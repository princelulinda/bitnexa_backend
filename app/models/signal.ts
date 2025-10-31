import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Plan from '#models/plan'
import { v4 as uuid } from 'uuid'

export default class Signal extends BaseModel {
  @beforeCreate()
  static assignUuid(signal: Signal) {
    signal.id = uuid()
  }

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare planId: string

  @column()
  declare status: string

  @column()
  declare description: string | null

  @column()
  declare code: string | null

  @column.dateTime()
  declare expiresAt: DateTime | null

  @column.dateTime()
  declare processedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => Plan)
  declare plan: BelongsTo<typeof Plan>
}
