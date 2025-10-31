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

  public async transferWelcomeBonusToInvestment(wallet: Wallet) {
    if (wallet.bonusBalance > 0) {
      const bonusAmount = wallet.bonusBalance
      wallet.investmentBalance = Number(wallet.investmentBalance) + Number(bonusAmount)
      wallet.bonusBalance = 0
      await wallet.save()

      // Create a transaction for the bonus transfer
      await Transaction.create({
        walletId: wallet.id,
        amount: bonusAmount,
        type: 'bonus_transfer',
        status: 'completed',
        description: 'Welcome bonus transferred to investment balance',
      })

      console.log(
        `Transferred ${bonusAmount} from bonus to investment balance for wallet ${wallet.id}`
      )
    }
  }
}
