# 📋 Changelog Backend — Marché P2P & Staking PXC
## Table des matières

1. [Résumé des changements](#1--résumé-des-changements)
2. [Nouveau modèle de données Wallet](#2--nouveau-modèle-de-données-wallet)
3. [Module P2P — Marché de tokens airdrop](#3--module-p2p--marché-de-tokens-airdrop)
4. [Module PXC Staking — 5%/jour](#4--module-pxc-staking--5jour)
5. [Routes supprimées](#5--routes-supprimées)
6. [Changements frontend requis](#6--changements-frontend-requis)
7. [Exemples d'intégration frontend](#7--exemples-dintégration-frontend)

---

## 1 — Résumé des changements

### Ce qui a changé

| Avant | Maintenant |
|-------|------------|
| P2P = échange hors-plateforme avec paiement fiat (virement, Mobile Money) | P2P = **swap atomique interne** : tokens PXC ↔ balance USDT |
| Le vendeur fixait son prix manuellement | Le prix est **automatiquement récupéré de CoinGecko** en temps réel |
| L'acheteur envoyait une preuve de paiement, le vendeur devait confirmer | **L'achat est instantané** — 1 clic et la transaction est complète |
| Les tokens étaient interchangeables avec la balance USDT | **Séparation stricte** : `airdropBalance` (tokens PXC) ≠ `balance` (USDT) |
| Pas de staking pour les tokens PXC | **Nouveau module PXC Staking** : 5% de rendement par jour |

### Fichiers backend créés

| Fichier | Description |
|---------|-------------|
| `app/Services/CoinPriceService.ts` | Service prix temps réel CoinGecko (cache 60s) |
| `app/models/pxc_staking_position.ts` | Model position de staking PXC |
| `app/controllers/pxc_staking_controller.ts` | Controller staking PXC |
| `database/migrations/1776200000000_*.ts` | Migration : champs `token_symbol`, `token_source` sur P2P |
| `database/migrations/1776300000000_*.ts` | Migration : table `pxc_staking_positions` |

### Fichiers backend modifiés

| Fichier | Modification |
|---------|-------------|
| `app/controllers/p2p_controller.ts` | Réécriture complète — swap atomique + prix CoinGecko |
| `app/models/p2p_offer.ts` | Ajout champs `tokenSymbol`, `tokenSource` |
| `app/models/p2p_trade.ts` | Ajout champ `tokenSymbol` |
| `start/routes.ts` | Nouvelles routes P2P simplifiées + routes PXC staking |
| `start/scheduler.ts` | Cron quotidien distribution rewards staking |

---

## 2 — Nouveau modèle de données Wallet

Le wallet d'un utilisateur contient maintenant **deux soldes distincts** :

```
┌─────────────────────────────────────────────────────────────┐
│                      WALLET UTILISATEUR                     │
├───────────────────┬─────────────────────────────────────────┤
│  balance (USDT)   │ Dépôts crypto, gains, ventes P2P       │
│                   │ → Retraitable on-chain                  │
│                   │ → Sert à ACHETER des tokens PXC sur P2P │
├───────────────────┼─────────────────────────────────────────┤
│  airdropBalance   │ Tokens PXC (airdrop quotidien)          │
│     (PXC)         │ → NON retraitable directement           │
│                   │ → Vendable sur le marché P2P → USDT     │
│                   │ → Stakable à 5%/jour                    │
└───────────────────┴─────────────────────────────────────────┘
```

**Réponse `GET /wallet` existante** — les champs concernés :
```json
{
  "balance": 150.00,
  "airdropBalance": 2500,
  "investmentBalance": 0,
  "bonusBalance": 0
}
```

> ⚠️ **Le frontend doit afficher `balance` et `airdropBalance` séparément** avec des labels clairs (ex: "Solde USDT" et "Tokens PXC").

---

## 3 — Module P2P — Marché de tokens airdrop

### 3.1 — Concept

Le marché P2P permet aux utilisateurs d'échanger des **tokens PXC** (collectés via l'airdrop quotidien) contre des **USDT** (balance principale). Tout se passe **sur la plateforme**, il n'y a plus de paiement externe.

### 3.2 — Flux complet

```
VENDEUR                                    ACHETEUR
──────                                     ────────
a des tokens PXC (airdropBalance)          a du USDT (balance)
        │                                          │
        ▼                                          │
POST /p2p/offers                                   │
  { tokenAmount: 500, currency: "usd" }            │
        │                                          │
        ▼                                          │
  CoinGecko → 1 PXC = 0.024 USD                   │
  airdropBalance -= 500 (escrow)                   │
  Offre créée : "500 PXC à 12.07 USD"              │
        │                                          │
        │         ◄────── Voit l'offre ────────────┤
        │                                          │
        │                POST /p2p/offers/:id/take │
        │                                          ▼
        │                          ╔═══════════════════════════╗
        │                          ║   SWAP ATOMIQUE INSTANT   ║
        │                          ║                           ║
        │                          ║  buyer.balance -= 12.07   ║
        ├────── balance += 12.07 ◄─║  seller.balance += 12.07  ║
        │                          ║  buyer.airdrop += 500     ║
        │                          ║  trade.status = completed ║
        │                          ╚═══════════════════════════╝
        ▼                                          ▼
  Reçoit 12.07 USDT                     Reçoit 500 PXC
```

### 3.3 — API P2P — Toutes les routes

---

#### `GET /p2p/token-price` — Prix temps réel du token PXC

**Sans paramètre** → toutes les devises :
```json
// Réponse
{
  "symbol": "PXC",
  "name": "Phoenixcoin",
  "prices": {
    "usd": 0.02414682,
    "eur": 0.021236,
    "ngn": 32.92,
    "cny": 0.163513
  },
  "cacheAge": "12s",
  "cacheExpiresIn": "48s",
  "supportedCurrencies": ["usd", "eur", "gbp", ...]
}
```

**Avec `?currency=usd`** → une seule devise :
```json
{
  "symbol": "PXC",
  "currency": "USD",
  "price": 0.02414682,
  "source": "coingecko"
}
```

> **Frontend** : Appeler cette route pour afficher le prix live du token sur la page du marché P2P.

---

#### `POST /p2p/offers` — Créer une offre de vente

```json
// Requête
{
  "tokenAmount": 500,
  "currency": "usd",
  "notes": "Vente rapide"         // optionnel
}
```

```json
// Réponse 201
{
  "message": "Offre créée. 500 PXC sont en escrow.",
  "offer": {
    "id": "uuid",
    "tokenSymbol": "PXC",
    "tokenAmount": 500,
    "pricePerToken": 0.02414682,
    "totalCost": 12.07,
    "currency": "USD",
    "notes": "Vente rapide",
    "status": "open",
    "seller": {
      "id": "uuid",
      "name": "John Doe",
      "email": "jo***@gmail.com"
    },
    "createdAt": "2026-07-27T15:00:00.000Z"
  }
}
```

> **Erreurs possibles** :
> - `403` — KYC non vérifié
> - `422` — Solde airdrop insuffisant
> - `503` — CoinGecko indisponible

> **Frontend** : Le champ `pricePerToken` n'est plus un input utilisateur. Afficher le prix CoinGecko en lecture seule et calculer `totalCost = tokenAmount × pricePerToken` en temps réel.

---

#### `GET /p2p/offers` — Lister les offres ouvertes

**Query params** : `?currency=USD&page=1`

```json
// Réponse
{
  "data": [
    {
      "id": "uuid",
      "tokenSymbol": "PXC",
      "tokenAmount": 500,
      "pricePerToken": 0.02414682,
      "totalCost": 12.07,
      "currency": "USD",
      "notes": null,
      "seller": { "id": "uuid", "name": "John", "email": "jo***@gmail.com" },
      "createdAt": "..."
    }
  ],
  "meta": { "total": 42, "perPage": 20, "currentPage": 1 }
}
```

> **Frontend** : Afficher chaque offre avec les colonnes : Vendeur, Quantité PXC, Prix/token, Total USDT, Bouton "Acheter".

---

#### `POST /p2p/offers/:offerId/take` — Acheter (INSTANTANÉ)

```json
// Requête : AUCUN BODY NÉCESSAIRE
// L'achat utilise les paramètres de l'offre (montant, prix)
```

```json
// Réponse 201
{
  "message": "Achat effectué avec succès. Vous avez reçu 500 PXC.",
  "trade": {
    "id": "uuid",
    "tokenSymbol": "PXC",
    "tokenAmount": 500,
    "pricePerToken": 0.02414682,
    "totalPaid": 12.07,
    "currency": "USD",
    "status": "completed",
    "completedAt": "2026-07-27T15:00:00.000Z"
  }
}
```

> **Erreurs possibles** :
> - `409` — Offre n'est plus disponible
> - `403` — Tentative d'acheter sa propre offre
> - `422` — Balance USDT insuffisante

> **Frontend** : 
> - Afficher une **modale de confirmation** avant l'achat : "Vous allez dépenser 12.07 USDT pour recevoir 500 PXC. Confirmer ?"
> - Après succès → **rafraîchir** `wallet.balance` et `wallet.airdropBalance`
> - **Pas besoin** de page "preuve de paiement" ni de page "attente de confirmation"

---

#### `GET /p2p/offers/my` — Mes offres

```json
// Réponse
{
  "data": [
    {
      "id": "uuid",
      "tokenSymbol": "PXC",
      "tokenAmount": 500,
      "pricePerToken": 0.024,
      "totalCost": 12.07,
      "currency": "USD",
      "notes": null,
      "status": "open",
      "createdAt": "..."
    }
  ],
  "meta": { ... }
}
```

---

#### `GET /p2p/offers/:offerId` — Détail d'une offre

Mêmes champs que dans la liste, avec en plus le `seller` et `status`.

---

#### `POST /p2p/offers/:offerId/cancel` — Annuler une offre

```json
// Réponse 200
{
  "message": "Offre annulée. 500 PXC restitués à votre solde airdrop."
}
```

> Seulement possible si `status === "open"`.

---

#### `GET /p2p/trades/my` — Mes trades

```json
{
  "data": [
    {
      "id": "uuid",
      "role": "buyer",
      "tokenSymbol": "PXC",
      "tokenAmount": 500,
      "pricePerToken": 0.024,
      "totalFiat": 12.07,
      "currency": "USD",
      "status": "completed",
      "completedAt": "...",
      "createdAt": "..."
    }
  ],
  "meta": { ... }
}
```

---

#### `GET /p2p/trades/:tradeId` — Détail d'un trade

Mêmes champs avec en plus l'objet `offer` embarqué.

---

#### `POST /p2p/trades/:tradeId/dispute` — Ouvrir un litige

```json
// Requête
{ "reason": "Les tokens n'ont pas été crédités correctement..." }
```

```json
// Réponse 200
{
  "message": "Litige ouvert. Un administrateur va examiner et résoudre le différend.",
  "tradeId": "uuid"
}
```

---

### 3.4 — Routes P2P SUPPRIMÉES (ne plus utiliser)

| Route supprimée | Raison |
|-----------------|--------|
| `POST /p2p/trades/:tradeId/payment-sent` | Plus de paiement externe → achat instantané |
| `POST /p2p/trades/:tradeId/confirm` | Plus de confirmation manuelle vendeur |
| `GET /p2p/payment-methods` | Plus de méthodes de paiement fiat |
| `POST /p2p/payment-methods` | Idem |
| `PUT /p2p/payment-methods/:id` | Idem |
| `DELETE /p2p/payment-methods/:id` | Idem |
| `GET /p2p/trades/debug/:tradeId` | Route debug supprimée |

---

## 4 — Module PXC Staking — 5%/jour

### 4.1 — Concept

Les utilisateurs peuvent **staker leurs tokens PXC** (airdropBalance) pour gagner un rendement de **5% par jour**. Les récompenses sont automatiquement distribuées **chaque jour à 00:00 UTC** et créditées dans `airdropBalance`.

### 4.2 — Règles

| Règle | Valeur |
|-------|--------|
| Taux journalier | 5% du principal |
| Montant minimum | 1 PXC |
| Source des tokens | `airdropBalance` |
| Destination des rewards | `airdropBalance` |
| Pénalité unstake avant 7 jours | 10% du principal |
| Unstake après 7 jours | Aucune pénalité |
| Distribution automatique | Chaque jour à 00:00 UTC |

### 4.3 — Flux

```
Jour 0 : User stake 1000 PXC
         → airdropBalance -= 1000

Jour 1 (00:00 UTC) : Scheduler distribue
         → reward = 1000 × 5% = 50 PXC
         → airdropBalance += 50

Jour 2 : reward = 50 PXC → airdropBalance += 50

...

Jour 7 : User unstake
         → Récupère 1000 (principal) + 350 (rewards) = 1350 PXC
         → Pas de pénalité car >= 7 jours
         → airdropBalance += 1350
```

### 4.4 — API Staking PXC

---

#### `GET /pxc-staking/summary` — Résumé global

```json
{
  "tokenSymbol": "PXC",
  "dailyRatePercent": 5,
  "activePositions": 2,
  "totalStaked": 1500,
  "totalRewardsEarned": 225,
  "totalPendingRewards": 75,
  "dailyEarnings": 75,
  "totalValue": 1800
}
```

> **Frontend** : Page principale du staking avec les stats agrégées. Afficher un compteur animé pour `dailyEarnings`.

---

#### `GET /pxc-staking/positions` — Mes positions

```json
[
  {
    "id": "uuid",
    "amount": 1000,
    "dailyRatePercent": 5,
    "rewardsEarned": 150,
    "pendingRewards": 50,
    "totalValue": 1200,
    "status": "active",
    "startedAt": "2026-07-20T00:00:00.000Z",
    "endedAt": null,
    "lastRewardAt": "2026-07-27T00:00:00.000Z",
    "createdAt": "..."
  }
]
```

> **Frontend** : Liste des positions avec pour chaque : montant staké, rewards cumulés, rewards en attente, boutons "Claim" et "Unstake".

---

#### `POST /pxc-staking/stake` — Staker des tokens

```json
// Requête
{ "amount": 1000 }
```

```json
// Réponse 201
{
  "message": "1000 PXC stakés avec succès. Vous gagnerez 5% par jour.",
  "position": {
    "id": "uuid",
    "amount": 1000,
    "dailyRatePercent": 5,
    "dailyEarnings": 50,
    "status": "active",
    "startedAt": "..."
  }
}
```

> **Erreurs** :
> - `422` — airdropBalance insuffisant

---

#### `POST /pxc-staking/claim/:id` — Réclamer les rewards sans unstake

```json
// Requête : AUCUN BODY
```

```json
// Réponse 200
{
  "message": "50.000000 PXC de récompenses réclamés.",
  "rewardsClaimed": 50,
  "totalRewardsEarned": 200
}
```

> **Frontend** : Bouton "Claim Rewards" sur chaque position active. Désactivé si `pendingRewards === 0`.

---

#### `POST /pxc-staking/unstake/:id` — Retirer tout (principal + rewards)

```json
// Requête : AUCUN BODY
```

```json
// Réponse 200 (après 7 jours, pas de pénalité)
{
  "message": "Unstake effectué avec succès.",
  "principal": 1000,
  "rewards": 350,
  "penalty": 0,
  "totalReturned": 1350
}

// Réponse 200 (avant 7 jours, pénalité 10%)
{
  "message": "Unstake anticipé. Pénalité de 10%: -100 PXC.",
  "principal": 1000,
  "rewards": 50,
  "penalty": 100,
  "totalReturned": 950
}
```

> **Frontend** : Modale de confirmation. Si < 7 jours, **avertir l'utilisateur** de la pénalité de 10%.

---

## 5 — Routes supprimées

Ces routes **n'existent plus** sur le backend. Le frontend doit les retirer :

```diff
- POST /p2p/trades/:tradeId/payment-sent
- POST /p2p/trades/:tradeId/confirm
- GET  /p2p/payment-methods
- POST /p2p/payment-methods
- PUT  /p2p/payment-methods/:id
- DELETE /p2p/payment-methods/:id
- GET  /p2p/trades/debug/:tradeId
```

---

## 6 — Changements frontend requis

### 6.1 — Page Wallet / Dashboard

| Changement | Détail |
|------------|--------|
| ✅ Afficher `airdropBalance` | Ajouter un affichage séparé "Tokens PXC" avec le solde `wallet.airdropBalance` |
| ✅ Prix live PXC | Appeler `GET /p2p/token-price?currency=usd` pour afficher la valeur USDT des tokens |
| ✅ Valeur totale | Afficher `airdropBalance × pricePerToken` comme "Valeur des tokens" |

### 6.2 — Page Marché P2P (REFONTE COMPLÈTE)

| Composant | Avant | Maintenant |
|-----------|-------|------------|
| Formulaire "Créer offre" | `tokenAmount` + `pricePerToken` + `paymentMethods` | `tokenAmount` + `currency` uniquement (prix auto CoinGecko) |
| Liste des offres | Affichait fiatCurrency + paymentMethods | Affiche `tokenAmount`, `pricePerToken`, `totalCost` en USDT |
| Bouton "Acheter" | Redirigeait vers un flow multi-étapes | **1 clic = achat instantané** avec modale de confirmation |
| Page "Preuve de paiement" | Formulaire upload preuve | **SUPPRIMER** cette page |
| Page "Confirmation vendeur" | Vendeur confirmait manuellement | **SUPPRIMER** cette page |
| Page "Méthodes de paiement" | CRUD méthodes fiat | **SUPPRIMER** cette page |
| Statuts affichés | pending_payment, payment_sent, etc. | Principalement `completed` ou `disputed` |

### 6.3 — Nouvelle page Staking PXC (À CRÉER)

Créer une nouvelle section/page "Staking PXC" avec :

| Composant | Description |
|-----------|-------------|
| **Résumé en haut** | Cards : Total staké, Gains quotidiens, Rewards en attente, Valeur totale |
| **Formulaire de stake** | Input `amount` + bouton "Staker" (source : `airdropBalance`) |
| **Liste des positions** | Tableau avec : Montant, Taux, Rewards cumulés, Rewards en attente, Depuis (date), Actions |
| **Bouton "Claim"** | Par position — réclame les rewards sans toucher au principal |
| **Bouton "Unstake"** | Par position — modale avec avertissement pénalité si < 7 jours |
| **Info pénalité** | Afficher clairement "Pénalité de 10% si retrait avant 7 jours" |

### 6.4 — Nouveaux types de transactions

Le frontend doit reconnaître ces nouveaux `type` dans l'historique des transactions :

| Type | Icône suggérée | Description affichée |
|------|---------------|---------------------|
| `p2p_escrow_lock` | 🔒 | Tokens lockés en escrow |
| `p2p_escrow_release` | 🔓 | Tokens restitués (offre annulée) |
| `p2p_purchase` | 🛒 | Achat P2P (débit USDT) |
| `p2p_token_received` | ⬇️ | Tokens PXC reçus (achat) |
| `p2p_sale` | 💰 | Vente P2P (crédit USDT) |
| `p2p_dispute_resolution` | ⚖️ | Résolution de litige |
| `pxc_staking_deposit` | 📥 | Tokens stakés |
| `pxc_staking_withdrawal` | 📤 | Unstake (principal + rewards) |
| `pxc_staking_reward` | 🎁 | Récompense staking quotidienne |

---

## 7 — Exemples d'intégration frontend

### 7.1 — Afficher le prix live (composant réutilisable)

```javascript
// Appel au chargement de la page P2P ou du dashboard
async function fetchTokenPrice(currency = 'usd') {
  const res = await api.get(`/p2p/token-price?currency=${currency}`)
  return res.data // { symbol: "PXC", currency: "USD", price: 0.024, source: "coingecko" }
}

// Rafraîchir toutes les 60 secondes (le backend cache aussi 60s)
setInterval(() => fetchTokenPrice(), 60_000)
```

### 7.2 — Créer une offre P2P

```javascript
async function createOffer(tokenAmount) {
  const res = await api.post('/p2p/offers', {
    tokenAmount,        // ex: 500
    currency: 'usd',    // devise pour le prix
    notes: ''           // optionnel
  })
  // Le prix est automatiquement récupéré depuis CoinGecko côté serveur
  // res.data.offer.pricePerToken = prix au moment de la création
  // res.data.offer.totalCost = tokenAmount × pricePerToken
}
```

### 7.3 — Acheter une offre (1 clic)

```javascript
async function buyOffer(offerId) {
  // Modale de confirmation AVANT l'appel
  const confirmed = await showConfirmDialog(
    `Acheter ${offer.tokenAmount} PXC pour ${offer.totalCost} USDT ?`
  )
  if (!confirmed) return

  const res = await api.post(`/p2p/offers/${offerId}/take`)
  // res.data.trade.status === 'completed'
  // → Rafraîchir wallet.balance et wallet.airdropBalance
  await refreshWallet()
}
```

### 7.4 — Staker des PXC

```javascript
async function stakePXC(amount) {
  const res = await api.post('/pxc-staking/stake', { amount })
  // res.data.position.dailyEarnings = amount × 5%
  await refreshWallet() // airdropBalance a diminué
}
```

### 7.5 — Réclamer les rewards

```javascript
async function claimRewards(positionId) {
  const res = await api.post(`/pxc-staking/claim/${positionId}`)
  // res.data.rewardsClaimed = montant reçu
  await refreshWallet() // airdropBalance a augmenté
}
```

### 7.6 — Unstake

```javascript
async function unstake(positionId, daysSinceStart) {
  if (daysSinceStart < 7) {
    const confirmed = await showConfirmDialog(
      '⚠️ Unstake avant 7 jours : pénalité de 10% sur le principal. Continuer ?'
    )
    if (!confirmed) return
  }

  const res = await api.post(`/pxc-staking/unstake/${positionId}`)
  // res.data.totalReturned = principal + rewards - pénalité
  await refreshWallet()
}
```

---

## Résumé des routes API finales

### P2P

| Méthode | Route | Rôle |
|---------|-------|------|
| `GET` | `/p2p/token-price` | Prix PXC temps réel |
| `POST` | `/p2p/offers` | Créer une offre |
| `GET` | `/p2p/offers` | Lister les offres |
| `GET` | `/p2p/offers/my` | Mes offres |
| `GET` | `/p2p/offers/:offerId` | Détail offre |
| `POST` | `/p2p/offers/:offerId/take` | **Acheter (swap instantané)** |
| `POST` | `/p2p/offers/:offerId/cancel` | Annuler offre |
| `GET` | `/p2p/trades/my` | Mes trades |
| `GET` | `/p2p/trades/:tradeId` | Détail trade |
| `POST` | `/p2p/trades/:tradeId/dispute` | Litige |

### PXC Staking

| Méthode | Route | Rôle |
|---------|-------|------|
| `GET` | `/pxc-staking/summary` | Résumé staking |
| `GET` | `/pxc-staking/positions` | Mes positions |
| `POST` | `/pxc-staking/stake` | Staker des PXC |
| `POST` | `/pxc-staking/unstake/:id` | Unstake (principal + rewards) |
| `POST` | `/pxc-staking/claim/:id` | Réclamer rewards seuls |

### Admin P2P

| Méthode | Route | Rôle |
|---------|-------|------|
| `GET` | `/admin/api/p2p/trades` | Tous les trades |
| `GET` | `/admin/api/p2p/trades/:tradeId` | Détail trade |
| `POST` | `/admin/api/p2p/trades/:tradeId/resolve` | Résoudre litige |
