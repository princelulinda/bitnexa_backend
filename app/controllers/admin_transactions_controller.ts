import type { HttpContext } from '@adonisjs/core/http'
import Transaction from '#models/transaction'
import Wallet from '#models/wallet'

export default class AdminTransactionsController {
  async index({ request, response }: HttpContext) {
    const {
      type,
      status,
      userId,
      walletId,
      dateFrom,
      dateTo,
      minAmount,
      maxAmount,
      page = 1,
      limit = 50,
    } = request.qs()

    const query = Transaction.query()
      .preload('wallet', (q) => q.preload('user'))
      .orderBy('created_at', 'desc')

    if (type) query.where('type', type)
    if (status) query.where('status', status)
    if (walletId) query.where('wallet_id', walletId)
    if (minAmount) query.where('amount', '>=', Number(minAmount))
    if (maxAmount) query.where('amount', '<=', Number(maxAmount))
    if (dateFrom) query.where('created_at', '>=', dateFrom)
    if (dateTo) query.where('created_at', '<=', dateTo + ' 23:59:59')

    if (userId) {
      const wallet = await Wallet.findBy('user_id', userId)
      if (!wallet) return response.ok({ data: [], meta: { total: 0, page: 1, limit } })
      query.where('wallet_id', wallet.id)
    }

    const paginated = await query.paginate(Number(page), Number(limit))

    return response.ok({
      data: paginated.all().map((t) => ({
        id: t.id,
        amount: t.amount,
        type: t.type,
        status: t.status,
        description: t.description,
        createdAt: t.createdAt,
        walletId: t.walletId,
        user: t.wallet?.user
          ? {
              id: t.wallet.user.id,
              fullName: t.wallet.user.fullName,
              email: t.wallet.user.email,
            }
          : null,
      })),
      meta: paginated.getMeta(),
    })
  }
}
