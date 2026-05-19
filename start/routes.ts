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
const ExternalWalletAddressesController = () =>import('#controllers/external_wallet_addresses_controller') // Import new controller
const GroupChatsController = () => import('#controllers/group_chats_controller') // Import GroupChatsController
const AdminCommandsController = () => import('#controllers/admin_commands_controller') // Import AdminCommandsController
const AnnouncementsController = () => import('#controllers/announcements_controller')
const AirdropsController = () => import('#controllers/airdrops_controller')
const TwoFactorsController = () => import('#controllers/two_factors_controller')
const KycsController = () => import('#controllers/kycs_controller')
const AdminKycsController = () => import('#controllers/admin_kycs_controller')
const UploadsController = () => import('#controllers/uploads_controller')
const CopyTradingController = () => import('#controllers/copy_tradings_controller')
const TeamController = () => import('#controllers/team_controller')
const StakingController = () => import('#controllers/staking_controller')
const AdminCreditsController = () => import('#controllers/admin_credits_controller')
const AdminLockedCapitalController = () => import('#controllers/admin_locked_capital_controller')
const AdminTransactionsController = () => import('#controllers/admin_transactions_controller')
const P2pController = () => import('#controllers/p2p_controller')
const P2pPaymentMethodsController = () => import('#controllers/p2p_payment_methods_controller')
const P2pChatController = () => import('#controllers/p2p_chat_controller')

// Auth Routes
router.post('/register', [AuthController, 'register'])
router.post('/verify-email', [AuthController, 'verifyEmail'])
router.post('/login', [AuthController, 'login'])
router.post('/auth/telegram', [AuthController, 'telegramAuth'])
router.post('/resend-verification-email', [AuthController, 'resendVerificationEmail'])

// Authenticated User Routes
router
  .group(() => {
    router.get('/auth/me', [AuthController, 'getAuthenticatedUser'])
    router.get('/auth/referrals', [AuthController, 'getReferralInfo'])
    router.post('/auth/logout', [AuthController, 'logout'])
    router.put('/auth/me', [AuthController, 'updateProfile']) // Add this line
    router.post('/uploads', [UploadsController, 'upload']) // Reusable upload endpoint

    // 2FA Routes
    router.get('/auth/2fa/generate', [TwoFactorsController, 'generate'])
    router.post('/auth/2fa/enable', [TwoFactorsController, 'enable'])
    router.post('/auth/2fa/disable', [TwoFactorsController, 'disable'])

    // KYC Routes (User)
    router.post('/kyc/submit', [KycsController, 'submit'])
    router.get('/kyc/status', [KycsController, 'status'])

    // External Wallet Addresses Routes
    router.resource('external-wallet-addresses', ExternalWalletAddressesController).apiOnly() // Only expose API-related routes (index, store, show, update, destroy)

    // Group Chat Routes
    router.get('/group-chat/messages', [GroupChatsController, 'index'])
    router.post('/group-chat/messages', [GroupChatsController, 'store'])

    // Copy Trading Routes
    router.get('/copy-trading/traders', [CopyTradingController, 'index'])
    router.get('/copy-trading/daily', [CopyTradingController, 'getDailyTrader'])
    router.post('/copy-trading/copy', [CopyTradingController, 'copyTrader'])
    router.get('/copy-trading/history', [CopyTradingController, 'getHistory'])

    // Staking Routes
    router.get('/staking/plans', [StakingController, 'plans'])
    router.get('/staking/positions', [StakingController, 'positions'])
    router.post('/staking/stake', [StakingController, 'stake'])
    router.post('/staking/unstake/:id', [StakingController, 'unstake'])
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
    router.post('/wallet/transfer-investment', [WalletsController, 'transferInvestmentToBalance'])
    router.get('/wallet/transactions', [WalletsController, 'getTransactions']) // New route for transaction history
    router.post('/signals/use', [SignalsController, 'useSignal'])
    router.get('/signals/current', [SignalsController, 'getCurrentSignal'])
    router.get('/signals/history', [SignalsController, 'getHistory'])

    // Airdrop Routes
    router.post('/airdrop/claim', [AirdropsController, 'claim'])
    router.get('/airdrop/status', [AirdropsController, 'status'])

    // P2P Exchange Routes
    router.post('/p2p/offers', [P2pController, 'createOffer'])
    router.get('/p2p/offers', [P2pController, 'listOffers'])
    router.get('/p2p/offers/my', [P2pController, 'myOffers'])
    router.get('/p2p/offers/:offerId', [P2pController, 'showOffer'])
    router.post('/p2p/offers/:offerId/take', [P2pController, 'takeOffer'])
    router.post('/p2p/offers/:offerId/cancel', [P2pController, 'cancelOffer'])
    router.post('/p2p/trades/:tradeId/payment-sent', [P2pController, 'markPaymentSent'])
    router.post('/p2p/trades/:tradeId/confirm', [P2pController, 'confirmPayment'])
    router.post('/p2p/trades/:tradeId/dispute', [P2pController, 'raiseDispute'])
    router.get('/p2p/trades/debug/:tradeId', [P2pController, 'debugTrade'])
    router.get('/p2p/trades/my', [P2pController, 'myTrades'])
    router.get('/p2p/trades/:tradeId', [P2pController, 'showTrade'])
    // P2P Payment Methods
    router.get('/p2p/payment-methods', [P2pPaymentMethodsController, 'index'])
    router.post('/p2p/payment-methods', [P2pPaymentMethodsController, 'store'])
    router.put('/p2p/payment-methods/:id', [P2pPaymentMethodsController, 'update'])
    router.delete('/p2p/payment-methods/:id', [P2pPaymentMethodsController, 'destroy'])
    // P2P Trade Chat
    router.get('/p2p/trades/:tradeId/messages', [P2pChatController, 'index'])
    router.post('/p2p/trades/:tradeId/messages', [P2pChatController, 'store'])
  })
  .use(middleware.auth())

