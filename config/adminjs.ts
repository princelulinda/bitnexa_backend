import { AdminJSProviderConfig } from '@adminjs/adonis'

import componentLoader from '../app/admin/component_loader.js'
import authProvider from '../app/admin/auth.js'
import { LucidResource } from '@adminjs/adonis'
import consolidationReportAction from '../app/admin/actions/consolidation_report.js'
import { dashboardHandler } from '../app/admin/dashboard_handler.js'

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
import Message from '#models/message'
import Announcement from '#models/announcement'
import uploadFileFeature from '@adminjs/upload'
import app from '@adonisjs/core/services/app'
import { cuid } from '@adonisjs/core/helpers'

const adminjsConfig: AdminJSProviderConfig = {
  adapter: {
    enabled: true,
  },
  adminjs: {
    rootPath: '/admin',
    loginPath: '/admin/login',
    logoutPath: '/admin/logout',
    componentLoader,
    dashboard: {
      handler: dashboardHandler,
      component: 'Dashboard',
    },
    resources: [
      new LucidResource(User),
      {
        resource: new LucidResource(Wallet),
        options: {
          actions: {
            consolidationReport: consolidationReportAction,
          },
        },
      },
      new LucidResource(Transaction),
      new LucidResource(Subscription),
      {
        resource: new LucidResource(Plan),
        options: {
          actions: {
            generateSignal: {
              handler: async (request, response, context) => {
                return {
                  record: context.record.toJSON(),
                  notice: {
                    message: 'Cliquez sur le bouton pour générer un signal.',
                    type: 'info',
                  },
                }
              },
              component: 'GenerateSignalComponent',
              actionType: 'record',
              isVisible: true,
              label: 'Générer un Signal',
            },
          },
        },
      },
      new LucidResource(ReferralLevel),
      new LucidResource(ExternalWalletAddress),
      new LucidResource(Deposit),
      new LucidResource(Signal),
      new LucidResource(UserSignal),
      {
        resource: new LucidResource(Announcement),
        options: {
          properties: {
            imageUrl: {
              type: 'string',
              components: {
                edit: 'ImageUploadComponent',
              },
            },
          },
        },
      },
      {
        resource: new LucidResource(Message),
        options: {
          titleProperty: 'id',
        },
      },
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
