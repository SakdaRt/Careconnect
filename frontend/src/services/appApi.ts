import api, {
  BankAccount,
  ChatThread,
  JobPost,
  KycStatus,
  Paginated,
  Payment,
  TopupIntent,
  WalletBalance,
  WithdrawalRequest,
  User,
} from './api';
import { demoStore } from './demoStore';

type WalletRole = 'hirer' | 'caregiver';
type DemoUser = Partial<User> & { id: string; role: User['role']; account_type?: User['account_type'] };

const isDemoToken = () => localStorage.getItem('careconnect_token') === 'demo';
const getDemoUserId = () => {
  const raw = localStorage.getItem('careconnect_user');
  if (!raw) return 'demo-hirer';
  try {
    const parsed = JSON.parse(raw) as { id?: string };
    return parsed.id || 'demo-hirer';
  } catch {
    return 'demo-hirer';
  }
};
const getDemoUserRole = () => {
  const raw = localStorage.getItem('careconnect_user');
  if (!raw) return 'hirer';
  try {
    const parsed = JSON.parse(raw) as { role?: 'hirer' | 'caregiver' | 'admin' };
    return parsed.role || 'hirer';
  } catch {
    return 'hirer';
  }
};
const getDemoUser = (): DemoUser | null => {
  const raw = localStorage.getItem('careconnect_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DemoUser;
  } catch {
    return null;
  }
};
const setDemoUser = (user: DemoUser) => {
  localStorage.setItem('careconnect_user', JSON.stringify(user));
};
const getFallbackDemoUser = (): DemoUser => ({
  id: getDemoUserId(),
  role: getDemoUserRole(),
  account_type: 'guest',
});

