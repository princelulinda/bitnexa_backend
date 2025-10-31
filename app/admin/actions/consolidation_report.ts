import { type ActionContext, type ActionRequest, type ActionResponse } from 'adminjs'

import Deposit from '#models/deposit'
import { BlockchainService } from '#services/BlockchainService'

const consolidationReportAction = {
  actionType: 'resource',
  icon: 'Document',
  label: 'Rapport de Consolidation',
  handler: async () => {
    const mainWalletAddress = 'ADRESSE_PRINCIPALE_NON_CONFIGURÉE' // TODO: Remplacez par la vraie adresse

    const deposits = await Deposit.all()
    const uniqueAddresses = [...new Map(deposits.map((d) => [d.address, d])).values()]

    const blockchainService = new BlockchainService()
    let totalBalance = 0
    const records = []

    for (const deposit of uniqueAddresses) {
      try {
        const balance = await blockchainService.getUSDTBalance(
          deposit.address,
          deposit.network as 'ERC20' | 'BEP20'
        )
        if (balance > 0) {
          records.push({
            address: deposit.address,
            network: deposit.network,
            balance: balance,
          })
          totalBalance += balance
        }
      } catch (error) {
        console.error(`Could not get balance for ${deposit.address} on ${deposit.network}:`, error)
      }
    }

    return {
      records: records,
      totalBalance: totalBalance,
      mainWalletAddress: mainWalletAddress,
    }
  },
  component: 'ConsolidationReport',
}

export default consolidationReportAction
