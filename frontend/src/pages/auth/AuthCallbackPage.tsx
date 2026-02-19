import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../layouts';
import { useAuth } from '../../contexts';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { loginWithTokens } = useAuth();
  const handledRef = useRef(false);
  const loginWithTokensRef = useRef(loginWithTokens);
  const navigateRef = useRef(navigate);
  loginWithTokensRef.current = loginWithTokens;
  navigateRef.current = navigate;

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const refreshToken = params.get('refreshToken') || undefined;

    window.history.replaceState({}, document.title, window.location.pathname);

    if (!token) {
      navigateRef.current('/login?error=oauth_failed', { replace: true });
      return;
    }

    loginWithTokensRef.current(token, refreshToken)
      .then((user) => {
        const destination = user.role === 'admin' ? '/admin/dashboard' : '/select-role';
        navigateRef.current(destination, {
          replace: true,
          state: user.role === 'admin' ? undefined : { mode: 'login' },
        });
      })
      .catch(() => {
        navigateRef.current('/login?error=oauth_failed', { replace: true });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthLayout>
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">กำลังเข้าสู่ระบบ</h1>
        <p className="text-gray-600">กรุณารอสักครู่...</p>
      </div>
    </AuthLayout>
  );
}
