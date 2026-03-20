#!/usr/bin/env node
/**
 * CareConnect Demo Seed Runner
 *
 * Usage: node backend/src/seeds/runDemoSeed.js
 *
 * สร้าง seed data สำหรับเดโมโปรเจกต์จบ
 * ใช้ ON CONFLICT เพื่อให้รันซ้ำได้ (idempotent)
 * ใช้ email @careconnect.local เพื่อให้ test cleanup preserve
 */

import "../config/loadEnv.js";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { query, closePool } from "../utils/db.js";
import {
  BANKS,
  PERSONAS,
  PATIENT_PROFILES,
  COMPLETED_JOBS,
  ACTIVE_JOBS,
  POSTED_JOBS,
  CANCELLED_JOBS,
  DRAFT_JOBS,
  CAREGIVER_DOCS,
  TOPUP_INTENTS,
  WITHDRAWAL_REQUESTS,
  DISPUTES,
  COMPLAINTS,
  CHAT_TEMPLATES,
  daysAgo,
} from "./demoSeedData.js";

const PASSWORD = "DemoSeed123!";
const PLATFORM_FEE_PERCENT = 10;

// Track IDs for cross-references
const userIds = {};       // persona key → UUID
const walletIds = {};     // persona key → wallet UUID
const patientIds = [];    // index → UUID
const jobPostIds = {};    // id_suffix → UUID
const jobIds = {};        // id_suffix → UUID
const escrowWalletIds = {}; // id_suffix → UUID
const threadIds = {};     // id_suffix → UUID
const bankAccountIds = {}; // persona key → UUID

// ============================================================================
// Utility
// ============================================================================
function log(phase, msg) {
  console.log(`[Seed ${phase}] ${msg}`);
}

function calcFee(totalAmount) {
  return Math.floor(totalAmount * PLATFORM_FEE_PERCENT / 100);
}

function calcHirerDeposit(totalAmount) {
  if (totalAmount <= 500) return 100;
  if (totalAmount <= 2000) return 200;
  if (totalAmount <= 5000) return 500;
  if (totalAmount <= 10000) return 1000;
  return 2000;
}

const DEMO_EMAILS = Object.values(PERSONAS).map((p) => p.email);

// ============================================================================
// Phase 0: Cleanup previous demo data (for idempotent re-runs)
// ============================================================================
async function cleanupPreviousDemoData() {
  log("0", "Cleaning up previous demo seed data...");

  const r = await query(`SELECT id FROM users WHERE email = ANY($1)`, [DEMO_EMAILS]);
  const ids = r.rows.map((row) => row.id);
  if (ids.length === 0) {
    log("0", "  No previous demo data found");
    return;
  }

  // Collect wallet IDs for ledger cleanup
  const wRes = await query(`SELECT id FROM wallets WHERE user_id = ANY($1)`, [ids]);
  const allWalletIds = wRes.rows.map((row) => row.id);

  // Collect job-related IDs
  const jpRes = await query(`SELECT id FROM job_posts WHERE hirer_id = ANY($1)`, [ids]);
  const jpIds = jpRes.rows.map((row) => row.id);
  let jIds = [];
  if (jpIds.length > 0) {
    const jRes = await query(`SELECT id FROM jobs WHERE job_post_id = ANY($1)`, [jpIds]);
    jIds = jRes.rows.map((row) => row.id);
    if (jIds.length > 0) {
      const escrowRes = await query(`SELECT id FROM wallets WHERE job_id = ANY($1)`, [jIds]);
      allWalletIds.push(...escrowRes.rows.map((row) => row.id));
    }
  }

  // Disable ledger immutability triggers for cleanup
  if (allWalletIds.length > 0) {
    await query(`ALTER TABLE ledger_transactions DISABLE TRIGGER prevent_update_ledger`);
    await query(`ALTER TABLE ledger_transactions DISABLE TRIGGER prevent_delete_ledger`);
    await query(`DELETE FROM ledger_transactions WHERE from_wallet_id = ANY($1) OR to_wallet_id = ANY($1)`, [allWalletIds]);
    await query(`ALTER TABLE ledger_transactions ENABLE TRIGGER prevent_update_ledger`);
    await query(`ALTER TABLE ledger_transactions ENABLE TRIGGER prevent_delete_ledger`);
  }

  // Delete in dependency order
  await query(`DELETE FROM caregiver_favorites WHERE hirer_id = ANY($1) OR caregiver_id = ANY($1)`, [ids]);
  await query(`DELETE FROM caregiver_reviews WHERE reviewer_id = ANY($1) OR caregiver_id = ANY($1)`, [ids]);
  await query(`DELETE FROM trust_score_history WHERE user_id = ANY($1)`, [ids]);
  await query(`DELETE FROM notifications WHERE user_id = ANY($1)`, [ids]);
  await query(`DELETE FROM complaints WHERE reporter_id = ANY($1)`, [ids]);
  await query(`DELETE FROM caregiver_documents WHERE user_id = ANY($1)`, [ids]);
  await query(`DELETE FROM user_kyc_info WHERE user_id = ANY($1)`, [ids]);
  await query(`DELETE FROM user_policy_acceptances WHERE user_id = ANY($1)`, [ids]);
  await query(`DELETE FROM topup_intents WHERE user_id = ANY($1)`, [ids]);
  await query(`DELETE FROM withdrawal_requests WHERE user_id = ANY($1)`, [ids]);
  await query(`DELETE FROM bank_accounts WHERE user_id = ANY($1)`, [ids]);

  if (jpIds.length > 0) {
    await query(`DELETE FROM dispute_messages WHERE dispute_id IN (SELECT id FROM disputes WHERE job_post_id = ANY($1))`, [jpIds]);
    await query(`DELETE FROM dispute_events WHERE dispute_id IN (SELECT id FROM disputes WHERE job_post_id = ANY($1))`, [jpIds]);
    await query(`DELETE FROM disputes WHERE job_post_id = ANY($1)`, [jpIds]);
  }
  if (jIds.length > 0) {
    await query(`DELETE FROM job_deposits WHERE job_id = ANY($1)`, [jIds]);
    await query(`DELETE FROM job_gps_events WHERE job_id = ANY($1)`, [jIds]);
    await query(`DELETE FROM chat_messages WHERE thread_id IN (SELECT id FROM chat_threads WHERE job_id = ANY($1))`, [jIds]);
    await query(`DELETE FROM chat_threads WHERE job_id = ANY($1)`, [jIds]);
    await query(`DELETE FROM job_assignments WHERE job_id = ANY($1)`, [jIds]);
    await query(`DELETE FROM wallets WHERE job_id = ANY($1)`, [jIds]);
    await query(`DELETE FROM jobs WHERE id = ANY($1)`, [jIds]);
  }
  if (jpIds.length > 0) {
    await query(`DELETE FROM job_posts WHERE id = ANY($1)`, [jpIds]);
  }

  await query(`DELETE FROM patient_profiles WHERE hirer_id = ANY($1)`, [ids]);
  await query(`DELETE FROM wallets WHERE user_id = ANY($1)`, [ids]);
  await query(`DELETE FROM hirer_profiles WHERE user_id = ANY($1)`, [ids]);
  await query(`DELETE FROM caregiver_profiles WHERE user_id = ANY($1)`, [ids]);
  await query(`DELETE FROM users WHERE id = ANY($1)`, [ids]);

  log("0", `  ✓ Cleaned ${ids.length} demo users and all related data`);
}

