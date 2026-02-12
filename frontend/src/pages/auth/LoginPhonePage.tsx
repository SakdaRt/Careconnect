import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Phone } from 'lucide-react';
import { AuthLayout } from '../../layouts';
import { Button, PhoneInput, PasswordInput } from '../../components/ui';
import { useAuth } from '../../contexts';
import toast from 'react-hot-toast';

export default function LoginPhonePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithPhone } = useAuth();
  const [formData, setFormData] = useState({
    phone: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ phone?: string; password?: string }>({});

  const validate = () => {
    const newErrors: typeof errors = {};

    if (!formData.phone) {
      newErrors.phone = 'กรุณากรอกเบอร์โทรศัพท์';
    } else {
      const digits = formData.phone.replace(/\D/g, '');
      if (digits.length < 10) {
        newErrors.phone = 'เบอร์โทรศัพท์ไม่ถูกต้อง';
      }
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
      // Extract digits only for API call
      const phoneDigits = formData.phone.replace(/\D/g, '');
      const formattedPhone = phoneDigits.startsWith('66')
        ? `+${phoneDigits}`
        : phoneDigits.startsWith('0')
        ? `+66${phoneDigits.slice(1)}`
        : `+66${phoneDigits}`;

      const user = await loginWithPhone(formattedPhone, formData.password);
      toast.success('เข้าสู่ระบบสำเร็จ');

      const state = location.state as { from?: string } | null;
      const destination = user.role === 'admin' ? '/admin/dashboard' : '/register/role';
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
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <Phone className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">
          เข้าสู่ระบบด้วยเบอร์โทร
        </h1>
        <p className="text-gray-600 text-center mb-8">กรอกเบอร์โทรศัพท์และรหัสผ่านของคุณ</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <PhoneInput
            label="เบอร์โทรศัพท์"
            placeholder="+66 8X XXXX XXXX"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            error={errors.phone}
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

          <Button type="submit" variant="secondary" size="lg" fullWidth loading={loading}>
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

        {/* Demo Credentials */}
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800 font-semibold mb-2">🔒 ทดสอบระบบ (Demo):</p>
          <p className="text-xs text-yellow-700">
            Phone: +66812345678 (ผู้ดูแล)
            <br />
            Password: อะไรก็ได้ (ยาวกว่า 6 ตัว)
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
