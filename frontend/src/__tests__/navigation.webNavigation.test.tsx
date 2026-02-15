import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import LandingPage from '../pages/public/LandingPage';
import LoginEntryPage from '../pages/auth/LoginEntryPage';
import RegisterTypePage from '../pages/auth/RegisterTypePage';
import SettingsPage from '../pages/shared/SettingsPage';
import HirerHomePage from '../pages/hirer/HirerHomePage';
import CareRecipientsPage from '../pages/hirer/CareRecipientsPage';
import CreateJobPage from '../pages/hirer/CreateJobPage';
import CaregiverJobFeedPage from '../pages/caregiver/CaregiverJobFeedPage';
import CaregiverMyJobsPage from '../pages/caregiver/CaregiverMyJobsPage';
import CaregiverWalletPage from '../pages/caregiver/CaregiverWalletPage';
import EarningsHistoryPage from '../pages/caregiver/EarningsHistoryPage';
import { TopBar } from '../components/navigation/TopBar';
import { BottomBar } from '../components/navigation/BottomBar';
import { AdminLayout } from '../layouts/AdminLayout';

const logoutMock = vi.fn();
let currentUser: any = null;

vi.mock('../contexts', () => ({
  useAuth: () => ({
    user: currentUser,
    logout: logoutMock,
  }),
}));

const sampleJobPost = {
  id: 'job-1',
  title: 'ดูแลผู้สูงอายุ',
  description: 'ดูแลทั่วไป',
  scheduled_start_at: '2026-02-01T09:00:00.000Z',
  scheduled_end_at: '2026-02-01T17:00:00.000Z',
  address_line1: 'สุขุมวิท',
  district: 'คลองเตย',
  province: 'กรุงเทพฯ',
  total_amount: 2400,
  job_type: 'companionship',
  status: 'posted',
  hourly_rate: 300,
  total_hours: 8,
};

vi.mock('../services/appApi', () => ({
  appApi: {
    getMyJobs: async () => ({ success: true, data: { data: [] } }),
    publishJob: async () => ({ success: true, data: {} }),
    getDisputeByJob: async () => ({ success: true, data: {} }),
    createDispute: async () => ({ success: true, data: { dispute: { id: 'dispute-1' } } }),
    getCareRecipients: async () => ({ success: true, data: [] }),
    deactivateCareRecipient: async () => ({ success: true }),
    createJob: async () => ({ success: true, data: {} }),
    getJobFeed: async () => ({ success: true, data: { data: [sampleJobPost] } }),
    getAssignedJobs: async () => ({ success: true, data: { data: [] } }),
    checkIn: async () => ({ success: true }),
    checkOut: async () => ({ success: true }),
    getWalletBalance: async () => ({ success: true, data: { available_balance: 1000 } }),
    listWalletTransactions: async () => ({ success: true, data: { data: [], totalPages: 1 } }),
    getBankAccounts: async () => ({ success: true, data: [] }),
    getWithdrawals: async () => ({ success: true, data: { data: [], totalPages: 1 } }),
    initiateWithdrawal: async () => ({ success: true }),
    addBankAccount: async () => ({ success: true }),
    cancelWithdrawal: async () => ({ success: true }),
  },
}));

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderWithRouter(ui: React.ReactNode, initialEntries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="*" element={<>{ui}<LocationDisplay /></>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Landing page navigation', () => {
  it('navigates via header links', () => {
    renderWithRouter(<LandingPage />);
    fireEvent.click(screen.getAllByRole('link', { name: 'เกี่ยวกับเรา' })[0]);
    expect(screen.getByTestId('location').textContent).toBe('/about');
  });

  it('navigates via FAQ link', () => {
    renderWithRouter(<LandingPage />);
    fireEvent.click(screen.getAllByRole('link', { name: 'คำถามที่พบบ่อย' })[0]);
    expect(screen.getByTestId('location').textContent).toBe('/faq');
  });

  it('navigates via contact link', () => {
    renderWithRouter(<LandingPage />);
    fireEvent.click(screen.getAllByRole('link', { name: 'ติดต่อเรา' })[0]);
    expect(screen.getByTestId('location').textContent).toBe('/contact');
  });

  it('navigates via login and register buttons', () => {
    renderWithRouter(<LandingPage />);
    fireEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));
    expect(screen.getByTestId('location').textContent).toBe('/login');
  });

  it('navigates via primary CTA buttons', () => {
    renderWithRouter(<LandingPage />);
    fireEvent.click(screen.getByRole('button', { name: 'เริ่มต้นใช้งาน' }));
    expect(screen.getByTestId('location').textContent).toBe('/register');
  });

  it('navigates via secondary CTA button', () => {
    renderWithRouter(<LandingPage />);
    fireEvent.click(screen.getByRole('button', { name: 'เรียนรู้เพิ่มเติม' }));
    expect(screen.getByTestId('location').textContent).toBe('/about');
  });

  it('navigates via footer CTA buttons', () => {
    renderWithRouter(<LandingPage />);
    fireEvent.click(screen.getAllByRole('button', { name: 'สมัครเป็นผู้ว่าจ้าง' })[0]);
    expect(screen.getByTestId('location').textContent).toBe('/register');
  });
});

