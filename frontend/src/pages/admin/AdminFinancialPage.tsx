import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { WithdrawalRequest, DashboardStats, LedgerTransaction } from '../../services/api';
import { Button, Card, Input, LoadingState } from '../../components/ui';
import { AdminLayout } from '../../layouts';

type TabKey = 'dashboard' | 'withdrawals' | 'transactions';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  queued: { label: 'รอรับเรื่อง', color: 'bg-yellow-100 text-yellow-800' },
  review: { label: 'กำลังตรวจสอบ', color: 'bg-blue-100 text-blue-800' },
  approved: { label: 'อนุมัติแล้ว', color: 'bg-green-100 text-green-800' },
  paid: { label: 'จ่ายแล้ว', color: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: 'ปฏิเสธ', color: 'bg-red-100 text-red-800' },
  cancelled: { label: 'ยกเลิก', color: 'bg-gray-100 text-gray-600' },
};

const TXN_TYPE_LABELS: Record<string, string> = {
  credit: 'เงินเข้า',
  debit: 'เงินออก',
  hold: 'กันเงิน',
  release: 'ปลดล็อค',
  reversal: 'กลับรายการ',
};

function formatMoney(n?: number | string | null) {
  if (n == null) return '฿0';
  return `฿${Number(n).toLocaleString()}`;
}

function formatDate(iso?: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('th-TH');
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_LABELS[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>;
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 mt-4">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(Math.max(1, page - 1))}>
        ก่อนหน้า
      </Button>
      <span className="text-xs text-gray-600">หน้า {page} / {totalPages}</span>
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onChange(Math.min(totalPages, page + 1))}>
        ถัดไป
      </Button>
    </div>
  );
}

