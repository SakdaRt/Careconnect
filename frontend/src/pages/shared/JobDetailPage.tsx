import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MessageCircle, User as UserIcon, FileText, ExternalLink } from 'lucide-react';
import { MainLayout } from '../../layouts';
import { Button, Card, LoadingState, ReasonModal, StatusBadge } from '../../components/ui';
import { JobPost, CaregiverDocument } from '../../services/api';
import { useAuth } from '../../contexts';
import { appApi } from '../../services/appApi';

function formatDateTimeRange(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const date = start.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStart = start.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  const timeEnd = end.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${timeStart} - ${timeEnd}`;
}

const JOB_TYPE_LABEL: Record<string, string> = {
  companionship: 'เพื่อนคุย / ดูแลทั่วไป',
  personal_care: 'ช่วยเหลือตัวเอง / อาบน้ำแต่งตัว',
  medical_monitoring: 'ดูแลการกินยา / วัดสัญญาณชีพ',
  dementia_care: 'ดูแลผู้ป่วยสมองเสื่อม',
  post_surgery: 'ดูแลหลังผ่าตัด',
  emergency: 'เร่งด่วน',
};

export default function JobDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const hirerId = user?.id || 'demo-hirer';

  const [job, setJob] = useState<JobPost | null>(null);
  const [disputeInfo, setDisputeInfo] = useState<{ id: string; status?: string; reason?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [cancelReasonDisplay, setCancelReasonDisplay] = useState('');
  const [caregiverDocs, setCaregiverDocs] = useState<CaregiverDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await appApi.getJobById(id);
      if (res.success && res.data?.job) {
        setJob(res.data.job);
        const dRes = await appApi.getDisputeByJob(id);
        setDisputeInfo(
          dRes.success && dRes.data?.dispute?.id
            ? { id: dRes.data.dispute.id, status: dRes.data.dispute.status, reason: dRes.data.dispute.reason }
            : null
        );
        const cancelRes = await appApi.getCancelReason(id);
        setCancelReasonDisplay(cancelRes.success ? String((cancelRes.data as any)?.reason || '') : '');
        // Load caregiver documents if hirer and caregiver is assigned
        const jobData = res.data.job;
        if (jobData.caregiver_id && ['assigned', 'in_progress', 'completed'].includes(jobData.status || '')) {
          setDocsLoading(true);
          try {
            const docRes = await appApi.getCaregiverDocumentsByCaregiver(jobData.caregiver_id);
            if (docRes.success && docRes.data) setCaregiverDocs(Array.isArray(docRes.data) ? docRes.data : []);
          } catch { /* ignore */ } finally {
            setDocsLoading(false);
          }
        }
        return;
      }
      setJob(null);
      setDisputeInfo(null);
      setCancelReasonDisplay('');
      toast.error(res.error || 'โหลดรายละเอียดงานไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const location = useMemo(() => {
    if (!job) return '';
    const parts = [job.address_line1, job.district, job.province].filter(Boolean);
    return parts.join(', ');
  }, [job]);

  const handlePublish = async () => {
    if (!job) return;
    setActionLoading(true);
    try {
      const res = await appApi.publishJob(job.id, hirerId);
      if (res.success) {
        toast.success('เผยแพร่งานแล้ว');
        await load();
        return;
      }
      const code = (res as any).code as string | undefined;
      if (code === 'INSUFFICIENT_BALANCE' || String(res.error || '').includes('Insufficient')) {
        toast.error('เงินในระบบไม่พอ กรุณาเติมเงินก่อนเผยแพร่');
        return;
      }
      toast.error(res.error || 'ไม่สามารถเผยแพร่งานได้');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setCancelOpen(true);
  };

  const handleConfirmCancel = async (reason: string) => {
    if (!job) return;
    setActionLoading(true);
    try {
      const res = await appApi.cancelJob(job.id, hirerId, reason);
      if (res.success) {
        toast.success('ยกเลิกงานแล้ว');
        setCancelOpen(false);
        await load();
        return;
      }
      toast.error(res.error || 'ไม่สามารถยกเลิกงานได้');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDispute = async () => {
    if (!job) return;
    setActionLoading(true);
    try {
      const existingRes = await appApi.getDisputeByJob(job.id);
      if (existingRes.success && existingRes.data?.dispute?.id) {
        navigate(`/dispute/${existingRes.data.dispute.id}`);
        return;
      }
    } finally {
      setActionLoading(false);
    }
    setDisputeOpen(true);
  };

  const handleConfirmDispute = async (reason: string) => {
    if (!job) return;
    setActionLoading(true);
    try {
      const res = await appApi.createDispute(job.id, hirerId, reason);
      if (!res.success || !res.data?.dispute?.id) {
        toast.error(res.error || 'เปิดข้อพิพาทไม่สำเร็จ');
        return;
      }
      toast.success('เปิดข้อพิพาทแล้ว');
      setDisputeOpen(false);
      navigate(`/dispute/${res.data.dispute.id}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <MainLayout showBottomBar={false}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3 mb-6">
          <Button variant="outline" onClick={() => navigate(-1)}>
            ย้อนกลับ
          </Button>
          <Link to="/hirer/home">
            <Button variant="ghost">ไปงานของฉัน</Button>
          </Link>
        </div>

        {loading ? (
          <LoadingState message="กำลังโหลดรายละเอียดงาน..." />
        ) : !job ? (
          <Card className="p-6">
            <p className="text-gray-700">ไม่พบงานนี้</p>
          </Card>
        ) : (
          <Card className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
                <div className="mt-2">
                  <StatusBadge status={job.status as any} />
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-blue-600">{job.total_amount.toLocaleString()} บาท</div>
                <div className="text-xs text-gray-500">
                  {job.hourly_rate.toLocaleString()} บาท/ชม. × {job.total_hours} ชม.
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm text-gray-700">
              <div>
                <span className="font-semibold">เวลา:</span> {formatDateTimeRange(job.scheduled_start_at, job.scheduled_end_at)}
              </div>
              <div>
                <span className="font-semibold">สถานที่:</span> {location || '-'}
              </div>
              <div>
                <span className="font-semibold">ประเภทงาน:</span> {JOB_TYPE_LABEL[job.job_type] || job.job_type}
              </div>
              <div>
                <span className="font-semibold">ความเสี่ยง:</span> {job.risk_level === 'high_risk' ? 'สูง' : 'ต่ำ'}
              </div>
              <div>
                <span className="font-semibold">รายละเอียด:</span>
                <div className="mt-1 whitespace-pre-wrap text-gray-800">{job.description}</div>
              </div>
              {job.status === 'cancelled' && cancelReasonDisplay && (
                <div className="text-red-700">
                  <span className="font-semibold">เหตุผลยกเลิก:</span> {cancelReasonDisplay}
                </div>
              )}
              {disputeInfo?.reason && (
                <div className="text-orange-700">
                  <span className="font-semibold">เหตุผลข้อพิพาท:</span> {disputeInfo.reason}
                </div>
              )}
            </div>

            {(job as any).caregiver_name && (job.status === 'assigned' || job.status === 'in_progress' || job.status === 'completed') && (
              <div className="mt-5 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">ผู้ดูแลที่รับงาน</div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900">{(job as any).caregiver_name}</div>
                    <div className="text-xs text-gray-600">
                      {(job as any).job_status === 'assigned' && 'รอเช็คอิน'}
                      {(job as any).job_status === 'in_progress' && 'กำลังดูแล'}
                      {(job as any).job_status === 'completed' && 'เสร็จสิ้น'}
                    </div>
                  </div>
                  {job.job_id && (
                    <Link to={`/chat/${job.job_id}`}>
                      <Button variant="primary" size="sm">
                        <MessageCircle className="w-4 h-4 mr-1" />
                        เปิดแชท
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Caregiver certification documents — visible to hirer after assignment */}
            {(job as any).caregiver_id && ['assigned', 'in_progress', 'completed'].includes(job.status || '') && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">เอกสารรับรองความสามารถ</div>
                {docsLoading ? (
                  <div className="text-xs text-gray-400 py-2">กำลังโหลด...</div>
                ) : caregiverDocs.length === 0 ? (
                  <div className="text-xs text-gray-400 py-2">ผู้ดูแลยังไม่ได้อัปโหลดเอกสารรับรอง</div>
                ) : (
                  <div className="space-y-2">
                    {caregiverDocs.map((doc) => (
                      <a
                        key={doc.id}
                        href={`/uploads/${doc.file_path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900">{doc.title}</div>
                          <div className="text-xs text-gray-500">
                            {doc.issuer && <>{doc.issuer} • </>}
                            {doc.issued_date && <>ออกเมื่อ {new Date(doc.issued_date).toLocaleDateString('th-TH')}</>}
                            {doc.expiry_date && <> • หมดอายุ {new Date(doc.expiry_date).toLocaleDateString('th-TH')}</>}
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-2 pt-4 border-t border-gray-100">
              {job.status === 'draft' && (
                <Button variant="primary" loading={actionLoading} onClick={handlePublish}>
                  เผยแพร่
                </Button>
              )}
              {job.status !== 'cancelled' && job.status !== 'completed' && (
                <Button variant="danger" loading={actionLoading} onClick={handleCancel}>
                  ยกเลิกงาน
                </Button>
              )}
              {disputeInfo?.id && (
                <Button variant="outline" loading={actionLoading} onClick={() => navigate(`/dispute/${disputeInfo.id}`)}>
                  ไปข้อพิพาท{disputeInfo.status ? ` (${disputeInfo.status})` : ''}
                </Button>
              )}
              {!disputeInfo?.id && job.job_id && job.status !== 'draft' && job.status !== 'cancelled' && job.status !== 'completed' && (
                <Button variant="outline" loading={actionLoading} onClick={handleOpenDispute}>
                  เปิดข้อพิพาท
                </Button>
              )}
            </div>
          </Card>
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
          loading={actionLoading}
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
          loading={actionLoading}
          minLength={10}
        />
      </div>
    </MainLayout>
  );
}

