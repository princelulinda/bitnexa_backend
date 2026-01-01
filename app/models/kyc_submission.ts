import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, belongsTo, column } from '@adonisjs/lucid/orm'
import { v4 as uuid } from 'uuid'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export default class KycSubmission extends BaseModel {
  @beforeCreate()
  static assignUuid(submission: KycSubmission) {
    submission.id = uuid()
  }

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare documentType: string

  @column()
  declare documentNumber: string | null

  @column()
  declare documentFrontUrl: string

  @column()
  declare documentBackUrl: string | null

  @column()
  declare selfieUrl: string

  @column()
  declare status: 'pending' | 'approved' | 'rejected'

  @column()
  declare rejectionReason: string | null

  @column.dateTime()
  declare submittedAt: DateTime

  @column.dateTime()
  declare reviewedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
