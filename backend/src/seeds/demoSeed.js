/**
 * Production-like Demo Seed Script
 * สร้างข้อมูล demo ครบทุก flow สำหรับ QA/UAT/Demo
 * 
 * รัน: node src/seeds/demoSeed.js
 * Reset: node src/seeds/demoSeed.js --reset
 */

import '../config/loadEnv.js';
import { query, transaction, closePool } from '../utils/db.js';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const DEMO_PASSWORD = 'Demo1234!';
const DEMO_TAG = 'demo_seed';

// ─── Helpers ───
const hash = (pw) => bcrypt.hashSync(pw, 10);
const uid = () => uuidv4();
const now = () => new Date().toISOString();
const ago = (days) => new Date(Date.now() - days * 86400000).toISOString();
const future = (days) => new Date(Date.now() + days * 86400000).toISOString();

// ─── Reset ───
async function resetDemo() {
  console.log('[Demo Seed] Resetting demo data...');
  // ลบข้อมูล demo ทั้งหมด (ใช้ email pattern)
  const patterns = [
    '%@demo.careconnect.local',
  ];
  for (const p of patterns) {
    const users = await query(`SELECT id FROM users WHERE email LIKE $1`, [p]);
    const ids = users.rows.map(r => r.id);
    if (ids.length === 0) continue;
    
    // ลบ complaints
    await query(`DELETE FROM complaints WHERE reporter_id = ANY($1) OR target_user_id = ANY($1)`, [ids]);
    // ลบ disputes + related
    await query(`DELETE FROM dispute_messages WHERE dispute_id IN (SELECT id FROM disputes WHERE opened_by_user_id = ANY($1))`, [ids]);
    await query(`DELETE FROM dispute_events WHERE dispute_id IN (SELECT id FROM disputes WHERE opened_by_user_id = ANY($1))`, [ids]);
    await query(`DELETE FROM disputes WHERE opened_by_user_id = ANY($1)`, [ids]);
    // ลบ reviews
    await query(`DELETE FROM caregiver_reviews WHERE reviewer_id = ANY($1) OR caregiver_id = ANY($1)`, [ids]);
    // ลบ notifications
    await query(`DELETE FROM notifications WHERE user_id = ANY($1)`, [ids]);
    // ลบ chat
    await query(`DELETE FROM chat_messages WHERE sender_id = ANY($1)`, [ids]);
    // ลบ jobs
    await query(`DELETE FROM job_assignments WHERE caregiver_id = ANY($1)`, [ids]);
    await query(`DELETE FROM jobs WHERE hirer_id = ANY($1)`, [ids]);
    await query(`DELETE FROM job_posts WHERE hirer_id = ANY($1)`, [ids]);
    // ลบ wallets + ledger
    await query(`DELETE FROM ledger_transactions WHERE from_wallet_id IN (SELECT id FROM wallets WHERE user_id = ANY($1)) OR to_wallet_id IN (SELECT id FROM wallets WHERE user_id = ANY($1))`, [ids]);
    await query(`DELETE FROM wallets WHERE user_id = ANY($1)`, [ids]);
    // ลบ documents
    await query(`DELETE FROM caregiver_documents WHERE user_id = ANY($1)`, [ids]);
    // ลบ profiles
    await query(`DELETE FROM hirer_profiles WHERE user_id = ANY($1)`, [ids]);
    await query(`DELETE FROM caregiver_profiles WHERE user_id = ANY($1)`, [ids]);
    // ลบ patient profiles
    await query(`DELETE FROM patient_profiles WHERE hirer_id = ANY($1)`, [ids]);
    // ลบ users
    await query(`DELETE FROM users WHERE id = ANY($1)`, [ids]);
  }
  console.log('[Demo Seed] Reset complete.');
}

// ─── Create User ───
async function createUser(email, role, opts = {}) {
  const id = uid();
  const passwordHash = hash(DEMO_PASSWORD);
  await query(
    `INSERT INTO users (id, email, password_hash, account_type, role, status, is_email_verified, is_phone_verified, trust_level, trust_score, completed_jobs_count, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
     ON CONFLICT (email) DO UPDATE SET
       role = EXCLUDED.role, status = EXCLUDED.status, trust_level = EXCLUDED.trust_level,
       trust_score = EXCLUDED.trust_score, completed_jobs_count = EXCLUDED.completed_jobs_count,
       updated_at = NOW()
     RETURNING id`,
    [id, email, passwordHash, opts.account_type || 'guest', role, opts.status || 'active',
     opts.email_verified !== false, opts.phone_verified || false,
     opts.trust_level || 'L0', opts.trust_score || 0, opts.completed_jobs || 0, ago(opts.age_days || 30)]
  );
  const userId = (await query(`SELECT id FROM users WHERE email = $1`, [email])).rows[0].id;
  return userId;
}

