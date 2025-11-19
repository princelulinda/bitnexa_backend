import User from '#models/user'
import Wallet from '#models/wallet'
import Transaction from '#models/transaction'

export default class BonusService {
  public async grantWelcomeBonus(user: User) {
    const wallet = await user.related('wallet').query().firstOrFail()

    // Check if user has not invested yet and has not received the bonus
    if (Number(wallet.investmentBalance) === 0 && Number(wallet.bonusBalance) === 0) {
      wallet.bonusBalance = Number(wallet.bonusBalance) + 20 // Add 20 USDT non-withdrawable
      await wallet.save()

      // Create a transaction record for the bonus
      await Transaction.create({
        walletId: wallet.id,
        amount: 20,
        type: 'bonus',
        status: 'completed',
        description: 'Welcome bonus for new investor',
      })

      console.log(`Welcome bonus of 20 USDT granted to user ${user.id}`)
    }
  }

  /**
   * Transfer a portion of the welcome bonus to investment balance.
   * Transfers up to 5% of the provided invested amount, but not more than the available bonus balance.
   * @param wallet Wallet instance
   * @param investedAmount Amount the user just invested
   */
  public async transferWelcomeBonusToInvestment(wallet: Wallet, investedAmount: number) {
    const availableBonus = Number(wallet.bonusBalance) || 0
    if (availableBonus <= 0 || !investedAmount || Number(investedAmount) <= 0) {
      return
    }

    // If invested amount is >= 100, transfer the entire available bonus (legacy behavior)
    // Otherwise transfer a fixed 5 USDT (or the available bonus if less)
    let transferAmount = 0
    if (Number(investedAmount) >= 100) {
      transferAmount = availableBonus
    } else {
      transferAmount = Math.min(availableBonus, 5)
    }

    if (transferAmount <= 0) {
      return
    }

    wallet.investmentBalance = Number(wallet.investmentBalance) + transferAmount
    wallet.bonusBalance = Number(wallet.bonusBalance) - transferAmount
    await wallet.save()

    // Create a transaction for the bonus transfer
    await Transaction.create({
      walletId: wallet.id,
      amount: transferAmount,
      type: 'bonus_transfer',
      status: 'completed',
      description: 'Portion of welcome bonus transferred to investment balance',
    })

    console.log(
      `Transferred ${transferAmount} from bonus to investment balance for wallet ${wallet.id}`
    )
  }
}
