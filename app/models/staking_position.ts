import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { v4 as uuidv4 } from 'uuid'
import User from '#models/user'
import StakingPlan from '#models/staking_plan'

export default class StakingPosition extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare stakingPlanId: string

  @column()
  declare token: string

  @column()
  declare amount: number

  @column()
  declare apyPercent: number

  @column()
  declare durationDays: number

  @column()
  declare rewardsEarned: number

  @column.dateTime()
  declare startedAt: DateTime

  @column.dateTime()
  declare endsAt: DateTime

  @column.dateTime()
  declare lastRewardAt: DateTime | null

  @column()
  declare status: 'active' | 'completed' | 'cancelled'

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => StakingPlan)
  declare stakingPlan: BelongsTo<typeof StakingPlan>

  @beforeCreate()
  static assignUuid(pos: StakingPosition) {
    pos.id = uuidv4()
  }
}
