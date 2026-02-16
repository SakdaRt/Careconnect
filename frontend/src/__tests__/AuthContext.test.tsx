import { render, act, waitFor, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthProvider, useAuth } from '../contexts/AuthContext'
import type { User } from '../services/api'

// Extend Vitest's matchers
import '@testing-library/jest-dom'

// Mock the API module
vi.mock('../services/api', () => ({
  default: {
    getCurrentUser: vi.fn(),
    loginWithEmail: vi.fn(),
    loginWithPhone: vi.fn(),
    registerGuest: vi.fn(),
    registerMember: vi.fn(),
    logout: vi.fn(),
    clearTokens: vi.fn(),
  },
  User: {},
}))

import api from '../services/api'

// Test component to access AuthContext
function TestComponent() {
  const auth = useAuth()
  return (
    <div>
      <div data-testid="is-authenticated">{auth.isAuthenticated.toString()}</div>
      <div data-testid="is-loading">{auth.isLoading.toString()}</div>
      <div data-testid="user-email">{auth.user?.email || 'null'}</div>
      <div data-testid="active-role">{auth.activeRole || 'null'}</div>
      <button
        data-testid="login-btn"
        onClick={() => auth.login('test@example.com', 'password').catch(() => {})}
      >
        Login
      </button>
      <button
        data-testid="logout-btn"
        onClick={() => auth.logout()}
      >
        Logout
      </button>
      <button
        data-testid="set-role-btn"
        onClick={() => auth.setActiveRole('caregiver')}
      >
        Set Role
      </button>
    </div>
  )
}

