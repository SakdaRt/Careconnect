import api from './api';

type WalletRole = 'hirer' | 'caregiver';

export const appApi = {
  async getMyProfile() {
    return api.getMyProfile();
  },

  async updateMyProfile(payload: any) {
    return api.updateMyProfile(payload);
  },

  async uploadProfileAvatar(formData: FormData) {
    return api.uploadProfileAvatar(formData);
  },

  async updatePhoneNumber(phone_number: string) {
    return api.updatePhoneNumber(phone_number);
  },

  async updateEmailAddress(email: string) {
    return api.updateEmailAddress(email);
  },

  async acceptPolicy(role: 'hirer' | 'caregiver', version_policy_accepted: string) {
    return api.acceptPolicy(role, version_policy_accepted);
  },

  async getKycStatus() {
    return api.getKycStatus();
  },

  async submitMockKyc(input: { full_name: string; national_id: string; document_type: string }) {
    return api.submitMockKyc(input);
  },

  async submitKyc(formData: FormData) {
    return api.submitKyc(formData);
  },

  async getMyCaregiverDocuments() {
    return api.getMyCaregiverDocuments();
  },

  async uploadCaregiverDocument(formData: FormData) {
    return api.uploadCaregiverDocument(formData);
  },

  async deleteCaregiverDocument(docId: string) {
    return api.deleteCaregiverDocument(docId);
  },

  async getCaregiverDocumentsByCaregiver(caregiverId: string) {
    return api.getCaregiverDocumentsByCaregiver(caregiverId);
  },

  async updateRole(role: 'hirer' | 'caregiver') {
    return api.updateRole(role);
  },

  async sendEmailOtp() {
    return api.sendEmailOtp();
  },

  async sendPhoneOtp() {
    return api.sendPhoneOtp();
  },

  async resendOtp(otp_id: string) {
    return api.resendOtp(otp_id);
  },

  async verifyOtp(otp_id: string, code: string) {
    return api.verifyOtp(otp_id, code);
  },

  async verifyEmailOtp(otp_id: string, code: string) {
    return api.verifyOtp(otp_id, code);
  },

  async getJobFeed(filters?: {
    job_type?: string;
    risk_level?: string;
    is_urgent?: boolean;
    page?: number;
    limit?: number;
  }) {
    return api.getJobFeed(filters);
  },

  async getMyJobs(_hirerId: string, status?: string, page?: number, limit?: number) {
    return api.getMyJobs(status, page, limit);
  },

  async getAssignedJobs(_caregiverId: string, status?: string, page?: number, limit?: number) {
    return api.getAssignedJobs(status, page, limit);
  },

  async getJobById(jobId: string) {
    return api.getJobById(jobId);
  },

  async createJob(_hirerId: string, jobData: any) {
    return api.createJob(jobData);
  },

  async publishJob(jobPostId: string, _hirerId: string) {
    return api.publishJob(jobPostId);
  },

  async cancelJob(jobPostId: string, _hirerId: string, reason?: string) {
    return api.cancelJob(jobPostId, reason || '');
  },

  async acceptJob(jobPostId: string, _caregiverId: string, message?: string) {
    return api.acceptJob(jobPostId, message);
  },

  async checkIn(jobId: string, _caregiverId: string, gpsData?: { lat: number; lng: number; accuracy_m?: number }) {
    return api.checkIn(jobId, gpsData);
  },

  async checkOut(jobId: string, _caregiverId: string, gpsData?: { lat: number; lng: number; accuracy_m?: number }) {
    return api.checkOut(jobId, gpsData);
  },

  async getChatThread(jobId: string) {
    return api.getChatThread(jobId);
  },

  async getOrCreateChatThread(jobId: string) {
    return api.getOrCreateChatThread(jobId);
  },

  async getChatMessages(threadId: string, limit?: number, before?: string) {
    return api.getChatMessages(threadId, limit, before);
  },

  async sendMessage(threadId: string, _sender: { id: string; role: string; name?: string }, content: string, messageType = 'text') {
    return api.sendMessage(threadId, content, messageType);
  },

  async getDispute(disputeId: string) {
    return api.getDispute(disputeId);
  },

  async getDisputeByJob(jobId: string) {
    return api.getDisputeByJob(jobId);
  },

  async createDispute(jobId: string, _openedByUserId: string, reason: string) {
    return api.createDispute(jobId, reason);
  },

  async getCancelReason(jobIdOrJobPostId: string) {
    const res = await api.getJobById(jobIdOrJobPostId);
    const job = res.success ? (res.data as any)?.job : null;
    const reason = job && (job as any).cancel_reason ? String((job as any).cancel_reason) : '';
    return { success: true, data: { reason: reason || '' }, error: undefined as string | undefined };
  },

  async postDisputeMessage(
    disputeId: string,
    _sender: { id: string; role?: string; email?: string },
    content: string
  ) {
    return api.postDisputeMessage(disputeId, content);
  },

  async requestDisputeClose(disputeId: string, _actor: { id: string }, reason?: string) {
    return api.requestDisputeClose(disputeId, reason);
  },

  async getWalletBalance(_userId: string, _role: WalletRole) {
    return api.getWallet();
  },

  async listWalletTransactions(_userId: string, _role: WalletRole, page = 1, limit = 20) {
    return api.getWalletTransactions(page, limit);
  },

  async getWalletTransactionsPage(_userId: string, _role: WalletRole, page: number, limit: number) {
    const res = await api.getWalletTransactions(page, limit);
    return {
      items: res.success && res.data ? res.data.data : [],
      totalPages: res.success && res.data ? res.data.totalPages : 1,
    };
  },

  async topUpWallet(amount: number, paymentMethod: string) {
    return api.topUpWallet(amount, paymentMethod);
  },

  async getPendingTopups() {
    return api.getPendingTopups();
  },

  async getTopupStatus(topupId: string) {
    return api.getTopupStatus(topupId);
  },

  async confirmTopupPayment(topupId: string) {
    return api.confirmTopupPayment(topupId);
  },

  async getBankAccounts() {
    return api.getBankAccounts();
  },

  async addBankAccount(input: {
    bank_code: string;
    bank_name?: string;
    account_number: string;
    account_name: string;
    set_primary?: boolean;
  }) {
    return api.addBankAccount(input);
  },

  async initiateWithdrawal(amount: number, bankAccountId: string) {
    return api.initiateWithdrawal(amount, bankAccountId);
  },

  async getWithdrawals(options?: { page?: number; limit?: number; status?: string }) {
    return api.getWithdrawals(options);
  },

  async cancelWithdrawal(withdrawalId: string) {
    return api.cancelWithdrawal(withdrawalId);
  },

  async getCareRecipients() {
    return api.getCareRecipients();
  },

  async getCareRecipient(id: string) {
    return api.getCareRecipient(id);
  },

  async createCareRecipient(payload: any) {
    return api.createCareRecipient(payload);
  },

  async updateCareRecipient(id: string, payload: any) {
    return api.updateCareRecipient(id, payload);
  },

  async deactivateCareRecipient(id: string) {
    return api.deactivateCareRecipient(id);
  },

  async getPayments(options?: { status?: string; page?: number; limit?: number; sort_by?: string; sort_order?: 'ASC' | 'DESC' }) {
    return api.getPayments(options);
  },

  async getPaymentById(paymentId: string) {
    return api.getPaymentById(paymentId);
  },

  async simulatePayment(paymentId: string) {
    return api.simulatePayment(paymentId);
  },

  async searchCaregivers(params: { q?: string; page?: number; limit?: number; skills?: string; trust_level?: string }) {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.skills) qs.set('skills', params.skills);
    if (params.trust_level) qs.set('trust_level', params.trust_level);
    return api.request<{ data: any[]; total: number; page: number; limit: number; totalPages: number }>(`/api/caregivers/search?${qs.toString()}`);
  },

  async assignCaregiverToJob(jobPostId: string, caregiverId: string) {
    return api.request<{ message: string }>('/api/caregivers/assign', {
      method: 'POST',
      body: { job_post_id: jobPostId, caregiver_id: caregiverId },
    });
  },
};
