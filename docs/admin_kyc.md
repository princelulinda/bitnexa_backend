# Documentation Admin KYC

Cette documentation décrit les endpoints fournis par le contrôleur `AdminKycsController` (fichier source : app/controllers/admin_kycs_controller.ts).

## Résumé des endpoints

- GET /admin/kycs
  - Description : Récupère toutes les soumissions KYC avec `status = 'pending'`, triées par `createdAt` asc.
  - Paramètres : aucun
  - Réponse (200) : tableau de `KycSubmission` avec relation `user` (sélection : `id`, `fullName`, `email`, `kycStatus`).
  - Exemple de réponse :

```json
[
  {
    "id": 123,
    "userId": 45,
    "status": "pending",
    "createdAt": "2025-12-10T08:12:00.000Z",
    "updatedAt": "2025-12-10T08:12:00.000Z",
    "user": {
      "id": 45,
      "fullName": "Alice Dupont",
      "email": "alice@example.com",
      "kycStatus": "pending"
    }
  }
]
```

---

- GET /admin/kycs/:id
  - Description : Récupère une soumission KYC par `id` et charge la relation `user`.
  - Paramètres : `id` (path)
  - Réponse (200) : objet `KycSubmission` complet avec `user` chargé.
  - Erreurs :
    - 404 si la soumission n'existe pas (gérée par `findOrFail`).
  - Exemple de réponse :

```json
{
  "id": 123,
  "userId": 45,
  "status": "pending",
  "createdAt": "2025-12-10T08:12:00.000Z",
  "updatedAt": "2025-12-10T08:12:00.000Z",
  "rejectionReason": null,
  "reviewedAt": null,
  "user": {
    "id": 45,
    "fullName": "Alice Dupont",
    "email": "alice@example.com",
    "kycStatus": "pending"
  }
}
```

---

- POST /admin/kycs/:id/approve  (selon routing, peut être `PUT`)
  - Description : Approuve la soumission KYC.
  - Paramètres : `id` (path)
  - Body : aucun
  - Comportement :
    - Vérifie que `submission.status === 'pending'` sinon renvoie 400.
    - Met `submission.status = 'approved'`, `submission.reviewedAt = DateTime.now()` et sauvegarde.
    - Met `user.kycStatus = 'verified'` et sauvegarde.
    - TODO dans le code : envoi d'email non implémenté.
  - Réponse (200) :

```json
{ "message": "KYC approuvé avec succès." }
```

  - Erreurs :
    - 400 si la soumission a déjà été traitée : { "message": "Cette demande a déjà été traitée." }
    - 404 si la soumission ou l'utilisateur introuvable.

---

- POST /admin/kycs/:id/reject  (selon routing, peut être `PUT`)
  - Description : Rejette la soumission KYC et enregistre une raison.
  - Paramètres : `id` (path)
  - Body (JSON) :

```json
{ "reason": "Pièce d'identité illisible" }
```

  - Comportement :
    - Vérifie `submission.status === 'pending'`; sinon 400.
    - Vérifie que `reason` est présent; sinon 400.
    - Met `submission.status = 'rejected'`, `submission.rejectionReason = reason`, `submission.reviewedAt = DateTime.now()` et sauvegarde.
    - Met `user.kycStatus = 'rejected'` et sauvegarde.
    - TODO dans le code : envoi d'email non implémenté.
  - Réponse (200) :

```json
{ "message": "KYC rejeté." }
```

  - Erreurs :
    - 400 si déjà traité : { "message": "Cette demande a déjà été traitée." }
    - 400 si `reason` manquant : { "message": "Une raison de rejet est requise." }
    - 404 si la soumission ou l'utilisateur introuvable.

---

## Champs attendus (observés dans le contrôleur)
- `KycSubmission` : `id`, `userId`, `status`, `rejectionReason`, `reviewedAt`, `createdAt`, `updatedAt`.
- `User` : `id`, `fullName`, `email`, `kycStatus`.
- Statuts : `'pending'`, `'approved'`, `'rejected'` pour `KycSubmission`; `user.kycStatus` devient `'verified'` ou `'rejected'`.

## Remarques
- Le contrôleur utilise `DateTime.now()` (Luxon) pour `reviewedAt`.
- Les envois d'email sont indiqués par des TODO et ne sont pas implémentés ici.
- Les URLs exactes et les méthodes HTTP dépendent du fichier de routes (`start/routes.ts`). Il est recommandé de vérifier ce fichier pour confirmer les verbes REST réels (GET/POST/PUT).

---

Si vous voulez, je peux :
- Vérifier `start/routes.ts` pour confirmer les chemins et méthodes HTTP exacts.
- Ajouter des exemples de payloads plus détaillés ou un fichier `README.md` dans un autre format.
- Implémenter l'envoi d'email de notification.
