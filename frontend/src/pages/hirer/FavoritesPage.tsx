import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Heart, Star, Briefcase } from 'lucide-react';
import { MainLayout } from '../../layouts';
import { Button, Card, LoadingState, Modal } from '../../components/ui';
import { JobPost } from '../../services/api';
import { appApi } from '../../services/appApi';
import { useAuth } from '../../contexts';

interface FavoriteCaregiver {
  id: string;
  caregiver_id: string;
  user_id: string;
  email?: string;
  trust_level?: string;
  trust_score?: number;
  completed_jobs_count?: number;
  display_name?: string;
  bio?: string;
  certifications?: string[];
  specializations?: string[];
  experience_years?: number;
  avg_rating?: number;
  total_reviews?: number;
  created_at: string;
}

const TRUST_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  L3: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'L3 เชื่อถือสูง' },
  L2: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'L2 ยืนยันแล้ว' },
  L1: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'L1 พื้นฐาน' },
  L0: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'L0 ยังไม่ยืนยัน' },
};

const CREATE_NEW_JOB_OPTION = '__create_new_job__';

export default function FavoritesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const hirerId = user?.id || '';
  const [favorites, setFavorites] = useState<FavoriteCaregiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedCaregiver, setSelectedCaregiver] = useState<FavoriteCaregiver | null>(null);
  const [myJobs, setMyJobs] = useState<JobPost[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(false);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await appApi.getFavorites(p, 20);
      if (res.success && res.data) {
        setFavorites(res.data.data || []);
        setTotalPages(res.data.totalPages || 1);
        setPage(p);
      } else {
        setFavorites([]);
      }
    } catch {
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(1);
  }, [load]);

  const loadMyJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
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

  const handleRemoveFavorite = async (caregiverId: string) => {
    try {
      const res = await appApi.toggleFavorite(caregiverId);
      if (res.success) {
        toast.success('ลบออกจากรายการโปรดแล้ว');
        setFavorites((prev) => prev.filter((f) => f.caregiver_id !== caregiverId));
      }
    } catch {
      toast.error('ไม่สามารถลบรายการโปรดได้');
    }
  };

  const buildCreateJobPath = useCallback((caregiver?: FavoriteCaregiver | null) => {
    const params = new URLSearchParams();
    if (caregiver?.caregiver_id) {
      params.set('preferred_caregiver_id', caregiver.caregiver_id);
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

  const handleOpenAssign = (caregiver: FavoriteCaregiver) => {
    setSelectedCaregiver(caregiver);
    setSelectedJobId(CREATE_NEW_JOB_OPTION);
    setAssignOpen(true);
    loadMyJobs();
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

      const res = await appApi.assignCaregiverToJob(selectedJobId, selectedCaregiver.caregiver_id);
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

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-3.5 h-3.5 ${i < Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
      />
    ));
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ผู้ดูแลที่ชื่นชอบ</h1>
            <p className="text-sm text-gray-600">รายการผู้ดูแลที่คุณบันทึกไว้</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/hirer/search-caregivers')}>
            ค้นหาผู้ดูแล
          </Button>
        </div>

        {loading ? (
          <LoadingState message="กำลังโหลด..." />
        ) : favorites.length === 0 ? (
          <Card className="text-center py-12">
            <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" aria-hidden="true" />
            <p className="text-gray-500">ยังไม่มีผู้ดูแลในรายการโปรด</p>
            <p className="text-sm text-gray-500 mt-1">กดหัวใจที่หน้าค้นหาผู้ดูแลเพื่อเพิ่ม</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {favorites.map((fav) => {
              const tl = TRUST_STYLE[fav.trust_level || 'L0'] || TRUST_STYLE.L0;
              const tags = Array.from(new Set([...(fav.specializations || []), ...(fav.certifications || [])]));
              return (
                <Card key={fav.id} className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{fav.display_name || 'ผู้ดูแล'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${tl.bg} ${tl.text}`}>{tl.label}</span>
                    </div>

                    {fav.bio && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{fav.bio}</p>
                    )}

                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                      {(fav.total_reviews ?? 0) > 0 && (
                        <span className="flex items-center gap-1">
                          {renderStars(fav.avg_rating || 0)}
                          <span className="ml-1">{Number(fav.avg_rating || 0).toFixed(1)} ({fav.total_reviews} รีวิว)</span>
                        </span>
                      )}
                      {fav.experience_years != null && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3.5 h-3.5" />ประสบการณ์ {fav.experience_years} ปี
                        </span>
                      )}
                      {(fav.completed_jobs_count ?? 0) > 0 && (
                        <span className="flex items-center gap-1">
                          ทำงานแล้ว {fav.completed_jobs_count} งาน
                        </span>
                      )}
                    </div>

                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {tags.slice(0, 5).map((s) => (
                          <span key={s} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 flex-shrink-0 items-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveFavorite(fav.caregiver_id)}
                      aria-label="ลบออกจากรายการโปรด"
                      className="p-2 rounded-full hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
                    >
                      <Heart className="w-5 h-5 fill-red-500 text-red-500" aria-hidden="true" />
                    </button>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/hirer/caregiver/${fav.user_id}`)}>
                      ดูโปรไฟล์
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleOpenAssign(fav)}
                    >
                      มอบหมายงาน
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => load(page - 1)}>ก่อนหน้า</Button>
            <span className="text-sm text-gray-600 flex items-center">หน้า {page}/{totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => load(page + 1)}>ถัดไป</Button>
          </div>
        )}

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
