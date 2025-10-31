import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Wallet from '#models/wallet'
import { v4 as uuid } from 'uuid'

export default class Transaction extends BaseModel {
  @beforeCreate()
  static assignUuid(transaction: Transaction) {
    transaction.id = uuid()
  }

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare walletId: string

  @column()
  declare amount: number

  @column()
  declare type: string

  @column()
  declare description: string | null

  @column()
  declare relatedSubscriptionId: string | null // Changed from number to string

  @column()
  declare status:
    | 'pending'
    | 'pending_blockchain_confirmation'
    | 'completed'
    | 'failed'
    | 'rejected'
    | 'pending_admin_approval'
    | 'processing_withdrawal'

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => Wallet)
  declare wallet: BelongsTo<typeof Wallet>
}