// ============================================================================
// Phase 1: Banks Master Data
// ============================================================================
async function seedBanks() {
  log("1", "Seeding banks...");
  for (const bank of BANKS) {
    await query(
      `INSERT INTO banks (code, full_name_th, full_name_en, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, TRUE, NOW(), NOW())
       ON CONFLICT (code) DO UPDATE SET full_name_th = EXCLUDED.full_name_th, full_name_en = EXCLUDED.full_name_en`,
      [bank.code, bank.full_name_th, bank.full_name_en]
    );
  }
  log("1", `  ✓ ${BANKS.length} banks`);
}

// ============================================================================
// Phase 1: Platform Wallets (ensure exist)
// ============================================================================
async function ensurePlatformWallets() {
  log("1", "Ensuring platform wallets...");
  const existing = await query(`SELECT id, wallet_type FROM wallets WHERE wallet_type IN ('platform', 'platform_replacement')`);
  if (existing.rows.length < 2) {
    await query(`INSERT INTO wallets (wallet_type, currency) VALUES ('platform', 'THB') ON CONFLICT DO NOTHING`);
    await query(`INSERT INTO wallets (wallet_type, currency) VALUES ('platform_replacement', 'THB') ON CONFLICT DO NOTHING`);
  }
  const platformResult = await query(`SELECT id FROM wallets WHERE wallet_type = 'platform' LIMIT 1`);
  walletIds._platform = platformResult.rows[0]?.id;
  log("1", `  ✓ platform wallet: ${walletIds._platform}`);
}

