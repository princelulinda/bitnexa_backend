import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import P2pOffer from '#models/p2p_offer'
import P2pTrade from '#models/p2p_trade'
import Transaction from '#models/transaction'

const PAYMENT_WINDOW_MINUTES = 30

const createOfferValidator = vine.compile(
  vine.object({
    amount: vine.number().min(1),
    pricePerUnit: vine.number().positive(),
    fiatCurrency: vine.string().trim().maxLength(10),
    paymentMethods: vine.array(vine.string().trim()).minLength(1),
    notes: vine.string().trim().optional(),
  })
)

const markPaymentSentValidator = vine.compile(
  vine.object({
    paymentProofs: vine.array(vine.string().trim()).minLength(1),
  })
)

const raiseDisputeValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().minLength(10),
  })
)

const resolveDisputeValidator = vine.compile(
  vine.object({
    direction: vine.enum(['buyer', 'seller']),
    notes: vine.string().trim().minLength(5),
  })
)

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  return local.substring(0, 2) + '***@' + domain
}

export default class P2pController {
  async createOffer({ request, auth, response }: HttpContext) {
    const user = auth.user!
    if (user.kycStatus !== 'verified') {
      return response.forbidden({ message: 'KYC verification required to create offers.' })
    }
    const data = await request.validateUsing(createOfferValidator)
    const wallet = await user.related('wallet').query().firstOrFail()
    if (Number(wallet.balance) < data.amount) {
      return response.unprocessableEntity({ message: 'Insufficient balance.' })
    }
    const offer = await db.transaction(async (trx) => {
      wallet.useTransaction(trx)
      wallet.balance = Math.round((Number(wallet.balance) - data.amount) * 100) / 100
      await wallet.save()
      const newOffer = await P2pOffer.create({
        sellerId: user.id,
        amount: data.amount,
        pricePerUnit: data.pricePerUnit,
        fiatCurrency: data.fiatCurrency.toUpperCase(),
        paymentMethods: data.paymentMethods,
        notes: data.notes ?? null,
        status: 'open',
      }, { client: trx })
      await Transaction.create({
        walletId: wallet.id,
        amount: data.amount,
        type: 'p2p_escrow_lock',
        description: `P2P escrow locked for offer ${newOffer.id}`,
        status: 'completed',
      }, { client: trx })
      return newOffer
    })
    await offer.load('seller')
    return response.created({
      message: 'Offer created and funds escrowed.',
      offer: {
        id: offer.id,
        amount: offer.amount,
        pricePerUnit: offer.pricePerUnit,
        fiatCurrency: offer.fiatCurrency,
        paymentMethods: offer.paymentMethods,
        notes: offer.notes,
        status: offer.status,
        seller: {
          id: offer.seller.id,
          name: offer.seller.fullName,
          email: maskEmail(offer.seller.email),
        },
        createdAt: offer.createdAt,
      },
    })
  }

  async listOffers({ request, auth, response }: HttpContext) {
    const user = auth.user!
    const { fiatCurrency, paymentMethod, page = 1 } = request.qs()
    const query = P2pOffer.query()
      .where('status', 'open')
      .whereNot('seller_id', user.id)
      .preload('seller', (q) => q.select(['id', 'full_name', 'email']))
      .orderBy('created_at', 'desc')
    if (fiatCurrency) query.where('fiat_currency', fiatCurrency.toUpperCase())
    if (paymentMethod) query.whereRaw(`payment_methods::text ILIKE ?`, [`%${paymentMethod}%`])
    const paginated = await query.paginate(Number(page), 20)
    const data = paginated.all().map((o) => ({
      id: o.id,
      amount: o.amount,
      pricePerUnit: o.pricePerUnit,
      fiatCurrency: o.fiatCurrency,
      paymentMethods: o.paymentMethods,
      notes: o.notes,
      seller: { id: o.seller.id, name: o.seller.fullName, email: maskEmail(o.seller.email) },
      createdAt: o.createdAt,
    }))
    return response.ok({ data, meta: paginated.getMeta() })
  }

