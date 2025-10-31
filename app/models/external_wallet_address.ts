import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user' // Import User model
import { v4 as uuid } from 'uuid'

export default class ExternalWalletAddress extends BaseModel {
  @beforeCreate()
  static assignUuid(externalWalletAddress: ExternalWalletAddress) {
    externalWalletAddress.id = uuid()
  }

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare address: string

  @column()
  declare currency: string

  @column()
  declare network: string

  @column()
  declare name: string | null // Optional name for the address

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
