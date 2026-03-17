# AdminFinancialPage — Requirement Document

> สำหรับ developer เพื่อพัฒนาหน้า "การเงิน" ของแอดมินให้ใช้งานจริงในโปรดักชัน
> วันที่: 2026-03-16
> Status: Draft

---

## 1. สรุปสถานะปัจจุบัน (Verified from Code)

### สิ่งที่มีอยู่แล้ว ✅

| ส่วน | สถานะ | ไฟล์หลัก |
|------|--------|----------|
| Withdrawal request flow (user ขอถอน) | ✅ ทำงานได้ | `walletService.js` → `initiateWithdrawal()` |
| Withdrawal status machine | ✅ 6 สถานะ: queued → review → approved → paid / rejected / cancelled | DB ENUM `withdrawal_status` |
| Admin endpoints: review / approve / reject / mark-paid | ✅ ทำงานได้ | `walletRoutes.js` (admin section) |
| Admin list withdrawals + filter by status | ✅ ทำงานได้ | `adminGetWithdrawals()` |
| Platform stats endpoint | ✅ basic | `getPlatformStats()` |
| Double-entry ledger (immutable) | ✅ | `ledger_transactions` table + DB trigger |
| Wallet system (5 types) | ✅ hirer/caregiver/escrow/platform/platform_replacement | `wallets` table |
| Bank account management | ✅ | `bank_accounts` table |
| Frontend withdrawal list + action buttons | ✅ basic | `AdminFinancialPage.tsx` |
| `payout_proof_storage_key` column | ✅ มีใน schema แต่ยังไม่ใช้ | `withdrawal_requests` table |
| `provider_name` / `provider_request_id` columns | ✅ มีใน schema สำหรับ future automation | `withdrawal_requests` table |

### สิ่งที่ยังขาด ❌

| ส่วน | สถานะ | ผลกระทบ |
|------|--------|---------|
| **Dashboard summary** (ยอดเงินรวมระบบ) | ❌ ไม่มี UI | แอดมินไม่เห็นภาพรวมการเงิน |
| **Upload สลิปโอนเงิน** | ❌ column มีแต่ไม่มี upload logic | ไม่มีหลักฐานการโอน |
| **ข้อมูลผู้ขอถอนแบบละเอียด** | ❌ เห็นแค่ email + bank last4 | ไม่พอสำหรับการโอนเงินจริง |
| **ประวัติ transaction ของระบบ** | ❌ ไม่มี UI สำหรับ admin | ตรวจสอบย้อนหลังไม่ได้ |
| **Audit log สำหรับ financial actions** | ❌ ไม่บันทึก audit_events | ไม่มี trail ว่าใครทำอะไร |
| **Ledger integrity check UI** | ❌ มี function แต่ไม่มี UI | ตรวจสอบความถูกต้องไม่ได้ |
| **Export / รายงาน** | ❌ | ทำบัญชีไม่ได้ |
| **Search/filter withdrawal by date/user** | ❌ filter แค่ status | หาคำขอเฉพาะเจาะจงไม่ได้ |
| **Confirmation dialog** ก่อน approve/reject/paid | ❌ | เสี่ยง misclick |
| **Idempotency guard** สำหรับ mark-paid | ❌ ไม่มี idempotency_key | เสี่ยงโอนซ้ำ |
| **Notification ถึง user** หลังสถานะเปลี่ยน | ❌ | user ไม่รู้ว่าเงินถูกโอนแล้ว |
| **Refund / adjustment records** | ❌ | ไม่มี flow ปรับยอด |

---

## 2. การแบ่งหมวดหมู่เงินในระบบ

ข้อมูลทั้งหมดคำนวณได้จาก `wallets` + `ledger_transactions` ที่มีอยู่แล้ว:

