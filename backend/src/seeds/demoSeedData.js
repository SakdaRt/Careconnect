/**
 * CareConnect Demo Seed Data
 * ข้อมูลจำลองสำหรับเดโมโปรเจกต์จบ
 *
 * ใช้ email @careconnect.local เพื่อให้ test cleanup preserve
 * Password ทุก persona: DemoSeed123!
 */

// ============================================================================
// Timeline helpers
// ============================================================================
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9, 0, 0, 0);
  return d;
}

function daysAgoAt(n, hour, min = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, min, 0, 0);
  return d;
}

function daysFromNow(n, hour = 9) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

// ============================================================================
// 1. BANKS Master Data (Thai banks)
// ============================================================================
export const BANKS = [
  { code: "BBL", full_name_th: "ธนาคารกรุงเทพ", full_name_en: "Bangkok Bank" },
  { code: "KBANK", full_name_th: "ธนาคารกสิกรไทย", full_name_en: "Kasikornbank" },
  { code: "SCB", full_name_th: "ธนาคารไทยพาณิชย์", full_name_en: "Siam Commercial Bank" },
  { code: "KTB", full_name_th: "ธนาคารกรุงไทย", full_name_en: "Krungthai Bank" },
  { code: "TTB", full_name_th: "ธนาคารทหารไทยธนชาต", full_name_en: "TMBThanachart Bank" },
  { code: "BAY", full_name_th: "ธนาคารกรุงศรีอยุธยา", full_name_en: "Bank of Ayudhya" },
  { code: "GSB", full_name_th: "ธนาคารออมสิน", full_name_en: "Government Savings Bank" },
  { code: "CIMBT", full_name_th: "ธนาคารซีไอเอ็มบีไทย", full_name_en: "CIMB Thai Bank" },
  { code: "TISCO", full_name_th: "ธนาคารทิสโก้", full_name_en: "Tisco Bank" },
  { code: "LH", full_name_th: "ธนาคารแลนด์ แอนด์ เฮ้าส์", full_name_en: "Land and Houses Bank" },
];

