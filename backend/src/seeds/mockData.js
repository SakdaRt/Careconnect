/**
 * Mock data for development seeding.
 * Used by server.js startup (dev mode only).
 * Controlled by env: SEED_MOCK_CAREGIVERS, SEED_MOCK_JOBS
 */

export const DEV_MOCK_CAREGIVERS = [
  {
    email: "caregiver.mock1@careconnect.local",
    display_name: "mock พิมพ์ชนก ผู้ดูแล",
    bio: "ดูแลผู้สูงอายุทั่วไป และช่วยกิจวัตรประจำวันอย่างอ่อนโยน",
    experience_years: 3,
    certifications: ["basic_first_aid", "safe_transfer"],
    specializations: ["companionship", "personal_care"],
    available_from: "08:00",
    available_to: "18:00",
    available_days: [1, 2, 3, 4, 5],
    trust_level: "L2",
    trust_score: 82,
    completed_jobs_count: 18,
  },
  {
    email: "caregiver.mock2@careconnect.local",
    display_name: "mock กิตติพร ผู้ดูแล",
    bio: "ถนัดดูแลผู้ป่วยสมองเสื่อม และเฝ้าระวังพฤติกรรมเสี่ยง",
    experience_years: 5,
    certifications: ["dementia_care", "medication_management"],
    specializations: ["dementia_care", "medical_monitoring"],
    available_from: "09:00",
    available_to: "20:00",
    available_days: [0, 1, 2, 3, 4, 5],
    trust_level: "L3",
    trust_score: 91,
    completed_jobs_count: 44,
  },
  {
    email: "caregiver.mock3@careconnect.local",
    display_name: "mock วรัญญา ผู้ดูแล",
    bio: "มีประสบการณ์ดูแลหลังผ่าตัดและติดตามสัญญาณชีพเบื้องต้น",
    experience_years: 4,
    certifications: ["post_surgery_care", "vitals_monitoring"],
    specializations: ["post_surgery", "medical_monitoring"],
    available_from: "07:00",
    available_to: "16:00",
    available_days: [1, 2, 3, 4, 5],
    trust_level: "L2",
    trust_score: 85,
    completed_jobs_count: 27,
  },
  {
    email: "caregiver.mock4@careconnect.local",
    display_name: "mock ศิริพร ผู้ดูแล",
    bio: "ช่วยพยุงเดิน ย้ายท่า และดูแลผู้ป่วยติดเตียงอย่างปลอดภัย",
    experience_years: 6,
    certifications: ["safe_transfer", "catheter_care"],
    specializations: ["personal_care", "medical_monitoring"],
    available_from: "10:00",
    available_to: "22:00",
    available_days: [0, 2, 3, 5, 6],
    trust_level: "L2",
    trust_score: 79,
    completed_jobs_count: 36,
  },
  {
    email: "caregiver.mock5@careconnect.local",
    display_name: "mock ปวีณ์ ผู้ดูแล",
    bio: "รับงานดูแลทั่วไปแบบยืดหยุ่น เหมาะกับงานช่วงสั้นและเร่งด่วน",
    experience_years: 2,
    certifications: ["basic_first_aid"],
    specializations: ["companionship", "emergency"],
    available_from: "12:00",
    available_to: "23:00",
    available_days: [1, 3, 4, 6],
    trust_level: "L1",
    trust_score: 68,
    completed_jobs_count: 9,
  },
  {
    email: "caregiver.mock6@careconnect.local",
    display_name: "mock สมชาย พยาบาล",
    bio: "พยาบาลวิชาชีพมีประสบการณ์ดูแลผู้ป่วยเฉพาะทาง และช่วยงานฟิสิโอเทอราพี",
    experience_years: 8,
    certifications: ["nursing_license", "physical_therapy_assist", "wound_care"],
    specializations: ["medical_monitoring", "post_surgery", "physical_therapy", "wound_care"],
    available_from: "07:00",
    available_to: "19:00",
    available_days: [1, 2, 3, 4, 5],
    trust_level: "L3",
    trust_score: 94,
    completed_jobs_count: 67,
  },
  {
    email: "caregiver.mock7@careconnect.local",
    display_name: "mock มาลี ผู้ดูแลเด็ก",
    bio: "เชี่ยวชาญการดูแลเด็กพิการและเด็กที่มีความต้องการพิเศษ",
    experience_years: 5,
    certifications: ["child_care", "special_needs_care", "cpr_infant"],
    specializations: ["child_care", "special_needs", "tutoring"],
    available_from: "06:00",
    available_to: "21:00",
    available_days: [0, 1, 2, 3, 4, 5, 6],
    trust_level: "L2",
    trust_score: 87,
    completed_jobs_count: 52,
  },
  {
    email: "caregiver.mock8@careconnect.local",
    display_name: "mock บุญรอด นวดแผนไทย",
    bio: "ผู้เชี่ยวชาญนวดแผนไทยและการดูแลสุขภาพแบบองค์รวม",
    experience_years: 12,
    certifications: ["thai_massage", "aromatherapy", "reflexology"],
    specializations: ["massage_therapy", "wellness", "stress_relief"],
    available_from: "09:00",
    available_to: "20:00",
    available_days: [0, 2, 4, 6],
    trust_level: "L2",
    trust_score: 83,
    completed_jobs_count: 89,
  },
  {
    email: "caregiver.mock9@careconnect.local",
    display_name: "mock อรุณี โภชนากร",
    bio: "โภชนากรผู้เชี่ยวชาญดูแลอาหารและโภชนาการสำหรับผู้สูงอายุ",
    experience_years: 6,
    certifications: ["nutrition_certified", "diabetes_management", "meal_planning"],
    specializations: ["nutrition_support", "meal_preparation", "diabetes_care"],
    available_from: "08:00",
    available_to: "17:00",
    available_days: [1, 2, 3, 4, 5],
    trust_level: "L2",
    trust_score: 88,
    completed_jobs_count: 41,
  },
  {
    email: "caregiver.mock10@careconnect.local",
    display_name: "mock วิทย์ กายภาพ",
    bio: "นักกายภาพบำบัดผู้เชี่ยวชาญดูแลผู้ป่วยฟื้นฟูสมรรถภาพ",
    experience_years: 7,
    certifications: ["physical_therapy_license", "rehabilitation_specialist"],
    specializations: ["physical_therapy", "rehabilitation", "stroke_recovery"],
    available_from: "07:30",
    available_to: "18:30",
    available_days: [1, 2, 3, 4, 5],
    trust_level: "L3",
    trust_score: 92,
    completed_jobs_count: 58,
  },
  {
    email: "caregiver.mock11@careconnect.local",
    display_name: "mock สุนีย์ ผู้ดูแลสมองเสื่อม",
    bio: "ผู้เชี่ยวชาญดูแลผู้ป่วยโรคอัลไซเมอร์และสมองเสื่อมชนิดอื่นๆ",
    experience_years: 9,
    certifications: ["dementia_specialist", "cognitive_therapy", "behavior_management"],
    specializations: ["dementia_care", "cognitive_therapy", "memory_care"],
    available_from: "08:00",
    available_to: "20:00",
    available_days: [0, 1, 2, 3, 4, 5, 6],
    trust_level: "L3",
    trust_score: 95,
    completed_jobs_count: 73,
  },
  {
    email: "caregiver.mock12@careconnect.local",
    display_name: "mock ประเสริฐ พยาบาล",
    bio: "พยาบาลผู้เชี่ยวชาญดูแลผู้ป่วยโรคไตและต้องฟอกเลือด",
    experience_years: 10,
    certifications: ["dialysis_certified", "renal_care", "iv_therapy"],
    specializations: ["dialysis_care", "renal_support", "medication_management"],
    available_from: "06:00",
    available_to: "22:00",
    available_days: [0, 1, 2, 3, 4, 5, 6],
    trust_level: "L3",
    trust_score: 96,
    completed_jobs_count: 81,
  },
  {
    email: "caregiver.mock13@careconnect.local",
    display_name: "mock รัตนา ผู้ดูแลผู้ป่วยมะเร็ง",
    bio: "ผู้เชี่ยวชาญดูแลผู้ป่วยมะเร็งและการดูแลแบบประคับประคอง",
    experience_years: 8,
    certifications: ["oncology_care", "palliative_care", "pain_management"],
    specializations: ["oncology_care", "palliative_support", "pain_management"],
    available_from: "07:00",
    available_to: "21:00",
    available_days: [0, 1, 2, 3, 4, 5, 6],
    trust_level: "L3",
    trust_score: 93,
    completed_jobs_count: 64,
  },
  {
    email: "caregiver.mock14@careconnect.local",
    display_name: "mock สมศรี พยาบาล",
    bio: "พยาบาลผู้เชี่ยวชาญดูแลผู้ป่วยหัวใจและความดันโลหิตสูง",
    experience_years: 7,
    certifications: ["cardiac_care", "blood_pressure_monitoring", "emergency_response"],
    specializations: ["cardiac_care", "emergency_response", "vital_monitoring"],
    available_from: "08:00",
    available_to: "20:00",
    available_days: [1, 2, 3, 4, 5],
    trust_level: "L3",
    trust_score: 90,
    completed_jobs_count: 55,
  },
  {
    email: "caregiver.mock15@careconnect.local",
    display_name: "mock อำนวย ผู้ดูแล",
    bio: "ดูแลผู้สูงอายุทั่วไป มีประสบการณ์มาก พร้อมช่วยงานบ้าน",
    experience_years: 15,
    certifications: ["basic_first_aid", "safe_transfer", "household_management"],
    specializations: ["companionship", "personal_care", "household_help"],
    available_from: "06:00",
    available_to: "22:00",
    available_days: [0, 1, 2, 3, 4, 5, 6],
    trust_level: "L3",
    trust_score: 89,
    completed_jobs_count: 112,
  },
];

