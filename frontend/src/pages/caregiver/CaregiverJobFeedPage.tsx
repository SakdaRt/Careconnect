import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { MainLayout } from '../../layouts';
import { Badge, Button, Card, LoadingState, StatusBadge } from '../../components/ui';
import { CaregiverProfile, JobPost } from '../../services/api';
import { appApi } from '../../services/appApi';
import { useAuth } from '../../contexts';
import toast from 'react-hot-toast';

function formatDate(startIso: string) {
  const d = new Date(startIso);
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

type SortOption = 'newest' | 'pay_high' | 'pay_low';
type TypeFilter = '' | 'companionship' | 'personal_care' | 'medical_monitoring' | 'dementia_care' | 'post_surgery' | 'emergency';

const TYPE_LABELS: Record<string, string> = {
  companionship: 'เพื่อนคุย/ดูแลทั่วไป',
  personal_care: 'ช่วยเหลือตัวเอง',
  medical_monitoring: 'ดูแลการกินยา/สัญญาณชีพ',
  dementia_care: 'ดูแลสมองเสื่อม',
  post_surgery: 'ดูแลหลังผ่าตัด',
  emergency: 'เร่งด่วน',
};

export default function CaregiverJobFeedPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<(JobPost & { eligible?: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('');
  const [profile, setProfile] = useState<CaregiverProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const isL0 = user?.trust_level === 'L0';

  const load = async () => {
    setLoading(true);
    try {
      const res = await appApi.getJobFeed({ page: 1, limit: 20 });
      if (res.success && res.data) {
        setJobs(res.data.data || []);
        return;
      }
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const loadProfile = async () => {
    setProfileLoading(true);
    try {
      const res = await appApi.getMyProfile();
      if (res.success && res.data && res.data.role === 'caregiver') {
        setProfile((res.data.profile || null) as CaregiverProfile | null);
      } else {
        setProfile(null);
      }
    } catch {}
    setProfileLoading(false);
  };

  const toggleVisibility = async () => {
    if (!profile) return;
    setTogglingVisibility(true);
    try {
      const newVisibility = !(profile.is_public_profile ?? true);
      const res = await appApi.updateMyProfile({
        display_name: profile.display_name || '',
        bio: profile.bio || '',
        experience_years: profile.experience_years,
        certifications: profile.certifications || [],
        specializations: profile.specializations || [],
        available_from: profile.available_from || '',
        available_to: profile.available_to || '',
        available_days: profile.available_days || [],
        is_public_profile: newVisibility,
      });
      if (res.success && res.data) {
        setProfile(res.data.profile as CaregiverProfile);
        toast.success(newVisibility ? 'เปิดให้ผู้ว่าจ้างค้นหาโปรไฟล์แล้ว' : 'ปิดโปรไฟล์จากผู้ว่าจ้างแล้ว');
      } else {
        toast.error(res.error || 'เปลี่ยนการแสดงตนไม่สำเร็จ');
      }
    } catch {}
    setTogglingVisibility(false);
  };

  useEffect(() => {
    load();
    loadProfile();
  }, []);

  const items = useMemo(() => {
    let filtered = jobs;
    if (typeFilter) filtered = filtered.filter((j) => j.job_type === typeFilter);
    const sorted = [...filtered];
    if (sortBy === 'pay_high') sorted.sort((a, b) => b.total_amount - a.total_amount);
    else if (sortBy === 'pay_low') sorted.sort((a, b) => a.total_amount - b.total_amount);
    return sorted;
  }, [jobs, sortBy, typeFilter]);

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ค้นหางาน</h1>
            <p className="text-sm text-gray-600">งานที่เปิดรับสมัครอยู่</p>
            <div className="mt-2">
              <Badge variant="warning">การ์ดสีส้ม = ผู้ว่าจ้างอยากจ้างคุณโดยตรง</Badge>
            </div>
          </div>
          <Button variant="outline" onClick={load}>
            รีเฟรช
          </Button>
        </div>

        {/* Profile Visibility Toggle */}
        {user?.role === 'caregiver' && profile && (
          <Card className="mb-4 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                {(profile.is_public_profile ?? true) ? (
                  <Eye className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <EyeOff className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    โปรไฟล์ของ {profile.display_name || 'คุณ'}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {(profile.is_public_profile ?? true)
                      ? 'แสดงให้ผู้ว่าจ้างค้นหาเห็นอยู่'
                      : 'ถูกซ่อนจากผู้ว่าจ้าง'}
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleVisibility}
                loading={togglingVisibility}
                disabled={profileLoading}
              >
                {(profile.is_public_profile ?? true) ? 'ปิด' : 'เปิด'}
              </Button>
            </div>
          </Card>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          <select
            className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          >
            <option value="">ทุกประเภท</option>
            {Object.entries(TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <select
            className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
          >
            <option value="newest">ล่าสุด</option>
            <option value="pay_high">ค่าจ้างสูง → ต่ำ</option>
            <option value="pay_low">ค่าจ้างต่ำ → สูง</option>
          </select>
          {typeFilter && (
            <button onClick={() => setTypeFilter('')} className="text-xs text-blue-600 hover:underline">ล้างตัวกรอง</button>
          )}
        </div>

        {isL0 && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
            <Shield className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-yellow-900">
              <p className="font-semibold mb-1">ยืนยันเบอร์โทรเพื่อรับงาน</p>
              <p>คุณยังไม่ได้ยืนยันเบอร์โทรศัพท์ กรุณายืนยัน OTP เพื่อเลื่อนเป็น Trust Level L1 แล้วจึงจะสามารถรับงานได้</p>
              <div className="mt-2">
                <Link to="/profile">
                  <Button variant="primary" size="sm">ไปยืนยันเบอร์โทร</Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {user?.trust_level === 'L1' && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-blue-900">
              <p className="font-semibold mb-1">ยืนยันตัวตน KYC เพื่อรับงานความเสี่ยงสูง</p>
              <p>งานบางประเภทต้อง Trust Level L2 ขึ้นไป ยืนยันตัวตนเพื่อปลดล็อก</p>
              <div className="mt-2">
                <Link to="/kyc">
                  <Button variant="primary" size="sm">ยืนยันตัวตน (KYC)</Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <LoadingState message="กำลังโหลดงาน..." />
        ) : items.length === 0 ? (
          <Card className="p-6">
            <p className="text-gray-700">ยังไม่มีงานในขณะนี้</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((job) => {
              const location = [job.address_line1, job.district, job.province].filter(Boolean).join(', ');
              const isDirectInvite = Boolean(user?.id && job.preferred_caregiver_id === user.id);
              const cardClassName = isDirectInvite
                ? 'p-4 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 shadow-sm shadow-orange-100/60'
                : 'p-4';
              return (
                <Card key={job.id} className={cardClassName}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-gray-900 text-lg line-clamp-1">{job.title}</h3>
                        <div className="flex items-center gap-2">
                          {isDirectInvite && <Badge variant="warning">อยากจ้างคุณ</Badge>}
                          <StatusBadge status={job.status as any} />
                        </div>
                      </div>
                      <p className={`text-sm mt-1 line-clamp-2 ${isDirectInvite ? 'text-orange-900' : 'text-gray-600'}`}>
                        {job.description}
                      </p>
                      <div className="mt-3 text-sm text-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>วันที่: {formatDate(job.scheduled_start_at)}</div>
                        <div>สถานที่: {location || '-'}</div>
                        <div>ค่าจ้างรวม: {job.total_amount.toLocaleString()} บาท</div>
                        <div>ประเภท: {job.job_type}</div>
                      </div>
                      {job.eligible === false && (
                        <div className="mt-2 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded px-2 py-1 inline-flex items-center gap-2 flex-wrap">
                          <span>ต้อง Trust Level {job.min_trust_level} ขึ้นไปจึงจะรับงานนี้ได้</span>
                          <Link to="/kyc" className="text-blue-600 underline hover:text-blue-800">ยืนยันตัวตน</Link>
                        </div>
                      )}
                      <div className="mt-4">
                        <Link to={`/caregiver/jobs/${job.id}/preview`}>
                          <Button variant={job.eligible === false ? 'outline' : 'primary'} size="sm">
                            {job.eligible === false ? 'ดูรายละเอียด' : 'ดูรายละเอียด / รับงาน'}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

