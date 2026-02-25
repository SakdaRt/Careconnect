import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CalendarDays, ChevronLeft, ChevronRight, MessageCircle, ShieldCheck, User as UserIcon, PlusCircle } from 'lucide-react';
import { MainLayout } from '../../layouts';
import { Badge, Button, Card, LoadingState, Modal, ReasonModal, Select, StatusBadge } from '../../components/ui';
import { CareRecipient, JobPost } from '../../services/api';
import { appApi } from '../../services/appApi';
import { useAuth } from '../../contexts';
import { isConfiguredDisplayName } from '../../utils/profileName';

type HirerJob = JobPost & {
  caregiver_name?: string | null;
  job_status?: string | null;
  job_id?: string | null;
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

const normalizeAddressPart = (value?: string | null) => (value || '').trim().toLowerCase();

const buildRecipientAddressKey = (
  addressLine1?: string | null,
  district?: string | null,
  province?: string | null,
  postalCode?: string | null,
  includePostalCode = true
) => {
  const normalizedAddress = normalizeAddressPart(addressLine1);
  if (!normalizedAddress) return '';

  const parts = [normalizedAddress, normalizeAddressPart(district), normalizeAddressPart(province)];
  if (includePostalCode) {
    parts.push(normalizeAddressPart(postalCode));
  }
  return parts.join('|');
};

function isSchedulableJob(job: HirerJob) {
  const effectiveStatus = job.job_status || job.status;
  return effectiveStatus === 'assigned' || effectiveStatus === 'in_progress';
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
  getRecipientName,
}: {
  job: HirerJob;
  onPublish: () => void;
  onOpenDispute: () => void;
  onCancel: () => void;
  getRecipientName: (job: HirerJob) => string;
}) {
  const location = useMemo(() => {
    return formatCompactLocation(job.address_line1, job.district, job.province);
  }, [job.address_line1, job.district, job.province]);
  const recipientName = useMemo(() => getRecipientName(job), [getRecipientName, job]);
  const lifecycleStatus = getLifecycleStatus(job);
  const lifecycle = getLifecycleBadge(lifecycleStatus);
  const isAssignedToCaregiver = Boolean(job.preferred_caregiver_id || job.caregiver_name) && lifecycleStatus !== 'draft';
  const assignedCaregiverName = job.caregiver_name || null;

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
            <div>ผู้รับการดูแล: {recipientName}</div>
            <div>ประเภทงาน: {job.job_type}</div>
            <div>
              ราคา: {job.total_amount.toLocaleString()} บาท ({job.hourly_rate.toLocaleString()} บาท/ชม. ×{' '}
              {job.total_hours} ชม.)
            </div>
          </div>

          {(job.caregiver_name || (isAssignedToCaregiver && assignedCaregiverName)) && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <UserIcon className="w-4 h-4 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900">{assignedCaregiverName}</div>
                <div className="text-xs text-gray-600">
                  {job.job_status === 'assigned' && 'รับงานแล้ว รอเช็คอิน'}
                  {job.job_status === 'in_progress' && 'กำลังดูแล'}
                  {job.job_status === 'completed' && 'เสร็จสิ้น'}
                  {!job.job_status && isAssignedToCaregiver && 'รอตอบรับ'}
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
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
                      className="whitespace-nowrap"
                      leftIcon={<MessageCircle className="w-4 h-4" />}
                    >
                      แชท
                    </Button>
                  </Link>
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

            {canDispute && (
              <div className="pt-2 border-t border-orange-100">
                <Button variant="outline" size="sm" onClick={onOpenDispute} className="border-orange-300 text-orange-700 hover:bg-orange-50">
                  เปิดข้อพิพาท
                </Button>
              </div>
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
  const [hasEverCreatedJob, setHasEverCreatedJob] = useState(false);
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

  useEffect(() => {
    appApi.getMyJobs(hirerId, undefined, 1, 1).then((res) => {
      if (res.success && res.data) {
        const total = res.data.total ?? (res.data.data?.length ?? 0);
        if (total > 0) setHasEverCreatedJob(true);
      }
    }).catch(() => {});
  }, [hirerId]);

  const loadSchedule = useCallback(async () => {
    setScheduleLoading(true);
    try {
      const [assignedRes, inProgressRes, recipientsRes] = await Promise.all([
        appApi.getMyJobs(hirerId, 'assigned', 1, 100),
        appApi.getMyJobs(hirerId, 'in_progress', 1, 100),
        appApi.getCareRecipients(),
      ]);

      const merged: HirerJob[] = [];
      const seen = new Set<string>();

      [assignedRes, inProgressRes].forEach((res) => {
        if (!res.success || !res.data?.data) return;

        for (const job of res.data.data as HirerJob[]) {
          if (!isSchedulableJob(job)) continue;
          const key = `${job.id}-${job.job_id || 'no-job'}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(job);
        }
      });

      merged.sort((a, b) => new Date(a.scheduled_start_at).getTime() - new Date(b.scheduled_start_at).getTime());
      setScheduleJobs(merged);

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

  const recipientIdByName = useMemo(() => {
    const map = new Map<string, string>();
    careRecipients.forEach((item) => {
      const name = (item.patient_display_name || '').trim();
      if (!name || map.has(name)) return;
      map.set(name, item.id);
    });
    return map;
  }, [careRecipients]);

  const recipientIdByAddressStrict = useMemo(() => {
    const map = new Map<string, string>();
    const duplicatedKeys = new Set<string>();

    careRecipients.forEach((item) => {
      const key = buildRecipientAddressKey(item.address_line1, item.district, item.province, item.postal_code, true);
      if (!key || duplicatedKeys.has(key)) return;
      if (map.has(key)) {
        map.delete(key);
        duplicatedKeys.add(key);
        return;
      }
      map.set(key, item.id);
    });

    return map;
  }, [careRecipients]);

  const recipientIdByAddressLoose = useMemo(() => {
    const map = new Map<string, string>();
    const duplicatedKeys = new Set<string>();

    careRecipients.forEach((item) => {
      const key = buildRecipientAddressKey(item.address_line1, item.district, item.province, item.postal_code, false);
      if (!key || duplicatedKeys.has(key)) return;
      if (map.has(key)) {
        map.delete(key);
        duplicatedKeys.add(key);
        return;
      }
      map.set(key, item.id);
    });

    return map;
  }, [careRecipients]);

  const getRecipientId = useCallback((job: HirerJob) => {
    if (job.patient_profile_id) return job.patient_profile_id;

    const name = (job.patient_display_name || '').trim();
    if (name && recipientIdByName.has(name)) {
      return recipientIdByName.get(name) || null;
    }

    const strictKey = buildRecipientAddressKey(job.address_line1, job.district, job.province, job.postal_code, true);
    if (strictKey && recipientIdByAddressStrict.has(strictKey)) {
      return recipientIdByAddressStrict.get(strictKey) || null;
    }

    const looseKey = buildRecipientAddressKey(job.address_line1, job.district, job.province, job.postal_code, false);
    if (looseKey && recipientIdByAddressLoose.has(looseKey)) {
      return recipientIdByAddressLoose.get(looseKey) || null;
    }

    return null;
  }, [recipientIdByAddressLoose, recipientIdByAddressStrict, recipientIdByName]);

  const getRecipientName = useCallback((job: HirerJob) => {
    if (job.patient_display_name) return job.patient_display_name;
    const recipientId = getRecipientId(job);
    if (recipientId && recipientNameMap.has(recipientId)) {
      return recipientNameMap.get(recipientId) || 'ผู้รับการดูแล';
    }
    return 'ไม่ระบุผู้รับการดูแล';
  }, [getRecipientId, recipientNameMap]);

  const hasUnknownRecipientJobs = useMemo(
    () => scheduleJobs.some((job) => !getRecipientId(job)),
    [getRecipientId, scheduleJobs]
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
      return scheduleJobs.filter((job) => !getRecipientId(job));
    }
    return scheduleJobs.filter((job) => getRecipientId(job) === selectedRecipientId);
  }, [getRecipientId, scheduleJobs, selectedRecipientId]);

  useEffect(() => {
    if (recipientOptions.some((option) => option.id === selectedRecipientId)) return;
    setSelectedRecipientId('all');
  }, [recipientOptions, selectedRecipientId]);

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
    setSelectedRecipientId('all');
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

  const filters: { key: JobStatusFilter; label: string; mobileLabel?: string }[] = [
    { key: 'waiting_response', label: 'รอตอบรับ' },
    { key: 'in_progress', label: 'อยู่ระหว่างการดำเนินงาน', mobileLabel: 'กำลังทำ' },
    { key: 'all', label: 'งานทั้งหมด' },
    { key: 'completed', label: 'เสร็จแล้ว' },
    { key: 'cancelled', label: 'ยกเลิก' },
  ];

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-5 space-y-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">งานของฉัน</h1>
            <p className="text-sm text-gray-600">จัดการงานทั้งหมดของคุณ</p>
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

        {/* Quick Actions */}
        <div className="mb-5">
          <Link to="/hirer/create-job" className="block w-full">
            <Button
              variant="primary"
              className="w-full py-2 rounded-xl"
              leftIcon={<PlusCircle className="w-4 h-4" />}
            >
              สร้างงาน
            </Button>
          </Link>
        </div>

        {/* Onboarding Checklist */}
        {(() => {
          const tl = user?.trust_level || 'L0';
          const isGuest = user?.account_type === 'guest';
          const hasName = isConfiguredDisplayName(user?.name);
          const hasPhone = !!user?.is_phone_verified;
          const hasEmail = !!user?.is_email_verified;
          const hasRecipient = careRecipients.length > 0;
          const hasJob = hasEverCreatedJob || jobs.length > 0;

          const steps: { done: boolean; label: string; sub: string; link?: string }[] = [
            { done: true, label: 'สมัครสมาชิก', sub: 'เสร็จแล้ว' },
            { done: hasName, label: 'ตั้งชื่อ-นามสกุล', sub: 'ชื่อที่ผู้ดูแลจะเห็น', link: '/profile' },
          ];

          if (isGuest) {
            steps.push({ done: hasPhone, label: 'เพิ่มและยืนยันเบอร์โทร', sub: 'เพื่อให้ผู้ดูแลติดต่อได้ + เลื่อนเป็น L1', link: '/profile' });
          } else {
            steps.push({ done: hasEmail, label: 'เพิ่มอีเมล', sub: 'เพิ่มช่องทางการติดต่อ', link: '/profile' });
          }

          steps.push(
            { done: tl === 'L2' || tl === 'L3', label: 'ยืนยันตัวตน KYC (L2)', sub: 'เผยแพร่งานทุกประเภท', link: '/kyc' },
            { done: hasRecipient, label: 'เพิ่มผู้รับการดูแล', sub: 'ข้อมูลผู้ที่จะได้รับบริการ', link: '/hirer/care-recipients/new' },
            { done: hasJob, label: 'สร้างงานแรก', sub: 'สร้างงานแล้วเลือกผู้ดูแล', link: '/hirer/create-job' },
          );

          const doneCount = steps.filter((s) => s.done).length;
          if (doneCount >= steps.length) return null;
          return (
            <Card className="mb-5 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold text-gray-900">เริ่มต้นใช้งาน</div>
                <span className="text-xs text-gray-500">{doneCount}/{steps.length}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mb-3">
                <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
              </div>
              <div className="space-y-2">
                {steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${s.done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                      {s.done ? '✓' : i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm ${s.done ? 'text-gray-400 line-through' : 'text-gray-800 font-medium'}`}>{s.label}</div>
                      {!s.done && <div className="text-xs text-gray-500">{s.sub}</div>}
                    </div>
                    {!s.done && s.link && (
                      <Link to={s.link}>
                        <Button variant="outline" size="sm" className="text-xs shrink-0">ไปเลย</Button>
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          );
        })()}

        <div className="mb-5">
          <div className="text-xs font-medium text-gray-500 mb-2">สถานะงาน</div>
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max gap-1.5">
              {filters.map((f) => (
                <Button
                  key={f.key}
                  size="sm"
                  variant={status === f.key ? 'primary' : 'outline'}
                  className="whitespace-nowrap"
                  onClick={() => setStatus(f.key)}
                >
                  <span className="sm:hidden">{f.mobileLabel || f.label}</span>
                  <span className="hidden sm:inline">{f.label}</span>
                </Button>
              ))}
            </div>
          </div>
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
          <Card className="p-4 sm:p-6">
            <div className="text-center">
              <p className="text-gray-700">ยังไม่มีงานในสถานะนี้</p>
              <div className="mt-4">
                <Link to="/hirer/create-job">
                  <Button variant="primary">สร้างงานแรก</Button>
                </Link>
              </div>
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
                getRecipientName={getRecipientName}
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
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-[260px_1fr] gap-3 sm:items-end">
                <div>
                  <Select label="เลือกผู้รับการดูแล" value={selectedRecipientId} onChange={(e) => setSelectedRecipientId(e.target.value)}>
                    {recipientOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="text-xs text-gray-500 sm:text-right">
                  งานทั้งหมดในมุมมองนี้: {filteredScheduleJobs.length}
                </div>
              </div>

              {filteredScheduleJobs.length === 0 && (
                <div className="text-xs text-gray-500">ยังไม่มีงานสถานะมอบหมายหรือกำลังทำในมุมมองนี้</div>
              )}

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
                      const location = formatCompactLocation(job.address_line1, job.district, job.province);
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
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => { setScheduleOpen(false); navigate(`/jobs/${job.id}`); }}
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

