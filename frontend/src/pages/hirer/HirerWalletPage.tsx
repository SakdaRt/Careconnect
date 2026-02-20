import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MainLayout } from '../../layouts';
import { Button, Card, Input, LoadingState, Modal } from '../../components/ui';
import { BankAccount, TopupIntent, TopupResult, Transaction, WalletBalance, WithdrawalRequest } from '../../services/api';
import { appApi } from '../../services/appApi';
import { useAuth } from '../../contexts';

const MOCK_QR_SIDE = 21;

function seededNumberFromText(text: string): number {
  let seed = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    seed ^= text.charCodeAt(i);
    seed = Math.imul(seed, 0x01000193);
  }
  return seed >>> 0;
}

function finderPatternCell(row: number, col: number, size: number): boolean | null {
  let localRow = -1;
  let localCol = -1;

  const inTopLeft = row < 7 && col < 7;
  const inTopRight = row < 7 && col >= size - 7;
  const inBottomLeft = row >= size - 7 && col < 7;

  if (inTopLeft) {
    localRow = row;
    localCol = col;
  } else if (inTopRight) {
    localRow = row;
    localCol = col - (size - 7);
  } else if (inBottomLeft) {
    localRow = row - (size - 7);
    localCol = col;
  } else {
    return null;
  }

  if (localRow === 0 || localRow === 6 || localCol === 0 || localCol === 6) return true;
  if (localRow === 1 || localRow === 5 || localCol === 1 || localCol === 5) return false;
  return true;
}

function buildMockQrCells(payload: string, size = MOCK_QR_SIDE): boolean[] {
  const cells: boolean[] = [];
  let state = seededNumberFromText(payload || 'careconnect-demo');

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const finderCell = finderPatternCell(row, col, size);
      if (finderCell !== null) {
        cells.push(finderCell);
        continue;
      }

      state ^= state << 13;
      state >>>= 0;
      state ^= state >>> 17;
      state >>>= 0;
      state ^= state << 5;
      state >>>= 0;

      const bit = ((state + row * 31 + col * 17) & 1) === 1;
      cells.push(bit);
    }
  }

  return cells;
}

function MockQrPreview({ payload }: { payload: string }) {
  const cells = useMemo(() => buildMockQrCells(payload), [payload]);

  return (
    <div className="inline-flex items-center justify-center p-4 bg-white border-4 border-gray-900 rounded-xl shadow-sm">
      <div
        className="grid"
        style={{
          width: 210,
          gridTemplateColumns: `repeat(${MOCK_QR_SIDE}, minmax(0, 1fr))`,
        }}
      >
        {cells.map((filled, idx) => (
          <div
            key={idx}
            className={filled ? 'bg-gray-900' : 'bg-white'}
            style={{ aspectRatio: '1 / 1' }}
          />
        ))}
      </div>
    </div>
  );
}

