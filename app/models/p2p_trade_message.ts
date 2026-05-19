import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { v4 as uuidv4 } from 'uuid'
import User from '#models/user'
import P2pTrade from '#models/p2p_trade'

export default class P2pTradeMessage extends BaseModel {
  static table = 'p2p_trade_messages'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare tradeId: string

  @column()
  declare senderId: string

  @column()
  declare content: string | null

  @column()
  declare fileUrl: string | null

  @column()
  declare fileType: 'image' | 'document' | null

  @column()
  declare messageType: 'text' | 'file' | 'system'

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => P2pTrade, { foreignKey: 'tradeId' })
  declare trade: BelongsTo<typeof P2pTrade>

  @belongsTo(() => User, { foreignKey: 'senderId' })
  declare sender: BelongsTo<typeof User>

  @beforeCreate()
  static assignUuid(m: P2pTradeMessage) {
    m.id = uuidv4()
  }
}
