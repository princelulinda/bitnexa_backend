import User from '#models/user'
import Wallet from '#models/wallet'
import Transaction from '#models/transaction'
import ReferralLevel from '#models/referral_level'
import { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { cuid } from '@adonisjs/core/helpers'
import { registerValidator, loginValidator, updateUserValidator } from '#validators/auth'

import mail from '@adonisjs/mail/services/main'
import BonusService from '#services/BonusService'
import { DepositService } from '#services/DepositService'

export default class AuthController {
  private bonusService: BonusService
  private depositService: DepositService

  constructor() {
    this.bonusService = new BonusService()
    this.depositService = new DepositService()
  }

  /**
   * Handle user registration
   */
  async register({ request, response }: HttpContext) {
    const payload = await request.validateUsing(registerValidator)

    const { fullName, email, password, referralCode } = payload

    // Check if user already exists
    const existingUser = await User.findBy('email', email)
    if (existingUser) {
      return response.conflict('User with this email already exists')
    }

    let referrer: User | null = null
    console.log(referralCode)
    if (referralCode) {
      referrer = await User.findBy('referral_code', referralCode)
      console.log(referralCode, referrer, await User.query().where('referral_code', referralCode).first())
      if (!referrer) {
        return response.badRequest('Invalid referral code')
      }
    }

    const newUserReferralCode = cuid().slice(0, 5)
    const emailVerificationCode = Math.floor(100000 + Math.random() * 900000).toString()
    const emailVerificationCodeExpiresAt = DateTime.now().plus({ minutes: 15 })

    const levelZero = await ReferralLevel.findBy('level', 0)
    if (!levelZero) {
      return response.internalServerError('Default referral level not found')
    }

    // Create user
    const user = await User.create({
      fullName,
      email,
      password,
      referralCode: newUserReferralCode,
      referrerId: referrer?.id,
      isEmailVerified: false,
      emailVerificationCode, // Use new column
      emailVerificationCodeExpiresAt, // Use new column
      referralLevelId: levelZero.id.toString(),
    })

    const wallet = await Wallet.create({
      userId: user.id,
      balance: 0,
      investmentBalance: 0,
      gainsBalance: 0,
      currency: 'USDT',
    })
    // Grant welcome bonus if applicable
    await this.bonusService.grantWelcomeBonus(user)

    // NOTE: Referral bonuses are now distributed after the first deposit via BonusService.processReferralDepositBonus

    // Send email confirmation (placeholder)
    try {
      await mail.send((message) => {
        message
          .to(user.email)
          .from('no-reply@Trsbit.com')
          .subject('Your Trsbit verification code')
          .htmlView('emails/verify_email', { user, code: emailVerificationCode })
      })
    } catch (error) {
      console.error('Failed to send verification email:', error)
      // Decide how to handle email sending failure (e.g., log, retry, inform user)
    }

    return response.created({
      message: 'User registered successfully. Please check your email for verification.',
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
      },
    })
  }

  /**
   * Handle email verification
   */
  async verifyEmail({ request, response }: HttpContext) {
    const { email, code } = request.body()

    if (!email || !code) {
      return response.badRequest('Email and verification code are required.')
    }

    const user = await User.query()
      .where('email', email)
      .where('emailVerificationCode', code)
      .where('emailVerificationCodeExpiresAt', '>', DateTime.now().toSQL())
      .first()
    const usertests = User.query()
    console.log(
      (await usertests).map((user) => {
        return { user_: { email: user.email, emailVerificationCode: user.emailVerificationCode } }
      })
    )
    if (!user) {
      return response.badRequest('Invalid, expired, or incorrect verification code for this email.')
    }

    user.isEmailVerified = true
    user.emailVerificationCode = null
    user.emailVerificationCodeExpiresAt = null
    await user.save()
    const token = await User.accessTokens.create(user)

    return response.ok({
      message: 'Email verified successfully. You can now log in.',
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
      },
      token,
    })
  }

  /**
   * Resend email verification code
   */
  async resendVerificationEmail({ request, response }: HttpContext) {
    const { email } = request.body()

    if (!email) {
      return response.badRequest('Email is required.')
    }
console.log('FROM ADDRESS:', mail.config.from)
    const normalizedEmail = email.toLowerCase().trim()
    const user = await User.query().where('email', normalizedEmail).first()
    console.log('User found:', user !== null)
    if (!user) {
      console.log('User not found for email:', normalizedEmail)
      return response.notFound('User not found.')
    }
    if (user.isEmailVerified) {
      return response.ok('Email is already verified.')
    }

    // Generate new email verification code and expiration
    const emailVerificationCode = Math.floor(100000 + Math.random() * 900000).toString()
    const emailVerificationCodeExpiresAt = DateTime.now().plus({ minutes: 15 })
    user.emailVerificationCode = emailVerificationCode
    user.emailVerificationCodeExpiresAt = emailVerificationCodeExpiresAt
    await user.save()

    try {
      await mail.send((message) => {
        message
          .to(user.email)
          .from('no-reply@Trsbit.com')
          .subject('Votre nouveau code de vérification Bitnexa')
          .htmlView('emails/verify_email', { user, code: emailVerificationCode })
      })
      return response.ok('Verification email sent successfully.')
    } catch (error) {
      console.error('Failed to send verification email:', error)
      return response.internalServerError('Failed to send verification email.')
    }
  }

  /**
   * Handle user login
   */
  async login({ request, response }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    try {
      const user = await User.verifyCredentials(email, password)
    
      if (!user.isEmailVerified) {
        return response.unauthorized({
          errors: [{ message: "Veuillez d'abord vérifier votre adresse e-mail." }],
        })
      }

      const token = await User.accessTokens.create(user)

      return response.ok({
        message: 'Connecté avec succès',
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
        },
        token: token,
      })
    } catch (error) {
      return response.notFound({
        errors: [
          {
            message:
              'Identifiants invalides. Veuillez vérifier votre e-mail et votre mot de passe.',
          },
        ],
      })
    }
  }

  /**
   * Get authenticated user details
   */
  async getAuthenticatedUser({ auth, response }: HttpContext) {
    const user = auth.user!
    await user.load('wallet')
    await user.load('referrer')
    await user.load('referrals')
    await user.load('referralLevel') // Load the referral level
    await user.load('subscriptions') // Load user subscriptions

    const activeSubscription = user.subscriptions.find((sub) => sub.status === 'active')

    // Trigger deposit check in the background. Do not await.
    this.depositService.processPendingDepositsForUser(user)

    return response.ok({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      referralCode: user.referralCode,
      isEmailVerified: user.isEmailVerified,
      isTwoFactorEnabled: user.isTwoFactorEnabled,
      kycStatus: user.kycStatus,
      createdAt: user.createdAt,
      wallet: user.wallet
        ? {
            id: user.wallet.id,
            balance: user.wallet.balance,
            investmentBalance: user.wallet.investmentBalance,
            gainsBalance: user.wallet.gainsBalance,
            bonusBalance: user.wallet.bonusBalance,
            currency: user.wallet.currency,
            airdropBalance:user.wallet.airdropBalance,
            solde:
              Number(user.wallet.balance) +
              Number(user.wallet.investmentBalance) +
              Number(user.wallet.gainsBalance) +
              Number(user.wallet.bonusBalance),
          }
        : null, // Handle case where wallet might not exist
      referrer: user.referrer
        ? {
            id: user.referrer.id,
            fullName: user.referrer.fullName,
            email: user.referrer.email,
          }
        : null,
      referralCount: user.referrals.length,
      referralLevel: user.referralLevel
        ? {
            id: user.referralLevel.id,
            level: user.referralLevel.level,
            name: user.referralLevel.name,
            minReferrals: user.referralLevel.minReferrals,
            weeklySalary: user.referralLevel.weeklySalary,
          }
        : null,
      activeSubscription: activeSubscription
        ? {
            id: activeSubscription.id,
            planId: activeSubscription.planId,
            investedAmount: activeSubscription.investedAmount,
            status: activeSubscription.status,
            startDate: activeSubscription.startDate,
            endDate: activeSubscription.endDate,
          }
        : null,
    })
  }

  /**
   * Get referral information for the authenticated user
   */
  async getReferralInfo({ auth, response }: HttpContext) {
    const user = auth.user!

    // Load referrals (users who used this user's referral code)
    await user.load('referrals')

    // Get recent referred users (e.g., last 10, or all)
    const recentReferrals = user.referrals.map((referredUser) => ({
      id: referredUser.id,
      fullName: referredUser.fullName,
      email: referredUser.email,
      createdAt: referredUser.createdAt,
    }))

    // Calculate total earnings from referral bonuses
    const wallet = await user.related('wallet').query().first()
    let totalEarnings = 0
    if (wallet) {
      const referralBonusTransactions = await Transaction.query()
        .where('walletId', wallet.id)
        .where('type', 'referral_bonus')

      totalEarnings = referralBonusTransactions.reduce(
        (sum, transaction) => sum + transaction.amount,
        0
      )
    }

    // For now, activeReferrals and pendingEarnings are placeholders
    // A more robust implementation would define what constitutes an 'active' referral
    // (e.g., made a deposit, subscribed to a plan) and how pending earnings are tracked.
    const activeReferrals = user.referrals.length // Assuming all referred users are 'active' for now
    const pendingEarnings = 0 // Placeholder

    return response.ok({
      recentReferrals,
      statistics: {
        activeReferrals,
        totalEarnings,
        pendingEarnings,
      },
    })
  }

  /**
   * Handle user logout
   */
  async logout({ auth, response }: HttpContext) {
    const user = auth.user!
    await User.accessTokens.delete(user, auth.user!.currentAccessToken.identifier)
    return response.ok({ message: 'Logged out successfully' })
  }

  /**
   * Update user profile
   */
  async updateProfile({ request, auth, response }: HttpContext) {
    const user = auth.user!
    const payload = await request.validateUsing(updateUserValidator)

    // Merge basic fields
    if (payload.fullName) {
      user.fullName = payload.fullName
    }
    if (payload.email) {
      user.email = payload.email
    }

    // Handle password update separately
    if (payload.password) {
      user.password = payload.password
    }

    await user.save()

    return response.ok(user)
  }
}
