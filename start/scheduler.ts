

 import cron from 'node-cron'
import { DateTime } from 'luxon'
import Signal from '#models/signal'
import Plan from '#models/plan'
import { cuid } from '@adonisjs/core/helpers'
import logger from '@adonisjs/core/services/logger'

/**
 * Génère un signal unique pour tous les plans actuellement actifs.
 */
async function generateSignalForAllActivePlans() {
  logger.info('Scheduler: Exécution de la génération de signaux...')

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
      await Signal.create({
        planId: plan.id,
        status: 'active',
        description: `Signal quotidien généré par le planificateur.`,
        code: code, // Utilise le même code pour tous les plans à ce moment précis
        expiresAt: expiresAt,
      })
      logger.info(`Scheduler: Signal ${code} généré pour le plan ${plan.name}.`)
    }

    logger.info('Scheduler: Génération de signaux terminée.')
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
  '15 14 * * *', // 15:50
  '0 17 * * *',  // 17:00
  '0 18 * * *',  // 18:00
];


  // Décommentez la boucle ci-dessous une fois 'node-cron' installé
  scheduleTimes.forEach((time) => {
   cron.schedule(time, generateSignalForAllActivePlans, {
    timezone: 'UTC', // Assurez-vous de configurer le bon fuseau horaire
  })
   logger.info(`Scheduler: Tâche de génération de signal planifiée pour ${time} (UTC).`)
 })

}
