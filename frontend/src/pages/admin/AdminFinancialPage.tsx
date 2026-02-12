import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api, { WithdrawalRequest } from '../../services/api';
import { Button, Card, Input, LoadingState } from '../../components/ui';

export default function AdminFinancialPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [items, setItems] = useState<WithdrawalRequest[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState<'all' | string>('all');
  const [payoutRef, setPayoutRef] = useState<Record<string, string>>({});
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.adminGetWithdrawals({ page, limit: 20, status: status === 'all' ? undefined : status });
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
  }, [page, status]);

  useEffect(() => {
    load();
  }, [load]);

  const formatDate = (iso?: string | null) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('th-TH');
  };

  const groupedCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const it of items) {
      map[it.status] = (map[it.status] || 0) + 1;
    }
    return map;
  }, [items]);

  const doAction = async (id: string, action: 'review' | 'approve' | 'reject' | 'mark-paid') => {
    setSubmitting(id);
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
        const res = await api.adminRejectWithdrawal(id, rejectReason[id] || undefined);
        if (!res.success) toast.error(res.error || 'ทำรายการไม่สำเร็จ');
        else toast.success('ปฏิเสธแล้ว');
      } else {
        const res = await api.adminMarkWithdrawalPaid(id, payoutRef[id] || undefined);
        if (!res.success) toast.error(res.error || 'ทำรายการไม่สำเร็จ');
        else toast.success('ทำเครื่องหมายจ่ายแล้ว');
      }
      await load();
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">คำขอถอนเงิน</h2>
            <div className="text-xs text-gray-500 mt-1">
              {Object.keys(groupedCounts).length === 0 ? 'ไม่มีข้อมูล' : Object.entries(groupedCounts).map(([k, v]) => `${k}:${v}`).join(' • ')}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
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
            <Button variant="outline" onClick={load}>
              รีเฟรช
            </Button>
          </div>
        </div>
      </Card>

      {loading ? (
        <LoadingState message="กำลังโหลด..." />
      ) : (
        <Card className="p-6">
          {items.length === 0 ? (
            <div className="text-sm text-gray-600">ยังไม่มีคำขอถอนเงิน</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {items.map((w) => (
                <div key={w.id} className="py-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900">
                        {w.status} • {Number(w.amount).toLocaleString()} บาท
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {w.user_email ? `${w.user_email} (${w.user_role || '-'})` : w.user_id}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {w.bank_name ? `${w.bank_name} •••• ${w.account_number_last4 || '-'}` : `bank_account_id: ${w.bank_account_id}`}
                        {w.account_name ? ` • ${w.account_name}` : ''}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">สร้าง: {formatDate(w.created_at)}</div>
                      <div className="text-xs text-gray-500 mt-1">รีวิว: {formatDate(w.reviewed_at)} • อนุมัติ: {formatDate(w.approved_at)} • จ่าย: {formatDate(w.paid_at)}</div>
                      {w.rejection_reason && <div className="text-xs text-red-600 mt-1">เหตุผล: {w.rejection_reason}</div>}
                      {w.payout_reference && <div className="text-xs text-gray-600 mt-1">payout_ref: {w.payout_reference}</div>}
                      <div className="text-[11px] text-gray-500 mt-1 font-mono break-all">{w.id}</div>
                    </div>
                    <div className="text-xs text-gray-500 whitespace-nowrap">{formatDate(w.updated_at)}</div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 sm:items-end sm:justify-between">
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                      {w.status === 'approved' && (
                        <div className="min-w-[260px]">
                          <Input
                            label="Payout reference"
                            value={payoutRef[w.id] || ''}
                            onChange={(e) => setPayoutRef((prev) => ({ ...prev, [w.id]: e.target.value }))}
                            placeholder="เช่น bank_txn_123"
                          />
                        </div>
                      )}
                      {['queued', 'review', 'approved'].includes(w.status) && (
                        <div className="min-w-[260px]">
                          <Input
                            label="เหตุผลปฏิเสธ"
                            value={rejectReason[w.id] || ''}
                            onChange={(e) => setRejectReason((prev) => ({ ...prev, [w.id]: e.target.value }))}
                            placeholder="ไม่ผ่านเงื่อนไข"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {w.status === 'queued' && (
                        <Button variant="outline" loading={submitting === w.id} onClick={() => doAction(w.id, 'review')}>
                          รับเรื่อง
                        </Button>
                      )}
                      {w.status === 'review' && (
                        <Button variant="primary" loading={submitting === w.id} onClick={() => doAction(w.id, 'approve')}>
                          อนุมัติ
                        </Button>
                      )}
                      {['queued', 'review', 'approved'].includes(w.status) && (
                        <Button variant="outline" loading={submitting === w.id} onClick={() => doAction(w.id, 'reject')}>
                          ปฏิเสธ
                        </Button>
                      )}
                      {w.status === 'approved' && (
                        <Button variant="primary" loading={submitting === w.id} onClick={() => doAction(w.id, 'mark-paid')}>
                          ทำเครื่องหมายจ่ายแล้ว
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 mt-4">
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
  );
}

