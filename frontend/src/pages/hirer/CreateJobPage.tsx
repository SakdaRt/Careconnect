import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, useBlocker } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MainLayout } from '../../layouts';
import { Badge, Button, Card, Input, Modal, type BadgeProps } from '../../components/ui';
import { GooglePlacesInput } from '../../components/location/GooglePlacesInput';
import { CareRecipient, CreateJobData } from '../../services/api';
import { appApi } from '../../services/appApi';
import { useAuth } from '../../contexts';
import { cn } from '../../contexts/ThemeContext';
import { computeRiskLevel } from '../../utils/risk';

type JobType =
  | 'companionship'
  | 'personal_care'
  | 'medical_monitoring'
  | 'dementia_care'
  | 'post_surgery'
  | 'emergency';

type DetailedJobType =
  | 'hospital_transport_support'
  | 'general_patient_care'
  | 'post_surgery_recovery'
  | 'dementia_supervision'
  | 'bedbound_high_dependency'
  | 'medical_device_home_care';

type DynamicQuestionOption = { value: string; label: string };

type DynamicQuestion = {
  id: string;
  label: string;
  helper?: string;
  type: 'radio' | 'multi';
  options: DynamicQuestionOption[];
  effects: Record<string, { addTasks?: string[]; removeTasks?: string[]; addSkills?: string[]; addEquipment?: string[]; addPrecautions?: string[]; setJobType?: JobType }>;
};

type DetailedJobTemplate = {
  label: string;
  helper: string;
  defaultTitle: string;
  jobType: JobType;
  defaultTasks: string[];
  defaultSkills: string[];
  defaultEquipment: string[];
  defaultPrecautions: string[];
  dynamicQuestions: DynamicQuestion[];
};

type OptionItem = {
  v: string;
  label: string;
};

type CreateJobErrorDetails = {
  section?: string;
  field?: string;
  related_task?: string;
};

type CreateJobErrorObject = {
  message?: string;
  code?: string;
  details?: CreateJobErrorDetails;
};

type CreateJobResult = {
  success: boolean;
  data?: {
    job?: {
      id?: string;
    };
  };
  error?: string | CreateJobErrorObject;
  code?: string;
  details?: CreateJobErrorDetails;
};

const JOB_TYPE_LABEL: Record<JobType, string> = {
  companionship: 'เพื่อนคุย / ดูแลทั่วไป',
  personal_care: 'ช่วยเหลือตัวเอง / อาบน้ำแต่งตัว',
  medical_monitoring: 'ดูแลการกินยา / วัดสัญญาณชีพ',
  dementia_care: 'ดูแลผู้ป่วยสมองเสื่อม',
  post_surgery: 'ดูแลหลังผ่าตัด',
  emergency: 'เร่งด่วน',
};