| หมวด | คำอธิบาย | แหล่งข้อมูล |
|------|----------|-------------|
| **เงินรวมในระบบ** | SUM(available_balance + held_balance) ทุก wallet | `wallets` |
| **เงินลูกค้าจ่าย (Top-up)** | SUM(amount) WHERE type='credit' AND reference_type='topup' | `ledger_transactions` |
| **เงินที่ต้องจ่าย caregiver** | SUM(available_balance) ของ wallet_type='caregiver' ทุกคน | `wallets` |
| **เงินที่ถอนได้** | SUM(available_balance) ของ wallet_type='caregiver' (ที่ trust ≥ L2) | `wallets` + `users` |
| **เงินค่าประกัน (Escrow)** | SUM(held_balance) ของ wallet_type='escrow' | `wallets` |
| **รายได้ platform** | available_balance ของ wallet_type='platform' | `wallets` |
| **ค่านายหน้า (Platform fee)** | SUM(amount) WHERE reference_type='fee' AND type='debit' | `ledger_transactions` |
| **เงินรอโอน** | SUM(amount) WHERE status IN ('queued','review','approved') | `withdrawal_requests` |
| **เงินที่โอนแล้ว** | SUM(amount) WHERE status='paid' | `withdrawal_requests` |
| **เงินคืน / ปรับยอด** | SUM(amount) WHERE type='reversal' | `ledger_transactions` |

### ⚠️ ข้อควรระวัง
- ยอดเงินเก็บเป็น **BIGINT (สตางค์/satoshi)** → แสดง UI ต้องหาร 100 หรือแปลงให้ถูก
  - **Update**: จากโค้ดจริง ยอดเก็บเป็น **บาท (integer)** ไม่ได้ใช้สตางค์ — ต้องยืนยันจาก seed data ว่าหน่วยจริงคืออะไร
- `held_balance` ไม่ใช่ "เงินที่ถอนได้" — เป็นเงินที่ถูก lock อยู่ (escrow/withdrawal pending)
- Platform wallet อาจยังไม่มีถ้ายังไม่เคยมี completed job → ต้อง auto-create

---

## 3. Withdrawal Flow (การทำงานจริง)

### Status Machine (verified from code)

```
queued ──► review ──► approved ──► paid ✅
  │           │           │
  │           │           ▼
  │           │        rejected ❌
  │           ▼
  │        rejected ❌
  ▼
rejected ❌ / cancelled (by user)
```

### Flow ละเอียด

```
1. Caregiver ขอถอน
   ├── POST /api/wallet/withdraw
   ├── Validation:
   │   ├── role = caregiver
   │   ├── trust_level ≥ L2
   │   ├── amount ≥ 500 THB
   │   ├── bank_account verified + name match (profile หรือ KYC ≥ 90%)
   │   └── available_balance ≥ amount
   ├── Atomic:
   │   ├── wallet: available_balance -= amount, held_balance += amount
   │   ├── INSERT withdrawal_requests (status='queued')
   │   └── INSERT ledger_transactions (type='hold', reference_type='withdrawal')
   └── Response: withdrawal_id, status='queued'

2. Admin รับเรื่อง (Review)
   ├── POST /api/wallet/admin/withdrawals/:id/review
   ├── Guard: status must be 'queued'
   ├── SET status='review', reviewed_by=adminId, reviewed_at=NOW()
   └── *** ยังขาด: ตรวจข้อมูลผู้ขอ, bank account detail ***

3. Admin อนุมัติ (Approve)
   ├── POST /api/wallet/admin/withdrawals/:id/approve
   ├── Guard: status must be 'review'
   ├── SET status='approved', approved_by=adminId, approved_at=NOW()
   └── *** ยังขาด: confirmation dialog, double-check amount ***

4. Admin โอนเงินจริง + Mark Paid
   ├── Admin ทำ bank transfer ข้างนอกระบบ (manual)
   ├── POST /api/wallet/admin/withdrawals/:id/mark-paid
   ├── Body: { payout_reference }
   ├── Guard: status must be 'approved'
   ├── Atomic:
   │   ├── wallet: held_balance -= amount (เงินออกจากระบบจริง)
   │   └── INSERT ledger_transactions (type='debit', reference_type='withdrawal', to_wallet_id=NULL)
   └── SET status='paid', paid_by=adminId, paid_at=NOW(), payout_reference
       *** ยังขาด: upload สลิป (payout_proof_storage_key), notification ถึง user ***

5. Admin ปฏิเสธ (Reject) — ได้ทุกสถานะก่อน paid
   ├── POST /api/wallet/admin/withdrawals/:id/reject
   ├── Guard: status IN ('queued','review','approved')
   ├── Atomic:
   │   ├── wallet: held_balance -= amount, available_balance += amount (คืนเงิน)
   │   └── INSERT ledger_transactions (type='reversal', reference_type='withdrawal')
   └── SET status='rejected', rejected_by, rejection_reason
       *** ยังขาด: notification ถึง user ***

6. User ยกเลิกเอง (Cancel)
   ├── POST /api/wallet/withdrawals/:id/cancel
   ├── Guard: status must be 'queued' (เท่านั้น)
   └── คืนเงินเหมือน reject
```

