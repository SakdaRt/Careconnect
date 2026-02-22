import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Star, Briefcase, Clock3, Heart, ArrowLeft, ShieldCheck } from 'lucide-react';
import { MainLayout } from '../../layouts';
import { Button, Card, LoadingState } from '../../components/ui';
import { appApi } from '../../services/appApi';

interface CaregiverProfile {
  id: string;
  email?: string;
  phone_number?: string;
  trust_level: string;
  trust_score?: number;
  completed_jobs_count?: number;
  created_at: string;
  display_name?: string;
  bio?: string;
  certifications?: string[];
  specializations?: string[];
  experience_years?: number;
  available_from?: string;
  available_to?: string;
  available_days?: Array<number | string>;
  is_public_profile?: boolean;
  is_favorited?: boolean;
  avg_rating?: number;
  total_reviews?: number;
}

interface Review {
  id: string;
  rating: number;
  comment?: string;
  reviewer_name?: string;
  created_at: string;
}

const TRUST_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  L3: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'L3 เชื่อถือสูง' },
  L2: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'L2 ยืนยันแล้ว' },
  L1: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'L1 พื้นฐาน' },
  L0: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'L0 ยังไม่ยืนยัน' },
};

const SKILL_LABELS: Record<string, string> = {
  companionship: 'ดูแลทั่วไป/เพื่อนคุย',
  personal_care: 'ช่วยกิจวัตรประจำวัน',
  medical_monitoring: 'ดูแลการกินยา/วัดสัญญาณชีพ',
  dementia_care: 'ดูแลสมองเสื่อม',
  post_surgery: 'ดูแลหลังผ่าตัด',
  emergency: 'กรณีฉุกเฉิน',
  basic_care: 'ดูแลทั่วไป',
  personal_hygiene: 'อาบน้ำ/แต่งตัว',
  medication: 'จัดยา/ให้ยา',
  vital_signs: 'วัดสัญญาณชีพ',
  wound_care: 'ดูแลแผล',
  physical_therapy: 'กายภาพบำบัด',
  cooking: 'ทำอาหาร',
  driving: 'ขับรถ',
  first_aid: 'ปฐมพยาบาล',
  basic_first_aid: 'ปฐมพยาบาลเบื้องต้น',
  safe_transfer: 'ย้ายท่าอย่างปลอดภัย',
  vitals_monitoring: 'วัด/ติดตามสัญญาณชีพ',
  medication_management: 'จัดยา/ดูแลการใช้ยา',
  post_surgery_care: 'ดูแลหลังผ่าตัด',
  catheter_care: 'ดูแลสายสวน',
  tube_feeding_care: 'ดูแลการให้อาหารทางสาย',
};

const DAY_LABELS: Record<number, string> = {
  0: 'อาทิตย์', 1: 'จันทร์', 2: 'อังคาร', 3: 'พุธ', 4: 'พฤหัสบดี', 5: 'ศุกร์', 6: 'เสาร์',
};

function formatTime(time?: string) {
  if (!time) return '';
  return time.slice(0, 5);
}

