# Score-Based Job Restrictions

เพิ่ม threshold คุม "สิทธิ์รับงาน" ตาม trust score โดยไม่ block การใช้งานระบบ และ auto-cancel assigned jobs เมื่อ score ตกต่ำกว่า threshold

---

## Thresholds (constants ใน jobService.js)

| Threshold | ค่า | ผล |
|---|---|---|
| `SCORE_THRESHOLD_HIGH_RISK_BLOCK` | 40 | รับ high_risk ไม่ได้ (แม้ L2+) |
| `SCORE_THRESHOLD_FULL_BAN` | 20 | รับงานใหม่ทุกประเภทไม่ได้ |

Login ยังได้, `in_progress` jobs ทำต่อได้, `ban_job_accept` admin flag ยังทำงานอิสระ

---

## ไฟล์ที่แก้ (5 ไฟล์)

### 1. `backend/src/services/jobService.js`

**`acceptJob`** — เพิ่ม score check หลัง trust_level check:
```
score < 20          → throw "Trust score ต่ำเกินไป ไม่สามารถรับงานได้ (score: X/20)"
score < 40 + high_risk → throw "Trust score ต่ำเกินไปสำหรับงานความเสี่ยงสูง (score: X/40)"
```
- `caregiver` object จาก `User.findById` มี `trust_score` อยู่แล้ว → ไม่ต้อง query เพิ่ม

**`checkIn`** — เพิ่ม check ก่อนเรียก `Job.checkIn`:
```
ดึง job risk_level + caregiver trust_score
score < 40 + high_risk → throw "ไม่สามารถ check-in งานความเสี่ยงสูงได้ เนื่องจาก trust score ต่ำกว่า 40"
```
(ป้องกันกรณีที่ score ตกหลังรับงานไปแล้ว)

**`_cancelAssignedJobForScoreBan(jobId, jobPostId, caregiverId, hirerId, reason)`** — ฟังก์ชันใหม่ (private):
- Cancel `jobs` + `job_assignments` (status = 'cancelled', cancellation_reason = reason)
- **Re-post**: `job_posts.status = 'posted'` ← เปิดให้หา CG ใหม่
- Escrow คงไว้ (ไม่ refund เพราะ job ยังเปิดหาคนอยู่)
- Notify hirer: "ผู้ดูแลถูกลบออกจากงานอัตโนมัติ กรุณาหาผู้ดูแลใหม่"

---

### 2. `backend/src/workers/trustLevelWorker.js`

**`updateUserTrust`** — หลัง UPDATE users เสร็จ เพิ่ม side effects:

```
ถ้า previousScore >= 40 และ newScore < 40:
  → ยกเลิก assigned high_risk jobs ทั้งหมดของ CG นี้ (เรียก _cancelAssignedJobForScoreBan)
  → log [TrustWorker][ALERT] score dropped below 40 — X high_risk jobs auto-cancelled

ถ้า previousScore >= 20 และ newScore < 20:
  → ยกเลิก assigned jobs ทั้งหมด (ทุก risk_level)
  → log [TrustWorker][ALERT] score dropped below 20 — X jobs auto-cancelled
```

`in_progress` ไม่แตะ — ให้ทำต่อจนจบ

---

### 3. `backend/src/middleware/auth.js` (policy gate)

เพิ่ม check ใน `job:accept`:
```js
if (user.ban_job_accept) return { allowed: false, reason: 'Job acceptance banned' };
```
(`trust_score` check ไม่ทำที่นี่ — ทำที่ service layer เพราะ policy gate ไม่รู้ risk_level ของงาน)

---

### 4. `backend/src/services/__tests__/jobService.accessControl.test.js`

เพิ่ม test cases:
- `score < 20` → `acceptJob` throws ทุก risk_level
- `score < 40` + high_risk → `acceptJob` throws
- `score < 40` + low_risk → `acceptJob` ผ่าน
- `score >= 40` + high_risk → `acceptJob` ผ่าน
- `checkIn` high_risk + `score < 40` → throws

---

### 5. `backend/src/workers/__tests__/trustLevelWorker.scoreBan.test.js` (ใหม่)

- score 45 → 35: high_risk assigned jobs ถูก cancel + re-post
- score 25 → 15: all assigned jobs ถูก cancel + re-post
- `in_progress` jobs ไม่ถูกแตะ
- score ลงแต่ยังเหนือ threshold: ไม่มี cancel

---

## Side Effects / Risks

| | |
|---|---|
| **Re-post ไม่ใช่ refund** | Escrow ยังค้างอยู่กับ job — ถ้า job ค้างนาน hirer ต้องยกเลิกเองถ้าไม่ต้องการ |
| **Concurrent trigger** | `_cancelNoShowJob` และ `_cancelAssignedJobForScoreBan` ใช้ DB guard เดียวกัน — idempotent |
| **Score boundary** | score = 40 พอดี = ยังรับ high_risk ได้ (check `< 40` ไม่ใช่ `<= 40`) |
| **admin manual ban** | `ban_job_accept` (admin) ยังทำงานอิสระ ไม่ถูก override โดย score |
| **ไม่ migration** | ไม่เพิ่ม DB column ใหม่ — ใช้ `trust_score` ที่มีอยู่แล้ว |
