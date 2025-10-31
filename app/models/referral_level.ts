import { BaseModel, beforeCreate, beforeSave, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import { referralLevelValidator } from '#validators/referral_level'
import { v4 as uuid } from 'uuid'

export default class ReferralLevel extends BaseModel {
  @beforeCreate()
  static assignUuid(referralLevel: ReferralLevel) {
    referralLevel.id = uuid()
  }

  @column({ isPrimary: true })
  declare id: string

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

  @beforeSave()
  static async validate(referralLevel: ReferralLevel) {
    await referralLevelValidator.validate(referralLevel)
  }
}