const DETAILED_JOB_TEMPLATES: Record<DetailedJobType, DetailedJobTemplate> = {
  hospital_transport_support: {
    label: 'พาไปโรงพยาบาล / ไปส่ง',
    helper: 'เหมาะกับงานพาไปพบแพทย์ รับยา รับผลตรวจ และประสานขั้นตอนที่โรงพยาบาล',
    defaultTitle: 'งานพาไปโรงพยาบาล / ไปส่ง',
    jobType: 'companionship',
    defaultTasks: ['hospital_companion', 'hospital_registration_support'],
    defaultSkills: ['basic_first_aid'],
    defaultEquipment: [],
    defaultPrecautions: ['fall_risk'],
    dynamicQuestions: [
      {
        id: 'transport_plan',
        label: 'การเดินทางไป-กลับ',
        type: 'radio',
        options: [
          { value: 'have_car', label: 'มีรถให้ผู้ดูแล' },
          { value: 'no_car', label: 'ไม่มีรถ (ผู้ดูแลช่วยประสานการเดินทาง)' },
        ],
        effects: {
          have_car: { removeTasks: ['hospital_transport_coordination'] },
          no_car: { addTasks: ['hospital_transport_coordination'] },
        },
      },
      {
        id: 'visit_scope',
        label: 'ขอบเขตงานที่ต้องช่วยในโรงพยาบาล',
        type: 'radio',
        options: [
          { value: 'escort_only', label: 'พาไป-พากลับและอยู่เป็นเพื่อน' },
          { value: 'registration', label: 'ช่วยลงทะเบียน/ประสานงาน' },
          { value: 'full_support', label: 'ครบทั้งพาไป ลงทะเบียน และช่วยรับยา/ผลตรวจ' },
        ],
        effects: {
          escort_only: {
            addTasks: ['hospital_companion'],
            removeTasks: ['hospital_registration_support', 'medication_pickup'],
          },
          registration: {
            addTasks: ['hospital_companion', 'hospital_registration_support'],
            removeTasks: ['medication_pickup'],
          },
          full_support: {
            addTasks: ['hospital_companion', 'hospital_registration_support', 'medication_pickup'],
            addSkills: ['medication_management'],
          },
        },
      },
      {
        id: 'mobility_help',
        label: 'ต้องช่วยพยุง/ย้ายท่าระหว่างเดินทางไหม?',
        type: 'radio',
        options: [
          { value: 'yes', label: 'ใช่ ต้องช่วยพยุงหรือย้ายท่า' },
          { value: 'no', label: 'ไม่ต้อง เคลื่อนไหวได้เอง' },
        ],
        effects: {
          yes: {
            addTasks: ['mobility_assist', 'transfer_assist'],
            addSkills: ['safe_transfer'],
            addEquipment: ['patient_lift'],
            addPrecautions: ['fall_risk', 'lifting_precaution'],
          },
          no: { removeTasks: ['mobility_assist', 'transfer_assist'] },
        },
      },
    ],
  },
  general_patient_care: {
    label: 'ดูแลทั่วไป',
    helper: 'เหมาะกับงานดูแลประจำวัน ไม่ซับซ้อนเฉพาะทาง และปรับรายละเอียดผ่านคำถามด้านล่าง',
    defaultTitle: 'งานดูแลทั่วไป',
    jobType: 'companionship',
    defaultTasks: ['companionship'],
    defaultSkills: ['basic_first_aid'],
    defaultEquipment: [],
    defaultPrecautions: ['fall_risk'],
    dynamicQuestions: [
      {
        id: 'care_focus',
        label: 'ลักษณะการดูแลหลัก',
        helper: 'เลือกโฟกัสหลัก แล้วปรับ task เพิ่มเติมได้ด้านล่าง',
        type: 'radio',
        options: [
          { value: 'basic', label: 'ดูแลทั่วไป/อยู่เป็นเพื่อน' },
          { value: 'personal', label: 'ช่วยกิจวัตรส่วนตัว (อาบน้ำ/แต่งตัว/ขับถ่าย)' },
          { value: 'medical', label: 'ดูแลยาและวัดสัญญาณชีพ' },
        ],
        effects: {
          basic: {
            addTasks: ['companionship'],
            removeTasks: ['bathing', 'dressing', 'toileting', 'diaper_change', 'feeding', 'medication_reminder', 'medication_administration', 'vitals_check', 'blood_sugar_check'],
            setJobType: 'companionship',
          },
          personal: {
            addTasks: ['bathing', 'dressing', 'toileting'],
            removeTasks: ['medication_reminder', 'medication_administration', 'vitals_check', 'blood_sugar_check'],
            addSkills: ['safe_transfer'],
            addPrecautions: ['fall_risk', 'lifting_precaution'],
            setJobType: 'personal_care',
          },
          medical: {
            addTasks: ['medication_reminder', 'vitals_check'],
            removeTasks: ['bathing', 'dressing', 'toileting'],
            addSkills: ['vitals_monitoring', 'medication_management'],
            addEquipment: ['bp_monitor', 'thermometer'],
            setJobType: 'medical_monitoring',
          },
        },
      },
      {
        id: 'transfer_need',
        label: 'ต้องช่วยพยุงเดิน/ย้ายท่าไหม?',
        type: 'radio',
        options: [
          { value: 'yes', label: 'ใช่ ต้องช่วยพยุงเดินหรือย้ายท่า' },
          { value: 'no', label: 'ไม่ต้อง เคลื่อนไหวได้เอง' },
        ],
        effects: {
          yes: { addTasks: ['mobility_assist', 'transfer_assist'], addSkills: ['safe_transfer'], addEquipment: ['patient_lift'], addPrecautions: ['fall_risk', 'lifting_precaution'] },
          no: { removeTasks: ['mobility_assist', 'transfer_assist'] },
        },
      },
      {
        id: 'feeding_help',
        label: 'ต้องช่วยป้อนอาหารไหม?',
        type: 'radio',
        options: [
          { value: 'self', label: 'กินเองได้' },
          { value: 'assist', label: 'ต้องช่วยป้อน' },
        ],
        effects: {
          self: { removeTasks: ['feeding'] },
          assist: { addTasks: ['feeding'] },
        },
      },
      {
        id: 'diaper',
        label: 'ต้องเปลี่ยนผ้าอ้อมไหม?',
        type: 'radio',
        options: [
          { value: 'yes', label: 'ใช่ ต้องเปลี่ยนผ้าอ้อม' },
          { value: 'no', label: 'ไม่ต้อง' },
        ],
        effects: {
          yes: { addTasks: ['diaper_change'] },
          no: { removeTasks: ['diaper_change'] },
        },
      },
      {
        id: 'med_level',
        label: 'ระดับการดูแลยา',
        helper: 'ผู้ดูแลต้องช่วยในระดับใด?',
        type: 'radio',
        options: [
          { value: 'remind', label: 'เตือนกินยาเท่านั้น' },
          { value: 'administer', label: 'ช่วยให้ยาตามแผนแพทย์ (หยิบ จัด แบ่ง ให้)' },
        ],
        effects: {
          administer: {
            addTasks: ['medication_reminder', 'medication_administration'],
            addSkills: ['medication_management'],
            setJobType: 'medical_monitoring',
          },
          remind: { addTasks: ['medication_reminder'], removeTasks: ['medication_administration'] },
        },
      },
      {
        id: 'blood_sugar',
        label: 'ต้องวัดน้ำตาลปลายนิ้วไหม?',
        type: 'radio',
        options: [
          { value: 'yes', label: 'ใช่ ต้องวัดน้ำตาล' },
          { value: 'no', label: 'ไม่ต้อง' },
        ],
        effects: {
          yes: { addTasks: ['blood_sugar_check'], addEquipment: ['glucometer'] },
          no: { removeTasks: ['blood_sugar_check'] },
        },
      },
    ],
  },
  post_surgery_recovery: {
    label: 'ดูแลผู้ป่วยหลังผ่าตัด',
    helper: 'ช่วยฟื้นตัวหลังผ่าตัดและติดตามอาการใกล้ชิด',
    defaultTitle: 'ดูแลผู้ป่วยหลังผ่าตัด',
    jobType: 'post_surgery',
    defaultTasks: ['wound_dressing', 'medication_administration', 'mobility_assist'],
    defaultSkills: ['post_surgery_care', 'wound_care', 'medication_management'],
    defaultEquipment: ['wound_care_supplies'],
    defaultPrecautions: ['infection_control', 'fall_risk'],
    dynamicQuestions: [
      {
        id: 'surgery_type',
        label: 'ผ่าตัดบริเวณใด?',
        helper: 'เพื่อระบุการดูแลที่เหมาะสม',
        type: 'radio',
        options: [
          { value: 'ortho', label: 'กระดูก/ข้อ (เข่า สะโพก กระดูกสันหลัง)' },
          { value: 'abdominal', label: 'ช่องท้อง' },
          { value: 'cardiac', label: 'หัวใจ/ทรวงอก' },
          { value: 'other', label: 'อื่น ๆ' },
        ],
        effects: {
          ortho: { addTasks: ['transfer_assist'], addSkills: ['safe_transfer'], addEquipment: ['walker', 'wheelchair', 'patient_lift'], addPrecautions: ['fall_risk', 'lifting_precaution'] },
          abdominal: { addPrecautions: ['aspiration_risk', 'infection_control'] },
          cardiac: { addTasks: ['vitals_check', 'oxygen_monitoring'], addSkills: ['vitals_monitoring'], addEquipment: ['bp_monitor', 'pulse_oximeter', 'oxygen_concentrator'], addPrecautions: ['infection_control'] },
        },
      },
      {
        id: 'catheter',
        label: 'มีสายสวนปัสสาวะไหม?',
        type: 'radio',
        options: [
          { value: 'yes', label: 'มี ต้องดูแลสายสวน' },
          { value: 'no', label: 'ไม่มี' },
        ],
        effects: {
          yes: { addTasks: ['catheter_care'], addSkills: ['catheter_care'], addPrecautions: ['infection_control'] },
          no: { removeTasks: ['catheter_care'] },
        },
      },
    ],
  },
  dementia_supervision: {
    label: 'ดูแลผู้ป่วยสมองเสื่อมใกล้ชิด',
    helper: 'เฝ้าระวังความปลอดภัยและพฤติกรรมต่อเนื่อง',
    defaultTitle: 'ดูแลผู้ป่วยสมองเสื่อม',
    jobType: 'dementia_care',
    defaultTasks: ['dementia_supervision', 'companionship', 'mobility_assist'],
    defaultSkills: ['dementia_care', 'basic_first_aid'],
    defaultEquipment: [],
    defaultPrecautions: ['behavioral_risk', 'fall_risk'],
    dynamicQuestions: [
      {
        id: 'behavior',
        label: 'มีพฤติกรรมเสี่ยงไหม?',
        helper: 'เช่น หนีออกจากบ้าน ก้าวร้าว สับสน',
        type: 'radio',
        options: [
          { value: 'wandering', label: 'มีพฤติกรรมหลงเดิน/หนีออกจากบ้าน' },
          { value: 'aggressive', label: 'มีพฤติกรรมก้าวร้าว/ต่อต้าน' },
          { value: 'mild', label: 'อาการเบา ไม่ค่อยมีพฤติกรรมเสี่ยง' },
        ],
        effects: {
          wandering: { addPrecautions: ['behavioral_risk', 'fall_risk'] },
          aggressive: { addPrecautions: ['behavioral_risk'] },
        },
      },
      {
        id: 'night_care',
        label: 'ต้องดูแลตอนกลางคืนด้วยไหม?',
        type: 'radio',
        options: [
          { value: 'yes', label: 'ใช่ ต้องเฝ้ากลางคืนด้วย' },
          { value: 'no', label: 'ไม่ต้อง ดูแลเฉพาะกลางวัน' },
        ],
        effects: {
          yes: { addTasks: ['meal_prep'] },
        },
      },
    ],
  },
  bedbound_high_dependency: {
    label: 'ดูแลผู้ป่วยติดเตียง/พึ่งพาสูง',
    helper: 'เหมาะกับผู้ป่วยที่ต้องช่วยเหลือเกือบทั้งหมด เช่น ย้ายท่า ป้อนอาหาร และดูแลสุขอนามัย',
    defaultTitle: 'งานดูแลผู้ป่วยติดเตียง/พึ่งพาสูง',
    jobType: 'personal_care',
    defaultTasks: ['transfer_assist', 'diaper_change', 'feeding', 'mobility_assist'],
    defaultSkills: ['safe_transfer', 'basic_first_aid'],
    defaultEquipment: ['hospital_bed'],
    defaultPrecautions: ['pressure_ulcer_risk', 'fall_risk', 'lifting_precaution', 'aspiration_risk'],
    dynamicQuestions: [
      {
        id: 'feeding_route',
        label: 'รูปแบบการให้อาหาร',
        type: 'radio',
        options: [
          { value: 'oral', label: 'ป้อนอาหารทางปาก' },
          { value: 'tube', label: 'ให้อาหารทางสาย (NG tube / PEG)' },
        ],
        effects: {
          oral: { addTasks: ['feeding'], removeTasks: ['tube_feeding'] },
          tube: {
            addTasks: ['tube_feeding'],
            removeTasks: ['feeding'],
            addSkills: ['tube_feeding_care'],
            addEquipment: ['feeding_tube_supplies'],
            addPrecautions: ['aspiration_risk'],
            setJobType: 'medical_monitoring',
          },
        },
      },
      {
        id: 'reposition_support',
        label: 'ต้องช่วยย้ายท่า/พลิกตะแคงเป็นประจำไหม?',
        type: 'radio',
        options: [
          { value: 'yes', label: 'ใช่ ต้องช่วยย้ายท่าเป็นประจำ' },
          { value: 'no', label: 'ไม่ต้องย้ายท่าบ่อย' },
        ],
        effects: {
          yes: {
            addTasks: ['transfer_assist'],
            addEquipment: ['patient_lift'],
            addPrecautions: ['pressure_ulcer_risk', 'lifting_precaution'],
          },
          no: { removeTasks: ['transfer_assist'] },
        },
      },
      {
        id: 'catheter',
        label: 'มีสายสวนปัสสาวะไหม?',
        type: 'radio',
        options: [
          { value: 'yes', label: 'มี ต้องดูแลสายสวน' },
          { value: 'no', label: 'ไม่มี' },
        ],
        effects: {
          yes: { addTasks: ['catheter_care'], addSkills: ['catheter_care'], addPrecautions: ['infection_control'] },
          no: { removeTasks: ['catheter_care'] },
        },
      },
    ],
  },
  medical_device_home_care: {
    label: 'ดูแลผู้ป่วยใช้อุปกรณ์ทางการแพทย์ที่บ้าน',
    helper: 'เหมาะกับเคสที่ต้องดูแลอุปกรณ์เฉพาะ เช่น ออกซิเจน สายให้อาหาร สายสวน หรือแผล',
    defaultTitle: 'งานดูแลผู้ป่วยใช้อุปกรณ์ทางการแพทย์ที่บ้าน',
    jobType: 'medical_monitoring',
    defaultTasks: ['vitals_check', 'medication_reminder'],
    defaultSkills: ['vitals_monitoring', 'medication_management'],
    defaultEquipment: ['bp_monitor', 'thermometer'],
    defaultPrecautions: ['infection_control'],
    dynamicQuestions: [
      {
        id: 'oxygen',
        label: 'มีการใช้ออกซิเจนไหม?',
        type: 'radio',
        options: [
          { value: 'yes', label: 'มี ต้องดูแลออกซิเจน' },
          { value: 'no', label: 'ไม่มี' },
        ],
        effects: {
          yes: { addTasks: ['oxygen_monitoring'], addEquipment: ['oxygen_concentrator', 'pulse_oximeter'], addPrecautions: ['infection_control'] },
          no: { removeTasks: ['oxygen_monitoring'] },
        },
      },
      {
        id: 'feeding_tube',
        label: 'มีสายให้อาหารไหม?',
        type: 'radio',
        options: [
          { value: 'yes', label: 'มี ต้องให้อาหารทางสาย' },
          { value: 'no', label: 'ไม่มี' },
        ],
        effects: {
          yes: { addTasks: ['tube_feeding'], addSkills: ['tube_feeding_care'], addEquipment: ['feeding_tube_supplies'], addPrecautions: ['aspiration_risk'] },
          no: { removeTasks: ['tube_feeding'] },
        },
      },
      {
        id: 'urinary_catheter',
        label: 'มีสายสวนปัสสาวะไหม?',
        type: 'radio',
        options: [
          { value: 'yes', label: 'มี ต้องดูแลสายสวน' },
          { value: 'no', label: 'ไม่มี' },
        ],
        effects: {
          yes: { addTasks: ['catheter_care'], addSkills: ['catheter_care'], addPrecautions: ['infection_control'] },
          no: { removeTasks: ['catheter_care'] },
        },
      },
      {
        id: 'wound',
        label: 'มีแผลที่ต้องทำแผล/เปลี่ยนผ้าพันไหม?',
        type: 'radio',
        options: [
          { value: 'yes', label: 'มี ต้องดูแลแผล' },
          { value: 'no', label: 'ไม่มี' },
        ],
        effects: {
          yes: { addTasks: ['wound_dressing'], addSkills: ['wound_care'], addEquipment: ['wound_care_supplies'], addPrecautions: ['infection_control'] },
          no: { removeTasks: ['wound_dressing'] },
        },
      },
      {
        id: 'blood_sugar',
        label: 'ต้องวัดน้ำตาลปลายนิ้วไหม?',
        type: 'radio',
        options: [
          { value: 'yes', label: 'ใช่ ต้องวัดน้ำตาล' },
          { value: 'no', label: 'ไม่ต้อง' },
        ],
        effects: {
          yes: { addTasks: ['blood_sugar_check'], addEquipment: ['glucometer'] },
          no: { removeTasks: ['blood_sugar_check'] },
        },
      },
      {
        id: 'med_support',
        label: 'ระดับการดูแลยา',
        type: 'radio',
        options: [
          { value: 'remind', label: 'เตือนกินยา' },
          { value: 'administer', label: 'ช่วยให้ยาตามแผนแพทย์' },
        ],
        effects: {
          remind: { removeTasks: ['medication_administration'] },
          administer: { addTasks: ['medication_administration'], addSkills: ['medication_management'] },
        },
      },
    ],
  },
};

const DETAILED_JOB_TYPE_ORDER: DetailedJobType[] = [
  'hospital_transport_support',
  'general_patient_care',
  'post_surgery_recovery',
  'dementia_supervision',
  'bedbound_high_dependency',
  'medical_device_home_care',
];

const DEFAULT_DETAILED_JOB_TYPE: DetailedJobType = 'general_patient_care';

const SPECIALIZED_TYPE_DIFFERENCE_HINT: Partial<Record<DetailedJobType, string>> = {
  post_surgery_recovery: 'ต่างจากทั่วไป: เน้นเฝ้าระวังแผลและภาวะแทรกซ้อนหลังผ่าตัด',
  dementia_supervision: 'ต่างจากทั่วไป: เน้นความปลอดภัยด้านพฤติกรรมและการสื่อสารกับผู้ป่วยสมองเสื่อม',
  bedbound_high_dependency: 'ต่างจากทั่วไป: ต้องช่วยกิจวัตรเกือบทั้งหมด และป้องกันแผลกดทับ/ภาวะแทรกซ้อนจากการนอนนาน',
  medical_device_home_care: 'ต่างจากทั่วไป: ต้องดูแลอุปกรณ์ทางการแพทย์และสังเกตสัญญาณเตือนเฉพาะ',
};