### ⚠️ จุดเสี่ยงที่ต้องแก้

1. **Mark-paid ไม่มี idempotency** — ถ้า admin กดซ้ำ จะ deduct held_balance ซ้ำ (แต่ status guard ป้องกันได้ระดับหนึ่ง)
2. **ไม่มี upload สลิป** — `payout_proof_storage_key` มีใน schema แต่ไม่มี endpoint/UI
3. **ไม่มี notification** — user ไม่รู้ว่าเงินโอนแล้ว
4. **ไม่มี audit log** — ไม่บันทึกว่า admin คนไหนทำอะไรเมื่อไหร่ (มีแค่ reviewed_by/approved_by/paid_by)

---

## 4. ข้อมูลที่แอดมินต้องเห็นก่อนโอนเงิน

### ข้อมูลผู้ขอถอน (จำเป็น)

| ข้อมูล | แหล่ง | มีใน API ปัจจุบัน? |
|--------|-------|-------------------|
| ชื่อจริง-นามสกุล | `caregiver_profiles.full_name` | ❌ ไม่ส่ง |
| Display name | `caregiver_profiles.display_name` | ❌ ไม่ส่ง |
| Role | `users.role` | ✅ `user_role` |
| Email | `users.email` | ✅ `user_email` |
| Phone | `users.phone_number` | ❌ ไม่ส่ง |
| Trust level | `users.trust_level` | ❌ ไม่ส่ง |
| KYC status | `user_kyc_info.status` | ❌ ไม่ส่ง |
| ธนาคาร | `banks.full_name_th` | ✅ `bank_name` |
| เลขบัญชี (last 4) | `bank_accounts.account_number_last4` | ✅ |
| เลขบัญชี (เต็ม) | `bank_accounts.account_number_encrypted` | ❌ ต้อง decrypt |
| ชื่อบัญชี | `bank_accounts.account_name` | ✅ |
| บัญชี verified? | `bank_accounts.is_verified` | ❌ ไม่ส่ง |
| ยอดคงเหลือ wallet | `wallets.available_balance` | ❌ ไม่ส่ง |
| ยอด held | `wallets.held_balance` | ❌ ไม่ส่ง |
| สถานะ ban | `users.ban_withdraw` | ❌ ไม่ส่ง |
| ประวัติถอนย้อนหลัง | `withdrawal_requests` WHERE user_id | ❌ ไม่มี endpoint |

### Action: ต้องเพิ่ม JOIN ใน `getAllWithdrawals()` หรือสร้าง endpoint ใหม่ `GET /api/wallet/admin/withdrawals/:id/detail`

---

## 5. UI Design — แบ่งส่วนหน้า Admin Financial

### Tab 1: Dashboard (ภาพรวมการเงิน)

```
┌─────────────────────────────────────────────────────────────┐
│  📊 ภาพรวมการเงิน                                           │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│ เงินรวม  │ Escrow   │ Platform │ รอโอน    │ โอนแล้ว          │
│ ฿xxx,xxx │ ฿xx,xxx  │ ฿xx,xxx  │ ฿x,xxx   │ ฿xx,xxx         │
│ (x wallets)│        │ (revenue)│ (x รายการ)│ (เดือนนี้)       │
└──────────┴──────────┴──────────┴──────────┴─────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  📈 สรุปรายเดือน                                             │
├─────────────────────────────────────────────────────────────┤
│ Top-up เข้าระบบ:     ฿xxx,xxx  (xx รายการ)                   │
│ Platform fee:        ฿xx,xxx   (xx งาน)                     │
│ ถอนออกจากระบบ:       ฿xx,xxx   (xx รายการ)                   │
│ คืนเงิน/ปรับยอด:    ฿x,xxx    (x รายการ)                    │
├─────────────────────────────────────────────────────────────┤
│ Ledger Integrity:    ✅ Valid (difference: 0)                │
└─────────────────────────────────────────────────────────────┘
```

**Data source**: `GET /api/wallet/admin/stats` (ต้องเพิ่ม monthly breakdown)

### Tab 2: คำขอถอนเงิน (Withdrawal Requests) — *มีอยู่แล้ว ต้องปรับปรุง*

