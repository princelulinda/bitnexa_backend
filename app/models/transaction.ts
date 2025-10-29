import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Wallet from '#models/wallet'

export default class Transaction extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare walletId: number

  @column()
  declare amount: number

  @column()
  declare type: string

  @column()
  declare description: string | null

  @column()
  declare relatedSubscriptionId: number | null

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
