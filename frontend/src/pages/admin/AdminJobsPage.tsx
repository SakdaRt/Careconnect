import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../../layouts';
import { Button, Card, Input, LoadingState, Modal, StatusBadge, Textarea } from '../../components/ui';
import api, { AdminJobListItem } from '../../services/api';

function formatDateTime(iso?: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('th-TH');
}

export default function AdminJobsPage() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<AdminJobListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | string>('all');
  const [risk, setRisk] = useState<'all' | string>('all');
  const [type, setType] = useState<'all' | string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<AdminJobListItem | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelTarget, setCancelTarget] = useState<AdminJobListItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.adminGetJobs({
        q: q.trim() || undefined,
        status: status === 'all' ? undefined : status,
        risk_level: risk === 'all' ? undefined : risk,
        job_type: type === 'all' ? undefined : type,
        page,
        limit: 20,
      });
      if (!res.success || !res.data) {
        setJobs([]);
        setTotalPages(1);
        return;
      }
      setJobs(res.data.data || []);
      setTotalPages(res.data.totalPages || 1);
    } finally {
      setLoading(false);
    }
  }, [page, q, risk, status, type]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = () => {
    setPage(1);
    load();
  };

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setSelectedJob(null);
    const res = await api.adminGetJob(id);
    if (!res.success || !res.data?.job) {
      toast.error(res.error || 'โหลดข้อมูลงานไม่สำเร็จ');
      return;
    }
    setSelectedJob(res.data.job);
  };

  const jobStatus = (j: AdminJobListItem) => (j.job_status || j.status) as any;

  const handleCancel = (j: AdminJobListItem) => {
    setCancelTarget(j);
    setCancelReason('');
    setCancelOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    const reason = cancelReason.trim();
    if (!reason) {
      toast.error('กรุณากรอกเหตุผลที่ยกเลิกงาน');
      return;
    }
    setActionLoading(cancelTarget.id);
    try {
      const res = await api.adminCancelJob(cancelTarget.id, reason);
      if (!res.success) {
        toast.error(res.error || 'ยกเลิกไม่สำเร็จ');
        return;
      }
      toast.success('ยกเลิกงานแล้ว');
      setCancelOpen(false);
      setCancelTarget(null);
      await load();
      if (selectedId === cancelTarget.id) await openDetail(cancelTarget.id);
    } finally {
      setActionLoading(null);
    }
  };

  const canCancel = (j: AdminJobListItem) => {
    const s = j.job_status || j.status;
    return s === 'posted' || s === 'assigned' || s === 'in_progress';
  };

  const selectedHeader = useMemo(() => {
    if (!selectedJob) return null;
    const loc = [selectedJob.address_line1, selectedJob.district, selectedJob.province].filter(Boolean).join(', ');
    return {
      title: selectedJob.title,
      status: jobStatus(selectedJob),
      job_post_id: selectedJob.id,
      job_id: selectedJob.job_id || null,
      hirer_name: (selectedJob as any).hirer_name || null,
      caregiver_name: (selectedJob as any).caregiver_name || null,
      patient_display_name: (selectedJob as any).patient_display_name || null,
      scheduled: `${formatDateTime(selectedJob.scheduled_start_at)} - ${formatDateTime(selectedJob.scheduled_end_at)}`,
      location: loc || '-',
    };
  }, [selectedJob]);

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        <Card className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="flex-1">
              <Input
                label="ค้นหา"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหา job_post_id / job_id / title / ชื่อ"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
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
                <option value="draft">draft</option>
                <option value="posted">posted</option>
                <option value="assigned">assigned</option>
                <option value="in_progress">in_progress</option>
                <option value="completed">completed</option>
                <option value="cancelled">cancelled</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Risk</label>
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                value={risk}
                onChange={(e) => {
                  setRisk(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">ทั้งหมด</option>
                <option value="low_risk">low_risk</option>
                <option value="medium_risk">medium_risk</option>
                <option value="high_risk">high_risk</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Type</label>
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">ทั้งหมด</option>
                <option value="elderly_care">elderly_care</option>
                <option value="patient_care">patient_care</option>
                <option value="post_surgery">post_surgery</option>
                <option value="night_shift">night_shift</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" onClick={handleSearch}>
                ค้นหา
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setQ('');
                  setStatus('all');
                  setRisk('all');
                  setType('all');
                  setPage(1);
                }}
              >
                ล้าง
              </Button>
            </div>
          </div>
        </Card>

        {selectedHeader && (
          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-gray-500">งาน</div>
                <div className="text-lg font-semibold text-gray-900">{selectedHeader.title}</div>
                <div className="text-xs text-gray-600 mt-1">
                  {selectedHeader.patient_display_name ? `ผู้รับการดูแล: ${selectedHeader.patient_display_name}` : ''}
                  {selectedHeader.hirer_name ? ` • ผู้ว่าจ้าง: ${selectedHeader.hirer_name}` : ''}
                  {selectedHeader.caregiver_name ? ` • ผู้ดูแล: ${selectedHeader.caregiver_name}` : ''}
                </div>
                <div className="text-xs text-gray-600 mt-1">{selectedHeader.scheduled}</div>
                <div className="text-xs text-gray-600 mt-1">{selectedHeader.location}</div>
                <div className="text-[11px] text-gray-500 mt-2 font-mono break-all">job_post: {selectedHeader.job_post_id}</div>
                {selectedHeader.job_id && <div className="text-[11px] text-gray-500 mt-1 font-mono break-all">job: {selectedHeader.job_id}</div>}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={selectedHeader.status} />
                <Button variant="outline" size="sm" onClick={() => { setSelectedId(null); setSelectedJob(null); }}>
                  ปิด
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <Link to={`/jobs/${selectedHeader.job_post_id}`} target="_blank">
                <Button variant="outline" size="sm">
                  เปิดหน้าฝั่งผู้ใช้
                </Button>
              </Link>
              {(selectedHeader.job_id || selectedHeader.job_post_id) && (
                <Link to={`/chat/${selectedHeader.job_id || selectedHeader.job_post_id}`} target="_blank">
                  <Button variant="outline" size="sm">
                    เปิดแชท
                  </Button>
                </Link>
              )}
              {selectedJob && canCancel(selectedJob) && (
                <Button
                  variant="danger"
                  size="sm"
                  loading={actionLoading === selectedJob.id}
                  onClick={() => handleCancel(selectedJob)}
                >
                  ยกเลิกงาน
                </Button>
              )}
            </div>
          </Card>
        )}

        <Card className="p-0 overflow-hidden">
          {loading ? (
            <div className="p-6">
              <LoadingState message="กำลังโหลดงาน..." />
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-6 text-sm text-gray-600">ไม่พบงาน</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {jobs.map((j) => (
                <div key={j.id} className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-gray-900 line-clamp-1">{j.title}</div>
                      <StatusBadge status={jobStatus(j)} />
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {j.patient_display_name ? `ผู้รับการดูแล: ${j.patient_display_name}` : ''}
                      {j.hirer_name ? ` • ผู้ว่าจ้าง: ${j.hirer_name}` : ''}
                      {j.caregiver_name ? ` • ผู้ดูแล: ${j.caregiver_name}` : ''}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      เริ่ม: {formatDateTime(j.scheduled_start_at)} • จบ: {formatDateTime(j.scheduled_end_at)}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-2 font-mono break-all">job_post: {j.id}</div>
                    {j.job_id && <div className="text-[11px] text-gray-500 mt-1 font-mono break-all">job: {j.job_id}</div>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openDetail(j.id)}>
                      รายละเอียด
                    </Button>
                    {canCancel(j) && (
                      <Button
                        variant="danger"
                        size="sm"
                        loading={actionLoading === j.id}
                        onClick={() => handleCancel(j)}
                      >
                        ยกเลิก
                      </Button>
                    )}
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
        </Card>
      </div>
      <Modal
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="ยกเลิกงาน"
        size="sm"
        footer={
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setCancelOpen(false)}
              disabled={!!actionLoading}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              กลับไป
            </button>
            <button
              onClick={handleConfirmCancel}
              disabled={!!actionLoading || !cancelReason.trim()}
              className="px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 bg-red-600 hover:bg-red-700"
            >
              {actionLoading ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิก'}
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-2">
          <Textarea
            label="เหตุผลที่ยกเลิกงาน"
            fullWidth
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="อธิบายเหตุผลในการยกเลิกงาน"
            className="min-h-28"
          />
        </div>
      </Modal>
    </AdminLayout>
  );
}

