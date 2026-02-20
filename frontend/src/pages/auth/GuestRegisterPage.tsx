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
        if (logout) logout();
      } catch {
        if (logout) logout();
      } finally {
        navigate('/register', { replace: true });
      }
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
      if (logout) logout();
    } catch {
      if (logout) logout();
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
      newErrors.email = 'Please enter your email';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.password) {
      newErrors.password = 'Please enter a password';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateCredentials()) return;

    setLoading(true);
    try {
      // Register guest user (this also logs them in)
      await registerGuest(formData.email, formData.password, 'hirer');
      await refreshUser();

      // Send email OTP for verification
      const otpResponse = await api.sendEmailOtp();

      if (!otpResponse.success || !otpResponse.data) {
        toast.error('ส่งรหัสยืนยันไม่สำเร็จ กรุณากดส่งใหม่อีกครั้ง');
        setOtpId('');
        setStep('otp');
        return;
      }

      setOtpId(otpResponse.data.otp_id);
      toast.success('OTP sent to your email');
      startCooldown();
      setStep('otp');
    } catch (error: any) {
      toast.error(error.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: OTP verification
  const handleVerifyOTP = async () => {
    if (formData.otp.length !== 6) {
      setErrors({ otp: 'Please enter the complete 6-digit code' });
      return;
    }

    setLoading(true);
    try {
      const response = await api.verifyOtp(otpId, formData.otp);

      if (!response.success) {
        toast.error(response.error || 'Invalid OTP');
        setLoading(false);
        return;
      }

      // Refresh user to get updated trust level
      await refreshUser();

      verifiedRef.current = true;
      toast.success('Email verified successfully!');
      setScopedStorageItem('pendingRole', 'hirer');
      navigate('/register/consent', { replace: true });
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
          setLoading(false);
          return;
        }
        setOtpId(response.data.otp_id);
        toast.success('OTP sent to your email');
        startCooldown();
        setLoading(false);
        return;
      }

      const response = await api.resendOtp(otpId);

      if (!response.success || !response.data) {
        toast.error(response.error || 'Failed to resend OTP');
        setLoading(false);
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
      <div className="bg-white rounded-lg shadow-md p-8">
        {step === 'otp' ? (
          <button
            onClick={handleCancelRegistration}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span className="text-sm">Back</span>
          </button>
        ) : (
          <Link
            to="/register"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span className="text-sm">Back</span>
          </Link>
        )}

        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">
          Create Guest Account
        </h1>
        <p className="text-gray-600 text-center mb-8">Register with email</p>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                step === 'credentials'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-600 text-white'
              }`}
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
              label="Email"
              type="email"
              placeholder="your@email.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              error={errors.email}
              leftIcon={<Mail className="w-5 h-5" />}
              required
            />

            <PasswordInput
              label="Password"
              placeholder="Enter password (min 6 characters)"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              error={errors.password}
              required
            />

            <PasswordInput
              label="Confirm Password"
              placeholder="Re-enter password"
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
              Create Account
            </Button>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> Guest accounts can create jobs and hire caregivers.
                To become a caregiver, register as a Member instead.
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
                <strong>Account created!</strong> Verify your email to unlock more features.
              </p>
            </div>

            <div className="text-center mb-6">
              <p className="text-gray-600">
                We sent a verification code to
                <br />
                <span className="font-semibold text-gray-900">{formData.email}</span>
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 text-center">
                OTP Code <span className="text-red-500">*</span>
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
              Verify Email
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button
                onClick={handleResendOTP}
                disabled={loading || resendCooldown > 0}
                className={resendCooldown > 0 ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-700'}
              >
                {resendCooldown > 0 ? `ส่งใหม่ได้ใน ${resendCooldown} วินาที` : "Didn't receive code? Resend"}
              </button>
            </div>

            <p className={`text-xs text-center ${otpSecondsLeft <= 60 ? 'text-red-500' : 'text-gray-400'}`}>
              {otpSecondsLeft > 0
                ? `รหัสหมดอายุใน ${Math.floor(otpSecondsLeft / 60)}:${String(otpSecondsLeft % 60).padStart(2, '0')} นาที`
                : 'รหัส OTP หมดอายุแล้ว'}
            </p>

          </div>
        )}

        {/* Already have account */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-gray-600 mb-4">Already have an account?</p>
          <Link to="/login">
            <Button variant="outline" fullWidth>
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
