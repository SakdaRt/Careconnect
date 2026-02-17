import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CalendarDays, ChevronLeft, ChevronRight, MessageCircle, ShieldCheck, User as UserIcon, PlusCircle } from 'lucide-react';
import { MainLayout } from '../../layouts';
import { Badge, Button, Card, LoadingState, Modal, ReasonModal, StatusBadge } from '../../components/ui';
import { CareRecipient, JobPost } from '../../services/api';
import { appApi } from '../../services/appApi';
import { useAuth } from '../../contexts';

type HirerJob = JobPost & {
  caregiver_name?: string | null;
  job_status?: string | null;
  job_id?: string | null;
  patient_profile_id?: string | null;
};

type JobStatusFilter =
  | 'all'
  | 'waiting_response'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

type JobLifecycleStatus = 'draft' | 'waiting_response' | 'in_progress' | 'completed' | 'cancelled';

function getLifecycleStatus(job: HirerJob): JobLifecycleStatus {
  if (job.status === 'cancelled' || job.job_status === 'cancelled') return 'cancelled';
  if (job.status === 'completed' || job.job_status === 'completed') return 'completed';

  if (
    job.status === 'assigned' ||
    job.status === 'in_progress' ||
    job.job_status === 'assigned' ||
    job.job_status === 'in_progress'
  ) {
    return 'in_progress';
  }

  if (job.status === 'draft') return 'draft';
  return 'waiting_response';
}

function getLifecycleBadge(status: JobLifecycleStatus): { label: string; variant: 'default' | 'info' | 'warning' | 'success' | 'danger' } {
  switch (status) {
    case 'waiting_response':
      return { label: 'รอการตอบรับ', variant: 'info' };
    case 'in_progress':
      return { label: 'อยู่ระหว่างการดำเนินงาน', variant: 'warning' };
    case 'completed':
      return { label: 'เสร็จแล้ว', variant: 'success' };
    case 'cancelled':
      return { label: 'ยกเลิก', variant: 'danger' };
    default:
      return { label: 'ยังไม่เผยแพร่', variant: 'default' };
  }
}