  async showOffer({ params, response }: HttpContext) {
    const offer = await P2pOffer.query()
      .where('id', params.offerId)
      .preload('seller', (q) => q.select(['id', 'full_name', 'email']))
      .first()

    if (!offer) {
      return response.notFound({ message: 'Offer not found.' })
    }

    return response.ok({
      id: offer.id,
      amount: offer.amount,
      pricePerUnit: offer.pricePerUnit,
      fiatCurrency: offer.fiatCurrency,
      paymentMethods: offer.paymentMethods,
      notes: offer.notes,
      status: offer.status,
      seller: {
        id: offer.seller.id,
        name: offer.seller.fullName,
        email: maskEmail(offer.seller.email),
      },
      createdAt: offer.createdAt,
    })
  }

  async takeOffer({ params, auth, response }: HttpContext) {
    const user = auth.user!
    const offer = await P2pOffer.find(params.offerId)
    if (!offer || offer.status !== 'open') {
      return response.conflict({ message: 'Offer is no longer available.' })
    }
    if (offer.sellerId === user.id) {
      return response.forbidden({ message: 'Cannot trade with yourself.' })
    }
    const trade = await db.transaction(async (trx) => {
      offer.useTransaction(trx)
      offer.status = 'locked'
      await offer.save()
      return P2pTrade.create({
        offerId: offer.id,
        buyerId: user.id,
        sellerId: offer.sellerId,
        amount: offer.amount,
        pricePerUnit: offer.pricePerUnit,
        fiatCurrency: offer.fiatCurrency,
        totalFiat: Math.round(offer.amount * offer.pricePerUnit * 100) / 100,
        status: 'pending_payment',
        paymentProofs: [],
      }, { client: trx })
    })
    return response.created({
      message: 'Trade initiated. Complete your fiat payment and submit proof.',
      trade: {
        id: trade.id,
        amount: trade.amount,
        totalFiat: trade.totalFiat,
        fiatCurrency: trade.fiatCurrency,
        paymentWindowMinutes: PAYMENT_WINDOW_MINUTES,
      },
    })
  }

  async markPaymentSent({ params, request, auth, response }: HttpContext) {
    const user = auth.user!
    const { paymentProofs } = await request.validateUsing(markPaymentSentValidator)
    const trade = await P2pTrade.find(params.tradeId)
    if (!trade) return response.notFound({ message: 'Trade not found.' })
    if (trade.buyerId !== user.id) return response.forbidden({ message: 'Access denied.' })
    if (trade.status !== 'pending_payment') {
      return response.conflict({ message: 'Trade is not in a payable state.' })
    }
    trade.status = 'payment_sent'
    trade.paymentProofs = paymentProofs
    trade.paidAt = DateTime.now().setZone('UTC')
    await trade.save()
    return response.ok({
      message: 'Payment marked as sent. The seller has 30 minutes to confirm.',
      tradeId: trade.id,
      paidAt: trade.paidAt,
    })
  }

  async confirmPayment({ params, auth, response }: HttpContext) {
    const user = auth.user!
    const trade = await P2pTrade.find(params.tradeId)
    if (!trade) return response.notFound({ message: 'Trade not found.' })
    if (trade.sellerId !== user.id) return response.forbidden({ message: 'Access denied.' })
    if (trade.status !== 'payment_sent') {
      return response.conflict({ message: 'Trade is not awaiting confirmation.' })
    }
    const buyerWallet = await db.from('wallets').where('user_id', trade.buyerId).first()
    if (!buyerWallet) return response.internalServerError({ message: 'Buyer wallet not found.' })
    await db.transaction(async (trx) => {
      await trx.from('wallets').where('id', buyerWallet.id).increment('balance', trade.amount)
      trade.useTransaction(trx)
      trade.status = 'completed'
      await trade.save()
      await P2pOffer.query({ client: trx }).where('id', trade.offerId).update({ status: 'completed' })
      await Transaction.create({
        walletId: buyerWallet.id,
        amount: trade.amount,
        type: 'p2p_release',
        description: `P2P USDT released from trade ${trade.id}`,
        status: 'completed',
      }, { client: trx })
      const sellerWallet = await db.from('wallets').where('user_id', trade.sellerId).first()
      if (sellerWallet) {
        await Transaction.create({
          walletId: sellerWallet.id,
          amount: trade.amount,
          type: 'p2p_sale',
          description: `P2P sale completed for trade ${trade.id}`,
          status: 'completed',
        }, { client: trx })
      }
    })
    return response.ok({ message: 'Payment confirmed. USDT released to buyer.', tradeId: trade.id })
  }