```
┌─────────────────────────────────────────────────────────────┐
│  💰 คำขอถอนเงิน                              [ค้นหา] [Export]│
├─────────────────────────────────────────────────────────────┤
│ Filter: [สถานะ ▼] [วันที่เริ่ม] [วันที่สิ้นสุด] [ค้นหา user]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌─── รายการ #1 ────────────────────────────────────────────┐│
│ │ สถานะ: 🟡 queued          จำนวน: ฿5,000                  ││
│ │                                                           ││
│ │ 👤 ผู้ขอ: นายสมชาย ใจดี (caregiver)                        ││
│ │    Email: somchai@gmail.com | Tel: 08x-xxx-xxxx           ││
│ │    Trust: L2 | KYC: approved                              ││
│ │                                                           ││
│ │ 🏦 ธนาคาร: กสิกรไทย (KBANK)                               ││
│ │    เลขบัญชี: xxx-x-xx123-x | ชื่อบัญชี: นายสมชาย ใจดี      ││
│ │    Verified: ✅                                            ││
│ │                                                           ││
│ │ 💰 Wallet: คงเหลือ ฿12,000 | Held: ฿5,000                ││
│ │    ถอนครั้งล่าสุด: 2026-03-10 (฿3,000 → paid)             ││
│ │                                                           ││
│ │ 📅 สร้าง: 16/03/2026 14:30                                ││
│ │                                                           ││
│ │ [รับเรื่อง]  [ปฏิเสธ (เหตุผล: ______)]                     ││
│ └───────────────────────────────────────────────────────────┘│
│                                                              │
│ ┌─── รายการ #2 (approved → รอโอน) ─────────────────────────┐│
│ │ สถานะ: 🟢 approved          จำนวน: ฿3,000                ││
│ │ ...                                                       ││
│ │ Payout reference: [________________]                      ││
│ │ 📎 แนบสลิป: [อัปโหลดไฟล์]                                  ││
│ │                                                           ││
│ │ [⚠️ ยืนยันว่าโอนแล้ว]  [ปฏิเสธ]                            ││
│ └───────────────────────────────────────────────────────────┘│
│                                                              │
│ [◀ ก่อนหน้า] หน้า 1/5 [ถัดไป ▶]                               │
└─────────────────────────────────────────────────────────────┘
```

### Tab 3: ประวัติ Transaction (Ledger)

```
┌─────────────────────────────────────────────────────────────┐
│  📋 ประวัติ Transaction                          [Export CSV]│
├─────────────────────────────────────────────────────────────┤
│ Filter: [ประเภท ▼] [วันที่] [ค้นหา reference]                │
├──────┬───────┬─────────┬───────────┬──────────┬────────────┤
│ วันที่│ ประเภท │ จำนวน    │ From→To   │ Reference│ Description│
├──────┼───────┼─────────┼───────────┼──────────┼────────────┤
│ 16/03│ credit│ +฿5,000 │ →Hirer#12 │ topup    │ Stripe..   │
│ 16/03│ hold  │ ฿3,000  │ Hirer→Escr│ job      │ Job hold   │
│ 15/03│ debit │ -฿2,000 │ CG#5→     │ withdraw │ Payout     │
└──────┴───────┴─────────┴───────────┴──────────┴────────────┘
```

**Data source**: ต้องสร้าง `GET /api/wallet/admin/transactions`

### Tab 4: หลักฐานการโอน (Transfer Proofs)

```
┌─────────────────────────────────────────────────────────────┐
│  🧾 หลักฐานการโอนเงิน                                       │
├─────────────────────────────────────────────────────────────┤
│ Filter: [วันที่] [ค้นหา]                                     │
├──────┬──────────┬─────────┬────────┬───────┬───────────────┤
│ วันที่│ ผู้รับเงิน │ จำนวน    │ ธนาคาร  │ Ref   │ สลิป          │
├──────┼──────────┼─────────┼────────┼───────┼───────────────┤
│ 16/03│ สมชาย    │ ฿5,000  │ KBANK  │ TXN123│ 📎 [ดูสลิป]    │
│ 15/03│ สมหญิง   │ ฿3,000  │ SCB    │ TXN456│ 📎 [ดูสลิป]    │
└──────┴──────────┴─────────┴────────┴───────┴───────────────┘
```

---

## 6. Database — Tables ที่ต้องมีเพิ่ม/แก้ไข

