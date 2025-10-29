import { ethers, InfuraProvider, JsonRpcProvider, Contract } from 'ethers'
import env from '#start/env'
import fetch from 'node-fetch'

const USDT_ABI = [
  // Transfer event
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  // balanceOf function
  'function balanceOf(address owner) view returns (uint256)',
  // decimals function
  'function decimals() view returns (uint8)',
]

const USDT_CONTRACT_ADDRESSES = {
  ERC20: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT Ethereum
  BEP20: '0x55d398326f99059fF775485246999027B3197955', // USDT BSC
}

export class BlockchainService {
  private infuraProjectId: string | undefined
  private providers: {
    ERC20: ethers.InfuraProvider
    BEP20: ethers.JsonRpcProvider
  }

  constructor() {
    this.infuraProjectId = env.get('INFURA_PROJECT_ID')

    if (!this.infuraProjectId) {
      throw new Error('Missing required environment variable INFURA_PROJECT_ID.')
    }

    this.providers = {
      ERC20: new ethers.InfuraProvider('mainnet', this.infuraProjectId),
      BEP20: new ethers.JsonRpcProvider(env.get('BSC_RPC_URL')),
    }
  }

  /**
   * Récupère les transactions USDT entrantes pour une adresse
   */
  public async getDepositsForAddress(
    address: string,
    network: 'ERC20' | 'BEP20'
  ): Promise<Array<{ txHash: string; from: string; amount: number }>> {
    const provider = this.providers[network]
    const contractAddress = USDT_CONTRACT_ADDRESSES[network]

    if (!contractAddress) {
      throw new Error(`USDT contract address not configured for network ${network}`)
    }

    const usdtContract = new Contract(contractAddress, USDT_ABI, provider)
    const decimals = await usdtContract.decimals() // Get decimals from contract

    const latestBlock = await provider.getBlockNumber()
    const scanRange = 500 // The total range to scan, reduced to avoid Infura rate limits
    const fromBlockInitial = Math.max(0, latestBlock - scanRange)
    const chunkSize = 500 // Query in chunks of 500 blocks

    let allDepositEvents: any[] = []

    for (let i = latestBlock; i >= fromBlockInitial; i -= chunkSize) {
      const chunkFromBlock = Math.max(fromBlockInitial, i - chunkSize + 1)
      const chunkToBlock = i

      if (chunkFromBlock > chunkToBlock) {
        break // Avoid invalid block ranges
      }

      const eventsInChunk = await usdtContract.queryFilter(
        usdtContract.filters.Transfer(null, address), // Filter for transfers TO our address
        chunkFromBlock,
        chunkToBlock
      )
      allDepositEvents = allDepositEvents.concat(eventsInChunk)
    }

    return allDepositEvents
      .map((event) => {
        if (!('args' in event)) {
          return null
        }
        const amountWei = event.args.value
        const txHash = event.transactionHash
        const fromAddress = event.args.from

        if (!txHash || !amountWei || !fromAddress) {
          return null // Should not happen with Transfer event
        }

        const amount = parseFloat(ethers.formatUnits(amountWei, decimals))
        return { amount, txHash, from: fromAddress }
      })
      .filter(Boolean) as Array<{ amount: number; txHash: string; from: string }>
  }

  /**
   * Récupère le solde USDT d'une adresse
   */
  public async getUSDTBalance(address: string, network: 'ERC20' | 'BEP20'): Promise<number> {
    const provider = this.providers[network]
    const contractAddress = USDT_CONTRACT_ADDRESSES[network]

    if (!contractAddress) {
      throw new Error(`USDT contract address not configured for network ${network}`)
    }

    const usdtContract = new Contract(contractAddress, USDT_ABI, provider)
    const balanceWei = await usdtContract.balanceOf(address)
    const decimals = await usdtContract.decimals()

    return parseFloat(ethers.formatUnits(balanceWei, decimals))
  }
}
