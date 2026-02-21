import { Link, useNavigate } from 'react-router-dom';
import { Bell, User, Settings, LogOut, Menu, ShieldCheck, Wallet, Users, ArrowLeftRight } from 'lucide-react';
import { useAuth } from '../../contexts';
import { useCallback, useEffect, useRef, useState, KeyboardEvent } from 'react';
import toast from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';
import { api, AppNotification } from '../../services/api';
import { appApi } from '../../services/appApi';
import { getScopedStorageItem, setScopedStorageItem } from '../../utils/authStorage';

const UNREAD_POLL_INTERVAL_MS = 60_000;

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return "***";
  return "***" + phone.slice(-4);
}

function trustLevelStyle(level: string) {
  switch (level) {
    case "L3":
      return {
        bg: "bg-emerald-100",
        text: "text-emerald-800",
        label: "L3 เชื่อถือสูง",
      };
    case "L2":
      return {
        bg: "bg-blue-100",
        text: "text-blue-800",
        label: "L2 ยืนยันแล้ว",
      };
    case "L1":
      return {
        bg: "bg-yellow-100",
        text: "text-yellow-800",
        label: "L1 พื้นฐาน",
      };
    default:
      return {
        bg: "bg-gray-100",
        text: "text-gray-600",
        label: "L0 ยังไม่ยืนยัน",
      };
  }
}

