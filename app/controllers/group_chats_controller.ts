import type { HttpContext } from '@adonisjs/core/http'
import Message from '#models/message'
import { createMessageValidator } from '#validators/message'
import SocketIoService from '#services/SocketIoService'

export default class GroupChatsController {
  /**
   * Display a list of all messages.
   */
  async index({ response }: HttpContext) {
    const messages = await Message.query()
      .preload('user')
      .preload('parent')
      .orderBy('createdAt', 'asc')
    console.log('KKKKKKKKKKKKKKKK')
    return response.ok(messages)
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request, response, auth }: HttpContext) {
    const user = auth.user!
    const payload = await request.validateUsing(createMessageValidator)

    const message = await Message.create({
      userId: user.id,
      content: payload.content,
      parentId: payload.parentId,
    })

    await message.load('user')
    if (message.parentId) {
      await message.load('parent')
    }

    // ✅ Utiliser le service SocketIoService correctement
    try {
      SocketIoService.io?.emit('send-io-message', message)
    } catch (error) {
      console.warn('Socket.IO not initialized yet:', error)
    }

    return response.created(message)
  }
}
