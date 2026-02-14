import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MainLayout } from '../../layouts';
import { Button, Card, LoadingState, StatusBadge } from '../../components/ui';
import { JobPost } from '../../services/api';
import { useAuth } from '../../contexts';
import { appApi } from '../../services/appApi';

function formatDateTimeRange(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const date = start.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStart = start.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  const timeEnd = end.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${timeStart} - ${timeEnd}`;
}

export default function JobPreviewPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const caregiverId = user?.id || 'demo-caregiver';

  const [job, setJob] = useState<JobPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await appApi.getJobById(id);
      if (res.success && res.data?.job) {
        setJob(res.data.job);
        return;
      }
      setJob(null);
      toast.error(res.error || 'โหลดรายละเอียดงานไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const location = useMemo(() => {
    if (!job) return '';
    return [job.address_line1, job.district, job.province].filter(Boolean).join(', ');
  }, [job]);

  const handleAccept = async () => {
    if (!job) return;
    setAccepting(true);
    try {
      const res = await appApi.acceptJob(job.id, caregiverId);
      if (res.success && res.data?.job_id) {
        toast.success('รับงานแล้ว');
        navigate(`/chat/${res.data.job_id}`);
        return;
      }
      toast.error(res.error || 'รับงานไม่สำเร็จ');
    } finally {
      setAccepting(false);
    }
  };

  return (
    <MainLayout showBottomBar={false}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3 mb-6">
          <Button variant="outline" onClick={() => navigate(-1)}>
            ย้อนกลับ
          </Button>
          <Button variant="ghost" onClick={load}>
            รีเฟรช
          </Button>
        </div>

        {loading ? (
          <LoadingState message="กำลังโหลดรายละเอียดงาน..." />
        ) : !job ? (
          <Card className="p-6">
            <p className="text-gray-700">ไม่พบงานนี้</p>
          </Card>
        ) : (
          <Card className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
                <div className="mt-2">
                  <StatusBadge status={job.status as any} />
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-blue-600">{job.total_amount.toLocaleString()} บาท</div>
                <div className="text-xs text-gray-500">
                  {job.hourly_rate.toLocaleString()} บาท/ชม. × {job.total_hours} ชม.
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm text-gray-700">
              <div>
                <span className="font-semibold">เวลา:</span> {formatDateTimeRange(job.scheduled_start_at, job.scheduled_end_at)}
              </div>
              <div>
                <span className="font-semibold">สถานที่:</span> {location || '-'}
              </div>
              <div>
                <span className="font-semibold">ประเภทงาน:</span> {job.job_type}
              </div>
              <div>
                <span className="font-semibold">ความเสี่ยง:</span> {job.risk_level}
              </div>
              <div>
                <span className="font-semibold">รายละเอียด:</span>
                <div className="mt-1 whitespace-pre-wrap text-gray-800">{job.description}</div>
              </div>
            </div>

            <div className="mt-6">
              <Button
                variant="primary"
                fullWidth
                loading={accepting}
                disabled={job.status !== 'posted'}
                onClick={handleAccept}
              >
                รับงานนี้
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                หากปุ่มกดไม่ได้ แสดงว่างานไม่อยู่ในสถานะเปิดรับแล้ว
              </p>
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}

