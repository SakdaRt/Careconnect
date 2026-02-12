import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MainLayout } from '../../layouts';
import { Button, Card, Input, LoadingState } from '../../components/ui';
import { TopupIntent, TopupResult, Transaction, WalletBalance } from '../../services/api';
import { appApi } from '../../services/appApi';
import { useAuth } from '../../contexts';

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
  const [submitting, setSubmitting] = useState(false);
  const [pendingTopups, setPendingTopups] = useState<TopupIntent[]>([]);
  const [activeTopupId, setActiveTopupId] = useState<string | null>(null);
  const [activeTopup, setActiveTopup] = useState<TopupIntent | null>(null);
  const [latestTopupResult, setLatestTopupResult] = useState<TopupResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const wRes = await appApi.getWalletBalance(userId, 'hirer');
      if (!wRes.success || !wRes.data) {
        setWallet(null);
        setTransactions([]);
        setTxTotalPages(1);
        setPendingTopups([]);
        toast.error(wRes.error || 'โหลดกระเป๋าเงินไม่สำเร็จ');
        return;
      }

      setWallet(wRes.data);
      const tRes = await appApi.listWalletTransactions(userId, 'hirer', txPage, 20);
      setTransactions(tRes.success && tRes.data ? tRes.data.data : []);
      setTxTotalPages(tRes.success && tRes.data ? tRes.data.totalPages : 1);

      const pRes = await appApi.getPendingTopups();
      setPendingTopups(pRes.success && pRes.data ? pRes.data : []);
    } finally {
      setLoading(false);
    }
  }, [txPage, userId]);

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
      if (res.data?.topup_id) setActiveTopupId(res.data.topup_id);
      toast.success('เริ่มต้นการเติมเงินแล้ว');
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

    let stopped = false;
    const tick = async () => {
      const res = await appApi.getTopupStatus(activeTopupId);
      if (!res.success || !res.data) return;
      setActiveTopup(res.data);
      if (res.data.status === 'succeeded') {
        toast.success('เติมเงินสำเร็จ');
        setActiveTopupId(null);
        setActiveTopup(null);
        setLatestTopupResult(null);
        await load();
        return;
      }
      if (res.data.status === 'failed' || res.data.status === 'expired') {
        toast.error(res.data.error_message || 'เติมเงินไม่สำเร็จ/หมดอายุ');
        setActiveTopupId(null);
        setActiveTopup(null);
        setLatestTopupResult(null);
        await load();
      }
    };

    const interval = window.setInterval(() => {
      if (stopped) return;
      tick();
    }, 2000);

    tick();

    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [activeTopupId, load]);

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">กระเป๋าเงิน</h1>
            <p className="text-sm text-gray-600">เติมเงินและดูประวัติธุรกรรม</p>
          </div>
          <div className="flex gap-2">
            <Link to="/hirer/wallet/history">
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

            {active && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">กำลังรอการชำระเงิน</h2>
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
                  {(active.payment_link_url || latestTopupResult?.payment_url) && (
                    <div className="pt-3">
                      <Button
                        variant="primary"
                        onClick={() => window.open(active.payment_link_url || latestTopupResult?.payment_url, '_blank')}
                      >
                        เปิดหน้าชำระเงิน
                      </Button>
                    </div>
                  )}
                  {(active.qr_payload || latestTopupResult?.qr_code) && (
                    <div className="pt-3">
                      <div className="text-xs text-gray-500 mb-1">QR Payload</div>
                      <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-auto">
                        {String(active.qr_payload || latestTopupResult?.qr_code)}
                      </pre>
                    </div>
                  )}
                  {active.error_message && <div className="text-sm text-red-600 pt-2">{active.error_message}</div>}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={load}>
                    รีเฟรชสถานะ
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setActiveTopupId(null);
                      setActiveTopup(null);
                      setLatestTopupResult(null);
                    }}
                  >
                    หยุดติดตาม
                  </Button>
                </div>
              </Card>
            )}

            <Card className="p-6">
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
                    เติมเงิน
                  </Button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">โหมดจริงจะเริ่มต้นการชำระเงิน (PromptPay) แล้วรอ webhook</p>
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
    </MainLayout>
  );
}

