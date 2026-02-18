import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingState } from './components/ui';
import { useAuth } from './contexts';
import type { UserRole } from './contexts/AuthContext';
import { isConfiguredDisplayName, toDisplayNameFromFullName } from './utils/profileName';

const hasConfiguredProfileName = (value?: string | null) => {
  if (isConfiguredDisplayName(value)) return true;
  return Boolean(toDisplayNameFromFullName(String(value || '')));
};

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <LoadingState message="กำลังตรวจสอบสถานะการเข้าสู่ระบบ..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

export function RequireRole({
  children,
  roles,
  redirectTo,
}: {
  children: ReactNode;
  roles: UserRole[];
  redirectTo?: string;
}) {
  const { user, isLoading, activeRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <LoadingState message="กำลังตรวจสอบสิทธิ์..." />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (user.role !== 'admin' && !activeRole) {
    return <Navigate to="/select-role" replace state={{ mode: 'login', from: location.pathname }} />;
  }

  const resolvedRole: UserRole = user.role === 'admin' ? 'admin' : activeRole!;

  if (!roles.includes(resolvedRole)) {
    const fallback =
      redirectTo ||
      (resolvedRole === 'hirer' ? '/hirer/home' : resolvedRole === 'caregiver' ? '/caregiver/jobs/feed' : '/admin/dashboard');
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}

export function RequirePolicy({ children }: { children: ReactNode }) {
  const { user, isLoading, activeRole } = useAuth();
  const location = useLocation();
  const POLICY_VERSION = '2026-02-01';

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <LoadingState message="กำลังตรวจสอบการยอมรับเงื่อนไข..." />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'admin') {
    return <>{children}</>;
  }

  const resolvedRole = activeRole || user.role;
  const acceptance = user.policy_acceptances?.[resolvedRole];

  if (!acceptance || acceptance.version_policy_accepted !== POLICY_VERSION) {
    return (
      <Navigate
        to="/register/consent"
        replace
        state={{ role: resolvedRole, from: location.pathname, mode: 'login' }}
      />
    );
  }

  return <>{children}</>;
}

/**
 * Require user to have a configured profile name.
 * Redirects to /profile with a state flag if missing.
 */
export function RequireProfile({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <LoadingState message="กำลังตรวจสอบโปรไฟล์..." />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Admin users don't need a profile
  if (user.role === 'admin') return <>{children}</>;

  // Require a configured profile name before entering core flows.
  // Accept both legacy short names and full names (self-view format).
  if (!hasConfiguredProfileName(user.name)) {
    return (
      <Navigate
        to="/profile"
        replace
        state={{ profileRequired: true, from: location.pathname }}
      />
    );
  }

  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <LoadingState message="กำลังตรวจสอบสิทธิ์..." />
      </div>
    );
  }

  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;

  return <>{children}</>;
}

