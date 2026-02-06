import { BaseCommand } from '@adonisjs/core/ace'
import Deposit from '#models/deposit'
import { BlockchainService } from '#services/BlockchainService'

export default class CheckBalances extends BaseCommand {
  static commandName = 'deposits:check-balances'
  static description = 'Fetches addresses from DB and queries their USDT balance on-chain'

  static options = {
    startApp: true
  }

  async run() {
    const blockchainService = new BlockchainService()
    
    this.logger.info('Fetching unique deposit addresses from database...')

    // Fetch unique addresses only
    const deposits = await Deposit.query()
      .select('address', 'network', 'currency')
      .distinct('address', 'network')

    this.logger.info(`Found ${deposits.length} unique addresses to check.`)

    for (const deposit of deposits) {
      const network = deposit.network as 'ERC20' | 'BEP20'
      
      if (network !== 'ERC20' && network !== 'BEP20') {
        continue
      }

      try {
        const balance = await blockchainService.getUSDTBalance(deposit.address, network)

        if (balance > 0) {
          this.logger.success(`[${network}] ${deposit.address}: ${balance} USDT`)
        } else {
          this.logger.info(`[${network}] ${deposit.address}: 0 USDT`)
        }
      } catch (error) {
        this.logger.error(`Error checking ${deposit.address}: ${error.message}`)
      }
    }

    this.logger.info('Scan complete.')
  }
}