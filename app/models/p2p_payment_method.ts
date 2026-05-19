import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { v4 as uuidv4 } from 'uuid'
import User from '#models/user'

export default class P2pPaymentMethod extends BaseModel {
  static table = 'p2p_payment_methods'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare type: string

  @column()
  declare label: string

  @column({
    prepare: (value: Record<string, string>) => JSON.stringify(value),
    consume: (value: string | Record<string, string>) => typeof value === 'string' ? JSON.parse(value) : value,
  })
  declare details: Record<string, string>

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @beforeCreate()
  static assignUuid(m: P2pPaymentMethod) {
    m.id = uuidv4()
  }
}
