

 import cron from 'node-cron'
import { DateTime } from 'luxon'
import Signal from '#models/signal'
import Plan from '#models/plan'
import { cuid } from '@adonisjs/core/helpers'
import logger from '@adonisjs/core/services/logger'

import User from '#models/user'
import mail from '@adonisjs/mail/services/main'
import TelegramBot   from "node-telegram-bot-api"
import PxcStakingPosition from '#models/pxc_staking_position'
import Transaction from '#models/transaction'
import db from '@adonisjs/lucid/services/db'
const token = '8994244880:AAF2YQ32ReFidoSBYOwOHSF64ArQ_0ExG3Y';
const bot = new TelegramBot(token, { polling: false });
const chatId = "-1004310950806"

async function generateSignalForAllActivePlans(minReferralLevel: number = 1, isExclusive: boolean = false) {
  logger.info(`Scheduler: Exécution de la génération de signaux (Min Level: ${minReferralLevel}, Exclusif: ${isExclusive})...`)
  try {
    const activePlans = await Plan.query().where('isActive', true)

    if (activePlans.length === 0) {
      logger.info('Scheduler: Aucun plan actif trouvé. Aucun signal généré.')
      return
    }

    // Un code de signal unique pour cette exécution
    const code = cuid().substring(0, 6).toUpperCase()
    const expiresAt = DateTime.now().plus({ minutes: 30 })

    for (const plan of activePlans) {
    const message = isExclusive
      ? `🌟 EXCLUSIVE VIP SIGNAL | LIMITED ACCESS 🔒

This is a premium signal reserved for our newest investors only (subscribers of less than 4 days).
It is the result of an in-depth market analysis shared with a restricted circle of members.

🎁 As a new investor, this is YOUR opportunity to maximize your entry into the market.

📊 To claim this exclusive opportunity, use:
• the code ${code}${minReferralLevel > 1 ? `\n\n🌟 LEVEL ${minReferralLevel}+ SIGNAL: Available only for high-tier members!` : ''}

⏰ Limited time offer — this signal expires soon. Don't miss it.

👉 Exclusivity is a privilege. Act with discipline and precision.`
      : `💎 OFFICIAL TRADING SIGNAL | SCHEDULED RELEASE ⏰

This signal has been released at the exact time defined by our professional trading strategy.
Every setup is the result of in-depth market analysis, combining technical precision, risk control, and strategic discipline.

Our goal is simple: deliver high-quality opportunities with consistency and transparency, even in volatile market conditions.

📊 To maximize performance, please strictly follow:
• the code ${code}${minReferralLevel > 1 ? `\n\n🌟 LEVEL ${minReferralLevel}+ SIGNAL: Available only for high-tier members!` : ''}

⚠️ Discipline and execution are key. Trust the process, respect the strategy, and let consistency build your success.

👉 Success is not accidental — it is the result of discipline, timing, and strategy.`;


try {
  await bot.sendMessage(chatId, `${message}`)
  await new Promise((resolve) => setTimeout(resolve, 10))
  await bot.sendMessage(chatId, `${code}`)
} catch (telegramError) {
  logger.error(telegramError, `Scheduler: Échec de l'envoi du signal ${code} sur Telegram.`)
}


      await Signal.create({
        planId: plan.id,
        status: 'active',
        description: `Signal quotidien niveau ${minReferralLevel}+`,
        code: code,
        expiresAt: expiresAt,
        minReferralLevel: minReferralLevel,
        isExclusive: isExclusive,
      })
      logger.info(`Scheduler: Signal ${code} généré pour le plan ${plan.name} (Min Level: ${minReferralLevel}).`)
    }

    // After signals are generated, send an email to all users
    const users = await User.all()
    console.log(`Sending new signal email to ${users.length} users.`)
    logger.info('Scheduler: Génération de signaux et envoi d\'e-mails terminés.')
  } catch (error) {
    logger.error(error, 'Scheduler: Une erreur est survenue lors de la génération des signaux.')
  }
}

/**
 * Planifie la génération des signaux à des heures spécifiques.
 */
export function startScheduler() {
  logger.info('Scheduler: Le planificateur de tâches est démarré.')

  // Les heures de génération des signaux et leur niveau requis
  const scheduleConfig = [
    { time: '0 11 * * *', level: 0, isExclusive: false },
    { time: '0 12 * * *', level: 0, isExclusive: false },
    { time: '0 15 * * *', level: 0, isExclusive: false },
    { time: '0 16 * * *', level: 0, isExclusive: true }
  ];


  scheduleConfig.forEach((config) => {
   cron.schedule(config.time, () => generateSignalForAllActivePlans(config.level, config.isExclusive ?? false), {
    timezone: 'UTC',
  })
   logger.info(`Scheduler: Tâche de génération de signal planifiée pour ${config.time} (UTC) [Level ${config.level}+${config.isExclusive ? ', Exclusif' : ''}].`)
 })

  // ─── PXC Staking: Distribution des récompenses quotidiennes (5%/jour) ──────
  cron.schedule('0 0 * * *', () => distributePxcStakingRewards(), {
    timezone: 'UTC',
  })
  logger.info('Scheduler: Distribution PXC staking planifiée pour 00:00 UTC chaque jour.')
}

/**
 * Distribue les récompenses de staking PXC pour toutes les positions actives.
 * Calcule les jours complets depuis le dernier paiement et crédite
 * les rewards dans airdropBalance de chaque utilisateur.
 */
async function distributePxcStakingRewards() {
  logger.info('[PXC Staking] Début de la distribution des récompenses...')
  const now = DateTime.now().setZone('UTC')

  try {
    const activePositions = await PxcStakingPosition.query().where('status', 'active')

    let totalDistributed = 0
    let positionsRewarded = 0

    for (const position of activePositions) {
      const since = position.lastRewardAt ?? position.startedAt
      const daysSince = now.diff(since, 'days').days
      const fullDays = Math.floor(daysSince)

      if (fullDays <= 0) continue

      const dailyReward = (Number(position.amount) * Number(position.dailyRatePercent)) / 100
      const reward = Math.round(dailyReward * fullDays * 1_000_000) / 1_000_000

      if (reward <= 0) continue

      try {
        await db.transaction(async (trx) => {
          // 1. Créditer airdropBalance du user
          await trx
            .from('wallets')
            .where('user_id', position.userId)
            .increment('airdrop_balance', reward)

          // 2. Mettre à jour la position
          position.useTransaction(trx)
          position.rewardsEarned = Number(position.rewardsEarned) + reward
          position.lastRewardAt = now
          await position.save()

          // 3. Transaction de récompense
          const wallet = await trx.from('wallets').where('user_id', position.userId).first()
          if (wallet) {
            await Transaction.create(
              {
                walletId: wallet.id,
                amount: reward,
                type: 'pxc_staking_reward',
                description: `Récompense staking PXC auto: ${reward.toFixed(6)} PXC (${fullDays} jour(s) × ${position.dailyRatePercent}%)`,
                status: 'completed',
              },
              { client: trx }
            )
          }
        })

        totalDistributed += reward
        positionsRewarded++
      } catch (err) {
        logger.error(err, `[PXC Staking] Erreur pour la position ${position.id}`)
      }
    }

    logger.info(`[PXC Staking] Distribution terminée: ${totalDistributed.toFixed(6)} PXC distribués à ${positionsRewarded} positions.`)
  } catch (error) {
    logger.error(error, '[PXC Staking] Erreur critique lors de la distribution.')
  }
}
