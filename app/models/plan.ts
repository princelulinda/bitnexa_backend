import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Subscription from '#models/subscription'
import Signal from '#models/signal'

export default class Plan extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

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
