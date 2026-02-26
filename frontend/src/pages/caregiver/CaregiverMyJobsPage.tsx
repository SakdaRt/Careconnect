import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CalendarDays, ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { MainLayout } from '../../layouts';
import { Badge, Button, Card, LoadingState, Modal, ReasonModal, StatusBadge, Textarea } from '../../components/ui';
import { CHECKOUT_PRESETS } from '../../components/ui/ReasonModal';
import { CaregiverAssignedJob } from '../../services/api';
import { useAuth } from '../../contexts';
import { appApi } from '../../services/appApi';

type Filter = 'all' | 'offers' | 'upcoming' | 'in_progress' | 'completed' | 'cancelled';

function formatDateTimeRange(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const startDate = start.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  const endDate = end.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStart = start.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  const timeEnd = end.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  if (startDate === endDate) {
    return `${startDate} ${timeStart} - ${timeEnd}`;
  }
  return `${startDate} ${timeStart} - ${endDate} ${timeEnd}`;
}

function formatCompactLocation(addressLine1?: string | null, district?: string | null, province?: string | null) {
  const compact = [district, province].filter(Boolean).join(', ');
  return compact || addressLine1 || '';
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

const WEEKDAY_LABELS = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];

const toDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const toDateKeyFromIso = (iso: string) => toDateKey(new Date(iso));

const formatMonthLabel = (date: Date) => date.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

