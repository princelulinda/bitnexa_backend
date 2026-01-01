import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import KycSubmission from '#models/kyc_submission'
import app from '@adonisjs/core/services/app'
import { cuid } from '@adonisjs/core/helpers'

export default class KycsController {
  
  /**
   * Submit KYC documents
   */
  public async submit({ request, auth, response }: HttpContext) {
    const user = auth.user!

    if (user.kycStatus === 'verified') {
      return response.badRequest({ message: 'Votre compte est déjà vérifié.' })
    }
    
    if (user.kycStatus === 'pending') {
       return response.badRequest({ message: 'Une demande de vérification est déjà en cours.' })
    }

    const { documentType, documentNumber } = request.only(['documentType', 'documentNumber'])
    
    // Validation basique des fichiers (images seulement)
    const documentFront = request.file('documentFront', {
      size: '5mb',
      extnames: ['jpg', 'png', 'jpeg', 'pdf'],
    })
    
    const documentBack = request.file('documentBack', {
        size: '5mb',
        extnames: ['jpg', 'png', 'jpeg', 'pdf'],
    })

    const selfie = request.file('selfie', {
        size: '5mb',
        extnames: ['jpg', 'png', 'jpeg'],
    })

    if (!documentType || !documentFront || !selfie) {
        return response.badRequest({ message: 'Tous les documents requis (Recto, Selfie) et le type de document sont obligatoires.' })
    }

    // Gestion du document back (obligatoire sauf pour le passeport)
    if (documentType !== 'passport' && !documentBack) {
        return response.badRequest({ message: 'Le verso du document est requis pour ce type de document.' })
    }

    // Sauvegarde des fichiers
    const documentFrontName = `${cuid()}.${documentFront.extname}`
    await documentFront.move(app.makePath('public/uploads/kyc'), {
        name: documentFrontName
    })

    const selfieName = `${cuid()}.${selfie.extname}`
    await selfie.move(app.makePath('public/uploads/kyc'), {
        name: selfieName
    })

    let documentBackName: string | null = null
    if (documentBack) {
        documentBackName = `${cuid()}.${documentBack.extname}`
        await documentBack.move(app.makePath('public/uploads/kyc'), {
            name: documentBackName
        })
    }

    // Création de la soumission
    await KycSubmission.create({
        userId: user.id,
        documentType,
        documentNumber,
        documentFrontUrl: `/uploads/kyc/${documentFrontName}`,
        documentBackUrl: documentBackName ? `/uploads/kyc/${documentBackName}` : null,
        selfieUrl: `/uploads/kyc/${selfieName}`,
        status: 'pending'
    })

    // Mise à jour du statut utilisateur
    user.kycStatus = 'pending'
    await user.save()

    return response.created({ message: 'Documents KYC soumis avec succès. En attente de validation.' })
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
