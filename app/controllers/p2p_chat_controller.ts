import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { cuid } from '@adonisjs/core/helpers'
import app from '@adonisjs/core/services/app'
import fs from 'node:fs/promises'
import path from 'node:path'
import P2pTrade from '#models/p2p_trade'
import P2pTradeMessage from '#models/p2p_trade_message'
import SocketIoService from '#services/SocketIoService'

const ACTIVE_STATUSES = ['pending_payment', 'payment_sent', 'disputed']

const sendMessageValidator = vine.compile(
  vine.object({
    content: vine.string().trim().maxLength(2000).optional(),
    file: vine.string().trim().optional(), // base64 encoded file
    fileType: vine.enum(['image', 'document']).optional(),
  })
)

async function saveFile(base64: string, fileType: 'image' | 'document'): Promise<{ url: string; type: string }> {
  const isImage = fileType === 'image'
  const matches = isImage
    ? base64.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/)
    : base64.match(/^data:([a-zA-Z0-9+/]+\/[a-zA-Z0-9+/]+);base64,(.+)$/)

  if (!matches) throw new Error('Invalid base64 file format.')

  const ext = isImage
    ? (matches[1].toLowerCase() === 'jpeg' ? 'jpg' : matches[1].toLowerCase())
    : 'pdf'

  const buffer = Buffer.from(matches[2], 'base64')
  if (buffer.length > 10 * 1024 * 1024) throw new Error('File exceeds 10MB limit.')

  const folder = isImage ? 'p2p/images' : 'p2p/documents'
  const fileName = `${cuid()}.${ext}`
  const dirPath = app.publicPath(`uploads/${folder}`)
  await fs.mkdir(dirPath, { recursive: true })
  await fs.writeFile(path.join(dirPath, fileName), buffer)

  return { url: `uploads/${folder}/${fileName}`, type: ext }
}

export default class P2pChatController {
  // GET /p2p/trades/:tradeId/messages
  async index({ params, auth, response }: HttpContext) {
    const user = auth.user!
    const trade = await P2pTrade.find(params.tradeId)
    if (!trade) return response.notFound({ message: 'Trade not found.' })
    if (trade.buyerId !== user.id && trade.sellerId !== user.id) {
      return response.forbidden({ message: 'Access denied.' })
    }

    const messages = await P2pTradeMessage.query()
      .where('trade_id', params.tradeId)
      .preload('sender', (q) => q.select(['id', 'full_name', 'email']))
      .orderBy('created_at', 'asc')

    return response.ok(messages.map((m) => ({
      id: m.id,
      messageType: m.messageType,
      content: m.content,
      fileUrl: m.fileUrl,
      fileType: m.fileType,
      sender: {
        id: m.sender.id,
        name: m.sender.fullName,
        role: m.senderId === trade.buyerId ? 'buyer' : 'seller',
      },
      createdAt: m.createdAt,
    })))
  }

  // POST /p2p/trades/:tradeId/messages
  async store({ params, request, auth, response }: HttpContext) {
    const user = auth.user!
    const trade = await P2pTrade.find(params.tradeId)
    if (!trade) return response.notFound({ message: 'Trade not found.' })
    if (trade.buyerId !== user.id && trade.sellerId !== user.id) {
      return response.forbidden({ message: 'Access denied.' })
    }
    if (!ACTIVE_STATUSES.includes(trade.status)) {
      return response.forbidden({ message: 'Chat is only available on active trades.' })
    }

    const data = await request.validateUsing(sendMessageValidator)
    if (!data.content && !data.file) {
      return response.badRequest({ message: 'Message must have content or a file.' })
    }

    let fileUrl: string | null = null
    let fileType: 'image' | 'document' | null = null
    let messageType: 'text' | 'file' = 'text'

    if (data.file && data.fileType) {
      try {
        const saved = await saveFile(data.file, data.fileType)
        fileUrl = saved.url
        fileType = data.fileType
        messageType = 'file'
      } catch (e) {
        return response.badRequest({ message: e.message })
      }
    }

    const message = await P2pTradeMessage.create({
      tradeId: trade.id,
      senderId: user.id,
      content: data.content ?? null,
      fileUrl,
      fileType,
      messageType,
    })

    await message.load('sender')

    const payload = {
      id: message.id,
      tradeId: trade.id,
      messageType: message.messageType,
      content: message.content,
      fileUrl: message.fileUrl,
      fileType: message.fileType,
      sender: {
        id: user.id,
        name: user.fullName,
        role: user.id === trade.buyerId ? 'buyer' : 'seller',
      },
      createdAt: message.createdAt,
    }

    // Emit via socket.io to the trade room
    const io = SocketIoService.io
    if (io) {
      io.to(`p2p:trade:${trade.id}`).emit('p2p:message', payload)
    }

    return response.created(payload)
  }
}
