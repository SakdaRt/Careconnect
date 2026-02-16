/**
 * API Client
 * Base HTTP client for making API requests to the backend
 */

import { clearScopedStorageItems, getScopedStorageItem, setScopedStorageItem } from '../utils/authStorage';

// In development, use the Vite proxy (empty string), in production use the API URL
const env = (import.meta as any).env as Record<string, string | undefined>;
const API_BASE_URL = env.VITE_API_URL || env.VITE_API_BASE_URL || '';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
  details?: any;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  requireAuth?: boolean;
}

class ApiClient {
  private baseUrl: string;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private toOptionalNumber(value: unknown): number | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private normalizeCareRecipient(input: any): CareRecipient {
    if (!input || typeof input !== 'object') return input as CareRecipient;
    return {
      ...input,
      lat: this.toOptionalNumber(input.lat),
      lng: this.toOptionalNumber(input.lng),
    } as CareRecipient;
  }

  private getAuthToken(): string | null {
    return getScopedStorageItem('careconnect_token');
  }

  private setAuthToken(token: string): void {
    setScopedStorageItem('careconnect_token', token);
  }

  private setRefreshToken(token: string): void {
    setScopedStorageItem('careconnect_refresh_token', token);
  }

  clearTokens(): void {
    clearScopedStorageItems([
      'careconnect_token',
      'careconnect_refresh_token',
      'careconnect_user',
      'careconnect_active_role',
      'pendingRole',
      'pendingAccountType',
    ]);
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { method = 'GET', body, headers = {}, requireAuth = true } = options;

    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

    const requestHeaders: Record<string, string> = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    };

    const requestBody =
      body === undefined
        ? undefined
        : isFormData
          ? body
          : JSON.stringify(body);

