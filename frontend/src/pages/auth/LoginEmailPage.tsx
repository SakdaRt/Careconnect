import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Mail } from 'lucide-react';
import { AuthLayout } from '../../layouts';
import { Button, Input, PasswordInput } from '../../components/ui';
import { useAuth } from '../../contexts';
import toast from 'react-hot-toast';

export default function LoginEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const newErrors: typeof errors = {};

    if (!formData.email) {
      newErrors.email = 'กรุณากรอกอีเมล';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'รูปแบบอีเมลไม่ถูกต้อง';
    }

    if (!formData.password) {
      newErrors.password = 'กรุณากรอกรหัสผ่าน';
    } else if (formData.password.length < 6) {
      newErrors.password = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);
    try {
      const user = await login(formData.email, formData.password);
      toast.success('เข้าสู่ระบบสำเร็จ');

      const state = location.state as { from?: string } | null;
      const destination = user.role === 'admin' ? '/admin/dashboard' : '/select-role';
      setTimeout(() => {
        navigate(destination, {
          replace: true,
          state: user.role === 'admin' ? undefined : { mode: 'login', from: state?.from },
        });
      }, 500);
    } catch (error: any) {
      toast.error(error.message || 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">
          เข้าสู่ระบบด้วยอีเมล
        </h1>
        <p className="text-gray-600 text-center mb-8">กรอกอีเมลและรหัสผ่านของคุณ</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="อีเมล"
            type="email"
            placeholder="your@email.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            error={errors.email}
            leftIcon={<Mail className="w-5 h-5" />}
            required
          />

          <PasswordInput
            label="รหัสผ่าน"
            placeholder="กรอกรหัสผ่าน"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            error={errors.password}
            required
          />

          <div className="flex items-center justify-between text-sm">
            <Link to="/forgot-password" className="text-blue-600 hover:text-blue-700">
              ลืมรหัสผ่าน?
            </Link>
          </div>

          <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
            เข้าสู่ระบบ
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-gray-600 hover:text-gray-700 text-sm">
            ← กลับไปเลือกวิธีเข้าสู่ระบบอื่น
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-gray-600 mb-4">ยังไม่มีบัญชี?</p>
          <Link to="/register">
            <Button variant="outline" fullWidth>
              สมัครสมาชิก
            </Button>
          </Link>
        </div>

      </div>
    </AuthLayout>
  );
}
