import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, beforeCreate } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Subscription from '#models/subscription'
import Signal from '#models/signal'
import { v4 as uuid } from 'uuid'

export default class Plan extends BaseModel {
  @beforeCreate()
  static assignUuid(plan: Plan) {
    plan.id = uuid()
  }

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare durationDays: number

  @column()
  declare minAmount: number

  @column()
  declare maxAmount: number

  @column()
  declare isActive: boolean

  @column()
  declare signalsPerDay: number

  @column()
  declare gainMultiplier: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @hasMany(() => Subscription)
  declare subscriptions: HasMany<typeof Subscription>

  @hasMany(() => Signal)
  declare signals: HasMany<typeof Signal>
}
