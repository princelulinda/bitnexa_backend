import Wallet from '#models/wallet'
import Transaction from '#models/transaction'
import Deposit from '#models/deposit'
import { DateTime } from 'luxon'
import {
  generateDepositAddressValidator,
  withdrawValidator,
  claimGainsValidator,
  investValidator,
} from '#validators/wallet'
import { CryptoAddressGenerator } from '#services/CryptoAddressGenerator'
import { BlockchainService } from '#services/BlockchainService' // Import the class
import type { HttpContext } from '@adonisjs/core/http'

export default class WalletsController {
  private cryptoAddressGenerator: CryptoAddressGenerator
  private blockchainService: BlockchainService // Declare the service

  constructor() {
    this.cryptoAddressGenerator = new CryptoAddressGenerator()
    this.blockchainService = new BlockchainService() // Instantiate the service
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
      // Increment deposit counter for unique address derivation
      user.depositCounter = user.depositCounter + 1
      await user.save()

      const newCryptoAddress = await this.cryptoAddressGenerator.generateAddress(
        normalizedCurrency,
        normalizedNetwork,
        user.depositCounter // Pass the new deposit counter
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
    }

    return response.ok({
      message: 'Deposit processing status updated.',
      walletBalance: wallet.balance,
      transactionStatus: transaction.status,
    })
  }

  /** 💸 Demande de retrait */
  async withdrawRequest({ request, response, auth }: HttpContext) {
    const { amount, cryptoAddress, network } = await request.validateUsing(withdrawValidator)
    const user = auth.user!
    const wallet = await user.related('wallet').query().firstOrFail()

    if (Number(wallet.balance) < amount) {
      return response.badRequest('Solde insuffisant pour le retrait.')
    }

    wallet.balance = Number(wallet.balance) - amount
    await wallet.save()

    const transaction = await Transaction.create({
      walletId: wallet.id,
      amount,
      type: 'withdrawal',
      description: `Demande de retrait de ${amount} ${wallet.currency} sur ${network} vers ${cryptoAddress}`,
      status: 'pending_admin_approval',
    })

    return response.accepted({
      message: "Demande de retrait initiée. En attente d'approbation administrative.",
      transactionId: transaction.id,
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

  /** ❌ Rejeter un retrait */
  async rejectWithdrawal({ response, params }: HttpContext) {
    const { transactionId } = params
    const transaction = await Transaction.findOrFail(transactionId)
    const wallet = await Wallet.findOrFail(transaction.walletId)

    wallet.balance = Number(wallet.balance) + transaction.amount
    await wallet.save()

    transaction.status = 'rejected'
    transaction.description = `Retrait de ${transaction.amount} rejeté. Fonds retournés.`
    await transaction.save()

    return response.ok('Retrait rejeté et fonds retournés.')
  }

  public async checkDepositStatus({ auth, response }: HttpContext) {
    const user = auth.user!
    const userDeposits = await user.related('deposits').query().where('status', 'pending')

    const processedDeposits: { network: string; txHash: string; amount: number }[] = []
    const errors: { network: string; message: string }[] = []

    for (const depositIntent of userDeposits) {
      const { address, network } = depositIntent

      // Ne traiter que les réseaux ERC20 et BEP20
      if (!['ERC20', 'BEP20'].includes(network)) continue

      try {
        // 🔹 Vérification blockchain (via ton service)
        const depositLogs = await this.blockchainService.getDepositsForAddress(
          address,
          '0x55d398326f99059fF775485246999027B3197955' as 'ERC20' | 'BEP20'
        )
        console.log(depositLogs, 'PPP')
        if (!depositLogs || depositLogs.length === 0) {
          continue
        }

        for (const log of depositLogs) {
          const { txHash, amount } = log

          if (!txHash || amount <= 0) {
            errors.push({ network, message: `Transaction log incomplete for ${network}.` })
            continue
          }

          // 🔹 Vérifier si la transaction a déjà été traitée
          const existingTransaction = await Transaction.query()
            .where('description', `Dépôt confirmé (TXID: ${txHash})`)
            .first()

          if (existingTransaction) continue

          // 🔹 Créditer le wallet
          const wallet = await user.related('wallet').query().firstOrFail()
          wallet.balance = Number(wallet.balance) + amount
          await wallet.save()

          // 🔹 Créer la transaction
          await Transaction.create({
            walletId: wallet.id,
            amount,
            type: 'deposit',
            description: `Dépôt confirmé (TXID: ${txHash})`,
            status: 'completed',
          })

          // 🔹 Mettre à jour l’intention de dépôt
          depositIntent.status = 'completed'
          await depositIntent.save()

          processedDeposits.push({ network, txHash, amount })
        }
      } catch (error) {
        console.error(`❌ Erreur pour ${network} (${address}) :`, error)
        errors.push({
          network,
          message: `Erreur lors de la vérification du dépôt sur ${network}.`,
        })
      }
    }
    return response.ok({
      message: '✅ Vérification des dépôts terminée.',
      processedDeposits,
      errors,
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