export default function CaregiverPublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CaregiverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [togglingFav, setTogglingFav] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await appApi.getCaregiverProfile(id);
      if (res.success && res.data) {
        setProfile(res.data);
        setFavorited(Boolean(res.data.is_favorited));
      } else {
        toast.error(res.error || 'ไม่พบผู้ดูแลนี้');
      }
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadReviews = useCallback(async () => {
    if (!id) return;
    setReviewsLoading(true);
    try {
      const res = await appApi.getCaregiverReviews(id, 1, 20);
      if (res.success && res.data) {
        setReviews((res.data.data || []) as Review[]);
      }
    } catch { /* ignore */ }
    finally { setReviewsLoading(false); }
  }, [id]);

  useEffect(() => {
    loadProfile();
    loadReviews();
  }, [loadProfile, loadReviews]);

  const handleToggleFavorite = async () => {
    if (!id || togglingFav) return;
    setTogglingFav(true);
    try {
      const res = await appApi.toggleFavorite(id);
      if (res.success && res.data) {
        const isFav = Boolean(res.data.favorited);
        setFavorited(isFav);
        toast.success(isFav ? 'เพิ่มในรายการโปรดแล้ว' : 'ลบออกจากรายการโปรดแล้ว');
      }
    } catch { toast.error('ไม่สามารถบันทึกได้'); }
    finally { setTogglingFav(false); }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="max-w-3xl mx-auto px-4 py-6">
          <LoadingState message="กำลังโหลดโปรไฟล์..." />
        </div>
      </MainLayout>
    );
  }

  if (!profile) {
    return (
      <MainLayout>
        <div className="max-w-3xl mx-auto px-4 py-6 text-center">
          <div className="text-4xl mb-3">😔</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">ไม่พบผู้ดูแลนี้</h2>
          <p className="text-sm text-gray-600 mb-4">อาจถูกลบหรือปิดโปรไฟล์แล้ว</p>
          <Button variant="primary" onClick={() => navigate(-1)}>กลับ</Button>
        </div>
      </MainLayout>
    );
  }

  const tl = TRUST_STYLE[profile.trust_level] || TRUST_STYLE.L0;
  const tags = Array.from(new Set([...(profile.specializations || []), ...(profile.certifications || [])]));
  const dayNums = (profile.available_days || []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  const fromTime = formatTime(profile.available_from);
  const toTime = formatTime(profile.available_to);

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Back button */}
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>กลับ</span>
        </button>

        {/* Header */}
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <h1 className="text-xl font-bold text-gray-900">{profile.display_name || 'ผู้ดูแล'}</h1>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${tl.bg} ${tl.text}`}>{tl.label}</span>
              </div>

              {/* Stats row */}
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                {(profile.avg_rating ?? 0) > 0 && (
                  <span className="flex items-center gap-1 text-yellow-600">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    {Number(profile.avg_rating).toFixed(1)} ({profile.total_reviews} รีวิว)
                  </span>
                )}
                {profile.experience_years != null && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-4 h-4" />
                    ประสบการณ์ {profile.experience_years} ปี
                  </span>
                )}
                {(profile.completed_jobs_count ?? 0) > 0 && (
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4" />
                    ทำงานแล้ว {profile.completed_jobs_count} งาน
                  </span>
                )}
              </div>
            </div>

            {/* Favorite */}
            <button
              onClick={handleToggleFavorite}
              disabled={togglingFav}
              aria-label={favorited ? 'ลบออกจากรายการโปรด' : 'เพิ่มในรายการโปรด'}
              aria-pressed={favorited}
              className="p-2 rounded-full hover:bg-red-50 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              <Heart className={`w-6 h-6 ${favorited ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} aria-hidden="true" />
            </button>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-sm text-gray-700 mt-4 whitespace-pre-wrap">{profile.bio}</p>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Link to={`/hirer/search-caregivers?resume_assign=1&caregiver_id=${profile.id}&caregiver_name=${encodeURIComponent(profile.display_name || '')}&caregiver_trust_level=${profile.trust_level}`}>
              <Button variant="primary" size="sm">มอบหมายงาน</Button>
            </Link>
          </div>
        </Card>

        {/* Skills */}
        {tags.length > 0 && (
          <Card className="p-4">
            <div className="text-sm font-semibold text-gray-900 mb-3">ทักษะและความเชี่ยวชาญ</div>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span key={tag} className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
                  {SKILL_LABELS[tag] || tag}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Availability */}
        {(dayNums.length > 0 || fromTime) && (
          <Card className="p-4">
            <div className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Clock3 className="w-4 h-4" />
              ช่วงเวลาที่พร้อมรับงาน
            </div>
            {dayNums.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {dayNums.map((d) => (
                  <span key={d} className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full">
                    {DAY_LABELS[d] || `วัน ${d}`}
                  </span>
                ))}
              </div>
            )}
            {fromTime && toTime && (
              <div className="text-sm text-gray-600">เวลา: {fromTime} - {toTime}</div>
            )}
          </Card>
        )}

        {/* Reviews */}
        <Card className="p-4">
          <div className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500" />
            รีวิวจากผู้ว่าจ้าง
            {(profile.total_reviews ?? 0) > 0 && (
              <span className="text-xs font-normal text-yellow-600">
                {Number(profile.avg_rating).toFixed(1)} ({profile.total_reviews} รีวิว)
              </span>
            )}
          </div>

          {reviewsLoading ? (
            <div className="text-sm text-gray-500 py-4 text-center">กำลังโหลดรีวิว...</div>
          ) : reviews.length === 0 ? (
            <div className="text-sm text-gray-500 py-4 text-center">ยังไม่มีรีวิว</div>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">{r.reviewer_name || 'ผู้ว่าจ้าง'}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(r.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  {r.comment && <p className="text-sm text-gray-700">{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
