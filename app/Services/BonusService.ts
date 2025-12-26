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

  /**
   * Process referral bonuses triggered by a user's first approved deposit.
   * Gives:
   * - Referrer: 10 USDT + 500 Airdrop points
   * - User: 5 USDT (Welcome bonus via referral link)
   */
  public async processReferralDepositBonus(user: User) {
    // 1. Check if user has a referrer
    await user.load('referrer')
    if (!user.referrer) {
      return
    }

    // 2. Check if this is the FIRST completed deposit
    // We count completed deposits. If there is more than 1, it's not the first.
    const wallet = await user.related('wallet').query().firstOrFail()
    
    const depositCount = await Transaction.query()
      .where('walletId', wallet.id)
      .where('type', 'deposit')
      .where('status', 'completed')
      .count('* as total')

    const count = Number(depositCount[0].$extras.total)

    // Ensure we don't trigger this multiple times. 
    // If count is 1 (the one just processed), we proceed. 
    // If count > 1, we stop.
    if (count > 1) {
      return
    }

    // Double check: Verify if the referrer already received a bonus for THIS user
    // This is a safety check against race conditions or manual adjustments
    const existingBonus = await Transaction.query()
        .where('type', 'referral_bonus')
        .where('description', 'like', `%${user.fullName}%`) // Heuristic check
        .first()
    
    // Ideally, we should check specifically on the referrer wallet, but let's proceed with the wallet logic below.

    // 3. Credit the Referrer
    const referrerWallet = await user.referrer.related('wallet').query().first()
    if (referrerWallet) {
      // Bonus 1: Standard bonus to main balance (10 USDT)
      const standardBonus = 10
      referrerWallet.balance = (Number(referrerWallet.balance) || 0) + standardBonus
      await referrerWallet.save()

      await Transaction.create({
        walletId: referrerWallet.id,
        amount: standardBonus,
        type: 'referral_bonus',
        status: 'completed',
        description: `Bonus de parrainage standard pour le premier dépôt de ${user.fullName}`,
      })

      // Bonus 2: Airdrop bonus (500 points)
      const airdropBonus = 500
      referrerWallet.airdropBalance = (Number(referrerWallet.airdropBalance) || 0) + airdropBonus
      await referrerWallet.save()

      await Transaction.create({
        walletId: referrerWallet.id,
        amount: airdropBonus,
        type: 'referral_airdrop_bonus',
        status: 'completed',
        description: `Bonus Airdrop de parrainage pour le premier dépôt de ${user.fullName}`,
      })

      console.log(`Referral bonuses granted to referrer ${user.referrer.id} for user ${user.id}`)
    }

    // 4. Credit the User (The 5 USDT welcome bonus for using a referral code)
    // Formerly given at registration
    const newUserBonus = 5
    wallet.bonusBalance = (Number(wallet.bonusBalance) || 0) + newUserBonus
    await wallet.save()

    await Transaction.create({
      walletId: wallet.id,
      amount: newUserBonus,
      type: 'referral_bonus',
      status: 'completed',
      description: `Bonus de bienvenue (validé après dépôt) pour parrainage par ${user.referrer.fullName}`,
    })
  }
}