// ============================================================================
// 2. PERSONA Users (ตัวละครหลักสำหรับเดโม)
// ============================================================================
export const PERSONAS = {
  // --- Hirers ---
  hirerMain: {
    email: "demo.somsri@careconnect.local",
    phone_number: "0891234001",
    account_type: "member",
    role: "hirer",
    display_name: "สมศรี วงศ์ดี",
    full_name: "สมศรี วงศ์ดี",
    trust_level: "L2",
    trust_score: 75,
    is_email_verified: true,
    is_phone_verified: true,
    completed_jobs_count: 5,
    created_at: daysAgo(28),
    address_line1: "123/45 ซอยสุขุมวิท 55",
    district: "วัฒนา",
    province: "กรุงเทพมหานคร",
    postal_code: "10110",
    lat: 13.7308,
    lng: 100.5695,
    kyc_status: "approved",
    kyc_verified_at: daysAgo(26),
  },
  hirerSecondary: {
    email: "demo.wichai@careconnect.local",
    phone_number: "0891234002",
    account_type: "member",
    role: "hirer",
    display_name: "วิชัย สุขสันต์",
    full_name: "วิชัย สุขสันต์",
    trust_level: "L1",
    trust_score: 55,
    is_email_verified: true,
    is_phone_verified: true,
    completed_jobs_count: 1,
    created_at: daysAgo(10),
    address_line1: "88/12 ถนนรัชดาภิเษก",
    district: "ห้วยขวาง",
    province: "กรุงเทพมหานคร",
    postal_code: "10310",
    lat: 13.7650,
    lng: 100.5743,
  },
  hirerNew: {
    email: "demo.napa@careconnect.local",
    account_type: "guest",
    role: "hirer",
    display_name: "นภา ใจดี",
    trust_level: "L0",
    trust_score: 50,
    is_email_verified: false,
    is_phone_verified: false,
    completed_jobs_count: 0,
    created_at: daysAgo(1),
  },

  // --- Caregivers ---
  caregiverMain: {
    email: "demo.pim@careconnect.local",
    phone_number: "0891234011",
    account_type: "member",
    role: "caregiver",
    display_name: "พิมพ์ชนก ศรีสุข",
    full_name: "พิมพ์ชนก ศรีสุข",
    trust_level: "L3",
    trust_score: 88,
    is_email_verified: true,
    is_phone_verified: true,
    completed_jobs_count: 12,
    created_at: daysAgo(28),
    bio: "พยาบาลวิชาชีพ ประสบการณ์ดูแลผู้สูงอายุ 6 ปี เชี่ยวชาญดูแลผู้ป่วยหลังผ่าตัดและโรคเรื้อรัง",
    experience_years: 6,
    certifications: ["basic_first_aid", "post_surgery_care", "vitals_monitoring", "medication_management"],
    specializations: ["personal_care", "medical_monitoring", "post_surgery"],
    available_from: "07:00",
    available_to: "19:00",
    available_days: [1, 2, 3, 4, 5],
    kyc_status: "approved",
    kyc_verified_at: daysAgo(26),
    has_bank_account: true,
    bank_code: "KBANK",
    account_number_last4: "7890",
    account_name: "พิมพ์ชนก ศรีสุข",
  },
  caregiverSecondary: {
    email: "demo.thiti@careconnect.local",
    phone_number: "0891234012",
    account_type: "member",
    role: "caregiver",
    display_name: "ธิติ พงษ์เจริญ",
    full_name: "ธิติ พงษ์เจริญ",
    trust_level: "L2",
    trust_score: 72,
    is_email_verified: true,
    is_phone_verified: true,
    completed_jobs_count: 4,
    created_at: daysAgo(14),
    bio: "ดูแลผู้ป่วยติดเตียงและช่วยกิจกรรมบำบัด มีใจรักงานบริการ",
    experience_years: 3,
    certifications: ["basic_first_aid", "safe_transfer"],
    specializations: ["companionship", "personal_care"],
    available_from: "08:00",
    available_to: "20:00",
    available_days: [0, 1, 2, 3, 4, 5, 6],
    kyc_status: "approved",
    kyc_verified_at: daysAgo(12),
  },
  caregiverNew: {
    email: "demo.malee@careconnect.local",
    phone_number: "0891234013",
    account_type: "member",
    role: "caregiver",
    display_name: "มาลี จันทร์สว่าง",
    full_name: "มาลี จันทร์สว่าง",
    trust_level: "L1",
    trust_score: 55,
    is_email_verified: true,
    is_phone_verified: true,
    completed_jobs_count: 0,
    created_at: daysAgo(3),
    bio: "เพิ่งเริ่มงานดูแลผู้สูงอายุ มีความตั้งใจและพร้อมเรียนรู้",
    experience_years: 1,
    certifications: ["basic_first_aid"],
    specializations: ["companionship"],
    available_from: "09:00",
    available_to: "18:00",
    available_days: [1, 2, 3, 4, 5],
  },
  caregiverBanned: {
    email: "demo.anan@careconnect.local",
    phone_number: "0891234014",
    account_type: "member",
    role: "caregiver",
    display_name: "อนันต์ สายลม",
    full_name: "อนันต์ สายลม",
    trust_level: "L2",
    trust_score: 65,
    is_email_verified: true,
    is_phone_verified: true,
    completed_jobs_count: 3,
    created_at: daysAgo(20),
    bio: "ดูแลผู้ป่วยทั่วไป",
    experience_years: 4,
    certifications: ["basic_first_aid", "safe_transfer"],
    specializations: ["companionship", "personal_care"],
    available_from: "08:00",
    available_to: "18:00",
    available_days: [1, 2, 3, 4, 5],
    ban_job_accept: true,
    admin_note: "ถูกระงับสิทธิ์รับงานชั่วคราว เนื่องจากไม่มาตามนัด 2 ครั้งติดต่อกัน",
    kyc_status: "approved",
    kyc_verified_at: daysAgo(18),
  },
};

