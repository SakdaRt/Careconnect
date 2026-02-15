import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Search, Star, Briefcase, Clock3 } from 'lucide-react';
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

export default function SearchCaregiversPage() {
  const { user } = useAuth();
  const hirerId = user?.id || '';

  const [caregivers, setCaregivers] = useState<CaregiverResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [trustFilter, setTrustFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Assign modal
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedCaregiver, setSelectedCaregiver] = useState<CaregiverResult | null>(null);
  const [myJobs, setMyJobs] = useState<JobPost[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(false);

  const search = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await appApi.searchCaregivers({
        q: searchText.trim(),
        page: p,
        limit: 20,
        trust_level: trustFilter || undefined,
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
  }, [searchText, trustFilter]);

  useEffect(() => {
    search(1);
  }, [trustFilter]);

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

  const handleOpenAssign = (cg: CaregiverResult) => {
    setSelectedCaregiver(cg);
    setSelectedJobId('');
    setAssignOpen(true);
    loadMyJobs();
  };

  const handleConfirmAssign = async () => {
    if (!selectedJobId || !selectedCaregiver) return;
    setAssigning(true);
    try {
      const res = await appApi.assignCaregiverToJob(selectedJobId, selectedCaregiver.id);
      if (res.success) {
        toast.success('มอบหมายผู้ดูแลสำเร็จ');
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
        <div className="flex flex-wrap gap-2 mb-4">
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
          {(trustFilter || searchText) && (
            <button
              onClick={() => { setTrustFilter(''); setSearchText(''); setTimeout(() => search(1), 0); }}
              className="text-xs text-blue-600 hover:underline px-2"
            >
              ล้างตัวกรอง
            </button>
          )}
          <span className="text-sm text-gray-500 ml-auto">พบ {total} คน</span>
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

                  <div className="flex gap-2 flex-shrink-0">
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
                {assigning ? 'กำลังมอบหมาย...' : 'ยืนยันมอบหมาย'}
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
                <Link to="/hirer/create-job">
                  <Button variant="primary" size="sm">สร้างงานใหม่</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
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
