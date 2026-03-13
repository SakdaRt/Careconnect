import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { MainLayout } from '../../layouts';
import { Button, Card, Input, Select, Textarea } from '../../components/ui';
import { appApi } from '../../services/appApi';

const CATEGORIES = [
  { value: 'inappropriate_name', label: 'ชื่อไม่เหมาะสม' },
  { value: 'inappropriate_photo', label: 'รูปภาพไม่เหมาะสม' },
  { value: 'inappropriate_chat', label: 'ข้อความ/แชทไม่เหมาะสม' },
  { value: 'scam_fraud', label: 'หลอกลวง/ฉ้อโกง' },
  { value: 'harassment', label: 'คุกคาม/ข่มขู่' },
  { value: 'safety_concern', label: 'ความปลอดภัย' },
  { value: 'payment_issue', label: 'ปัญหาการเงิน/ชำระเงิน' },
  { value: 'service_quality', label: 'คุณภาพบริการ' },
  { value: 'fake_certificate', label: 'ใบรับรองปลอม/เอกสารไม่น่าเชื่อถือ' },
  { value: 'other', label: 'อื่นๆ' },
];

export default function ComplaintFormPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (files.length + selected.length > 5) {
      toast.error('แนบไฟล์ได้สูงสุด 5 ไฟล์');
      return;
    }
    setFiles((prev) => [...prev, ...selected]);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!category) { toast.error('กรุณาเลือกประเภทเรื่อง'); return; }
    if (!subject.trim() || subject.trim().length < 2) { toast.error('กรุณากรอกหัวข้อเรื่อง'); return; }
    if (!description.trim() || description.trim().length < 10) { toast.error('กรุณากรอกรายละเอียดอย่างน้อย 10 ตัวอักษร'); return; }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('category', category);
      formData.append('subject', subject.trim());
      formData.append('description', description.trim());
      for (const file of files) {
        formData.append('attachments', file);
      }

      const res = await appApi.createComplaint(formData);
      if (!res.success) {
        toast.error(res.message || res.error || 'ส่งเรื่องร้องเรียนไม่สำเร็จ');
        return;
      }
      toast.success('ส่งเรื่องร้องเรียนสำเร็จ แอดมินจะตรวจสอบและติดต่อกลับ');
      navigate('/settings', { replace: true });
    } catch (error: any) {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">แจ้งเรื่องร้องเรียน</h1>
          <p className="text-sm text-gray-600">แจ้งปัญหาหรือร้องเรียนให้แอดมินตรวจสอบ</p>
        </div>

        <Card className="p-4 sm:p-6 space-y-4">
          <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-blue-900">
              เรื่องร้องเรียนจะถูกส่งให้แอดมินตรวจสอบ คุณสามารถแจ้งปัญหาทุกประเภทที่พบในระบบได้
              ไม่จำเป็นต้องเกี่ยวข้องกับงานที่จ้าง
            </p>
          </div>

          <Select
            label="ประเภทเรื่อง"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">— เลือกประเภท —</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>

          <Input
            label="หัวข้อเรื่อง"
            placeholder="เช่น พบชื่อผู้ใช้ไม่เหมาะสม"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />

          <Textarea
            label="รายละเอียด"
            placeholder="อธิบายปัญหาที่พบอย่างละเอียด เช่น ชื่อผู้ใช้ที่พบ, สิ่งที่เกิดขึ้น, วันเวลาโดยประมาณ"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            required
          />

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              แนบหลักฐาน (ไม่บังคับ — สูงสุด 5 ไฟล์)
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {files.map((file, i) => (
                <div key={i} className="flex items-center gap-1 bg-gray-100 rounded px-2 py-1 text-xs text-gray-700">
                  <span className="max-w-[150px] truncate">{file.name}</span>
                  <button onClick={() => removeFile(i)} className="text-gray-500 hover:text-red-500" aria-label={`ลบไฟล์ ${file.name}`}>
                    <X className="w-3 h-3" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
            {files.length < 5 && (
              <label className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                <Upload className="w-4 h-4" aria-hidden="true" />
                <span>เลือกไฟล์</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
            <p className="text-xs text-gray-500 mt-1">รองรับ JPG, PNG, GIF, WebP, PDF (ไม่เกิน 10MB ต่อไฟล์)</p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="primary" fullWidth loading={loading} onClick={handleSubmit}>
              ส่งเรื่องร้องเรียน
            </Button>
            <Button variant="outline" onClick={() => navigate(-1)}>
              ยกเลิก
            </Button>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