### Tables ที่มีอยู่แล้ว (ไม่ต้องสร้างใหม่)

| Table | หน้าที่ | สถานะ |
|-------|---------|-------|
| `wallets` | กระเป๋าเงิน (5 types) | ✅ ครบ |
| `ledger_transactions` | บันทึกทุก transaction (immutable) | ✅ ครบ |
| `withdrawal_requests` | คำขอถอนเงิน (6 สถานะ) | ✅ มี `payout_proof_storage_key` พร้อม |
| `bank_accounts` | บัญชีธนาคารผู้ใช้ | ✅ ครบ |
| `banks` | รายชื่อธนาคาร | ✅ ครบ |
| `topup_intents` | รายการเติมเงิน | ✅ ครบ |
| `audit_events` | Audit log | ✅ มีโครงสร้างแล้ว แต่ยังไม่บันทึก financial events |

### สิ่งที่ต้องเพิ่ม

#### 6.1 เพิ่ม columns ใน `withdrawal_requests` (optional)

```sql
-- ไม่จำเป็นต้องเพิ่ม column ใหม่ — schema ปัจจุบันครอบคลุมแล้ว:
-- payout_reference       ✅ มี (bank txn ref)
-- payout_proof_storage_key ✅ มี (สลิป image key)
-- provider_name          ✅ มี (สำหรับ future auto-payout)
-- provider_request_id    ✅ มี
-- reviewed_by/at         ✅ มี
-- approved_by/at         ✅ มี
-- paid_by/at             ✅ มี
-- rejected_by/at/reason  ✅ มี
```

#### 6.2 ใช้ `audit_events` สำหรับ financial audit

ใช้ table `audit_events` ที่มีอยู่แล้ว โดยเพิ่ม event_type ใหม่:

| event_type | action | details (JSONB) |
|-----------|--------|----------------|
| `withdrawal_reviewed` | `admin:review` | `{ withdrawal_id, amount, admin_id }` |
| `withdrawal_approved` | `admin:approve` | `{ withdrawal_id, amount, admin_id }` |
| `withdrawal_rejected` | `admin:reject` | `{ withdrawal_id, amount, admin_id, reason }` |
| `withdrawal_paid` | `admin:mark_paid` | `{ withdrawal_id, amount, admin_id, payout_reference, proof_key }` |
| `admin_add_funds` | `admin:add_funds` | `{ user_id, amount, reason }` |

#### 6.3 ไม่ต้องสร้าง table ใหม่

**สิ่งที่ไม่ต้องทำ** (เพราะ schema ปัจจุบันรองรับแล้ว):
- ❌ ไม่ต้องสร้าง `withdrawal_proofs` — ใช้ `payout_proof_storage_key` ใน `withdrawal_requests`
- ❌ ไม่ต้องสร้าง `refunds` — ใช้ `ledger_transactions` type='reversal'
- ❌ ไม่ต้องสร้าง `deposits` — ใช้ `topup_intents` + `ledger_transactions`
- ❌ ไม่ต้องสร้าง `payments` แยก — มี `payments` table อยู่แล้ว (แต่ใช้สำหรับ job payment display)

---

## 7. Backend APIs ที่ต้องมี

### APIs ที่มีอยู่แล้ว ✅

| Method | Endpoint | หน้าที่ |
|--------|----------|---------|
| GET | `/api/wallet/admin/stats` | Platform stats |
| GET | `/api/wallet/admin/withdrawals` | List all withdrawals |
| POST | `/api/wallet/admin/withdrawals/:id/review` | Review |
| POST | `/api/wallet/admin/withdrawals/:id/approve` | Approve |
| POST | `/api/wallet/admin/withdrawals/:id/reject` | Reject |
| POST | `/api/wallet/admin/withdrawals/:id/mark-paid` | Mark paid |
| POST | `/api/wallet/admin/add-funds` | Add funds (admin) |

### APIs ที่ต้องสร้างใหม่/ปรับปรุง

