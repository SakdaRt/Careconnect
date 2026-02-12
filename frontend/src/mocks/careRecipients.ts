// Care Recipients (Patients) Mock Data
export interface CareRecipient {
  id: string;
  hirer_id: string;
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  relationship: string;
  medical_conditions: string[];
  mobility_level: 'independent' | 'assisted' | 'wheelchair' | 'bedridden';
  cognitive_status: 'normal' | 'mild_impairment' | 'moderate_impairment' | 'severe_impairment';
  allergies: string[];
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
  }>;
  dietary_requirements: string[];
  special_needs: string[];
  emergency_contact: {
    name: string;
    relationship: string;
    phone: string;
  };
  notes: string;
  created_at: string;
  updated_at: string;
}

export const mockCareRecipients: CareRecipient[] = [
  {
    id: 'patient-1',
    hirer_id: 'hirer-1',
    name: 'คุณยาย สุขใจ',
    age: 75,
    gender: 'female',
    relationship: 'คุณยาย',
    medical_conditions: ['เบาหวาน', 'ความดันสูง', 'ข้อเข่าเสื่อม'],
    mobility_level: 'assisted',
    cognitive_status: 'normal',
    allergies: ['ยาแก้ปวดบางชนิด'],
    medications: [
      {
        name: 'Metformin',
        dosage: '500mg',
        frequency: 'เช้า-เย็น หลังอาหาร',
      },
      {
        name: 'Amlodipine',
        dosage: '5mg',
        frequency: 'เช้า ก่อนอาหาร',
      },
    ],
    dietary_requirements: ['อาหารไร้น้ำตาล', 'อาหารไร้เกลือ', 'เนื้อสัตว์บด'],
    special_needs: ['ต้องช่วยเดิน', 'ต้องเตือนกินยา', 'ต้องการพูดคุยเป็นมิตร'],
    emergency_contact: {
      name: 'สมชาย ใจดี',
      relationship: 'หลาน',
      phone: '+66812345678',
    },
    notes: 'คุณยายชอบดูทีวี ชอบฟังเพลงเก่า ช่วยเปิดให้ด้วย',
    created_at: '2026-01-05T10:00:00Z',
    updated_at: '2026-01-08T14:30:00Z',
  },
  {
    id: 'patient-2',
    hirer_id: 'hirer-2',
    name: 'คุณปู่ มีสุข',
    age: 82,
    gender: 'male',
    relationship: 'คุณปู่',
    medical_conditions: ['เบาหวาน', 'ความดันสูง', 'โรคหัวใจ', 'อัลไซเมอร์เล็กน้อย'],
    mobility_level: 'wheelchair',
    cognitive_status: 'mild_impairment',
    allergies: ['Penicillin'],
    medications: [
      {
        name: 'Insulin',
        dosage: '10 units',
        frequency: 'เช้า-เย็น ก่อนอาหาร',
      },
      {
        name: 'Aspirin',
        dosage: '81mg',
        frequency: 'เช้า หลังอาหาร',
      },
      {
        name: 'Atorvastatin',
        dosage: '20mg',
        frequency: 'ก่อนนอน',
      },
    ],
    dietary_requirements: ['อาหารไร้น้ำตาล', 'อาหารไร้เกลือ', 'อาหารไร้ไขมัน', 'อาหารบด'],
    special_needs: [
      'ต้องใช้รถเข็น',
      'ต้องเฝ้าดูอาการ',
      'อาจสับสนเล็กน้อย',
      'ต้องเตือนกินยา',
      'ต้องวัดระดับน้ำตาล',
    ],
    emergency_contact: {
      name: 'สมศรี รักษ์ดี',
      relationship: 'หลานสาว',
      phone: '+66898765432',
    },
    notes: 'คุณปู่อาจจำคนไม่ได้บางครั้ง ต้องพูดช้าๆ ชัดๆ และใจเย็น',
    created_at: '2026-01-03T09:00:00Z',
    updated_at: '2026-01-09T10:00:00Z',
  },
  {
    id: 'patient-3',
    hirer_id: 'hirer-1',
    name: 'คุณตา พรประเสริฐ',
    age: 68,
    gender: 'male',
    relationship: 'คุณตา',
    medical_conditions: ['โรคปอด COPD', 'ความดันสูง'],
    mobility_level: 'independent',
    cognitive_status: 'normal',
    allergies: [],
    medications: [
      {
        name: 'Salbutamol inhaler',
        dosage: '2 puffs',
        frequency: 'ทุก 6 ชั่วโมง หรือเมื่อมีอาการ',
      },
      {
        name: 'Losartan',
        dosage: '50mg',
        frequency: 'เช้า',
      },
    ],
    dietary_requirements: ['อาหารธรรมดา', 'เลี่ยงอาหารรสจัด'],
    special_needs: ['ต้องช่วยใช้ยาพ่นอย่างถูกวิธี', 'เฝ้าดูอาการหายใจ'],
    emergency_contact: {
      name: 'สมชาย ใจดี',
      relationship: 'หลาน',
      phone: '+66812345678',
    },
    notes: 'คุณตายังสุขภาพดี แต่อาจหายใจลำบากบางครั้ง ให้สังเกตุและใช้ยาพ่นทันที',
    created_at: '2026-01-07T11:00:00Z',
    updated_at: '2026-01-07T11:00:00Z',
  },
];