// ============================================================================
// 3. PATIENT PROFILES (ผู้รับดูแล)
// ============================================================================
export const PATIENT_PROFILES = [
  {
    owner: "hirerMain",
    patient_display_name: "คุณยายสมจิตร",
    address_line1: "123/45 ซอยสุขุมวิท 55",
    district: "วัฒนา",
    province: "กรุงเทพมหานคร",
    postal_code: "10110",
    lat: 13.7308,
    lng: 100.5695,
    birth_year: 1948,
    age_band: "70-80",
    gender: "female",
    mobility_level: "needs_assistance",
    communication_style: "verbal",
    general_health_summary: "โรคเบาหวานชนิดที่ 2 ความดันโลหิตสูง เข่าเสื่อมทั้ง 2 ข้าง",
    chronic_conditions_flags: ["diabetes", "hypertension", "osteoarthritis"],
    cognitive_status: "normal",
    symptoms_flags: [],
    medical_devices_flags: [],
    care_needs_flags: ["medication_reminder", "mobility_assist", "meal_prep"],
    behavior_risks_flags: [],
    allergies_flags: ["sulfa_drugs"],
    is_active: true,
    created_at: daysAgo(27),
  },
  {
    owner: "hirerMain",
    patient_display_name: "คุณตาประยุทธ์",
    address_line1: "123/45 ซอยสุขุมวิท 55",
    district: "วัฒนา",
    province: "กรุงเทพมหานคร",
    postal_code: "10110",
    lat: 13.7308,
    lng: 100.5695,
    birth_year: 1940,
    age_band: "80-90",
    gender: "male",
    mobility_level: "wheelchair",
    communication_style: "limited",
    general_health_summary: "อัมพฤกษ์ครึ่งซีก ต้องใช้รถเข็น มีภาวะสมองเสื่อมระยะเริ่มต้น",
    chronic_conditions_flags: ["stroke", "dementia_early"],
    cognitive_status: "mild_impairment",
    symptoms_flags: [],
    medical_devices_flags: ["wheelchair"],
    care_needs_flags: ["transfer_assist", "bathing", "feeding", "medication_reminder", "dementia_supervision"],
    behavior_risks_flags: ["wandering"],
    allergies_flags: [],
    is_active: true,
    created_at: daysAgo(27),
  },
  {
    owner: "hirerSecondary",
    patient_display_name: "คุณแม่วันดี",
    address_line1: "88/12 ถนนรัชดาภิเษก",
    district: "ห้วยขวาง",
    province: "กรุงเทพมหานคร",
    postal_code: "10310",
    lat: 13.7650,
    lng: 100.5743,
    birth_year: 1955,
    age_band: "60-70",
    gender: "female",
    mobility_level: "independent",
    communication_style: "verbal",
    general_health_summary: "สุขภาพดีโดยรวม ต้องการเพื่อนดูแลทั่วไป",
    chronic_conditions_flags: ["hypertension"],
    cognitive_status: "normal",
    symptoms_flags: [],
    medical_devices_flags: [],
    care_needs_flags: ["companionship", "meal_prep", "light_housekeeping"],
    behavior_risks_flags: [],
    allergies_flags: [],
    is_active: true,
    created_at: daysAgo(9),
  },
];

// ============================================================================
// 4. JOB SCENARIOS
// ============================================================================

