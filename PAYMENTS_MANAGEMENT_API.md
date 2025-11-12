## Payback & Commission Manager - Admin APIs

Scope: Endpoints powering the admin Payments tabs shown in the UI: Refunds, Jackpot, Commission. All endpoints require admin auth.

- Base path: `/api/admin` unless stated
- Auth: `requireAuth` + role `admin`
- Formats: JSON; timestamps ISO 8601

### Common Enums
- **serviceType**: `video_call` | `live_show` | `dedication`
- **transactionStatus**: `initiated` | `pending` | `completed` | `cancelled` | `refunded` | `failed`

---

## 1) Commission Manager
Hierarchy: country override → service default → global default.

### 1.1 Get commission configuration
- GET `/api/admin/commissions`
- Response
```json
{
  "globalDefault": 0.15,
  "serviceDefaults": { "videoCall": 0.16, "liveShow": 0.16, "dedication": 0.16 },
  "countries": [
    { "country":"United Kingdom","countryCode":"GB",
      "rates": { "videoCall":0.16, "liveShow":0.16, "dedication":0.16 }},
    { "country":"USA","countryCode":"US",
      "rates": { "videoCall":0.16, "liveShow":0.16, "dedication":0.16 }}
  ],
  "updatedBy": "<adminId>",
  "updatedAt": "2025-07-25T10:30:00.000Z"
}
```

### 1.2 Update global default commission
- PUT `/api/admin/commissions/global`
- Body
```json
{ "globalDefault": 0.15 }
```
- 0 ≤ value ≤ 1; 2 decimal precision suggested.

### 1.3 Update service default commissions
- PUT `/api/admin/commissions/services`
- Body
```json
{ "serviceDefaults": { "videoCall": 0.16, "liveShow": 0.16, "dedication": 0.16 } }
```

### 1.4 Add or update a country override
- POST `/api/admin/commissions/countries`
- Body
```json
{ "country":"United Kingdom", "countryCode":"GB",
  "rates": { "videoCall":0.16, "liveShow":0.16, "dedication":0.16 } }
```

### 1.5 Remove a country override
- DELETE `/api/admin/commissions/countries/:countryCode`
- Response: `{ "success": true }`

Validation for all Commission routes
- `countryCode`: ISO-2 or ISO-3 uppercase
- Rates in [0,1]; if percentage UI, divide by 100 server-side

---

## 2) Refunds (Payments tab: Refunds)
List/filter payments, show metrics, trigger refund.

### 2.1 Metrics cards
- GET `/api/admin/refunds/metrics`
- Query: `from`, `to` (ISO); `service` (optional); `type` (manual|auto optional)
- Response
```json
{
  "totalRefunded": { "count": 12000, "amount": 54678 },
  "pendingRefunds": { "count": 3, "amount": 2464 },
  "failedRefunds": { "count": 15, "amount": 12464 },
  "avgCommissionTimeSec": 760
}
```

### 2.2 List refunds and refundable transactions
- GET `/api/admin/refunds`
- Query
  - `q` (name or Baroni ID)
  - `status` in `refunded|pending|failed|completed`
  - `service` in serviceType
  - `from`/`to` ISO; `page` (1+), `limit` (1–100)
- Response (paginated)
```json
{
  "items": [
    {
      "transactionId": "T123",
      "service": "video_call",
      "status": "completed",
      "payer": { "id":"U1","name":"John","phone":"+..." },
      "receiver": { "id":"S1","name":"John Meyer","country":"USA" },
      "grossAmount": 4873,
      "commission": 324,
      "netAmount": 3483,
      "scheduledAt": "2025-07-25T10:30:00Z",
      "paymentRef": "PAY-2024-001",
      "notes": null
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 150
}
```

### 2.3 Trigger refund
- POST `/api/admin/refunds/:transactionId/trigger`
- Preconditions
  - Transaction exists
  - `status === completed` (admin reversal) OR timed-out/failed flow needing manual action
- Response
```json
{ "success": true, "message": "Transaction refunded successfully" }
```

Notes
- Uses `transactionService.refundTransaction` and existing cancellation/escrow refund logic where applicable.

---

## 3) Jackpot (Payments tab: Jackpot)
Totals, per-star jackpot, withdrawals approve/retry.

### 3.1 Overall metrics
- GET `/api/admin/jackpot/metrics`
- Query: `date=today` or `from`/`to`
- Response
```json
{
  "totalCurrentJackpot": 12000,
  "paidToday": { "count": 15, "amount": 8464 },
  "pending": { "count": 3, "amount": 2464 },
  "failed": { "count": 15, "amount": 12464 }
}
```

### 3.2 Star jackpot listing
- GET `/api/admin/jackpot/stars`
- Query: `q`, `status` (eligible|pending|failed), `page`, `limit`
- Response
```json
{
  "items": [
    {
      "starId": "S1",
      "name": "John Meyer",
      "country": "USA",
      "wallet": { "jackpot": 12000, "escrow": 340, "totalEarned": 54000, "totalWithdrawn": 42000 },
      "today": { "paid": 15, "amount": 8464, "failed": 1 },
      "lastWithdrawal": { "id": "W123", "status": "completed", "amount": 324 }
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 80
}
```

### 3.3 Create withdrawal (Approve)
- POST `/api/admin/jackpot/withdrawals`
- Body
```json
{ "starId": "<id>", "amount": 1234, "note": "optional" }
```
- Response: created and processed; uses `adminWallet.createWithdrawal` internally

### 3.4 List withdrawals
- GET `/api/admin/jackpot/withdrawals`
- Query: `status=pending|completed|failed`, `from`, `to`, `page`, `limit`

### 3.5 Retry failed withdrawal
- PATCH `/api/admin/jackpot/withdrawals/:id/retry`
- Re-attempt payout via `withdrawFromJackpot` if balance allows; updates status.

Optional moderation flow
- If you prefer two-step: add
  - PATCH `/api/admin/jackpot/withdrawals/:id/approve`
  - PATCH `/api/admin/jackpot/withdrawals/:id/reject`

---

## 4) Server-side helper contract

### 4.1 Commission helper
`utils/commissionHelper.js`
- `getEffectiveCommission({ serviceType, countryCode }): Promise<number>`
- `applyCommission(amount, rate): { commission, net }`

### 4.2 Amount attribution
- When creating star escrow/jackpot entries, store `{ commission, netAmount }` in `StarTransaction.metadata` for consistent admin reporting.

---

## 5) Validation & Security
- All routes: `requireAuth` + admin role check
- Pagination: `page>=1`, `limit 1..100`
- Date ranges: `from<=to`, max window guards if needed
- Commission rates: `[0,1]`, up to 2 decimals
- ISO country code validation

---

## 6) Mapping to existing code
- Refunds use: `services/transactionService.js` and `services/paymentCallbackService.js`
- Jackpot use: `services/starWalletService.js`, `controllers/adminWallet.js`
- Country toggles exist in `models/CountryServiceConfig.js`; commission overrides may be stored either here (`rates`) or in a dedicated `CommissionConfig` collection.

---

## 7) Implementation order
1) CommissionConfig model + routes (`/api/admin/commissions/*`)
2) Refunds controller/routes (`/api/admin/refunds/*`)
3) Jackpot metrics/list + withdrawal retry (`/api/admin/jackpot/*`)
4) Wire commission helper into earning flows as needed


