/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'
const AuthController = () => import('#controllers/auth_controller')
const WalletsController = () => import('#controllers/wallets_controller')
const SubscriptionsController = () => import('#controllers/subscriptions_controller')
const SignalsController = () => import('#controllers/signals_controller')
const ExternalWalletAddressesController = () =>
  import('#controllers/external_wallet_addresses_controller') // Import new controller
const GroupChatsController = () => import('#controllers/group_chats_controller') // Import GroupChatsController
const AdminCommandsController = () => import('#controllers/admin_commands_controller') // Import AdminCommandsController
const AnnouncementsController = () => import('#controllers/announcements_controller')
const AirdropsController = () => import('#controllers/airdrops_controller')

// Auth Routes
router.post('/register', [AuthController, 'register'])
router.post('/verify-email', [AuthController, 'verifyEmail'])
router.post('/login', [AuthController, 'login'])
router.post('/resend-verification-email', [AuthController, 'resendVerificationEmail'])
router.post('/announcements/upload-image', [AnnouncementsController, 'uploadImage'])

// Authenticated User Routes
router
  .group(() => {
    router.get('/auth/me', [AuthController, 'getAuthenticatedUser'])
    router.get('/auth/referrals', [AuthController, 'getReferralInfo'])
    router.post('/auth/logout', [AuthController, 'logout'])
    router.put('/auth/me', [AuthController, 'updateProfile']) // Add this line

    // External Wallet Addresses Routes
    router.resource('external-wallet-addresses', ExternalWalletAddressesController).apiOnly() // Only expose API-related routes (index, store, show, update, destroy)

    // Group Chat Routes
    router.get('/group-chat/messages', [GroupChatsController, 'index'])
    router.post('/group-chat/messages', [GroupChatsController, 'store'])
  })
  .use(middleware.auth())

// Wallet Routes (requires authentication for user-facing actions)
router
  .group(() => {
    router.get('/wallet', [WalletsController, 'show'])
    router.get('/wallet/deposit-status', [WalletsController, 'checkDepositStatus'])
    router.post('/wallet/deposit/address', [WalletsController, 'generateDepositAddress'])
    router.post('/wallet/withdraw/request', [WalletsController, 'withdrawRequest'])
    router.post('/wallet/invest', [WalletsController, 'investFunds'])
    router.post('/subscriptions', [SubscriptionsController, 'create'])
    router.post('/subscriptions/upgrade', [SubscriptionsController, 'upgrade'])
    router.post('/wallet/claim-gains', [WalletsController, 'claimGains'])
    router.get('/wallet/transactions', [WalletsController, 'getTransactions']) // New route for transaction history
    router.post('/signals/use', [SignalsController, 'useSignal'])

    // Airdrop Routes
    router.post('/airdrop/claim', [AirdropsController, 'claim'])
    router.get('/airdrop/status', [AirdropsController, 'status'])
  })
  .use(middleware.auth())

// Admin Commands Routes (requires authentication)
router
  .group(() => {
    router.post('/calculate-referral-levels', [AdminCommandsController, 'calculateReferralLevels'])
    router.post('/plans/:planId/generate-signal', [AdminCommandsController, 'generateSingleSignal'])
  })
  .prefix('/admin/api') // Changed prefix to /admin/api
  .use()

router
  .group(() => {
    router.post('/internal/deposit/confirm', [WalletsController, 'processConfirmedDepositInternal'])
    // Admin actions for withdrawals
    router.post('/admin/wallet/withdraw/:transactionId/approve', [
      WalletsController,
      'approveWithdrawal',
    ])
    router.post('/admin/wallet/withdraw/:transactionId/reject', [
      WalletsController,
      'rejectWithdrawal',
    ])
  })
  .prefix('/api')

// Announcements
router.resource('announcements', AnnouncementsController).apiOnly()
