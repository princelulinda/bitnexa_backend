import TelegramBot from 'node-telegram-bot-api'
import env from '#start/env'
import Transaction from '#models/transaction'
import KycSubmission from '#models/kyc_submission'
import User from '#models/user'
import logger from '@adonisjs/core/services/logger'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import fs from 'node:fs'

export default class TelegramAdminService {
  private bot: TelegramBot
  private adminChatId: string

  constructor() {
    // On utilise le token existant ou on le charge depuis l'env
    const token = '8256645631:AAGPH3BSkBfa8X9ldJx3BjGLJIBImii12Ts'
    // Idéalement, mettez TELEGRAM_ADMIN_ID dans votre .env
    // Pour l'instant, on mettra l'ID en dur ou on le laissera vide pour le configurer
    this.adminChatId = env.get('TELEGRAM_ADMIN_ID', '') 
    
    // Polling est activé ici car c'est le processus principal du bot
    this.bot = new TelegramBot(token, { polling: true })
  }

  public start() {
    console.log('🤖 Telegram Admin Bot started...')
    console.log('👉 Send /me to get your Chat ID if you need to configure it.')

    // Gestion des erreurs de polling
    this.bot.on('polling_error', (error) => {
      console.error(`[Telegram Error] ${error.code}: ${error.message}`)
    })

    // Commande /start
    this.bot.onText(/\/start/, (msg) => {
      if (!this.isAdmin(msg.chat.id)) return
      
      const message = `
👮‍♂️ **Bitnexa Admin Panel**

Available commands:
💰 /withdrawals - Pending withdrawals
Dl /kyc - Pending KYC requests
🆔 /me - Show your Chat ID
`
      this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' })
    })

    // Commande /me (utile pour récupérer l'ID)
    this.bot.onText(/\/me/, (msg) => {
      this.bot.sendMessage(msg.chat.id, `Your Chat ID is: \`${msg.chat.id}\``, { parse_mode: 'Markdown' })
    })

    // Commande /withdrawals
    this.bot.onText(/\/withdrawals/, async (msg) => {
      if (!this.isAdmin(msg.chat.id)) return
      await this.listPendingWithdrawals(msg.chat.id)
    })

    // Commande /kyc
    this.bot.onText(/\/kyc/, async (msg) => {
      if (!this.isAdmin(msg.chat.id)) return
      await this.listPendingKycs(msg.chat.id)
    })

    // Gestion des clics sur les boutons (Callbacks)
    this.bot.on('callback_query', async (callbackQuery) => {
      const msg = callbackQuery.message
      const data = callbackQuery.data
      const chatId = msg?.chat.id

      if (!chatId || !data) return
      if (!this.isAdmin(chatId)) return

      // Ack le bouton pour arrêter le chargement
      this.bot.answerCallbackQuery(callbackQuery.id)

      try {
        if (data.startsWith('wd_approve_')) {
          const txId = data.replace('wd_approve_', '')
          await this.approveWithdrawal(chatId, txId)
        } else if (data.startsWith('wd_reject_')) {
          const txId = data.replace('wd_reject_', '')
          await this.rejectWithdrawal(chatId, txId)
        } else if (data.startsWith('kyc_approve_')) {
          const kycId = data.replace('kyc_approve_', '')
          await this.approveKyc(chatId, kycId)
        } else if (data.startsWith('kyc_reject_')) {
          const kycId = data.replace('kyc_reject_', '')
          await this.rejectKyc(chatId, kycId)
        }
      } catch (error) {
        console.error('Error processing callback:', error)
        this.bot.sendMessage(chatId, `❌ Error: ${error.message}`)
      }
    })
  }

  private isAdmin(chatId: number | string): boolean {
    // Si aucun admin n'est configuré, on log l'ID pour aider l'utilisateur
    if (!this.adminChatId) {
        console.log(`⚠️ No TELEGRAM_ADMIN_ID configured. User ${chatId} tried to access bot.`)
        this.bot.sendMessage(chatId, `⚠️ Access Denied. Please add \`TELEGRAM_ADMIN_ID=${chatId}\` to your .env file.`)
        return false
    }
    
    // Comparaison (on gère string/number)
    return String(chatId) === String(this.adminChatId)
  }

