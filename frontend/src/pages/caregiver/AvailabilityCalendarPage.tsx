import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarDays, Clock3, Save } from 'lucide-react';
import { MainLayout } from '../../layouts';
import { Button, Card, LoadingState } from '../../components/ui';
import { appApi } from '../../services/appApi';

const DAYS = [
  { value: 1, short: 'จ.', label: 'วันจันทร์' },
  { value: 2, short: 'อ.', label: 'วันอังคาร' },
  { value: 3, short: 'พ.', label: 'วันพุธ' },
  { value: 4, short: 'พฤ.', label: 'วันพฤหัสบดี' },
  { value: 5, short: 'ศ.', label: 'วันศุกร์' },
  { value: 6, short: 'ส.', label: 'วันเสาร์' },
  { value: 0, short: 'อา.', label: 'วันอาทิตย์' },
];

export default function AvailabilityCalendarPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableFrom, setAvailableFrom] = useState('08:00');
  const [availableTo, setAvailableTo] = useState('18:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await appApi.getMyProfile();
        if (!res.success || !res.data?.profile) {
          toast.error(res.error || 'โหลดข้อมูลเวลาว่างไม่สำเร็จ');
          return;
        }

        const profile: any = res.data.profile;
        setAvailableFrom(String(profile.available_from || '08:00'));
        setAvailableTo(String(profile.available_to || '18:00'));
        setSelectedDays(Array.isArray(profile.available_days) ? profile.available_days : []);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const sortedSelectedDays = useMemo(() => {
    return [...selectedDays].sort((a, b) => {
      const normA = a === 0 ? 7 : a;
      const normB = b === 0 ? 7 : b;
      return normA - normB;
    });
  }, [selectedDays]);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) => {
      if (prev.includes(day)) return prev.filter((item) => item !== day);
      return [...prev, day];
    });
  };

  const handleSave = async () => {
    if (!availableFrom || !availableTo) {
      toast.error('กรุณาระบุช่วงเวลาให้ครบ');
      return;
    }

    if (selectedDays.length === 0) {
      toast.error('กรุณาเลือกอย่างน้อย 1 วัน');
      return;
    }

    setSaving(true);
    try {
      const res = await appApi.updateMyProfile({
        available_from: availableFrom,
        available_to: availableTo,
        available_days: sortedSelectedDays,
      });

      if (!res.success) {
        toast.error(res.error || 'บันทึกปฏิทินเวลาว่างไม่สำเร็จ');
        return;
      }

      toast.success('บันทึกปฏิทินเวลาว่างแล้ว');
    } catch {
      toast.error('บันทึกปฏิทินเวลาว่างไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <LoadingState message="กำลังโหลดปฏิทินเวลาว่าง..." />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ปฏิทินเวลาว่างผู้ดูแล</h1>
          <p className="text-sm text-gray-600">ตั้งค่าวันและช่วงเวลาที่พร้อมรับงาน</p>
        </div>

        <Card padding="responsive">
          <div className="flex items-center gap-2 mb-4">
            <Clock3 className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">ช่วงเวลาที่พร้อมรับงาน</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm text-gray-700">
              เริ่ม
              <input
                type="time"
                data-testid="availability-from"
                value={availableFrom}
                onChange={(e) => setAvailableFrom(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="text-sm text-gray-700">
              สิ้นสุด
              <input
                type="time"
                data-testid="availability-to"
                value={availableTo}
                onChange={(e) => setAvailableTo(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>
        </Card>

        <Card padding="responsive">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">วันประจำสัปดาห์</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {DAYS.map((day) => {
              const active = selectedDays.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  data-testid={`availability-day-${day.value}`}
                  onClick={() => toggleDay(day.value)}
                  className={`rounded-xl border px-3 py-3 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    active
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                  aria-pressed={active}
                >
                  <div className="text-sm font-semibold">{day.short}</div>
                  <div className="text-xs mt-1 text-gray-500">{day.label.replace('วัน', '')}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 text-xs text-gray-500">
            เลือกแล้ว {sortedSelectedDays.length} วัน
          </div>
        </Card>

        <div className="flex justify-end">
          <Button variant="primary" onClick={handleSave} loading={saving} data-testid="availability-save">
            <Save className="w-4 h-4" aria-hidden="true" />
            บันทึกปฏิทิน
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
