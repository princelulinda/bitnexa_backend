import User from '#models/user'
import Transaction from '#models/transaction'
import Deposit from '#models/deposit'
import { BlockchainService } from '#services/BlockchainService'
import { CryptoAddressGenerator } from '#services/CryptoAddressGenerator'
import BonusService from '#services/BonusService'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'

export class DepositService {
  private blockchainService: BlockchainService
  private cryptoGenerator: CryptoAddressGenerator
  private bonusService: BonusService

  constructor() {
    this.blockchainService = new BlockchainService()
    this.cryptoGenerator = new CryptoAddressGenerator()
    this.bonusService = new BonusService()
  }

  /**
   * Scans for pending deposits for a given user by checking the balance of single-use addresses.
   * @param user The user for whom to check deposits.
   */
  public async processPendingDepositsForUser(user: User): Promise<void> {
    logger.info(`Starting pending deposit check for user ${user.id} using balance method.`)
    try {
      // Get IDs first to iterate safely
      const pendingDepositIds = await user
        .related('deposits')
        .query()
        .where('status', 'pending')
        .select('id')

      if (pendingDepositIds.length === 0) {
        return
      }

      for (const { id } of pendingDepositIds) {
        // We wrap EACH deposit processing in its own DB transaction
        await db.transaction(async (trx) => {
          const depositIntent = await Deposit.query({ client: trx })
            .where('id', id)
            .where('status', 'pending')
            .forUpdate()
            .first()

          if (!depositIntent) return

          const { address, network } = depositIntent

          if (!['ERC20', 'BEP20'].includes(network)) return

          try {
            const currentBalance = await this.blockchainService.getUSDTBalance(
              address,
              network as 'ERC20' | 'BEP20'
            )

            const lastBalance = Number(depositIntent.lastDetectedBalance || 0)

            if (currentBalance > lastBalance) {
              const amountToCredit = currentBalance - lastBalance
              
              logger.info(`New funds detected for user ${user.id}: ${amountToCredit} USDT`)

              const wallet = await user.related('wallet').query({ client: trx }).firstOrFail()

              // 1. Créditer le compte utilisateur
              wallet.balance = Number(wallet.balance) + amountToCredit
              await wallet.useTransaction(trx).save()

              await Transaction.create(
                {
                  walletId: wallet.id,
                  amount: amountToCredit,
                  type: 'deposit',
                  description: `Dépôt de ${amountToCredit} USDT détecté sur l'adresse ${address}.`,
                  status: 'completed',
                },
                { client: trx }
              )

              depositIntent.lastDetectedBalance = currentBalance
              await depositIntent.useTransaction(trx).save()

              // 2. Transférer (Sweep) vers le portefeuille principal
              // On fait cela APRÈS avoir crédité l'utilisateur pour ne pas le faire attendre
              // et on l'exécute de manière asynchrone (non-bloquante pour la DB)
              this.triggerSweep(user, network as 'ERC20' | 'BEP20')
            }
          } catch (error) {
            logger.error(error, `Error checking balance for deposit ${id}`)
            throw error 
          }
        })
      }
    } catch (error) {
      logger.error(error, `Failed to process pending deposits for user ${user.id}`)
    }
  }

  /**
   * Déclenche le transfert des fonds vers le portefeuille principal en arrière-plan.
   */
  private async triggerSweep(user: User, network: 'ERC20' | 'BEP20') {
    try {
      logger.info(`[Sweeper] Initiating sweep for user ${user.id} (${network})`)
      const depositWallet = this.cryptoGenerator.getWallet(network, user.hdIndex)
      
      const txHash = await this.blockchainService.sweepUSDT(depositWallet, network)
      logger.info(`[Sweeper] Sweep successful for user ${user.id}. TX: ${txHash}`)
    } catch (error) {
      logger.error(error, `[Sweeper] Failed to sweep funds for user ${user.id}`)
    }
  }
}
