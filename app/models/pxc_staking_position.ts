import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { v4 as uuidv4 } from 'uuid'
import User from '#models/user'

export default class PxcStakingPosition extends BaseModel {
  static table = 'pxc_staking_positions'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  /** Montant de tokens PXC stakés */
  @column()
  declare amount: number

  /** Récompenses accumulées en PXC (5%/jour sur le principal) */
  @column()
  declare rewardsEarned: number

  /** Taux journalier en % (5 = 5% par jour) */
  @column()
  declare dailyRatePercent: number

  @column()
  declare status: 'active' | 'completed' | 'cancelled'

  /** Dernier moment où les rewards ont été calculés */
  @column.dateTime()
  declare lastRewardAt: DateTime | null

  @column.dateTime()
  declare startedAt: DateTime

  /** Null = staking ouvert, rempli quand l'utilisateur unstake */
  @column.dateTime()
  declare endedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @beforeCreate()
  static assignUuid(pos: PxcStakingPosition) {
    pos.id = uuidv4()
  }

  /**
   * Calcule les récompenses dues depuis le dernier paiement.
   * 5% par jour = 5 / 100 du principal par jour complet écoulé.
   */
  get pendingRewards(): number {
    const since = this.lastRewardAt ?? this.startedAt
    const now = DateTime.now().setZone('UTC')
    const daysSince = now.diff(since, 'days').days
    const fullDays = Math.floor(daysSince)
    if (fullDays <= 0) return 0
    const daily = (Number(this.amount) * Number(this.dailyRatePercent)) / 100
    return Math.round(daily * fullDays * 1_000_000) / 1_000_000
  }
}
