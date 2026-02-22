import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { KeyRound, ArrowLeft, CheckCircle } from 'lucide-react';
import { AuthLayout } from '../../layouts';
import { Button, Input } from '../../components/ui';
import toast from 'react-hot-toast';
import { appApi } from '../../services/appApi';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!newPassword) {
      newErrors.password = 'กรุณากรอกรหัสผ่านใหม่';
    } else if (newPassword.length < 8) {
      newErrors.password = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
    }
    if (!confirmPassword) {
      newErrors.confirm = 'กรุณายืนยันรหัสผ่าน';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirm = 'รหัสผ่านไม่ตรงกัน';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  if (!token || !email) {
    return (
      <AuthLayout>
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">ลิงก์ไม่ถูกต้อง</h1>
          <p className="text-gray-600 mb-6">
            ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอลิงก์ใหม่
          </p>
          <Link to="/forgot-password">
            <Button variant="primary" size="lg" fullWidth>
              ขอลิงก์รีเซ็ตรหัสผ่านใหม่
            </Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await appApi.resetPassword(token, email, newPassword);
      if (res.success) {
        setSuccess(true);
        toast.success('รีเซ็ตรหัสผ่านสำเร็จ');
      } else {
        toast.error(res.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout>
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">เปลี่ยนรหัสผ่านสำเร็จ!</h1>
          <p className="text-gray-600 mb-8">
            คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้แล้ว
          </p>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => navigate('/login')}
          >
            ไปหน้าเข้าสู่ระบบ
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="bg-white rounded-lg shadow-md p-8">
        <Link
          to="/login"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
          <span className="text-sm">กลับ</span>
        </Link>

        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <KeyRound className="w-8 h-8 text-blue-600" aria-hidden="true" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">ตั้งรหัสผ่านใหม่</h1>
        <p className="text-gray-600 text-center mb-8">
          กรอกรหัสผ่านใหม่สำหรับบัญชี <span className="font-semibold">{decodeURIComponent(email)}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="รหัสผ่านใหม่"
            type="password"
            placeholder="อย่างน้อย 8 ตัวอักษร"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            error={errors.password}
            leftIcon={<KeyRound className="w-5 h-5" aria-hidden="true" />}
            required
          />

          <Input
            label="ยืนยันรหัสผ่านใหม่"
            type="password"
            placeholder="กรอกรหัสผ่านอีกครั้ง"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={errors.confirm}
            leftIcon={<KeyRound className="w-5 h-5" aria-hidden="true" />}
            required
          />

          <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
            ตั้งรหัสผ่านใหม่
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
