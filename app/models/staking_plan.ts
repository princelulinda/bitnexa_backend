import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { v4 as uuidv4 } from 'uuid'
import StakingPosition from '#models/staking_position'

export default class StakingPlan extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare token: 'ETH' | 'SOL'

  @column()
  declare durationDays: number

  @column()
  declare apyPercent: number

  @column()
  declare minAmount: number

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => StakingPosition)
  declare positions: HasMany<typeof StakingPosition>

  @beforeCreate()
  static assignUuid(plan: StakingPlan) {
    plan.id = uuidv4()
  }
}
