import { ethers, type InfuraProvider, type JsonRpcProvider, Contract } from 'ethers'
import env from '#start/env'

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

  /**
   * Transfère les USDT d'une adresse de dépôt vers le portefeuille principal.
   * Si l'adresse n'a pas assez de BNB/ETH pour les frais, le Gas Wallet en envoie.
   */
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

    // 1. Calcul des frais de gaz nécessaires
    const gasPrice = (await provider.getFeeData()).gasPrice || ethers.parseUnits('3', 'gwei')
    const gasLimit = 65000n // Estimation large pour un transfert USDT
    const requiredGas = gasPrice * gasLimit

    // 2. Vérifier le solde de la monnaie native (BNB/ETH)
    const nativeBalance = await provider.getBalance(wallet.address)

    if (nativeBalance < requiredGas) {
      console.log(`[Sweeper] Pas assez de gaz sur ${wallet.address}. Envoi de fonds depuis le Gas Wallet...`)
      const gasWallet = new ethers.Wallet(this.gasWalletPrivateKey, provider)
      
      // Envoyer un peu plus que nécessaire pour être sûr (ex: 120% du requis)
      const amountToSend = (requiredGas * 12n) / 10n 
      
      const tx = await gasWallet.sendTransaction({
        to: wallet.address,
        value: amountToSend,
      })
      await tx.wait()
      console.log(`[Sweeper] Gaz envoyé: ${tx.hash}`)
    }

    // 3. Transférer les USDT vers le Main Wallet
    console.log(`[Sweeper] Transfert de USDT de ${wallet.address} vers ${this.mainWalletAddress}...`)
    const sweepTx = await usdtContract.transfer(this.mainWalletAddress, balanceWei)
    await sweepTx.wait()
    
    console.log(`[Sweeper] USDT transférés: ${sweepTx.hash}`)
    return sweepTx.hash
  }

  /**
   * Récupère les transactions USDT entrantes pour une adresse (Best-effort)
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
      
      // Réduire drastiquement la plage de scan pour les RPC gratuits
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
      return [] // Retourne vide en cas d'erreur RPC au lieu de faire planter le process
    }
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
    console.log(parseFloat(ethers.formatUnits(balanceWei, decimals)))

    return parseFloat(ethers.formatUnits(balanceWei, decimals))
  }
}
