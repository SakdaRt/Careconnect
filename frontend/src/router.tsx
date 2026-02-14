import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { MainLayout, AdminLayout } from './layouts';
import { PlaceholderPage } from './components/PlaceholderPage';
import { LoadingState } from './components/ui';
import { RouteErrorFallback } from './components/ErrorBoundary';
const ComponentShowcase = lazy(() => import('./pages/ComponentShowcase'));
const JobDetailPage = lazy(() => import('./pages/shared/JobDetailPage'));
const ChatRoomPage = lazy(() => import('./pages/shared/ChatRoomPage'));
const DisputeChatPage = lazy(() => import('./pages/shared/DisputeChatPage'));
const NotificationsPage = lazy(() => import('./pages/shared/NotificationsPage'));
const ProfilePage = lazy(() => import('./pages/shared/ProfilePage'));
const SettingsPage = lazy(() => import('./pages/shared/SettingsPage'));
const KycPage = lazy(() => import('./pages/shared/KycPage'));

// Public Pages
const LandingPage = lazy(() => import('./pages/public/LandingPage'));
const AboutPage = lazy(() => import('./pages/public/AboutPage'));
const FAQPage = lazy(() => import('./pages/public/FAQPage'));
const ContactPage = lazy(() => import('./pages/public/ContactPage'));

