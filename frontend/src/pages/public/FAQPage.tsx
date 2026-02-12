import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Heart, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../../components/ui';

interface FAQ {
  question: string;
  answer: string;
  category: 'general' | 'hirer' | 'caregiver' | 'payment' | 'safety';
}

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const faqs: FAQ[] = [
    // General
    {
      category: 'general',
      question: 'Careconnect คืออะไร?',
      answer:
        'Careconnect คือแพลตฟอร์มจับคู่ผู้ว่าจ้างกับผู้ดูแลผู้สูงอายุมืออาชีพ ที่เน้นความปลอดภัย โปร่งใส และเชื่อถือได้ ด้วยระบบตรวจสอบคุณภาพและการันตีการทำงาน',
    },
    {
      category: 'general',
      question: 'มีค่าใช้จ่ายในการสมัครหรือไม่?',
      answer:
        'การสมัครสมาชิกไม่มีค่าใช้จ่าย สามารถสมัครและใช้งานฟรี ระบบจะหักค่าบริการเฉพาะเมื่อมีการทำงานสำเร็จเท่านั้น',
    },
    {
      category: 'general',
      question: 'ต่างระหว่าง Guest และ Member อย่างไร?',
      answer:
        'Guest สมัครด้วยอีเมล ใช้สำรวจระบบได้ แต่ไม่สามารถสร้างหรือรับงานได้ Member สมัครด้วยเบอร์โทรและยืนยัน OTP สามารถใช้งานเต็มรูปแบบได้ตาม Trust Level',
    },

    // Hirer
    {
      category: 'hirer',
      question: 'ฉันจะหาผู้ดูแลได้อย่างไร?',
      answer:
        'เพียงสร้างงานและระบุรายละเอียดความต้องการ ระบบจะจับคู่ผู้ดูแลที่เหมาะสมให้ หรือผู้ดูแลสามารถมาสนใจงานของคุณได้เอง คุณสามารถแชทและเจรจารายละเอียดก่อนตัดสินใจ',
    },
    {
      category: 'hirer',
      question: 'จะรู้ได้อย่างไรว่าผู้ดูแลน่าเชื่อถือ?',
      answer:
        'ระบบมี Trust Level 4 ระดับ (L0-L3) ที่แสดงความน่าเชื่อถือของผู้ดูแล รวมถึงประวัติการทำงาน รีวิวจากผู้ใช้งานอื่น และการตรวจสอบ KYC ยิ่ง Trust Level สูง ยิ่งน่าเชื่อถือมากขึ้น',
    },
    {
      category: 'hirer',
      question: 'ถ้างานมีปัญหา ฉันต้องทำอย่างไร?',
      answer:
        'คุณสามารถแจ้งปัญหาผ่านระบบแชทหรือเปิด Dispute ได้ทันที ทีมงานจะเข้ามาช่วยไกล่เกลี่ยและแก้ไขปัญหา พร้อมข้อมูลประกอบจาก GPS และรูปภาพหลักฐาน',
    },

    // Caregiver
    {
      category: 'caregiver',
      question: 'ฉันต้องมีคุณสมบัติอะไรบ้าง?',
      answer:
        'ต้องมีอายุ 18 ปีขึ้นไป มีประสบการณ์หรือความสามารถในการดูแลผู้สูงอายุ และผ่านการตรวจสอบ KYC สำหรับงาน High Risk จะต้องมี Trust Level L2 ขึ้นไป',
    },
    {
      category: 'caregiver',
      question: 'ฉันจะเพิ่ม Trust Level ได้อย่างไร?',
      answer:
        'L0→L1: ยืนยันอีเมล/เบอร์โทร และกรอกโปรไฟล์ให้ครบ | L1→L2: ผ่านการตรวจสอบ KYC และทำงานสำเร็จอย่างน้อย 3 งาน | L2→L3: มี Trust Score สูงจากการทำงานที่มีคุณภาพและรีวิวดี',
    },
    {
      category: 'caregiver',
      question: 'ฉันจะรับเงินเมื่อไหร่?',
      answer:
        'เงินจะถูกจ่ายทันทีหลังจากงานเสร็จสมบูรณ์และคุณเช็คเอาต์สำเร็จ (พร้อมหลักฐาน GPS และรูปภาพ) เงินจะเข้ากระเป๋าเงินของคุณทันที และสามารถขอถอนได้เมื่อ Trust Level ถึง L3',
    },

    // Payment
    {
      category: 'payment',
      question: 'ระบบการเงินทำงานอย่างไร?',
      answer:
        'ผู้ว่าจ้างต้องเติมเงินเข้ากระเป๋าเงินก่อน เมื่อยอมรับข้อเสนอ เงินจะถูกกันไว้ (Escrow) หลังงานเสร็จ เงินจะถูกโอนให้ผู้ดูแลทันที ระบบ Ledger จะบันทึกธุรกรรมทุกรายการแบบ immutable',
    },
    {
      category: 'payment',
      question: 'ค่าบริการคิดอย่างไร?',
      answer:
        'ระบบหักค่าบริการเล็กน้อยจากแต่ละธุรกรรมที่สำเร็จ โดยแบ่งภาระระหว่างผู้ว่าจ้างและผู้ดูแล รายละเอียดค่าบริการจะแสดงชัดเจนก่อนยืนยันทุกครั้ง',
    },
    {
      category: 'payment',
      question: 'การถอนเงินต้องทำอย่างไร?',
      answer:
        'ผู้ดูแลที่มี Trust Level L3 สามารถขอถอนเงินได้โดยเพิ่มบัญชีธนาคาร ทีมงานจะตรวจสอบและโอนเงินภายใน 1-3 วันทำการ',
    },

    // Safety
    {
      category: 'safety',
      question: 'ระบบตรวจสอบคุณภาพอย่างไร?',
      answer:
        'ผู้ดูแลต้องเช็คอิน-เช็คเอาต์ด้วย GPS, ถ่ายรูปหลักฐานก่อน-หลังทำงาน, ระบบติดตาม GPS ทุก 15 นาที และสุ่มตรวจคุณภาพ 10% ของงานโดยทีม QA',
    },
    {
      category: 'safety',
      question: 'ข้อมูลส่วนตัวปลอดภัยไหม?',
      answer:
        'ข้อมูลทั้งหมดถูกเข้ารหัสและจัดเก็บอย่างปลอดภัย ข้อมูลผู้ป่วยจะถูกเปิดเผยเฉพาะผู้ดูแลที่รับงานเท่านั้น และจำกัดตาม Trust Level',
    },
    {
      category: 'safety',
      question: 'ถ้ามีเหตุฉุกเฉินต้องทำอย่างไร?',
      answer:
        'โทรหมายเลขฉุกเฉินทันที (191, 1669) และแจ้งผ่านระบบแชท ระบบจะบันทึกเหตุการณ์และแจ้งทีมงานทันที พร้อมข้อมูล GPS และประวัติการทำงาน',
    },
  ];

  const categories = [
    { value: 'all', label: 'ทั้งหมด' },
    { value: 'general', label: 'ทั่วไป' },
    { value: 'hirer', label: 'สำหรับผู้ว่าจ้าง' },
    { value: 'caregiver', label: 'สำหรับผู้ดูแล' },
    { value: 'payment', label: 'การเงิน' },
    { value: 'safety', label: 'ความปลอดภัย' },
  ];

  const filteredFaqs =
    selectedCategory === 'all' ? faqs : faqs.filter((faq) => faq.category === selectedCategory);

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
          <h1 className="text-5xl font-bold mb-4">คำถามที่พบบ่อย</h1>
          <p className="text-xl opacity-90">
            ค้นหาคำตอบสำหรับคำถามที่พบบ่อยเกี่ยวกับ Careconnect
          </p>
        </div>
      </section>

      {/* Category Filter */}
      <section className="py-8 px-4 sm:px-6 lg:px-8 bg-white border-b">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap gap-2 justify-center">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedCategory === cat.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ List */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-4">
            {filteredFaqs.map((faq, index) => (
              <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200">
                <button
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-gray-900 pr-4">{faq.question}</span>
                  {openIndex === index ? (
                    <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  )}
                </button>

                {openIndex === index && (
                  <div className="px-6 pb-4">
                    <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-blue-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            ยังหาคำตอบที่ต้องการไม่เจอ?
          </h2>
          <p className="text-xl text-gray-600 mb-8">ติดต่อทีมงานของเราได้ตลอด 24 ชั่วโมง</p>
          <Link to="/contact">
            <Button variant="primary" size="lg">
              ติดต่อเรา
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