const JOB_TASK_OPTIONS = [
  { v: 'companionship', label: 'เพื่อนคุย/ดูแลทั่วไป' },
  { v: 'hospital_companion', label: 'พาไปโรงพยาบาลเป็นเพื่อน' },
  { v: 'hospital_registration_support', label: 'ช่วยลงทะเบียน/ประสานงานโรงพยาบาล' },
  { v: 'hospital_transport_coordination', label: 'ช่วยประสานการเดินทางไป-กลับ' },
  { v: 'medication_pickup', label: 'รับยา/รับผลตรวจแทนตามที่มอบหมาย' },
  { v: 'meal_prep', label: 'เตรียมอาหาร/จัดมื้ออาหาร' },
  { v: 'light_housekeeping', label: 'งานบ้านเบา ๆ' },
  { v: 'mobility_assist', label: 'ช่วยพยุงเดิน' },
  { v: 'transfer_assist', label: 'ช่วยย้ายท่า/ขึ้นลงเตียง' },
  { v: 'bathing', label: 'อาบน้ำ/เช็ดตัว' },
  { v: 'dressing', label: 'แต่งตัว' },
  { v: 'toileting', label: 'เข้าห้องน้ำ' },
  { v: 'diaper_change', label: 'เปลี่ยนผ้าอ้อม' },
  { v: 'feeding', label: 'ช่วยป้อนอาหาร' },
  { v: 'tube_feeding', label: 'ให้อาหารทางสาย' },
  { v: 'medication_reminder', label: 'เตือนกินยา' },
  { v: 'medication_administration', label: 'ช่วยให้ยาตามแผนแพทย์' },
  { v: 'vitals_check', label: 'วัดสัญญาณชีพ' },
  { v: 'blood_sugar_check', label: 'วัดน้ำตาลปลายนิ้ว' },
  { v: 'wound_dressing', label: 'ทำแผล/เปลี่ยนผ้าพันแผล' },
  { v: 'catheter_care', label: 'ดูแลสายสวนปัสสาวะ' },
  { v: 'oxygen_monitoring', label: 'ดูแล/เฝ้าระวังออกซิเจน' },
  { v: 'dementia_supervision', label: 'ดูแลใกล้ชิด (สมองเสื่อม/หลงเดิน)' },
] as const;

const SKILL_OPTIONS = [
  { v: 'basic_first_aid', label: 'ปฐมพยาบาลเบื้องต้น' },
  { v: 'safe_transfer', label: 'ย้ายท่าอย่างปลอดภัย' },
  { v: 'vitals_monitoring', label: 'วัด/ติดตามสัญญาณชีพ' },
  { v: 'medication_management', label: 'จัดยา/ดูแลการใช้ยา' },
  { v: 'dementia_care', label: 'ดูแลผู้ป่วยสมองเสื่อม' },
  { v: 'post_surgery_care', label: 'ดูแลหลังผ่าตัด' },
  { v: 'wound_care', label: 'ทำแผล' },
  { v: 'catheter_care', label: 'ดูแลสายสวน' },
  { v: 'tube_feeding_care', label: 'ดูแลการให้อาหารทางสาย' },
] as const;

const EQUIPMENT_OPTIONS = [
  { v: 'wheelchair', label: 'รถเข็น' },
  { v: 'walker', label: 'Walker/ไม้เท้า' },
  { v: 'hospital_bed', label: 'เตียงผู้ป่วย' },
  { v: 'patient_lift', label: 'เครื่องยกพยุงผู้ป่วย' },
  { v: 'thermometer', label: 'เครื่องวัดไข้' },
  { v: 'bp_monitor', label: 'เครื่องวัดความดัน' },
  { v: 'pulse_oximeter', label: 'เครื่องวัดออกซิเจนปลายนิ้ว' },
  { v: 'glucometer', label: 'เครื่องวัดน้ำตาล' },
  { v: 'oxygen_concentrator', label: 'เครื่องให้ออกซิเจน' },
  { v: 'feeding_tube_supplies', label: 'อุปกรณ์สายให้อาหาร' },
  { v: 'wound_care_supplies', label: 'อุปกรณ์ทำแผล' },
] as const;

const PRECAUTION_OPTIONS = [
  { v: 'fall_risk', label: 'เสี่ยงหกล้ม' },
  { v: 'aspiration_risk', label: 'เสี่ยงสำลัก' },
  { v: 'infection_control', label: 'ต้องระวังการติดเชื้อ' },
  { v: 'pressure_ulcer_risk', label: 'เสี่ยงแผลกดทับ' },
  { v: 'behavioral_risk', label: 'เสี่ยงพฤติกรรม' },
  { v: 'allergy_precaution', label: 'ต้องระวังการแพ้' },
  { v: 'lifting_precaution', label: 'ต้องระวังการยกพยุง' },
] as const;

const labelByValue = (options: ReadonlyArray<OptionItem>, values: readonly string[]) => {
  const map = new Map(options.map((o) => [o.v, o.label]));
  return values.map((v) => map.get(v) || v);
};

type CreateJobStep = 1 | 2 | 3 | 4;

const CREATE_JOB_STEPS: Array<{ id: CreateJobStep; title: string; helper: string }> = [
  { id: 1, title: 'ข้อมูลหลักและคำถาม', helper: 'ผู้รับการดูแล + ประเภทงาน + คำถาม' },
  { id: 2, title: 'งานและคุณสมบัติ', helper: 'งานที่ต้องทำ + ทักษะ/อุปกรณ์' },
  { id: 3, title: 'เวลาและสถานที่', helper: 'วัน เวลา สถานที่ ราคา' },
  { id: 4, title: 'ตรวจทาน', helper: 'สรุปก่อนยืนยันบันทึก' },
];

const SECTION_STEP_MAP: Record<string, CreateJobStep> = {
  patient: 1,
  job_basic: 1,
  dynamic_questions: 2,
  job_tasks: 2,
  job_requirements: 2,
  job_schedule: 3,
  job_location: 3,
};

