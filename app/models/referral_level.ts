import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class ReferralLevel extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare level: number

  @column()
  declare name: string

  @column()
  declare minReferrals: number

  @column()
  declare weeklySalary: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
