import { BaseCommand } from '@adonisjs/core/ace'
import { CommandOptions } from '@adonisjs/core/types/ace'

export default class TelegramBotCommand extends BaseCommand {
  static commandName = 'telegram:run'
  static description = 'Start the Telegram Admin Bot (Long running process)'

  static options: CommandOptions = {
    startApp: true // Important: Charge toute l'application (Base de données, etc.)
  }

  async run() {
    this.logger.info('Starting Telegram Bot Service...')

    // Import dynamique du service pour s'assurer que l'app est bootée
    const TelegramAdminService = (await import('#services/TelegramAdminService')).default
    const service = new TelegramAdminService()
    
    service.start()
    
    this.logger.success('Bot is running. Press Ctrl+C to stop.')
    
    // On maintient le process en vie
    // (Node.js ne quittera pas tant que le polling Telegram est actif)
    await new Promise(() => {}) 
  }
}
