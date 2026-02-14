import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MainLayout } from '../../layouts';
import { Button, Card, CheckboxGroup, Input, LoadingState } from '../../components/ui';
import { GooglePlacesInput } from '../../components/location/GooglePlacesInput';
import { CareRecipient } from '../../services/api';
import { appApi } from '../../services/appApi';
import { cn } from '../../contexts/ThemeContext';

type SelectOption = {
  value: string;
  label: string;
};

const GENDER_OPTIONS: SelectOption[] = [
  { value: 'female', label: 'หญิง' },
  { value: 'male', label: 'ชาย' },
  { value: 'other', label: 'อื่น ๆ / ไม่ระบุ' },
];

const MOBILITY_OPTIONS: SelectOption[] = [
  { value: 'walk_independent', label: 'เดินได้เอง' },
  { value: 'walk_assisted', label: 'เดินได้แต่ต้องพยุง/ใช้ไม้เท้า' },
  { value: 'wheelchair', label: 'ใช้รถเข็น' },
  { value: 'bedbound', label: 'ติดเตียง' },
];

const COMMUNICATION_OPTIONS: SelectOption[] = [
  { value: 'normal', label: 'สื่อสารได้ตามปกติ' },
  { value: 'hearing_impaired', label: 'ได้ยินไม่ชัด/ต้องพูดช้า' },
  { value: 'speech_impaired', label: 'พูดไม่ชัด/ต้องใช้เวลาสื่อสาร' },
  { value: 'nonverbal', label: 'สื่อสารด้วยท่าทาง/ไม่พูด' },
];

const COGNITIVE_OPTIONS: SelectOption[] = [
  { value: 'normal', label: 'ปกติ' },
  { value: 'mild_impairment', label: 'หลงลืมเล็กน้อย' },
  { value: 'dementia', label: 'สมองเสื่อม/สับสนเป็นช่วง ๆ' },
  { value: 'delirium', label: 'สับสนเฉียบพลัน/เปลี่ยนแปลงเร็ว' },
  { value: 'psychiatric', label: 'โรคทางจิตเวช/พฤติกรรมต้องดูแลใกล้ชิด' },
];

const CHRONIC_OPTIONS: SelectOption[] = [
  { value: 'hypertension', label: 'ความดันโลหิตสูง' },
  { value: 'diabetes', label: 'เบาหวาน' },
  { value: 'heart_disease', label: 'โรคหัวใจ' },
  { value: 'stroke_history', label: 'เคยเป็นสโตรก/อัมพฤกษ์อัมพาต' },
  { value: 'copd_asthma', label: 'โรคปอดเรื้อรัง/หอบหืด' },
  { value: 'kidney_disease', label: 'ไตเรื้อรัง' },
  { value: 'cancer', label: 'มะเร็ง/อยู่ระหว่างรักษา' },
  { value: 'pressure_ulcer', label: 'แผลกดทับ' },
  { value: 'fall_history', label: 'มีประวัติล้มบ่อย' },
];

const SYMPTOM_OPTIONS: SelectOption[] = [
  { value: 'shortness_of_breath', label: 'หายใจเหนื่อย/หอบ' },
  { value: 'chest_pain', label: 'เจ็บหน้าอก/แน่นหน้าอก' },
  { value: 'seizure', label: 'ชัก/ลมชัก' },
  { value: 'altered_consciousness', label: 'ซึม/สติเปลี่ยนแปลง' },
  { value: 'high_fever', label: 'ไข้สูง (≥38.5°C)' },
  { value: 'uncontrolled_bleeding', label: 'เลือดออกผิดปกติ/หยุดยาก' },
  { value: 'severe_pain', label: 'ปวดรุนแรงควบคุมยาก' },
  { value: 'frequent_vomiting', label: 'อาเจียนบ่อย/เสี่ยงขาดน้ำ' },
];

const MEDICAL_DEVICE_OPTIONS: SelectOption[] = [
  { value: 'oxygen', label: 'ใช้ออกซิเจน' },
  { value: 'tracheostomy', label: 'เจาะคอ (tracheostomy)' },
  { value: 'ventilator', label: 'ใช้เครื่องช่วยหายใจ' },
  { value: 'feeding_tube', label: 'สายให้อาหาร (NG/PEG)' },
  { value: 'urinary_catheter', label: 'สายสวนปัสสาวะ' },
  { value: 'wound_dressing', label: 'ต้องทำแผล/เปลี่ยนผ้าพันแผล' },
];

