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
import mail from '@adonisjs/mail/services/main'
import type { HttpContext } from '@adonisjs/core/http'

export default class WalletsController {
  private cryptoAddressGenerator: CryptoAddressGenerator
  private depositService: DepositService
  private bonusService: BonusService

  constructor() {
    this.cryptoAddressGenerator = new CryptoAddressGenerator()
    this.depositService = new DepositService()
    this.bonusService = new BonusService()
  }

  /** 🧾 Afficher le solde du portefeuille de l'utilisateur */
  async show({ auth, response }: HttpContext) {
    const user = auth.user!
    const wallet = await user.related('wallet').query().firstOrFail()
    return response.ok(wallet)
  }

  /** ⚙️ Générer une adresse de dépôt */
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
      const newCryptoAddress = await this.cryptoAddressGenerator.generateAddress(
        normalizedCurrency,
        normalizedNetwork,
        user.hdIndex // Pass the unique user HD index
      )

      // Set expiration for 24 hours from now
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

  /** 💰 Traiter les dépôts confirmés */
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
      .where('description', `Dépôt confirmé (TXID: ${txid})`)
      .where('status', 'completed')
      .first()

    if (existingTransaction) {
      return response.conflict('Transaction already processed.')
    }

    let transaction = await Transaction.query()
      .where('description', `Dépôt en attente (TXID: ${txid})`)
      .first()

    if (!transaction) {
      transaction = await Transaction.create({
        walletId: wallet.id,
        amount,
        type: 'deposit',
        description: `Dépôt en attente (TXID: ${txid})`,
        status: 'pending_blockchain_confirmation',
      })
    }

    const requiredConfirmations = 3
    if (confirmations >= requiredConfirmations && transaction.status !== 'completed') {
      wallet.balance = Number(wallet.balance) + amount
      await wallet.save()

      transaction.status = 'completed'
      transaction.description = `Dépôt confirmé (TXID: ${txid})`
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

  /** 💸 Demande de retrait */
  async withdrawRequest({ request, response, auth }: HttpContext) {
    const { amount, cryptoAddress, network, otp } = await request.validateUsing(withdrawValidator)
    const user = auth.user!

    // Vérification 2FA si activée
    if (user.isTwoFactorEnabled) {
      if (!otp) {
        return response.badRequest('Code 2FA requis pour effectuer un retrait.')
      }

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret!,
        encoding: 'base32',
        token: otp,
        window: 1, // Tolérance de +/- 30 secondes
      })

      if (!verified) {
        return response.badRequest('Code 2FA invalide.')
      }
    }

    const wallet = await user.related('wallet').query().firstOrFail()
    // Apply a 5% withdrawal fee
    const fee = Math.round(Number(amount) * 0.05 * 100) / 100 // round to 2 decimals
    const totalDeduction = Math.round((Number(amount) + fee) * 100) / 100

    if (Number(wallet.balance) < totalDeduction) {
      return response.badRequest('Solde insuffisant pour le retrait et les frais associés.')
    }

    // Deduct total (amount + fee) immediately
    wallet.balance = Math.round((Number(wallet.balance) - totalDeduction) * 100) / 100
    await wallet.save()

    // Create the withdrawal transaction (pending admin approval)
    const transaction = await Transaction.create({
      walletId: wallet.id,
      amount,
      type: 'withdrawal',
      description: `Demande de retrait de ${amount} ${wallet.currency} sur ${network} vers ${cryptoAddress}`,
      status: 'pending_admin_approval',
    })

    // Create a separate fee transaction (completed)
    await Transaction.create({
      walletId: wallet.id,
      amount: fee,
      type: 'withdrawal_fee',
      description: `Fee for withdrawal ${transaction.id}`,
      status: 'completed',
    })

    return response.accepted({
      message: "Demande de retrait initiée. En attente d'approbation administrative.",
      transactionId: transaction.id,
      fee,
    })
  }

  /** ✅ Admin approuve un retrait */
  async approveWithdrawal({ response, params }: HttpContext) {
    const { transactionId } = params

    const transaction = await Transaction.query()
      .where('id', transactionId)
      .where('type', 'withdrawal')
      .where('status', 'pending_admin_approval')
      .firstOrFail()

    transaction.status = 'processing_withdrawal'
    transaction.description = `Retrait de ${transaction.amount} approuvé. Envoi en cours.`
    await transaction.save()

    return response.ok({
      message: "Retrait approuvé. L'envoi de la cryptomonnaie est en cours.",
      transactionId: transaction.id,
    })
  }

  /** 🏁 Confirmer un retrait (Envoi effectué) */
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
    transaction.description = `Retrait de ${transaction.amount} envoyé. TXID: ${txid}`
    await transaction.save()

    // Send confirmation email
    await mail.send((message) => {
      message
        .to(user.email)
        .subject('Retrait confirmé - Trsbit')
        .htmlView('emails/withdrawal_confirmed', {
          user,
          amount: transaction.amount,
          network: 'USDT', // Assuming USDT as it's the only one in validator
          txid,
        })
    })

    return response.ok({
      message: 'Retrait confirmé et email envoyé.',
      transactionId: transaction.id,
    })
  }

  /** ❌ Rejeter un retrait */
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
    transaction.description = `Retrait de ${transaction.amount} rejeté. Raison : ${reason}`
    await transaction.save()

    // Send rejection email
    await mail.send((message) => {
      message
        .to(user.email)
        .subject('Demande de retrait rejetée - Trsbit')
        .htmlView('emails/withdrawal_rejected', {
          user,
          amount: transaction.amount,
          reason,
        })
    })

    return response.ok('Retrait rejeté, fonds retournés et email envoyé.')
  }

  /** 📋 Lister les retraits en attente (Admin) */
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
      message: 'Vérification des dépôts initiée. Les nouveaux dépôts apparaîtront sous peu.',
    })
  }

  /** 💹 Investir des fonds */
  async investFunds({ request, auth, response }: HttpContext) {
    const { amount } = await request.validateUsing(investValidator)
    const user = auth.user!
    const wallet = await user.related('wallet').query().firstOrFail()

    if (amount <= 0) return response.badRequest('Amount must be positive.')
    if (Number(wallet.balance) < amount)
      return response.badRequest('Solde insuffisant pour investir.')

    wallet.balance = Number(wallet.balance) - amount
    wallet.investmentBalance = Number(wallet.investmentBalance) + amount
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

  /** 🎁 Réclamer les gains */
  async claimGains({ request, auth, response }: HttpContext) {
    const { amount } = await request.validateUsing(claimGainsValidator)
    const user = auth.user!
    const wallet = await user.related('wallet').query().firstOrFail()

    if (amount <= 0) return response.badRequest('Amount must be positive.')
    if (Number(wallet.gainsBalance) < amount)
      return response.badRequest('Insufficient gains balance.')

    wallet.gainsBalance = Number(wallet.gainsBalance) - amount
    wallet.balance = Number(wallet.balance) + amount
    await wallet.save()

    await Transaction.create({
      walletId: wallet.id,
      amount,
      type: 'claim_gains',
      description: `Claimed ${amount} from gains balance.`,
      status: 'completed',
    })

    return response.ok({ message: 'Gains claimed successfully.', wallet })
  }

  /** 📜 Afficher l'historique des transactions de l'utilisateur */
  async getTransactions({ auth, response }: HttpContext) {
    const user = auth.user!
    const wallet = await user.related('wallet').query().firstOrFail()
    const transactions = await wallet.related('transactions').query().orderBy('createdAt', 'desc')

    return response.ok(transactions)
  }
}
