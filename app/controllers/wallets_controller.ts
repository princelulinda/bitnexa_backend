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

  async show({ auth, response }: HttpContext) {
    const user = auth.user!
    const wallet = await user.related('wallet').query().firstOrFail()
    return response.ok(wallet)
  }

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
      return response.ok({
        message: `Use this address to deposit ${normalizedCurrency} on ${normalizedNetwork}`,
        address: deposit.address,
        currency: deposit.currency,
        network: deposit.network,
        status: deposit.status,
        expiresAt: deposit.expiresAt,
      })
    }

    try {
      await user.refresh()
      if (user.hdIndex === null || user.hdIndex === undefined) {
        const db = (await import('@adonisjs/lucid/services/db')).default
        await db.rawQuery(
          "UPDATE users SET hd_index = nextval('users_hd_index_seq') WHERE id = ? AND hd_index IS NULL",
          [user.id]
        )
        await user.refresh()
        if (user.hdIndex === null || user.hdIndex === undefined) {
          throw new Error('Failed to assign hdIndex to user.')
        }
      }

      const newCryptoAddress = await this.cryptoAddressGenerator.generateAddress(
        normalizedCurrency,
        normalizedNetwork,
        user.hdIndex
      )
      const expiresAt = DateTime.now().plus({ hours: 24 })
      deposit = await Deposit.create({
        userId: user.id,
        currency: normalizedCurrency,
        network: normalizedNetwork,
        address: newCryptoAddress,
        expectedAmount: 0,
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
      console.error('Error generating deposit address:', error.message)
      return response.internalServerError('Failed to generate deposit address.')
    }
  }

  async processConfirmedDepositInternal({ request, response }: HttpContext) {
    const { address, amount, currency, network, txid, confirmations } = request.only([
      'address', 'amount', 'currency', 'network', 'txid', 'confirmations',
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

    if (existingTransaction) return response.conflict('Transaction already processed.')

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

    if (confirmations >= 3 && transaction.status !== 'completed') {
      wallet.balance = Number(wallet.balance) + amount
      await wallet.save()
      transaction.status = 'completed'
      transaction.description = `Confirmed deposit (TXID: ${txid})`
      await transaction.save()
      await this.bonusService.processReferralDepositBonus(user)
    }

    return response.ok({
      message: 'Deposit processing status updated.',
      walletBalance: wallet.balance,
      transactionStatus: transaction.status,
    })
  }

  async withdrawRequest({ request, response, auth }: HttpContext) {
    const { amount, cryptoAddress, network, otp } = await request.validateUsing(withdrawValidator)
    const user = auth.user!

    if (user.isTwoFactorEnabled) {
      if (!otp) return response.badRequest('2FA code required to perform a withdrawal.')
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret!,
        encoding: 'base32',
        token: otp,
        window: 1,
      })
      if (!verified) return response.badRequest('Invalid 2FA code.')
    }

    const wallet = await user.related('wallet').query().firstOrFail()
    const fee = Math.round(Number(amount) * 0.05 * 100) / 100
    const totalDeduction = Math.round((Number(amount) + fee) * 100) / 100

    // Total withdrawable = balance + investmentBalance
    const totalAvailable = Math.round((Number(wallet.balance) + Number(wallet.investmentBalance)) * 100) / 100

    // Block withdrawal only if it would touch the locked capital
    const lockedCapital = Number(wallet.lockedCapital ?? 0)
    if (lockedCapital > 0 && wallet.withdrawalUnlockLevel !== null) {
      const userLevel = await user.related('referralLevel').query().first()
      const currentLevel = userLevel?.level ?? 0

      if (currentLevel < wallet.withdrawalUnlockLevel) {
        // Allow withdrawal only up to (balance + investmentBalance) minus locked capital
        const withdrawableBalance = Math.max(0, totalAvailable - lockedCapital)
        if (amount > withdrawableBalance) {
          return response.forbidden(
            `You can only withdraw up to $${withdrawableBalance.toFixed(2)}. Your balance includes $${lockedCapital} of locked capital that requires referral level ${wallet.withdrawalUnlockLevel} to unlock. Your current level is ${currentLevel}.`
          )
        }
      } else {
        // Level reached — remove the lock
        wallet.lockedCapital = 0
        wallet.withdrawalUnlockLevel = null
        await wallet.save()
      }
    }

    if (totalAvailable < totalDeduction) {
      return response.badRequest('Insufficient balance for withdrawal and associated fees.')
    }

    // Deduct from balance first, then investmentBalance if needed
    let remaining = totalDeduction
    const balanceDeduction = Math.min(Number(wallet.balance), remaining)
    wallet.balance = Math.round((Number(wallet.balance) - balanceDeduction) * 100) / 100
    remaining = Math.round((remaining - balanceDeduction) * 100) / 100
    if (remaining > 0) {
      wallet.investmentBalance = Math.round((Number(wallet.investmentBalance) - remaining) * 100) / 100
    }
    await wallet.save()

    const transaction = await Transaction.create({
      walletId: wallet.id,
      amount,
      type: 'withdrawal',
      description: `Withdrawal request of ${amount} USDT on ${network} to ${cryptoAddress}`,
      status: 'pending_admin_approval',
    })

    await Transaction.create({
      walletId: wallet.id,
      amount: fee,
      type: 'withdrawal_fee',
      description: `Fee for withdrawal ${transaction.id}`,
      status: 'completed',
    })

    this.withdrawalService.processWithdrawal(transaction.id).catch((err) => {
      console.error(`[Auto-Withdrawal] Failed for tx ${transaction.id}:`, err.message)
      this.telegramService.sendNewWithdrawalNotification(user, amount, transaction.id)
    })

    return response.accepted({
      message: 'Withdrawal initiated. Funds will be sent to your address shortly.',
      transactionId: transaction.id,
      fee,
    })
  }

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

    return response.ok({ message: 'Withdrawal approved.', transactionId: transaction.id })
  }

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

    await mail.send((message) => {
      message
        .to(user.email)
        .subject('Withdrawal confirmed')
        .htmlView('emails/withdrawal_confirmed', { user, amount: transaction.amount, network: 'USDT', txid })
    })

    return response.ok({ message: 'Withdrawal confirmed and email sent.', transactionId: transaction.id })
  }

  async rejectWithdrawal({ request, response, params }: HttpContext) {
    const { transactionId } = params
    const { reason } = await request.validateUsing(adminWithdrawRejectValidator)

    const transaction = await Transaction.findOrFail(transactionId)
    const wallet = await Wallet.findOrFail(transaction.walletId)
    const user = await wallet.related('user').query().firstOrFail()

    wallet.balance = Math.round((Number(wallet.balance) + Number(transaction.amount)) * 100) / 100

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

    await mail.send((message) => {
      message
        .to(user.email)
        .subject('Withdrawal request rejected')
        .htmlView('emails/withdrawal_rejected', { user, amount: transaction.amount, reason })
    })

    return response.ok('Withdrawal rejected, funds returned and email sent.')
  }

  async getPendingWithdrawals({ response }: HttpContext) {
    const transactions = await Transaction.query()
      .where('type', 'withdrawal')
      .whereIn('status', ['pending_admin_approval', 'processing_withdrawal'])
      .preload('wallet', (query) => { query.preload('user') })
      .orderBy('createdAt', 'desc')
    return response.ok(transactions)
  }

  async checkDepositStatus({ auth, response }: HttpContext) {
    const user = auth.user!
    this.depositService.processPendingDepositsForUser(user)
    return response.ok({ message: 'Deposit check initiated. New deposits will appear shortly.' })
  }

  async investFunds({ request, auth, response }: HttpContext) {
    const { amount } = await request.validateUsing(investValidator)
    const user = auth.user!
    const wallet = await user.related('wallet').query().firstOrFail()

    if (amount <= 0) return response.badRequest('Amount must be positive.')
    if (Number(wallet.balance) < amount) return response.badRequest('Insufficient balance to invest.')

    wallet.balance = Number(wallet.balance) - amount
    wallet.investmentBalance = Number(wallet.investmentBalance) + amount
    wallet.totalInvested = Number(wallet.totalInvested) + amount
    await wallet.save()

    if (wallet.bonusBalance > 0) {
      const bonusAmount = wallet.bonusBalance
      wallet.balance += bonusAmount
      wallet.bonusBalance = 0
      await wallet.save()
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

  async transferInvestmentToBalance({ request, auth, response }: HttpContext) {
    const { amount } = await request.validateUsing(claimGainsValidator)
    const user = auth.user!
    const wallet = await user.related('wallet').query().firstOrFail()

    if (amount <= 0) return response.badRequest('Amount must be positive.')
    if (Number(wallet.investmentBalance) < amount) return response.badRequest('Insufficient investment balance.')

    const currentInvestment = Number(wallet.investmentBalance)
    const investedCapital = Number(wallet.totalInvested)
    const doubleTarget = investedCapital * 2
    let fee = 0

    if (currentInvestment < doubleTarget) {
      fee = Math.round(amount * 0.2 * 100) / 100
    }

    wallet.investmentBalance = Number(wallet.investmentBalance) - amount
    wallet.balance = Number(wallet.balance) + (amount - fee)
    await wallet.save()

    await Transaction.create({
      walletId: wallet.id,
      amount,
      type: 'internal_transfer',
      description: `Transferred ${amount} from investment to balance.`,
      status: 'completed',
    })

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
      message: fee > 0 ? `Transfer successful. A 20% penalty (${fee}) was applied.` : 'Transfer successful.',
      wallet,
      feeApplied: fee > 0,
    })
  }

  async getTransactions({ auth, response }: HttpContext) {
    const user = auth.user!
    const wallet = await user.related('wallet').query().firstOrFail()
    const transactions = await wallet.related('transactions').query().orderBy('createdAt', 'desc')
    return response.ok(transactions)
  }
}
