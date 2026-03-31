import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MainLayout } from '../../layouts';
import { Button, Card, Input, LoadingState } from '../../components/ui';
import { DisputeMessage } from '../../services/api';
import { appApi } from '../../services/appApi';
import { useAuth } from '../../contexts';

function formatDateTime(iso?: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('th-TH');
}

function DisputeStatusBadge({ status }: { status: string }) {
  const cls =
    status === 'open'
      ? 'bg-yellow-100 text-yellow-800'
      : status === 'in_review'
        ? 'bg-blue-100 text-blue-800'
        : status === 'resolved'
          ? 'bg-green-100 text-green-800'
          : status === 'rejected'
            ? 'bg-red-100 text-red-800'
            : 'bg-gray-100 text-gray-800';
  return <span className={`text-xs px-2 py-1 rounded ${cls}`}>{status}</span>;
}

export default function DisputeChatPage() {
  const navigate = useNavigate();
  const { disputeId } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dispute, setDispute] = useState<any>(null);
  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    if (!disputeId) return;
    setLoading(true);
    try {
      const res = await appApi.getDispute(disputeId);
      if (!res.success || !res.data) {
        toast.error(res.error || 'โหลดข้อพิพาทไม่สำเร็จ');
        setDispute(null);
        setMessages([]);
        setEvents([]);
        return;
      }
      setDispute(res.data.dispute);
      setMessages(res.data.messages || []);
      setEvents(res.data.events || []);
    } finally {
      setLoading(false);
    }
  }, [disputeId]);

  useEffect(() => {
    load();
  }, [load]);

  const canSend = useMemo(() => {
    const s = String(dispute?.status || '');
    return s === 'open' || s === 'in_review';
  }, [dispute?.status]);

  const requestClose = async () => {
    if (!disputeId) return;
    const reason = window.prompt('เหตุผลที่ขอปิดข้อพิพาท (ถ้ามี)');
    const actorId = user?.id || 'demo-user';
    const res = await appApi.requestDisputeClose(disputeId, { id: actorId }, reason || undefined);
    if (!res.success) {
      toast.error(res.error || 'ส่งคำขอปิดไม่สำเร็จ');
      return;
    }
    toast.success('ส่งคำขอปิดแล้ว');
    await load();
  };

  const handleImageSend = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !disputeId) return;
    if (!canSend) { toast.error('ไม่สามารถส่งรูปภาพได้'); return; }
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await appApi.uploadDisputeImage(disputeId, formData);
      if (!uploadRes.success || !uploadRes.data?.attachment_key) {
        toast.error(uploadRes.error || 'อัปโหลดรูปภาพไม่สำเร็จ');
        return;
      }
      const attachmentKey = uploadRes.data.attachment_key;
      const sender = { id: user?.id || '', role: user?.role || 'hirer' };
      const res = await appApi.postDisputeMessage(disputeId, sender, '', attachmentKey);
      if (!res.success || !res.data?.message) {
        toast.error(res.error || 'ส่งรูปภาพไม่สำเร็จ');
        return;
      }
      setMessages((prev) => [...prev, res.data!.message]);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSend = async () => {
    if (!disputeId) return;
    const content = text.trim();
    if (!content) return;
    if (!canSend) {
      toast.error('ข้อพิพาทถูกปิดแล้ว');
      return;
    }
    setSending(true);
    try {
      const sender = {
        id: user?.id || '',
        role: user?.role || 'hirer',
      };
      const res = await appApi.postDisputeMessage(disputeId, sender, content);
      if (!res.success || !res.data?.message) {
        toast.error(res.error || 'ส่งข้อความไม่สำเร็จ');
        return;
      }
      setText('');
      setMessages((prev) => [...prev, res.data!.message]);
    } finally {
      setSending(false);
    }
  };

  return (
    <MainLayout showBottomBar={false}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3 mb-6">
          <Button variant="outline" onClick={() => navigate(-1)}>
            ย้อนกลับ
          </Button>
          <Button variant="outline" onClick={load}>
            รีเฟรช
          </Button>
        </div>

        {loading ? (
          <LoadingState message="กำลังโหลดข้อพิพาท..." />
        ) : !dispute ? (
          <Card padding="responsive">
            <div className="text-sm text-gray-700">ไม่พบข้อพิพาท</div>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card padding="responsive">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-gray-500">ข้อพิพาท</div>
                  <div className="text-lg font-semibold text-gray-900">{dispute.title || 'Dispute'}</div>
                  <div className="text-xs text-gray-600 mt-1">สร้าง: {formatDateTime(dispute.created_at)} • อัปเดต: {formatDateTime(dispute.updated_at)}</div>
                </div>
                <DisputeStatusBadge status={String(dispute.status)} />
              </div>
              <div className="text-sm text-gray-800 mt-3">เหตุผล: {dispute.reason}</div>
              {dispute.assigned_admin_id && <div className="text-xs text-gray-600 mt-2">ผู้ดูแลเรื่อง: {String(dispute.assigned_admin_id)}</div>}
              {dispute.resolution && <div className="text-sm text-gray-800 mt-2">ผลการตัดสิน: {String(dispute.resolution)}</div>}
              {(Number(dispute.settlement_refund_amount || 0) > 0 || Number(dispute.settlement_payout_amount || 0) > 0) && (
                <div className="text-xs text-gray-600 mt-2">
                  settlement • refund:{Number(dispute.settlement_refund_amount || 0).toLocaleString()} • payout:{Number(dispute.settlement_payout_amount || 0).toLocaleString()}
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                {canSend && (
                  <Button variant="outline" size="sm" onClick={requestClose}>
                    ขอปิดข้อพิพาท
                  </Button>
                )}
              </div>
            </Card>

            <Card padding="responsive">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">ข้อความ</h2>
              {messages.length === 0 ? (
                <div className="text-sm text-gray-600">ยังไม่มีข้อความ</div>
              ) : (
                <div className="space-y-3">
                  {messages.map((m) => (
                    <div key={m.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="text-xs text-gray-500">
                        {m.is_system_message ? 'ระบบ' : m.sender_role === 'hirer' ? 'ผู้ว่าจ้าง' : m.sender_role === 'caregiver' ? 'ผู้ดูแล' : m.sender_role === 'admin' ? 'แอดมิน' : 'ผู้ใช้'} • {formatDateTime(m.created_at)}
                      </div>
                      {m.type === 'image' && (m as any).attachment_key ? (
                        <a href={`/uploads/${(m as any).attachment_key}`} target="_blank" rel="noreferrer" className="mt-1 block">
                          <img
                            src={`/uploads/${(m as any).attachment_key}`}
                            alt="รูปภาพ"
                            className="max-w-[240px] max-h-[240px] rounded-lg object-cover cursor-pointer"
                          />
                        </a>
                      ) : (
                        <div className="text-sm text-gray-800 mt-1 whitespace-pre-wrap">{m.content || ''}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleImageSend}
                  disabled={uploadingImage || !canSend}
                />
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <Input
                      label="พิมพ์ข้อความ"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={canSend ? 'พิมพ์ข้อความ...' : 'ข้อพิพาทถูกปิดแล้ว'}
                      disabled={!canSend}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSend();
                      }}
                    />
                  </div>
                  <div className="sm:self-end flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage || !canSend}
                      className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-gray-300"
                      title="แนบรูปภาพ"
                    >
                      {uploadingImage ? (
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      )}
                    </button>
                    <Button variant="primary" loading={sending} disabled={!canSend} onClick={handleSend}>
                      ส่ง
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            <Card padding="responsive">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h2>
              {events.length === 0 ? (
                <div className="text-sm text-gray-600">ยังไม่มีเหตุการณ์</div>
              ) : (
                <div className="space-y-3">
                  {events.map((e: any) => (
                    <div key={e.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="text-xs text-gray-500">
                        {e.event_type} • {formatDateTime(e.created_at)}
                      </div>
                      <div className="text-sm text-gray-800 mt-1 whitespace-pre-wrap">{e.message}</div>
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