// --- Group A: Completed jobs (ย้อนหลัง) ---
export const COMPLETED_JOBS = [
  {
    id_suffix: "completed-1",
    hirer: "hirerMain",
    caregiver: "caregiverMain",
    patient_index: 0, // คุณยายสมจิตร
    title: "ดูแลคุณยายสมจิตร ช่วยกิจวัตรประจำวัน",
    description: "ช่วยอาบน้ำ เตรียมอาหาร เตือนกินยา พาเดินออกกำลังกายเบาๆ",
    job_type: "personal_care",
    risk_level: "low_risk",
    hourly_rate: 300,
    total_hours: 6,
    // total_amount = 1800, platform_fee = 180 (10%)
    scheduled_start: daysAgoAt(21, 8),
    scheduled_end: daysAgoAt(21, 14),
    address_line1: "123/45 ซอยสุขุมวิท 55",
    district: "วัฒนา",
    province: "กรุงเทพมหานคร",
    postal_code: "10110",
    lat: 13.7308,
    lng: 100.5695,
    job_tasks_flags: ["bathing", "meal_prep", "medication_reminder", "mobility_assist"],
    required_skills_flags: ["basic_first_aid"],
    checkin_at: daysAgoAt(21, 7, 55),
    checkout_at: daysAgoAt(21, 14, 5),
    review: { rating: 5, comment: "พี่พิมพ์ดูแลดีมาก คุณยายชอบมาก ขอบคุณค่ะ" },
    created_at: daysAgo(22),
    posted_at: daysAgo(22),
    assigned_at: daysAgoAt(21, 7, 30),
  },
  {
    id_suffix: "completed-2",
    hirer: "hirerMain",
    caregiver: "caregiverMain",
    patient_index: 0,
    title: "ดูแลคุณยายสมจิตร ตรวจน้ำตาลและความดัน",
    description: "วัดความดัน วัดน้ำตาล เตือนกินยา ดูแลทั่วไป",
    job_type: "medical_monitoring",
    risk_level: "low_risk",
    hourly_rate: 350,
    total_hours: 4,
    scheduled_start: daysAgoAt(14, 9),
    scheduled_end: daysAgoAt(14, 13),
    address_line1: "123/45 ซอยสุขุมวิท 55",
    district: "วัฒนา",
    province: "กรุงเทพมหานคร",
    postal_code: "10110",
    lat: 13.7308,
    lng: 100.5695,
    job_tasks_flags: ["vitals_check", "blood_sugar_check", "medication_reminder"],
    required_skills_flags: ["vitals_monitoring"],
    checkin_at: daysAgoAt(14, 8, 50),
    checkout_at: daysAgoAt(14, 13, 10),
    review: { rating: 4, comment: "ดูแลดี แต่มาสายนิดหน่อย" },
    created_at: daysAgo(16),
    posted_at: daysAgo(15),
    assigned_at: daysAgoAt(14, 8, 30),
  },
  {
    id_suffix: "completed-3",
    hirer: "hirerMain",
    caregiver: "caregiverSecondary",
    patient_index: 1, // คุณตาประยุทธ์
    title: "ดูแลคุณตาประยุทธ์ ช่วยกายภาพบำบัดเบื้องต้น",
    description: "ช่วยพยุงเดิน ย้ายท่า ออกกำลังกายตามคำแนะนำแพทย์",
    job_type: "personal_care",
    risk_level: "low_risk",
    hourly_rate: 280,
    total_hours: 5,
    scheduled_start: daysAgoAt(10, 10),
    scheduled_end: daysAgoAt(10, 15),
    address_line1: "123/45 ซอยสุขุมวิท 55",
    district: "วัฒนา",
    province: "กรุงเทพมหานคร",
    postal_code: "10110",
    lat: 13.7308,
    lng: 100.5695,
    job_tasks_flags: ["transfer_assist", "mobility_assist", "companionship"],
    required_skills_flags: ["safe_transfer"],
    checkin_at: daysAgoAt(10, 9, 58),
    checkout_at: daysAgoAt(10, 15, 2),
    review: { rating: 3, comment: "พอใช้ได้ แต่ยังต้องปรับปรุงบางจุด" },
    created_at: daysAgo(12),
    posted_at: daysAgo(11),
    assigned_at: daysAgoAt(10, 9, 45),
  },
  {
    id_suffix: "completed-4",
    hirer: "hirerSecondary",
    caregiver: "caregiverMain",
    patient_index: 2, // คุณแม่วันดี
    title: "ดูแลคุณแม่วันดี เพื่อนดูแลทั่วไป",
    description: "เป็นเพื่อนคุยและช่วยทำกิจวัตรประจำวัน",
    job_type: "companionship",
    risk_level: "low_risk",
    hourly_rate: 250,
    total_hours: 4,
    scheduled_start: daysAgoAt(7, 9),
    scheduled_end: daysAgoAt(7, 13),
    address_line1: "88/12 ถนนรัชดาภิเษก",
    district: "ห้วยขวาง",
    province: "กรุงเทพมหานคร",
    postal_code: "10310",
    lat: 13.7650,
    lng: 100.5743,
    job_tasks_flags: ["companionship", "meal_prep", "light_housekeeping"],
    required_skills_flags: [],
    checkin_at: daysAgoAt(7, 8, 55),
    checkout_at: daysAgoAt(7, 13, 0),
    review: { rating: 5, comment: "คุณแม่ชอบมากค่ะ พูดจาดี ใจเย็น" },
    created_at: daysAgo(8),
    posted_at: daysAgo(8),
    assigned_at: daysAgoAt(7, 8, 30),
  },
  {
    id_suffix: "completed-5",
    hirer: "hirerMain",
    caregiver: "caregiverMain",
    patient_index: 1, // คุณตาประยุทธ์ - high risk
    title: "ดูแลคุณตาประยุทธ์ ดูแลผู้ป่วยสมองเสื่อม",
    description: "เฝ้าระวังพฤติกรรม ช่วยกิจวัตร ดูแลความปลอดภัย",
    job_type: "dementia_care",
    risk_level: "high_risk",
    hourly_rate: 400,
    total_hours: 8,
    scheduled_start: daysAgoAt(5, 7),
    scheduled_end: daysAgoAt(5, 15),
    address_line1: "123/45 ซอยสุขุมวิท 55",
    district: "วัฒนา",
    province: "กรุงเทพมหานคร",
    postal_code: "10110",
    lat: 13.7308,
    lng: 100.5695,
    min_trust_level: "L2",
    job_tasks_flags: ["dementia_supervision", "bathing", "feeding", "medication_reminder"],
    required_skills_flags: ["dementia_care"],
    checkin_at: daysAgoAt(5, 6, 55),
    checkout_at: daysAgoAt(5, 15, 3),
    review: { rating: 5, comment: "ดูแลดีมาก ระมัดระวัง เข้าใจผู้ป่วยสมองเสื่อม" },
    created_at: daysAgo(6),
    posted_at: daysAgo(6),
    assigned_at: daysAgoAt(5, 6, 30),
  },
];

