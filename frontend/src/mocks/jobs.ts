// Job Mock Data
export type JobStatus = 'draft' | 'posted' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'expired';
export type JobType = 'hourly' | 'daily' | 'overnight' | 'live_in';
export type RiskLevel = 'low' | 'high';

export interface Job {
  id: string;
  status: JobStatus;
  job_type: JobType;
  risk_level: RiskLevel;
  hirer_id: string;
  hirer_name: string;
  caregiver_id: string | null;
  caregiver_name: string | null;
  patient_id: string;
  patient_name: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  pay_amount: number;
  pay_rate_type: 'hourly' | 'daily' | 'fixed';
  location: string;
  location_lat: number;
  location_lng: number;
  requirements: string[];
  skills_required: string[];
  equipment_needed: string[];
  created_at: string;
  updated_at: string;
  posted_at: string | null;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
}

export const mockJobs: Job[] = [
  // Draft jobs (Hirer)
  {
    id: 'job-1',
    status: 'draft',
    job_type: 'hourly',
    risk_level: 'low',
    hirer_id: 'hirer-1',
    hirer_name: 'สมชาย ใจดี',
    caregiver_id: null,
    caregiver_name: null,
    patient_id: 'patient-1',
    patient_name: 'คุณยาย สุขใจ',
    title: 'ดูแลคุณยายตอนเย็น',
    description: 'ต้องการผู้ดูแลช่วยเหลือคุณยายในช่วงเย็น ช่วยทำกิจกรรมประจำวัน',
    start_date: '2026-01-15',
    end_date: '2026-01-15',
    start_time: '17:00',
    end_time: '21:00',
    pay_amount: 300,
    pay_rate_type: 'hourly',
    location: 'บางนา กรุงเทพ',
    location_lat: 13.6684,
    location_lng: 100.6074,
    requirements: ['ช่วยเหลือกิจวัตรประจำวัน', 'ทำความสะอาดเบื้องต้น'],
    skills_required: ['ดูแลผู้สูงอายุ', 'การพยาบาลเบื้องต้น'],
    equipment_needed: [],
    created_at: '2026-01-09T10:00:00Z',
    updated_at: '2026-01-09T10:00:00Z',
    posted_at: null,
    assigned_at: null,
    started_at: null,
    completed_at: null,
    cancelled_at: null,
  },

  // Posted jobs (visible to caregivers)
  {
    id: 'job-2',
    status: 'posted',
    job_type: 'daily',
    risk_level: 'low',
    hirer_id: 'hirer-1',
    hirer_name: 'สมชาย ใจดี',
    caregiver_id: null,
    caregiver_name: null,
    patient_id: 'patient-1',
    patient_name: 'คุณยาย สุขใจ',
    title: 'ดูแลคุณยายทั้งวัน',
    description: 'ต้องการผู้ดูแลช่วยเหลือคุณยายตลอดวัน ให้อาหาร และช่วยกิจกรรมประจำวัน',
    start_date: '2026-01-16',
    end_date: '2026-01-16',
    start_time: '08:00',
    end_time: '18:00',
    pay_amount: 1500,
    pay_rate_type: 'daily',
    location: 'บางนา กรุงเทพ',
    location_lat: 13.6684,
    location_lng: 100.6074,
    requirements: ['ให้อาหาร', 'ช่วยเดิน', 'ทำความสะอาด'],
    skills_required: ['ดูแลผู้สูงอายุ', 'ประสบการณ์ 1 ปีขึ้นไป'],
    equipment_needed: [],
    created_at: '2026-01-09T09:00:00Z',
    updated_at: '2026-01-09T11:00:00Z',
    posted_at: '2026-01-09T11:00:00Z',
    assigned_at: null,
    started_at: null,
    completed_at: null,
    cancelled_at: null,
  },

  {
    id: 'job-3',
    status: 'posted',
    job_type: 'overnight',
    risk_level: 'high',
    hirer_id: 'hirer-2',
    hirer_name: 'สมศรี รักษ์ดี',
    caregiver_id: null,
    caregiver_name: null,
    patient_id: 'patient-2',
    patient_name: 'คุณปู่ มีสุข',
    title: 'ดูแลคุณปู่ค้างคืน (มีโรคประจำตัว)',
    description: 'ต้องการผู้ดูแลมืออาชีพ คุณปู่เป็นเบาหวานและความดันสูง ต้องให้ยาตามเวลา',
    start_date: '2026-01-17',
    end_date: '2026-01-18',
    start_time: '20:00',
    end_time: '08:00',
    pay_amount: 2500,
    pay_rate_type: 'fixed',
    location: 'สุขุมวิท กรุงเทพ',
    location_lat: 13.7248,
    location_lng: 100.5800,
    requirements: ['ให้ยา', 'เฝ้าดูอาการตลอดคืน', 'ติดต่อฉุกเฉินได้'],
    skills_required: ['พยาบาล', 'ดูแลผู้ป่วยโรคเรื้อรัง', 'ประสบการณ์ 3 ปีขึ้นไป'],
    equipment_needed: ['เครื่องวัดความดัน', 'เครื่องวัดน้ำตาล'],
    created_at: '2026-01-09T08:00:00Z',
    updated_at: '2026-01-09T12:00:00Z',
    posted_at: '2026-01-09T12:00:00Z',
    assigned_at: null,
    started_at: null,
    completed_at: null,
    cancelled_at: null,
  },

  // Assigned job
  {
    id: 'job-4',
    status: 'assigned',
    job_type: 'hourly',
    risk_level: 'low',
    hirer_id: 'hirer-1',
    hirer_name: 'สมชาย ใจดี',
    caregiver_id: 'caregiver-1',
    caregiver_name: 'สมหญิง ดูแล',
    patient_id: 'patient-1',
    patient_name: 'คุณยาย สุขใจ',
    title: 'ดูแลคุณยายเช้า',
    description: 'ช่วยเหลือคุณยายในช่วงเช้า อาบน้ำ ให้อาหาร',
    start_date: '2026-01-10',
    end_date: '2026-01-10',
    start_time: '07:00',
    end_time: '11:00',
    pay_amount: 400,
    pay_rate_type: 'hourly',
    location: 'บางนา กรุงเทพ',
    location_lat: 13.6684,
    location_lng: 100.6074,
    requirements: ['อาบน้ำ', 'ให้อาหารเช้า', 'ทำความสะอาดห้อง'],
    skills_required: ['ดูแลผู้สูงอายุ'],
    equipment_needed: [],
    created_at: '2026-01-08T10:00:00Z',
    updated_at: '2026-01-09T14:00:00Z',
    posted_at: '2026-01-08T11:00:00Z',
    assigned_at: '2026-01-09T14:00:00Z',
    started_at: null,
    completed_at: null,
    cancelled_at: null,
  },

  // In progress job
  {
    id: 'job-5',
    status: 'in_progress',
    job_type: 'daily',
    risk_level: 'low',
    hirer_id: 'hirer-1',
    hirer_name: 'สมชาย ใจดี',
    caregiver_id: 'caregiver-1',
    caregiver_name: 'สมหญิง ดูแล',
    patient_id: 'patient-1',
    patient_name: 'คุณยาย สุขใจ',
    title: 'ดูแลคุณยายวันนี้',
    description: 'ดูแลคุณยายตลอดวัน ช่วยกิจกรรมต่างๆ',
    start_date: '2026-01-09',
    end_date: '2026-01-09',
    start_time: '08:00',
    end_time: '18:00',
    pay_amount: 1500,
    pay_rate_type: 'daily',
    location: 'บางนา กรุงเทพ',
    location_lat: 13.6684,
    location_lng: 100.6074,
    requirements: ['ดูแลทั่วไป', 'ให้อาหาร'],
    skills_required: ['ดูแลผู้สูงอายุ'],
    equipment_needed: [],
    created_at: '2026-01-08T09:00:00Z',
    updated_at: '2026-01-09T08:05:00Z',
    posted_at: '2026-01-08T10:00:00Z',
    assigned_at: '2026-01-09T07:00:00Z',
    started_at: '2026-01-09T08:05:00Z',
    completed_at: null,
    cancelled_at: null,
  },

  // Completed jobs
  {
    id: 'job-6',
    status: 'completed',
    job_type: 'hourly',
    risk_level: 'low',
    hirer_id: 'hirer-1',
    hirer_name: 'สมชาย ใจดี',
    caregiver_id: 'caregiver-1',
    caregiver_name: 'สมหญิง ดูแล',
    patient_id: 'patient-1',
    patient_name: 'คุณยาย สุขใจ',
    title: 'ดูแลคุณยายเย็น (เสร็จแล้ว)',
    description: 'ดูแลคุณยายช่วงเย็น',
    start_date: '2026-01-08',
    end_date: '2026-01-08',
    start_time: '17:00',
    end_time: '21:00',
    pay_amount: 400,
    pay_rate_type: 'hourly',
    location: 'บางนา กรุงเทพ',
    location_lat: 13.6684,
    location_lng: 100.6074,
    requirements: ['ดูแลทั่วไป'],
    skills_required: ['ดูแลผู้สูงอายุ'],
    equipment_needed: [],
    created_at: '2026-01-07T10:00:00Z',
    updated_at: '2026-01-08T21:15:00Z',
    posted_at: '2026-01-07T11:00:00Z',
    assigned_at: '2026-01-08T15:00:00Z',
    started_at: '2026-01-08T17:05:00Z',
    completed_at: '2026-01-08T21:15:00Z',
    cancelled_at: null,
  },
];
