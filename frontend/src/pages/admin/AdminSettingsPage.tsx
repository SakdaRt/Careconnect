import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../../layouts';
import { Button, Card, Input, LoadingState } from '../../components/ui';
import api from '../../services/api';
import { useAuth } from '../../contexts';

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<{ ok: boolean; db: string; now: string } | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [trustUserId, setTrustUserId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const h = await api.adminGetHealth();
      setHealth(h.success ? (h.data as any) : null);
      const s = await api.adminGetStats();
      setStats(s.success ? s.data : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const env = useMemo(() => {
    const e = (import.meta as any).env as Record<string, string | undefined>;
    return {
      apiBase: e.VITE_API_URL || e.VITE_API_BASE_URL || '(proxy)',
      socketUrl: e.VITE_SOCKET_URL || '(default)',
    };
  }, []);

  const doTrustAll = async () => {
    setSubmitting('trust_all');
    try {
      const res = await api.adminRecalcTrustAll();
      if (!res.success) {
        toast.error(res.error || 'ทำรายการไม่สำเร็จ');
        return;
      }
      toast.success('สั่งคำนวณ trust level แล้ว');
    } finally {
      setSubmitting(null);
    }
  };

  const doTrustUser = async () => {
    const id = trustUserId.trim();
    if (!id) {
      toast.error('กรุณากรอก user id');
      return;
    }
    setSubmitting('trust_user');
    try {
      const res = await api.adminRecalcTrustUser(id);
      if (!res.success) {
        toast.error(res.error || 'ทำรายการไม่สำเร็จ');
        return;
      }
      toast.success('สั่งคำนวณ trust level สำหรับผู้ใช้แล้ว');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold text-gray-900">ตั้งค่าระบบ</div>
            <div className="text-sm text-gray-600">Health, stats และเครื่องมือผู้ดูแลระบบ</div>
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

            <Card className="p-6">
              <div className="text-sm font-semibold text-gray-900 mb-4">สถิติ</div>
              {!stats ? (
                <div className="text-sm text-gray-600">ไม่พบข้อมูลสถิติ</div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-2">Users</div>
                    <div className="text-sm text-gray-800 space-y-1">
                      {Object.entries(stats.users || {}).map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between">
                          <div className="text-gray-700">{k}</div>
                          <div className="font-semibold">{Number(v).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-2">Jobs</div>
                    <div className="text-sm text-gray-800 space-y-1">
                      {Object.entries(stats.jobs || {}).map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between">
                          <div className="text-gray-700">{k}</div>
                          <div className="font-semibold">{Number(v).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="lg:col-span-2">
                    <div className="text-xs text-gray-500 mb-2">Wallet Totals</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {(stats.wallets || []).map((w: any) => (
                        <Card key={w.type} className="p-4">
                          <div className="text-xs text-gray-500">{w.type}</div>
                          <div className="text-sm text-gray-800 mt-2 flex items-center justify-between">
                            <div>available</div>
                            <div className="font-semibold">{Number(w.totalAvailable || 0).toLocaleString()}</div>
                          </div>
                          <div className="text-sm text-gray-800 mt-1 flex items-center justify-between">
                            <div>held</div>
                            <div className="font-semibold">{Number(w.totalHeld || 0).toLocaleString()}</div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Card>

            <Card className="p-6">
              <div className="text-sm font-semibold text-gray-900 mb-4">เครื่องมือ</div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" loading={submitting === 'trust_all'} onClick={doTrustAll}>
                  คำนวณ Trust Level ทั้งหมด
                </Button>
                <div className="flex-1 min-w-[240px]">
                  <Input
                    label="Trust Level: user id"
                    value={trustUserId}
                    onChange={(e) => setTrustUserId(e.target.value)}
                    placeholder="ใส่ user_id"
                  />
                </div>
                <Button variant="primary" loading={submitting === 'trust_user'} onClick={doTrustUser}>
                  คำนวณเฉพาะผู้ใช้
                </Button>
              </div>
              <div className="text-xs text-gray-500 mt-3">
                ผู้ใช้งาน: {user?.email || '-'} • role: {user?.role || '-'}
              </div>
            </Card>

            <Card className="p-6">
              <div className="text-sm font-semibold text-gray-900 mb-4">Environment</div>
              <div className="text-sm text-gray-800 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-gray-600">VITE_API</div>
                  <div className="font-mono text-xs break-all">{env.apiBase}</div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-gray-600">VITE_SOCKET_URL</div>
                  <div className="font-mono text-xs break-all">{env.socketUrl}</div>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

