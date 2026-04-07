import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Trader from '#models/trader'

export default class extends BaseSeeder {
  async run() {
    const traders = [
      {
        name: 'Tyler Brooks',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=TylerBrooks',
        successRate: 92,
        description: 'Bitcoin & Ethereum specialist with 8 years of experience. Long-term strategy focused on capital preservation.',
        isActive: true,
      },
      {
        name: 'Ashley Carter',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AshleyCarter',
        successRate: 88,
        description: 'DeFi and altcoin expert. Advanced technical analysis with a focus on emerging layer-2 protocols.',
        isActive: true,
      },
      {
        name: 'Brandon Mitchell',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=BrandonMitchell',
        successRate: 85,
        description: 'Quantitative trader using proprietary algorithms. Data-driven approach to crypto market cycles.',
        isActive: true,
      },
      {
        name: 'Jordan Hayes',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=JordanHayes',
        successRate: 90,
        description: 'Swing trader specializing in BNB, SOL, and AVAX. Consistent returns across bull and bear markets.',
        isActive: true,
      },
      {
        name: 'Brittany Evans',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=BrittanyEvans',
        successRate: 87,
        description: 'Macro-economic analyst combining on-chain fundamentals with technical signals for high-probability trades.',
        isActive: true,
      },
      {
        name: 'Derek Johnson',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=DerekJohnson',
        successRate: 83,
        description: 'High-frequency scalping expert on BTC/USDT. Precision entries with tight risk management.',
        isActive: true,
      },
      {
        name: 'Megan Thompson',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MeganThompson',
        successRate: 91,
        description: 'Crypto portfolio manager with optimized diversification strategies. Steady compounding returns.',
        isActive: true,
      },
      {
        name: 'Kyle Anderson',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=KyleAnderson',
        successRate: 86,
        description: 'NFT and Web3 specialist. Early mover advantage in identifying emerging market trends.',
        isActive: true,
      },
      {
        name: 'Stephanie Wilson',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=StephanieWilson',
        successRate: 89,
        description: 'Financial engineer leveraging AI-based predictive models for crypto market forecasting.',
        isActive: true,
      },
      {
        name: 'Nathan Davis',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=NathanDavis',
        successRate: 84,
        description: 'Former institutional trader. Advanced hedging strategies with a focus on downside protection.',
        isActive: true,
      },
      {
        name: 'Kayla Robinson',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=KaylaRobinson',
        successRate: 93,
        description: 'Top performer 2024. Breakout and momentum trading specialist with exceptional win rate.',
        isActive: true,
      },
      {
        name: 'Ryan Martinez',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=RyanMartinez',
        successRate: 82,
        description: 'ETH and L2 swing trader. Deep on-chain analysis to identify accumulation zones.',
        isActive: true,
      },
      {
        name: 'Lauren White',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=LaurenWhite',
        successRate: 88,
        description: 'Stablecoin and yield farming expert. Optimized returns with minimal volatility exposure.',
        isActive: true,
      },
      {
        name: 'Travis Harris',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=TravisHarris',
        successRate: 85,
        description: 'Emerging market crypto specialist. Strong track record across global market conditions.',
        isActive: true,
      },
      {
        name: 'Amber Clark',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AmberClark',
        successRate: 90,
        description: 'Certified technical analyst. Chart patterns, Fibonacci retracements, and Elliott Wave theory.',
        isActive: true,
      },
      {
        name: 'Cody Lewis',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=CodyLewis',
        successRate: 87,
        description: 'Blockchain developer turned trader. Deep expertise in DeFi protocols and smart contract analysis.',
        isActive: true,
      },
      {
        name: 'Tiffany Walker',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=TiffanyWalker',
        successRate: 86,
        description: 'Risk management specialist. Minimal drawdown approach with consistent daily gains.',
        isActive: true,
      },
      {
        name: 'Chad Nelson',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ChadNelson',
        successRate: 91,
        description: 'Crypto futures trading expert. Disciplined leverage usage with strong position sizing.',
        isActive: true,
      },
      {
        name: 'Samantha Young',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SamanthaYoung',
        successRate: 84,
        description: 'Market sentiment analyst. Combines social data, fear & greed index, and technical signals.',
        isActive: true,
      },
      {
        name: 'Blake Turner',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=BlakeTurner',
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
