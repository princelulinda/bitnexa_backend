

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

async function generateSignalForAllActivePlans(isExclusive: boolean = false) {
  logger.info(`Scheduler: Exécution de la génération de signaux${isExclusive ? ' EXCLUSIFS' : ''}...`)
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
• the code ${code}${isExclusive ? '\n\n🌟 EXCLUSIVE SIGNAL: Available only for new investors (first 4 days)!' : ''}

⚠️ Discipline and execution are key. Trust the process, respect the strategy, and let consistency build your success.

👉 Success is not accidental — it is the result of discipline, timing, and strategy.`;


bot.sendMessage(chatId, `${message}`);
bot.sendMessage(chatId, `${code}`);


      await Signal.create({
        planId: plan.id,
        status: 'active',
        description: `Signal quotidien généré par le planificateur${isExclusive ? ' (Exclusif)' : ''}.`,
        code: code, 
        expiresAt: expiresAt,
        isExclusive: isExclusive,
      })
      logger.info(`Scheduler: Signal ${code} généré pour le plan ${plan.name} (Exclusive: ${isExclusive}).`)
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

  // Les heures de génération des signaux
  const scheduleTimes = [
  '0 10 * * *', 
  '0 11 * * *',  
  '0 14 * * *', 
  '0 15 * * *' // Ce 4ème signal sera exclusif
];


  scheduleTimes.forEach((time, index) => {
   const isExclusive = index === 3; // Le 4ème (index 3) est exclusif
   cron.schedule(time, () => generateSignalForAllActivePlans(isExclusive), {
    timezone: 'UTC',
  })
   logger.info(`Scheduler: Tâche de génération de signal planifiée pour ${time} (UTC) ${isExclusive ? '[EXCLUSIVE]' : ''}.`)
 })

}
