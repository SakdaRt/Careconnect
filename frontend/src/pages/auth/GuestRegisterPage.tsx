import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Mail, ArrowLeft, Shield } from 'lucide-react';
import { AuthLayout } from '../../layouts';
import { Button, Input, OTPInput, PasswordInput } from '../../components/ui';
import { useAuth } from '../../contexts';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { setScopedStorageItem } from '../../utils/authStorage';

type Step = 'credentials' | 'otp';

export default function GuestRegisterPage() {
  const navigate = useNavigate();
  const { registerGuest, refreshUser, logout } = useAuth();
  const [step, setStep] = useState<Step>('credentials');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    otp: '',
  });
  const [otpId, setOtpId] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpTimerKey, setOtpTimerKey] = useState(0);
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(5 * 60);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const otpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepRef = useRef<Step>('credentials');
  const verifiedRef = useRef(false);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      if (otpTimerRef.current) clearTimeout(otpTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (step !== 'otp') return;
    const timer = setTimeout(() => {
      if (verifiedRef.current) return;
      toast.error('รหัส OTP หมดอายุ กรุณาสมัครใหม่อีกครั้ง');
      navigate('/register', { replace: true });
    }, 5 * 60 * 1000);
    otpTimerRef.current = timer;
    return () => clearTimeout(timer);
  }, [step, otpTimerKey]);

  useEffect(() => {
    if (step !== 'otp') return;
    setOtpSecondsLeft(5 * 60);
    const interval = setInterval(() => {
      setOtpSecondsLeft(s => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [step, otpTimerKey]);

  const handleCancelRegistration = async () => {
    try {
      await api.cancelUnverifiedAccount();
      logout();
    } catch {
      logout();
    } finally {
      navigate('/register', { replace: true });
    }
  };

  const startCooldown = () => {
    setResendCooldown(60);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // Step 1: Validate credentials
  const validateCredentials = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = 'กรุณากรอกอีเมล';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'รูปแบบอีเมลไม่ถูกต้อง';
    }

    if (!formData.password) {
      newErrors.password = 'กรุณากรอกรหัสผ่าน';
    } else if (formData.password.length < 8) {
      newErrors.password = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'กรุณายืนยันรหัสผ่าน';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'รหัสผ่านไม่ตรงกัน';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateCredentials()) return;

    setLoading(true);
    try {
      const result = await registerGuest(formData.email, formData.password, 'hirer');
      setOtpId(result.otp_id);
      toast.success('ส่งรหัส OTP ไปที่อีเมลแล้ว กรุณายืนยันเพื่อสร้างบัญชี');
      startCooldown();
      setStep('otp');
    } catch (error: any) {
      toast.error(error.message || 'สมัครสมาชิกไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: OTP verification
  const handleVerifyOTP = async () => {
    if (formData.otp.length !== 6) {
      setErrors({ otp: 'กรุณากรอกรหัส OTP ให้ครบ 6 หลัก' });
      return;
    }

    setLoading(true);
    try {
      const response = await api.verifyOtp(otpId, formData.otp);

      if (!response.success) {
        toast.error(response.error || 'รหัส OTP ไม่ถูกต้อง');
        return;
      }

      verifiedRef.current = true;

      if (response.data?.registered && response.data?.accessToken) {
        api.setSessionTokens(response.data.accessToken, response.data.refreshToken);
        await refreshUser();
        toast.success('สมัครสมาชิกสำเร็จ!');
        setScopedStorageItem('pendingRole', 'hirer');
        navigate('/register/consent', { replace: true });
      } else {
        await refreshUser();
        toast.success('ยืนยันอีเมลสำเร็จ!');
        navigate('/register/consent', { replace: true });
      }
    } catch (error: any) {
      toast.error(error.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    try {
      if (!otpId) {
        const response = await api.sendEmailOtp();
        if (!response.success || !response.data) {
          toast.error(response.error || 'ส่งรหัสยืนยันไม่สำเร็จ');
          return;
        }
        setOtpId(response.data.otp_id);
        toast.success('OTP sent to your email');
        startCooldown();
        return;
      }

      const response = await api.resendOtp(otpId);

      if (!response.success || !response.data) {
        toast.error(response.error || 'Failed to resend OTP');
        return;
      }

      setOtpId(response.data.otp_id);
      setFormData({ ...formData, otp: '' });
      setOtpTimerKey(k => k + 1);
      startCooldown();
      toast.success('New OTP sent');
    } catch (error: any) {
      toast.error('Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
        {step === 'otp' ? (
          <button
            onClick={handleCancelRegistration}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span className="text-sm">กลับ</span>
          </button>
        ) : (
          <Link
            to="/register"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span className="text-sm">กลับ</span>
          </Link>
        )}

        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-2">
          สมัครบัญชีแขก
        </h1>
        <p className="text-gray-600 text-center mb-6 sm:mb-8">ลงทะเบียนด้วยอีเมล</p>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold bg-blue-600 text-white"
            >
              1
            </div>
            <div className="w-12 h-0.5 bg-gray-300">
              <div
                className={`h-full bg-blue-600 transition-all ${
                  step === 'otp' ? 'w-full' : 'w-0'
                }`}
              />
            </div>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                step === 'otp'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              2
            </div>
          </div>
        </div>

        {/* Step 1: Credentials */}
        {step === 'credentials' && (
          <div className="space-y-4">
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
              placeholder="กรอกรหัสผ่าน (อย่างน้อย 8 ตัวอักษร)"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              error={errors.password}
              required
            />

            <PasswordInput
              label="ยืนยันรหัสผ่าน"
              placeholder="กรอกรหัสผ่านอีกครั้ง"
              value={formData.confirmPassword}
              onChange={(e) =>
                setFormData({ ...formData, confirmPassword: e.target.value })
              }
              error={errors.confirmPassword}
              required
            />

            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              onClick={handleRegister}
            >
              สร้างบัญชี
            </Button>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>หมายเหตุ:</strong> บัญชีแขกสามารถสร้างงานและจ้างผู้ดูแลได้
                หากต้องการเป็นผู้ดูแล กรุณาสมัครเป็นบัญชีสมาชิกแทน
              </p>
            </div>
          </div>
        )}

        {/* Step 2: OTP */}
        {step === 'otp' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg mb-4">
              <Shield className="w-5 h-5 text-green-600" />
              <p className="text-sm text-green-900">
                <strong>สร้างบัญชีแล้ว!</strong> ยืนยันอีเมลเพื่อเปิดใช้งานเพิ่มเติม
              </p>
            </div>

            <div className="text-center mb-6">
              <p className="text-gray-600">
                เราได้ส่งรหัสยืนยันไปยัง
                <br />
                <span className="font-semibold text-gray-900">{formData.email}</span>
              </p>
            </div>

            <div>
              <label htmlFor="otp-0" className="block text-sm font-semibold text-gray-700 mb-2 text-center">
                รหัส OTP <span className="text-red-500">*</span>
              </label>
              <OTPInput
                value={formData.otp}
                onChange={(value) => setFormData({ ...formData, otp: value })}
                error={errors.otp}
              />
            </div>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              onClick={handleVerifyOTP}
            >
              ยืนยันอีเมล
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button
                onClick={handleResendOTP}
                disabled={loading || resendCooldown > 0}
                className={resendCooldown > 0 ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-700'}
              >
                {resendCooldown > 0 ? `ส่งใหม่ได้ใน ${resendCooldown} วินาที` : 'ไม่ได้รับรหัส? ส่งใหม่อีกครั้ง'}
              </button>
            </div>

            <p className={`text-xs text-center ${otpSecondsLeft <= 60 ? 'text-red-500' : 'text-gray-500'}`}>
              {otpSecondsLeft > 0
                ? `รหัสหมดอายุใน ${Math.floor(otpSecondsLeft / 60)}:${String(otpSecondsLeft % 60).padStart(2, '0')} นาที`
                : 'รหัส OTP หมดอายุแล้ว'}
            </p>

          </div>
        )}

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
