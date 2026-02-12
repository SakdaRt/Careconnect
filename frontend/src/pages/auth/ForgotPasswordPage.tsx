import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Mail, ArrowLeft } from 'lucide-react';
import { AuthLayout } from '../../layouts';
import { Button, Input } from '../../components/ui';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const validate = () => {
    if (!email) {
      setError('กรุณากรอกอีเมล');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('รูปแบบอีเมลไม่ถูกต้อง');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);
    try {
      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setSent(true);
      toast.success('ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว');
    } catch (error: any) {
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout>
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8 text-green-600" />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-4">ตรวจสอบอีเมลของคุณ</h1>

          <p className="text-gray-600 mb-6">
            เราได้ส่งลิงก์สำหรับรีเซ็ตรหัสผ่านไปยัง
            <br />
            <span className="font-semibold text-gray-900">{email}</span>
          </p>

          <p className="text-sm text-gray-500 mb-8">
            กรุณาตรวจสอบอีเมลและคลิกลิงก์เพื่อตั้งรหัสผ่านใหม่
            <br />
            ลิงก์จะหมดอายุภายใน 1 ชั่วโมง
          </p>

          <Link to="/login">
            <Button variant="primary" size="lg" fullWidth>
              กลับไปหน้าเข้าสู่ระบบ
            </Button>
          </Link>

          <div className="mt-6">
            <button
              onClick={() => {
                setSent(false);
                setEmail('');
              }}
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              ไม่ได้รับอีเมล? ส่งใหม่อีกครั้ง
            </button>
          </div>
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
          <ArrowLeft className="w-4 h-4 mr-2" />
          <span className="text-sm">กลับ</span>
        </Link>

        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">ลืมรหัสผ่าน?</h1>
        <p className="text-gray-600 text-center mb-8">
          กรอกอีเมลของคุณ เราจะส่งลิงก์สำหรับรีเซ็ตรหัสผ่านให้
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="อีเมล"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
            leftIcon={<Mail className="w-5 h-5" />}
            required
          />

          <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
            ส่งลิงก์รีเซ็ตรหัสผ่าน
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-gray-600 mb-4">จำรหัสผ่านได้แล้ว?</p>
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
