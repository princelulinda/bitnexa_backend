import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import P2pOffer from '#models/p2p_offer'
import P2pTrade from '#models/p2p_trade'
import Transaction from '#models/transaction'
import Wallet from '#models/wallet'
import CoinPriceService from '#services/CoinPriceService'

// ─── Constantes ───────────────────────────────────────────────────────────────

const TOKEN_SYMBOL = 'PXC' // Symbole du token airdrop négocié sur le marché P2P

// ─── Validators ───────────────────────────────────────────────────────────────

const createOfferValidator = vine.compile(
  vine.object({
    /**
     * Quantité de tokens PXC à mettre en vente.
     * Débitée de airdropBalance du vendeur et mise en escrow.
     * Le prix par token est automatiquement récupéré depuis CoinGecko.
     */
    tokenAmount: vine.number().min(1),
    /**
     * Devise dans laquelle l'acheteur paiera depuis son balance.
     * Ex: "usd", "eur". Le prix sera converti depuis CoinGecko.
     */
    currency: vine.string().trim().maxLength(10),
    notes: vine.string().trim().optional(),
  })
)

const resolveDisputeValidator = vine.compile(
  vine.object({
    direction: vine.enum(['buyer', 'seller']),
    notes: vine.string().trim().minLength(5),
  })
)

const raiseDisputeValidator = vine.compile(
  vine.object({
    reason: vine.string().trim().minLength(10),
  })
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  return local.substring(0, 2) + '***@' + domain
}

// ─── Controller ───────────────────────────────────────────────────────────────

export default class P2pController {

  /**
   * GET /p2p/token-price
   * Retourne le prix actuel du token PXC depuis CoinGecko.
   * Query param optionnel : ?currency=usd
   */
  async getTokenPrice({ request, response }: HttpContext) {
    const { currency } = request.qs()
    try {
      if (currency) {
        const price = await CoinPriceService.getPriceInCurrency(currency)
        return response.ok({
          symbol: TOKEN_SYMBOL,
          currency: currency.toUpperCase(),
          price,
          source: 'coingecko',
        })
      }
      const snapshot = await CoinPriceService.getMarketSnapshot()
      return response.ok(snapshot)
    } catch (error) {
      return response.serviceUnavailable({
        message: error.message ?? 'Impossible de récupérer le prix du marché.',
      })
    }
  }

