import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams, useBlocker } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Car, Heart, Brain, BedDouble, Activity, Stethoscope, User as UserIcon, PlusCircle, Check, Search, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { MainLayout } from '../../layouts';
import { Avatar, Badge, Button, Card, Input, Modal, Select, Textarea, type BadgeProps } from '../../components/ui';
import { GooglePlacesInput } from '../../components/location/GooglePlacesInput';
import { CareRecipient, CreateJobData } from '../../services/api';
import { appApi } from '../../services/appApi';
import { useAuth } from '../../contexts';
import { cn } from '../../utils/cn';
import { computeRiskLevel } from '../../utils/risk';
import { getTrustLevelConfig, getTrustLevelLabel } from '../../utils/trustLevel';

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

type CreateJobStep = 1 | 2 | 3 | 4 | 5;

const CREATE_JOB_STEPS: Array<{ id: CreateJobStep; title: string; helper: string }> = [
  { id: 1, title: 'เลือกบริการ', helper: 'ประเภทการดูแลที่ต้องการ' },
  { id: 2, title: 'ผู้รับการดูแล', helper: 'เลือกผู้ที่จะได้รับบริการ' },
  { id: 3, title: 'รายละเอียดงาน', helper: 'วัน เวลา สถานที่ ราคา' },
  { id: 4, title: 'ผู้ดูแล', helper: 'เลือกผู้ดูแลหรือโพสต์หา' },
  { id: 5, title: 'ตรวจทาน', helper: 'สรุปก่อนยืนยัน' },
];

const SECTION_STEP_MAP: Record<string, CreateJobStep> = {
  service: 1,
  patient: 2,
  job_basic: 3,
  dynamic_questions: 3,
  job_tasks: 3,
  job_requirements: 3,
  job_schedule: 3,
  job_location: 3,
  caregiver: 4,
};

const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES_5 = ['00','05','10','15','20','25','30','35','40','45','50','55'];

