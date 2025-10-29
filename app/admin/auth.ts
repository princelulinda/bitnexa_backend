import { DefaultAuthProvider, DefaultAuthenticatePayload } from 'adminjs'
import User from '#models/user' // Import the User model
import hash from '@adonisjs/core/services/hash' // Import the hash service

import componentLoader from './component_loader.js'

/**
 * Your "authenticate" function. Depending on the auth provider used, the payload may be different.
 *
 * The default authentication provider uses email and password to authenticate. You can modify this
 * function to use email & password to verify if the User exists and if their passwords match.
 *
 * The default implementation below will let any in, so make sure to update it.
 */
const authenticate = async ({ email, password }: DefaultAuthenticatePayload) => {
  const user = await User.findBy('email', email)

  if (user && (await hash.verify(user.password, password))) {
    // Authentication successful
    // You might want to return a simplified user object or just the ID
    return {
      id: String(user.id),
      email: user.email,
      fullName: user.fullName,
      // Add any other properties AdminJS needs for the authenticated user
    }
  }

  // Authentication failed
  return null
}

const authProvider = new DefaultAuthProvider({
  componentLoader,
  authenticate,
})

export default authProvider
