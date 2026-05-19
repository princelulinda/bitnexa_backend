# Requirements Document

## Introduction

This feature adds a peer-to-peer (P2P) USDT exchange to the platform, modeled after Binance P2P. Sellers post offers and their USDT is immediately locked in escrow. Buyers take offers and submit proof of external fiat payment. Sellers confirm receipt to release funds. A dispute system with admin resolution handles conflicts. KYC is required to sell. All fund movements are recorded in the existing transaction audit trail.

## Glossary

- **P2P_System**: The peer-to-peer exchange subsystem responsible for managing offers, trades, escrow, and disputes.
- **Offer**: A sell listing created by a Seller specifying the USDT amount, price, and accepted payment methods.
- **Trade**: An active transaction between a Buyer and a Seller initiated when a Buyer accepts an Offer.
- **Escrow**: The internal holding state where USDT is deducted from the Seller's wallet balance and held pending trade completion.
- **Seller**: A KYC-verified user who creates an Offer to sell USDT.
- **Buyer**: An authenticated user who accepts an Offer and submits proof of external fiat payment.
- **Payment_Proof**: An image URL or transaction reference string uploaded by the Buyer as evidence of external fiat payment.
- **Dispute**: A formal conflict raised by either party when a trade cannot be resolved between them.
- **Admin**: A platform administrator with authority to resolve Disputes and override trade outcomes.
- **Payment_Window**: The 30-minute period after a Buyer marks payment as sent, within which the Seller must confirm or a timeout occurs.
- **Wallet**: The existing user wallet model holding USDT balance.
- **Transaction**: The existing audit record model used to log all balance movements.

---

## Requirements

### Requirement 1: Offer Creation with Escrow Lock

**User Story:** As a Seller, I want to create a USDT sell offer so that Buyers can find and accept it, with my funds secured immediately.

#### Acceptance Criteria

1. WHEN a Seller submits a create-offer request, THE P2P_System SHALL verify the Seller's `kycStatus` is `verified` before proceeding.
2. IF the Seller's `kycStatus` is not `verified`, THEN THE P2P_System SHALL return a 403 error with the message "KYC verification required to create offers".
3. WHEN a Seller submits a create-offer request with a valid USDT amount and price, THE P2P_System SHALL deduct the specified USDT amount from the Seller's Wallet `balance` and record it as escrowed within a single database transaction.
4. IF the Seller's Wallet `balance` is less than the requested offer amount, THEN THE P2P_System SHALL return a 422 error with the message "Insufficient balance".
5. WHEN an Offer is created successfully, THE P2P_System SHALL set the Offer status to `open` and record a Transaction of type `p2p_escrow_lock` with status `completed` against the Seller's Wallet.
6. THE P2P_System SHALL require each Offer to include: USDT amount (minimum 1 USDT), price per USDT in fiat, fiat currency code, and at least one accepted payment method label.
7. IF the USDT amount is less than 1, THEN THE P2P_System SHALL return a 422 validation error.

---

### Requirement 2: Offer Listing and Discovery

**User Story:** As a Buyer, I want to browse open sell offers so that I can find a suitable trade.

#### Acceptance Criteria

1. WHEN a request is made to list offers, THE P2P_System SHALL return only Offers with status `open`.
2. THE P2P_System SHALL support filtering the offer list by fiat currency code.
3. THE P2P_System SHALL support filtering the offer list by payment method label.
4. THE P2P_System SHALL return offers sorted by creation date descending by default.
5. THE P2P_System SHALL paginate offer list results with a default page size of 20.
6. WHILE an Offer belongs to the authenticated Seller, THE P2P_System SHALL exclude that Offer from the Buyer's listing view to prevent self-trading.

---

### Requirement 3: Trade Initiation by Buyer

**User Story:** As a Buyer, I want to accept an open offer so that I can purchase USDT by paying the Seller externally.

#### Acceptance Criteria