const CARE_NEED_OPTIONS: SelectOption[] = [
  { value: 'bathing', label: 'อาบน้ำ/เช็ดตัว' },
  { value: 'dressing', label: 'แต่งตัว' },
  { value: 'toileting', label: 'เข้าห้องน้ำ/เปลี่ยนผ้าอ้อม' },
  { value: 'transfer_assist', label: 'ช่วยพยุง/ย้ายท่า/ขึ้นลงเตียง' },
  { value: 'feeding', label: 'ช่วยป้อนอาหาร' },
  { value: 'tube_feeding', label: 'ให้อาหารทางสาย' },
  { value: 'medication_reminder', label: 'เตือนกินยา' },
  { value: 'medication_administration', label: 'จัดยา/ช่วยให้ยาตามแผนแพทย์' },
  { value: 'vitals_check', label: 'วัดสัญญาณชีพ' },
];

const BEHAVIOR_RISK_OPTIONS: SelectOption[] = [
  { value: 'fall_risk', label: 'เสี่ยงหกล้ม' },
  { value: 'wandering', label: 'เดินหลง/ออกนอกบ้านเอง' },
  { value: 'aggression', label: 'ก้าวร้าว/ทำร้ายตนเองหรือผู้อื่น' },
  { value: 'choking_risk', label: 'เสี่ยงสำลัก' },
  { value: 'infection_control', label: 'ต้องระวังการติดเชื้อเป็นพิเศษ' },
];

const ALLERGY_OPTIONS: SelectOption[] = [
  { value: 'no_known_allergies', label: 'ไม่มีประวัติแพ้ (NKA)' },
  { value: 'food_allergy', label: 'แพ้อาหารบางชนิด' },
  { value: 'drug_allergy', label: 'แพ้ยา' },
  { value: 'latex_allergy', label: 'แพ้ยาง/ลาเท็กซ์' },
  { value: 'other_allergy', label: 'อื่น ๆ' },
];

function normalizeAgeBand(raw?: string | null) {
  const v = String(raw || '').trim();
  if (!v) return '60_74';
  if (['0_12', '13_17', '18_59', '60_74', '75_89', '90_plus'].includes(v)) return v;
  const m = v.match(/(\d{1,3})\s*-\s*(\d{1,3})/);
  if (m) {
    const start = Number(m[1]);
    if (start >= 90) return '90_plus';
    if (start >= 75) return '75_89';
    if (start >= 60) return '60_74';
    if (start >= 18) return '18_59';
    if (start >= 13) return '13_17';
    return '0_12';
  }
  return '60_74';
}

function normalizeGender(raw?: string | null) {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return 'female';
  if (['female', 'male', 'other'].includes(v)) return v;
  if (v === 'หญิง') return 'female';
  if (v === 'ชาย') return 'male';
  return 'other';
}

function normalizeMobility(raw?: string | null) {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return 'walk_independent';
  if (['walk_independent', 'walk_assisted', 'wheelchair', 'bedbound'].includes(v)) return v;
  if (v.includes('ติดเตียง')) return 'bedbound';
  if (v.includes('รถเข็น')) return 'wheelchair';
  if (v.includes('พยุง') || v.includes('ไม้เท้า')) return 'walk_assisted';
  if (v.includes('เดิน')) return 'walk_independent';
  return 'walk_independent';
}

function normalizeCommunication(raw?: string | null) {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return 'normal';
  if (['normal', 'hearing_impaired', 'speech_impaired', 'nonverbal'].includes(v)) return v;
  if (v.includes('ได้ยิน')) return 'hearing_impaired';
  if (v.includes('พูด')) return 'speech_impaired';
  if (v.includes('ไม่พูด') || v.includes('ท่าทาง')) return 'nonverbal';
  return 'normal';
}

function normalizeCognitive(raw?: string | null) {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return 'normal';
  if (['normal', 'mild_impairment', 'dementia', 'delirium', 'psychiatric'].includes(v)) return v;
  if (v.includes('สมองเสื่อม')) return 'dementia';
  if (v.includes('เพ้อ') || v.includes('สับสน')) return 'delirium';
  return 'normal';
}

