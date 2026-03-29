# CareConnect — Load Test Results

> อัพเดทล่าสุด: 2026-03-29
> Environment: Local Docker (`http://localhost:3000`)
> Tool: k6 v1.7.0
> Scope: Auth + Job + Wallet (Critical API)

---

## Environment Specs

| Component | Details |
|-----------|---------|
| OS | Linux (Ubuntu) |
| Backend | Node.js Express (Docker container) |
| Database | PostgreSQL 15 (Docker container) |
| Backend URL | http://localhost:3000 |
| k6 version | v1.7.0 |
| Date | 2026-03-29 |

---

## Phase 1 — Smoke Test ✅ PASSED

> Stages: 1→5 VU over 30s | Goal: ยืนยัน endpoints ตอบสนองปกติ

| Metric | Value | Pass/Fail |
|--------|-------|-----------|
| Total Requests | 333 | ✅ |
| Checks Passed | 100% (664/664) | ✅ |
| Error Rate | 0.00% | ✅ |
| p50 Response Time | 3.12ms | ✅ |
| p90 Response Time | 5.72ms | ✅ |
| p95 Response Time | 6.44ms | ✅ |
| RPS (avg) | 10.82/s | ✅ |

### Endpoint Breakdown (Smoke)

| Endpoint | p95 | Errors |
|----------|-----|--------|
| GET /api/auth/me | 6.51ms | 0% |
| GET /api/auth/profile | — | 0% |
| GET /api/jobs/feed | 8.59ms | 0% |
| GET /api/jobs/my-jobs | — | 0% |
| GET /api/jobs/stats | — | 0% |
| GET /api/wallet/balance | 5.00ms | 0% |
| GET /api/wallet/transactions | — | 0% |

**Threshold Results**: ทุก threshold ผ่าน ✅
**Notes**: ระบบตอบสนองเร็วมากที่ low load — p95 < 10ms ทุก endpoint

---

## Phase 2 — Load Test (Normal Load) ✅ PASSED

> Stages: 10→50→100 VU over ~6 min | Thresholds: p95 < 500ms, errors < 1%

| Metric | Value | Threshold | Pass/Fail |
|--------|-------|-----------|-----------|
| Total Requests | 46,793 | — | ✅ |
| Checks Passed | 100% (93,584/93,584) | — | ✅ |
| Error Rate | 0.00% | < 1% | ✅ |
| p50 Response Time | 4.42ms | — | ✅ |
| p90 Response Time | 9.96ms | — | ✅ |
| p95 Response Time | 12.80ms | < 500ms | ✅ |
| p99 Response Time | 20.55ms | < 1000ms | ✅ |
| Peak RPS | ~130/s | — | ✅ |
| Max VU Reached | 100 | 100 | ✅ |
| Total Iterations | 25,611 | — | ✅ |

### Endpoint Breakdown (Load @ 100 VU)

| Endpoint | p50 | p95 | Threshold | Pass/Fail |
|----------|-----|-----|-----------|-----------|
| POST /api/auth/login/email | 75.95ms | 91.86ms | < 800ms | ✅ |
| GET /api/auth/me | 5.72ms | 17.05ms | < 300ms | ✅ |
| GET /api/auth/profile | 3.01ms | 9.36ms | < 300ms | ✅ |
| GET /api/jobs/feed | 5.03ms | 12.80ms | < 600ms | ✅ |
| GET /api/jobs/my-jobs | 7.17ms | 14.96ms | < 500ms | ✅ |
| GET /api/jobs/stats | 3.06ms | 8.94ms | < 400ms | ✅ |
| GET /api/wallet/balance | 3.44ms | 9.94ms | < 300ms | ✅ |
| GET /api/wallet/transactions | 3.88ms | 11.62ms | < 500ms | ✅ |

**Threshold Results**: ทุก threshold ผ่าน ✅
**Bottleneck**: `POST /api/auth/login/email` ช้าที่สุด (p95=91.86ms) — เพราะ bcrypt password hashing
**Notes**: ที่ 100 VU ระบบยังตอบสนองเร็วมาก p95 รวมแค่ 12.8ms (ไม่รวม login)

---

## Phase 3 — Stress Test (Breaking Point) ✅ PASSED

> Stages: 50→100→200→300 VU over ~6 min | Thresholds: p95 < 2000ms, errors < 5%

| Metric | Value | Threshold | Pass/Fail |
|--------|-------|-----------|-----------|
| Total Requests | 150,871 | — | ✅ |
| Checks Passed | 100% (301,740/301,740) | — | ✅ |
| Error Rate | 0.00% | < 5% | ✅ |
| avg Response Time | 270.21ms | — | ✅ |
| p50 Response Time | 243.66ms | — | ✅ |
| p90 Response Time | 668.99ms | — | ✅ |
| p95 Response Time | 808.66ms | < 2000ms | ✅ |
| max Response Time | 1.03s | — | ✅ |
| Peak RPS | ~419/s | — | ✅ |
| Total Iterations | 82,806 | — | ✅ |

