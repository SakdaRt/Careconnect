import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Search, Star, Briefcase, Clock3, Heart } from 'lucide-react';
import { MainLayout } from '../../layouts';
import { Button, Card, LoadingState, Modal } from '../../components/ui';
import { JobPost } from '../../services/api';
import { appApi } from '../../services/appApi';
import { useAuth } from '../../contexts';

interface CaregiverResult {
  id: string;
  email?: string;
  phone_number?: string;
  trust_level: string;
  trust_score?: number;
  completed_jobs_count?: number;
  display_name?: string;
  bio?: string;
  skills?: string[];
  certifications?: string[];
  specializations?: string[];
  experience_years?: number;
  available_days?: Array<number | string>;
  available_from?: string;
  available_to?: string;
  is_public_profile?: boolean;
}

const TRUST_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  L3: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'L3 เชื่อถือสูง' },
  L2: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'L2 ยืนยันแล้ว' },
  L1: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'L1 พื้นฐาน' },
  L0: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'L0 ยังไม่ยืนยัน' },
};

const SKILL_LABELS: Record<string, string> = {
  companionship: 'ดูแลทั่วไป/เพื่อนคุย',
  personal_care: 'ช่วยกิจวัตรประจำวัน',
  medical_monitoring: 'ดูแลการกินยา/วัดสัญญาณชีพ',
  dementia_care: 'ดูแลสมองเสื่อม',
  post_surgery: 'ดูแลหลังผ่าตัด',
  emergency: 'กรณีฉุกเฉิน',
  basic_care: 'ดูแลทั่วไป',
  personal_hygiene: 'อาบน้ำ/แต่งตัว',
  medication: 'จัดยา/ให้ยา',
  vital_signs: 'วัดสัญญาณชีพ',
  wound_care: 'ดูแลแผล',
  physical_therapy: 'กายภาพบำบัด',
  cooking: 'ทำอาหาร',
  driving: 'ขับรถ',
  first_aid: 'ปฐมพยาบาล',
  basic_first_aid: 'ปฐมพยาบาลเบื้องต้น',
  safe_transfer: 'ย้ายท่าอย่างปลอดภัย',
  vitals_monitoring: 'วัด/ติดตามสัญญาณชีพ',
  medication_management: 'จัดยา/ดูแลการใช้ยา',
  post_surgery_care: 'ดูแลหลังผ่าตัด',
  catheter_care: 'ดูแลสายสวน',
  tube_feeding_care: 'ดูแลการให้อาหารทางสาย',
};

const DAY_LABELS: Record<number, string> = {
  0: 'อา',
  1: 'จ',
  2: 'อ',
  3: 'พ',
  4: 'พฤ',
  5: 'ศ',
  6: 'ส',
};

const DAY_FULL_LABELS: Record<number, string> = {
  0: 'วันอาทิตย์',
  1: 'วันจันทร์',
  2: 'วันอังคาร',
  3: 'วันพุธ',
  4: 'วันพฤหัสบดี',
  5: 'วันศุกร์',
  6: 'วันเสาร์',
};

type JobCategoryKey =
  | 'hospital_transport_support'
  | 'general_patient_care'
  | 'post_surgery_recovery'
  | 'dementia_supervision'
  | 'bedbound_high_dependency'
  | 'medical_device_home_care';

const JOB_CATEGORY_FILTERS: Record<JobCategoryKey, { label: string; skills: string[] }> = {
  hospital_transport_support: {
    label: 'พาไปโรงพยาบาล / ไปส่ง',
    skills: ['hospital_companion', 'hospital_registration_support', 'hospital_transport_coordination', 'medication_pickup', 'companionship'],
  },
  general_patient_care: {
    label: 'ดูแลทั่วไป',
    skills: ['companionship', 'personal_care', 'basic_first_aid'],
  },
  post_surgery_recovery: {
    label: 'ดูแลหลังผ่าตัด',
    skills: ['post_surgery', 'post_surgery_care', 'wound_care'],
  },
  dementia_supervision: {
    label: 'ดูแลสมองเสื่อม',
    skills: ['dementia_care'],
  },
  bedbound_high_dependency: {
    label: 'ผู้ป่วยติดเตียง/พึ่งพาสูง',
    skills: ['personal_care', 'safe_transfer', 'tube_feeding_care', 'catheter_care'],
  },
  medical_device_home_care: {
    label: 'ดูแลอุปกรณ์แพทย์ที่บ้าน',
    skills: ['medical_monitoring', 'vitals_monitoring', 'medication_management', 'tube_feeding_care', 'catheter_care', 'oxygen_monitoring'],
  },
};