export default function CreateJobPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const hirerId = user?.id || 'demo-hirer';
  const preferredCaregiverIdParam = (searchParams.get('preferred_caregiver_id') || '').trim();
  const preferredCaregiverNameParam = (searchParams.get('preferred_caregiver_name') || '').trim();
  const preferredCaregiverTrustLevelParam = (searchParams.get('preferred_caregiver_trust_level') || '').trim();
  const shouldReturnToAssign = searchParams.get('return_to_assign') === '1';

  const [loading, setLoading] = useState(false);
  const [careRecipients, setCareRecipients] = useState<CareRecipient[]>([]);
  const [careRecipientId, setCareRecipientId] = useState<string>('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<CreateJobData | null>(null);
  const [errorAnchorId, setErrorAnchorId] = useState<string | null>(null);
  const [errorSection, setErrorSection] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [highlightTask, setHighlightTask] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState<CreateJobStep>(1);
  const [maxVisitedStep, setMaxVisitedStep] = useState<CreateJobStep>(1);
  const [pendingDetailedType, setPendingDetailedType] = useState<DetailedJobType | null>(null);
  const [templateSwitchOpen, setTemplateSwitchOpen] = useState(false);
  const [dynamicAnswers, setDynamicAnswers] = useState<Record<string, string>>({});
  const [showExtraTasks, setShowExtraTasks] = useState(false);
  const [showQuickAddRecipient, setShowQuickAddRecipient] = useState(false);
  const [quickRecipientName, setQuickRecipientName] = useState('');
  const [quickRecipientGender, setQuickRecipientGender] = useState('female');
  const [quickRecipientAge, setQuickRecipientAge] = useState('60_74');
  const [quickRecipientMobility, setQuickRecipientMobility] = useState('walk_independent');
  const [quickRecipientSaving, setQuickRecipientSaving] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    job_type: DETAILED_JOB_TEMPLATES[DEFAULT_DETAILED_JOB_TYPE].jobType as JobType,
    detailed_job_type: DEFAULT_DETAILED_JOB_TYPE as DetailedJobType,
    scheduled_start_at: '',
    scheduled_end_at: '',
    address_line1: '',
    address_line2: '',
    district: '',
    province: 'Bangkok',
    postal_code: '',
    lat: undefined as number | undefined,
    lng: undefined as number | undefined,
    hourly_rate: 350,
    total_hours: 8,
    is_urgent: false,
    job_tasks_flags: [...DETAILED_JOB_TEMPLATES[DEFAULT_DETAILED_JOB_TYPE].defaultTasks] as string[],
    required_skills_flags: [...DETAILED_JOB_TEMPLATES[DEFAULT_DETAILED_JOB_TYPE].defaultSkills] as string[],
    equipment_available_flags: [...DETAILED_JOB_TEMPLATES[DEFAULT_DETAILED_JOB_TYPE].defaultEquipment] as string[],
    precautions_flags: [...DETAILED_JOB_TEMPLATES[DEFAULT_DETAILED_JOB_TYPE].defaultPrecautions] as string[],
  });

  useEffect(() => {
    if (currentStep > maxVisitedStep) {
      setMaxVisitedStep(currentStep);
    }
  }, [currentStep, maxVisitedStep]);

  // Unsaved changes warning
  const hasUnsavedChanges = useCallback(() => {
    return currentStep > 1 || form.title.trim().length > 0 || form.description.trim().length > 0;
  }, [currentStep, form.title, form.description]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    return hasUnsavedChanges() && currentLocation.pathname !== nextLocation.pathname;
  });

  const handleQuickAddRecipient = async () => {
    const name = quickRecipientName.trim();
    if (!name) { toast.error('กรุณากรอกชื่อผู้รับการดูแล'); return; }
    setQuickRecipientSaving(true);
    try {
      const res = await appApi.createCareRecipient({
        patient_display_name: name,
        gender: quickRecipientGender,
        age_band: quickRecipientAge,
        mobility_level: quickRecipientMobility,
      });
      if (res.success && res.data?.id) {
        setCareRecipients((prev) => [...prev, res.data]);
        setCareRecipientId(res.data.id);
        setShowQuickAddRecipient(false);
        setQuickRecipientName('');
        toast.success('เพิ่มผู้รับการดูแลแล้ว');
      } else {
        toast.error(res.error || 'เพิ่มผู้รับการดูแลไม่สำเร็จ');
      }
    } catch { toast.error('เพิ่มผู้รับการดูแลไม่สำเร็จ'); }
    finally { setQuickRecipientSaving(false); }
  };

  const currentDetailedTemplate = useMemo(() => {
    return DETAILED_JOB_TEMPLATES[form.detailed_job_type];
  }, [form.detailed_job_type]);

  const selectedCareRecipient = useMemo(() => {
    if (!careRecipientId) return null;
    return careRecipients.find((p) => p.id === careRecipientId) || null;
  }, [careRecipientId, careRecipients]);

  const suggestions = useMemo(() => {
    const needs = new Set(selectedCareRecipient?.care_needs_flags ?? []);
    const devices = new Set(selectedCareRecipient?.medical_devices_flags ?? []);
    const behaviors = new Set(selectedCareRecipient?.behavior_risks_flags ?? []);
    const cognitive = String(selectedCareRecipient?.cognitive_status || '');
    const mobility = String(selectedCareRecipient?.mobility_level || '');
    const selectedTasks = new Set(form.job_tasks_flags || []);

    const tasks = new Set<string>();
    const precautions = new Set<string>();
    const skills = new Set<string>();
    const equipment = new Set<string>();

    if (mobility === 'wheelchair' || mobility === 'bedbound' || needs.has('transfer_assist')) {
      tasks.add('transfer_assist');
      skills.add('safe_transfer');
      precautions.add('lifting_precaution');
      if (mobility === 'wheelchair') equipment.add('wheelchair');
      if (mobility === 'bedbound') equipment.add('hospital_bed');
      equipment.add('patient_lift');
    }
    if (needs.has('bathing')) tasks.add('bathing');
    if (needs.has('dressing')) tasks.add('dressing');
    if (needs.has('toileting')) tasks.add('toileting');
    if (needs.has('feeding')) tasks.add('feeding');
    if (needs.has('tube_feeding')) {
      tasks.add('tube_feeding');
      skills.add('tube_feeding_care');
      precautions.add('aspiration_risk');
    }
    if (needs.has('medication_reminder')) tasks.add('medication_reminder');
    if (needs.has('medication_administration')) {
      tasks.add('medication_administration');
      skills.add('medication_management');
    }
    if (needs.has('vitals_check')) {
      tasks.add('vitals_check');
      skills.add('vitals_monitoring');
      equipment.add('bp_monitor');
      equipment.add('thermometer');
    }

    if (devices.has('wound_dressing')) {
      tasks.add('wound_dressing');
      skills.add('wound_care');
      precautions.add('infection_control');
      equipment.add('wound_care_supplies');
    }
    if (devices.has('urinary_catheter')) {
      tasks.add('catheter_care');
      skills.add('catheter_care');
      precautions.add('infection_control');
    }
    if (devices.has('oxygen')) {
      tasks.add('oxygen_monitoring');
      precautions.add('infection_control');
      equipment.add('oxygen_concentrator');
      equipment.add('pulse_oximeter');
    }

    if (behaviors.has('fall_risk')) precautions.add('fall_risk');
    if (behaviors.has('choking_risk')) precautions.add('aspiration_risk');
    if (behaviors.has('infection_control')) precautions.add('infection_control');
    if (behaviors.has('aggression') || behaviors.has('wandering') || cognitive === 'dementia' || cognitive === 'delirium') {
      tasks.add('dementia_supervision');
      skills.add('dementia_care');
      precautions.add('behavioral_risk');
    }

    if (selectedTasks.has('vitals_check')) {
      equipment.add('bp_monitor');
      equipment.add('thermometer');
    }
    if (selectedTasks.has('blood_sugar_check')) equipment.add('glucometer');
    if (selectedTasks.has('tube_feeding')) equipment.add('feeding_tube_supplies');
    if (selectedTasks.has('wound_dressing')) equipment.add('wound_care_supplies');
    if (selectedTasks.has('oxygen_monitoring')) {
      equipment.add('oxygen_concentrator');
      equipment.add('pulse_oximeter');
    }
    if (selectedTasks.has('transfer_assist')) equipment.add('patient_lift');

    const outTasks = Array.from(tasks);
    const outPrecautions = Array.from(precautions);
    const outSkills = Array.from(skills);
    const outEquipment = Array.from(equipment);

    if (!outTasks.length && !outPrecautions.length && !outSkills.length && !outEquipment.length) return null;
    return { tasks: outTasks, precautions: outPrecautions, skills: outSkills, equipment: outEquipment };
  }, [form.job_tasks_flags, selectedCareRecipient]);

  const computedRisk = useMemo(() => {
    return computeRiskLevel({ jobType: form.job_type, careRecipient: selectedCareRecipient, jobTasksFlags: form.job_tasks_flags });
  }, [form.job_type, form.job_tasks_flags, selectedCareRecipient]);

  const patientSummary = useMemo(() => {
    if (!selectedCareRecipient) return null;
    const p = selectedCareRecipient;
    const tags: { label: string; variant: NonNullable<BadgeProps['variant']> }[] = [];

    if (p.mobility_level) tags.push({ label: `การเคลื่อนไหว: ${p.mobility_level}`, variant: 'info' });
    if (p.communication_style) tags.push({ label: `สื่อสาร: ${p.communication_style}`, variant: 'info' });
    if (p.cognitive_status) tags.push({ label: `สติ/ความจำ: ${p.cognitive_status}`, variant: 'warning' });

    const addFlags = (
      arr: string[] | null | undefined,
      prefix: string,
      variant: NonNullable<BadgeProps['variant']>
    ) => {
      for (const v of arr || []) tags.push({ label: `${prefix}${v}`, variant });
    };

    addFlags(p.chronic_conditions_flags, 'โรค: ', 'default');
    addFlags(p.symptoms_flags, 'อาการ: ', 'danger');
    addFlags(p.medical_devices_flags, 'อุปกรณ์: ', 'warning');
    addFlags(p.care_needs_flags, 'ต้องช่วย: ', 'info');
    addFlags(p.behavior_risks_flags, 'เสี่ยง: ', 'warning');
    addFlags(p.allergies_flags, 'แพ้: ', 'default');

    return { tags };
  }, [selectedCareRecipient]);

  const totalAmount = useMemo(() => {
    const hourly = Number(form.hourly_rate) || 0;
    const hours = Number(form.total_hours) || 0;
    return Math.round(hourly * hours);
  }, [form.hourly_rate, form.total_hours]);


  const toggleJobTask = (taskValue: string) => {
    setErrorSection(null);
    setErrorMessage(null);
    setHighlightTask(null);
    setFieldErrors((prev) => ({ ...prev, job_tasks_flags: '' }));
    setForm((prev) => {
      const next = new Set(prev.job_tasks_flags);
      if (next.has(taskValue)) next.delete(taskValue);
      else next.add(taskValue);
      return { ...prev, job_tasks_flags: Array.from(next) };
    });
  };

  const setStepError = (params: {
    section: keyof typeof SECTION_STEP_MAP;
    message: string;
    fields?: Record<string, string>;
    highlightTask?: string | null;
  }) => {
    const { section, message, fields = {}, highlightTask: nextHighlightTask = null } = params;
    setCurrentStep(SECTION_STEP_MAP[section]);
    setErrorSection(section);
    setErrorMessage(message);
    setFieldErrors(fields);
    setHighlightTask(nextHighlightTask);
    setErrorAnchorId(`section-${section}`);
    toast.error(message);
  };

  const validateStepOne = () => {
    if (!careRecipientId) {
      setStepError({ section: 'patient', message: 'กรุณาเลือกผู้รับการดูแล' });
      return false;
    }

    if (!form.title.trim()) {
      setStepError({ section: 'job_basic', message: 'กรุณากรอกชื่องาน', fields: { title: 'กรุณากรอกชื่องาน' } });
      return false;
    }

    if (!form.description.trim()) {
      setStepError({ section: 'job_basic', message: 'กรุณากรอกรายละเอียดงาน', fields: { description: 'กรุณากรอกรายละเอียดงาน' } });
      return false;
    }

    return true;
  };

  const validateStepTwo = () => {
    if (!form.job_tasks_flags.length) {
      setStepError({ section: 'job_tasks', message: 'กรุณาเลือกงานที่ต้องทำอย่างน้อย 1 อย่าง', fields: { job_tasks_flags: 'กรุณาเลือกงานที่ต้องทำอย่างน้อย 1 อย่าง' } });
      return false;
    }
    return true;
  };

  const validateStepThree = () => {
    if (!form.scheduled_start_at || !form.scheduled_end_at) {
      setStepError({
        section: 'job_schedule',
        message: 'กรุณาเลือกวันและเวลาเริ่ม/สิ้นสุด',
        fields: {
          scheduled_start_at: 'กรุณาเลือกวันและเวลาเริ่ม/สิ้นสุด',
          scheduled_end_at: 'กรุณาเลือกวันและเวลาเริ่ม/สิ้นสุด',
        },
      });
      return false;
    }

    const start = new Date(form.scheduled_start_at);
    const end = new Date(form.scheduled_end_at);
    if (start >= end) {
      setStepError({
        section: 'job_schedule',
        message: 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม',
        fields: { scheduled_end_at: 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม' },
      });
      return false;
    }

    if (start <= new Date()) {
      setStepError({
        section: 'job_schedule',
        message: 'เวลาเริ่มงานต้องอยู่ในอนาคต',
        fields: { scheduled_start_at: 'เวลาเริ่มงานต้องอยู่ในอนาคต' },
      });
      return false;
    }

    if (!form.address_line1.trim()) {
      setStepError({ section: 'job_location', message: 'กรุณากรอกที่อยู่', fields: { address_line1: 'กรุณากรอกที่อยู่' } });
      return false;
    }

    if (Number(form.hourly_rate) <= 0 || Number(form.total_hours) <= 0) {
      setStepError({
        section: 'job_location',
        message: 'กรุณาระบุเรทรายชั่วโมงและจำนวนชั่วโมงให้ถูกต้อง',
      });
      return false;
    }

    return true;
  };

  const handleNextStep = () => {
    const clearErrors = () => {
      setErrorSection(null);
      setErrorMessage(null);
      setFieldErrors({});
    };
    if (currentStep === 1) {
      if (!validateStepOne()) return;
      clearErrors();
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!validateStepTwo()) return;
      clearErrors();
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!validateStepThree()) return;
      clearErrors();
      setCurrentStep(4);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevStep = () => {
    setErrorSection(null);
    setErrorMessage(null);
    setFieldErrors({});
    setCurrentStep((prev) => (prev === 1 ? 1 : ((prev - 1) as CreateJobStep)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const applyDetailedJobTemplate = (
    nextDetailedType: DetailedJobType,
    options: { resetTasks?: boolean } = {}
  ) => {
    const template = DETAILED_JOB_TEMPLATES[nextDetailedType];
    const resetTasks = options.resetTasks ?? true;
    setErrorSection(null);
    setErrorMessage(null);
    setHighlightTask(null);
    setFieldErrors({});
    setDynamicAnswers({});
    setShowExtraTasks(false);

    setForm((prev) => ({
      ...prev,
      detailed_job_type: nextDetailedType,
      job_type: template.jobType,
      title: prev.title.trim() ? prev.title : template.defaultTitle,
      job_tasks_flags: resetTasks ? [...template.defaultTasks] : prev.job_tasks_flags,
      required_skills_flags: resetTasks ? [...template.defaultSkills] : prev.required_skills_flags,
      equipment_available_flags: resetTasks ? [...template.defaultEquipment] : prev.equipment_available_flags,
      precautions_flags: resetTasks ? [...template.defaultPrecautions] : prev.precautions_flags,
    }));
  };

  const handleDetailedTypeSelection = (nextDetailedType: DetailedJobType) => {
    if (nextDetailedType === form.detailed_job_type) return;

    const currentDefaultTasks = new Set(currentDetailedTemplate.defaultTasks);
    const hasCustomizedTasks =
      form.job_tasks_flags.length !== currentDefaultTasks.size ||
      form.job_tasks_flags.some((task) => !currentDefaultTasks.has(task));

    if (!hasCustomizedTasks) {
      applyDetailedJobTemplate(nextDetailedType, { resetTasks: true });
      return;
    }

    setPendingDetailedType(nextDetailedType);
    setTemplateSwitchOpen(true);
  };

  const closeTemplateSwitch = () => {
    setTemplateSwitchOpen(false);
    setPendingDetailedType(null);
  };

  const applyPendingDetailedType = (resetTasks: boolean) => {
    if (!pendingDetailedType) return;
    applyDetailedJobTemplate(pendingDetailedType, { resetTasks });
    closeTemplateSwitch();
  };

  const applyDynamicAnswer = (questionId: string, value: string) => {
    setDynamicAnswers((prev) => ({ ...prev, [questionId]: value }));
    const question = currentDetailedTemplate.dynamicQuestions.find((q) => q.id === questionId);
    if (!question) return;
    const effect = question.effects[value];
    setForm((prev) => {
      const nextTasks = new Set(prev.job_tasks_flags);
      const nextSkills = new Set(prev.required_skills_flags);
      const nextEquipment = new Set(prev.equipment_available_flags);
      const nextPrecautions = new Set(prev.precautions_flags);

      for (const opt of question.options) {
        const otherEffect = question.effects[opt.value];
        if (opt.value !== value && otherEffect) {
          for (const t of otherEffect.addTasks || []) nextTasks.delete(t);
          for (const s of otherEffect.addSkills || []) nextSkills.delete(s);
          for (const e of otherEffect.addEquipment || []) nextEquipment.delete(e);
          for (const p of otherEffect.addPrecautions || []) nextPrecautions.delete(p);
        }
      }

      if (effect) {
        for (const t of effect.addTasks || []) nextTasks.add(t);
        for (const t of effect.removeTasks || []) nextTasks.delete(t);
        for (const s of effect.addSkills || []) nextSkills.add(s);
        for (const e of effect.addEquipment || []) nextEquipment.add(e);
        for (const p of effect.addPrecautions || []) nextPrecautions.add(p);
      }

      return {
        ...prev,
        job_type: effect?.setJobType || prev.job_type,
        job_tasks_flags: Array.from(nextTasks),
        required_skills_flags: Array.from(nextSkills),
        equipment_available_flags: Array.from(nextEquipment),
        precautions_flags: Array.from(nextPrecautions),
      };
    });
  };

  const relevantTaskValues = useMemo(() => {
    const values = new Set(currentDetailedTemplate.defaultTasks);
    for (const q of currentDetailedTemplate.dynamicQuestions) {
      for (const opt of q.options) {
        const effect = q.effects[opt.value];
        for (const t of effect?.addTasks || []) values.add(t);
      }
    }
    return values;
  }, [currentDetailedTemplate]);

  useEffect(() => {
    if (!selectedCareRecipient) return;
    const hasLocation =
      !!selectedCareRecipient.address_line1 ||
      typeof selectedCareRecipient.lat === 'number' ||
      typeof selectedCareRecipient.lng === 'number';
    if (!hasLocation) return;
    setForm((prev) => ({
      ...prev,
      address_line1: selectedCareRecipient.address_line1 || '',
      address_line2: selectedCareRecipient.address_line2 || '',
      district: selectedCareRecipient.district || '',
      province: selectedCareRecipient.province || prev.province,
      postal_code: selectedCareRecipient.postal_code || '',
      lat: typeof selectedCareRecipient.lat === 'number' ? selectedCareRecipient.lat : prev.lat,
      lng: typeof selectedCareRecipient.lng === 'number' ? selectedCareRecipient.lng : prev.lng,
    }));
  }, [selectedCareRecipient?.id]);

  const toCreatePayload = (): CreateJobData => {
    const selectedTemplate = DETAILED_JOB_TEMPLATES[form.detailed_job_type];

    if (!form.scheduled_start_at || !form.scheduled_end_at) {
      throw new Error('กรุณาเลือกวันและเวลาเริ่ม/สิ้นสุด');
    }
    if (!form.title.trim()) throw new Error('กรุณากรอกชื่องาน');
    if (!form.description.trim()) throw new Error('กรุณากรอกรายละเอียดงาน');
    if (!form.address_line1.trim()) throw new Error('กรุณากรอกที่อยู่');
    if (!form.job_tasks_flags.length) throw new Error('กรุณาเลือกงานที่ต้องทำอย่างน้อย 1 อย่าง');
    if (!careRecipientId) throw new Error('กรุณาเลือกผู้รับการดูแล');

    const detailLines = [`ประเภทงานหลัก: ${selectedTemplate.label}`];
    for (const q of selectedTemplate.dynamicQuestions) {
      const ans = dynamicAnswers[q.id];
      if (ans) {
        const optLabel = q.options.find((o) => o.value === ans)?.label || ans;
        detailLines.push(`${q.label}: ${optLabel}`);
      }
    }

    const finalDescription = [
      form.description.trim(),
      '',
      'รายละเอียดเพิ่มเติมจากประเภทงาน',
      ...detailLines.map((line) => `- ${line}`),
    ].join('\n');

    return {
      title: form.title.trim(),
      description: finalDescription,
      job_type: form.job_type,
      risk_level: computedRisk.risk_level,
      scheduled_start_at: new Date(form.scheduled_start_at).toISOString(),
      scheduled_end_at: new Date(form.scheduled_end_at).toISOString(),
      address_line1: form.address_line1.trim(),
      address_line2: form.address_line2.trim() || undefined,
      district: form.district.trim() || undefined,
      province: form.province.trim() || undefined,
      postal_code: form.postal_code.trim() || undefined,
      lat: typeof form.lat === 'number' ? form.lat : undefined,
      lng: typeof form.lng === 'number' ? form.lng : undefined,
      geofence_radius_m: 1000,
      hourly_rate: Number(form.hourly_rate),
      total_hours: Number(form.total_hours),
      is_urgent: form.is_urgent,
      patient_profile_id: careRecipientId || undefined,
      job_tasks_flags: Array.from(new Set(form.job_tasks_flags)),
      required_skills_flags: form.required_skills_flags,
      equipment_available_flags: form.equipment_available_flags,
      precautions_flags: form.precautions_flags,
    };
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const res = await appApi.getCareRecipients();
      if (cancelled) return;
      if (!res.success || !res.data) {
        setCareRecipients([]);
        setCareRecipientId('');
        return;
      }
      const active = res.data.filter((p) => p.is_active);
      setCareRecipients(active);
      setCareRecipientId((prev) => {
        if (prev && active.some((p) => p.id === prev)) return prev;
        return active[0]?.id || '';
      });
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [hirerId]);

  const handleSubmit = async () => {
    if (loading) return;

    let nextPayload: CreateJobData;
    try {
      nextPayload = toCreatePayload();
      setPendingPayload(nextPayload);
      setFieldErrors((prev) => ({ ...prev, description: '' }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'กรอกข้อมูลไม่ครบ';
      if (msg.includes('รายละเอียดงาน')) {
        setFieldErrors((prev) => ({ ...prev, description: msg }));
      }
      toast.error(msg);
      return;
    }

    setLoading(true);
    try {
      const res = (await appApi.createJob(hirerId, nextPayload)) as CreateJobResult;
      const createdJob = res.success ? res.data?.job : null;
      if (!createdJob?.id) {
        const errObj: CreateJobErrorObject | undefined =
          typeof res.error === 'object' && res.error ? res.error : undefined;
        const details = res.details || errObj?.details || {};
        const code = res.code || errObj?.code;
        const section = details.section;
        const field = details.field;
        const relatedTask = details.related_task;

        const taskLabel = relatedTask ? (labelByValue(JOB_TASK_OPTIONS, [relatedTask])[0] || relatedTask) : null;
        let thai = typeof res.error === 'string' ? res.error : errObj?.message || 'สร้างงานไม่สำเร็จ';
        if (code === 'JOB_REQUIRED_FIELD') {
          const map: Record<string, string> = {
            title: 'กรุณากรอกชื่องาน',
            description: 'กรุณากรอกรายละเอียดงาน',
            address_line1: 'กรุณากรอกที่อยู่',
            scheduled_start_at: 'กรุณาเลือกวันและเวลาเริ่มงาน',
            scheduled_end_at: 'กรุณาเลือกวันและเวลาสิ้นสุด',
            patient_profile_id: 'กรุณาเลือกผู้รับการดูแล',
          };
          thai = map[field || ''] || 'กรุณากรอกข้อมูลให้ครบ';
        } else if (code === 'JOB_SCHEDULE_INVALID') {
          thai = 'วัน/เวลาไม่ถูกต้อง กรุณาตรวจสอบเวลาเริ่มและเวลาสิ้นสุด';
        } else if (code === 'JOB_TASKS_REQUIRED') {
          thai = 'กรุณาเลือกงานที่ต้องทำอย่างน้อย 1 อย่าง';
        } else if (code === 'PATIENT_NOT_FOUND') {
          thai = 'ไม่พบผู้รับการดูแลที่เลือก กรุณาเลือกใหม่';
        } else if (code === 'PATIENT_TASK_MISMATCH') {
          thai = taskLabel ? `งานที่เลือกไม่สอดคล้องกับข้อมูลผู้ป่วย: ${taskLabel}` : 'งานที่เลือกไม่สอดคล้องกับข้อมูลผู้ป่วย';
        } else if (code === 'JOB_FLAGS_INVALID') {
          thai = 'มีตัวเลือกบางอย่างไม่ถูกต้อง กรุณารีเฟรชหน้าแล้วลองใหม่';
        }

        setErrorMessage(thai);
        setErrorSection(section || null);
        if (section && SECTION_STEP_MAP[section]) {
          setCurrentStep(SECTION_STEP_MAP[section]);
        }
        setHighlightTask(relatedTask || null);
        if (field) {
          setFieldErrors({ [field]: thai });
        } else if (code === 'JOB_TASKS_REQUIRED' || code === 'PATIENT_TASK_MISMATCH') {
          setFieldErrors({ job_tasks_flags: thai });
        } else {
          setFieldErrors({});
        }
        if (section) setErrorAnchorId(`section-${section}`);
        toast.error(thai);
        setReviewOpen(false);
        return;
      }

      toast.success('สร้างงานแบบร่างสำเร็จ');
      setReviewOpen(false);
      setPendingPayload(null);

      if (shouldReturnToAssign && preferredCaregiverIdParam) {
        const returnParams = new URLSearchParams();
        returnParams.set('resume_assign', '1');
        returnParams.set('caregiver_id', preferredCaregiverIdParam);
        returnParams.set('job_id', createdJob.id);
        if (preferredCaregiverNameParam) {
          returnParams.set('caregiver_name', preferredCaregiverNameParam);
        }
        if (preferredCaregiverTrustLevelParam) {
          returnParams.set('caregiver_trust_level', preferredCaregiverTrustLevelParam);
        }
        navigate(`/hirer/search-caregivers?${returnParams.toString()}`, { replace: true });
        return;
      }

      navigate('/hirer/home', { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'สร้างงานไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const openReview = () => {
    if (loading) return;
    try {
      const payload = toCreatePayload();
      setErrorSection(null);
      setErrorMessage(null);
      setFieldErrors({});
      setHighlightTask(null);
      setPendingPayload(payload);
      setReviewOpen(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'กรอกข้อมูลไม่ครบ';
      setErrorMessage(msg);
      if (msg.includes('วันและเวลา')) {
        setCurrentStep(3);
        setErrorSection('job_schedule');
        setFieldErrors({ scheduled_start_at: msg, scheduled_end_at: msg });
        setErrorAnchorId('section-job_schedule');
      } else if (msg.includes('ชื่องาน') || msg.includes('รายละเอียดงาน')) {
        setCurrentStep(1);
        setErrorSection('job_basic');
        setErrorAnchorId('section-job_basic');
      } else if (msg.includes('ที่อยู่') || msg.includes('Google Maps')) {
        setCurrentStep(3);
        setErrorSection('job_location');
        setFieldErrors({ address_line1: msg });
        setErrorAnchorId('section-job_location');
      } else if (msg.includes('ผู้รับการดูแล')) {
        setCurrentStep(1);
        setErrorSection('patient');
        setErrorAnchorId('section-patient');
      } else if (msg.includes('งานที่ต้องทำ')) {
        setCurrentStep(2);
        setErrorSection('job_tasks');
        setFieldErrors({ job_tasks_flags: msg });
        setErrorAnchorId('section-job_tasks');
      }
      toast.error(msg);
    }
  };

  useEffect(() => {
    if (!errorAnchorId) return;
    const el = document.getElementById(errorAnchorId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setErrorAnchorId(null);
  }, [errorAnchorId]);

  const applySuggestions = () => {
    if (!suggestions) return;
    setErrorSection(null);
    setErrorMessage(null);
    setHighlightTask(null);
    setFieldErrors((prev) => ({ ...prev, job_tasks_flags: '' }));
    setForm((prev) => ({
      ...prev,
      job_tasks_flags: [...suggestions.tasks],
      precautions_flags: [...suggestions.precautions],
      required_skills_flags: [...suggestions.skills],
      equipment_available_flags: [...(suggestions.equipment || [])],
    }));
    toast.success('นำคำแนะนำมาใช้แล้ว');
  };

  const handleDescriptionChange = (value: string) => {
    setErrorSection(null);
    setErrorMessage(null);
    setFieldErrors((prev) => ({ ...prev, description: '' }));
    setForm((prev) => ({ ...prev, description: value }));
  };

  return (
    <MainLayout showBottomBar={false}>
      {/* Unsaved changes blocker modal */}
      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">ออกจากหน้านี้?</h3>
            <p className="text-sm text-gray-600 mb-4">ข้อมูลที่กรอกไว้จะหายไป คุณแน่ใจหรือไม่?</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => blocker.reset?.()}>อยู่ต่อ</Button>
              <Button variant="danger" size="sm" onClick={() => blocker.proceed?.()}>ออกจากหน้านี้</Button>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h1 className="text-2xl font-bold text-gray-900">สร้างงานใหม่</h1>
          <Button variant="outline" onClick={() => navigate(-1)} disabled={loading}>
            ย้อนกลับ
          </Button>
        </div>
        <p className="text-sm text-gray-600 mb-6">สร้างเป็นแบบร่างก่อน แล้วค่อยเผยแพร่ในหน้า “งานของฉัน”</p>

        <Card className="p-4 sm:p-6">
          <div className="space-y-4">
            {errorSection && errorMessage && (
              <div className="p-3 border border-red-300 bg-red-50 rounded-lg text-sm text-red-800">
                {errorMessage}
              </div>
            )}

            <Card className="p-4 border-blue-200 bg-blue-50/50">
              <div className="text-sm font-semibold text-gray-900 mb-2">ขั้นตอนการสร้างงาน</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CREATE_JOB_STEPS.map((step) => {
                  const isActive = currentStep === step.id;
                  const isDone = currentStep > step.id;
                  const canJump = step.id <= maxVisitedStep;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      disabled={!canJump}
                      onClick={() => setCurrentStep(step.id)}
                      className={cn(
                        'text-left border rounded-lg px-3 py-2 transition-colors',
                        isActive ? 'border-blue-500 bg-blue-100' : isDone ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-white text-gray-400',
                        !canJump && 'cursor-not-allowed'
                      )}
                    >
                      <div className="text-xs font-semibold">{step.id}</div>
                      <div className="text-sm font-semibold text-gray-900 mt-0.5">{step.title}</div>
                      <div className="text-[11px] text-gray-600 mt-0.5 hidden sm:block">{step.helper}</div>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* ───── Step 1: ผู้รับการดูแล + ประเภทงาน ───── */}
            {currentStep === 1 && (
              <>
                <div
                  id="section-patient"
                  className={cn('flex flex-col gap-1 p-3 border rounded-lg', errorSection === 'patient' ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white')}
                >
                  <label className="text-sm font-semibold text-gray-700">ผู้รับการดูแล</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white" value={careRecipientId} onChange={(e) => setCareRecipientId(e.target.value)}>
                    <option value="">ยังไม่ได้เลือก</option>
                    {careRecipients.map((p) => (<option key={p.id} value={p.id}>{p.patient_display_name}</option>))}
                  </select>
                  {careRecipients.length === 0 && !showQuickAddRecipient && <div className="text-xs text-red-600">ยังไม่มีผู้รับการดูแล</div>}
                  <div className="flex flex-wrap gap-2">
                    {!showQuickAddRecipient && (
                      <Button variant="primary" size="sm" onClick={() => setShowQuickAddRecipient(true)}>+ เพิ่มเร็ว</Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => navigate('/hirer/care-recipients')}>จัดการผู้รับการดูแล</Button>
                  </div>
                  {showQuickAddRecipient && (
                    <div className="mt-2 p-3 border border-blue-200 bg-blue-50/50 rounded-lg space-y-2">
                      <div className="text-xs font-semibold text-blue-800">เพิ่มผู้รับการดูแลแบบเร็ว</div>
                      <input
                        type="text"
                        value={quickRecipientName}
                        onChange={(e) => setQuickRecipientName(e.target.value)}
                        placeholder="ชื่อผู้รับการดูแล เช่น คุณแม่สมศรี"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <select className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white" value={quickRecipientGender} onChange={(e) => setQuickRecipientGender(e.target.value)}>
                          <option value="female">หญิง</option>
                          <option value="male">ชาย</option>
                          <option value="other">อื่นๆ</option>
                        </select>
                        <select className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white" value={quickRecipientAge} onChange={(e) => setQuickRecipientAge(e.target.value)}>
                          <option value="0_12">เด็ก (0-12)</option>
                          <option value="13_17">วัยรุ่น (13-17)</option>
                          <option value="18_59">ผู้ใหญ่ (18-59)</option>
                          <option value="60_74">ผู้สูงอายุ (60-74)</option>
                          <option value="75_89">ผู้สูงอายุ (75-89)</option>
                          <option value="90_plus">ผู้สูงอายุ (90+)</option>
                        </select>
                        <select className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white" value={quickRecipientMobility} onChange={(e) => setQuickRecipientMobility(e.target.value)}>
                          <option value="walk_independent">เดินได้เอง</option>
                          <option value="walk_assisted">ต้องพยุง</option>
                          <option value="wheelchair">รถเข็น</option>
                          <option value="bedbound">ติดเตียง</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="primary" size="sm" onClick={handleQuickAddRecipient} loading={quickRecipientSaving}>บันทึก</Button>
                        <Button variant="outline" size="sm" onClick={() => setShowQuickAddRecipient(false)}>ยกเลิก</Button>
                      </div>
                      <div className="text-[10px] text-gray-500">แก้ไขรายละเอียดเพิ่มเติมได้ภายหลังที่เมนู "ผู้รับการดูแล"</div>
                    </div>
                  )}
                </div>

                {selectedCareRecipient && patientSummary && (
                  <Card className="p-4">
                    <div className="text-sm font-semibold text-gray-900">สรุปผู้ได้รับการดูแล</div>
                    <div className="text-xs text-gray-600 mt-1">{selectedCareRecipient.patient_display_name}</div>
                    {selectedCareRecipient.general_health_summary && <div className="text-sm text-gray-800 mt-2 whitespace-pre-wrap">{selectedCareRecipient.general_health_summary}</div>}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {patientSummary.tags.slice(0, 20).map((t, idx) => (<Badge key={idx} variant={t.variant}>{t.label}</Badge>))}
                      {patientSummary.tags.length > 20 && <Badge variant="default">+{patientSummary.tags.length - 20}</Badge>}
                    </div>
                  </Card>
                )}

                <Card id="section-job_basic" className={cn(errorSection === 'job_basic' ? 'border-red-400 bg-red-50' : undefined)}>
                  <div className="text-sm font-semibold text-gray-900 mb-3">ข้อมูลงาน</div>
                  <Input label="ชื่องาน" value={form.title} error={fieldErrors.title} onChange={(e) => { setErrorSection(null); setErrorMessage(null); setFieldErrors((prev) => ({ ...prev, title: '' })); setForm({ ...form, title: e.target.value }); }} placeholder="เช่น ดูแลผู้สูงอายุช่วงเช้า" required />
                  <div className="flex flex-col gap-1 mt-3">
                    <label className="text-sm font-semibold text-gray-700">รายละเอียดงาน</label>
                    <textarea className={cn('w-full px-4 py-2 border rounded-lg transition-colors', 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent', fieldErrors.description ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 hover:border-gray-400', 'min-h-28')} value={form.description} onChange={(e) => handleDescriptionChange(e.target.value)} placeholder="อธิบายสิ่งที่ต้องทำ ข้อควรระวัง อุปกรณ์ ฯลฯ" />
                    {fieldErrors.description && <div className="text-sm text-red-600">{fieldErrors.description}</div>}
                  </div>

                  <div className="flex flex-col gap-1 mt-3">
                    <label className="text-sm font-semibold text-gray-700">ประเภทงานหลัก</label>
                    <select className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white" value={form.detailed_job_type} onChange={(e) => handleDetailedTypeSelection(e.target.value as DetailedJobType)}>
                      {DETAILED_JOB_TYPE_ORDER.map((value) => (<option key={value} value={value}>{DETAILED_JOB_TEMPLATES[value].label}</option>))}
                    </select>
                    <div className="text-xs text-gray-500 mt-1">{currentDetailedTemplate.helper}</div>
                    {SPECIALIZED_TYPE_DIFFERENCE_HINT[form.detailed_job_type] && (
                      <div className="text-xs text-amber-700 mt-1">
                        {SPECIALIZED_TYPE_DIFFERENCE_HINT[form.detailed_job_type]}
                      </div>
                    )}
                    <div className="text-xs text-gray-400">หมวดงานหลัก: {JOB_TYPE_LABEL[currentDetailedTemplate.jobType]}</div>
                  </div>
                </Card>

                {currentDetailedTemplate.dynamicQuestions.length > 0 && (
                  <Card id="section-dynamic_questions" className="border-amber-200 bg-amber-50/50">
                    <div className="text-sm font-semibold text-gray-900 mb-1">คำถามเพิ่มเติมสำหรับ &quot;{currentDetailedTemplate.label}&quot;</div>
                    <div className="text-xs text-gray-600 mb-3">ตอบคำถามเพื่อให้ระบบเลือกงาน ทักษะ และอุปกรณ์ที่เกี่ยวข้องให้อัตโนมัติ</div>
                    <div className="space-y-4">
                      {currentDetailedTemplate.dynamicQuestions.map((q) => (
                        <div key={q.id} className="p-3 border border-amber-200 bg-white rounded-lg">
                          <div className="text-sm font-semibold text-gray-900">{q.label}</div>
                          {q.helper && <div className="text-xs text-gray-600 mt-0.5">{q.helper}</div>}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                            {q.options.map((opt) => {
                              const checked = dynamicAnswers[q.id] === opt.value;
                              return (
                                <label key={opt.value} className={cn('flex items-center gap-3 border rounded-lg px-3 py-2 cursor-pointer', checked ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white')}>
                                  <input type="radio" name={`dq_${q.id}`} checked={checked} onChange={() => applyDynamicAnswer(q.id, opt.value)} />
                                  <span className="text-sm text-gray-900">{opt.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            )}

            {/* ───── Step 2: งานที่ต้องทำ + ทักษะ/อุปกรณ์/ข้อควรระวัง ───── */}
            {currentStep === 2 && (
              <>
                {suggestions && (
                  <Card className="p-4">
                    <div className="text-sm font-semibold text-gray-900">คำแนะนำจากข้อมูลผู้ป่วย</div>
                    <div className="text-xs text-gray-600 mt-1">กดใช้คำแนะนำเพื่อเติมตัวเลือกที่สอดคล้องกับผู้ป่วยอัตโนมัติ</div>
                    {suggestions.tasks.length > 0 && <div className="mt-3"><div className="text-xs text-gray-600">งานที่แนะนำ</div><div className="flex flex-wrap gap-2 mt-2">{labelByValue(JOB_TASK_OPTIONS, suggestions.tasks).map((l) => (<Badge key={l} variant="info">{l}</Badge>))}</div></div>}
                    <div className="flex gap-2 mt-4 justify-end"><Button variant="outline" size="sm" onClick={applySuggestions}>ใช้คำแนะนำ</Button></div>
                  </Card>
                )}

                <Card id="section-job_tasks" className={cn(errorSection === 'job_tasks' ? 'border-red-400 bg-red-50' : undefined)}>
                  <div className="text-sm font-semibold text-gray-900 mb-1">งานที่ต้องทำ</div>
                  <div className="text-xs text-gray-600 mb-2">ระบบเลือกงานตามประเภท &quot;{currentDetailedTemplate.label}&quot; + คำตอบของคุณแล้ว ปรับเพิ่ม/ลดได้</div>
                  {fieldErrors.job_tasks_flags && <div className="text-sm text-red-700 mb-2">{fieldErrors.job_tasks_flags}</div>}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {JOB_TASK_OPTIONS.filter((opt) => relevantTaskValues.has(opt.v) || form.job_tasks_flags.includes(opt.v)).map((opt) => {
                      const checked = form.job_tasks_flags.includes(opt.v);
                      return (
                        <label key={opt.v} className={cn('flex items-center gap-3 border rounded-lg px-3 py-2 cursor-pointer', highlightTask === opt.v ? 'border-red-500 bg-red-50' : checked ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white')}>
                          <input type="checkbox" checked={checked} onChange={() => toggleJobTask(opt.v)} />
                          <span className="text-sm text-gray-900">{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>

                  {!showExtraTasks && (
                    <button type="button" className="mt-2 text-xs text-blue-700 hover:text-blue-800 underline" onClick={() => setShowExtraTasks(true)}>
                      แสดงงานอื่น ๆ ทั้งหมด
                    </button>
                  )}
                  {showExtraTasks && (
                    <>
                      <div className="text-xs text-gray-500 mt-3 mb-1">งานอื่น ๆ</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {JOB_TASK_OPTIONS.filter((opt) => !relevantTaskValues.has(opt.v) && !form.job_tasks_flags.includes(opt.v)).map((opt) => (
                          <label key={opt.v} className="flex items-center gap-3 border border-gray-200 rounded-lg px-3 py-2 cursor-pointer bg-gray-50">
                            <input type="checkbox" checked={false} onChange={() => toggleJobTask(opt.v)} />
                            <span className="text-sm text-gray-700">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                      <button type="button" className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline" onClick={() => setShowExtraTasks(false)}>ซ่อนงานอื่น ๆ</button>
                    </>
                  )}
                </Card>

                <div id="section-job_requirements" />
                <Card className={cn(errorSection === 'job_requirements' ? 'border-red-400 bg-red-50' : undefined)}>
                  <div className="text-sm font-semibold text-gray-900 mb-1">ทักษะที่ต้องมี</div>
                  <div className="text-xs text-gray-600 mb-2">ระบบแนะนำตามประเภทงานแล้ว ปรับเพิ่ม/ลดได้</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {SKILL_OPTIONS.map((opt) => {
                      const checked = form.required_skills_flags.includes(opt.v);
                      return (
                        <label key={opt.v} className={cn('flex items-center gap-3 border rounded-lg px-3 py-2 cursor-pointer', checked ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white')}>
                          <input type="checkbox" checked={checked} onChange={() => { setErrorSection(null); const next = new Set(form.required_skills_flags); if (next.has(opt.v)) next.delete(opt.v); else next.add(opt.v); setForm({ ...form, required_skills_flags: Array.from(next) }); }} />
                          <span className="text-sm text-gray-900">{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </Card>

                <Card>
                  <div className="text-sm font-semibold text-gray-900 mb-1">อุปกรณ์ที่มีให้</div>
                  <div className="text-xs text-gray-600 mb-2">ระบบแนะนำตามประเภทงานแล้ว ปรับเพิ่ม/ลดได้</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {EQUIPMENT_OPTIONS.map((opt) => {
                      const checked = form.equipment_available_flags.includes(opt.v);
                      return (
                        <label key={opt.v} className={cn('flex items-center gap-3 border rounded-lg px-3 py-2 cursor-pointer', checked ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white')}>
                          <input type="checkbox" checked={checked} onChange={() => { setErrorSection(null); const next = new Set(form.equipment_available_flags); if (next.has(opt.v)) next.delete(opt.v); else next.add(opt.v); setForm({ ...form, equipment_available_flags: Array.from(next) }); }} />
                          <span className="text-sm text-gray-900">{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </Card>

                <Card>
                  <div className="text-sm font-semibold text-gray-900 mb-1">ข้อควรระวัง/ความปลอดภัย</div>
                  <div className="text-xs text-gray-600 mb-2">ระบบแนะนำตามประเภทงานแล้ว ปรับเพิ่ม/ลดได้</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PRECAUTION_OPTIONS.map((opt) => {
                      const checked = form.precautions_flags.includes(opt.v);
                      return (
                        <label key={opt.v} className={cn('flex items-center gap-3 border rounded-lg px-3 py-2 cursor-pointer', checked ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white')}>
                          <input type="checkbox" checked={checked} onChange={() => { setErrorSection(null); const next = new Set(form.precautions_flags); if (next.has(opt.v)) next.delete(opt.v); else next.add(opt.v); setForm({ ...form, precautions_flags: Array.from(next) }); }} />
                          <span className="text-sm text-gray-900">{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </Card>

                <div className={cn('w-full px-4 py-2 border rounded-lg mt-1', computedRisk.risk_level === 'high_risk' ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50')}>
                  <div className="text-sm font-semibold text-gray-900">{computedRisk.risk_level === 'high_risk' ? 'ความเสี่ยงสูง' : 'ความเสี่ยงต่ำ'}</div>
                  <div className="text-xs text-gray-600 mt-1">{computedRisk.reason}</div>
                </div>
              </>
            )}

            {/* ───── Step 3: เวลา สถานที่ ราคา ───── */}
            {currentStep === 3 && (
              <>
                <div id="section-job_schedule" />
                <Card className={cn(errorSection === 'job_schedule' ? 'border-red-400 bg-red-50' : undefined)}>
                  <div className="text-sm font-semibold text-gray-900 mb-3">วันและเวลา</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input label="เริ่มงาน" type="datetime-local" value={form.scheduled_start_at} error={fieldErrors.scheduled_start_at} onChange={(e) => { setErrorSection(null); setErrorMessage(null); setFieldErrors((prev) => ({ ...prev, scheduled_start_at: '' })); setForm({ ...form, scheduled_start_at: e.target.value }); }} required />
                    <Input label="สิ้นสุด" type="datetime-local" value={form.scheduled_end_at} error={fieldErrors.scheduled_end_at} onChange={(e) => { setErrorSection(null); setErrorMessage(null); setFieldErrors((prev) => ({ ...prev, scheduled_end_at: '' })); setForm({ ...form, scheduled_end_at: e.target.value }); }} required />
                  </div>
                </Card>

                <div id="section-job_location" className={cn(errorSection === 'job_location' ? 'border border-red-400 bg-red-50 rounded-lg p-3' : undefined, 'space-y-3')}>
                  <GooglePlacesInput label="ที่อยู่" value={form.address_line1} placeholder="ค้นหาที่อยู่ด้วย Google Maps" disabled={loading} error={fieldErrors.address_line1} showMap lat={form.lat} lng={form.lng} onChange={(next) => { const nextLat = typeof next.lat === 'number' ? next.lat : undefined; const nextLng = typeof next.lng === 'number' ? next.lng : undefined; setErrorSection(null); setErrorMessage(null); setFieldErrors((prev) => ({ ...prev, address_line1: '' })); setForm((prev) => ({ ...prev, address_line1: next.address_line1 || '', district: next.district || prev.district, province: next.province || prev.province, postal_code: next.postal_code || prev.postal_code, lat: nextLat, lng: nextLng })); }} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {!form.district && !form.province && (<><Input label="เขต/อำเภอ" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} placeholder="เช่น วัฒนา" /><Input label="จังหวัด" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} placeholder="เช่น Bangkok" /></>)}
                    {(form.district || form.province) && (<div className="sm:col-span-2"><div className="text-sm text-gray-600">ที่อยู่: {form.address_line1}{form.district && `, ${form.district}`}{form.province && `, ${form.province}`}{form.postal_code && ` ${form.postal_code}`}</div></div>)}
                  </div>
                  <Input label="รายละเอียดที่อยู่เพิ่มเติม" value={form.address_line2} onChange={(e) => setForm((prev) => ({ ...prev, address_line2: e.target.value }))} placeholder="เช่น หมู่บ้าน อาคาร ชั้น ห้อง หรือจุดสังเกต" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="เรทรายชั่วโมง (บาท)" type="number" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: Number(e.target.value) })} min={0} required />
                  <Input label="จำนวนชั่วโมงรวม" type="number" value={form.total_hours} onChange={(e) => setForm({ ...form, total_hours: Number(e.target.value) })} min={1} required />
                </div>

                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={form.is_urgent} onChange={(e) => setForm({ ...form, is_urgent: e.target.checked })} className="w-4 h-4" />
                  <span className="text-sm text-gray-700">งานเร่งด่วน</span>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">ราคารวมประมาณการ: <strong>{totalAmount.toLocaleString()} บาท</strong></p>
                </div>
              </>
            )}

            {/* ───── Step 4: ตรวจทาน ───── */}
            {currentStep === 4 && (
              <Card className="p-4 border-blue-200 bg-blue-50/40">
                <div className="text-sm font-semibold text-gray-900">สรุปก่อนบันทึกแบบร่าง</div>
                <div className="text-sm text-gray-800 mt-2">ผู้รับการดูแล: {selectedCareRecipient ? selectedCareRecipient.patient_display_name : 'ยังไม่ได้เลือก'}</div>
                <div className="text-sm text-gray-800 mt-1">ประเภทงาน: {currentDetailedTemplate.label}</div>
                {currentDetailedTemplate.dynamicQuestions.map((q) => {
                  const ans = dynamicAnswers[q.id];
                  if (!ans) return null;
                  const optLabel = q.options.find((o) => o.value === ans)?.label || ans;
                  return <div key={q.id} className="text-sm text-gray-800 mt-1">{q.label}: {optLabel}</div>;
                })}
                <div className="flex flex-col gap-1 mt-3">
                  <label className="text-sm font-semibold text-gray-700">รายละเอียดงานที่ต้องการสื่อสาร</label>
                  <textarea
                    className={cn(
                      'w-full px-4 py-2 border rounded-lg transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                      fieldErrors.description ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 hover:border-gray-400',
                      'min-h-28'
                    )}
                    value={form.description}
                    onChange={(e) => handleDescriptionChange(e.target.value)}
                    placeholder="เขียนรายละเอียดงานเพิ่มเติมเพื่อสื่อสารกับผู้ดูแลให้ชัดเจน"
                  />
                  {fieldErrors.description && <div className="text-sm text-red-600">{fieldErrors.description}</div>}
                  <div className="text-xs text-gray-500">ข้อความนี้จะแสดงเป็นรายละเอียดงานหลัก และระบบจะเติมสรุปจากประเภทงานให้อัตโนมัติท้ายข้อความ</div>
                </div>
                <div className="text-sm text-gray-800 mt-1">วันเวลา: {form.scheduled_start_at || '-'} ถึง {form.scheduled_end_at || '-'}</div>
                <div className="text-sm text-gray-800 mt-1">ที่อยู่: {form.address_line1 || '-'}</div>
                <div className="text-sm text-gray-800 mt-1">งานที่ต้องทำ: {form.job_tasks_flags.length} รายการ</div>
                <div className="flex flex-wrap gap-1 mt-1">{labelByValue(JOB_TASK_OPTIONS, form.job_tasks_flags).map((l) => <Badge key={l} variant="info">{l}</Badge>)}</div>
                {form.required_skills_flags.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{labelByValue(SKILL_OPTIONS, form.required_skills_flags).map((l) => <Badge key={l} variant="default">{l}</Badge>)}</div>}
                {form.equipment_available_flags.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{labelByValue(EQUIPMENT_OPTIONS, form.equipment_available_flags).map((l) => <Badge key={l} variant="success">{l}</Badge>)}</div>}
                {form.precautions_flags.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{labelByValue(PRECAUTION_OPTIONS, form.precautions_flags).map((l) => <Badge key={l} variant="warning">{l}</Badge>)}</div>}
                <div className="text-sm text-gray-800 mt-2">ราคารวมประมาณการ: <strong>{totalAmount.toLocaleString()} บาท</strong></div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => setCurrentStep(1)}>แก้ข้อมูลหลัก</Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentStep(2)}>แก้งานที่ต้องทำ</Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentStep(3)}>แก้เวลา/สถานที่</Button>
                </div>
              </Card>
            )}

            <div className="pt-2 flex flex-col sm:flex-row gap-2 sm:justify-end">
              {currentStep > 1 && (
                <Button variant="outline" onClick={handlePrevStep} disabled={loading}>ย้อนกลับ</Button>
              )}
              {currentStep < 4 ? (
                <Button variant="primary" onClick={handleNextStep} disabled={loading} fullWidth={currentStep === 1}>
                  {currentStep === 1 ? 'ถัดไป: เลือกงานและคุณสมบัติ' : currentStep === 2 ? 'ถัดไป: เวลาและสถานที่' : 'ถัดไป: ตรวจทาน'}
                </Button>
              ) : (
                <Button variant="primary" fullWidth loading={loading} onClick={openReview}>ตรวจทาน</Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Modal
        isOpen={templateSwitchOpen}
        onClose={closeTemplateSwitch}
        title="เปลี่ยนประเภทงานหลัก"
        size="md"
        footer={
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <button
              onClick={closeTemplateSwitch}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              onClick={() => applyPendingDetailedType(false)}
              className="px-4 py-2 text-blue-700 bg-blue-50 border border-blue-300 rounded-lg hover:bg-blue-100 transition-colors"
            >
              เปลี่ยนประเภทและคงงานที่เลือกไว้
            </button>
            <button
              onClick={() => applyPendingDetailedType(true)}
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              เปลี่ยนประเภทและรีเซ็ตงานตามแม่แบบ
            </button>
          </div>
        }
      >
        <div className="text-sm text-gray-700 space-y-2">
          <div>คุณกำลังเปลี่ยนจาก “{currentDetailedTemplate.label}”</div>
          <div>ไปเป็น “{pendingDetailedType ? DETAILED_JOB_TEMPLATES[pendingDetailedType].label : '-'}”</div>
          <div className="text-xs text-gray-500">เลือกได้ว่าจะคงงานที่เลือกไว้ หรือรีเซ็ตตามประเภทใหม่เพื่อให้กรอกได้เร็วขึ้น</div>
        </div>
      </Modal>

      <Modal
        isOpen={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title="ตรวจทานก่อนบันทึก"
        size="lg"
        footer={
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setReviewOpen(false)}
              disabled={loading}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              กลับไปแก้ไข
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !form.description.trim()}
              className={cn(
                'px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50',
                computedRisk.risk_level === 'high_risk' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
              )}
            >
              {loading ? 'กำลังบันทึก...' : 'ยืนยันบันทึกแบบร่าง'}
            </button>
          </div>
        }
      >
        {pendingPayload ? (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="text-sm font-semibold text-gray-900">สรุปงาน</div>
              <div className="text-sm text-gray-800 mt-2">ชื่องาน: {pendingPayload.title}</div>
              <div className="text-sm text-gray-800 mt-1">ประเภทงานหลัก: {currentDetailedTemplate.label}</div>
              <div className="text-sm text-gray-800 mt-1">หมวดงานหลัก: {JOB_TYPE_LABEL[form.job_type]}</div>
              {currentDetailedTemplate.dynamicQuestions.map((q) => {
                const ans = dynamicAnswers[q.id];
                if (!ans) return null;
                const optLabel = q.options.find((o) => o.value === ans)?.label || ans;
                return <div key={q.id} className="text-sm text-gray-800 mt-1">{q.label}: {optLabel}</div>;
              })}
              <div className="flex flex-col gap-1 mt-3">
                <label className="text-sm font-semibold text-gray-700">รายละเอียดงาน (แก้ไขได้ก่อนบันทึก)</label>
                <textarea
                  className={cn(
                    'w-full px-4 py-2 border rounded-lg transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                    fieldErrors.description ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 hover:border-gray-400',
                    'min-h-28'
                  )}
                  value={form.description}
                  onChange={(e) => handleDescriptionChange(e.target.value)}
                  placeholder="เขียนสิ่งที่ต้องการสื่อสารเพิ่มเติมกับผู้ดูแล"
                />
                {fieldErrors.description && <div className="text-sm text-red-600">{fieldErrors.description}</div>}
                <div className="text-xs text-gray-500">ระบบจะต่อท้ายด้วยสรุปจากประเภทงานที่คุณเลือกให้อัตโนมัติ</div>
              </div>
              <div className="text-sm text-gray-800 mt-1">
                ความเสี่ยง: {computedRisk.risk_level === 'high_risk' ? 'สูง' : 'ต่ำ'}
              </div>
              {computedRisk.reasons?.length ? (
                <div className="text-xs text-gray-600 mt-2">
                  {computedRisk.reasons.map((r) => (
                    <div key={r}>• {r}</div>
                  ))}
                </div>
              ) : null}
            </Card>

            <Card className="p-4">
              <div className="text-sm font-semibold text-gray-900">ผู้รับการดูแล</div>
              <div className="text-sm text-gray-800 mt-2">
                {selectedCareRecipient ? selectedCareRecipient.patient_display_name : 'ยังไม่ได้เลือก'}
              </div>
              {selectedCareRecipient?.general_health_summary && (
                <div className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{selectedCareRecipient.general_health_summary}</div>
              )}
            </Card>

            <Card className="p-4">
              <div className="text-sm font-semibold text-gray-900">รายละเอียดที่เลือก</div>
              <div className="text-xs text-gray-600 mt-2">งานที่ต้องทำ</div>
              <div className="flex flex-wrap gap-2 mt-2">
                {labelByValue(JOB_TASK_OPTIONS, pendingPayload.job_tasks_flags || []).map((l) => (
                  <Badge key={l} variant="info">
                    {l}
                  </Badge>
                ))}
              </div>

              {(pendingPayload.required_skills_flags || []).length > 0 && (
                <>
                  <div className="text-xs text-gray-600 mt-3">ทักษะที่ต้องมี</div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {labelByValue(SKILL_OPTIONS, pendingPayload.required_skills_flags || []).map((l) => (
                      <Badge key={l} variant="default">
                        {l}
                      </Badge>
                    ))}
                  </div>
                </>
              )}

              {(pendingPayload.equipment_available_flags || []).length > 0 && (
                <>
                  <div className="text-xs text-gray-600 mt-3">อุปกรณ์ที่มีให้</div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {labelByValue(EQUIPMENT_OPTIONS, pendingPayload.equipment_available_flags || []).map((l) => (
                      <Badge key={l} variant="success">
                        {l}
                      </Badge>
                    ))}
                  </div>
                </>
              )}

              {(pendingPayload.precautions_flags || []).length > 0 && (
                <>
                  <div className="text-xs text-gray-600 mt-3">ข้อควรระวัง</div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {labelByValue(PRECAUTION_OPTIONS, pendingPayload.precautions_flags || []).map((l) => (
                      <Badge key={l} variant="warning">
                        {l}
                      </Badge>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </div>
        ) : null}
      </Modal>
    </MainLayout>
  );
}

