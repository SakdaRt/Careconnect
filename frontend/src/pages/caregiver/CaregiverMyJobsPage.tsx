import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MainLayout } from '../../layouts';
import { Button, Card, LoadingState, Modal, StatusBadge } from '../../components/ui';
import { CaregiverAssignedJob } from '../../services/api';
import { useAuth } from '../../contexts';
import { appApi } from '../../services/appApi';

type Filter = 'assigned' | 'in_progress' | 'completed' | 'cancelled';

function formatDateTimeRange(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const date = start.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStart = start.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  const timeEnd = end.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${timeStart} - ${timeEnd}`;
}

const toRadians = (value: number) => (value * Math.PI) / 180;

const getDistanceMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return earthRadius * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const formatDistance = (distance: number) => {
  if (distance < 1000) return `${Math.round(distance)} ม.`;
  return `${(distance / 1000).toFixed(2)} กม.`;
};

function getCurrentGps(): Promise<{ lat: number; lng: number; accuracy_m?: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('อุปกรณ์นี้ไม่รองรับการขอตำแหน่ง'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy_m: pos.coords.accuracy,
        }),
      (err) => reject(new Error(err.message || 'ไม่สามารถอ่านตำแหน่งได้')),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

export default function CaregiverMyJobsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const caregiverId = user?.id || 'demo-caregiver';

  const [filter, setFilter] = useState<Filter>('assigned');
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<CaregiverAssignedJob[]>([]);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeJobId, setDisputeJobId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await appApi.getAssignedJobs(caregiverId, filter, 1, 20);
      if (res.success && res.data) {
        setJobs(res.data.data || []);
        return;
      }
      setJobs([]);
      toast.error(res.error || 'โหลดงานไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [caregiverId, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const items = useMemo(() => jobs, [jobs]);

  const handleCheckIn = async (job: CaregiverAssignedJob) => {
    setActionLoadingId(job.id);
    try {
      const gps = await getCurrentGps();
      if (typeof job.lat === 'number' && typeof job.lng === 'number') {
        const distance = getDistanceMeters(gps.lat, gps.lng, job.lat, job.lng);
        const allowedRadius = Math.min(1000, typeof job.geofence_radius_m === 'number' ? job.geofence_radius_m : 1000);
        if (distance > allowedRadius + (gps.accuracy_m || 0)) {
          toast.error(`อยู่นอกระยะเช็คอิน (${formatDistance(distance)} > ${formatDistance(allowedRadius)})`);
          return;
        }
        toast.success(`ระยะห่าง ${formatDistance(distance)} อยู่ในเกณฑ์เช็คอิน`);
      }
      const res = await appApi.checkIn(job.id, caregiverId, gps);
      if (!res.success) {
        toast.error(res.error || 'เช็คอินไม่สำเร็จ');
        return;
      }
      toast.success('เช็คอินแล้ว');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เช็คอินไม่สำเร็จ');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCheckOut = async (jobId: string) => {
    setActionLoadingId(jobId);
    try {
      const gps = await getCurrentGps();
      const res = await appApi.checkOut(jobId, caregiverId, gps);
      if (!res.success) {
        toast.error(res.error || 'เช็คเอาต์ไม่สำเร็จ');
        return;
      }
      toast.success('เช็คเอาต์แล้ว');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เช็คเอาต์ไม่สำเร็จ');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenDispute = async (jobId: string) => {
    setActionLoadingId(jobId);
    try {
      const existingRes = await appApi.getDisputeByJob(jobId);
      if (existingRes.success && existingRes.data?.dispute?.id) {
        navigate(`/dispute/${existingRes.data.dispute.id}`);
        return;
      }
    } finally {
      setActionLoadingId(null);
    }
    setDisputeReason('');
    setDisputeJobId(jobId);
    setDisputeOpen(true);
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
      const res = await appApi.createDispute(disputeJobId, caregiverId, reason);
      if (!res.success || !res.data?.dispute?.id) {
        toast.error(res.error || 'เปิดข้อพิพาทไม่สำเร็จ');
        return;
      }
      toast.success('เปิดข้อพิพาทแล้ว');
      setDisputeOpen(false);
      setDisputeReason('');
      setDisputeJobId(null);
      navigate(`/dispute/${res.data.dispute.id}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const filters: { key: Filter; label: string }[] = [
    { key: 'assigned', label: 'รับงานแล้ว' },
    { key: 'in_progress', label: 'กำลังทำ' },
    { key: 'completed', label: 'เสร็จสิ้น' },
    { key: 'cancelled', label: 'ยกเลิก' },
  ];

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">งานของฉัน</h1>
            <p className="text-sm text-gray-600">จัดการงานที่รับไว้ และเช็คอิน/เช็คเอาต์</p>
          </div>
          <Button variant="outline" onClick={load}>
            รีเฟรช
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {filters.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? 'primary' : 'outline'}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {loading ? (
          <LoadingState message="กำลังโหลดงาน..." />
        ) : items.length === 0 ? (
          <Card className="p-6">
            <p className="text-gray-700">ยังไม่มีงานในสถานะนี้</p>
            <div className="mt-4">
              <Link to="/caregiver/jobs/feed">
                <Button variant="primary">ไปค้นหางาน</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((job) => {
              const location = [job.address_line1, job.district, job.province].filter(Boolean).join(', ');
              const isLoading = actionLoadingId === job.id;
              return (
                <Card key={job.id} className="p-4">
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
                        <div>ค่าจ้างรวม: {job.total_amount.toLocaleString()} บาท</div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link to={`/chat/${job.id}`}>
                          <Button variant="outline" size="sm">
                            เปิดแชท
                          </Button>
                        </Link>
                        <Button variant="outline" size="sm" loading={isLoading} onClick={() => handleOpenDispute(job.id)}>
                          เปิดข้อพิพาท
                        </Button>

                        {job.status === 'assigned' && (
                          <Button
                            variant="primary"
                            size="sm"
                            loading={isLoading}
                            onClick={() => handleCheckIn(job)}
                          >
                            เช็คอิน
                          </Button>
                        )}

                        {job.status === 'in_progress' && (
                          <Button
                            variant="primary"
                            size="sm"
                            loading={isLoading}
                            onClick={() => handleCheckOut(job.id)}
                          >
                            เช็คเอาต์
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
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
      </div>
    </MainLayout>
  );
}

