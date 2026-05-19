import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { v4 as uuidv4 } from 'uuid'
import User from '#models/user'
import P2pOffer from '#models/p2p_offer'

export default class P2pTrade extends BaseModel {
  static table = 'p2p_trades'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare offerId: string

  @column()
  declare buyerId: string

  @column()
  declare sellerId: string

  @column()
  declare amount: number

  @column()
  declare pricePerUnit: number

  @column()
  declare fiatCurrency: string

  @column()
  declare totalFiat: number

  @column()
  declare status:
    | 'pending_payment'
    | 'payment_sent'
    | 'completed'
    | 'cancelled'
    | 'timed_out'
    | 'disputed'
    | 'resolved_buyer'
    | 'resolved_seller'

  @column({
    prepare: (value: string[]) => JSON.stringify(value),
    consume: (value: string | string[]) => typeof value === 'string' ? JSON.parse(value) : value,
  })
  declare paymentProofs: string[]

  @column.dateTime()
  declare paidAt: DateTime | null

  @column()
  declare disputedBy: string | null

  @column()
  declare disputeReason: string | null

  @column()
  declare resolvedBy: string | null

  @column()
  declare resolutionDirection: 'buyer' | 'seller' | null

  @column()
  declare resolutionNotes: string | null

  @column.dateTime()
  declare resolvedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => P2pOffer, { foreignKey: 'offerId' })
  declare offer: BelongsTo<typeof P2pOffer>

  @belongsTo(() => User, { foreignKey: 'buyerId' })
  declare buyer: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'sellerId' })
  declare seller: BelongsTo<typeof User>

  @beforeCreate()
  static assignUuid(trade: P2pTrade) {
    trade.id = uuidv4()
  }
}
