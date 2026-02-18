import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RequireAuth, RequireRole, RequireProfile, RequireAdmin } from '../routerGuards'
import { AuthProvider } from '../contexts/AuthContext'
import type { User } from '../services/api'

// Extend Vitest's matchers
import '@testing-library/jest-dom'

// Mock the AuthContext
vi.mock('../contexts', () => ({
  useAuth: vi.fn(),
}))

// Mock LoadingState component
vi.mock('../components/ui', () => ({
  LoadingState: ({ message }: { message: string }) => (
    <div data-testid="loading-state">{message}</div>
  ),
}))

import { useAuth } from '../contexts'

describe('Route Guards', () => {
  const mockUseAuth = vi.mocked(useAuth)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('RequireAuth', () => {
    it('shows loading state while checking authentication', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        isAuthenticated: false,
        activeRole: null,
      } as any)

      render(
        <MemoryRouter>
          <AuthProvider>
            <RequireAuth>
              <div>Protected Content</div>
            </RequireAuth>
          </AuthProvider>
        </MemoryRouter>
      )

      expect(screen.getByTestId('loading-state')).toBeInTheDocument()
      expect(screen.getByText('กำลังตรวจสอบสถานะการเข้าสู่ระบบ...')).toBeInTheDocument()
    })

    it('redirects to login when user is not authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        activeRole: null,
      } as any)

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthProvider>
            <RequireAuth>
              <div>Protected Content</div>
            </RequireAuth>
          </AuthProvider>
        </MemoryRouter>
      )

      // Should redirect to login
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })

    it('renders children when user is authenticated', () => {
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

      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
        activeRole: 'caregiver',
      } as any)

      render(
        <MemoryRouter>
          <AuthProvider>
            <RequireAuth>
              <div>Protected Content</div>
            </RequireAuth>
          </AuthProvider>
        </MemoryRouter>
      )

      expect(screen.getByText('Protected Content')).toBeInTheDocument()
    })
  })

  describe('RequireRole', () => {
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

    it('shows loading state while checking authentication', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        isAuthenticated: false,
        activeRole: null,
      } as any)

      render(
        <MemoryRouter>
          <AuthProvider>
            <RequireRole roles={['caregiver']}>
              <div>Role Protected Content</div>
            </RequireRole>
          </AuthProvider>
        </MemoryRouter>
      )

      expect(screen.getByTestId('loading-state')).toBeInTheDocument()
      expect(screen.getByText('กำลังตรวจสอบสิทธิ...')).toBeInTheDocument()
    })

    it('redirects to login when user is not authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        activeRole: null,
      } as any)

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthProvider>
            <RequireRole roles={['caregiver']}>
              <div>Role Protected Content</div>
            </RequireRole>
          </AuthProvider>
        </MemoryRouter>
      )

      expect(screen.queryByText('Role Protected Content')).not.toBeInTheDocument()
    })

    it('redirects to role selection when user has no active role (non-admin)', () => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
        activeRole: null,
      } as any)

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthProvider>
            <RequireRole roles={['caregiver']}>
              <div>Role Protected Content</div>
            </RequireRole>
          </AuthProvider>
        </MemoryRouter>
      )

      expect(screen.queryByText('Role Protected Content')).not.toBeInTheDocument()
    })

    it('renders children when user has required role', () => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
        activeRole: 'caregiver',
      } as any)

      render(
        <MemoryRouter>
          <AuthProvider>
            <RequireRole roles={['caregiver']}>
              <div>Role Protected Content</div>
            </RequireRole>
          </AuthProvider>
        </MemoryRouter>
      )

      expect(screen.getByText('Role Protected Content')).toBeInTheDocument()
    })

    it('redirects when user does not have required role', () => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
        activeRole: 'caregiver',
      } as any)

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthProvider>
            <RequireRole roles={['hirer']}>
              <div>Hirer Only Content</div>
            </RequireRole>
          </AuthProvider>
        </MemoryRouter>
      )

      expect(screen.queryByText('Hirer Only Content')).not.toBeInTheDocument()
    })

    it('allows admin users without active role', () => {
      const adminUser: User = {
        ...mockUser,
        role: 'admin',
      }

      mockUseAuth.mockReturnValue({
        user: adminUser,
        isLoading: false,
        isAuthenticated: true,
        activeRole: null,
      } as any)

      render(
        <MemoryRouter>
          <AuthProvider>
            <RequireRole roles={['admin']}>
              <div>Admin Content</div>
            </RequireRole>
          </AuthProvider>
        </MemoryRouter>
      )

      expect(screen.getByText('Admin Content')).toBeInTheDocument()
    })
  })

  describe('RequireProfile', () => {
    const baseUser: User = {
      id: '1',
      email: 'test@example.com',
      phone_number: '+1234567890',
      role: 'hirer',
      account_type: 'member',
      trust_level: 'L1',
      trust_score: 75,
      status: 'active',
      is_email_verified: true,
      is_phone_verified: true,
      completed_jobs_count: 5,
      first_job_waiver_used: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }

    it('allows users with full name format', () => {
      mockUseAuth.mockReturnValue({
        user: {
          ...baseUser,
          name: 'สมชาย ใจดี',
        },
        isLoading: false,
        isAuthenticated: true,
        activeRole: 'hirer',
      } as any)

      render(
        <MemoryRouter>
          <AuthProvider>
            <RequireProfile>
              <div>Profile Protected Content</div>
            </RequireProfile>
          </AuthProvider>
        </MemoryRouter>
      )

      expect(screen.getByText('Profile Protected Content')).toBeInTheDocument()
    })

    it('redirects users with unconfigured generated name', () => {
      mockUseAuth.mockReturnValue({
        user: {
          ...baseUser,
          name: 'ผู้ว่าจ้าง A1B2',
        },
        isLoading: false,
        isAuthenticated: true,
        activeRole: 'hirer',
      } as any)

      render(
        <MemoryRouter initialEntries={['/hirer/home']}>
          <AuthProvider>
            <RequireProfile>
              <div>Profile Protected Content</div>
            </RequireProfile>
          </AuthProvider>
        </MemoryRouter>
      )

      expect(screen.queryByText('Profile Protected Content')).not.toBeInTheDocument()
    })
  })

  describe('RequireAdmin', () => {
    it('renders children for admin users', () => {
      const adminUser: User = {
        id: '1',
        email: 'admin@example.com',
        phone_number: '+1234567890',
        role: 'admin',
        account_type: 'member',
        trust_level: 'L3',
        trust_score: 100,
        status: 'active',
        is_email_verified: true,
        is_phone_verified: true,
        completed_jobs_count: 0,
        first_job_waiver_used: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      mockUseAuth.mockReturnValue({
        user: adminUser,
        isLoading: false,
        isAuthenticated: true,
        activeRole: 'admin',
      } as any)

      render(
        <MemoryRouter>
          <AuthProvider>
            <RequireAdmin>
              <div>Admin Only Content</div>
            </RequireAdmin>
          </AuthProvider>
        </MemoryRouter>
      )

      expect(screen.getByText('Admin Only Content')).toBeInTheDocument()
    })

    it('redirects non-admin users', () => {
      const regularUser: User = {
        id: '1',
        email: 'user@example.com',
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

      mockUseAuth.mockReturnValue({
        user: regularUser,
        isLoading: false,
        isAuthenticated: true,
        activeRole: 'caregiver',
      } as any)

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <AuthProvider>
            <RequireAdmin>
              <div>Admin Only Content</div>
            </RequireAdmin>
          </AuthProvider>
        </MemoryRouter>
      )

      expect(screen.queryByText('Admin Only Content')).not.toBeInTheDocument()
    })
  })
})
