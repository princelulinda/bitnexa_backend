import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import KycSubmission from '#models/kyc_submission'
import app from '@adonisjs/core/services/app'
import { cuid } from '@adonisjs/core/helpers'
import TelegramNotificationService from '#services/TelegramNotificationService'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'

export default class KycsController {
  
  /**
   * Submit KYC documents
   */

public async submit({ request, auth, response }: HttpContext) {
  logger.info('--- Début KYC SUBMIT ---')

  const user = auth.user!
  logger.info(`Utilisateur ID: ${user.id} - Status KYC actuel: ${user.kycStatus}`)

  if (user.kycStatus === 'verified') {
    logger.info('Soumission refusée : compte déjà vérifié')
    return response.badRequest({ message: 'Votre compte est déjà vérifié.' })
  }
  
  if (user.kycStatus === 'pending') {
    logger.info('Soumission refusée : demande déjà en cours')
    return response.badRequest({ message: 'Une demande de vérification est déjà en cours.' })
  }

  const { 
    documentType, 
    documentNumber, 
    documentFrontUrl, 
    documentBackUrl, 
    selfieUrl 
  } = request.only([
    'documentType', 
    'documentNumber', 
    'documentFrontUrl', 
    'documentBackUrl', 
    'selfieUrl'
  ])

  logger.info(`Type document reçu: ${documentType}, Numéro: ${documentNumber}`)
  logger.info(`documentFrontUrl: ${documentFrontUrl ? 'OK' : 'ABSENT'}`)
  logger.info(`documentBackUrl: ${documentBackUrl ? 'OK' : 'ABSENT'}`)
  logger.info(`selfieUrl: ${selfieUrl ? 'OK' : 'ABSENT'}`)

  if (!documentType || !documentFrontUrl || !selfieUrl) {
      logger.error('Champs obligatoires manquants.')
      return response.badRequest({ message: 'Tous les documents requis (Recto, Selfie) et le type de document sont obligatoires.' })
  }

  // Document Back obligatoire sauf passeport
  if (documentType !== 'passport' && !documentBackUrl) {
      logger.error('Document back URL manquante alors que requise.')
      return response.badRequest({ message: 'Le verso du document est requis pour ce type de document.' })
  }

  try {
    logger.info('Création DB KycSubmission...')
    const kyc = await KycSubmission.create({
      userId: user.id,
      documentType,
      documentNumber,
      documentFrontUrl,
      documentBackUrl: documentBackUrl || null,
      selfieUrl,
      status: 'pending',
      submittedAt: DateTime.now()
    })

    logger.info(`KYC créé ID = ${kyc.id}`)

    user.kycStatus = 'pending'
    await user.save()

    logger.info('Envoi notification Telegram...')
    const telegramService = new TelegramNotificationService()
    telegramService.sendNewKycNotification(user, kyc.id)

    logger.info('--- FIN KYC SUBMIT : SUCCESS ---')

    return response.created({ message: 'Documents KYC soumis avec succès. En attente de validation.' })

  } catch (error) {
    logger.error('ERREUR LORS DU SUBMIT KYC')
    logger.error(error)
    return response.internalServerError({ message: 'Erreur interne serveur.', error: error.message })
  }
}


  /**
   * Get current KYC status and submission details
   */
  public async status({ auth, response }: HttpContext) {
      const user = auth.user!
      
      const latestSubmission = await KycSubmission.query()
        .where('userId', user.id)
        .orderBy('createdAt', 'desc')
        .first()

      return response.ok({
          kycStatus: user.kycStatus,
          submission: latestSubmission
      })
  }
}
