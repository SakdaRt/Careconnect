import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Briefcase, Heart, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { AuthLayout } from '../../layouts';
import { Button } from '../../components/ui';
import { useAuth } from '../../contexts';
import { appApi } from '../../services/appApi';

type Role = 'hirer' | 'caregiver';

export default function RoleSelectionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setActiveRole, updateUser } = useAuth();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [changing, setChanging] = useState(false);

  const state = location.state as { mode?: 'login'; from?: string } | null;
  const isLoginFlow = state?.mode === 'login';
  const accountType = user?.account_type || 'guest';
  const canSelectCaregiver = accountType !== 'guest' || !!user?.is_phone_verified;

  const resolveRedirectPath = (role: Role) => {
    if (role === 'hirer') return '/hirer/home';
    return '/caregiver/jobs/feed';
  };

  const handleContinue = async () => {
    if (!selectedRole) return;

    if (isLoginFlow) {
      setActiveRole(selectedRole);
      setChanging(true);
      try {
        if (selectedRole === 'caregiver' && accountType === 'guest' && !user?.is_phone_verified) {
          toast.error('ยืนยันเบอร์โทรก่อนเพื่อเปิดใช้งานบทบาทผู้ดูแล');
          return;
        }
        const res = await appApi.updateRole(selectedRole);
        if (!res.success) {
          toast.error(res.error || 'ไม่สามารถเปลี่ยนบทบาทได้');
          return;
        }
        if (res.data?.user) {
          updateUser(res.data.user);
        }
      } catch (error: any) {
        toast.error(error?.message || 'ไม่สามารถเปลี่ยนบทบาทได้');
        return;
      } finally {
        setChanging(false);
      }
      const acceptance = user?.policy_acceptances?.[selectedRole];
      if (!acceptance) {
        navigate('/register/consent', {
          replace: true,
          state: { role: selectedRole, from: state?.from, mode: 'login' },
        });
        return;
      }
      const destination = state?.from || resolveRedirectPath(selectedRole);
      navigate(destination, { replace: true });
      return;
    }

    navigate('/login', { replace: true });
  };

  useEffect(() => {
    if (!isLoginFlow) {
      navigate('/login', { replace: true });
    }
  }, [isLoginFlow, navigate]);

  return (
    <AuthLayout>
      <div className="bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">
          เลือกบทบาทของคุณ
        </h1>
        <p className="text-gray-600 text-center mb-8">
          คุณต้องการใช้บริการในฐานะอะไร?
        </p>

        <div className="space-y-4">
          {/* Hirer Role */}
          <div
            onClick={() => setSelectedRole('hirer')}
            className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${
              selectedRole === 'hirer'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Briefcase className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold text-gray-900">ผู้ว่าจ้าง</h3>
                  {selectedRole === 'hirer' && (
                    <span className="text-blue-600 text-sm">✓ เลือกแล้ว</span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  สร้างงานและจ้างผู้ดูแลสำหรับคนในครอบครัวหรือผู้สูงอายุ
                </p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>สร้างและจัดการงานดูแลผู้สูงอายุ</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>ค้นหาผู้ดูแลที่เหมาะสม</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>ชำระเงินผ่านระบบที่ปลอดภัย</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>ติดตามงานและประเมินผู้ดูแล</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Caregiver Role */}
          <div
            onClick={() => {
              if (!canSelectCaregiver) {
                toast.error('ยืนยันเบอร์โทรก่อนเพื่อเปิดใช้งานบทบาทผู้ดูแล');
                return;
              }
              setSelectedRole('caregiver');
            }}
            className={`border-2 rounded-lg p-6 transition-all ${
              !canSelectCaregiver
                ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50'
                : selectedRole === 'caregiver'
                ? 'border-green-500 bg-green-50 cursor-pointer'
                : 'border-gray-200 hover:border-green-300 cursor-pointer'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Heart className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold text-gray-900">ผู้ดูแล</h3>
                  {selectedRole === 'caregiver' && (
                    <span className="text-green-600 text-sm">✓ เลือกแล้ว</span>
                  )}
                  {!canSelectCaregiver && (
                    <span className="text-red-600 text-xs bg-red-100 px-2 py-1 rounded">
                      ไม่พร้อมใช้งาน
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  รับงานดูแลผู้สูงอายุและสร้างรายได้
                </p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-green-600 mt-0.5">•</span>
                    <span>ค้นหางานที่เหมาะกับคุณ</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-green-600 mt-0.5">•</span>
                    <span>รับค่าจ้างผ่านระบบที่โปร่งใส</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-green-600 mt-0.5">•</span>
                    <span>สร้างโปรไฟล์และรับรีวิว</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-green-600 mt-0.5">•</span>
                    <span>ยืนยันตัวตนเพื่อสร้างความน่าเชื่อถือ</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info for Guest accounts */}
        {!canSelectCaregiver && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-900">
                <p className="font-semibold mb-1">หมายเหตุ:</p>
                <p>
                  หากต้องการเป็นผู้ดูแล กรุณายืนยันเบอร์โทรศัพท์ก่อน
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Continue Button */}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!selectedRole || changing}
          onClick={handleContinue}
          className="mt-6"
        >
          ดำเนินการต่อ
        </Button>

        {/* Can change later info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            💡 คุณสามารถเปลี่ยนบทบาทได้ในภายหลังจากการตั้งค่าบัญชี
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
