import { Link } from 'react-router-dom';
import { AdminLayout } from '../../layouts';
import { Card } from '../../components/ui';

export default function AdminDashboardPage() {
  const tiles = [
    { title: 'จัดการงาน', desc: 'ค้นหา/ดูสถานะ/ยกเลิกงาน', to: '/admin/jobs' },
    { title: 'จัดการผู้ใช้', desc: 'ค้นหา/ระงับ/ดู trust level', to: '/admin/users' },
    { title: 'การเงิน', desc: 'รายการถอนเงิน/ตรวจสอบธุรกรรม', to: '/admin/financial' },
    { title: 'ข้อพิพาท', desc: 'ดูรายการและสถานะการแก้ไข', to: '/admin/disputes' },
    { title: 'รายงาน', desc: 'สรุปภาพรวมและ export', to: '/admin/reports' },
    { title: 'ตั้งค่าระบบ', desc: 'ค่าพื้นฐาน/health check', to: '/admin/settings' },
  ];

  return (
    <AdminLayout>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to}>
            <Card className="p-6 hover:bg-gray-50 transition-colors">
              <div className="text-lg font-semibold text-gray-900">{t.title}</div>
              <div className="text-sm text-gray-600 mt-2">{t.desc}</div>
            </Card>
          </Link>
        ))}
      </div>
    </AdminLayout>
  );
}

