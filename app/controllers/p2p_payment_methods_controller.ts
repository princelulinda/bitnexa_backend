import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import P2pPaymentMethod from '#models/p2p_payment_method'

const createValidator = vine.compile(
  vine.object({
    type: vine.string().trim().maxLength(50),
    label: vine.string().trim().maxLength(100),
    details: vine.record(vine.string().trim()),
  })
)

const updateValidator = vine.compile(
  vine.object({
    label: vine.string().trim().maxLength(100).optional(),
    details: vine.record(vine.string().trim()).optional(),
    isActive: vine.boolean().optional(),
  })
)

export default class P2pPaymentMethodsController {
  // GET /p2p/payment-methods
  async index({ auth, response }: HttpContext) {
    const user = auth.user!
    const methods = await P2pPaymentMethod.query()
      .where('user_id', user.id)
      .orderBy('created_at', 'desc')
    return response.ok(methods)
  }

  // POST /p2p/payment-methods
  async store({ request, auth, response }: HttpContext) {
    const user = auth.user!
    const data = await request.validateUsing(createValidator)
    const method = await P2pPaymentMethod.create({
      userId: user.id,
      type: data.type,
      label: data.label,
      details: data.details,
      isActive: true,
    })
    return response.created(method)
  }

  // PUT /p2p/payment-methods/:id
  async update({ params, request, auth, response }: HttpContext) {
    const user = auth.user!
    const method = await P2pPaymentMethod.find(params.id)
    if (!method) return response.notFound({ message: 'Payment method not found.' })
    if (method.userId !== user.id) return response.forbidden({ message: 'Access denied.' })

    const data = await request.validateUsing(updateValidator)
    if (data.label !== undefined) method.label = data.label
    if (data.details !== undefined) method.details = data.details
    if (data.isActive !== undefined) method.isActive = data.isActive
    await method.save()

    return response.ok(method)
  }

  // DELETE /p2p/payment-methods/:id
  async destroy({ params, auth, response }: HttpContext) {
    const user = auth.user!
    const method = await P2pPaymentMethod.find(params.id)
    if (!method) return response.notFound({ message: 'Payment method not found.' })
    if (method.userId !== user.id) return response.forbidden({ message: 'Access denied.' })
    await method.delete()
    return response.ok({ message: 'Payment method deleted.' })
  }
}