  /**
   * POST /p2p/offers
   * Le vendeur liste ses tokens PXC airdrop sur le marché.
   *
   * Flux :
   *  1. Vérifie que le vendeur a assez de tokens dans airdropBalance
   *  2. Débite airdropBalance → tokens en escrow
   *  3. Le prix est automatiquement fixé via CoinGecko
   */
  async createOffer({ request, auth, response }: HttpContext) {
    const user = auth.user!

    if (user.kycStatus !== 'verified') {
      return response.forbidden({ message: 'KYC requis pour créer une offre.' })
    }

    const data = await request.validateUsing(createOfferValidator)

    // ── Prix temps réel depuis CoinGecko ──────────────────────────────────
    let pricePerToken: number
    try {
      pricePerToken = await CoinPriceService.getPriceInCurrency(data.currency)
    } catch (error) {
      return response.serviceUnavailable({
        message: error.message ?? 'Impossible de récupérer le prix du marché. Réessayez.',
      })
    }

    const totalCost = Math.round(data.tokenAmount * pricePerToken * 100) / 100

    // ── Vérifier le solde airdrop du vendeur ──────────────────────────────
    const wallet = await Wallet.findByOrFail('userId', user.id)
    if (Number(wallet.airdropBalance) < data.tokenAmount) {
      return response.unprocessableEntity({
        message: `Solde insuffisant. Vous avez ${wallet.airdropBalance} ${TOKEN_SYMBOL}, vous essayez de vendre ${data.tokenAmount} ${TOKEN_SYMBOL}.`,
      })
    }

    const offer = await db.transaction(async (trx) => {
      // 1. Débiter les tokens du vendeur → escrow
      await trx
        .from('wallets')
        .where('user_id', user.id)
        .decrement('airdrop_balance', data.tokenAmount)

      // 2. Créer l'offre avec le prix temps réel
      const newOffer = await P2pOffer.create(
        {
          sellerId: user.id,
          tokenSymbol: TOKEN_SYMBOL,
          tokenSource: 'airdrop',
          amount: data.tokenAmount,
          pricePerUnit: pricePerToken,
          fiatCurrency: data.currency.toUpperCase(),
          paymentMethods: [],   // champ conservé pour compatibilité migration
          notes: data.notes ?? null,
          status: 'open',
        },
        { client: trx }
      )

      // 3. Enregistrer le lock escrow
      await Transaction.create(
        {
          walletId: wallet.id,
          amount: data.tokenAmount,
          type: 'p2p_escrow_lock',
          description: `Escrow P2P: ${data.tokenAmount} ${TOKEN_SYMBOL} lockés pour l'offre ${newOffer.id}`,
          status: 'completed',
        },
        { client: trx }
      )

      return newOffer
    })

    await offer.load('seller')

    return response.created({
      message: `Offre créée. ${data.tokenAmount} ${TOKEN_SYMBOL} sont en escrow.`,
      offer: {
        id: offer.id,
        tokenSymbol: offer.tokenSymbol,
        tokenAmount: offer.amount,
        pricePerToken: offer.pricePerUnit,
        totalCost,
        currency: offer.fiatCurrency,
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

  /**
   * GET /p2p/offers
   * Liste les offres ouvertes (tokens PXC à acheter).
   * Filtres disponibles : ?currency=usd
   */
  async listOffers({ request, auth, response }: HttpContext) {
    const user = auth.user!
    const { currency, page = 1 } = request.qs()

    const query = P2pOffer.query()
      .where('status', 'open')
      .whereNot('seller_id', user.id)
      .preload('seller', (q) => q.select(['id', 'full_name', 'email']))
      .orderBy('created_at', 'desc')

    if (currency) query.where('fiat_currency', currency.toUpperCase())

    const paginated = await query.paginate(Number(page), 20)

    const data = paginated.all().map((o) => ({
      id: o.id,
      tokenSymbol: o.tokenSymbol,
      tokenAmount: o.amount,
      pricePerToken: o.pricePerUnit,
      totalCost: Math.round(o.amount * o.pricePerUnit * 100) / 100,
      currency: o.fiatCurrency,
      notes: o.notes,
      seller: {
        id: o.seller.id,
        name: o.seller.fullName,
        email: maskEmail(o.seller.email),
      },
      createdAt: o.createdAt,
    }))

    return response.ok({ data, meta: paginated.getMeta() })
  }

  /**
   * GET /p2p/offers/:offerId
   * Détail d'une offre.
   */
  async showOffer({ params, response }: HttpContext) {
    const offer = await P2pOffer.query()
      .where('id', params.offerId)
      .preload('seller', (q) => q.select(['id', 'full_name', 'email']))
      .first()

    if (!offer) return response.notFound({ message: 'Offre introuvable.' })

    return response.ok({
      id: offer.id,
      tokenSymbol: offer.tokenSymbol,
      tokenAmount: offer.amount,
      pricePerToken: offer.pricePerUnit,
      totalCost: Math.round(offer.amount * offer.pricePerUnit * 100) / 100,
      currency: offer.fiatCurrency,
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

  /**
   * POST /p2p/offers/:offerId/take
   * L'acheteur achète les tokens en payant depuis son balance USDT.
   *
   * Swap atomique en une seule transaction DB :
   *  1. Vérifie que buyer.balance >= totalCost
   *  2. Débite buyer.balance du montant en USDT
   *  3. Crédite seller.balance du même montant
   *  4. Crédite buyer.airdropBalance des tokens PXC
   *  5. Trade et offre passent en "completed"
   */
  async takeOffer({ params, auth, response }: HttpContext) {
    const user = auth.user!

    const offer = await P2pOffer.find(params.offerId)
    if (!offer || offer.status !== 'open') {
      return response.conflict({ message: 'Cette offre n\'est plus disponible.' })
    }
    if (offer.sellerId === user.id) {
      return response.forbidden({ message: 'Vous ne pouvez pas acheter votre propre offre.' })
    }

    const totalCost = Math.round(offer.amount * offer.pricePerUnit * 100) / 100

    // Vérifier le balance USDT de l'acheteur
    const buyerWallet = await Wallet.findByOrFail('userId', user.id)
    if (Number(buyerWallet.balance) < totalCost) {
      return response.unprocessableEntity({
        message: `Balance insuffisante. Vous avez ${buyerWallet.balance} ${offer.fiatCurrency}, cette offre coûte ${totalCost} ${offer.fiatCurrency}.`,
      })
    }

    const trade = await db.transaction(async (trx) => {
      // 1. Débiter le balance USDT de l'acheteur
      await trx
        .from('wallets')
        .where('user_id', user.id)
        .decrement('balance', totalCost)

      // 2. Créditer le balance USDT du vendeur
      await trx
        .from('wallets')
        .where('user_id', offer.sellerId)
        .increment('balance', totalCost)

      // 3. Créditer les tokens PXC à l'acheteur
      await trx
        .from('wallets')
        .where('user_id', user.id)
        .increment('airdrop_balance', offer.amount)

      // 4. Créer le trade (completed instantanément)
      const newTrade = await P2pTrade.create(
        {
          offerId: offer.id,
          buyerId: user.id,
          sellerId: offer.sellerId,
          amount: offer.amount,
          pricePerUnit: offer.pricePerUnit,
          fiatCurrency: offer.fiatCurrency,
          tokenSymbol: offer.tokenSymbol,
          totalFiat: totalCost,
          status: 'completed',
          paymentProofs: [],
          paidAt: DateTime.now().setZone('UTC'),
        },
        { client: trx }
      )

      // 5. Fermer l'offre
      offer.useTransaction(trx)
      offer.status = 'completed'
      await offer.save()

      // 6. Transaction : débit USDT acheteur
      await Transaction.create(
        {
          walletId: buyerWallet.id,
          amount: totalCost,
          type: 'p2p_purchase',
          description: `Achat P2P: ${offer.amount} ${offer.tokenSymbol} pour ${totalCost} ${offer.fiatCurrency} (trade ${newTrade.id})`,
          status: 'completed',
        },
        { client: trx }
      )

      // 7. Transaction : crédit tokens acheteur
      await Transaction.create(
        {
          walletId: buyerWallet.id,
          amount: offer.amount,
          type: 'p2p_token_received',
          description: `Réception P2P: ${offer.amount} ${offer.tokenSymbol} (trade ${newTrade.id})`,
          status: 'completed',
        },
        { client: trx }
      )

      // 8. Transaction : crédit USDT vendeur
      const sellerWallet = await trx.from('wallets').where('user_id', offer.sellerId).first()
      if (sellerWallet) {
        await Transaction.create(
          {
            walletId: sellerWallet.id,
            amount: totalCost,
            type: 'p2p_sale',
            description: `Vente P2P: ${offer.amount} ${offer.tokenSymbol} → ${totalCost} ${offer.fiatCurrency} reçus (trade ${newTrade.id})`,
            status: 'completed',
          },
          { client: trx }
        )
      }

      return newTrade
    })

    return response.created({
      message: `Achat effectué avec succès. Vous avez reçu ${offer.amount} ${TOKEN_SYMBOL}.`,
      trade: {
        id: trade.id,
        tokenSymbol: trade.tokenSymbol,
        tokenAmount: trade.amount,
        pricePerToken: trade.pricePerUnit,
        totalPaid: trade.totalFiat,
        currency: trade.fiatCurrency,
        status: trade.status,
        completedAt: trade.paidAt,
      },
    })
  }

  /**
   * POST /p2p/offers/:offerId/cancel
   * Le vendeur annule son offre ouverte.
   * Les tokens en escrow sont restitués dans airdropBalance.
   */
  async cancelOffer({ params, auth, response }: HttpContext) {
    const user = auth.user!

    const offer = await P2pOffer.find(params.offerId)
    if (!offer) return response.notFound({ message: 'Offre introuvable.' })
    if (offer.sellerId !== user.id) return response.forbidden({ message: 'Accès refusé.' })
    if (offer.status !== 'open') {
      return response.conflict({ message: 'Seules les offres ouvertes peuvent être annulées.' })
    }

    await db.transaction(async (trx) => {
      // Restituer les tokens à l'airdropBalance du vendeur
      await trx
        .from('wallets')
        .where('user_id', user.id)
        .increment('airdrop_balance', offer.amount)

      offer.useTransaction(trx)
      offer.status = 'cancelled'
      await offer.save()

      const sellerWallet = await trx.from('wallets').where('user_id', user.id).first()
      if (sellerWallet) {
        await Transaction.create(
          {
            walletId: sellerWallet.id,
            amount: offer.amount,
            type: 'p2p_escrow_release',
            description: `Escrow restitué — offre ${offer.id} annulée`,
            status: 'completed',
          },
          { client: trx }
        )
      }
    })

    return response.ok({
      message: `Offre annulée. ${offer.amount} ${offer.tokenSymbol} restitués à votre solde airdrop.`,
    })
  }

  /**
   * GET /p2p/offers/my
   * Mes offres (en tant que vendeur).
   */
  async myOffers({ auth, request, response }: HttpContext) {
    const user = auth.user!
    const { page = 1 } = request.qs()

    const paginated = await P2pOffer.query()
      .where('seller_id', user.id)
      .orderBy('created_at', 'desc')
      .paginate(Number(page), 20)

    const data = paginated.all().map((o) => ({
      id: o.id,
      tokenSymbol: o.tokenSymbol,
      tokenAmount: o.amount,
      pricePerToken: o.pricePerUnit,
      totalCost: Math.round(o.amount * o.pricePerUnit * 100) / 100,
      currency: o.fiatCurrency,
      notes: o.notes,
      status: o.status,
      createdAt: o.createdAt,
    }))

    return response.ok({ data, meta: paginated.getMeta() })
  }

  /**
   * GET /p2p/trades/my
   * Mes trades (acheteur ou vendeur).
   */
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
      tokenSymbol: t.tokenSymbol,
      tokenAmount: t.amount,
      pricePerToken: t.pricePerUnit,
      totalFiat: t.totalFiat,
      currency: t.fiatCurrency,
      status: t.status,
      completedAt: t.paidAt,
      createdAt: t.createdAt,
    }))

    return response.ok({ data, meta: paginated.getMeta() })
  }

  /**
   * GET /p2p/trades/:tradeId
   * Détail d'un trade.
   */
  async showTrade({ params, auth, response }: HttpContext) {
    const user = auth.user!

    const trade = await P2pTrade.query()
      .where('id', params.tradeId)
      .andWhere((q) => q.where('buyer_id', user.id).orWhere('seller_id', user.id))
      .preload('offer')
      .first()

    if (!trade) return response.notFound({ message: 'Trade introuvable ou accès refusé.' })

    return response.ok({
      id: trade.id,
      role: trade.buyerId === user.id ? 'buyer' : 'seller',
      tokenSymbol: trade.tokenSymbol,
      tokenAmount: trade.amount,
      pricePerToken: trade.pricePerUnit,
      totalFiat: trade.totalFiat,
      currency: trade.fiatCurrency,
      status: trade.status,
      completedAt: trade.paidAt,
      createdAt: trade.createdAt,
      offer: trade.offer,
    })
  }

  /**
   * POST /p2p/trades/:tradeId/dispute
   * Ouvre un litige sur un trade complété (ex: erreur de montant, anomalie).
   * Disponible 24h après la complétion du trade.
   */
  async raiseDispute({ params, request, auth, response }: HttpContext) {
    const user = auth.user!
    const { reason } = await request.validateUsing(raiseDisputeValidator)

    const trade = await P2pTrade.find(params.tradeId)
    if (!trade) return response.notFound({ message: 'Trade introuvable.' })
    if (trade.buyerId !== user.id && trade.sellerId !== user.id) {
      return response.forbidden({ message: 'Accès refusé.' })
    }
    if (trade.status !== 'completed') {
      return response.conflict({ message: 'Seuls les trades complétés peuvent faire l\'objet d\'un litige.' })
    }

    trade.status = 'disputed'
    trade.disputedBy = user.id
    trade.disputeReason = reason
    await trade.save()

    return response.ok({
      message: 'Litige ouvert. Un administrateur va examiner et résoudre le différend.',
      tradeId: trade.id,
    })
  }

  // ─── Routes Admin ──────────────────────────────────────────────────────────

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

  /**
   * POST /admin/api/p2p/trades/:tradeId/resolve
   * Résolution d'un litige par un admin.
   *
   * direction: "buyer"
   *   → Rembourse l'acheteur (restitue son balance USDT + retire les tokens)
   * direction: "seller"
   *   → Valide la vente du vendeur (aucun mouvement, trade déjà complété en faveur du vendeur)
   */
  async adminResolveDispute({ params, request, auth, response }: HttpContext) {
    const admin = auth.user!
    const { direction, notes } = await request.validateUsing(resolveDisputeValidator)

    const trade = await P2pTrade.find(params.tradeId)
    if (!trade) return response.notFound({ message: 'Trade introuvable.' })
    if (trade.status !== 'disputed') {
      return response.conflict({ message: 'Ce trade n\'est pas en litige.' })
    }

    const buyerWallet = await db.from('wallets').where('user_id', trade.buyerId).first()
    const sellerWallet = await db.from('wallets').where('user_id', trade.sellerId).first()

    await db.transaction(async (trx) => {
      if (direction === 'buyer') {
        // Rembourser l'acheteur : restituer son USDT + récupérer les tokens
        if (buyerWallet) {
          await trx.from('wallets').where('id', buyerWallet.id)
            .increment('balance', trade.totalFiat)
            .decrement('airdrop_balance', trade.amount)

          await Transaction.create({
            walletId: buyerWallet.id,
            amount: trade.totalFiat,
            type: 'p2p_dispute_resolution',
            description: `Litige résolu: acheteur remboursé ${trade.totalFiat} ${trade.fiatCurrency} (trade ${trade.id})`,
            status: 'completed',
          }, { client: trx })
        }
        if (sellerWallet) {
          // Retirer le montant USDT du vendeur + lui restituer les tokens PXC
          await trx.from('wallets').where('id', sellerWallet.id)
            .decrement('balance', trade.totalFiat)
            .increment('airdrop_balance', trade.amount)

          await Transaction.create({
            walletId: sellerWallet.id,
            amount: trade.totalFiat,
            type: 'p2p_dispute_resolution',
            description: `Litige résolu: USDT retirés au vendeur, tokens PXC restitués (trade ${trade.id})`,
            status: 'completed',
          }, { client: trx })
        }
        trade.status = 'resolved_buyer'

      } else {
        // Résolution en faveur du vendeur : le trade complété reste tel quel
        // Aucun mouvement de fonds nécessaire
        await Transaction.create({
          walletId: sellerWallet?.id ?? '',
          amount: trade.totalFiat,
          type: 'p2p_dispute_resolution',
          description: `Litige résolu en faveur du vendeur — trade ${trade.id} validé`,
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
    })

    return response.ok({
      message: `Litige résolu en faveur du ${direction === 'buyer' ? 'acheteur' : 'vendeur'}.`,
      tradeId: trade.id,
    })
  }
}
