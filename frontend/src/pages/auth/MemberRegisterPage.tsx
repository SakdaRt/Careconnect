import { Link, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { Phone, ArrowLeft } from 'lucide-react';
import { AuthLayout } from '../../layouts';
import { Button, PhoneInput, OTPInput, PasswordInput } from '../../components/ui';
import api from '../../services/api';
import { useAuth } from '../../contexts';
import { setScopedStorageItem } from '../../utils/authStorage';
import { logOtpEvent, showDevOtpToast } from '../../utils/otpDebug';

type Step = 'phone' | 'otp' | 'password';

export default function MemberRegisterPage() {
  const navigate = useNavigate();
  const { registerMember, refreshUser, logout } = useAuth();
  const [step, setStep] = useState<Step>('phone');
  const [formData, setFormData] = useState({
    phone: '',
    otp: '',
    password: '',
    confirmPassword: '',
  });
  const [selectedRole, setSelectedRole] = useState<'hirer' | 'caregiver' | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [otpId, setOtpId] = useState('');

  const [otpTimerKey, setOtpTimerKey] = useState(0);
  const otpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepRef = useRef(step);
  const verifiedRef = useRef(false);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    return () => {
      if (otpTimerRef.current) clearTimeout(otpTimerRef.current);
      if (stepRef.current === 'otp' && !verifiedRef.current) {
        api.cancelUnverifiedAccount().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (step !== 'otp') return;
    const timer = setTimeout(async () => {
      if (verifiedRef.current) return;
      try {
        await api.cancelUnverifiedAccount();
        logout();
      } catch {
        logout();
      } finally {
        navigate('/register', { replace: true });
      }
    }, 5 * 60 * 1000);
    otpTimerRef.current = timer;
    return () => clearTimeout(timer);
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

  // Step 1: Phone submission
  const validatePhone = () => {
    const newErrors: Record<string, string> = {};
    const digits = formData.phone.replace(/\D/g, '');
    const isValid = /^0[2-9]\d{7,8}$/.test(digits);

    if (!formData.phone) {
      newErrors.phone = 'กรุณากรอกเบอร์โทรศัพท์';
    } else if (!isValid) {
      newErrors.phone = 'กรุณากรอกเบอร์มือถือไทย เช่น 08x-xxx-xxxx';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendOTP = () => {
    if (!validatePhone()) return;
    setStep('password');
  };

  // Step 2: OTP verification
  const handleVerifyOTP = async () => {
    if (formData.otp.length !== 6) {
      logOtpEvent('sms', 'OTP entry rejected due to invalid length', { length: formData.otp.length }, 'warn');
      return;
    }
    if (!otpId) {
      logOtpEvent('sms', 'OTP verification requested without otpId', undefined, 'warn');
      return;
    }

    setLoading(true);
    try {
      const response = await api.verifyOtp(otpId, formData.otp);
      if (!response.success) {
        logOtpEvent('sms', 'OTP verification failed', { error: response.error || 'OTP verification failed' }, 'warn');
        return;
      }
      verifiedRef.current = true;

      if (response.data?.registered && response.data?.accessToken) {
        api.setSessionTokens(response.data.accessToken, response.data.refreshToken);
        await refreshUser();
        logOtpEvent('sms', 'Registration completed after OTP verification');
      } else {
        await refreshUser();
        logOtpEvent('sms', 'OTP verified successfully');
      }

      setScopedStorageItem('pendingRole', selectedRole || 'hirer');
      navigate('/register/consent', { replace: true });
    } catch (error: any) {
      logOtpEvent('sms', 'OTP verification request error', error, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    try {
      if (!otpId) {
        const response = await api.sendPhoneOtp();
        if (!response.success || !response.data) {
          logOtpEvent('sms', 'Failed to send OTP', { error: response.error || 'Failed to send OTP' }, 'warn');
          return;
        }
        setOtpId(response.data.otp_id);
        setOtpTimerKey(k => k + 1);
        showDevOtpToast(response.data, 'sms');
        logOtpEvent('sms', 'Sent OTP', { otpId: response.data.otp_id });
        return;
      }
      const response = await api.resendOtp(otpId);
      if (!response.success || !response.data) {
        logOtpEvent('sms', 'Failed to resend OTP', { error: response.error || 'Failed to resend OTP' }, 'warn');
        return;
      }
      setOtpId(response.data.otp_id);
      setFormData({ ...formData, otp: '' });
      setOtpTimerKey(k => k + 1);
      showDevOtpToast(response.data, 'sms');
      logOtpEvent('sms', 'Resent OTP', { otpId: response.data.otp_id });
    } catch (error: any) {
      logOtpEvent('sms', 'Unexpected resend OTP error', error, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Password creation
  const validatePassword = () => {
    const newErrors: Record<string, string> = {};

    if (!selectedRole) {
      newErrors.role = 'กรุณาเลือกบทบาท';
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

  const handleCreateAccount = async () => {
    if (!validatePassword()) return;

    setLoading(true);
    try {
      const result = await registerMember(formData.phone, formData.password, selectedRole || 'hirer');
      setOtpId(result.otp_id);
      showDevOtpToast(result, 'sms');
      logOtpEvent('sms', 'Sent registration OTP', { otpId: result.otp_id });
      setStep('otp');
    } catch (error: any) {
      const msg = error?.message || 'ไม่สามารถสร้างบัญชีได้ กรุณาลองใหม่อีกครั้ง';
      setErrors({ general: msg });
      logOtpEvent('sms', 'Registration failed before OTP step', error, 'error');
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
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <Phone className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-2">
          สมัครบัญชีสมาชิก
        </h1>
        <p className="text-gray-600 text-center mb-6 sm:mb-8">ลงทะเบียนด้วยเบอร์โทรศัพท์</p>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
        <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold bg-green-600 text-white"
            >
              1
            </div>
            <div className="w-12 h-0.5 bg-gray-300">
              <div
                className={`h-full bg-green-600 transition-all ${
                step !== 'phone' ? 'w-full' : 'w-0'
                }`}
              />
            </div>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              step === 'password'
                ? 'bg-green-600 text-white'
                : step === 'otp'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              2
            </div>
            <div className="w-12 h-0.5 bg-gray-300">
              <div
                className={`h-full bg-green-600 transition-all ${
                step === 'otp' ? 'w-full' : 'w-0'
                }`}
              />
            </div>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              step === 'otp'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              3
            </div>
          </div>
        </div>

        {/* Step 1: Phone */}
        {step === 'phone' && (
          <div className="space-y-4">
            <PhoneInput
              label="เบอร์โทรศัพท์"
              placeholder="08x-xxx-xxxx"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              error={errors.phone}
              required
            />

            <Button
              variant="secondary"
              size="lg"
              fullWidth
              loading={loading}
              onClick={handleSendOTP}
            >
              ถัดไป
            </Button>

            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-900">
                <strong>บัญชีสมาชิก:</strong> สามารถเป็นทั้งผู้ว่าจ้างและผู้ดูแลได้
                คุณจะเลือกบทบาทในขั้นตอนถัดไป
              </p>
            </div>
          </div>
        )}

        {/* Step 2: OTP */}
        {step === 'otp' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="otp-0" className="block text-sm font-semibold text-gray-700 mb-2 text-center">
                รหัสยืนยัน <span className="text-red-500">*</span>
              </label>
              <OTPInput
                value={formData.otp}
                onChange={(value) => setFormData({ ...formData, otp: value })}
              />
            </div>

            <Button
              variant="secondary"
              size="lg"
              fullWidth
              loading={loading}
              onClick={handleVerifyOTP}
            >
              ยืนยันรหัส
            </Button>

            <div className="text-center">
              <button
                onClick={handleResendOTP}
                disabled={loading}
                className="text-green-600 hover:text-green-700 text-sm"
              >
                ไม่ได้รับรหัส? ส่งใหม่อีกครั้ง
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Password */}
        {step === 'password' && (
          <div className="space-y-4">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-700">เลือกบทบาทที่จะเริ่มต้นใช้งาน</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedRole('hirer')}
                  className={`border-2 rounded-lg p-4 text-left transition-all ${
                    selectedRole === 'hirer'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900">ผู้ว่าจ้าง</div>
                  <div className="text-sm text-gray-600">สร้างงานและจ้างผู้ดูแล</div>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole('caregiver')}
                  className={`border-2 rounded-lg p-4 text-left transition-all ${
                    selectedRole === 'caregiver'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-green-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900">ผู้ดูแล</div>
                  <div className="text-sm text-gray-600">รับงานและสร้างรายได้</div>
                </button>
              </div>
              {errors.role && <p className="text-sm text-red-600">{errors.role}</p>}
            </div>

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

            {errors.general && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {errors.general}
              </div>
            )}

            <Button
              variant="secondary"
              size="lg"
              fullWidth
              loading={loading}
              onClick={handleCreateAccount}
            >
              สร้างบัญชี
            </Button>
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