// Hospital companion caregivers (generated)
const HOSPITAL_COMPANION_MOCK_NAMES = [
  "นลินี", "อาทิตยา", "สุภาภรณ์", "จิราภา", "ณัฐกานต์",
  "ขวัญชนก", "พิชญ์สินี", "ชนิศา", "สุชานันท์", "อมรรัตน์",
];

const DEV_HOSPITAL_COMPANION_MOCK_CAREGIVERS =
  HOSPITAL_COMPANION_MOCK_NAMES.map((name, index) => {
    const sequence = index + 1;
    const hasMedicationSupport = index % 3 === 0;
    const baseScore = 72 + index * 2;

    return {
      email: `caregiver.hospital${sequence}@careconnect.local`,
      display_name: `mock ${name} ผู้ช่วยพาไปโรงพยาบาล`,
      bio: "ถนัดพาผู้สูงอายุไปโรงพยาบาล ช่วยลงทะเบียน นัดหมาย และประสานการเดินทางไป-กลับ",
      experience_years: 2 + (index % 4),
      certifications: hasMedicationSupport
        ? ["basic_first_aid", "medication_management"]
        : ["basic_first_aid", "safe_transfer"],
      specializations: ["companionship", "medical_monitoring", "hospital_companion"],
      available_from: index % 2 === 0 ? "06:30" : "07:30",
      available_to: index % 2 === 0 ? "17:30" : "19:00",
      available_days: [1, 2, 3, 4, 5, 6],
      trust_level: hasMedicationSupport ? "L2" : "L1",
      trust_score: baseScore,
      completed_jobs_count: 12 + index * 3,
    };
  });

