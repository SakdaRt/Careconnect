import { Link } from 'react-router-dom';
import { Heart, Mail, Phone, MapPin, Clock } from 'lucide-react';
import { Button, Input } from '../../components/ui';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock submission
    toast.success('ข้อความของคุณถูกส่งเรียบร้อยแล้ว เราจะติดต่อกลับโดยเร็วที่สุด');
    setFormData({ name: '', email: '', subject: '', message: '' });
  };

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
      <section className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-4">ติดต่อเรา</h1>
          <p className="text-xl opacity-90">
            มีคำถามหรือข้อสงสัย? เราพร้อมให้บริการคุณตลอด 24 ชั่วโมง
          </p>
        </div>
      </section>

      {/* Contact Info & Form */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Information */}
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-8">ช่องทางติดต่อ</h2>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">อีเมล</h3>
                    <p className="text-gray-600">support@careconnect.com</p>
                    <p className="text-sm text-gray-500 mt-1">
                      ตอบกลับภายใน 24 ชั่วโมง
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Phone className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">โทรศัพท์</h3>
                    <p className="text-gray-600">02-XXX-XXXX</p>
                    <p className="text-gray-600">080-XXX-XXXX (มือถือ)</p>
                    <p className="text-sm text-gray-500 mt-1">
                      จันทร์-ศุกร์ 9:00-18:00 น.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">สำนักงาน</h3>
                    <p className="text-gray-600">
                      123 ถนนสุขุมวิท แขวงคลองเตย
                      <br />
                      เขตคลองเตย กรุงเทพฯ 10110
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">เวลาทำการ</h3>
                    <p className="text-gray-600">จันทร์-ศุกร์: 9:00-18:00 น.</p>
                    <p className="text-gray-600">เสาร์-อาทิตย์: 10:00-16:00 น.</p>
                    <p className="text-sm text-gray-500 mt-1">
                      (ระบบออนไลน์ให้บริการ 24/7)
                    </p>
                  </div>
                </div>
              </div>

              {/* Social Media (Mock) */}
              <div className="mt-8">
                <h3 className="font-semibold text-gray-900 mb-4">ติดตามเราได้ที่</h3>
                <div className="flex gap-4">
                  <button className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors">
                    F
                  </button>
                  <button className="w-10 h-10 bg-blue-400 text-white rounded-full flex items-center justify-center hover:bg-blue-500 transition-colors">
                    T
                  </button>
                  <button className="w-10 h-10 bg-pink-600 text-white rounded-full flex items-center justify-center hover:bg-pink-700 transition-colors">
                    IG
                  </button>
                  <button className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center hover:bg-green-600 transition-colors">
                    L
                  </button>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div>
              <div className="bg-white rounded-lg shadow-md p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">ส่งข้อความถึงเรา</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    label="ชื่อ-นามสกุล"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="กรอกชื่อ-นามสกุล"
                    required
                  />

                  <Input
                    label="อีเมล"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="your@email.com"
                    required
                  />

                  <Input
                    label="หัวข้อ"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="หัวข้อที่ต้องการสอบถาม"
                    required
                  />

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      ข้อความ <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="รายละเอียดที่ต้องการสอบถาม"
                      rows={6}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>

                  <Button type="submit" variant="primary" size="lg" fullWidth>
                    ส่งข้อความ
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-blue-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            ลองเช็คคำถามที่พบบ่อยดูก่อนไหม?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            คำตอบสำหรับคำถามส่วนใหญ่อาจอยู่ในหน้า FAQ แล้ว
          </p>
          <Link to="/faq">
            <Button variant="primary" size="lg">
              ดูคำถามที่พบบ่อย
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
