import { Link } from 'react-router-dom';
import { Heart, Shield, Users, Target, CheckCircle } from 'lucide-react';
import { Button } from '../../components/ui';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center">
              <Heart className="w-8 h-8 text-blue-600 mr-2" />
              <span className="text-2xl font-bold text-blue-600">Careconnect</span>
            </Link>
            <Link to="/">
              <Button variant="ghost">กลับหน้าแรก</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6">เกี่ยวกับ Careconnect</h1>
          <p className="text-xl opacity-90">
            แพลตฟอร์มที่เชื่อมต่อผู้ว่าจ้างกับผู้ดูแลมืออาชีพ
            <br />
            ด้วยความปลอดภัย โปร่งใส และเชื่อถือได้
          </p>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12">
            <div className="bg-white rounded-lg p-8 shadow-md">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                <Target className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">พันธกิจ</h2>
              <p className="text-gray-600 text-lg leading-relaxed">
                สร้างแพลตฟอร์มที่เชื่อมโยงผู้ต้องการความช่วยเหลือในการดูแลผู้สูงอายุ
                กับผู้ดูแลมืออาชีพที่ผ่านการตรวจสอบ ด้วยระบบที่โปร่งใส ปลอดภัย
                และเป็นธรรมสำหรับทุกฝ่าย
              </p>
            </div>

            <div className="bg-white rounded-lg p-8 shadow-md">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <Heart className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">วิสัยทัศน์</h2>
              <p className="text-gray-600 text-lg leading-relaxed">
                เป็นแพลตฟอร์มอันดับหนึ่งในการจับคู่ผู้ดูแลผู้สูงอายุในประเทศไทย
                ที่ทุกครอบครัวเชื่อใจและเลือกใช้ เพื่อมอบการดูแลที่มีคุณภาพ
                และความอบอุ่นให้กับคนที่พวกเขารัก
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">ค่านิยมหลัก</h2>
            <p className="text-xl text-gray-600">หลักการที่เรายึดถือในการให้บริการ</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-3">ความปลอดภัย</h3>
              <p className="text-gray-600">
                ตรวจสอบประวัติและคุณสมบัติของผู้ดูแลทุกคนอย่างเข้มงวด
                พร้อมระบบติดตามและการันตีคุณภาพการบริการ
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-3">ความโปร่งใส</h3>
              <p className="text-gray-600">
                ระบบการเงินที่โปร่งใส ตรวจสอบได้ทุกธุรกรรม
                พร้อมรีวิวและคะแนนจากผู้ใช้งานจริง
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-10 h-10 text-purple-600" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-3">ความเป็นธรรม</h3>
              <p className="text-gray-600">
                สร้างสภาพแวดล้อมที่เป็นธรรมทั้งผู้ว่าจ้างและผู้ดูแล
                ด้วยค่าตอบแทนที่เหมาะสมและระบบที่เป็นกลาง
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How We Work */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">วิธีการทำงาน</h2>
            <p className="text-xl text-gray-600">
              เราใช้เทคโนโลยีและกระบวนการตรวจสอบที่เข้มงวดเพื่อความปลอดภัย
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg p-6 shadow-md">
              <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-blue-600" />
                การตรวจสอบผู้ดูแล
              </h3>
              <ul className="space-y-2 text-gray-600">
                <li>• ตรวจสอบประวัติและเอกสารยืนยันตัวตน (KYC)</li>
                <li>• ตรวจสอบประสบการณ์และใบรับรองการทำงาน</li>
                <li>• ระบบ Trust Level 4 ระดับ (L0-L3)</li>
                <li>• รีวิวและคะแนนจากผู้ใช้งานจริง</li>
              </ul>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-md">
              <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-blue-600" />
                การติดตามคุณภาพ
              </h3>
              <ul className="space-y-2 text-gray-600">
                <li>• ติดตาม GPS ตลอดเวลาทำงาน</li>
                <li>• ต้องถ่ายรูปหลักฐานก่อน-หลังทำงาน</li>
                <li>• สุ่มตรวจคุณภาพ 10% ของงาน</li>
                <li>• ระบบแจ้งเตือนและข้อพิพาท</li>
              </ul>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-md">
              <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-blue-600" />
                ระบบการเงิน
              </h3>
              <ul className="space-y-2 text-gray-600">
                <li>• กระเป๋าเงินแยกสำหรับแต่ละฝ่าย</li>
                <li>• กันเงินก่อนเริ่มงาน (Escrow)</li>
                <li>• จ่ายเงินหลังงานเสร็จสมบูรณ์</li>
                <li>• ถอนเงินผ่านระบบที่ปลอดภัย</li>
              </ul>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-md">
              <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-blue-600" />
                การสื่อสาร
              </h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Chat-centric Job Room สำหรับแต่ละงาน</li>
                <li>• เจรจาต่อรองรายละเอียดผ่านแชท</li>
                <li>• ประวัติการสนทนาเก็บไว้เพื่อความปลอดภัย</li>
                <li>• ระบบแจ้งเตือนแบบเรียลไทม์</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-blue-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">พร้อมเริ่มต้นใช้งานแล้วหรือยัง?</h2>
          <p className="text-xl mb-8 opacity-90">
            เข้าร่วมกับเราวันนี้ เพื่อประสบการณ์การดูแลที่ดีกว่า
          </p>
          <Link to="/register">
            <Button variant="secondary" size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
              สมัครสมาชิก
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p>© 2026 Careconnect. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
