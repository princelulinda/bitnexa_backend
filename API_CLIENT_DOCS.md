# Documentation API Client Bitnexa

Cette documentation détaille les routes accessibles aux utilisateurs finaux, les paramètres requis, et les réponses attendues.

## 🌍 Base URL & Authentification
*   **Base URL** : `http://localhost:3333` (ou votre domaine en production)
*   **Authentification** : La plupart des routes nécessitent un token d'authentification.
    *   Header : `Authorization: Bearer <votre_token>`

---

## 🔐 Authentification (`/auth`)

### 1. Inscription
Crée un nouveau compte utilisateur.
*   **Endpoint** : `POST /register`
*   **Body (JSON)** :
    ```json
    {
      "fullName": "Jean Dupont",
      "email": "jean@example.com",
      "password": "password123",
      "referralCode": "OPTIONAL_CODE"
    }
    ```
*   **Réponse (201 Created)** :
    ```json
    {
      "message": "User registered successfully...",
      "user": { ... }
    }
    ```

### 2. Connexion
Authentifie l'utilisateur et retourne un token.
*   **Endpoint** : `POST /login`
*   **Body (JSON)** :
    ```json
    {
      "email": "jean@example.com",
      "password": "password123"
    }
    ```
*   **Réponse (200 OK)** :
    ```json
    {
      "message": "Connecté avec succès",
      "token": { "type": "bearer", "token": "..." },
      "user": { ... }
    }
    ```

### 3. Vérifier l'email
Valide le code reçu par email après l'inscription.
*   **Endpoint** : `POST /verify-email`
*   **Body (JSON)** :
    ```json
    {
      "email": "jean@example.com",
      "code": "123456"
    }
    ```

### 4. Renvoyer l'email de vérification
*   **Endpoint** : `POST /resend-verification-email`
*   **Body (JSON)** : `{ "email": "jean@example.com" }`

### 5. Profil Utilisateur (Me)
Récupère les informations complètes de l'utilisateur connecté (solde, abonnements, etc.).
*   **Endpoint** : `GET /auth/me`
*   **Header** : `Authorization: Bearer <token>`
*   **Réponse** : Retourne l'objet `user` avec `wallet`, `referrer`, `activeSubscription`.

### 6. Mettre à jour le profil
*   **Endpoint** : `PUT /auth/me`
*   **Header** : `Authorization: Bearer <token>`
*   **Body (JSON)** :
    ```json
    {back
      "fullName": "Jean Pierre", // Optionnel
      "email": "new@example.com", // Optionnel
      "password": "newpassword", // Optionnel
      "password_confirmation": "newpassword" // Requis si password présent
    }
    ```

### 7. Informations de Parrainage
*   **Endpoint** : `GET /auth/referrals`
*   **Header** : `Authorization: Bearer <token>`
*   **Réponse** : Liste des filleuls et statistiques des gains.

### 8. Déconnexion
*   **Endpoint** : `POST /auth/logout`
*   **Header** : `Authorization: Bearer <token>`

---

## 💰 Portefeuille (`/wallet`)

Toutes ces routes nécessitent l'authentification.

### 1. Détails du Portefeuille
*   **Endpoint** : `GET /wallet`
*   **Réponse** : Solde actuel, investissements, gains, etc.

### 2. Générer une adresse de dépôt
Génère ou récupère une adresse pour déposer des fonds.
*   **Endpoint** : `POST /wallet/deposit/address`
*   **Body (JSON)** :
    ```json
    {
      "currency": "USDT",
      "network": "TRC20" // ou ERC20, BEP20
    }
    ```
*   **Réponse** : `{ "address": "T...", "expiresAt": "..." }`

### 3. Vérifier le statut des dépôts
Déclenche une vérification en arrière-plan des dépôts blockchain.
*   **Endpoint** : `GET /wallet/deposit-status`

### 4. Demander un retrait
Initie une demande de retrait (frais de 5%).
*   **Endpoint** : `POST /wallet/withdraw/request`
*   **Body (JSON)** :
    ```json
    {
      "amount": 100,
      "cryptoAddress": "TTargetAddress...",
      "network": "TRC20"
    }
    ```

### 5. Investir des fonds
Transfère des fonds du solde principal vers le solde d'investissement.
*   **Endpoint** : `POST /wallet/invest`
*   **Body (JSON)** : `{ "amount": 500 }`

### 6. Réclamer les gains
Transfère les gains vers le solde principal.
*   **Endpoint** : `POST /wallet/claim-gains`
*   **Body (JSON)** : `{ "amount": 50 }`

### 7. Historique des transactions
*   **Endpoint** : `GET /wallet/transactions`

---

## 📅 Abonnements (`/subscriptions`)

### 1. Souscrire à un plan
Nécessite des fonds suffisants dans le solde principal.
*   **Endpoint** : `POST /subscriptions`
*   **Header** : `Authorization: Bearer <token>`
*   **Body (JSON)** : `{ "amount": 1000 }`

### 2. Mettre à niveau (Upgrade)
*   **Endpoint** : `POST /subscriptions/upgrade`
*   **Header** : `Authorization: Bearer <token>`
*   **Body (JSON)** : `{ "targetPlanId": "uuid-du-nouveau-plan" }`

---

## 📈 Signaux de Trading (`/signals`)

### 1. Signal Actuel
Récupère le signal actif pour le plan de l'utilisateur.
*   **Endpoint** : `GET /signals/current`
*   **Header** : `Authorization: Bearer <token>`

### 2. Utiliser un Signal
Valide un code de signal pour créditer les gains quotidiens.
*   **Endpoint** : `POST /signals/use`
*   **Header** : `Authorization: Bearer <token>`
*   **Body (JSON)** : `{ "code": "ABC123" }`

---


## 💬 Chat de Groupe (`/group-chat`)

### 1. Lister les messages
*   **Endpoint** : `GET /group-chat/messages`
*   **Header** : `Authorization: Bearer <token>`

### 2. Envoyer un message
*   **Endpoint** : `POST /group-chat/messages`
*   **Header** : `Authorization: Bearer <token>`
*   **Body (JSON)** :
    ```json
    {
      "content": "Bonjour tout le monde !",
      "parentId": "uuid-message-parent" // Optionnel (pour répondre)
    }
    ```

---

## 📒 Portefeuilles Externes (`/external-wallet-addresses`)

Gère les adresses sauvegardées par l'utilisateur (carnet d'adresses).
*   **Header** : `Authorization: Bearer <token>`

*   **Lister** : `GET /external-wallet-addresses`
*   **Créer** : `POST /external-wallet-addresses`
    *   Body : `{ "address": "...", "currency": "USDT", "network": "TRC20", "name": "Mon Wallet Binance" }`
*   **Voir** : `GET /external-wallet-addresses/:id`
*   **Modifier** : `PUT /external-wallet-addresses/:id`
*   **Supprimer** : `DELETE /external-wallet-addresses/:id`

---

## 📢 Annonces (`/announcements`)

*   **Lister les annonces** : `GET /announcements`
    *   Accessible publiquement (pas de token requis pour la lecture).
*   **Voir une annonce** : `GET /announcements/:id`
