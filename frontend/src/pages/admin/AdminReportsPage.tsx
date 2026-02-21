import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useLocation } from 'react-router-dom';
import { AdminLayout } from '../../layouts';
import { Button, Card, Input, LoadingState } from '../../components/ui';
import api, { AdminLedgerTransaction } from '../../services/api';

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color || 'text-gray-900'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function formatDateTime(iso?: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('th-TH');
}

export default function AdminReportsPage() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'summary' | 'ledger'>('summary');

  // Summary state
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<any>(null);

  // Ledger state
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AdminLedgerTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [referenceType, setReferenceType] = useState<string>('');
  const [referenceId, setReferenceId] = useState<string>('');
  const [walletId, setWalletId] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await api.adminGetReportsSummary();
      if (res.success && res.data) setSummaryData(res.data);
    } finally { setSummaryLoading(false); }
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const rt = params.get('reference_type') || '';
    const ri = params.get('reference_id') || '';
    const wi = params.get('wallet_id') || '';
    const ty = params.get('type') || '';
    const fr = params.get('from') || '';
    const t2 = params.get('to') || '';
    if (rt || ri || wi || ty || fr || t2) {
      setReferenceType(rt); setReferenceId(ri); setWalletId(wi);
      setType(ty); setFrom(fr); setTo(t2); setPage(1);
      setActiveTab('ledger');
    }
  }, [location.search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.adminGetLedgerTransactions({
        reference_type: referenceType.trim() || undefined,
        reference_id: referenceId.trim() || undefined,
        wallet_id: walletId.trim() || undefined,
        type: type.trim() || undefined,
        from: from.trim() || undefined,
        to: to.trim() || undefined,
        page, limit: 50,
      });
      if (!res.success || !res.data) { toast.error(res.error || 'โหลดข้อมูลไม่สำเร็จ'); setItems([]); setTotalPages(1); return; }
      setItems(res.data.data || []);
      setTotalPages(res.data.totalPages || 1);
    } finally { setLoading(false); }
  }, [from, page, referenceId, referenceType, to, type, walletId]);

  useEffect(() => { if (activeTab === 'ledger') load(); }, [load, activeTab]);

  const ledgerSummary = useMemo(() => {
    const total = items.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const byType: Record<string, number> = {};
    for (const t of items) byType[t.type] = (byType[t.type] || 0) + 1;
    return { total, byType };
  }, [items]);

  const totalUsers = summaryData ? (summaryData.users as any[]).reduce((s: number, r: any) => s + Number(r.count), 0) : 0;
  const totalJobs = summaryData ? (summaryData.jobs as any[]).reduce((s: number, r: any) => s + Number(r.count), 0) : 0;
  const completedJobs = summaryData ? Number((summaryData.jobs as any[]).find((j: any) => j.status === 'completed')?.count || 0) : 0;
  const openDisputes = summaryData ? Number((summaryData.disputes as any[]).find((d: any) => d.status === 'open')?.count || 0) : 0;

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 bg-white px-2 rounded-t-xl">
          {(['summary', 'ledger'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-blue-500 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab === 'summary' ? 'ภาพรวมระบบ' : 'Ledger Transactions'}
            </button>
          ))}
        </div>

        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <>
            {summaryLoading ? <LoadingState message="กำลังโหลดข้อมูล..." /> : !summaryData ? (
              <Card className="p-6 text-sm text-gray-600">ไม่พบข้อมูล</Card>
            ) : (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatCard label="ผู้ใช้ทั้งหมด" value={totalUsers.toLocaleString()} color="text-blue-700" />
                  <StatCard label="งานทั้งหมด" value={totalJobs.toLocaleString()} color="text-indigo-700" />
                  <StatCard label="งานสำเร็จ" value={completedJobs.toLocaleString()} color="text-green-700" />
                  <StatCard label="ข้อพิพาทเปิดอยู่" value={openDisputes.toLocaleString()} color={openDisputes > 0 ? 'text-red-600' : 'text-gray-700'} />
                </div>

                {/* Revenue */}
                {summaryData.revenue && (
                  <Card className="p-4">
                    <div className="text-sm font-semibold text-gray-800 mb-3">รายได้ระบบ</div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div><div className="text-xs text-gray-500">รายได้จากงาน</div><div className="text-lg font-bold text-green-700">{Number(summaryData.revenue.total_job_revenue || 0).toLocaleString()} ฿</div></div>
                      <div><div className="text-xs text-gray-500">ค่าธรรมเนียมแพลตฟอร์ม</div><div className="text-lg font-bold text-blue-700">{Number(summaryData.revenue.total_platform_fee || 0).toLocaleString()} ฿</div></div>
                      <div><div className="text-xs text-gray-500">ยอดเติมเงินรวม</div><div className="text-lg font-bold text-purple-700">{Number(summaryData.revenue.total_topup || 0).toLocaleString()} ฿</div></div>
                      <div><div className="text-xs text-gray-500">จำนวนการชำระงาน</div><div className="text-lg font-bold text-gray-800">{Number(summaryData.revenue.job_payment_count || 0).toLocaleString()} ครั้ง</div></div>
                    </div>
                  </Card>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Users by role/status */}
                  <Card className="p-4">
                    <div className="text-sm font-semibold text-gray-800 mb-3">ผู้ใช้ตาม Role / Status</div>
                    <div className="space-y-1">
                      {(summaryData.users as any[]).map((r: any) => (
                        <div key={`${r.role}-${r.status}`} className="flex justify-between text-sm">
                          <span className="text-gray-600">{r.role} / {r.status}</span>
                          <span className="font-semibold">{Number(r.count).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Trust distribution */}
                  <Card className="p-4">
                    <div className="text-sm font-semibold text-gray-800 mb-3">Trust Level</div>
                    <div className="space-y-2">
                      {(summaryData.trust_distribution as any[]).map((r: any) => {
                        const pct = totalUsers > 0 ? Math.round(Number(r.count) / totalUsers * 100) : 0;
                        const colors: Record<string, string> = { L0: 'bg-gray-300', L1: 'bg-yellow-400', L2: 'bg-blue-400', L3: 'bg-purple-500' };
                        return (
                          <div key={r.trust_level}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-medium">{r.trust_level}</span>
                              <span className="text-gray-500">{Number(r.count).toLocaleString()} ({pct}%)</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${colors[r.trust_level] || 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>

                  {/* Jobs by status */}
                  <Card className="p-4">
                    <div className="text-sm font-semibold text-gray-800 mb-3">งานตามสถานะ</div>
                    <div className="space-y-1">
                      {(summaryData.jobs as any[]).map((r: any) => (
                        <div key={r.status} className="flex justify-between text-sm">
                          <span className="text-gray-600">{r.status}</span>
                          <span className="font-semibold">{Number(r.count).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>

                {/* 7-day activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-semibold text-gray-800">ผู้ใช้ใหม่ 7 วัน</div>
                      <Button variant="outline" size="sm" onClick={loadSummary}>รีเฟรช</Button>
                    </div>
                    {summaryData.new_users_7d.length === 0 ? (
                      <div className="text-xs text-gray-500">ไม่มีข้อมูล</div>
                    ) : (
                      <div className="space-y-1">
                        {(summaryData.new_users_7d as any[]).map((r: any) => (
                          <div key={r.day} className="flex justify-between text-sm">
                            <span className="text-gray-600">{new Date(r.day).toLocaleDateString('th-TH')}</span>
                            <span className="font-semibold text-blue-700">+{Number(r.count)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                  <Card className="p-4">
                    <div className="text-sm font-semibold text-gray-800 mb-3">งานใหม่ 7 วัน</div>
                    {summaryData.new_jobs_7d.length === 0 ? (
                      <div className="text-xs text-gray-500">ไม่มีข้อมูล</div>
                    ) : (
                      <div className="space-y-1">
                        {(summaryData.new_jobs_7d as any[]).map((r: any) => (
                          <div key={r.day} className="flex justify-between text-sm">
                            <span className="text-gray-600">{new Date(r.day).toLocaleDateString('th-TH')}</span>
                            <span className="font-semibold text-indigo-700">+{Number(r.count)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>

                {/* Disputes */}
                {summaryData.disputes.length > 0 && (
                  <Card className="p-4">
                    <div className="text-sm font-semibold text-gray-800 mb-3">ข้อพิพาทตามสถานะ</div>
                    <div className="flex flex-wrap gap-4">
                      {(summaryData.disputes as any[]).map((r: any) => (
                        <div key={r.status} className="text-center">
                          <div className="text-2xl font-bold text-gray-800">{Number(r.count)}</div>
                          <div className="text-xs text-gray-500">{r.status}</div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            )}
          </>
        )}

        {/* Ledger Tab */}
        {activeTab === 'ledger' && (
          <>
            <Card className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Input label="reference_type" value={referenceType} onChange={(e) => setReferenceType(e.target.value)} placeholder="job/fee/topup/withdrawal/refund" />
                <Input label="reference_id" value={referenceId} onChange={(e) => setReferenceId(e.target.value)} placeholder="เช่น job_id หรือ withdrawal_id" />
                <Input label="wallet_id" value={walletId} onChange={(e) => setWalletId(e.target.value)} placeholder="from/to wallet id" />
                <Input label="type" value={type} onChange={(e) => setType(e.target.value)} placeholder="credit/debit/hold/release/reversal" />
                <Input label="from (ISO)" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="2026-01-01T00:00:00Z" />
                <Input label="to (ISO)" value={to} onChange={(e) => setTo(e.target.value)} placeholder="2026-01-31T23:59:59Z" />
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button variant="primary" onClick={() => { setPage(1); load(); }}>ค้นหา</Button>
                <Button variant="outline" onClick={() => { setReferenceType(''); setReferenceId(''); setWalletId(''); setType(''); setFrom(''); setTo(''); setPage(1); }}>ล้าง</Button>
                <Button variant="outline" onClick={load}>รีเฟรช</Button>
                <div className="text-xs text-gray-500 self-center">
                  {Object.keys(ledgerSummary.byType).length === 0 ? 'ไม่มีข้อมูล' : Object.entries(ledgerSummary.byType).map(([k, v]) => `${k}:${v}`).join(' • ')}
                  {items.length > 0 ? ` • sum:${ledgerSummary.total.toLocaleString()}` : ''}
                </div>
              </div>
            </Card>

            {loading ? (
              <LoadingState message="กำลังโหลด ledger..." />
            ) : (
              <Card className="p-0 overflow-hidden">
                {items.length === 0 ? (
                  <div className="p-6 text-sm text-gray-600">ไม่พบรายการ</div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {items.map((t) => (
                      <div key={t.id} className="p-4 flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900">{t.type} • {t.reference_type || '-'}</div>
                            <div className="text-xs text-gray-600 mt-1">{t.description || '-'}</div>
                            <div className="text-xs text-gray-500 mt-1">{formatDateTime(t.created_at)}</div>
                            {t.reference_type === 'dispute' && t.reference_id && (
                              <div className="mt-2">
                                <Link to={`/admin/disputes?q=${encodeURIComponent(String(t.reference_id))}`} target="_blank">
                                  <Button variant="outline" size="sm">เปิด Dispute</Button>
                                </Link>
                              </div>
                            )}
                          </div>
                          <div className="text-sm font-bold text-gray-900 whitespace-nowrap">{Number(t.amount || 0).toLocaleString()} บาท</div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                          <div className="text-[11px] text-gray-600 font-mono break-all">from: {t.from_wallet_id || '-'} ({t.from_wallet_type || '-'}) {t.from_user_email ? `• ${t.from_user_email}` : ''}</div>
                          <div className="text-[11px] text-gray-600 font-mono break-all">to: {t.to_wallet_id || '-'} ({t.to_wallet_type || '-'}) {t.to_user_email ? `• ${t.to_user_email}` : ''}</div>
                          <div className="text-[11px] text-gray-500 font-mono break-all">ref_id: {t.reference_id || '-'}</div>
                          <div className="text-[11px] text-gray-500 font-mono break-all">id: {t.id}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="p-4 border-t border-gray-200 flex items-center justify-between gap-3">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>ก่อนหน้า</Button>
                  <div className="text-xs text-gray-600">หน้า {page} / {totalPages}</div>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>ถัดไป</Button>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}

