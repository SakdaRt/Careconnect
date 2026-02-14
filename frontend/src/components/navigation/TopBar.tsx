import { Link } from 'react-router-dom';
import { Bell, User, Settings, LogOut, Menu, ShieldCheck, Wallet, Users } from 'lucide-react';
import { useAuth } from '../../contexts';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return '***';
  return '***' + phone.slice(-4);
}

function trustLevelStyle(level: string) {
  switch (level) {
    case 'L3': return { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'L3 เชื่อถือสูง' };
    case 'L2': return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'L2 ยืนยันแล้ว' };
    case 'L1': return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'L1 พื้นฐาน' };
    default: return { bg: 'bg-gray-100', text: 'text-gray-600', label: 'L0 ยังไม่ยืนยัน' };
  }
}

export function TopBar() {
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = useCallback(async () => {
    if (!user) { setUnreadCount(0); return; }
    try {
      const res = await api.getUnreadNotificationCount();
      if (res.success && res.data) setUnreadCount(res.data.count ?? 0);
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  if (!user) return null;

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <span className="text-xl font-bold text-blue-600">Careconnect</span>
          </Link>

          {/* Right side - Notifications and Menu */}
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <Link
              to="/notifications"
              className="relative p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Bell className="w-6 h-6" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-semibold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            {/* Menu Button */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-2 p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>

              {/* Dropdown Menu */}
              {showMenu && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMenu(false)}
                  />

                  {/* Menu */}
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                    {/* User Info */}
                    <div className="px-4 py-3 border-b border-gray-200">
                      <p className="text-sm font-semibold text-gray-900">{user.name || 'ผู้ใช้'}</p>
                      <p className="text-xs text-gray-500">{user.email ? maskEmail(user.email) : user.phone_number ? maskPhone(user.phone_number) : ''}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {user.role === 'hirer' ? 'ผู้ว่าจ้าง' : user.role === 'caregiver' ? 'ผู้ดูแล' : 'แอดมิน'}
                        </span>
                        {(() => { const tl = trustLevelStyle(user.trust_level || 'L0'); return (
                          <span className={`text-xs ${tl.bg} ${tl.text} px-2 py-1 rounded`}>{tl.label}</span>
                        ); })()}
                      </div>
                    </div>

                    {/* Menu Items */}
                    <Link
                      to="/profile"
                      className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => setShowMenu(false)}
                    >
                      <User className="w-5 h-5" />
                      <span>โปรไฟล์</span>
                    </Link>

                    {user.role === 'hirer' && (
                      <>
                        <Link
                          to="/hirer/care-recipients"
                          className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
                          onClick={() => setShowMenu(false)}
                        >
                          <Users className="w-5 h-5" />
                          <span>ผู้รับการดูแล</span>
                        </Link>
                        <Link
                          to="/hirer/wallet"
                          className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
                          onClick={() => setShowMenu(false)}
                        >
                          <Wallet className="w-5 h-5" />
                          <span>กระเป๋าเงิน</span>
                        </Link>
                      </>
                    )}

                    {user.role === 'caregiver' && (
                      <Link
                        to="/caregiver/wallet"
                        className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setShowMenu(false)}
                      >
                        <Wallet className="w-5 h-5" />
                        <span>กระเป๋าเงิน</span>
                      </Link>
                    )}

                    {user.role !== 'admin' && (
                      <Link
                        to="/kyc"
                        className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setShowMenu(false)}
                      >
                        <ShieldCheck className="w-5 h-5" />
                        <div className="flex items-center gap-2">
                          <span>ยืนยันตัวตน</span>
                          {(['L0', 'L1'].includes(user.trust_level || 'L0')) && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">แนะนำ</span>
                          )}
                        </div>
                      </Link>
                    )}

                    <Link
                      to="/settings"
                      className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => setShowMenu(false)}
                    >
                      <Settings className="w-5 h-5" />
                      <span>ตั้งค่า / ช่วยเหลือ</span>
                    </Link>

                    <div className="border-t border-gray-200 my-2"></div>

                    <button
                      onClick={() => {
                        setShowMenu(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-5 h-5" />
                      <span>ออกจากระบบ</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
