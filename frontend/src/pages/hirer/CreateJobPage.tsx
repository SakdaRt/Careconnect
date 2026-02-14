import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MainLayout } from '../../layouts';
import { Badge, Button, Card, Input, Modal, type BadgeProps } from '../../components/ui';
import { GooglePlacesInput } from '../../components/location/GooglePlacesInput';
import { CareRecipient, CreateJobData } from '../../services/api';
import { appApi } from '../../services/appApi';
import { useAuth } from '../../contexts';
import { cn } from '../../contexts/ThemeContext';
import { computeRiskLevel, HIGH_RISK_TASK_VALUES } from '../../utils/risk';

type JobType =
  | 'companionship'
  | 'personal_care'
  | 'medical_monitoring'
  | 'dementia_care'
  | 'post_surgery'
  | 'emergency';

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

const JOB_TASK_OPTIONS = [
  { v: 'companionship', label: 'เพื่อนคุย/ดูแลทั่วไป' },
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

export default function CreateJobPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const hirerId = user?.id || 'demo-hirer';

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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [taskPanelsOpen, setTaskPanelsOpen] = useState<{ high: boolean; low: boolean }>({
    high: true,
    low: true,
  });

  const [form, setForm] = useState({
    title: '',
    description: '',
    preferred_caregiver_id: '',
    job_type: 'companionship' as JobType,
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
    job_tasks_flags: [] as string[],
    required_skills_flags: [] as string[],
    equipment_available_flags: [] as string[],
    precautions_flags: [] as string[],
  });

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

  const taskOptionsByRisk = useMemo(() => {
    const high = JOB_TASK_OPTIONS.filter((opt) => HIGH_RISK_TASK_VALUES.has(opt.v));
    const low = JOB_TASK_OPTIONS.filter((opt) => !HIGH_RISK_TASK_VALUES.has(opt.v));
    return { high, low };
  }, []);

  const selectedTaskCountByRisk = useMemo(() => {
    const high = form.job_tasks_flags.filter((task) => HIGH_RISK_TASK_VALUES.has(task)).length;
    const low = form.job_tasks_flags.filter((task) => !HIGH_RISK_TASK_VALUES.has(task)).length;
    return { high, low };
  }, [form.job_tasks_flags]);

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
    if (!form.scheduled_start_at || !form.scheduled_end_at) {
      throw new Error('กรุณาเลือกวันและเวลาเริ่ม/สิ้นสุด');
    }
    if (!form.title.trim()) throw new Error('กรุณากรอกชื่องาน');
    if (!form.description.trim()) throw new Error('กรุณากรอกรายละเอียดงาน');
    if (!form.address_line1.trim()) throw new Error('กรุณากรอกที่อยู่');
    if (!form.job_tasks_flags.length) throw new Error('กรุณาเลือกงานที่ต้องทำอย่างน้อย 1 อย่าง');

    return {
      title: form.title.trim(),
      description: form.description.trim(),
      preferred_caregiver_id: form.preferred_caregiver_id.trim() || undefined,
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
      job_tasks_flags: form.job_tasks_flags,
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
    if (!pendingPayload || loading) return;
    setLoading(true);
    try {
      const res = (await appApi.createJob(hirerId, pendingPayload)) as CreateJobResult;
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
        } else if (code === 'PREFERRED_CAREGIVER_INVALID') {
          thai = 'ไม่พบผู้ดูแลที่ระบุหรือสถานะไม่พร้อมใช้งาน';
        }

        setErrorMessage(thai);
        setErrorSection(section || null);
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
        setErrorSection('job_schedule');
        setFieldErrors({ scheduled_start_at: msg, scheduled_end_at: msg });
        setErrorAnchorId('section-job_schedule');
      } else if (msg.includes('ชื่องาน') || msg.includes('รายละเอียดงาน')) {
        setErrorSection('job_basic');
        setErrorAnchorId('section-job_basic');
      } else if (msg.includes('ที่อยู่') || msg.includes('Google Maps')) {
        setErrorSection('job_location');
        setFieldErrors({ address_line1: msg });
        setErrorAnchorId('section-job_location');
      } else if (msg.includes('งานที่ต้องทำ')) {
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

  return (
    <MainLayout showBottomBar={false}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h1 className="text-2xl font-bold text-gray-900">สร้างงานใหม่</h1>
          <Button variant="outline" onClick={() => navigate(-1)} disabled={loading}>
            ย้อนกลับ
          </Button>
        </div>
        <p className="text-sm text-gray-600 mb-6">สร้างเป็นแบบร่างก่อน แล้วค่อยเผยแพร่ในหน้า “งานของฉัน”</p>

        <Card className="p-6">
          <div className="space-y-4">
            {errorSection && errorMessage && (
              <div className="p-3 border border-red-300 bg-red-50 rounded-lg text-sm text-red-800">
                {errorMessage}
              </div>
            )}

            <div
              id="section-patient"
              className={cn(
                'flex flex-col gap-1 p-3 border rounded-lg',
                errorSection === 'patient' ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
              )}
            >
              <label className="text-sm font-semibold text-gray-700">ผู้รับการดูแล</label>
              <select
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white"
                value={careRecipientId}
                onChange={(e) => setCareRecipientId(e.target.value)}
              >
                <option value="">ยังไม่ได้เลือก</option>
                {careRecipients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.patient_display_name}
                  </option>
                ))}
              </select>
              {careRecipients.length === 0 && (
                <div className="text-xs text-red-600">
                  ยังไม่มีผู้รับการดูแล กรุณาเพิ่มผู้รับการดูแลก่อนสร้างงาน
                </div>
              )}
              <div className="text-xs text-gray-500">
                ถ้ายังไม่มีผู้รับการดูแล ให้ไปเพิ่มที่เมนู “ผู้รับการดูแล”
              </div>
              <div>
                <Button variant="outline" size="sm" onClick={() => navigate('/hirer/care-recipients')}>
                  จัดการผู้รับการดูแล
                </Button>
              </div>
            </div>

            {selectedCareRecipient && patientSummary && (
              <Card className="p-4">
                <div className="text-sm font-semibold text-gray-900">สรุปผู้ได้รับการดูแล</div>
                <div className="text-xs text-gray-600 mt-1">{selectedCareRecipient.patient_display_name}</div>
                {selectedCareRecipient.general_health_summary && (
                  <div className="text-sm text-gray-800 mt-2 whitespace-pre-wrap">{selectedCareRecipient.general_health_summary}</div>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  {patientSummary.tags.slice(0, 20).map((t, idx) => (
                    <Badge key={idx} variant={t.variant}>
                      {t.label}
                    </Badge>
                  ))}
                  {patientSummary.tags.length > 20 && <Badge variant="default">+{patientSummary.tags.length - 20}</Badge>}
                </div>
              </Card>
            )}

            <div id="section-job_schedule" />
            <Card className={cn(errorSection === 'job_schedule' ? 'border-red-400 bg-red-50' : undefined)}>
              <div className="text-sm font-semibold text-gray-900 mb-3">วันและเวลา</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="เริ่มงาน"
                  type="datetime-local"
                  value={form.scheduled_start_at}
                  error={fieldErrors.scheduled_start_at}
                  onChange={(e) => {
                    setErrorSection(null);
                    setErrorMessage(null);
                    setFieldErrors((prev) => ({ ...prev, scheduled_start_at: '' }));
                    setForm({ ...form, scheduled_start_at: e.target.value });
                  }}
                  required
                />
                <Input
                  label="สิ้นสุด"
                  type="datetime-local"
                  value={form.scheduled_end_at}
                  error={fieldErrors.scheduled_end_at}
                  onChange={(e) => {
                    setErrorSection(null);
                    setErrorMessage(null);
                    setFieldErrors((prev) => ({ ...prev, scheduled_end_at: '' }));
                    setForm({ ...form, scheduled_end_at: e.target.value });
                  }}
                  required
                />
              </div>
            </Card>

            <Card
              id="section-job_basic"
              className={cn(errorSection === 'job_basic' ? 'border-red-400 bg-red-50' : undefined)}
            >
              <div className="text-sm font-semibold text-gray-900 mb-3">ข้อมูลงาน</div>
              <Input
                label="ชื่องาน"
                value={form.title}
                error={fieldErrors.title}
                onChange={(e) => {
                  setErrorSection(null);
                  setErrorMessage(null);
                  setFieldErrors((prev) => ({ ...prev, title: '' }));
                  setForm({ ...form, title: e.target.value });
                }}
                placeholder="เช่น ดูแลผู้สูงอายุช่วงเช้า"
                required
              />

              <div className="flex flex-col gap-1 mt-3">
                <label className="text-sm font-semibold text-gray-700">รายละเอียดงาน</label>
                <textarea
                  className={cn(
                    'w-full px-4 py-2 border rounded-lg transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                    fieldErrors.description ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 hover:border-gray-400',
                    'min-h-28'
                  )}
                  value={form.description}
                  onChange={(e) => {
                    setErrorSection(null);
                    setErrorMessage(null);
                    setFieldErrors((prev) => ({ ...prev, description: '' }));
                    setForm({ ...form, description: e.target.value });
                  }}
                  placeholder="อธิบายสิ่งที่ต้องทำ ข้อควรระวัง อุปกรณ์ ฯลฯ"
                />
                {fieldErrors.description && <div className="text-sm text-red-600">{fieldErrors.description}</div>}
              </div>


              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-gray-700">ประเภทงาน</label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white"
                    value={form.job_type}
                    onChange={(e) => {
                      setErrorSection(null);
                      setForm({ ...form, job_type: e.target.value as JobType });
                    }}
                  >
                    <option value="companionship">เพื่อนคุย / ดูแลทั่วไป</option>
                    <option value="personal_care">ช่วยเหลือตัวเอง / อาบน้ำแต่งตัว</option>
                    <option value="medical_monitoring">ดูแลการกินยา / วัดสัญญาณชีพ</option>
                    <option value="dementia_care">ดูแลผู้ป่วยสมองเสื่อม</option>
                    <option value="post_surgery">ดูแลหลังผ่าตัด</option>
                    <option value="emergency">เร่งด่วน</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-gray-700">ระดับความเสี่ยง (อัตโนมัติ)</label>
                  <div
                    className={cn(
                      'w-full px-4 py-2 border rounded-lg bg-white',
                      computedRisk.risk_level === 'high_risk' ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'
                    )}
                  >
                    <div className="text-sm font-semibold text-gray-900">
                      {computedRisk.risk_level === 'high_risk' ? 'ความเสี่ยงสูง' : 'ความเสี่ยงต่ำ'}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">{computedRisk.reason}</div>
                    {computedRisk.reasons?.length ? (
                      <div className="mt-2 flex flex-col gap-1">
                        {computedRisk.reasons.slice(0, 5).map((r) => (
                          <div key={r} className="text-[11px] text-gray-700">
                            • {r}
                          </div>
                        ))}
                        {computedRisk.reasons.length > 5 && (
                          <div className="text-[11px] text-gray-600">และอีก {computedRisk.reasons.length - 5} รายการ</div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>

            {suggestions && (
              <Card className="p-4">
                <div className="text-sm font-semibold text-gray-900">คำแนะนำจากข้อมูลผู้ป่วย</div>
                <div className="text-xs text-gray-600 mt-1">กดใช้คำแนะนำเพื่อเติมตัวเลือกที่สอดคล้องกับผู้ป่วยอัตโนมัติ</div>
                {suggestions.tasks.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-600">งานที่แนะนำ</div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {labelByValue(JOB_TASK_OPTIONS, suggestions.tasks).map((l) => (
                        <Badge key={l} variant="info">
                          {l}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {suggestions.skills.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-600">ทักษะที่แนะนำ</div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {labelByValue(SKILL_OPTIONS, suggestions.skills).map((l) => (
                        <Badge key={l} variant="default">
                          {l}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {suggestions.precautions.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-600">ข้อควรระวังที่แนะนำ</div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {labelByValue(PRECAUTION_OPTIONS, suggestions.precautions).map((l) => (
                        <Badge key={l} variant="warning">
                          {l}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {(suggestions.equipment || []).length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-600">อุปกรณ์ที่แนะนำ</div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {labelByValue(EQUIPMENT_OPTIONS, suggestions.equipment || []).map((l) => (
                        <Badge key={l} variant="success">
                          {l}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 mt-4 justify-end">
                  <Button variant="outline" size="sm" onClick={applySuggestions}>
                    ใช้คำแนะนำ
                  </Button>
                </div>
              </Card>
            )}

            <Card
              id="section-job_tasks"
              className={cn(errorSection === 'job_tasks' ? 'border-red-400 bg-red-50' : undefined)}
            >
              <div className="text-sm font-semibold text-gray-900 mb-3">งานที่ต้องทำ (เลือกได้หลายข้อ)</div>
              {fieldErrors.job_tasks_flags && <div className="text-sm text-red-700 mb-2">{fieldErrors.job_tasks_flags}</div>}
              <div className="space-y-3">
                {[
                  {
                    key: 'high' as const,
                    title: 'ความเสี่ยงสูง',
                    subtitle: 'ต้องใช้ทักษะหรือความระมัดระวังมาก',
                    options: taskOptionsByRisk.high,
                    selectedCount: selectedTaskCountByRisk.high,
                    open: taskPanelsOpen.high,
                    panelClass: 'border-red-200 bg-red-50/40',
                  },
                  {
                    key: 'low' as const,
                    title: 'ความเสี่ยงต่ำ',
                    subtitle: 'งานดูแลทั่วไป',
                    options: taskOptionsByRisk.low,
                    selectedCount: selectedTaskCountByRisk.low,
                    open: taskPanelsOpen.low,
                    panelClass: 'border-emerald-200 bg-emerald-50/40',
                  },
                ].map((group) => (
                  <div key={group.key} className={cn('border rounded-lg overflow-hidden', group.panelClass)}>
                    <button
                      type="button"
                      onClick={() =>
                        setTaskPanelsOpen((prev) => ({
                          ...prev,
                          [group.key]: !prev[group.key],
                        }))
                      }
                      className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left"
                    >
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{group.title}</div>
                        <div className="text-xs text-gray-600 mt-0.5">{group.subtitle} • เลือกแล้ว {group.selectedCount}</div>
                      </div>
                      <span className="text-xs text-gray-600">{group.open ? 'ซ่อน' : 'กดเพื่อขยาย'}</span>
                    </button>

                    {group.open && (
                      <div className="px-4 pb-4 border-t border-white/70">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                          {group.options.map((opt) => {
                            const checked = form.job_tasks_flags.includes(opt.v);
                            return (
                              <label
                                key={opt.v}
                                className={cn(
                                  'flex items-center gap-3 border rounded-lg px-3 py-2 cursor-pointer',
                                  highlightTask === opt.v
                                    ? 'border-red-500 bg-red-50'
                                    : checked
                                      ? 'border-blue-500 bg-blue-50'
                                      : 'border-gray-300 bg-white'
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleJobTask(opt.v)}
                                />
                                <span className="text-sm text-gray-900">{opt.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-600 mt-2">
                ระบบจะตรวจสอบความสอดคล้องกับข้อมูลผู้ป่วยก่อนบันทึก และคำนวณความเสี่ยงอัตโนมัติ
              </div>
            </Card>

            <div className="border border-gray-200 rounded-lg">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors rounded-lg"
              >
                <span>ตั้งค่าขั้นสูง (ทักษะ, อุปกรณ์, ข้อควรระวัง, ระบุผู้ดูแล)</span>
                <svg className={cn('w-5 h-5 transition-transform', showAdvanced && 'rotate-180')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
              </button>
            </div>

            {showAdvanced && (
              <>
            <div id="section-job_requirements" />
            <Card className={cn(errorSection === 'job_requirements' ? 'border-red-400 bg-red-50' : undefined)}>
              <div className="text-sm font-semibold text-gray-900 mb-3">ทักษะที่ต้องมี (ช่วยคัดผู้ดูแล)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SKILL_OPTIONS.map((opt) => {
                  const checked = form.required_skills_flags.includes(opt.v);
                  return (
                    <label
                      key={opt.v}
                      className={cn(
                        'flex items-center gap-3 border rounded-lg px-3 py-2 cursor-pointer',
                        checked ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setErrorSection(null);
                          const next = new Set(form.required_skills_flags);
                          if (next.has(opt.v)) next.delete(opt.v);
                          else next.add(opt.v);
                          setForm({ ...form, required_skills_flags: Array.from(next) });
                        }}
                      />
                      <span className="text-sm text-gray-900">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </Card>

            <Card className={cn(errorSection === 'job_requirements' ? 'border-red-400 bg-red-50' : undefined)}>
              <div className="text-sm font-semibold text-gray-900 mb-3">อุปกรณ์ที่มีให้ (เลือกได้หลายข้อ)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {EQUIPMENT_OPTIONS.map((opt) => {
                  const checked = form.equipment_available_flags.includes(opt.v);
                  return (
                    <label
                      key={opt.v}
                      className={cn(
                        'flex items-center gap-3 border rounded-lg px-3 py-2 cursor-pointer',
                        checked ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setErrorSection(null);
                          const next = new Set(form.equipment_available_flags);
                          if (next.has(opt.v)) next.delete(opt.v);
                          else next.add(opt.v);
                          setForm({ ...form, equipment_available_flags: Array.from(next) });
                        }}
                      />
                      <span className="text-sm text-gray-900">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </Card>

            <Card className={cn(errorSection === 'job_requirements' ? 'border-red-400 bg-red-50' : undefined)}>
              <div className="text-sm font-semibold text-gray-900 mb-3">ข้อควรระวัง/ความปลอดภัย</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRECAUTION_OPTIONS.map((opt) => {
                  const checked = form.precautions_flags.includes(opt.v);
                  return (
                    <label
                      key={opt.v}
                      className={cn(
                        'flex items-center gap-3 border rounded-lg px-3 py-2 cursor-pointer',
                        checked ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setErrorSection(null);
                          const next = new Set(form.precautions_flags);
                          if (next.has(opt.v)) next.delete(opt.v);
                          else next.add(opt.v);
                          setForm({ ...form, precautions_flags: Array.from(next) });
                        }}
                      />
                      <span className="text-sm text-gray-900">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </Card>

            <Card>
              <div className="text-sm font-semibold text-gray-900 mb-3">ระบุผู้ดูแลที่ต้องการ</div>
              <Input
                label="User ID ของผู้ดูแล"
                value={form.preferred_caregiver_id}
                error={fieldErrors.preferred_caregiver_id}
                onChange={(e) => {
                  setErrorSection(null);
                  setErrorMessage(null);
                  setFieldErrors((prev) => ({ ...prev, preferred_caregiver_id: '' }));
                  setForm({ ...form, preferred_caregiver_id: e.target.value });
                }}
                placeholder="เว้นว่างหากเปิดรับทุกคน"
              />
              <div className="text-xs text-gray-500 mt-1">ถ้าต้องการให้ผู้ดูแลคนเดิมรับงาน ให้ใส่ User ID ที่ได้จากระบบ</div>
            </Card>
              </>
            )}

            <div
              id="section-job_location"
              className={cn(errorSection === 'job_location' ? 'border border-red-400 bg-red-50 rounded-lg p-3' : undefined, 'space-y-3')}
            >
              <GooglePlacesInput
                label="ที่อยู่"
                value={form.address_line1}
                placeholder="ค้นหาที่อยู่ด้วย Google Maps"
                disabled={loading}
                error={fieldErrors.address_line1}
                showMap
                lat={form.lat}
                lng={form.lng}
                onChange={(next) => {
                  const nextLat = typeof next.lat === 'number' ? next.lat : undefined;
                  const nextLng = typeof next.lng === 'number' ? next.lng : undefined;
                  setErrorSection(null);
                  setErrorMessage(null);
                  setFieldErrors((prev) => ({ ...prev, address_line1: '' }));
                  setForm((prev) => ({
                    ...prev,
                    address_line1: next.address_line1 || '',
                    district: next.district || prev.district,
                    province: next.province || prev.province,
                    postal_code: next.postal_code || prev.postal_code,
                    lat: nextLat,
                    lng: nextLng,
                  }));
                }}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {!form.district && !form.province && (
                  <>
                    <Input
                      label="เขต/อำเภอ"
                      value={form.district}
                      onChange={(e) => setForm({ ...form, district: e.target.value })}
                      placeholder="เช่น วัฒนา"
                    />
                    <Input
                      label="จังหวัด"
                      value={form.province}
                      onChange={(e) => setForm({ ...form, province: e.target.value })}
                      placeholder="เช่น Bangkok"
                    />
                  </>
                )}
                {(form.district || form.province) && (
                  <div className="sm:col-span-2">
                    <div className="text-sm text-gray-600">
                      ที่อยู่: {form.address_line1}
                      {form.district && `, ${form.district}`}
                      {form.province && `, ${form.province}`}
                      {form.postal_code && ` ${form.postal_code}`}
                    </div>
                  </div>
                )}
              </div>

              <Input
                label="รายละเอียดที่อยู่เพิ่มเติม"
                value={form.address_line2}
                onChange={(e) => setForm((prev) => ({ ...prev, address_line2: e.target.value }))}
                placeholder="เช่น หมู่บ้าน อาคาร ชั้น ห้อง หรือจุดสังเกต"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="เรทรายชั่วโมง (บาท)"
                type="number"
                value={form.hourly_rate}
                onChange={(e) => setForm({ ...form, hourly_rate: Number(e.target.value) })}
                min={0}
                required
              />
              <Input
                label="จำนวนชั่วโมงรวม"
                type="number"
                value={form.total_hours}
                onChange={(e) => setForm({ ...form, total_hours: Number(e.target.value) })}
                min={1}
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_urgent}
                onChange={(e) => setForm({ ...form, is_urgent: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">งานเร่งด่วน</span>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                ราคารวมประมาณการ: <strong>{totalAmount.toLocaleString()} บาท</strong>
              </p>
            </div>

            <div className="pt-2">
              <Button variant="primary" fullWidth loading={loading} onClick={openReview}>
                รีวิวก่อนบันทึก
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Modal
        isOpen={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title="ตรวจสอบข้อมูลก่อนบันทึก"
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
              disabled={loading}
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
              <div className="text-sm text-gray-800 mt-1">ประเภทงาน: {JOB_TYPE_LABEL[form.job_type]}</div>
              <div className="text-sm text-gray-800 mt-1">
                ความเสี่ยง: {computedRisk.risk_level === 'high_risk' ? 'สูง' : 'ต่ำ'}
              </div>
              {pendingPayload.preferred_caregiver_id ? (
                <div className="text-sm text-gray-800 mt-1">
                  ผู้ดูแลที่ระบุ: {pendingPayload.preferred_caregiver_id}
                </div>
              ) : null}
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

