import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { MainLayout } from '../../layouts';
import { Button, Card, LoadingState, StatusBadge } from '../../components/ui';
import { JobPost } from '../../services/api';
import { appApi } from '../../services/appApi';
import { useAuth } from '../../contexts';

function formatDate(startIso: string) {
  const d = new Date(startIso);
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CaregiverJobFeedPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<(JobPost & { eligible?: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const isL0 = user?.trust_level === 'L0';

  const load = async () => {
    setLoading(true);
    try {
      const res = await appApi.getJobFeed({ page: 1, limit: 20 });
      if (res.success && res.data) {
        setJobs(res.data.data || []);
        return;
      }
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const items = useMemo(() => jobs, [jobs]);

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ค้นหางาน</h1>
            <p className="text-sm text-gray-600">งานที่เปิดรับสมัครอยู่</p>
          </div>
          <Button variant="outline" onClick={load}>
            รีเฟรช
          </Button>
        </div>

        {isL0 && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
            <Shield className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-900">
              <p className="font-semibold mb-1">ยืนยันตัวตนเพื่อรับงาน</p>
              <p>คุณยังไม่ได้ยืนยันเบอร์โทรศัพท์ กรุณายืนยัน OTP เพื่อเลื่อนเป็น Trust Level L1 แล้วจึงจะสามารถรับงานได้</p>
            </div>
          </div>
        )}

        {loading ? (
          <LoadingState message="กำลังโหลดงาน..." />
        ) : items.length === 0 ? (
          <Card className="p-6">
            <p className="text-gray-700">ยังไม่มีงานในขณะนี้</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((job) => {
              const location = [job.address_line1, job.district, job.province].filter(Boolean).join(', ');
              return (
                <Card key={job.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-gray-900 text-lg line-clamp-1">{job.title}</h3>
                        <StatusBadge status={job.status as any} />
                      </div>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{job.description}</p>
                      <div className="mt-3 text-sm text-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>วันที่: {formatDate(job.scheduled_start_at)}</div>
                        <div>สถานที่: {location || '-'}</div>
                        <div>ค่าจ้างรวม: {job.total_amount.toLocaleString()} บาท</div>
                        <div>ประเภท: {job.job_type}</div>
                      </div>
                      {job.eligible === false && (
                        <div className="mt-2 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded px-2 py-1 inline-block">
                          ต้อง Trust Level {job.min_trust_level} ขึ้นไปจึงจะรับงานนี้ได้
                        </div>
                      )}
                      <div className="mt-4">
                        <Link to={`/caregiver/jobs/${job.id}/preview`}>
                          <Button variant={job.eligible === false ? 'outline' : 'primary'} size="sm">
                            {job.eligible === false ? 'ดูรายละเอียด' : 'ดูรายละเอียด / รับงาน'}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

