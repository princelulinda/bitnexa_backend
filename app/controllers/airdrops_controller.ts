import type { HttpContext } from '@adonisjs/core/http'
import Wallet from '#models/wallet'
import Transaction from '#models/transaction'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'

export default class AirdropsController {
  /**
   * Permet à un utilisateur de réclamer son airdrop quotidien.
   */
  public async claim({ auth, response }: HttpContext) {
    const user = await auth.authenticate()
    const wallet = await Wallet.findByOrFail('userId', user.id)

    // --- Vérification de la dernière réclamation ---
    if (wallet.airdropLastClaimedAt) {
      const today = DateTime.now()
      const lastClaimDate = wallet.airdropLastClaimedAt

      // Vérifie si la dernière réclamation a eu lieu le même jour (dans le même fuseau horaire)
      if (today.hasSame(lastClaimDate, 'day')) {
        return response.badRequest({
          message: 'Vous avez déjà réclamé votre airdrop aujourd\'hui. Revenez demain !',
        })
      }
    }

    // Montant de l\'airdrop (à mettre dans un fichier de configuration)
    const AIRDROP_AMOUNT = 100

    const trx = await db.transaction()
    try {
      // Mettre à jour le portefeuille dans la transaction
      const walletInTrx = await Wallet.findOrFail(wallet.id, { client: trx })
      walletInTrx.airdropBalance = (Number(walletInTrx.airdropBalance) || 0) + AIRDROP_AMOUNT
      walletInTrx.airdropLastClaimedAt = DateTime.now()
      await walletInTrx.save()

      // Créer un enregistrement de transaction
      await Transaction.create(
        {
          walletId: wallet.id,
          amount: AIRDROP_AMOUNT,
          type: 'airdrop_claim',
          status: 'completed',
          description: 'Réclamation de l\'airdrop quotidien.',
        },
        { client: trx }
      )

      await trx.commit()

      return response.ok({
        message: `Félicitations ! Vous avez réclamé ${AIRDROP_AMOUNT} jetons.`, 
        newAirdropBalance: walletInTrx.airdropBalance,
      })
    } catch (error) {
      console.log(error)
      await trx.rollback()
      return response.internalServerError({
        message: 'Une erreur est survenue lors de la réclamation de l\'airdrop.',
      })
    }
  }

  /**
   * Récupère le statut de l\'airdrop pour l\'utilisateur.
   */
  public async status({ auth, response }: HttpContext) {
    const user = await auth.authenticate()
    const wallet = await Wallet.findByOrFail('userId', user.id)

    let canClaim = true
    if (wallet.airdropLastClaimedAt) {
      if (DateTime.now().hasSame(wallet.airdropLastClaimedAt, 'day')) {
        canClaim = false
      }
    }

    return response.ok({
      airdropBalance: wallet.airdropBalance,
      lastClaimedAt: wallet.airdropLastClaimedAt,
      canClaim: canClaim,
    })
  }
}