DEV_MOCK_CAREGIVERS.push(...DEV_HOSPITAL_COMPANION_MOCK_CAREGIVERS);

export const DEV_MOCK_HIRERS = [
  { email: "hirer.mock.hospital1@careconnect.local", display_name: "mock ญาติคุณพิม" },
  { email: "hirer.mock.hospital2@careconnect.local", display_name: "mock ครอบครัวคุณวินัย" },
  { email: "hirer.mock.hospital3@careconnect.local", display_name: "mock ลูกสาวคุณดาวเรือง" },
  { email: "hirer.mock.hospital4@careconnect.local", display_name: "mock ทีมดูแลผู้สูงวัย" },
];

const HOSPITAL_ESCORT_JOB_LOCATIONS = [
  { hospital: "รพ.ศิริราช", address_line1: "ท่าพระจันทร์", district: "บางกอกน้อย", province: "กรุงเทพมหานคร" },
  { hospital: "รพ.จุฬาลงกรณ์", address_line1: "สามย่าน", district: "ปทุมวัน", province: "กรุงเทพมหานคร" },
  { hospital: "รพ.รามาธิบดี", address_line1: "ราชเทวี", district: "ราชเทวี", province: "กรุงเทพมหานคร" },
  { hospital: "รพ.พระมงกุฎ", address_line1: "อนุสาวรีย์ชัย", district: "ราชเทวี", province: "กรุงเทพมหานคร" },
  { hospital: "รพ.กรุงเทพ", address_line1: "เพชรบุรีตัดใหม่", district: "ห้วยขวาง", province: "กรุงเทพมหานคร" },
  { hospital: "รพ.เปาโลสมุทรปราการ", address_line1: "ปากน้ำ", district: "เมืองสมุทรปราการ", province: "สมุทรปราการ" },
  { hospital: "รพ.ศรีนครินทร์", address_line1: "ศรีนครินทร์", district: "บางพลี", province: "สมุทรปราการ" },
  { hospital: "รพ.บางปะกอก 9", address_line1: "สุขสวัสดิ์", district: "ราษฎร์บูรณะ", province: "กรุงเทพมหานคร" },
  { hospital: "รพ.เกษมราษฎร์บางแค", address_line1: "เพชรเกษม", district: "บางแค", province: "กรุงเทพมหานคร" },
  { hospital: "รพ.พญาไท 2", address_line1: "พหลโยธิน", district: "พญาไท", province: "กรุงเทพมหานคร" },
];

