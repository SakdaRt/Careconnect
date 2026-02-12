import { Link } from 'react-router-dom';
import { Heart, Shield, Clock, Users, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui';

export default function LandingPage() {
  const features = [
    {
      icon: <Shield className="w-8 h-8" />,
      title: 'ความปลอดภัยที่เชื่อถือได้',
      description: 'ระบบ Trust Level และ KYC ตรวจสอบผู้ดูแลทุกคน เพื่อความปลอดภัยของคุณและคนที่คุณรัก',
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: 'จับคู่อัจฉริยะ',
      description: 'ระบบจับคู่ผู้ดูแลที่เหมาะสมตามความต้องการ ประสบการณ์ และระยะทาง',
    },
    {
      icon: <Clock className="w-8 h-8" />,
      title: 'ยืดหยุ่น ตรงเวลา',
      description: 'เลือกเวลาและรูปแบบการดูแลได้ตามต้องการ พร้อมระบบติดตามเวลาแบบเรียลไทม์',
    },
    {
      icon: <Heart className="w-8 h-8" />,
      title: 'การเงินโปร่งใส',
      description: 'ระบบกระเป๋าเงินที่ปลอดภัย ธุรกรรมโปร่งใส จ่ายเงินหลังบริการเสร็จสิ้น',
    },
  ];

  const howItWorks = [
    {
      step: '1',
      title: 'สมัครสมาชิก',
      description: 'เลือกเป็นผู้ว่าจ้างหรือผู้ดูแล สมัครง่ายด้วยอีเมลหรือเบอร์โทร',
    },
    {
      step: '2',
      title: 'ตั้งค่าโปรไฟล์',
      description: 'กรอกข้อมูลและความต้องการ ยิ่งละเอียดยิ่งจับคู่ได้ดี',
    },
    {
      step: '3',
      title: 'เริ่มใช้งาน',
      description: 'สร้างงานหรือรับงาน แชทตกลงรายละเอียด และเริ่มการดูแล',
    },
    {
      step: '4',
      title: 'การันตีคุณภาพ',
      description: 'ระบบติดตาม GPS และหลักฐานการทำงาน ปลอดภัยทุกขั้นตอน',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header/Navbar */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center">
              <Heart className="w-8 h-8 text-blue-600 mr-2" />
              <span className="text-2xl font-bold text-blue-600">Careconnect</span>
            </Link>

            <nav className="hidden md:flex gap-8">
              <Link to="/about" className="text-gray-700 hover:text-blue-600 transition-colors">
                เกี่ยวกับเรา
              </Link>
              <Link to="/faq" className="text-gray-700 hover:text-blue-600 transition-colors">
                คำถามที่พบบ่อย
              </Link>
              <Link to="/contact" className="text-gray-700 hover:text-blue-600 transition-colors">
                ติดต่อเรา
              </Link>
            </nav>

            <div className="flex gap-3">
              <Link to="/login">
                <Button variant="ghost">เข้าสู่ระบบ</Button>
              </Link>
              <Link to="/register">
                <Button variant="primary">สมัครสมาชิก</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold leading-tight md:leading-tight text-gray-900 mb-6">
            แพลตฟอร์มจับคู่ผู้ดูแล
            <br />
            <span className="text-blue-600">ที่คุณเชื่อถือได้</span>
          </h1>

          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            เชื่อมต่อผู้ว่าจ้างกับผู้ดูแลมืออาชีพ
            <br />
            ด้วยระบบความปลอดภัยระดับสูง การเงินโปร่งใส และการันตีคุณภาพ
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button variant="primary" size="lg" rightIcon={<ArrowRight className="w-5 h-5" />}>
                เริ่มต้นใช้งาน
              </Button>
            </Link>
            <Link to="/about">
              <Button variant="outline" size="lg">
                เรียนรู้เพิ่มเติม
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 mt-16 max-w-3xl mx-auto">
            <div>
              <p className="text-4xl font-bold text-blue-600">500+</p>
              <p className="text-gray-600 mt-2">ผู้ดูแลมืออาชีพ</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-blue-600">1,000+</p>
              <p className="text-gray-600 mt-2">งานสำเร็จ</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-blue-600">4.8/5</p>
              <p className="text-gray-600 mt-2">คะแนนความพึงพอใจ</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              ทำไมต้องเลือก Careconnect
            </h2>
            <p className="text-xl text-gray-600">
              เราให้ความสำคัญกับความปลอดภัยและคุณภาพในทุกขั้นตอน
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-blue-50 rounded-lg p-6 text-center hover:shadow-lg transition-shadow"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 text-white rounded-full mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">วิธีการใช้งาน</h2>
            <p className="text-xl text-gray-600">เริ่มต้นใช้งานได้ง่ายๆ ใน 4 ขั้นตอน</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((item, index) => (
              <div key={index} className="relative">
                <div className="bg-white rounded-lg p-6 shadow-md h-full">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-4">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-600">{item.description}</p>
                </div>

                {/* Arrow (hidden on last item) */}
                {index < howItWorks.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                    <ArrowRight className="w-8 h-8 text-blue-300" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link to="/register">
              <Button variant="primary" size="lg" rightIcon={<ArrowRight className="w-5 h-5" />}>
                เริ่มต้นเลยวันนี้
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-blue-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">พร้อมเริ่มต้นแล้วหรือยัง?</h2>
          <p className="text-xl mb-8 opacity-90">
            สมัครวันนี้และเริ่มใช้งานได้ทันที ไม่มีค่าใช้จ่ายในการสมัคร
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button
                variant="secondary"
                size="lg"
              >
                สมัครเป็นผู้ว่าจ้าง
              </Button>
            </Link>
            <Link to="/register">
              <Button
                variant="outline"
                size="lg"
                className="bg-white border-white text-blue-700 hover:bg-blue-50 hover:text-blue-800"
              >
                สมัครเป็นผู้ดูแล
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center mb-4">
                <Heart className="w-6 h-6 text-blue-500 mr-2" />
                <span className="text-xl font-bold text-white">Careconnect</span>
              </div>
              <p className="text-sm">แพลตฟอร์มจับคู่ผู้ดูแลที่คุณเชื่อถือได้</p>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-4">เกี่ยวกับเรา</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/about" className="hover:text-white transition-colors">
                    เกี่ยวกับ Careconnect
                  </Link>
                </li>
                <li>
                  <Link to="/faq" className="hover:text-white transition-colors">
                    คำถามที่พบบ่อย
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="hover:text-white transition-colors">
                    ติดต่อเรา
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-4">สำหรับผู้ใช้</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/register" className="hover:text-white transition-colors">
                    สมัครสมาชิก
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="hover:text-white transition-colors">
                    เข้าสู่ระบบ
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-4">ติดตามเรา</h3>
              <p className="text-sm mb-2">อีเมล: support@careconnect.com</p>
              <p className="text-sm">โทร: 02-XXX-XXXX</p>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>© 2026 Careconnect. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
