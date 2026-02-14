import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Shield, FileText, Lock, CheckCircle } from 'lucide-react';
import { AuthLayout } from '../../layouts';
import { Button } from '../../components/ui';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts';
import { appApi } from '../../services/appApi';

export default function ConsentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, activeRole, setActiveRole, refreshUser } = useAuth();
  const [consents, setConsents] = useState({
    terms: false,
    privacy: false,
    dataProcessing: false,
  });
  const [loading, setLoading] = useState(false);

  const state = location.state as { role?: 'hirer' | 'caregiver'; from?: string; mode?: 'login' } | null;
  const pendingRole = localStorage.getItem('pendingRole') || '';
  const resolvedRole =
    state?.role ||
    (pendingRole === 'caregiver' ? 'caregiver' : pendingRole === 'hirer' ? 'hirer' : null) ||
    (activeRole === 'caregiver' ? 'caregiver' : activeRole === 'hirer' ? 'hirer' : null) ||
    (user?.role === 'caregiver' ? 'caregiver' : 'hirer');
  const POLICY_VERSION = '2026-02-01';

  const allConsentsAccepted = consents.terms && consents.privacy && consents.dataProcessing;

  const handleComplete = async () => {
    if (!allConsentsAccepted) {
      toast.error('กรุณายอมรับเงื่อนไขทั้งหมด');
      return;
    }

    setLoading(true);
    try {
      const response = await appApi.acceptPolicy(resolvedRole, POLICY_VERSION);
      if (!response.success) {
        toast.error(typeof response.error === 'string' ? response.error : 'ยืนยัน Policy ไม่สำเร็จ');
        return;
      }

      await refreshUser();

      // Clear pending role
      localStorage.removeItem('pendingRole');
      setActiveRole(resolvedRole);

      toast.success('สมัครสมาชิกสำเร็จ! ยินดีต้อนรับสู่ Careconnect');

      // Navigate based on role
      setTimeout(() => {
        const destination =
          resolvedRole === 'hirer' ? '/hirer/home' : '/caregiver/jobs/feed';
        navigate(state?.from || destination, { replace: true });
      }, 500);
    } catch (error: any) {
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">
          เงื่อนไขและความเป็นส่วนตัว
        </h1>
        <p className="text-gray-600 text-center mb-8">
          กรุณาอ่านและยอมรับเงื่อนไขก่อนใช้บริการ
        </p>

        {/* Role Summary */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900 text-center">
            คุณกำลังสมัครในฐานะ:{' '}
            <strong>{resolvedRole === 'hirer' ? 'ผู้ว่าจ้าง' : 'ผู้ดูแล'}</strong>
          </p>
        </div>

        {/* Consent Sections */}
        <div className="space-y-4 mb-6">
          {/* Terms of Service */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start gap-3 mb-3">
              <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">
                  เงื่อนไขการให้บริการ (Terms of Service)
                </h3>
                <div className="text-sm text-gray-600 space-y-2 mb-3 max-h-32 overflow-y-auto bg-gray-50 p-3 rounded">
                  <p>
                    <strong>1. การใช้บริการ:</strong> คุณยอมรับว่าจะใช้บริการตามกฎหมายและระเบียบที่กำหนด
                  </p>
                  <p>
                    <strong>2. ความรับผิดชอบ:</strong> คุณรับผิดชอบต่อข้อมูลที่ให้ไว้และการกระทำทั้งหมดในบัญชีของคุณ
                  </p>
                  <p>
                    <strong>3. การชำระเงิน:</strong> ระบบจะคุ้มครองการชำระเงินด้วย Escrow System
                    เงินจะถูกโอนเมื่องานเสร็จสมบูรณ์เท่านั้น
                  </p>
                  <p>
                    <strong>4. การยกเลิก:</strong> ผู้ใช้สามารถยกเลิกงานได้ตามเงื่อนไข
                    แต่อาจมีค่าปรับตามกรณี
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consents.terms}
                    onChange={(e) => setConsents({ ...consents, terms: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    ข้าพเจ้ายอมรับเงื่อนไขการให้บริการ
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Privacy Policy */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start gap-3 mb-3">
              <Lock className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">
                  นโยบายความเป็นส่วนตัว (Privacy Policy)
                </h3>
                <div className="text-sm text-gray-600 space-y-2 mb-3 max-h-32 overflow-y-auto bg-gray-50 p-3 rounded">
                  <p>
                    <strong>1. การเก็บข้อมูล:</strong> เราเก็บข้อมูลส่วนบุคคล (ชื่อ, อีเมล, เบอร์โทร)
                    และข้อมูลการใช้บริการ
                  </p>
                  <p>
                    <strong>2. การใช้ข้อมูล:</strong> ข้อมูลจะใช้เพื่อการให้บริการ, การยืนยันตัวตน,
                    และการปรับปรุงบริการเท่านั้น
                  </p>
                  <p>
                    <strong>3. การแชร์ข้อมูล:</strong> เราจะไม่แชร์ข้อมูลส่วนบุคคลกับบุคคลที่สาม
                    ยกเว้นตามที่กฎหมายกำหนด
                  </p>
                  <p>
                    <strong>4. ความปลอดภัย:</strong> เราใช้มาตรการรักษาความปลอดภัยระดับสูง
                    รวมถึงการเข้ารหัสข้อมูล
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consents.privacy}
                    onChange={(e) => setConsents({ ...consents, privacy: e.target.checked })}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">
                    ข้าพเจ้ายอมรับนโยบายความเป็นส่วนตัว
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Data Processing */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start gap-3 mb-3">
              <CheckCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">
                  การประมวลผลข้อมูลส่วนบุคคล (PDPA)
                </h3>
                <div className="text-sm text-gray-600 space-y-2 mb-3 max-h-32 overflow-y-auto bg-gray-50 p-3 rounded">
                  <p>
                    <strong>1. สิทธิของคุณ:</strong> คุณมีสิทธิ์เข้าถึง, แก้ไข, ลบ,
                    และโอนย้ายข้อมูลของคุณได้ตามกฎหมาย PDPA
                  </p>
                  <p>
                    <strong>2. การยืนยันตัวตน:</strong> การใช้บริการบางประเภท (เช่น ผู้ดูแล)
                    ต้องมีการยืนยันตัวตน (KYC) ตามข้อกำหนด
                  </p>
                  <p>
                    <strong>3. ข้อมูลสุขภาพ:</strong> สำหรับผู้รับการดูแล
                    ข้อมูลสุขภาพจะถูกเก็บอย่างปลอดภัยและเข้าถึงได้เฉพาะผู้เกี่ยวข้องเท่านั้น
                  </p>
                  <p>
                    <strong>4. ระยะเวลาเก็บข้อมูล:</strong> เราจะเก็บข้อมูลตามระยะเวลาที่จำเป็น
                    หรือตามที่กฎหมายกำหนด
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consents.dataProcessing}
                    onChange={(e) =>
                      setConsents({ ...consents, dataProcessing: e.target.checked })
                    }
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">
                    ข้าพเจ้ายินยอมให้ประมวลผลข้อมูลส่วนบุคคล
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Complete Registration Button */}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!allConsentsAccepted}
          loading={loading}
          onClick={handleComplete}
        >
          ยอมรับและสมัครสมาชิก
        </Button>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            หากมีข้อสงสัย กรุณาติดต่อ{' '}
            <a href="mailto:support@careconnect.com" className="text-blue-600 hover:underline">
              support@careconnect.com
            </a>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
