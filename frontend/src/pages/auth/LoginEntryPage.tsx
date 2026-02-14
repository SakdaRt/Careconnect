import { Link } from 'react-router-dom';
import { Mail, Phone } from 'lucide-react';
import { AuthLayout } from '../../layouts';
import { Button } from '../../components/ui';
export default function LoginEntryPage() {

  return (
    <AuthLayout>
      <div className="bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">เข้าสู่ระบบ</h1>
        <p className="text-gray-600 text-center mb-8">เลือกวิธีการเข้าสู่ระบบ</p>

        <div className="space-y-4">
          <Link to="/login/email" className="block">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              leftIcon={<Mail className="w-5 h-5" />}
            >
              เข้าสู่ระบบด้วยอีเมล
            </Button>
          </Link>

          <Link to="/login/phone" className="block">
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              leftIcon={<Phone className="w-5 h-5" />}
            >
              เข้าสู่ระบบด้วยเบอร์โทร
            </Button>
          </Link>
        </div>

        <div className="mt-6 text-center">
          <Link to="/forgot-password" className="text-blue-600 hover:text-blue-700 text-sm">
            ลืมรหัสผ่าน?
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-gray-600 mb-4">ยังไม่มีบัญชี?</p>
          <Link to="/register">
            <Button variant="outline" size="lg" fullWidth>
              สมัครสมาชิก
            </Button>
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
