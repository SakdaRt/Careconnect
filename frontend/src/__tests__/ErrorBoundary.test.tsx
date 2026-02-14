import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ErrorBoundary, RouteErrorFallback } from '../components/ErrorBoundary'

import '@testing-library/jest-dom'

function ThrowingComponent({ error }: { error?: Error }) {
  if (error) throw error
  return <div>Safe content</div>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Suppress console.error from React's error boundary logging
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Hello</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('catches rendering errors and shows fallback UI', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent error={new Error('Test crash')} />
      </ErrorBoundary>
    )

    expect(screen.queryByText('Safe content')).not.toBeInTheDocument()
    expect(screen.getByText('เกิดข้อผิดพลาด')).toBeInTheDocument()
    expect(screen.getByText('ลองใหม่')).toBeInTheDocument()
    expect(screen.getByText('กลับหน้าหลัก')).toBeInTheDocument()
  })

  it('resets error state when retry button is clicked', () => {
    let shouldThrow = true

    function ConditionalThrower() {
      if (shouldThrow) throw new Error('Boom')
      return <div>Recovered</div>
    }

    const { rerender } = render(
      <ErrorBoundary>
        <ConditionalThrower />
      </ErrorBoundary>
    )

    expect(screen.getByText('เกิดข้อผิดพลาด')).toBeInTheDocument()

    // Fix the error condition before clicking retry
    shouldThrow = false

    fireEvent.click(screen.getByText('ลองใหม่'))

    // After reset, ErrorBoundary re-renders children
    // Since shouldThrow is now false, it should render successfully
    rerender(
      <ErrorBoundary>
        <ConditionalThrower />
      </ErrorBoundary>
    )

    expect(screen.getByText('Recovered')).toBeInTheDocument()
  })

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <ThrowingComponent error={new Error('Crash')} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom error UI')).toBeInTheDocument()
    expect(screen.queryByText('เกิดข้อผิดพลาด')).not.toBeInTheDocument()
  })

  it('logs error to console', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <ThrowingComponent error={new Error('Logged error')} />
      </ErrorBoundary>
    )

    expect(consoleSpy).toHaveBeenCalled()
    const loggedArgs = consoleSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('[ErrorBoundary]')
    )
    expect(loggedArgs).toBeDefined()
  })
})

describe('RouteErrorFallback', () => {
  it('renders not-found UI with home button', () => {
    render(<RouteErrorFallback />)

    expect(screen.getByText('ไม่พบหน้าที่ต้องการ')).toBeInTheDocument()
    expect(screen.getByText('กลับหน้าหลัก')).toBeInTheDocument()
  })
})
