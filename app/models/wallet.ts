import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Transaction from '#models/transaction'
import { v4 as uuidv4 } from 'uuid' // Import uuidv4

export default class Wallet extends BaseModel {
  @column({ isPrimary: true })
  declare id: string // Changed to string

  @column()
  declare userId: string // Changed to string

  @column()
  declare balance: number

  @column({ columnName: 'investment_balance' })
  declare investmentBalance: number

  @column({ columnName: 'gains_balance' })
  declare gainsBalance: number

  @column()
  declare currency: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @hasMany(() => Transaction)
  declare transactions: HasMany<typeof Transaction>

  @beforeCreate()
  public static assignUuid(wallet: Wallet) {
    wallet.id = uuidv4()
  }
}
