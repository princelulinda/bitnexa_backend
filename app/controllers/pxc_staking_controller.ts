import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import PxcStakingPosition from '#models/pxc_staking_position'
import Transaction from '#models/transaction'
import Wallet from '#models/wallet'

const TOKEN_SYMBOL = 'PXC'
const DAILY_RATE_PERCENT = 5 // 5% par jour
const EARLY_UNSTAKE_PENALTY_PERCENT = 10 // 10% de pénalité si unstake avant 7 jours

const stakeValidator = vine.compile(
  vine.object({
    amount: vine.number().min(1),
  })
)

export default class PxcStakingController {
  /**
   * GET /pxc-staking/positions
   * Liste les positions de staking PXC de l'utilisateur.
   */
  async positions({ auth, response }: HttpContext) {
    const user = auth.user!

    const positions = await PxcStakingPosition.query()
      .where('userId', user.id)
      .orderBy('createdAt', 'desc')

    const data = positions.map((p) => ({
      id: p.id,
      amount: p.amount,
      dailyRatePercent: p.dailyRatePercent,
      rewardsEarned: p.rewardsEarned,
      pendingRewards: p.pendingRewards,
      totalValue: Number(p.amount) + Number(p.rewardsEarned) + p.pendingRewards,
      status: p.status,
      startedAt: p.startedAt,
      endedAt: p.endedAt,
      lastRewardAt: p.lastRewardAt,
      createdAt: p.createdAt,
    }))

    return response.ok(data)
  }

  /**
   * GET /pxc-staking/summary
   * Résumé global du staking PXC de l'utilisateur.
   */
  async summary({ auth, response }: HttpContext) {
    const user = auth.user!

    const activePositions = await PxcStakingPosition.query()
      .where('userId', user.id)
      .where('status', 'active')

    const totalStaked = activePositions.reduce((sum, p) => sum + Number(p.amount), 0)
    const totalRewardsEarned = activePositions.reduce((sum, p) => sum + Number(p.rewardsEarned), 0)
    const totalPendingRewards = activePositions.reduce((sum, p) => sum + p.pendingRewards, 0)
    const dailyEarnings = totalStaked * DAILY_RATE_PERCENT / 100

    return response.ok({
      tokenSymbol: TOKEN_SYMBOL,
      dailyRatePercent: DAILY_RATE_PERCENT,
      activePositions: activePositions.length,
      totalStaked,
      totalRewardsEarned,
      totalPendingRewards,
      dailyEarnings,
      totalValue: totalStaked + totalRewardsEarned + totalPendingRewards,
    })
  }

  /**
   * POST /pxc-staking/stake
   * Stake des tokens PXC depuis airdropBalance.
   *
   * Flux :
   *  1. Vérifie que airdropBalance >= amount
   *  2. Débite airdropBalance
   *  3. Crée une position de staking active
   */
  async stake({ request, auth, response }: HttpContext) {
    const user = auth.user!
    const { amount } = await request.validateUsing(stakeValidator)

    const wallet = await Wallet.findByOrFail('userId', user.id)

    if (Number(wallet.airdropBalance) < amount) {
      return response.unprocessableEntity({
        message: `Solde insuffisant. Vous avez ${wallet.airdropBalance} ${TOKEN_SYMBOL}, vous essayez de staker ${amount} ${TOKEN_SYMBOL}.`,
      })
    }

    const now = DateTime.now().setZone('UTC')

    const position = await db.transaction(async (trx) => {
      // 1. Débiter les tokens de l'airdropBalance
      await trx
        .from('wallets')
        .where('user_id', user.id)
        .decrement('airdrop_balance', amount)

      // 2. Créer la position de staking
      const pos = await PxcStakingPosition.create(
        {
          userId: user.id,
          amount,
          dailyRatePercent: DAILY_RATE_PERCENT,
          rewardsEarned: 0,
          status: 'active',
          startedAt: now,
          lastRewardAt: null,
          endedAt: null,
        },
        { client: trx }
      )

      // 3. Enregistrer la transaction
      await Transaction.create(
        {
          walletId: wallet.id,
          amount,
          type: 'pxc_staking_deposit',
          description: `Staking PXC: ${amount} ${TOKEN_SYMBOL} stakés à ${DAILY_RATE_PERCENT}%/jour (position ${pos.id})`,
          status: 'completed',
        },
        { client: trx }
      )

      return pos
    })

    return response.created({
      message: `${amount} ${TOKEN_SYMBOL} stakés avec succès. Vous gagnerez ${DAILY_RATE_PERCENT}% par jour.`,
      position: {
        id: position.id,
        amount: position.amount,
        dailyRatePercent: position.dailyRatePercent,
        dailyEarnings: Math.round(amount * DAILY_RATE_PERCENT / 100 * 1_000_000) / 1_000_000,
        status: position.status,
        startedAt: position.startedAt,
      },
    })
  }

