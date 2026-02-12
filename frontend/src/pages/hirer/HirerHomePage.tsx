import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MainLayout } from '../../layouts';
import { Button, Card, LoadingState, Modal, StatusBadge } from '../../components/ui';
import { JobPost } from '../../services/api';
import { appApi } from '../../services/appApi';
import { useAuth } from '../../contexts';

type JobStatusFilter =
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'expired';

function formatDateTimeRange(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const date = start.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStart = start.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  const timeEnd = end.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${timeStart} - ${timeEnd}`;
}

function JobPostCard({
  job,
  onPublish,
  onOpenDispute,
  onCancel,
}: {
  job: JobPost;
  onPublish: () => void;
  onOpenDispute: () => void;
  onCancel: () => void;
}) {
  const location = useMemo(() => {
    const parts = [job.address_line1, job.district, job.province].filter(Boolean);
    return parts.join(', ');
  }, [job.address_line1, job.district, job.province]);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900 text-lg line-clamp-1">{job.title}</h3>
            <StatusBadge status={job.status as any} />
          </div>

          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{job.description}</p>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
            <div>เวลา: {formatDateTimeRange(job.scheduled_start_at, job.scheduled_end_at)}</div>
            <div>สถานที่: {location || '-'}</div>
            <div>ประเภทงาน: {job.job_type}</div>
            <div>
              ราคา: {job.total_amount.toLocaleString()} บาท ({job.hourly_rate.toLocaleString()} บาท/ชม. ×{' '}
              {job.total_hours} ชม.)
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link to={`/jobs/${job.id}`}>
              <Button variant="outline" size="sm">
                ดูรายละเอียด
              </Button>
            </Link>

            {job.status === 'draft' && (
              <Button variant="primary" size="sm" onClick={onPublish}>
                เผยแพร่
              </Button>
            )}

            {job.status !== 'draft' && (
              <Button variant="outline" size="sm" onClick={onOpenDispute}>
                เปิดข้อพิพาท
              </Button>
            )}

            {job.status !== 'cancelled' && job.status !== 'completed' && (
              <Button variant="danger" size="sm" onClick={onCancel}>
                ยกเลิกงาน
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function HirerHomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<JobStatusFilter>('active');
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeJobId, setDisputeJobId] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelJobId, setCancelJobId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const hirerId = user?.id || 'demo-hirer';

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await appApi.getMyJobs(hirerId, status === 'active' ? undefined : status);
      if (res.success && res.data) {
        const items = res.data.data || [];
        if (status === 'active') {
          const activeStatuses = new Set(['draft', 'posted', 'assigned', 'in_progress']);
          setJobs(items.filter((job) => activeStatuses.has(job.status)));
          return;
        }
        setJobs(items);
        return;
      }
      setJobs([]);
      toast.error(res.error || 'โหลดรายการงานไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [hirerId, status]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const handlePublish = async (jobPostId: string) => {
    const res = await appApi.publishJob(jobPostId, hirerId);
    if (res.success) {
      toast.success(appApi.isDemoToken() ? 'เผยแพร่งานแล้ว (เดโม)' : 'เผยแพร่งานแล้ว');
      await loadJobs();
      return;
    }
    const code = (res as any).code as string | undefined;
    if (code === 'INSUFFICIENT_BALANCE' || String(res.error || '').includes('Insufficient')) {
      toast.error('เงินในระบบไม่พอ กรุณาเติมเงินก่อนเผยแพร่');
      return;
    }
    toast.error(res.error || 'ไม่สามารถเผยแพร่งานได้');
  };

  const handleOpenDispute = async (jobPostId: string) => {
    setActionLoadingId(jobPostId);
    const existingRes = await appApi.getDisputeByJob(jobPostId);
    if (existingRes.success && existingRes.data?.dispute?.id) {
      setActionLoadingId(null);
      navigate(`/dispute/${existingRes.data.dispute.id}`);
      return;
    }
    setActionLoadingId(null);
    setDisputeReason('');
    setDisputeJobId(jobPostId);
    setDisputeOpen(true);
  };

  const handleOpenCancel = (jobPostId: string) => {
    setCancelReason('');
    setCancelJobId(jobPostId);
    setCancelOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancelJobId) return;
    const reason = cancelReason.trim();
    if (!reason) {
      toast.error('กรุณากรอกเหตุผลที่ยกเลิกงาน');
      return;
    }
    setActionLoadingId(cancelJobId);
    try {
      const res = await appApi.cancelJob(cancelJobId, hirerId, reason);
      if (!res.success) {
        toast.error(res.error || 'ยกเลิกงานไม่สำเร็จ');
        return;
      }
      toast.success('ยกเลิกงานแล้ว');
      setCancelOpen(false);
      setCancelReason('');
      setCancelJobId(null);
      await loadJobs();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmDispute = async () => {
    if (!disputeJobId) return;
    const reason = disputeReason.trim();
    if (!reason) {
      toast.error('กรุณากรอกเหตุผลที่เปิดข้อพิพาท');
      return;
    }
    setActionLoadingId(disputeJobId);
    try {
      const res = await appApi.createDispute(disputeJobId, hirerId, reason);
      if (!res.success || !res.data?.dispute?.id) {
        toast.error(res.error || (appApi.isDemoToken() ? 'เปิดข้อพิพาทไม่สำเร็จ (เดโม)' : 'เปิดข้อพิพาทไม่สำเร็จ'));
        return;
      }
      toast.success(appApi.isDemoToken() ? 'เปิดข้อพิพาทแล้ว (เดโม)' : 'เปิดข้อพิพาทแล้ว');
      setDisputeOpen(false);
      setDisputeReason('');
      setDisputeJobId(null);
      navigate(`/dispute/${res.data.dispute.id}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const filters: { key: JobStatusFilter; label: string }[] = [
    { key: 'active', label: 'งานที่ใช้งานอยู่' },
    { key: 'completed', label: 'เสร็จสิ้น' },
    { key: 'cancelled', label: 'ยกเลิก' },
  ];

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">งานของฉัน</h1>
            <p className="text-sm text-gray-600">สร้างงานเป็นแบบร่าง แล้วค่อยกดเผยแพร่</p>
          </div>
          <Link to="/hirer/create-job">
            <Button variant="primary">สร้างงานใหม่</Button>
          </Link>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {filters.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={status === f.key ? 'primary' : 'outline'}
              onClick={() => setStatus(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {loading ? (
          <LoadingState message="กำลังโหลดรายการงาน..." />
        ) : jobs.length === 0 ? (
          <Card className="p-6">
            <p className="text-gray-700">ยังไม่มีงานในสถานะนี้</p>
            <div className="mt-4">
              <Link to="/hirer/create-job">
                <Button variant="primary">สร้างงานแรก</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <JobPostCard
                key={job.id}
                job={job}
                onPublish={() => handlePublish(job.id)}
                onOpenDispute={() => handleOpenDispute(job.id)}
                onCancel={() => handleOpenCancel(job.id)}
              />
            ))}
          </div>
        )}
        <Modal
          isOpen={disputeOpen}
          onClose={() => setDisputeOpen(false)}
          title="เปิดข้อพิพาท"
          size="sm"
          footer={
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDisputeOpen(false)}
                disabled={!!actionLoadingId}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                กลับไป
              </button>
              <button
                onClick={handleConfirmDispute}
                disabled={!!actionLoadingId || !disputeReason.trim()}
                className="px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 bg-blue-600 hover:bg-blue-700"
              >
                {actionLoadingId ? 'กำลังส่ง...' : 'ยืนยันเปิดข้อพิพาท'}
              </button>
            </div>
          }
        >
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-gray-700">เหตุผลที่เปิดข้อพิพาท</label>
            <textarea
              className="w-full px-4 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300 hover:border-gray-400 min-h-28"
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="อธิบายเหตุผลในการเปิดข้อพิพาท"
            />
          </div>
        </Modal>
        <Modal
          isOpen={cancelOpen}
          onClose={() => setCancelOpen(false)}
          title="ยกเลิกงาน"
          size="sm"
          footer={
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setCancelOpen(false)}
                disabled={!!actionLoadingId}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                กลับไป
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={!!actionLoadingId || !cancelReason.trim()}
                className="px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 bg-red-600 hover:bg-red-700"
              >
                {actionLoadingId ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิก'}
              </button>
            </div>
          }
        >
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-gray-700">เหตุผลที่ยกเลิกงาน</label>
            <textarea
              className="w-full px-4 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent border-gray-300 hover:border-gray-400 min-h-28"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="อธิบายเหตุผลในการยกเลิกงาน"
            />
          </div>
        </Modal>
      </div>
    </MainLayout>
  );
}

