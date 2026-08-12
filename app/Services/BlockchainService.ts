import { ethers, type InfuraProvider, type JsonRpcProvider, Contract } from 'ethers'
import env from '#start/env'

const USDT_ABI = [
  // Transfer event
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  // balanceOf function
  'function balanceOf(address owner) view returns (uint256)',
  // transfer function
  'function transfer(address to, uint256 value) returns (bool)',
  // decimals function
  'function decimals() view returns (uint8)',
]

const USDT_CONTRACT_ADDRESSES = {
  ERC20: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT Ethereum
  BEP20: '0x55d398326f99059fF775485246999027B3197955', // USDT BSC
}

export class BlockchainService {
  private infuraProjectId: string | undefined
  private gasWalletPrivateKey: string
  private mainWalletAddress: string
  private providers: {
    ERC20: ethers.InfuraProvider
    BEP20: ethers.JsonRpcProvider
  }

  constructor() {
    this.infuraProjectId = env.get('INFURA_PROJECT_ID')
    this.gasWalletPrivateKey = env.get('GAS_WALLET_PRIVATE_KEY')
    this.mainWalletAddress = env.get('MAIN_WALLET_ADDRESS')

    if (!this.infuraProjectId) {
      throw new Error('Missing required environment variable INFURA_PROJECT_ID.')
    }

    this.providers = {
      ERC20: new ethers.InfuraProvider('mainnet', this.infuraProjectId),
      BEP20: new ethers.JsonRpcProvider(env.get('BSC_RPC_URL')),
    }
  }

  public async sweepUSDT(
    depositWallet: ethers.HDNodeWallet,
    network: 'ERC20' | 'BEP20'
  ): Promise<string> {
    const provider = this.providers[network]
    const wallet = depositWallet.connect(provider)
    const contractAddress = USDT_CONTRACT_ADDRESSES[network]
    const usdtContract = new Contract(contractAddress, USDT_ABI, wallet)

    const balanceWei = await usdtContract.balanceOf(wallet.address)
    if (balanceWei === 0n) return 'No USDT to sweep.'

    // 1. Calculate required gas fees
    const gasPrice = (await provider.getFeeData()).gasPrice || ethers.parseUnits('3', 'gwei')
    const gasLimit = 65000n // Generous estimate for USDT transfer
    const requiredGas = gasPrice * gasLimit

    // 2. Check native currency balance (BNB/ETH)
    const nativeBalance = await provider.getBalance(wallet.address)

    if (nativeBalance < requiredGas && network === 'BEP20') {
      console.log(`[Sweeper] Insufficient gas on ${wallet.address} (BEP20). Sending funds from Gas Wallet...`)
      const gasWallet = new ethers.Wallet(this.gasWalletPrivateKey, provider)
      
      // Check gas wallet balance first
      const gasWalletBalance = await provider.getBalance(gasWallet.address)
      const amountToSend = (requiredGas * 12n) / 10n // Send 120% of required gas
      
      // Estimate gas for the replenishment transaction itself (standard transfer is 21000 gas)
      const gasWalletTxCost = gasPrice * 21000n
      
      if (gasWalletBalance < (amountToSend + gasWalletTxCost)) {
        throw new Error(`[Sweeper] Gas wallet ${gasWallet.address} has insufficient funds to replenish deposit wallet. Balance: ${ethers.formatEther(gasWalletBalance)}, Needed: ${ethers.formatEther(amountToSend + gasWalletTxCost)}`)
      }

      const tx = await gasWallet.sendTransaction({
        to: wallet.address,
        value: amountToSend,
      })
      await tx.wait()
      console.log(`[Sweeper] Gas sent: ${tx.hash}`)
    } else if (nativeBalance < requiredGas && network !== 'BEP20') {
      console.warn(`[Sweeper] Insufficient gas on ${wallet.address} for ${network}. Automatic replenishment is disabled for this network.`)
      throw new Error(`Insufficient native balance for gas on ${network}`)
    }

    // 3. Transfer USDT to Main Wallet
    console.log(`[Sweeper] Transferring USDT from ${wallet.address} to ${this.mainWalletAddress}...`)
    const sweepTx = await usdtContract.transfer(this.mainWalletAddress, balanceWei)
    await sweepTx.wait()
    
    console.log(`[Sweeper] USDT transferred: ${sweepTx.hash}`)
    return sweepTx.hash
  }

  /**
   * Sweeps the native BNB balance of a deposit wallet to a destination address,
   * leaving just enough to cover the transfer's own gas cost.
   */
  public async sweepNativeBalance(
    depositWallet: ethers.HDNodeWallet,
    network: 'BEP20',
    destinationAddress: string
  ): Promise<{ hash: string; amount: string } | null> {
    const provider = this.providers[network]
    const wallet = depositWallet.connect(provider)

    const balance = await provider.getBalance(wallet.address)
    if (balance === 0n) return null

    const gasPrice = (await provider.getFeeData()).gasPrice || ethers.parseUnits('3', 'gwei')
    const gasLimit = 21000n
    const gasCost = gasPrice * gasLimit

    if (balance <= gasCost) return null

    const amountToSend = balance - gasCost

    const tx = await wallet.sendTransaction({
      to: destinationAddress,
      value: amountToSend,
      gasLimit,
      gasPrice,
    })
    await tx.wait()

    return { hash: tx.hash, amount: ethers.formatEther(amountToSend) }
  }

  /**
   * Fetches incoming USDT transactions for an address (Best-effort)
   */
  public async getDepositsForAddress(
    address: string,
    network: 'ERC20' | 'BEP20'
  ): Promise<Array<{ txHash: string; from: string; amount: number }>> {
    try {
      const provider = this.providers[network]
      const contractAddress = USDT_CONTRACT_ADDRESSES[network]

      if (!contractAddress) return []

      const usdtContract = new Contract(contractAddress, USDT_ABI, provider)
      const latestBlock = await provider.getBlockNumber()
      
      // Drastically reduce scan range for free RPCs
      const scanRange = 100 
      const fromBlock = Math.max(0, latestBlock - scanRange)

      const events = await usdtContract.queryFilter(
        usdtContract.filters.Transfer(null, address),
        fromBlock,
        latestBlock
      )

      const decimals = await usdtContract.decimals().catch(() => 6)

      return events
        .map((event) => {
          if (!('args' in event)) return null
          return {
            amount: parseFloat(ethers.formatUnits(event.args.value, decimals)),
            txHash: event.transactionHash,
            from: event.args.from,
          }
        })
        .filter(Boolean) as Array<{ amount: number; txHash: string; from: string }>
    } catch (error) {
      console.error(`[BlockchainService] Error fetching events for ${address}:`, error.message)
      return [] // Return empty on RPC error instead of crashing the process
    }
  }

  /**
   * Fetches the USDT balance of an address
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
