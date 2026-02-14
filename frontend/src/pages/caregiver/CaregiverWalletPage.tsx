import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ShieldCheck } from 'lucide-react';
import { MainLayout } from '../../layouts';
import { Button, Card, Input, LoadingState } from '../../components/ui';
import { BankAccount, Transaction, WalletBalance, WithdrawalRequest } from '../../services/api';
import { appApi } from '../../services/appApi';
import { useAuth } from '../../contexts';

export default function CaregiverWalletPage() {
  const { user } = useAuth();
  const userId = user?.id || 'demo-caregiver';

  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txPage, setTxPage] = useState(1);
  const [txTotalPages, setTxTotalPages] = useState(1);
  const [typeFilter, setTypeFilter] = useState<'all' | Transaction['type']>('all');
  const [refFilter, setRefFilter] = useState<'all' | Transaction['reference_type']>('all');
  const [amount, setAmount] = useState(500);
  const [submitting, setSubmitting] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | null>(null);
  const [newBankCode, setNewBankCode] = useState('SCB');
  const [newBankName, setNewBankName] = useState('Siam Commercial Bank');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [addingBank, setAddingBank] = useState(false);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [wdPage, setWdPage] = useState(1);
  const [wdTotalPages, setWdTotalPages] = useState(1);
  const [wdStatus, setWdStatus] = useState<'all' | string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const wRes = await appApi.getWalletBalance(userId, 'caregiver');
      if (!wRes.success || !wRes.data) {
        setWallet(null);
        setTransactions([]);
        setTxTotalPages(1);
        setBankAccounts([]);
        setWithdrawals([]);
        toast.error(wRes.error || 'โหลดกระเป๋าเงินไม่สำเร็จ');
        return;
      }

      setWallet(wRes.data);
      const tRes = await appApi.listWalletTransactions(userId, 'caregiver', txPage, 20);
      setTransactions(tRes.success && tRes.data ? tRes.data.data : []);
      setTxTotalPages(tRes.success && tRes.data ? tRes.data.totalPages : 1);

      const bRes = await appApi.getBankAccounts();
      const list = bRes.success && bRes.data ? bRes.data : [];
      setBankAccounts(list);
      const primary = list.find((b) => b.is_primary) || list[0];
      if (primary && !selectedBankAccountId) setSelectedBankAccountId(primary.id);

      const wds = await appApi.getWithdrawals({ page: wdPage, limit: 10, status: wdStatus === 'all' ? undefined : wdStatus });
      setWithdrawals(wds.success && wds.data ? wds.data.data : []);
      setWdTotalPages(wds.success && wds.data ? wds.data.totalPages : 1);
    } finally {
      setLoading(false);
    }
  }, [selectedBankAccountId, txPage, wdPage, wdStatus, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleWithdraw = async () => {
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error('กรุณาระบุจำนวนเงินที่ถูกต้อง');
      return;
    }
    setSubmitting(true);
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
      setSubmitting(false);
    }
  };

  const filtered = transactions.filter((t) => {
    if (typeFilter !== 'all' && t.type !== typeFilter) return false;
    if (refFilter !== 'all' && t.reference_type !== refFilter) return false;
    return true;
  });

  const selectedBank = useMemo(
    () => bankAccounts.find((b) => b.id === selectedBankAccountId) || null,
    [bankAccounts, selectedBankAccountId]
  );

  const handleAddBankAccount = async () => {
    if (!newBankCode.trim() || !newAccountNumber.trim() || !newAccountName.trim()) {
      toast.error('กรอกข้อมูลให้ครบ');
      return;
    }
    setAddingBank(true);
    try {
      const res = await appApi.addBankAccount({
        bank_code: newBankCode.trim(),
        bank_name: newBankName.trim() || undefined,
        account_number: newAccountNumber.trim(),
        account_name: newAccountName.trim(),
        set_primary: bankAccounts.length === 0,
      });
      if (!res.success || !res.data?.bank_account) {
        toast.error(res.error || 'เพิ่มบัญชีไม่สำเร็จ');
        return;
      }
      toast.success(res.data.message || 'เพิ่มบัญชีสำเร็จ');
      setSelectedBankAccountId(res.data.bank_account.id);
      setNewAccountNumber('');
      await load();
    } finally {
      setAddingBank(false);
    }
  };

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

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">กระเป๋าเงิน</h1>
            <p className="text-sm text-gray-600">ดูรายได้และถอนเงิน</p>
          </div>
          <div className="flex gap-2">
            <Link to="/caregiver/wallet/history">
              <Button variant="outline">ประวัติ</Button>
            </Link>
            <Button variant="outline" onClick={load}>
              รีเฟรช
            </Button>
          </div>
        </div>

        {loading ? (
          <LoadingState message="กำลังโหลดกระเป๋าเงิน..." />
        ) : (
          <div className="space-y-4">
            <Card className="p-6">
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
                    {(wallet?.total_balance || 0).toLocaleString()} บาท
                  </div>
                </div>
              </div>
            </Card>

            {(
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">บัญชีธนาคาร</h2>
                {bankAccounts.length === 0 ? (
                  <div className="text-sm text-gray-600 mb-4">ยังไม่มีบัญชีธนาคาร (เพิ่มเพื่อถอนเงิน)</div>
                ) : (
                  <div className="space-y-2 mb-4">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Bank Code" value={newBankCode} onChange={(e) => setNewBankCode(e.target.value)} />
                  <Input label="Bank Name" value={newBankName} onChange={(e) => setNewBankName(e.target.value)} />
                  <Input
                    label="Account Number"
                    value={newAccountNumber}
                    onChange={(e) => setNewAccountNumber(e.target.value)}
                    placeholder="เช่น 1234567890"
                  />
                  <Input
                    label="Account Name"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    placeholder="ชื่อบัญชี"
                  />
                </div>
                <div className="mt-3">
                  <Button variant="primary" loading={addingBank} onClick={handleAddBankAccount}>
                    เพิ่มบัญชี
                  </Button>
                </div>
                <div className="text-xs text-gray-500 mt-2">โหมด dev จะ mark verified อัตโนมัติ เพื่อให้ถอนเงินได้</div>
              </Card>
            )}

            {!['L2', 'L3'].includes(user?.trust_level || 'L0') && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-900">ยืนยันตัวตนเพื่อถอนเงิน</p>
                  <p className="text-xs text-amber-700 mt-1">
                    การถอนเงินต้อง Trust Level L2 ขึ้นไป (ยืนยันเบอร์โทร + KYC)
                  </p>
                  <div className="mt-2">
                    <Link to="/kyc">
                      <Button variant="primary" size="sm">ยืนยันตัวตน (KYC)</Button>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">ถอนเงิน</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  label="จำนวนเงิน (บาท)"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
                <div className="sm:self-end">
                  <Button variant="primary" loading={submitting} onClick={handleWithdraw}>
                    ถอนเงิน
                  </Button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                บัญชีที่เลือก: {selectedBank ? `${selectedBank.bank_name || selectedBank.bank_code} •••• ${selectedBank.account_number_last4}` : '-'}
              </p>
            </Card>

            <Card className="p-6">
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

            <Card className="p-6">
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
                        {t.reference_type === 'job' && (
                          <div className="mt-2">
                            <Link to={`/caregiver/wallet/earning/${t.reference_id}`}>
                              <Button variant="outline" size="sm">
                                ดูรายละเอียดงานนี้
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
    </MainLayout>
  );
}