// --- Group B: Active jobs (กำลังดำเนินอยู่) ---
export const ACTIVE_JOBS = [
  {
    id_suffix: "assigned-1",
    hirer: "hirerMain",
    caregiver: "caregiverSecondary",
    patient_index: 0,
    title: "ดูแลคุณยายสมจิตร ช่วยกิจวัตรเช้า",
    description: "ช่วยอาบน้ำ แต่งตัว เตรียมอาหารเช้า เตือนกินยา",
    job_type: "personal_care",
    risk_level: "low_risk",
    hourly_rate: 300,
    total_hours: 4,
    status: "assigned", // รอ check-in
    scheduled_start: daysFromNow(1, 8),
    scheduled_end: daysFromNow(1, 12),
    address_line1: "123/45 ซอยสุขุมวิท 55",
    district: "วัฒนา",
    province: "กรุงเทพมหานคร",
    postal_code: "10110",
    lat: 13.7308,
    lng: 100.5695,
    job_tasks_flags: ["bathing", "dressing", "meal_prep", "medication_reminder"],
    required_skills_flags: ["basic_first_aid"],
    created_at: daysAgo(2),
    posted_at: daysAgo(2),
    assigned_at: daysAgo(1),
  },
  {
    id_suffix: "inprogress-1",
    hirer: "hirerSecondary",
    caregiver: "caregiverMain",
    patient_index: 2,
    title: "ดูแลคุณแม่วันดี เพื่อนดูแลช่วงบ่าย",
    description: "เป็นเพื่อนพาไปเดินเล่น ช่วยงานบ้านเบาๆ",
    job_type: "companionship",
    risk_level: "low_risk",
    hourly_rate: 250,
    total_hours: 5,
    status: "in_progress", // กำลังทำ
    scheduled_start: daysAgoAt(0, 13),
    scheduled_end: daysAgoAt(0, 18),
    address_line1: "88/12 ถนนรัชดาภิเษก",
    district: "ห้วยขวาง",
    province: "กรุงเทพมหานคร",
    postal_code: "10310",
    lat: 13.7650,
    lng: 100.5743,
    job_tasks_flags: ["companionship", "light_housekeeping", "mobility_assist"],
    required_skills_flags: [],
    checkin_at: daysAgoAt(0, 12, 55),
    created_at: daysAgo(3),
    posted_at: daysAgo(2),
    assigned_at: daysAgo(1),
  },
];

