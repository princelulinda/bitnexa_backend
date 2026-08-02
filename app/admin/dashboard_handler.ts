import User from '#models/user'
import Wallet from '#models/wallet'
import Transaction from '#models/transaction'
import Deposit from '#models/deposit'
import db from '@adonisjs/lucid/services/db'
import { BlockchainService } from '../Services/BlockchainService.js'

export const dashboardHandler = async () => {
  try {
    // Key Stats
    const totalUsers = (await User.query().count('* as total'))[0].$extras.total
    const totalWallets = (await Wallet.query().count('* as total'))[0].$extras.total
    const totalTransactions = (await Transaction.query().count('* as total'))[0].$extras.total
    const totalDepositsResult = (await Deposit.query().sum('expected_amount as total'))[0].$extras
      .total
    const totalDeposits = totalDepositsResult || 0

    // Last 5 Users
    const last5Users = await User.query().orderBy('createdAt', 'desc').limit(5)

    // Last 5 Transactions
    const last5Transactions = await Transaction.query().orderBy('createdAt', 'desc').limit(5)

    // Evolution Data (Last 30 Days)
    const usersEvolutionRaw = await db.rawQuery(`
      SELECT DATE(created_at) as date, COUNT(id) as count
      FROM users
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `)
    
    const transactionsEvolutionRaw = await db.rawQuery(`
      SELECT DATE(created_at) as date, COUNT(id) as count, SUM(amount) as volume
      FROM transactions
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `)
    
    const depositsEvolutionRaw = await db.rawQuery(`
      SELECT DATE(created_at) as date, SUM(expected_amount) as volume
      FROM deposits
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `)

    // Format evolution data for Recharts
    // Let's create a 30-day timeline map to ensure no gaps
    const evolutionMap = new Map()
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      evolutionMap.set(dateStr, { name: dateStr, users: 0, transactions: 0, txVolume: 0, deposits: 0 })
    }

    usersEvolutionRaw.rows.forEach((row: any) => {
      const dateStr = row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date
      if (evolutionMap.has(dateStr)) {
        evolutionMap.get(dateStr).users = parseInt(row.count) || 0
      }
    })

    transactionsEvolutionRaw.rows.forEach((row: any) => {
      const dateStr = row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date
      if (evolutionMap.has(dateStr)) {
        evolutionMap.get(dateStr).transactions = parseInt(row.count) || 0
        evolutionMap.get(dateStr).txVolume = parseFloat(row.volume) || 0
      }
    })
    
    depositsEvolutionRaw.rows.forEach((row: any) => {
      const dateStr = row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date
      if (evolutionMap.has(dateStr)) {
        evolutionMap.get(dateStr).deposits = parseFloat(row.volume) || 0
      }
    })

    const evolutionData = Array.from(evolutionMap.values())

    // TVL Calculation
    const deposits = await Deposit.all()
    const uniqueAddresses = [...new Map(deposits.map((d) => [d.address, d])).values()]
    const blockchainService = new BlockchainService()
    let tvl = 0
    for (const deposit of uniqueAddresses) {
      try {
        const balance = await blockchainService.getUSDTBalance(
          deposit.address,
          deposit.network as 'ERC20' | 'BEP20'
        )
        tvl += balance
      } catch (error) {
        console.error(`Could not get balance for ${deposit.address} on ${deposit.network}:`, error)
      }
    }

    return {
      totalUsers,
      totalWallets,
      totalTransactions,
      totalDeposits,
      last5Users: last5Users.map((u) => u.serialize()),
      last5Transactions: last5Transactions.map((t) => t.serialize()),
      tvl: tvl.toFixed(2),
      evolutionData,
    }
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return {
      error: 'Could not fetch dashboard data',
    }
  }
}
