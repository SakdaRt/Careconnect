import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Heart, Star, Briefcase } from 'lucide-react';
import { MainLayout } from '../../layouts';
import { Button, Card, LoadingState } from '../../components/ui';
import { appApi } from '../../services/appApi';

interface FavoriteCaregiver {
  id: string;
  caregiver_id: string;
  user_id: string;
  email?: string;
  trust_level?: string;
  trust_score?: number;
  completed_jobs_count?: number;
  display_name?: string;
  bio?: string;
  certifications?: string[];
  specializations?: string[];
  experience_years?: number;
  avg_rating?: number;
  total_reviews?: number;
  created_at: string;
}

const TRUST_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  L3: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'L3 เชื่อถือสูง' },
  L2: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'L2 ยืนยันแล้ว' },
  L1: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'L1 พื้นฐาน' },
  L0: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'L0 ยังไม่ยืนยัน' },
};

export default function FavoritesPage() {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<FavoriteCaregiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await appApi.getFavorites(p, 20);
      if (res.success && res.data) {
        setFavorites(res.data.data || []);
        setTotalPages(res.data.totalPages || 1);
        setPage(p);
      } else {
        setFavorites([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(1);
  }, [load]);

  const handleRemoveFavorite = async (caregiverId: string) => {
    try {
      const res = await appApi.toggleFavorite(caregiverId);
      if (res.success) {
        toast.success('ลบออกจากรายการโปรดแล้ว');
        setFavorites((prev) => prev.filter((f) => f.caregiver_id !== caregiverId));
      }
    } catch {
      toast.error('ไม่สามารถลบรายการโปรดได้');
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-3.5 h-3.5 ${i < Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
      />
    ));
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ผู้ดูแลที่ชื่นชอบ</h1>
            <p className="text-sm text-gray-600">รายการผู้ดูแลที่คุณบันทึกไว้</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/hirer/search-caregivers')}>
            ค้นหาผู้ดูแล
          </Button>
        </div>

        {loading ? (
          <LoadingState message="กำลังโหลด..." />
        ) : favorites.length === 0 ? (
          <Card className="text-center py-12">
            <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">ยังไม่มีผู้ดูแลในรายการโปรด</p>
            <p className="text-sm text-gray-400 mt-1">กดหัวใจที่หน้าค้นหาผู้ดูแลเพื่อเพิ่ม</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {favorites.map((fav) => {
              const tl = TRUST_STYLE[fav.trust_level || 'L0'] || TRUST_STYLE.L0;
              const tags = Array.from(new Set([...(fav.specializations || []), ...(fav.certifications || [])]));
              return (
                <Card key={fav.id} className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{fav.display_name || 'ผู้ดูแล'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${tl.bg} ${tl.text}`}>{tl.label}</span>
                    </div>

                    {fav.bio && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{fav.bio}</p>
                    )}

                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                      {(fav.total_reviews ?? 0) > 0 && (
                        <span className="flex items-center gap-1">
                          {renderStars(fav.avg_rating || 0)}
                          <span className="ml-1">{(fav.avg_rating || 0).toFixed(1)} ({fav.total_reviews} รีวิว)</span>
                        </span>
                      )}
                      {fav.experience_years != null && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3.5 h-3.5" />ประสบการณ์ {fav.experience_years} ปี
                        </span>
                      )}
                      {(fav.completed_jobs_count ?? 0) > 0 && (
                        <span className="flex items-center gap-1">
                          ทำงานแล้ว {fav.completed_jobs_count} งาน
                        </span>
                      )}
                    </div>

                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {tags.slice(0, 5).map((s) => (
                          <span key={s} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 flex-shrink-0 items-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveFavorite(fav.caregiver_id)}
                      className="p-2 rounded-full hover:bg-red-50 transition-colors"
                      title="ลบออกจากรายการโปรด"
                    >
                      <Heart className="w-5 h-5 fill-red-500 text-red-500" />
                    </button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => navigate(`/hirer/search-caregivers?q=${encodeURIComponent(fav.display_name || fav.caregiver_id)}`)}
                    >
                      มอบหมายงาน
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => load(page - 1)}>ก่อนหน้า</Button>
            <span className="text-sm text-gray-600 flex items-center">หน้า {page}/{totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => load(page + 1)}>ถัดไป</Button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
