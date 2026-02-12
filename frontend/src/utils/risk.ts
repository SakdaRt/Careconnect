import type { CareRecipient } from '../services/api';

export type JobType =
  | 'companionship'
  | 'personal_care'
  | 'medical_monitoring'
  | 'dementia_care'
  | 'post_surgery'
  | 'emergency';

export type RiskLevel = 'low_risk' | 'high_risk';

export function computeRiskLevel({
  jobType,
  careRecipient,
  jobTasksFlags = [],
}: {
  jobType: JobType;
  careRecipient?: CareRecipient | null;
  jobTasksFlags?: string[];
}) {
  const baselineHighJobTypes = new Set<JobType>(['emergency', 'post_surgery', 'dementia_care', 'medical_monitoring']);

  const devices = new Set(careRecipient?.medical_devices_flags || []);
  const symptoms = new Set(careRecipient?.symptoms_flags || []);
  const behaviors = new Set(careRecipient?.behavior_risks_flags || []);
  const needs = new Set(careRecipient?.care_needs_flags || []);
  const cognitive = String(careRecipient?.cognitive_status || '');
  const tasks = new Set(jobTasksFlags || []);

  const reasons: string[] = [];
  const add = (text: string) => reasons.push(text);

  if (devices.has('ventilator')) add('ใช้เครื่องช่วยหายใจ');
  if (devices.has('tracheostomy')) add('มีการเจาะคอ');
  if (devices.has('oxygen')) add('ใช้ออกซิเจน');
  if (devices.has('feeding_tube')) add('มีสายให้อาหาร');

  if (symptoms.has('shortness_of_breath')) add('มีอาการหายใจเหนื่อย/หอบ');
  if (symptoms.has('chest_pain')) add('มีอาการเจ็บ/แน่นหน้าอก');
  if (symptoms.has('seizure')) add('มีประวัติชัก/ลมชัก');
  if (symptoms.has('altered_consciousness')) add('มีอาการซึม/สติเปลี่ยนแปลง');
  if (symptoms.has('uncontrolled_bleeding')) add('มีเลือดออกผิดปกติ/หยุดยาก');
  if (symptoms.has('high_fever')) add('มีไข้สูง');

  if (needs.has('tube_feeding')) add('ต้องให้อาหารทางสาย');
  if (needs.has('medication_administration')) add('ต้องช่วยให้ยาตามแผนแพทย์');

  if (behaviors.has('aggression')) add('มีพฤติกรรมก้าวร้าว');
  if (cognitive === 'delirium') add('มีภาวะสับสนเฉียบพลัน/เพ้อ');
  if (behaviors.has('wandering') && (behaviors.has('fall_risk') || cognitive === 'dementia' || cognitive === 'delirium')) {
    add('มีพฤติกรรมหลงเดินร่วมกับปัจจัยเสี่ยง');
  }
  if (tasks.has('tube_feeding')) add('งานมีการให้อาหารทางสาย');
  if (tasks.has('medication_administration')) add('งานมีการช่วยให้ยาตามแผนแพทย์');
  if (tasks.has('wound_dressing')) add('งานมีการทำแผล');
  if (tasks.has('catheter_care')) add('งานมีการดูแลสายสวน');
  if (tasks.has('oxygen_monitoring')) add('งานมีการดูแล/เฝ้าระวังออกซิเจน');
  if (tasks.has('dementia_supervision')) add('งานมีการดูแลใกล้ชิดผู้ป่วยสับสน/หลงเดิน');

  if (reasons.length > 0) {
    return {
      risk_level: 'high_risk' as RiskLevel,
      reason: 'เข้าข่ายความเสี่ยงสูงจากข้อมูลผู้ป่วย',
      reasons,
    };
  }

  if (baselineHighJobTypes.has(jobType)) {
    return {
      risk_level: 'high_risk' as RiskLevel,
      reason: 'ประเภทงานเข้าข่ายความเสี่ยงสูง',
      reasons: ['ประเภทงานอยู่ในกลุ่มที่ต้องเฝ้าระวังสูง'],
    };
  }

  return {
    risk_level: 'low_risk' as RiskLevel,
    reason: 'ประเภทงานเข้าข่ายความเสี่ยงต่ำ',
    reasons: ['ไม่พบเกณฑ์ผู้ป่วยที่จัดเป็นความเสี่ยงสูง'],
  };
}

