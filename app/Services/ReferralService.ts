import User from '#models/user'
import ReferralLevel from '#models/referral_level'
import db from '@adonisjs/lucid/services/db'
import Wallet from '#models/wallet' // Import Wallet model

export default class ReferralService {
  /**
   * Counts the total number of active team members for a given user,
   * including direct and indirect referrals, who have an investmentBalance > 0.
   * Uses a recursive CTE for efficient database traversal.
   */
  private async countTotalActiveTeamMembers(userId: number): Promise<number> {
    // Ensure the user exists and has a wallet to avoid errors
    const user = await User.query().where('id', userId).preload('wallet').first()
    if (!user || !user.wallet) {
      return 0
    }

    const result = await db.rawQuery<{ total: number }[]>(`
      WITH RECURSIVE ReferralHierarchy AS (
        -- Anchor member: the direct referrals of the user
        SELECT id, referrer_id
        FROM users
        WHERE referrer_id = :userId

        UNION ALL

        -- Recursive member: referrals of the previous level
        SELECT u.id, u.referrer_id
        FROM users u
        INNER JOIN ReferralHierarchy rh ON u.referrer_id = rh.id
      )
      SELECT COUNT(DISTINCT rh.id) as total
      FROM ReferralHierarchy rh
      JOIN wallets w ON rh.id = w.user_id
      WHERE w.investment_balance > 0;
    `, { userId })

    return result.rows[0]?.total || 0
  }

  /**
   * Counts the number of direct active referrals for a given user.
   * An active referral is a direct referral with an investmentBalance > 0.
   */
  private async countDirectActiveReferrals(userId: number): Promise<number> {
    const result = await User.query()
      .where('referrerId', userId)
      .whereHas('wallet', (walletQuery) => {
        walletQuery.where('investmentBalance', '>', 0)
      })
      .count('* as total')

    return Number(result[0].$extras.total)
  }

  /**
   * Calculates and updates the referral level for a single user based on
   * their direct active referrals and total active team members.
   */
  public async updateUserLevel(user: User): Promise<void> {
    // Fetch all referral levels, ordered by minReferrals descending to find the highest eligible level first
    const referralLevels = await ReferralLevel.query().orderBy('minReferrals', 'desc')

    const directActiveReferrals = await this.countDirectActiveReferrals(user.id)
    const totalActiveTeamMembers = await this.countTotalActiveTeamMembers(user.id)

    let eligibleLevel: ReferralLevel | null = null
    for (const level of referralLevels) {
      // Level 0 is a special case, it's the default and doesn't require minReferrals
      if (level.level === 0) {
        // If no other level is met, level 0 is the default
        if (!eligibleLevel) {
          eligibleLevel = level
        }
        continue
      }

      // For Level 1, check direct active referrals
      if (level.level === 1 && directActiveReferrals >= level.minReferrals) {
        eligibleLevel = level
        break // Found the highest eligible level
      }
      // For Level 2+, check total active team members
      else if (level.level > 1 && totalActiveTeamMembers >= level.minReferrals) {
        eligibleLevel = level
        break // Found the highest eligible level
      }
    }

    // If after checking all levels, no eligible level was found (e.g., no level 0 defined),
    // ensure a default is set if possible, or handle this edge case.
    // Given we added Level 0, this should always find at least Level 0.
    if (!eligibleLevel) {
      eligibleLevel = await ReferralLevel.findBy('level', 0) // Fallback to Level 0
    }

    // Update user's referralLevelId if it has changed
    if (eligibleLevel && user.referralLevelId !== eligibleLevel.id) {
      user.referralLevelId = eligibleLevel.id
      await user.save()
      console.log(`User ${user.id} (${user.fullName}) level changed to ${eligibleLevel.name}`)
    }
  }

  /**
   * Traverses the upline of a starting user and updates the referral levels
   * for each referrer in the chain. This is called when an event occurs
   * that might affect upline levels (e.g., a downline user becomes active).
   */
  public async updateUplineLevels(startingUserId: number): Promise<void> {
    const user = await User.find(startingUserId)
    if (!user || !user.referrerId) {
      return // No user or no referrer, nothing to update in the upline
    }

    let currentReferrerId: number | null = user.referrerId
    while (currentReferrerId) {
      const referrer = await User.find(currentReferrerId)
      if (referrer) {
        await this.updateUserLevel(referrer) // Update the current referrer's level
        currentReferrerId = referrer.referrerId // Move up to the next referrer
      } else {
        currentReferrerId = null // No more referrer in the chain
      }
    }
  }
}
