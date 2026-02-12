import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ConsentPage from '../pages/auth/ConsentPage';
import { RequireAuth, RequirePolicy, RequireRole } from '../routerGuards';

const setActiveRoleMock = vi.fn();
const refreshUserMock = vi.fn();
let currentAuth: any = null;

vi.mock('../contexts', () => ({
  useAuth: () => currentAuth,
}));

vi.mock('../services/appApi', () => ({
  appApi: {
    acceptPolicy: vi.fn(async () => ({
      success: true,
      data: {
        policy_acceptances: {
          hirer: {
            policy_accepted_at: '2026-02-01T10:00:00.000Z',
            version_policy_accepted: '2026-02-01',
          },
        },
      },
    })),
  },
}));

const LocationDisplay = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

describe('Policy flow', () => {
  beforeEach(() => {
    localStorage.clear();
    setActiveRoleMock.mockReset();
    refreshUserMock.mockReset();
  });

  it('redirects to role dashboard after consent on first signup', async () => {
    localStorage.setItem('pendingRole', 'hirer');
    currentAuth = {
      user: { role: 'hirer', account_type: 'guest' },
      activeRole: null,
      isLoading: false,
      setActiveRole: setActiveRoleMock,
      refreshUser: refreshUserMock,
    };

    vi.useFakeTimers();

    render(
      <MemoryRouter initialEntries={['/register/consent']}>
        <Routes>
          <Route path="/register/consent" element={<ConsentPage />} />
          <Route path="/hirer/home" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    );

    await act(async () => {
      fireEvent.click(screen.getByLabelText('ข้าพเจ้ายอมรับเงื่อนไขการให้บริการ'));
      fireEvent.click(screen.getByLabelText('ข้าพเจ้ายอมรับนโยบายความเป็นส่วนตัว'));
      fireEvent.click(screen.getByLabelText('ข้าพเจ้ายินยอมให้ประมวลผลข้อมูลส่วนบุคคล'));
      fireEvent.click(screen.getByRole('button', { name: 'ยอมรับและสมัครสมาชิก' }));
      await vi.runAllTimersAsync();
    });

    expect(screen.getByTestId('location').textContent).toBe('/hirer/home');

    vi.useRealTimers();
  });

  it('redirects to policy when login role lacks consent', () => {
    currentAuth = {
      user: { role: 'hirer', policy_acceptances: {} },
      activeRole: 'hirer',
      isLoading: false,
    };

    render(
      <MemoryRouter initialEntries={['/hirer/home']}>
        <Routes>
          <Route
            path="/hirer/home"
            element={
              <RequireAuth>
                <RequireRole roles={['hirer']}>
                  <RequirePolicy>
                    <LocationDisplay />
                  </RequirePolicy>
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route path="/register/consent" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('location').textContent).toBe('/register/consent');
  });

  it('allows dashboard when login role already accepted policy', () => {
    currentAuth = {
      user: {
        role: 'hirer',
        policy_acceptances: {
          hirer: {
            policy_accepted_at: '2026-02-01T10:00:00.000Z',
            version_policy_accepted: '2026-02-01',
          },
        },
      },
      activeRole: 'hirer',
      isLoading: false,
    };

    render(
      <MemoryRouter initialEntries={['/hirer/home']}>
        <Routes>
          <Route
            path="/hirer/home"
            element={
              <RequireAuth>
                <RequireRole roles={['hirer']}>
                  <RequirePolicy>
                    <LocationDisplay />
                  </RequirePolicy>
                </RequireRole>
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('location').textContent).toBe('/hirer/home');
  });
});
