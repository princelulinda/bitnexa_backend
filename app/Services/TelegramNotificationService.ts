import TelegramBot from 'node-telegram-bot-api'
import env from '#start/env'

export default class TelegramNotificationService {
  private bot: TelegramBot
  private adminChatId: string

  constructor() {
    // Note: polling must be false here to avoid conflicts with the main bot process
    const token = '8484922145:AAHKKsv21mMzdkcT4N2sGYZSHrIVI7-FzoA'
    this.bot = new TelegramBot(token, { polling: false })
    this.adminChatId = env.get('TELEGRAM_ADMIN_ID', '')
  }

  public async sendNewKycNotification(user: any, kycId: string) {
    if (!this.adminChatId) return

    const message = `
🔔 **New KYC Submission**
User: ${user.fullName} (${user.email})
Status: Pending

👉 Check /kyc command to validate.
`
    try {
      await this.bot.sendMessage(this.adminChatId, message, { parse_mode: 'Markdown' })
    } catch (error) {
      console.error('Failed to send Telegram notification:', error.message)
    }
  }

  public async sendNewWithdrawalNotification(user: any, amount: number, transactionId: string) {
    if (!this.adminChatId) return

    const message = `
💸 **New Withdrawal Request**
User: ${user.fullName} (${user.email})
Amount: **${amount}**

👉 Check /withdrawals command to validate.
`
    try {
      await this.bot.sendMessage(this.adminChatId, message, { parse_mode: 'Markdown' })
    } catch (error) {
      console.error('Failed to send Telegram notification:', error.message)
    }
  }
}
