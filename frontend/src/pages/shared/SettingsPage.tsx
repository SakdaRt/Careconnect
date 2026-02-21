import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { User, ShieldCheck, Bell, HelpCircle, LogOut, KeyRound, ArrowLeftRight } from 'lucide-react';
import { MainLayout } from '../../layouts';
import { Button, Card, Input } from '../../components/ui';
import { useAuth } from '../../contexts';
import { appApi } from '../../services/appApi';
import { setScopedStorageItem } from '../../utils/authStorage';

function trustLabel(level: string) {
  if (level === 'L3') return { label: 'L3 เชื่อถือสูง', cls: 'bg-emerald-100 text-emerald-800' };
  if (level === 'L2') return { label: 'L2 ยืนยันแล้ว', cls: 'bg-blue-100 text-blue-800' };
  if (level === 'L1') return { label: 'L1 พื้นฐาน', cls: 'bg-yellow-100 text-yellow-800' };
  return { label: 'L0 ยังไม่ยืนยัน', cls: 'bg-gray-100 text-gray-600' };
}

export default function SettingsPage() {
  const { user, logout, activeRole, setActiveRole, updateUser } = useAuth();
  const navigate = useNavigate();
  const [switchingRole, setSwitchingRole] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const resolvedRole = user?.role === 'admin' ? 'admin' : (activeRole || user?.role || 'hirer');
  const canSwitchRole = resolvedRole !== 'admin' && user?.account_type !== 'guest' && user?.is_phone_verified;
  const targetRole = resolvedRole === 'hirer' ? 'caregiver' : 'hirer';
  const targetRoleLabel = targetRole === 'hirer' ? 'ผู้ว่าจ้าง' : 'ผู้ดูแล';
  const tl = trustLabel(user?.trust_level || 'L0');

  const handleSwitchRole = async () => {
    if (switchingRole) return;
    setSwitchingRole(true);
    try {
      const res = await appApi.updateRole(targetRole);
      if (!res.success) { toast.error(res.error || 'ไม่สามารถเปลี่ยนบทบาทได้'); return; }
      if (res.data?.user) updateUser(res.data.user);
      setActiveRole(targetRole);
      setScopedStorageItem('careconnect_active_role', targetRole);
      const dest = targetRole === 'caregiver' ? '/caregiver/jobs/feed' : '/hirer/home';
      navigate(dest, { replace: true });
      toast.success(`เปลี่ยนเป็น${targetRoleLabel}แล้ว`);
    } catch { toast.error('ไม่สามารถเปลี่ยนบทบาทได้'); }
    finally { setSwitchingRole(false); }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) { toast.error('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร'); return; }
    if (newPassword !== confirmPassword) { toast.error('รหัสผ่านใหม่ไม่ตรงกัน'); return; }
    setChangingPassword(true);
    try {
      const res = await appApi.changePassword(currentPassword, newPassword);
      if (!res.success) { toast.error(res.error || 'เปลี่ยนรหัสผ่านไม่สำเร็จ'); return; }
      toast.success('เปลี่ยนรหัสผ่านสำเร็จ');
      setShowPasswordForm(false);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch { toast.error('เปลี่ยนรหัสผ่านไม่สำเร็จ'); }
    finally { setChangingPassword(false); }
  };

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ตั้งค่า</h1>
          <p className="text-sm text-gray-600">จัดการบัญชีและการตั้งค่าต่างๆ</p>
        </div>

        {/* Account Info */}
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <User className="w-5 h-5 text-gray-500" />
            <div className="text-sm font-semibold text-gray-900">ข้อมูลบัญชี</div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">ชื่อที่แสดง</span>
              <span className="text-gray-900 font-medium">{user?.name || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">บทบาทปัจจุบัน</span>
              <span className="text-gray-900 font-medium">{resolvedRole === 'hirer' ? 'ผู้ว่าจ้าง' : resolvedRole === 'caregiver' ? 'ผู้ดูแล' : 'แอดมิน'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">ประเภทบัญชี</span>
              <span className="text-gray-900 font-medium">{user?.account_type === 'guest' ? 'Guest (อีเมล)' : 'Member (เบอร์โทร)'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Trust Level</span>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${tl.cls}`}>{tl.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Trust Score</span>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, user?.trust_score ?? 0)}%` }} />
                </div>
                <span className="text-gray-900 font-medium text-xs">{user?.trust_score ?? 0}/100</span>
              </div>
            </div>
            {(user?.completed_jobs_count ?? 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">งานที่เสร็จสิ้น</span>
                <span className="text-gray-900 font-medium">{user?.completed_jobs_count} งาน</span>
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/profile"><Button variant="outline" size="sm">แก้ไขโปรไฟล์</Button></Link>
          </div>
        </Card>

        {/* Role Switching */}
        {canSwitchRole && (
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <ArrowLeftRight className="w-5 h-5 text-blue-500" />
              <div className="text-sm font-semibold text-gray-900">เปลี่ยนบทบาท</div>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              คุณสามารถสลับบทบาทระหว่างผู้ว่าจ้างและผู้ดูแลได้ บทบาทปัจจุบัน: <strong>{resolvedRole === 'hirer' ? 'ผู้ว่าจ้าง' : 'ผู้ดูแล'}</strong>
            </p>
            <Button variant="primary" size="sm" onClick={handleSwitchRole} loading={switchingRole}>
              เปลี่ยนเป็น{targetRoleLabel}
            </Button>
          </Card>
        )}

        {/* Security */}
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <KeyRound className="w-5 h-5 text-gray-500" />
            <div className="text-sm font-semibold text-gray-900">ความปลอดภัย</div>
          </div>
          {!showPasswordForm ? (
            <Button variant="outline" size="sm" onClick={() => setShowPasswordForm(true)}>เปลี่ยนรหัสผ่าน</Button>
          ) : (
            <div className="space-y-3">
              {user?.email && (
                <Input label="รหัสผ่านปัจจุบัน" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              )}
              <Input label="รหัสผ่านใหม่" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="อย่างน้อย 6 ตัวอักษร" />
              <Input label="ยืนยันรหัสผ่านใหม่" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={handleChangePassword} loading={changingPassword}>บันทึก</Button>
                <Button variant="outline" size="sm" onClick={() => { setShowPasswordForm(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}>ยกเลิก</Button>
              </div>
            </div>
          )}
        </Card>

        {/* KYC */}
        {resolvedRole !== 'admin' && (
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <ShieldCheck className="w-5 h-5 text-gray-500" />
              <div className="text-sm font-semibold text-gray-900">ยืนยันตัวตน (KYC)</div>
            </div>
            <p className="text-xs text-gray-600 mb-3">ยืนยันตัวตนเพื่อเพิ่ม Trust Level และเข้าถึงฟีเจอร์เพิ่มเติม</p>
            <Link to="/kyc"><Button variant="outline" size="sm">ยืนยันตัวตน</Button></Link>
          </Card>
        )}

        {/* Notifications */}
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Bell className="w-5 h-5 text-gray-500" />
            <div className="text-sm font-semibold text-gray-900">การแจ้งเตือน</div>
          </div>
          <Link to="/notifications"><Button variant="outline" size="sm">ดูการแจ้งเตือน</Button></Link>
        </Card>

        {/* Help */}
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <HelpCircle className="w-5 h-5 text-gray-500" />
            <div className="text-sm font-semibold text-gray-900">ช่วยเหลือ</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/faq"><Button variant="outline" size="sm">คำถามที่พบบ่อย</Button></Link>
            <Link to="/contact"><Button variant="outline" size="sm">ติดต่อเรา</Button></Link>
            <Link to="/about"><Button variant="outline" size="sm">เกี่ยวกับเรา</Button></Link>
          </div>
        </Card>

        {/* Logout */}
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <LogOut className="w-5 h-5 text-red-500" />
            <div className="text-sm font-semibold text-gray-900">ออกจากระบบ</div>
          </div>
          <Button variant="danger" size="sm" onClick={logout}>ออกจากระบบ</Button>
        </Card>
      </div>
    </MainLayout>
  );
}