const JOB_CATEGORY_ORDER: JobCategoryKey[] = [
  'hospital_transport_support',
  'general_patient_care',
  'post_surgery_recovery',
  'dementia_supervision',
  'bedbound_high_dependency',
  'medical_device_home_care',
];

const CREATE_NEW_JOB_OPTION = '__create_new_job__';

function formatTime(time?: string) {
  if (!time) return '';
  return time.slice(0, 5);
}

function formatAvailability(days?: Array<number | string>, from?: string, to?: string) {
  const dayNums = (days || [])
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) as number[];

  const dayText = dayNums.length ? dayNums.map((d) => DAY_LABELS[d] || String(d)).join(', ') : '';
  const fromText = formatTime(from);
  const toText = formatTime(to);
  const timeText = fromText && toText ? `${fromText}-${toText}` : '';

  if (!dayText && !timeText) return '';
  if (dayText && timeText) return `${dayText} (${timeText})`;
  return dayText || timeText;
}

function buildSkillsFilterFromCategories(categories: JobCategoryKey[]) {
  if (!categories.length) return '';
  return categories
    .map((category) => {
      const skills = JOB_CATEGORY_FILTERS[category]?.skills || [];
      return Array.from(new Set(skills)).join(',');
    })
    .filter(Boolean)
    .join(';');
}

