import { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '../../layouts';
import { Button, Card, LoadingState } from '../../components/ui';
import api from '../../services/api';

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<{ ok: boolean; db: string; now: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const h = await api.adminGetHealth();
      setHealth(h.success ? (h.data as any) : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);


  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold text-gray-900">ตั้งค่าระบบ</div>
            <div className="text-sm text-gray-600">ตรวจสอบสถานะ API และฐานข้อมูล</div>
          </div>
          <Button variant="outline" onClick={load}>
            รีเฟรช
          </Button>
        </div>

        {loading ? (
          <LoadingState message="กำลังโหลด..." />
        ) : (
          <>
            <Card className="p-6">
              <div className="text-sm font-semibold text-gray-900 mb-4">สถานะระบบ</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="text-xs text-gray-500">API</div>
                  <div className={`text-sm font-semibold ${health?.ok ? 'text-green-700' : 'text-red-700'}`}>
                    {health?.ok ? 'ok' : 'error'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Database</div>
                  <div className={`text-sm font-semibold ${health?.db === 'ok' ? 'text-green-700' : 'text-red-700'}`}>
                    {health?.db || '-'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">เวลา</div>
                  <div className="text-sm font-semibold text-gray-900">{health?.now ? new Date(health.now).toLocaleString('th-TH') : '-'}</div>
                </div>
              </div>
            </Card>

          </>
        )}
      </div>
    </AdminLayout>
  );
}

