import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../layouts';
import { useAuth } from '../../contexts';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { loginWithTokens } = useAuth();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const refreshToken = params.get('refreshToken') || undefined;

    window.history.replaceState({}, document.title, window.location.pathname);

    if (!token) {
      navigate('/login?error=oauth_failed', { replace: true });
      return;
    }

    let cancelled = false;

    const completeOAuthLogin = async () => {
      try {
        const user = await loginWithTokens(token, refreshToken);
        if (cancelled) return;

        const destination = user.role === 'admin' ? '/admin/dashboard' : '/select-role';
        navigate(destination, {
          replace: true,
          state: user.role === 'admin' ? undefined : { mode: 'login' },
        });
      } catch {
        if (cancelled) return;
        navigate('/login?error=oauth_failed', { replace: true });
      }
    };

    completeOAuthLogin();

    return () => {
      cancelled = true;
    };
  }, [loginWithTokens, navigate]);

  return (
    <AuthLayout>
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">กำลังเข้าสู่ระบบ</h1>
        <p className="text-gray-600">กรุณารอสักครู่...</p>
      </div>
    </AuthLayout>
  );
}