  /**
   * POST /pxc-staking/unstake/:id
   * Unstake : récupère le principal + récompenses dans airdropBalance.
   *
   * Pénalité de 10% sur le principal si unstake avant 7 jours.
   */
  async unstake({ auth, params, response }: HttpContext) {
    const user = auth.user!

    const position = await PxcStakingPosition.query()
      .where('id', params.id)
      .where('userId', user.id)
      .where('status', 'active')
      .first()

    if (!position) {
      return response.notFound({ message: 'Position de staking active introuvable.' })
    }

    const now = DateTime.now().setZone('UTC')
    const daysSinceStart = now.diff(position.startedAt, 'days').days

    // Calculer les rewards en attente
    const pendingRewards = position.pendingRewards
    const totalRewards = Number(position.rewardsEarned) + pendingRewards

    // Pénalité si unstake avant 7 jours
    let penalty = 0
    const isEarly = daysSinceStart < 7
    if (isEarly) {
      penalty = Math.round(Number(position.amount) * EARLY_UNSTAKE_PENALTY_PERCENT / 100 * 1_000_000) / 1_000_000
    }

    const returnAmount = Math.round((Number(position.amount) + totalRewards - penalty) * 1_000_000) / 1_000_000

    await db.transaction(async (trx) => {
      // 1. Restituer les tokens dans airdropBalance
      await trx
        .from('wallets')
        .where('user_id', user.id)
        .increment('airdrop_balance', returnAmount)

      // 2. Clôturer la position
      position.useTransaction(trx)
      position.status = isEarly ? 'cancelled' : 'completed'
      position.rewardsEarned = totalRewards
      position.endedAt = now
      position.lastRewardAt = now
      await position.save()

      // 3. Enregistrer la transaction
      const wallet = await trx.from('wallets').where('user_id', user.id).first()
      if (wallet) {
        await Transaction.create(
          {
            walletId: wallet.id,
            amount: returnAmount,
            type: 'pxc_staking_withdrawal',
            description: `Unstake PXC: ${position.amount} principal + ${totalRewards.toFixed(6)} rewards${penalty > 0 ? ` - ${penalty} pénalité (unstake anticipé)` : ''} = ${returnAmount} ${TOKEN_SYMBOL}`,
            status: 'completed',
          },
          { client: trx }
        )
      }
    })

    return response.ok({
      message: isEarly
        ? `Unstake anticipé. Pénalité de ${EARLY_UNSTAKE_PENALTY_PERCENT}%: -${penalty} ${TOKEN_SYMBOL}.`
        : `Unstake effectué avec succès.`,
      principal: Number(position.amount),
      rewards: totalRewards,
      penalty,
      totalReturned: returnAmount,
    })
  }

  /**
   * POST /pxc-staking/claim/:id
   * Réclame les récompenses accumulées sans toucher au principal.
   * Les rewards sont envoyées dans airdropBalance.
   */
  async claimRewards({ auth, params, response }: HttpContext) {
    const user = auth.user!

    const position = await PxcStakingPosition.query()
      .where('id', params.id)
      .where('userId', user.id)
      .where('status', 'active')
      .first()

    if (!position) {
      return response.notFound({ message: 'Position de staking active introuvable.' })
    }

    const pendingRewards = position.pendingRewards
    if (pendingRewards <= 0) {
      return response.badRequest({ message: 'Aucune récompense à réclamer pour le moment.' })
    }

    const now = DateTime.now().setZone('UTC')

    await db.transaction(async (trx) => {
      // 1. Créditer les rewards dans airdropBalance
      await trx
        .from('wallets')
        .where('user_id', user.id)
        .increment('airdrop_balance', pendingRewards)

      // 2. Mettre à jour la position
      position.useTransaction(trx)
      position.rewardsEarned = Number(position.rewardsEarned) + pendingRewards
      position.lastRewardAt = now
      await position.save()

      // 3. Enregistrer la transaction
      const wallet = await trx.from('wallets').where('user_id', user.id).first()
      if (wallet) {
        await Transaction.create(
          {
            walletId: wallet.id,
            amount: pendingRewards,
            type: 'pxc_staking_reward',
            description: `Récompense staking PXC: ${pendingRewards.toFixed(6)} ${TOKEN_SYMBOL} (position ${position.id})`,
            status: 'completed',
          },
          { client: trx }
        )
      }
    })

    return response.ok({
      message: `${pendingRewards.toFixed(6)} ${TOKEN_SYMBOL} de récompenses réclamés.`,
      rewardsClaimed: pendingRewards,
      totalRewardsEarned: Number(position.rewardsEarned),
    })
  }
}