export default function SearchCaregiversPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hirerId = user?.id || '';
  const resumeAssignHandledRef = useRef(false);

  const [caregivers, setCaregivers] = useState<CaregiverResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [trustFilter, setTrustFilter] = useState('');
  const [jobCategoryFilters, setJobCategoryFilters] = useState<JobCategoryKey[]>([]);
  const [experienceFilter, setExperienceFilter] = useState('');
  const [availableDayFilter, setAvailableDayFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Assign modal
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedCaregiver, setSelectedCaregiver] = useState<CaregiverResult | null>(null);
  const [myJobs, setMyJobs] = useState<JobPost[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCaregiver, setDetailCaregiver] = useState<CaregiverResult | null>(null);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());

  const handleToggleFavorite = async (caregiverId: string) => {
    try {
      const res = await appApi.toggleFavorite(caregiverId);
      if (res.success && res.data) {
        const isFavorited = Boolean(res.data.favorited);
        setFavoritedIds((prev) => {
          const next = new Set(prev);
          if (isFavorited) {
            next.add(caregiverId);
          } else {
            next.delete(caregiverId);
          }
          return next;
        });
        toast.success(isFavorited ? 'เพิ่มในรายการโปรดแล้ว' : 'ลบออกจากรายการโปรดแล้ว');
      }
    } catch {
      toast.error('ไม่สามารถบันทึกรายการโปรดได้');
    }
  };

  const search = useCallback(async (
    p = 1,
    overrides?: {
      q?: string;
      trust_level?: string;
      job_categories?: JobCategoryKey[];
      min_experience_years?: string;
      available_day?: string;
    }
  ) => {
    const q = (overrides?.q ?? searchText).trim();
    const trustLevel = overrides?.trust_level ?? trustFilter;
    const selectedCategories = overrides?.job_categories ?? jobCategoryFilters;
    const skills = buildSkillsFilterFromCategories(selectedCategories);
    const minExperienceYears = overrides?.min_experience_years ?? experienceFilter;
    const availableDay = overrides?.available_day ?? availableDayFilter;

    setLoading(true);
    try {
      const res = await appApi.searchCaregivers({
        q,
        page: p,
        limit: 20,
        trust_level: trustLevel || undefined,
        skills: skills || undefined,
        min_experience_years: minExperienceYears ? Number(minExperienceYears) : undefined,
        available_day: availableDay ? Number(availableDay) : undefined,
      });
      if (res.success && res.data) {
        setCaregivers(res.data.data || []);
        setTotal(res.data.total || 0);
        setPage(p);
      } else {
        setCaregivers([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
    }
  }, [searchText, trustFilter, jobCategoryFilters, experienceFilter, availableDayFilter]);

  useEffect(() => {
    search(1);
  }, [trustFilter, jobCategoryFilters, experienceFilter, availableDayFilter]);

  useEffect(() => {
    let cancelled = false;

    const syncFavoriteState = async () => {
      if (caregivers.length === 0) {
        setFavoritedIds(new Set());
        return;
      }

      const checks = await Promise.allSettled(
        caregivers.map((cg) => appApi.checkFavorite(cg.id))
      );

      if (cancelled) return;

      const next = new Set<string>();
      checks.forEach((result, index) => {
        if (
          result.status === 'fulfilled' &&
          result.value.success &&
          result.value.data?.favorited
        ) {
          next.add(caregivers[index].id);
        }
      });

      setFavoritedIds(next);
    };

    syncFavoriteState();

    return () => {
      cancelled = true;
    };
  }, [caregivers]);

  const loadMyJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      // Load all jobs (draft + active) that can be assigned
      const res = await appApi.getMyJobs(hirerId);
      if (res.success && res.data) {
        const assignable = (res.data.data || []).filter(
          (j: JobPost) => !['cancelled', 'completed', 'expired'].includes(j.status || '')
        );
        setMyJobs(assignable);
      }
    } finally {
      setJobsLoading(false);
    }
  }, [hirerId]);

  useEffect(() => {
    const shouldResumeAssign = searchParams.get('resume_assign') === '1';
    const caregiverId = (searchParams.get('caregiver_id') || '').trim();

    if (!shouldResumeAssign || !caregiverId || resumeAssignHandledRef.current) {
      return;
    }

    resumeAssignHandledRef.current = true;

    const caregiverName = (searchParams.get('caregiver_name') || '').trim();
    const caregiverTrustLevel = (searchParams.get('caregiver_trust_level') || '').trim();
    const jobId = (searchParams.get('job_id') || '').trim();

    setSelectedCaregiver({
      id: caregiverId,
      trust_level: caregiverTrustLevel || 'L0',
      display_name: caregiverName || undefined,
    });
    setSelectedJobId(jobId);
    setAssignOpen(true);
    loadMyJobs();

    navigate('/hirer/search-caregivers', { replace: true });
  }, [loadMyJobs, navigate, searchParams]);

  const buildCreateJobPath = useCallback((caregiver?: CaregiverResult | null) => {
    const params = new URLSearchParams();
    if (caregiver?.id) {
      params.set('preferred_caregiver_id', caregiver.id);
    }
    if (caregiver?.display_name) {
      params.set('preferred_caregiver_name', caregiver.display_name);
    }
    if (caregiver?.trust_level) {
      params.set('preferred_caregiver_trust_level', caregiver.trust_level);
    }
    params.set('return_to_assign', '1');
    return `/hirer/create-job?${params.toString()}`;
  }, []);

  const handleOpenAssign = (cg: CaregiverResult) => {
    setSelectedCaregiver(cg);
    setSelectedJobId(CREATE_NEW_JOB_OPTION);
    setAssignOpen(true);
    loadMyJobs();
  };

  const handleOpenDetails = (cg: CaregiverResult) => {
    setDetailCaregiver(cg);
    setDetailOpen(true);
  };

  const handleAssignFromDetails = () => {
    if (!detailCaregiver) return;
    setDetailOpen(false);
    handleOpenAssign(detailCaregiver);
  };

  const handleOpenCreateJob = () => {
    if (!selectedCaregiver) return;
    setAssignOpen(false);
    navigate(buildCreateJobPath(selectedCaregiver));
  };

  const handleConfirmAssign = async () => {
    if (!selectedCaregiver) return;
    if (selectedJobId === CREATE_NEW_JOB_OPTION) {
      handleOpenCreateJob();
      return;
    }
    if (!selectedJobId) return;
    const selectedJob = myJobs.find((job) => job.id === selectedJobId);
    setAssigning(true);
    try {
      if (selectedJob?.status === 'draft') {
        const publishRes = await appApi.publishJob(selectedJob.id, hirerId);
        if (!publishRes.success) {
          const code = (publishRes as any).code as string | undefined;
          const errMsg = String(publishRes.error || '');

          if (code === 'INSUFFICIENT_BALANCE' || errMsg.includes('Insufficient')) {
            toast.error('เงินในระบบไม่พอ กรุณาเติมเงินก่อนส่งงานให้ผู้ดูแล');
            return;
          }
          if (
            code === 'HIRER_TRUST_RESTRICTION' ||
            code === 'POLICY_VIOLATION' ||
            code === 'INSUFFICIENT_TRUST_LEVEL' ||
            errMsg.includes('trust') ||
            errMsg.includes('Trust') ||
            errMsg.includes('policy')
          ) {
            toast.error('กรุณายืนยันตัวตนให้ครบตามระดับความเสี่ยงของงานก่อนส่งให้ผู้ดูแล');
            return;
          }
          toast.error(publishRes.error || 'ไม่สามารถเผยแพร่งานเพื่อส่งให้ผู้ดูแลได้');
          return;
        }
      }

      const res = await appApi.assignCaregiverToJob(selectedJobId, selectedCaregiver.id);
      if (res.success) {
        toast.success('ส่งงานให้ผู้ดูแลแล้ว รอการตอบรับ');
        setAssignOpen(false);
      } else {
        toast.error(res.error || 'ไม่สามารถมอบหมายได้');
      }
    } finally {
      setAssigning(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">ค้นหาผู้ดูแล</h1>
          <p className="text-sm text-gray-600">ค้นหาและเลือกผู้ดูแลที่เหมาะสม แล้วมอบหมายงานได้เลย</p>
        </div>
        <div className="mb-4">
          <Button variant="outline" size="sm" onClick={() => navigate('/hirer/favorites')}>
            <Heart className="w-4 h-4 mr-1 inline" />ผู้ดูแลที่ชื่นชอบ
          </Button>
        </div>

        {/* Search bar */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search(1)}
              placeholder="ค้นหาชื่อ, อีเมล, เบอร์โทร..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <Button variant="primary" onClick={() => search(1)}>ค้นหา</Button>
        </div>

        {/* Filters */}
        <div className="mb-4 space-y-2">
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <select
              className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-sm"
              value={trustFilter}
              onChange={(e) => setTrustFilter(e.target.value)}
            >
              <option value="">ทุกระดับความเชื่อถือ</option>
              <option value="L3">L3 เชื่อถือสูง</option>
              <option value="L2">L2 ยืนยันแล้ว</option>
              <option value="L1">L1 พื้นฐาน</option>
            </select>
            <select
              className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-sm"
              value={experienceFilter}
              onChange={(e) => setExperienceFilter(e.target.value)}
            >
              <option value="">ประสบการณ์ทุกระดับ</option>
              <option value="1">อย่างน้อย 1 ปี</option>
              <option value="3">อย่างน้อย 3 ปี</option>
              <option value="5">อย่างน้อย 5 ปี</option>
              <option value="8">อย่างน้อย 8 ปี</option>
            </select>
            <select
              className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-sm"
              value={availableDayFilter}
              onChange={(e) => setAvailableDayFilter(e.target.value)}
            >
              <option value="">ทุกวันที่พร้อมรับงาน</option>
              {Object.entries(DAY_FULL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <div className="flex items-center justify-end gap-2">
              {(trustFilter || jobCategoryFilters.length > 0 || experienceFilter || availableDayFilter || searchText) && (
                <button
                  onClick={() => {
                    setTrustFilter('');
                    setJobCategoryFilters([]);
                    setExperienceFilter('');
                    setAvailableDayFilter('');
                    setSearchText('');
                    search(1, {
                      q: '',
                      trust_level: '',
                      job_categories: [],
                      min_experience_years: '',
                      available_day: '',
                    });
                  }}
                  className="text-xs text-blue-600 hover:underline px-2"
                >
                  ล้างตัวกรอง
                </button>
              )}
              <span className="text-sm text-gray-500">พบ {total} คน</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">ประเภทงาน:</span>
            {JOB_CATEGORY_ORDER.map((category) => {
              const isSelected = jobCategoryFilters.includes(category);
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => {
                    setJobCategoryFilters((prev) => (
                      prev.includes(category)
                        ? prev.filter((value) => value !== category)
                        : [...prev, category]
                    ));
                  }}
                  className={`px-3 py-1.5 rounded-full border text-xs transition ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400'
                  }`}
                >
                  {JOB_CATEGORY_FILTERS[category].label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <LoadingState message="กำลังค้นหา..." />
        ) : caregivers.length === 0 ? (
          <Card className="text-center py-12">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">ไม่พบผู้ดูแลที่ตรงกับเงื่อนไข</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {caregivers.map((cg) => {
              const tl = TRUST_STYLE[cg.trust_level] || TRUST_STYLE.L0;
              const tags = Array.from(
                new Set([...(cg.specializations || []), ...(cg.certifications || []), ...(cg.skills || [])])
              );
              const availability = formatAvailability(cg.available_days, cg.available_from, cg.available_to);
              return (
                <Card key={cg.id} className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{cg.display_name || 'ผู้ดูแล'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${tl.bg} ${tl.text}`}>{tl.label}</span>
                    </div>

                    {cg.bio && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{cg.bio}</p>
                    )}

                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                      {cg.experience_years != null && (
                        <span className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5" />ประสบการณ์ {cg.experience_years} ปี
                        </span>
                      )}
                      {(cg.completed_jobs_count ?? 0) > 0 && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3.5 h-3.5" />ทำงานแล้ว {cg.completed_jobs_count} งาน
                        </span>
                      )}
                      {availability && (
                        <span className="flex items-center gap-1">
                          <Clock3 className="w-3.5 h-3.5" />ว่าง: {availability}
                        </span>
                      )}
                    </div>

                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {tags.slice(0, 5).map((s) => (
                          <span key={s} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                            {SKILL_LABELS[s] || s}
                          </span>
                        ))}
                        {tags.length > 5 && (
                          <span className="text-xs text-gray-400">+{tags.length - 5}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 flex-shrink-0 items-center">
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(cg.id)}
                      className="p-2 rounded-full hover:bg-red-50 transition-colors"
                      title={favoritedIds.has(cg.id) ? 'ลบออกจากรายการโปรด' : 'เพิ่มในรายการโปรด'}
                    >
                      <Heart className={`w-5 h-5 ${favoritedIds.has(cg.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                    </button>
                    <Button variant="outline" size="sm" onClick={() => handleOpenDetails(cg)}>
                      ดูรายละเอียด
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => handleOpenAssign(cg)}>
                      มอบหมายงาน
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => search(page - 1)}>ก่อนหน้า</Button>
            <span className="text-sm text-gray-600 flex items-center">หน้า {page}/{totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => search(page + 1)}>ถัดไป</Button>
          </div>
        )}

        <Modal
          isOpen={detailOpen}
          onClose={() => setDetailOpen(false)}
          title={`รายละเอียดผู้ดูแล${detailCaregiver?.display_name ? `: ${detailCaregiver.display_name}` : ''}`}
          size="md"
          footer={
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDetailOpen(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ปิด
              </button>
              <Button variant="primary" size="sm" onClick={handleAssignFromDetails} disabled={!detailCaregiver}>
                มอบหมายงาน
              </Button>
            </div>
          }
        >
          {detailCaregiver && (() => {
            const tl = TRUST_STYLE[detailCaregiver.trust_level] || TRUST_STYLE.L0;
            const availability = formatAvailability(
              detailCaregiver.available_days,
              detailCaregiver.available_from,
              detailCaregiver.available_to
            );
            const tags = Array.from(
              new Set([
                ...(detailCaregiver.specializations || []),
                ...(detailCaregiver.certifications || []),
                ...(detailCaregiver.skills || []),
              ])
            );

            return (
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-semibold text-gray-900">{detailCaregiver.display_name || 'ผู้ดูแล'}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${tl.bg} ${tl.text}`}>{tl.label}</span>
                </div>

                {detailCaregiver.bio && (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{detailCaregiver.bio}</p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                  {detailCaregiver.experience_years != null && (
                    <div>ประสบการณ์: {detailCaregiver.experience_years} ปี</div>
                  )}
                  {(detailCaregiver.completed_jobs_count ?? 0) > 0 && (
                    <div>จำนวนงานที่ทำแล้ว: {detailCaregiver.completed_jobs_count} งาน</div>
                  )}
                  {availability && <div>ช่วงเวลาที่ว่าง: {availability}</div>}
                  {detailCaregiver.email && <div>อีเมล: {detailCaregiver.email}</div>}
                  {detailCaregiver.phone_number && <div>เบอร์โทร: {detailCaregiver.phone_number}</div>}
                </div>

                {tags.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-900 mb-2">ทักษะและความเชี่ยวชาญ</div>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <span key={tag} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                          {SKILL_LABELS[tag] || tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </Modal>

        {/* Assign Modal */}
        <Modal
          isOpen={assignOpen}
          onClose={() => setAssignOpen(false)}
          title={`มอบหมายงานให้ ${selectedCaregiver?.display_name || 'ผู้ดูแล'}`}
          size="sm"
          footer={
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setAssignOpen(false)}
                disabled={assigning}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmAssign}
                disabled={assigning || !selectedJobId}
                className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {selectedJobId === CREATE_NEW_JOB_OPTION
                  ? 'ไปสร้างงานใหม่'
                  : assigning
                    ? 'กำลังมอบหมาย...'
                    : 'ยืนยันมอบหมาย'}
              </button>
            </div>
          }
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-600">เลือกงานที่ต้องการมอบหมายให้ผู้ดูแลคนนี้</p>
            {jobsLoading ? (
              <div className="text-center py-4 text-sm text-gray-500">กำลังโหลดรายการงาน...</div>
            ) : myJobs.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-2">ยังไม่มีงานที่สามารถมอบหมายได้</p>
                <Button variant="primary" size="sm" onClick={handleOpenCreateJob}>
                  สร้างงานใหม่ทันที
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                <label
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedJobId === CREATE_NEW_JOB_OPTION ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="assign-job"
                    value={CREATE_NEW_JOB_OPTION}
                    checked={selectedJobId === CREATE_NEW_JOB_OPTION}
                    onChange={() => setSelectedJobId(CREATE_NEW_JOB_OPTION)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900">สร้างงานใหม่</div>
                    <p className="text-xs text-gray-500 mt-0.5">ไปหน้าสร้างงานโพสต์ แล้วกลับมาเลือกมอบหมายผู้ดูแลคนนี้อัตโนมัติ</p>
                  </div>
                </label>
                {myJobs.map((job) => (
                  <label
                    key={job.id}
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedJobId === job.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="assign-job"
                      value={job.id}
                      checked={selectedJobId === job.id}
                      onChange={() => setSelectedJobId(job.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900 truncate">{job.title || 'งานไม่มีชื่อ'}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          job.status === 'draft' ? 'bg-gray-100 text-gray-600' :
                          job.status === 'posted' ? 'bg-green-100 text-green-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {job.status === 'draft' ? 'แบบร่าง' : job.status === 'posted' ? 'เผยแพร่แล้ว' : job.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {job.total_amount ? `฿${job.total_amount.toLocaleString()}` : ''} 
                        {job.scheduled_start_at ? ` · ${new Date(job.scheduled_start_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}` : ''}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </Modal>
      </div>
    </MainLayout>
  );
}
