import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Trader from '#models/trader'
import { v4 as uuidv4 } from 'uuid'

export default class UserCopyTrade extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare traderId: string

  @column.dateTime()
  declare usedAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Trader)
  declare trader: BelongsTo<typeof Trader>

  @beforeCreate()
  public static assignUuid(userCopyTrade: UserCopyTrade) {
    userCopyTrade.id = uuidv4()
  }
}
