import Wallet from '#models/wallet'
import Transaction from '#models/transaction'
import Deposit from '#models/deposit'
import { DateTime } from 'luxon'
import speakeasy from 'speakeasy'
import {
  generateDepositAddressValidator,
  withdrawValidator,
  claimGainsValidator,
  investValidator,
  adminWithdrawConfirmValidator,
  adminWithdrawRejectValidator,
} from '#validators/wallet'
import { CryptoAddressGenerator } from '#services/CryptoAddressGenerator'
import { DepositService } from '#services/DepositService'
import BonusService from '#services/BonusService'
import TelegramNotificationService from '#services/TelegramNotificationService'
import WithdrawalService from '#services/WithdrawalService'
import mail from '@adonisjs/mail/services/main'
import type { HttpContext } from '@adonisjs/core/http'

export default class WalletsController {
  private cryptoAddressGenerator: CryptoAddressGenerator
  private depositService: DepositService
  private bonusService: BonusService
  private telegramService: TelegramNotificationService
  private withdrawalService: WithdrawalService

  constructor() {
    this.cryptoAddressGenerator = new CryptoAddressGenerator()
    this.depositService = new DepositService()
    this.bonusService = new BonusService()
    this.telegramService = new TelegramNotificationService()
    this.withdrawalService = new WithdrawalService()
  }

  /** 🧾 Display user wallet balance */
  async show({ auth, response }: HttpContext) {
    const user = auth.user!
    const wallet = await user.related('wallet').query().firstOrFail()
    return response.ok(wallet)
  }

  /** ⚙️ Generate a deposit address */
  async generateDepositAddress({ request, response, auth }: HttpContext) {
    const { currency, network } = await request.validateUsing(generateDepositAddressValidator)
    const user = auth.user!
    const normalizedCurrency = currency.toUpperCase()
    const normalizedNetwork = network.toUpperCase()
    let deposit = await Deposit.query()
      .where('userId', user.id)
      .where('currency', normalizedCurrency)
      .where('network', normalizedNetwork)
      .where('status', 'pending')
      .first()

    if (deposit && deposit.expiresAt && deposit.expiresAt > DateTime.now()) {
      // If a pending deposit exists and is not expired, return its address
      return response.ok({
        message: `Use this address to deposit ${normalizedCurrency} on ${normalizedNetwork}`,
        address: deposit.address,
        currency: deposit.currency,
        network: deposit.network,
        status: deposit.status,
        expiresAt: deposit.expiresAt,
      })
    }

                // 2. If no pending or expired deposit, generate a new address
              try {
                // Ensure we have the latest user data including hdIndex
                await user.refresh()
                
                console.log(`[generateDepositAddress] User ID: ${user.id}, hdIndex: ${user.hdIndex}`)
          
                if (user.hdIndex === null || user.hdIndex === undefined) {
                   console.warn(`[generateDepositAddress] User ${user.id} has null hdIndex. Attempting to fix...`)
                   // This should ideally not happen if DB defaults and migrations are correct, 
                   // but as a fallback we can try to rely on the DB default or assign one.
                   // Since we can't easily "assign nextval" from here without raw query:
                   
                   const db = (await import('@adonisjs/lucid/services/db')).default
                   // Force update this user with a new index
                   await db.rawQuery("UPDATE users SET hd_index = nextval('users_hd_index_seq') WHERE id = ? AND hd_index IS NULL", [user.id])
                   
                   await user.refresh()
                   
                   if (user.hdIndex === null || user.hdIndex === undefined) {
                       throw new Error('Failed to assign hdIndex to user.')
                   }
                }
          
                const newCryptoAddress = await this.cryptoAddressGenerator.generateAddress(
                  normalizedCurrency,
                  normalizedNetwork,
                  user.hdIndex // Pass the unique user HD index
                )      // Set expiration for 24 hours from now
      const expiresAt = DateTime.now().plus({ hours: 24 })

      // Create a new Deposit record
      deposit = await Deposit.create({
        userId: user.id,
        currency: normalizedCurrency,
        network: normalizedNetwork,
        address: newCryptoAddress,
        expectedAmount: 0, // Amount is not required anymore
        status: 'pending',
        expiresAt: expiresAt,
      })

      return response.ok({
        message: `Use this address to deposit ${normalizedCurrency} on ${normalizedNetwork}`,
        address: deposit.address,
        currency: deposit.currency,
        network: deposit.network,
        status: deposit.status,
        expiresAt: deposit.expiresAt,
      })
    } catch (error) {
      console.error('❌ Error generating deposit address:', error.message)
      return response.internalServerError('Failed to generate deposit address.')
    }
  }

