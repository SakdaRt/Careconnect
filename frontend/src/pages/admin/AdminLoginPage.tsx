import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Shield } from 'lucide-react';
import { AuthLayout } from '../../layouts';
import { Button, Input, PasswordInput } from '../../components/ui';
import { useAuth } from '../../contexts';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { user, login, logout, isLoading } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'admin') {
      navigate('/admin/dashboard', { replace: true });
      return;
    }
    logout();
    toast.error('บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานแอดมิน');
  }, [logout, navigate, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email.trim() || !formData.password) {
      toast.error('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }
    setSubmitting(true);
    try {
      await login(formData.email.trim(), formData.password);
    } catch (error: any) {
      toast.error(error?.message || 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">Admin Portal</h1>
        <p className="text-gray-600 text-center mb-8">เข้าสู่ระบบสำหรับผู้ดูแลระบบ</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="อีเมล"
            type="email"
            placeholder="admin@email.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
          <PasswordInput
            label="รหัสผ่าน"
            placeholder="กรอกรหัสผ่าน"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
          />
          <Button type="submit" variant="primary" size="lg" fullWidth loading={submitting || isLoading}>
            เข้าสู่ระบบ
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/" className="text-gray-600 hover:text-gray-700 text-sm">
            ← กลับหน้าเว็บหลัก
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}

