import { Contract, ethers, InfuraProvider, JsonRpcProvider } from 'ethers'
// import TronWeb from 'tronweb'
import env from '#start/env'

// USDT ERC20/BEP20 ABI (simplified for transfer event and balance check)
const USDT_ABI = [
  // Transfer event
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  // balanceOf function
  'function balanceOf(address owner) view returns (uint256)',
  // decimals function
  'function decimals() view returns (uint8)',
]

// USDT contract addresses (example, replace with actual addresses for mainnet/testnet)
const USDT_CONTRACT_ADDRESSES = {
  ERC20: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // Mainnet USDT
  BEP20: '0x55d398326f99059fF775485246999027B3197955', // BSC USDT
}

export class CryptoAddressGenerator {
  private mnemonic: string
  private infuraProjectId: string | undefined
  // private tronGridApiKey: string | undefined

  constructor() {
    this.mnemonic = env.get('HD_WALLET_MNEMONIC')
    this.infuraProjectId = env.get('INFURA_PROJECT_ID')
    // this.tronGridApiKey = env.get('TRONGRID_API_KEY')

    if (!this.mnemonic) {
      throw new Error('HD_WALLET_MNEMONIC is not set in environment variables.')
    }
  }

  /**
   * Derives an EVM-compatible address (ERC20, BEP20) from the HD wallet.
   * @param userId Used as account index for unique derivation.
   * @returns The derived Ethereum-like address.
   */
  private deriveEVMAddress(network: string, addressIndex: number): string {
    const accountNumber = network === 'ERC20' ? 0 : 1
    const path = `44'/60'/${accountNumber}'/0/${addressIndex}` 
    const wallet = ethers.HDNodeWallet.fromPhrase(this.mnemonic).derivePath(path)
    return wallet.address
  }

  /**
   * Generates a deposit address for a given user, currency, and network.
   * @param userId The ID of the user.
   * @param currency The currency (e.g., 'USDT').
   * @param network The network (e.g., 'ERC20', 'BEP20', 'TRC20').
   * @returns The generated crypto address.
   */
  public async generateAddress(
    currency: string,
    network: string,
    addressIndex: number
  ): Promise<string> {
    if (currency !== 'USDT') {
      throw new Error('Only USDT is supported for address generation.')
    }

    switch (network) {
      case 'ERC20':
      case 'BEP20':
        if (!this.infuraProjectId) {
          throw new Error('INFURA_PROJECT_ID is not configured for EVM networks.')
        }
        return this.deriveEVMAddress(network, addressIndex)
      default:
        throw new Error('Unsupported network.')
    }
  }

  public getEVMProvider(network: 'ERC20' | 'BEP20') {
    if (!this.infuraProjectId) {
      throw new Error('INFURA_PROJECT_ID is not configured.')
    }
    if (network === 'ERC20') {
      return new InfuraProvider('mainnet', this.infuraProjectId)
    } else if (network === 'BEP20') {
      // Infura doesn't directly support BSC, you'd use a custom RPC URL for BSC
      // For production, use a reliable BSC RPC endpoint
      return new JsonRpcProvider('https://bsc-dataseed.binance.org/')
    }
    throw new Error('Invalid EVM network.')
  }

  /**
   * Queries the blockchain for USDT deposit events to a specific address.
   * @param depositAddress The address to check for deposits.
   * @param network The network (ERC20 or BEP20).
   * @param blocksToCheck The number of recent blocks to check.
   * @returns An array of deposit events with amount, txHash, and fromAddress.
   */
  public async getDepositsForAddress(
    depositAddress: string,
    network: 'ERC20' | 'BEP20',
    blocksToCheck: number = 100
  ): Promise<Array<{ amount: number; txHash: string; fromAddress: string }>> {
    if (!['ERC20', 'BEP20'].includes(network)) {
      throw new Error('Only ERC20/BEP20 networks are supported for deposit querying.')
    }

    const provider = this.getEVMProvider(network)
    const usdtContractAddress = USDT_CONTRACT_ADDRESSES[network]

    if (!usdtContractAddress) {
      throw new Error(`USDT contract address not configured for network ${network}`)
    }

    const usdtContract = new Contract(usdtContractAddress, USDT_ABI, provider)
    const decimals = await usdtContract.decimals()

    const latestBlock = await provider.getBlockNumber()
    const fromBlock = Math.max(0, latestBlock - blocksToCheck)

    const depositEvents = await usdtContract.queryFilter(
      usdtContract.filters.Transfer(null, depositAddress),
      fromBlock,
      latestBlock
    )

    return depositEvents
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

        const amount = parseFloat(ethers.formatUnits(amountWei, decimals)) // Convert to number
        return { amount, txHash, fromAddress }
      })
      .filter(Boolean) as Array<{ amount: number; txHash: string; fromAddress: string }>
  }
}