  async cancelOffer({ params, auth, response }: HttpContext) {
    const user = auth.user!
    const offer = await P2pOffer.find(params.offerId)
    if (!offer) return response.notFound({ message: 'Offer not found.' })
    if (offer.sellerId !== user.id) return response.forbidden({ message: 'Access denied.' })
    if (offer.status !== 'open') {
      return response.conflict({ message: 'Offer cannot be cancelled in its current state.' })
    }
    const wallet = await user.related('wallet').query().firstOrFail()
    await db.transaction(async (trx) => {
      wallet.useTransaction(trx)
      wallet.balance = Math.round((Number(wallet.balance) + offer.amount) * 100) / 100
      await wallet.save()
      offer.useTransaction(trx)
      offer.status = 'cancelled'
      await offer.save()
      await Transaction.create({
        walletId: wallet.id,
        amount: offer.amount,
        type: 'p2p_escrow_release',
        description: `P2P escrow released — offer ${offer.id} cancelled`,
        status: 'completed',
      }, { client: trx })
    })
    return response.ok({ message: 'Offer cancelled and funds returned to your balance.' })
  }

  async raiseDispute({ params, request, auth, response }: HttpContext) {
    const user = auth.user!
    const { reason } = await request.validateUsing(raiseDisputeValidator)
    const trade = await P2pTrade.find(params.tradeId)
    console.log(params.tradeId,)
    if (!trade) return response.notFound({ message: 'Trade not found.' })
    if (trade.buyerId !== user.id && trade.sellerId !== user.id) {
      return response.forbidden({ message: 'Access denied.' })
    }
    if (trade.status !== 'payment_sent') {
      return response.conflict({ message: 'Disputes can only be raised on trades awaiting confirmation.' })
    }
    trade.status = 'disputed'
    trade.disputedBy = user.id
    trade.disputeReason = reason
    await trade.save()
    return response.ok({ message: 'Dispute raised. An admin will review and resolve it.', tradeId: trade.id })
  }

  async myOffers({ auth, request, response }: HttpContext) {
    const user = auth.user!
    const { page = 1 } = request.qs()
    const paginated = await P2pOffer.query()
      .where('seller_id', user.id)
      .orderBy('created_at', 'desc')
      .paginate(Number(page), 20)
    const data = paginated.all().map((o) => ({
      id: o.id,
      amount: o.amount,
      pricePerUnit: o.pricePerUnit,
      fiatCurrency: o.fiatCurrency,
      paymentMethods: o.paymentMethods,
      notes: o.notes,
      status: o.status,
      seller: { id: user.id, name: user.fullName, email: maskEmail(user.email) },
      createdAt: o.createdAt,
    }))
    return response.ok({ data, meta: paginated.getMeta() })
  }

  async myTrades({ auth, request, response }: HttpContext) {
    const user = auth.user!
    const { page = 1 } = request.qs()
    const paginated = await P2pTrade.query()
      .where((q) => q.where('buyer_id', user.id).orWhere('seller_id', user.id))
      .preload('offer')
      .orderBy('created_at', 'desc')
      .paginate(Number(page), 20)
    const data = paginated.all().map((t) => ({
      id: t.id,
      role: t.buyerId === user.id ? 'buyer' : 'seller',
      amount: t.amount,
      totalFiat: t.totalFiat,
      fiatCurrency: t.fiatCurrency,
      status: t.status,
      paidAt: t.paidAt,
      createdAt: t.createdAt,
    }))
    return response.ok({ data, meta: paginated.getMeta() })
  }