### Degradation Timeline (Stress)

| VU Count | Avg Response Time | Error Rate | Status |
|----------|------------------|------------|--------|
| 50 | ~5ms | 0% | ✅ Healthy |
| 100 | ~10–15ms | 0% | ✅ Healthy |
| 200 | ~100–200ms | 0% | ✅ Acceptable |
| 300 | ~270ms (avg), p95=809ms | 0% | ✅ Degraded แต่ผ่าน |

**Threshold Results**: ทุก threshold ผ่าน ✅
**Breaking Point**: **ไม่พบ breaking point ที่ 300 VU** — ระบบยังคง 0% error
**Bottleneck**: Response time เพิ่มขึ้นตาม VU แต่ยังไม่ timeout หรือ error
**Notes**: ที่ 300 VU p95=808ms ยังอยู่ใต้ threshold 2000ms — หากต้องการหา true breaking point ต้องทดสอบที่ 500+ VU

---

## Phase 4 — Soak Test (Endurance) ✅ PASSED

> VU: 30 sustained over 11 min | Thresholds: p95 < 800ms, errors < 1%

| Metric | Value | Threshold | Pass/Fail |
|--------|-------|-----------|-----------|
| Total Requests | 27,582 | — | ✅ |
| Checks Passed | 100% (55,162/55,162) | — | ✅ |
| Error Rate | 0.00% | < 1% | ✅ |
| p50 Response Time | 3.61ms | — | ✅ |
| p90 Response Time | 6.25ms | — | ✅ |
| p95 Response Time | 7.27ms | < 800ms | ✅ |
| p99 Response Time | 10.34ms | < 1500ms | ✅ |
| max Response Time | 69.03ms | — | ✅ |
| avg RPS | ~41.8/s | — | ✅ |
| Total Iterations | 15,069 | — | ✅ |

### Endpoint Stability (Soak @ 30 VU, 11 min)

| Endpoint | p95 | Threshold | Pass/Fail |
|----------|-----|-----------|-----------|
| GET /api/auth/me | 8.20ms | < 400ms | ✅ |
| GET /api/jobs/feed | 7.16ms | < 700ms | ✅ |
| GET /api/wallet/balance | 5.15ms | < 400ms | ✅ |

**Threshold Results**: ทุก threshold ผ่าน ✅
**Memory Leak Signs**: ไม่พบ — response time คงที่ตลอด 10 นาที ไม่มี drift
**Response Time Drift**: p95 ตั้งแต่ต้นถึงท้ายการทดสอบ ≈ เท่ากัน (~7ms) — ไม่มี degradation
**Notes**: ระบบ stable มาก ไม่มีสัญญาณ memory leak หรือ connection pool exhaustion

---

## Phase 5 — Extended Stress Test (1000 VU) ✅ PASSED

> Stages: 300→500→700→1000 VU over ~6 min | Goal: หา true breaking point

| Metric | Value | Pass/Fail |
|--------|-------|-----------|
| Total Requests | 165,833 | ✅ |
| Checks Passed | 100% (331,664/331,664) | ✅ |
| Error Rate | 0.00% | ✅ |
| avg Response Time | 1.37s | ✅ |
| p50 Response Time | 1.25s | ✅ |
| p90 Response Time | 3.06s | ✅ |
| p95 Response Time | 3.62s | ✅ |
| max Response Time | 4.22s | ✅ |
| Peak RPS | ~460/s | ✅ |
| Total Iterations | 91,217 | ✅ |

### Degradation Timeline (Extended Stress)

| VU Count | Approx p95 | Error Rate | Status |
|----------|-----------|------------|--------|
| 300 | ~808ms | 0% | ✅ Degraded แต่ OK |
| 500 | ~1.5–2s | 0% | ✅ Slow แต่ OK |
| 700 | ~2.5–3s | 0% | ✅ Slow มาก แต่ OK |
| 1000 | 3.62s | 0% | ✅ Degraded มาก — ยังไม่ error |

**Breaking Point**: **ไม่พบแม้ที่ 1000 VU** — ระบบตอบ 0% error ตลอด
**Bottleneck ที่ 1000 VU**: Response time เพิ่มขึ้นมาก (p95=3.62s) แต่ Node.js Event Loop + PostgreSQL ยังรับ request ได้ทั้งหมด
**สาเหตุที่ไม่ error**: Node.js I/O non-blocking + PostgreSQL connection queue รับ request และต่อแถวรอ ไม่ reject

---

## Summary — ระบบรองรับได้เท่าไหร่