  /** 💰 Process confirmed deposits */
  async processConfirmedDepositInternal({ request, response }: HttpContext) {
    const { address, amount, currency, network, txid, confirmations } = request.only([
      'address',
      'amount',
      'currency',
      'network',
      'txid',
      'confirmations',
    ])

    if (!address || !amount || !currency || !network || !txid || confirmations === undefined) {
      return response.badRequest('Missing required parameters.')
    }

    const depositAddressRecord = await Deposit.query()
      .where('address', address)
      .where('currency', currency)
      .where('network', network)
      .firstOrFail()

    const user = await depositAddressRecord.related('user').query().firstOrFail()
    const wallet = await user.related('wallet').query().firstOrFail()

    const existingTransaction = await Transaction.query()
      .where('description', `Confirmed deposit (TXID: ${txid})`)
      .where('status', 'completed')
      .first()

    if (existingTransaction) {
      return response.conflict('Transaction already processed.')
    }

    let transaction = await Transaction.query()
      .where('description', `Pending deposit (TXID: ${txid})`)
      .first()

    if (!transaction) {
      transaction = await Transaction.create({
        walletId: wallet.id,
        amount,
        type: 'deposit',
        description: `Pending deposit (TXID: ${txid})`,
        status: 'pending_blockchain_confirmation',
      })
    }

    const requiredConfirmations = 3
    if (confirmations >= requiredConfirmations && transaction.status !== 'completed') {
      wallet.balance = Number(wallet.balance) + amount
      await wallet.save()

      transaction.status = 'completed'
      transaction.description = `Confirmed deposit (TXID: ${txid})`
      await transaction.save()

      // Check and grant referral bonuses if this is the first deposit
      await this.bonusService.processReferralDepositBonus(user)
    }

    return response.ok({
      message: 'Deposit processing status updated.',
      walletBalance: wallet.balance,
      transactionStatus: transaction.status,
    })
  }

  /** 💸 Withdrawal request */
  async withdrawRequest({ request, response, auth }: HttpContext) {
    const { amount, cryptoAddress, network, otp } = await request.validateUsing(withdrawValidator)
    const user = auth.user!

    // 2FA verification if enabled
    if (user.isTwoFactorEnabled) {
      if (!otp) {
        return response.badRequest('2FA code required to perform a withdrawal.')
      }

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret!,
        encoding: 'base32',
        token: otp,
        window: 1,
      })