// ============================================================================
// Phase 1: Persona Users + Profiles
// ============================================================================
async function seedPersonaUsers() {
  log("1", "Seeding persona users...");
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  for (const [key, p] of Object.entries(PERSONAS)) {
    const result = await query(
      `INSERT INTO users (
         id, email, phone_number, password_hash, account_type, role, status,
         is_email_verified, is_phone_verified, trust_level, trust_score,
         completed_jobs_count, ban_job_accept, admin_note,
         created_at, updated_at
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, $4, $5, 'active',
         $6, $7, $8, $9,
         $10, $11, $12,
         $13, $13
       )
       ON CONFLICT (email) DO UPDATE
       SET role = EXCLUDED.role,
           trust_level = EXCLUDED.trust_level,
           trust_score = EXCLUDED.trust_score,
           is_email_verified = EXCLUDED.is_email_verified,
           is_phone_verified = EXCLUDED.is_phone_verified,
           completed_jobs_count = EXCLUDED.completed_jobs_count,
           ban_job_accept = EXCLUDED.ban_job_accept,
           admin_note = EXCLUDED.admin_note,
           updated_at = NOW()
       RETURNING id`,
      [
        p.email,
        p.phone_number || null,
        passwordHash,
        p.account_type,
        p.role,
        p.is_email_verified,
        p.is_phone_verified,
        p.trust_level,
        p.trust_score,
        p.completed_jobs_count,
        p.ban_job_accept || false,
        p.admin_note || null,
        p.created_at || new Date(),
      ]
    );
    userIds[key] = result.rows[0].id;

    // Profile
    if (p.role === "hirer") {
      await query(
        `INSERT INTO hirer_profiles (user_id, display_name, full_name, address_line1, district, province, postal_code, lat, lng, total_jobs_completed, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
         ON CONFLICT (user_id) DO UPDATE
         SET display_name = EXCLUDED.display_name, full_name = EXCLUDED.full_name,
             address_line1 = EXCLUDED.address_line1, district = EXCLUDED.district,
             province = EXCLUDED.province, lat = EXCLUDED.lat, lng = EXCLUDED.lng,
             total_jobs_completed = EXCLUDED.total_jobs_completed, updated_at = NOW()`,
        [
          userIds[key], p.display_name, p.full_name || null,
          p.address_line1 || null, p.district || null, p.province || null,
          p.postal_code || null, p.lat || null, p.lng || null,
          p.completed_jobs_count || 0, p.created_at || new Date(),
        ]
      );
    } else if (p.role === "caregiver") {
      await query(
        `INSERT INTO caregiver_profiles (
           user_id, display_name, full_name, bio, experience_years,
           certifications, specializations, available_from, available_to, available_days,
           total_jobs_completed, is_public_profile, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, $12, $12)
         ON CONFLICT (user_id) DO UPDATE
         SET display_name = EXCLUDED.display_name, full_name = EXCLUDED.full_name,
             bio = EXCLUDED.bio, experience_years = EXCLUDED.experience_years,
             certifications = EXCLUDED.certifications, specializations = EXCLUDED.specializations,
             available_from = EXCLUDED.available_from, available_to = EXCLUDED.available_to,
             available_days = EXCLUDED.available_days,
             total_jobs_completed = EXCLUDED.total_jobs_completed, updated_at = NOW()`,
        [
          userIds[key], p.display_name, p.full_name || null, p.bio || null,
          p.experience_years || 0,
          p.certifications || [], p.specializations || [],
          p.available_from || null, p.available_to || null, p.available_days || [],
          p.completed_jobs_count || 0, p.created_at || new Date(),
        ]
      );
    }

    // Policy acceptance (for active users except L0 new)
    if (p.trust_level !== "L0") {
      await query(
        `INSERT INTO user_policy_acceptances (user_id, role, policy_accepted_at, version_policy_accepted)
         VALUES ($1, $2, $3, '1.0')
         ON CONFLICT (user_id, role) DO NOTHING`,
        [userIds[key], p.role, p.created_at || new Date()]
      );
    }

    // Wallet — use SELECT-then-INSERT to avoid constraint issues
    const walletType = p.role === "hirer" ? "hirer" : "caregiver";
    let existingWallet = await query(
      `SELECT id FROM wallets WHERE user_id = $1 AND wallet_type = $2 LIMIT 1`,
      [userIds[key], walletType]
    );
    if (existingWallet.rows.length > 0) {
      walletIds[key] = existingWallet.rows[0].id;
    } else {
      const walletResult = await query(
        `INSERT INTO wallets (id, user_id, wallet_type, available_balance, held_balance, currency, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, 0, 0, 'THB', $3, $3)
         RETURNING id`,
        [userIds[key], walletType, p.created_at || new Date()]
      );
      walletIds[key] = walletResult.rows[0].id;
    }

    // KYC info
    if (p.kyc_status) {
      await query(
        `INSERT INTO user_kyc_info (id, user_id, provider_name, status, verified_at, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, 'mock', $2, $3, $4, $4)
         ON CONFLICT ON CONSTRAINT user_kyc_info_user_id_unique DO UPDATE
         SET status = EXCLUDED.status, verified_at = EXCLUDED.verified_at, updated_at = NOW()`,
        [userIds[key], p.kyc_status, p.kyc_verified_at || null, p.created_at || new Date()]
      );
    }

    // Bank account (for caregiverMain)
    if (p.has_bank_account) {
      const bankResult = await query(
        `INSERT INTO bank_accounts (id, user_id, bank_code, account_number_encrypted, account_number_last4, account_name, is_verified, is_primary, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, 'encrypted_demo', $3, $4, TRUE, TRUE, $5, $5)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [userIds[key], p.bank_code, p.account_number_last4, p.account_name, p.created_at || new Date()]
      );
      if (bankResult.rows.length > 0) {
        bankAccountIds[key] = bankResult.rows[0].id;
      } else {
        const existing = await query(
          `SELECT id FROM bank_accounts WHERE user_id = $1 AND is_primary = TRUE LIMIT 1`,
          [userIds[key]]
        );
        bankAccountIds[key] = existing.rows[0]?.id;
      }
    }

    log("1", `  ✓ ${key}: ${p.display_name} (${p.role}, ${p.trust_level})`);
  }
}

// ============================================================================
// Phase 1: Patient Profiles
// ============================================================================
async function seedPatientProfiles() {
  log("1", "Seeding patient profiles...");
  for (let i = 0; i < PATIENT_PROFILES.length; i++) {
    const pp = PATIENT_PROFILES[i];
    const hirerId = userIds[pp.owner];
    const result = await query(
      `INSERT INTO patient_profiles (
         id, hirer_id, patient_display_name,
         address_line1, district, province, postal_code, lat, lng,
         birth_year, age_band, gender,
         mobility_level, communication_style, general_health_summary,
         chronic_conditions_flags, cognitive_status, symptoms_flags,
         medical_devices_flags, care_needs_flags, behavior_risks_flags,
         allergies_flags, is_active, created_at, updated_at
       ) VALUES (
         gen_random_uuid(), $1, $2,
         $3, $4, $5, $6, $7, $8,
         $9, $10, $11,
         $12, $13, $14,
         $15, $16, $17,
         $18, $19, $20,
         $21, $22, $23, $23
       ) RETURNING id`,
      [
        hirerId, pp.patient_display_name,
        pp.address_line1 || null, pp.district || null, pp.province || null,
        pp.postal_code || null, pp.lat || null, pp.lng || null,
        pp.birth_year || null, pp.age_band || null, pp.gender || null,
        pp.mobility_level || null, pp.communication_style || null,
        pp.general_health_summary || null,
        pp.chronic_conditions_flags || [], pp.cognitive_status || null,
        pp.symptoms_flags || [],
        pp.medical_devices_flags || [], pp.care_needs_flags || [],
        pp.behavior_risks_flags || [],
        pp.allergies_flags || [], pp.is_active !== false,
        pp.created_at || new Date(),
      ]
    );
    patientIds.push(result.rows[0].id);
    log("1", `  ✓ Patient: ${pp.patient_display_name}`);
  }
}

// ============================================================================
// Phase 1: Caregiver Documents
// ============================================================================
async function seedCaregiverDocuments() {
  log("1", "Seeding caregiver documents...");
  for (const cd of CAREGIVER_DOCS) {
    const userId = userIds[cd.persona];
    for (const doc of cd.documents) {
      await query(
        `INSERT INTO caregiver_documents (id, user_id, document_type, title, issuer, issued_date, file_path, file_name, file_size, mime_type, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
        [userId, doc.document_type, doc.title, doc.issuer || null, doc.issued_date || null, doc.file_path, doc.file_name, doc.file_size, doc.mime_type]
      );
    }
    log("1", `  ✓ ${cd.documents.length} docs for ${cd.persona}`);
  }
}

// ============================================================================
// Phase 2: Topup Intents + Wallet Credit
// ============================================================================
async function seedTopupIntents() {
  log("2", "Seeding topup intents + wallet credits...");
  for (const ti of TOPUP_INTENTS) {
    const userId = userIds[ti.persona];
    const wId = walletIds[ti.persona];
    const intentId = uuidv4();

    await query(
      `INSERT INTO topup_intents (id, user_id, amount, currency, method, provider_name, status, idempotency_key, created_at, updated_at, succeeded_at)
       VALUES ($1, $2, $3, 'THB', $4, 'stripe', $5, $6, $7, $7, $8)`,
      [intentId, userId, ti.amount, ti.method, ti.status, `demo-topup-${intentId}`, ti.created_at, ti.status === "succeeded" ? ti.created_at : null]
    );

    if (ti.status === "succeeded" && wId) {
      await query(
        `UPDATE wallets SET available_balance = available_balance + $1, updated_at = NOW() WHERE id = $2`,
        [ti.amount, wId]
      );
      await query(
        `INSERT INTO ledger_transactions (id, to_wallet_id, amount, currency, type, reference_type, reference_id, description, idempotency_key, created_at)
         VALUES ($1, $2, $3, 'THB', 'credit', 'topup', $4, 'Demo topup', $5, $6)`,
        [uuidv4(), wId, ti.amount, intentId, `demo-topup-ledger-${intentId}`, ti.created_at]
      );
    }
  }
  log("2", `  ✓ ${TOPUP_INTENTS.length} topup intents`);
}

// ============================================================================
// Phase 2: Helper — create a full job lifecycle
// ============================================================================
async function createJobWithFullLifecycle(job, finalStatus) {
  const hirerId = userIds[job.hirer];
  const hirerWId = walletIds[job.hirer];
  const caregiverId = job.caregiver ? userIds[job.caregiver] : null;
  const caregiverWId = job.caregiver ? walletIds[job.caregiver] : null;
  const patientId = job.patient_index != null ? patientIds[job.patient_index] : null;

  const totalAmount = job.hourly_rate * job.total_hours;
  const platformFee = calcFee(totalAmount);
  const hirerDeposit = calcHirerDeposit(totalAmount);
  const totalCost = totalAmount + hirerDeposit;
  const caregiverPayout = totalAmount - platformFee;
  const minTrust = job.min_trust_level || (job.risk_level === "high_risk" ? "L2" : "L1");

  // 1. Create job_post
  const jpId = uuidv4();
  jobPostIds[job.id_suffix] = jpId;

  const jpStatus = finalStatus === "draft" ? "draft" : finalStatus;
  const postedAt = job.posted_at || null;
  const closedAt = (finalStatus === "completed" || finalStatus === "cancelled") ? (job.checkout_at || job.cancelled_at || new Date()) : null;

  await query(
    `INSERT INTO job_posts (
       id, hirer_id, title, description, job_type, risk_level,
       scheduled_start_at, scheduled_end_at,
       address_line1, district, province, postal_code, lat, lng,
       hourly_rate, total_hours, total_amount, platform_fee_percent, platform_fee_amount,
       hirer_deposit_amount, caregiver_deposit_amount,
       min_trust_level, required_certifications, job_tasks_flags, required_skills_flags,
       status, is_urgent, patient_profile_id, posted_at, closed_at,
       created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5::job_type, $6::risk_level,
       $7, $8,
       $9, $10, $11, $12, $13, $14,
       $15, $16, $17, 10, $18,
       $29, 0,
       $19::trust_level, $20, $21, $22,
       $23::job_status, $24, $25, $26, $27,
       $28, NOW()
     )`,
    [
      jpId, hirerId, job.title, job.description, job.job_type, job.risk_level,
      job.scheduled_start, job.scheduled_end,
      job.address_line1, job.district || null, job.province || null, job.postal_code || null,
      job.lat || null, job.lng || null,
      job.hourly_rate, job.total_hours, totalAmount, platformFee,
      minTrust, job.required_certifications || [], job.job_tasks_flags || [], job.required_skills_flags || [],
      jpStatus, job.is_urgent || false, patientId, postedAt, closedAt,
      job.created_at, hirerDeposit,
    ]
  );

  // If draft, stop here
  if (finalStatus === "draft") {
    log("2", `  ✓ [draft] ${job.title}`);
    return;
  }

  // 2. Hold funds on publish (posted/assigned/in_progress/completed)
  if (postedAt && hirerWId) {
    await query(
      `UPDATE wallets SET available_balance = available_balance - $1, held_balance = held_balance + $1, updated_at = NOW() WHERE id = $2`,
      [totalCost, hirerWId]
    );
    await query(
      `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, currency, type, reference_type, reference_id, description, idempotency_key, created_at)
       VALUES ($1, $2, $3, $4, 'THB', 'hold', 'job', $5, 'Hold funds for job publish', $6, $7)`,
      [uuidv4(), hirerWId, hirerWId, totalCost, jpId, `demo-hold-publish-${jpId}`, postedAt]
    );
  }

  // If only posted, stop here
  if (finalStatus === "posted") {
    log("2", `  ✓ [posted] ${job.title}`);
    return;
  }

  // If cancelled before assignment
  if (finalStatus === "cancelled" && !job.was_assigned) {
    // Unhold funds
    if (hirerWId) {
      await query(
        `UPDATE wallets SET held_balance = held_balance - $1, available_balance = available_balance + $1, updated_at = NOW() WHERE id = $2`,
        [totalCost, hirerWId]
      );
      await query(
        `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, currency, type, reference_type, reference_id, description, idempotency_key, created_at)
         VALUES ($1, $2, $3, $4, 'THB', 'release', 'job', $5, 'Release held funds for cancelled job', $6, $7)`,
        [uuidv4(), hirerWId, hirerWId, totalCost, jpId, `demo-release-cancel-${jpId}`, job.cancelled_at]
      );
    }
    log("2", `  ✓ [cancelled-posted] ${job.title}`);
    return;
  }

  // 3. Create job instance + assignment + escrow (assigned/in_progress/completed/cancelled-after-assign)
  const jId = uuidv4();
  jobIds[job.id_suffix] = jId;

  const jobStatus = finalStatus === "cancelled" ? "cancelled" : (finalStatus === "in_progress" ? "in_progress" : finalStatus);
  const startedAt = job.checkin_at || null;
  const completedAt = finalStatus === "completed" ? (job.checkout_at || null) : null;
  const cancelledAt = finalStatus === "cancelled" ? (job.cancelled_at || null) : null;

  await query(
    `INSERT INTO jobs (id, job_post_id, hirer_id, status, assigned_at, started_at, completed_at, cancelled_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4::job_status, $5, $6, $7, $8, $9, NOW())`,
    [jId, jpId, hirerId, jobStatus, job.assigned_at, startedAt, completedAt, cancelledAt, job.assigned_at || job.created_at]
  );

  // Assignment
  const assignStatus = finalStatus === "completed" ? "completed" : (finalStatus === "cancelled" ? "cancelled" : "active");
  await query(
    `INSERT INTO job_assignments (id, job_id, job_post_id, caregiver_id, status, assigned_at, start_confirmed_at, end_confirmed_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5::assignment_status, $6, $7, $8, $9, NOW())`,
    [uuidv4(), jId, jpId, caregiverId, assignStatus, job.assigned_at, startedAt, completedAt, job.assigned_at || job.created_at]
  );

  // Escrow wallet
  const escrowId = uuidv4();
  escrowWalletIds[job.id_suffix] = escrowId;

  // Move held → escrow
  if (hirerWId) {
    await query(
      `UPDATE wallets SET held_balance = held_balance - $1, updated_at = NOW() WHERE id = $2`,
      [totalCost, hirerWId]
    );
  }

  const escrowHeld = (finalStatus === "completed" || finalStatus === "cancelled") ? 0 : totalCost;
  await query(
    `INSERT INTO wallets (id, job_id, wallet_type, available_balance, held_balance, currency, created_at, updated_at)
     VALUES ($1, $2, 'escrow', 0, $3, 'THB', $4, NOW())`,
    [escrowId, jId, escrowHeld, job.assigned_at || job.created_at]
  );

  await query(
    `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, currency, type, reference_type, reference_id, description, idempotency_key, created_at)
     VALUES ($1, $2, $3, $4, 'THB', 'hold', 'job', $5, 'Job escrow hold', $6, $7)`,
    [uuidv4(), hirerWId, escrowId, totalAmount, jId, `demo-hold-escrow-${jId}`, job.assigned_at || job.created_at]
  );
  if (hirerDeposit > 0) {
    await query(
      `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, currency, type, reference_type, reference_id, description, idempotency_key, created_at)
       VALUES ($1, $2, $3, $4, 'THB', 'hold', 'deposit', $5, 'Hirer deposit escrow hold', $6, $7)`,
      [uuidv4(), hirerWId, escrowId, hirerDeposit, jId, `demo-hold-deposit-${jId}`, job.assigned_at || job.created_at]
    );
    await query(
      `INSERT INTO job_deposits (id, job_id, job_post_id, user_id, party, amount, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'hirer', $5, $6, $7, NOW())`,
      [uuidv4(), jId, jpId, hirerId, hirerDeposit, finalStatus === 'completed' ? 'released' : 'held', job.assigned_at || job.created_at]
    );
  }

  // Chat thread
  const tId = uuidv4();
  threadIds[job.id_suffix] = tId;
  const threadStatus = (finalStatus === "completed" || finalStatus === "cancelled") ? "closed" : "open";
  await query(
    `INSERT INTO chat_threads (id, job_id, status, created_at, updated_at, closed_at)
     VALUES ($1, $2, $3, $4, NOW(), $5)`,
    [tId, jId, threadStatus, job.assigned_at || job.created_at, closedAt]
  );

  // GPS events
  if (startedAt) {
    const gpsLat = job.lat || 13.7308;
    const gpsLng = job.lng || 100.5695;
    await query(
      `INSERT INTO job_gps_events (id, job_id, caregiver_id, event_type, lat, lng, accuracy_m, confidence_score, recorded_at, created_at)
       VALUES ($1, $2, $3, 'check_in', $4, $5, 8.5, 95, $6, $6)`,
      [uuidv4(), jId, caregiverId, gpsLat, gpsLng, startedAt]
    );
  }
  if (completedAt) {
    const gpsLat = job.lat || 13.7308;
    const gpsLng = job.lng || 100.5695;
    await query(
      `INSERT INTO job_gps_events (id, job_id, caregiver_id, event_type, lat, lng, accuracy_m, confidence_score, recorded_at, created_at)
       VALUES ($1, $2, $3, 'check_out', $4, $5, 6.2, 97, $6, $6)`,
      [uuidv4(), jId, caregiverId, gpsLat, gpsLng, completedAt]
    );
  }

  // 4. Settlement (completed jobs)
  if (finalStatus === "completed" && caregiverWId) {
    // Escrow → Caregiver (total_amount - fee = net payout)
    await query(
      `UPDATE wallets SET available_balance = available_balance + $1, updated_at = NOW() WHERE id = $2`,
      [caregiverPayout, caregiverWId]
    );
    await query(
      `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, currency, type, reference_type, reference_id, description, idempotency_key, created_at)
       VALUES ($1, $2, $3, $4, 'THB', 'release', 'job', $5, 'Payment for completed job', $6, $7)`,
      [uuidv4(), escrowId, caregiverWId, caregiverPayout, jId, `demo-release-cg-${jId}`, completedAt]
    );

    // Platform fee
    if (platformFee > 0 && walletIds._platform) {
      await query(
        `UPDATE wallets SET available_balance = available_balance + $1, updated_at = NOW() WHERE id = $2`,
        [platformFee, walletIds._platform]
      );
      await query(
        `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, currency, type, reference_type, reference_id, description, idempotency_key, created_at)
         VALUES ($1, $2, $3, $4, 'THB', 'debit', 'fee', $5, 'Platform service fee', $6, $7)`,
        [uuidv4(), escrowId, walletIds._platform, platformFee, jId, `demo-fee-${jId}`, completedAt]
      );
    }

    // Release hirer deposit back
    if (hirerDeposit > 0 && hirerWId) {
      await query(
        `UPDATE wallets SET available_balance = available_balance + $1, updated_at = NOW() WHERE id = $2`,
        [hirerDeposit, hirerWId]
      );
      await query(
        `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, currency, type, reference_type, reference_id, description, idempotency_key, created_at)
         VALUES ($1, $2, $3, $4, 'THB', 'release', 'deposit', $5, 'Return hirer deposit (completed)', $6, $7)`,
        [uuidv4(), escrowId, hirerWId, hirerDeposit, jId, `demo-release-dep-${jId}`, completedAt]
      );
      await query(
        `UPDATE job_deposits SET status = 'released', released_amount = amount, settled_at = $2, updated_at = NOW() WHERE job_id = $1 AND party = 'hirer'`,
        [jId, completedAt]
      );
    }

    // Update jobs settlement fields
    await query(
      `UPDATE jobs SET final_caregiver_payout = $2, final_platform_fee = $3, settlement_mode = 'normal', settlement_completed_at = $4, fault_party = 'none', updated_at = NOW() WHERE id = $1`,
      [jId, caregiverPayout, platformFee, completedAt]
    );

    // Review
    if (job.review) {
      await query(
        `INSERT INTO caregiver_reviews (id, job_id, job_post_id, reviewer_id, caregiver_id, rating, comment, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $7)`,
        [jId, jpId, hirerId, caregiverId, job.review.rating, job.review.comment, completedAt]
      );
    }

    log("2", `  ✓ [completed] ${job.title} — CG net ฿${caregiverPayout}, fee ฿${platformFee}, deposit ฿${hirerDeposit} returned`);
    return;
  }

  // 5. Cancelled after assign — refund job amount + release deposit
  if (finalStatus === "cancelled" && job.was_assigned) {
    if (hirerWId) {
      // Refund job amount
      await query(
        `UPDATE wallets SET available_balance = available_balance + $1, updated_at = NOW() WHERE id = $2`,
        [totalCost, hirerWId]
      );
      await query(
        `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, currency, type, reference_type, reference_id, description, idempotency_key, created_at)
         VALUES ($1, $2, $3, $4, 'THB', 'reversal', 'refund', $5, 'Refund for cancelled job', $6, $7)`,
        [uuidv4(), escrowId, hirerWId, totalAmount, jId, `demo-refund-${jId}`, cancelledAt]
      );
      // Release deposit
      if (hirerDeposit > 0) {
        await query(
          `INSERT INTO ledger_transactions (id, from_wallet_id, to_wallet_id, amount, currency, type, reference_type, reference_id, description, idempotency_key, created_at)
           VALUES ($1, $2, $3, $4, 'THB', 'release', 'deposit', $5, 'Return hirer deposit (cancelled)', $6, $7)`,
          [uuidv4(), escrowId, hirerWId, hirerDeposit, jId, `demo-release-dep-cancel-${jId}`, cancelledAt]
        );
        await query(
          `UPDATE job_deposits SET status = 'released', released_amount = amount, settled_at = $2, updated_at = NOW() WHERE job_id = $1 AND party = 'hirer'`,
          [jId, cancelledAt]
        );
      }
    }
    // Update jobs settlement
    await query(
      `UPDATE jobs SET fault_party = 'none', settlement_mode = 'normal', settlement_completed_at = $2, final_hirer_refund = $3, updated_at = NOW() WHERE id = $1`,
      [jId, cancelledAt, totalAmount]
    );
    log("2", `  ✓ [cancelled-assigned] ${job.title} — refunded ฿${totalAmount}, deposit ฿${hirerDeposit} returned`);
    return;
  }

  // Active jobs (assigned / in_progress)
  log("2", `  ✓ [${finalStatus}] ${job.title}`);
}

// ============================================================================
// Phase 2: Seed all job groups
// ============================================================================
async function seedCompletedJobs() {
  log("2", "Seeding completed jobs...");
  for (const job of COMPLETED_JOBS) {
    await createJobWithFullLifecycle(job, "completed");
  }
}

async function seedActiveJobs() {
  log("2", "Seeding active jobs...");
  for (const job of ACTIVE_JOBS) {
    await createJobWithFullLifecycle(job, job.status);
  }
}

async function seedPostedJobs() {
  log("2", "Seeding posted jobs...");
  for (const job of POSTED_JOBS) {
    await createJobWithFullLifecycle(job, "posted");
  }
}

async function seedCancelledJobs() {
  log("2", "Seeding cancelled jobs...");
  for (const job of CANCELLED_JOBS) {
    await createJobWithFullLifecycle(job, "cancelled");
  }
}

async function seedDraftJobs() {
  log("2", "Seeding draft jobs...");
  for (const job of DRAFT_JOBS) {
    await createJobWithFullLifecycle(job, "draft");
  }
}

async function seedWithdrawalRequests() {
  log("2", "Seeding withdrawal requests...");
  for (const wr of WITHDRAWAL_REQUESTS) {
    const userId = userIds[wr.persona];
    const wId = walletIds[wr.persona];
    const wrId = uuidv4();

    // Find or create bank account for this persona
    let bankAccId = bankAccountIds[wr.persona];
    if (!bankAccId) {
      const existing = await query(
        `SELECT id FROM bank_accounts WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      if (existing.rows.length > 0) {
        bankAccId = existing.rows[0].id;
      } else {
        const newBa = await query(
          `INSERT INTO bank_accounts (id, user_id, bank_code, account_number_encrypted, account_number_last4, account_name, is_verified, is_primary, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, 'encrypted_demo', '1234', $3, TRUE, TRUE, NOW(), NOW())
           RETURNING id`,
          [userId, wr.bank_code || "KBANK", PERSONAS[wr.persona]?.display_name || "Demo User"]
        );
        bankAccId = newBa.rows[0].id;
      }
      bankAccountIds[wr.persona] = bankAccId;
    }

    const adminId = await query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
    const adminUserId = adminId.rows[0]?.id;

    await query(
      `INSERT INTO withdrawal_requests (
         id, user_id, bank_account_id, amount, currency, status,
         reviewed_by, reviewed_at, approved_by, approved_at,
         paid_by, paid_at, rejected_by, rejected_at, rejection_reason,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, 'THB', $5::withdrawal_status,
         $6, $7, $8, $9,
         $10, $11, $12, $13, $14,
         $15, NOW()
       )`,
      [
        wrId, userId, bankAccId, wr.amount, wr.status,
        wr.status !== "queued" ? adminUserId : null,
        wr.reviewed_at || null,
        ["approved", "paid"].includes(wr.status) ? adminUserId : null,
        wr.approved_at || null,
        wr.status === "paid" ? adminUserId : null,
        wr.paid_at || null,
        wr.status === "rejected" ? adminUserId : null,
        wr.rejected_at || null,
        wr.rejection_reason || null,
        wr.created_at,
      ]
    );

    // Deduct from caregiver wallet for pending/paid withdrawals
    if (["queued", "review", "approved", "paid"].includes(wr.status) && wId) {
      await query(
        `UPDATE wallets SET available_balance = available_balance - $1, held_balance = held_balance + $1, updated_at = NOW() WHERE id = $2`,
        [wr.amount, wId]
      );
    }
    if (wr.status === "paid" && wId) {
      await query(
        `UPDATE wallets SET held_balance = held_balance - $1, updated_at = NOW() WHERE id = $2`,
        [wr.amount, wId]
      );
      await query(
        `INSERT INTO ledger_transactions (id, from_wallet_id, amount, currency, type, reference_type, reference_id, description, idempotency_key, created_at)
         VALUES ($1, $2, $3, 'THB', 'debit', 'withdrawal', $4, 'Withdrawal paid', $5, $6)`,
        [uuidv4(), wId, wr.amount, wrId, `demo-withdraw-${wrId}`, wr.paid_at]
      );
    }

    log("2", `  ✓ Withdrawal ${wr.status}: ฿${wr.amount/100} for ${wr.persona}`);
  }
}

// ============================================================================
// Phase 3: Chat Messages
// ============================================================================
async function seedChatMessages() {
  log("3", "Seeding chat messages...");
  let count = 0;
  for (const [suffix, messages] of Object.entries(CHAT_TEMPLATES)) {
    const tId = threadIds[suffix];
    if (!tId) continue;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const isSystem = msg.type === "system";
      const senderId = isSystem ? null : userIds[msg.sender];
      const msgTime = new Date(Date.now() - (messages.length - i) * 60000 * 5); // 5 min apart

      await query(
        `INSERT INTO chat_messages (id, thread_id, sender_id, type, content, is_system_message, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
        [tId, senderId, isSystem ? "system" : "text", msg.content, isSystem, msg.created_at || msgTime]
      );
      count++;
    }
  }
  log("3", `  ✓ ${count} chat messages`);
}

// ============================================================================
// Phase 3: Disputes
// ============================================================================
async function seedDisputes() {
  log("3", "Seeding disputes...");
  for (const d of DISPUTES) {
    const jpId = jobPostIds[d.job_suffix];
    const jId = jobIds[d.job_suffix] || null;
    const openedById = userIds[d.opened_by];

    const adminResult = await query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
    const adminUserId = adminResult.rows[0]?.id;

    const disputeId = uuidv4();
    await query(
      `INSERT INTO disputes (
         id, job_post_id, job_id, opened_by_user_id,
         status, reason, assigned_admin_id, resolution, resolved_at,
         settlement_refund_amount, settlement_payout_amount,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4,
         $5::dispute_status, $6, $7, $8, $9,
         $10, 0,
         $11, NOW()
       )`,
      [
        disputeId, jpId, jId, openedById,
        d.status, d.reason,
        d.status !== "open" ? adminUserId : null,
        d.resolution || null, d.resolved_at || null,
        d.settlement_refund_amount || 0,
        d.created_at,
      ]
    );

    // Dispute events
    await query(
      `INSERT INTO dispute_events (id, dispute_id, actor_user_id, event_type, message, created_at)
       VALUES (gen_random_uuid(), $1, $2, 'note', $3, $4)`,
      [disputeId, openedById, `เปิดข้อพิพาท: ${d.reason}`, d.created_at]
    );

    if (d.status === "resolved") {
      await query(
        `INSERT INTO dispute_events (id, dispute_id, actor_user_id, event_type, message, created_at)
         VALUES (gen_random_uuid(), $1, $2, 'status_change', $3, $4)`,
        [disputeId, adminUserId, `แก้ไขแล้ว: ${d.resolution}`, d.resolved_at]
      );
    }

    // Dispute messages
    if (d.messages) {
      for (const msg of d.messages) {
        const senderId = msg.sender === "admin" ? adminUserId : userIds[msg.sender];
        await query(
          `INSERT INTO dispute_messages (id, dispute_id, sender_id, type, content, is_system_message, created_at)
           VALUES (gen_random_uuid(), $1, $2, 'text', $3, FALSE, $4)`,
          [disputeId, senderId, msg.content, msg.created_at]
        );
      }
    }

    log("3", `  ✓ Dispute [${d.status}]: ${d.reason.substring(0, 40)}...`);
  }
}

// ============================================================================
// Phase 3: Complaints
// ============================================================================
async function seedComplaints() {
  log("3", "Seeding complaints...");
  for (const c of COMPLAINTS) {
    const reporterId = userIds[c.reporter];
    const targetId = c.target ? userIds[c.target] : null;

    const adminResult = await query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
    const adminUserId = adminResult.rows[0]?.id;

    await query(
      `INSERT INTO complaints (
         id, reporter_id, category, target_user_id,
         subject, description, status, assigned_admin_id, admin_note, resolved_at,
         created_at, updated_at
       ) VALUES (
         gen_random_uuid(), $1, $2, $3,
         $4, $5, $6::complaint_status, $7, $8, $9,
         $10, NOW()
       )`,
      [
        reporterId, c.category, targetId,
        c.subject, c.description, c.status,
        c.status !== "open" ? adminUserId : null,
        c.admin_note || null, c.resolved_at || null,
        c.created_at,
      ]
    );
    log("3", `  ✓ Complaint [${c.status}]: ${c.subject}`);
  }
}

// ============================================================================
// Phase 3: Notifications
// ============================================================================
async function seedNotifications() {
  log("3", "Seeding notifications...");
  const notifs = [
    // Job accepted notifications
    { user: "hirerMain", template: "job_accepted", title: "ผู้ดูแลรับงานแล้ว", body: "พิมพ์ชนก ศรีสุข รับงาน \"ดูแลคุณยายสมจิตร\" แล้ว", status: "read", created_at: daysAgo(21) },
    { user: "hirerMain", template: "job_accepted", title: "ผู้ดูแลรับงานแล้ว", body: "พิมพ์ชนก ศรีสุข รับงาน \"ตรวจน้ำตาลและความดัน\" แล้ว", status: "read", created_at: daysAgo(14) },
    { user: "hirerMain", template: "job_accepted", title: "ผู้ดูแลรับงานแล้ว", body: "ธิติ พงษ์เจริญ รับงาน \"ช่วยกายภาพบำบัด\" แล้ว", status: "read", created_at: daysAgo(10) },
    // Check-in notifications
    { user: "hirerMain", template: "check_in", title: "ผู้ดูแลเช็คอินแล้ว", body: "พิมพ์ชนก ศรีสุข เช็คอินที่สถานที่ทำงาน", status: "read", created_at: daysAgo(21) },
    // Check-out/complete notifications
    { user: "hirerMain", template: "check_out", title: "งานเสร็จสมบูรณ์", body: "งาน \"ดูแลคุณยายสมจิตร\" เสร็จสมบูรณ์ เงินโอนให้ผู้ดูแลแล้ว", status: "read", created_at: daysAgo(21) },
    { user: "hirerMain", template: "check_out", title: "งานเสร็จสมบูรณ์", body: "งาน \"ดูแลผู้ป่วยสมองเสื่อม\" เสร็จสมบูรณ์", status: "delivered", created_at: daysAgo(5) },
    // KYC approved
    { user: "caregiverMain", template: "kyc_approved", title: "ยืนยันตัวตนสำเร็จ", body: "การยืนยันตัวตน KYC ของคุณได้รับการอนุมัติแล้ว", status: "read", created_at: daysAgo(26) },
    { user: "caregiverSecondary", template: "kyc_approved", title: "ยืนยันตัวตนสำเร็จ", body: "การยืนยันตัวตน KYC ของคุณได้รับการอนุมัติแล้ว", status: "read", created_at: daysAgo(12) },
    // Recent unread
    { user: "hirerMain", template: "job_accepted", title: "ผู้ดูแลรับงานแล้ว", body: "ธิติ พงษ์เจริญ รับงาน \"ช่วยกิจวัตรเช้า\" แล้ว", status: "delivered", created_at: daysAgo(1) },
    { user: "caregiverMain", template: "job_assigned", title: "คุณได้รับมอบหมายงานใหม่", body: "งาน \"เพื่อนดูแลช่วงบ่าย\" กำลังดำเนินอยู่", status: "delivered", created_at: daysAgo(1) },
    // Withdrawal notification
    { user: "caregiverMain", template: "withdrawal_paid", title: "ถอนเงินสำเร็จ", body: "ถอนเงิน ฿2,000 ไปบัญชี KBANK xxx7890 เรียบร้อย", status: "read", created_at: daysAgo(9) },
  ];

  for (const n of notifs) {
    const userId = userIds[n.user];
    await query(
      `INSERT INTO notifications (id, user_id, channel, template_key, title, body, status, created_at, read_at)
       VALUES (gen_random_uuid(), $1, 'in_app', $2, $3, $4, $5::notification_status, $6, $7)`,
      [userId, n.template, n.title, n.body, n.status, n.created_at, n.status === "read" ? n.created_at : null]
    );
  }
  log("3", `  ✓ ${notifs.length} notifications`);
}

// ============================================================================
// Phase 3: Caregiver Favorites
// ============================================================================
async function seedFavorites() {
  log("3", "Seeding favorites...");
  // สมศรี favorite พิมพ์ชนก
  await query(
    `INSERT INTO caregiver_favorites (id, hirer_id, caregiver_id, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3)
     ON CONFLICT (hirer_id, caregiver_id) DO NOTHING`,
    [userIds.hirerMain, userIds.caregiverMain, daysAgo(20)]
  );
  // สมศรี favorite ธิติ
  await query(
    `INSERT INTO caregiver_favorites (id, hirer_id, caregiver_id, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3)
     ON CONFLICT (hirer_id, caregiver_id) DO NOTHING`,
    [userIds.hirerMain, userIds.caregiverSecondary, daysAgo(9)]
  );
  // วิชัย favorite พิมพ์ชนก
  await query(
    `INSERT INTO caregiver_favorites (id, hirer_id, caregiver_id, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3)
     ON CONFLICT (hirer_id, caregiver_id) DO NOTHING`,
    [userIds.hirerSecondary, userIds.caregiverMain, daysAgo(6)]
  );
  log("3", `  ✓ 3 favorites`);
}

// ============================================================================
// Phase 3: Trust Score History
// ============================================================================
async function seedTrustHistory() {
  log("3", "Seeding trust score history...");
  const entries = [
    { user: "caregiverMain", delta: 5, before: 50, after: 55, level_before: "L1", level_after: "L1", reason: "job_completed", created_at: daysAgo(21) },
    { user: "caregiverMain", delta: 3, before: 55, after: 58, level_before: "L1", level_after: "L1", reason: "good_review", created_at: daysAgo(21) },
    { user: "caregiverMain", delta: 10, before: 58, after: 68, level_before: "L1", level_after: "L2", reason: "kyc_approved", created_at: daysAgo(26) },
    { user: "caregiverMain", delta: 5, before: 68, after: 73, level_before: "L2", level_after: "L2", reason: "job_completed", created_at: daysAgo(14) },
    { user: "caregiverMain", delta: 5, before: 73, after: 78, level_before: "L2", level_after: "L2", reason: "job_completed", created_at: daysAgo(7) },
    { user: "caregiverMain", delta: 10, before: 78, after: 88, level_before: "L2", level_after: "L3", reason: "bank_verified", created_at: daysAgo(6) },
    { user: "caregiverSecondary", delta: 5, before: 55, after: 60, level_before: "L1", level_after: "L1", reason: "job_completed", created_at: daysAgo(10) },
    { user: "caregiverSecondary", delta: 12, before: 60, after: 72, level_before: "L1", level_after: "L2", reason: "kyc_approved", created_at: daysAgo(12) },
  ];

  for (const e of entries) {
    await query(
      `INSERT INTO trust_score_history (id, user_id, delta, score_before, score_after, trust_level_before, trust_level_after, reason_code, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::trust_level, $6::trust_level, $7, $8)`,
      [userIds[e.user], e.delta, e.before, e.after, e.level_before, e.level_after, e.reason, e.created_at]
    );
  }
  log("3", `  ✓ ${entries.length} trust score history entries`);
}

// ============================================================================
// Phase 3: Update Caregiver Profile Stats (average_rating, total_reviews)
// ============================================================================
async function updateCaregiverStats() {
  log("3", "Updating caregiver profile stats...");
  for (const key of ["caregiverMain", "caregiverSecondary"]) {
    const userId = userIds[key];
    await query(
      `UPDATE caregiver_profiles
       SET average_rating = (SELECT COALESCE(AVG(rating)::numeric(3,2), 0) FROM caregiver_reviews WHERE caregiver_id = $1),
           total_reviews = (SELECT COUNT(*) FROM caregiver_reviews WHERE caregiver_id = $1),
           updated_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );
  }
  log("3", `  ✓ Stats updated`);
}

// ============================================================================
// Main Runner
// ============================================================================
async function main() {
  console.log("=".repeat(60));
  console.log("CareConnect Demo Seed Data Runner");
  console.log("=".repeat(60));

  try {
    // Phase 0: Cleanup previous demo data
    await cleanupPreviousDemoData();

    // Phase 1: Foundation
    await seedBanks();
    await ensurePlatformWallets();
    await seedPersonaUsers();
    await seedPatientProfiles();
    await seedCaregiverDocuments();

    console.log("\n" + "=".repeat(60));
    console.log("Phase 1 Complete!");
    console.log("=".repeat(60));

    // Phase 2: Financial + Jobs
    await seedTopupIntents();    // Must come first — credits wallets
    await seedCompletedJobs();   // Oldest jobs first
    await seedCancelledJobs();   // Cancelled jobs
    await seedActiveJobs();      // Currently active
    await seedPostedJobs();      // Open for applications
    await seedDraftJobs();       // Drafts
    await seedWithdrawalRequests(); // After CG wallets have balance

    // Phase 3: Interaction data
    await seedChatMessages();
    await seedDisputes();
    await seedComplaints();
    await seedNotifications();
    await seedFavorites();
    await seedTrustHistory();
    await updateCaregiverStats();

    console.log("\n" + "=".repeat(60));
    console.log("Demo Seed Complete!");
    console.log(`Users: ${Object.keys(userIds).length}`);
    console.log(`Patients: ${patientIds.length}`);
    console.log(`Wallets: ${Object.keys(walletIds).length}`);
    console.log("=".repeat(60));

  } catch (error) {
    console.error("\n[Seed ERROR]", error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();