    if (requireAuth) {
      const token = this.getAuthToken();
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: requestHeaders,
        body: requestBody,
      });

      const rawText = await response.text();
      let parsed: unknown = null;
      if (rawText) {
        try {
          parsed = JSON.parse(rawText);
        } catch {
          parsed = rawText;
        }
      }

      if (!response.ok) {
        // 401 auto-refresh: attempt ONCE, then retry the original request
        if (
          response.status === 401 &&
          requireAuth &&
          !(options as any)._retried &&
          !ApiClient.NO_REFRESH_ENDPOINTS.includes(endpoint)
        ) {
          const refreshed = await this.attemptRefresh();
          if (refreshed) {
            return this.request<T>(endpoint, { ...options, _retried: true } as any);
          }
          // Refresh failed — clear everything
          this.clearTokens();
        }

        let errorMessage: string;
        if (typeof parsed === 'object' && parsed) {
          const p = parsed as any;
          const rawErr = p.message || p.error;
          errorMessage = (typeof rawErr === 'string') ? rawErr : (typeof rawErr === 'object' && rawErr?.message) ? rawErr.message : 'Request failed';
        } else {
          errorMessage = rawText || 'Request failed';
        }
        return {
          success: false,
          error: errorMessage,
          code: typeof parsed === 'object' && parsed ? (parsed as any).code : undefined,
          details: typeof parsed === 'object' && parsed ? (parsed as any).details : undefined,
        };
      }

      if (typeof parsed === 'object' && parsed && 'success' in (parsed as any)) {
        const result = parsed as ApiResponse<T>;
        // Sanitize error: ensure it is always a string (API may return {code, message} objects)
        if (result.error && typeof result.error !== 'string') {
          const errObj = result.error as unknown as Record<string, unknown>;
          result.error = (typeof errObj.message === 'string' && errObj.message) || (typeof errObj.code === 'string' && errObj.code) || 'Request failed';
        }
        return result;
      }

      return {
        success: true,
        data: parsed as T,
      };
    } catch (error) {
      console.error('[API Client] Request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /** Send a FormData request (for file uploads). Does NOT set Content-Type — browser adds multipart boundary. */
  async requestFormData<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    const requestHeaders: Record<string, string> = {};
    const token = this.getAuthToken();
    if (token) requestHeaders['Authorization'] = `Bearer ${token}`;

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: requestHeaders,
        body: formData,
      });

      const rawText = await response.text();
      let parsed: unknown = null;
      if (rawText) {
        try { parsed = JSON.parse(rawText); } catch { parsed = rawText; }
      }

      if (!response.ok) {
        if (response.status === 401) {
          const refreshed = await this.attemptRefresh();
          if (refreshed) return this.requestFormData<T>(endpoint, formData);
          this.clearTokens();
        }
        let errorMessage: string;
        if (typeof parsed === 'object' && parsed) {
          const p = parsed as any;
          const rawErr = p.message || p.error;
          errorMessage = (typeof rawErr === 'string') ? rawErr : (typeof rawErr === 'object' && rawErr?.message) ? rawErr.message : 'Request failed';
        } else {
          errorMessage = rawText || 'Request failed';
        }
        return { success: false, error: errorMessage, code: typeof parsed === 'object' && parsed ? (parsed as any).code : undefined };
      }

      if (typeof parsed === 'object' && parsed && 'success' in (parsed as any)) {
        const result = parsed as ApiResponse<T>;
        if (result.error && typeof result.error !== 'string') {
          const errObj = result.error as unknown as Record<string, unknown>;
          result.error = (typeof errObj.message === 'string' && errObj.message) || (typeof errObj.code === 'string' && errObj.code) || 'Request failed';
        }
        return result;
      }
      return { success: true, data: parsed as T };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  }

  // Auth endpoints
  async registerGuest(email: string, password: string, role: string) {
    const response = await this.request<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>('/api/auth/register/guest', {
      method: 'POST',
      body: { email, password, role },
      requireAuth: false,
    });

    if (response.success && response.data) {
      this.setAuthToken(response.data.accessToken);
      this.setRefreshToken(response.data.refreshToken);
    }

    return response;
  }

  async registerMember(phone_number: string, password: string, role: string, email?: string) {
    const response = await this.request<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>('/api/auth/register/member', {
      method: 'POST',
      body: { phone_number, password, role, email },
      requireAuth: false,
    });

    if (response.success && response.data) {
      this.setAuthToken(response.data.accessToken);
      this.setRefreshToken(response.data.refreshToken);
    }

    return response;
  }

  async loginWithEmail(email: string, password: string) {
    const response = await this.request<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>('/api/auth/login/email', {
      method: 'POST',
      body: { email, password },
      requireAuth: false,
    });

    if (response.success && response.data) {
      this.setAuthToken(response.data.accessToken);
      this.setRefreshToken(response.data.refreshToken);
    }

    return response;
  }

  async loginWithPhone(phone_number: string, password: string) {
    const response = await this.request<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>('/api/auth/login/phone', {
      method: 'POST',
      body: { phone_number, password },
      requireAuth: false,
    });

    if (response.success && response.data) {
      this.setAuthToken(response.data.accessToken);
      this.setRefreshToken(response.data.refreshToken);
    }

    return response;
  }

  async getCurrentUser() {
    return this.request<{ user: User }>('/api/auth/me');
  }

  async getMyProfile() {
    return this.request<{ role: User['role']; profile: HirerProfile | CaregiverProfile | null }>('/api/auth/profile');
  }

  async updateMyProfile(payload: Partial<UserProfile> & { display_name: string }) {
    return this.request<{ profile: HirerProfile | CaregiverProfile }>('/api/auth/profile', {
      method: 'PUT',
      body: payload,
    });
  }

  async updatePhoneNumber(phone_number: string) {
    return this.request<{ phone_number: string; is_phone_verified: boolean }>('/api/auth/phone', {
      method: 'POST',
      body: { phone_number },
    });
  }

  async updateEmailAddress(email: string) {
    return this.request<{ email: string; is_email_verified: boolean }>('/api/auth/email', {
      method: 'POST',
      body: { email },
    });
  }

  async acceptPolicy(role: 'hirer' | 'caregiver', version_policy_accepted: string) {
    const response = await this.request<{ policy_acceptances: Record<string, { policy_accepted_at: string; version_policy_accepted: string }> }>(
      '/api/auth/policy/accept',
      {
        method: 'POST',
        body: { role, version_policy_accepted },
      }
    );
    if (!response.success && response.error === 'Not Found') {
      return this.request<{ policy_acceptances: Record<string, { policy_accepted_at: string; version_policy_accepted: string }> }>(
        '/api/auth/consent',
        {
          method: 'POST',
          body: { role, version_policy_accepted },
        }
      );
    }
    return response;
  }

  async updateRole(role: 'hirer' | 'caregiver') {
    return this.request<{ user: User }>('/api/auth/role', {
      method: 'POST',
      body: { role },
    });
  }

  async logout() {
    const response = await this.request('/api/auth/logout', { method: 'POST' });
    this.clearTokens();
    return response;
  }

  // OTP endpoints
  async sendEmailOtp() {
    return this.request<{ otp_id: string; email: string; expires_in: number }>(
      '/api/otp/email/send',
      { method: 'POST' }
    );
  }

  async sendPhoneOtp() {
    return this.request<{ otp_id: string; phone_number: string; expires_in: number }>(
      '/api/otp/phone/send',
      { method: 'POST' }
    );
  }

  async verifyOtp(otp_id: string, code: string) {
    return this.request<{
      type: 'email' | 'phone';
      is_email_verified: boolean;
      is_phone_verified: boolean;
      trust_level: string;
    }>('/api/otp/verify', {
      method: 'POST',
      body: { otp_id, code },
    });
  }

  async resendOtp(otp_id: string) {
    return this.request<{ otp_id: string; expires_in: number }>('/api/otp/resend', {
      method: 'POST',
      body: { otp_id },
    });
  }

  // Wallet endpoints
  async getWallet() {
    const raw: any = await this.request<any>(`/api/wallet/balance?_=${Date.now()}`);
    if (!raw.success) return raw as ApiResponse<WalletBalance>;
    return {
      success: true,
      data: {
        wallet_id: raw.wallet_id,
        wallet_type: raw.wallet_type,
        currency: raw.currency,
        available_balance: raw.available_balance,
        held_balance: raw.held_balance,
        total_balance: raw.total_balance,
      } satisfies WalletBalance,
    } as ApiResponse<WalletBalance>;
  }

  async getWalletTransactions(page?: number, limit?: number) {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    const sep = query ? '&' : '?';
    const raw: any = await this.request<any>(`/api/wallet/transactions${query}${sep}_=${Date.now()}`);
    if (!raw.success) return raw as ApiResponse<Paginated<Transaction>>;
    return {
      success: true,
      data: {
        data: raw.data || [],
        total: raw.total || 0,
        page: raw.page || page || 1,
        limit: raw.limit || limit || 20,
        totalPages: raw.totalPages || 1,
      },
    } as ApiResponse<Paginated<Transaction>>;
  }

  async topUpWallet(amount: number, payment_method: string) {
    const raw: any = await this.request<any>('/api/wallet/topup', {
      method: 'POST',
      body: { amount, payment_method },
    });
    if (!raw.success) return raw as ApiResponse<TopupResult>;
    return {
      success: true,
      data: {
        topup_id: raw.topup_id,
        amount: raw.amount,
        status: raw.status,
        payment_method: raw.payment_method,
        payment_url: raw.payment_url,
        qr_code: raw.qr_code,
        expires_at: raw.expires_at,
        message: raw.message,
      },
    } as ApiResponse<TopupResult>;
  }

  async getPendingTopups() {
    const raw: any = await this.request<any>(`/api/wallet/topup/pending?_=${Date.now()}`);
    if (!raw.success) return raw as ApiResponse<TopupIntent[]>;
    return { success: true, data: raw.data || [] } as ApiResponse<TopupIntent[]>;
  }

  async getTopupStatus(topupId: string) {
    const raw: any = await this.request<any>(`/api/wallet/topup/${topupId}?_=${Date.now()}`);
    if (!raw.success) return raw as ApiResponse<TopupIntent>;
    return { success: true, data: raw.topup } as ApiResponse<TopupIntent>;
  }

  async confirmTopupPayment(topupId: string) {
    const raw: any = await this.request<any>(`/api/wallet/topup/${topupId}/confirm`, {
      method: 'POST',
    });
    if (!raw.success) {
      return raw as ApiResponse<{ topup: TopupIntent; wallet: WalletBalance | null }>;
    }
    return {
      success: true,
      data: {
        topup: raw.topup,
        wallet: raw.wallet || null,
      },
    } as ApiResponse<{ topup: TopupIntent; wallet: WalletBalance | null }>;
  }

  async getBankAccounts() {
    const raw: any = await this.request<any>('/api/wallet/bank-accounts');
    if (!raw.success) return raw as ApiResponse<BankAccount[]>;
    return { success: true, data: raw.data || [] } as ApiResponse<BankAccount[]>;
  }

  async addBankAccount(input: {
    bank_code: string;
    bank_name?: string;
    account_number: string;
    account_name: string;
    set_primary?: boolean;
  }) {
    const raw: any = await this.request<any>('/api/wallet/bank-accounts', {
      method: 'POST',
      body: input,
    });
    if (!raw.success) return raw as ApiResponse<{ bank_account: BankAccount; message?: string }>;
    return {
      success: true,
      data: { bank_account: raw.bank_account, message: raw.message },
    } as ApiResponse<{ bank_account: BankAccount; message?: string }>;
  }

  async initiateWithdrawal(amount: number, bank_account_id: string) {
    const raw: any = await this.request<any>('/api/wallet/withdraw', {
      method: 'POST',
      body: { amount, bank_account_id },
    });
    if (!raw.success) {
      return raw as ApiResponse<{ withdrawal_id: string; amount: number; status: string; message?: string }>;
    }
    return {
      success: true,
      data: {
        withdrawal_id: raw.withdrawal_id,
        amount: raw.amount,
        status: raw.status,
        message: raw.message,
      },
    } as ApiResponse<{ withdrawal_id: string; amount: number; status: string; message?: string }>;
  }

  async getWithdrawals(options?: { page?: number; limit?: number; status?: string }) {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', String(options.page));
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.status) params.append('status', String(options.status));
    const query = params.toString() ? `?${params.toString()}` : '';
    const raw: any = await this.request<any>(`/api/wallet/withdrawals${query}`);
    if (!raw.success) return raw as ApiResponse<Paginated<WithdrawalRequest>>;
    return {
      success: true,
      data: {
        data: raw.data || [],
        total: raw.total || 0,
        page: raw.page || options?.page || 1,
        limit: raw.limit || options?.limit || 20,
        totalPages: raw.totalPages || 1,
      },
    } as ApiResponse<Paginated<WithdrawalRequest>>;
  }

  async cancelWithdrawal(withdrawalId: string) {
    const raw: any = await this.request<any>(`/api/wallet/withdrawals/${withdrawalId}/cancel`, { method: 'POST' });
    if (!raw.success) return raw as ApiResponse<{ withdrawal_id: string; status: string; message?: string }>;
    return {
      success: true,
      data: { withdrawal_id: raw.withdrawal_id, status: raw.status, message: raw.message },
    } as ApiResponse<{ withdrawal_id: string; status: string; message?: string }>;
  }

  async adminGetWithdrawals(options?: { page?: number; limit?: number; status?: string }) {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', String(options.page));
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.status) params.append('status', String(options.status));
    const query = params.toString() ? `?${params.toString()}` : '';
    const raw: any = await this.request<any>(`/api/wallet/admin/withdrawals${query}`);
    if (!raw.success) return raw as ApiResponse<Paginated<WithdrawalRequest>>;
    return {
      success: true,
      data: {
        data: raw.data || [],
        total: raw.total || 0,
        page: raw.page || options?.page || 1,
        limit: raw.limit || options?.limit || 20,
        totalPages: raw.totalPages || 1,
      },
    } as ApiResponse<Paginated<WithdrawalRequest>>;
  }

  async adminReviewWithdrawal(withdrawalId: string) {
    const raw: any = await this.request<any>(`/api/wallet/admin/withdrawals/${withdrawalId}/review`, { method: 'POST' });
    if (!raw.success) return raw as ApiResponse<{ withdrawal: WithdrawalRequest }>;
    return { success: true, data: { withdrawal: raw.withdrawal } } as ApiResponse<{ withdrawal: WithdrawalRequest }>;
  }

  async adminApproveWithdrawal(withdrawalId: string) {
    const raw: any = await this.request<any>(`/api/wallet/admin/withdrawals/${withdrawalId}/approve`, { method: 'POST' });
    if (!raw.success) return raw as ApiResponse<{ withdrawal: WithdrawalRequest }>;
    return { success: true, data: { withdrawal: raw.withdrawal } } as ApiResponse<{ withdrawal: WithdrawalRequest }>;
  }

  async adminRejectWithdrawal(withdrawalId: string, reason?: string) {
    const raw: any = await this.request<any>(`/api/wallet/admin/withdrawals/${withdrawalId}/reject`, {
      method: 'POST',
      body: { reason },
    });
    if (!raw.success) return raw as ApiResponse<{ withdrawal: WithdrawalRequest }>;
    return { success: true, data: { withdrawal: raw.withdrawal } } as ApiResponse<{ withdrawal: WithdrawalRequest }>;
  }

  async adminMarkWithdrawalPaid(withdrawalId: string, payout_reference?: string) {
    const raw: any = await this.request<any>(`/api/wallet/admin/withdrawals/${withdrawalId}/mark-paid`, {
      method: 'POST',
      body: { payout_reference },
    });
    if (!raw.success) return raw as ApiResponse<{ withdrawal: WithdrawalRequest }>;
    return { success: true, data: { withdrawal: raw.withdrawal } } as ApiResponse<{ withdrawal: WithdrawalRequest }>;
  }

  async adminGetUsers(options?: { q?: string; role?: string; status?: string; page?: number; limit?: number }) {
    const params = new URLSearchParams();
    if (options?.q) params.append('q', options.q);
    if (options?.role) params.append('role', options.role);
    if (options?.status) params.append('status', options.status);
    if (options?.page) params.append('page', String(options.page));
    if (options?.limit) params.append('limit', String(options.limit));
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<Paginated<AdminUserListItem>>(`/api/admin/users${query}`);
  }

  async adminGetUser(userId: string) {
    return this.request<{ user: AdminUserListItem & { profile?: any } }>(`/api/admin/users/${userId}`);
  }

  async adminSetUserStatus(userId: string, status: 'active' | 'suspended' | 'deleted', reason?: string) {
    return this.request<{ user: AdminUserListItem }>(`/api/admin/users/${userId}/status`, {
      method: 'POST',
      body: { status, reason },
    });
  }

  async adminGetJobs(options?: {
    q?: string;
    status?: string;
    risk_level?: string;
    job_type?: string;
    page?: number;
    limit?: number;
  }) {
    const params = new URLSearchParams();
    if (options?.q) params.append('q', options.q);
    if (options?.status) params.append('status', options.status);
    if (options?.risk_level) params.append('risk_level', options.risk_level);
    if (options?.job_type) params.append('job_type', options.job_type);
    if (options?.page) params.append('page', String(options.page));
    if (options?.limit) params.append('limit', String(options.limit));
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<Paginated<AdminJobListItem>>(`/api/admin/jobs${query}`);
  }

  async adminGetJob(id: string) {
    return this.request<{ job: AdminJobListItem }>(`/api/admin/jobs/${id}`);
  }

  async adminCancelJob(id: string, reason: string) {
    return this.request<{ job_post_id: string; job_id?: string | null; status: string }>(`/api/admin/jobs/${id}/cancel`, {
      method: 'POST',
      body: { reason },
    });
  }

  async adminGetLedgerTransactions(options?: {
    reference_type?: string;
    reference_id?: string;
    wallet_id?: string;
    type?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const params = new URLSearchParams();
    if (options?.reference_type) params.append('reference_type', options.reference_type);
    if (options?.reference_id) params.append('reference_id', options.reference_id);
    if (options?.wallet_id) params.append('wallet_id', options.wallet_id);
    if (options?.type) params.append('type', options.type);
    if (options?.from) params.append('from', options.from);
    if (options?.to) params.append('to', options.to);
    if (options?.page) params.append('page', String(options.page));
    if (options?.limit) params.append('limit', String(options.limit));
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<Paginated<AdminLedgerTransaction>>(`/api/admin/ledger/transactions${query}`);
  }

  async adminGetHealth() {
    return this.request<{ ok: boolean; db: string; now: string }>('/api/admin/health');
  }

  async adminGetStats() {
    return this.request<{ users: Record<string, number>; jobs: Record<string, number>; wallets: any[] }>('/api/admin/stats');
  }

  async adminRecalcTrustAll() {
    return this.request<any>('/api/admin/trust/recalculate', { method: 'POST' });
  }

  async adminRecalcTrustUser(userId: string) {
    return this.request<any>(`/api/admin/trust/recalculate/${userId}`, { method: 'POST' });
  }

  async adminGetDisputes(options?: { q?: string; status?: string; assigned?: string; page?: number; limit?: number }) {
    const params = new URLSearchParams();
    if (options?.q) params.append('q', options.q);
    if (options?.status) params.append('status', options.status);
    if (options?.assigned) params.append('assigned', options.assigned);
    if (options?.page) params.append('page', String(options.page));
    if (options?.limit) params.append('limit', String(options.limit));
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<Paginated<AdminDisputeListItem>>(`/api/admin/disputes${query}`);
  }

  async adminGetDispute(id: string) {
    return this.request<{ dispute: AdminDisputeListItem; events: AdminDisputeEvent[]; messages: DisputeMessage[] }>(`/api/admin/disputes/${id}`);
  }

  async adminUpdateDispute(id: string, input: { status?: string; note?: string; assign_to_me?: boolean }) {
    return this.request<{ dispute: AdminDisputeListItem }>(`/api/admin/disputes/${id}`, {
      method: 'POST',
      body: input,
    });
  }

  async adminSettleDispute(id: string, input: { refund_amount?: number; payout_amount?: number; resolution?: string; idempotency_key?: string }) {
    return this.request<{ dispute: AdminDisputeListItem; settlement: { refund_amount: number; payout_amount: number } }>(
      `/api/admin/disputes/${id}/settle`,
      { method: 'POST', body: input }
    );
  }

  async createDispute(job_id: string, reason: string) {
    return this.request<{ dispute: { id: string } }>('/api/disputes', {
      method: 'POST',
      body: { job_id, reason },
    });
  }

  async getDispute(disputeId: string) {
    return this.request<{ dispute: any; events: AdminDisputeEvent[]; messages: DisputeMessage[] }>(`/api/disputes/${disputeId}`);
  }

  async postDisputeMessage(disputeId: string, content: string) {
    return this.request<{ message: DisputeMessage }>(`/api/disputes/${disputeId}/messages`, {
      method: 'POST',
      body: { content },
    });
  }

  async requestDisputeClose(disputeId: string, reason?: string) {
    return this.request<{ ok: boolean }>(`/api/disputes/${disputeId}/request-close`, {
      method: 'POST',
      body: { reason },
    });
  }

  async getDisputeByJob(jobId: string) {
    return this.request<{ dispute: any | null }>(`/api/disputes/by-job/${jobId}`);
  }

  async getKycStatus() {
    return this.request<{ kyc: KycStatus | null }>('/api/kyc/status');
  }

  async submitMockKyc(input: { full_name: string; national_id: string; document_type: string }) {
    return this.request<{ kyc: KycStatus }>('/api/kyc/mock/submit', {
      method: 'POST',
      body: input,
    });
  }

  async submitKyc(formData: FormData) {
    return this.request<{ kyc: KycStatus }>('/api/kyc/submit', {
      method: 'POST',
      body: formData,
    });
  }

  async getMyCaregiverDocuments() {
    return this.request<CaregiverDocument[]>('/api/caregiver-documents');
  }

  async uploadCaregiverDocument(formData: FormData) {
    return this.request<CaregiverDocument>('/api/caregiver-documents', {
      method: 'POST',
      body: formData,
    });
  }

  async deleteCaregiverDocument(docId: string) {
    return this.request<{ id: string }>(`/api/caregiver-documents/${docId}`, {
      method: 'DELETE',
    });
  }

  async getCaregiverDocumentsByCaregiver(caregiverId: string) {
    return this.request<CaregiverDocument[]>(`/api/caregiver-documents/by-caregiver/${caregiverId}`);
  }

  async getNotifications(page = 1, limit = 20, unreadOnly = false) {
    const params = new URLSearchParams();
    params.append('page', String(page));
    params.append('limit', String(limit));
    if (unreadOnly) params.append('unread_only', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<Paginated<AppNotification> & { unreadCount: number }>(`/api/notifications${query}`);
  }

  async getUnreadNotificationCount() {
    return this.request<{ count: number }>(`/api/notifications/unread-count?_=${Date.now()}`);
  }

  async markNotificationAsRead(notificationId: string) {
    return this.request<{ notification: AppNotification }>(`/api/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });
  }

  async markAllNotificationsAsRead() {
    return this.request<{ message?: string }>('/api/notifications/read-all', {
      method: 'PATCH',
    });
  }

  async getPayments(options?: {
    status?: string;
    page?: number;
    limit?: number;
    sort_by?: string;
    sort_order?: 'ASC' | 'DESC';
  }) {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', String(options.status));
    if (options?.page) params.append('page', String(options.page));
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.sort_by) params.append('sort_by', String(options.sort_by));
    if (options?.sort_order) params.append('sort_order', String(options.sort_order));
    const query = params.toString() ? `?${params.toString()}` : '';

    const raw: any = await this.request<any>(`/api/payments${query}`);
    if (!raw.success) return raw as ApiResponse<Paginated<Payment>>;

    const pagination = raw.pagination || {};
    return {
      success: true,
      data: {
        data: raw.data || [],
        total: pagination.total || 0,
        page: pagination.page || 1,
        limit: pagination.limit || 20,
        totalPages: pagination.pages || 1,
      },
    } as ApiResponse<Paginated<Payment>>;
  }

  async getPaymentById(paymentId: string) {
    return this.request<Payment>(`/api/payments/${paymentId}`);
  }

  async simulatePayment(paymentId: string) {
    const raw: any = await this.request<any>(`/api/payments/${paymentId}/simulate`, {
      method: 'POST',
    });
    if (!raw.success) return raw as ApiResponse<{ payment: Payment; ledgerEntry?: any }>;
    return {
      success: true,
      data: {
        payment: raw.data,
        ledgerEntry: raw.ledgerEntry,
      },
    } as ApiResponse<{ payment: Payment; ledgerEntry?: any }>;
  }

  async getCareRecipients() {
    const raw: any = await this.request<any>('/api/care-recipients');
    if (!raw.success) return raw as ApiResponse<CareRecipient[]>;
    const list = Array.isArray(raw.data) ? raw.data.map((item: any) => this.normalizeCareRecipient(item)) : [];
    return { success: true, data: list } as ApiResponse<CareRecipient[]>;
  }

  async getCareRecipient(id: string) {
    const raw: any = await this.request<any>(`/api/care-recipients/${id}`);
    if (!raw.success) return raw as ApiResponse<CareRecipient>;
    const data = raw.data ? this.normalizeCareRecipient(raw.data) : raw.data;
    return { success: true, data } as ApiResponse<CareRecipient>;
  }

  async createCareRecipient(input: Omit<CareRecipient, 'id' | 'hirer_id' | 'is_active' | 'created_at' | 'updated_at'>) {
    const raw: any = await this.request<any>('/api/care-recipients', { method: 'POST', body: input });
    if (!raw.success) return raw as ApiResponse<CareRecipient>;
    const data = raw.data ? this.normalizeCareRecipient(raw.data) : raw.data;
    return { success: true, data } as ApiResponse<CareRecipient>;
  }

  async updateCareRecipient(id: string, input: Partial<Omit<CareRecipient, 'id' | 'hirer_id' | 'is_active' | 'created_at' | 'updated_at'>>) {
    const raw: any = await this.request<any>(`/api/care-recipients/${id}`, { method: 'PUT', body: input });
    if (!raw.success) return raw as ApiResponse<CareRecipient>;
    const data = raw.data ? this.normalizeCareRecipient(raw.data) : raw.data;
    return { success: true, data } as ApiResponse<CareRecipient>;
  }

  async deactivateCareRecipient(id: string) {
    const raw: any = await this.request<any>(`/api/care-recipients/${id}`, { method: 'DELETE' });
    if (!raw.success) return raw as ApiResponse<CareRecipient>;
    return { success: true, data: raw.data } as ApiResponse<CareRecipient>;
  }

  // Job endpoints
  async getJobFeed(filters?: {
    job_type?: string;
    risk_level?: string;
    is_urgent?: boolean;
    page?: number;
    limit?: number;
  }) {
    const params = new URLSearchParams();
    if (filters?.job_type) params.append('job_type', filters.job_type);
    if (filters?.risk_level) params.append('risk_level', filters.risk_level);
    if (filters?.is_urgent !== undefined) params.append('is_urgent', String(filters.is_urgent));
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<{
      data: JobPost[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/api/jobs/feed${query}`);
  }

  async getMyJobs(status?: string, page?: number, limit?: number) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (page) params.append('page', String(page));
    if (limit) params.append('limit', String(limit));
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<{
      data: JobPost[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/api/jobs/my-jobs${query}`);
  }

  async getAssignedJobs(status?: string, page?: number, limit?: number) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (page) params.append('page', String(page));
    if (limit) params.append('limit', String(limit));
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<{
      data: CaregiverAssignedJob[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/api/jobs/assigned${query}`);
  }

  async getJobById(jobId: string) {
    return this.request<{ job: JobPost }>(`/api/jobs/${jobId}`);
  }

  async createJob(jobData: CreateJobData) {
    return this.request<{ job: JobPost }>('/api/jobs', {
      method: 'POST',
      body: jobData,
    });
  }

  async publishJob(jobPostId: string) {
    return this.request<{ job: JobPost }>(`/api/jobs/${jobPostId}/publish`, {
      method: 'POST',
    });
  }

  async acceptJob(jobId: string, message?: string) {
    return this.request<{
      job_id: string;
      assignment_id: string;
      chat_thread_id: string;
      escrow_amount: number;
    }>(`/api/jobs/${jobId}/accept`, {
      method: 'POST',
      body: { message },
    });
  }

  async checkIn(jobId: string, gpsData?: { lat: number; lng: number; accuracy_m?: number }) {
    return this.request<{ job: Job }>(`/api/jobs/${jobId}/checkin`, {
      method: 'POST',
      body: gpsData,
    });
  }

  async checkOut(jobId: string, gpsData?: { lat: number; lng: number; accuracy_m?: number }) {
    return this.request<{ job: Job }>(`/api/jobs/${jobId}/checkout`, {
      method: 'POST',
      body: gpsData,
    });
  }

  async cancelJob(jobId: string, reason: string) {
    return this.request<{ job: Job }>(`/api/jobs/${jobId}/cancel`, {
      method: 'POST',
      body: { reason },
    });
  }

  // Chat endpoints
  async getChatThread(jobId: string) {
    const raw: any = await this.request<any>(`/api/chat/job/${jobId}/thread`);
    if (!raw.success) return raw as ApiResponse<{ thread: ChatThread }>;
    return { success: true, data: { thread: raw.thread } } as ApiResponse<{ thread: ChatThread }>;
  }

  async getOrCreateChatThread(jobId: string) {
    const raw: any = await this.request<any>(`/api/chat/job/${jobId}/thread`, {
      method: 'POST',
    });
    if (!raw.success) return raw as ApiResponse<{ thread: ChatThread }>;
    return { success: true, data: { thread: raw.thread } } as ApiResponse<{ thread: ChatThread }>;
  }

  async getChatMessages(threadId: string, limit?: number, before?: string) {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (before) params.append('before', before);
    const query = params.toString() ? `?${params.toString()}` : '';
    const raw: any = await this.request<any>(`/api/chat/threads/${threadId}/messages${query}`);
    if (!raw.success) return raw as ApiResponse<Paginated<ChatMessage>>;
    return {
      success: true,
      data: {
        data: raw.data || [],
        total: raw.total || 0,
        page: raw.page || 1,
        limit: raw.limit || limit || 50,
        totalPages: raw.totalPages || 1,
      },
    } as ApiResponse<Paginated<ChatMessage>>;
  }

  async sendMessage(threadId: string, content: string, messageType: string = 'text') {
    const raw: any = await this.request<any>(`/api/chat/threads/${threadId}/messages`, {
      method: 'POST',
      body: { content, type: messageType },
    });
    if (!raw.success) return raw as ApiResponse<{ message: ChatMessage }>;
    return {
      success: true,
      data: { message: raw.message as ChatMessage },
    } as ApiResponse<{ message: ChatMessage }>;
  }

  // Token refresh
  static readonly NO_REFRESH_ENDPOINTS = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'];

  private async attemptRefresh(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      const refreshToken = getScopedStorageItem('careconnect_refresh_token');
      if (!refreshToken) return false;

      try {
        const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) return false;

        const data = await response.json();
        const tokenPayload = (typeof data?.data === 'object' && data?.data)
          ? data.data
          : data;
        if (data.success && tokenPayload?.accessToken) {
          setScopedStorageItem('careconnect_token', tokenPayload.accessToken);
          if (tokenPayload.refreshToken) {
            setScopedStorageItem('careconnect_refresh_token', tokenPayload.refreshToken);
          }
          return true;
        }
      } catch (error) {
        console.error('Token refresh failed:', error);
      }

      return false;
    })();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }
}