const formatFullDateLabel = (dateKey: string) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return '-';
  return new Date(y, m - 1, d).toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
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

  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<CaregiverAssignedJob[]>([]);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeJobId, setDisputeJobId] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutJobId, setCheckoutJobId] = useState<string | null>(null);
  const [checkoutIsEarly, setCheckoutIsEarly] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleJobs, setScheduleJobs] = useState<CaregiverAssignedJob[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const apiStatus = filter === 'all'
        ? undefined
        : filter === 'offers' || filter === 'upcoming'
          ? 'assigned'
          : filter;
      const res = await appApi.getAssignedJobs(caregiverId, apiStatus, 1, 50);
      if (res.success && res.data) {
        const source = res.data.data || [];
        const filtered = filter === 'offers'
          ? source.filter((job) => Boolean(job.awaiting_response))
          : filter === 'upcoming'
            ? source.filter((job) => !job.awaiting_response && job.status === 'assigned')
            : source;
        setJobs(filtered);
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

  const loadSchedule = useCallback(async () => {
    setScheduleLoading(true);
    try {
      const statuses: Array<'assigned' | 'in_progress'> = [
        'assigned',
        'in_progress',
      ];

      const responses = await Promise.all(statuses.map((status) => appApi.getAssignedJobs(caregiverId, status, 1, 100)));
      const merged: CaregiverAssignedJob[] = [];
      const seen = new Set<string>();

      responses.forEach((res) => {
        if (!res.success || !res.data?.data) return;

        for (const job of res.data.data) {
          if (job.awaiting_response) continue;
          const key = `${job.id}-${job.status}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(job);
        }
      });

      merged.sort((a, b) => new Date(a.scheduled_start_at).getTime() - new Date(b.scheduled_start_at).getTime());
      setScheduleJobs(merged);
    } finally {
      setScheduleLoading(false);
    }
  }, [caregiverId]);

  const scheduleJobsByDate = useMemo(() => {
    const grouped: Record<string, CaregiverAssignedJob[]> = {};

    for (const job of scheduleJobs) {
      const dateKey = toDateKeyFromIso(job.scheduled_start_at);
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(job);
    }

    Object.values(grouped).forEach((group) => {
      group.sort((a, b) => new Date(a.scheduled_start_at).getTime() - new Date(b.scheduled_start_at).getTime());
    });

    return grouped;
  }, [scheduleJobs]);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
    const firstDayOfWeek = (firstDay.getDay() + 6) % 7;
    const cells: Array<Date | null> = [];

    for (let i = 0; i < firstDayOfWeek; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
    }
    while (cells.length % 7 !== 0) cells.push(null);

    return cells;
  }, [calendarMonth]);

  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const selectedDateJobs = scheduleJobsByDate[selectedDateKey] || [];
  const selectedDateLabel = useMemo(() => formatFullDateLabel(selectedDateKey), [selectedDateKey]);

  const handleOpenSchedule = async () => {
    setScheduleOpen(true);
    await loadSchedule();
  };

  const handleRefresh = async () => {
    await load();
    if (scheduleOpen) await loadSchedule();
  };

  const handleAcceptAssignedOffer = async (job: CaregiverAssignedJob) => {
    const targetJobPostId = String(job.job_post_id || job.id || '').trim();
    if (!targetJobPostId) {
      toast.error('ไม่พบข้อมูลงานสำหรับตอบรับ');
      return;
    }

    setActionLoadingId(job.id);
    try {
      const res = await appApi.acceptJob(targetJobPostId, caregiverId);
      if (!res.success) {
        toast.error(res.error || 'ตอบรับงานไม่สำเร็จ');
        return;
      }

      toast.success('ตอบรับงานแล้ว ไปต่อที่แท็บรอเริ่มงาน');
      if (filter === 'upcoming') {
        await load();
      } else {
        setFilter('upcoming');
      }
      if (scheduleOpen) await loadSchedule();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectAssignedOffer = async (job: CaregiverAssignedJob) => {
    const targetJobPostId = String(job.job_post_id || job.id || '').trim();
    if (!targetJobPostId) {
      toast.error('ไม่พบข้อมูลงานสำหรับปฏิเสธ');
      return;
    }

    setActionLoadingId(job.id);
    try {
      const res = await appApi.rejectJob(targetJobPostId, caregiverId);
      if (!res.success) {
        toast.error(res.error || 'ปฏิเสธงานไม่สำเร็จ');
        return;
      }

      toast.success('ปฏิเสธงานแล้ว');
      await load();
    } finally {
      setActionLoadingId(null);
    }
  };

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
        toast.success(`ตรวจสอบตำแหน่งผ่านแล้ว (${formatDistance(distance)})`);
      }
      const res = await appApi.checkIn(job.id, caregiverId, gps);
      if (!res.success) {
        toast.error(res.error || 'บันทึกการมาถึงไม่สำเร็จ');
        return;
      }
      toast.success('บันทึกแล้ว: มาถึงที่หมาย');
      if (filter === 'in_progress') {
        await load();
      } else {
        setFilter('in_progress');
      }
      if (scheduleOpen) await loadSchedule();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'บันทึกการมาถึงไม่สำเร็จ');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenCheckout = (job: CaregiverAssignedJob) => {
    const now = new Date();
    const endAt = new Date(job.scheduled_end_at);
    const isEarly = now < endAt;
    setCheckoutJobId(job.id);
    setCheckoutIsEarly(isEarly);
    setCheckoutOpen(true);
  };

  const handleConfirmCheckout = async (evidenceNote: string) => {
    if (!checkoutJobId || !evidenceNote.trim()) return;
    setActionLoadingId(checkoutJobId);
    try {
      if (checkoutIsEarly) {
        const res = await appApi.requestEarlyCheckout(checkoutJobId, evidenceNote.trim());
        if (!res.success) {
          toast.error(res.error || 'ส่งคำขอไม่สำเร็จ');
          return;
        }
        toast.success('ส่งคำขอส่งงานก่อนเวลาแล้ว รอผู้ว่าจ้างอนุมัติ');
        setCheckoutOpen(false);
        setCheckoutJobId(null);
        setCheckoutIsEarly(false);
        await load();
      } else {
        let gps: { lat: number; lng: number; accuracy_m: number } = { lat: 0, lng: 0, accuracy_m: 0 };
        try {
          const raw = await getCurrentGps();
          gps = { lat: raw.lat, lng: raw.lng, accuracy_m: raw.accuracy_m ?? 0 };
        } catch { /* checkout allowed anywhere */ }
        const res = await appApi.checkOut(checkoutJobId, caregiverId, gps, evidenceNote.trim());
        if (!res.success) {
          toast.error(res.error || 'ส่งงานเสร็จไม่สำเร็จ');
          return;
        }
        toast.success('ส่งงานเสร็จแล้ว');
        setCheckoutOpen(false);
        setCheckoutJobId(null);
        setCheckoutIsEarly(false);
        if (filter === 'completed') {
          await load();
        } else {
          setFilter('completed');
        }
        if (scheduleOpen) await loadSchedule();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ส่งงานเสร็จไม่สำเร็จ');
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
    { key: 'offers', label: 'รอตอบรับ' },
    { key: 'in_progress', label: 'กำลังทำ' },
    { key: 'all', label: 'งานทั้งหมด' },
    { key: 'upcoming', label: 'รอเริ่มงาน' },
    { key: 'completed', label: 'เสร็จสิ้น' },
    { key: 'cancelled', label: 'ยกเลิก' },
  ];

  const emptyMessageByFilter: Record<Filter, string> = {
    all: 'ยังไม่มีงานในระบบ',
    offers: 'ยังไม่มีงานที่รอการตอบรับ',
    upcoming: 'ยังไม่มีงานที่รอเริ่มงาน',
    in_progress: 'ยังไม่มีงานที่กำลังทำ',
    completed: 'ยังไม่มีงานที่เสร็จสิ้น',
    cancelled: 'ยังไม่มีงานที่ยกเลิก',
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-5 space-y-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">งานของฉัน</h1>
            <p className="text-sm text-gray-600">งานที่มอบหมายจะขึ้นก่อน พร้อมตัวเลือกตอบรับหรือปฏิเสธ</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button
              variant="outline"
              className="w-full sm:w-auto whitespace-nowrap"
              leftIcon={<CalendarDays className="w-4 h-4" />}
              onClick={handleOpenSchedule}
            >
              ดูตารางงาน
            </Button>
            <Button variant="outline" className="w-full sm:w-auto whitespace-nowrap" onClick={handleRefresh}>
              รีเฟรช
            </Button>
          </div>
        </div>

        <div className="mb-5">
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max gap-1.5">
              {filters.map((f) => (
                <Button
                  key={f.key}
                  size="sm"
                  variant={filter === f.key ? 'primary' : 'outline'}
                  className="whitespace-nowrap"
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <LoadingState message="กำลังโหลดงาน..." />
        ) : items.length === 0 ? (
          <Card className="p-6 sm:p-8 text-center">
            <div className="text-4xl mb-3">{filter === 'all' ? '🔍' : filter === 'completed' ? '🎉' : '📭'}</div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">{emptyMessageByFilter[filter]}</h3>
            <p className="text-sm text-gray-600 mb-4">
              {filter === 'all' ? 'เริ่มค้นหางานที่เหมาะกับคุณได้เลย' : 'ลองเปลี่ยนตัวกรองดู หรือไปค้นหางานใหม่'}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {filter !== 'all' && <Button variant="outline" size="sm" onClick={() => setFilter('all')}>ดูงานทั้งหมด</Button>}
              <Link to="/caregiver/jobs/feed"><Button variant="primary" size="sm">ค้นหางาน</Button></Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((job) => {
              const targetJobPostId = String(job.job_post_id || job.id || '').trim();
              const location = formatCompactLocation(job.address_line1, job.district, job.province);
              const isLoading = actionLoadingId === job.id;
              const isAwaitingResponse = Boolean(job.awaiting_response);
              return (
                <Card key={job.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-gray-900 text-lg line-clamp-1">{job.title}</h3>
                        <div className="flex items-center gap-2">
                          {isAwaitingResponse && <Badge variant="warning">รอการตอบรับ</Badge>}
                          <StatusBadge status={job.status as any} />
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{job.description}</p>

                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
                        <div>เวลา: {formatDateTimeRange(job.scheduled_start_at, job.scheduled_end_at)}</div>
                        <div>สถานที่: {location || '-'}</div>
                        <div>ผู้รับการดูแล: {job.patient_display_name || '-'}</div>
                        <div>ค่าจ้างรวม: {job.total_amount.toLocaleString()} บาท</div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {targetJobPostId && (
                            <Link to={`/jobs/${targetJobPostId}`}>
                              <Button variant="outline" size="sm">
                                ดูรายละเอียดงาน
                              </Button>
                            </Link>
                          )}
                          {isAwaitingResponse ? (
                            <>
                              <Button
                                variant="primary"
                                size="sm"
                                loading={isLoading}
                                onClick={() => handleAcceptAssignedOffer(job)}
                              >
                                ตอบรับงาน
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                loading={isLoading}
                                onClick={() => handleRejectAssignedOffer(job)}
                              >
                                ปฏิเสธงาน
                              </Button>
                            </>
                          ) : (
                            <>
                              <Link to={`/chat/${job.id}`}>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  className="whitespace-nowrap"
                                  leftIcon={<MessageCircle className="w-4 h-4" />}
                                >
                                  แชท
                                </Button>
                              </Link>
                            </>
                          )}

                          {job.status === 'assigned' && !isAwaitingResponse && (
                            <Button
                              variant="primary"
                              size="sm"
                              loading={isLoading}
                              onClick={() => handleCheckIn(job)}
                            >
                              มาถึงที่หมายแล้ว
                            </Button>
                          )}

                          {job.status === 'in_progress' && (job as any).early_checkout_status !== 'pending' && (
                            <Button
                              variant="primary"
                              size="sm"
                              loading={isLoading}
                              onClick={() => handleOpenCheckout(job)}
                            >
                              ส่งงานเสร็จ
                            </Button>
                          )}
                        </div>

                        {job.status === 'in_progress' && (job as any).early_checkout_status === 'pending' && (
                          <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="text-xs font-semibold text-amber-800">รอผู้ว่าจ้างอนุมัติส่งงานก่อนเวลา</div>
                            <div className="text-xs text-amber-700 mt-0.5">ระบบจะแจ้งเตือนเมื่อผู้ว่าจ้างตอบรับ</div>
                          </div>
                        )}

                        {job.status === 'in_progress' && (job as any).early_checkout_status === 'rejected' && (
                          <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                            <div className="text-xs font-semibold text-red-800">ผู้ว่าจ้างปฏิเสธคำขอส่งงานก่อนเวลา</div>
                            <div className="text-xs text-red-700 mt-0.5">กรุณาดูแลต่อจนถึงเวลาสิ้นสุด หรือกดส่งงานเสร็จอีกครั้ง</div>
                            <Button
                              variant="primary"
                              size="sm"
                              loading={isLoading}
                              onClick={() => handleOpenCheckout(job)}
                              className="mt-2"
                            >
                              ส่งงานเสร็จอีกครั้ง
                            </Button>
                          </div>
                        )}

                        {!isAwaitingResponse && (job.status === 'assigned' || job.status === 'in_progress') && (
                          <div className="pt-2 border-t border-orange-100">
                            <Button variant="outline" size="sm" loading={isLoading} onClick={() => handleOpenDispute(job.id)} className="border-orange-300 text-orange-700 hover:bg-orange-50">
                              เปิดข้อพิพาท
                            </Button>
                          </div>
                        )}
                      </div>
                      {!isAwaitingResponse && (job.status === 'assigned' || job.status === 'in_progress') && (
                        <div className="mt-2 text-xs text-gray-500">
                          {job.status === 'assigned'
                            ? 'เมื่อไปถึงสถานที่แล้ว ให้กด "มาถึงที่หมายแล้ว"'
                            : 'เมื่อดูแลเสร็จ ให้กด "ส่งงานเสร็จ" เพื่อแจ้งผู้ว่าจ้าง'}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        <Modal
          isOpen={scheduleOpen}
          onClose={() => setScheduleOpen(false)}
          title="ตารางงานของฉัน"
          size="xl"
        >
          {scheduleLoading ? (
            <div className="py-10 text-center text-sm text-gray-500">กำลังโหลดตารางงาน...</div>
          ) : scheduleJobs.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">ยังไม่มีงานที่รับไว้ในตาราง</div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="p-2 rounded-md border border-gray-200 hover:bg-gray-50"
                  onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="text-sm font-semibold text-gray-900">{formatMonthLabel(calendarMonth)}</div>
                <button
                  type="button"
                  className="p-2 rounded-md border border-gray-200 hover:bg-gray-50"
                  onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500">
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label} className="py-1">
                    {label}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarCells.map((day, index) => {
                  if (!day) {
                    return <div key={`empty-${index}`} className="h-8 rounded bg-gray-50" />;
                  }

                  const dateKey = toDateKey(day);
                  const jobsOnDate = scheduleJobsByDate[dateKey] || [];
                  const isSelected = dateKey === selectedDateKey;
                  const isToday = dateKey === todayKey;

                  return (
                    <button
                      type="button"
                      key={dateKey}
                      onClick={() => setSelectedDateKey(dateKey)}
                      className={`h-8 rounded border text-[11px] transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : isToday
                            ? 'border-blue-200 bg-blue-50/40 text-gray-800'
                            : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="leading-none">{day.getDate()}</div>
                      {jobsOnDate.length > 0 && (
                        <div className="mt-px inline-flex min-w-[14px] h-3.5 items-center justify-center rounded-full bg-blue-100 px-0.5 text-[9px] font-semibold text-blue-700">
                          {jobsOnDate.length}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div>
                <div className="text-sm font-semibold text-gray-900 mb-2">{selectedDateLabel}</div>
                {selectedDateJobs.length === 0 ? (
                  <div className="text-sm text-gray-500">ไม่มีงานในวันนี้</div>
                ) : (
                  <div className="space-y-2">
                    {selectedDateJobs.map((job) => {
                      const location = [job.district, job.province].filter(Boolean).join(', ');
                      return (
                        <div key={`${job.id}-${job.status}`} className="p-3 border border-gray-200 rounded-lg">
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-medium text-sm text-gray-900 line-clamp-1">{job.title}</div>
                            <StatusBadge status={job.status as any} />
                          </div>
                          <div className="mt-1 text-xs text-gray-600">
                            {formatDateTimeRange(job.scheduled_start_at, job.scheduled_end_at)}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">ผู้รับการดูแล: {job.patient_display_name || '-'}</div>
                          {location && <div className="mt-1 text-xs text-gray-500">พื้นที่: {location}</div>}
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => { setScheduleOpen(false); navigate(`/jobs/${job.job_post_id || job.id}`); }}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              ดูรายละเอียดงาน →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>

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
            <Textarea
              label="เหตุผลที่เปิดข้อพิพาท"
              fullWidth
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="อธิบายเหตุผลในการเปิดข้อพิพาท"
              className="min-h-28"
            />
          </div>
        </Modal>

        <ReasonModal
          isOpen={checkoutOpen}
          onClose={() => { setCheckoutOpen(false); setCheckoutJobId(null); setCheckoutIsEarly(false); }}
          onConfirm={handleConfirmCheckout}
          title={checkoutIsEarly ? 'ขอส่งงานก่อนเวลา' : 'ส่งงานเสร็จ'}
          description={checkoutIsEarly
            ? 'ยังไม่ถึงเวลาสิ้นสุดงาน ระบบจะส่งคำขอไปให้ผู้ว่าจ้างอนุมัติก่อน กรุณาเลือกสิ่งที่ทำเป็นหลักฐาน'
            : 'กรุณาเลือกสิ่งที่ทำเป็นหลักฐาน'}
          placeholder="รายละเอียดเพิ่มเติม เช่น อาการผู้ป่วย ข้อสังเกต..."
          confirmText={checkoutIsEarly ? 'ส่งคำขอ' : 'ยืนยันส่งงาน'}
          variant="primary"
          loading={!!actionLoadingId}
          presetReasons={CHECKOUT_PRESETS}
        />
      </div>
    </MainLayout>
  );
}

