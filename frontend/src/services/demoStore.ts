import type {
  AdminDisputeEvent,
  CareRecipient,
  ChatMessage,
  ChatThread,
  CreateJobData,
  DisputeMessage,
  JobPost,
  Transaction,
  WalletBalance,
} from './api';

const JOB_POSTS_KEY = 'careconnect_demo_job_posts';
const JOBS_KEY = 'careconnect_demo_jobs';
const CHAT_THREADS_KEY = 'careconnect_demo_chat_threads';
const CHAT_MESSAGES_KEY = 'careconnect_demo_chat_messages';
const CARE_RECIPIENTS_KEY = 'careconnect_demo_care_recipients';
const WALLET_BALANCES_KEY = 'careconnect_demo_wallet_balances';
const WALLET_TRANSACTIONS_KEY = 'careconnect_demo_wallet_transactions';
const JOB_ESCROWS_KEY = 'careconnect_demo_job_escrows';
const PLATFORM_WALLET_ID_KEY = 'careconnect_demo_platform_wallet_id';
const DISPUTES_KEY = 'careconnect_demo_disputes';
const DISPUTE_EVENTS_KEY = 'careconnect_demo_dispute_events';
const DISPUTE_MESSAGES_KEY = 'careconnect_demo_dispute_messages';
const CANCEL_REASONS_KEY = 'careconnect_demo_cancel_reasons';
const PROFILES_KEY = 'careconnect_demo_profiles';
const SEED_KEY = 'careconnect_demo_seed_state';
const KYC_STATUS_KEY = 'careconnect_demo_kyc_status';

type SeedState = {
  globalSeeded: boolean;
  hirers: Record<string, boolean>;
  caregivers: Record<string, boolean>;
};

function readSeedState(): SeedState {
  const raw = localStorage.getItem(SEED_KEY);
  if (!raw) return { globalSeeded: false, hirers: {}, caregivers: {} };
  try {
    const parsed = JSON.parse(raw) as SeedState;
    return {
      globalSeeded: !!parsed.globalSeeded,
      hirers: parsed.hirers || {},
      caregivers: parsed.caregivers || {},
    };
  } catch {
    return { globalSeeded: false, hirers: {}, caregivers: {} };
  }
}

function writeSeedState(state: SeedState) {
  localStorage.setItem(SEED_KEY, JSON.stringify(state));
}

type DemoKycStatus = {
  user_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  provider_reference_id?: string | null;
  verified_at?: string | null;
  created_at: string;
  updated_at: string;
};

function readKycStatusMap(): Record<string, DemoKycStatus> {
  const raw = localStorage.getItem(KYC_STATUS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, DemoKycStatus>;
  } catch {
    return {};
  }
}

function writeKycStatusMap(data: Record<string, DemoKycStatus>) {
  localStorage.setItem(KYC_STATUS_KEY, JSON.stringify(data));
}

function readJobPosts(): JobPost[] {
  const raw = localStorage.getItem(JOB_POSTS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as JobPost[];
  } catch {
    return [];
  }
}

function writeJobPosts(jobPosts: JobPost[]) {
  localStorage.setItem(JOB_POSTS_KEY, JSON.stringify(jobPosts));
}

function readCareRecipients(): CareRecipient[] {
  const raw = localStorage.getItem(CARE_RECIPIENTS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CareRecipient[];
  } catch {
    return [];
  }
}

function writeCareRecipients(items: CareRecipient[]) {
  localStorage.setItem(CARE_RECIPIENTS_KEY, JSON.stringify(items));
}

type SeedJobInput = {
  id?: string;
  hirer_id: string;
  preferred_caregiver_id?: string | null;
  title: string;
  description: string;
  job_type: string;
  risk_level: string;
  status: string;
  scheduled_start_at: string;
  scheduled_end_at: string;
  address_line1: string;
  district?: string | null;
  province?: string | null;
  hourly_rate: number;
  total_hours: number;
  is_urgent?: boolean;
  min_trust_level?: string;
  required_certifications?: string[];
  caregiver_id?: string | null;
  caregiver_name?: string | null;
  patient_display_name?: string | null;
  hirer_name?: string | null;
  job_id?: string | null;
  assigned_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
  posted_at?: string | null;
};

function buildJobPost(input: SeedJobInput): JobPost {
  const total_amount = Math.round(input.hourly_rate * input.total_hours);
  const platform_fee_percent = 10;
  const platform_fee_amount = Math.round(total_amount * (platform_fee_percent / 100));
  const created_at = input.created_at || new Date().toISOString();
  return {
    id: input.id || crypto.randomUUID(),
    hirer_id: input.hirer_id,
    preferred_caregiver_id: input.preferred_caregiver_id ?? null,
    title: input.title,
    description: input.description,
    job_type: input.job_type,
    risk_level: input.risk_level,
    status: input.status,
    job_id: input.job_id || null,
    job_status: input.status,
    caregiver_id: input.caregiver_id || null,
    caregiver_name: input.caregiver_name || null,
    patient_display_name: input.patient_display_name || null,
    hirer_name: input.hirer_name || null,
    assigned_at: input.assigned_at || null,
    started_at: input.started_at || null,
    completed_at: input.completed_at || null,
    scheduled_start_at: input.scheduled_start_at,
    scheduled_end_at: input.scheduled_end_at,
    address_line1: input.address_line1,
    address_line2: null,
    district: input.district ?? null,
    province: input.province ?? null,
    postal_code: null,
    lat: null,
    lng: null,
    geofence_radius_m: 100,
    hourly_rate: input.hourly_rate,
    total_hours: input.total_hours,
    total_amount,
    platform_fee_percent,
    platform_fee_amount,
    min_trust_level: input.min_trust_level || 'L1',
    required_certifications: input.required_certifications || [],
    is_urgent: !!input.is_urgent,
    created_at,
    posted_at: input.posted_at ?? null,
    updated_at: created_at,
  };
}

