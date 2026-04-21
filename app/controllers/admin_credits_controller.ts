import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import User from '#models/user'
import Wallet from '#models/wallet'
import Transaction from '#models/transaction'
import ReferralLevel from '#models/referral_level'

const creditUsersValidator = vine.compile(
  vine.object({
    userIds: vine.array(vine.string().uuid()).minLength(1),
    amount: vine.number().positive(),
    unlockLevel: vine.number().min(0),
    description: vine.string().optional(),
  })
)

const creditByLevelValidator = vine.compile(
  vine.object({
    referralLevel: vine.number().min(0),
    amount: vine.number().positive(),
    unlockLevel: vine.number().min(0),
    description: vine.string().optional(),
  })
)

export default class AdminCreditsController {
  /**
   * POST /admin/api/credits/users
   * Credit specific users — amount goes to balance but withdrawal is blocked until level reached
   */
  async creditUsers({ request, response }: HttpContext) {
    const { userIds, amount, unlockLevel, description } = await request.validateUsing(creditUsersValidator)

    const unlockLevelRecord = await ReferralLevel.query().where('level', unlockLevel).first()
    if (!unlockLevelRecord) {
      return response.badRequest(`Referral level ${unlockLevel} does not exist.`)
    }

    const results: { userId: string; status: string }[] = []

    for (const userId of userIds) {
      const user = await User.find(userId)
      if (!user) { results.push({ userId, status: 'not_found' }); continue }

      const wallet = await Wallet.query().where('userId', userId).first()
      if (!wallet) { results.push({ userId, status: 'no_wallet' }); continue }

      // Add to balance (visible & usable) but track as locked capital
      wallet.balance = Number(wallet.balance) + amount
      wallet.lockedCapital = Number(wallet.lockedCapital) + amount
      wallet.withdrawalUnlockLevel = unlockLevel
      await wallet.save()

      await Transaction.create({
        walletId: wallet.id,
        amount,
        type: 'admin_credit',
        description: description ?? `Admin credit $${amount} — withdrawal locked until level ${unlockLevel} (${unlockLevelRecord.name})`,
        status: 'completed',
      })

      results.push({ userId, status: 'credited' })
    }

    const credited = results.filter((r) => r.status === 'credited').length
    return response.ok({ message: `${credited}/${userIds.length} users credited.`, results })
  }

  /**
   * POST /admin/api/credits/by-level
   * Credit all users at a given referral level
   */
  async creditByLevel({ request, response }: HttpContext) {
    const { referralLevel, amount, unlockLevel, description } = await request.validateUsing(creditByLevelValidator)

    const levelRecord = await ReferralLevel.query().where('level', referralLevel).first()
    if (!levelRecord) return response.badRequest(`Referral level ${referralLevel} does not exist.`)

    const unlockLevelRecord = await ReferralLevel.query().where('level', unlockLevel).first()
    if (!unlockLevelRecord) return response.badRequest(`Unlock level ${unlockLevel} does not exist.`)

    const users = await User.query().where('referralLevelId', levelRecord.id)
    if (users.length === 0) return response.ok({ message: 'No users at this level.', credited: 0 })

    let credited = 0
    for (const user of users) {
      const wallet = await Wallet.query().where('userId', user.id).first()
      if (!wallet) continue

      wallet.balance = Number(wallet.balance) + amount
      wallet.lockedCapital = Number(wallet.lockedCapital) + amount
      wallet.withdrawalUnlockLevel = unlockLevel
      await wallet.save()

      await Transaction.create({
        walletId: wallet.id,
        amount,
        type: 'admin_credit',
        description: description ?? `Admin credit $${amount} — withdrawal locked until level ${unlockLevel} (${unlockLevelRecord.name})`,
        status: 'completed',
      })
      credited++
    }

    return response.ok({ message: `${credited} users at ${levelRecord.name} credited $${amount} each.`, credited })
  }

  /**
   * POST /admin/api/credits/unlock/:userId
   * Admin override — remove capital lock
   */
  async unlockCapital({ params, response }: HttpContext) {
    const wallet = await Wallet.query().where('userId', params.userId).first()
    if (!wallet) return response.notFound('Wallet not found.')

    const locked = Number(wallet.lockedCapital)
    if (locked <= 0) return response.badRequest('No locked capital.')

    wallet.lockedCapital = 0
    wallet.withdrawalUnlockLevel = null
    await wallet.save()

    await Transaction.create({
      walletId: wallet.id,
      amount: locked,
      type: 'admin_unlock',
      description: `Admin unlocked capital restriction of $${locked}`,
      status: 'completed',
    })

    return response.ok({ message: `Capital lock of $${locked} removed. User can now withdraw freely.` })
  }
}
