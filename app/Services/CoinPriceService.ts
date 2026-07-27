/**
 * CoinPriceService
 * ─────────────────────────────────────────────────────────────────────────────
 * Service de prix temps réel pour le token PXC (Phoenixcoin) via CoinGecko.
 *
 * Fonctionnalités :
 *  - Récupère le prix du token dans toutes les devises fiat
 *  - Cache interne de 60 secondes pour éviter les rate-limits de l'API
 *  - Fallback sur le dernier prix connu en cas d'erreur réseau
 *  - Méthode utilitaire pour obtenir le prix dans une devise spécifique
 */

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/coins/phoenixcoin' +
  '?localization=false&tickers=false&market_data=true' +
  '&community_data=false&developer_data=false&sparkline=false'

/** Durée du cache en millisecondes (60 secondes) */
const CACHE_TTL_MS = 60_000

export interface TokenPriceData {
  /** Prix dans toutes les devises disponibles */
  prices: Record<string, number>
  /** Dernière mise à jour selon CoinGecko */
  lastUpdated: string
  /** Timestamp local de la dernière récupération */
  fetchedAt: Date
}

class CoinPriceService {
  private cache: TokenPriceData | null = null
  private lastFetchAt: number = 0
  private isFetching: boolean = false

  /**
   * Récupère les données de prix depuis CoinGecko.
   * Utilise le cache si celui-ci est encore valide (< 60s).
   */
  async getPriceData(): Promise<TokenPriceData> {
    const now = Date.now()

    // Retourner le cache s'il est encore frais
    if (this.cache && now - this.lastFetchAt < CACHE_TTL_MS) {
      return this.cache
    }

    // Éviter les requêtes concurrentes
    if (this.isFetching && this.cache) {
      return this.cache
    }

    this.isFetching = true

    try {
      const response = await fetch(COINGECKO_URL, {
        headers: {
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10_000), // timeout 10s
      })

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as {
        market_data?: {
          current_price?: Record<string, number>
          last_updated?: string
        }
      }

      const prices = data.market_data?.current_price ?? {}
      const lastUpdated = data.market_data?.last_updated ?? new Date().toISOString()

      this.cache = {
        prices,
        lastUpdated,
        fetchedAt: new Date(),
      }
      this.lastFetchAt = now

      return this.cache
    } catch (error) {
      console.error('[CoinPriceService] Erreur lors de la récupération du prix:', error)

      // Retourner le cache périmé si disponible (fallback)
      if (this.cache) {
        console.warn('[CoinPriceService] Utilisation du cache périmé comme fallback.')
        return this.cache
      }

      throw new Error(
        'Impossible de récupérer le prix du token. Veuillez réessayer dans quelques instants.'
      )
    } finally {
      this.isFetching = false
    }
  }

  /**
   * Retourne le prix du token dans une devise spécifique.
   * @param currency Code devise en minuscules (ex: "usd", "eur", "xaf")
   * @throws Error si la devise n'est pas supportée
   */
  async getPriceInCurrency(currency: string): Promise<number> {
    const data = await this.getPriceData()
    const lowerCurrency = currency.toLowerCase()
    const price = data.prices[lowerCurrency]

    if (price === undefined) {
      throw new Error(
        `Devise "${currency.toUpperCase()}" non supportée. Devises disponibles: ${Object.keys(data.prices).join(', ')}`
      )
    }

    return price
  }

  /**
   * Retourne un snapshot complet avec le prix, le cache info, et les devises supportées.
   */
  async getMarketSnapshot() {
    const data = await this.getPriceData()
    const now = Date.now()
    const ageSeconds = Math.round((now - this.lastFetchAt) / 1000)

    return {
      symbol: 'PXC',
      name: 'Phoenixcoin',
      prices: data.prices,
      lastUpdated: data.lastUpdated,
      cacheAge: `${ageSeconds}s`,
      cacheExpiresIn: `${Math.max(0, Math.round((CACHE_TTL_MS - (now - this.lastFetchAt)) / 1000))}s`,
      supportedCurrencies: Object.keys(data.prices),
    }
  }

  /**
   * Force le rafraîchissement du cache au prochain appel.
   */
  invalidateCache() {
    this.lastFetchAt = 0
  }
}

export default new CoinPriceService()
