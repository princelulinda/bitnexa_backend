import { args, BaseCommand } from '@adonisjs/core/ace'
import User from '#models/user'

export default class Disable2fa extends BaseCommand {
  static commandName = 'users:disable-2fa'
  static description = 'Disables Two-Factor Authentication for a specific user'

  @args.string({ description: 'The email of the user to disable 2FA for' })
  declare email: string

  static options = {
    startApp: true
  }

  async run() {
    const user = await User.query().where('email', this.email).first()

    if (!user) {
      this.logger.error(`User with email "${this.email}" not found.`)
      return
    }

    if (!user.isTwoFactorEnabled) {
      this.logger.warning(`2FA is already disabled for user ${user.email}.`)
      return
    }

    try {
      user.isTwoFactorEnabled = false
      user.twoFactorSecret = null
      await user.save()

      this.logger.success(`Two-Factor Authentication has been disabled for ${user.email}.`)
    } catch (error) {
      this.logger.error(`Failed to disable 2FA for ${user.email}: ${error.message}`)
    }
  }
}
