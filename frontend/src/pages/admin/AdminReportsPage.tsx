import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useLocation } from 'react-router-dom';
import { AdminLayout } from '../../layouts';
import { Button, Card, Input, LoadingState } from '../../components/ui';
import api, { AdminLedgerTransaction } from '../../services/api';

function formatDateTime(iso?: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('th-TH');
}

export default function AdminReportsPage() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AdminLedgerTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [referenceType, setReferenceType] = useState<string>('');
  const [referenceId, setReferenceId] = useState<string>('');
  const [walletId, setWalletId] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const nextReferenceType = params.get('reference_type') || '';
    const nextReferenceId = params.get('reference_id') || '';
    const nextWalletId = params.get('wallet_id') || '';
    const nextType = params.get('type') || '';
    const nextFrom = params.get('from') || '';
    const nextTo = params.get('to') || '';
    if (
      nextReferenceType !== referenceType ||
      nextReferenceId !== referenceId ||
      nextWalletId !== walletId ||
      nextType !== type ||
      nextFrom !== from ||
      nextTo !== to
    ) {
      setReferenceType(nextReferenceType);
      setReferenceId(nextReferenceId);
      setWalletId(nextWalletId);
      setType(nextType);
      setFrom(nextFrom);
      setTo(nextTo);
      setPage(1);
    }
  }, [from, location.search, referenceId, referenceType, to, type, walletId]);

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
        page,
        limit: 50,
      });
      if (!res.success || !res.data) {
        toast.error(res.error || 'โหลดข้อมูลไม่สำเร็จ');
        setItems([]);
        setTotalPages(1);
        return;
      }
      setItems(res.data.data || []);
      setTotalPages(res.data.totalPages || 1);
    } finally {
      setLoading(false);
    }
  }, [from, page, referenceId, referenceType, to, type, walletId]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => {
    const total = items.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const byType: Record<string, number> = {};
    for (const t of items) byType[t.type] = (byType[t.type] || 0) + 1;
    return { total, byType };
  }, [items]);

  return (
    <AdminLayout>
      <div className="space-y-4">
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
            <Button
              variant="primary"
              onClick={() => {
                setPage(1);
                load();
              }}
            >
              ค้นหา
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setReferenceType('');
                setReferenceId('');
                setWalletId('');
                setType('');
                setFrom('');
                setTo('');
                setPage(1);
              }}
            >
              ล้าง
            </Button>
            <Button variant="outline" onClick={load}>
              รีเฟรช
            </Button>
            <div className="text-xs text-gray-500 self-center">
              {Object.keys(summary.byType).length === 0 ? 'ไม่มีข้อมูล' : Object.entries(summary.byType).map(([k, v]) => `${k}:${v}`).join(' • ')}
              {items.length > 0 ? ` • sum:${summary.total.toLocaleString()}` : ''}
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
                        <div className="text-sm font-semibold text-gray-900">
                          {t.type} • {t.reference_type || '-'}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">{t.description || '-'}</div>
                        <div className="text-xs text-gray-500 mt-1">{formatDateTime(t.created_at)}</div>
                        {t.reference_type === 'dispute' && t.reference_id && (
                          <div className="mt-2">
                            <Link to={`/admin/disputes?q=${encodeURIComponent(String(t.reference_id))}`} target="_blank">
                              <Button variant="outline" size="sm">
                                เปิด Dispute
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>
                      <div className="text-sm font-bold text-gray-900 whitespace-nowrap">{Number(t.amount || 0).toLocaleString()} บาท</div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                      <div className="text-[11px] text-gray-600 font-mono break-all">
                        from: {t.from_wallet_id || '-'} ({t.from_wallet_type || '-'}) {t.from_user_email ? `• ${t.from_user_email}` : ''}
                      </div>
                      <div className="text-[11px] text-gray-600 font-mono break-all">
                        to: {t.to_wallet_id || '-'} ({t.to_wallet_type || '-'}) {t.to_user_email ? `• ${t.to_user_email}` : ''}
                      </div>
                      <div className="text-[11px] text-gray-500 font-mono break-all">ref_id: {t.reference_id || '-'}</div>
                      <div className="text-[11px] text-gray-500 font-mono break-all">id: {t.id}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 border-t border-gray-200 flex items-center justify-between gap-3">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                ก่อนหน้า
              </Button>
              <div className="text-xs text-gray-600">
                หน้า {page} / {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                ถัดไป
              </Button>
            </div>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}

