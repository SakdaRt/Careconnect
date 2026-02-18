import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MessageCircle, User as UserIcon, FileText, ExternalLink, Star } from 'lucide-react';
import { MainLayout } from '../../layouts';
import { Button, Card, LoadingState, ReasonModal, StatusBadge } from '../../components/ui';
import { JobPost, CaregiverDocument } from '../../services/api';
import { useAuth } from '../../contexts';
import { appApi } from '../../services/appApi';

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

function formatFullLocation(
  addressLine1?: string | null,
  addressLine2?: string | null,
  district?: string | null,
  province?: string | null,
  postalCode?: string | null
) {
  return [addressLine1, addressLine2, district, province, postalCode].filter(Boolean).join(', ');
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
  const isCaregiverView = user?.role === 'caregiver';
  const myJobsLink = isCaregiverView ? '/caregiver/jobs/my-jobs' : '/hirer/home';

  const [job, setJob] = useState<JobPost | null>(null);
  const [disputeInfo, setDisputeInfo] = useState<{ id: string; status?: string; reason?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [cancelReasonDisplay, setCancelReasonDisplay] = useState('');
  const [caregiverDocs, setCaregiverDocs] = useState<CaregiverDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [existingReview, setExistingReview] = useState<any>(null);
  const [reviewHover, setReviewHover] = useState(0);

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
        // Load existing review
        if (id) {
          try {
            const reviewRes = await appApi.getJobReview(id);
            if (reviewRes.success && reviewRes.data?.review) {
              setExistingReview(reviewRes.data.review);
            }
          } catch { /* ignore */ }
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

  const locationArea = useMemo(() => {
    if (!job) return '';
    return formatFullLocation(job.address_line1, job.address_line2, job.district, job.province, job.postal_code);
  }, [job]);

  const mapLink = useMemo(() => {
    if (!job) return '';

    if (typeof job.lat === 'number' && typeof job.lng === 'number') {
      return `https://www.google.com/maps/search/?api=1&query=${job.lat},${job.lng}&hl=th&gl=th`;
    }

    const addressQuery = [job.address_line1, job.address_line2, job.district, job.province, job.postal_code, 'ประเทศไทย']
      .filter(Boolean)
      .join(' ');

    if (!addressQuery) return '';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressQuery)}&hl=th&gl=th`;
  }, [job]);

  const counterpartTitle = isCaregiverView ? 'ผู้ว่าจ้างที่มอบหมายงาน' : 'ผู้ดูแลที่รับงาน';
  const counterpartName = isCaregiverView
    ? ((job as any)?.hirer_name || 'ผู้ว่าจ้าง')
    : ((job as any)?.caregiver_name || 'ผู้ดูแล');
  const counterpartStatus = isCaregiverView
    ? {
        assigned: 'มอบหมายงานให้คุณแล้ว',
        in_progress: 'กำลังดำเนินงาน',
        completed: 'งานเสร็จสิ้นแล้ว',
      }
    : {
        assigned: 'รอเช็คอิน',
        in_progress: 'กำลังดูแล',
        completed: 'เสร็จสิ้น',
      };
  const shouldShowCounterpartCard = (
    job?.status === 'assigned'
    || job?.status === 'in_progress'
    || job?.status === 'completed'
  ) && (isCaregiverView ? Boolean((job as any)?.hirer_name || job?.hirer_id) : Boolean((job as any)?.caregiver_name));

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
      const errMsg = String(res.error || '');
      if (code === 'INSUFFICIENT_BALANCE' || errMsg.includes('Insufficient')) {
        toast.error('เงินในระบบไม่พอ กรุณาเติมเงินก่อนเผยแพร่');
        return;
      }
      if (code === 'POLICY_VIOLATION' || code === 'INSUFFICIENT_TRUST_LEVEL' || errMsg.includes('trust') || errMsg.includes('Trust') || errMsg.includes('L1')) {
        toast.error('กรุณายืนยันตัวตนก่อนเผยแพร่งาน — ไปที่ เมนู > ยืนยันตัวตน');
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
          <Link to={myJobsLink}>
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
                <span className="font-semibold">พื้นที่งาน:</span> {locationArea || '-'}
                {mapLink && (
                  <div className="mt-2">
                    <a
                      href={mapLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-semibold"
                    >
                      เปิดแผนที่นำทาง (Google Maps)
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <div className="mt-1 text-xs text-gray-500">แสดงผลภาษาไทยตามแผนที่เป็นหลัก</div>
                  </div>
                )}
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

            {shouldShowCounterpartCard && (
              <div className="mt-5 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">{counterpartTitle}</div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900">{counterpartName}</div>
                    <div className="text-xs text-gray-600">
                      {(job as any).job_status === 'assigned' && counterpartStatus.assigned}
                      {(job as any).job_status === 'in_progress' && counterpartStatus.in_progress}
                      {(job as any).job_status === 'completed' && counterpartStatus.completed}
                    </div>
                  </div>
                  {job.job_id && (
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

            {/* Review section for completed jobs */}
            {!isCaregiverView && job.status === 'completed' && (job as any).caregiver_id && (
              <div className="mt-5 p-4 bg-yellow-50 border border-yellow-100 rounded-lg">
                <div className="text-sm font-semibold text-gray-900 mb-3">
                  {existingReview ? 'รีวิวของคุณ' : 'รีวิวผู้ดูแล'}
                </div>
                {existingReview ? (
                  <div>
                    <div className="flex items-center gap-1 mb-2">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star key={i} className={`w-5 h-5 ${i < existingReview.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                      ))}
                      <span className="text-sm text-gray-600 ml-2">{existingReview.rating}/5</span>
                    </div>
                    {existingReview.comment && (
                      <p className="text-sm text-gray-700">{existingReview.comment}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }, (_, i) => (
                        <button
                          key={i}
                          type="button"
                          onMouseEnter={() => setReviewHover(i + 1)}
                          onMouseLeave={() => setReviewHover(0)}
                          onClick={() => setReviewRating(i + 1)}
                          className="p-0.5"
                        >
                          <Star className={`w-7 h-7 transition-colors ${
                            i < (reviewHover || reviewRating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 hover:text-yellow-300'
                          }`} />
                        </button>
                      ))}
                      {reviewRating > 0 && <span className="text-sm text-gray-600 ml-2">{reviewRating}/5</span>}
                    </div>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-20"
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="แสดงความคิดเห็นเกี่ยวกับผู้ดูแล (ไม่บังคับ)"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={reviewRating === 0 || reviewSubmitting}
                      loading={reviewSubmitting}
                      onClick={async () => {
                        if (!reviewRating || !(job as any).caregiver_id) return;
                        setReviewSubmitting(true);
                        try {
                          const res = await appApi.createReview(job.id, (job as any).caregiver_id, reviewRating, reviewComment.trim() || undefined);
                          if (res.success) {
                            toast.success('บันทึกรีวิวแล้ว');
                            setExistingReview({ rating: reviewRating, comment: reviewComment.trim() });
                          } else {
                            toast.error((res as any).error || 'ไม่สามารถบันทึกรีวิวได้');
                          }
                        } finally {
                          setReviewSubmitting(false);
                        }
                      }}
                    >
                      ส่งรีวิว
                    </Button>
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

