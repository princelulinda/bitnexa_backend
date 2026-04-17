import { BaseSeeder } from '@adonisjs/lucid/seeders'
import StakingPlan from '#models/staking_plan'

export default class extends BaseSeeder {
  async run() {
    const plans = [
      // ETH plans
      { token: 'ETH', durationDays: 30,  apyPercent: 5.5,  minAmount: 50,  isActive: true },
      { token: 'ETH', durationDays: 60,  apyPercent: 7.0,  minAmount: 50,  isActive: true },
      { token: 'ETH', durationDays: 90,  apyPercent: 9.0,  minAmount: 50,  isActive: true },
      { token: 'ETH', durationDays: 180, apyPercent: 12.0, minAmount: 100, isActive: true },
      // SOL plans
      { token: 'SOL', durationDays: 30,  apyPercent: 6.0,  minAmount: 20,  isActive: true },
      { token: 'SOL', durationDays: 60,  apyPercent: 8.0,  minAmount: 20,  isActive: true },
      { token: 'SOL', durationDays: 90,  apyPercent: 10.5, minAmount: 20,  isActive: true },
      { token: 'SOL', durationDays: 180, apyPercent: 14.0, minAmount: 50,  isActive: true },
    ]

    for (const plan of plans) {
      await StakingPlan.firstOrCreate(
        { token: plan.token, durationDays: plan.durationDays },
        plan
      )
    }
  }
}