// --- Group C: Posted jobs (เปิดรับอยู่ — เพิ่มจาก 10 ที่มีอยู่) ---
export const POSTED_JOBS = [
  {
    id_suffix: "posted-new-1",
    hirer: "hirerMain",
    patient_index: 0,
    title: "ดูแลคุณยายสมจิตร ช่วยพาไปหาหมอ",
    description: "พาไปตรวจเบาหวานที่ รพ.กรุงเทพ ช่วยลงทะเบียน รอพบแพทย์ รับยา",
    job_type: "companionship",
    risk_level: "low_risk",
    hourly_rate: 320,
    total_hours: 5,
    scheduled_start: daysFromNow(3, 7),
    scheduled_end: daysFromNow(3, 12),
    address_line1: "เพชรบุรีตัดใหม่",
    district: "ห้วยขวาง",
    province: "กรุงเทพมหานคร",
    postal_code: "10310",
    lat: 13.7468,
    lng: 100.5589,
    job_tasks_flags: ["hospital_companion", "hospital_registration_support", "medication_pickup"],
    required_skills_flags: ["basic_first_aid"],
    is_urgent: false,
    created_at: daysAgo(1),
    posted_at: daysAgo(1),
  },
  {
    id_suffix: "posted-new-2",
    hirer: "hirerMain",
    patient_index: 1,
    title: "ดูแลคุณตาประยุทธ์ งานดูแลกลางคืน (high risk)",
    description: "เฝ้าดูแลช่วงกลางคืน เฝ้าระวังพฤติกรรมเดินหลับ ช่วยพลิกตัว",
    job_type: "dementia_care",
    risk_level: "high_risk",
    hourly_rate: 450,
    total_hours: 8,
    min_trust_level: "L2",
    scheduled_start: daysFromNow(2, 20),
    scheduled_end: daysFromNow(3, 4),
    address_line1: "123/45 ซอยสุขุมวิท 55",
    district: "วัฒนา",
    province: "กรุงเทพมหานคร",
    postal_code: "10110",
    lat: 13.7308,
    lng: 100.5695,
    job_tasks_flags: ["dementia_supervision", "transfer_assist", "medication_reminder"],
    required_skills_flags: ["dementia_care"],
    is_urgent: true,
    created_at: daysAgo(1),
    posted_at: daysAgo(1),
  },
  {
    id_suffix: "posted-new-3",
    hirer: "hirerSecondary",
    patient_index: 2,
    title: "เพื่อนดูแลคุณแม่วันดี สุดสัปดาห์",
    description: "เป็นเพื่อนดูแลช่วงวันเสาร์ ช่วยทำอาหาร พูดคุย",
    job_type: "companionship",
    risk_level: "low_risk",
    hourly_rate: 250,
    total_hours: 6,
    scheduled_start: daysFromNow(5, 9),
    scheduled_end: daysFromNow(5, 15),
    address_line1: "88/12 ถนนรัชดาภิเษก",
    district: "ห้วยขวาง",
    province: "กรุงเทพมหานคร",
    postal_code: "10310",
    lat: 13.7650,
    lng: 100.5743,
    job_tasks_flags: ["companionship", "meal_prep"],
    required_skills_flags: [],
    is_urgent: false,
    created_at: daysAgo(2),
    posted_at: daysAgo(2),
  },
];

// --- Group D: Cancelled jobs ---
export const CANCELLED_JOBS = [
  {
    id_suffix: "cancelled-posted",
    hirer: "hirerMain",
    patient_index: 0,
    title: "ดูแลคุณยายสมจิตร (ยกเลิก - เลื่อนนัดหมอ)",
    description: "พาไปหาหมอ — ยกเลิกเนื่องจากเลื่อนนัด",
    job_type: "companionship",
    risk_level: "low_risk",
    hourly_rate: 300,
    total_hours: 4,
    cancel_reason: "แพทย์เลื่อนนัดหมาย ขออภัยด้วยค่ะ",
    was_assigned: false, // ยกเลิกตอน posted
    scheduled_start: daysAgoAt(8, 8),
    scheduled_end: daysAgoAt(8, 12),
    address_line1: "123/45 ซอยสุขุมวิท 55",
    district: "วัฒนา",
    province: "กรุงเทพมหานคร",
    created_at: daysAgo(10),
    posted_at: daysAgo(10),
    cancelled_at: daysAgo(9),
  },
  {
    id_suffix: "cancelled-assigned",
    hirer: "hirerMain",
    caregiver: "caregiverBanned",
    patient_index: 0,
    title: "ดูแลคุณยายสมจิตร (ยกเลิก - ผู้ดูแลไม่มา)",
    description: "ช่วยกิจวัตรประจำวัน — ยกเลิกเพราะผู้ดูแลไม่มาตามนัด",
    job_type: "personal_care",
    risk_level: "low_risk",
    hourly_rate: 300,
    total_hours: 5,
    cancel_reason: "ผู้ดูแลไม่มาตามนัดหมาย",
    was_assigned: true, // ยกเลิกหลัง assign
    scheduled_start: daysAgoAt(15, 8),
    scheduled_end: daysAgoAt(15, 13),
    address_line1: "123/45 ซอยสุขุมวิท 55",
    district: "วัฒนา",
    province: "กรุงเทพมหานคร",
    created_at: daysAgo(17),
    posted_at: daysAgo(17),
    assigned_at: daysAgo(16),
    cancelled_at: daysAgoAt(15, 9),
  },
];