// Types
export interface User {
  id: string;
  email: string | null;
  phone_number: string | null;
  account_type: 'guest' | 'member';
  role: 'hirer' | 'caregiver' | 'admin';
  status: 'active' | 'suspended' | 'deleted';
  trust_level: 'L0' | 'L1' | 'L2' | 'L3';
  trust_score: number;
  name?: string;
  avatar?: string;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  completed_jobs_count: number;
  first_job_waiver_used: boolean;
  policy_acceptances?: Record<string, { policy_accepted_at: string; version_policy_accepted: string }>;
  created_at: string;
  updated_at: string;
}

export interface CaregiverProfile {
  id: string;
  user_id: string;
  display_name: string;
  is_public_profile?: boolean | null;
  bio: string | null;
  experience_years: number | null;
  certifications: string[] | null;
  specializations: string[] | null;
  available_from: string | null;
  available_to: string | null;
  available_days: number[] | null;
  total_jobs_completed: number;
  average_rating: number | null;
  total_reviews: number;
  created_at: string;
  updated_at: string;
}

export interface HirerProfile {
  id: string;
  user_id: string;
  display_name: string;
  address_line1: string | null;
  address_line2: string | null;
  district: string | null;
  province: string | null;
  postal_code: string | null;
  total_jobs_posted: number;
  total_jobs_completed: number;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  role: 'hirer' | 'caregiver' | 'admin';
  display_name: string;
  caregiver_profile?: CaregiverProfile;
  hirer_profile?: HirerProfile;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminUserListItem {
  id: string;
  email: string | null;
  phone_number: string | null;
  account_type: 'guest' | 'member';
  role: 'hirer' | 'caregiver' | 'admin';
  status: 'active' | 'suspended' | 'deleted';
  trust_level: 'L0' | 'L1' | 'L2' | 'L3';
  trust_score: number;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  completed_jobs_count: number;
  first_job_waiver_used: boolean;
  created_at: string;
  updated_at: string;
  display_name?: string | null;
}

export interface AdminJobListItem extends JobPost {
  job_id?: string | null;
  job_status?: string | null;
  caregiver_id?: string | null;
  assignment_status?: string | null;
  caregiver_name?: string | null;
  patient_display_name?: string | null;
  hirer_name?: string | null;
  assigned_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
}

export interface AdminLedgerTransaction {
  id: string;
  from_wallet_id: string | null;
  to_wallet_id: string | null;
  amount: number;
  currency?: string | null;
  type: string;
  reference_type: string | null;
  reference_id: string | null;
  provider_name?: string | null;
  provider_transaction_id?: string | null;
  description?: string | null;
  created_at: string;
  from_wallet_type?: string | null;
  to_wallet_type?: string | null;
  from_user_id?: string | null;
  to_user_id?: string | null;
  from_user_email?: string | null;
  to_user_email?: string | null;
}

export interface AdminStatsResponse {
  users: Record<string, number>;
  jobs: Record<string, number>;
  wallets: Array<{ type: string; totalAvailable: number; totalHeld: number }>;
}

export interface AdminDisputeListItem {
  id: string;
  job_post_id: string;
  job_id: string | null;
  caregiver_id?: string | null;
  opened_by_user_id: string;
  opened_by_role?: string | null;
  status: 'open' | 'in_review' | 'resolved' | 'rejected';
  reason: string;
  assigned_admin_id: string | null;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  title?: string | null;
  hirer_name?: string | null;
  caregiver_name?: string | null;
}

export interface AdminDisputeEvent {
  id: string;
  dispute_id: string;
  actor_user_id: string | null;
  event_type: 'note' | 'status_change';
  message: string;
  created_at: string;
}

export interface DisputeMessage {
  id: string;
  dispute_id: string;
  sender_id: string | null;
  type: string;
  content: string | null;
  is_system_message: boolean;
  metadata?: any;
  created_at: string;
  sender_email?: string | null;
  sender_role?: string | null;
}

export interface Wallet {
  id: string;
  user_id: string;
  available_balance: number;
  held_balance: number;
  total_earned: number;
  total_spent: number;
  currency: string;
}

export interface WalletBalance {
  wallet_id: string;
  wallet_type: 'hirer' | 'caregiver';
  currency: string;
  available_balance: number;
  held_balance: number;
  total_balance: number;
}

export interface TopupResult {
  topup_id: string;
  amount: number;
  status: string;
  payment_method: string;
  payment_url?: string;
  qr_code?: string;
  expires_at?: string;
  message?: string;
}

export interface TopupIntent {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  method: string;
  provider_name: string;
  provider_payment_id: string | null;
  provider_transaction_id: string | null;
  status: 'pending' | 'succeeded' | 'failed' | 'expired';
  payment_link_url: string | null;
  qr_payload: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
  succeeded_at?: string | null;
  failed_at?: string | null;
}

export interface BankAccount {
  id: string;
  bank_code: string;
  bank_name?: string | null;
  account_number_last4: string;
  account_name: string;
  is_verified: boolean;
  is_primary: boolean;
}

export interface WithdrawalRequest {
  id: string;
  user_id: string;
  bank_account_id: string;
  amount: number;
  currency: string;
  status: string;
  user_email?: string | null;
  user_role?: string | null;
  bank_name?: string | null;
  account_number_last4?: string | null;
  account_name?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  paid_by?: string | null;
  paid_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  payout_reference?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  channel: string;
  template_key?: string | null;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  reference_type?: string | null;
  reference_id?: string | null;
  status: string;
  read_at?: string | null;
  created_at: string;
}

export interface CaregiverDocument {
  id: string;
  user_id: string;
  document_type: string;
  title: string;
  description?: string | null;
  issuer?: string | null;
  issued_date?: string | null;
  expiry_date?: string | null;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  payer_user_id: string;
  payee_user_id: string;
  job_id?: string | null;
  amount: number;
  fee_amount: number;
  status: string;
  payment_method?: string | null;
  provider_payment_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  processed_at?: string | null;
  payer_name?: string | null;
  payee_name?: string | null;
  ledger_entries?: unknown[];
}

export interface CareRecipient {
  id: string;
  hirer_id: string;
  patient_display_name: string;
  address_line1?: string | null;
  address_line2?: string | null;
  district?: string | null;
  province?: string | null;
  postal_code?: string | null;
  lat?: number | null;
  lng?: number | null;
  birth_year?: number | null;
  age_band: string | null;
  gender: string | null;
  mobility_level: string | null;
  communication_style: string | null;
  cognitive_status?: string | null;
  general_health_summary: string | null;
  chronic_conditions_flags: string[] | null;
  symptoms_flags?: string[] | null;
  medical_devices_flags?: string[] | null;
  care_needs_flags?: string[] | null;
  behavior_risks_flags?: string[] | null;
  allergies_flags?: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  from_wallet_id: string | null;
  to_wallet_id: string | null;
  type: 'credit' | 'debit' | 'hold' | 'release' | 'reversal';
  reference_type: string;
  reference_id: string;
  provider_name: string | null;
  provider_transaction_id: string | null;
  description: string | null;
  metadata: any;
  created_at: string;
}

export interface JobPost {
  id: string;
  hirer_id: string;
  preferred_caregiver_id?: string | null;
  title: string;
  description: string;
  job_type: string;
  risk_level: string;
  status: string;
  job_id?: string | null;
  job_status?: string | null;
  caregiver_id?: string | null;
  assignment_status?: string | null;
  caregiver_name?: string | null;
  patient_display_name?: string | null;
  hirer_name?: string | null;
  assigned_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  scheduled_start_at: string;
  scheduled_end_at: string;
  address_line1: string;
  address_line2: string | null;
  district: string | null;
  province: string | null;
  postal_code: string | null;
  lat: number | null;
  lng: number | null;
  geofence_radius_m: number;
  hourly_rate: number;
  total_hours: number;
  total_amount: number;
  platform_fee_percent: number;
  platform_fee_amount: number;
  min_trust_level: string;
  required_certifications: string[];
  is_urgent: boolean;
  created_at: string;
  posted_at?: string | null;
  updated_at?: string;
}

export interface Job {
  id: string;
  job_post_id: string;
  status: string;
  assigned_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface JobAssignment {
  id: string;
  job_id: string;
  caregiver_id: string;
  status: string;
  assigned_at: string;
}

export interface KycStatus {
  id: string;
  user_id: string;
  provider_name: string;
  provider_session_id: string | null;
  provider_reference_id: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  result: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

export interface CaregiverAssignedJob {
  id: string;
  job_post_id: string;
  hirer_id: string;
  status: string;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
  job_closed_at: string | null;
  created_at: string;
  updated_at: string;
  title: string;
  description: string;
  hourly_rate: number;
  total_amount: number;
  scheduled_start_at: string;
  scheduled_end_at: string;
  address_line1: string;
  district: string | null;
  province: string | null;
  lat?: number | null;
  lng?: number | null;
  geofence_radius_m?: number | null;
}

export interface CreateJobData {
  title: string;
  description: string;
  job_type: string;
  risk_level?: string;
  scheduled_start_at: string;
  scheduled_end_at: string;
  address_line1: string;
  address_line2?: string;
  district?: string;
  province?: string;
  postal_code?: string;
  lat?: number;
  lng?: number;
  geofence_radius_m?: number;
  hourly_rate: number;
  total_hours: number;
  min_trust_level?: string;
  required_certifications?: string[];
  is_urgent?: boolean;
  patient_profile_id?: string;
  job_tasks_flags?: string[];
  required_skills_flags?: string[];
  equipment_available_flags?: string[];
  precautions_flags?: string[];
  preferred_caregiver_id?: string;
}

export interface ChatThread {
  id: string;
  job_id: string;
  status: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  sender_id: string | null;
  content: string;
  type: string;
  attachment_key?: string | null;
  sender_name?: string | null;
  sender_role?: string | null;
  created_at: string;
}

export interface CaregiverDocument {
  id: string;
  caregiver_id: string;
  document_type: string;
  file_key: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  status: 'pending' | 'approved' | 'rejected';
  verified_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Export singleton instance
export const api = new ApiClient(API_BASE_URL);
export default api;