1. WHEN a Buyer submits a take-offer request for an `open` Offer, THE P2P_System SHALL create a Trade record linking the Buyer and the Offer, and set the Trade status to `pending_payment`.
2. WHEN a Trade is created, THE P2P_System SHALL set the Offer status to `locked` so no other Buyer can accept it simultaneously.
3. IF the Offer status is not `open` at the time of the take-offer request, THEN THE P2P_System SHALL return a 409 error with the message "Offer is no longer available".
4. IF the Buyer is the same user as the Seller, THEN THE P2P_System SHALL return a 403 error with the message "Cannot trade with yourself".
5. WHEN a Trade is created, THE P2P_System SHALL record the trade amount, fiat currency, price per unit, and total fiat amount on the Trade record.

---

### Requirement 4: Buyer Payment Submission

**User Story:** As a Buyer, I want to submit proof of my fiat payment so that the Seller can verify and release the USDT.

#### Acceptance Criteria

1. WHEN a Buyer submits a payment-sent request for a Trade in `pending_payment` status, THE P2P_System SHALL update the Trade status to `payment_sent` and record the `paidAt` timestamp.
2. WHEN the Trade status is set to `payment_sent`, THE P2P_System SHALL start the Payment_Window countdown of 30 minutes from `paidAt`.
3. THE P2P_System SHALL require the Buyer to provide at least one Payment_Proof (image URL or transaction reference string) when marking payment as sent.
4. IF the Trade status is not `pending_payment` when the Buyer submits payment, THEN THE P2P_System SHALL return a 409 error with the message "Trade is not in a payable state".
5. IF the requesting user is not the trade's Buyer, THEN THE P2P_System SHALL return a 403 error.

---

### Requirement 5: Seller Confirmation and USDT Release

**User Story:** As a Seller, I want to confirm receipt of fiat payment so that the USDT is released to the Buyer.

#### Acceptance Criteria

1. WHEN a Seller confirms receipt on a Trade in `payment_sent` status, THE P2P_System SHALL add the escrowed USDT amount to the Buyer's Wallet `balance` within a single database transaction.
2. WHEN the USDT is released to the Buyer, THE P2P_System SHALL set the Trade status to `completed` and the Offer status to `completed`.
3. WHEN the USDT is released, THE P2P_System SHALL record a Transaction of type `p2p_release` with status `completed` against the Buyer's Wallet.
4. WHEN the USDT is released, THE P2P_System SHALL record a Transaction of type `p2p_sale` with status `completed` against the Seller's Wallet for audit purposes.
5. IF the Trade status is not `payment_sent` when the Seller confirms, THEN THE P2P_System SHALL return a 409 error with the message "Trade is not awaiting confirmation".
6. IF the confirming user is not the trade's Seller, THEN THE P2P_System SHALL return a 403 error.

---

### Requirement 6: Seller Cancellation

**User Story:** As a Seller, I want to cancel my offer before it is accepted so that I can recover my escrowed USDT.

#### Acceptance Criteria

1. WHEN a Seller cancels an Offer in `open` status, THE P2P_System SHALL return the escrowed USDT amount to the Seller's Wallet `balance` within a single database transaction.
2. WHEN an Offer is cancelled, THE P2P_System SHALL set the Offer status to `cancelled` and record a Transaction of type `p2p_escrow_release` with status `completed` against the Seller's Wallet.
3. IF the Offer status is not `open` at the time of cancellation, THEN THE P2P_System SHALL return a 409 error with the message "Offer cannot be cancelled in its current state".
4. IF the cancelling user is not the Offer's Seller, THEN THE P2P_System SHALL return a 403 error.

---

### Requirement 7: Payment Timeout Auto-Cancellation

**User Story:** As a Seller, I want unpaid trades to expire automatically so that my funds are not locked indefinitely.

#### Acceptance Criteria

