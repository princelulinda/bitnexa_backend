import User from '#models/user'
import Transaction from '#models/transaction'
import { BlockchainService } from '#services/BlockchainService'
import BonusService from '#services/BonusService'
import logger from '@adonisjs/core/services/logger'

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
      const userDeposits = await user.related('deposits').query().where('status', 'pending')

      if (userDeposits.length === 0) {
        return // No pending deposits to check
      }

      for (const depositIntent of userDeposits) {
        const { address, network } = depositIntent

        if (!['ERC20', 'BEP20'].includes(network)) continue

        try {
          // Check the balance of the unique deposit address
          const balance = await this.blockchainService.getUSDTBalance(
            address,
            network as 'ERC20' | 'BEP20'
          )

          // If there is a balance, process it as a new deposit
          if (balance > 0) {
            const wallet = await user.related('wallet').query().firstOrFail()

            // Credit the user's wallet
            wallet.balance = Number(wallet.balance) + balance
            await wallet.save()

            // Create a transaction record for this deposit
            await Transaction.create({
              walletId: wallet.id,
              amount: balance,
              type: 'deposit',
              // We don't have a txHash with this method, which is a trade-off for performance.
              description: `Dépôt de ${balance} USDT détecté sur l'adresse ${address}.`,
              status: 'completed',
            })

            // Mark the deposit intent as completed so it's not checked again
            depositIntent.status = 'completed'
            await depositIntent.save()

            logger.info(`Processed deposit of ${balance} for user ${user.id} on address ${address}`)

            // Check and grant referral bonuses if this is the first deposit
            await this.bonusService.processReferralDepositBonus(user)
          }
        } catch (error) {
          logger.error(error, `Error checking balance for ${network} (${address}) for user ${user.id}`)
        }
      }
    } catch (error) {
      logger.error(error, `Failed to process pending deposits for user ${user.id}`)
    } finally {
      logger.info(`Finished pending deposit check for user ${user.id}`)
    }
  }
}
