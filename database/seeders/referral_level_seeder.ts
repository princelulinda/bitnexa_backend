import { BaseSeeder } from '@adonisjs/lucid/seeders'
import ReferralLevel from '#models/referral_level'

export default class extends BaseSeeder {
  async run() {
    await ReferralLevel.firstOrCreate(
      { level: 0 },
      { name: 'LV0', minReferrals: 0, weeklySalary: 0 }
    )
    await ReferralLevel.firstOrCreate(
      { level: 1 },
      { name: 'LV1', minReferrals: 5, weeklySalary: 15 }
    )
    await ReferralLevel.firstOrCreate(
      { level: 2 },
      { name: 'LV3', minReferrals: 30, weeklySalary: 60 }
    )
  }
}
