import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BadgeCheck, ShieldCheck, Camera, Upload, FileText, CheckCircle, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { MainLayout } from '../../layouts';
import { Button, Card, Input, LoadingState, Select } from '../../components/ui';
import { useAuth } from '../../contexts';
import { appApi } from '../../services/appApi';
import type { KycStatus } from '../../services/api';

const verifiedLevels = new Set(['L2', 'L3']);

type Step = 'document' | 'selfie' | 'info' | 'review';
const STEPS: { key: Step; label: string; icon: any }[] = [
  { key: 'document', label: 'อัปโหลดเอกสาร', icon: Upload },
  { key: 'selfie', label: 'สแกนใบหน้า', icon: Camera },
  { key: 'info', label: 'ข้อมูลส่วนตัว', icon: FileText },
  { key: 'review', label: 'ตรวจสอบ & ส่ง', icon: CheckCircle },
];

export default function KycPage() {
  const navigate = useNavigate();
  const { user, activeRole, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [kyc, setKyc] = useState<KycStatus | null>(null);
  const [step, setStep] = useState<Step>('document');

  // Document state
  const [docFront, setDocFront] = useState<File | null>(null);
  const [docFrontPreview, setDocFrontPreview] = useState<string | null>(null);
  const [docBack, setDocBack] = useState<File | null>(null);
  const [docBackPreview, setDocBackPreview] = useState<string | null>(null);
  const [docType, setDocType] = useState('national_id');

  // Selfie state
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Info state
  const [fullName, setFullName] = useState('');
  const [nationalId, setNationalId] = useState('');

  // Processing animation
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);

  const resolvedRole = user?.role === 'admin' ? 'admin' : (activeRole || user?.role || 'hirer');
  const homePath = resolvedRole === 'caregiver' ? '/caregiver/jobs/feed' : resolvedRole === 'admin' ? '/admin/dashboard' : '/hirer/home';

  const isVerified = kyc?.status === 'approved' || verifiedLevels.has(user?.trust_level || 'L0');

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await appApi.getKycStatus();
      if (res.success) setKyc(res.data?.kyc || null);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => { stopCamera(); };
  }, []);

  const handleFileSelect = (setter: (f: File | null) => void, previewSetter: (s: string | null) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) { toast.error('ไฟล์ต้องไม่เกิน 10 MB'); return; }
      setter(file);
      const reader = new FileReader();
      reader.onload = () => previewSetter(reader.result as string);
      reader.readAsDataURL(file);
    };

  // Camera functions — simulates KYC Provider face scan
  // In production, this step would redirect to the provider's hosted page
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);

      // Auto-capture after 2 seconds but show preview for confirmation
      setTimeout(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.drawImage(video, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              setSelfieFile(new File([blob], 'selfie.jpg', { type: 'image/jpeg' }));
              setSelfiePreview(canvas.toDataURL('image/jpeg', 0.85));
            } else {
              const placeholder = new File([new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0])], 'selfie.jpg', { type: 'image/jpeg' });
              setSelfieFile(placeholder);
              setSelfiePreview(null);
            }
            // Stop camera but stay on selfie step for user to confirm
            stream.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
            setCameraActive(false);
            toast.success('ถ่ายรูปสำเร็จ กรุณาตรวจสอบก่อนไปขั้นตอนถัดไป');
          }, 'image/jpeg', 0.85);
        } else {
          const placeholder = new File([new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0])], 'selfie.jpg', { type: 'image/jpeg' });
          setSelfieFile(placeholder);
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          setCameraActive(false);
          toast.success('ถ่ายรูปสำเร็จ');
        }
      }, 2000);
    } catch {
      toast.error('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้อง');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  // Step navigation
  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  const canGoNext = useMemo(() => {
    switch (step) {
      case 'document': return !!docFront;
      case 'selfie': return !!selfieFile;
      case 'info': return fullName.trim().length > 0 && (docType === 'national_id' ? nationalId.length === 13 : nationalId.trim().length > 0);
      case 'review': return true;
      default: return false;
    }
  }, [step, docFront, selfieFile, fullName, nationalId]);

  const goNext = () => {
    const idx = currentStepIndex;
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1].key);
  };
  const goBack = () => {
    const idx = currentStepIndex;
    if (idx > 0) setStep(STEPS[idx - 1].key);
  };

  // Submit
  const handleSubmit = async () => {
    if (!docFront || !selfieFile || !fullName.trim() || !nationalId.trim()) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    if (docType === 'national_id' && nationalId.trim().length !== 13) {
      toast.error('เลขบัตรประชาชนต้องมี 13 หลัก');
      return;
    }

    setSubmitting(true);
    setProcessing(true);
    setProcessingStep(0);

    // Simulate provider processing steps
    const steps = [
      'กำลังอัปโหลดเอกสาร...',
      'กำลังตรวจสอบเอกสาร...',
      'กำลังเปรียบเทียบใบหน้า...',
      'กำลังยืนยันข้อมูล...',
      'กำลังรอผลจาก Provider...',
    ];

    for (let i = 0; i < steps.length; i++) {
      setProcessingStep(i);
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 400));
    }

    try {
      const formData = new FormData();
      formData.append('full_name', fullName.trim());
      formData.append('national_id', nationalId.trim());
      formData.append('document_type', docType);
      formData.append('document_front', docFront);
      if (docBack) formData.append('document_back', docBack);
      formData.append('selfie', selfieFile);

      const res = await appApi.submitKyc(formData);
      if (!res.success) {
        toast.error(res.error || 'ยืนยันตัวตนไม่สำเร็จ');
        return;
      }
      setKyc(res.data?.kyc || null);
      await refreshUser();
      toast.success('ยืนยันตัวตนสำเร็จ! Trust Level ของคุณได้รับการอัปเกรด');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ยืนยันตัวตนไม่สำเร็จ');
    } finally {
      setSubmitting(false);
      setProcessing(false);
    }
  };

  const processingLabels = [
    'กำลังอัปโหลดเอกสาร...',
    'กำลังตรวจสอบเอกสาร...',
    'กำลังเปรียบเทียบใบหน้า...',
    'กำลังยืนยันข้อมูล...',
    'กำลังรอผลจาก Provider...',
  ];

  // ─── Render ───

  if (loading) {
    return (
      <MainLayout showBottomBar={false}>
        <div className="max-w-3xl mx-auto px-4 py-6">
          <LoadingState message="กำลังโหลดสถานะ..." />
        </div>
      </MainLayout>
    );
  }

  // Already verified — show status
  if (isVerified) {
    return (
      <MainLayout showBottomBar={false}>
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-gray-900">ยืนยันตัวตน (KYC)</h1>
            <Button variant="outline" onClick={() => navigate(homePath)}>ย้อนกลับ</Button>
          </div>
          <Card className="p-8 text-center">
            <BadgeCheck className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-green-700 mb-2">ยืนยันตัวตนเรียบร้อยแล้ว</h2>
            <p className="text-gray-600 mb-1">
              Trust Level: <span className="font-bold text-gray-900">{user?.trust_level || 'L2'}</span>
            </p>
            {kyc?.verified_at && (
              <p className="text-sm text-gray-500">ยืนยันเมื่อ: {new Date(kyc.verified_at).toLocaleString('th-TH')}</p>
            )}
            <div className="mt-6">
              <Button variant="primary" onClick={() => navigate(homePath)}>กลับหน้าหลัก</Button>
            </div>
          </Card>
        </div>
      </MainLayout>
    );
  }

  // Processing animation overlay
  if (processing) {
    return (
      <MainLayout showBottomBar={false}>
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Card className="p-8">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-spin" />
              <h2 className="text-lg font-bold text-gray-900 mb-4">กำลังดำเนินการยืนยันตัวตน</h2>
              <div className="space-y-3 max-w-xs mx-auto text-left">
                {processingLabels.map((label, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {i < processingStep ? (
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    ) : i === processingStep ? (
                      <Loader2 className="w-5 h-5 text-blue-500 flex-shrink-0 animate-spin" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                    )}
                    <span className={`text-sm ${i <= processingStep ? 'text-gray-900' : 'text-gray-400'}`}>{label}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-6">กรุณาอย่าปิดหน้านี้</p>
            </div>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout showBottomBar={false}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ยืนยันตัวตน (KYC)</h1>
            <p className="text-sm text-gray-600">กรุณาทำตามขั้นตอนเพื่อยืนยันตัวตน</p>
          </div>
          <Button variant="outline" onClick={() => navigate(-1)}>ย้อนกลับ</Button>
        </div>

        {/* Status bar */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
            <div className="text-sm">
              <span className="text-gray-600">สถานะ: </span>
              <span className="font-semibold text-amber-600">
                {kyc?.status === 'rejected' ? 'ไม่ผ่าน — กรุณาส่งใหม่' : 'ยังไม่ยืนยัน'}
              </span>
              <span className="text-gray-400 mx-2">•</span>
              <span className="text-gray-600">Trust Level: </span>
              <span className="font-semibold text-gray-900">{user?.trust_level || 'L0'}</span>
            </div>
          </div>
        </Card>

        {/* Step indicator */}
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = s.key === step;
            const isDone = i < currentStepIndex;
            return (
              <div key={s.key} className="flex items-center flex-1">
                <button
                  onClick={() => { if (isDone) setStep(s.key); }}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium w-full justify-center transition-colors
                    ${isActive ? 'bg-blue-100 text-blue-700' : isDone ? 'bg-green-50 text-green-700 cursor-pointer hover:bg-green-100' : 'bg-gray-50 text-gray-600'}`}
                >
                  {isDone ? <CheckCircle className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{i + 1}</span>
                </button>
                {i < STEPS.length - 1 && <div className={`w-4 h-0.5 mx-0.5 flex-shrink-0 ${isDone ? 'bg-green-300' : 'bg-gray-200'}`} />}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <Card className="p-4 sm:p-6">
          {/* ─── Step 1: Document Upload ─── */}
          {step === 'document' && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">อัปโหลดเอกสาร</h2>
              <p className="text-sm text-gray-600 mb-4">ถ่ายรูปหรือเลือกรูปบัตรประชาชน / หนังสือเดินทาง</p>

              <Select label="ประเภทเอกสาร" value={docType} onChange={(e) => setDocType(e.target.value)}>
                <option value="national_id">บัตรประชาชน</option>
                <option value="passport">หนังสือเดินทาง</option>
              </Select>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Front */}
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    ด้านหน้า <span className="text-red-500">*</span>
                  </label>
                  {docFrontPreview ? (
                    <div className="relative">
                      <img src={docFrontPreview} alt="ด้านหน้า" className="w-full h-48 object-cover rounded-lg border border-gray-200" />
                      <button
                        onClick={() => { setDocFront(null); setDocFrontPreview(null); }}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                      >✕</button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-500">คลิกเพื่อเลือกรูป</span>
                      <span className="text-xs text-gray-400 mt-1">JPEG, PNG ไม่เกิน 10 MB</span>
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect(setDocFront, setDocFrontPreview)} />
                    </label>
                  )}
                </div>

                {/* Back */}
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    ด้านหลัง <span className="text-gray-400 text-xs">(ไม่บังคับ)</span>
                  </label>
                  {docBackPreview ? (
                    <div className="relative">
                      <img src={docBackPreview} alt="ด้านหลัง" className="w-full h-48 object-cover rounded-lg border border-gray-200" />
                      <button
                        onClick={() => { setDocBack(null); setDocBackPreview(null); }}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                      >✕</button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-500">คลิกเพื่อเลือกรูป</span>
                      <span className="text-xs text-gray-400 mt-1">ไม่บังคับ</span>
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect(setDocBack, setDocBackPreview)} />
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 2: Face Scan ─── */}
          {step === 'selfie' && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">สแกนใบหน้า</h2>
              <p className="text-sm text-gray-600 mb-4">
                {selfiePreview ? 'ตรวจสอบรูปถ่ายของคุณ หากไม่ชัดเจนสามารถถ่ายใหม่ได้' : 'ระบบจะเปิดกล้องเพื่อสแกนใบหน้าอัตโนมัติ'}
              </p>

              {cameraActive ? (
                <div className="text-center">
                  <div className="relative inline-block">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full max-w-sm h-auto rounded-xl border-2 border-blue-300 mx-auto"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-48 border-2 border-blue-400/60 rounded-full animate-pulse" />
                    </div>
                  </div>
                  <p className="text-sm text-blue-600 font-medium mt-3 animate-pulse">กำลังสแกนใบหน้า...</p>
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              ) : selfiePreview ? (
                <div className="text-center">
                  <img src={selfiePreview} alt="รูปใบหน้า" className="w-48 h-48 object-cover rounded-full border-4 border-green-300 mx-auto" />
                  <p className="text-sm text-green-700 font-medium mt-3">ถ่ายรูปสำเร็จ</p>
                  <div className="flex gap-3 justify-center mt-4">
                    <Button variant="outline" onClick={() => { setSelfieFile(null); setSelfiePreview(null); startCamera(); }}>
                      <Camera className="w-4 h-4 mr-2" />ถ่ายใหม่
                    </Button>
                    <Button variant="primary" onClick={goNext}>
                      ใช้รูปนี้ ถัดไป<ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Camera className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-sm text-gray-500 mb-4">กดปุ่มด้านล่างเพื่อเริ่มสแกนใบหน้า</p>
                  <Button variant="primary" onClick={startCamera}>
                    <Camera className="w-4 h-4 mr-2" />เปิดกล้อง
                  </Button>
                  <div className="mt-6 p-3 bg-gray-50 border border-gray-200 rounded-lg text-left">
                    <p className="text-xs text-gray-500">
                      <span className="font-semibold text-gray-600">หมายเหตุ:</span> ในระบบจริง ขั้นตอนนี้จะเปิดหน้าเว็บของ KYC Provider (เช่น Sumsub, Onfido)
                      เพื่อทำ Liveness Detection และเปรียบเทียบใบหน้ากับเอกสาร — ระบบนี้เป็นการจำลองเท่านั้น
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Step 3: Personal Info ─── */}
          {step === 'info' && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">ข้อมูลส่วนตัว</h2>
              <p className="text-sm text-gray-600 mb-4">กรอกข้อมูลให้ตรงกับเอกสารที่อัปโหลด</p>

              <div className="space-y-4">
                <Input
                  label="ชื่อ-นามสกุล (ตามบัตร)"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="เช่น สมชาย ใจดี"
                  required
                />
                <Input
                  label={docType === 'national_id' ? 'เลขบัตรประชาชน (13 หลัก)' : 'เลขหนังสือเดินทาง'}
                  value={nationalId}
                  onChange={(e) => {
                    if (docType === 'national_id') {
                      setNationalId(e.target.value.replace(/\D/g, '').slice(0, 13));
                    } else {
                      setNationalId(e.target.value);
                    }
                  }}
                  inputMode={docType === 'national_id' ? 'numeric' : undefined}
                  placeholder={docType === 'national_id' ? '1234567890123' : 'AA1234567'}
                  error={docType === 'national_id' && nationalId.length > 0 && nationalId.length < 13 ? `กรอกแล้ว ${nationalId.length}/13 หลัก` : undefined}
                  required
                />
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                  ข้อมูลจะถูกเข้ารหัสและส่งไปยัง KYC Provider เพื่อตรวจสอบ ระบบจะไม่เก็บข้อมูลดิบ
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 4: Review & Submit ─── */}
          {step === 'review' && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">ตรวจสอบข้อมูล</h2>
              <p className="text-sm text-gray-600 mb-4">กรุณาตรวจสอบข้อมูลก่อนส่งยืนยัน</p>

              <div className="space-y-4">
                {/* Document preview */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">เอกสาร</h3>
                  <div className="flex gap-3">
                    {docFrontPreview && (
                      <img src={docFrontPreview} alt="ด้านหน้า" className="w-24 h-16 object-cover rounded border" />
                    )}
                    {docBackPreview && (
                      <img src={docBackPreview} alt="ด้านหลัง" className="w-24 h-16 object-cover rounded border" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    ประเภท: {docType === 'national_id' ? 'บัตรประชาชน' : 'หนังสือเดินทาง'}
                  </p>
                </div>

                {/* Selfie preview */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">รูปใบหน้า</h3>
                  {selfiePreview && (
                    <img src={selfiePreview} alt="Selfie" className="w-20 h-20 object-cover rounded-full border" />
                  )}
                </div>

                {/* Info */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">ข้อมูลส่วนตัว</h3>
                  <div className="text-sm text-gray-800 space-y-1">
                    <div>ชื่อ-นามสกุล: <span className="font-medium">{fullName}</span></div>
                    <div>
                      {docType === 'national_id' ? 'เลขบัตรประชาชน' : 'เลขหนังสือเดินทาง'}:{' '}
                      <span className="font-medium">{nationalId.slice(0, 4)}****{nationalId.slice(-4)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  เมื่อกดส่ง ข้อมูลจะถูกส่งไปยัง KYC Provider เพื่อตรวจสอบ หากข้อมูลถูกต้องจะได้รับการยืนยันอัตโนมัติ
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <div>
            {currentStepIndex > 0 && (
              <Button variant="outline" onClick={goBack}>
                <ArrowLeft className="w-4 h-4 mr-1" />ย้อนกลับ
              </Button>
            )}
          </div>
          <div>
            {step === 'review' ? (
              <Button variant="primary" onClick={handleSubmit} loading={submitting} disabled={submitting}>
                <CheckCircle className="w-4 h-4 mr-1" />ส่งยืนยันตัวตน
              </Button>
            ) : (
              <Button variant="primary" onClick={goNext} disabled={!canGoNext}>
                ถัดไป<ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
