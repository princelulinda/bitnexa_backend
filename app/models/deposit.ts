import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import { v4 as uuid } from 'uuid'

export default class Deposit extends BaseModel {
  @beforeCreate()
  static assignUuid(deposit: Deposit) {
    deposit.id = uuid()
  }

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare currency: string

  @column()
  declare network: string // e.g., ERC20, TRC20, BEP20

  @column()
  declare address: string

  @column({ columnName: 'expected_amount' })
  declare expectedAmount: number

  @column()
  declare status: string

  @column.dateTime({ columnName: 'expires_at' })
  declare expiresAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
