import type { CareRecipient } from '../services/api';

export type JobType =
  | 'companionship'
  | 'personal_care'
  | 'medical_monitoring'
  | 'dementia_care'
  | 'post_surgery'
  | 'emergency';

export type RiskLevel = 'low_risk' | 'high_risk';

const HIGH_RISK_TASK_REASON_LABELS = {
  tube_feeding: 'งานมีการให้อาหารทางสาย',
  medication_administration: 'งานมีการช่วยให้ยาตามแผนแพทย์',
  wound_dressing: 'งานมีการทำแผล',
  catheter_care: 'งานมีการดูแลสายสวน',
  oxygen_monitoring: 'งานมีการดูแล/เฝ้าระวังออกซิเจน',
  dementia_supervision: 'งานมีการดูแลใกล้ชิดผู้ป่วยสับสน/หลงเดิน',
} as const;

type HighRiskTaskValue = keyof typeof HIGH_RISK_TASK_REASON_LABELS;

const HIGH_RISK_TASK_KEYS = Object.keys(HIGH_RISK_TASK_REASON_LABELS) as HighRiskTaskValue[];

export const HIGH_RISK_TASK_VALUES: ReadonlySet<string> = new Set<string>(HIGH_RISK_TASK_KEYS);

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
  for (const task of HIGH_RISK_TASK_KEYS) {
    if (tasks.has(task)) add(HIGH_RISK_TASK_REASON_LABELS[task]);
  }

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

