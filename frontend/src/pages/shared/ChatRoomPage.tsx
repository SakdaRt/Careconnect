import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';
import { ChatLayout } from '../../layouts';
import { Button, Card, Input, LoadingState, ReasonModal, StatusBadge } from '../../components/ui';
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
  const listRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [cancelReasonDisplay, setCancelReasonDisplay] = useState<string>('');

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

  const handleCheckOut = async (evidenceNote: string) => {
    if (!jobId || !evidenceNote.trim()) return;
    setActionLoading('checkout');
    try {
      const caregiverId = user?.id || 'demo-caregiver';
      let gps: { lat: number; lng: number; accuracy_m: number } = { lat: 0, lng: 0, accuracy_m: 0 };
      try {
        const raw = await getCurrentGps();
        gps = { lat: raw.lat, lng: raw.lng, accuracy_m: raw.accuracy_m ?? 0 };
      } catch { /* checkout allowed anywhere */ }
      const res = await appApi.checkOut(jobId, caregiverId, gps, evidenceNote.trim());
      if (!res.success) {
        toast.error(res.error || 'ส่งงานเสร็จไม่สำเร็จ');
        return;
      }
      toast.success('ส่งงานเสร็จแล้ว');
      setCheckoutOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ส่งงานเสร็จไม่สำเร็จ');
    } finally {
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
        <Card className="p-6">
          <p className="text-gray-700">ไม่พบรหัสงาน</p>
        </Card>
      </ChatLayout>
    );
  }

  return (
    <ChatLayout>
      <div className="max-w-3xl mx-auto px-4 py-4">
        {loading ? (
          <LoadingState message="กำลังโหลดแชท..." />
        ) : !thread ? (
          <Card className="p-6">
            <p className="text-gray-700">ยังไม่มีห้องแชทสำหรับงานนี้</p>
            <p className="text-sm text-gray-500 mt-2">งานต้องถูก “รับงาน” ก่อนถึงจะเริ่มแชทได้</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-semibold text-gray-900 line-clamp-1">{job?.title || 'งาน'}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    {user?.role === 'caregiver'
                      ? (hirerName ? `ผู้ว่าจ้าง: ${hirerName}` : '')
                      : (caregiverName ? `ผู้ดูแล: ${caregiverName}` : '')}
                    {patientDisplayName ? ` • ผู้รับการดูแล: ${patientDisplayName}` : ''}
                  </div>
                </div>
                {jobStatus && <StatusBadge status={jobStatus as any} />}
              </div>
              <div className="text-xs text-gray-600 space-y-0.5">
                <div>{formatDateTimeRange(job?.scheduled_start_at, job?.scheduled_end_at)}</div>
                {location && <div>{location}</div>}
              </div>
              {jobStatus === 'cancelled' && cancelReasonDisplay && (
                <div className="text-xs text-red-700 mt-2">เหตุผลการยกเลิก: {cancelReasonDisplay}</div>
              )}
              {disputeInfo?.reason && (
                <div className="text-xs text-orange-700 mt-1">เหตุผลข้อพิพาท: {disputeInfo.reason}</div>
              )}
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
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
                  {!disputeInfo?.id && job?.job_id && (
                    <Button variant="outline" size="sm" disabled={!job} loading={actionLoading === 'dispute'} onClick={handleOpenDispute}>
                      เปิดข้อพิพาท
                    </Button>
                  )}
                  <Button variant="outline" size="sm" disabled={!job} loading={actionLoading === 'cancel'} onClick={handleCancelJob}>
                    ยกเลิกงาน
                  </Button>
                  </>
                )}
              </div>
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
                    onClick={() => setCheckoutOpen(true)}
                  >
                    ส่งงานเสร็จ
                  </Button>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  สถานะงาน: {jobStatusLabel}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {caregiverActionHint}
                </div>
              </Card>
            )}

            <div
              ref={listRef}
              className="bg-white border border-gray-200 rounded-lg h-[60vh] overflow-y-auto p-4 space-y-3"
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
                  return (
                    <div key={m.id} className={`flex ${align}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${bubble}`}>
                        {m.sender_id !== null && !isMine && (
                          <div className="text-[11px] opacity-80 mb-1">{(m as any).sender_role === 'hirer' ? 'ผู้ว่าจ้าง' : (m as any).sender_role === 'caregiver' ? 'ผู้ดูแล' : (m.sender_name || 'ผู้ใช้')}</div>
                        )}
                        <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                        <div className="text-[11px] opacity-70 mt-1 text-right">{formatTime(m.created_at)}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex gap-2">
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
            {isChatLocked && (
              <div className="text-xs text-red-600">{chatLockMessage}</div>
            )}
          </div>
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
        <ReasonModal
          isOpen={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          onConfirm={handleCheckOut}
          title="ส่งงานเสร็จ"
          description="กรุณาสรุปงานที่ทำเป็นหลักฐาน เช่น สิ่งที่ดูแล อาการผู้ป่วย ข้อสังเกต"
          placeholder="สรุปงานที่ทำ เช่น อาบน้ำ ป้อนอาหาร วัดความดัน..."
          confirmText="ยืนยันส่งงาน"
          variant="primary"
          loading={actionLoading === 'checkout'}
          minLength={10}
        />
      </div>
    </ChatLayout>
  );
}