function formatDateTimeRange(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const date = start.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStart = start.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  const timeEnd = end.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${timeStart} - ${timeEnd}`;
}

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

function JobPostCard({
  job,
  onPublish,
  onOpenDispute,
  onCancel,
}: {
  job: HirerJob;
  onPublish: () => void;
  onOpenDispute: () => void;
  onCancel: () => void;
}) {
  const location = useMemo(() => {
    const parts = [job.address_line1, job.district, job.province].filter(Boolean);
    return parts.join(', ');
  }, [job.address_line1, job.district, job.province]);
  const lifecycleStatus = getLifecycleStatus(job);
  const lifecycle = getLifecycleBadge(lifecycleStatus);
  const isAssignedToCaregiver = Boolean(job.preferred_caregiver_id) && lifecycleStatus !== 'draft';

  const canChat =
    Boolean(job.job_id) &&
    (job.job_status === 'assigned' || job.job_status === 'in_progress' || job.job_status === 'completed');

  const canDispute = Boolean(job.job_id) && lifecycleStatus !== 'draft' && lifecycleStatus !== 'cancelled' && lifecycleStatus !== 'completed';
  const canCancel = lifecycleStatus !== 'cancelled' && lifecycleStatus !== 'completed';
  const canPublish = lifecycleStatus === 'draft';

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900 text-lg line-clamp-1">{job.title}</h3>
            <Badge variant={lifecycle.variant}>{lifecycle.label}</Badge>
          </div>

          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{job.description}</p>

          <div className="mt-2">
            <Badge variant={isAssignedToCaregiver ? 'warning' : 'info'}>
              {isAssignedToCaregiver ? 'มอบหมายให้ผู้ดูแล' : 'งานโพสต์รับสมัคร'}
            </Badge>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
            <div>เวลา: {formatDateTimeRange(job.scheduled_start_at, job.scheduled_end_at)}</div>
            <div>สถานที่: {location || '-'}</div>
            <div>ประเภทงาน: {job.job_type}</div>
            <div>
              ราคา: {job.total_amount.toLocaleString()} บาท ({job.hourly_rate.toLocaleString()} บาท/ชม. ×{' '}
              {job.total_hours} ชม.)
            </div>
          </div>

          {job.caregiver_name && (job.job_status === 'assigned' || job.job_status === 'in_progress' || job.job_status === 'completed') && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <UserIcon className="w-4 h-4 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900">{job.caregiver_name}</div>
                <div className="text-xs text-gray-600">
                  {job.job_status === 'assigned' && 'รอเช็คอิน'}
                  {job.job_status === 'in_progress' && 'กำลังดูแล'}
                  {job.job_status === 'completed' && 'เสร็จสิ้น'}
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-start justify-between gap-2 pt-3 border-t border-gray-100">
            <div className="flex flex-wrap gap-2">
              <Link to={`/jobs/${job.id}`}>
                <Button variant="outline" size="sm">
                  ดูรายละเอียด
                </Button>
              </Link>

              {canChat && (
                <Link to={`/chat/${job.job_id}`}>
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<MessageCircle className="w-4 h-4" />}
                  >
                    แชท
                  </Button>
                </Link>
              )}

              {canDispute && (
                <Button variant="outline" size="sm" onClick={onOpenDispute}>
                  เปิดข้อพิพาท
                </Button>
              )}

              {canCancel && (
                <Button variant="danger" size="sm" onClick={onCancel}>
                  ยกเลิกงาน
                </Button>
              )}
            </div>

            {canPublish && (
              <Button variant="primary" size="sm" onClick={onPublish}>
                เผยแพร่
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
  const [status, setStatus] = useState<JobStatusFilter>('all');
  const [jobs, setJobs] = useState<HirerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeJobId, setDisputeJobId] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelJobId, setCancelJobId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [showKycPrompt, setShowKycPrompt] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleJobs, setScheduleJobs] = useState<HirerJob[]>([]);
  const [careRecipients, setCareRecipients] = useState<CareRecipient[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState('all');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));

  const hirerId = user?.id || 'demo-hirer';

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const requestStatus = status === 'waiting_response'
        ? 'posted'
        : status === 'completed'
          ? 'completed'
        : status === 'cancelled'
          ? 'cancelled'
          : undefined;
      const res = await appApi.getMyJobs(hirerId, requestStatus);
      if (res.success && res.data) {
        const items = (res.data.data || []) as HirerJob[];
        if (status === 'in_progress') {
          setJobs(items.filter((job) => getLifecycleStatus(job) === 'in_progress'));
          return;
        }
        if (status === 'waiting_response') {
          setJobs(items.filter((job) => getLifecycleStatus(job) === 'waiting_response'));
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

  const loadCareRecipients = useCallback(async () => {
    const res = await appApi.getCareRecipients();
    if (res.success && Array.isArray(res.data)) {
      setCareRecipients(res.data);
    }
  }, []);

  useEffect(() => {
    loadCareRecipients();
  }, [loadCareRecipients]);

  const loadSchedule = useCallback(async () => {
    setScheduleLoading(true);
    try {
      const [jobsRes, recipientsRes] = await Promise.all([
        appApi.getMyJobs(hirerId, undefined, 1, 200),
        appApi.getCareRecipients(),
      ]);

      if (jobsRes.success && jobsRes.data) {
        const source = (jobsRes.data.data || []) as HirerJob[];
        setScheduleJobs(source.filter((job) => job.status !== 'draft'));
      } else {
        setScheduleJobs([]);
      }

      if (recipientsRes.success && Array.isArray(recipientsRes.data)) {
        setCareRecipients(recipientsRes.data);
      }
    } finally {
      setScheduleLoading(false);
    }
  }, [hirerId]);

  const recipientNameMap = useMemo(() => {
    const map = new Map<string, string>();
    careRecipients.forEach((item) => {
      map.set(item.id, item.patient_display_name || 'ผู้รับการดูแล');
    });
    return map;
  }, [careRecipients]);

  const getRecipientName = useCallback((job: HirerJob) => {
    if (job.patient_display_name) return job.patient_display_name;
    if (job.patient_profile_id && recipientNameMap.has(job.patient_profile_id)) {
      return recipientNameMap.get(job.patient_profile_id) || 'ผู้รับการดูแล';
    }
    return 'ไม่ระบุผู้รับการดูแล';
  }, [recipientNameMap]);

  const hasUnknownRecipientJobs = useMemo(
    () => scheduleJobs.some((job) => !job.patient_profile_id),
    [scheduleJobs]
  );

  const recipientOptions = useMemo(() => {
    const sortedRecipients = [...careRecipients].sort((a, b) =>
      (a.patient_display_name || '').localeCompare(b.patient_display_name || '', 'th')
    );

    const options = [
      { id: 'all', label: 'ผู้รับการดูแลทั้งหมด' },
      ...sortedRecipients.map((item) => ({ id: item.id, label: item.patient_display_name || 'ผู้รับการดูแล' })),
    ];

    if (hasUnknownRecipientJobs) {
      options.push({ id: '__unassigned__', label: 'ไม่ระบุผู้รับการดูแล' });
    }

    return options;
  }, [careRecipients, hasUnknownRecipientJobs]);

  const filteredScheduleJobs = useMemo(() => {
    if (selectedRecipientId === 'all') return scheduleJobs;
    if (selectedRecipientId === '__unassigned__') {
      return scheduleJobs.filter((job) => !job.patient_profile_id);
    }
    return scheduleJobs.filter((job) => job.patient_profile_id === selectedRecipientId);
  }, [scheduleJobs, selectedRecipientId]);

  const scheduleJobsByDate = useMemo(() => {
    const grouped: Record<string, HirerJob[]> = {};

    for (const job of filteredScheduleJobs) {
      const dateKey = toDateKeyFromIso(job.scheduled_start_at);
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(job);
    }

    Object.values(grouped).forEach((group) => {
      group.sort((a, b) => new Date(a.scheduled_start_at).getTime() - new Date(b.scheduled_start_at).getTime());
    });

    return grouped;
  }, [filteredScheduleJobs]);

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
    await loadJobs();
    if (scheduleOpen) await loadSchedule();
  };

  const handlePublish = async (jobPostId: string) => {
    const res = await appApi.publishJob(jobPostId, hirerId);
    if (res.success) {
      toast.success('เผยแพร่งานแล้ว');
      setShowKycPrompt(false);
      await loadJobs();
      return;
    }
    const code = (res as any).code as string | undefined;
    const errMsg = String(res.error || '');
    if (code === 'INSUFFICIENT_BALANCE' || errMsg.includes('Insufficient')) {
      toast.error('เงินในระบบไม่พอ กรุณาเติมเงินก่อนเผยแพร่');
      return;
    }
    if (code === 'POLICY_VIOLATION' || code === 'INSUFFICIENT_TRUST_LEVEL' || errMsg.includes('trust') || errMsg.includes('Trust') || errMsg.includes('policy')) {
      setShowKycPrompt(true);
      const tl = user?.trust_level || 'L0';
      if (tl === 'L0') {
        toast.error('กรุณายืนยันเบอร์โทรก่อนเผยแพร่งาน (ต้อง L1+)');
      } else if (tl === 'L1') {
        toast.error('งานความเสี่ยงสูงต้องยืนยันตัวตน KYC ก่อนเผยแพร่ (ต้อง L2+)');
      } else {
        toast.error(errMsg || 'ระดับความน่าเชื่อถือไม่เพียงพอ');
      }
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
    setDisputeJobId(jobPostId);
    setDisputeOpen(true);
  };

  const handleOpenCancel = (jobPostId: string) => {
    setCancelJobId(jobPostId);
    setCancelOpen(true);
  };

  const handleConfirmCancel = async (reason: string) => {
    if (!cancelJobId) return;
    setActionLoadingId(cancelJobId);
    try {
      const res = await appApi.cancelJob(cancelJobId, hirerId, reason);
      if (!res.success) {
        toast.error(res.error || 'ยกเลิกงานไม่สำเร็จ');
        return;
      }
      toast.success('ยกเลิกงานแล้ว');
      setCancelOpen(false);
      setCancelJobId(null);
      await loadJobs();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmDispute = async (reason: string) => {
    if (!disputeJobId) return;
    setActionLoadingId(disputeJobId);
    try {
      const res = await appApi.createDispute(disputeJobId, hirerId, reason);
      if (!res.success || !res.data?.dispute?.id) {
        toast.error(res.error || 'เปิดข้อพิพาทไม่สำเร็จ');
        return;
      }
      toast.success('เปิดข้อพิพาทแล้ว');
      setDisputeOpen(false);
      setDisputeJobId(null);
      navigate(`/dispute/${res.data.dispute.id}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const filters: { key: JobStatusFilter; label: string }[] = [
    { key: 'all', label: 'งานทั้งหมด' },
    { key: 'waiting_response', label: 'รอตอบรับ' },
    { key: 'in_progress', label: 'อยู่ระหว่างการดำเนินงาน' },
    { key: 'completed', label: 'เสร็จแล้ว' },
    { key: 'cancelled', label: 'ยกเลิก' },
  ];

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">งานของฉัน</h1>
            <p className="text-sm text-gray-600">จัดการงานทั้งหมดของคุณ</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" leftIcon={<CalendarDays className="w-4 h-4" />} onClick={handleOpenSchedule}>
              ดูตารางงาน
            </Button>
            <Button variant="outline" onClick={handleRefresh}>
              รีเฟรช
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-5">
          <Link
            to="/hirer/create-job"
            className="w-full flex items-center justify-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
          >
            <PlusCircle className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-semibold text-blue-700">สร้างงาน</span>
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

        {showKycPrompt && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">ต้องยืนยันตัวตนก่อนเผยแพร่งาน</p>
              <p className="text-xs text-amber-700 mt-1">
                {(user?.trust_level || 'L0') === 'L0'
                  ? 'กรุณายืนยันเบอร์โทรศัพท์ก่อน (Trust Level L1) จากนั้นยืนยันตัวตน KYC เพื่อเผยแพร่งานความเสี่ยงสูง (L2)'
                  : 'งานความเสี่ยงสูงต้อง Trust Level L2 ขึ้นไป กรุณายืนยันตัวตน KYC'}
              </p>
              <div className="mt-2 flex gap-2">
                <Link to="/kyc">
                  <Button variant="primary" size="sm">ยืนยันตัวตน (KYC)</Button>
                </Link>
                <Button variant="outline" size="sm" onClick={() => setShowKycPrompt(false)}>ปิด</Button>
              </div>
            </div>
          </div>
        )}

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
          isOpen={scheduleOpen}
          onClose={() => setScheduleOpen(false)}
          title="ตารางงานผู้รับการดูแล"
          size="xl"
        >
          {scheduleLoading ? (
            <div className="py-10 text-center text-sm text-gray-500">กำลังโหลดตารางงาน...</div>
          ) : scheduleJobs.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">ยังไม่มีงานในตาราง</div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-[260px_1fr] gap-3 sm:items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">เลือกผู้รับการดูแล</label>
                  <select
                    className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                    value={selectedRecipientId}
                    onChange={(e) => setSelectedRecipientId(e.target.value)}
                  >
                    {recipientOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="text-xs text-gray-500 sm:text-right">
                  งานทั้งหมดในมุมมองนี้: {filteredScheduleJobs.length}
                </div>
              </div>

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
                    return <div key={`empty-${index}`} className="h-14 rounded-md bg-gray-50" />;
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
                      className={`h-14 rounded-md border text-xs transition-colors ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : isToday
                            ? 'border-blue-200 bg-blue-50/40 text-gray-800'
                            : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="leading-none">{day.getDate()}</div>
                      {jobsOnDate.length > 0 && (
                        <div className="mt-1 inline-flex min-w-[20px] h-5 items-center justify-center rounded-full bg-blue-100 px-1 text-[10px] font-semibold text-blue-700">
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
                        <div key={`${job.id}-${job.job_status || job.status}`} className="p-3 border border-gray-200 rounded-lg">
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-medium text-sm text-gray-900 line-clamp-1">{job.title}</div>
                            <StatusBadge status={(job.job_status || job.status) as any} />
                          </div>
                          <div className="mt-1 text-xs text-gray-600">
                            {formatDateTimeRange(job.scheduled_start_at, job.scheduled_end_at)}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">ผู้รับการดูแล: {getRecipientName(job)}</div>
                          {location && <div className="mt-1 text-xs text-gray-500">พื้นที่: {location}</div>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>
        <ReasonModal
          isOpen={disputeOpen}
          onClose={() => setDisputeOpen(false)}
          onConfirm={handleConfirmDispute}
          title="เปิดข้อพิพาท"
          description="กรุณาอธิบายปัญหาที่เกิดขึ้นอย่างละเอียด เพื่อให้แอดมินพิจารณาได้ถูกต้อง"
          placeholder="อธิบายเหตุผลในการเปิดข้อพิพาท..."
          confirmText="ยืนยันเปิดข้อพิพาท"
          variant="warning"
          loading={!!actionLoadingId}
          minLength={10}
        />
        <ReasonModal
          isOpen={cancelOpen}
          onClose={() => setCancelOpen(false)}
          onConfirm={handleConfirmCancel}
          title="ยกเลิกงาน"
          description="กรุณาอธิบายเหตุผลที่ต้องการยกเลิกงาน เพื่อให้อีกฝ่ายเข้าใจ"
          placeholder="อธิบายเหตุผลในการยกเลิกงาน..."
          confirmText="ยืนยันยกเลิก"
          variant="danger"
          loading={!!actionLoadingId}
          minLength={10}
        />
      </div>
    </MainLayout>
  );
}

