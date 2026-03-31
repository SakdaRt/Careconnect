import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../../layouts';
import { Button, Card, Input, LoadingState } from '../../components/ui';
import api, { AdminDisputeEvent, AdminDisputeListItem, DisputeMessage } from '../../services/api';

function formatDateTime(iso?: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('th-TH');
}

function DisputeStatusBadge({ status }: { status: AdminDisputeListItem['status'] | string }) {
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
  return <span className={`text-xs px-2 py-1 rounded ${cls}`}>{String(status)}</span>;
}

const COMPLAINT_CATEGORY_LABELS: Record<string, string> = {
  inappropriate_name: 'ชื่อไม่เหมาะสม',
  inappropriate_photo: 'รูปภาพไม่เหมาะสม',
  inappropriate_chat: 'ข้อความ/แชทไม่เหมาะสม',
  scam_fraud: 'หลอกลวง/ฉ้อโกง',
  harassment: 'คุกคาม/ข่มขู่',
  safety_concern: 'ความปลอดภัย',
  payment_issue: 'ปัญหาการเงิน',
  service_quality: 'คุณภาพบริการ',
  fake_certificate: 'ใบรับรองปลอม/เอกสารไม่น่าเชื่อถือ',
  other: 'อื่นๆ',
};

export default function AdminDisputesPage() {
  const [activeTab, setActiveTab] = useState<'disputes' | 'complaints'>('disputes');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AdminDisputeListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | string>('all');
  const [assigned, setAssigned] = useState<'all' | 'me' | 'unassigned'>('all');

  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [complaintsPage, setComplaintsPage] = useState(1);
  const [complaintsTotalPages, setComplaintsTotalPages] = useState(1);
  const [complaintsStatus, setComplaintsStatus] = useState<string>('');
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [complaintAdminNote, setComplaintAdminNote] = useState('');

  const [selected, setSelected] = useState<AdminDisputeListItem | null>(null);
  const [events, setEvents] = useState<AdminDisputeEvent[]>([]);
  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [note, setNote] = useState('');
  const [chatText, setChatText] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [resolution, setResolution] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.adminGetDisputes({
        q: q.trim() || undefined,
        status: status === 'all' ? undefined : status,
        assigned: assigned === 'all' ? undefined : assigned,
        page,
        limit: 20,
      });
      if (!res.success || !res.data) {
        toast.error(res.error || 'โหลดข้อมูลไม่สำเร็จ');
        setItems([]);
        setTotalPages(1);
        return;
      }
      setItems(res.data.data || []);
      setTotalPages(res.data.totalPages || 1);
    } finally {
      setLoading(false);
    }
  }, [assigned, page, q, status]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (id: string) => {
    setSelected(null);
    setEvents([]);
    setMessages([]);
    setNote('');
    setChatText('');
    setRefundAmount('');
    setPayoutAmount('');
    setResolution('');
    const res = await api.adminGetDispute(id);
    if (!res.success || !res.data) {
      toast.error(res.error || 'โหลดข้อพิพาทไม่สำเร็จ');
      return;
    }
    setSelected(res.data.dispute);
    setEvents(res.data.events || []);
    setMessages(res.data.messages || []);
  };

  const doUpdate = async (id: string, input: { status?: string; note?: string; assign_to_me?: boolean }) => {
    setActionLoading(id);
    try {
      const res = await api.adminUpdateDispute(id, input);
      if (!res.success) {
        toast.error(res.error || 'อัปเดตไม่สำเร็จ');
        return;
      }
      toast.success('อัปเดตแล้ว');
      await openDetail(id);
      await load();
    } finally {
      setActionLoading(null);
    }
  };

  const statusLabel = (s: string) => {
    if (s === 'open') return 'open';
    if (s === 'in_review') return 'in_review';
    if (s === 'resolved') return 'resolved';
    if (s === 'rejected') return 'rejected';
    return s;
  };

  const selectedHeader = useMemo(() => {
    if (!selected) return null;
    return {
      title: selected.title || 'Dispute',
      status: selected.status,
      dispute_id: selected.id,
      job_post_id: selected.job_post_id,
      job_id: selected.job_id,
      caregiver_id: (selected as any).caregiver_id as string | null | undefined,
      hirer_name: selected.hirer_name || null,
      caregiver_name: selected.caregiver_name || null,
      created_at: selected.created_at,
      updated_at: selected.updated_at,
      resolved_at: selected.resolved_at,
      reason: selected.reason,
      assigned_admin_id: selected.assigned_admin_id,
    };
  }, [selected]);

  const hasCaregiver = useMemo(() => {
    if (!selectedHeader) return false;
    return !!(selectedHeader.caregiver_id || selectedHeader.caregiver_name);
  }, [selectedHeader]);

  const canSendChat = useMemo(() => {
    if (!selectedHeader) return false;
    if (!['open', 'in_review'].includes(String(selectedHeader.status))) return false;
    return true;
  }, [selectedHeader]);

  const handleAdminImageSend = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedHeader) return;
    if (!canSendChat) { toast.error('ไม่สามารถส่งรูปภาพได้'); return; }
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await api.uploadDisputeImage(selectedHeader.dispute_id, formData);
      if (!uploadRes.success || !uploadRes.data?.attachment_key) {
        toast.error(uploadRes.error || 'อัปโหลดรูปภาพไม่สำเร็จ');
        return;
      }
      const attachmentKey = uploadRes.data.attachment_key;
      const res = await api.postDisputeMessage(selectedHeader.dispute_id, '', attachmentKey);
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

  const sendChat = async () => {
    if (!selectedHeader) return;
    const text = chatText.trim();
    if (!text) return;
    if (!canSendChat) {
      toast.error('ส่งข้อความไม่สำเร็จ');
      return;
    }
    setActionLoading(selectedHeader.dispute_id);
    try {
      const res = await api.postDisputeMessage(selectedHeader.dispute_id, text);
      if (!res.success || !res.data?.message) {
        toast.error(res.error || 'ส่งข้อความไม่สำเร็จ');
        return;
      }
      setChatText('');
      setMessages((prev) => [...prev, res.data!.message]);
      await load();
    } finally {
      setActionLoading(null);
    }
  };

  const settle = async () => {
    if (!selectedHeader) return;
    const refund = refundAmount.trim() ? Number(refundAmount) : undefined;
    const payout = hasCaregiver && payoutAmount.trim() ? Number(payoutAmount) : undefined;
    const resText = resolution.trim() || undefined;
    if (!refund && !payout && !resText) {
      toast.error('กรุณากรอก refund / payout / resolution อย่างน้อย 1 อย่าง');
      return;
    }
    const confirmed = window.confirm(
      `ยืนยันปิดเรื่องและทำรายการ?\nrefund: ${refund || 0}\npayout: ${payout || 0}\nresolution: ${resText || '-'}`
    );
    if (!confirmed) return;
    setActionLoading(selectedHeader.dispute_id);
    try {
      const idempotencyKey = crypto.randomUUID();
      const res = await api.adminSettleDispute(selectedHeader.dispute_id, {
        refund_amount: refund,
        payout_amount: payout,
        resolution: resText,
        idempotency_key: idempotencyKey,
      });
      if (!res.success) {
        toast.error(res.error || 'ปิดเรื่องไม่สำเร็จ');
        return;
      }
      toast.success('ปิดเรื่องแล้ว');
      await openDetail(selectedHeader.dispute_id);
      await load();
    } finally {
      setActionLoading(null);
    }
  };

  const loadComplaints = useCallback(async () => {
    setComplaintsLoading(true);
    try {
      const res = await api.adminGetComplaints({
        status: complaintsStatus || undefined,
        page: complaintsPage,
        limit: 20,
      });
      if (!res.success || !res.data) {
        setComplaints([]);
        setComplaintsTotalPages(1);
        return;
      }
      setComplaints(res.data.data || []);
      setComplaintsTotalPages(res.data.totalPages || 1);
    } finally {
      setComplaintsLoading(false);
    }
  }, [complaintsStatus, complaintsPage]);

  useEffect(() => {
    if (activeTab === 'complaints') loadComplaints();
  }, [activeTab, loadComplaints]);

  const handleComplaintUpdate = async (id: string, input: { status?: string; admin_note?: string; assign_to_me?: boolean }) => {
    setActionLoading(id);
    try {
      const res = await api.adminUpdateComplaint(id, input);
      if (!res.success) { toast.error(res.error || 'อัปเดตไม่สำเร็จ'); return; }
      toast.success('อัปเดตแล้ว');
      if (res.data?.complaint) setSelectedComplaint(res.data.complaint);
      await loadComplaints();
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex gap-2 mb-2">
          <button
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'disputes' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            onClick={() => setActiveTab('disputes')}
          >
            ข้อพิพาท (Disputes)
          </button>
          <button
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === 'complaints' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            onClick={() => setActiveTab('complaints')}
          >
            ร้องเรียนทั่วไป (Complaints)
          </button>
        </div>

        {activeTab === 'complaints' && (
          <div className="space-y-4">
            <Card padding="responsive">
              <div className="flex gap-3 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">สถานะ</label>
                  <select className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm" value={complaintsStatus} onChange={(e) => { setComplaintsStatus(e.target.value); setComplaintsPage(1); }}>
                    <option value="">ทั้งหมด</option>
                    <option value="open">open</option>
                    <option value="in_review">in_review</option>
                    <option value="resolved">resolved</option>
                    <option value="dismissed">dismissed</option>
                  </select>
                </div>
                <Button variant="primary" onClick={() => { setComplaintsPage(1); loadComplaints(); }}>ค้นหา</Button>
              </div>
            </Card>

            {complaintsLoading ? <LoadingState message="กำลังโหลด..." /> : complaints.length === 0 ? (
              <Card padding="lg" className="text-center text-sm text-gray-600">ยังไม่มีเรื่องร้องเรียน</Card>
            ) : (
              <div className="space-y-3">
                {complaints.map((c: any) => (
                  <Card key={c.id} className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setSelectedComplaint(c); setComplaintAdminNote(c.admin_note || ''); }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-gray-900 text-sm">{c.subject}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          ประเภท: {COMPLAINT_CATEGORY_LABELS[c.category] || c.category} • ผู้แจ้ง: {c.reporter_name || c.reporter_email || c.reporter_id}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">สร้าง: {formatDateTime(c.created_at)}</div>
                      </div>
                      <DisputeStatusBadge status={c.status} />
                    </div>
                  </Card>
                ))}
                <div className="flex justify-center gap-2 mt-2">
                  <Button variant="outline" size="sm" disabled={complaintsPage <= 1} onClick={() => setComplaintsPage((p) => p - 1)}>ก่อนหน้า</Button>
                  <span className="text-sm text-gray-600 self-center">{complaintsPage}/{complaintsTotalPages}</span>
                  <Button variant="outline" size="sm" disabled={complaintsPage >= complaintsTotalPages} onClick={() => setComplaintsPage((p) => p + 1)}>ถัดไป</Button>
                </div>
              </div>
            )}

            {selectedComplaint && (
              <Card padding="responsive" className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-gray-900">{selectedComplaint.subject}</h3>
                    <div className="text-xs text-gray-600 mt-1">ประเภท: {COMPLAINT_CATEGORY_LABELS[selectedComplaint.category] || selectedComplaint.category}</div>
                    <div className="text-xs text-gray-500">ผู้แจ้ง: {selectedComplaint.reporter_name || selectedComplaint.reporter_email || selectedComplaint.reporter_id} ({selectedComplaint.reporter_role || '-'})</div>
                    {selectedComplaint.target_user_id && <div className="text-xs text-gray-500">ผู้ถูกร้องเรียน: {selectedComplaint.target_name || selectedComplaint.target_user_id}</div>}
                  </div>
                  <DisputeStatusBadge status={selectedComplaint.status} />
                </div>
                <div className="text-sm text-gray-800 whitespace-pre-wrap">{selectedComplaint.description}</div>
                {selectedComplaint.attachments && selectedComplaint.attachments.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-1">ไฟล์แนบ:</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedComplaint.attachments.map((a: any) => (
                        <a key={a.id} href={`/uploads/${a.file_path}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">{a.file_name}</a>
                      ))}
                    </div>
                  </div>
                )}
                {selectedComplaint.admin_note && <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">หมายเหตุแอดมิน: {selectedComplaint.admin_note}</div>}
                <div className="space-y-2 pt-2 border-t border-gray-200">
                  <Input label="หมายเหตุแอดมิน" value={complaintAdminNote} onChange={(e) => setComplaintAdminNote(e.target.value)} placeholder="บันทึกสำหรับแอดมิน" />
                  <div className="flex flex-wrap gap-2">
                    {!selectedComplaint.assigned_admin_id && <Button variant="outline" size="sm" loading={actionLoading === selectedComplaint.id} onClick={() => handleComplaintUpdate(selectedComplaint.id, { assign_to_me: true })}>รับเรื่อง</Button>}
                    <Button variant="outline" size="sm" loading={actionLoading === selectedComplaint.id} onClick={() => handleComplaintUpdate(selectedComplaint.id, { status: 'in_review', admin_note: complaintAdminNote || undefined })}>เปลี่ยนเป็น in_review</Button>
                    <Button variant="primary" size="sm" loading={actionLoading === selectedComplaint.id} onClick={() => handleComplaintUpdate(selectedComplaint.id, { status: 'resolved', admin_note: complaintAdminNote || undefined })}>ปิดเรื่อง (resolved)</Button>
                    <Button variant="ghost" size="sm" loading={actionLoading === selectedComplaint.id} onClick={() => handleComplaintUpdate(selectedComplaint.id, { status: 'dismissed', admin_note: complaintAdminNote || undefined })}>ยกเลิก (dismissed)</Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedComplaint(null)}>ปิด</Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'disputes' && <><Card padding="responsive">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="flex-1">
              <Input
                label="ค้นหา"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหา dispute_id / job_post_id / job_id / title / ชื่อ"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setPage(1);
                    load();
                  }
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Status</label>
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">ทั้งหมด</option>
                <option value="open">open</option>
                <option value="in_review">in_review</option>
                <option value="resolved">resolved</option>
                <option value="rejected">rejected</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Assign</label>
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                value={assigned}
                onChange={(e) => {
                  setAssigned(e.target.value as any);
                  setPage(1);
                }}
              >
                <option value="all">ทั้งหมด</option>
                <option value="me">Assigned to me</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  setPage(1);
                  load();
                }}
              >
                ค้นหา
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setQ('');
                  setStatus('all');
                  setAssigned('all');
                  setPage(1);
                }}
              >
                ล้าง
              </Button>
              <Button variant="outline" onClick={load}>
                รีเฟรช
              </Button>
            </div>
          </div>
        </Card>

        {selectedHeader && (
          <Card padding="responsive">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-gray-500">ข้อพิพาท</div>
                <div className="text-lg font-semibold text-gray-900">{selectedHeader.title}</div>
                <div className="text-xs text-gray-600 mt-1">
                  {selectedHeader.hirer_name ? `ผู้ว่าจ้าง: ${selectedHeader.hirer_name}` : ''}
                  {selectedHeader.caregiver_name ? ` • ผู้ดูแล: ${selectedHeader.caregiver_name}` : ''}
                </div>
                <div className="text-xs text-gray-600 mt-1">สร้าง: {formatDateTime(selectedHeader.created_at)} • อัปเดต: {formatDateTime(selectedHeader.updated_at)}</div>
                {selectedHeader.resolved_at && <div className="text-xs text-gray-600 mt-1">ปิดเรื่อง: {formatDateTime(selectedHeader.resolved_at)}</div>}
                <div className="text-xs text-gray-700 mt-2">เหตุผล: {selectedHeader.reason}</div>
                <div className="text-[11px] text-gray-500 mt-2 font-mono break-all">dispute: {selectedHeader.dispute_id}</div>
                <div className="text-[11px] text-gray-500 mt-1 font-mono break-all">job_post: {selectedHeader.job_post_id}</div>
                {selectedHeader.job_id && <div className="text-[11px] text-gray-500 mt-1 font-mono break-all">job: {selectedHeader.job_id}</div>}
              </div>
            <div className="flex items-center gap-2">
                <DisputeStatusBadge status={selectedHeader.status} />
                <Button variant="outline" size="sm" onClick={() => { setSelected(null); setEvents([]); }}>
                  ปิด
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                loading={actionLoading === selectedHeader.dispute_id}
                onClick={() => doUpdate(selectedHeader.dispute_id, { status: 'rejected' })}
              >
                ปฏิเสธข้อพิพาท
              </Button>
              <Link to={`/admin/jobs?q=${selectedHeader.job_post_id}`}>
                <Button variant="outline" size="sm">ดูงานในระบบ</Button>
              </Link>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              หากต้องการปิดเรื่องพร้อมคืนเงิน/จ่ายเงิน ให้ใช้ส่วน "ปิดเรื่องและชำระเงิน" ด้านล่าง
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Card padding="responsive">
                <div className="text-sm font-semibold text-gray-900 mb-2">เพิ่มโน้ต</div>
                <Input label="โน้ต" value={note} onChange={(e) => setNote(e.target.value)} placeholder="พิมพ์โน้ตของแอดมิน" />
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="primary"
                    size="sm"
                    loading={actionLoading === selectedHeader.dispute_id}
                    onClick={() => {
                      const n = note.trim();
                      if (!n) {
                        toast.error('กรุณากรอกโน้ต');
                        return;
                      }
                      setNote('');
                      doUpdate(selectedHeader.dispute_id, { note: n });
                    }}
                  >
                    บันทึกโน้ต
                  </Button>
                </div>
              </Card>

              <Card padding="responsive">
                <div className="text-sm font-semibold text-gray-900 mb-2">Timeline</div>
                {events.length === 0 ? (
                  <div className="text-sm text-gray-600">ยังไม่มีเหตุการณ์</div>
                ) : (
                  <div className="space-y-3">
                    {events.map((e) => (
                      <div key={e.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="text-xs text-gray-500">
                          {e.event_type} • {formatDateTime(e.created_at)}
                        </div>
                        <div className="text-sm text-gray-800 mt-1">{e.message}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <Card padding="responsive" className="mt-3">
              <div className="text-sm font-semibold text-gray-900 mb-2">ข้อความ</div>
              {messages.length === 0 ? (
                <div className="text-sm text-gray-600">ยังไม่มีข้อความ</div>
              ) : (
                <div className="space-y-2">
                  {messages.map((m) => (
                    <div key={m.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="text-xs text-gray-500">
                        {m.is_system_message ? 'system' : m.sender_email || m.sender_role || 'user'} • {formatDateTime(m.created_at)}
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

              <div className="mt-3 space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAdminImageSend}
                  disabled={uploadingImage || !canSendChat}
                />
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <Input
                      label="ส่งข้อความ (admin)"
                      value={chatText}
                      onChange={(e) => setChatText(e.target.value)}
                      placeholder={canSendChat ? 'พิมพ์ข้อความ...' : 'ไม่สามารถส่งข้อความได้'}
                      disabled={!canSendChat}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') sendChat();
                      }}
                    />
                  </div>
                  <div className="sm:self-end flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage || !canSendChat}
                      className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-gray-300"
                      title="แนบรูปภาพ"
                    >
                      {uploadingImage ? (
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      )}
                    </button>
                    <Button variant="primary" size="sm" disabled={!canSendChat} loading={actionLoading === selectedHeader.dispute_id} onClick={sendChat}>
                      ส่ง
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            <Card padding="responsive" className="mt-3">
              <div className="text-sm font-semibold text-gray-900 mb-1">ปิดเรื่องและชำระเงิน</div>
              <div className="text-xs text-gray-500 mb-3">กรอกจำนวนเงินที่จะคืน/จ่าย แล้วกด "ปิดเรื่องและทำรายการ" — ระบบจะสร้าง ledger อัตโนมัติและเปลี่ยนสถานะเป็น resolved</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="คืนเงินให้ผู้ว่าจ้าง (บาท)"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  inputMode="numeric"
                  placeholder="0"
                />
                <Input
                  label="จ่ายให้ผู้ดูแล (บาท)"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  inputMode="numeric"
                  placeholder="0"
                  disabled={!hasCaregiver}
                  helperText={!hasCaregiver ? 'ยังไม่มี caregiver ที่ active ในงานนี้' : undefined}
                />
                <Input
                  label="สรุปการตัดสิน"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="เช่น คืนเงินเต็มจำนวนเพราะผู้ดูแลไม่มาตามนัด"
                />
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button
                  variant="primary"
                  size="sm"
                  loading={actionLoading === selectedHeader.dispute_id}
                  onClick={settle}
                  disabled={!['open', 'in_review'].includes(String(selectedHeader.status))}
                >
                  ปิดเรื่องและทำรายการ
                </Button>
                <Link to={`/admin/reports?reference_type=dispute&reference_id=${selectedHeader.dispute_id}`}>
                  <Button variant="outline" size="sm">
                    ดูรายการเงินของเรื่องนี้
                  </Button>
                </Link>
              </div>
            </Card>
          </Card>
        )}

        <Card className="p-0 overflow-hidden">
          {loading ? (
            <div className="p-6">
              <LoadingState message="กำลังโหลดข้อพิพาท..." />
            </div>
          ) : items.length === 0 ? (
            <div className="p-6 text-sm text-gray-600">ไม่พบข้อพิพาท</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {items.map((d) => (
                <div key={d.id} className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-gray-900 line-clamp-1">{d.title || 'Dispute'}</div>
                      <DisputeStatusBadge status={statusLabel(d.status)} />
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {d.hirer_name ? `ผู้ว่าจ้าง: ${d.hirer_name}` : ''}
                      {d.caregiver_name ? ` • ผู้ดูแล: ${d.caregiver_name}` : ''}
                      {d.opened_by_role ? ` • opened_by:${d.opened_by_role}` : ''}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">เหตุผล: {d.reason}</div>
                    <div className="text-[11px] text-gray-500 mt-2 font-mono break-all">dispute: {d.id}</div>
                    <div className="text-[11px] text-gray-500 mt-1 font-mono break-all">job_post: {d.job_post_id}</div>
                    {d.job_id && <div className="text-[11px] text-gray-500 mt-1 font-mono break-all">job: {d.job_id}</div>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openDetail(d.id)}>
                      รายละเอียด
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="p-4 border-t border-gray-200 flex items-center justify-between gap-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              ก่อนหน้า
            </Button>
            <div className="text-xs text-gray-600">
              หน้า {page} / {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              ถัดไป
            </Button>
          </div>
        </Card></>}
      </div>
    </AdminLayout>
  );
}

