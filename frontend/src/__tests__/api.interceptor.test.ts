import { describe, it, expect, vi, beforeEach } from 'vitest'
import api from '../services/api'

/**
 * Tests for ApiClient token management, 401 auto-refresh, and stampede prevention.
 *
 * Note: setup.ts replaces window.localStorage with vi.fn() stubs.
 * We give them a real backing Map so getItem/setItem/removeItem work end-to-end
 * while still being spyable.
 */

// Helper to create a mock Response
function mockResponse(status: number, body: any): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
    headers: new Headers(),
    redirected: false,
    statusText: 'OK',
    type: 'basic',
    url: '',
    clone: function () { return mockResponse(status, body) },
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response
}

describe('API Interceptor', () => {
  /** Backing store for the mocked localStorage */
  let store: Map<string, string>
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    store = new Map()

    // Wire the vi.fn() stubs from setup.ts to a real backing store
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => store.get(key) ?? null)
    vi.mocked(localStorage.setItem).mockImplementation((key: string, val: string) => { store.set(key, val) })
    vi.mocked(localStorage.removeItem).mockImplementation((key: string) => { store.delete(key) })
    vi.mocked(localStorage.clear).mockImplementation(() => { store.clear() })

    // Mock global fetch
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockReset()
  })

  describe('Token Management', () => {
    it('should store and retrieve auth token via localStorage', () => {
      localStorage.setItem('careconnect_token', 'test-token')
      expect(localStorage.getItem('careconnect_token')).toBe('test-token')
    })

    it('should set auth token in localStorage', () => {
      localStorage.setItem('careconnect_token', 'new-token')
      expect(localStorage.getItem('careconnect_token')).toBe('new-token')
    })

    it('clearTokens removes all auth keys', () => {
      localStorage.setItem('careconnect_token', 't')
      localStorage.setItem('careconnect_refresh_token', 'r')
      localStorage.setItem('careconnect_user', 'u')

      api.clearTokens()

      expect(localStorage.getItem('careconnect_token')).toBeNull()
      expect(localStorage.getItem('careconnect_refresh_token')).toBeNull()
      expect(localStorage.getItem('careconnect_user')).toBeNull()
    })
  })

  describe('Request Header Attachment', () => {
    it('should attach Authorization header when token exists', async () => {
      store.set('careconnect_token', 'my-token')

      mockFetch.mockResolvedValueOnce(
        mockResponse(200, { success: true, data: { ok: true } })
      )

      await api.request('/api/test')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [, init] = mockFetch.mock.calls[0]
      expect((init?.headers as Record<string, string>)['Authorization']).toBe('Bearer my-token')
    })

    it('should not attach Authorization header when requireAuth is false', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(200, { success: true, data: { ok: true } })
      )

      await api.request('/api/test', { requireAuth: false })

      const [, init] = mockFetch.mock.calls[0]
      expect((init?.headers as Record<string, string>)['Authorization']).toBeUndefined()
    })
  })

  describe('401 Auto-Refresh', () => {
    it('should refresh token on 401 and retry the request', async () => {
      store.set('careconnect_token', 'expired')
      store.set('careconnect_refresh_token', 'valid-rt')

      // 1st call: 401
      // 2nd call: refresh endpoint succeeds
      // 3rd call: retry original succeeds
      mockFetch
        .mockResolvedValueOnce(mockResponse(401, { error: 'Unauthorized' }))
        .mockResolvedValueOnce(mockResponse(200, {
          success: true,
          data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
        }))
        .mockResolvedValueOnce(mockResponse(200, { success: true, data: { result: 'ok' } }))

      const res = await api.request<{ result: string }>('/api/protected')

      expect(res.success).toBe(true)
      expect(res.data).toEqual({ result: 'ok' })
      expect(mockFetch).toHaveBeenCalledTimes(3)

      // Verify new tokens were stored
      expect(store.get('careconnect_token')).toBe('new-access')
      expect(store.get('careconnect_refresh_token')).toBe('new-refresh')
    })

    it('should clear tokens when refresh fails', async () => {
      store.set('careconnect_token', 'expired')
      store.set('careconnect_refresh_token', 'bad-rt')

      // 1st call: 401
      // 2nd call: refresh endpoint fails
      mockFetch
        .mockResolvedValueOnce(mockResponse(401, { error: 'Unauthorized' }))
        .mockResolvedValueOnce(mockResponse(401, { error: 'Invalid refresh token' }))

      const res = await api.request('/api/protected')

      expect(res.success).toBe(false)
      // Tokens should be cleared
      expect(store.has('careconnect_token')).toBe(false)
      expect(store.has('careconnect_refresh_token')).toBe(false)
      expect(store.has('careconnect_user')).toBe(false)
    })

    it('should not attempt refresh when no refresh token exists', async () => {
      store.set('careconnect_token', 'expired')
      // No refresh token

      mockFetch
        .mockResolvedValueOnce(mockResponse(401, { error: 'Unauthorized' }))

      const res = await api.request('/api/protected')

      expect(res.success).toBe(false)
      // Only 1 fetch call + the clearTokens call (no refresh attempted)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should not refresh on auth endpoints (prevents infinite loop)', async () => {
      store.set('careconnect_token', 'expired')
      store.set('careconnect_refresh_token', 'valid-rt')

      mockFetch
        .mockResolvedValueOnce(mockResponse(401, { error: 'Unauthorized' }))

      const res = await api.request('/api/auth/refresh', { method: 'POST', body: {} })

      expect(res.success).toBe(false)
      // Only 1 call — no refresh attempted for auth endpoints
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should not retry more than once (prevents infinite retry)', async () => {
      store.set('careconnect_token', 'expired')
      store.set('careconnect_refresh_token', 'valid-rt')

      // 1st call: 401
      // 2nd call: refresh succeeds
      // 3rd call: retry also returns 401
      mockFetch
        .mockResolvedValueOnce(mockResponse(401, { error: 'Unauthorized' }))
        .mockResolvedValueOnce(mockResponse(200, {
          success: true,
          data: { accessToken: 'still-bad', refreshToken: 'new-rt' },
        }))
        .mockResolvedValueOnce(mockResponse(401, { error: 'Still unauthorized' }))

      const res = await api.request('/api/protected')

      expect(res.success).toBe(false)
      // 3 calls total: original + refresh + retry. No further retries.
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })
  })

  describe('Parallel 401 Stampede Prevention', () => {
    it('should share a single refresh call across parallel 401s', async () => {
      store.set('careconnect_token', 'expired')
      store.set('careconnect_refresh_token', 'valid-rt')

      let refreshCallCount = 0

      mockFetch.mockImplementation(async (input: any) => {
        const url = typeof input === 'string' ? input : input.url
        if (url.includes('/api/auth/refresh')) {
          refreshCallCount++
          return mockResponse(200, {
            success: true,
            data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
          })
        }
        // First round: all return 401 if token is still 'expired'
        // After refresh: token is 'new-access', so succeed
        const token = store.get('careconnect_token')
        if (token === 'expired') {
          return mockResponse(401, { error: 'Unauthorized' })
        }
        return mockResponse(200, { success: true, data: { ok: true } })
      })

      // Fire 3 parallel requests
      const results = await Promise.all([
        api.request('/api/endpoint-1'),
        api.request('/api/endpoint-2'),
        api.request('/api/endpoint-3'),
      ])

      // All should succeed after refresh
      for (const r of results) {
        expect(r.success).toBe(true)
      }

      // Only ONE refresh call should have been made (stampede prevention)
      expect(refreshCallCount).toBe(1)
    })
  })

  describe('Non-401 Error Passthrough', () => {
    it('should pass through 403 errors without refresh attempt', async () => {
      store.set('careconnect_token', 'valid')
      store.set('careconnect_refresh_token', 'valid-rt')

      mockFetch
        .mockResolvedValueOnce(mockResponse(403, { error: 'Forbidden' }))

      const res = await api.request('/api/admin-only')

      expect(res.success).toBe(false)
      expect(res.error).toBe('Forbidden')
      // Only 1 call — no refresh attempted
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should pass through 500 errors without refresh attempt', async () => {
      store.set('careconnect_token', 'valid')

      mockFetch
        .mockResolvedValueOnce(mockResponse(500, { error: 'Server error' }))

      const res = await api.request('/api/broken')

      expect(res.success).toBe(false)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })
})