// ─── Create Wallet ───
async function createWallet(userId, type, balance = 0) {
  await query(
    `INSERT INTO wallets (id, user_id, wallet_type, available_balance, held_balance, currency, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 0, 'THB', NOW(), NOW())
     ON CONFLICT DO NOTHING`,
    [uid(), userId, type, balance]
  );
}

// ─── Main Seed ───
async function seed() {
  console.log('[Demo Seed] Starting...');
  
  const pwHash = hash(DEMO_PASSWORD);

  // ════════════════════════════════════════
  // 1. ADMIN ACCOUNTS
  // ════════════════════════════════════════
  console.log('[Demo Seed] Creating admins...');
  const adminSuper = await createUser('admin.super@demo.careconnect.local', 'admin', { trust_level: 'L3', trust_score: 100, email_verified: true });
  const adminMod = await createUser('admin.moderator@demo.careconnect.local', 'admin', { trust_level: 'L3', trust_score: 100, email_verified: true });
  const adminSupport = await createUser('admin.support@demo.careconnect.local', 'admin', { trust_level: 'L3', trust_score: 100, email_verified: true });

  // ════════════════════════════════════════
  // 2. HIRER ACCOUNTS (7 types)
  // ════════════════════════════════════════
  console.log('[Demo Seed] Creating hirers...');
  const hirerNew = await createUser('hirer.new@demo.careconnect.local', 'hirer', { trust_level: 'L0', age_days: 2 });
  const hirerRegular = await createUser('hirer.regular@demo.careconnect.local', 'hirer', { trust_level: 'L1', trust_score: 60, completed_jobs: 5, phone_verified: true, age_days: 90 });
  const hirerVip = await createUser('hirer.vip@demo.careconnect.local', 'hirer', { trust_level: 'L2', trust_score: 85, completed_jobs: 25, phone_verified: true, age_days: 365 });
  const hirerDisputed = await createUser('hirer.disputed@demo.careconnect.local', 'hirer', { trust_level: 'L1', trust_score: 45, completed_jobs: 8, phone_verified: true });
  const hirerComplainer = await createUser('hirer.complainer@demo.careconnect.local', 'hirer', { trust_level: 'L1', trust_score: 50, completed_jobs: 3, phone_verified: true });
  const hirerRich = await createUser('hirer.rich@demo.careconnect.local', 'hirer', { trust_level: 'L2', trust_score: 80, completed_jobs: 15, phone_verified: true });
  const hirerBroke = await createUser('hirer.broke@demo.careconnect.local', 'hirer', { trust_level: 'L1', trust_score: 40, completed_jobs: 2, phone_verified: true });

  // Hirer profiles
  const hirers = [
    { id: hirerNew, name: 'คุณใหม่ (ผู้ว่าจ้างใหม่)', district: 'วัฒนา', province: 'กรุงเทพมหานคร' },
    { id: hirerRegular, name: 'คุณประจำ (ผู้ว่าจ้างประจำ)', district: 'จตุจักร', province: 'กรุงเทพมหานคร' },
    { id: hirerVip, name: 'คุณวีไอพี (VIP)', district: 'สาทร', province: 'กรุงเทพมหานคร' },
    { id: hirerDisputed, name: 'คุณพิพาท (เคย dispute)', district: 'บางนา', province: 'กรุงเทพมหานคร' },
    { id: hirerComplainer, name: 'คุณร้องเรียน (เคยร้องเรียน)', district: 'ลาดพร้าว', province: 'กรุงเทพมหานคร' },
    { id: hirerRich, name: 'คุณมีเงิน (ยอดสูง)', district: 'สุขุมวิท', province: 'กรุงเทพมหานคร' },
    { id: hirerBroke, name: 'คุณหมดตัว (ยอดต่ำ)', district: 'บางแค', province: 'กรุงเทพมหานคร' },
  ];
  for (const h of hirers) {
    await query(
      `INSERT INTO hirer_profiles (user_id, display_name, district, province, updated_at)
       VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name`,
      [h.id, h.name, h.district, h.province]
    );
  }

  // Wallets
  await createWallet(hirerNew, 'hirer', 0);
  await createWallet(hirerRegular, 'hirer', 5000);
  await createWallet(hirerVip, 'hirer', 50000);
  await createWallet(hirerDisputed, 'hirer', 3000);
  await createWallet(hirerComplainer, 'hirer', 2000);
  await createWallet(hirerRich, 'hirer', 200000);
  await createWallet(hirerBroke, 'hirer', 50);

  // Patient profiles for hirers
  const patientIds = {};
  for (const h of [hirerRegular, hirerVip, hirerDisputed]) {
    const pid = uid();
    patientIds[h] = pid;
    await query(
      `INSERT INTO patient_profiles (id, hirer_id, patient_display_name, gender, age_band, mobility_level, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW()) ON CONFLICT DO NOTHING`,
      [pid, h, h === hirerVip ? 'คุณแม่วีไอพี' : h === hirerDisputed ? 'คุณพ่อพิพาท' : 'คุณยายประจำ', 'female', '75_89', h === hirerDisputed ? 'wheelchair' : 'walk_assisted']
    );
  }

  // ════════════════════════════════════════
  // 3. CAREGIVER ACCOUNTS (10 types)
  // ════════════════════════════════════════
  console.log('[Demo Seed] Creating caregivers...');
  const cgNewbie = await createUser('cg.newbie@demo.careconnect.local', 'caregiver', { trust_level: 'L0', age_days: 3 });
  const cgExpert = await createUser('cg.expert@demo.careconnect.local', 'caregiver', { trust_level: 'L3', trust_score: 95, completed_jobs: 80, phone_verified: true, age_days: 500 });
  const cgHighRating = await createUser('cg.highrating@demo.careconnect.local', 'caregiver', { trust_level: 'L2', trust_score: 90, completed_jobs: 45, phone_verified: true });
  const cgLowRating = await createUser('cg.lowrating@demo.careconnect.local', 'caregiver', { trust_level: 'L1', trust_score: 35, completed_jobs: 12, phone_verified: true });
  const cgNoCert = await createUser('cg.nocert@demo.careconnect.local', 'caregiver', { trust_level: 'L1', trust_score: 55, completed_jobs: 8, phone_verified: true });
  const cgManyCerts = await createUser('cg.manycerts@demo.careconnect.local', 'caregiver', { trust_level: 'L3', trust_score: 92, completed_jobs: 60, phone_verified: true });
  const cgReported = await createUser('cg.reported@demo.careconnect.local', 'caregiver', { trust_level: 'L1', trust_score: 30, completed_jobs: 5, phone_verified: true });
  const cgSuspended = await createUser('cg.suspended@demo.careconnect.local', 'caregiver', { trust_level: 'L1', trust_score: 20, completed_jobs: 3, phone_verified: true, status: 'suspended' });
  const cgFlexible = await createUser('cg.flexible@demo.careconnect.local', 'caregiver', { trust_level: 'L2', trust_score: 75, completed_jobs: 22, phone_verified: true });
  const cgWeekend = await createUser('cg.weekend@demo.careconnect.local', 'caregiver', { trust_level: 'L2', trust_score: 70, completed_jobs: 15, phone_verified: true });

  const caregivers = [
    { id: cgNewbie, name: 'น้องใหม่ (มือใหม่)', bio: 'เพิ่งเริ่มทำงานดูแลผู้สูงอายุ ตั้งใจเรียนรู้', exp: 0, certs: [], specs: ['companionship'], days: [1,2,3,4,5], from: '09:00', to: '17:00' },
    { id: cgExpert, name: 'พี่เก่ง (ประสบการณ์สูง)', bio: 'ประสบการณ์ดูแลผู้สูงอายุกว่า 10 ปี มีใบรับรองครบ', exp: 10, certs: ['nursing_license','cpr_certified','dementia_specialist'], specs: ['medical_monitoring','dementia_care','post_surgery'], days: [0,1,2,3,4,5,6], from: '06:00', to: '22:00' },
    { id: cgHighRating, name: 'คุณดี (คะแนนสูง)', bio: 'ได้รับความไว้วางใจจากผู้ว่าจ้างจำนวนมาก คะแนนรีวิวสูง', exp: 5, certs: ['basic_first_aid','safe_transfer'], specs: ['companionship','personal_care'], days: [1,2,3,4,5], from: '08:00', to: '18:00' },
    { id: cgLowRating, name: 'คุณต่ำ (คะแนนต่ำ)', bio: 'พร้อมรับงานทุกประเภท', exp: 2, certs: ['basic_first_aid'], specs: ['companionship'], days: [1,3,5], from: '10:00', to: '16:00' },
    { id: cgNoCert, name: 'คุณเปล่า (ไม่มีใบรับรอง)', bio: 'มีประสบการณ์ดูแลจริงแต่ยังไม่มีใบรับรอง', exp: 3, certs: [], specs: ['companionship','personal_care'], days: [1,2,3,4,5], from: '08:00', to: '17:00' },
    { id: cgManyCerts, name: 'คุณครบ (ใบรับรองเยอะ)', bio: 'มีใบรับรองครบทุกด้าน พร้อมรับงานเฉพาะทาง', exp: 8, certs: ['nursing_license','cpr_certified','dementia_specialist','wound_care','catheter_care','medication_management'], specs: ['medical_monitoring','dementia_care','post_surgery','emergency'], days: [0,1,2,3,4,5,6], from: '07:00', to: '21:00' },
    { id: cgReported, name: 'คุณถูกรายงาน (ถูก report)', bio: 'รับงานดูแลทั่วไป', exp: 1, certs: ['basic_first_aid'], specs: ['companionship'], days: [1,2,3], from: '09:00', to: '15:00' },
    { id: cgSuspended, name: 'คุณถูกระงับ (suspended)', bio: 'บัญชีถูกระงับชั่วคราว', exp: 1, certs: [], specs: ['companionship'], days: [], from: '09:00', to: '17:00' },
    { id: cgFlexible, name: 'คุณยืดหยุ่น (เวลาหลากหลาย)', bio: 'รับงานได้ทุกเวลา ยืดหยุ่นสูง', exp: 4, certs: ['basic_first_aid','safe_transfer'], specs: ['companionship','personal_care','medical_monitoring'], days: [0,1,2,3,4,5,6], from: '06:00', to: '23:00' },
    { id: cgWeekend, name: 'คุณเสาร์อาทิตย์ (weekend only)', bio: 'รับงานเฉพาะเสาร์-อาทิตย์', exp: 2, certs: ['basic_first_aid'], specs: ['companionship','personal_care'], days: [0,6], from: '08:00', to: '20:00' },
  ];

  for (const cg of caregivers) {
    await query(
      `INSERT INTO caregiver_profiles (user_id, display_name, bio, experience_years, certifications, specializations, available_days, available_from, available_to, is_public_profile, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW())
       ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, bio = EXCLUDED.bio, experience_years = EXCLUDED.experience_years`,
      [cg.id, cg.name, cg.bio, cg.exp, `{${cg.certs.join(',')}}`, `{${cg.specs.join(',')}}`, `{${cg.days.join(',')}}`, cg.from, cg.to]
    );
    await createWallet(cg.id, 'caregiver', cg.id === cgExpert ? 30000 : cg.id === cgHighRating ? 15000 : 1000);
  }

  // ════════════════════════════════════════
  // 4. CAREGIVER DOCUMENTS (certificates)
  // ════════════════════════════════════════
  console.log('[Demo Seed] Creating certificates...');
  const certTypes = [
    { type: 'certification', title: 'ใบรับรอง CPR', issuer: 'สภากาชาดไทย' },
    { type: 'certification', title: 'ใบรับรองการดูแลผู้สูงอายุ', issuer: 'กรมอนามัย' },
    { type: 'license', title: 'ใบอนุญาตพยาบาล', issuer: 'สภาพยาบาล' },
    { type: 'training', title: 'ผ่านการอบรมดูแลสมองเสื่อม', issuer: 'สมาคมอัลไซเมอร์' },
    { type: 'certification', title: 'ใบรับรองการดูแลแผล', issuer: 'โรงพยาบาลศิริราช' },
    { type: 'training', title: 'ผ่านการอบรมปฐมพยาบาล', issuer: 'กรมควบคุมโรค' },
  ];
  const certsFor = [
    { userId: cgExpert, certs: [0,1,2,3] },
    { userId: cgManyCerts, certs: [0,1,2,3,4,5] },
    { userId: cgHighRating, certs: [0,5] },
    { userId: cgFlexible, certs: [0,1] },
  ];
  for (const entry of certsFor) {
    for (const ci of entry.certs) {
      const cert = certTypes[ci];
      await query(
        `INSERT INTO caregiver_documents (id, user_id, document_type, title, issuer, issued_date, file_path, file_name, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [uid(), entry.userId, cert.type, cert.title, cert.issuer, ago(365 + ci * 30).split('T')[0], `demo/cert_placeholder.pdf`, `${cert.title}.pdf`]
      );
    }
  }

  // ════════════════════════════════════════
  // 5. JOBS (all statuses)
  // ════════════════════════════════════════
  console.log('[Demo Seed] Creating jobs...');
  
  // Job: posted (open for applications)
  const jobOpen1 = uid();
  await query(
    `INSERT INTO job_posts (id, hirer_id, title, description, job_type, risk_level, scheduled_start_at, scheduled_end_at, address_line1, district, province, hourly_rate, total_hours, total_amount, status, min_trust_level, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'companionship', 'low_risk', $5, $6, 'สุขุมวิท 55', 'วัฒนา', 'กรุงเทพมหานคร', 350, 8, 2800, 'posted', 'L1', NOW(), NOW())`,
    [jobOpen1, hirerRegular, 'งานดูแลคุณยาย ช่วงเช้า', 'ช่วยดูแลคุณยาย อาบน้ำ แต่งตัว ทำอาหาร พาไปเดินเล่น', future(3), future(3.33)]
  );

  const jobOpen2 = uid();
  await query(
    `INSERT INTO job_posts (id, hirer_id, title, description, job_type, risk_level, scheduled_start_at, scheduled_end_at, address_line1, district, province, hourly_rate, total_hours, total_amount, status, min_trust_level, is_urgent, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'emergency', 'high_risk', $5, $6, 'สีลม', 'บางรัก', 'กรุงเทพมหานคร', 500, 12, 6000, 'posted', 'L2', true, NOW(), NOW())`,
    [jobOpen2, hirerVip, 'งานเร่งด่วน ดูแลหลังผ่าตัด', 'ต้องการผู้ดูแลด่วน หลังผ่าตัดสะโพก ต้องมีประสบการณ์', future(1), future(1.5)]
  );

  // Job: assigned (accepted by caregiver)
  const jobAssigned = uid();
  const jobAssignedInstance = uid();
  await query(
    `INSERT INTO job_posts (id, hirer_id, title, description, job_type, risk_level, scheduled_start_at, scheduled_end_at, address_line1, district, province, hourly_rate, total_hours, total_amount, status, min_trust_level, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'personal_care', 'low_risk', $5, $6, 'รัชดาภิเษก', 'ห้วยขวาง', 'กรุงเทพมหานคร', 380, 8, 3040, 'assigned', 'L1', $7, NOW())`,
    [jobAssigned, hirerRegular, 'ดูแลคุณยายช่วงบ่าย', 'ช่วยกิจวัตรประจำวัน อาบน้ำ แต่งตัว ทำอาหาร', future(5), future(5.33), ago(2)]
  );
  await query(
    `INSERT INTO jobs (id, job_post_id, hirer_id, status, assigned_at, created_at, updated_at) VALUES ($1, $2, $3, 'assigned', NOW(), NOW(), NOW())`,
    [jobAssignedInstance, jobAssigned, hirerRegular]
  );
  await query(
    `INSERT INTO job_assignments (id, job_id, job_post_id, caregiver_id, status, assigned_at, created_at, updated_at) VALUES ($1, $2, $3, $4, 'active', NOW(), NOW(), NOW())`,
    [uid(), jobAssignedInstance, jobAssigned, cgHighRating]
  );

  // Job: in_progress
  const jobInProgress = uid();
  const jobInProgressInstance = uid();
  await query(
    `INSERT INTO job_posts (id, hirer_id, title, description, job_type, risk_level, scheduled_start_at, scheduled_end_at, address_line1, district, province, hourly_rate, total_hours, total_amount, status, min_trust_level, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'medical_monitoring', 'low_risk', $5, $6, 'สาทร', 'สาทร', 'กรุงเทพมหานคร', 420, 10, 4200, 'in_progress', 'L1', $7, NOW())`,
    [jobInProgress, hirerVip, 'ดูแลคุณแม่ VIP ประจำวัน', 'ดูแลการกินยา วัดความดัน วัดน้ำตาล', ago(0), future(0.42), ago(3)]
  );
  await query(
    `INSERT INTO jobs (id, job_post_id, hirer_id, status, assigned_at, started_at, created_at, updated_at) VALUES ($1, $2, $3, 'in_progress', $4, $5, $4, NOW())`,
    [jobInProgressInstance, jobInProgress, hirerVip, ago(1), ago(0)]
  );
  await query(
    `INSERT INTO job_assignments (id, job_id, job_post_id, caregiver_id, status, assigned_at, start_confirmed_at, created_at, updated_at) VALUES ($1, $2, $3, $4, 'active', $5, $6, $5, NOW())`,
    [uid(), jobInProgressInstance, jobInProgress, cgExpert, ago(1), ago(0)]
  );

  // Job: completed
  const jobCompleted = uid();
  const jobCompletedInstance = uid();
  await query(
    `INSERT INTO job_posts (id, hirer_id, title, description, job_type, risk_level, scheduled_start_at, scheduled_end_at, address_line1, district, province, hourly_rate, total_hours, total_amount, status, min_trust_level, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'companionship', 'low_risk', $5, $6, 'จตุจักร', 'จตุจักร', 'กรุงเทพมหานคร', 300, 6, 1800, 'completed', 'L1', $7, NOW())`,
    [jobCompleted, hirerRegular, 'พาคุณยายไปหาหมอ (เสร็จแล้ว)', 'พาไปโรงพยาบาลและรับยากลับบ้าน', ago(10), ago(9.75), ago(12)]
  );
  await query(
    `INSERT INTO jobs (id, job_post_id, hirer_id, status, assigned_at, started_at, completed_at, created_at, updated_at) VALUES ($1, $2, $3, 'completed', $4, $5, $6, $4, NOW())`,
    [jobCompletedInstance, jobCompleted, hirerRegular, ago(11), ago(10), ago(9.75)]
  );
  await query(
    `INSERT INTO job_assignments (id, job_id, job_post_id, caregiver_id, status, assigned_at, start_confirmed_at, end_confirmed_at, created_at, updated_at) VALUES ($1, $2, $3, $4, 'completed', $5, $6, $7, $5, NOW())`,
    [uid(), jobCompletedInstance, jobCompleted, cgHighRating, ago(11), ago(10), ago(9.75)]
  );

  // Job: cancelled
  const jobCancelled = uid();
  await query(
    `INSERT INTO job_posts (id, hirer_id, title, description, job_type, risk_level, scheduled_start_at, scheduled_end_at, address_line1, district, province, hourly_rate, total_hours, total_amount, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'companionship', 'low_risk', $5, $6, 'บางนา', 'บางนา', 'กรุงเทพมหานคร', 300, 4, 1200, 'cancelled', $7, NOW())`,
    [jobCancelled, hirerDisputed, 'งานยกเลิก — ไม่สะดวก', 'ยกเลิกเนื่องจากเปลี่ยนแผน', ago(5), ago(4.83), ago(7)]
  );

  // Job: draft
  const jobDraft = uid();
  await query(
    `INSERT INTO job_posts (id, hirer_id, title, description, job_type, risk_level, scheduled_start_at, scheduled_end_at, hourly_rate, total_hours, total_amount, status, address_line1, province, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'companionship', 'low_risk', $5, $6, 350, 8, 2800, 'draft', 'สุขุมวิท', 'กรุงเทพมหานคร', NOW(), NOW())`,
    [jobDraft, hirerNew, 'แบบร่าง — ยังไม่เสร็จ', 'กำลังกรอกข้อมูล', future(7), future(7.33)]
  );

  // ════════════════════════════════════════
  // 6. CHAT MESSAGES
  // ════════════════════════════════════════
  console.log('[Demo Seed] Creating chat threads & messages...');
  // Chat for in-progress job
  const threadId = uid();
  await query(
    `INSERT INTO chat_threads (id, job_id, status, created_at, updated_at) VALUES ($1, $2, 'open', NOW(), NOW()) ON CONFLICT DO NOTHING`,
    [threadId, jobInProgressInstance]
  );
  const chatMsgs = [
    { sender: hirerVip, content: 'สวัสดีค่ะ พรุ่งนี้คุณแม่ต้องกินยาตอน 8 โมงนะคะ' },
    { sender: cgExpert, content: 'รับทราบครับ จะไปถึงก่อน 7:30' },
    { sender: hirerVip, content: 'ขอบคุณค่ะ คุณแม่ชอบดื่มนมอุ่นตอนเช้าด้วยนะคะ' },
    { sender: cgExpert, content: 'เตรียมให้ครับ มีอะไรแจ้งมาได้เลยครับ' },
    { sender: hirerVip, content: 'วันนี้คุณแม่อาการดีขึ้นมากเลยค่ะ ขอบคุณนะคะ ❤️' },
  ];
  for (const [i, msg] of chatMsgs.entries()) {
    await query(
      `INSERT INTO chat_messages (id, thread_id, sender_id, type, content, created_at) VALUES ($1, $2, $3, 'text', $4, $5)`,
      [uid(), threadId, msg.sender, msg.content, new Date(Date.now() - (chatMsgs.length - i) * 3600000).toISOString()]
    );
  }

  // ════════════════════════════════════════
  // 7. REVIEWS & RATINGS
  // ════════════════════════════════════════
  console.log('[Demo Seed] Creating reviews...');
  const reviews = [
    { jobId: jobCompletedInstance, jobPostId: jobCompleted, reviewer: hirerRegular, caregiver: cgHighRating, rating: 5, comment: 'ดูแลดีมาก เอาใจใส่ ตรงต่อเวลา แนะนำเลยค่ะ' },
    { jobId: jobCompletedInstance, jobPostId: jobCompleted, reviewer: hirerVip, caregiver: cgExpert, rating: 5, comment: 'มืออาชีพมาก ดูแลคุณแม่ได้ดีเยี่ยม' },
    { jobId: jobCompletedInstance, jobPostId: jobCompleted, reviewer: hirerRegular, caregiver: cgExpert, rating: 4, comment: 'ดี แต่มาสายนิดหน่อย' },
    { jobId: jobCompletedInstance, jobPostId: jobCompleted, reviewer: hirerDisputed, caregiver: cgLowRating, rating: 2, comment: 'ไม่ค่อยใส่ใจ ต้องคอยบอกตลอด' },
    { jobId: jobCompletedInstance, jobPostId: jobCompleted, reviewer: hirerComplainer, caregiver: cgLowRating, rating: 1, comment: 'มาสายมากและไม่ทำงานตามที่ตกลง' },
    { jobId: jobCompletedInstance, jobPostId: jobCompleted, reviewer: hirerRegular, caregiver: cgFlexible, rating: 4, comment: 'ยืดหยุ่นดี รับงานกระชั้นชิดได้' },
    { jobId: jobCompletedInstance, jobPostId: jobCompleted, reviewer: hirerVip, caregiver: cgHighRating, rating: 5, comment: 'ประทับใจมาก จะจ้างอีกแน่นอน' },
    { jobId: jobCompletedInstance, jobPostId: jobCompleted, reviewer: hirerVip, caregiver: cgManyCerts, rating: 5, comment: 'มีความรู้ดี อธิบายอาการให้ฟังได้ชัดเจน' },
  ];
  for (const r of reviews) {
    await query(
      `INSERT INTO caregiver_reviews (id, job_id, job_post_id, reviewer_id, caregiver_id, rating, comment, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
      [uid(), r.jobId, r.jobPostId, r.reviewer, r.caregiver, r.rating, r.comment, ago(Math.random() * 30)]
    );
  }

  // ════════════════════════════════════════
  // 8. COMPLAINTS & DISPUTES
  // ════════════════════════════════════════
  console.log('[Demo Seed] Creating complaints & disputes...');
  
  // Complaints
  const complaintCategories = [
    { reporter: hirerComplainer, category: 'inappropriate_name', subject: 'ชื่อผู้ดูแลไม่เหมาะสม', desc: 'พบชื่อผู้ดูแลที่ใช้คำหยาบ', status: 'open' },
    { reporter: hirerComplainer, category: 'fake_certificate', subject: 'ใบรับรองน่าสงสัย', desc: 'ใบรับรองของผู้ดูแลดูเหมือนปลอม ออกจากสถาบันที่ไม่มีอยู่จริง', status: 'in_review', target: cgReported },
    { reporter: hirerDisputed, category: 'scam_fraud', subject: 'สงสัยหลอกลวง', desc: 'ผู้ดูแลไม่มาทำงานแต่เรียกเก็บเงิน', status: 'open', target: cgLowRating },
    { reporter: hirerVip, category: 'service_quality', subject: 'คุณภาพบริการต่ำ', desc: 'ผู้ดูแลไม่ทำตามที่ตกลง ดูแลไม่ดี', status: 'resolved' },
    { reporter: hirerRegular, category: 'safety_concern', subject: 'ปัญหาความปลอดภัย', desc: 'ผู้ดูแลปล่อยผู้สูงอายุนั่งรถเข็นโดยไม่เบรก', status: 'open' },
  ];
  for (const c of complaintCategories) {
    await query(
      `INSERT INTO complaints (id, reporter_id, category, target_user_id, subject, description, status, created_at, updated_at, resolved_at, assigned_admin_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7::complaint_status, $8, NOW(), $9, $10)`,
      [uid(), c.reporter, c.category, c.target || null, c.subject, c.desc, c.status, ago(Math.random() * 14),
       c.status === 'resolved' ? ago(1) : null,
       c.status === 'in_review' ? adminMod : null]
    );
  }

  // ════════════════════════════════════════
  // 9. NOTIFICATIONS
  // ════════════════════════════════════════
  console.log('[Demo Seed] Creating notifications...');
  const notifTemplates = [
    { userId: hirerRegular, title: 'ผู้ดูแลตอบรับงาน', body: 'คุณดี ตอบรับงาน "ดูแลคุณยายช่วงบ่าย" แล้ว', ref_type: 'job' },
    { userId: hirerVip, title: 'งานกำลังดำเนินการ', body: 'ผู้ดูแลเช็คอินแล้ว งาน "ดูแลคุณแม่ VIP"', ref_type: 'job' },
    { userId: cgExpert, title: 'งานใหม่สำหรับคุณ', body: 'มีงานใหม่ที่เหมาะกับคุณ ดูรายละเอียด', ref_type: 'job' },
    { userId: cgHighRating, title: 'ได้รับรีวิวใหม่', body: 'ผู้ว่าจ้างให้ 5 ดาว "ดูแลดีมาก"', ref_type: 'job' },
    { userId: hirerComplainer, title: 'เรื่องร้องเรียนอัปเดต', body: 'แอดมินกำลังตรวจสอบเรื่องร้องเรียนของคุณ', ref_type: 'job' },
    { userId: cgReported, title: 'แจ้งเตือนจากระบบ', body: 'มีผู้ร้องเรียนเกี่ยวกับบัญชีของคุณ กรุณาตรวจสอบ', ref_type: 'job' },
  ];
  for (const n of notifTemplates) {
    await query(
      `INSERT INTO notifications (id, user_id, channel, template_key, title, body, reference_type, status, created_at)
       VALUES ($1, $2, 'in_app', 'demo', $3, $4, $5, 'sent', $6)`,
      [uid(), n.userId, n.title, n.body, n.ref_type, ago(Math.random() * 7)]
    );
  }

  // ════════════════════════════════════════
  // 10. PLACEHOLDER FILES
  // ════════════════════════════════════════
  console.log('[Demo Seed] Creating placeholder files...');
  const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
  const demoDir = path.join(uploadDir, 'demo');
  try {
    fs.mkdirSync(demoDir, { recursive: true });
    // Create a simple placeholder PDF
    const placeholderContent = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF';
    fs.writeFileSync(path.join(demoDir, 'cert_placeholder.pdf'), placeholderContent);
    console.log('[Demo Seed] Placeholder files created.');
  } catch (err) {
    console.warn('[Demo Seed] Could not create placeholder files:', err.message);
  }

  console.log('[Demo Seed] ✅ Complete!');
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('  DEMO ACCOUNTS');
  console.log('  Password for all: ' + DEMO_PASSWORD);
  console.log('═══════════════════════════════════════');
  console.log('');
  console.log('ADMIN:');
  console.log('  admin.super@demo.careconnect.local');
  console.log('  admin.moderator@demo.careconnect.local');
  console.log('  admin.support@demo.careconnect.local');
  console.log('');
  console.log('HIRER:');
  console.log('  hirer.new@demo.careconnect.local       (ใหม่ / L0)');
  console.log('  hirer.regular@demo.careconnect.local    (ประจำ / L1)');
  console.log('  hirer.vip@demo.careconnect.local        (VIP / L2)');
  console.log('  hirer.disputed@demo.careconnect.local   (เคย dispute / L1)');
  console.log('  hirer.complainer@demo.careconnect.local (เคยร้องเรียน / L1)');
  console.log('  hirer.rich@demo.careconnect.local       (เงินเยอะ / L2)');
  console.log('  hirer.broke@demo.careconnect.local      (เงินน้อย / L1)');
  console.log('');
  console.log('CAREGIVER:');
  console.log('  cg.newbie@demo.careconnect.local        (มือใหม่ / L0)');
  console.log('  cg.expert@demo.careconnect.local        (ประสบการณ์สูง / L3)');
  console.log('  cg.highrating@demo.careconnect.local    (คะแนนสูง / L2)');
  console.log('  cg.lowrating@demo.careconnect.local     (คะแนนต่ำ / L1)');
  console.log('  cg.nocert@demo.careconnect.local        (ไม่มีใบรับรอง / L1)');
  console.log('  cg.manycerts@demo.careconnect.local     (ใบรับรองเยอะ / L3)');
  console.log('  cg.reported@demo.careconnect.local      (ถูก report / L1)');
  console.log('  cg.suspended@demo.careconnect.local     (ถูกระงับ / suspended)');
  console.log('  cg.flexible@demo.careconnect.local      (ยืดหยุ่น / L2)');
  console.log('  cg.weekend@demo.careconnect.local       (เสาร์-อาทิตย์ / L2)');
  console.log('');
  console.log('Reset: node src/seeds/demoSeed.js --reset');
  console.log('═══════════════════════════════════════');
}

// ─── Main ───
async function main() {
  try {
    const isReset = process.argv.includes('--reset');
    
    if (isReset) {
      await resetDemo();
    }
    
    await seed();
  } catch (err) {
    console.error('[Demo Seed] Error:', err);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();