      if (!verified) {
        return response.badRequest('Invalid 2FA code.')
      }
    }

    const wallet = await user.related('wallet').query().firstOrFail()
    const fee = Math.round(Number(amount) * 0.05 * 100) / 100
    const totalDeduction = Math.round((Number(amount) + fee) * 100) / 100

    if (Number(wallet.balance) < totalDeduction) {
      return response.badRequest('Insufficient balance for withdrawal and associated fees.')
    }

    // Deduct total (amount + fee) immediately
    wallet.balance = Math.round((Number(wallet.balance) - totalDeduction) * 100) / 100
    await wallet.save()

    // Create the withdrawal transaction
    const transaction = await Transaction.create({
      walletId: wallet.id,
      amount,
      type: 'withdrawal',
      description: `Withdrawal request of ${amount} USDT on ${network} to ${cryptoAddress}`,
      status: 'pending_admin_approval',
    })

    // Create fee transaction
    await Transaction.create({
      walletId: wallet.id,
      amount: fee,
      type: 'withdrawal_fee',
      description: `Fee for withdrawal ${transaction.id}`,
      status: 'completed',
    })

    // 🚀 Process automatically in background (non-blocking)
    this.withdrawalService.processWithdrawal(transaction.id).catch((err) => {
      console.error(`[Auto-Withdrawal] Failed for tx ${transaction.id}:`, err.message)
      // Notify admin via Telegram as fallback
      this.telegramService.sendNewWithdrawalNotification(user, amount, transaction.id)
    })

    return response.accepted({
      message: 'Withdrawal initiated. Funds will be sent to your address shortly.',
      transactionId: transaction.id,
      fee,
    })
  }

  /** ✅ Admin approves a withdrawal */
  async approveWithdrawal({ response, params }: HttpContext) {
    const { transactionId } = params

    const transaction = await Transaction.query()
      .where('id', transactionId)
      .where('type', 'withdrawal')
      .where('status', 'pending_admin_approval')
      .firstOrFail()

    transaction.status = 'processing_withdrawal'
    transaction.description = `Withdrawal of ${transaction.amount} approved. Sending in progress.`
    await transaction.save()

    return response.ok({
      message: "Withdrawal approved. Cryptocurrency transfer in progress.",
      transactionId: transaction.id,
    })
  }

  /** 🏁 Confirm a withdrawal (Sent) */
  async confirmWithdrawal({ request, response, params }: HttpContext) {
    const { transactionId } = params
    const { txid } = await request.validateUsing(adminWithdrawConfirmValidator)

    const transaction = await Transaction.query()
      .where('id', transactionId)
      .where('type', 'withdrawal')
      .where('status', 'processing_withdrawal')
      .firstOrFail()

    const wallet = await Wallet.findOrFail(transaction.walletId)
    const user = await wallet.related('user').query().firstOrFail()

    transaction.status = 'completed'
    transaction.description = `Withdrawal of ${transaction.amount} sent. TXID: ${txid}`
    await transaction.save()

    // Send confirmation email
    await mail.send((message) => {
      message
        .to(user.email)
        .subject('Withdrawal confirmed - Trsbit')
        .htmlView('emails/withdrawal_confirmed', {
          user,
          amount: transaction.amount,
          network: 'USDT', // Assuming USDT as it's the only one in validator
          txid,
        })
    })

    return response.ok({
      message: 'Withdrawal confirmed and email sent.',
      transactionId: transaction.id,
    })
  }

  /** ❌ Reject a withdrawal */
  async rejectWithdrawal({ request, response, params }: HttpContext) {
    const { transactionId } = params
    const { reason } = await request.validateUsing(adminWithdrawRejectValidator)

    const transaction = await Transaction.findOrFail(transactionId)
    const wallet = await Wallet.findOrFail(transaction.walletId)
    const user = await wallet.related('user').query().firstOrFail()

    // Refund the withdrawal amount
    wallet.balance = Math.round((Number(wallet.balance) + Number(transaction.amount)) * 100) / 100

    // Also try to find and refund the associated fee transaction (if exists)
    const feeTransaction = await Transaction.query()
      .where('walletId', wallet.id)
      .where('type', 'withdrawal_fee')
      .where('description', `Fee for withdrawal ${transaction.id}`)
      .first()

    if (feeTransaction) {
      wallet.balance = Math.round((Number(wallet.balance) + Number(feeTransaction.amount)) * 100) / 100
      feeTransaction.status = 'rejected'
      feeTransaction.description = `Fee for withdrawal ${transaction.id} refunded due to rejection.`
      await feeTransaction.save()
    }

    await wallet.save()

    transaction.status = 'rejected'
    transaction.description = `Withdrawal of ${transaction.amount} rejected. Reason: ${reason}`
    await transaction.save()

    // Send rejection email
    await mail.send((message) => {
      message
        .to(user.email)
        .subject('Withdrawal request rejected - Trsbit')
        .htmlView('emails/withdrawal_rejected', {
          user,
          amount: transaction.amount,
          reason,
        })
    })

    return response.ok('Withdrawal rejected, funds returned and email sent.')
  }

  /** 📋 List pending withdrawals (Admin) */
  async getPendingWithdrawals({ response }: HttpContext) {
    const transactions = await Transaction.query()
      .where('type', 'withdrawal')
      .whereIn('status', ['pending_admin_approval', 'processing_withdrawal'])
      .preload('wallet', (query) => {
        query.preload('user')
      })
      .orderBy('createdAt', 'desc')

    return response.ok(transactions)
  }

  public async checkDepositStatus({ auth, response }: HttpContext) {
    const user = auth.user!

    // The service will run in the background. We don't await it here.
    this.depositService.processPendingDepositsForUser(user)

    return response.ok({
      message: 'Deposit check initiated. New deposits will appear shortly.',
    })
  }

  /** 💹 Invest funds */
  async investFunds({ request, auth, response }: HttpContext) {
    const { amount } = await request.validateUsing(investValidator)
    const user = auth.user!
    const wallet = await user.related('wallet').query().firstOrFail()

    if (amount <= 0) return response.badRequest('Amount must be positive.')
    if (Number(wallet.balance) < amount)
      return response.badRequest('Insufficient balance to invest.')

    wallet.balance = Number(wallet.balance) - amount
    wallet.investmentBalance = Number(wallet.investmentBalance) + amount
    // Track total invested capital
    wallet.totalInvested = Number(wallet.totalInvested) + amount
    await wallet.save()

    // Check if bonusBalance exists and transfer it to main balance
    if (wallet.bonusBalance > 0) {
      const bonusAmount = wallet.bonusBalance
      wallet.balance += bonusAmount
      wallet.bonusBalance = 0
      await wallet.save() // Save again after bonus transfer

      await Transaction.create({
        walletId: wallet.id,
        amount: bonusAmount,
        type: 'bonus_transfer',
        description: 'Welcome bonus transferred to main balance upon first investment.',
        status: 'completed',
      })
    }

    await Transaction.create({
      walletId: wallet.id,
      amount,
      type: 'investment',
      description: `Invested ${amount} from main balance.`,
      status: 'completed',
    })

    return response.ok({ message: 'Funds invested successfully.', wallet })
  }

  /** 🔄 Transfer investment to main balance */
  async transferInvestmentToBalance({ request, auth, response }: HttpContext) {
    const { amount } = await request.validateUsing(claimGainsValidator) // Reusing amount validator
    const user = auth.user!
    const wallet = await user.related('wallet').query().firstOrFail()

    if (amount <= 0) return response.badRequest('Amount must be positive.')
    if (Number(wallet.investmentBalance) < amount)
      return response.badRequest('Insufficient investment balance.')

    const currentInvestment = Number(wallet.investmentBalance)
    const investedCapital = Number(wallet.totalInvested)
    const doubleTarget = investedCapital * 2

    let fee = 0
    let feeDescription = ''
    const netAmount = amount - fee

    // Update Balances
    wallet.investmentBalance = Number(wallet.investmentBalance) - amount
    wallet.balance = Number(wallet.balance) + netAmount
    
    // We do NOT decrease 'totalInvested'. The user's initial capital baseline remains.
    
    await wallet.save()

    // 1. Transaction for the transfer out
    await Transaction.create({
      walletId: wallet.id,
      amount: amount,
      type: 'internal_transfer',
      description: `Transferred ${amount} from investment to balance${feeDescription}.`,
      status: 'completed',
    })

    // 2. Transaction for the fee (if any)
    if (fee > 0) {
      await Transaction.create({
        walletId: wallet.id,
        amount: fee,
        type: 'transfer_fee',
        description: `Penalty fee for early transfer (Target: ${doubleTarget}, Current: ${currentInvestment})`,
        status: 'completed',
      })
    }

    return response.ok({ 
      message: fee > 0 
        ? `Transfer successful. A 20% penalty (${fee}) was applied.` 
        : 'Transfer successful.', 
      wallet,
      feeApplied: fee > 0
    })
  }

  /** 📜 Display user transaction history */
  async getTransactions({ auth, response }: HttpContext) {
    const user = auth.user!
    const wallet = await user.related('wallet').query().firstOrFail()
    const transactions = await wallet.related('transactions').query().orderBy('createdAt', 'desc')

    return response.ok(transactions)
  }
}
