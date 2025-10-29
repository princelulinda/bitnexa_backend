import { AdminJSProviderConfig } from '@adminjs/adonis'

import componentLoader from '../app/admin/component_loader.js'
import authProvider from '../app/admin/auth.js'
import { LucidResource } from '@adminjs/adonis'

// Import all models
import User from '#models/user'
import Wallet from '#models/wallet'
import Transaction from '#models/transaction'
import Subscription from '#models/subscription'
import Plan from '#models/plan'
import ReferralLevel from '#models/referral_level'
import ExternalWalletAddress from '#models/external_wallet_address'
import Deposit from '#models/deposit'
import Signal from '#models/signal'
import UserSignal from '#models/user_signal'

const adminjsConfig: AdminJSProviderConfig = {
  adapter: {
    enabled: true,
  },
  adminjs: {
    rootPath: '/admin',
    loginPath: '/admin/login',
    logoutPath: '/admin/logout',
    componentLoader,
    resources: [
      // new LucidResource(User),
      // new LucidResource(Wallet),
      // new LucidResource(Transaction),
      // new LucidResource(Subscription),
      // new LucidResource(Plan),
      // new LucidResource(ReferralLevel),
      // new(ExternalWalletAddress),
      // new LucidResource(Deposit),
      // new LucidResource(Signal),
      // new LucidResource(UserSignal),
    ],
    pages: {},
    locale: {
      availableLanguages: ['en'],
      language: 'en',
      translations: {
        en: {
          actions: {},
          messages: {},
          labels: {},
          buttons: {},
          properties: {},
          components: {},
          pages: {},
          ExampleResource: {
            actions: {},
            messages: {},
            labels: {},
            buttons: {},
            properties: {},
          },
        },
      },
    },
    branding: {
      companyName: 'ZinoFee',
      theme: {},
    },
    settings: {
      defaultPerPage: 10,
    },
  },
  auth: {
    enabled: true,
    provider: authProvider,
    middlewares: [],
  },
  middlewares: [],
}

export default adminjsConfig
