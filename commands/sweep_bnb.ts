import { args, BaseCommand } from '@adonisjs/core/ace'
import { ethers } from 'ethers'
import Deposit from '#models/deposit'
import User from '#models/user'
import { BlockchainService } from '#services/BlockchainService'
import { CryptoAddressGenerator } from '#services/CryptoAddressGenerator'

export default class SweepBnb extends BaseCommand {
  static commandName = 'bnb:sweep'
  static description =
    'Collects residual BNB left over on BEP20 deposit addresses and sends it to a destination address'

  @args.string({ description: 'Destination BSC address to receive the collected BNB' })
  declare destination: string

  static options = {
    startApp: true,
  }

  async run() {
    if (!ethers.isAddress(this.destination)) {
      this.logger.error(`"${this.destination}" is not a valid BSC address.`)
      return
    }

    const blockchainService = new BlockchainService()
    const addressGenerator = new CryptoAddressGenerator()

    this.logger.info('Fetching unique BEP20 deposit addresses from database...')

    const deposits = await Deposit.query()
      .where('network', 'BEP20')
      .select('address', 'userId')
      .distinct('address')

    this.logger.info(`Found ${deposits.length} unique BEP20 addresses to check.`)

    let sweptCount = 0
    let totalCollected = 0

    for (const deposit of deposits) {
      const user = await User.find(deposit.userId)
      if (!user || user.hdIndex === null || user.hdIndex === undefined) {
        this.logger.warning(`Skipping ${deposit.address}: no hdIndex for user ${deposit.userId}.`)
        continue
      }

      try {
        const depositWallet = addressGenerator.getWallet('BEP20', user.hdIndex)

        // Safety check: never sign with a derived key that doesn't match the stored address.
        if (depositWallet.address.toLowerCase() !== deposit.address.toLowerCase()) {
          this.logger.error(
            `Address mismatch for ${deposit.address} (derived ${depositWallet.address}). Skipping for safety.`
          )
          continue
        }

        const result = await blockchainService.sweepNativeBalance(
          depositWallet,
          'BEP20',
          this.destination
        )

        if (!result) {
          this.logger.info(`[${deposit.address}] Nothing to sweep (dust below gas cost).`)
          continue
        }

        this.logger.success(
          `[${deposit.address}] Swept ${result.amount} BNB -> ${this.destination} (tx: ${result.hash})`
        )
        sweptCount++
        totalCollected += parseFloat(result.amount)
      } catch (error) {
        this.logger.error(`[${deposit.address}] Failed: ${error.message}`)
      }
    }

    this.logger.info(`Done. Swept ${sweptCount} address(es), collected ~${totalCollected} BNB total.`)
  }
}