describe('AuthContext', () => {
  const mockUser: User = {
    id: '1',
    email: 'test@example.com',
    phone_number: '+1234567890',
    role: 'caregiver',
    account_type: 'member',
    trust_level: 'L1',
    trust_score: 75,
    status: 'active',
    is_email_verified: true,
    is_phone_verified: false,
    completed_jobs_count: 5,
    first_job_waiver_used: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    vi.mocked(localStorage.getItem).mockReturnValue(null)
    vi.mocked(localStorage.setItem).mockImplementation(() => {})
    vi.mocked(localStorage.removeItem).mockImplementation(() => {})
    vi.mocked(sessionStorage.getItem).mockReturnValue(null)
    vi.mocked(sessionStorage.setItem).mockImplementation(() => {})
    vi.mocked(sessionStorage.removeItem).mockImplementation(() => {})
  })

  describe('Initialization', () => {
    it('initializes with loading state', () => {
      // Provide stored user + token so initAuth enters the async branch
      vi.mocked(localStorage.getItem)
        .mockImplementation((key) => {
          if (key === 'careconnect_user') return JSON.stringify(mockUser)
          if (key === 'careconnect_token') return 'some-token'
          return null
        })

      // Never resolve so isLoading stays true
      vi.mocked(api.getCurrentUser).mockReturnValue(new Promise(() => {}))

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      expect(screen.getByTestId('is-loading')).toHaveTextContent('true')
    })

    it('loads user from valid token', async () => {
      vi.mocked(localStorage.getItem)
        .mockImplementation((key) => {
          if (key === 'careconnect_user') return JSON.stringify(mockUser)
          if (key === 'careconnect_token') return 'valid-token'
          return null
        })

      vi.mocked(api.getCurrentUser).mockResolvedValue({
        success: true,
        data: { user: mockUser },
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false')
      })

      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com')
    })

    it('handles invalid token', async () => {
      vi.mocked(localStorage.getItem)
        .mockImplementation((key) => {
          if (key === 'careconnect_token') return 'invalid-token'
          if (key === 'careconnect_user') return JSON.stringify(mockUser)
          return null
        })

      vi.mocked(api.getCurrentUser).mockResolvedValue({
        success: false,
        error: 'Invalid token',
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false')
      })

      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false')
      expect(screen.getByTestId('user-email')).toHaveTextContent('null')
      expect(api.clearTokens).toHaveBeenCalled()
    })
  })

  describe('Login', () => {
    it('logs in user successfully', async () => {
      vi.mocked(api.loginWithEmail).mockResolvedValue({
        success: true,
        data: {
          user: mockUser,
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      const loginBtn = screen.getByTestId('login-btn')
      
      await act(async () => {
        loginBtn.click()
      })

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
      })

      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com')
      // api.loginWithEmail is mocked, so token storage happens inside the mock.
      // Verify the mock was called with correct credentials.
      expect(api.loginWithEmail).toHaveBeenCalledWith('test@example.com', 'password')
    })

    it('handles login failure', async () => {
      vi.mocked(api.loginWithEmail).mockResolvedValue({
        success: false,
        error: 'Invalid credentials',
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      const loginBtn = screen.getByTestId('login-btn')
      
      await act(async () => {
        loginBtn.click()
      })

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false')
      })

      expect(screen.getByTestId('user-email')).toHaveTextContent('null')
    })
  })

  describe('Logout', () => {
    it('logs out user and clears tokens', async () => {
      // Start with logged in user
      vi.mocked(localStorage.getItem)
        .mockImplementation((key) => {
          if (key === 'careconnect_user') return JSON.stringify(mockUser)
          if (key === 'careconnect_token') return 'valid-token'
          return null
        })

      vi.mocked(api.getCurrentUser).mockResolvedValue({
        success: true,
        data: { user: mockUser },
      })

      vi.mocked(api.logout).mockResolvedValue({ success: true })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
      })

      const logoutBtn = screen.getByTestId('logout-btn')
      
      await act(async () => {
        logoutBtn.click()
      })

      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false')
      expect(screen.getByTestId('user-email')).toHaveTextContent('null')
      expect(api.clearTokens).toHaveBeenCalled()
    })
  })

  describe('Active Role Management', () => {
    it('sets active role', async () => {
      vi.mocked(localStorage.getItem)
        .mockImplementation((key) => {
          if (key === 'careconnect_user') return JSON.stringify(mockUser)
          if (key === 'careconnect_token') return 'valid-token'
          return null
        })

      vi.mocked(api.getCurrentUser).mockResolvedValue({
        success: true,
        data: { user: mockUser },
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false')
      })

      const setRoleBtn = screen.getByTestId('set-role-btn')
      
      await act(async () => {
        setRoleBtn.click()
      })

      expect(screen.getByTestId('active-role')).toHaveTextContent('caregiver')
      expect(sessionStorage.setItem).toHaveBeenCalledWith('careconnect_active_role', 'caregiver')
    })

    it('clears active role', async () => {
      vi.mocked(localStorage.getItem)
        .mockImplementation((key) => {
          if (key === 'careconnect_user') return JSON.stringify(mockUser)
          if (key === 'careconnect_token') return 'valid-token'
          if (key === 'careconnect_active_role') return 'caregiver'
          return null
        })

      vi.mocked(api.getCurrentUser).mockResolvedValue({
        success: true,
        data: { user: mockUser },
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('active-role')).toHaveTextContent('caregiver')
      })

      // Test clearing role by calling logout (which clears active role)
      const logoutBtn = screen.getByTestId('logout-btn')
      
      await act(async () => {
        logoutBtn.click()
      })

      // After logout, user should be null and role cleared
      expect(screen.getByTestId('active-role')).toHaveTextContent('null')
    })
  })

  describe('Token Refresh', () => {
    it('handles token refresh (transparent via request layer)', async () => {
      // When initAuth runs, getCurrentUser goes through request() which
      // handles 401 refresh transparently. From AuthContext's perspective
      // getCurrentUser simply succeeds after the internal refresh.
      vi.mocked(localStorage.getItem)
        .mockImplementation((key) => {
          if (key === 'careconnect_user') return JSON.stringify(mockUser)
          if (key === 'careconnect_token') return 'expired-token'
          if (key === 'careconnect_refresh_token') return 'valid-refresh-token'
          return null
        })

      // Simulate: request() internally refreshed the token, so getCurrentUser succeeds
      vi.mocked(api.getCurrentUser).mockResolvedValue({
        success: true,
        data: { user: mockUser },
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
      })

      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com')
    })

    it('handles refresh token failure', async () => {
      // When refresh also fails, request() returns { success: false }
      // and initAuth calls api.clearTokens()
      vi.mocked(localStorage.getItem)
        .mockImplementation((key) => {
          if (key === 'careconnect_token') return 'expired-token'
          if (key === 'careconnect_user') return JSON.stringify(mockUser)
          if (key === 'careconnect_refresh_token') return 'invalid-refresh-token'
          return null
        })

      vi.mocked(api.getCurrentUser).mockResolvedValue({
        success: false,
        error: 'Token expired',
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false')
      })

      // initAuth calls api.clearTokens() which removes all three keys
      expect(api.clearTokens).toHaveBeenCalled()
    })
  })
})