describe('Auth entry navigation', () => {
  beforeEach(() => {
    currentUser = null;
  });

  it('navigates to login methods and forgot password', () => {
    renderWithRouter(<LoginEntryPage />, ['/login']);
    fireEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบด้วยอีเมล' }));
    expect(screen.getByTestId('location').textContent).toBe('/login/email');
  });

  it('navigates to phone login', () => {
    renderWithRouter(<LoginEntryPage />, ['/login']);
    fireEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบด้วยเบอร์โทร' }));
    expect(screen.getByTestId('location').textContent).toBe('/login/phone');
  });

  it('navigates to forgot password', () => {
    renderWithRouter(<LoginEntryPage />, ['/login']);
    fireEvent.click(screen.getByRole('link', { name: 'ลืมรหัสผ่าน?' }));
    expect(screen.getByTestId('location').textContent).toBe('/forgot-password');
  });

  it('navigates to register from login entry', () => {
    renderWithRouter(<LoginEntryPage />, ['/login']);
    fireEvent.click(screen.getByRole('button', { name: 'สมัครสมาชิก' }));
    expect(screen.getByTestId('location').textContent).toBe('/register');
  });

  it('navigates via demo buttons', () => {
    renderWithRouter(<LoginEntryPage />, ['/login']);
    fireEvent.click(screen.getByRole('button', { name: 'เข้าเดโม (ผู้ว่าจ้าง)' }));
    expect(screen.getByTestId('location').textContent).toBe('/hirer/home');
  });

  it('navigates via caregiver demo button', () => {
    renderWithRouter(<LoginEntryPage />, ['/login']);
    fireEvent.click(screen.getByRole('button', { name: 'เข้าเดโม (ผู้ดูแล)' }));
    expect(screen.getByTestId('location').textContent).toBe('/caregiver/jobs/feed');
  });
});

describe('Register type navigation', () => {
  it('navigates to guest registration', () => {
    renderWithRouter(<RegisterTypePage />, ['/register']);
    fireEvent.click(screen.getByRole('button', { name: 'สมัครด้วยอีเมล' }));
    expect(screen.getByTestId('location').textContent).toBe('/register/guest');
  });

  it('navigates to member registration', () => {
    renderWithRouter(<RegisterTypePage />, ['/register']);
    fireEvent.click(screen.getByRole('button', { name: 'สมัครด้วยเบอร์โทร' }));
    expect(screen.getByTestId('location').textContent).toBe('/register/member');
  });

  it('navigates to login from register', () => {
    renderWithRouter(<RegisterTypePage />, ['/register']);
    fireEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));
    expect(screen.getByTestId('location').textContent).toBe('/login');
  });
});

describe('Top bar navigation', () => {
  beforeEach(() => {
    currentUser = { id: 'hirer-1', role: 'hirer', email: 'hirer@test.com', trust_level: 'L1', name: 'Hirer' };
  });

  it('navigates to profile and settings from menu', () => {
    renderWithRouter(<TopBar />, ['/hirer/home']);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('link', { name: 'โปรไฟล์' }));
    expect(screen.getByTestId('location').textContent).toBe('/profile');
  });

  it('navigates to settings from menu', () => {
    renderWithRouter(<TopBar />, ['/hirer/home']);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('link', { name: 'ตั้งค่า / ช่วยเหลือ' }));
    expect(screen.getByTestId('location').textContent).toBe('/settings');
  });
});

describe('Bottom bar navigation', () => {
  it('navigates hirer tabs', () => {
    currentUser = { id: 'hirer-1', role: 'hirer', email: 'hirer@test.com', trust_level: 'L1', name: 'Hirer' };
    renderWithRouter(<BottomBar />, ['/hirer/home']);
    fireEvent.click(screen.getByRole('link', { name: 'ค้นหาผู้ดูแล' }));
    expect(screen.getByTestId('location').textContent).toBe('/hirer/search-caregivers');
  });

  it('navigates hirer care recipients', () => {
    currentUser = { id: 'hirer-1', role: 'hirer', email: 'hirer@test.com', trust_level: 'L1', name: 'Hirer' };
    renderWithRouter(<BottomBar />, ['/hirer/home']);
    fireEvent.click(screen.getByRole('link', { name: 'ผู้รับการดูแล' }));
    expect(screen.getByTestId('location').textContent).toBe('/hirer/care-recipients');
  });

  it('navigates caregiver tabs', () => {
    currentUser = { id: 'caregiver-1', role: 'caregiver', email: 'caregiver@test.com', trust_level: 'L1', name: 'Caregiver' };
    renderWithRouter(<BottomBar />, ['/caregiver/jobs/feed']);
    fireEvent.click(screen.getByRole('link', { name: 'งานของฉัน' }));
    expect(screen.getByTestId('location').textContent).toBe('/caregiver/jobs/my-jobs');
  });

  it('navigates caregiver profile', () => {
    currentUser = { id: 'caregiver-1', role: 'caregiver', email: 'caregiver@test.com', trust_level: 'L1', name: 'Caregiver' };
    renderWithRouter(<BottomBar />, ['/caregiver/jobs/feed']);
    fireEvent.click(screen.getByRole('link', { name: 'โปรไฟล์' }));
    expect(screen.getByTestId('location').textContent).toBe('/caregiver/profile');
  });
});