| Priority | Method | Endpoint | หน้าที่ |
|----------|--------|----------|---------|
| **P0** | GET | `/api/wallet/admin/withdrawals/:id` | ดูรายละเอียดคำขอถอน + ข้อมูลผู้ขอ + bank + wallet |
| **P0** | POST | `/api/wallet/admin/withdrawals/:id/upload-proof` | อัปโหลดสลิปโอนเงิน (multipart/form-data) |
| **P1** | GET | `/api/wallet/admin/stats/dashboard` | Dashboard summary (monthly breakdown, categories) |
| **P1** | GET | `/api/wallet/admin/transactions` | Ledger transactions list (filtered, paginated) |
| **P2** | GET | `/api/wallet/admin/withdrawals/export` | Export CSV |
| **P2** | GET | `/api/wallet/admin/ledger-integrity` | Ledger integrity check |
| **P2** | GET | `/api/wallet/admin/transactions/export` | Export ledger CSV |

### API ที่ต้องปรับปรุง

#### `GET /api/wallet/admin/withdrawals` — เพิ่ม query params + JOIN data

**ปัจจุบัน**: filter แค่ `status`, JOIN แค่ `users.email`, `banks.full_name_th`, `bank_accounts.account_number_last4`, `bank_accounts.account_name`

**ต้องเพิ่ม**:
```
Query params:
  - search (ค้นหาตาม email, phone, name)
  - date_from, date_to (ช่วงวันที่)
  - sort_by (created_at, amount, status)
  - sort_order (asc, desc)

Response เพิ่ม:
  - user_phone
  - user_full_name (จาก caregiver_profiles)
  - user_trust_level
  - user_kyc_status
  - bank_account_is_verified
  - wallet_available_balance
  - wallet_held_balance
  - total_previous_withdrawals (count)
  - total_previous_paid (sum amount ที่ status='paid')
```

#### `POST /api/wallet/admin/withdrawals/:id/mark-paid` — เพิ่ม proof upload + audit

**ปัจจุบัน**: รับแค่ `payout_reference` (text)

**ต้องเพิ่ม**:
```
Body:
  - payout_reference (required — ต้องบังคับ)
  - payout_proof_storage_key (optional — ถ้า upload แยก endpoint)

Side effects เพิ่ม:
  - INSERT audit_events
  - Send notification ถึง user (in_app + push)
  - idempotency_key check (ป้องกันกด mark-paid ซ้ำ)
```

---

## 8. Withdrawal Status ทั้งหมด

### withdrawal_status ENUM (มีอยู่แล้วใน DB)

| Status | คำอธิบาย | ใครเปลี่ยน | Action ถัดไป |
|--------|----------|-----------|-------------|
| `queued` | รอรับเรื่อง | System (auto) | Admin: review / reject / User: cancel |
| `review` | กำลังตรวจสอบ | Admin | Admin: approve / reject |
| `approved` | อนุมัติแล้ว รอโอนเงิน | Admin | Admin: mark-paid / reject |
| `paid` | โอนเงินแล้ว ✅ | Admin | Terminal state |
| `rejected` | ปฏิเสธ ❌ | Admin | Terminal state (เงินคืน wallet อัตโนมัติ) |
| `cancelled` | ยกเลิกโดย user | User | Terminal state (เงินคืน wallet อัตโนมัติ) |

### Payment Status ENUM (สำหรับ payments table — มีอยู่แล้ว)

```sql
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
```

---

## 9. Validation & Security

### 9.1 ป้องกันถอนเกินยอด ✅ (มีแล้ว)
- `available_balance >= amount` check ด้วย `FOR UPDATE` row lock
- `WHERE available_balance >= $1` ใน UPDATE query เป็น safety net เพิ่มเติม
- DB CHECK constraint: `available_balance >= 0`, `held_balance >= 0`

### 9.2 ป้องกันโอนซ้ำ ⚠️ (ต้องเพิ่ม)
- Status guard มีอยู่ (`status must be 'approved'` ก่อน mark-paid) — ป้องกันได้ระดับหนึ่ง
- **ต้องเพิ่ม**: idempotency_key สำหรับ mark-paid action
- **ต้องเพิ่ม**: confirmation dialog + loading state ที่ disable ปุ่มระหว่าง process

### 9.3 Audit trail ⚠️ (ต้องเพิ่ม)
- `reviewed_by`, `approved_by`, `paid_by`, `rejected_by` columns มีอยู่แล้ว ✅
- **ต้องเพิ่ม**: INSERT `audit_events` ทุกครั้งที่ admin ทำ action
- **ต้องเพิ่ม**: เก็บ IP address / user-agent ของ admin (optional)

