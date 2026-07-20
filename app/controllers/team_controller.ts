import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default class TeamController {
  /**
   * Returns the full referral tree of a user (by email or id)
   */
  async show({ request, response }: HttpContext) {
    const identifier = request.input('identifier', '')

    if (!identifier) {
      return response.badRequest({ error: 'identifier (email or id) is required.' })
    }

    // The `id` column is a Postgres uuid — only include it in the query when
    // the identifier actually looks like a UUID, otherwise Postgres rejects
    // the parameter binding (e.g. "invalid input syntax for type uuid") even
    // though the `email` branch would have matched.
    const rootUser = await User.query()
      .where('email', identifier)
      .if(UUID_RE.test(identifier), (q) => q.orWhere('id', identifier))
      .first()

    if (!rootUser) {
      return response.notFound({ error: 'User not found.' })
    }

    const tree = await this.buildTree(rootUser.id)

    return response.ok({
      root: {
        id: rootUser.id,
        fullName: rootUser.fullName,
        email: rootUser.email,
        referralCode: rootUser.referralCode,
        kycStatus: rootUser.kycStatus,
      },
      team: tree,
      total: this.countNodes(tree),
    })
  }

  private async buildTree(userId: string): Promise<any[]> {
    const referrals = await User.query()
      .where('referrerId', userId)
      .preload('wallet')
      .preload('referralLevel')
      .preload('subscriptions', (q) => q.where('status', 'active').preload('plan'))
      .orderBy('createdAt', 'asc')

    const nodes = []
    for (const member of referrals) {
      const balance = member.wallet ? Number(member.wallet.balance) : 0
      const investmentBalance = member.wallet ? Number(member.wallet.investmentBalance) : 0
      const lockedCapital = member.wallet ? Number(member.wallet.lockedCapital ?? 0) : 0
      const withdrawable = Math.max(0, balance + investmentBalance - lockedCapital)
      nodes.push({
        id: member.id,
        fullName: member.fullName,
        email: member.email,
        referralCode: member.referralCode,
        kycStatus: member.kycStatus,
        referralLevel: member.referralLevel?.level ?? null,
        plan: member.subscriptions[0]?.plan?.name ?? null,
        balance: balance.toFixed(2),
        investmentBalance: investmentBalance.toFixed(2),
        lockedCapital: lockedCapital.toFixed(2),
        withdrawable: withdrawable.toFixed(2),
        joinedAt: member.createdAt,
        children: await this.buildTree(member.id),
      })
    }
    return nodes
  }

  private countNodes(tree: any[]): number {
    return tree.reduce((acc, node) => acc + 1 + this.countNodes(node.children), 0)
  }
}
