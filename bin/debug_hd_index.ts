import 'reflect-metadata'
import { IgnitorFactory } from '@adonisjs/core/factories'
import User from '#models/user'

async function run() {
  const ignitor = new IgnitorFactory()
    .withCoreConfig()
    .withCoreProviders()
    .merge({
      rcFileContents: {
        providers: [
          () => import('@adonisjs/lucid/database_provider'),
          () => import('@adonisjs/auth/auth_provider')
        ]
      }
    })
    .create(new URL('../', import.meta.url))

  const app = ignitor.createApp('web')
  await app.init()
  await app.boot()

  const user = await User.first()
  if (user) {
    console.log('User ID:', user.id)
    console.log('User Email:', user.email)
    console.log('User HD Index:', user.hdIndex)
  } else {
    console.log('No user found.')
  }
}

run().catch(console.error)
