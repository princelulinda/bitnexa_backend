import { BaseCommand } from '@adonisjs/core/ace'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import P2pTrade from '#models/p2p_trade'
import P2pOffer from '#models/p2p_offer'
import Transaction from '#models/transaction'

export default class P2pTimeout extends BaseCommand {
  static commandName = 'p2p:timeout'
  static description = 'Expire P2P trades where payment window has elapsed'

  async run() {
    const cutoff = DateTime.now().setZone('UTC').minus({ minutes: 30 }).toSQL()!

    const expiredTrades = await P2pTrade.query()
      .where('status', 'payment_sent')
      .where('paid_at', '<=', cutoff)

    this.logger.info(`Found ${expiredTrades.length} expired trade(s).`)

    for (const trade of expiredTrades) {
      const sellerWallet = await db.from('wallets').where('user_id', trade.sellerId).first()
      if (!sellerWallet) continue

      await db.transaction(async (trx) => {
        await trx.from('wallets').where('id', sellerWallet.id).increment('balance', trade.amount)

        trade.useTransaction(trx)
        trade.status = 'timed_out'
        await trade.save()

        await P2pOffer.query({ client: trx }).where('id', trade.offerId).update({ status: 'open' })

        await Transaction.create({
          walletId: sellerWallet.id,
          amount: trade.amount,
          type: 'p2p_escrow_release',
          description: `P2P escrow released — trade ${trade.id} timed out`,
          status: 'completed',
        }, { client: trx })
      })

      this.logger.info(`Trade ${trade.id} timed out. Funds returned to seller.`)
    }

    this.logger.success('P2P timeout check complete.')
  }
}
