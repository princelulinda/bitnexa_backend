import type { HttpContext } from '@adonisjs/core/http'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import User from '#models/user'

export default class TwoFactorsController {
  /**
   * Génère un secret 2FA et retourne le QR Code
   */
  public async generate({ auth, response }: HttpContext) {
    const user = auth.user!

    const secret = speakeasy.generateSecret({
      name: `TRSBIT (${user.email})`,
    })

    // Sauvegarde temporaire du secret (le 2FA n'est pas encore activé)
    user.twoFactorSecret = secret.base32
    await user.save()

    // Génération du QR Code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!)

    return response.json({
      secret: secret.base32,
      qrCodeUrl,
    })
  }

  /**
   * Active le 2FA après vérification du code
   */
  public async enable({ auth, request, response }: HttpContext) {
    const user = auth.user!
    const { token } = request.only(['token'])

    if (!user.twoFactorSecret) {
      return response.badRequest({ message: 'Veuillez d\'abord générer un secret 2FA.' })
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1, // Tolérance de +/- 30 secondes
    })
    console.log(user.twoFactorSecret, token)
    if (!verified) {
      return response.badRequest({ message: 'Code 2FA invalide.' })
    }

    user.isTwoFactorEnabled = true
    await user.save()

    return response.json({ message: 'Authentification à deux facteurs activée avec succès.' })
  }

  /**
   * Désactive le 2FA
   */
  public async disable({ auth, response }: HttpContext) {
    const user = auth.user!
    
    // Pour une sécurité accrue, on pourrait demander le mot de passe ou un code 2FA ici
    // Pour l'instant, on désactive simplement

    user.isTwoFactorEnabled = false
    user.twoFactorSecret = null // Optionnel : on peut supprimer le secret ou le garder pour une réactivation future sans rescanner
    await user.save()

    return response.json({ message: 'Authentification à deux facteurs désactivée.' })
  }
}
