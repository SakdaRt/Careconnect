import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Camera, X } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { ChatLayout } from '../../layouts';
import { Button, Card, Input, LoadingState, Modal, ReasonModal, StatusBadge, Textarea } from '../../components/ui';
import { CANCEL_PRESETS, CHECKOUT_PRESETS } from '../../components/ui/ReasonModal';
import { ChatMessage, ChatThread, JobPost } from '../../services/api';
import { appApi } from '../../services/appApi';
import { useAuth } from '../../contexts';
import { getScopedStorageItem } from '../../utils/authStorage';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTimeRange(startIso?: string | null, endIso?: string | null) {
  if (!startIso || !endIso) return '-';
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

export default function ChatRoomPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [job, setJob] = useState<JobPost | null>(null);
  const [disputeInfo, setDisputeInfo] = useState<{ id: string; status?: string; reason?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutType, setCheckoutType] = useState<'normal' | 'special'>('normal');
  const [checkoutNote, setCheckoutNote] = useState('');
  const [checkoutPreset, setCheckoutPreset] = useState('');
  const [checkoutPhoto, setCheckoutPhoto] = useState<File | null>(null);
  const [checkoutPhotoPreview, setCheckoutPhotoPreview] = useState<string | null>(null);
  const [checkoutUploading, setCheckoutUploading] = useState(false);
  const checkoutPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [cancelReasonDisplay, setCancelReasonDisplay] = useState<string>('');
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    });
  };

  const load = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const jobRes = await appApi.getJobById(jobId);
      const nextJob = jobRes.success ? jobRes.data?.job || null : null;
      setJob(nextJob);
      const dRes = await appApi.getDisputeByJob(jobId);
      setDisputeInfo(
        dRes.success && dRes.data?.dispute?.id
          ? { id: dRes.data.dispute.id, status: dRes.data.dispute.status, reason: dRes.data.dispute.reason }
          : null
      );
      const cancelRes = await appApi.getCancelReason(jobId);
      setCancelReasonDisplay(cancelRes.success ? String((cancelRes.data as any)?.reason || '') : '');

      const resPrimary = await appApi.getChatThread(jobId);
      let nextThread = resPrimary.success ? resPrimary.data?.thread || null : null;
      if (!nextThread) {
        const fallbackId = (jobRes.success && jobRes.data?.job?.job_id) ? jobRes.data.job.job_id! : null;
        if (fallbackId) {
          const resFallback = await appApi.getChatThread(fallbackId);
          nextThread = resFallback.success ? resFallback.data?.thread || null : null;
        }
        if (!nextThread) {
          const created = await appApi.getOrCreateChatThread(fallbackId || jobId);
          nextThread = created.success ? created.data?.thread || null : null;
        }
      }
      setThread(nextThread);
      if (!nextThread) {
        setMessages([]);
        return;
      }
      const msgs = await appApi.getChatMessages(nextThread.id, 50);
      setMessages(msgs.success && msgs.data ? msgs.data.data || [] : []);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!thread) return;

    const env = (import.meta as any).env as Record<string, string | undefined>;
    const socketUrl = env.VITE_SOCKET_URL || window.location.origin;
    const token = getScopedStorageItem('careconnect_token');
    if (!token) return;

    const socket = io(socketUrl, {
      transports: ['websocket'],
      auth: { token },
    });
    socketRef.current = socket;

    const onError = (payload: any) => {
      const message = String(payload?.message || 'เกิดข้อผิดพลาดของแชท');
      if (message.includes('closed chat') || message.includes('cancelled job')) {
        setThread((prev) => (prev ? { ...prev, status: 'closed' } : prev));
      }
      toast.error(message);
    };

    socket.on('connect', () => {
      socket.emit('thread:join', thread.id);
    });

    socket.on('message:new', (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
      scrollToBottom();
    });

    socket.on('error', onError);

    return () => {
      try {
        socket.emit('thread:leave', thread.id);
      } catch {
        // ignore
      }
      socket.off('message:new');
      socket.off('error', onError);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [thread]);

  const handleImageSend = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !thread || !jobId) return;
    if (isChatLocked) { toast.error('ไม่สามารถส่งรูปภาพได้'); return; }
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await appApi.uploadChatImage(thread.id, formData);
      if (!uploadRes.success || !uploadRes.data?.attachment_key) {
        toast.error(uploadRes.error || 'อัปโหลดรูปภาพไม่สำเร็จ');
        return;
      }
      const attachmentKey = uploadRes.data.attachment_key;
      const socket = socketRef.current;
      if (socket?.connected) {
        socket.emit('message:send', { threadId: thread.id, type: 'image', content: '', attachment_key: attachmentKey });
      } else {
        const sender = { id: user?.id || '', role: user?.role || 'user', name: user?.name || undefined };
        const res = await appApi.sendMessage(thread.id, sender, '', 'image', attachmentKey);
        if (!res.success || !res.data?.message) {
          toast.error(res.error || 'ส่งรูปภาพไม่สำเร็จ');
          return;
        }
        setMessages((prev) => [...prev, res.data!.message]);
        scrollToBottom();
      }
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    const currentJobStatus = ((job as any)?.job_status as string | undefined) || job?.status;
    if (!thread || !trimmed || !jobId || currentJobStatus === 'cancelled' || thread.status === 'closed') return;
    setSending(true);
    try {
      const sender = { id: user?.id || '', role: user?.role || 'user', name: user?.name || undefined };
      const socket = socketRef.current;
      if (socket?.connected) {
        socket.emit('message:send', { threadId: thread.id, type: 'text', content: trimmed });
        setText('');
        return;
      }

      const res = await appApi.sendMessage(thread.id, sender, trimmed, 'text');
      if (!res.success || !res.data?.message) {
        const errorMessage = String(res.error || 'ส่งข้อความไม่สำเร็จ');
        if (errorMessage.includes('closed chat') || errorMessage.includes('cancelled job')) {
          setThread((prev) => (prev ? { ...prev, status: 'closed' } : prev));
        }
        toast.error(res.error || 'ส่งข้อความไม่สำเร็จ');
        return;
      }
      setMessages((prev) => [...prev, res.data!.message]);
      setText('');
      scrollToBottom();
    } finally {
      setSending(false);
    }
  };

  const handleCheckIn = async () => {
    if (!jobId) return;
    setActionLoading('checkin');
    try {
      const caregiverId = user?.id || 'demo-caregiver';
      const gps = await getCurrentGps();
      if (typeof job?.lat === 'number' && typeof job?.lng === 'number') {
        const distance = getDistanceMeters(gps.lat, gps.lng, job.lat, job.lng);
        const allowedRadius = Math.min(1000, typeof job.geofence_radius_m === 'number' ? job.geofence_radius_m : 1000);
        if (distance > allowedRadius + (gps.accuracy_m || 0)) {
          toast.error(`อยู่นอกระยะเช็คอิน (${formatDistance(distance)} > ${formatDistance(allowedRadius)})`);
          return;
        }
        toast.success(`ตรวจสอบตำแหน่งผ่านแล้ว (${formatDistance(distance)})`);
      }
      const res = await appApi.checkIn(jobId, caregiverId, gps);
      if (!res.success) {
        toast.error(res.error || 'บันทึกการมาถึงไม่สำเร็จ');
        return;
      }
      toast.success('บันทึกแล้ว: มาถึงที่หมาย');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'บันทึกการมาถึงไม่สำเร็จ');
    } finally {
      setActionLoading(null);
    }
  };

  const viewJobDetailId = ((job as any)?.id as string | undefined)
    || ((job as any)?.job_id as string | undefined)
    || jobId;

  const handleViewJobDetail = () => {
    if (!viewJobDetailId) return;
    navigate(`/jobs/${viewJobDetailId}`);
  };

  const handleOpenCheckout = () => {
    setCheckoutType('normal');
    setCheckoutNote('');
    setCheckoutPreset('');
    setCheckoutPhoto(null);
    setCheckoutPhotoPreview(null);
    setCheckoutOpen(true);
  };

  const handleOpenSpecialCheckout = () => {
    setCheckoutType('special');
    setCheckoutNote('');
    setCheckoutPreset('');
    setCheckoutPhoto(null);
    setCheckoutPhotoPreview(null);
    setCheckoutOpen(true);
  };

  const handleConfirmCheckout = async () => {
    if (!jobId) return;
    const evidenceNote = checkoutPreset
      ? `${checkoutPreset}${checkoutNote.trim() ? ` — ${checkoutNote.trim()}` : ''}`
      : checkoutNote.trim();
    if (!evidenceNote) { toast.error('กรุณาเลือกหรือกรอกหลักฐานการทำงาน'); return; }
    if (!checkoutPhoto) { toast.error('กรุณาแนบรูปภาพหลักฐานการทำงาน'); return; }
    setActionLoading('checkout');
    try {
      const formData = new FormData();
      formData.append('file', checkoutPhoto);
      setCheckoutUploading(true);
      const uploadRes = await appApi.uploadCheckoutPhoto(jobId, formData);
      setCheckoutUploading(false);
      if (!uploadRes.success || !uploadRes.data?.photo_url) {
        toast.error(uploadRes.error || 'อัปโหลดรูปภาพไม่สำเร็จ');
        return;
      }
      const res = await appApi.requestEarlyCheckout(jobId, evidenceNote, uploadRes.data.photo_url);
      if (!res.success) { toast.error(res.error || 'ส่งคำขอไม่สำเร็จ'); return; }
      toast.success(checkoutType === 'normal' ? 'ส่งงานรอผู้ว่าจ้างอนุมัติแล้ว (อนุมัติอัตโนมัติใน 1 ชม.)' : 'ส่งคำขอจบงานกรณีพิเศษแล้ว รอผู้ว่าจ้างอนุมัติ');
      setCheckoutOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ส่งงานเสร็จไม่สำเร็จ');
    } finally {
      setCheckoutUploading(false);
      setActionLoading(null);
    }
  };

  const handleCancelJob = () => {
    setCancelOpen(true);
  };

  const handleConfirmCancel = async (reason: string) => {
    if (!jobId) return;
    setActionLoading('cancel');
    try {
      const hirerId = user?.id || 'demo-hirer';
      const res = await appApi.cancelJob(jobId, hirerId, reason);
      if (!res.success) {
        toast.error(res.error || 'ยกเลิกไม่สำเร็จ');
        return;
      }
      toast.success('ยกเลิกงานแล้ว');
      setCancelOpen(false);
      await load();
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenDispute = async () => {
    if (!jobId) return;
    setActionLoading('dispute');
    try {
      const existingRes = await appApi.getDisputeByJob(jobId);
      if (existingRes.success && existingRes.data?.dispute?.id) {
        navigate(`/dispute/${existingRes.data.dispute.id}`);
        return;
      }
    } finally {
      setActionLoading(null);
    }
    setDisputeOpen(true);
  };

  const handleConfirmDispute = async (reason: string) => {
    if (!jobId) return;
    setActionLoading('dispute');
    try {
      const openedBy = user?.id || 'demo-hirer';
      const res = await appApi.createDispute(jobId, openedBy, reason);
      if (!res.success || !res.data?.dispute?.id) {
        toast.error(res.error || 'เปิดข้อพิพาทไม่สำเร็จ');
        return;
      }
      toast.success('เปิดข้อพิพาทแล้ว');
      setDisputeOpen(false);
      navigate(`/dispute/${res.data.dispute.id}`);
    } finally {
      setActionLoading(null);
    }
  };

  const grouped = useMemo(() => messages, [messages]);
  const jobInstanceStatus = (job as any)?.job_status as string | undefined;
  const jobStatus = jobInstanceStatus || job?.status;
  const patientDisplayName = (job as any)?.patient_display_name as string | undefined;
  const caregiverName = (job as any)?.caregiver_name as string | undefined;
  const hirerName = (job as any)?.hirer_name as string | undefined;
  const location = [job?.address_line1, job?.district, job?.province].filter(Boolean).join(', ');
  const canCheckIn = user?.role === 'caregiver' && jobInstanceStatus === 'assigned';
  const canCheckOut = user?.role === 'caregiver' && jobInstanceStatus === 'in_progress';
  const statusLabelMap: Record<string, string> = {
    assigned: 'รอไปถึงที่หมาย',
    in_progress: 'กำลังทำงาน',
    completed: 'เสร็จสิ้น',
    cancelled: 'ยกเลิก',
    posted: 'รอผู้ดูแล',
    draft: 'แบบร่าง',
  };
  const jobStatusLabel = jobInstanceStatus ? (statusLabelMap[jobInstanceStatus] || jobInstanceStatus) : '-';
  const caregiverActionHint = canCheckIn
    ? 'เมื่อไปถึงสถานที่แล้ว ให้กด "มาถึงที่หมายแล้ว"'
    : canCheckOut
      ? 'เมื่อดูแลเสร็จ ให้กด "ส่งงานเสร็จ" เพื่อแจ้งผู้ว่าจ้าง'
      : 'ติดตามสถานะงานจากหน้านี้ได้ตลอดเวลา';
  const isChatLocked = jobStatus === 'cancelled' || thread?.status === 'closed';
  const chatLockMessage = jobStatus === 'cancelled'
    ? 'งานนี้ถูกยกเลิกแล้ว จึงไม่สามารถพิมพ์แชทต่อได้'
    : thread?.status === 'closed'
      ? 'ห้องแชทนี้ปิดแล้ว'
      : '';

  if (!jobId) {
    return (
      <ChatLayout>
        <Card padding="responsive">
          <p className="text-gray-700">ไม่พบรหัสงาน</p>
        </Card>
      </ChatLayout>
    );
  }

  return (
    <ChatLayout>
      <div className="max-w-3xl mx-auto w-full flex flex-col h-full min-h-0">
        {loading ? (
          <div className="flex-1 flex items-center justify-center px-4">
            <LoadingState message="กำลังโหลดแชท..." />
          </div>
        ) : !thread ? (
          <div className="flex-1 px-4 py-4">
            <Card padding="responsive">
              <p className="text-gray-700">ยังไม่มีห้องแชทสำหรับงานนี้</p>
              <p className="text-sm text-gray-500 mt-2">งานต้องถูก "รับงาน" ก่อนถึงจะเริ่มแชทได้</p>
            </Card>
          </div>
        ) : (
          <>
            {/* Fixed top cards (non-scrolling) */}
            <div className="flex-shrink-0 px-4 pt-3 space-y-3">
              {/* Job detail card - collapsible */}
              <Card className="p-3">
                <div
                  className="flex items-center justify-between gap-2 cursor-pointer"
                  onClick={() => setHeaderCollapsed((v) => !v)}
                >
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    <div className="font-semibold text-sm text-gray-900 line-clamp-1">{job?.title || 'งาน'}</div>
                    {jobStatus && <StatusBadge status={jobStatus as any} />}
                  </div>
                  <span className="text-xs text-gray-500 flex-shrink-0">{headerCollapsed ? '▼ แสดง' : '▲ ซ่อน'}</span>
                </div>

                {!headerCollapsed && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-600">
                      {user?.role === 'caregiver'
                        ? (hirerName ? `ผู้ว่าจ้าง: ${hirerName}` : '')
                        : (caregiverName ? `ผู้ดูแล: ${caregiverName}` : '')}
                      {patientDisplayName ? ` • ผู้รับการดูแล: ${patientDisplayName}` : ''}
                    </div>
                    <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                      <div>{formatDateTimeRange(job?.scheduled_start_at, job?.scheduled_end_at)}</div>
                      {location && <div>{location}</div>}
                    </div>
                    {jobStatus === 'cancelled' && cancelReasonDisplay && (
                      <div className="text-xs text-red-600 mt-1">เหตุผลการยกเลิก: {cancelReasonDisplay}</div>
                    )}
                    {disputeInfo?.reason && (
                      <div className="text-xs text-orange-700 mt-1">เหตุผลข้อพิพาท: {disputeInfo.reason}</div>
                    )}
                    <div className="mt-2 pt-2 border-t border-gray-100 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" disabled={!viewJobDetailId} onClick={handleViewJobDetail}>
                          ดูรายละเอียดงาน
                        </Button>
                        {jobStatus && jobStatus !== 'completed' && jobStatus !== 'cancelled' && (
                          <>
                          {disputeInfo?.id && (
                            <Button variant="outline" size="sm" onClick={() => navigate(`/dispute/${disputeInfo.id}`)}>
                              ไปข้อพิพาท{disputeInfo.status ? ` (${disputeInfo.status})` : ''}
                            </Button>
                          )}
                          <Button variant="outline" size="sm" disabled={!job} loading={actionLoading === 'cancel'} onClick={handleCancelJob}>
                            ยกเลิกงาน
                          </Button>
                          </>
                        )}
                      </div>
                      {jobStatus && jobStatus !== 'completed' && jobStatus !== 'cancelled' && !disputeInfo?.id && job?.job_id && (
                        <div className="pt-1 border-t border-orange-100">
                          <Button variant="outline" size="sm" disabled={!job} loading={actionLoading === 'dispute'} onClick={handleOpenDispute} className="border-orange-300 text-orange-700 hover:bg-orange-50">
                            เปิดข้อพิพาท
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>

              {user?.role === 'caregiver' && (
                <Card className="p-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!canCheckIn}
                      loading={actionLoading === 'checkin'}
                      onClick={handleCheckIn}
                    >
                      มาถึงที่หมายแล้ว
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!canCheckOut}
                      loading={actionLoading === 'checkout'}
                      onClick={handleOpenCheckout}
                    >
                      ส่งงานเสร็จ
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!canCheckOut}
                      onClick={handleOpenSpecialCheckout}
                    >
                      ขอจบงานกรณีพิเศษ
                    </Button>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">สถานะงาน: {jobStatusLabel}</div>
                  <div className="text-xs text-gray-500 mt-1">{caregiverActionHint}</div>
                </Card>
              )}

            </div>

            {/* Scrollable messages area */}
            <div
              ref={listRef}
              className="flex-1 overflow-y-auto min-h-0 px-4 py-3 space-y-3"
            >
              {grouped.length === 0 ? (
                <div className="text-center text-sm text-gray-500">ยังไม่มีข้อความ</div>
              ) : (
                grouped.map((m) => {
                  const isMine = !!user?.id && m.sender_id === user.id;
                  const bubble =
                    m.sender_id === null
                      ? 'bg-gray-100 text-gray-800'
                      : isMine
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-900';
                  const align = m.sender_id === null ? 'justify-center' : isMine ? 'justify-end' : 'justify-start';
                  const isImage = m.type === 'image' && (m as any).attachment_key;
                  return (
                    <div key={m.id} className={`flex ${align}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${bubble}`}>
                        {m.sender_id !== null && !isMine && (
                          <div className="text-xs opacity-80 mb-1">{(m as any).sender_role === 'hirer' ? 'ผู้ว่าจ้าง' : (m as any).sender_role === 'caregiver' ? 'ผู้ดูแล' : (m.sender_name || 'ผู้ใช้')}</div>
                        )}
                        {isImage ? (
                          <a href={`/uploads/${(m as any).attachment_key}`} target="_blank" rel="noreferrer">
                            <img
                              src={`/uploads/${(m as any).attachment_key}`}
                              alt="รูปภาพ"
                              className="max-w-[220px] max-h-[220px] rounded-lg object-cover cursor-pointer"
                            />
                          </a>
                        ) : (
                          <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                        )}
                        <div className="text-xs opacity-70 mt-1 text-right">{formatTime(m.created_at)}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Sticky bottom input bar */}
            <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 py-3 space-y-1">
              {isChatLocked && (
                <div className="text-xs text-red-600">{chatLockMessage}</div>
              )}
              <div className="flex gap-2 items-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleImageSend}
                  disabled={uploadingImage || isChatLocked}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage || isChatLocked}
                  className="flex-shrink-0 p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="แนบรูปภาพ"
                >
                  {uploadingImage ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  )}
                </button>
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={isChatLocked ? 'ไม่สามารถส่งข้อความได้' : 'พิมพ์ข้อความ...'}
                  fullWidth
                  disabled={sending || isChatLocked}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button variant="primary" loading={sending} disabled={isChatLocked} onClick={handleSend}>
                  ส่ง
                </Button>
              </div>
              {!isChatLocked && (
                <p className="text-xs text-gray-400">รูปภาพ: JPG, PNG, WebP, GIF ไม่เกิน 5 MB</p>
              )}
            </div>
          </>
        )}
        <ReasonModal
          isOpen={cancelOpen}
          onClose={() => setCancelOpen(false)}
          onConfirm={handleConfirmCancel}
          title="ยกเลิกงาน"
          description="กรุณาอธิบายเหตุผลที่ต้องการยกเลิกงาน เพื่อให้อีกฝ่ายเข้าใจ"
          placeholder="อธิบายเหตุผลในการยกเลิกงาน..."
          confirmText="ยืนยันยกเลิก"
          variant="danger"
          loading={actionLoading === 'cancel'}
          minLength={10}
          presetReasons={CANCEL_PRESETS}
        />
        <ReasonModal
          isOpen={disputeOpen}
          onClose={() => setDisputeOpen(false)}
          onConfirm={handleConfirmDispute}
          title="เปิดข้อพิพาท"
          description="กรุณาอธิบายปัญหาที่เกิดขึ้นอย่างละเอียด เพื่อให้แอดมินพิจารณาได้ถูกต้อง"
          placeholder="อธิบายเหตุผลในการเปิดข้อพิพาท..."
          confirmText="ยืนยันเปิดข้อพิพาท"
          variant="warning"
          loading={actionLoading === 'dispute'}
          minLength={10}
        />
        <Modal
          isOpen={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          title={checkoutType === 'special' ? 'ขอจบงานกรณีพิเศษ' : 'ส่งงานเสร็จ'}
          size="sm"
          footer={
            <div className="flex gap-3 justify-end">
              <button onClick={() => setCheckoutOpen(false)} disabled={!!actionLoading || checkoutUploading}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                กลับไป
              </button>
              <button onClick={handleConfirmCheckout}
                disabled={!!actionLoading || checkoutUploading || !checkoutPhoto || (!checkoutPreset && !checkoutNote.trim())}
                className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {checkoutUploading ? 'กำลังอัปโหลด...' : actionLoading === 'checkout' ? 'กำลังส่ง...' : 'ส่งคำขอ'}
              </button>
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-600">
              {checkoutType === 'special'
                ? 'ขอจบงานในกรณีพิเศษ เช่น ไม่สามารถอยู่ในโลเคชั่นที่กำหนดได้ ระบบจะส่งคำขอไปให้ผู้ว่าจ้างอนุมัติ หากไม่มีการตอบรับภายใน 1 ชม. ระบบจะอนุมัติอัตโนมัติ'
                : 'กรุณาเลือกสิ่งที่ทำเป็นหลักฐาน และแนบรูปภาพ ผู้ว่าจ้างต้องอนุมัติก่อน หากไม่ตอบรับภายใน 1 ชม. ระบบจะอนุมัติอัตโนมัติ'}
            </p>
            <div className="flex flex-wrap gap-2">
              {CHECKOUT_PRESETS.map((preset) => (
                <button key={preset} type="button" onClick={() => setCheckoutPreset(checkoutPreset === preset ? '' : preset)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    checkoutPreset === preset ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                  }`}>
                  {preset}
                </button>
              ))}
            </div>
            <Textarea label="รายละเอียดเพิ่มเติม (ถ้ามี)" fullWidth value={checkoutNote}
              onChange={(e) => setCheckoutNote(e.target.value)}
              placeholder="เช่น อาการผู้ป่วย ข้อสังเกต..." className="min-h-20" />
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">รูปภาพหลักฐาน <span className="text-red-500">*</span></div>
              {checkoutPhotoPreview ? (
                <div className="relative">
                  <img src={checkoutPhotoPreview} alt="หลักฐาน" className="w-full max-h-48 object-cover rounded-lg border border-gray-200" />
                  <button type="button" onClick={() => { setCheckoutPhoto(null); setCheckoutPhotoPreview(null); }}
                    className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full bg-gray-900/60 text-white hover:bg-gray-900/80">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => checkoutPhotoInputRef.current?.click()}
                  className="w-full flex flex-col items-center gap-2 p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50/40 transition-colors text-gray-500 hover:text-blue-600">
                  <Camera className="w-8 h-8" />
                  <span className="text-sm font-medium">กดเพื่อเลือกรูปภาพ</span>
                  <span className="text-xs text-gray-400">JPG, PNG, WebP (ไม่เกิน 10 MB)</span>
                </button>
              )}
              <input ref={checkoutPhotoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setCheckoutPhoto(file);
                  const reader = new FileReader();
                  reader.onload = (ev) => setCheckoutPhotoPreview(ev.target?.result as string);
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }} />
            </div>
          </div>
        </Modal>
      </div>
    </ChatLayout>
  );
}

