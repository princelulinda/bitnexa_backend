import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Trader from '#models/trader'
import { v4 as uuidv4 } from 'uuid'

export default class DailyTrader extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare traderId: string

  @column.date()
  declare date: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Trader)
  declare trader: BelongsTo<typeof Trader>

  @beforeCreate()
  public static assignUuid(dailyTrader: DailyTrader) {
    dailyTrader.id = uuidv4()
  }
}
