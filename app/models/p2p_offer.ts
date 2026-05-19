import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { v4 as uuidv4 } from 'uuid'
import User from '#models/user'
import P2pTrade from '#models/p2p_trade'

export default class P2pOffer extends BaseModel {
  static table = 'p2p_offers'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare sellerId: string

  @column()
  declare amount: number

  @column()
  declare pricePerUnit: number

  @column()
  declare fiatCurrency: string

  @column({
    prepare: (value: string[]) => JSON.stringify(value),
    consume: (value: string | string[]) => typeof value === 'string' ? JSON.parse(value) : value,
  })
  declare paymentMethods: string[]

  @column()
  declare status: 'open' | 'locked' | 'completed' | 'cancelled'

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User, { foreignKey: 'sellerId' })
  declare seller: BelongsTo<typeof User>

  @hasMany(() => P2pTrade, { foreignKey: 'offerId' })
  declare trades: HasMany<typeof P2pTrade>

  @beforeCreate()
  static assignUuid(offer: P2pOffer) {
    offer.id = uuidv4()
  }
}