function SummaryCard({ title, value, sub, className }: { title: string; value: string; sub?: string; className?: string }) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-4 ${className || ''}`}>
      <div className="text-xs font-medium text-gray-500">{title}</div>
      <div className="text-xl font-bold text-gray-900 tabular-nums mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function DashboardTab() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await api.adminGetDashboardStats();
      if (res.success && res.data) setStats(res.data);
      else toast.error(res.error || 'โหลด dashboard ไม่สำเร็จ');
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingState message="กำลังโหลด dashboard..." />;
  if (!stats) return <div className="text-sm text-gray-600">ไม่สามารถโหลดข้อมูลได้</div>;

  const w = stats.wallets;
  const totalSystem = Object.values(w).reduce((s, v) => s + v.total_available + v.total_held, 0);
  const wd = stats.withdrawals;
  const pendingCount = (wd.queued?.count || 0) + (wd.review?.count || 0) + (wd.approved?.count || 0);
  const pendingAmount = (wd.queued?.total_amount || 0) + (wd.review?.total_amount || 0) + (wd.approved?.total_amount || 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard title="เงินรวมในระบบ" value={formatMoney(totalSystem)} sub={`${Object.values(w).reduce((s, v) => s + v.count, 0)} กระเป๋าเงิน`} />
        <SummaryCard title="เงินค้ำประกัน (Escrow)" value={formatMoney((w.escrow?.total_held || 0) + (w.escrow?.total_available || 0))} sub={`${w.escrow?.count || 0} งาน`} />
        <SummaryCard title="รายได้แพลตฟอร์ม" value={formatMoney(w.platform?.total_available || 0)} sub="ค่าธรรมเนียม" />
        <SummaryCard title="รอโอน" value={formatMoney(pendingAmount)} sub={`${pendingCount} รายการ`} />
        <SummaryCard title="โอนแล้ว" value={formatMoney(wd.paid?.total_amount || 0)} sub={`${wd.paid?.count || 0} รายการ`} />
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">สรุปรายเดือน (6 เดือนล่าสุด)</h3>
        {stats.monthly.length === 0 ? (
          <div className="text-sm text-gray-500">ยังไม่มีข้อมูล</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-3 font-medium text-gray-600">เดือน</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">เติมเงิน</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">ค่าธรรมเนียม</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">ถอนออก</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">คืนเงิน</th>
                </tr>
              </thead>
              <tbody>
                {stats.monthly.map((m) => (
                  <tr key={m.month} className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-medium text-gray-900">{m.month}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-green-700">{formatMoney(m.topup_amount)} <span className="text-gray-500">({m.topup_count})</span></td>
                    <td className="py-2 px-2 text-right tabular-nums text-blue-700">{formatMoney(m.fee_amount)} <span className="text-gray-500">({m.fee_count})</span></td>
                    <td className="py-2 px-2 text-right tabular-nums text-orange-700">{formatMoney(m.payout_amount)} <span className="text-gray-500">({m.payout_count})</span></td>
                    <td className="py-2 px-2 text-right tabular-nums text-red-600">{formatMoney(m.reversal_amount)} <span className="text-gray-500">({m.reversal_count})</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">ความถูกต้องของบัญชี</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {stats.ledger_integrity.valid ? (
            <span className="text-green-700 font-medium">ถูกต้อง — ผลต่าง: 0</span>
          ) : (
            <span className="text-red-700 font-medium">ไม่ตรงกัน — ผลต่าง: {formatMoney(stats.ledger_integrity.difference)}</span>
          )}
          <span className="text-gray-500 text-xs ml-2">
            เงินเข้า: {formatMoney(stats.ledger_integrity.credits)} | เงินออก: {formatMoney(stats.ledger_integrity.debits)} | ยอดรวม Wallet: {formatMoney(stats.ledger_integrity.walletSum)}
          </span>
        </div>
      </Card>
    </div>
  );
}

function WithdrawalsTab() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [items, setItems] = useState<WithdrawalRequest[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [payoutRef, setPayoutRef] = useState<Record<string, string>>({});
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: string; label: string } | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.adminGetWithdrawals({
        page,
        limit: 20,
        status: status === 'all' ? undefined : status,
        search: search || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      if (!res.success) {
        toast.error(res.error || 'โหลดข้อมูลไม่สำเร็จ');
        setItems([]);
        return;
      }
      setItems(res.data?.data || []);
      setTotalPages(res.data?.totalPages || 1);
    } finally {
      setLoading(false);
    }
  }, [page, status, search, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const doAction = async (id: string, action: string) => {
    setSubmitting(id);
    setConfirmAction(null);
    try {
      if (action === 'review') {
        const res = await api.adminReviewWithdrawal(id);
        if (!res.success) toast.error(res.error || 'ทำรายการไม่สำเร็จ');
        else toast.success('รับเรื่องแล้ว');
      } else if (action === 'approve') {
        const res = await api.adminApproveWithdrawal(id);
        if (!res.success) toast.error(res.error || 'ทำรายการไม่สำเร็จ');
        else toast.success('อนุมัติแล้ว');
      } else if (action === 'reject') {
        if (!rejectReason[id]?.trim()) {
          toast.error('กรุณาระบุเหตุผลก่อนปฏิเสธ');
          setSubmitting(null);
          return;
        }
        const res = await api.adminRejectWithdrawal(id, rejectReason[id]);
        if (!res.success) toast.error(res.error || 'ทำรายการไม่สำเร็จ');
        else toast.success('ปฏิเสธแล้ว');
      } else if (action === 'mark-paid') {
        if (!payoutRef[id]?.trim()) {
          toast.error('กรุณาระบุ Payout reference ก่อนยืนยัน');
          setSubmitting(null);
          return;
        }
        const res = await api.adminMarkWithdrawalPaid(id, payoutRef[id]);
        if (!res.success) toast.error(res.error || 'ทำรายการไม่สำเร็จ');
        else toast.success('บันทึกการโอนเงินสำเร็จ');
      }
      await load();
    } finally {
      setSubmitting(null);
    }
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">สถานะ</label>
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              >
                <option value="all">ทั้งหมด</option>
                <option value="queued">รอรับเรื่อง</option>
                <option value="review">กำลังตรวจสอบ</option>
                <option value="approved">อนุมัติแล้ว</option>
                <option value="paid">จ่ายแล้ว</option>
                <option value="rejected">ปฏิเสธ</option>
                <option value="cancelled">ยกเลิก</option>
              </select>
            </div>
            <div className="flex items-end gap-1">
              <div className="min-w-[200px]">
                <Input
                  label="ค้นหา"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="email, เบอร์, ชื่อ"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button variant="outline" onClick={handleSearch}>ค้นหา</Button>
            </div>
            <div className="flex items-end gap-1">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ตั้งแต่</label>
                <input type="date" className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ถึง</label>
                <input type="date" className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={load}>รีเฟรช</Button>
        </div>
      </Card>

      {loading ? (
        <LoadingState message="กำลังโหลด..." />
      ) : (
        <Card className="p-4">
          {items.length === 0 ? (
            <div className="text-sm text-gray-600 py-8 text-center">ไม่พบคำขอถอนเงิน</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {items.map((w) => (
                <div key={w.id} className="py-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={w.status} />
                        <span className="text-base font-bold text-gray-900 tabular-nums">{formatMoney(w.amount)}</span>
                        {w.user_ban_withdraw && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">BAN</span>}
                      </div>
                      <div className="text-sm text-gray-800">
                        {w.user_full_name || w.user_display_name || '-'}
                        <span className="text-gray-500 text-xs ml-1">({w.user_role || '-'})</span>
                      </div>
                      <div className="text-xs text-gray-600 space-x-2">
                        <span>{w.user_email || '-'}</span>
                        {w.user_phone && <span>| {w.user_phone}</span>}
                      </div>
                      <div className="text-xs text-gray-600">
                        Trust: <span className="font-medium">{w.user_trust_level || '-'}</span>
                        {' | '}KYC: <span className="font-medium">{w.user_kyc_status || '-'}</span>
                      </div>
                      <div className="text-xs text-gray-600">
                        🏦 {w.bank_name || '-'} •••• {w.account_number_last4 || '-'} • {w.account_name || '-'}
                      </div>
                      <div className="text-xs text-gray-500">
                        Wallet: คงเหลือ {formatMoney(w.wallet_available_balance)} | Held {formatMoney(w.wallet_held_balance)}
                        {w.total_paid_count != null && ` | ถอนสำเร็จ ${w.total_paid_count} ครั้ง (${formatMoney(w.total_paid_amount)})`}
                      </div>
                      <div className="text-xs text-gray-500">สร้าง: {formatDate(w.created_at)}</div>
                      {w.reviewed_at && <div className="text-xs text-gray-500">รีวิว: {formatDate(w.reviewed_at)} | อนุมัติ: {formatDate(w.approved_at)} | จ่าย: {formatDate(w.paid_at)}</div>}
                      {w.rejection_reason && <div className="text-xs text-red-600">เหตุผลปฏิเสธ: {w.rejection_reason}</div>}
                      {w.payout_reference && <div className="text-xs text-gray-600">Ref: {w.payout_reference}</div>}
                    </div>
                  </div>

                  {!['paid', 'rejected', 'cancelled'].includes(w.status) && (
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-end sm:justify-between border-t border-gray-100 pt-3">
                      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                        {w.status === 'approved' && (
                          <div className="min-w-[260px]">
                            <Input
                              label="Payout reference *"
                              value={payoutRef[w.id] || ''}
                              onChange={(e) => setPayoutRef((prev) => ({ ...prev, [w.id]: e.target.value }))}
                              placeholder="เลขอ้างอิงจากธนาคาร"
                            />
                          </div>
                        )}
                        {['queued', 'review', 'approved'].includes(w.status) && (
                          <div className="min-w-[260px]">
                            <Input
                              label="เหตุผลปฏิเสธ"
                              value={rejectReason[w.id] || ''}
                              onChange={(e) => setRejectReason((prev) => ({ ...prev, [w.id]: e.target.value }))}
                              placeholder="ข้อมูลไม่ถูกต้อง / ไม่ผ่านเงื่อนไข"
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {w.status === 'queued' && (
                          <Button variant="outline" loading={submitting === w.id} onClick={() => setConfirmAction({ id: w.id, action: 'review', label: `รับเรื่องคำขอถอน ${formatMoney(w.amount)} ?` })}>
                            รับเรื่อง
                          </Button>
                        )}
                        {w.status === 'review' && (
                          <Button variant="primary" loading={submitting === w.id} onClick={() => setConfirmAction({ id: w.id, action: 'approve', label: `อนุมัติคำขอถอน ${formatMoney(w.amount)} ?` })}>
                            อนุมัติ
                          </Button>
                        )}
                        {['queued', 'review', 'approved'].includes(w.status) && (
                          <Button variant="outline" loading={submitting === w.id} onClick={() => setConfirmAction({ id: w.id, action: 'reject', label: `ปฏิเสธคำขอถอน ${formatMoney(w.amount)} ? เงินจะคืนเข้า wallet ผู้ใช้` })}>
                            ปฏิเสธ
                          </Button>
                        )}
                        {w.status === 'approved' && (
                          <Button variant="primary" loading={submitting === w.id} onClick={() => setConfirmAction({ id: w.id, action: 'mark-paid', label: `ยืนยันว่าโอนเงิน ${formatMoney(w.amount)} แล้ว? เงินจะถูกตัดออกจากระบบ` })}>
                            ยืนยันโอนแล้ว
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </Card>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmAction(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-2">ยืนยันการดำเนินการ</h3>
            <p className="text-sm text-gray-700 mb-4">{confirmAction.label}</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setConfirmAction(null)}>ยกเลิก</Button>
              <Button
                variant="primary"
                loading={submitting === confirmAction.id}
                onClick={() => doAction(confirmAction.id, confirmAction.action)}
              >
                ยืนยัน
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatWalletLabel(walletType?: string | null, userName?: string | null, userEmail?: string | null) {
  if (!walletType) return '-';
  const name = userName || userEmail || '';
  const typeLabel = walletType === 'platform' ? 'แพลตฟอร์ม' : walletType === 'escrow' ? 'escrow' : walletType;
  return name ? `${typeLabel} (${name})` : typeLabel;
}

const REF_TYPE_LABELS: Record<string, string> = {
  topup: 'เติมเงิน',
  job: 'งาน',
  withdrawal: 'ถอนเงิน',
  fee: 'ค่าธรรมเนียม',
  refund: 'คืนเงิน',
  dispute: 'ข้อพิพาท',
  penalty: 'ค่าปรับ',
};

function exportCSV(items: LedgerTransaction[]) {
  const headers = ['วันที่', 'ประเภท', 'จำนวน', 'จาก', 'ไป', 'อ้างอิง', 'รายละเอียด'];
  const rows = items.map(t => [
    t.created_at ? new Date(t.created_at).toISOString() : '',
    t.type,
    t.amount,
    formatWalletLabel(t.from_wallet_type, t.from_user_name, t.from_user_email),
    formatWalletLabel(t.to_wallet_type, t.to_user_name, t.to_user_email),
    t.reference_type || '',
    (t.description || '').replace(/,/g, ' '),
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function TransactionsTab() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<LedgerTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [refFilter, setRefFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.adminGetTransactions({
        page,
        limit: 30,
        type: typeFilter === 'all' ? undefined : typeFilter,
        reference_type: refFilter === 'all' ? undefined : refFilter,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      if (!res.success) {
        toast.error(res.error || 'โหลดข้อมูลไม่สำเร็จ');
        setItems([]);
        return;
      }
      setItems(res.data?.data || []);
      setTotalPages(res.data?.totalPages || 1);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, refFilter, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">ประเภท</label>
            <select className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
              <option value="all">ทั้งหมด</option>
              <option value="credit">เงินเข้า</option>
              <option value="debit">เงินออก</option>
              <option value="hold">กันเงิน</option>
              <option value="release">ปลดล็อค</option>
              <option value="reversal">กลับรายการ</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">อ้างอิง</label>
            <select className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm" value={refFilter} onChange={(e) => { setRefFilter(e.target.value); setPage(1); }}>
              <option value="all">ทั้งหมด</option>
              <option value="topup">เติมเงิน</option>
              <option value="job">งาน</option>
              <option value="withdrawal">ถอนเงิน</option>
              <option value="fee">ค่าธรรมเนียม</option>
              <option value="refund">คืนเงิน</option>
              <option value="dispute">ข้อพิพาท</option>
              <option value="penalty">ค่าปรับ</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">ตั้งแต่</label>
            <input type="date" className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">ถึง</label>
            <input type="date" className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
          </div>
          <Button variant="outline" onClick={load}>รีเฟรช</Button>
          {items.length > 0 && <Button variant="outline" onClick={() => exportCSV(items)}>ส่งออก CSV</Button>}
        </div>
      </Card>

      {loading ? (
        <LoadingState message="กำลังโหลด..." />
      ) : (
        <Card className="p-4">
          {items.length === 0 ? (
            <div className="text-sm text-gray-600 py-8 text-center">ไม่พบรายการธุรกรรม</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-2 font-medium text-gray-600">วันที่</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">ประเภท</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-600">จำนวน</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">จาก → ไป</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">อ้างอิง</th>
                    <th className="text-left py-2 pl-2 font-medium text-gray-600">รายละเอียด</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => (
                    <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 pr-2 text-gray-700 whitespace-nowrap">{formatDate(t.created_at)}</td>
                      <td className="py-2 px-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          t.type === 'credit' ? 'bg-green-100 text-green-800' :
                          t.type === 'debit' ? 'bg-red-100 text-red-800' :
                          t.type === 'hold' ? 'bg-yellow-100 text-yellow-800' :
                          t.type === 'reversal' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {TXN_TYPE_LABELS[t.type] || t.type}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums font-medium text-gray-900">{formatMoney(t.amount)}</td>
                      <td className="py-2 px-2 text-gray-600 whitespace-nowrap text-xs">
                        {formatWalletLabel(t.from_wallet_type, t.from_user_name, t.from_user_email)} → {formatWalletLabel(t.to_wallet_type, t.to_user_name, t.to_user_email)}
                      </td>
                      <td className="py-2 px-2 text-gray-600">{REF_TYPE_LABELS[t.reference_type] || t.reference_type || '-'}</td>
                      <td className="py-2 pl-2 text-gray-500 truncate max-w-[200px]">{t.description || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </Card>
      )}
    </div>
  );
}

export default function AdminFinancialPage() {
  const [tab, setTab] = useState<TabKey>('dashboard');

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'dashboard', label: 'ภาพรวม' },
    { key: 'withdrawals', label: 'คำขอถอนเงิน' },
    { key: 'transactions', label: 'รายการธุรกรรม' },
  ];

  return (
    <AdminLayout>
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900">การเงิน</h1>
        <p className="text-xs text-gray-500 mt-0.5">จัดการคำขอถอนเงิน ดูรายการธุรกรรม และภาพรวมการเงินของระบบ</p>
      </div>
      <div className="flex items-center gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'withdrawals' && <WithdrawalsTab />}
      {tab === 'transactions' && <TransactionsTab />}
    </div>
    </AdminLayout>
  );
}
