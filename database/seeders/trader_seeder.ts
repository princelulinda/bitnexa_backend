import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Trader from '#models/trader'

export default class extends BaseSeeder {
  async run() {
    const traders = [
      {
        name: 'Tyler Brooks',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop', // Young professional male trader
        successRate: 92,
        description: 'Bitcoin & Ethereum specialist with 8 years of experience. Long-term strategy focused on capital preservation.',
        isActive: true,
      },
      {
        name: 'Ashley Carter',
        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop', // Confident young woman
        successRate: 88,
        description: 'DeFi and altcoin expert. Advanced technical analysis with a focus on emerging layer-2 protocols.',
        isActive: true,
      },
      {
        name: 'Brandon Mitchell',
        avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800&auto=format&fit=crop', // Professional man at desk
        successRate: 85,
        description: 'Quantitative trader using proprietary algorithms. Data-driven approach to crypto market cycles.',
        isActive: true,
      },
      {
        name: 'Jordan Hayes',
        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop', // Young male trader
        successRate: 90,
        description: 'Swing trader specializing in BNB, SOL, and AVAX. Consistent returns across bull and bear markets.',
        isActive: true,
      },
      {
        name: 'Brittany Evans',
        avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=800&auto=format&fit=crop', // Professional woman
        successRate: 87,
        description: 'Macro-economic analyst combining on-chain fundamentals with technical signals for high-probability trades.',
        isActive: true,
      },
      {
        name: 'Derek Johnson',
        avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop', // Serious male trader
        successRate: 83,
        description: 'High-frequency scalping expert on BTC/USDT. Precision entries with tight risk management.',
        isActive: true,
      },
      {
        name: 'Megan Thompson',
        avatarUrl: 'https://images.unsplash.com/photo-1580489944761-09be1ec59862?w=800&auto=format&fit=crop', // Smiling professional woman
        successRate: 91,
        description: 'Crypto portfolio manager with optimized diversification strategies. Steady compounding returns.',
        isActive: true,
      },
      {
        name: 'Kyle Anderson',
        avatarUrl: 'https://images.unsplash.com/photo-1519085360753-38b2b54e3d6a?w=800&auto=format&fit=crop', // Young male in casual business
        successRate: 86,
        description: 'NFT and Web3 specialist. Early mover advantage in identifying emerging market trends.',
        isActive: true,
      },
      {
        name: 'Stephanie Wilson',
        avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&auto=format&fit=crop', // Confident business woman
        successRate: 89,
        description: 'Financial engineer leveraging AI-based predictive models for crypto market forecasting.',
        isActive: true,
      },
      {
        name: 'Nathan Davis',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop', // Mature professional male
        successRate: 84,
        description: 'Former institutional trader. Advanced hedging strategies with a focus on downside protection.',
        isActive: true,
      },
      {
        name: 'Kayla Robinson',
        avatarUrl: 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=800&auto=format&fit=crop', // Young energetic woman
        successRate: 93,
        description: 'Top performer 2024. Breakout and momentum trading specialist with exceptional win rate.',
        isActive: true,
      },
      {
        name: 'Ryan Martinez',
        avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop',
        successRate: 82,
        description: 'ETH and L2 swing trader. Deep on-chain analysis to identify accumulation zones.',
        isActive: true,
      },
      {
        name: 'Lauren White',
        avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&auto=format&fit=crop', // Professional woman smiling
        successRate: 88,
        description: 'Stablecoin and yield farming expert. Optimized returns with minimal volatility exposure.',
        isActive: true,
      },
      {
        name: 'Travis Harris',
        avatarUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=800&auto=format&fit=crop', // Confident male trader
        successRate: 85,
        description: 'Emerging market crypto specialist. Strong track record across global market conditions.',
        isActive: true,
      },
      {
        name: 'Amber Clark',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop', // Elegant professional woman
        successRate: 90,
        description: 'Certified technical analyst. Chart patterns, Fibonacci retracements, and Elliott Wave theory.',
        isActive: true,
      },
      {
        name: 'Cody Lewis',
        avatarUrl: 'https://images.unsplash.com/photo-1519085360753-38b2b54e3d6a?w=800&auto=format&fit=crop',
        successRate: 87,
        description: 'Blockchain developer turned trader. Deep expertise in DeFi protocols and smart contract analysis.',
        isActive: true,
      },
      {
        name: 'Tiffany Walker',
        avatarUrl: 'https://images.unsplash.com/photo-1580489944761-09be1ec59862?w=800&auto=format&fit=crop',
        successRate: 86,
        description: 'Risk management specialist. Minimal drawdown approach with consistent daily gains.',
        isActive: true,
      },
      {
        name: 'Chad Nelson',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop',
        successRate: 91,
        description: 'Crypto futures trading expert. Disciplined leverage usage with strong position sizing.',
        isActive: true,
      },
      {
        name: 'Samantha Young',
        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop',
        successRate: 84,
        description: 'Market sentiment analyst. Combines social data, fear & greed index, and technical signals.',
        isActive: true,
      },
      {
        name: 'Blake Turner',
        avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800&auto=format&fit=crop',
        successRate: 89,
        description: 'Professional trader since 2017. Survived every bear market with a proven long-term strategy.',
        isActive: true,
      },
    ]

    for (const trader of traders) {
      await Trader.firstOrCreate({ name: trader.name }, trader)
    }
  }
}