import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BadgeCheck, ShieldCheck } from 'lucide-react';
import { MainLayout } from '../../layouts';
import { Button, Card, Input, LoadingState } from '../../components/ui';
import { useAuth } from '../../contexts';
import { appApi } from '../../services/appApi';
import type { KycStatus } from '../../services/api';

const verifiedLevels = new Set(['L2', 'L3']);
const statusLabel: Record<KycStatus['status'], { label: string; color: string; icon: any }> = {
  pending: { label: 'รอตรวจสอบ', color: 'text-amber-600', icon: ShieldCheck },
  approved: { label: 'ยืนยันแล้ว', color: 'text-green-600', icon: BadgeCheck },
  rejected: { label: 'ไม่ผ่านการยืนยัน', color: 'text-red-600', icon: ShieldCheck },
  expired: { label: 'หมดอายุ', color: 'text-gray-500', icon: ShieldCheck },
};

export default function KycPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [kyc, setKyc] = useState<KycStatus | null>(null);
  const [form, setForm] = useState({
    full_name: '',
    national_id: '',
    document_type: 'national_id',
  });

  const kycStatus = useMemo(() => {
    const level = user?.trust_level || 'L0';
    if (kyc?.status) {
      return statusLabel[kyc.status];
    }
    return verifiedLevels.has(level)
      ? { label: 'ยืนยันแล้ว', color: 'text-green-600', icon: BadgeCheck }
      : { label: 'ยังไม่ยืนยัน', color: 'text-amber-600', icon: ShieldCheck };
  }, [kyc?.status, user?.trust_level]);

  const StatusIcon = kycStatus.icon;
  const isVerified = kyc?.status === 'approved' || verifiedLevels.has(user?.trust_level || 'L0');

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await appApi.getKycStatus();
      if (res.success) {
        setKyc(res.data?.kyc || null);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'โหลดสถานะไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const submitMock = async () => {
    if (submitting) return;
    if (!form.full_name.trim() || !form.national_id.trim()) {
      toast.error('กรุณากรอกชื่อ-นามสกุลและเลขบัตร');
      return;
    }
    setSubmitting(true);
    try {
      const res = await appApi.submitMockKyc({
        full_name: form.full_name.trim(),
        national_id: form.national_id.trim(),
        document_type: form.document_type,
      });
      if (!res.success) {
        toast.error(res.error || 'ยืนยันตัวตนไม่สำเร็จ');
        return;
      }
      setKyc(res.data?.kyc || null);
      await refreshUser();
      toast.success('ยืนยันตัวตนสำเร็จ');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ยืนยันตัวตนไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MainLayout showBottomBar={false}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ยืนยันตัวตน (KYC)</h1>
            <p className="text-sm text-gray-600">คุณสามารถยืนยันตัวตนภายหลังได้ทุกเวลา</p>
          </div>
          <Button variant="outline" onClick={() => navigate(-1)}>
            ย้อนกลับ
          </Button>
        </div>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <StatusIcon className={`w-6 h-6 ${kycStatus.color}`} />
            <div>
              <div className="text-sm text-gray-500">สถานะปัจจุบัน</div>
              <div className={`text-lg font-semibold ${kycStatus.color}`}>{kycStatus.label}</div>
            </div>
          </div>
          <div className="mt-3 text-sm text-gray-600">
            ระดับความน่าเชื่อถือปัจจุบัน: <span className="font-semibold text-gray-900">{user?.trust_level || 'L0'}</span>
          </div>
          {kyc?.verified_at && (
            <div className="mt-2 text-xs text-gray-500">
              ยืนยันเมื่อ: {new Date(kyc.verified_at).toLocaleString('th-TH')}
            </div>
          )}
        </Card>

        {loading ? (
          <LoadingState message="กำลังโหลดสถานะ..." />
        ) : (
          <Card className="p-6">
            <div className="text-sm font-semibold text-gray-900 mb-4">กรอกข้อมูลยืนยันตัวตน (ตัวอย่าง)</div>
            <div className="grid gap-3">
              <Input
                label="ชื่อ-นามสกุล"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="เช่น สมชาย ใจดี"
                disabled={isVerified}
              />
              <Input
                label="เลขบัตรประชาชน"
                value={form.national_id}
                onChange={(e) => setForm({ ...form, national_id: e.target.value })}
                placeholder="1234567890123"
                disabled={isVerified}
              />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-gray-700">ประเภทเอกสาร</label>
                <select
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white"
                  value={form.document_type}
                  onChange={(e) => setForm({ ...form, document_type: e.target.value })}
                  disabled={isVerified}
                >
                  <option value="national_id">บัตรประชาชน</option>
                  <option value="passport">หนังสือเดินทาง</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <Button
                variant="primary"
                onClick={submitMock}
                loading={submitting}
                disabled={isVerified}
              >
                ยืนยันตัวตนด้วยข้อมูลตัวอย่าง
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  setForm({
                    full_name: 'สมหญิง ใจดี',
                    national_id: '1101700203451',
                    document_type: 'national_id',
                  })
                }
                disabled={isVerified}
              >
                เติมข้อมูลตัวอย่าง
              </Button>
            </div>
          </Card>
        )}

        <Card className="p-6">
          <div className="text-sm text-gray-600 mb-4">
            การยืนยันตัวตนช่วยเพิ่มความน่าเชื่อถือและปลดล็อกงานบางประเภทที่มีความเสี่ยงสูง
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="primary"
              onClick={submitMock}
              loading={submitting}
              disabled={isVerified}
            >
              เริ่มยืนยันตัวตน
            </Button>
            <Button variant="outline" onClick={() => navigate('/settings')}>
              ทำภายหลัง
            </Button>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