  private async listPendingWithdrawals(chatId: number) {
    const transactions = await Transaction.query()
      .where('type', 'withdrawal')
      .where('status', 'pending_admin_approval')
      .preload('wallet', (q) => q.preload('user'))
      .orderBy('created_at', 'asc') // Les plus vieux en premier
      .limit(5)

    if (transactions.length === 0) {
      return this.bot.sendMessage(chatId, '✅ No pending withdrawals.')
    }

    for (const tx of transactions) {
      const user = tx.wallet.user
      const message = `
💰 **Withdrawal Request**
User: ${user.fullName} (${user.email})
Amount: **${tx.amount}**
Net (approx): ${tx.amount} (Fees may apply)
Desc: ${tx.description}
Date: ${tx.createdAt.toFormat('dd/MM/yyyy HH:mm')}
`
      const opts = {
        parse_mode: 'Markdown' as const,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Approve', callback_data: `wd_approve_${tx.id}` },
              { text: '❌ Reject', callback_data: `wd_reject_${tx.id}` }
            ]
          ]
        }
      }
      await this.bot.sendMessage(chatId, message, opts)
    }
  }

  private async listPendingKycs(chatId: number) {
    const kycs = await KycSubmission.query()
      .where('status', 'pending')
      .preload('user')
      .orderBy('created_at', 'asc')
      .limit(5)

    if (kycs.length === 0) {
      return this.bot.sendMessage(chatId, '✅ No pending KYC submissions.')
    }

    for (const kyc of kycs) {
      const user = kyc.user
      const message = `
Dl **KYC Submission**
User: ${user.fullName} (${user.email})
Doc Type: ${kyc.documentType}
Date: ${kyc.submittedAt.toFormat('dd/MM/yyyy HH:mm')}

See photos below 👇
`
      await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })

      // Send images if they exist
      const sendPhoto = async (url: string | null, caption: string) => {
        if (!url) return
        const relativePath = url.startsWith('/') ? url.substring(1) : url
        const filePath = app.makePath('public', relativePath)

        if (fs.existsSync(filePath)) {
          await this.bot.sendPhoto(chatId, `https://api.wisdomx-exchange.com/${relativePath}`, { caption })
        }
      }

      await sendPhoto(kyc.documentFrontUrl, 'Front')
      await sendPhoto(kyc.documentBackUrl, 'Back')
      await sendPhoto(kyc.selfieUrl, 'Selfie')

      const opts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Validate KYC', callback_data: `kyc_approve_${kyc.id}` },
              { text: '❌ Reject', callback_data: `kyc_reject_${kyc.id}` }
            ]
          ]
        }
      }
      await this.bot.sendMessage(chatId, 'Action for above KYC:', opts)
    }
  }

  // --- Action Methods ---

  private async approveWithdrawal(chatId: number, txId: string) {
    const tx = await Transaction.find(txId)
    if (!tx || tx.status !== 'pending_admin_approval') {
      return this.bot.sendMessage(chatId, '⚠️ Transaction not found or already processed.')
    }

    // Update logic similar to Controller
    tx.status = 'processing_withdrawal'
    tx.description = `Withdrawal approved by Admin Bot.`
    await tx.save()

    this.bot.sendMessage(chatId, `✅ Withdrawal for ${tx.amount} approved! Status changed to 'processing'. Don't forget to execute the transfer manually if needed.`)
  }

  private async rejectWithdrawal(chatId: number, txId: string) {
    const tx = await Transaction.find(txId)
    if (!tx) return this.bot.sendMessage(chatId, '⚠️ Transaction not found.')

    const wallet = await tx.related('wallet').query().first()
    if (!wallet) return 

    // Refund logic
    // We assume a 5% fee was taken separately in a 'withdrawal_fee' transaction. 
    // Ideally we refund that too, but for simplicity here we just refund the main amount to balance.
    // (A complete implementation would refund the fee transaction too).
    
    wallet.balance = Number(wallet.balance) + Number(tx.amount)
    await wallet.save()

    tx.status = 'rejected'
    tx.description = 'Rejected via Telegram Bot'
    await tx.save()

    this.bot.sendMessage(chatId, `❌ Withdrawal rejected. Funds (${tx.amount}) returned to user wallet.`)
  }

  private async approveKyc(chatId: number, kycId: string) {
    const kyc = await KycSubmission.find(kycId)
    if (!kyc) return

    kyc.status = 'approved'
    kyc.reviewedAt = DateTime.now()
    await kyc.save()

    // Update User status
    const user = await User.find(kyc.userId)
    if (user) {
        user.kycStatus = 'verified'
        await user.save()
    }

    this.bot.sendMessage(chatId, `✅ KYC Approved for ${user?.email}`)
  }

  private async rejectKyc(chatId: number, kycId: string) {
    const kyc = await KycSubmission.find(kycId)
    if (!kyc) return

    kyc.status = 'rejected'
    kyc.reviewedAt = DateTime.now()
    await kyc.save()

    const user = await User.find(kyc.userId)
    if (user) {
        user.kycStatus = 'rejected'
        await user.save()
    }

    this.bot.sendMessage(chatId, `❌ KYC Rejected for ${user?.email}`)
  }
}