  async showTrade({ params, auth, response }: HttpContext) {
    const user = auth.user!
    const trade = await P2pTrade.query()
      .where('id', params.tradeId)
      .andWhere((q) => q.where('buyer_id', user.id).orWhere('seller_id', user.id))
      .preload('offer')
      .first()

    if (!trade) {
      return response.notFound({ message: 'Trade not found or access denied.' })
    }

    return response.ok({
      id: trade.id,
      role: trade.buyerId === user.id ? 'buyer' : 'seller',
      amount: trade.amount,
      totalFiat: trade.totalFiat,
      fiatCurrency: trade.fiatCurrency,
      status: trade.status,
      paidAt: trade.paidAt,
      createdAt: trade.createdAt,
      offer: trade.offer,
    })
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  async debugTrade({ params, response }: HttpContext) {
    const trade = await db.rawQuery('SELECT * FROM p2p_trades WHERE id = ?', [params.tradeId])
    return response.ok(trade.rows)
  }

  async adminListTrades({ request, response }: HttpContext) {
    const { status, page = 1 } = request.qs()
    const query = P2pTrade.query()
      .preload('offer')
      .preload('buyer', (q) => q.select(['id', 'full_name', 'email']))
      .preload('seller', (q) => q.select(['id', 'full_name', 'email']))
      .orderBy('created_at', 'desc')
    if (status) query.where('status', status)
    const paginated = await query.paginate(Number(page), 20)
    return response.ok({ data: paginated.all(), meta: paginated.getMeta() })
  }

  async adminGetTrade({ params, response }: HttpContext) {
    const trade = await P2pTrade.query()
      .where('id', params.tradeId)
      .preload('offer')
      .preload('buyer')
      .preload('seller')
      .firstOrFail()
    return response.ok(trade)
  }

  async adminResolveDispute({ params, request, auth, response }: HttpContext) {
    const admin = auth.user!
    const { direction, notes } = await request.validateUsing(resolveDisputeValidator)
    const trade = await P2pTrade.find(params.tradeId)
    if (!trade) return response.notFound({ message: 'Trade not found.' })
    if (trade.status !== 'disputed') {
      return response.conflict({ message: 'Trade is not in disputed state.' })
    }
    const buyerWallet = await db.from('wallets').where('user_id', trade.buyerId).first()
    const sellerWallet = await db.from('wallets').where('user_id', trade.sellerId).first()
    await db.transaction(async (trx) => {
      if (direction === 'buyer' && buyerWallet) {
        await trx.from('wallets').where('id', buyerWallet.id).increment('balance', trade.amount)
        await Transaction.create({
          walletId: buyerWallet.id,
          amount: trade.amount,
          type: 'p2p_dispute_resolution',
          description: `Dispute resolved in favor of buyer — trade ${trade.id}`,
          status: 'completed',
        }, { client: trx })
        trade.status = 'resolved_buyer'
      } else if (direction === 'seller' && sellerWallet) {
        await trx.from('wallets').where('id', sellerWallet.id).increment('balance', trade.amount)
        await Transaction.create({
          walletId: sellerWallet.id,
          amount: trade.amount,
          type: 'p2p_dispute_resolution',
          description: `Dispute resolved in favor of seller — trade ${trade.id}`,
          status: 'completed',
        }, { client: trx })
        trade.status = 'resolved_seller'
      }
      trade.useTransaction(trx)
      trade.resolvedBy = admin.id
      trade.resolutionDirection = direction
      trade.resolutionNotes = notes
      trade.resolvedAt = DateTime.now().setZone('UTC')
      await trade.save()
      await P2pOffer.query({ client: trx }).where('id', trade.offerId).update({ status: 'completed' })
    })
    return response.ok({ message: `Dispute resolved in favor of ${direction}.`, tradeId: trade.id })
  }
}
