import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MainLayout } from '../../layouts';
import { Button, Card, LoadingState } from '../../components/ui';
import { JobPost, Transaction } from '../../services/api';
import { appApi } from '../../services/appApi';
import { useAuth } from '../../contexts';

function formatDateTimeRange(startIso?: string | null, endIso?: string | null) {
  if (!startIso || !endIso) return '-';
  const start = new Date(startIso);
  const end = new Date(endIso);
  const date = start.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStart = start.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  const timeEnd = end.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${timeStart} - ${timeEnd}`;
}

async function findRelatedTransactions(
  loader: (page: number, limit: number) => Promise<{ items: Transaction[]; totalPages: number }>,
  referenceId: string
) {
  const limit = 50;
  const maxPages = 5;
  const matches: Transaction[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const res = await loader(page, limit);
    const found = res.items.filter((t) => t.reference_id === referenceId);
    matches.push(...found);
    if (matches.length > 0) break;
    if (page >= res.totalPages) break;
  }

  return matches;
}

export default function JobEarningDetailPage() {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { user } = useAuth();
  const userId = user?.id || 'demo-caregiver';

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<JobPost | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);

  const load = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const jobRes = await appApi.getJobById(jobId);
      if (!jobRes.success || !jobRes.data?.job) {
        setJob(null);
        setTxs([]);
        return;
      }

      const jobData = jobRes.data.job;
      setJob(jobData);
      const actualJobId = jobData.job_id || jobId;

      const related = await findRelatedTransactions(
        async (page, limit) => {
          return appApi.getWalletTransactionsPage(userId, 'caregiver', page, limit);
        },
        actualJobId
      );
      setTxs(related);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'โหลดรายละเอียดรายได้ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [jobId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const location = useMemo(() => {
    return [job?.address_line1, job?.district, job?.province].filter(Boolean).join(', ') || '-';
  }, [job]);

  const patientName = job?.patient_display_name || '-';

  const paid = useMemo(() => {
    const jobIdRef = job?.job_id || jobId || '';
    const relevant = txs.filter((t) => t.reference_type === 'job' && t.reference_id === jobIdRef);
    return relevant.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [job?.job_id, jobId, txs]);

  return (
    <MainLayout showBottomBar={false}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3 mb-6">
          <Button variant="outline" onClick={() => navigate('/caregiver/wallet/history')}>
            ย้อนกลับ
          </Button>
          <Button variant="outline" onClick={load}>
            รีเฟรช
          </Button>
        </div>

        {loading ? (
          <LoadingState message="กำลังโหลด..." />
        ) : !job ? (
          <Card className="p-6">
            <div className="text-sm text-gray-700">ไม่พบข้อมูลงาน</div>
            <div className="mt-4">
              <Link to="/caregiver/wallet/history">
                <Button variant="primary">กลับไปประวัติ</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card className="p-6">
              <div className="text-sm text-gray-500">รายละเอียดรายได้จากงาน</div>
              <div className="text-xl font-bold text-gray-900 mt-1">{job.title}</div>
              <div className="text-xs text-gray-600 mt-2">{formatDateTimeRange(job.scheduled_start_at, job.scheduled_end_at)}</div>
              <div className="text-xs text-gray-600 mt-1">{location}</div>
              <div className="text-xs text-gray-600 mt-1">ผู้รับการดูแล: {patientName}</div>
              <div className="text-[11px] text-gray-500 mt-3 font-mono break-all">job: {job.job_id || jobId}</div>
              <div className="text-[11px] text-gray-500 mt-1 font-mono break-all">job_post: {job.id}</div>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">สรุปรายได้</h2>
              <div className="flex items-center justify-between text-sm">
                <div className="text-gray-700">ยอดที่ได้รับจากงานนี้</div>
                <div className="text-gray-900 font-bold">{paid.toLocaleString()} บาท</div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">ธุรกรรมที่เกี่ยวข้อง</h2>
              {txs.length === 0 ? (
                <div className="text-sm text-gray-600">ยังไม่พบธุรกรรมที่เกี่ยวข้อง</div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {txs.map((t) => (
                    <div key={t.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900">
                          {t.type.toUpperCase()} • {t.reference_type}
                        </div>
                        <div className="text-xs text-gray-500">{new Date(t.created_at).toLocaleString('th-TH')}</div>
                        {t.description && <div className="text-xs text-gray-600 mt-1">{t.description}</div>}
                        <div className="text-[11px] text-gray-500 mt-1 font-mono break-all">{t.id}</div>
                      </div>
                      <div className="text-sm font-semibold text-gray-900">{t.amount.toLocaleString()} บาท</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