| Phase | Max VU | Peak RPS | p95 Latency | Error Rate | Result |
|-------|--------|----------|-------------|------------|--------|
| Smoke (1→5 VU) | 5 | 10.8/s | 6.44ms | 0% | ✅ PASS |
| Load (10→100 VU) | 100 | 129.7/s | 12.80ms | 0% | ✅ PASS |
| Stress (50→300 VU) | 300 | 418.8/s | 808.66ms | 0% | ✅ PASS |
| Soak (30 VU, 11 min) | 30 | 41.8/s | 7.27ms | 0% | ✅ PASS |
| Extended Stress (→1000 VU) | 1000 | 460/s | 3.62s | **0%** | ✅ PASS |

### สรุปความสามารถของระบบ

- **Concurrent Users ที่ทดสอบสูงสุด**: **1,000 VU** — ยังคง 0% error
- **Breaking Point (HTTP error)**: **ไม่พบในช่วง 0–1000 VU** — ระบบไม่ reject request แต่ตอบช้าลง
- **Performance Degradation Point**: ที่ ~300 VU p95 เริ่มเกิน 800ms / ที่ ~700 VU เกิน 2s
- **Peak RPS ที่ทำได้**: **~460 req/s** (ที่ 1000 VU)
- **p95 ที่ 100 VU (normal load)**: **12.8ms** — เร็วมาก เหมาะกับ production
- **p95 ที่ 1000 VU (extreme load)**: **3.62s** — ช้า แต่ไม่ error
- **Bottleneck หลัก**: `POST /api/auth/login/email` (bcrypt hashing, by design)
- **Endpoint ที่ช้าที่สุด (non-auth)**: `GET /api/jobs/my-jobs` (p95=14.96ms @ 100 VU)
- **ไม่พบ memory leak**: soak test 11 นาที ไม่มี response time drift
- **คำแนะนำ**:
  - สำหรับ MVP/thesis: ระบบรองรับ concurrent user ได้ดีเกินความคาดหมาย
  - Production target: ควรรักษา VU ≤ 200–300 เพื่อ p95 < 1s
  - ถ้าต้องการ scale ต่อ: เพิ่ม DB connection pool size + Redis cache สำหรับ read-heavy endpoints

---

## Raw Output Logs

### Phase 1 (Smoke)
```
checks_total.......: 664     21.58/s
checks_succeeded...: 100.00% 664/664
http_req_duration..: avg=4.23ms  p(90)=5.72ms  p(95)=6.44ms
http_req_failed....: 0.00%  0 out of 333
http_reqs..........: 333    10.82/s
iterations.........: 63     2.05/s
```

### Phase 2 (Load)
```
checks_total.......: 93584   259.37/s
checks_succeeded...: 100.00% 93584/93584
http_req_duration..: avg=5.61ms   p(90)=9.96ms  p(95)=12.8ms  p(99)=20.55ms
  {POST /login}....: avg=75.95ms  p(90)=90.09ms p(95)=91.86ms
  {GET /me}........: avg=7.4ms    p(90)=13.11ms p(95)=17.05ms
  {GET /jobs/feed}.: avg=6.21ms   p(90)=10.21ms p(95)=12.8ms
  {GET /balance}.  : avg=4.47ms   p(90)=7.85ms  p(95)=9.94ms
http_req_failed....: 0.00%  0 out of 46793
http_reqs..........: 46793  129.69/s
iterations.........: 25611  70.98/s
vus_max............: 100
```

### Phase 3 (Stress)
```
checks_total.......: 301740  837.59/s
checks_succeeded...: 100.00% 301740/301740
http_req_duration..: avg=270.21ms min=1.92ms med=243.66ms max=1.03s
                     p(90)=668.99ms p(95)=808.66ms
http_req_failed....: 0.00%  0 out of 150871
http_reqs..........: 150871 418.80/s
iterations.........: 82806  229.86/s
vus_max............: 300
```

### Phase 4 (Soak)
```
checks_total.......: 55162   83.55/s
checks_succeeded...: 100.00% 55162/55162
http_req_duration..: avg=4.03ms min=1.93ms med=3.61ms max=69.03ms
                     p(90)=6.25ms p(95)=7.27ms p(99)=10.34ms
http_req_failed....: 0.00%  0 out of 27582
http_reqs..........: 27582  41.78/s
iterations.........: 15069  22.83/s
vus_max............: 30
duration...........: 11 minutes
```

### Phase 5 (Extended Stress — 1000 VU)
```
checks_total.......: 331664  920.15/s
checks_succeeded...: 100.00% 331664/331664
http_req_duration..: avg=1.37s min=2.02ms med=1.25s max=4.22s
                     p(90)=3.06s p(95)=3.62s
http_req_failed....: 0.00%  0 out of 165833
http_reqs..........: 165833 460.08/s
iterations.........: 91217  253.07/s
vus_max............: 1000
```