const toPaginated = <T>(items: T[], page = 1, limit = items.length): Paginated<T> => {
  const total = items.length;
  return { data: items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
};
const ok = <T>(data: T) => ({ success: true, data, error: undefined as string | undefined });

export const appApi = {
  isDemoToken,

  async getMyProfile() {
    if (!isDemoToken()) return api.getMyProfile();
    const userId = getDemoUserId();
    const role = getDemoUserRole();
    const stored = demoStore.getProfile(userId);
    return ok({
      role,
      profile: stored?.profile || null,
    });
  },

  async updateMyProfile(payload: any) {
    if (!isDemoToken()) return api.updateMyProfile(payload);
    const userId = getDemoUserId();
    const role = getDemoUserRole();
    const profile = demoStore.updateProfile(userId, role, payload);
    return ok({ profile });
  },

  async updatePhoneNumber(phone_number: string) {
    if (!isDemoToken()) return api.updatePhoneNumber(phone_number);
    const existing = getDemoUser() || getFallbackDemoUser();
    const updated = { ...existing, phone_number, is_phone_verified: false };
    setDemoUser(updated);
    return ok({ phone_number, is_phone_verified: false });
  },

  async updateEmailAddress(email: string) {
    if (!isDemoToken()) return api.updateEmailAddress(email);
    const existing = getDemoUser() || getFallbackDemoUser();
    const updated = { ...existing, email, is_email_verified: false };
    setDemoUser(updated);
    return ok({ email, is_email_verified: false });
  },

  async acceptPolicy(role: 'hirer' | 'caregiver', version_policy_accepted: string) {
    if (!isDemoToken()) return api.acceptPolicy(role, version_policy_accepted);
    const existing = getDemoUser() || getFallbackDemoUser();
    const policy_acceptances = {
      ...(existing.policy_acceptances || {}),
      [role]: {
        policy_accepted_at: new Date().toISOString(),
        version_policy_accepted,
      },
    };
    const updated = { ...existing, policy_acceptances };
    setDemoUser(updated);
    return ok({ policy_acceptances });
  },

  async getKycStatus() {
    if (!isDemoToken()) return api.getKycStatus();
    const userId = getDemoUserId();
    const kyc = demoStore.getKycStatus(userId);
    return ok({ kyc: kyc as KycStatus | null });
  },

  async submitMockKyc(input: { full_name: string; national_id: string; document_type: string }) {
    if (!isDemoToken()) return api.submitMockKyc(input);
    const userId = getDemoUserId();
    const now = new Date().toISOString();
    const kyc = demoStore.setKycStatus(userId, {
      user_id: userId,
      status: 'approved',
      provider_reference_id: `mock-${userId}`,
      verified_at: now,
      created_at: now,
      updated_at: now,
    });
    const existing = getDemoUser() || getFallbackDemoUser();
    const updated = { ...existing, trust_level: 'L2' };
    setDemoUser(updated);
    return ok({ kyc: kyc as KycStatus });
  },

  async updateRole(role: 'hirer' | 'caregiver') {
    if (!isDemoToken()) return api.updateRole(role);
    const existing = getDemoUser() || getFallbackDemoUser();
    const updated: DemoUser = { ...existing, role, account_type: 'member' };
    setDemoUser(updated);
    return ok({ user: updated });
  },

  async sendEmailOtp() {
    if (!isDemoToken()) return api.sendEmailOtp();
    const user = getDemoUser();
    if (!user?.email) return { success: false, error: 'No email address associated with this account' };
    return ok({ otp_id: 'demo-email-otp', email: user.email, expires_in: 300, debug_code: '123456' } as any);
  },

  async sendPhoneOtp() {
    if (!isDemoToken()) return api.sendPhoneOtp();
    const user = getDemoUser();
    if (!user?.phone_number) return { success: false, error: 'No phone number associated with this account' };
    return ok({ otp_id: 'demo-otp', phone_number: user.phone_number, expires_in: 300, debug_code: '123456' } as any);
  },

  async resendOtp(otp_id: string) {
    if (!isDemoToken()) return api.resendOtp(otp_id);
    return ok({ otp_id, expires_in: 300, debug_code: '123456' } as any);
  },

  async verifyOtp(otp_id: string, code: string) {
    if (!isDemoToken()) return api.verifyOtp(otp_id, code);
    if (code !== '123456') return { success: false, error: 'รหัส OTP ไม่ถูกต้อง' };
    const existing = getDemoUser() || getFallbackDemoUser();
    const updated: DemoUser = { ...existing, is_phone_verified: true, trust_level: existing.trust_level || 'L1' };
    setDemoUser(updated);
    return ok({ type: 'phone', is_email_verified: !!updated.is_email_verified, is_phone_verified: true, trust_level: updated.trust_level || 'L1' });
  },

  async verifyEmailOtp(otp_id: string, code: string) {
    if (!isDemoToken()) return api.verifyOtp(otp_id, code);
    if (code !== '123456') return { success: false, error: 'รหัส OTP ไม่ถูกต้อง' };
    const existing = getDemoUser() || getFallbackDemoUser();
    const updated: DemoUser = { ...existing, is_email_verified: true, trust_level: existing.trust_level || 'L1' };
    setDemoUser(updated);
    return ok({ type: 'email', is_email_verified: true, is_phone_verified: !!updated.is_phone_verified, trust_level: updated.trust_level || 'L1' });
  },

  async getJobFeed(filters?: {
    job_type?: string;
    risk_level?: string;
    is_urgent?: boolean;
    page?: number;
    limit?: number;
  }) {
    if (!isDemoToken()) return api.getJobFeed(filters);
    const items = demoStore.listJobFeed();
    const page = filters?.page || 1;
    const limit = filters?.limit || items.length || 20;
    return ok(toPaginated(items, page, limit));
  },

  async getMyJobs(hirerId: string, status?: string, page?: number, limit?: number) {
    if (!isDemoToken()) return api.getMyJobs(status, page, limit);
    const items = demoStore.listMyJobs(hirerId, status);
    return ok(toPaginated(items, page || 1, limit || items.length || 20));
  },

  async getAssignedJobs(caregiverId: string, status?: string, page?: number, limit?: number) {
    if (!isDemoToken()) return api.getAssignedJobs(status, page, limit);
    const items = demoStore.listCaregiverJobs(caregiverId, status as any);
    return ok(toPaginated(items, page || 1, limit || items.length || 20));
  },

  async getJobById(jobId: string) {
    if (!isDemoToken()) return api.getJobById(jobId);
    const job = demoStore.getJobById(jobId) || demoStore.getJobPostByJobId(jobId);
    return ok({ job: (job as JobPost | null) || null });
  },

  async createJob(hirerId: string, jobData: any) {
    if (!isDemoToken()) return api.createJob(jobData);
    const job = demoStore.createJob(hirerId, jobData);
    return ok({ job });
  },

  async publishJob(jobPostId: string, hirerId: string) {
    if (!isDemoToken()) return api.publishJob(jobPostId);
    const job = demoStore.publishJob(jobPostId, hirerId);
    if (!job) return { success: false, error: 'Publish failed' };
    return ok({ job });
  },

  async cancelJob(jobPostId: string, hirerId: string, reason?: string) {
    if (!isDemoToken()) return api.cancelJob(jobPostId, reason || '');
    const job = demoStore.cancelJob(jobPostId, hirerId);
    if (!job) return { success: false, error: 'Cancel failed' };
    if (reason) {
      demoStore.saveCancelReason(jobPostId, reason);
    }
    return ok({ job });
  },

  async acceptJob(jobPostId: string, caregiverId: string, message?: string) {
    if (!isDemoToken()) return api.acceptJob(jobPostId, message);
    const demo = demoStore.acceptJob(jobPostId, caregiverId);
    if (!demo) return { success: false, error: 'Accept failed' };
    return ok({
      job_id: demo.job_id,
      assignment_id: null,
      chat_thread_id: demo.chat_thread_id,
      escrow_amount: 0,
    });
  },

  async checkIn(jobId: string, caregiverId: string, gpsData?: { lat: number; lng: number; accuracy_m?: number }) {
    if (!isDemoToken()) return api.checkIn(jobId, gpsData);
    const job = demoStore.checkIn(jobId, caregiverId);
    if (!job) return { success: false, error: 'Check-in failed' };
    return ok({ job });
  },

  async checkOut(jobId: string, caregiverId: string, gpsData?: { lat: number; lng: number; accuracy_m?: number }) {
    if (!isDemoToken()) return api.checkOut(jobId, gpsData);
    const job = demoStore.checkOut(jobId, caregiverId);
    if (!job) return { success: false, error: 'Check-out failed' };
    return ok({ job });
  },

  async getChatThread(jobId: string) {
    if (!isDemoToken()) return api.getChatThread(jobId);
    const thread = demoStore.getThreadByJobId(jobId);
    return ok({ thread: (thread as ChatThread | null) || null });
  },

  async getOrCreateChatThread(jobId: string) {
    if (!isDemoToken()) return api.getOrCreateChatThread(jobId);
    const thread = demoStore.getThreadByJobId(jobId);
    if (!thread) return { success: false, error: 'Thread not found' };
    return ok({ thread });
  },

  async getChatMessages(threadId: string, limit?: number, before?: string) {
    if (!isDemoToken()) return api.getChatMessages(threadId, limit, before);
    const items = demoStore.getMessages(threadId);
    return ok(toPaginated(items, 1, limit || items.length || 50));
  },

  async sendMessage(threadId: string, sender: { id: string; role: string; name?: string }, content: string, messageType = 'text') {
    if (!isDemoToken()) return api.sendMessage(threadId, content, messageType);
    const message = demoStore.sendMessage(threadId, sender, content);
    return ok({ message });
  },

  async getDispute(disputeId: string) {
    if (!isDemoToken()) return api.getDispute(disputeId);
    const dispute = demoStore.getDisputeById(disputeId);
    if (!dispute) return { success: false, error: 'Dispute not found' };
    const messages = demoStore.getDisputeMessages(disputeId);
    const events = demoStore.getDisputeEvents(disputeId);
    return ok({ dispute, messages, events });
  },

  async getDisputeByJob(jobId: string) {
    if (!isDemoToken()) return api.getDisputeByJob(jobId);
    const dispute = demoStore.getDisputeByJob(jobId);
    return ok({ dispute: dispute || null });
  },

  async createDispute(jobId: string, openedByUserId: string, reason: string) {
    if (!isDemoToken()) return api.createDispute(jobId, reason);
    const dispute = demoStore.createDispute(jobId, openedByUserId, reason);
    if (!dispute) return { success: false, error: 'Create dispute failed' };
    return ok({ dispute });
  },

  async getCancelReason(jobIdOrJobPostId: string) {
    if (!isDemoToken()) {
      const res = await api.getJobById(jobIdOrJobPostId);
      const job = res.success ? (res.data as any)?.job : null;
      const reason = job && (job as any).cancel_reason ? String((job as any).cancel_reason) : '';
      return ok({ reason: reason || '' });
    }
    const jobPost = demoStore.getJobById(jobIdOrJobPostId) || demoStore.getJobPostByJobId(jobIdOrJobPostId);
    const reason = jobPost ? demoStore.getCancelReason(jobPost.id) : '';
    return ok({ reason });
  },

  async postDisputeMessage(
    disputeId: string,
    sender: { id: string; role?: string; email?: string },
    content: string
  ) {
    if (!isDemoToken()) return api.postDisputeMessage(disputeId, content);
    const message = demoStore.postDisputeMessage(disputeId, sender, content);
    if (!message) return { success: false, error: 'Post dispute message failed' };
    return ok({ message });
  },

  async requestDisputeClose(disputeId: string, actor: { id: string }, reason?: string) {
    if (!isDemoToken()) return api.requestDisputeClose(disputeId, reason);
    const okRes = demoStore.requestDisputeClose(disputeId, actor, reason);
    if (!okRes) return { success: false, error: 'Request dispute close failed' };
    return ok({ ok: okRes });
  },

  async getWalletBalance(userId: string, role: WalletRole) {
    if (!isDemoToken()) return api.getWallet();
    const wallet = demoStore.getWalletBalance(userId, role);
    return ok(wallet) as { success: boolean; data?: WalletBalance; error?: string };
  },

  async listWalletTransactions(userId: string, role: WalletRole, page = 1, limit = 20) {
    if (!isDemoToken()) return api.getWalletTransactions(page, limit);
    const wallet = demoStore.getWalletBalance(userId, role);
    const pageData = demoStore.listWalletTransactions(wallet.wallet_id, page, limit);
    return ok(toPaginated(pageData.data, page, limit));
  },

  async getWalletTransactionsPage(userId: string, role: WalletRole, page: number, limit: number) {
    if (!isDemoToken()) {
      const res = await api.getWalletTransactions(page, limit);
      return {
        items: res.success && res.data ? res.data.data : [],
        totalPages: res.success && res.data ? res.data.totalPages : 1,
      };
    }
    const wallet = demoStore.getWalletBalance(userId, role);
    const pageData = demoStore.listWalletTransactions(wallet.wallet_id, page, limit);
    return { items: pageData.data, totalPages: pageData.totalPages };
  },

  async topUpWallet(amount: number, paymentMethod: string) {
    if (!isDemoToken()) return api.topUpWallet(amount, paymentMethod);
    return { success: false, error: 'Topup not available in demo' };
  },

  async getPendingTopups() {
    if (!isDemoToken()) return api.getPendingTopups();
    return ok([] as TopupIntent[]);
  },

  async getTopupStatus(topupId: string) {
    if (!isDemoToken()) return api.getTopupStatus(topupId);
    return { success: false, error: 'Topup not available in demo' };
  },

  async getBankAccounts() {
    if (!isDemoToken()) return api.getBankAccounts();
    return ok([] as BankAccount[]);
  },

  async addBankAccount(input: {
    bank_code: string;
    bank_name?: string;
    account_number: string;
    account_name: string;
    set_primary?: boolean;
  }) {
    if (!isDemoToken()) return api.addBankAccount(input);
    return { success: false, error: 'Bank account not available in demo' };
  },

  async initiateWithdrawal(amount: number, bankAccountId: string) {
    if (!isDemoToken()) return api.initiateWithdrawal(amount, bankAccountId);
    return { success: false, error: 'Withdrawal not available in demo' };
  },

  async getWithdrawals(options?: { page?: number; limit?: number; status?: string }) {
    if (!isDemoToken()) return api.getWithdrawals(options);
    const page = options?.page || 1;
    const limit = options?.limit || 10;
    return ok(toPaginated([] as WithdrawalRequest[], page, limit));
  },

  async cancelWithdrawal(withdrawalId: string) {
    if (!isDemoToken()) return api.cancelWithdrawal(withdrawalId);
    return { success: false, error: 'Withdrawal not available in demo' };
  },

  async getCareRecipients() {
    if (!isDemoToken()) return api.getCareRecipients();
    return ok(demoStore.listCareRecipients(getDemoUserId()));
  },

  async getCareRecipient(id: string) {
    if (!isDemoToken()) return api.getCareRecipient(id);
    const item = demoStore.getCareRecipient(id);
    if (!item) return { success: false, error: 'Care recipient not found' };
    return ok(item);
  },

  async createCareRecipient(payload: any) {
    if (!isDemoToken()) return api.createCareRecipient(payload);
    const created = demoStore.createCareRecipient(getDemoUserId(), payload);
    return ok(created);
  },

  async updateCareRecipient(id: string, payload: any) {
    if (!isDemoToken()) return api.updateCareRecipient(id, payload);
    const updated = demoStore.updateCareRecipient(id, payload);
    if (!updated) return { success: false, error: 'Care recipient not found' };
    return ok(updated);
  },

  async deactivateCareRecipient(id: string) {
    if (!isDemoToken()) return api.deactivateCareRecipient(id);
    const updated = demoStore.deactivateCareRecipient(id);
    if (!updated) return { success: false, error: 'Care recipient not found' };
    return ok(updated);
  },

  // Payment API methods
  async getPayments(options?: { status?: string; page?: number; limit?: number; sort_by?: string; sort_order?: 'ASC' | 'DESC' }) {
    if (!isDemoToken()) return api.getPayments(options);
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    return ok(toPaginated([] as any[], page, limit));
  },

  async getPaymentById(paymentId: string) {
    if (!isDemoToken()) return api.getPaymentById(paymentId);
    return { success: false, error: 'Payment not found in demo' };
  },

  async simulatePayment(paymentId: string) {
    if (!isDemoToken()) return api.simulatePayment(paymentId);
    return { success: false, error: 'Payment simulation not available in demo' };
  },
