import User from '#models/user'
import Wallet from '#models/wallet'
import Transaction from '#models/transaction'
import Deposit from '#models/deposit'
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
    }
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return {
      error: 'Could not fetch dashboard data',
    }
  }
}
