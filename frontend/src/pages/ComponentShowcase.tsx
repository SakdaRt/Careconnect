import { useState } from 'react';
import { Home, Mail, Wallet as WalletIcon, Plus } from 'lucide-react';
import { MainLayout } from '../layouts';
import {
  Button,
  Input,
  PasswordInput,
  OTPInput,
  PhoneInput,
  Card,
  JobCard,
  CareRecipientCard,
  WalletCard,
  Badge,
  StatusBadge,
  TrustLevelBadge,
  Avatar,
  Modal,
  ConfirmModal,
  Tabs,
  Spinner,
  LoadingState,
  Skeleton,
  JobCardSkeleton,
  CareRecipientCardSkeleton,
  EmptyState,
} from '../components/ui';
import { mockJobs, mockCareRecipients } from '../mocks';

export default function ComponentShowcase() {
  const [showModal, setShowModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [phoneValue, setPhoneValue] = useState('');

  return (
    <MainLayout showBottomBar={false}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Component Showcase</h1>

        <div className="space-y-12">
          {/* Buttons */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Buttons</h2>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="outline">Outline</Button>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button loading>Loading</Button>
                <Button disabled>Disabled</Button>
                <Button leftIcon={<Home className="w-4 h-4" />}>With Icon</Button>
                <Button rightIcon={<Plus className="w-4 h-4" />}>Add New</Button>
              </div>

              <Button fullWidth>Full Width Button</Button>
            </div>
          </section>

          {/* Inputs */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Inputs</h2>
            <div className="max-w-md space-y-4">
              <Input label="Email" type="email" placeholder="your@email.com" required />
              <Input
                label="With Error"
                type="text"
                error="This field is required"
                placeholder="Enter text"
              />
              <Input
                label="With Helper Text"
                helperText="This is helper text"
                placeholder="Enter text"
              />
              <Input
                label="With Left Icon"
                leftIcon={<Mail className="w-5 h-5" />}
                placeholder="Email address"
              />
              <PasswordInput label="Password" placeholder="Enter password" />
              <PhoneInput
                label="Phone Number"
                value={phoneValue}
                onChange={(e) => setPhoneValue(e.target.value)}
              />
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  OTP Input
                </label>
                <OTPInput value={otpValue} onChange={setOtpValue} />
              </div>
            </div>
          </section>

          {/* Cards */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Cards</h2>
            <div className="space-y-4">
              <Card>
                <h3 className="font-semibold text-lg mb-2">Basic Card</h3>
                <p className="text-gray-600">This is a basic card component.</p>
              </Card>

              <Card clickable onClick={() => alert('Card clicked!')}>
                <h3 className="font-semibold text-lg mb-2">Clickable Card</h3>
                <p className="text-gray-600">This card is clickable with hover effects.</p>
              </Card>

              {mockJobs.slice(0, 2).map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  onClick={() => alert(`Job ${job.id} clicked`)}
                  showCaregiver={!!job.caregiver_name}
                />
              ))}

              {mockCareRecipients.slice(0, 1).map(recipient => (
                <CareRecipientCard
                  key={recipient.id}
                  recipient={recipient}
                  onClick={() => alert(`Recipient ${recipient.id} clicked`)}
                />
              ))}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <WalletCard
                  title="ยอดคงเหลือ"
                  amount={5000}
                  icon={<WalletIcon className="w-6 h-6" />}
                  variant="primary"
                  description="สามารถใช้ได้"
                />
                <WalletCard
                  title="ยอดเงินค้าง"
                  amount={1500}
                  icon={<WalletIcon className="w-6 h-6" />}
                  variant="warning"
                  description="กันเงินจากงาน"
                />
                <WalletCard
                  title="รายได้ทั้งหมด"
                  amount={12400}
                  icon={<WalletIcon className="w-6 h-6" />}
                  variant="success"
                  description="รายได้สะสม"
                />
              </div>
            </div>
          </section>

          {/* Badges */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Badges</h2>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">Default</Badge>
                <Badge variant="success">Success</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="danger">Danger</Badge>
                <Badge variant="info">Info</Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                <StatusBadge status="draft" />
                <StatusBadge status="posted" />
                <StatusBadge status="assigned" />
                <StatusBadge status="in_progress" />
                <StatusBadge status="completed" />
                <StatusBadge status="cancelled" />
              </div>

              <div className="flex flex-wrap gap-2">
                <TrustLevelBadge level="L0" />
                <TrustLevelBadge level="L1" />
                <TrustLevelBadge level="L2" />
                <TrustLevelBadge level="L3" />
              </div>
            </div>
          </section>

          {/* Avatars */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Avatars</h2>
            <div className="flex flex-wrap gap-4 items-center">
              <Avatar size="xs" name="John Doe" />
              <Avatar size="sm" name="Jane Smith" />
              <Avatar size="md" name="Bob Wilson" />
              <Avatar size="lg" name="Alice Johnson" />
              <Avatar size="xl" name="Charlie Brown" />
              <Avatar size="md" />
            </div>
          </section>

          {/* Modals */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Modals</h2>
            <div className="flex gap-3">
              <Button onClick={() => setShowModal(true)}>Open Modal</Button>
              <Button variant="danger" onClick={() => setShowConfirmModal(true)}>
                Open Confirm Modal
              </Button>
            </div>

            <Modal
              isOpen={showModal}
              onClose={() => setShowModal(false)}
              title="Example Modal"
              footer={
                <div className="flex gap-3 justify-end">
                  <Button variant="ghost" onClick={() => setShowModal(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => setShowModal(false)}>Confirm</Button>
                </div>
              }
            >
              <p className="text-gray-700">
                This is an example modal with a title, content, and footer.
              </p>
            </Modal>

            <ConfirmModal
              isOpen={showConfirmModal}
              onClose={() => setShowConfirmModal(false)}
              onConfirm={() => {
                alert('Confirmed!');
                setShowConfirmModal(false);
              }}
              title="Confirm Action"
              message="Are you sure you want to proceed with this action?"
              variant="danger"
            />
          </section>

          {/* Tabs */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Tabs</h2>
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-medium mb-3">Line Tabs</h3>
                <Tabs
                  tabs={[
                    { id: 'all', label: 'ทั้งหมด', count: 10 },
                    { id: 'active', label: 'กำลังดำเนินการ', count: 3 },
                    { id: 'completed', label: 'เสร็จสิ้น', count: 7 },
                  ]}
                />
              </div>

              <div>
                <h3 className="text-lg font-medium mb-3">Pills Tabs</h3>
                <Tabs
                  variant="pills"
                  tabs={[
                    { id: 'overview', label: 'ภาพรวม', icon: <Home className="w-4 h-4" /> },
                    { id: 'details', label: 'รายละเอียด' },
                    { id: 'history', label: 'ประวัติ' },
                  ]}
                />
              </div>
            </div>
          </section>

          {/* Loading States */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Loading States</h2>
            <div className="space-y-6">
              <div className="flex gap-4 items-center">
                <Spinner size="sm" />
                <Spinner size="md" />
                <Spinner size="lg" />
                <Spinner size="xl" />
              </div>

              <Card>
                <LoadingState message="กำลังโหลดข้อมูล..." />
              </Card>

              <div className="space-y-3">
                <JobCardSkeleton />
                <CareRecipientCardSkeleton />
              </div>

              <div className="space-y-2">
                <Skeleton height="20px" />
                <Skeleton height="20px" width="80%" />
                <Skeleton height="20px" width="60%" />
              </div>
            </div>
          </section>

          {/* Empty States */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Empty States</h2>
            <Card>
              <EmptyState
                icon={<WalletIcon className="w-16 h-16" />}
                title="ไม่มีงาน"
                description="คุณยังไม่มีงานในขณะนี้ เริ่มต้นโดยการสร้างงานใหม่"
                action={
                  <Button leftIcon={<Plus className="w-4 h-4" />}>
                    สร้างงานใหม่
                  </Button>
                }
              />
            </Card>
          </section>
        </div>
      </div>
    </MainLayout>
  );
}