function scheduleFromNow(offsetHours: number, durationHours: number) {
  const start = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function addJobPosts(posts: JobPost[]) {
  const existing = readJobPosts();
  writeJobPosts([...posts, ...existing]);
}

function addJobs(jobs: DemoJob[]) {
  const existing = readJobs();
  writeJobs([...jobs, ...existing]);
}

function addThreads(threads: ChatThread[]) {
  const existing = readThreads();
  const byJobId = new Map(existing.map((t) => [t.job_id, t]));
  const next = [...existing];
  for (const thread of threads) {
    if (!byJobId.has(thread.job_id)) {
      next.push(thread);
      byJobId.set(thread.job_id, thread);
    }
  }
  writeThreads(next);
}

function addMessages(threadId: string, messages: ChatMessage[]) {
  const map = readMessagesByThread();
  if (map[threadId]?.length) return;
  map[threadId] = messages;
  writeMessagesByThread(map);
}

function seedWalletIfNeeded(userId: string, walletType: 'hirer' | 'caregiver', wallet: WalletBalance) {
  const map = readWalletTransactions();
  if (map[wallet.wallet_id]?.length) return wallet;
  const now = new Date();
  const balances = readWalletBalances();
  const key = `${walletType}:${userId}` as WalletKey;
  const relatedJobId =
    walletType === 'hirer'
      ? readJobPosts().find((j) => j.hirer_id === userId && j.status === 'completed' && j.job_id)?.job_id || crypto.randomUUID()
      : readJobs().find((j) => j.caregiver_id === userId && j.status === 'completed')?.id || crypto.randomUUID();

  if (walletType === 'hirer') {
    const updated: WalletBalance = {
      ...wallet,
      available_balance: 5200,
      held_balance: 800,
      total_balance: 6000,
    };
    balances[key] = updated;
    writeWalletBalances(balances);
    map[wallet.wallet_id] = [
      {
        id: crypto.randomUUID(),
        amount: 5000,
        currency: 'THB',
        from_wallet_id: null,
        to_wallet_id: wallet.wallet_id,
        type: 'credit',
        reference_type: 'topup',
        reference_id: crypto.randomUUID(),
        provider_name: 'demo',
        provider_transaction_id: null,
        description: 'Top-up (demo)',
        metadata: {},
        created_at: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      },
      {
        id: crypto.randomUUID(),
        amount: 800,
        currency: 'THB',
        from_wallet_id: wallet.wallet_id,
        to_wallet_id: crypto.randomUUID(),
        type: 'hold',
        reference_type: 'job',
        reference_id: relatedJobId,
        provider_name: 'demo',
        provider_transaction_id: null,
        description: 'Hold for job (demo)',
        metadata: { job_id: relatedJobId },
        created_at: new Date(now.getTime() - 1000 * 60 * 60 * 6).toISOString(),
      },
      {
        id: crypto.randomUUID(),
        amount: 1200,
        currency: 'THB',
        from_wallet_id: wallet.wallet_id,
        to_wallet_id: null,
        type: 'debit',
        reference_type: 'job',
        reference_id: relatedJobId,
        provider_name: 'demo',
        provider_transaction_id: null,
        description: 'Job payment (demo)',
        metadata: { job_id: relatedJobId },
        created_at: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(),
      },
    ];
    writeWalletTransactions(map);
    return updated;
  }

  const updated: WalletBalance = {
    ...wallet,
    available_balance: 3200,
    held_balance: 0,
    total_balance: 3200,
  };
  balances[key] = updated;
  writeWalletBalances(balances);
  map[wallet.wallet_id] = [
    {
      id: crypto.randomUUID(),
      amount: 1800,
      currency: 'THB',
      from_wallet_id: crypto.randomUUID(),
      to_wallet_id: wallet.wallet_id,
      type: 'credit',
      reference_type: 'job',
      reference_id: relatedJobId,
      provider_name: 'demo',
      provider_transaction_id: null,
      description: 'Job payment (demo)',
      metadata: { job_id: relatedJobId },
      created_at: new Date(now.getTime() - 1000 * 60 * 60 * 12).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      amount: 500,
      currency: 'THB',
      from_wallet_id: wallet.wallet_id,
      to_wallet_id: null,
      type: 'debit',
      reference_type: 'withdrawal',
      reference_id: crypto.randomUUID(),
      provider_name: 'demo',
      provider_transaction_id: null,
      description: 'Withdrawal (demo)',
      metadata: {},
      created_at: new Date(now.getTime() - 1000 * 60 * 60 * 3).toISOString(),
    },
  ];
  writeWalletTransactions(map);
  return updated;
}

function ensureGlobalSeed() {
  const state = readSeedState();
  if (state.globalSeeded) return;
  const existing = readJobPosts();
  if (existing.length > 0) {
    state.globalSeeded = true;
    writeSeedState(state);
    return;
  }

  const t1 = scheduleFromNow(6, 6);
  const t2 = scheduleFromNow(28, 8);
  const t3 = scheduleFromNow(52, 4);

  const posts = [
    buildJobPost({
      hirer_id: 'seed-hirer-1',
      title: 'ดูแลคุณยายช่วงเช้า',
      description: 'ช่วยดูแลทั่วไป พาเดินเล่น และเตือนกินยา',
      job_type: 'companionship',
      risk_level: 'low_risk',
      status: 'posted',
      scheduled_start_at: t1.start,
      scheduled_end_at: t1.end,
      address_line1: 'บางนา',
      district: 'บางนา',
      province: 'กรุงเทพฯ',
      hourly_rate: 320,
      total_hours: 6,
      is_urgent: false,
      hirer_name: 'คุณศิริพร',
      patient_display_name: 'คุณยายปราณี',
      posted_at: new Date().toISOString(),
    }),
    buildJobPost({
      hirer_id: 'seed-hirer-2',
      title: 'ดูแลหลังผ่าตัด 1 คืน',
      description: 'เฝ้าระวังอาการหลังผ่าตัดและช่วยพยุงเดิน',
      job_type: 'post_surgery',
      risk_level: 'high_risk',
      status: 'posted',
      scheduled_start_at: t2.start,
      scheduled_end_at: t2.end,
      address_line1: 'พระราม 9',
      district: 'ห้วยขวาง',
      province: 'กรุงเทพฯ',
      hourly_rate: 480,
      total_hours: 8,
      is_urgent: true,
      hirer_name: 'คุณอนันต์',
      patient_display_name: 'คุณพ่อวิชัย',
      posted_at: new Date().toISOString(),
    }),
    buildJobPost({
      hirer_id: 'seed-hirer-3',
      title: 'ดูแลผู้สูงอายุช่วงบ่าย',
      description: 'ช่วยอาบน้ำและจัดมื้ออาหาร',
      job_type: 'personal_care',
      risk_level: 'medium_risk',
      status: 'posted',
      scheduled_start_at: t3.start,
      scheduled_end_at: t3.end,
      address_line1: 'ลาดพร้าว',
      district: 'ลาดพร้าว',
      province: 'กรุงเทพฯ',
      hourly_rate: 350,
      total_hours: 4,
      is_urgent: false,
      hirer_name: 'คุณอรทัย',
      patient_display_name: 'คุณยายละไม',
      posted_at: new Date().toISOString(),
    }),
  ];

  writeJobPosts(posts);
  state.globalSeeded = true;
  writeSeedState(state);
}

function ensureHirerSeed(hirerId: string) {
  const state = readSeedState();
  if (state.hirers[hirerId]) return;
  const existing = readJobPosts().filter((j) => j.hirer_id === hirerId);
  if (existing.length > 0) {
    state.hirers[hirerId] = true;
    writeSeedState(state);
    return;
  }

  const caregiverId = `seed-caregiver-${hirerId.slice(0, 6)}`;
  const assignedJobId = crypto.randomUUID();
  const inProgressJobId = crypto.randomUUID();
  const completedJobId = crypto.randomUUID();
  const now = new Date();
  const t1 = scheduleFromNow(-12, 6);
  const t2 = scheduleFromNow(10, 4);
  const t3 = scheduleFromNow(30, 8);
  const t4 = scheduleFromNow(54, 6);

  const posts = [
    buildJobPost({
      hirer_id: hirerId,
      title: 'ดูแลคุณพ่อช่วงเช้า',
      description: 'ช่วยพยุงเดิน ดูแลการกินยา และวัดความดัน',
      job_type: 'medical_monitoring',
      risk_level: 'medium_risk',
      status: 'draft',
      scheduled_start_at: t2.start,
      scheduled_end_at: t2.end,
      address_line1: 'รามอินทรา',
      district: 'บางเขน',
      province: 'กรุงเทพฯ',
      hourly_rate: 350,
      total_hours: 4,
      is_urgent: false,
      hirer_name: 'บัญชีเดโม',
      patient_display_name: 'คุณพ่อสมชาย',
      posted_at: null,
      created_at: now.toISOString(),
    }),
    buildJobPost({
      hirer_id: hirerId,
      title: 'ดูแลคุณยายตอนบ่าย (ด่วน)',
      description: 'ช่วยอาบน้ำ เปลี่ยนผ้าอ้อม และเตรียมอาหาร',
      job_type: 'personal_care',
      risk_level: 'high_risk',
      status: 'posted',
      scheduled_start_at: t3.start,
      scheduled_end_at: t3.end,
      address_line1: 'อโศก',
      district: 'วัฒนา',
      province: 'กรุงเทพฯ',
      hourly_rate: 420,
      total_hours: 6,
      is_urgent: true,
      hirer_name: 'บัญชีเดโม',
      patient_display_name: 'คุณยายบุญช่วย',
      posted_at: now.toISOString(),
    }),
    buildJobPost({
      hirer_id: hirerId,
      title: 'ดูแลคุณยายช่วงเช้า',
      description: 'งานประจำช่วงเช้า ดูแลทั่วไปและเตือนกินยา',
      job_type: 'companionship',
      risk_level: 'low_risk',
      status: 'assigned',
      scheduled_start_at: t2.start,
      scheduled_end_at: t2.end,
      address_line1: 'บางแค',
      district: 'บางแค',
      province: 'กรุงเทพฯ',
      hourly_rate: 300,
      total_hours: 4,
      is_urgent: false,
      caregiver_id: caregiverId,
      caregiver_name: 'สมหญิง ดูแล',
      hirer_name: 'บัญชีเดโม',
      patient_display_name: 'คุณยายละไม',
      posted_at: now.toISOString(),
      assigned_at: now.toISOString(),
      job_id: assignedJobId,
    }),
    buildJobPost({
      hirer_id: hirerId,
      title: 'ดูแลหลังผ่าตัด (เริ่มแล้ว)',
      description: 'ดูแลหลังผ่าตัดและช่วยพยุงเดิน',
      job_type: 'post_surgery',
      risk_level: 'high_risk',
      status: 'in_progress',
      scheduled_start_at: t1.start,
      scheduled_end_at: t1.end,
      address_line1: 'อ่อนนุช',
      district: 'สวนหลวง',
      province: 'กรุงเทพฯ',
      hourly_rate: 500,
      total_hours: 6,
      is_urgent: false,
      caregiver_id: caregiverId,
      caregiver_name: 'สมหญิง ดูแล',
      hirer_name: 'บัญชีเดโม',
      patient_display_name: 'คุณพ่อวิชัย',
      posted_at: now.toISOString(),
      assigned_at: new Date(now.getTime() - 1000 * 60 * 60 * 5).toISOString(),
      started_at: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(),
      job_id: inProgressJobId,
    }),
    buildJobPost({
      hirer_id: hirerId,
      title: 'ดูแลคุณยายช่วงเย็น (เสร็จแล้ว)',
      description: 'ดูแลทั่วไป ช่วยจัดยาและเตรียมอาหาร',
      job_type: 'companionship',
      risk_level: 'low_risk',
      status: 'completed',
      scheduled_start_at: t4.start,
      scheduled_end_at: t4.end,
      address_line1: 'พหลโยธิน',
      district: 'จตุจักร',
      province: 'กรุงเทพฯ',
      hourly_rate: 320,
      total_hours: 5,
      is_urgent: false,
      caregiver_id: caregiverId,
      caregiver_name: 'สมหญิง ดูแล',
      hirer_name: 'บัญชีเดโม',
      patient_display_name: 'คุณยายปราณี',
      posted_at: new Date(now.getTime() - 1000 * 60 * 60 * 20).toISOString(),
      assigned_at: new Date(now.getTime() - 1000 * 60 * 60 * 18).toISOString(),
      completed_at: new Date(now.getTime() - 1000 * 60 * 60 * 1).toISOString(),
      job_id: completedJobId,
    }),
  ];

  addJobPosts(posts);
  addJobs([
    {
      id: assignedJobId,
      job_post_id: posts[2].id,
      hirer_id: hirerId,
      caregiver_id: caregiverId,
      status: 'assigned',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      assigned_at: now.toISOString(),
      started_at: null,
      completed_at: null,
    },
    {
      id: inProgressJobId,
      job_post_id: posts[3].id,
      hirer_id: hirerId,
      caregiver_id: caregiverId,
      status: 'in_progress',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      assigned_at: new Date(now.getTime() - 1000 * 60 * 60 * 5).toISOString(),
      started_at: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(),
      completed_at: null,
    },
    {
      id: completedJobId,
      job_post_id: posts[4].id,
      hirer_id: hirerId,
      caregiver_id: caregiverId,
      status: 'completed',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      assigned_at: new Date(now.getTime() - 1000 * 60 * 60 * 18).toISOString(),
      started_at: new Date(now.getTime() - 1000 * 60 * 60 * 16).toISOString(),
      completed_at: new Date(now.getTime() - 1000 * 60 * 60 * 1).toISOString(),
    },
  ]);

  const threadId = crypto.randomUUID();
  addThreads([
    {
      id: threadId,
      job_id: assignedJobId,
      status: 'active',
      created_at: now.toISOString(),
    },
  ]);
  addMessages(threadId, [
    {
      id: crypto.randomUUID(),
      thread_id: threadId,
      sender_id: caregiverId,
      content: 'สวัสดีค่ะ ยืนยันรับงานแล้วนะคะ',
      type: 'text',
      created_at: new Date(now.getTime() - 1000 * 60 * 15).toISOString(),
      sender_name: 'สมหญิง ดูแล',
      sender_role: 'caregiver',
    },
    {
      id: crypto.randomUUID(),
      thread_id: threadId,
      sender_id: hirerId,
      content: 'ขอบคุณค่ะ นัดเจอกันหน้าบ้านได้เลยนะคะ',
      type: 'text',
      created_at: new Date(now.getTime() - 1000 * 60 * 8).toISOString(),
      sender_name: 'บัญชีเดโม',
      sender_role: 'hirer',
    },
  ]);

  state.hirers[hirerId] = true;
  writeSeedState(state);
}

function ensureCaregiverSeed(caregiverId: string) {
  const state = readSeedState();
  if (state.caregivers[caregiverId]) return;
  const existing = readJobs().filter((j) => j.caregiver_id === caregiverId);
  if (existing.length > 0) {
    state.caregivers[caregiverId] = true;
    writeSeedState(state);
    return;
  }

  const hirerId = `seed-hirer-${caregiverId.slice(0, 6)}`;
  const assignedJobId = crypto.randomUUID();
  const completedJobId = crypto.randomUUID();
  const now = new Date();
  const t1 = scheduleFromNow(8, 5);
  const t2 = scheduleFromNow(-28, 6);

  const posts = [
    buildJobPost({
      hirer_id: hirerId,
      title: 'ดูแลคุณพ่อที่บ้าน',
      description: 'ดูแลทั่วไป พาออกกำลังกายเบา ๆ',
      job_type: 'companionship',
      risk_level: 'low_risk',
      status: 'assigned',
      scheduled_start_at: t1.start,
      scheduled_end_at: t1.end,
      address_line1: 'บางซื่อ',
      district: 'บางซื่อ',
      province: 'กรุงเทพฯ',
      hourly_rate: 300,
      total_hours: 5,
      caregiver_id: caregiverId,
      caregiver_name: 'บัญชีเดโม',
      hirer_name: 'คุณณัฐ',
      patient_display_name: 'คุณพ่อสมคิด',
      posted_at: new Date(now.getTime() - 1000 * 60 * 60 * 10).toISOString(),
      assigned_at: new Date(now.getTime() - 1000 * 60 * 60 * 9).toISOString(),
      job_id: assignedJobId,
    }),
    buildJobPost({
      hirer_id: hirerId,
      title: 'ดูแลคุณยายช่วงเย็น (เสร็จแล้ว)',
      description: 'ช่วยเตรียมอาหารและจัดยา',
      job_type: 'personal_care',
      risk_level: 'medium_risk',
      status: 'completed',
      scheduled_start_at: t2.start,
      scheduled_end_at: t2.end,
      address_line1: 'สะพานใหม่',
      district: 'สายไหม',
      province: 'กรุงเทพฯ',
      hourly_rate: 360,
      total_hours: 6,
      caregiver_id: caregiverId,
      caregiver_name: 'บัญชีเดโม',
      hirer_name: 'คุณปรียา',
      patient_display_name: 'คุณยายวิไล',
      posted_at: new Date(now.getTime() - 1000 * 60 * 60 * 40).toISOString(),
      assigned_at: new Date(now.getTime() - 1000 * 60 * 60 * 38).toISOString(),
      completed_at: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
      job_id: completedJobId,
    }),
  ];

  addJobPosts(posts);
  addJobs([
    {
      id: assignedJobId,
      job_post_id: posts[0].id,
      hirer_id: hirerId,
      caregiver_id: caregiverId,
      status: 'assigned',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      assigned_at: new Date(now.getTime() - 1000 * 60 * 60 * 9).toISOString(),
      started_at: null,
      completed_at: null,
    },
    {
      id: completedJobId,
      job_post_id: posts[1].id,
      hirer_id: hirerId,
      caregiver_id: caregiverId,
      status: 'completed',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      assigned_at: new Date(now.getTime() - 1000 * 60 * 60 * 38).toISOString(),
      started_at: new Date(now.getTime() - 1000 * 60 * 60 * 30).toISOString(),
      completed_at: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
    },
  ]);

  const threadId = crypto.randomUUID();
  addThreads([
    {
      id: threadId,
      job_id: assignedJobId,
      status: 'active',
      created_at: now.toISOString(),
    },
  ]);
  addMessages(threadId, [
    {
      id: crypto.randomUUID(),
      thread_id: threadId,
      sender_id: hirerId,
      content: 'รายละเอียดงานเพิ่มเติมส่งในแชทนะคะ',
      type: 'text',
      created_at: new Date(now.getTime() - 1000 * 60 * 20).toISOString(),
      sender_name: 'คุณณัฐ',
      sender_role: 'hirer',
    },
    {
      id: crypto.randomUUID(),
      thread_id: threadId,
      sender_id: caregiverId,
      content: 'รับทราบค่ะ จะเตรียมตัวให้พร้อม',
      type: 'text',
      created_at: new Date(now.getTime() - 1000 * 60 * 12).toISOString(),
      sender_name: 'บัญชีเดโม',
      sender_role: 'caregiver',
    },
  ]);

  state.caregivers[caregiverId] = true;
  writeSeedState(state);
}

function createDefaultCareRecipients(hirerId: string) {
  const now = new Date().toISOString();
  const currentYear = new Date().getFullYear();
  const first: CareRecipient = {
    id: crypto.randomUUID(),
    hirer_id: hirerId,
    patient_display_name: 'คุณยายบุญช่วย',
    address_line1: 'ถนนสุขุมวิท เขตวัฒนา กรุงเทพ',
    district: 'วัฒนา',
    province: 'Bangkok',
    postal_code: '10110',
    lat: 13.7367,
    lng: 100.561,
    birth_year: currentYear - 82,
    age_band: '75_89',
    gender: 'female',
    mobility_level: 'walk_assisted',
    communication_style: 'hearing_impaired',
    cognitive_status: 'mild_impairment',
    general_health_summary: 'เดินได้แต่ต้องพยุงเล็กน้อย มีอาการหลงลืมบางครั้ง',
    chronic_conditions_flags: ['hypertension'],
    symptoms_flags: ['shortness_of_breath'],
    medical_devices_flags: null,
    care_needs_flags: ['medication_reminder', 'transfer_assist'],
    behavior_risks_flags: ['fall_risk'],
    allergies_flags: null,
    is_active: true,
    created_at: now,
    updated_at: now,
  };
  const second: CareRecipient = {
    id: crypto.randomUUID(),
    hirer_id: hirerId,
    patient_display_name: 'คุณพ่อสมชาย',
    address_line1: 'ถนนเพชรบุรี เขตราชเทวี กรุงเทพ',
    district: 'ราชเทวี',
    province: 'Bangkok',
    postal_code: '10400',
    lat: 13.7519,
    lng: 100.533,
    birth_year: currentYear - 68,
    age_band: '60_74',
    gender: 'male',
    mobility_level: 'walk_independent',
    communication_style: 'normal',
    cognitive_status: 'normal',
    general_health_summary: 'ช่วยเหลือตัวเองได้ ต้องคุมอาหารและช่วยดูแลการกินยา',
    chronic_conditions_flags: ['diabetes'],
    symptoms_flags: null,
    medical_devices_flags: null,
    care_needs_flags: ['feeding', 'medication_reminder'],
    behavior_risks_flags: null,
    allergies_flags: ['food_allergy'],
    is_active: true,
    created_at: now,
    updated_at: now,
  };
  const items = [first, second];
  writeCareRecipients(items);
  return items;
}

type DemoJob = {
  id: string;
  job_post_id: string;
  hirer_id: string;
  caregiver_id: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  assigned_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
};

function readJobs(): DemoJob[] {
  const raw = localStorage.getItem(JOBS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as DemoJob[];
  } catch {
    return [];
  }
}

function writeJobs(jobs: DemoJob[]) {
  localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
}

function readThreads(): ChatThread[] {
  const raw = localStorage.getItem(CHAT_THREADS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ChatThread[];
  } catch {
    return [];
  }
}

function writeThreads(threads: ChatThread[]) {
  localStorage.setItem(CHAT_THREADS_KEY, JSON.stringify(threads));
}

function readMessagesByThread(): Record<string, ChatMessage[]> {
  const raw = localStorage.getItem(CHAT_MESSAGES_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, ChatMessage[]>;
  } catch {
    return {};
  }
}

function writeMessagesByThread(messages: Record<string, ChatMessage[]>) {
  localStorage.setItem(CHAT_MESSAGES_KEY, JSON.stringify(messages));
}

function readCancelReasons(): Record<string, string> {
  const raw = localStorage.getItem(CANCEL_REASONS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeCancelReasons(map: Record<string, string>) {
  localStorage.setItem(CANCEL_REASONS_KEY, JSON.stringify(map));
}

type DemoDispute = {
  id: string;
  job_post_id: string;
  job_id: string | null;
  opened_by_user_id: string;
  status: 'open' | 'in_review' | 'resolved' | 'rejected';
  reason: string;
  assigned_admin_id: string | null;
  created_at: string;
  updated_at: string;
};

function readDisputes(): Record<string, DemoDispute> {
  const raw = localStorage.getItem(DISPUTES_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, DemoDispute>;
  } catch {
    return {};
  }
}

function writeDisputes(map: Record<string, DemoDispute>) {
  localStorage.setItem(DISPUTES_KEY, JSON.stringify(map));
}

function readDisputeEvents(): Record<string, AdminDisputeEvent[]> {
  const raw = localStorage.getItem(DISPUTE_EVENTS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, AdminDisputeEvent[]>;
  } catch {
    return {};
  }
}

function writeDisputeEvents(map: Record<string, AdminDisputeEvent[]>) {
  localStorage.setItem(DISPUTE_EVENTS_KEY, JSON.stringify(map));
}

function readDisputeMessages(): Record<string, DisputeMessage[]> {
  const raw = localStorage.getItem(DISPUTE_MESSAGES_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, DisputeMessage[]>;
  } catch {
    return {};
  }
}

function writeDisputeMessages(map: Record<string, DisputeMessage[]>) {
  localStorage.setItem(DISPUTE_MESSAGES_KEY, JSON.stringify(map));
}

function readProfiles(): Record<string, { role: string; profile: any }> {
  const raw = localStorage.getItem(PROFILES_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, { role: string; profile: any }>;
  } catch {
    return {};
  }
}

function writeProfiles(map: Record<string, { role: string; profile: any }>) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(map));
}

type WalletKey = `${'hirer' | 'caregiver'}:${string}`;

function readWalletBalances(): Record<WalletKey, WalletBalance> {
  const raw = localStorage.getItem(WALLET_BALANCES_KEY);
  if (!raw) return {} as Record<WalletKey, WalletBalance>;
  try {
    return JSON.parse(raw) as Record<WalletKey, WalletBalance>;
  } catch {
    return {} as Record<WalletKey, WalletBalance>;
  }
}

function writeWalletBalances(balances: Record<WalletKey, WalletBalance>) {
  localStorage.setItem(WALLET_BALANCES_KEY, JSON.stringify(balances));
}

function readWalletTransactions(): Record<string, Transaction[]> {
  const raw = localStorage.getItem(WALLET_TRANSACTIONS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, Transaction[]>;
  } catch {
    return {};
  }
}

function writeWalletTransactions(map: Record<string, Transaction[]>) {
  localStorage.setItem(WALLET_TRANSACTIONS_KEY, JSON.stringify(map));
}

type DemoJobEscrow = {
  escrow_wallet_id: string;
  job_id: string;
  hirer_wallet_id: string;
  amount_total: number;
  amount_job: number;
  amount_fee: number;
  created_at: string;
};

function readJobEscrows(): Record<string, DemoJobEscrow> {
  const raw = localStorage.getItem(JOB_ESCROWS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, DemoJobEscrow>;
  } catch {
    return {};
  }
}

function writeJobEscrows(map: Record<string, DemoJobEscrow>) {
  localStorage.setItem(JOB_ESCROWS_KEY, JSON.stringify(map));
}

function getPlatformWalletId() {
  const existing = localStorage.getItem(PLATFORM_WALLET_ID_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(PLATFORM_WALLET_ID_KEY, created);
  return created;
}

export const demoStore = {
  getKycStatus(userId: string) {
    const map = readKycStatusMap();
    return map[userId] || null;
  },

  setKycStatus(userId: string, status: DemoKycStatus) {
    const map = readKycStatusMap();
    map[userId] = status;
    writeKycStatusMap(map);
    return status;
  },

  getJobInstanceById(jobId: string) {
    return readJobs().find((j) => j.id === jobId) || null;
  },

  getJobById(jobPostId: string) {
    ensureGlobalSeed();
    return readJobPosts().find((j) => j.id === jobPostId) || null;
  },

  getJobPostByJobId(jobId: string) {
    ensureGlobalSeed();
    const job = readJobs().find((j) => j.id === jobId);
    if (!job) return null;
    return readJobPosts().find((p) => p.id === job.job_post_id) || null;
  },

  listMyJobs(hirerId: string, status?: string) {
    ensureGlobalSeed();
    ensureHirerSeed(hirerId);
    const all = readJobPosts().filter((j) => j.hirer_id === hirerId);
    const filtered = status ? all.filter((j) => j.status === status) : all;
    return filtered.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  },

  listCareRecipients(hirerId?: string) {
    let items = readCareRecipients();
    if (items.length === 0 && hirerId) {
      items = createDefaultCareRecipients(hirerId);
    }
    const filtered = hirerId ? items.filter((p) => p.hirer_id === hirerId) : items;
    return filtered.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  },

  getCareRecipient(id: string) {
    return readCareRecipients().find((p) => p.id === id) || null;
  },

  createCareRecipient(hirerId: string, payload: any) {
    const now = new Date().toISOString();
    const patientDisplayName = String(payload?.patient_display_name || '').trim() || 'ผู้รับการดูแล';
    const item: CareRecipient = {
      id: crypto.randomUUID(),
      hirer_id: hirerId,
      patient_display_name: patientDisplayName,
      address_line1: payload?.address_line1 ?? null,
      district: payload?.district ?? null,
      province: payload?.province ?? null,
      postal_code: payload?.postal_code ?? null,
      lat: payload?.lat ?? null,
      lng: payload?.lng ?? null,
      birth_year: payload?.birth_year ?? null,
      age_band: payload?.age_band ?? null,
      gender: payload?.gender ?? null,
      mobility_level: payload?.mobility_level ?? null,
      communication_style: payload?.communication_style ?? null,
      cognitive_status: payload?.cognitive_status ?? null,
      general_health_summary: payload?.general_health_summary ?? null,
      chronic_conditions_flags: payload?.chronic_conditions_flags ?? null,
      symptoms_flags: payload?.symptoms_flags ?? null,
      medical_devices_flags: payload?.medical_devices_flags ?? null,
      care_needs_flags: payload?.care_needs_flags ?? null,
      behavior_risks_flags: payload?.behavior_risks_flags ?? null,
      allergies_flags: payload?.allergies_flags ?? null,
      is_active: true,
      created_at: now,
      updated_at: now,
    };
    const next = [item, ...readCareRecipients()];
    writeCareRecipients(next);
    return item;
  },

  updateCareRecipient(id: string, payload: any) {
    const items = readCareRecipients();
    const idx = items.findIndex((p) => p.id === id);
    if (idx < 0) return null;
    const current = items[idx];
    const withValue = (key: string, fallback: any) =>
      Object.prototype.hasOwnProperty.call(payload || {}, key) ? payload[key] : fallback;
    const updated: CareRecipient = {
      ...current,
      patient_display_name: withValue('patient_display_name', current.patient_display_name),
      address_line1: withValue('address_line1', current.address_line1 ?? null),
      district: withValue('district', current.district ?? null),
      province: withValue('province', current.province ?? null),
      postal_code: withValue('postal_code', current.postal_code ?? null),
      lat: withValue('lat', current.lat ?? null),
      lng: withValue('lng', current.lng ?? null),
      birth_year: withValue('birth_year', current.birth_year ?? null),
      age_band: withValue('age_band', current.age_band),
      gender: withValue('gender', current.gender),
      mobility_level: withValue('mobility_level', current.mobility_level),
      communication_style: withValue('communication_style', current.communication_style),
      cognitive_status: withValue('cognitive_status', current.cognitive_status ?? null),
      general_health_summary: withValue('general_health_summary', current.general_health_summary),
      chronic_conditions_flags: withValue('chronic_conditions_flags', current.chronic_conditions_flags ?? null),
      symptoms_flags: withValue('symptoms_flags', current.symptoms_flags ?? null),
      medical_devices_flags: withValue('medical_devices_flags', current.medical_devices_flags ?? null),
      care_needs_flags: withValue('care_needs_flags', current.care_needs_flags ?? null),
      behavior_risks_flags: withValue('behavior_risks_flags', current.behavior_risks_flags ?? null),
      allergies_flags: withValue('allergies_flags', current.allergies_flags ?? null),
      updated_at: new Date().toISOString(),
    };
    items[idx] = updated;
    writeCareRecipients(items);
    return updated;
  },

  deactivateCareRecipient(id: string) {
    const items = readCareRecipients();
    const idx = items.findIndex((p) => p.id === id);
    if (idx < 0) return null;
    const current = items[idx];
    const updated: CareRecipient = {
      ...current,
      is_active: false,
      updated_at: new Date().toISOString(),
    };
    items[idx] = updated;
    writeCareRecipients(items);
    return updated;
  },

  createJob(hirerId: string, jobData: CreateJobData) {
    const now = new Date().toISOString();
    const total_amount = Math.round(jobData.hourly_rate * jobData.total_hours);
    const platform_fee_percent = 10;
    const platform_fee_amount = Math.round(total_amount * (platform_fee_percent / 100));

    const jobPost: JobPost = {
      id: crypto.randomUUID(),
      hirer_id: hirerId,
      title: jobData.title,
      description: jobData.description,
      job_type: jobData.job_type,
      risk_level: jobData.risk_level || 'low_risk',
      status: 'draft',
      scheduled_start_at: jobData.scheduled_start_at,
      scheduled_end_at: jobData.scheduled_end_at,
      address_line1: jobData.address_line1,
      address_line2: jobData.address_line2 || null,
      district: jobData.district || null,
      province: jobData.province || null,
      postal_code: jobData.postal_code || null,
      lat: jobData.lat ?? null,
      lng: jobData.lng ?? null,
      geofence_radius_m: jobData.geofence_radius_m ?? 100,
      hourly_rate: jobData.hourly_rate,
      total_hours: jobData.total_hours,
      total_amount,
      platform_fee_percent,
      platform_fee_amount,
      min_trust_level: jobData.min_trust_level || 'L1',
      required_certifications: jobData.required_certifications || [],
      is_urgent: jobData.is_urgent || false,
      created_at: now,
      updated_at: now,
      posted_at: null,
    };

    const next = [jobPost, ...readJobPosts()];
    writeJobPosts(next);
    return jobPost;
  },

  publishJob(jobPostId: string, hirerId: string) {
    const all = readJobPosts();
    const idx = all.findIndex((j) => j.id === jobPostId && j.hirer_id === hirerId);
    if (idx < 0) return null;
    const job = all[idx];
    const updated: JobPost = {
      ...job,
      status: 'posted',
      posted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    all[idx] = updated;
    writeJobPosts(all);
    return updated;
  },

  cancelJob(jobPostId: string, hirerId: string) {
    const jobInstance = readJobs().find((j) => j.id === jobPostId) || null;
    const resolvedJobPostId = jobInstance?.job_post_id || jobPostId;
    const resolvedHirerId = jobInstance?.hirer_id || hirerId;
    const all = readJobPosts();
    const idx = all.findIndex((j) => j.id === resolvedJobPostId && j.hirer_id === resolvedHirerId);
    if (idx < 0) return null;
    const job = all[idx];
    const now = new Date().toISOString();
    const updated: JobPost = {
      ...job,
      status: 'cancelled',
      updated_at: now,
    };
    all[idx] = updated;
    writeJobPosts(all);
    const jobs = readJobs();
    const updatedJobs: DemoJob[] = jobs.map((j) =>
      j.job_post_id === resolvedJobPostId && j.status !== 'completed'
        ? { ...j, status: 'cancelled', updated_at: now }
        : j
    );
    writeJobs(updatedJobs);
    return updated;
  },

  saveCancelReason(jobPostId: string, reason: string) {
    const map = readCancelReasons();
    map[jobPostId] = reason;
    writeCancelReasons(map);
  },

  getCancelReason(jobPostId: string) {
    const map = readCancelReasons();
    return map[jobPostId] || '';
  },

  listJobFeed() {
    ensureGlobalSeed();
    return readJobPosts()
      .filter((j) => j.status === 'posted')
      .sort((a, b) => {
        if (a.is_urgent !== b.is_urgent) return a.is_urgent ? -1 : 1;
        return a.scheduled_start_at.localeCompare(b.scheduled_start_at);
      });
  },

  acceptJob(jobPostId: string, caregiverId: string) {
    const allPosts = readJobPosts();
    const postIdx = allPosts.findIndex((j) => j.id === jobPostId);
    if (postIdx < 0) return null;
    const post = allPosts[postIdx];
    if (post.status !== 'posted') return null;

    const now = new Date().toISOString();
    const jobId = crypto.randomUUID();
    const threadId = crypto.randomUUID();
    const escrowWalletId = crypto.randomUUID();

    const updatedPost: JobPost = {
      ...post,
      status: 'assigned',
      updated_at: now,
    };
    allPosts[postIdx] = updatedPost;
    writeJobPosts(allPosts);

    const jobs = readJobs();
    const job: DemoJob = {
      id: jobId,
      job_post_id: post.id,
      hirer_id: post.hirer_id,
      caregiver_id: caregiverId,
      status: 'assigned',
      created_at: now,
      updated_at: now,
      assigned_at: now,
      started_at: null,
      completed_at: null,
    };
    writeJobs([job, ...jobs]);

    const hirerWallet = this.getWalletBalance(post.hirer_id, 'hirer');
    const totalAmount = Number(post.total_amount || 0) + Number(post.platform_fee_amount || 0);
    if (hirerWallet.available_balance < totalAmount) {
      return null;
    }

    const balances = readWalletBalances();
    const hirerKey = `hirer:${post.hirer_id}` as WalletKey;
    const updatedHirerWallet = {
      ...hirerWallet,
      available_balance: hirerWallet.available_balance - totalAmount,
      held_balance: hirerWallet.held_balance,
      total_balance: hirerWallet.total_balance - totalAmount,
    } as WalletBalance;
    balances[hirerKey] = updatedHirerWallet;
    writeWalletBalances(balances);

    const escrows = readJobEscrows();
    escrows[jobId] = {
      escrow_wallet_id: escrowWalletId,
      job_id: jobId,
      hirer_wallet_id: hirerWallet.wallet_id,
      amount_total: totalAmount,
      amount_job: Number(post.total_amount || 0),
      amount_fee: Number(post.platform_fee_amount || 0),
      created_at: now,
    };
    writeJobEscrows(escrows);

    const txHold: Transaction = {
      id: crypto.randomUUID(),
      amount: totalAmount,
      currency: 'THB',
      from_wallet_id: hirerWallet.wallet_id,
      to_wallet_id: escrowWalletId,
      type: 'hold',
      reference_type: 'job',
      reference_id: jobId,
      provider_name: 'demo',
      provider_transaction_id: null,
      description: 'Job escrow hold (demo)',
      metadata: { job_id: jobId },
      created_at: now,
    };
    const txMap = readWalletTransactions();
    txMap[hirerWallet.wallet_id] = [txHold, ...(txMap[hirerWallet.wallet_id] || [])];
    writeWalletTransactions(txMap);

    const threads = readThreads();
    const thread: ChatThread = {
      id: threadId,
      job_id: jobId,
      status: 'open',
      created_at: now,
    };
    writeThreads([thread, ...threads]);

    const messagesByThread = readMessagesByThread();
    const systemMessage: ChatMessage = {
      id: crypto.randomUUID(),
      thread_id: threadId,
      sender_id: null,
      content: 'เริ่มห้องแชทสำหรับงานนี้แล้ว',
      type: 'text',
      created_at: now,
      sender_name: 'System',
      sender_role: null,
    };
    messagesByThread[threadId] = [systemMessage];
    writeMessagesByThread(messagesByThread);

    return { job_id: jobId, chat_thread_id: threadId };
  },

  listCaregiverJobs(caregiverId: string, status?: DemoJob['status']) {
    ensureGlobalSeed();
    ensureCaregiverSeed(caregiverId);
    const jobs = readJobs().filter((j) => j.caregiver_id === caregiverId);
    const filtered = status ? jobs.filter((j) => j.status === status) : jobs;

    const byPostId = new Map(readJobPosts().map((p) => [p.id, p]));

    return filtered
      .map((j) => {
        const post = byPostId.get(j.job_post_id);
        return {
          id: j.id,
          job_post_id: j.job_post_id,
          hirer_id: j.hirer_id,
          status: j.status,
          assigned_at: j.assigned_at || null,
          started_at: j.started_at || null,
          completed_at: j.completed_at || null,
          cancelled_at: null,
          expired_at: null,
          job_closed_at: null,
          created_at: j.created_at,
          updated_at: j.updated_at,
          title: post?.title || 'งาน',
          description: post?.description || '',
          hourly_rate: post?.hourly_rate || 0,
          total_amount: post?.total_amount || 0,
          scheduled_start_at: post?.scheduled_start_at || new Date().toISOString(),
          scheduled_end_at: post?.scheduled_end_at || new Date().toISOString(),
          address_line1: post?.address_line1 || '',
          district: post?.district || null,
          province: post?.province || null,
        };
      })
      .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  },

  checkIn(jobId: string, caregiverId: string) {
    const all = readJobs();
    const idx = all.findIndex((j) => j.id === jobId && j.caregiver_id === caregiverId);
    if (idx < 0) return null;
    const job = all[idx];
    if (job.status !== 'assigned') return null;
    const now = new Date().toISOString();
    const updated: DemoJob = { ...job, status: 'in_progress', started_at: now, updated_at: now };
    all[idx] = updated;
    writeJobs(all);
    return updated;
  },

  checkOut(jobId: string, caregiverId: string) {
    const all = readJobs();
    const idx = all.findIndex((j) => j.id === jobId && j.caregiver_id === caregiverId);
    if (idx < 0) return null;
    const job = all[idx];
    if (job.status !== 'in_progress') return null;
    const now = new Date().toISOString();
    const updated: DemoJob = { ...job, status: 'completed', completed_at: now, updated_at: now };
    all[idx] = updated;
    writeJobs(all);

    const escrows = readJobEscrows();
    const escrow = escrows[jobId];
    if (escrow) {
      const caregiverWallet = this.getWalletBalance(caregiverId, 'caregiver');
      const balances = readWalletBalances();
      const caregiverKey = `caregiver:${caregiverId}` as WalletKey;
      balances[caregiverKey] = {
        ...caregiverWallet,
        available_balance: caregiverWallet.available_balance + escrow.amount_job,
        total_balance: caregiverWallet.total_balance + escrow.amount_job,
      };
      writeWalletBalances(balances);

      const txMap = readWalletTransactions();
      const txCaregiver: Transaction = {
        id: crypto.randomUUID(),
        amount: escrow.amount_job,
        currency: 'THB',
        from_wallet_id: escrow.escrow_wallet_id,
        to_wallet_id: caregiverWallet.wallet_id,
        type: 'release',
        reference_type: 'job',
        reference_id: jobId,
        provider_name: 'demo',
        provider_transaction_id: null,
        description: 'Payment for completed job (demo)',
        metadata: { job_id: jobId },
        created_at: now,
      };
      txMap[caregiverWallet.wallet_id] = [txCaregiver, ...(txMap[caregiverWallet.wallet_id] || [])];

      if (escrow.amount_fee > 0) {
        const platformWalletId = getPlatformWalletId();
        const txFee: Transaction = {
          id: crypto.randomUUID(),
          amount: escrow.amount_fee,
          currency: 'THB',
          from_wallet_id: escrow.escrow_wallet_id,
          to_wallet_id: platformWalletId,
          type: 'debit',
          reference_type: 'fee',
          reference_id: jobId,
          provider_name: 'demo',
          provider_transaction_id: null,
          description: 'Platform service fee (demo)',
          metadata: { job_id: jobId },
          created_at: now,
        };
        txMap[platformWalletId] = [txFee, ...(txMap[platformWalletId] || [])];
      }

      writeWalletTransactions(txMap);

      delete escrows[jobId];
      writeJobEscrows(escrows);
    }
    return updated;
  },

  getThreadByJobId(jobId: string) {
    return readThreads().find((t) => t.job_id === jobId) || null;
  },

  getMessages(threadId: string) {
    const map = readMessagesByThread();
    return map[threadId] || [];
  },

  sendMessage(threadId: string, sender: { id: string; role: string; name?: string }, content: string) {
    const now = new Date().toISOString();
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      thread_id: threadId,
      sender_id: sender.id,
      content,
      type: 'text',
      created_at: now,
      sender_name: sender.name || sender.role,
      sender_role: sender.role,
    };

    const map = readMessagesByThread();
    const list = map[threadId] || [];
    map[threadId] = [...list, message];
    writeMessagesByThread(map);
    return message;
  },

  getWalletBalance(userId: string, walletType: 'hirer' | 'caregiver') {
    ensureGlobalSeed();
    if (walletType === 'hirer') ensureHirerSeed(userId);
    if (walletType === 'caregiver') ensureCaregiverSeed(userId);
    const balances = readWalletBalances();
    const key = `${walletType}:${userId}` as WalletKey;
    const existing = balances[key];
    if (existing) return seedWalletIfNeeded(userId, walletType, existing);

    const created: WalletBalance = {
      wallet_id: crypto.randomUUID(),
      wallet_type: walletType,
      currency: 'THB',
      available_balance: 0,
      held_balance: 0,
      total_balance: 0,
    };
    balances[key] = created;
    writeWalletBalances(balances);
    return seedWalletIfNeeded(userId, walletType, created);
  },

  listWalletTransactions(walletId: string, page = 1, limit = 20) {
    const map = readWalletTransactions();
    const all = map[walletId] || [];
    const start = (page - 1) * limit;
    const data = all.slice(start, start + limit);
    const total = all.length;
    return { data, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  },

  topUpWallet(userId: string, amount: number) {
    const wallet = this.getWalletBalance(userId, 'hirer');
    const next: WalletBalance = {
      ...wallet,
      available_balance: wallet.available_balance + amount,
      total_balance: wallet.total_balance + amount,
    };

    const balances = readWalletBalances();
    const key = `hirer:${userId}` as WalletKey;
    balances[key] = next;
    writeWalletBalances(balances);

    const tx: Transaction = {
      id: crypto.randomUUID(),
      amount,
      currency: 'THB',
      from_wallet_id: null,
      to_wallet_id: wallet.wallet_id,
      type: 'credit',
      reference_type: 'topup',
      reference_id: crypto.randomUUID(),
      provider_name: 'demo',
      provider_transaction_id: null,
      description: 'Top-up (demo)',
      metadata: {},
      created_at: new Date().toISOString(),
    };

    const map = readWalletTransactions();
    map[wallet.wallet_id] = [tx, ...(map[wallet.wallet_id] || [])];
    writeWalletTransactions(map);
    return { wallet: next, transaction: tx };
  },

  withdrawWallet(userId: string, amount: number) {
    const wallet = this.getWalletBalance(userId, 'caregiver');
    if (wallet.available_balance < amount) return null;

    const next: WalletBalance = {
      ...wallet,
      available_balance: wallet.available_balance - amount,
      total_balance: wallet.total_balance - amount,
    };

    const balances = readWalletBalances();
    const key = `caregiver:${userId}` as WalletKey;
    balances[key] = next;
    writeWalletBalances(balances);

    const tx: Transaction = {
      id: crypto.randomUUID(),
      amount,
      currency: 'THB',
      from_wallet_id: wallet.wallet_id,
      to_wallet_id: null,
      type: 'debit',
      reference_type: 'withdrawal',
      reference_id: crypto.randomUUID(),
      provider_name: 'demo',
      provider_transaction_id: null,
      description: 'Withdrawal (demo)',
      metadata: {},
      created_at: new Date().toISOString(),
    };

    const map = readWalletTransactions();
    map[wallet.wallet_id] = [tx, ...(map[wallet.wallet_id] || [])];
    writeWalletTransactions(map);
    return { wallet: next, transaction: tx };
  },

  createDispute(jobIdOrJobPostId: string, openedByUserId: string, reason: string) {
    const now = new Date().toISOString();
    const jobPost = this.getJobById(jobIdOrJobPostId) || this.getJobPostByJobId(jobIdOrJobPostId);
    if (!jobPost) return null;
    const jobInstance = this.getJobInstanceById(jobIdOrJobPostId);
    const jobId = jobInstance?.id || (jobPost as any)?.job_id || null;

    const disputes = readDisputes();
    const existing = Object.values(disputes).find(
      (d) => d.job_post_id === jobPost.id && (d.status === 'open' || d.status === 'in_review')
    );
    if (existing) return existing;

    const id = crypto.randomUUID();
    const dispute: DemoDispute = {
      id,
      job_post_id: jobPost.id,
      job_id: jobId,
      opened_by_user_id: openedByUserId,
      status: 'open',
      reason,
      assigned_admin_id: null,
      created_at: now,
      updated_at: now,
    };
    disputes[id] = dispute;
    writeDisputes(disputes);

    const events = readDisputeEvents();
    const firstEvent: AdminDisputeEvent = {
      id: crypto.randomUUID(),
      dispute_id: id,
      actor_user_id: openedByUserId,
      event_type: 'status_change',
      message: 'Dispute opened: open',
      created_at: now,
    };
    events[id] = [firstEvent];
    writeDisputeEvents(events);

    const messages = readDisputeMessages();
    const systemMessage: DisputeMessage = {
      id: crypto.randomUUID(),
      dispute_id: id,
      sender_id: null,
      type: 'system',
      content: `Dispute opened (demo). Reason: ${reason}`,
      is_system_message: true,
      created_at: now,
      sender_email: null,
      sender_role: null,
    };
    messages[id] = [systemMessage];
    writeDisputeMessages(messages);

    return dispute;
  },

  getDisputeByJob(jobIdOrJobPostId: string) {
    const jobPost = this.getJobById(jobIdOrJobPostId) || this.getJobPostByJobId(jobIdOrJobPostId);
    if (!jobPost) return null;
    const disputes = Object.values(readDisputes()).filter((d) => d.job_post_id === jobPost.id);
    if (disputes.length === 0) return null;
    disputes.sort((a, b) => {
      const aOpen = a.status === 'open' || a.status === 'in_review';
      const bOpen = b.status === 'open' || b.status === 'in_review';
      if (aOpen !== bOpen) return aOpen ? -1 : 1;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
    const d = disputes[0];
    return { ...d, title: jobPost.title || 'Dispute' };
  },

  getDisputeById(disputeId: string) {
    const dispute = readDisputes()[disputeId] || null;
    if (!dispute) return null;
    const jobPost = this.getJobById(dispute.job_post_id);
    return {
      ...dispute,
      title: jobPost?.title || 'Dispute',
    };
  },

  getDisputeEvents(disputeId: string) {
    const map = readDisputeEvents();
    return map[disputeId] || [];
  },

  getDisputeMessages(disputeId: string) {
    const map = readDisputeMessages();
    return map[disputeId] || [];
  },

  postDisputeMessage(disputeId: string, sender: { id: string; role?: string; email?: string }, content: string) {
    const now = new Date().toISOString();
    const disputes = readDisputes();
    const dispute = disputes[disputeId];
    if (!dispute) return null;
    if (dispute.status !== 'open' && dispute.status !== 'in_review') return null;

    const message: DisputeMessage = {
      id: crypto.randomUUID(),
      dispute_id: disputeId,
      sender_id: sender.id,
      type: 'text',
      content,
      is_system_message: false,
      created_at: now,
      sender_email: sender.email || null,
      sender_role: sender.role || null,
    };
    const map = readDisputeMessages();
    map[disputeId] = [...(map[disputeId] || []), message];
    writeDisputeMessages(map);

    disputes[disputeId] = { ...dispute, updated_at: now };
    writeDisputes(disputes);

    return message;
  },

  requestDisputeClose(disputeId: string, actor: { id: string }, reason?: string) {
    const now = new Date().toISOString();
    const disputes = readDisputes();
    const dispute = disputes[disputeId];
    if (!dispute) return false;
    if (dispute.status !== 'open' && dispute.status !== 'in_review') return false;

    const events = readDisputeEvents();
    const list = events[disputeId] || [];
    if (dispute.status === 'open') {
      list.push({
        id: crypto.randomUUID(),
        dispute_id: disputeId,
        actor_user_id: actor.id,
        event_type: 'status_change',
        message: 'Status changed: open → in_review (request close)',
        created_at: now,
      });
      dispute.status = 'in_review';
    }
    list.push({
      id: crypto.randomUUID(),
      dispute_id: disputeId,
      actor_user_id: actor.id,
      event_type: 'note',
      message: reason ? `Request close: ${reason}` : 'Request close',
      created_at: now,
    });
    events[disputeId] = list;
    writeDisputeEvents(events);

    const messages = readDisputeMessages();
    const msgs = messages[disputeId] || [];
    msgs.push({
      id: crypto.randomUUID(),
      dispute_id: disputeId,
      sender_id: null,
      type: 'system',
      content: reason ? `User requested close. Reason: ${reason}` : 'User requested close.',
      is_system_message: true,
      created_at: now,
      sender_email: null,
      sender_role: null,
    });
    messages[disputeId] = msgs;
    writeDisputeMessages(messages);

    disputes[disputeId] = { ...dispute, updated_at: now };
    writeDisputes(disputes);
    return true;
  },

  getProfile(userId: string) {
    const profiles = readProfiles();
    return profiles[userId] || null;
  },

  updateProfile(userId: string, role: string, payload: any) {
    const profiles = readProfiles();
    const existing = profiles[userId]?.profile || null;
    const now = new Date().toISOString();
    const display_name = String(payload?.display_name || existing?.display_name || '').trim() || 'ผู้ใช้';

    if (role === 'hirer') {
      const profile = {
        id: existing?.id || crypto.randomUUID(),
        user_id: userId,
        display_name,
        address_line1: payload?.address_line1 ?? existing?.address_line1 ?? null,
        address_line2: payload?.address_line2 ?? existing?.address_line2 ?? null,
        district: payload?.district ?? existing?.district ?? null,
        province: payload?.province ?? existing?.province ?? null,
        postal_code: payload?.postal_code ?? existing?.postal_code ?? null,
        total_jobs_posted: existing?.total_jobs_posted ?? 0,
        total_jobs_completed: existing?.total_jobs_completed ?? 0,
        created_at: existing?.created_at || now,
        updated_at: now,
      };
      profiles[userId] = { role, profile };
      writeProfiles(profiles);
      return profile;
    }

    const profile = {
      id: existing?.id || crypto.randomUUID(),
      user_id: userId,
      display_name,
      bio: payload?.bio ?? existing?.bio ?? null,
      experience_years: payload?.experience_years ?? existing?.experience_years ?? null,
      certifications: payload?.certifications ?? existing?.certifications ?? null,
      specializations: payload?.specializations ?? existing?.specializations ?? null,
      available_from: payload?.available_from ?? existing?.available_from ?? null,
      available_to: payload?.available_to ?? existing?.available_to ?? null,
      available_days: payload?.available_days ?? existing?.available_days ?? null,
      total_jobs_completed: existing?.total_jobs_completed ?? 0,
      average_rating: existing?.average_rating ?? null,
      total_reviews: existing?.total_reviews ?? 0,
      created_at: existing?.created_at || now,
      updated_at: now,
    };
    profiles[userId] = { role, profile };
    writeProfiles(profiles);
    return profile;
  },
};

