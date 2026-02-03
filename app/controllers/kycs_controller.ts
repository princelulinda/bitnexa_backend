import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import KycSubmission from '#models/kyc_submission'
import app from '@adonisjs/core/services/app'
import { cuid } from '@adonisjs/core/helpers'
import TelegramNotificationService from '#services/TelegramNotificationService'
import logger from '@adonisjs/core/services/logger'

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

  const { documentType, documentNumber } = request.only(['documentType', 'documentNumber'])
  logger.info(`Type document reçu: ${documentType}, Numéro: ${documentNumber}`)

  // Vérification des fichiers
  const documentFront = request.file('documentFront')
  const documentBack  = request.file('documentBack')
  const selfie        = request.file('selfie')

  logger.info(`documentFront: ${documentFront ? 'OK' : 'ABSENT'}`)
  logger.info(`documentBack: ${documentBack ? 'OK' : 'ABSENT'}`)
  logger.info(`selfie: ${selfie ? 'OK' : 'ABSENT'}`)

  if (!documentType || !documentFront || !selfie) {
      logger.error('Champs obligatoires manquants.')
      return response.badRequest({ message: 'Tous les documents requis (Recto, Selfie) et le type de document sont obligatoires.' })
  }

  // Document Back obligatoire sauf passeport
  if (documentType !== 'passport' && !documentBack) {
      logger.error('Document back manquant alors que requis.')
      return response.badRequest({ message: 'Le verso du document est requis pour ce type de document.' })
  }

  try {
    // Sauvegarde des fichiers
    const frontName = `${cuid()}.${documentFront.extname}`
    logger.info(`Saving FRONT: ${frontName}`)
    await documentFront.move(app.makePath('public/uploads/kyc'), { name: frontName })

    const selfieName = `${cuid()}.${selfie.extname}`
    logger.info(`Saving SELFIE: ${selfieName}`)
    await selfie.move(app.makePath('public/uploads/kyc'), { name: selfieName })

    let backName: string | null = null

    if (documentBack) {
      backName = `${cuid()}.${documentBack.extname}`
      logger.info(`Saving BACK: ${backName}`)
      await documentBack.move(app.makePath('public/uploads/kyc'), { name: backName })
    }

    logger.info('Création DB KycSubmission...')
    const kyc = await KycSubmission.create({
      userId: user.id,
      documentType,
      documentNumber,
      documentFrontUrl: `/uploads/kyc/${frontName}`,
      documentBackUrl: backName ? `/uploads/kyc/${backName}` : null,
      selfieUrl: `/uploads/kyc/${selfieName}`,
      status: 'pending'
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
