import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Trader from '#models/trader'

export default class extends BaseSeeder {
  async run() {
    const traders = [
      {
        name: 'Alex Morgan',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AlexMorgan',
        successRate: 92,
        description: 'Spécialiste Bitcoin & Ethereum avec 8 ans d\'expérience. Stratégie long-terme.',
        isActive: true,
      },
      {
        name: 'Sarah Chen',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SarahChen',
        successRate: 88,
        description: 'Experte en DeFi et altcoins. Analyse technique avancée.',
        isActive: true,
      },
      {
        name: 'Marcus Williams',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MarcusWilliams',
        successRate: 85,
        description: 'Trader quantitatif. Algorithmes propriétaires sur les marchés crypto.',
        isActive: true,
      },
      {
        name: 'Yuki Tanaka',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=YukiTanaka',
        successRate: 90,
        description: 'Spécialiste des marchés asiatiques. Focus sur BNB, SOL et AVAX.',
        isActive: true,
      },
      {
        name: 'Elena Petrova',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ElenaPetrova',
        successRate: 87,
        description: 'Analyste macro-économique. Combine fondamentaux et technique.',
        isActive: true,
      },
      {
        name: 'James Okafor',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=JamesOkafor',
        successRate: 83,
        description: 'Expert en scalping et trading haute fréquence sur BTC/USDT.',
        isActive: true,
      },
      {
        name: 'Lina Dubois',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=LinaDubois',
        successRate: 91,
        description: 'Gestionnaire de portefeuille crypto. Diversification optimisée.',
        isActive: true,
      },
      {
        name: 'Carlos Mendez',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=CarlosMendez',
        successRate: 86,
        description: 'Spécialiste NFT et Web3. Détecte les tendances émergentes.',
        isActive: true,
      },
      {
        name: 'Priya Sharma',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=PriyaSharma',
        successRate: 89,
        description: 'Ingénieure financière. Modèles prédictifs basés sur l\'IA.',
        isActive: true,
      },
      {
        name: 'David Kim',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=DavidKim',
        successRate: 84,
        description: 'Ancien trader institutionnel. Stratégies de couverture avancées.',
        isActive: true,
      },
      {
        name: 'Amara Diallo',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=AmaraDiallo',
        successRate: 93,
        description: 'Top performer 2024. Spécialiste des breakouts et momentum trading.',
        isActive: true,
      },
      {
        name: 'Noah Fischer',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=NoahFischer',
        successRate: 82,
        description: 'Trader swing sur ETH et L2. Analyse on-chain approfondie.',
        isActive: true,
      },
      {
        name: 'Isabella Rossi',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=IsabellaRossi',
        successRate: 88,
        description: 'Experte en stablecoins et yield farming. Rendements optimisés.',
        isActive: true,
      },
      {
        name: 'Kwame Asante',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=KwameAsante',
        successRate: 85,
        description: 'Spécialiste des marchés émergents crypto. Focus Afrique & Asie.',
        isActive: true,
      },
      {
        name: 'Sophie Laurent',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SophieLaurent',
        successRate: 90,
        description: 'Analyste technique certifiée. Patterns chartistes et Fibonacci.',
        isActive: true,
      },
      {
        name: 'Ravi Patel',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=RaviPatel',
        successRate: 87,
        description: 'Développeur blockchain & trader. Expertise DeFi et smart contracts.',
        isActive: true,
      },
      {
        name: 'Mia Johansson',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MiaJohansson',
        successRate: 86,
        description: 'Spécialiste risk management. Drawdown minimal, gains constants.',
        isActive: true,
      },
      {
        name: 'Omar Hassan',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=OmarHassan',
        successRate: 91,
        description: 'Expert en trading de futures crypto. Levier maîtrisé et discipliné.',
        isActive: true,
      },
      {
        name: 'Chloe Nguyen',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ChloeNguyen',
        successRate: 84,
        description: 'Analyste sentiment de marché. Combine social data et technique.',
        isActive: true,
      },
      {
        name: 'Lucas Ferreira',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=LucasFerreira',
        successRate: 89,
        description: 'Trader professionnel depuis 2017. Survécu à tous les bear markets.',
        isActive: true,
      },
    ]

    for (const trader of traders) {
      await Trader.firstOrCreate({ name: trader.name }, trader)
    }
  }
}
