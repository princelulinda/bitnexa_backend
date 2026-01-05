import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, column, hasOne, hasMany, belongsTo } from '@adonisjs/lucid/orm'
import db from '@adonisjs/lucid/services/db'
import type { HasOne, HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'
import Wallet from '#models/wallet'
import Subscription from '#models/subscription'
import ReferralLevel from '#models/referral_level' // Import ReferralLevel
import ExternalWalletAddress from '#models/external_wallet_address' // Import ExternalWalletAddress
import Deposit from '#models/deposit'
import KycSubmission from '#models/kyc_submission'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import { v4 as uuidv4 } from 'uuid' // Import uuidv4

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})
export default class User extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true })
  declare id: string // Changed to string

  @column()
  declare fullName: string | null

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare referralCode: string | null

  @column()
  declare referrerId: string | null // Changed to string to match UUID

  @column()
  declare isEmailVerified: boolean

  @column()
  declare emailVerificationCode: string | null

  @column.dateTime()
  declare emailVerificationCodeExpiresAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column()
  declare referralLevelId: number | null

  @column({ columnName: 'hd_index' })
  declare hdIndex: number

  @column()
  declare depositCounter: number

  @column({ serializeAs: null })
  declare twoFactorSecret: string | null

  @column()
  declare isTwoFactorEnabled: boolean

  @column()
  declare kycStatus: 'unverified' | 'pending' | 'verified' | 'rejected'

  // Relationships
  @hasOne(() => Wallet)
  declare wallet: HasOne<typeof Wallet>

  @hasMany(() => Subscription)
  declare subscriptions: HasMany<typeof Subscription>

  @belongsTo(() => User, {
    foreignKey: 'referrerId',
  })
  declare referrer: BelongsTo<typeof User>

  @hasMany(() => User, {
    foreignKey: 'referrerId',
  })
  declare referrals: HasMany<typeof User>

  @belongsTo(() => ReferralLevel)
  declare referralLevel: BelongsTo<typeof ReferralLevel>

  @hasMany(() => ExternalWalletAddress)
  declare externalWalletAddresses: HasMany<typeof ExternalWalletAddress>

  @hasMany(() => Deposit)
  declare deposits: HasMany<typeof Deposit>

  @hasMany(() => KycSubmission)
  declare kycSubmissions: HasMany<typeof KycSubmission>


  @beforeCreate()
  public static assignUuid(user: User) {
    user.id = uuidv4()
  }

  @beforeCreate()
  public static async assignHdIndex(user: User) {
    // We explicitly call the sequence from the application layer
    // This ensures the user object has the value immediately available in memory
    const result = await db.rawQuery("SELECT nextval('users_hd_index_seq') as index")
    user.hdIndex = Number(result.rows[0].index)
  }

  static accessTokens = DbAccessTokensProvider.forModel(User, { tokenableIdType: 'uuid' })
}
