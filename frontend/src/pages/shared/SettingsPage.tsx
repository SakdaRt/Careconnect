import { Link } from 'react-router-dom';
import { MainLayout } from '../../layouts';
import { Button, Card } from '../../components/ui';

export default function SettingsPage() {
  return (
    <MainLayout showBottomBar={false}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ตั้งค่า / ช่วยเหลือ</h1>
          <p className="text-sm text-gray-600">การตั้งค่าพื้นฐานและลิงก์ช่วยเหลือ</p>
        </div>

        <Card className="p-6">
          <div className="text-sm font-semibold text-gray-900 mb-3">ช่วยเหลือ</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Link to="/faq">
              <Button variant="outline">คำถามที่พบบ่อย</Button>
            </Link>
            <Link to="/contact">
              <Button variant="outline">ติดต่อเรา</Button>
            </Link>
            <Link to="/about">
              <Button variant="outline">เกี่ยวกับเรา</Button>
            </Link>
          </div>
        </Card>

        <Card className="p-6">
          <div className="text-sm font-semibold text-gray-900 mb-3">การแจ้งเตือน</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Link to="/notifications">
              <Button variant="primary">ไปที่การแจ้งเตือน</Button>
            </Link>
          </div>
        </Card>

        <Card className="p-6">
          <div className="text-sm font-semibold text-gray-900 mb-3">ยืนยันตัวตน</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Link to="/kyc">
              <Button variant="outline">ไปที่การยืนยันตัวตน (KYC)</Button>
            </Link>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}

