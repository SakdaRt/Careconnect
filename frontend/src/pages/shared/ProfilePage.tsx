import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { MainLayout } from '../../layouts';
import { Button, Card, CheckboxGroup, Input, OTPInput, PhoneInput } from '../../components/ui';
import { GooglePlacesInput } from '../../components/location/GooglePlacesInput';
import { useAuth } from '../../contexts';
import { appApi } from '../../services/appApi';
import type { CaregiverProfile, HirerProfile, UserProfile } from '../../services/api';

function roleLabel(role: string) {
  if (role === 'hirer') return 'ผู้ว่าจ้าง';
  if (role === 'caregiver') return 'ผู้ดูแล';
  return 'แอดมิน';
}

export default function ProfilePage() {
  const { user, updateUser, refreshUser, logout } = useAuth();
  const [profileRole, setProfileRole] = useState<'hirer' | 'caregiver' | 'admin'>('hirer');
  const [hirerForm, setHirerForm] = useState({
    display_name: '',
    address_line1: '',
    address_line2: '',
    district: '',
    province: '',
    postal_code: '',
  });
  const [caregiverForm, setCaregiverForm] = useState({
    display_name: '',
    bio: '',
    experience_years: '',
    certifications: [] as string[],
    specializations: [] as string[],
    available_from: '',
    available_to: '',
    available_days: [] as string[],
  });
  const [profileSnapshot, setProfileSnapshot] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailValue, setEmailValue] = useState('');
  const [emailOtpCode, setEmailOtpCode] = useState('');
  const [emailOtpId, setEmailOtpId] = useState('');
  const [emailOtpLoading, setEmailOtpLoading] = useState(false);
  const [emailOtpError, setEmailOtpError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailOtpDebugCode, setEmailOtpDebugCode] = useState<string | undefined>(undefined);
  const [phoneValue, setPhoneValue] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpId, setOtpId] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [otpDebugCode, setOtpDebugCode] = useState<string | undefined>(undefined);

  const primaryId = useMemo(() => user?.email || user?.phone_number || '-', [user]);

  const handleSendEmailOtp = async () => {
    if (!emailValue.trim()) {
      setEmailError('กรุณากรอกอีเมล');
      return;
    }

    setEmailOtpLoading(true);
    setEmailError('');
    setEmailOtpError('');
    try {
      const updateResponse = await appApi.updateEmailAddress(emailValue.trim());
      if (!updateResponse.success) {
        toast.error(updateResponse.error || 'บันทึกอีเมลไม่สำเร็จ');
        return;
      }
      await refreshUser();
      const response = await appApi.sendEmailOtp();
      if (!response.success || !response.data) {
        toast.error(response.error || 'ส่งรหัส OTP ไม่สำเร็จ');
        return;
      }
      setEmailOtpId(response.data.otp_id);
      const dbg = (response.data as any).debug_code as string | undefined;
      setEmailOtpDebugCode(dbg);
      toast.success(dbg ? `ส่งรหัส OTP แล้ว (โค้ดทดสอบ: ${dbg})` : 'ส่งรหัส OTP แล้ว');
    } catch (error: any) {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    } finally {
      setEmailOtpLoading(false);
    }
  };

  const handleResendEmailOtp = async () => {
    setEmailOtpLoading(true);
    setEmailOtpError('');
    try {
      if (!emailOtpId) {
        await handleSendEmailOtp();
        return;
      }
      const response = await appApi.resendOtp(emailOtpId);
      if (!response.success || !response.data) {
        toast.error(response.error || 'ส่งรหัส OTP ใหม่ไม่สำเร็จ');
        return;
      }
      setEmailOtpId(response.data.otp_id);
      const dbg = (response.data as any).debug_code as string | undefined;
      setEmailOtpDebugCode(dbg);
      setEmailOtpCode('');
      toast.success('ส่งรหัส OTP ใหม่แล้ว');
    } catch (error: any) {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setEmailOtpLoading(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (emailOtpCode.length !== 6) {
      setEmailOtpError('กรุณากรอกรหัส OTP ให้ครบ 6 หลัก');
      return;
    }
    if (!emailOtpId) {
      toast.error('ไม่พบรหัส OTP สำหรับยืนยัน');
      return;
    }

    setEmailOtpLoading(true);
    setEmailOtpError('');
    try {
      const response = await appApi.verifyEmailOtp(emailOtpId, emailOtpCode);
      if (!response.success) {
        toast.error(response.error || 'รหัส OTP ไม่ถูกต้อง');
        return;
      }
      await refreshUser();
      setEmailOtpId('');
      setEmailOtpCode('');
      setEmailOtpDebugCode(undefined);
      toast.success('ยืนยันอีเมลสำเร็จ');
    } catch (error: any) {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    } finally {
      setEmailOtpLoading(false);
    }
  };

  const handleSendPhoneOtp = async () => {
    if (!phoneValue.trim()) {
      setPhoneError('กรุณากรอกเบอร์โทร');
      return;
    }

    setOtpLoading(true);
    setPhoneError('');
    setOtpError('');
    try {
      const updateResponse = await appApi.updatePhoneNumber(phoneValue.trim());
      if (!updateResponse.success) {
        toast.error(updateResponse.error || 'บันทึกเบอร์โทรไม่สำเร็จ');
        return;
      }
      await refreshUser();
      const response = await appApi.sendPhoneOtp();
      if (!response.success || !response.data) {
        toast.error(response.error || 'ส่งรหัส OTP ไม่สำเร็จ');
        return;
      }
      setOtpId(response.data.otp_id);
      const dbg = (response.data as any).debug_code as string | undefined;
      setOtpDebugCode(dbg);
      toast.success(dbg ? `ส่งรหัส OTP แล้ว (โค้ดทดสอบ: ${dbg})` : 'ส่งรหัส OTP แล้ว');
    } catch (error: any) {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setOtpLoading(true);
    setOtpError('');
    try {
      if (!otpId) {
        await handleSendPhoneOtp();
        return;
      }
      const response = await appApi.resendOtp(otpId);
      if (!response.success || !response.data) {
        toast.error(response.error || 'ส่งรหัส OTP ใหม่ไม่สำเร็จ');
        return;
      }
      setOtpId(response.data.otp_id);
      const dbg = (response.data as any).debug_code as string | undefined;
      setOtpDebugCode(dbg);
      setOtpCode('');
      toast.success('ส่งรหัส OTP ใหม่แล้ว');
    } catch (error: any) {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      setOtpError('กรุณากรอกรหัส OTP ให้ครบ 6 หลัก');
      return;
    }
    if (!otpId) {
      toast.error('ไม่พบรหัส OTP สำหรับยืนยัน');
      return;
    }

    setOtpLoading(true);
    setOtpError('');
    try {
      const response = await appApi.verifyOtp(otpId, otpCode);
      if (!response.success) {
        toast.error(response.error || 'รหัส OTP ไม่ถูกต้อง');
        return;
      }
      await refreshUser();
      setOtpId('');
      setOtpCode('');
      setOtpDebugCode(undefined);
      toast.success('ยืนยันเบอร์โทรสำเร็จ');
    } catch (error: any) {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    } finally {
      setOtpLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      setProfileRole(user.role);
      setEmailValue(user.email || '');
      setPhoneValue(user.phone_number || '');
    }
  }, [user]);

  const CERTIFICATION_OPTIONS = useMemo(
    () => [
      { value: 'basic_first_aid', label: 'ปฐมพยาบาลเบื้องต้น' },
      { value: 'safe_transfer', label: 'ย้ายท่าอย่างปลอดภัย' },
      { value: 'vitals_monitoring', label: 'วัด/ติดตามสัญญาณชีพ' },
      { value: 'medication_management', label: 'จัดยา/ดูแลการใช้ยา' },
      { value: 'dementia_care', label: 'ดูแลผู้ป่วยสมองเสื่อม' },
      { value: 'post_surgery_care', label: 'ดูแลหลังผ่าตัด' },
      { value: 'wound_care', label: 'ทำแผล' },
      { value: 'catheter_care', label: 'ดูแลสายสวน' },
      { value: 'tube_feeding_care', label: 'ดูแลการให้อาหารทางสาย' },
    ],
    []
  );

  const SPECIALIZATION_OPTIONS = useMemo(
    () => [
      { value: 'companionship', label: 'ดูแลทั่วไป/เพื่อนคุย' },
      { value: 'personal_care', label: 'ช่วยกิจวัตรประจำวัน' },
      { value: 'medical_monitoring', label: 'ดูแลการกินยา/วัดสัญญาณชีพ' },
      { value: 'dementia_care', label: 'ดูแลผู้ป่วยสมองเสื่อม' },
      { value: 'post_surgery', label: 'ดูแลหลังผ่าตัด' },
      { value: 'emergency', label: 'กรณีฉุกเฉิน' },
    ],
    []
  );

  const DAY_OPTIONS = useMemo(
    () => [
      { value: '0', label: 'อา' },
      { value: '1', label: 'จ' },
      { value: '2', label: 'อ' },
      { value: '3', label: 'พ' },
      { value: '4', label: 'พฤ' },
      { value: '5', label: 'ศ' },
      { value: '6', label: 'ส' },
    ],
    []
  );

  const hydrateHirerForm = useCallback((profile: HirerProfile | null, fallbackName: string) => {
    setHirerForm({
      display_name: profile?.display_name || fallbackName,
      address_line1: profile?.address_line1 || '',
      address_line2: profile?.address_line2 || '',
      district: profile?.district || '',
      province: profile?.province || '',
      postal_code: profile?.postal_code || '',
    });
  }, []);

  const hydrateCaregiverForm = useCallback((profile: CaregiverProfile | null, fallbackName: string) => {
    setCaregiverForm({
      display_name: profile?.display_name || fallbackName,
      bio: profile?.bio || '',
      experience_years: profile?.experience_years !== null && profile?.experience_years !== undefined ? String(profile.experience_years) : '',
      certifications: profile?.certifications || [],
      specializations: profile?.specializations || [],
      available_from: profile?.available_from || '',
      available_to: profile?.available_to || '',
      available_days: (profile?.available_days || []).map((d) => String(d)),
    });
  }, []);

  const applyProfile = useCallback(
    (role: 'hirer' | 'caregiver' | 'admin', profile: UserProfile | null) => {
      const fallbackName = user?.name || '';
      setProfileRole(role);
      setProfileSnapshot(profile);
      if (role === 'hirer') {
        hydrateHirerForm(profile as HirerProfile | null, fallbackName);
      }
      if (role === 'caregiver') {
        hydrateCaregiverForm(profile as CaregiverProfile | null, fallbackName);
      }
    },
    [user?.name, hydrateCaregiverForm, hydrateHirerForm]
  );

  useEffect(() => {
    if (!user) return;
    let active = true;
    const loadProfile = async () => {
      setLoadingProfile(true);
      try {
        const res = await appApi.getMyProfile();
        if (!res.success || !res.data) {
          toast.error(res.error || 'โหลดโปรไฟล์ไม่สำเร็จ');
          return;
        }
        if (!active) return;
        applyProfile(res.data.role, res.data.profile);
      } finally {
        if (active) setLoadingProfile(false);
      }
    };
    loadProfile();
    return () => {
      active = false;
    };
  }, [user, applyProfile]);

  const handleSave = async () => {
    if (!user) return;
    if (profileRole === 'admin') return;
    setSaving(true);
    try {
      if (profileRole === 'hirer') {
        const displayName = hirerForm.display_name.trim();
        if (!displayName) {
          toast.error('กรุณากรอกชื่อที่ใช้แสดง');
          return;
        }
        const res = await appApi.updateMyProfile({
          display_name: displayName,
          address_line1: hirerForm.address_line1.trim() || null,
          address_line2: hirerForm.address_line2.trim() || null,
          district: hirerForm.district.trim() || null,
          province: hirerForm.province.trim() || null,
          postal_code: hirerForm.postal_code.trim() || null,
        });
        if (!res.success || !res.data) {
          toast.error(res.error || 'บันทึกไม่สำเร็จ');
          return;
        }
        applyProfile('hirer', res.data.profile);
        updateUser({ name: displayName });
        toast.success('บันทึกแล้ว');
        return;
      }

      const displayName = caregiverForm.display_name.trim();
      if (!displayName) {
        toast.error('กรุณากรอกชื่อที่ใช้แสดง');
        return;
      }
      const experienceYears = caregiverForm.experience_years.trim();
      const experienceValue = experienceYears ? Number(experienceYears) : null;
      const availableDays = caregiverForm.available_days
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
      const res = await appApi.updateMyProfile({
        display_name: displayName,
        bio: caregiverForm.bio.trim() || null,
        experience_years: Number.isFinite(experienceValue) ? experienceValue : null,
        certifications: caregiverForm.certifications,
        specializations: caregiverForm.specializations,
        available_from: caregiverForm.available_from || null,
        available_to: caregiverForm.available_to || null,
        available_days: availableDays,
      });
      if (!res.success || !res.data) {
        toast.error(res.error || 'บันทึกไม่สำเร็จ');
        return;
      }
      applyProfile('caregiver', res.data.profile);
      updateUser({ name: displayName });
      toast.success('บันทึกแล้ว');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!user) return;
    applyProfile(profileRole, profileSnapshot);
  };

  return (
    <MainLayout showBottomBar={false}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">โปรไฟล์</h1>
            <p className="text-sm text-gray-600">ข้อมูลบัญชีและสถานะการยืนยันตัวตน</p>
          </div>
          <Button variant="outline" onClick={logout} disabled={!user}>
            ออกจากระบบ
          </Button>
        </div>

        {!user ? (
          <Card className="p-6">
            <div className="text-sm text-gray-700">กรุณาเข้าสู่ระบบก่อน</div>
          </Card>
        ) : (
          <>
            <Card className="p-6">
              <div className="text-sm font-semibold text-gray-900 mb-3">ข้อมูลโปรไฟล์</div>
              {profileRole === 'admin' ? (
                <div className="text-sm text-gray-600">บัญชีแอดมินไม่มีข้อมูลโปรไฟล์ที่แก้ไขได้</div>
              ) : (
                <div className="space-y-4">
                  {profileRole === 'hirer' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label="ชื่อที่ใช้แสดง"
                        value={hirerForm.display_name}
                        onChange={(e) => setHirerForm({ ...hirerForm, display_name: e.target.value })}
                        placeholder="ชื่อของคุณ"
                        required
                      />
                      <GooglePlacesInput
                        label="ที่อยู่บรรทัด 1"
                        value={hirerForm.address_line1}
                        placeholder="ค้นหาที่อยู่ด้วย Google Maps"
                        onChange={(next) =>
                          setHirerForm({
                            ...hirerForm,
                            address_line1: next.address_line1,
                            district: next.district || hirerForm.district,
                            province: next.province || hirerForm.province,
                            postal_code: next.postal_code || hirerForm.postal_code,
                          })
                        }
                      />
                      <Input
                        label="ที่อยู่บรรทัด 2"
                        value={hirerForm.address_line2}
                        onChange={(e) => setHirerForm({ ...hirerForm, address_line2: e.target.value })}
                        placeholder="อาคาร/ชั้น/ห้อง"
                      />
                      <Input
                        label="เขต/อำเภอ"
                        value={hirerForm.district}
                        onChange={(e) => setHirerForm({ ...hirerForm, district: e.target.value })}
                        placeholder="เขต/อำเภอ"
                      />
                      <Input
                        label="จังหวัด"
                        value={hirerForm.province}
                        onChange={(e) => setHirerForm({ ...hirerForm, province: e.target.value })}
                        placeholder="จังหวัด"
                      />
                      <Input
                        label="รหัสไปรษณีย์"
                        value={hirerForm.postal_code}
                        onChange={(e) => setHirerForm({ ...hirerForm, postal_code: e.target.value })}
                        placeholder="รหัสไปรษณีย์"
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                          label="ชื่อที่ใช้แสดง"
                          value={caregiverForm.display_name}
                          onChange={(e) => setCaregiverForm({ ...caregiverForm, display_name: e.target.value })}
                          placeholder="ชื่อของคุณ"
                          required
                        />
                        <Input
                          label="ประสบการณ์ (ปี)"
                          type="number"
                          min={0}
                          value={caregiverForm.experience_years}
                          onChange={(e) => setCaregiverForm({ ...caregiverForm, experience_years: e.target.value })}
                          placeholder="เช่น 3"
                        />
                        <Input
                          label="เวลาว่างเริ่มต้น"
                          type="time"
                          value={caregiverForm.available_from}
                          onChange={(e) => setCaregiverForm({ ...caregiverForm, available_from: e.target.value })}
                        />
                        <Input
                          label="เวลาว่างสิ้นสุด"
                          type="time"
                          value={caregiverForm.available_to}
                          onChange={(e) => setCaregiverForm({ ...caregiverForm, available_to: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-semibold text-gray-700">แนะนำตัว</label>
                        <textarea
                          className="w-full px-4 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300 hover:border-gray-400 min-h-28"
                          value={caregiverForm.bio}
                          onChange={(e) => setCaregiverForm({ ...caregiverForm, bio: e.target.value })}
                          placeholder="เล่าประสบการณ์หรือความถนัดของคุณ"
                        />
                      </div>
                      <CheckboxGroup
                        label="ทักษะ/ใบรับรอง"
                        layout="grid"
                        value={caregiverForm.certifications}
                        onChange={(v) => setCaregiverForm({ ...caregiverForm, certifications: v })}
                        options={CERTIFICATION_OPTIONS}
                      />
                      <CheckboxGroup
                        label="ประเภทงานที่ถนัด"
                        layout="grid"
                        value={caregiverForm.specializations}
                        onChange={(v) => setCaregiverForm({ ...caregiverForm, specializations: v })}
                        options={SPECIALIZATION_OPTIONS}
                      />
                      <CheckboxGroup
                        label="วันเวลาที่สะดวกรับงาน"
                        layout="grid"
                        value={caregiverForm.available_days}
                        onChange={(v) => setCaregiverForm({ ...caregiverForm, available_days: v })}
                        options={DAY_OPTIONS}
                      />
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button variant="primary" loading={saving} onClick={handleSave} disabled={loadingProfile}>
                      บันทึก
                    </Button>
                    <Button variant="outline" onClick={handleReset} disabled={loadingProfile}>
                      ยกเลิก
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            <Card className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-semibold text-gray-700">บัญชี</div>
                  <div className="text-sm text-gray-900">{primaryId}</div>
                  <div className="text-xs text-gray-500 font-mono break-all">{user.id}</div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="text-xs text-gray-500">บทบาท</div>
                  <div className="text-sm font-semibold text-gray-900">{roleLabel(user.role)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Trust Level</div>
                  <div className="text-sm font-semibold text-gray-900">{user.trust_level}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">งานสำเร็จ</div>
                  <div className="text-sm font-semibold text-gray-900">{user.completed_jobs_count}</div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="text-sm font-semibold text-gray-900 mb-3">การยืนยัน</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-gray-700">อีเมล</div>
                  <div className={`text-sm font-semibold ${user.is_email_verified ? 'text-green-700' : 'text-gray-500'}`}>
                    {user.is_email_verified ? 'ยืนยันแล้ว' : 'ยังไม่ยืนยัน'}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-gray-700">เบอร์โทร</div>
                  <div className={`text-sm font-semibold ${user.is_phone_verified ? 'text-green-700' : 'text-gray-500'}`}>
                    {user.is_phone_verified ? 'ยืนยันแล้ว' : 'ยังไม่ยืนยัน'}
                  </div>
                </div>
              </div>
              {!user.is_email_verified && (
                <div className="mt-4 border-t border-gray-200 pt-4 space-y-3">
                  <div className="text-sm font-semibold text-gray-900">ยืนยันอีเมล</div>
                  <Input
                    label="อีเมล"
                    type="email"
                    value={emailValue}
                    onChange={(e) => setEmailValue(e.target.value)}
                    error={emailError}
                  />
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button variant="secondary" loading={emailOtpLoading} onClick={handleSendEmailOtp}>
                      ส่งรหัส OTP
                    </Button>
                    {emailOtpId && (
                      <Button variant="outline" loading={emailOtpLoading} onClick={handleResendEmailOtp}>
                        ส่งใหม่อีกครั้ง
                      </Button>
                    )}
                  </div>
                  {emailOtpId && (
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">รหัส OTP</label>
                      <OTPInput value={emailOtpCode} onChange={setEmailOtpCode} error={emailOtpError} />
                      <Button variant="primary" loading={emailOtpLoading} onClick={handleVerifyEmailOtp}>
                        ยืนยันอีเมล
                      </Button>
                      <div className="text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        {emailOtpDebugCode ? (
                          <>
                            โหมดพัฒนา: โค้ดทดสอบ <span className="bg-yellow-100 px-1 rounded">{emailOtpDebugCode}</span>
                          </>
                        ) : (
                          <>
                            โหมดพัฒนา: ใช้โค้ด <span className="bg-yellow-100 px-1 rounded">123456</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {!user.is_phone_verified && (
                <div className="mt-4 border-t border-gray-200 pt-4 space-y-3">
                  <div className="text-sm font-semibold text-gray-900">ยืนยันเบอร์โทร</div>
                  <PhoneInput
                    label="เบอร์โทรศัพท์"
                    value={phoneValue}
                    onChange={(e) => setPhoneValue(e.target.value)}
                    error={phoneError}
                  />
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button variant="secondary" loading={otpLoading} onClick={handleSendPhoneOtp}>
                      ส่งรหัส OTP
                    </Button>
                    {otpId && (
                      <Button variant="outline" loading={otpLoading} onClick={handleResendOtp}>
                        ส่งใหม่อีกครั้ง
                      </Button>
                    )}
                  </div>
                  {otpId && (
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">รหัส OTP</label>
                      <OTPInput value={otpCode} onChange={setOtpCode} error={otpError} />
                      <Button variant="primary" loading={otpLoading} onClick={handleVerifyOtp}>
                        ยืนยันเบอร์โทร
                      </Button>
                      <div className="text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        {otpDebugCode ? (
                          <>
                            โหมดพัฒนา: โค้ดทดสอบ <span className="bg-yellow-100 px-1 rounded">{otpDebugCode}</span>
                          </>
                        ) : (
                          <>
                            โหมดพัฒนา: ใช้โค้ด <span className="bg-yellow-100 px-1 rounded">123456</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}