### 9.4 Authorization ✅ (มีแล้ว)
- ทุก admin endpoint ใช้ `requireAuth` + `requireRole('admin')`
- Caregiver cancel ใช้ `requireAuth` + ตรวจ `user_id` match

### 9.5 สิ่งที่ต้องเพิ่ม

| Security Measure | Priority | รายละเอียด |
|-----------------|----------|-----------|
| **Confirmation dialog** | P0 | ทุก action (approve/reject/mark-paid) ต้องมี confirm |
| **Idempotency** สำหรับ mark-paid | P0 | ป้องกัน double-click / retry โอนเงินซ้ำ |
| **Audit events** | P0 | บันทึกทุก financial action ใน `audit_events` |
| **Rate limiting** | P1 | จำกัดจำนวน action ต่อนาที (ป้องกัน automated abuse) |
| **payout_reference required** | P1 | บังคับกรอก bank ref ก่อน mark-paid |
| **Notification ถึง user** | P1 | แจ้ง user ทุกครั้งที่สถานะเปลี่ยน |
| **Account number masking** | P2 | แสดงเลขบัญชีเต็มเฉพาะใน detail view |
| **Admin permission levels** | P3 | แยกสิทธิ์: reviewer vs approver vs payer (future) |

---

## 10. แผนพัฒนา — ระยะแรก vs ระยะถัดไป

### ระยะแรก (MVP — Manual Transfer) 🎯

**เป้าหมาย**: แอดมินสามารถจัดการคำขอถอนเงินได้จริง พร้อมหลักฐาน

| # | Task | Priority | Effort |
|---|------|----------|--------|
| 1 | **ปรับ `getAllWithdrawals` query** — เพิ่ม JOIN ข้อมูลผู้ขอ (name, phone, trust, KYC, wallet balance) | P0 | S |
| 2 | **สร้าง withdrawal detail endpoint** — `GET /api/wallet/admin/withdrawals/:id` พร้อมข้อมูลครบ | P0 | S |
| 3 | **เพิ่ม upload สลิป endpoint** — `POST .../upload-proof` (file upload → storage key) | P0 | M |
| 4 | **เพิ่ม audit_events** ทุก withdrawal action (review/approve/reject/paid) | P0 | S |
| 5 | **เพิ่ม notification** ถึง user เมื่อ withdrawal status เปลี่ยน | P1 | S |
| 6 | **ปรับ UI — Withdrawal list** เพิ่มข้อมูลผู้ขอ, confirmation dialog, upload สลิป | P0 | L |
| 7 | **สร้าง UI — Dashboard tab** แสดงยอดเงินรวมแต่ละหมวด | P1 | M |
| 8 | **เพิ่ม search/date filter** ใน withdrawal list | P1 | S |
| 9 | **บังคับ payout_reference** ก่อน mark-paid (required field) | P0 | XS |
| 10 | **Idempotency guard** สำหรับ mark-paid | P0 | S |

**Effort**: XS = <1h, S = 1-3h, M = 3-6h, L = 6-12h

### ระยะถัดไป (Enhanced)

| # | Task | Priority |
|---|------|----------|
| 11 | **Ledger transactions viewer** — admin ดู transactions ทั้งระบบ | P2 |
| 12 | **Export CSV** — withdrawals + transactions | P2 |
| 13 | **Ledger integrity check UI** — แสดงผลจาก `verifyLedgerIntegrity()` | P2 |
| 14 | **Monthly report generation** | P2 |
| 15 | **Refund/adjustment workflow** — admin สร้าง reversal transactions | P2 |
| 16 | **Stats dashboard charts** — กราฟแสดง trend | P3 |

### ระยะอนาคต (Automation)

| # | Task | Priority |
|---|------|----------|
| 17 | **Auto payout via bank API** (PromptPay/bank transfer API) | P3 |
| 18 | **Payment gateway integration** สำหรับ payout (Omise/2C2P) | P3 |
| 19 | **Scheduled payout batching** — รวม withdrawals แล้วโอนทีเดียว | P3 |
| 20 | **Admin permission levels** — แยก reviewer/approver/payer | P3 |
| 21 | **Webhook callback** จาก bank API เมื่อโอนสำเร็จ → auto mark-paid | P3 |

---

## 11. Actionable Plan สำหรับ Developer

### Sprint 1: Backend Foundation (1-2 วัน)

