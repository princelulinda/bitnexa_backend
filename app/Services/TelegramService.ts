import { createHmac, createHash } from 'node:crypto'
import env from '#start/env'

export default class TelegramService {
  /**
   * Verify the data coming from Telegram Login Widget or Web App
   * @param data The data object from Telegram
   * @returns boolean
   */
  public verifyData(data: Record<string, any>): boolean {
    const { hash, ...dataToCheck } = data
    if (!hash) return false

    const token = env.get('TELEGRAM_BOT_TOKEN')

    // Sort keys alphabetically
    const keys = Object.keys(dataToCheck).sort()
    const dataString = keys
      .map((key) => `${key}=${dataToCheck[key]}`)
      .join('\n')

    // For Login Widget: secret_key = SHA256(token)
    const secretKey = createHash('sha256').update(token).digest()
    const checkHash = createHmac('sha256', secretKey)
      .update(dataString)
      .digest('hex')

    return checkHash === hash
  }

  /**
   * Verify data from Telegram Mini App (Web App)
   */
  public verifyWebAppData(initData: string): boolean {
    const params = new URLSearchParams(initData)
    const hash = params.get('hash')
    if (!hash) return false

    const dataToCheck: string[] = []
    params.sort()
    params.forEach((value, key) => {
      if (key !== 'hash') {
        dataToCheck.push(`${key}=${value}`)
      }
    })

    const dataString = dataToCheck.join('\n')
    const token = env.get('TELEGRAM_BOT_TOKEN')

    const secretKey = createHmac('sha256', 'WebAppData')
      .update(token)
      .digest()

    const checkHash = createHmac('sha256', secretKey)
      .update(dataString)
      .digest('hex')

    return checkHash === hash
  }
}