// Auth Pages
const LoginEntryPage = lazy(() => import('./pages/auth/LoginEntryPage'));
const LoginEmailPage = lazy(() => import('./pages/auth/LoginEmailPage'));
const LoginPhonePage = lazy(() => import('./pages/auth/LoginPhonePage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const RegisterTypePage = lazy(() => import('./pages/auth/RegisterTypePage'));
const GuestRegisterPage = lazy(() => import('./pages/auth/GuestRegisterPage'));
const MemberRegisterPage = lazy(() => import('./pages/auth/MemberRegisterPage'));
const RoleSelectionPage = lazy(() => import('./pages/auth/RoleSelectionPage'));
const ConsentPage = lazy(() => import('./pages/auth/ConsentPage'));
const HirerHomePage = lazy(() => import('./pages/hirer/HirerHomePage'));
const SearchCaregiversPage = lazy(() => import('./pages/hirer/SearchCaregiversPage'));
const CreateJobPage = lazy(() => import('./pages/hirer/CreateJobPage'));
const HirerWalletPage = lazy(() => import('./pages/hirer/HirerWalletPage'));
const CareRecipientsPage = lazy(() => import('./pages/hirer/CareRecipientsPage'));
const CareRecipientFormPage = lazy(() => import('./pages/hirer/CareRecipientFormPage'));
const HirerPaymentHistoryPage = lazy(() => import('./pages/hirer/HirerPaymentHistoryPage'));
const JobReceiptPage = lazy(() => import('./pages/hirer/JobReceiptPage'));
const CaregiverJobFeedPage = lazy(() => import('./pages/caregiver/CaregiverJobFeedPage'));
const JobPreviewPage = lazy(() => import('./pages/caregiver/JobPreviewPage'));
const CaregiverMyJobsPage = lazy(() => import('./pages/caregiver/CaregiverMyJobsPage'));
const CaregiverWalletPage = lazy(() => import('./pages/caregiver/CaregiverWalletPage'));
const EarningsHistoryPage = lazy(() => import('./pages/caregiver/EarningsHistoryPage'));
const JobEarningDetailPage = lazy(() => import('./pages/caregiver/JobEarningDetailPage'));
const AdminFinancialPage = lazy(() => import('./pages/admin/AdminFinancialPage'));
import { RequireAdmin, RequireAuth, RequirePolicy, RequireProfile, RequireRole } from './routerGuards';
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminJobsPage = lazy(() => import('./pages/admin/AdminJobsPage'));
const AdminReportsPage = lazy(() => import('./pages/admin/AdminReportsPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));
const AdminDisputesPage = lazy(() => import('./pages/admin/AdminDisputesPage'));

// ============================================================================
// Hirer Pages
// ============================================================================
 

// ============================================================================
// Caregiver Pages
// ============================================================================
const CaregiverProfilePage = () => (
  <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
    <ProfilePage />
  </Suspense>
);
 

// ============================================================================
// Shared Pages
// ============================================================================
const CancelJobPage = () => <MainLayout showBottomBar={false}><PlaceholderPage title="ยกเลิกงาน" /></MainLayout>;
 

// ============================================================================
// Admin Pages
// ============================================================================

// ============================================================================
// Router Configuration
// ============================================================================
export const router = createBrowserRouter([
  {
    // Root layout route — provides errorElement for all child routes
    errorElement: <RouteErrorFallback />,
    children: [
  // Public Routes
  {
    path: '/',
    element: (
      <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
        <LandingPage />
      </Suspense>
    ),
  },
  {
    path: '/about',
    element: (
      <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
        <AboutPage />
      </Suspense>
    ),
  },
  {
    path: '/faq',
    element: (
      <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
        <FAQPage />
      </Suspense>
    ),
  },
  {
    path: '/contact',
    element: (
      <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
        <ContactPage />
      </Suspense>
    ),
  },

  // Component Showcase (for development)
  {
    path: '/showcase',
    element: (
      <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
        <ComponentShowcase />
      </Suspense>
    ),
  },

  // Auth Routes
  { path: '/login', element: <Suspense fallback={<LoadingState message="กำลังโหลด..." />}><LoginEntryPage /></Suspense> },
  { path: '/login/email', element: <Suspense fallback={<LoadingState message="กำลังโหลด..." />}><LoginEmailPage /></Suspense> },
  { path: '/login/phone', element: <Suspense fallback={<LoadingState message="กำลังโหลด..." />}><LoginPhonePage /></Suspense> },
  { path: '/forgot-password', element: <Suspense fallback={<LoadingState message="กำลังโหลด..." />}><ForgotPasswordPage /></Suspense> },
  { path: '/register', element: <Suspense fallback={<LoadingState message="กำลังโหลด..." />}><RegisterTypePage /></Suspense> },
  { path: '/register/guest', element: <Suspense fallback={<LoadingState message="กำลังโหลด..." />}><GuestRegisterPage /></Suspense> },
  { path: '/register/member', element: <Suspense fallback={<LoadingState message="กำลังโหลด..." />}><MemberRegisterPage /></Suspense> },
  { path: '/select-role', element: <Suspense fallback={<LoadingState message="กำลังโหลด..." />}><RoleSelectionPage /></Suspense> },
  { path: '/register/consent', element: <Suspense fallback={<LoadingState message="กำลังโหลด..." />}><ConsentPage /></Suspense> },

  // Hirer Routes
  {
    path: '/hirer/home',
    element: (
      <RequireAuth>
        <RequireRole roles={['hirer']}>
          <RequirePolicy>
            <RequireProfile>
              <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
                <HirerHomePage />
              </Suspense>
            </RequireProfile>
          </RequirePolicy>
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: '/hirer/search-caregivers',
    element: (
      <RequireAuth>
        <RequireRole roles={['hirer']}>
          <RequirePolicy>
            <RequireProfile>
              <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
                <SearchCaregiversPage />
              </Suspense>
            </RequireProfile>
          </RequirePolicy>
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: '/hirer/create-job',
    element: (
      <RequireAuth>
        <RequireRole roles={['hirer']}>
          <RequirePolicy>
            <RequireProfile>
              <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
                <CreateJobPage />
              </Suspense>
            </RequireProfile>
          </RequirePolicy>
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: '/hirer/care-recipients',
    element: (
      <RequireAuth>
        <RequireRole roles={['hirer']}>
          <RequirePolicy>
            <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
              <CareRecipientsPage />
            </Suspense>
          </RequirePolicy>
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: '/hirer/care-recipients/new',
    element: (
      <RequireAuth>
        <RequireRole roles={['hirer']}>
          <RequirePolicy>
            <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
              <CareRecipientFormPage />
            </Suspense>
          </RequirePolicy>
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: '/hirer/care-recipients/:id/edit',
    element: (
      <RequireAuth>
        <RequireRole roles={['hirer']}>
          <RequirePolicy>
            <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
              <CareRecipientFormPage />
            </Suspense>
          </RequirePolicy>
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: '/hirer/wallet',
    element: (
      <RequireAuth>
        <RequireRole roles={['hirer']}>
          <RequirePolicy>
            <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
              <HirerWalletPage />
            </Suspense>
          </RequirePolicy>
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: '/hirer/wallet/receipt/:jobId',
    element: (
      <RequireAuth>
        <RequireRole roles={['hirer']}>
          <RequirePolicy>
            <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
              <JobReceiptPage />
            </Suspense>
          </RequirePolicy>
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: '/hirer/wallet/history',
    element: (
      <RequireAuth>
        <RequireRole roles={['hirer']}>
          <RequirePolicy>
            <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
              <HirerPaymentHistoryPage />
            </Suspense>
          </RequirePolicy>
        </RequireRole>
      </RequireAuth>
    ),
  },

  // Caregiver Routes
  {
    path: '/caregiver/jobs/feed',
    element: (
      <RequireAuth>
        <RequireRole roles={['caregiver']}>
          <RequirePolicy>
            <RequireProfile>
              <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
                <CaregiverJobFeedPage />
              </Suspense>
            </RequireProfile>
          </RequirePolicy>
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: '/caregiver/jobs/my-jobs',
    element: (
      <RequireAuth>
        <RequireRole roles={['caregiver']}>
          <RequirePolicy>
            <RequireProfile>
              <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
                <CaregiverMyJobsPage />
              </Suspense>
            </RequireProfile>
          </RequirePolicy>
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: '/caregiver/jobs/:id/preview',
    element: (
      <RequireAuth>
        <RequireRole roles={['caregiver']}>
          <RequirePolicy>
            <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
              <JobPreviewPage />
            </Suspense>
          </RequirePolicy>
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: '/caregiver/profile',
    element: (
      <RequireAuth>
        <RequireRole roles={['caregiver']}>
          <RequirePolicy>
            <CaregiverProfilePage />
          </RequirePolicy>
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: '/caregiver/wallet',
    element: (
      <RequireAuth>
        <RequireRole roles={['caregiver']}>
          <RequirePolicy>
            <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
              <CaregiverWalletPage />
            </Suspense>
          </RequirePolicy>
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: '/caregiver/wallet/earning/:jobId',
    element: (
      <RequireAuth>
        <RequireRole roles={['caregiver']}>
          <RequirePolicy>
            <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
              <JobEarningDetailPage />
            </Suspense>
          </RequirePolicy>
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: '/caregiver/wallet/history',
    element: (
      <RequireAuth>
        <RequireRole roles={['caregiver']}>
          <RequirePolicy>
            <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
              <EarningsHistoryPage />
            </Suspense>
          </RequirePolicy>
        </RequireRole>
      </RequireAuth>
    ),
  },

  // Shared Routes
  {
    path: '/chat/:jobId',
    element: (
      <RequireAuth>
        <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
          <ChatRoomPage />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    path: '/jobs/:id',
    element: (
      <RequireAuth>
        <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
          <JobDetailPage />
        </Suspense>
      </RequireAuth>
    ),
  },
  { path: '/jobs/:id/cancel', element: <CancelJobPage /> },
  {
    path: '/dispute/:disputeId',
    element: (
      <RequireAuth>
        <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
          <DisputeChatPage />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    path: '/notifications',
    element: (
      <RequireAuth>
        <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
          <NotificationsPage />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    path: '/profile',
    element: (
      <RequireAuth>
        <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
          <ProfilePage />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    path: '/settings',
    element: (
      <RequireAuth>
        <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
          <SettingsPage />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    path: '/kyc',
    element: (
      <RequireAuth>
        <Suspense fallback={<LoadingState message="กำลังโหลด..." />}>
          <KycPage />
        </Suspense>
      </RequireAuth>
    ),
  },

  // Admin Routes
  { path: '/admin/login', element: <Suspense fallback={<LoadingState message="กำลังโหลด..." />}><AdminLoginPage /></Suspense> },
  { path: '/admin/dashboard', element: <RequireAdmin><Suspense fallback={<LoadingState message="กำลังโหลด..." />}><AdminDashboardPage /></Suspense></RequireAdmin> },
  { path: '/admin/jobs', element: <RequireAdmin><Suspense fallback={<LoadingState message="กำลังโหลด..." />}><AdminJobsPage /></Suspense></RequireAdmin> },
  { path: '/admin/users', element: <RequireAdmin><Suspense fallback={<LoadingState message="กำลังโหลด..." />}><AdminUsersPage /></Suspense></RequireAdmin> },
  { path: '/admin/financial', element: <RequireAdmin><AdminLayout><Suspense fallback={<LoadingState message="กำลังโหลด..." />}><AdminFinancialPage /></Suspense></AdminLayout></RequireAdmin> },
  { path: '/admin/disputes', element: <RequireAdmin><Suspense fallback={<LoadingState message="กำลังโหลด..." />}><AdminDisputesPage /></Suspense></RequireAdmin> },
  { path: '/admin/reports', element: <RequireAdmin><Suspense fallback={<LoadingState message="กำลังโหลด..." />}><AdminReportsPage /></Suspense></RequireAdmin> },
  { path: '/admin/settings', element: <RequireAdmin><Suspense fallback={<LoadingState message="กำลังโหลด..." />}><AdminSettingsPage /></Suspense></RequireAdmin> },

  // Fallback
  { path: '*', element: <Navigate to="/" replace /> },
    ], // end children
  }, // end root layout route
]);