// Admin Commands Routes (requires authentication)
router
  .group(() => {
    router.post('/calculate-referral-levels', [AdminCommandsController, 'calculateReferralLevels'])
    router.post('/plans/:planId/generate-signal', [AdminCommandsController, 'generateSingleSignal'])
    router.post('/signals/generate-new-investors', [
      AdminCommandsController,
      'generateNewInvestorsSignal',
    ])

    // KYC Admin Routes
    router.get('/kyc/submissions', [AdminKycsController, 'index'])
    router.get('/kyc/submissions/:id', [AdminKycsController, 'show'])
    router.post('/kyc/submissions/:id/approve', [AdminKycsController, 'approve'])
    router.post('/kyc/submissions/:id/reject', [AdminKycsController, 'reject'])

    // Team viewer
    router.get('/team', [TeamController, 'show'])

    // Admin Credits
    router.post('/credits/users', [AdminCreditsController, 'creditUsers'])
    router.post('/credits/by-level', [AdminCreditsController, 'creditByLevel'])
    router.post('/credits/unlock/:userId', [AdminCreditsController, 'unlockCapital'])

    // Locked capital overview
    router.get('/locked-capital', [AdminLockedCapitalController, 'index'])

    // All transactions with filters
    router.get('/transactions', [AdminTransactionsController, 'index'])
    // Update user referral level
    router.post('/users/:userId/referral-level', [AdminLockedCapitalController, 'updateReferralLevel'])
    // Daily trader — get or auto-generate
    router.get('/daily-trader', [AdminCommandsController, 'getDailyTrader'])
    // P2P admin
    router.get('/p2p/trades', [P2pController, 'adminListTrades'])
    router.get('/p2p/trades/:tradeId', [P2pController, 'adminGetTrade'])
    router.post('/p2p/trades/:tradeId/resolve', [P2pController, 'adminResolveDispute'])
  })
  .prefix('/admin/api')

router
  .group(() => {
  router.post('/internal/deposit/confirm', [WalletsController, 'processConfirmedDepositInternal'])
    // Admin actions for withdrawals
    router.get('/admin/wallet/withdrawals/pending', [WalletsController, 'getPendingWithdrawals'])
    router.post('/admin/wallet/withdraw/:transactionId/approve', [
      WalletsController,
      'approveWithdrawal',
    ])
    router.post('/admin/wallet/withdraw/:transactionId/confirm', [
      WalletsController,
      'confirmWithdrawal',
    ])
    router.post('/admin/wallet/withdraw/:transactionId/reject', [
      WalletsController,
      'rejectWithdrawal',
    ])
  })
  .prefix('/api')

// Announcements
router.resource('announcements', AnnouncementsController).apiOnly()
