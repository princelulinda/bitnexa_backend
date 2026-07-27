import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import mail from '@adonisjs/mail/services/main'
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
    const { userIds, amount, unlockLevel, description } =
      await request.validateUsing(creditUsersValidator)

    const unlockLevelRecord = await ReferralLevel.query().where('level', unlockLevel).first()
    if (!unlockLevelRecord) {
      return response.badRequest(`Referral level ${unlockLevel} does not exist.`)
    }

    const results: { userId: string; status: string }[] = []

    for (const userId of userIds) {
      const user = await User.find(userId)
      if (!user) {
        results.push({ userId, status: 'not_found' })
        continue
      }

      const wallet = await Wallet.query().where('userId', userId).first()
      if (!wallet) {
        results.push({ userId, status: 'no_wallet' })
        continue
      }

      // Add to balance (visible & usable) but track as locked capital
      wallet.balance = Number(wallet.balance) + amount
      wallet.lockedCapital = Number(wallet.lockedCapital) + amount
      wallet.withdrawalUnlockLevel = unlockLevel
      await wallet.save()

      await Transaction.create({
        walletId: wallet.id,
        amount,
        type: 'admin_credit',
        description:
          description ??
          `Admin credit $${amount} — withdrawal locked until level ${unlockLevel} (${unlockLevelRecord.name})`,
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
    const { referralLevel, amount, unlockLevel, description } =
      await request.validateUsing(creditByLevelValidator)

    const levelRecord = await ReferralLevel.query().where('level', referralLevel).first()
    if (!levelRecord) return response.badRequest(`Referral level ${referralLevel} does not exist.`)

    const unlockLevelRecord = await ReferralLevel.query().where('level', unlockLevel).first()
    if (!unlockLevelRecord)
      return response.badRequest(`Unlock level ${unlockLevel} does not exist.`)

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
        description:
          description ??
          `Admin credit $${amount} — withdrawal locked until level ${unlockLevel} (${unlockLevelRecord.name})`,
        status: 'completed',
      })
      credited++
    }

    return response.ok({
      message: `${credited} users at ${levelRecord.name} credited $${amount} each.`,
      credited,
    })
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

    return response.ok({
      message: `Capital lock of $${locked} removed. User can now withdraw freely.`,
    })
  }

  /**
   * GET /admin/api/credits/members-by-level
   * Get all members at level 1 or higher with their referral level and wallet details
   */
  async getMembersAtLevelOneOrHigher({ response }: HttpContext) {
    const users = await User.query()
      .whereHas('referralLevel', (query) => {
        query.where('level', '>=', 1)
      })
      .preload('referralLevel')
      .preload('wallet')
      .orderBy('fullName', 'asc')

    const lastWeek = DateTime.now().minus({ weeks: 1 }).toSQL()

    const result = []
    for (const user of users) {
      const balance = user.wallet ? Number(user.wallet.balance) : 0
      const investmentBalance = user.wallet ? Number(user.wallet.investmentBalance) : 0
      const weeklySalary = user.referralLevel ? Number(user.referralLevel.weeklySalary) : 0

      let isPaidThisWeek = false
      if (user.wallet) {
        const alreadyPaid = await Transaction.query()
          .where('walletId', user.wallet.id)
          .where('type', 'referral_salary')
          .where('createdAt', '>', lastWeek!)
          .first()
        isPaidThisWeek = !!alreadyPaid
      }

      result.push({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        referralLevel: {
          id: user.referralLevel?.id,
          level: user.referralLevel?.level,
          name: user.referralLevel?.name,
          weeklySalary: weeklySalary,
        },
        wallet: {
          id: user.wallet?.id,
          balance: balance,
          investmentBalance: investmentBalance,
        },
        isPaidThisWeek,
        joinedAt: user.createdAt,
      })
    }

    return response.ok(result)
  }

  /**
   * POST /admin/api/credits/pay-members-by-level
   * Automatically pay weekly salaries to all members at level 1 or higher (or a specific user if userId is provided)
   */
  async payMembersAtLevelOneOrHigher({ request, response }: HttpContext) {
    const { userId } = request.only(['userId'])

    const query = User.query()
      .whereHas('referralLevel', (q) => {
        q.where('level', '>=', 1)
      })
      .preload('referralLevel')
      .preload('wallet')

    if (userId) {
      query.where('id', userId)
    }

    const users = await query

    const lastWeek = DateTime.now().minus({ weeks: 1 }).toSQL()

    const results = []
    let paidCount = 0
    let skippedCount = 0

    for (const user of users) {
      if (!user.wallet) {
        results.push({
          userId: user.id,
          fullName: user.fullName,
          email: user.email,
          status: 'no_wallet',
          amount: 0,
        })
        skippedCount++
        continue
      }

      const salary = user.referralLevel ? Number(user.referralLevel.weeklySalary) : 0
      if (salary <= 0) {
        results.push({
          userId: user.id,
          fullName: user.fullName,
          email: user.email,
          status: 'zero_salary',
          amount: 0,
        })
        skippedCount++
        continue
      }

      // Check if they already received their weekly salary in the last 7 days
      const alreadyPaid = await Transaction.query()
        .where('walletId', user.wallet.id)
        .where('type', 'referral_salary')
        .where('createdAt', '>', lastWeek!)
        .first()

      if (alreadyPaid) {
        results.push({
          userId: user.id,
          fullName: user.fullName,
          email: user.email,
          status: 'already_paid_this_week',
          amount: salary,
        })
        skippedCount++
        continue
      }

      // Perform the payment
      const wallet = user.wallet
      wallet.balance = Number(wallet.balance) + salary
      await wallet.save()

      await Transaction.create({
        walletId: wallet.id,
        amount: salary,
        type: 'referral_salary',
        description: `Weekly salary for ${user.referralLevel.name} (Level ${user.referralLevel.level})`,
        status: 'completed',
      })

      // Send the payment notification email in English
      try {
        await mail.send((message) => {
          message
            .to(user.email)
            .subject('🎉 Weekly Salary Credited - Phoenix capital')
            .htmlView('emails/weekly_salary_paid', {
              user,
              amount: salary,
              levelName: user.referralLevel.name,
              level: user.referralLevel.level,
            })
        })
      } catch (mailError) {
        console.error(`Failed to send weekly salary email to ${user.email}:`, mailError)
      }

      results.push({
        userId: user.id,
        fullName: user.fullName,
        email: user.email,
        status: 'paid',
        amount: salary,
      })
      paidCount++
    }

    return response.ok({
      message: userId
        ? paidCount > 0
          ? 'User paid successfully.'
          : 'User payment skipped.'
        : `${paidCount} users paid, ${skippedCount} skipped.`,
      paidCount,
      skippedCount,
      results,
    })
  }
}
