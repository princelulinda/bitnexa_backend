import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import Transaction from '#models/transaction'

const PENDING_WITHDRAWAL_STATUSES = ['pending_admin_approval', 'processing_withdrawal']
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export default class AdminDashboardController {
  async stats({ request, response }: HttpContext) {
    const days = Math.min(Math.max(Number(request.qs().days) || 30, 1), 365)

    const totalUsers = Number((await User.query().count('* as total'))[0].$extras.total)
    const totalTransactions = Number(
      (await Transaction.query().count('* as total'))[0].$extras.total
    )

    const usersBeforePeriodRow = await db.rawQuery(
      `SELECT COUNT(id) as count FROM users WHERE created_at < NOW() - INTERVAL '${days} days'`
    )
    const usersBeforePeriod = Number(usersBeforePeriodRow.rows[0].count) || 0

    const usersByDayRaw = await db.rawQuery(`
      SELECT DATE(created_at) as date, COUNT(id) as count
      FROM users
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `)

    const txByDayRaw = await db.rawQuery(`
      SELECT DATE(created_at) as date, COUNT(id) as count, COALESCE(SUM(amount), 0) as volume
      FROM transactions
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `)

    const dayMap = new Map<
      string,
      { date: string; newUsers: number; txCount: number; txVolume: number }
    >()
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setUTCDate(d.getUTCDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      dayMap.set(dateStr, { date: dateStr, newUsers: 0, txCount: 0, txVolume: 0 })
    }
    usersByDayRaw.rows.forEach((row: any) => {
      const dateStr = row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date
      if (dayMap.has(dateStr)) dayMap.get(dateStr)!.newUsers = Number(row.count) || 0
    })
    txByDayRaw.rows.forEach((row: any) => {
      const dateStr = row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date
      if (dayMap.has(dateStr)) {
        dayMap.get(dateStr)!.txCount = Number(row.count) || 0
        dayMap.get(dateStr)!.txVolume = Number.parseFloat(row.volume) || 0
      }
    })

    let cumulative = usersBeforePeriod
    const userGrowth = Array.from(dayMap.values()).map((d) => {
      cumulative += d.newUsers
      return { date: d.date, newUsers: d.newUsers, cumulativeUsers: cumulative }
    })
    const transactionActivity = Array.from(dayMap.values()).map((d) => ({
      date: d.date,
      count: d.txCount,
      volume: d.txVolume,
    }))

    const newUsersInPeriod = Array.from(dayMap.values()).reduce((s, d) => s + d.newUsers, 0)
    const txCountInPeriod = Array.from(dayMap.values()).reduce((s, d) => s + d.txCount, 0)
    const volumeInPeriod = Array.from(dayMap.values()).reduce((s, d) => s + d.txVolume, 0)

    const byTypeRaw = await db.rawQuery(`
      SELECT type, COUNT(id) as count, COALESCE(SUM(amount), 0) as volume
      FROM transactions
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY type
      ORDER BY count DESC
    `)
    const typeRows = byTypeRaw.rows.map((r: any) => ({
      type: r.type,
      count: Number(r.count),
      volume: Number.parseFloat(r.volume) || 0,
    }))
    const topTypes = typeRows.slice(0, 8)
    const otherTypes = typeRows.slice(8)
    const transactionsByType =
      otherTypes.length > 0
        ? [
            ...topTypes,
            {
              type: 'other',
              count: otherTypes.reduce((s: number, r: any) => s + r.count, 0),
              volume: otherTypes.reduce((s: number, r: any) => s + r.volume, 0),
            },
          ]
        : topTypes

    const byStatusRaw = await db.rawQuery(`
      SELECT status, COUNT(id) as count
      FROM transactions
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY status
      ORDER BY count DESC
    `)
    const transactionsByStatus = byStatusRaw.rows.map((r: any) => ({
      status: r.status,
      count: Number(r.count),
    }))

    const kycRaw = await db.rawQuery(`
      SELECT kyc_status as status, COUNT(id) as count FROM users GROUP BY kyc_status
    `)
    const kycBreakdown = kycRaw.rows.map((r: any) => ({ status: r.status, count: Number(r.count) }))

    // Total deposited / withdrawn (all-time, completed only)
    const depositWithdrawTotalsRaw = await db.rawQuery(`
      SELECT type, COALESCE(SUM(ABS(amount)), 0) as total
      FROM transactions
      WHERE type IN ('deposit', 'withdrawal') AND status = 'completed'
      GROUP BY type
    `)
    const totalDeposited =
      Number.parseFloat(
        depositWithdrawTotalsRaw.rows.find((r: any) => r.type === 'deposit')?.total
      ) || 0
    const totalWithdrawn =
      Number.parseFloat(
        depositWithdrawTotalsRaw.rows.find((r: any) => r.type === 'withdrawal')?.total
      ) || 0

    // Pending withdrawals (requested but not yet paid out)
    const pendingWithdrawalsRaw = await db.rawQuery(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(id) as count
       FROM transactions
       WHERE type = 'withdrawal' AND status = ANY(?::text[])`,
      [PENDING_WITHDRAWAL_STATUSES]
    )
    const pendingWithdrawalsAmount = Number.parseFloat(pendingWithdrawalsRaw.rows[0].total) || 0
    const pendingWithdrawalsCount = Number(pendingWithdrawalsRaw.rows[0].count) || 0

    // Deposits vs withdrawals per day (completed only) — for the flow chart
    const depositWithdrawByDayRaw = await db.rawQuery(`
      SELECT DATE(created_at) as date, type, COALESCE(SUM(ABS(amount)), 0) as volume
      FROM transactions
      WHERE created_at >= NOW() - INTERVAL '${days} days'
        AND type IN ('deposit', 'withdrawal') AND status = 'completed'
      GROUP BY DATE(created_at), type
      ORDER BY date ASC
    `)
    const flowMap = new Map(
      Array.from(dayMap.keys()).map((date) => [date, { date, deposits: 0, withdrawals: 0 }])
    )
    depositWithdrawByDayRaw.rows.forEach((row: any) => {
      const dateStr = row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date
      const entry = flowMap.get(dateStr)
      if (!entry) return
      if (row.type === 'deposit') entry.deposits = Number.parseFloat(row.volume) || 0
      if (row.type === 'withdrawal') entry.withdrawals = Number.parseFloat(row.volume) || 0
    })
    const depositWithdrawFlow = Array.from(flowMap.values())

    // Funds currently held on the platform (live wallet aggregates)
    const walletTotalsRaw = await db.rawQuery(`
      SELECT
        COALESCE(SUM(balance), 0) as balance,
        COALESCE(SUM(investment_balance), 0) as investment_balance,
        COALESCE(SUM(gains_balance), 0) as gains_balance,
        COALESCE(SUM(total_invested), 0) as total_invested,
        COALESCE(SUM(locked_capital), 0) as locked_capital,
        COALESCE(SUM(bonus_balance), 0) as bonus_balance,
        COALESCE(SUM(airdrop_balance), 0) as airdrop_balance
      FROM wallets
    `)
    const w = walletTotalsRaw.rows[0]
    const walletTotals = {
      balance: Number.parseFloat(w.balance) || 0,
      investmentBalance: Number.parseFloat(w.investment_balance) || 0,
      gainsBalance: Number.parseFloat(w.gains_balance) || 0,
      totalInvested: Number.parseFloat(w.total_invested) || 0,
      lockedCapital: Number.parseFloat(w.locked_capital) || 0,
      bonusBalance: Number.parseFloat(w.bonus_balance) || 0,
      airdropBalance: Number.parseFloat(w.airdrop_balance) || 0,
    }
    const fundsPresent =
      walletTotals.balance +
      walletTotals.investmentBalance +
      walletTotals.gainsBalance +
      walletTotals.bonusBalance

    const recentUsers = await User.query().orderBy('createdAt', 'desc').limit(10)
    const recentTransactions = await Transaction.query()
      .preload('wallet', (q) => q.preload('user'))
      .orderBy('createdAt', 'desc')
      .limit(10)

    return response.ok({
      range: { days },
      kpis: {
        totalUsers,
        newUsersInPeriod,
        totalTransactions,
        txCountInPeriod,
        volumeInPeriod,
        completedCount: transactionsByStatus.find((s: any) => s.status === 'completed')?.count || 0,
        pendingCount: transactionsByStatus
          .filter(
            (s: any) => s.status.startsWith('pending') || s.status === 'processing_withdrawal'
          )
          .reduce((sum: number, s: any) => sum + s.count, 0),
        failedCount: transactionsByStatus
          .filter((s: any) => s.status === 'failed' || s.status === 'rejected')
          .reduce((sum: number, s: any) => sum + s.count, 0),
        kycVerified: kycBreakdown.find((k: any) => k.status === 'verified')?.count || 0,
        totalDeposited,
        totalWithdrawn,
        netFlow: totalDeposited - totalWithdrawn,
        pendingWithdrawalsAmount,
        pendingWithdrawalsCount,
        fundsPresent,
      },
      wallets: walletTotals,
      userGrowth,
      transactionActivity,
      depositWithdrawFlow,
      transactionsByType,
      transactionsByStatus,
      kycBreakdown,
      recentUsers: recentUsers.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        createdAt: u.createdAt,
        kycStatus: u.kycStatus,
      })),
      recentTransactions: recentTransactions.map((t) => ({
        id: t.id,
        amount: t.amount,
        type: t.type,
        status: t.status,
        createdAt: t.createdAt,
        user: t.wallet?.user
          ? { fullName: t.wallet.user.fullName, email: t.wallet.user.email }
          : null,
      })),
    })
  }

  async withdrawalsByDate({ request, response }: HttpContext) {
    const dateParam = String(request.qs().date || '')
    const date = ISO_DATE_RE.test(dateParam) ? dateParam : DateTime.now().toISODate()

    const rows = await db.rawQuery(
      `SELECT
         t.id as transaction_id, t.amount, t.status, t.created_at, t.description,
         w.id as wallet_id, w.balance, w.investment_balance, w.locked_capital, w.gains_balance,
         u.id as user_id, u.full_name, u.email
       FROM transactions t
       JOIN wallets w ON w.id = t.wallet_id
       JOIN users u ON u.id = w.user_id
       WHERE t.type = 'withdrawal' AND DATE(t.created_at) = ?
       ORDER BY t.created_at DESC`,
      [date]
    )

    const list = rows.rows.map((r: any) => ({
      transactionId: r.transaction_id,
      userId: r.user_id,
      fullName: r.full_name,
      email: r.email,
      amount: Number.parseFloat(r.amount) || 0,
      status: r.status,
      description: r.description,
      createdAt: r.created_at,
      walletBalance: Number.parseFloat(r.balance) || 0,
      walletInvestmentBalance: Number.parseFloat(r.investment_balance) || 0,
      walletGainsBalance: Number.parseFloat(r.gains_balance) || 0,
      walletLockedCapital: Number.parseFloat(r.locked_capital) || 0,
    }))

    return response.ok({
      date,
      count: list.length,
      totalAmount: list.reduce((sum: number, r: any) => sum + r.amount, 0),
      rows: list,
    })
  }
}
