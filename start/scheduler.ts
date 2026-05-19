

 import cron from 'node-cron'
import { DateTime } from 'luxon'
import Signal from '#models/signal'
import Plan from '#models/plan'
import { cuid } from '@adonisjs/core/helpers'
import logger from '@adonisjs/core/services/logger'

import User from '#models/user'
import mail from '@adonisjs/mail/services/main'
import TelegramBot   from "node-telegram-bot-api"
const token = '8484922145:AAHKKsv21mMzdkcT4N2sGYZSHrIVI7-FzoA';
const bot = new TelegramBot(token, { polling: false });
const chatId = "-1003616087750"

async function generateSignalForAllActivePlans(minReferralLevel: number = 1) {
  logger.info(`Scheduler: Exécution de la génération de signaux (Min Level: ${minReferralLevel})...`)
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
    const message = `💎 OFFICIAL TRADING SIGNAL | SCHEDULED RELEASE ⏰

This signal has been released at the exact time defined by our professional trading strategy.
Every setup is the result of in-depth market analysis, combining technical precision, risk control, and strategic discipline.

Our goal is simple: deliver high-quality opportunities with consistency and transparency, even in volatile market conditions.

📊 To maximize performance, please strictly follow:
• the code ${code}${minReferralLevel > 1 ? `\n\n🌟 LEVEL ${minReferralLevel}+ SIGNAL: Available only for high-tier members!` : ''}

⚠️ Discipline and execution are key. Trust the process, respect the strategy, and let consistency build your success.

👉 Success is not accidental — it is the result of discipline, timing, and strategy.`;


bot.sendMessage(chatId, `${message}`);
bot.sendMessage(chatId, `${code}`);


      await Signal.create({
        planId: plan.id,
        status: 'active',
        description: `Signal quotidien niveau ${minReferralLevel}+`,
        code: code, 
        expiresAt: expiresAt,
        minReferralLevel: minReferralLevel,
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
    { time: '0 11 * * *', level: 1 },
    { time: '0 12 * * *', level: 1 },
    { time: '0 14 * * *', level: 2 },
    { time: '0 15 * * *', level: 3 }
  ];


  scheduleConfig.forEach((config) => {
   cron.schedule(config.time, () => generateSignalForAllActivePlans(config.level), {
    timezone: 'UTC',
  })
   logger.info(`Scheduler: Tâche de génération de signal planifiée pour ${config.time} (UTC) [Level ${config.level}+].`)
 })

}
