import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MainLayout } from '../../layouts';
import { Button, Card, LoadingState } from '../../components/ui';
import { CareRecipient } from '../../services/api';
import { appApi } from '../../services/appApi';

function normalizeAgeBand(raw?: string | null) {
  const v = String(raw || '').trim();
  if (!v) return null;
  if (['0_12', '13_17', '18_59', '60_74', '75_89', '90_plus'].includes(v)) return v;
  const m = v.match(/(\d{1,3})\s*-\s*(\d{1,3})/);
  if (m) {
    const start = Number(m[1]);
    if (start >= 90) return '90_plus';
    if (start >= 75) return '75_89';
    if (start >= 60) return '60_74';
    if (start >= 18) return '18_59';
    if (start >= 13) return '13_17';
    return '0_12';
  }
  return null;
}

function formatAgeBand(ageBand?: string | null) {
  const normalized = normalizeAgeBand(ageBand);
  const label =
    normalized === '0_12'
      ? 'เด็ก (0–12)'
      : normalized === '13_17'
      ? 'วัยรุ่น (13–17)'
      : normalized === '18_59'
      ? 'ผู้ใหญ่ (18–59)'
      : normalized === '60_74'
      ? 'ผู้สูงอายุ (60–74)'
      : normalized === '75_89'
      ? 'ผู้สูงอายุ (75–89)'
      : normalized === '90_plus'
      ? 'ผู้สูงอายุ (90+)'
      : '';
  return label || null;
}

function formatGender(gender?: string | null) {
  if (!gender) return null;
  if (gender === 'female') return 'หญิง';
  if (gender === 'male') return 'ชาย';
  return 'อื่น ๆ / ไม่ระบุ';
}

function formatMobility(mobility?: string | null) {
  if (!mobility) return null;
  if (mobility === 'walk_independent') return 'เดินได้เอง';
  if (mobility === 'walk_assisted') return 'เดินได้แต่ต้องพยุง/ใช้ไม้เท้า';
  if (mobility === 'wheelchair') return 'ใช้รถเข็น';
  if (mobility === 'bedbound') return 'ติดเตียง';
  return mobility;
}

function parseBirthYear(raw?: number | string | null) {
  if (raw === null || raw === undefined || raw === '') return null;
  const year = Number(raw);
  if (!Number.isFinite(year)) return null;
  return year;
}

function getAgeFromBirthYear(year?: number | null) {
  if (!year) return null;
  const age = new Date().getFullYear() - year;
  if (age < 0 || age > 120) return null;
  return age;
}

function summarize(recipient: CareRecipient) {
  const ageBandLabel = formatAgeBand(recipient.age_band);
  const genderLabel = formatGender(recipient.gender);
  const mobilityLabel = formatMobility(recipient.mobility_level);
  const parts = [
    ageBandLabel ? `ช่วงอายุ: ${ageBandLabel}` : null,
    genderLabel ? `เพศ: ${genderLabel}` : null,
    mobilityLabel ? `การเคลื่อนไหว: ${mobilityLabel}` : null,
  ].filter(Boolean);
  return parts.join(' • ');
}

export default function CareRecipientsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CareRecipient[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await appApi.getCareRecipients();
      if (!res.success || !res.data) {
        setItems([]);
        return;
      }
      setItems(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = useMemo(() => items.filter((i) => i.is_active), [items]);

  const handleDeactivate = async (id: string) => {
    const ok = window.confirm('ปิดใช้งานผู้รับการดูแลรายนี้?');
    if (!ok) return;
    const res = await appApi.deactivateCareRecipient(id);
    if (!res.success) {
      toast.error(res.error || 'ทำรายการไม่สำเร็จ');
      return;
    }
    toast.success('ปิดใช้งานแล้ว');
    await load();
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ผู้รับการดูแล</h1>
            <p className="text-sm text-gray-600">เพิ่มข้อมูลผู้รับการดูแลเพื่อใช้ตอนสร้างงาน</p>
          </div>
          <div className="w-full sm:w-auto">
            <Button
              variant="primary"
              fullWidth
              className="sm:w-auto whitespace-nowrap"
              onClick={() => navigate('/hirer/care-recipients/new')}
            >
              เพิ่มผู้รับการดูแล
            </Button>
          </div>
        </div>

        {loading ? (
          <LoadingState message="กำลังโหลด..." />
        ) : active.length === 0 ? (
          <Card className="p-4 sm:p-6">
            <div className="text-sm text-gray-700">ยังไม่มีผู้รับการดูแล</div>
            <div className="mt-4 flex gap-2">
              <Link to="/hirer/care-recipients/new">
                <Button variant="primary">เพิ่มคนแรก</Button>
              </Link>
              <Link to="/hirer/create-job">
                <Button variant="outline">ไปสร้างงาน</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {active.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-lg font-semibold text-gray-900 line-clamp-1">{p.patient_display_name}</div>
                        <div className="text-xs text-gray-700 mt-1">
                          {(() => {
                            const birthYear = parseBirthYear(p.birth_year);
                            const age = getAgeFromBirthYear(birthYear);
                            const ageBandLabel = formatAgeBand(p.age_band);
                            const birthYearLabel = birthYear ? `ปีเกิด ${birthYear}` : 'ปีเกิด -';
                            const ageLabel = age !== null ? `อายุ ${age} ปี` : ageBandLabel ? `ช่วงอายุ ${ageBandLabel}` : 'อายุ -';
                            return `${birthYearLabel} • ${ageLabel}`;
                          })()}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">{summarize(p) || '-'}</div>
                        {p.general_health_summary && (
                          <div className="text-sm text-gray-700 mt-2 line-clamp-2">{p.general_health_summary}</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button variant="outline" size="sm" onClick={() => navigate(`/hirer/care-recipients/${p.id}/edit`)}>
                      แก้ไข
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDeactivate(p.id)}>
                      ปิดใช้งาน
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
