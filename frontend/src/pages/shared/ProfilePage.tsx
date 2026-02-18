import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ShieldCheck, BadgeCheck, Shield, Upload, FileText, Trash2, ExternalLink } from 'lucide-react';
import { MainLayout } from '../../layouts';
import { Avatar, Button, Card, CheckboxGroup, Input, OTPInput, PhoneInput } from '../../components/ui';
import { GooglePlacesInput } from '../../components/location/GooglePlacesInput';
import { useAuth } from '../../contexts';
import { appApi } from '../../services/appApi';
import type { CaregiverProfile, CaregiverDocument, HirerProfile } from '../../services/api';
import { FULL_NAME_INPUT_GUIDE, isConfiguredDisplayName, toDisplayNameFromFullName } from '../../utils/profileName';

function roleLabel(role: string) {
  if (role === 'hirer') return 'ผู้ว่าจ้าง';
  if (role === 'caregiver') return 'ผู้ดูแล';
  return 'แอดมิน';
}

export default function ProfilePage() {
  const { user, updateUser, refreshUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const profileRequired = !!(location.state as any)?.profileRequired;
  const returnTo = (location.state as any)?.from as string | undefined;
  const [profileRole, setProfileRole] = useState<'hirer' | 'caregiver' | 'admin'>('hirer');
  const [hirerForm, setHirerForm] = useState({
    display_name: '',
    address_line1: '',
    address_line2: '',
    district: '',
    province: '',
    postal_code: '',
    lat: null as number | null,
    lng: null as number | null,
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
    is_public_profile: true,
  });
  const [profileSnapshot, setProfileSnapshot] = useState<HirerProfile | CaregiverProfile | null>(null);
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

  // Caregiver certification documents
  const [certDocs, setCertDocs] = useState<CaregiverDocument[]>([]);
  const [certDocsLoading, setCertDocsLoading] = useState(false);
  const [certUploadOpen, setCertUploadOpen] = useState(false);
  const [certUploading, setCertUploading] = useState(false);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certForm, setCertForm] = useState({ title: '', document_type: 'certification', description: '', issuer: '', issued_date: '', expiry_date: '' });
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const primaryId = useMemo(() => user?.email || user?.phone_number || '-', [user]);
  const avatarSrc = useMemo(() => {
    if (!user?.avatar) return undefined;
    if (user.avatar.startsWith('http://') || user.avatar.startsWith('https://') || user.avatar.startsWith('/')) {
      return user.avatar;
    }
    return `/uploads/${user.avatar}`;
  }, [user?.avatar]);
  const displayNameGuideText = `${FULL_NAME_INPUT_GUIDE} คนอื่นจะเห็นเป็น “ชื่อจริง น.” ก่อนมอบหมายงาน`;

  const handleAvatarFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const supportedMime = ['image/jpeg', 'image/png', 'image/webp'];
    if (!supportedMime.includes(file.type)) {
      toast.error('อนุญาตเฉพาะไฟล์ JPEG, PNG หรือ WebP');
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('รูปโปรไฟล์ต้องมีขนาดไม่เกิน 5 MB');
      event.target.value = '';
      return;
    }

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await appApi.uploadProfileAvatar(formData);
      if (!res.success || !res.data?.avatar) {
        toast.error(res.error || 'อัปโหลดรูปโปรไฟล์ไม่สำเร็จ');
        return;
      }

      updateUser({ avatar: res.data.avatar });
      toast.success('อัปเดตรูปโปรไฟล์แล้ว');
    } catch (error: any) {
      toast.error(error.message || 'อัปโหลดรูปโปรไฟล์ไม่สำเร็จ');
    } finally {
      setAvatarUploading(false);
      event.target.value = '';
    }
  };

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

  const hirerDisplayNamePreview = useMemo(() => toDisplayNameFromFullName(hirerForm.display_name), [hirerForm.display_name]);
  const caregiverDisplayNamePreview = useMemo(() => toDisplayNameFromFullName(caregiverForm.display_name), [caregiverForm.display_name]);

  const resolveNameInputForSave = useCallback((rawInput: string, previousDisplayName?: string | null) => {
    const trimmedInput = rawInput.trim();
    if (!trimmedInput) return null;

    const converted = toDisplayNameFromFullName(trimmedInput);
    if (converted) return trimmedInput;

    const previous = (previousDisplayName || '').trim();
    if (previous && trimmedInput === previous && isConfiguredDisplayName(previous)) {
      return trimmedInput;
    }

    return null;
  }, []);

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
      display_name: profile?.full_name || profile?.display_name || fallbackName,
      address_line1: profile?.address_line1 || '',
      address_line2: profile?.address_line2 || '',
      district: profile?.district || '',
      province: profile?.province || '',
      postal_code: profile?.postal_code || '',
      lat: (profile as any)?.lat ?? null,
      lng: (profile as any)?.lng ?? null,
    });
  }, []);

  const hydrateCaregiverForm = useCallback((profile: CaregiverProfile | null, fallbackName: string) => {
    setCaregiverForm({
      display_name: profile?.full_name || profile?.display_name || fallbackName,
      bio: profile?.bio || '',
      experience_years: profile?.experience_years !== null && profile?.experience_years !== undefined ? String(profile.experience_years) : '',
      certifications: profile?.certifications || [],
      specializations: profile?.specializations || [],
      available_from: profile?.available_from || '',
      available_to: profile?.available_to || '',
      available_days: (profile?.available_days || []).map((d) => String(d)),
      is_public_profile: typeof profile?.is_public_profile === 'boolean' ? profile.is_public_profile : true,
    });
  }, []);

  const applyProfile = useCallback(
    (role: 'hirer' | 'caregiver' | 'admin', profile: HirerProfile | CaregiverProfile | null) => {
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
        const previousDisplayName = (profileSnapshot as HirerProfile | null)?.display_name || null;
        const fullNameInput = resolveNameInputForSave(hirerForm.display_name, previousDisplayName);
        if (!fullNameInput) {
          toast.error(`${FULL_NAME_INPUT_GUIDE} แล้วระบบจะแสดงเป็นชื่อจริงและตัวแรกของนามสกุล`);
          return;
        }
        const res = await appApi.updateMyProfile({
          display_name: fullNameInput,
          address_line1: hirerForm.address_line1.trim() || null,
          address_line2: hirerForm.address_line2.trim() || null,
          district: hirerForm.district.trim() || null,
          province: hirerForm.province.trim() || null,
          postal_code: hirerForm.postal_code.trim() || null,
          lat: hirerForm.lat,
          lng: hirerForm.lng,
        } as any);
        if (!res.success || !res.data) {
          toast.error(res.error || 'บันทึกไม่สำเร็จ');
          return;
        }
        applyProfile('hirer', res.data.profile);
        updateUser({ name: (res.data.profile as any)?.full_name || res.data.profile.display_name || fullNameInput });
        toast.success('บันทึกแล้ว');
        if (profileRequired && returnTo) {
          navigate(returnTo, { replace: true });
        }
        return;
      }

      const previousDisplayName = (profileSnapshot as CaregiverProfile | null)?.display_name || null;
      const fullNameInput = resolveNameInputForSave(caregiverForm.display_name, previousDisplayName);
      if (!fullNameInput) {
        toast.error(`${FULL_NAME_INPUT_GUIDE} แล้วระบบจะแสดงเป็นชื่อจริงและตัวแรกของนามสกุล`);
        return;
      }
      const experienceYears = caregiverForm.experience_years.trim();
      const experienceValue = experienceYears ? Number(experienceYears) : null;
      const availableDays = caregiverForm.available_days
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
      const res = await appApi.updateMyProfile({
        display_name: fullNameInput,
        bio: caregiverForm.bio.trim() || null,
        experience_years: Number.isFinite(experienceValue) ? experienceValue : null,
        certifications: caregiverForm.certifications,
        specializations: caregiverForm.specializations,
        available_from: caregiverForm.available_from || null,
        available_to: caregiverForm.available_to || null,
        available_days: availableDays,
        is_public_profile: caregiverForm.is_public_profile,
      });
      if (!res.success || !res.data) {
        toast.error(res.error || 'บันทึกไม่สำเร็จ');
        return;
      }
      applyProfile('caregiver', res.data.profile);
      updateUser({ name: (res.data.profile as any)?.full_name || res.data.profile.display_name || fullNameInput });
      toast.success('บันทึกแล้ว');
      if (profileRequired && returnTo) {
        navigate(returnTo, { replace: true });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!user) return;
    applyProfile(profileRole, profileSnapshot);
  };

  const handleChangeRole = () => {
    if (!user || user.role === 'admin') return;
    navigate('/select-role', {
      state: { mode: 'login' },
    });
  };

  // ─── Caregiver certification documents ───
  const loadCertDocs = useCallback(async () => {
    if (user?.role !== 'caregiver') return;
    setCertDocsLoading(true);
    try {
      const res = await appApi.getMyCaregiverDocuments();
      if (res.success && res.data) setCertDocs(Array.isArray(res.data) ? res.data : []);
    } catch { /* ignore */ } finally {
      setCertDocsLoading(false);
    }
  }, [user?.role]);

  useEffect(() => { loadCertDocs(); }, [loadCertDocs]);

  const handleCertUpload = async () => {
    if (!certFile || !certForm.title.trim()) {
      toast.error('กรุณาระบุชื่อเอกสารและเลือกไฟล์');
      return;
    }
    setCertUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', certFile);
      fd.append('title', certForm.title.trim());
      fd.append('document_type', certForm.document_type);
      if (certForm.description.trim()) fd.append('description', certForm.description.trim());
      if (certForm.issuer.trim()) fd.append('issuer', certForm.issuer.trim());
      if (certForm.issued_date) fd.append('issued_date', certForm.issued_date);
      if (certForm.expiry_date) fd.append('expiry_date', certForm.expiry_date);
      const res = await appApi.uploadCaregiverDocument(fd);
      if (!res.success) { toast.error(res.error || 'อัปโหลดไม่สำเร็จ'); return; }
      toast.success('อัปโหลดเอกสารสำเร็จ');
      setCertUploadOpen(false);
      setCertFile(null);
      setCertForm({ title: '', document_type: 'certification', description: '', issuer: '', issued_date: '', expiry_date: '' });
      loadCertDocs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'อัปโหลดไม่สำเร็จ');
    } finally {
      setCertUploading(false);
    }
  };

  const handleCertDelete = async (docId: string) => {
    if (!confirm('ต้องการลบเอกสารนี้?')) return;
    try {
      const res = await appApi.deleteCaregiverDocument(docId);
      if (!res.success) { toast.error(res.error || 'ลบไม่สำเร็จ'); return; }
      toast.success('ลบเอกสารแล้ว');
      setCertDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch { toast.error('ลบไม่สำเร็จ'); }
  };

  const DOC_TYPE_LABELS: Record<string, string> = {
    certification: 'ใบรับรอง/ใบประกาศ',
    license: 'ใบอนุญาต',
    training: 'ใบผ่านการอบรม',
    other: 'อื่นๆ',
  };

  return (
    <MainLayout showBottomBar={false}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">โปรไฟล์</h1>
            <p className="text-sm text-gray-600">ข้อมูลบัญชีและสถานะการยืนยันตัวตน</p>
          </div>
          {user && user.role !== 'admin' && (
            <Button variant="outline" onClick={handleChangeRole}>
              เปลี่ยนสถานะ
            </Button>
          )}
        </div>

        {user && (
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar src={avatarSrc} name={user.name || ''} size="lg" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{user.name || '-'}</div>
                  <div className="text-xs text-gray-600 break-all">{primaryId}</div>
                  <div className="text-xs text-gray-400 font-mono break-all">{user.id}</div>
                </div>
              </div>

              <div className="flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  loading={avatarUploading}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  เพิ่มรูปโปรไฟล์
                </Button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarFileChange}
                />
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2">รองรับไฟล์ JPEG, PNG, WebP ขนาดไม่เกิน 5 MB</div>
          </Card>
        )}

        {profileRequired && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="text-sm font-semibold text-amber-800">กรุณาตั้งชื่อที่ใช้แสดงก่อนเริ่มใช้งาน</div>
            <div className="text-xs text-amber-700 mt-1">{FULL_NAME_INPUT_GUIDE} ระบบจะย่อให้อัตโนมัติเป็น “ชื่อจริง + ตัวแรกของนามสกุล” เพื่อความปลอดภัย</div>
          </div>
        )}

        {user && user.role !== 'admin' && (
          <Card className="p-6">
            <div className="text-sm font-semibold text-gray-900 mb-3">ระดับความน่าเชื่อถือ</div>
            <div className="flex items-center gap-3 mb-3">
              {(['L2', 'L3'].includes(user.trust_level || 'L0'))
                ? <BadgeCheck className="w-6 h-6 text-green-600" />
                : (user.trust_level === 'L1')
                  ? <ShieldCheck className="w-6 h-6 text-yellow-600" />
                  : <Shield className="w-6 h-6 text-gray-400" />
              }
              <div>
                <div className="text-lg font-bold text-gray-900">{user.trust_level || 'L0'}</div>
                <div className="text-xs text-gray-500">
                  {user.trust_level === 'L3' ? 'เชื่อถือสูง' : user.trust_level === 'L2' ? 'ยืนยันแล้ว' : user.trust_level === 'L1' ? 'พื้นฐาน' : 'ยังไม่ยืนยัน'}
                </div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${user.is_phone_verified ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {user.is_phone_verified ? '✓' : '1'}
                </div>
                <span className={user.is_phone_verified ? 'text-green-700' : 'text-gray-600'}>ยืนยันเบอร์โทร {user.is_phone_verified ? '✓' : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${['L2', 'L3'].includes(user.trust_level || 'L0') ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {['L2', 'L3'].includes(user.trust_level || 'L0') ? '✓' : '2'}
                </div>
                <span className={['L2', 'L3'].includes(user.trust_level || 'L0') ? 'text-green-700' : 'text-gray-600'}>ยืนยันตัวตน KYC {['L2', 'L3'].includes(user.trust_level || 'L0') ? '✓' : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${user.trust_level === 'L3' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {user.trust_level === 'L3' ? '✓' : '3'}
                </div>
                <span className={user.trust_level === 'L3' ? 'text-green-700' : 'text-gray-600'}>บัญชีธนาคาร + คะแนน ≥80 {user.trust_level === 'L3' ? '✓' : ''}</span>
              </div>
            </div>
            {!['L2', 'L3'].includes(user.trust_level || 'L0') && (
              <div className="mt-3">
                <Link to="/kyc">
                  <Button variant="primary" size="sm">ยืนยันตัวตน (KYC)</Button>
                </Link>
              </div>
            )}
          </Card>
        )}

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
                    <div className="space-y-4">
                      <Input
                        label="ชื่อที่ใช้แสดง"
                        value={hirerForm.display_name}
                        onChange={(e) => { const v = e.target.value; setHirerForm((prev) => ({ ...prev, display_name: v })); }}
                        placeholder="เช่น สมชาย ใจดี"
                        helperText={displayNameGuideText}
                        required
                      />
                      {hirerDisplayNamePreview && hirerDisplayNamePreview !== hirerForm.display_name.trim() && (
                        <div className="text-xs text-blue-700">ชื่อที่จะแสดง: {hirerDisplayNamePreview}</div>
                      )}
                      <GooglePlacesInput
                        label="ที่อยู่"
                        value={hirerForm.address_line1}
                        placeholder="ค้นหาที่อยู่ด้วย Google Maps"
                        showMap
                        lat={hirerForm.lat}
                        lng={hirerForm.lng}
                        onChange={(next) =>
                          setHirerForm((prev) => ({
                            ...prev,
                            address_line1: next.address_line1,
                            district: next.district || prev.district,
                            province: next.province || prev.province,
                            postal_code: next.postal_code || prev.postal_code,
                            lat: typeof next.lat === 'number' ? next.lat : prev.lat,
                            lng: typeof next.lng === 'number' ? next.lng : prev.lng,
                          }))
                        }
                      />
                      <Input
                        label="ที่อยู่บรรทัด 2"
                        value={hirerForm.address_line2}
                        onChange={(e) => { const v = e.target.value; setHirerForm((prev) => ({ ...prev, address_line2: v })); }}
                        placeholder="อาคาร/ชั้น/ห้อง"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Input
                          label="เขต/อำเภอ"
                          value={hirerForm.district}
                          onChange={(e) => { const v = e.target.value; setHirerForm((prev) => ({ ...prev, district: v })); }}
                          placeholder="เขต/อำเภอ"
                        />
                        <Input
                          label="จังหวัด"
                          value={hirerForm.province}
                          onChange={(e) => { const v = e.target.value; setHirerForm((prev) => ({ ...prev, province: v })); }}
                          placeholder="จังหวัด"
                        />
                        <Input
                          label="รหัสไปรษณีย์"
                          value={hirerForm.postal_code}
                          onChange={(e) => { const v = e.target.value; setHirerForm((prev) => ({ ...prev, postal_code: v })); }}
                          placeholder="รหัสไปรษณีย์"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                          label="ชื่อที่ใช้แสดง"
                          value={caregiverForm.display_name}
                          onChange={(e) => setCaregiverForm({ ...caregiverForm, display_name: e.target.value })}
                          placeholder="เช่น อรทัย ใจงาม"
                          helperText={displayNameGuideText}
                          required
                        />
                        {caregiverDisplayNamePreview && caregiverDisplayNamePreview !== caregiverForm.display_name.trim() && (
                          <div className="text-xs text-blue-700 sm:col-span-2">ชื่อที่จะแสดง: {caregiverDisplayNamePreview}</div>
                        )}
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
                      <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={caregiverForm.is_public_profile}
                          onChange={(e) => setCaregiverForm({ ...caregiverForm, is_public_profile: e.target.checked })}
                        />
                        <div>
                          <div className="text-sm font-semibold text-gray-900">เปิดให้ผู้ว่าจ้างค้นหาโปรไฟล์ได้</div>
                          <div className="text-xs text-gray-600 mt-0.5">
                            หากปิดไว้ โปรไฟล์ของคุณจะไม่แสดงในหน้า “ค้นหาผู้ดูแล” ของผู้ว่าจ้าง
                          </div>
                        </div>
                      </label>
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

            {/* ─── Caregiver Certification Documents ─── */}
            {profileRole === 'caregiver' && (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">เอกสารรับรองความสามารถ</div>
                    <div className="text-xs text-gray-500">อัปโหลดใบรับรอง ใบอนุญาต หรือเอกสารยืนยันทักษะ เพื่อให้ผู้ว่าจ้างสามารถตรวจสอบได้</div>
                  </div>
                  {!certUploadOpen && (
                    <Button variant="outline" size="sm" onClick={() => setCertUploadOpen(true)}>
                      <Upload className="w-4 h-4 mr-1" />เพิ่มเอกสาร
                    </Button>
                  )}
                </div>

                {/* Upload form */}
                {certUploadOpen && (
                  <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 mb-4">
                    <div className="text-sm font-semibold text-blue-800 mb-3">อัปโหลดเอกสารใหม่</div>
                    <div className="grid gap-3">
                      <Input
                        label="ชื่อเอกสาร *"
                        value={certForm.title}
                        onChange={(e) => setCertForm({ ...certForm, title: e.target.value })}
                        placeholder="เช่น ใบรับรองปฐมพยาบาล"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-sm font-semibold text-gray-700">ประเภทเอกสาร</label>
                          <select
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                            value={certForm.document_type}
                            onChange={(e) => setCertForm({ ...certForm, document_type: e.target.value })}
                          >
                            <option value="certification">ใบรับรอง/ใบประกาศ</option>
                            <option value="license">ใบอนุญาต</option>
                            <option value="training">ใบผ่านการอบรม</option>
                            <option value="other">อื่นๆ</option>
                          </select>
                        </div>
                        <Input
                          label="หน่วยงานที่ออก"
                          value={certForm.issuer}
                          onChange={(e) => setCertForm({ ...certForm, issuer: e.target.value })}
                          placeholder="เช่น สภากาชาดไทย"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-sm font-semibold text-gray-700">วันที่ออก</label>
                          <input
                            type="date"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                            value={certForm.issued_date}
                            onChange={(e) => setCertForm({ ...certForm, issued_date: e.target.value })}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-sm font-semibold text-gray-700">วันหมดอายุ</label>
                          <input
                            type="date"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                            value={certForm.expiry_date}
                            onChange={(e) => setCertForm({ ...certForm, expiry_date: e.target.value })}
                          />
                        </div>
                      </div>
                      <Input
                        label="รายละเอียดเพิ่มเติม"
                        value={certForm.description}
                        onChange={(e) => setCertForm({ ...certForm, description: e.target.value })}
                        placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
                      />
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-semibold text-gray-700">ไฟล์เอกสาร * <span className="text-xs text-gray-400 font-normal">(JPEG, PNG, PDF ไม่เกิน 10 MB)</span></label>
                        {certFile ? (
                          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg">
                            <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            <span className="text-sm text-gray-800 truncate flex-1">{certFile.name}</span>
                            <span className="text-xs text-gray-400">{(certFile.size / 1024).toFixed(0)} KB</span>
                            <button onClick={() => setCertFile(null)} className="text-red-500 hover:text-red-700 text-xs">✕</button>
                          </div>
                        ) : (
                          <label className="flex items-center justify-center h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                            <Upload className="w-5 h-5 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-500">คลิกเพื่อเลือกไฟล์</span>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f && f.size > 10 * 1024 * 1024) { toast.error('ไฟล์ต้องไม่เกิน 10 MB'); return; }
                                if (f) setCertFile(f);
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button variant="primary" size="sm" loading={certUploading} onClick={handleCertUpload} disabled={!certFile || !certForm.title.trim()}>
                        <Upload className="w-4 h-4 mr-1" />อัปโหลด
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => { setCertUploadOpen(false); setCertFile(null); }}>
                        ยกเลิก
                      </Button>
                    </div>
                  </div>
                )}

                {/* Document list */}
                {certDocsLoading ? (
                  <div className="text-sm text-gray-500 text-center py-4">กำลังโหลดเอกสาร...</div>
                ) : certDocs.length === 0 ? (
                  <div className="text-center py-6 text-gray-400">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <div className="text-sm">ยังไม่มีเอกสารรับรอง</div>
                    <div className="text-xs mt-1">อัปโหลดเอกสารเพื่อเพิ่มความน่าเชื่อถือ</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {certDocs.map((doc) => (
                      <div key={doc.id} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900">{doc.title}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {DOC_TYPE_LABELS[doc.document_type] || doc.document_type}
                            {doc.issuer && <> • {doc.issuer}</>}
                          </div>
                          {doc.issued_date && (
                            <div className="text-xs text-gray-400 mt-0.5">
                              ออกเมื่อ: {new Date(doc.issued_date).toLocaleDateString('th-TH')}
                              {doc.expiry_date && <> • หมดอายุ: {new Date(doc.expiry_date).toLocaleDateString('th-TH')}</>}
                            </div>
                          )}
                          {doc.description && <div className="text-xs text-gray-500 mt-1">{doc.description}</div>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <a
                            href={`/uploads/${doc.file_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                            title="ดูเอกสาร"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => handleCertDelete(doc.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                            title="ลบเอกสาร"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

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

            <Button variant="danger" fullWidth onClick={logout}>
              ออกจากระบบ
            </Button>
          </>
        )}
      </div>
    </MainLayout>
  );
}
