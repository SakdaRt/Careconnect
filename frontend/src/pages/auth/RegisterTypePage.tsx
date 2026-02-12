import { Link, useNavigate } from 'react-router-dom';
import { Mail, Phone, Info } from 'lucide-react';
import { AuthLayout } from '../../layouts';
import { Button } from '../../components/ui';

export default function RegisterTypePage() {
  const navigate = useNavigate();

  return (
    <AuthLayout>
      <div className="bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">สมัครสมาชิก</h1>
        <p className="text-gray-600 text-center mb-8">เลือกประเภทบัญชีที่คุณต้องการ</p>

        <div className="space-y-4">
          {/* Guest Account - Email */}
          <div className="border-2 border-blue-200 rounded-lg p-6 hover:border-blue-400 transition-colors">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 mb-1">บัญชีแขก (Guest)</h3>
                <p className="text-sm text-gray-600 mb-3">
                  ลงทะเบียนด้วยอีเมล - เหมาะสำหรับผู้ว่าจ้างที่ต้องการหาผู้ดูแลเท่านั้น
                </p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>สร้างงานและจ้างผู้ดูแลได้ทันที</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>ไม่ต้องยืนยันตัวตนด้วยเบอร์โทร</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-red-600 mt-0.5">✗</span>
                    <span>ไม่สามารถสมัครเป็นผู้ดูแลได้</span>
                  </div>
                </div>
              </div>
            </div>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              leftIcon={<Mail className="w-5 h-5" />}
              onClick={() => navigate('/register/guest')}
            >
              สมัครด้วยอีเมล
            </Button>
          </div>

          {/* Member Account - Phone */}
          <div className="border-2 border-green-200 rounded-lg p-6 hover:border-green-400 transition-colors">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Phone className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 mb-1">บัญชีสมาชิก (Member)</h3>
                <p className="text-sm text-gray-600 mb-3">
                  ลงทะเบียนด้วยเบอร์โทรศัพท์ - เหมาะสำหรับทั้งผู้ว่าจ้างและผู้ดูแล
                </p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>สามารถเป็นทั้งผู้ว่าจ้างและผู้ดูแลได้</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>รับงานและหารายได้เป็นผู้ดูแล</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>ยืนยันตัวตนด้วย OTP ผ่าน SMS</span>
                  </div>
                </div>
              </div>
            </div>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              leftIcon={<Phone className="w-5 h-5" />}
              onClick={() => navigate('/register/member')}
            >
              สมัครด้วยเบอร์โทร
            </Button>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">หมายเหตุ:</p>
              <p>
                หากคุณต้องการรับงานเป็นผู้ดูแล กรุณาเลือก <strong>บัญชีสมาชิก</strong> เท่านั้น
                <br />
                บัญชีแขกสามารถสร้างงานและจ้างผู้ดูแลได้เท่านั้น
              </p>
            </div>
          </div>
        </div>

        {/* Already have account */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-gray-600 mb-4">มีบัญชีอยู่แล้ว?</p>
          <Link to="/login">
            <Button variant="outline" fullWidth>
              เข้าสู่ระบบ
            </Button>
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