// --- Group E: Draft job ---
export const DRAFT_JOBS = [
  {
    id_suffix: "draft-1",
    hirer: "hirerMain",
    patient_index: 1,
    title: "ดูแลคุณตาประยุทธ์ (ร่าง)",
    description: "ยังไม่ได้กำหนดรายละเอียด",
    job_type: "personal_care",
    risk_level: "low_risk",
    hourly_rate: 300,
    total_hours: 4,
    scheduled_start: daysFromNow(7, 9),
    scheduled_end: daysFromNow(7, 13),
    address_line1: "123/45 ซอยสุขุมวิท 55",
    district: "วัฒนา",
    province: "กรุงเทพมหานคร",
    job_tasks_flags: ["companionship"],
    created_at: daysAgo(0),
  },
];

// ============================================================================
// 5. CAREGIVER DOCUMENTS (for high-risk eligible caregivers)
// ============================================================================
export const CAREGIVER_DOCS = [
  {
    persona: "caregiverMain",
    documents: [
      {
        document_type: "certification",
        title: "ใบรับรองปฐมพยาบาลเบื้องต้น",
        issuer: "สภากาชาดไทย",
        issued_date: "2024-03-15",
        file_path: "uploads/documents/demo-cert-firstaid.pdf",
        file_name: "cert-firstaid.pdf",
        file_size: 245000,
        mime_type: "application/pdf",
      },
      {
        document_type: "license",
        title: "ใบอนุญาตผู้ช่วยพยาบาล",
        issuer: "สภาการพยาบาล",
        issued_date: "2023-06-01",
        file_path: "uploads/documents/demo-license-nursing.pdf",
        file_name: "license-nursing.pdf",
        file_size: 312000,
        mime_type: "application/pdf",
      },
    ],
  },
  {
    persona: "caregiverSecondary",
    documents: [
      {
        document_type: "training",
        title: "ประกาศนียบัตรการดูแลผู้สูงอายุ",
        issuer: "กรมอนามัย กระทรวงสาธารณสุข",
        issued_date: "2024-08-20",
        file_path: "uploads/documents/demo-cert-elderly.pdf",
        file_name: "cert-elderly-care.pdf",
        file_size: 198000,
        mime_type: "application/pdf",
      },
    ],
  },
];

// ============================================================================
// 6. FINANCIAL SCENARIOS
// ============================================================================
export const TOPUP_INTENTS = [
  { persona: "hirerMain", amount: 50000, status: "succeeded", method: "payment_link", created_at: daysAgo(27) },
  { persona: "hirerMain", amount: 30000, status: "succeeded", method: "payment_link", created_at: daysAgo(13) },
  { persona: "hirerMain", amount: 20000, status: "succeeded", method: "payment_link", created_at: daysAgo(4) },
  { persona: "hirerSecondary", amount: 15000, status: "succeeded", method: "payment_link", created_at: daysAgo(9) },
  { persona: "hirerMain", amount: 10000, status: "failed", method: "payment_link", created_at: daysAgo(20) },
];

export const WITHDRAWAL_REQUESTS = [
  {
    persona: "caregiverMain",
    amount: 2000,
    status: "paid",
    bank_code: "KBANK",
    created_at: daysAgo(10),
    reviewed_at: daysAgo(10),
    approved_at: daysAgo(9),
    paid_at: daysAgo(9),
  },
  {
    persona: "caregiverMain",
    amount: 1500,
    status: "queued",
    bank_code: "KBANK",
    created_at: daysAgo(1),
  },
  {
    persona: "caregiverSecondary",
    amount: 500,
    status: "rejected",
    bank_code: "SCB",
    rejection_reason: "บัญชีธนาคารยังไม่ได้รับการยืนยัน",
    created_at: daysAgo(5),
    rejected_at: daysAgo(4),
  },
];

