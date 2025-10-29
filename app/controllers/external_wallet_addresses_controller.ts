import type { HttpContext } from '@adonisjs/core/http'
import ExternalWalletAddress from '#models/external_wallet_address'
import {
  createExternalWalletAddressValidator,
  updateExternalWalletAddressValidator,
} from '#validators/external_wallet_address'

export default class ExternalWalletAddressesController {
  /**
   * Display a list of all external wallet addresses for the authenticated user.
   */
  async index({ auth, response }: HttpContext) {
    const user = auth.user!
    const externalWalletAddresses = await user.related('externalWalletAddresses').query()
    return response.ok(externalWalletAddresses)
  }

  /**
   * Store a new external wallet address.
   */
  async store({ request, auth, response }: HttpContext) {
    const user = auth.user!
    const payload = await request.validateUsing(createExternalWalletAddressValidator)

    const externalWalletAddress = await user.related('externalWalletAddresses').create(payload)

    return response.created(externalWalletAddress)
  }

  /**
   * Display a single external wallet address.
   */
  async show({ params, auth, response }: HttpContext) {
    const user = auth.user!
    const externalWalletAddress = await user
      .related('externalWalletAddresses')
      .query()
      .where('id', params.id)
      .firstOrFail()
    return response.ok(externalWalletAddress)
  }

  /**
   * Update an existing external wallet address.
   */
  async update({ params, request, auth, response }: HttpContext) {
    const user = auth.user!
    const externalWalletAddress = await user
      .related('externalWalletAddresses')
      .query()
      .where('id', params.id)
      .firstOrFail()
    const payload = await request.validateUsing(updateExternalWalletAddressValidator)

    externalWalletAddress.merge(payload)
    await externalWalletAddress.save()

    return response.ok(externalWalletAddress)
  }

  /**
   * Delete an external wallet address.
   */
  async destroy({ params, auth, response }: HttpContext) {
    const user = auth.user!
    const externalWalletAddress = await user
      .related('externalWalletAddresses')
      .query()
      .where('id', params.id)
      .firstOrFail()
    await externalWalletAddress.delete()

    return response.noContent()
  }
}