function DateTimeInput24h({
  label,
  value,
  onChange,
  error,
  required,
}: {
  label: string;
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  error?: string;
  required?: boolean;
}) {
  const datePart = value ? value.slice(0, 10) : '';
  const timePart = value && value.includes('T') ? value.slice(11, 16) : '';
  const hourStr = timePart.slice(0, 2);
  const minuteStr = timePart.slice(3, 5);

  const combine = (d: string, h: string, m: string) =>
    d && h && m ? `${d}T${h}:${m}` : '';

  const handleDate = (e: ChangeEvent<HTMLInputElement>) => {
    const d = e.target.value;
    onChange({ target: { value: combine(d, hourStr || '08', minuteStr || '00') } });
  };

  const handleHour = (e: ChangeEvent<HTMLSelectElement>) => {
    if (!datePart) return;
    onChange({ target: { value: combine(datePart, e.target.value, minuteStr || '00') } });
  };

  const handleMinute = (e: ChangeEvent<HTMLSelectElement>) => {
    if (!datePart) return;
    onChange({ target: { value: combine(datePart, hourStr || '08', e.target.value) } });
  };

  const thaiDatePreview = datePart ? (() => {
    const [y, m, d] = datePart.split('-');
    return `${parseInt(d)} ${THAI_MONTHS[parseInt(m) - 1]} ${parseInt(y) + 543}`;
  })() : null;

  const base = 'px-3 py-2 border rounded-lg bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const cls = error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 hover:border-gray-400';

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-semibold text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="flex gap-2 items-center flex-wrap">
        <input
          type="date"
          value={datePart}
          onChange={handleDate}
          className={cn('flex-1 min-w-0', base, cls)}
          aria-label={`วันที่ ${label}`}
        />
        <select
          value={hourStr}
          onChange={handleHour}
          disabled={!datePart}
          className={cn('w-20', base, cls, !datePart && 'opacity-40 cursor-not-allowed')}
          aria-label="ชั่วโมง"
        >
          <option value="">ชม.</option>
          {HOURS_24.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <span className="text-gray-500 font-semibold select-none">:</span>
        <select
          value={minuteStr}
          onChange={handleMinute}
          disabled={!datePart}
          className={cn('w-20', base, cls, !datePart && 'opacity-40 cursor-not-allowed')}
          aria-label="นาที"
        >
          <option value="">นาที</option>
          {MINUTES_5.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      {thaiDatePreview && hourStr && minuteStr && (
        <p className="text-xs text-blue-600">
          {thaiDatePreview} เวลา {hourStr}.{minuteStr} น.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export default function CreateJobPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const hirerId = user?.id || 'demo-hirer';
  const preferredCaregiverIdParam = (searchParams.get('preferred_caregiver_id') || '').trim();
  const preferredCaregiverNameParam = (searchParams.get('preferred_caregiver_name') || '').trim();
  const preferredCaregiverTrustLevelParam = (searchParams.get('preferred_caregiver_trust_level') || '').trim();
  const shouldReturnToAssign = searchParams.get('return_to_assign') === '1';
  const serviceParam = (searchParams.get('service') || '').trim() as DetailedJobType | '';
  const recipientParam = (searchParams.get('recipient') || '').trim();

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
  const [suggestedCaregivers, setSuggestedCaregivers] = useState<any[]>([]);
  const [suggestedLoading, setSuggestedLoading] = useState(false);
  const [favoriteCaregivers, setFavoriteCaregivers] = useState<any[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [selectedCaregiverId, setSelectedCaregiverId] = useState<string>(preferredCaregiverIdParam || '');
  const [showAdvancedStep3, setShowAdvancedStep3] = useState(false);
  const [previewCaregiverId, setPreviewCaregiverId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewReviews, setPreviewReviews] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [successJobId, setSuccessJobId] = useState<string | null>(null);
  const [isDirectAssignment, setIsDirectAssignment] = useState(false);

  const initialDetailedType = (serviceParam && DETAILED_JOB_TEMPLATES[serviceParam]) ? serviceParam : DEFAULT_DETAILED_JOB_TYPE;
  const initialTemplate = DETAILED_JOB_TEMPLATES[initialDetailedType];

  const [form, setForm] = useState({
    title: initialTemplate.defaultTitle || '',
    description: '',
    job_type: initialTemplate.jobType as JobType,
    detailed_job_type: initialDetailedType as DetailedJobType,
    scheduled_start_at: '',
    scheduled_end_at: '',
    address_line1: '',
    address_line2: '',
    district: '',
    province: 'Bangkok',
    postal_code: '',
    lat: undefined as number | undefined,
    lng: undefined as number | undefined,
    hourly_rate: 150,
    total_hours: 8,
    job_tasks_flags: [...initialTemplate.defaultTasks] as string[],
    required_skills_flags: [...initialTemplate.defaultSkills] as string[],
    equipment_available_flags: [...initialTemplate.defaultEquipment] as string[],
    precautions_flags: [...initialTemplate.defaultPrecautions] as string[],
  });

  // ── Draft persistence (sessionStorage) ──
  const DRAFT_KEY = 'careconnect_create_job_draft';

  useEffect(() => {
    const saved = sessionStorage.getItem(DRAFT_KEY);
    if (!saved) return;
    try {
      const draft = JSON.parse(saved);
      if (serviceParam || recipientParam) return;
      if (draft.form) setForm((prev) => ({ ...prev, ...draft.form }));
      if (draft.careRecipientId) setCareRecipientId(draft.careRecipientId);
      if (draft.dynamicAnswers) setDynamicAnswers(draft.dynamicAnswers);
      if (draft.currentStep) setCurrentStep(draft.currentStep as CreateJobStep);
      if (draft.maxVisitedStep) setMaxVisitedStep(draft.maxVisitedStep as CreateJobStep);
    } catch { /* ignore corrupt draft */ }
  }, []);

  useEffect(() => {
    const draft = {
      form,
      careRecipientId,
      dynamicAnswers,
      currentStep,
      maxVisitedStep,
    };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [form, careRecipientId, dynamicAnswers, currentStep, maxVisitedStep]);

  const clearDraft = () => sessionStorage.removeItem(DRAFT_KEY);

  // ── Fetch caregiver suggestions + favorites when entering Step 4 ──
  useEffect(() => {
    if (currentStep !== 4 || preferredCaregiverIdParam) return;
    let cancelled = false;
    const run = async () => {
      setSuggestedLoading(true);
      setFavoritesLoading(true);
      try {
        const skills = form.required_skills_flags.join(',');
        let availableDay: number | undefined;
        if (form.scheduled_start_at) {
          const d = new Date(form.scheduled_start_at);
          if (!isNaN(d.getTime())) availableDay = d.getDay();
        }
        const [suggestRes, favRes] = await Promise.all([
          appApi.searchCaregivers({
            skills: skills || undefined,
            trust_level: computedRisk.risk_level === 'high_risk' ? 'L2' : 'L1',
            available_day: availableDay,
            limit: 12,
          }),
          appApi.getFavorites(1, 20),
        ]);
        if (cancelled) return;
        if (suggestRes.success && suggestRes.data?.data) {
          const ranked = suggestRes.data.data
            .map((cg: any) => ({ ...cg, _matchScore: computeMatchScore(cg) }))
            .sort((a: any, b: any) => b._matchScore - a._matchScore);
          setSuggestedCaregivers(ranked);
        }
        if (favRes.success && favRes.data?.data) {
          setFavoriteCaregivers(favRes.data.data);
        }
      } catch { /* ignore */ }
      finally {
        if (!cancelled) {
          setSuggestedLoading(false);
          setFavoritesLoading(false);
        }
      }
    };
    run();
    return () => { cancelled = true; };
  }, [currentStep]);

  // ── Preview modal data fetch ──
  const openPreview = useCallback(async (caregiverId: string) => {
    setPreviewCaregiverId(caregiverId);
    setPreviewLoading(true);
    setPreviewData(null);
    setPreviewReviews([]);
    try {
      const [profileRes, reviewsRes] = await Promise.all([
        appApi.getCaregiverProfile(caregiverId),
        appApi.getCaregiverReviews(caregiverId, 1, 5),
      ]);
      if (profileRes.success && profileRes.data) setPreviewData(profileRes.data);
      if (reviewsRes.success && reviewsRes.data?.data) setPreviewReviews(reviewsRes.data.data);
    } catch { /* ignore */ }
    finally { setPreviewLoading(false); }
  }, []);

  const closePreview = () => { setPreviewCaregiverId(null); setPreviewData(null); setPreviewReviews([]); };

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
        setCareRecipients((prev) => [...prev, res.data!]);
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

  const computeMatchScore = useCallback((cg: any) => {
    let score = 0;
    const requiredSkills = new Set(form.required_skills_flags);
    const cgSkills = new Set([...(cg.specializations || []), ...(cg.certifications || [])]);
    let skillMatches = 0;
    requiredSkills.forEach((s) => { if (cgSkills.has(s)) skillMatches++; });
    if (requiredSkills.size > 0) score += Math.round((skillMatches / requiredSkills.size) * 40);
    else score += 20;
    const rating = Number(cg.avg_rating) || 0;
    score += Math.round((rating / 5) * 25);
    const trustOrder = ['L0', 'L1', 'L2', 'L3'];
    const minTrust = computedRisk.risk_level === 'high_risk' ? 'L2' : 'L1';
    const cgTrustIdx = trustOrder.indexOf(cg.trust_level || 'L0');
    const minTrustIdx = trustOrder.indexOf(minTrust);
    if (cgTrustIdx >= minTrustIdx) score += 15;
    const exp = Number(cg.experience_years) || 0;
    score += Math.min(exp * 2, 10);
    const jobs = Number(cg.completed_jobs_count) || 0;
    score += Math.min(jobs, 10);
    return Math.min(score, 100);
  }, [form.required_skills_flags, computedRisk.risk_level]);

  type FeasibilityResult = {
    schedule: 'available' | 'maybe' | 'unknown';
    scheduleLabel: string;
    time: 'within' | 'outside' | 'unknown';
    timeLabel: string;
    confidence: 'high' | 'medium' | 'low';
    confidenceLabel: string;
  };

  const computeFeasibility = useCallback((cg: any): FeasibilityResult => {
    const availDays: number[] = cg.available_days || [];
    const availFrom: string = cg.available_from || '';
    const availTo: string = cg.available_to || '';

    let schedule: FeasibilityResult['schedule'] = 'unknown';
    let scheduleLabel = 'ความพร้อมไม่ชัดเจน';
    let time: FeasibilityResult['time'] = 'unknown';
    let timeLabel = '';

    if (form.scheduled_start_at) {
      const jobDate = new Date(form.scheduled_start_at);
      if (!isNaN(jobDate.getTime())) {
        const jobDay = jobDate.getDay();
        if (availDays.length > 0) {
          schedule = availDays.includes(jobDay) ? 'available' : 'maybe';
          scheduleLabel = availDays.includes(jobDay) ? 'น่าจะว่างในวันนั้น' : 'อาจต้องยืนยันวัน';
        }

        if (availFrom && availTo) {
          const jobHour = jobDate.getHours();
          const jobMin = jobDate.getMinutes();
          const jobTimeMin = jobHour * 60 + jobMin;
          const [fH, fM] = availFrom.split(':').map(Number);
          const [tH, tM] = availTo.split(':').map(Number);
          const fromMin = (fH || 0) * 60 + (fM || 0);
          const toMin = (tH || 0) * 60 + (tM || 0);
          if (jobTimeMin >= fromMin && jobTimeMin <= toMin) {
            time = 'within';
            timeLabel = 'เวลาตรงช่วงที่ว่าง';
          } else {
            time = 'outside';
            timeLabel = 'อาจต้องยืนยันเวลา';
          }
        }
      }
    }

    let confidence: FeasibilityResult['confidence'] = 'low';
    let confidenceLabel = 'ต้องยืนยันกับผู้ดูแล';
    if (schedule === 'available' && time === 'within') {
      confidence = 'high';
      confidenceLabel = 'มีแนวโน้มรับงานได้';
    } else if (schedule === 'available' || time === 'within') {
      confidence = 'medium';
      confidenceLabel = 'น่าจะรับงานได้';
    }

    return { schedule, scheduleLabel, time, timeLabel, confidence, confidenceLabel };
  }, [form.scheduled_start_at]);

  const computeReliability = (cg: any): string[] => {
    const tags: string[] = [];
    const rating = Number(cg.avg_rating) || 0;
    const reviews = Number(cg.total_reviews) || 0;
    const exp = Number(cg.experience_years) || 0;
    const jobs = Number(cg.completed_jobs_count) || 0;
    const trust = String(cg.trust_level || 'L0');
    if (rating >= 4.5 && reviews >= 3) tags.push('คะแนนรีวิวดีมาก');
    else if (rating >= 4.0 && reviews >= 2) tags.push('คะแนนรีวิวดี');
    if (jobs >= 20) tags.push('มีประสบการณ์สูง');
    else if (jobs >= 5) tags.push('มีผลงานแล้ว');
    if (trust === 'L3') tags.push('มืออาชีพ');
    else if (trust === 'L2') tags.push('ยืนยันตัวตน');
    if (exp >= 5) tags.push(`ประสบการณ์ ${exp} ปี`);
    return tags.slice(0, 3);
  };

  const computeStrengthsSummary = (cg: any, feas: FeasibilityResult): string | null => {
    const reasons: string[] = [];
    const requiredSkills = new Set(form.required_skills_flags);
    const cgSkills = new Set([...(cg.specializations || []), ...(cg.certifications || [])]);
    let skillMatches = 0;
    requiredSkills.forEach((s) => { if (cgSkills.has(s)) skillMatches++; });
    if (requiredSkills.size > 0 && skillMatches > 0) {
      const pct = Math.round((skillMatches / requiredSkills.size) * 100);
      if (pct >= 80) reasons.push('ทักษะตรงกับงานมาก');
      else if (pct >= 50) reasons.push('มีทักษะที่ตรงกับงาน');
    }
    if (feas.confidence === 'high') reasons.push('น่าจะว่างในเวลาที่ต้องการ');
    else if (feas.confidence === 'medium') reasons.push('น่าจะรับงานได้');
    const rating = Number(cg.avg_rating) || 0;
    if (rating >= 4.0) reasons.push('ได้รับรีวิวดี');
    if (reasons.length === 0) return null;
    return 'เหมาะกับงานนี้: ' + reasons.slice(0, 2).join(' และ');
  };

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
    return true;
  };

  const validateStepTwo = () => {
    if (!careRecipientId) {
      setStepError({ section: 'patient', message: 'กรุณาเลือกผู้รับการดูแล' });
      return false;
    }
    return true;
  };

  const validateStepThree = () => {
    if (!form.title.trim()) {
      setStepError({ section: 'job_basic', message: 'กรุณากรอกชื่องาน', fields: { title: 'กรุณากรอกชื่องาน' } });
      return false;
    }

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
      setStepError({ section: 'job_location', message: 'กรุณากรอกสถานที่ทำงาน', fields: { address_line1: 'กรุณากรอกสถานที่ทำงาน' } });
      return false;
    }

    if (Number(form.hourly_rate) <= 0 || Number(form.total_hours) <= 0) {
      setStepError({
        section: 'job_location',
        message: 'กรุณาระบุเรทรายชั่วโมงและจำนวนชั่วโมงให้ถูกต้อง',
      });
      return false;
    }

    if (!form.job_tasks_flags.length) {
      setStepError({ section: 'job_tasks', message: 'กรุณาเลือกงานที่ต้องทำอย่างน้อย 1 อย่าง', fields: { job_tasks_flags: 'กรุณาเลือกงานที่ต้องทำอย่างน้อย 1 อย่าง' } });
      return false;
    }

    return true;
  };

  const validateStepFour = () => {
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
    } else if (currentStep === 4) {
      if (!validateStepFour()) return;
      clearErrors();
      setCurrentStep(5);
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
    if (!form.address_line1.trim()) throw new Error('กรุณากรอกสถานที่ทำงาน');
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
      patient_profile_id: careRecipientId || undefined,
      preferred_caregiver_id: (selectedCaregiverId || preferredCaregiverIdParam) || undefined,
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
        if (recipientParam && active.some((p) => p.id === recipientParam)) return recipientParam;
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
            address_line1: 'กรุณากรอกสถานที่ทำงาน',
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

      clearDraft();
      setReviewOpen(false);
      setPendingPayload(null);

      const directCaregiverId = selectedCaregiverId || preferredCaregiverIdParam;
      if (directCaregiverId && !shouldReturnToAssign) {
        const pubRes = await appApi.publishJob(createdJob.id, hirerId);
        if (!pubRes.success) {
          const errMsg = typeof pubRes.error === 'string' ? pubRes.error : 'เผยแพร่งานไม่สำเร็จ';
          toast.error(errMsg);
          setSuccessJobId(createdJob.id);
          return;
        }
        setIsDirectAssignment(true);
        setSuccessJobId(createdJob.id);
        return;
      }

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

      setIsDirectAssignment(false);
      setSuccessJobId(createdJob.id);
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
      const routeToSection = (section: string) => {
        const step = SECTION_STEP_MAP[section];
        if (step) setCurrentStep(step);
        setErrorSection(section);
        setErrorAnchorId(`section-${section}`);
      };
      if (msg.includes('วันและเวลา')) {
        routeToSection('job_schedule');
        setFieldErrors({ scheduled_start_at: msg, scheduled_end_at: msg });
      } else if (msg.includes('ชื่องาน') || msg.includes('รายละเอียดงาน')) {
        routeToSection('job_basic');
      } else if (msg.includes('สถานที่ทำงาน') || msg.includes('Google Maps')) {
        routeToSection('job_location');
        setFieldErrors({ address_line1: msg });
      } else if (msg.includes('ผู้รับการดูแล')) {
        routeToSection('patient');
      } else if (msg.includes('งานที่ต้องทำ')) {
        routeToSection('job_tasks');
        setFieldErrors({ job_tasks_flags: msg });
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

  const SERVICE_CARDS = [
    { key: 'hospital_transport_support' as DetailedJobType, icon: Car, label: 'พาไปโรงพยาบาล', desc: 'พาไปพบแพทย์ รับยา รับผลตรวจ', color: 'bg-red-50 text-red-600 border-red-200' },
    { key: 'general_patient_care' as DetailedJobType, icon: Heart, label: 'ดูแลทั่วไป', desc: 'อยู่เป็นเพื่อน ช่วยกิจวัตร ดูแลยา', color: 'bg-blue-50 text-blue-600 border-blue-200' },
    { key: 'post_surgery_recovery' as DetailedJobType, icon: Activity, label: 'ดูแลหลังผ่าตัด', desc: 'เฝ้าระวังแผลและภาวะแทรกซ้อน', color: 'bg-green-50 text-green-600 border-green-200' },
    { key: 'dementia_supervision' as DetailedJobType, icon: Brain, label: 'ดูแลสมองเสื่อม', desc: 'เฝ้าระวังพฤติกรรมอย่างใกล้ชิด', color: 'bg-purple-50 text-purple-600 border-purple-200' },
    { key: 'bedbound_high_dependency' as DetailedJobType, icon: BedDouble, label: 'ดูแลผู้ป่วยติดเตียง', desc: 'ช่วยเหลือเกือบทั้งหมด ย้ายท่า สุขอนามัย', color: 'bg-amber-50 text-amber-600 border-amber-200' },
    { key: 'medical_device_home_care' as DetailedJobType, icon: Stethoscope, label: 'ดูแลอุปกรณ์การแพทย์', desc: 'ออกซิเจน สายให้อาหาร สายสวน', color: 'bg-teal-50 text-teal-600 border-teal-200' },
  ];

  const totalSteps = CREATE_JOB_STEPS.length;

  return (
    <MainLayout showBottomBar={false}>
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

      <div className="max-w-3xl mx-auto px-4 pt-4 pb-8">
        {/* ── Mobile-first progress header ── */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-500">ขั้นตอน {currentStep}/{totalSteps}</span>
            <span className="text-xs text-gray-500">{Math.round((currentStep / totalSteps) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${(currentStep / totalSteps) * 100}%` }} />
          </div>
          <div className="flex justify-between mt-2 overflow-x-auto gap-1">
            {CREATE_JOB_STEPS.map((step) => {
              const canJump = step.id <= maxVisitedStep;
              const isCurrent = step.id === currentStep;
              const isDone = step.id < currentStep;
              return (
                <button
                  key={step.id}
                  type="button"
                  disabled={!canJump}
                  onClick={() => canJump && setCurrentStep(step.id)}
                  className={cn(
                    'flex items-center gap-1 text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap transition-colors',
                    isCurrent ? 'bg-blue-100 text-blue-700 font-bold' : isDone ? 'text-green-600' : 'text-gray-400',
                    !canJump && 'cursor-not-allowed'
                  )}
                >
                  {isDone && <Check className="w-3 h-3" aria-hidden="true" />}
                  {step.title}
                </button>
              );
            })}
          </div>
          <h2 className="text-xl font-bold text-gray-900 mt-3">{CREATE_JOB_STEPS.find((s) => s.id === currentStep)?.title}</h2>
          <p className="text-sm text-gray-500">{CREATE_JOB_STEPS.find((s) => s.id === currentStep)?.helper}</p>
        </div>

        {errorSection && errorMessage && (
          <div className="p-3 border border-red-300 bg-red-50 rounded-lg text-sm text-red-800 mb-4">
            {errorMessage}
          </div>
        )}

        {/* ═══════════ Step 1: เลือกบริการ ═══════════ */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SERVICE_CARDS.map((svc) => {
                const Icon = svc.icon;
                const isSelected = form.detailed_job_type === svc.key;
                return (
                  <button
                    key={svc.key}
                    type="button"
                    onClick={() => {
                      if (svc.key !== form.detailed_job_type) {
                        handleDetailedTypeSelection(svc.key);
                      }
                    }}
                    className={cn(
                      'border-2 rounded-xl p-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500',
                      isSelected ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200' : `border-gray-200 hover:border-blue-300 ${svc.color}`
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={cn('w-8 h-8 flex-shrink-0', isSelected ? 'text-blue-600' : '')} aria-hidden="true" />
                      <div>
                        <div className={cn('text-sm font-semibold', isSelected ? 'text-blue-900' : 'text-gray-900')}>{svc.label}</div>
                        <div className={cn('text-xs mt-0.5', isSelected ? 'text-blue-700' : 'text-gray-600')}>{svc.desc}</div>
                      </div>
                      {isSelected && <Check className="w-5 h-5 text-blue-600 flex-shrink-0 ml-auto" aria-hidden="true" />}
                    </div>
                  </button>
                );
              })}
            </div>
            {currentDetailedTemplate && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm font-medium text-blue-900">เลือก: {currentDetailedTemplate.label}</div>
                <div className="text-xs text-blue-700 mt-1">{currentDetailedTemplate.helper}</div>
                {SPECIALIZED_TYPE_DIFFERENCE_HINT[form.detailed_job_type] && (
                  <div className="text-xs text-amber-700 mt-1">{SPECIALIZED_TYPE_DIFFERENCE_HINT[form.detailed_job_type]}</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══════════ Step 2: เลือกผู้รับการดูแล ═══════════ */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div id="section-patient" className={cn(errorSection === 'patient' ? 'border border-red-400 bg-red-50 rounded-lg p-3' : '')}>
              {careRecipients.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {careRecipients.map((p) => {
                    const isSelected = careRecipientId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setCareRecipientId(p.id)}
                        className={cn(
                          'border-2 rounded-xl p-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500',
                          isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', isSelected ? 'bg-blue-200' : 'bg-gray-100')}>
                            <UserIcon className={cn('w-5 h-5', isSelected ? 'text-blue-700' : 'text-gray-500')} aria-hidden="true" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={cn('text-sm font-semibold line-clamp-1', isSelected ? 'text-blue-900' : 'text-gray-900')}>{p.patient_display_name}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{p.gender === 'male' ? 'ชาย' : p.gender === 'female' ? 'หญิง' : ''} {p.age_band?.replace('_', '-') || ''}</div>
                          </div>
                          {isSelected && <Check className="w-5 h-5 text-blue-600 flex-shrink-0" aria-hidden="true" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <Card padding="responsive" className="text-center">
                  <UserIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" aria-hidden="true" />
                  <p className="text-sm text-gray-700 font-medium">ยังไม่มีผู้รับการดูแล</p>
                  <p className="text-xs text-gray-500 mt-1">เพิ่มข้อมูลผู้ที่จะได้รับบริการก่อน</p>
                </Card>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {!showQuickAddRecipient && (
                <Button variant="primary" size="sm" leftIcon={<PlusCircle className="w-4 h-4" />} onClick={() => setShowQuickAddRecipient(true)}>เพิ่มผู้รับการดูแลใหม่</Button>
              )}
              <Link to="/hirer/care-recipients"><Button variant="outline" size="sm">จัดการทั้งหมด</Button></Link>
            </div>

            {showQuickAddRecipient && (
              <Card padding="responsive" className="border-blue-200 bg-blue-50/50">
                <div className="text-sm font-semibold text-blue-800 mb-2">เพิ่มผู้รับการดูแลแบบเร็ว</div>
                <input type="text" value={quickRecipientName} onChange={(e) => setQuickRecipientName(e.target.value)} placeholder="ชื่อ เช่น คุณแม่สมศรี" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm mb-2" />
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <Select aria-label="เพศ" value={quickRecipientGender} onChange={(e) => setQuickRecipientGender(e.target.value)}>
                    <option value="female">หญิง</option><option value="male">ชาย</option><option value="other">อื่นๆ</option>
                  </Select>
                  <Select aria-label="ช่วงอายุ" value={quickRecipientAge} onChange={(e) => setQuickRecipientAge(e.target.value)}>
                    <option value="60_74">60-74</option><option value="75_89">75-89</option><option value="90_plus">90+</option><option value="18_59">18-59</option><option value="0_12">0-12</option>
                  </Select>
                  <Select aria-label="การเคลื่อนไหว" value={quickRecipientMobility} onChange={(e) => setQuickRecipientMobility(e.target.value)}>
                    <option value="walk_independent">เดินเอง</option><option value="walk_assisted">ต้องพยุง</option><option value="wheelchair">รถเข็น</option><option value="bedbound">ติดเตียง</option>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={handleQuickAddRecipient} loading={quickRecipientSaving}>บันทึก</Button>
                  <Button variant="outline" size="sm" onClick={() => setShowQuickAddRecipient(false)}>ยกเลิก</Button>
                </div>
              </Card>
            )}

            {selectedCareRecipient && patientSummary && (
              <Card padding="responsive">
                <div className="text-sm font-semibold text-gray-900">ข้อมูลผู้รับการดูแล</div>
                <div className="text-xs text-gray-600 mt-1">{selectedCareRecipient.patient_display_name}</div>
                {selectedCareRecipient.general_health_summary && <div className="text-sm text-gray-800 mt-2 whitespace-pre-wrap line-clamp-3">{selectedCareRecipient.general_health_summary}</div>}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {patientSummary.tags.slice(0, 12).map((t, idx) => (<Badge key={idx} variant={t.variant}>{t.label}</Badge>))}
                  {patientSummary.tags.length > 12 && <Badge variant="default">+{patientSummary.tags.length - 12}</Badge>}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ═══════════ Step 3: รายละเอียดงาน (merged) ═══════════ */}
        {currentStep === 3 && (
          <div className="space-y-4">
            {currentDetailedTemplate.dynamicQuestions.length > 0 && (
              <Card id="section-dynamic_questions" className="border-amber-200 bg-amber-50/50">
                <div className="text-sm font-semibold text-gray-900 mb-1">คำถามสำหรับ &quot;{currentDetailedTemplate.label}&quot;</div>
                <div className="text-xs text-gray-600 mb-3">ตอบเพื่อให้ระบบเลือกงาน/ทักษะ/อุปกรณ์ให้อัตโนมัติ</div>
                <div className="space-y-3">
                  {currentDetailedTemplate.dynamicQuestions.map((q) => (
                    <div key={q.id} className="p-3 border border-amber-200 bg-white rounded-lg">
                      <div className="text-sm font-semibold text-gray-900">{q.label}</div>
                      {q.helper && <div className="text-xs text-gray-600 mt-0.5">{q.helper}</div>}
                      <div className="grid grid-cols-1 gap-2 mt-2">
                        {q.options.map((opt) => {
                          const checked = dynamicAnswers[q.id] === opt.value;
                          return (
                            <label key={opt.value} className={cn('flex items-center gap-3 border rounded-lg px-3 py-2.5 cursor-pointer', checked ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white')}>
                              <input type="radio" name={`dq_${q.id}`} checked={checked} onChange={() => applyDynamicAnswer(q.id, opt.value)} className="w-4 h-4" />
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

            <div id="section-job_schedule" />
            <Card className={cn(errorSection === 'job_schedule' ? 'border-red-400 bg-red-50' : undefined)}>
              <div className="text-sm font-semibold text-gray-900 mb-3">วันและเวลา</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <DateTimeInput24h label="เริ่มงาน" value={form.scheduled_start_at} error={fieldErrors.scheduled_start_at} onChange={(e) => { setErrorSection(null); setErrorMessage(null); setFieldErrors((prev) => ({ ...prev, scheduled_start_at: '' })); setForm({ ...form, scheduled_start_at: e.target.value }); }} required />
                <DateTimeInput24h label="สิ้นสุด" value={form.scheduled_end_at} error={fieldErrors.scheduled_end_at} onChange={(e) => { setErrorSection(null); setErrorMessage(null); setFieldErrors((prev) => ({ ...prev, scheduled_end_at: '' })); setForm({ ...form, scheduled_end_at: e.target.value }); }} required />
              </div>
            </Card>

            <div id="section-job_location" className={cn(errorSection === 'job_location' ? 'border border-red-400 bg-red-50 rounded-lg p-3' : undefined, 'space-y-3')}>
              <GooglePlacesInput label="สถานที่ทำงาน" value={form.address_line1} placeholder="ค้นหาสถานที่ทำงานด้วย Google Maps" disabled={loading} error={fieldErrors.address_line1} showMap lat={form.lat} lng={form.lng} onChange={(next) => { const nextLat = typeof next.lat === 'number' ? next.lat : undefined; const nextLng = typeof next.lng === 'number' ? next.lng : undefined; setErrorSection(null); setErrorMessage(null); setFieldErrors((prev) => ({ ...prev, address_line1: '' })); setForm((prev) => ({ ...prev, address_line1: next.address_line1 || '', district: next.district || prev.district, province: next.province || prev.province, postal_code: next.postal_code || prev.postal_code, lat: nextLat, lng: nextLng })); }} />
              <Input label="รายละเอียดเพิ่มเติม" value={form.address_line2} onChange={(e) => setForm((prev) => ({ ...prev, address_line2: e.target.value }))} placeholder="เช่น หมู่บ้าน ชั้น ห้อง" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input label="เรท/ชม. (บาท)" type="number" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: Number(e.target.value) })} min={0} required />
              <Input label="จำนวนชม." type="number" value={form.total_hours} onChange={(e) => setForm({ ...form, total_hours: Number(e.target.value) })} min={1} required />
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
              <span className="text-sm text-blue-900">ราคารวมประมาณ</span>
              <strong className="text-lg tabular-nums text-blue-900">{totalAmount.toLocaleString()} บาท</strong>
            </div>

            <Card id="section-job_basic" className={cn(errorSection === 'job_basic' ? 'border-red-400 bg-red-50' : undefined)}>
              <div className="text-sm font-semibold text-gray-900 mb-2">ชื่องานและรายละเอียด</div>
              <Input label="ชื่องาน" value={form.title} error={fieldErrors.title} onChange={(e) => { setErrorSection(null); setErrorMessage(null); setFieldErrors((prev) => ({ ...prev, title: '' })); setForm({ ...form, title: e.target.value }); }} placeholder="เช่น ดูแลผู้สูงอายุช่วงเช้า" required />
              <div className="mt-3">
                <Textarea label="รายละเอียดงาน" fullWidth value={form.description} onChange={(e) => handleDescriptionChange(e.target.value)} placeholder="อธิบายสิ่งที่ต้องทำเพิ่มเติม" error={fieldErrors.description} className="min-h-20" />
              </div>
            </Card>

            {/* ── Tasks/Skills/Equipment summary bar (always visible) ── */}
            <Card id="section-job_tasks" className={cn('p-4', errorSection === 'job_tasks' ? 'border-red-400 bg-red-50' : undefined)}>
              <button type="button" onClick={() => setShowAdvancedStep3(!showAdvancedStep3)} className="w-full flex items-center justify-between">
                <div className="text-left">
                  <div className="text-sm font-semibold text-gray-900">งาน/ทักษะ/อุปกรณ์</div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">งาน: {form.job_tasks_flags.length}</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full">ทักษะ: {form.required_skills_flags.length}</span>
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">อุปกรณ์: {form.equipment_available_flags.length}</span>
                    <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">ระวัง: {form.precautions_flags.length}</span>
                  </div>
                </div>
                {showAdvancedStep3 ? <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" aria-hidden="true" /> : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" aria-hidden="true" />}
              </button>
              {fieldErrors.job_tasks_flags && <div className="text-sm text-red-700 mt-2">{fieldErrors.job_tasks_flags}</div>}
              <div className="flex flex-wrap gap-1 mt-2">
                {labelByValue(JOB_TASK_OPTIONS, form.job_tasks_flags).slice(0, 6).map((l) => <Badge key={l} variant="info">{l}</Badge>)}
                {form.job_tasks_flags.length > 6 && <Badge variant="default">+{form.job_tasks_flags.length - 6}</Badge>}
              </div>
            </Card>

            {showAdvancedStep3 && (
              <div className="space-y-4">
                {suggestions && (
                  <Card padding="sm">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-gray-900">คำแนะนำจากข้อมูลผู้ป่วย</div>
                      <Button variant="outline" size="sm" onClick={applySuggestions}>ใช้คำแนะนำ</Button>
                    </div>
                  </Card>
                )}

                <Card>
                  <div className="text-sm font-semibold text-gray-900 mb-1">งานที่ต้องทำ ({form.job_tasks_flags.length})</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {JOB_TASK_OPTIONS.filter((opt) => relevantTaskValues.has(opt.v) || form.job_tasks_flags.includes(opt.v)).map((opt) => {
                      const checked = form.job_tasks_flags.includes(opt.v);
                      return (
                        <label key={opt.v} className={cn('flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer text-sm', highlightTask === opt.v ? 'border-red-500 bg-red-50' : checked ? 'border-blue-500 bg-blue-50' : 'border-gray-300')}>
                          <input type="checkbox" checked={checked} onChange={() => toggleJobTask(opt.v)} className="w-4 h-4" />
                          {opt.label}
                        </label>
                      );
                    })}
                  </div>
                  {!showExtraTasks && <button type="button" className="mt-2 text-xs text-blue-700 underline" onClick={() => setShowExtraTasks(true)}>แสดงงานอื่น ๆ</button>}
                  {showExtraTasks && (
                    <div className="mt-2 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {JOB_TASK_OPTIONS.filter((opt) => !relevantTaskValues.has(opt.v) && !form.job_tasks_flags.includes(opt.v)).map((opt) => (
                          <label key={opt.v} className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 cursor-pointer bg-gray-50 text-sm">
                            <input type="checkbox" checked={false} onChange={() => toggleJobTask(opt.v)} className="w-4 h-4" />{opt.label}
                          </label>
                        ))}
                      </div>
                      <button type="button" className="text-xs text-gray-500 underline" onClick={() => setShowExtraTasks(false)}>ซ่อน</button>
                    </div>
                  )}
                </Card>

                <Card>
                  <div className="text-sm font-semibold text-gray-900 mb-1">ทักษะ/อุปกรณ์/ข้อควรระวัง</div>
                  {[
                    { title: 'ทักษะ', options: SKILL_OPTIONS, field: 'required_skills_flags' as const },
                    { title: 'อุปกรณ์', options: EQUIPMENT_OPTIONS, field: 'equipment_available_flags' as const },
                    { title: 'ข้อควรระวัง', options: PRECAUTION_OPTIONS, field: 'precautions_flags' as const },
                  ].map(({ title, options, field }) => (
                    <div key={field} className="mt-3">
                      <div className="text-xs font-medium text-gray-700 mb-1">{title}</div>
                      <div className="flex flex-wrap gap-2">
                        {options.map((opt) => {
                          const checked = (form[field] as string[]).includes(opt.v);
                          return (
                            <label key={opt.v} className={cn('flex items-center gap-1.5 border rounded-full px-2.5 py-1 cursor-pointer text-xs', checked ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-300 text-gray-600')}>
                              <input type="checkbox" checked={checked} onChange={() => { setErrorSection(null); const next = new Set(form[field] as string[]); if (next.has(opt.v)) next.delete(opt.v); else next.add(opt.v); setForm({ ...form, [field]: Array.from(next) }); }} className="w-3 h-3" />
                              {opt.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
            )}

            <div className={cn('p-3 border rounded-lg', computedRisk.risk_level === 'high_risk' ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50')}>
              <div className="text-sm font-semibold">{computedRisk.risk_level === 'high_risk' ? 'ความเสี่ยงสูง' : 'ความเสี่ยงต่ำ'}</div>
              <div className="text-xs text-gray-600 mt-1">{computedRisk.reason}</div>
            </div>

          </div>
        )}

        {/* ═══════════ Step 4: เลือกผู้ดูแล ═══════════ */}
        {currentStep === 4 && (
          <div className="space-y-4">
            {preferredCaregiverIdParam ? (
              <Card padding="responsive" className="border-blue-200 bg-blue-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-5 h-5 text-blue-700" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-blue-900">ผู้ดูแลที่เลือก: {preferredCaregiverNameParam || 'ผู้ดูแล'}</div>
                    {preferredCaregiverTrustLevelParam && <div className="text-xs text-blue-700">ระดับ: {getTrustLevelLabel(preferredCaregiverTrustLevelParam)}</div>}
                  </div>
                  <Check className="w-5 h-5 text-blue-600 ml-auto" aria-hidden="true" />
                </div>
                <p className="text-xs text-blue-700 mt-2">งานจะถูกมอบหมายให้ผู้ดูแลคนนี้โดยตรง</p>
              </Card>
            ) : (
              <>
                <button type="button" onClick={() => setSelectedCaregiverId('')} className={cn('w-full border-2 rounded-xl p-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500', !selectedCaregiverId ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300')}>
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', !selectedCaregiverId ? 'bg-green-200' : 'bg-gray-100')}>
                      <Search className="w-5 h-5 text-green-600" aria-hidden="true" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900">โพสต์หาผู้ดูแล</div>
                      <div className="text-xs text-gray-600">เผยแพร่งานให้ผู้ดูแลที่เหมาะสมมาสมัคร</div>
                    </div>
                    {!selectedCaregiverId && <Check className="w-5 h-5 text-green-600 flex-shrink-0" aria-hidden="true" />}
                  </div>
                </button>

                {/* ── Favorite caregivers section ── */}
                {(favoritesLoading || favoriteCaregivers.length > 0) && (
                  <div className="pt-2">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 mb-2">
                      <Heart className="w-4 h-4 fill-red-500 text-red-500" aria-hidden="true" />
                      ผู้ดูแลที่ชื่นชอบ
                    </div>
                    {favoritesLoading ? (
                      <div className="text-center py-4 text-sm text-gray-500">กำลังโหลดรายการโปรด...</div>
                    ) : (
                      <div className="space-y-2">
                        {favoriteCaregivers.slice(0, 5).map((fav) => {
                          const isSelected = selectedCaregiverId === fav.caregiver_id;
                          const rating = Number(fav.avg_rating) || 0;
                          const certs = (fav.certifications || []) as string[];
                          const specs = (fav.specializations || []) as string[];
                          const requiredSkills = new Set(form.required_skills_flags);
                          const matchedSkills = [...specs, ...certs].filter((s: string) => requiredSkills.has(s));
                          return (
                            <div key={fav.id} className={cn('border-2 rounded-xl transition-all', isSelected ? 'border-blue-500 bg-blue-50' : 'border-red-200 bg-red-50/20')}>
                              <button type="button" onClick={() => setSelectedCaregiverId(isSelected ? '' : fav.caregiver_id)} className="w-full p-3 text-left focus:outline-none">
                                <div className="flex items-start gap-3">
                                  <Avatar
                                    userId={fav.caregiver_id}
                                    avatarVersion={fav.avatar_version}
                                    src={!fav.avatar_version && fav.avatar ? `/uploads/${fav.avatar}` : undefined}
                                    name={fav.display_name || 'ผู้ดูแล'}
                                    size="md"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-semibold text-gray-900 line-clamp-1">{fav.display_name || 'ผู้ดูแล'}</span>
                                      <Badge variant={getTrustLevelConfig(fav.trust_level).badgeVariant}>{getTrustLevelLabel(fav.trust_level)}</Badge>
                                      <Heart className="w-3.5 h-3.5 fill-red-400 text-red-400 flex-shrink-0" aria-hidden="true" />
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-600">
                                      {rating > 0 && (
                                        <span className="flex items-center gap-0.5 text-amber-600">
                                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                                          {rating.toFixed(1)}{fav.total_reviews > 0 && <span className="text-gray-500">({fav.total_reviews})</span>}
                                        </span>
                                      )}
                                      {fav.experience_years > 0 && <span>ประสบการณ์ {fav.experience_years} ปี</span>}
                                      {Number(fav.completed_jobs_count) > 0 && <span>งานสำเร็จ {fav.completed_jobs_count}</span>}
                                    </div>
                                    {matchedSkills.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {matchedSkills.slice(0, 3).map((s: string) => (
                                          <span key={s} className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-800 rounded-full">✓ {s}</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-shrink-0">
                                    {isSelected ? <Check className="w-5 h-5 text-blue-600" aria-hidden="true" /> : null}
                                  </div>
                                </div>
                              </button>
                              <div className="px-3 pb-2">
                                <button type="button" onClick={(e) => { e.stopPropagation(); openPreview(fav.caregiver_id); }} className="text-xs text-blue-600 hover:underline">ดูโปรไฟล์</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-2">
                  <div className="text-sm font-semibold text-gray-900 mb-2">หรือเลือกผู้ดูแลที่แนะนำ</div>
                  {suggestedLoading ? (
                    <div className="text-center py-8 text-sm text-gray-500">กำลังค้นหาผู้ดูแลที่เหมาะสม...</div>
                  ) : suggestedCaregivers.length === 0 ? (
                    <Card padding="responsive" className="text-center">
                      <div className="text-sm text-gray-500">ยังไม่พบผู้ดูแลที่ตรงเงื่อนไขขณะนี้</div>
                      <div className="mt-2"><Link to="/hirer/search-caregivers"><Button variant="outline" size="sm" leftIcon={<Search className="w-4 h-4" />}>ค้นหาเพิ่มเติม</Button></Link></div>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {suggestedCaregivers.slice(0, 8).map((cg, idx) => {
                        const isSelected = selectedCaregiverId === cg.id;
                        const rating = Number(cg.avg_rating) || 0;
                        const matchScore = cg._matchScore || 0;
                        const isBestMatch = idx === 0 && matchScore >= 40;
                        const completedJobs = Number(cg.completed_jobs_count) || 0;
                        const certs = (cg.certifications || []) as string[];
                        const specs = (cg.specializations || []) as string[];
                        const requiredSkills = new Set(form.required_skills_flags);
                        const matchedSkills = [...specs, ...certs].filter((s: string) => requiredSkills.has(s));
                        const feas = computeFeasibility(cg);
                        return (
                          <div key={cg.id} className={cn('border-2 rounded-xl transition-all', isSelected ? 'border-blue-500 bg-blue-50' : isBestMatch ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200')}>
                            {isBestMatch && !isSelected && (
                              <div className="bg-amber-100 text-amber-800 text-[10px] font-bold text-center py-0.5 rounded-t-[10px]">⭐ แนะนำ — เหมาะสมที่สุด</div>
                            )}
                            <button type="button" onClick={() => setSelectedCaregiverId(isSelected ? '' : cg.id)} className="w-full p-3 text-left focus:outline-none">
                              <div className="flex items-start gap-3">
                                <Avatar
                                  userId={cg.id}
                                  avatarVersion={cg.avatar_version}
                                  src={!cg.avatar_version && cg.avatar ? `/uploads/${cg.avatar}` : undefined}
                                  name={cg.display_name || 'ผู้ดูแล'}
                                  size="md"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-gray-900 line-clamp-1">{cg.display_name || 'ผู้ดูแล'}</span>
                                    <Badge variant={getTrustLevelConfig(cg.trust_level).badgeVariant}>{getTrustLevelLabel(cg.trust_level)}</Badge>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-600">
                                    {rating > 0 && (
                                      <span className="flex items-center gap-0.5 text-amber-600">
                                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                                        {rating.toFixed(1)}{cg.total_reviews > 0 && <span className="text-gray-500">({cg.total_reviews})</span>}
                                      </span>
                                    )}
                                    {cg.experience_years > 0 && <span>ประสบการณ์ {cg.experience_years} ปี</span>}
                                    {completedJobs > 0 && <span>งานสำเร็จ {completedJobs}</span>}
                                  </div>
                                  {matchedSkills.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      {matchedSkills.slice(0, 3).map((s: string) => (
                                        <span key={s} className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-800 rounded-full">✓ {s}</span>
                                      ))}
                                      {matchedSkills.length > 3 && <span className="text-[10px] text-gray-500">+{matchedSkills.length - 3}</span>}
                                    </div>
                                  )}
                                  {certs.length > 0 && matchedSkills.length === 0 && (
                                    <div className="text-[10px] text-gray-500 mt-1">ใบรับรอง: {certs.slice(0, 2).join(', ')}{certs.length > 2 ? ` +${certs.length - 2}` : ''}</div>
                                  )}
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', feas.confidence === 'high' ? 'bg-green-100 text-green-800' : feas.confidence === 'medium' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600')}>
                                      {feas.confidence === 'high' ? '✓' : feas.confidence === 'medium' ? '~' : '?'} {feas.confidenceLabel}
                                    </span>
                                    {feas.scheduleLabel && feas.schedule !== 'unknown' && (
                                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', feas.schedule === 'available' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700')}>
                                        {feas.scheduleLabel}
                                      </span>
                                    )}
                                    {computeReliability(cg).map((tag) => (
                                      <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded-full">{tag}</span>
                                    ))}
                                  </div>
                                  {(() => { const s = computeStrengthsSummary(cg, feas); return s ? <div className="text-[10px] text-green-700 mt-1 leading-tight">{s}</div> : null; })()}
                                </div>
                                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                                  {isSelected ? <Check className="w-5 h-5 text-blue-600" aria-hidden="true" /> : (
                                    <div className="text-[10px] text-gray-500">{matchScore}%</div>
                                  )}
                                </div>
                              </div>
                            </button>
                            <div className="px-3 pb-2">
                              <button type="button" onClick={(e) => { e.stopPropagation(); openPreview(cg.id); }} className="text-xs text-blue-600 hover:underline">ดูโปรไฟล์</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Caregiver Preview Modal ── */}
        <Modal isOpen={!!previewCaregiverId} onClose={closePreview} title="โปรไฟล์ผู้ดูแล" size="lg">
          {previewLoading ? (
            <div className="text-center py-10 text-sm text-gray-500">กำลังโหลด...</div>
          ) : previewData ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <UserIcon className="w-7 h-7 text-blue-600" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900">{previewData.display_name || 'ผู้ดูแล'}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant={getTrustLevelConfig(previewData.trust_level).badgeVariant}>{getTrustLevelLabel(previewData.trust_level)}</Badge>
                    {Number(previewData.avg_rating) > 0 && (
                      <span className="flex items-center gap-0.5 text-sm text-amber-600">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                        {Number(previewData.avg_rating).toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {previewData.bio && <p className="text-sm text-gray-700 whitespace-pre-wrap">{previewData.bio}</p>}

              <div className="grid grid-cols-2 gap-3 text-sm">
                {previewData.experience_years > 0 && <div><div className="text-xs text-gray-500">ประสบการณ์</div><div className="font-medium">{previewData.experience_years} ปี</div></div>}
                {Number(previewData.completed_jobs_count) > 0 && <div><div className="text-xs text-gray-500">งานสำเร็จ</div><div className="font-medium">{previewData.completed_jobs_count}</div></div>}
                {Number(previewData.total_reviews) > 0 && <div><div className="text-xs text-gray-500">รีวิว</div><div className="font-medium">{previewData.total_reviews}</div></div>}
              </div>

              {(() => {
                const cgForFeas = suggestedCaregivers.find((c: any) => c.id === previewCaregiverId) || previewData;
                const modalFeas = computeFeasibility(cgForFeas);
                const modalReliability = computeReliability(cgForFeas);
                const modalStrengths = computeStrengthsSummary(cgForFeas, modalFeas);
                return (
                  <div className="p-3 border border-blue-200 bg-blue-50/50 rounded-lg space-y-2">
                    <div className="text-xs font-medium text-blue-900">ความเหมาะสมกับงานนี้</div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', modalFeas.confidence === 'high' ? 'bg-green-100 text-green-800' : modalFeas.confidence === 'medium' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600')}>
                        {modalFeas.confidence === 'high' ? '✓' : modalFeas.confidence === 'medium' ? '~' : '?'} {modalFeas.confidenceLabel}
                      </span>
                      {modalFeas.schedule !== 'unknown' && (
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full', modalFeas.schedule === 'available' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700')}>{modalFeas.scheduleLabel}</span>
                      )}
                      {modalFeas.time !== 'unknown' && (
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full', modalFeas.time === 'within' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700')}>{modalFeas.timeLabel}</span>
                      )}
                      {modalReliability.map((tag) => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">{tag}</span>
                      ))}
                    </div>
                    {modalStrengths && <div className="text-xs text-green-700 leading-snug">{modalStrengths}</div>}
                  </div>
                );
              })()}

              {((previewData.specializations || []).length > 0 || (previewData.certifications || []).length > 0) && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">ทักษะ / ใบรับรอง</div>
                  <div className="flex flex-wrap gap-1.5">
                    {[...(previewData.specializations || []), ...(previewData.certifications || [])].map((s: string) => {
                      const isMatch = form.required_skills_flags.includes(s);
                      return <span key={s} className={cn('text-xs px-2 py-0.5 rounded-full', isMatch ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700')}>{isMatch ? '✓ ' : ''}{s}</span>;
                    })}
                  </div>
                </div>
              )}

              {previewReviews.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2">รีวิวล่าสุด</div>
                  <div className="space-y-2">
                    {previewReviews.slice(0, 3).map((rv: any) => (
                      <div key={rv.id} className="p-2 border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-1 text-xs text-amber-600">
                          {Array.from({ length: rv.rating || 0 }).map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" aria-hidden="true" />)}
                        </div>
                        {rv.comment && <div className="text-xs text-gray-700 mt-1 line-clamp-2">{rv.comment}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="primary" fullWidth onClick={() => { setSelectedCaregiverId(previewCaregiverId || ''); closePreview(); }}>เลือกผู้ดูแลคนนี้</Button>
                <Button variant="outline" fullWidth onClick={closePreview}>ปิด</Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-sm text-gray-500">ไม่พบข้อมูลผู้ดูแล</div>
          )}
        </Modal>

        {/* ═══════════ Step 5: สรุปก่อนยืนยัน ═══════════ */}
        {currentStep === 5 && !successJobId && (
          <div className="space-y-4">
            <Card padding="responsive">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">บริการ</div>
                <button type="button" onClick={() => setCurrentStep(1)} className="text-xs text-blue-600 hover:underline">แก้ไข</button>
              </div>
              <div className="text-sm text-gray-800 mt-1">{currentDetailedTemplate.label}</div>
              {currentDetailedTemplate.dynamicQuestions.map((q) => {
                const ans = dynamicAnswers[q.id];
                if (!ans) return null;
                const optLabel = q.options.find((o) => o.value === ans)?.label || ans;
                return <div key={q.id} className="text-xs text-gray-600 mt-0.5">{q.label}: {optLabel}</div>;
              })}
            </Card>

            <Card padding="responsive">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">ผู้รับการดูแล</div>
                <button type="button" onClick={() => setCurrentStep(2)} className="text-xs text-blue-600 hover:underline">แก้ไข</button>
              </div>
              <div className="text-sm text-gray-800 mt-1">{selectedCareRecipient?.patient_display_name || 'ยังไม่ได้เลือก'}</div>
            </Card>

            <Card padding="responsive">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">รายละเอียดงาน</div>
                <button type="button" onClick={() => setCurrentStep(3)} className="text-xs text-blue-600 hover:underline">แก้ไข</button>
              </div>
              <div className="text-sm text-gray-800 mt-1">ชื่องาน: {form.title || '-'}</div>
              <div className="text-sm text-gray-800 mt-1">วันเวลา: {form.scheduled_start_at ? new Date(form.scheduled_start_at).toLocaleString('th-TH') : '-'} — {form.scheduled_end_at ? new Date(form.scheduled_end_at).toLocaleString('th-TH') : '-'}</div>
              <div className="text-sm text-gray-800 mt-1">สถานที่ทำงาน: {form.address_line1 || '-'}</div>
              <div className="text-sm text-gray-800 mt-1">งาน: {form.job_tasks_flags.length} รายการ</div>
              <div className="flex flex-wrap gap-1 mt-1">{labelByValue(JOB_TASK_OPTIONS, form.job_tasks_flags).map((l) => <Badge key={l} variant="info">{l}</Badge>)}</div>
            </Card>

            <Card padding="responsive">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">ค่าจ้าง</div>
                <button type="button" onClick={() => setCurrentStep(3)} className="text-xs text-blue-600 hover:underline">แก้ไข</button>
              </div>
              <div className="text-lg font-bold tabular-nums text-gray-900 mt-1">{totalAmount.toLocaleString()} บาท</div>
              <div className="text-xs text-gray-500">{form.hourly_rate} บาท/ชม. × {form.total_hours} ชม.</div>
            </Card>

            {/* Caregiver selection summary + outcome messaging */}
            <Card padding="responsive">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">ผู้ดูแล</div>
                <button type="button" onClick={() => setCurrentStep(4)} className="text-xs text-blue-600 hover:underline">แก้ไข</button>
              </div>
              {(selectedCaregiverId || preferredCaregiverIdParam) ? (
                <>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <UserIcon className="w-4 h-4 text-blue-600" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {preferredCaregiverNameParam || suggestedCaregivers.find((c: any) => c.id === selectedCaregiverId)?.display_name || 'ผู้ดูแลที่เลือก'}
                      </div>
                      <div className="text-xs text-gray-500">มอบหมายงานโดยตรง</div>
                    </div>
                  </div>
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-xs text-blue-800">หลังบันทึก: งานจะถูกส่งให้ผู้ดูแลที่เลือก → รอการตอบรับ → เริ่มงาน</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm text-gray-800 mt-1">โพสต์หาผู้ดูแลผ่าน marketplace</div>
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                    <div className="text-xs text-green-800">หลังบันทึก: งานจะถูกเผยแพร่ → ผู้ดูแลที่สนใจจะสมัคร → คุณเลือกจากหน้า "งานของฉัน"</div>
                  </div>
                </>
              )}
            </Card>

            <div className="mt-3">
              <Textarea label="รายละเอียดงานที่ต้องการสื่อสาร" fullWidth value={form.description} onChange={(e) => handleDescriptionChange(e.target.value)} placeholder="เขียนรายละเอียดเพิ่มเติมสำหรับผู้ดูแล" error={fieldErrors.description} className="min-h-20" helperText="ระบบจะเติมสรุปจากบริการที่เลือกให้อัตโนมัติ" />
            </div>

            <div className={cn('p-3 border rounded-lg', computedRisk.risk_level === 'high_risk' ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50')}>
              <div className="text-xs">{computedRisk.risk_level === 'high_risk' ? '⚠ ความเสี่ยงสูง' : '✓ ความเสี่ยงต่ำ'} — {computedRisk.reason}</div>
            </div>
          </div>
        )}

        {/* ═══════════ Success Screen ═══════════ */}
        {successJobId && (
          <div className="space-y-5 text-center py-4">
            <div className="text-5xl">✅</div>
            <h2 className="text-xl font-bold text-gray-900">{isDirectAssignment ? 'มอบหมายงานสำเร็จแล้ว!' : 'สร้างงานสำเร็จแล้ว!'}</h2>
            <p className="text-sm text-gray-600">
              {isDirectAssignment
                ? 'งานถูกส่งให้ผู้ดูแลที่คุณเลือกแล้ว กรุณารอการตอบรับ'
                : 'งานถูกบันทึกเป็นแบบร่างแล้ว เผยแพร่จากหน้า "งานของฉัน" เพื่อเปิดรับสมัครผู้ดูแล'}
            </p>

            <Card padding="responsive" className="text-left">
              <div className="text-sm font-semibold text-gray-900 mb-2">สิ่งที่ควรทำต่อ</div>
              <div className="space-y-2">
                {isDirectAssignment ? (
                  <>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 font-bold text-sm mt-0.5">1</span>
                      <div className="text-sm text-gray-700">รอผู้ดูแลตอบรับงาน — ระบบจะแจ้งเตือนคุณทันที</div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 font-bold text-sm mt-0.5">2</span>
                      <div className="text-sm text-gray-700">เมื่อผู้ดูแลตอบรับแล้ว สามารถแชทเพื่อนัดรายละเอียดได้</div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 font-bold text-sm mt-0.5">3</span>
                      <div className="text-sm text-gray-700">สามารถยกเลิกงานได้ก่อนผู้ดูแลตอบรับ</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 font-bold text-sm mt-0.5">1</span>
                      <div className="text-sm text-gray-700">ไปที่ <strong>หน้า "งานของฉัน"</strong> เพื่อเผยแพร่งาน</div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 font-bold text-sm mt-0.5">2</span>
                      <div className="text-sm text-gray-700">รอผู้ดูแลสมัครเข้ามา จากนั้นเลือกผู้ดูแลที่เหมาะสม</div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 font-bold text-sm mt-0.5">3</span>
                      <div className="text-sm text-gray-700">สามารถแก้ไขหรือยกเลิกงานได้ก่อนเริ่มงาน</div>
                    </div>
                  </>
                )}
              </div>
            </Card>

            <div className="flex flex-col gap-2 pt-2">
              <Link to={`/jobs/${successJobId}`}>
                <Button variant="primary" fullWidth>ดูรายละเอียดงาน</Button>
              </Link>
              <Link to="/hirer/home">
                <Button variant="outline" fullWidth>กลับหน้าหลัก</Button>
              </Link>
            </div>
          </div>
        )}
      {/* ── Bottom nav ── */}
      {!successJobId && (
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          {currentStep > 1 && (
            <Button variant="outline" fullWidth onClick={handlePrevStep} disabled={loading}>← ย้อนกลับ</Button>
          )}
          {currentStep < totalSteps ? (
            <Button variant="primary" fullWidth onClick={handleNextStep} disabled={loading}>
              ถัดไป →
            </Button>
          ) : (
            <Button variant="primary" fullWidth loading={loading} onClick={openReview}>{(selectedCaregiverId || preferredCaregiverIdParam) ? '✓ ยืนยันมอบหมายงาน' : '✓ ยืนยันบันทึกแบบร่าง'}</Button>
          )}
        </div>
      )}
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
            {!form.description.trim() && !loading && (
              <div className="text-xs text-red-600 mt-1">กรุณากรอกรายละเอียดงานก่อนบันทึก</div>
            )}
          </div>
        }
      >
        {pendingPayload ? (
          <div className="space-y-4">
            <Card padding="responsive">
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
              <div className="mt-3">
                <Textarea label="รายละเอียดงาน (แก้ไขได้ก่อนบันทึก)" fullWidth value={form.description} onChange={(e) => handleDescriptionChange(e.target.value)} placeholder="เขียนสิ่งที่ต้องการสื่อสารเพิ่มเติมกับผู้ดูแล" error={fieldErrors.description} className="min-h-28" helperText="ระบบจะต่อท้ายด้วยสรุปจากประเภทงานที่คุณเลือกให้อัตโนมัติ" />
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

            <Card padding="responsive">
              <div className="text-sm font-semibold text-gray-900">ผู้รับการดูแล</div>
              <div className="text-sm text-gray-800 mt-2">
                {selectedCareRecipient ? selectedCareRecipient.patient_display_name : 'ยังไม่ได้เลือก'}
              </div>
              {selectedCareRecipient?.general_health_summary && (
                <div className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{selectedCareRecipient.general_health_summary}</div>
              )}
            </Card>

            <Card padding="responsive">
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

