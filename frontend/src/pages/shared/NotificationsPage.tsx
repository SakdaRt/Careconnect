import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { MainLayout } from '../../layouts';
import { Button, Card } from '../../components/ui';
import { useAuth } from '../../contexts';
import { api, AppNotification } from '../../services/api';

type Filter = 'all' | 'unread';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('th-TH');
}

function getNotificationLink(n: AppNotification): string | null {
  if (n.reference_type === 'job' && n.reference_id) {
    return `/chat/${n.reference_id}`;
  }
  return null;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    setLoading(true);
    try {
      const res = await api.getNotifications(1, 50, filter === 'unread');
      if (res.success && res.data) {
        setItems(res.data.data || []);
        setUnreadCount(res.data.unreadCount ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [user, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleOpen = async (n: AppNotification) => {
    if (!user) return;
    if (n.status !== 'read') {
      await api.markNotificationAsRead(n.id);
      setItems((prev) => prev.map((item) => (item.id === n.id ? { ...item, status: 'read' } : item)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    const link = getNotificationLink(n);
    if (link) navigate(link);
  };

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsAsRead();
    setItems((prev) => prev.map((item) => ({ ...item, status: 'read' })));
    setUnreadCount(0);
  };

  return (
    <MainLayout showBottomBar={false}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">การแจ้งเตือน</h1>
            <p className="text-sm text-gray-600">ติดตามเหตุการณ์ล่าสุดของคุณ</p>
          </div>
          <div className="flex gap-2">
            <Link to={user?.role === 'hirer' ? '/hirer/home' : user?.role === 'caregiver' ? '/caregiver/jobs/feed' : '/'}>
              <Button variant="ghost">กลับ</Button>
            </Link>
          </div>
        </div>

        {!user ? (
          <Card className="p-6">
            <div className="text-sm text-gray-700">กรุณาเข้าสู่ระบบเพื่อดูการแจ้งเตือน</div>
          </Card>
        ) : (
          <>
            <Card className="p-4 mb-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-gray-700">ยังไม่อ่าน: {unreadCount}</div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
                      อ่านทั้งหมด
                    </Button>
                  )}
                  <Button variant={filter === 'all' ? 'primary' : 'outline'} size="sm" onClick={() => setFilter('all')}>
                    ทั้งหมด
                  </Button>
                  <Button
                    variant={filter === 'unread' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('unread')}
                  >
                    ยังไม่อ่าน
                  </Button>
                </div>
              </div>
            </Card>

            {loading ? (
              <Card className="p-8">
                <div className="text-center text-sm text-gray-500">กำลังโหลด...</div>
              </Card>
            ) : items.length === 0 ? (
              <Card className="p-8">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
                    <Bell className="w-7 h-7 text-blue-600" />
                  </div>
                  <div className="text-gray-900 font-semibold">ยังไม่มีการแจ้งเตือน</div>
                  <div className="text-sm text-gray-600">เมื่อมีความเคลื่อนไหว ระบบจะแจ้งให้ทราบที่นี่</div>
                </div>
              </Card>
            ) : (
              <div className="space-y-2">
                {items.map((n) => {
                  const isRead = n.status === 'read';
                  return (
                    <button
                      key={n.id}
                      className="w-full text-left"
                      onClick={() => handleOpen(n)}
                    >
                      <Card className={`p-4 hover:bg-gray-50 transition-colors ${isRead ? '' : 'border-blue-200 bg-blue-50/30'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900">{n.title}</div>
                            <div className="text-sm text-gray-700 mt-1">{n.body}</div>
                            <div className="text-xs text-gray-500 mt-2">{formatDate(n.created_at)}</div>
                          </div>
                          {!isRead && <div className="w-2 h-2 rounded-full bg-blue-600 mt-1" />}
                        </div>
                      </Card>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}