describe('Settings page navigation', () => {
  beforeEach(() => {
    currentUser = { id: 'hirer-1', role: 'hirer', email: 'hirer@test.com', trust_level: 'L1', name: 'Hirer' };
  });

  it('navigates from settings links', () => {
    renderWithRouter(<SettingsPage />, ['/settings']);
    fireEvent.click(screen.getByRole('button', { name: 'คำถามที่พบบ่อย' }));
    expect(screen.getByTestId('location').textContent).toBe('/faq');
  });

  it('navigates to notifications', () => {
    renderWithRouter(<SettingsPage />, ['/settings']);
    fireEvent.click(screen.getByRole('button', { name: 'ไปที่การแจ้งเตือน' }));
    expect(screen.getByTestId('location').textContent).toBe('/notifications');
  });
});

describe('Admin menu navigation', () => {
  beforeEach(() => {
    currentUser = { id: 'admin-1', role: 'admin', email: 'admin@test.com', trust_level: 'L3', name: 'Admin' };
  });

  it('navigates via admin menu items', () => {
    renderWithRouter(
      <AdminLayout>
        <div>Admin</div>
      </AdminLayout>,
      ['/admin/dashboard']
    );
    fireEvent.click(screen.getByRole('link', { name: 'จัดการงาน' }));
    expect(screen.getByTestId('location').textContent).toBe('/admin/jobs');
  });

  it('navigates to admin settings', () => {
    renderWithRouter(
      <AdminLayout>
        <div>Admin</div>
      </AdminLayout>,
      ['/admin/dashboard']
    );
    fireEvent.click(screen.getByRole('link', { name: 'ตั้งค่าระบบ' }));
    expect(screen.getByTestId('location').textContent).toBe('/admin/settings');
  });
});

describe('Hirer navigation flows', () => {
  beforeEach(() => {
    currentUser = { id: 'hirer-1', role: 'hirer', email: 'hirer@test.com', trust_level: 'L1', name: 'Hirer' };
  });

  it('navigates from hirer home to create job', async () => {
    renderWithRouter(<HirerHomePage />, ['/hirer/home']);
    fireEvent.click(await screen.findByRole('link', { name: 'สร้างงาน' }));
    expect(screen.getByTestId('location').textContent).toBe('/hirer/create-job');
  });

  it('navigates from care recipients empty state to create job', async () => {
    renderWithRouter(<CareRecipientsPage />, ['/hirer/care-recipients']);
    fireEvent.click(await screen.findByRole('button', { name: 'ไปสร้างงาน' }));
    expect(screen.getByTestId('location').textContent).toBe('/hirer/create-job');
  });

  it('navigates from create job to care recipients', async () => {
    renderWithRouter(<CreateJobPage />, ['/hirer/create-job']);
    fireEvent.click(await screen.findByRole('button', { name: 'จัดการผู้รับการดูแล' }));
    expect(screen.getByTestId('location').textContent).toBe('/hirer/care-recipients');
  });
});

describe('Caregiver navigation flows', () => {
  beforeEach(() => {
    currentUser = { id: 'caregiver-1', role: 'caregiver', email: 'caregiver@test.com', trust_level: 'L1', name: 'Caregiver' };
  });

  it('navigates from job feed to job preview', async () => {
    renderWithRouter(<CaregiverJobFeedPage />, ['/caregiver/jobs/feed']);
    fireEvent.click(await screen.findByRole('button', { name: 'ดูรายละเอียด / รับงาน' }));
    expect(screen.getByTestId('location').textContent).toBe('/caregiver/jobs/job-1/preview');
  });

  it('navigates from my jobs empty state to job feed', async () => {
    renderWithRouter(<CaregiverMyJobsPage />, ['/caregiver/jobs/my-jobs']);
    fireEvent.click(await screen.findByRole('button', { name: 'ไปค้นหางาน' }));
    expect(screen.getByTestId('location').textContent).toBe('/caregiver/jobs/feed');
  });

  it('navigates from wallet to history page', async () => {
    renderWithRouter(<CaregiverWalletPage />, ['/caregiver/wallet']);
    fireEvent.click(await screen.findByRole('button', { name: 'ประวัติ' }));
    expect(screen.getByTestId('location').textContent).toBe('/caregiver/wallet/history');
  });

  it('navigates from earnings history back to wallet', async () => {
    renderWithRouter(<EarningsHistoryPage />, ['/caregiver/wallet/history']);
    fireEvent.click(await screen.findByRole('button', { name: 'ย้อนกลับ' }));
    expect(screen.getByTestId('location').textContent).toBe('/caregiver/wallet');
  });
});
