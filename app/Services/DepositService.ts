import User from '#models/user'
import Transaction from '#models/transaction'
import Deposit from '#models/deposit'
import { BlockchainService } from '#services/BlockchainService'
import BonusService from '#services/BonusService'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'

export class DepositService {
  private blockchainService: BlockchainService
  private bonusService: BonusService

  constructor() {
    this.blockchainService = new BlockchainService()
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
        // We wrap EACH deposit processing in its own DB transaction to ensure atomic operations
        // and prevent race conditions (double crediting).
        await db.transaction(async (trx) => {
          // 1. Lock the row immediately. This prevents any other process from reading/writing 
          // to this specific deposit row until we are done.
          const depositIntent = await Deposit.query({ client: trx })
            .where('id', id)
            .where('status', 'pending')
            .forUpdate() // <--- CRITICAL: This waits if another process is working on this row
            .first()

          // If null, it means another process already finished it or it's no longer pending
          if (!depositIntent) return

          const { address, network } = depositIntent

          if (!['ERC20', 'BEP20'].includes(network)) return

          try {
            // 2. Check the balance (External API Call - holds the DB lock, but necessary for safety)
            const balance = await this.blockchainService.getUSDTBalance(
              address,
              network as 'ERC20' | 'BEP20'
            )

            // If there is a balance, process it
            if (balance > 0) {
              // Try to find TX Hash (Optional info)
              let txHash = null
              try {
                const recentDeposits = await this.blockchainService.getDepositsForAddress(
                  address,
                  network as 'ERC20' | 'BEP20'
                )
                if (recentDeposits.length > 0) {
                  txHash = recentDeposits[recentDeposits.length - 1].txHash
                }
              } catch (hashError) {
                logger.warn(`Could not retrieve txHash: ${hashError.message}`)
              }

              const wallet = await user.related('wallet').query({ client: trx }).firstOrFail()

              // 3. Update Wallet & Create Transaction ATOMICALLY
              wallet.balance = Number(wallet.balance) + balance
              await wallet.useTransaction(trx).save()

              await Transaction.create(
                {
                  walletId: wallet.id,
                  amount: balance,
                  type: 'deposit',
                  description: txHash
                    ? `Dépôt de ${balance} USDT confirmé (TXID: ${txHash})`
                    : `Dépôt de ${balance} USDT détecté sur l'adresse ${address}.`,
                  status: 'completed',
                },
                { client: trx }
              )

              // 4. Mark deposit as completed
              depositIntent.status = 'completed'
              await depositIntent.useTransaction(trx).save()

              logger.info(`Processed deposit of ${balance} for user ${user.id}`)

              // Bonus processing (can be outside the main locking transaction to keep it fast, 
              // or inside if strict consistency is needed. Here we do it after commit implicitly 
              // but we need to pass the user context properly, usually separate is fine for bonuses)
            }
          } catch (error) {
            logger.error(error, `Error checking balance for deposit ${id}`)
            throw error // Rollback transaction on error
          }
        })

        // Process bonus independently after the secure transaction to avoid long locks
        // Re-fetch fresh user/wallet data if needed for bonus logic
        await this.bonusService.processReferralDepositBonus(user)
      }
    } catch (error) {
      logger.error(error, `Failed to process pending deposits for user ${user.id}`)
    } finally {
      logger.info(`Finished pending deposit check for user ${user.id}`)
    }
  }
}
