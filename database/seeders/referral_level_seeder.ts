import { BaseSeeder } from '@adonisjs/lucid/seeders'
import ReferralLevel from '#models/referral_level'

export default class extends BaseSeeder {
  async run() {
    await ReferralLevel.createMany([
      {
        level: 1,
        name: 'Level 1',
        minReferrals: 5,
        weeklySalary: 15,
      },
      {
        level: 2,
        name: 'Level 2',
        minReferrals: 30, // Assuming this refers to total active team members
        weeklySalary: 60,
      },
    ])
  }
}
