import User from '#models/user'
import Wallet from '#models/wallet'
import Transaction from '#models/transaction'
import Subscription from '#models/subscription'

export default class BonusService {
  public async grantWelcomeBonus(_user: User) {
    // Welcome bonus is no longer granted at registration.
    // This method is kept empty to avoid breaking existing calls if any remain.
  }

  /**
   * Process referral bonuses triggered by a user's FIRST INVESTMENT (subscription).
   * New Logic:
   * - User: Receives 5% of the invested amount directly in main balance.
   * - Referrer: Receives 5% of the invested amount directly in main balance.
   *
   * @param user The user who made the investment
   * @param investedAmount The amount of the investment
   */
  public async processFirstInvestmentBonus(user: User, investedAmount: number) {
    if (!investedAmount || investedAmount <= 0) {
      return
    }

    const wallet = await user.related('wallet').query().firstOrFail()

    // 1. Check if this is the FIRST subscription
    // We count subscriptions. Since this is called after the subscription is created,
    // if count is 1, it is indeed the first one.
    const subscriptionCount = await Subscription.query()
      .where('userId', user.id)
      .count('* as total')

    const count = Number(subscriptionCount[0].$extras.total)

    // If count > 1, it's not the first investment
    if (count > 1) {
      return
    }

    const bonusAmount = investedAmount * 0.05 // 5% calculation

    // 2. Credit the User (5% bonus)
    wallet.balance = Number(wallet.balance) + bonusAmount
    await wallet.save()

    await Transaction.create({
      walletId: wallet.id,
      amount: bonusAmount,
      type: 'bonus',
      status: 'completed',
      description: `Bonus de premier investissement de 5% (${bonusAmount} USDT)`,
    })

    console.log(`First investment bonus of ${bonusAmount} granted to user ${user.id}`)

    // 3. Credit the Referrer (5% bonus)
    await user.load('referrer')
    if (user.referrer) {
      // Double check: Verify if the referrer already received a bonus for THIS user to prevent duplicates
      const existingBonus = await Transaction.query()
        .where('type', 'referral_bonus')
        .where('description', 'like', `%${user.fullName}%`)
        .first()
      
      if (existingBonus) {
          console.log('Referral bonus already granted for this user.')
          return
      }

      const referrerWallet = await user.referrer.related('wallet').query().first()
      if (referrerWallet) {
        referrerWallet.balance = (Number(referrerWallet.balance) || 0) + bonusAmount
        await referrerWallet.save()

        await Transaction.create({
          walletId: referrerWallet.id,
          amount: bonusAmount,
          type: 'referral_bonus',
          status: 'completed',
          description: `Bonus de parrainage de 5% (${bonusAmount} USDT) sur le premier investissement de ${user.fullName}`,
        })

        console.log(`Referral bonus of ${bonusAmount} granted to referrer ${user.referrer.id} for user ${user.id}`)
      }
    }
  }
}