```
1. ปรับ getAllWithdrawals() — เพิ่ม JOIN + query params
   - JOIN caregiver_profiles (full_name)
   - JOIN users (phone_number, trust_level)
   - JOIN user_kyc_info (status)
   - JOIN wallets (available_balance, held_balance)
   - เพิ่ม subquery: total previous withdrawals
   - เพิ่ม query params: search, date_from, date_to

2. สร้าง getWithdrawalDetail() service + endpoint
   - คืนข้อมูลครบทุก field ที่ต้องการ
   - รวม withdrawal history ของ user คนเดียวกัน

3. เพิ่ม audit_events INSERT ใน:
   - reviewWithdrawal()
   - approveWithdrawal()
   - rejectWithdrawal()
   - markWithdrawalPaid()
   - addFunds()

4. บังคับ payout_reference required ใน markWithdrawalPaid()
   - Joi validation: payout_reference required

5. เพิ่ม notification trigger หลัง withdrawal status change
   - ใช้ Notification model ที่มีอยู่
```

### Sprint 2: File Upload + Mark-paid Safety (1 วัน)

```
6. สร้าง upload proof endpoint
   - POST /api/wallet/admin/withdrawals/:id/upload-proof
   - Accept multipart/form-data (image/pdf)
   - Save file → storage (local/S3)
   - Update payout_proof_storage_key

7. เพิ่ม idempotency guard ใน markWithdrawalPaid
   - Check: ถ้า status ≠ 'approved' → reject
   - Optional: idempotency_key ใน request header
```

### Sprint 3: Frontend Redesign (2-3 วัน)

```
8. Redesign AdminFinancialPage.tsx เป็น tab-based layout
   - Tab 1: Dashboard (ยอดเงินรวม)
   - Tab 2: Withdrawal Requests (ปรับปรุง)
   - Tab 3: Transactions (ใหม่ — ถ้ามีเวลา)
   - Tab 4: Transfer Proofs (ใหม่ — ถ้ามีเวลา)

9. ปรับ Withdrawal list:
   - แสดงข้อมูลผู้ขอครบ (name, phone, trust, KYC)
   - เพิ่ม search box + date filter
   - เพิ่ม confirmation dialog ทุก action
   - เพิ่ม upload สลิป ตอน mark-paid
   - เพิ่ม expandable detail view

10. สร้าง Dashboard summary:
    - Cards: เงินรวม, escrow, platform, รอโอน, โอนแล้ว
    - สรุปรายเดือน
    - Ledger integrity status
```

### Sprint 4: Polish + Testing (1 วัน)

```
11. เขียน tests:
    - Unit: withdrawal detail endpoint
    - Unit: upload proof
    - Integration: full withdrawal flow (queued → paid)
    - Audit events verification

12. Manual QA:
    - ทดสอบ flow จริง: ขอถอน → review → approve → upload สลิป → mark-paid
    - ตรวจ notification ถึง user
    - ตรวจ audit log
    - ทดสอบ edge cases: cancel, reject, double-click
```

---

## 12. คำเตือนสำหรับระบบการเงินจริง ⚠️

1. **ห้ามลบ ledger_transactions** — ระบบมี DB trigger ป้องกันอยู่แล้ว ห้ามแก้
2. **ระวัง race condition** — withdrawal ใช้ `FOR UPDATE` lock แล้ว แต่ต้องระวังเมื่อเพิ่ม feature ใหม่
3. **เงินที่ "ออกจากระบบจริง"** คือ mark-paid — ต้อง double-check ยอดก่อนโอน
4. **Bank account number** เก็บแบบ encrypted — ถ้าจะแสดงเต็มต้อง decrypt + log access
5. **Dev mode auto-topup** ต้องปิดใน production — ตรวจ `NODE_ENV` ก่อน deploy
6. **Test cleanup** อาจลบ withdrawal data — ต้องมี safeguard (มีอยู่แล้วใน setup.js)
7. **Timezone** — ทุก timestamp เป็น `TIMESTAMPTZ` (UTC) ✅ แต่ UI ต้องแสดงเวลาไทย (toLocaleString('th-TH'))
8. **Amount unit** — ยืนยันว่าเก็บเป็นบาทหรือสตางค์ก่อนแสดง UI (จากโค้ดดู เหมือนเก็บเป็นบาท integer)
9. **Concurrent admin actions** — ถ้ามี admin หลายคน ต้องระวัง 2 คนกด approve พร้อมกัน (status check ในTransaction ป้องกันได้)