1. WHEN the Payment_Window of 30 minutes elapses after `paidAt` without Seller confirmation, THE P2P_System SHALL set the Trade status to `timed_out`.
2. WHEN a Trade is set to `timed_out`, THE P2P_System SHALL return the escrowed USDT to the Seller's Wallet `balance` and set the Offer status back to `open`.
3. WHEN a Trade times out, THE P2P_System SHALL record a Transaction of type `p2p_escrow_release` with status `completed` against the Seller's Wallet.
4. THE P2P_System SHALL process timeout checks via a scheduled background job that runs at least every 5 minutes.

---

### Requirement 8: Dispute System

**User Story:** As a Buyer or Seller, I want to raise a dispute when a trade cannot be resolved between us so that an Admin can intervene.

#### Acceptance Criteria

1. WHEN a party raises a dispute on a Trade in `payment_sent` status, THE P2P_System SHALL set the Trade status to `disputed` and record the disputing user's ID and reason.
2. IF the Trade status is not `payment_sent` when a dispute is raised, THEN THE P2P_System SHALL return a 409 error with the message "Disputes can only be raised on trades awaiting confirmation".
3. IF the requesting user is neither the Buyer nor the Seller of the Trade, THEN THE P2P_System SHALL return a 403 error.
4. WHEN an Admin resolves a dispute in favor of the Buyer, THE P2P_System SHALL release the escrowed USDT to the Buyer's Wallet and set the Trade status to `resolved_buyer`.
5. WHEN an Admin resolves a dispute in favor of the Seller, THE P2P_System SHALL return the escrowed USDT to the Seller's Wallet and set the Trade status to `resolved_seller`.
6. WHEN a dispute is resolved, THE P2P_System SHALL record the resolving Admin's ID, resolution direction, and resolution notes on the Trade record.
7. WHEN a dispute is resolved, THE P2P_System SHALL record a Transaction of type `p2p_dispute_resolution` for the wallet movement.

---

### Requirement 9: Trade and Offer History

**User Story:** As a user, I want to view my P2P trade and offer history so that I can track my activity.

#### Acceptance Criteria

1. WHEN an authenticated user requests their offer history, THE P2P_System SHALL return all Offers where the user is the Seller, paginated with a default page size of 20.
2. WHEN an authenticated user requests their trade history, THE P2P_System SHALL return all Trades where the user is either the Buyer or the Seller, paginated with a default page size of 20.
3. THE P2P_System SHALL include Trade status, amounts, counterparty identifier (masked email), and timestamps in the trade history response.

---

### Requirement 10: Admin Trade Overview

**User Story:** As an Admin, I want to view all trades and disputes so that I can monitor the P2P marketplace and resolve conflicts.

#### Acceptance Criteria

1. WHEN an Admin requests the trade list, THE P2P_System SHALL return all Trades across all users with pagination.
2. THE P2P_System SHALL support filtering the admin trade list by status (e.g., `disputed`, `completed`, `timed_out`).
3. WHEN an Admin requests a single Trade, THE P2P_System SHALL return full Trade details including Offer data, Buyer identity, Seller identity, Payment_Proof records, and dispute information.
4. THE P2P_System SHALL expose admin dispute resolution as a dedicated endpoint requiring an explicit resolution direction (`buyer` or `seller`) and resolution notes.

---

### Requirement 11: Transaction Audit Trail

**User Story:** As a platform operator, I want every fund movement in P2P to be recorded in the existing Transaction log so that I have a complete audit trail.

#### Acceptance Criteria

1. THE P2P_System SHALL record a Transaction entry for every balance change caused by a P2P operation (escrow lock, escrow release, USDT release to buyer, dispute resolution).
2. WHEN a Transaction is recorded for a P2P operation, THE P2P_System SHALL include the Trade ID or Offer ID in the transaction `description` field for traceability.
3. THE P2P_System SHALL never modify a Wallet balance outside of a database transaction that also creates the corresponding Transaction record.
4. FOR ALL completed Trades, the sum of `p2p_escrow_lock` transaction amounts SHALL equal the sum of `p2p_release` transaction amounts for that Trade (conservation of funds property).
