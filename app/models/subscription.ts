import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Plan from '#models/plan'
import Wallet from '#models/wallet'
import { v4 as uuid } from 'uuid'

export default class Subscription extends BaseModel {
  @beforeCreate()
  static assignUuid(subscription: Subscription) {
    subscription.id = uuid()
  }

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare planId: string

  @column()
  declare walletId: string

  @column()
  declare investedAmount: number

  @column()
  declare status: string

  @column.dateTime()
  declare startDate: DateTime

  @column.dateTime()
  declare endDate: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Plan)
  declare plan: BelongsTo<typeof Plan>

  @belongsTo(() => Wallet)
  declare wallet: BelongsTo<typeof Wallet>
}