// ============================================================================
// 7. DISPUTES & COMPLAINTS
// ============================================================================
export const DISPUTES = [
  {
    id_suffix: "dispute-open",
    job_suffix: "completed-3", // งานของธิติ
    opened_by: "hirerMain",
    reason: "ผู้ดูแลมาสายเกือบ 30 นาที และทำงานไม่ครบตามที่ตกลง",
    status: "open",
    created_at: daysAgo(9),
    messages: [
      { sender: "hirerMain", content: "ผู้ดูแลมาถึงสาย ไม่ช่วยพยุงคุณตาไปห้องน้ำตามที่ตกลง", created_at: daysAgo(9) },
      { sender: "caregiverSecondary", content: "ขอโทษครับ รถติดมาก แต่ผมได้ทำงานครบทุกอย่างตามที่ตกลงครับ", created_at: daysAgo(9) },
    ],
  },
  {
    id_suffix: "dispute-resolved",
    job_suffix: "cancelled-assigned", // งานที่ถูกยกเลิก
    opened_by: "hirerMain",
    reason: "ผู้ดูแลไม่มาทำงานโดยไม่แจ้งล่วงหน้า ต้องการ refund เต็มจำนวน",
    status: "resolved",
    resolution: "คืนเงินเต็มจำนวนให้ผู้ว่าจ้าง เนื่องจากผู้ดูแลไม่มาตามนัด",
    settlement_refund_amount: 1650, // 300*5 + 10% fee = 1650
    created_at: daysAgo(14),
    resolved_at: daysAgo(13),
    messages: [
      { sender: "hirerMain", content: "ผู้ดูแลไม่มาทำงาน ไม่แจ้งล่วงหน้า คุณตาต้องรอเป็นชั่วโมง", created_at: daysAgo(14) },
      { sender: "admin", content: "ทางแพลตฟอร์มได้ตรวจสอบแล้ว จะดำเนินการคืนเงินให้ครับ", created_at: daysAgo(13) },
    ],
  },
];

export const COMPLAINTS = [
  {
    reporter: "hirerMain",
    category: "service_quality",
    target: "caregiverBanned",
    subject: "ผู้ดูแลขาดงานซ้ำ",
    description: "ผู้ดูแลอนันต์ไม่มาตามนัด 2 ครั้งติดต่อกัน ทำให้คุณตาต้องรอผู้ดูแลคนอื่นนานมาก",
    status: "resolved",
    admin_note: "ระงับสิทธิ์รับงานชั่วคราว 30 วัน",
    created_at: daysAgo(14),
    resolved_at: daysAgo(13),
  },
  {
    reporter: "caregiverNew",
    category: "payment_issue",
    subject: "ยอดเงินไม่ตรง",
    description: "ยอดเงินในกระเป๋าหลังเสร็จงานแรก ไม่ตรงกับที่คำนวณจาก hourly rate",
    status: "open",
    created_at: daysAgo(2),
  },
];

// ============================================================================
// 8. CHAT MESSAGES (for active/completed jobs)
// ============================================================================
export const CHAT_TEMPLATES = {
  "completed-1": [
    { type: "system", content: "ผู้ดูแลรับงานแล้ว เงินถูกพักไว้ในระบบ Escrow เรียบร้อย" },
    { sender: "caregiverMain", content: "สวัสดีค่ะ พิมพ์จะมาถึงประมาณ 7:50 นะคะ" },
    { sender: "hirerMain", content: "ขอบคุณค่ะ คุณยายรอรับอยู่ค่ะ" },
    { sender: "caregiverMain", content: "ถึงแล้วค่ะ เช็คอินเรียบร้อย" },
    { type: "system", content: "งานเสร็จสมบูรณ์ ระบบโอนเงินให้ผู้ดูแลเรียบร้อยแล้ว" },
  ],
  "assigned-1": [
    { type: "system", content: "ผู้ดูแลรับงานแล้ว เงินถูกพักไว้ในระบบ Escrow เรียบร้อย" },
    { sender: "caregiverSecondary", content: "สวัสดีครับ ธิติรับทราบครับ พรุ่งนี้จะไปถึงก่อนเวลานะครับ" },
    { sender: "hirerMain", content: "ขอบคุณค่ะ คุณยายนอนตื่นเช้า เตรียมตัวรอค่ะ" },
  ],
  "inprogress-1": [
    { type: "system", content: "ผู้ดูแลรับงานแล้ว เงินถูกพักไว้ในระบบ Escrow เรียบร้อย" },
    { sender: "caregiverMain", content: "ถึงแล้วค่ะ คุณแม่สบายดีค่ะ" },
    { sender: "hirerSecondary", content: "ขอบคุณครับ ดูแลด้วยนะครับ" },
  ],
};

// ============================================================================
// Export helpers
// ============================================================================
export { daysAgo, daysAgoAt, daysFromNow };