export const DEV_MOCK_ESCORT_JOB_TEMPLATES = HOSPITAL_ESCORT_JOB_LOCATIONS.map(
  (location, index) => {
    const shouldIncludeTransport = index % 2 === 0;
    const shouldIncludeMedicationPickup = index % 3 === 0;
    const jobTasksFlags = ["hospital_companion", "hospital_registration_support"];

    if (shouldIncludeTransport) jobTasksFlags.push("hospital_transport_coordination");
    if (shouldIncludeMedicationPickup) jobTasksFlags.push("medication_pickup");

    return {
      title: `mock งานพาไป${location.hospital} #${index + 1}`,
      description: shouldIncludeMedicationPickup
        ? `ช่วยพาผู้รับการดูแลไป ${location.hospital} ลงทะเบียน พบแพทย์ และรับยากลับบ้าน`
        : `ช่วยพาผู้รับการดูแลไป ${location.hospital} และประสานงานหน้างานจนเสร็จสิ้น`,
      address_line1: location.address_line1,
      district: location.district,
      province: location.province,
      hourly_rate: 320 + (index % 4) * 20,
      total_hours: shouldIncludeTransport ? 6 : 4,
      is_urgent: index % 4 === 0,
      risk_level: shouldIncludeMedicationPickup ? "high_risk" : "low_risk",
      min_trust_level: shouldIncludeMedicationPickup ? "L2" : "L1",
      job_tasks_flags: jobTasksFlags,
      required_skills_flags: shouldIncludeMedicationPickup
        ? ["basic_first_aid", "medication_management"]
        : ["basic_first_aid"],
      equipment_available_flags: shouldIncludeTransport ? ["wheelchair"] : [],
      precautions_flags: shouldIncludeMedicationPickup
        ? ["fall_risk", "allergy_precaution"]
        : ["fall_risk"],
    };
  },
);