export function TopBar() {
  const { user, logout, activeRole, setActiveRole, updateUser } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const seenRealtimeNotificationIds = useRef<Set<string>>(new Set());

  const fetchUnread = useCallback(async () => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await api.getUnreadNotificationCount();
      if (res.success && res.data) setUnreadCount(res.data.count ?? 0);
    } catch {
      /* ignore */
    }
  }, [user?.id]);

  useEffect(() => {
    fetchUnread();
    const interval = window.setInterval(fetchUnread, UNREAD_POLL_INTERVAL_MS);

    const handleFocus = () => {
      fetchUnread();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchUnread();
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchUnread]);

  useEffect(() => {
    if (!user?.id) return;

    const token = getScopedStorageItem('careconnect_token');
    if (!token) return;

    const env = (import.meta as any).env as Record<string, string | undefined>;
    const socketUrl = env.VITE_SOCKET_URL || window.location.origin;

    const socket: Socket = io(socketUrl, {
      transports: ['websocket'],
      auth: { token },
    });

    const onNotification = (payload: { notification?: AppNotification }) => {
      const notification = payload?.notification;
      if (!notification?.id) {
        fetchUnread();
        return;
      }

      if (seenRealtimeNotificationIds.current.has(notification.id)) {
        return;
      }

      seenRealtimeNotificationIds.current.add(notification.id);
      if (seenRealtimeNotificationIds.current.size > 200) {
        seenRealtimeNotificationIds.current = new Set([notification.id]);
      }

      if (notification.status !== 'read') {
        setUnreadCount((count) => count + 1);
      }

      // Keep badge authoritative with backend count in case any event was missed.
      fetchUnread();

      const message = notification.body
        ? `${notification.title}: ${notification.body}`
        : notification.title;
      toast(message, { icon: '🔔' });
    };

    socket.on('notification:new', onNotification);

    return () => {
      socket.off('notification:new', onNotification);
      socket.disconnect();
    };
  }, [fetchUnread, user?.id]);

  if (!user) return null;

  const resolvedRole = user.role === 'admin' ? 'admin' : (activeRole || user.role);
  const homePath = resolvedRole === 'caregiver' ? '/caregiver/jobs/feed' : resolvedRole === 'admin' ? '/admin/dashboard' : '/hirer/home';
  const canSwitchRole = resolvedRole !== 'admin' && user.account_type !== 'guest' && user.is_phone_verified;
  const targetRole = resolvedRole === 'hirer' ? 'caregiver' : 'hirer';
  const targetRoleLabel = targetRole === 'hirer' ? 'ผู้ว่าจ้าง' : 'ผู้ดูแล';

  const handleSwitchRole = async () => {
    if (switchingRole) return;
    setSwitchingRole(true);
    try {
      const res = await appApi.updateRole(targetRole);
      if (!res.success) {
        toast.error(res.error || 'ไม่สามารถเปลี่ยนบทบาทได้');
        return;
      }
      if (res.data?.user) updateUser(res.data.user);
      setActiveRole(targetRole);
      setScopedStorageItem('careconnect_active_role', targetRole);
      setShowMenu(false);
      const dest = targetRole === 'caregiver' ? '/caregiver/jobs/feed' : '/hirer/home';
      navigate(dest, { replace: true });
      toast.success(`เปลี่ยนเป็น${targetRoleLabel}แล้ว`);
    } catch {
      toast.error('ไม่สามารถเปลี่ยนบทบาทได้');
    } finally {
      setSwitchingRole(false);
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
      {/* Skip Navigation Link — a11y: ข้ามไปเนื้อหาหลักสำหรับผู้ใช้ keyboard */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold"
      >
        ข้ามไปเนื้อหาหลัก
      </a>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to={homePath} className="flex items-center">
            <span className="text-xl font-bold text-blue-600">Careconnect</span>
          </Link>

          {/* Right side - Notifications and Menu */}
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <Link
              to="/notifications"
              aria-label={`การแจ้งเตือน${unreadCount > 0 ? ` (${unreadCount} ยังไม่อ่าน)` : ''}`}
              className="relative p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Bell className="w-6 h-6" aria-hidden="true" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-semibold">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>

            {/* Menu Button */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                aria-label="เมนูผู้ใช้"
                aria-expanded={showMenu}
                aria-haspopup="true"
                className="flex items-center gap-2 p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              >
                <Menu className="w-6 h-6" aria-hidden="true" />
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
                  <div
                    className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
                    role="menu"
                    aria-label="เมนูผู้ใช้"
                    onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Escape') setShowMenu(false); }}
                  >
                    {/* User Info */}
                    <div className="px-4 py-3 border-b border-gray-200">
                      <p className="text-sm font-semibold text-gray-900">
                        {user.name || "ผู้ใช้"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {user.email
                          ? maskEmail(user.email)
                          : user.phone_number
                            ? maskPhone(user.phone_number)
                            : ""}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {resolvedRole === "hirer"
                            ? "ผู้ว่าจ้าง"
                            : resolvedRole === "caregiver"
                              ? "ผู้ดูแล"
                              : "แอดมิน"}
                        </span>
                        {(() => {
                          const tl = trustLevelStyle(user.trust_level || "L0");
                          return (
                            <span
                              className={`text-xs ${tl.bg} ${tl.text} px-2 py-1 rounded`}
                            >
                              {tl.label}
                            </span>
                          );
                        })()}
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

                    {resolvedRole === 'hirer' && (
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

                    {resolvedRole === 'caregiver' && (
                      <Link
                        to="/caregiver/wallet"
                        className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setShowMenu(false)}
                      >
                        <Wallet className="w-5 h-5" />
                        <span>กระเป๋าเงิน</span>
                      </Link>
                    )}

                    {resolvedRole !== 'admin' && (
                      <Link
                        to="/kyc"
                        className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => setShowMenu(false)}
                      >
                        <ShieldCheck className="w-5 h-5" />
                        <div className="flex items-center gap-2">
                          <span>ยืนยันตัวตน</span>
                          {["L0", "L1"].includes(user.trust_level || "L0") && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                              แนะนำ
                            </span>
                          )}
                        </div>
                      </Link>
                    )}

                    {canSwitchRole && (
                      <button
                        onClick={handleSwitchRole}
                        disabled={switchingRole}
                        className="w-full flex items-center gap-3 px-4 py-3 text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-50 focus:outline-none focus:bg-blue-50"
                      >
                        <ArrowLeftRight className="w-5 h-5" />
                        <span>{switchingRole ? 'กำลังเปลี่ยน...' : `เปลี่ยนเป็น${targetRoleLabel}`}</span>
                      </button>
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
