import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Signal from '#models/signal'
import { v4 as uuid } from 'uuid'

export default class UserSignal extends BaseModel {
  @beforeCreate()
  static assignUuid(userSignal: UserSignal) {
    userSignal.id = uuid()
  }

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare signalId: string

  @column.dateTime()
  declare usedAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Signal)
  declare signal: BelongsTo<typeof Signal>
}