export default function HirerWalletPage() {
  const { user } = useAuth();
  const userId = user?.id || 'demo-hirer';

  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txPage, setTxPage] = useState(1);
  const [txTotalPages, setTxTotalPages] = useState(1);
  const [typeFilter, setTypeFilter] = useState<'all' | Transaction['type']>('all');
  const [refFilter, setRefFilter] = useState<'all' | Transaction['reference_type']>('all');
  const [amount, setAmount] = useState(1000);
  const [withdrawAmount, setWithdrawAmount] = useState(500);
  const [submitting, setSubmitting] = useState(false);
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);
  const [pendingTopups, setPendingTopups] = useState<TopupIntent[]>([]);
  const [activeTopupId, setActiveTopupId] = useState<string | null>(null);
  const [activeTopup, setActiveTopup] = useState<TopupIntent | null>(null);
  const [latestTopupResult, setLatestTopupResult] = useState<TopupResult | null>(null);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [confirmingTopup, setConfirmingTopup] = useState(false);

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [wdPage, setWdPage] = useState(1);
  const [wdTotalPages, setWdTotalPages] = useState(1);
  const [wdStatus, setWdStatus] = useState<'all' | string>('all');

  const clearActiveTopup = useCallback(() => {
    const closingTopupId = activeTopupId;
    if (closingTopupId) {
      setPendingTopups((items) => items.filter((item) => item.id !== closingTopupId));
    }
    setActiveTopupId(null);
    setActiveTopup(null);
    setLatestTopupResult(null);
    setShowTopupModal(false);
  }, [activeTopupId]);

  const refreshTopupStatus = useCallback(async (topupId: string) => {
    const res = await appApi.getTopupStatus(topupId);
    if (!res.success || !res.data) {
      return null;
    }
    setActiveTopup(res.data);
    return res.data;
  }, []);

  const syncTopupStatusNow = useCallback(
    async (topupId: string, attempts = 1, waitMs = 700) => {
      let latest: TopupIntent | null = null;
      for (let i = 0; i < attempts; i += 1) {
        latest = await refreshTopupStatus(topupId);
        if (!latest) return null;
        if (latest.status !== 'pending') return latest;
        if (i < attempts - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, waitMs));
        }
      }
      return latest;
    },
    [refreshTopupStatus]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const wRes = await appApi.getWalletBalance(userId, 'hirer');
      if (!wRes.success || !wRes.data) {
        setWallet(null);
        setTransactions([]);
        setTxTotalPages(1);
        setPendingTopups([]);
        setBankAccounts([]);
        setWithdrawals([]);
        toast.error(wRes.error || 'โหลดกระเป๋าเงินไม่สำเร็จ');
        return;
      }

      setWallet(wRes.data);
      const tRes = await appApi.listWalletTransactions(userId, 'hirer', txPage, 20);
      setTransactions(tRes.success && tRes.data ? tRes.data.data : []);
      setTxTotalPages(tRes.success && tRes.data ? tRes.data.totalPages : 1);

      const pRes = await appApi.getPendingTopups();
      setPendingTopups(pRes.success && pRes.data ? pRes.data : []);

      const bRes = await appApi.getBankAccounts();
      const list = bRes.success && bRes.data ? bRes.data : [];
      setBankAccounts(list);
      const primary = list.find((b) => b.is_primary) || list[0];
      if (!selectedBankAccountId || (selectedBankAccountId && !list.some((b) => b.id === selectedBankAccountId))) {
        setSelectedBankAccountId(primary ? primary.id : null);
      }

      const wds = await appApi.getWithdrawals({ page: wdPage, limit: 10, status: wdStatus === 'all' ? undefined : wdStatus });
      setWithdrawals(wds.success && wds.data ? wds.data.data : []);
      setWdTotalPages(wds.success && wds.data ? wds.data.totalPages : 1);
    } finally {
      setLoading(false);
    }
  }, [selectedBankAccountId, txPage, wdPage, wdStatus, userId]);

  const applyResolvedTopupStatus = useCallback(
    async (topup: TopupIntent | null) => {
      if (!topup) return false;
      setActiveTopup(topup);

      if (topup.status === 'succeeded') {
        toast.success('ชำระเงินสำเร็จ เงินเข้ากระเป๋าแล้ว');
        clearActiveTopup();
        await load();
        return true;
      }

      if (topup.status === 'failed' || topup.status === 'expired') {
        toast.error(topup.error_message || 'ไม่พบการชำระเงินหรือรายการหมดอายุ');
        clearActiveTopup();
        await load();
        return true;
      }

      return false;
    },
    [clearActiveTopup, load]
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleTopUp = async () => {
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error('กรุณาระบุจำนวนเงินที่ถูกต้อง');
      return;
    }
    setSubmitting(true);
    try {
      const res = await appApi.topUpWallet(value, 'promptpay');
      if (!res.success) {
        toast.error(res.error || 'เติมเงินไม่สำเร็จ');
        return;
      }
      setLatestTopupResult(res.data || null);
      if (res.data?.topup_id) {
        setActiveTopupId(res.data.topup_id);
        setShowTopupModal(true);
      }
      toast.success('เริ่มต้นการเติมเงินแล้ว');
      await load();
      if (res.data?.topup_id) {
        await refreshTopupStatus(res.data.topup_id);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmTopup = async () => {
    if (!activeTopupId) return;

    setConfirmingTopup(true);
    try {
      const beforeConfirm = await syncTopupStatusNow(activeTopupId);
      if (await applyResolvedTopupStatus(beforeConfirm)) {
        return;
      }

      const res = await appApi.confirmTopupPayment(activeTopupId);

      if (!res.success) {
        const fallbackStatus = await syncTopupStatusNow(activeTopupId, 3);
        if (await applyResolvedTopupStatus(fallbackStatus)) {
          return;
        }

        const normalizedError = (res.error || '').toLowerCase();
        if (normalizedError.includes('requested resource was not found')) {
          toast('ยังไม่พบ endpoint ยืนยัน ระบบเช็กสถานะล่าสุดแล้ว กรุณาลองกดยืนยันอีกครั้ง', { icon: '⏳' });
          return;
        }

        toast.error(res.error || 'ตรวจสอบการชำระเงินไม่สำเร็จ');
        return;
      }

      if (await applyResolvedTopupStatus(res.data?.topup || null)) {
        return;
      }

      const latestAfterConfirm = await syncTopupStatusNow(activeTopupId, 3);
      if (await applyResolvedTopupStatus(latestAfterConfirm)) {
        return;
      }

      toast('ยังไม่พบรายการชำระเงิน โปรดชำระเงินก่อนแล้วกดยืนยันอีกครั้ง', { icon: '⏳' });
    } finally {
      setConfirmingTopup(false);
    }
  };

  const handleWithdraw = async () => {
    const value = Number(withdrawAmount);
    if (!value || value <= 0) {
      toast.error('กรุณาระบุจำนวนเงินที่ถูกต้อง');
      return;
    }
    setSubmittingWithdraw(true);
    try {
      if (!selectedBankAccountId) {
        toast.error('กรุณาเลือกบัญชีธนาคารก่อนถอนเงิน');
        return;
      }

      const res = await appApi.initiateWithdrawal(value, selectedBankAccountId);
      if (!res.success) {
        const code = (res as any).code as string | undefined;
        const errMsg = String(res.error || '');
        if (code === 'POLICY_VIOLATION' || code === 'INSUFFICIENT_TRUST_LEVEL' || errMsg.includes('trust') || errMsg.includes('Trust') || errMsg.includes('L2')) {
          toast.error('ต้องยืนยันตัวตน KYC ก่อนถอนเงิน (Trust Level L2+)');
        } else {
          toast.error(res.error || 'ถอนเงินไม่สำเร็จ');
        }
        return;
      }
      toast.success(res.data?.message || 'ส่งคำขอถอนเงินแล้ว');
      await load();
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  const selectedBank = useMemo(
    () => bankAccounts.find((b) => b.id === selectedBankAccountId) || null,
    [bankAccounts, selectedBankAccountId]
  );

  const handleCancelWithdrawal = async (withdrawalId: string) => {
    const res = await appApi.cancelWithdrawal(withdrawalId);
    if (!res.success) {
      toast.error(res.error || 'ยกเลิกไม่สำเร็จ');
      return;
    }
    toast.success(res.data?.message || 'ยกเลิกแล้ว');
    await load();
  };

  const formatDateTime = (iso: string) => new Date(iso).toLocaleString('th-TH');

  const filtered = transactions.filter((t) => {
    if (typeFilter !== 'all' && t.type !== typeFilter) return false;
    if (refFilter !== 'all' && t.reference_type !== refFilter) return false;
    return true;
  });

  const active = useMemo(() => {
    if (activeTopup) return activeTopup;
    if (!activeTopupId) return null;
    return pendingTopups.find((t) => t.id === activeTopupId) || null;
  }, [activeTopup, activeTopupId, pendingTopups]);

  useEffect(() => {
    if (activeTopupId) return;
    if (pendingTopups.length === 0) return;
    setActiveTopupId(pendingTopups[0].id);
  }, [activeTopupId, pendingTopups]);

  useEffect(() => {
    if (!activeTopupId) return;

    refreshTopupStatus(activeTopupId);
  }, [activeTopupId, refreshTopupStatus]);

  const activeQrPayload = String(active?.qr_payload || latestTopupResult?.qr_code || activeTopupId || 'careconnect-demo');
  const activePaymentUrl = active?.payment_link_url || latestTopupResult?.payment_url || null;

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-6 space-y-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">กระเป๋าเงิน</h1>
            <p className="text-sm text-gray-600 leading-6 mt-1">เติมเงินและถอนเงินได้ รวมถึงดูประวัติธุรกรรม</p>
          </div>
          <div className="flex gap-2 sm:justify-end">
            <Link to="/hirer/wallet/history" className="flex-1 sm:flex-none">
              <Button variant="outline" className="w-full">ประวัติ</Button>
            </Link>
            <Button variant="outline" onClick={load} className="flex-1 sm:flex-none">
              รีเฟรช
            </Button>
          </div>
        </div>

        {loading ? (
          <LoadingState message="กำลังโหลดกระเป๋าเงิน..." />
        ) : (
          <div className="space-y-4">
            <Card className="p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="text-xs text-gray-500">คงเหลือ</div>
                  <div className="text-xl font-bold text-gray-900">
                    {(wallet?.available_balance || 0).toLocaleString()} บาท
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">เงินที่ถูกพัก</div>
                  <div className="text-xl font-bold text-gray-900">
                    {(wallet?.held_balance || 0).toLocaleString()} บาท
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">รวม</div>
                  <div className="text-xl font-bold text-gray-900">
                    {((wallet?.available_balance || 0) + (wallet?.held_balance || 0)).toLocaleString()} บาท
                  </div>
                </div>
              </div>
            </Card>

            {active && (
              <Card className="p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">มีรายการรอชำระเงิน</h2>
                <div className="text-sm text-gray-700 space-y-1">
                  <div>
                    สถานะ: <strong>{active.status}</strong>
                  </div>
                  <div>
                    จำนวนเงิน: <strong>{Number(active.amount).toLocaleString()}</strong> บาท
                  </div>
                  <div className="text-xs text-gray-500 font-mono break-all">topup_id: {active.id}</div>
                  {active.expires_at && (
                    <div className="text-xs text-gray-500">หมดอายุ: {new Date(active.expires_at).toLocaleString('th-TH')}</div>
                  )}
                  {active.error_message && <div className="text-sm text-red-600 pt-2">{active.error_message}</div>}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="primary" size="sm" onClick={() => setShowTopupModal(true)}>
                    เปิด QR ชำระเงิน
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (!activeTopupId) return;
                      await refreshTopupStatus(activeTopupId);
                    }}
                  >
                    ตรวจสอบสถานะ
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearActiveTopup}
                  >
                    ปิดรายการ
                  </Button>
                </div>
              </Card>
            )}

            <Card className="p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">เติมเงิน</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  label="จำนวนเงิน (บาท)"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
                <div className="sm:self-end">
                  <Button variant="primary" loading={submitting} onClick={handleTopUp}>
                    เติมเงินด้วย QR
                  </Button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">ระบบจำลอง: เมื่อกดเติมเงิน จะเปิด popup QR และให้กดยืนยันหลังชำระเสร็จ</p>
            </Card>

            <Card className="p-4 sm:p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold text-gray-900">บัญชีธนาคารสำหรับถอนเงิน</h2>
                <Link to="/wallet/bank-accounts">
                  <Button variant="outline" size="sm">ไปหน้าจัดการบัญชี</Button>
                </Link>
              </div>
              {bankAccounts.length === 0 ? (
                <div className="text-sm text-gray-600">ยังไม่มีบัญชีธนาคาร กรุณาเพิ่มจากหน้าจัดการบัญชี</div>
              ) : (
                <div className="space-y-2">
                  {bankAccounts.map((b) => (
                    <label key={b.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                      <input
                        type="radio"
                        name="bank_account"
                        checked={selectedBankAccountId === b.id}
                        onChange={() => setSelectedBankAccountId(b.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {b.bank_name || b.bank_code} • •••• {b.account_number_last4}
                        </div>
                        <div className="text-xs text-gray-600">{b.account_name}</div>
                      </div>
                      <div className="text-xs text-gray-600">{b.is_verified ? 'verified' : 'pending'}</div>
                    </label>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">ถอนเงิน</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  label="จำนวนเงิน (บาท)"
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                />
                <div className="sm:self-end">
                  <Button variant="primary" loading={submittingWithdraw} onClick={handleWithdraw}>
                    ถอนเงิน
                  </Button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                บัญชีที่เลือก: {selectedBank ? `${selectedBank.bank_name || selectedBank.bank_code} •••• ${selectedBank.account_number_last4}` : '-'}
              </p>
            </Card>

            <Card className="p-4 sm:p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold text-gray-900">รายการถอนเงิน</h2>
                <div className="flex items-center gap-2">
                  <select
                    className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                    value={wdStatus}
                    onChange={(e) => {
                      setWdStatus(e.target.value);
                      setWdPage(1);
                    }}
                  >
                    <option value="all">ทั้งหมด</option>
                    <option value="queued">queued</option>
                    <option value="review">review</option>
                    <option value="approved">approved</option>
                    <option value="paid">paid</option>
                    <option value="rejected">rejected</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                  <Button variant="outline" size="sm" onClick={load}>
                    รีเฟรช
                  </Button>
                </div>
              </div>

              {withdrawals.length === 0 ? (
                <div className="text-sm text-gray-600">ยังไม่มีรายการถอนเงิน</div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {withdrawals.map((w) => (
                    <div key={w.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900">
                          {w.status} • {Number(w.amount).toLocaleString()} บาท
                        </div>
                        <div className="text-xs text-gray-600">
                          {w.bank_name ? `${w.bank_name} •••• ${w.account_number_last4 || '-'}` : `bank_account_id: ${w.bank_account_id}`}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{formatDateTime(w.created_at)}</div>
                        <div className="text-[11px] text-gray-500 mt-1 font-mono break-all">{w.id}</div>
                      </div>
                      {w.status === 'queued' && (
                        <Button variant="outline" size="sm" onClick={() => handleCancelWithdrawal(w.id)}>
                          ยกเลิก
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-3 mt-4">
                <Button variant="outline" size="sm" disabled={wdPage <= 1} onClick={() => setWdPage((p) => Math.max(1, p - 1))}>
                  ก่อนหน้า
                </Button>
                <div className="text-xs text-gray-600">
                  หน้า {wdPage} / {wdTotalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={wdPage >= wdTotalPages}
                  onClick={() => setWdPage((p) => Math.min(wdTotalPages, p + 1))}
                >
                  ถัดไป
                </Button>
              </div>
            </Card>

            <Card className="p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">ธุรกรรมล่าสุด</h2>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">ประเภท</label>
                  <select
                    className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as any)}
                  >
                    <option value="all">ทั้งหมด</option>
                    <option value="credit">credit</option>
                    <option value="debit">debit</option>
                    <option value="hold">hold</option>
                    <option value="release">release</option>
                    <option value="reversal">reversal</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">อ้างอิง</label>
                  <select
                    className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                    value={refFilter}
                    onChange={(e) => setRefFilter(e.target.value as any)}
                  >
                    <option value="all">ทั้งหมด</option>
                    <option value="topup">topup</option>
                    <option value="job">job</option>
                    <option value="fee">fee</option>
                    <option value="withdrawal">withdrawal</option>
                    <option value="refund">refund</option>
                    <option value="dispute">dispute</option>
                    <option value="penalty">penalty</option>
                  </select>
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="text-sm text-gray-600">ยังไม่มีธุรกรรม</div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filtered.map((t) => (
                    <div key={t.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900">
                          {t.type.toUpperCase()} • {t.reference_type}
                        </div>
                        <div className="text-xs text-gray-500">{new Date(t.created_at).toLocaleString('th-TH')}</div>
                        {t.description && <div className="text-xs text-gray-600 mt-1">{t.description}</div>}
                        <div className="text-[11px] text-gray-500 mt-1 font-mono break-all">
                          ref:{t.reference_id}
                        </div>
                        {(t.reference_type === 'job' || t.reference_type === 'fee' || t.reference_type === 'refund') && (
                          <div className="mt-2">
                            <Link to={`/hirer/wallet/receipt/${t.reference_id}`}>
                              <Button variant="outline" size="sm">
                                ดูใบเสร็จ
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-gray-900">{t.amount.toLocaleString()} บาท</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-3 mt-4">
                <Button variant="outline" size="sm" disabled={txPage <= 1} onClick={() => setTxPage((p) => Math.max(1, p - 1))}>
                  ก่อนหน้า
                </Button>
                <div className="text-xs text-gray-600">
                  หน้า {txPage} / {txTotalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={txPage >= txTotalPages}
                  onClick={() => setTxPage((p) => Math.min(txTotalPages, p + 1))}
                >
                  ถัดไป
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>

      <Modal
        isOpen={showTopupModal && !!activeTopupId}
        onClose={() => setShowTopupModal(false)}
        title="สแกนเพื่อชำระเงิน"
        size="md"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowTopupModal(false)}>
              ปิด
            </Button>
            <Button variant="primary" loading={confirmingTopup} onClick={handleConfirmTopup}>
              ยืนยันการชำระเงิน
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-center">
          <div className="text-sm text-gray-700">
            จำนวนเงิน: <strong>{Number(active?.amount || latestTopupResult?.amount || amount).toLocaleString()} บาท</strong>
          </div>

          <MockQrPreview payload={activeQrPayload} />

          <div className="text-xs text-gray-500">
            * QR นี้เป็นโหมดจำลองสำหรับทดสอบ ยังไม่มีการตัดเงินจริง
          </div>

          <div className="text-left bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1">
            <div className="text-xs text-gray-600">สถานะล่าสุด: <strong>{active?.status || 'pending'}</strong></div>
            <div className="text-xs text-gray-500 font-mono break-all">topup_id: {activeTopupId}</div>
            {active?.expires_at && (
              <div className="text-xs text-gray-500">หมดอายุ: {new Date(active.expires_at).toLocaleString('th-TH')}</div>
            )}
          </div>

          {activePaymentUrl && (
            <div>
              <Button variant="outline" onClick={() => window.open(activePaymentUrl, '_blank')}>
                เปิดหน้าจำลองการชำระเงิน
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </MainLayout>
  );
}

