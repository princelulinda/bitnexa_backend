import { ethers, Contract } from 'ethers'
import env from '#start/env'
import Transaction from '#models/transaction'
import Wallet from '#models/wallet'
import mail from '@adonisjs/mail/services/main'

const USDT_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 value) returns (bool)',
  'function decimals() view returns (uint8)',
]

const USDT_CONTRACT_ADDRESSES: Record<string, string> = {
  ERC20: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  BEP20: '0x55d398326f99059fF775485246999027B3197955',
}

export default class WithdrawalService {
  private getProvider(network: string) {
    if (network === 'ERC20') {
      return new ethers.InfuraProvider('mainnet', env.get('INFURA_PROJECT_ID'))
    }
    if (network === 'BEP20') {
      return new ethers.JsonRpcProvider(env.get('BSC_RPC_URL'))
    }
    throw new Error(`Unsupported network: ${network}`)
  }

  /**
   * Parses the destination address and network from the transaction description.
   * Description format: "Withdrawal request of X USDT on NETWORK to ADDRESS"
   */
  private parseWithdrawalDescription(description: string): { address: string; network: string } | null {
    const match = description.match(/on\s+(\w+)\s+to\s+(0x[a-fA-F0-9]{40})/)
    if (!match) return null
    return { network: match[1].toUpperCase(), address: match[2] }
  }

  /**
   * Sends USDT from the hot wallet to the user's address on-chain.
   * Returns the transaction hash.
   */
  public async sendUSDT(toAddress: string, amount: number, network: string): Promise<string> {
    const hotWalletKey = env.get('HOT_WALLET_PRIVATE_KEY')
    if (!hotWalletKey) throw new Error('HOT_WALLET_PRIVATE_KEY is not configured.')

    const provider = this.getProvider(network)
    const hotWallet = new ethers.Wallet(hotWalletKey, provider)
    const contractAddress = USDT_CONTRACT_ADDRESSES[network]
    if (!contractAddress) throw new Error(`No USDT contract for network ${network}`)

    const usdtContract = new Contract(contractAddress, USDT_ABI, hotWallet)
    const decimals: bigint = await usdtContract.decimals()
    const amountWei = ethers.parseUnits(amount.toFixed(Number(decimals)), Number(decimals))

    // Check hot wallet USDT balance
    const hotBalance: bigint = await usdtContract.balanceOf(hotWallet.address)
    if (hotBalance < amountWei) {
      throw new Error(
        `Hot wallet has insufficient USDT. Has: ${ethers.formatUnits(hotBalance, decimals)}, needs: ${amount}`
      )
    }

    const tx = await usdtContract.transfer(toAddress, amountWei)
    const receipt = await tx.wait()
    return receipt.hash
  }

  /**
   * Processes a pending withdrawal transaction automatically.
   * Called right after the user submits a withdrawal request.
   */
  public async processWithdrawal(transactionId: string): Promise<void> {
    const transaction = await Transaction.query()
      .where('id', transactionId)
      .where('type', 'withdrawal')
      .where('status', 'pending_admin_approval')
      .firstOrFail()

    const parsed = this.parseWithdrawalDescription(transaction.description ?? '')
    if (!parsed) {
      console.error(`[WithdrawalService] Could not parse address/network from: ${transaction.description}`)
      return
    }

    const { address, network } = parsed

    // Mark as processing
    transaction.status = 'processing_withdrawal'
    await transaction.save()

    try {
      const txHash = await this.sendUSDT(address, Number(transaction.amount), network)

      transaction.status = 'completed'
      transaction.description = `Withdrawal of ${transaction.amount} sent. TXID: ${txHash}`
      await transaction.save()

      // Send confirmation email
      const wallet = await Wallet.findOrFail(transaction.walletId)
      const user = await wallet.related('user').query().firstOrFail()

      await mail.send((message) => {
        message
          .to(user.email)
          .subject('Withdrawal confirmed - Trsbit')
          .htmlView('emails/withdrawal_confirmed', {
            user,
            amount: transaction.amount,
            network,
            txid: txHash,
          })
      })

      console.log(`[WithdrawalService] Withdrawal ${transactionId} completed. TXID: ${txHash}`)
    } catch (error) {
      console.error(`[WithdrawalService] Failed to process withdrawal ${transactionId}:`, error.message)

      // Revert to pending_admin_approval so admin can retry manually
      transaction.status = 'pending_admin_approval'
      transaction.description = `${transaction.description} [AUTO-SEND FAILED: ${error.message}]`
      await transaction.save()

      throw error
    }
  }
}