function yearToAgeBand(year: number) {
  const age = new Date().getFullYear() - year;
  if (age >= 90) return '90_plus';
  if (age >= 75) return '75_89';
  if (age >= 60) return '60_74';
  if (age >= 18) return '18_59';
  if (age >= 13) return '13_17';
  return '0_12';
}

function formatAgeBand(ageBand: string, age?: number | null) {
  const label =
    ageBand === '0_12'
      ? 'เด็ก (0–12)'
      : ageBand === '13_17'
      ? 'วัยรุ่น (13–17)'
      : ageBand === '18_59'
      ? 'ผู้ใหญ่ (18–59)'
      : ageBand === '60_74'
      ? 'ผู้สูงอายุ (60–74)'
      : ageBand === '75_89'
      ? 'ผู้สูงอายุ (75–89)'
      : ageBand === '90_plus'
      ? 'ผู้สูงอายุ (90+)'
      : '';
  if (!label) return '';
  if (age === null || age === undefined) return label;
  return `${label} • อายุ ${age} ปี`;
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: SelectOption[];
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-semibold text-gray-700">
        {label}
        {required ? <span className="text-red-500 ml-1">*</span> : null}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ExpandableMultiSelect({
  title,
  helperText,
  value,
  onChange,
  options,
}: {
  title: string;
  helperText?: string;
  value: string[];
  onChange: (next: string[]) => void;
  options: SelectOption[];
}) {
  return (
    <Card className="p-0 overflow-hidden">
      <details>
        <summary className="list-none cursor-pointer px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-900">{title}</div>
            <div className="text-xs text-gray-500 mt-0.5">เลือกแล้ว {value.length} รายการ</div>
          </div>
          <span className="text-xs text-gray-500">กดเพื่อขยาย</span>
        </summary>
        <div className="px-4 pb-4 border-t border-gray-100">
          {helperText ? <div className="text-xs text-gray-500 mt-2 mb-3">{helperText}</div> : null}
          <CheckboxGroup
            layout="grid"
            value={value}
            onChange={onChange}
            options={options}
          />
        </div>
      </details>
    </Card>
  );
}

export default function CareRecipientFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<CareRecipient | null>(null);
  const [fieldErrors, setFieldErrors] = useState({
    patient_display_name: '',
  });

  const [form, setForm] = useState({
    patient_display_name: '',
    address_line1: '',
    address_line2: '',
    district: '',
    province: 'Bangkok',
    postal_code: '',
    lat: undefined as number | undefined,
    lng: undefined as number | undefined,
    birth_year: '',
    age_band: '60_74',
    gender: 'female',
    mobility_level: 'walk_independent',
    communication_style: 'normal',
    cognitive_status: 'normal',
    general_health_summary: '',
    chronic_conditions_flags: [] as string[],
    symptoms_flags: [] as string[],
    medical_devices_flags: [] as string[],
    care_needs_flags: [] as string[],
    behavior_risks_flags: [] as string[],
    allergies_flags: [] as string[],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!id) {
        setData(null);
        return;
      }
      const res = await appApi.getCareRecipient(id);
      if (!res.success || !res.data) {
        toast.error(res.error || 'โหลดข้อมูลไม่สำเร็จ');
        setData(null);
        return;
      }
      setData(res.data);
      setForm({
        patient_display_name: res.data.patient_display_name || '',
        address_line1: res.data.address_line1 || '',
        address_line2: res.data.address_line2 || '',
        district: res.data.district || '',
        province: res.data.province || 'Bangkok',
        postal_code: res.data.postal_code || '',
        lat: typeof res.data.lat === 'number' ? res.data.lat : undefined,
        lng: typeof res.data.lng === 'number' ? res.data.lng : undefined,
        birth_year: res.data.birth_year ? String(res.data.birth_year) : '',
        age_band: normalizeAgeBand(res.data.age_band),
        gender: normalizeGender(res.data.gender),
        mobility_level: normalizeMobility(res.data.mobility_level),
        communication_style: normalizeCommunication(res.data.communication_style),
        cognitive_status: normalizeCognitive(res.data.cognitive_status),
        general_health_summary: res.data.general_health_summary || '',
        chronic_conditions_flags: res.data.chronic_conditions_flags || [],
        symptoms_flags: res.data.symptoms_flags || [],
        medical_devices_flags: res.data.medical_devices_flags || [],
        care_needs_flags: res.data.care_needs_flags || [],
        behavior_risks_flags: res.data.behavior_risks_flags || [],
        allergies_flags: res.data.allergies_flags || [],
      });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const title = useMemo(() => (isEdit ? 'แก้ไขผู้รับการดูแล' : 'เพิ่มผู้รับการดูแล'), [isEdit]);

  const birthYearValue = useMemo(() => {
    const raw = String(form.birth_year || '').trim();
    if (!raw) return null;
    const year = Number(raw);
    if (!Number.isFinite(year)) return null;
    return year;
  }, [form.birth_year]);

  const currentYear = new Date().getFullYear();
  const calculatedAge = useMemo(() => {
    if (!birthYearValue) return null;
    const age = currentYear - birthYearValue;
    if (age < 0 || age > 120) return null;
    return age;
  }, [birthYearValue, currentYear]);

  const calculatedAgeBand = useMemo(() => {
    if (!birthYearValue || calculatedAge === null) return null;
    return yearToAgeBand(birthYearValue);
  }, [birthYearValue, calculatedAge]);

  const handleSave = async () => {
    const displayName = form.patient_display_name.trim();
    if (!displayName) {
      setFieldErrors((prev) => ({ ...prev, patient_display_name: 'กรุณากรอกชื่อที่ใช้แสดง' }));
      toast.error('กรุณากรอกชื่อที่ใช้แสดง');
      return;
    }
    if (!birthYearValue || calculatedAge === null || !calculatedAgeBand) {
      toast.error('กรุณากรอกปีเกิดที่ถูกต้อง');
      return;
    }
    if (!form.gender) {
      toast.error('กรุณาเลือกเพศ');
      return;
    }
    if (!form.mobility_level) {
      toast.error('กรุณาเลือกระดับการเคลื่อนไหว');
      return;
    }
    if (!form.cognitive_status) {
      toast.error('กรุณาเลือกสถานะความจำ/สติ');
      return;
    }

    if (['wheelchair', 'bedbound'].includes(form.mobility_level) && !form.care_needs_flags.includes('transfer_assist')) {
      toast.error('กรณีใช้รถเข็น/ติดเตียง กรุณาเลือก “ช่วยพยุง/ย้ายท่า” ในความต้องการการดูแล');
      return;
    }
    if (form.care_needs_flags.includes('tube_feeding') && !form.medical_devices_flags.includes('feeding_tube')) {
      toast.error('ถ้าเลือก “ให้อาหารทางสาย” กรุณาเลือก “สายให้อาหาร” ในอุปกรณ์ทางการแพทย์');
      return;
    }

    setSaving(true);
    try {
      const payload: Omit<CareRecipient, 'id' | 'hirer_id' | 'is_active' | 'created_at' | 'updated_at'> = {
        patient_display_name: displayName,
        address_line1: form.address_line1.trim() || null,
        address_line2: form.address_line2.trim() || null,
        district: form.district.trim() || null,
        province: form.province.trim() || null,
        postal_code: form.postal_code.trim() || null,
        lat: typeof form.lat === 'number' ? form.lat : null,
        lng: typeof form.lng === 'number' ? form.lng : null,
        birth_year: birthYearValue,
        age_band: calculatedAgeBand,
        gender: form.gender || null,
        mobility_level: form.mobility_level || null,
        communication_style: form.communication_style || null,
        cognitive_status: form.cognitive_status || null,
        general_health_summary: form.general_health_summary.trim() || null,
        chronic_conditions_flags: form.chronic_conditions_flags.length ? form.chronic_conditions_flags : null,
        symptoms_flags: form.symptoms_flags.length ? form.symptoms_flags : null,
        medical_devices_flags: form.medical_devices_flags.length ? form.medical_devices_flags : null,
        care_needs_flags: form.care_needs_flags.length ? form.care_needs_flags : null,
        behavior_risks_flags: form.behavior_risks_flags.length ? form.behavior_risks_flags : null,
        allergies_flags: form.allergies_flags.length ? form.allergies_flags : null,
      };

      if (!id) {
        const res = await appApi.createCareRecipient(payload);
        if (!res.success) {
          toast.error(res.error || 'บันทึกไม่สำเร็จ');
          return;
        }
        toast.success('เพิ่มสำเร็จ');
      } else {
        const res = await appApi.updateCareRecipient(id, payload);
        if (!res.success) {
          toast.error(res.error || 'บันทึกไม่สำเร็จ');
          return;
        }
        toast.success('บันทึกสำเร็จ');
      }
      navigate('/hirer/care-recipients');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout showBottomBar={false}>
        <div className="max-w-3xl mx-auto px-4 py-6">
          <LoadingState message="กำลังโหลด..." />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout showBottomBar={false}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3 mb-6">
          <Link to="/hirer/care-recipients">
            <Button variant="outline">ย้อนกลับ</Button>
          </Link>
          <Button variant="ghost" onClick={load}>
            รีเฟรช
          </Button>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
        {isEdit && data && <div className="text-xs text-gray-500 font-mono break-all mb-4">{data.id}</div>}

        <Card className="p-6">
          <div className="space-y-4">
            <Input
              label="ชื่อที่ใช้แสดง"
              value={form.patient_display_name}
              error={fieldErrors.patient_display_name}
              onChange={(e) => {
                const next = e.target.value;
                setFieldErrors((prev) => ({ ...prev, patient_display_name: '' }));
                setForm((prev) => ({ ...prev, patient_display_name: next }));
              }}
              placeholder="เช่น คุณพ่อ / คุณแม่ / คุณยาย"
              required
            />

            <Card className="p-4">
              <div className="text-sm font-semibold text-gray-900 mb-3">ที่อยู่ผู้รับการดูแล</div>
              <div className="space-y-3">
                <GooglePlacesInput
                  label="ที่อยู่"
                  value={form.address_line1}
                  placeholder="ค้นหาที่อยู่ด้วย Google Maps"
                  disabled={saving}
                  showMap
                  lat={form.lat}
                  lng={form.lng}
                  onChange={(next) => {
                    const nextLat = typeof next.lat === 'number' ? next.lat : undefined;
                    const nextLng = typeof next.lng === 'number' ? next.lng : undefined;
                    setForm((prev) => ({
                      ...prev,
                      address_line1: next.address_line1 || '',
                      district: next.district || '',
                      province: next.province || prev.province,
                      postal_code: next.postal_code || '',
                      lat: nextLat,
                      lng: nextLng,
                    }));
                  }}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="เขต/อำเภอ"
                    value={form.district}
                    onChange={(e) => setForm((prev) => ({ ...prev, district: e.target.value }))}
                    placeholder="เช่น วัฒนา"
                  />
                  <Input
                    label="จังหวัด"
                    value={form.province}
                    onChange={(e) => setForm((prev) => ({ ...prev, province: e.target.value }))}
                    placeholder="เช่น Bangkok"
                  />
                </div>
                <Input
                  label="รหัสไปรษณีย์"
                  value={form.postal_code}
                  onChange={(e) => setForm((prev) => ({ ...prev, postal_code: e.target.value }))}
                  placeholder="เช่น 10110"
                />
                <Input
                  label="รายละเอียดที่อยู่เพิ่มเติม"
                  value={form.address_line2}
                  onChange={(e) => setForm((prev) => ({ ...prev, address_line2: e.target.value }))}
                  placeholder="เช่น หมู่บ้าน อาคาร ชั้น ห้อง หรือจุดสังเกต"
                />
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-sm font-semibold text-gray-900 mb-3">ข้อมูลพื้นฐาน</div>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex flex-col gap-2">
                  <Input
                    label="ปีเกิด"
                    type="number"
                    value={form.birth_year}
                    onChange={(e) => setForm((prev) => ({ ...prev, birth_year: e.target.value }))}
                    placeholder="เช่น 1945"
                    required
                  />
                  <div className="text-xs text-gray-500">
                    ระบบคำนวณช่วงอายุจากปีเกิดโดยอัตโนมัติ
                  </div>
                  {calculatedAgeBand && (
                    <div className="text-sm text-gray-700">
                      {formatAgeBand(calculatedAgeBand, calculatedAge)}
                    </div>
                  )}
                </div>
                <SelectField
                  label="เพศ"
                  required
                  value={form.gender}
                  onChange={(v) => setForm((prev) => ({ ...prev, gender: v }))}
                  options={GENDER_OPTIONS}
                />
                <SelectField
                  label="การเคลื่อนไหว"
                  required
                  value={form.mobility_level}
                  onChange={(v) => setForm((prev) => ({ ...prev, mobility_level: v }))}
                  options={MOBILITY_OPTIONS}
                />
                <SelectField
                  label="การสื่อสาร"
                  required
                  value={form.communication_style}
                  onChange={(v) => setForm((prev) => ({ ...prev, communication_style: v }))}
                  options={COMMUNICATION_OPTIONS}
                />
                <SelectField
                  label="ความจำ/สติ"
                  required
                  value={form.cognitive_status}
                  onChange={(v) => setForm((prev) => ({ ...prev, cognitive_status: v }))}
                  options={COGNITIVE_OPTIONS}
                />
              </div>
            </Card>

            <ExpandableMultiSelect
              title="โรคประจำตัว/เงื่อนไขสำคัญ"
              helperText="เลือกได้หลายข้อ"
              value={form.chronic_conditions_flags}
              onChange={(v) => setForm((prev) => ({ ...prev, chronic_conditions_flags: v }))}
              options={CHRONIC_OPTIONS}
            />

            <ExpandableMultiSelect
              title="อาการสำคัญ/อาการเสี่ยง"
              helperText="เลือกได้หลายข้อ งานอาจถูกจัดเป็นความเสี่ยงสูงอัตโนมัติ"
              value={form.symptoms_flags}
              onChange={(v) => setForm((prev) => ({ ...prev, symptoms_flags: v }))}
              options={SYMPTOM_OPTIONS}
            />

            <ExpandableMultiSelect
              title="อุปกรณ์/หัตถการทางการแพทย์"
              helperText="เลือกได้หลายข้อ"
              value={form.medical_devices_flags}
              onChange={(v) => setForm((prev) => ({ ...prev, medical_devices_flags: v }))}
              options={MEDICAL_DEVICE_OPTIONS}
            />

            <ExpandableMultiSelect
              title="ความต้องการการดูแล"
              helperText="เลือกได้หลายข้อ เลือกให้ครบจะช่วยประเมินงานได้แม่นยำ"
              value={form.care_needs_flags}
              onChange={(v) => setForm((prev) => ({ ...prev, care_needs_flags: v }))}
              options={CARE_NEED_OPTIONS}
            />

            <ExpandableMultiSelect
              title="พฤติกรรม/ความเสี่ยงด้านความปลอดภัย"
              helperText="เลือกได้หลายข้อ"
              value={form.behavior_risks_flags}
              onChange={(v) => setForm((prev) => ({ ...prev, behavior_risks_flags: v }))}
              options={BEHAVIOR_RISK_OPTIONS}
            />

            <ExpandableMultiSelect
              title="แพ้/ข้อห้าม"
              helperText="เลือกได้หลายข้อ หากมี “อื่น ๆ” โปรดระบุในสรุปสุขภาพโดยรวม"
              value={form.allergies_flags}
              onChange={(v) => setForm((prev) => ({ ...prev, allergies_flags: v }))}
              options={ALLERGY_OPTIONS}
            />

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-700">สรุปสุขภาพโดยรวม</label>
              <textarea
                className={cn(
                  'w-full px-4 py-2 border rounded-lg transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                  'border-gray-300 hover:border-gray-400',
                  'min-h-28'
                )}
                value={form.general_health_summary}
                onChange={(e) => setForm((prev) => ({ ...prev, general_health_summary: e.target.value }))}
                placeholder="เช่น โรคประจำตัว, ข้อควรระวัง, อาการสำคัญ"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" fullWidth onClick={() => navigate(-1)} disabled={saving}>
                ย้อนกลับ
              </Button>
              <Button variant="primary" fullWidth loading={saving} onClick={handleSave}>
                บันทึก
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
