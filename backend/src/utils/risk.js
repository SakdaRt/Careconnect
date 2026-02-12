export function computeRiskLevel({ jobType, patientProfile, jobTasksFlags = [] }) {
  const baselineHighJobTypes = new Set(['emergency', 'post_surgery', 'dementia_care', 'medical_monitoring']);

  const devices = new Set(patientProfile?.medical_devices_flags || []);
  const symptoms = new Set(patientProfile?.symptoms_flags || []);
  const behaviors = new Set(patientProfile?.behavior_risks_flags || []);
  const needs = new Set(patientProfile?.care_needs_flags || []);
  const cognitive = String(patientProfile?.cognitive_status || '');
  const tasks = new Set(jobTasksFlags || []);

  const reason_codes = [];
  const reason_details = [];

  const add = (code, detail) => {
    reason_codes.push(code);
    reason_details.push(detail);
  };

  if (devices.has('ventilator')) add('patient:device_ventilator', 'ใช้เครื่องช่วยหายใจ');
  if (devices.has('tracheostomy')) add('patient:device_tracheostomy', 'มีการเจาะคอ');
  if (devices.has('oxygen')) add('patient:device_oxygen', 'ใช้ออกซิเจน');
  if (devices.has('feeding_tube')) add('patient:device_feeding_tube', 'มีสายให้อาหาร');

  if (symptoms.has('shortness_of_breath')) add('patient:symptom_shortness_of_breath', 'มีอาการหายใจเหนื่อย/หอบ');
  if (symptoms.has('chest_pain')) add('patient:symptom_chest_pain', 'มีอาการเจ็บ/แน่นหน้าอก');
  if (symptoms.has('seizure')) add('patient:symptom_seizure', 'มีประวัติชัก/ลมชัก');
  if (symptoms.has('altered_consciousness')) add('patient:symptom_altered_consciousness', 'มีอาการซึม/สติเปลี่ยนแปลง');
  if (symptoms.has('uncontrolled_bleeding')) add('patient:symptom_uncontrolled_bleeding', 'มีเลือดออกผิดปกติ/หยุดยาก');
  if (symptoms.has('high_fever')) add('patient:symptom_high_fever', 'มีไข้สูง');

  if (needs.has('tube_feeding')) add('patient:need_tube_feeding', 'ต้องให้อาหารทางสาย');
  if (needs.has('medication_administration')) add('patient:need_medication_administration', 'ต้องช่วยให้ยาตามแผนแพทย์');

  if (behaviors.has('aggression')) add('patient:behavior_aggression', 'มีพฤติกรรมก้าวร้าว');
  if (cognitive === 'delirium') add('patient:cognitive_delirium', 'มีภาวะสับสนเฉียบพลัน/เพ้อ');
  if (behaviors.has('wandering') && (behaviors.has('fall_risk') || cognitive === 'dementia' || cognitive === 'delirium')) {
    add('patient:behavior_wandering_high_risk', 'มีพฤติกรรมหลงเดินร่วมกับปัจจัยเสี่ยง');
  }

  if (tasks.has('tube_feeding')) add('task:tube_feeding', 'งานมีการให้อาหารทางสาย');
  if (tasks.has('medication_administration')) add('task:medication_administration', 'งานมีการช่วยให้ยาตามแผนแพทย์');
  if (tasks.has('wound_dressing')) add('task:wound_dressing', 'งานมีการทำแผล');
  if (tasks.has('catheter_care')) add('task:catheter_care', 'งานมีการดูแลสายสวน');
  if (tasks.has('oxygen_monitoring')) add('task:oxygen_monitoring', 'งานมีการดูแล/เฝ้าระวังออกซิเจน');
  if (tasks.has('dementia_supervision')) add('task:dementia_supervision', 'งานมีการดูแลใกล้ชิดผู้ป่วยสับสน/หลงเดิน');

  const highByPatient = reason_codes.length > 0;

  if (highByPatient) {
    return {
      risk_level: 'high_risk',
      reason_codes,
      reason_details,
      reason_source: 'patient_criteria',
      detail: {
        job_type: jobType,
        matched: { reason_codes, reason_details },
      },
    };
  }

  if (baselineHighJobTypes.has(jobType)) {
    return {
      risk_level: 'high_risk',
      reason_codes: ['job_type:high_risk_job_type'],
      reason_details: ['ประเภทงานเข้าข่ายความเสี่ยงสูง'],
      reason_source: 'job_type_criteria',
      detail: { job_type: jobType },
    };
  }

  return {
    risk_level: 'low_risk',
    reason_codes: ['job_type:low_risk_job_type'],
    reason_details: ['ประเภทงานเข้าข่ายความเสี่ยงต่ำ'],
    reason_source: 'job_type_criteria',
    detail: { job_type: jobType },
  };
}

