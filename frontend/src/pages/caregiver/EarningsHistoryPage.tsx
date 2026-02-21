import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layouts';
import { Button, Card, LoadingState, Select } from '../../components/ui';
import { Transaction } from '../../services/api';
import { appApi } from '../../services/appApi';
import { useAuth } from '../../contexts';

export default function EarningsHistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id || 'demo-caregiver';

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [typeFilter, setTypeFilter] = useState<'all' | Transaction['type']>('all');
  const [refFilter, setRefFilter] = useState<'all' | Transaction['reference_type']>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tRes = await appApi.listWalletTransactions(userId, 'caregiver', page, 20);
      setTransactions(tRes.success && tRes.data ? tRes.data.data : []);
      setTotalPages(tRes.success && tRes.data ? tRes.data.totalPages : 1);
    } finally {
      setLoading(false);
    }
  }, [page, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (refFilter !== 'all' && t.reference_type !== refFilter) return false;
      return true;
    });
  }, [refFilter, transactions, typeFilter]);

  return (
    <MainLayout showBottomBar={false}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3 mb-6">
          <Button variant="outline" onClick={() => navigate('/caregiver/wallet')}>
            ย้อนกลับ
          </Button>
          <Button variant="outline" onClick={load}>
            รีเฟรช
          </Button>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">ประวัติรายได้</h1>
        <p className="text-sm text-gray-600 mb-6">ดูรายการรายรับ/รายจ่ายในกระเป๋าเงินผู้ดูแล</p>

        {loading ? (
          <LoadingState message="กำลังโหลด..." />
        ) : (
          <Card className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div>
                <Select label="ประเภท" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
                  <option value="all">ทั้งหมด</option>
                  <option value="credit">credit</option>
                  <option value="debit">debit</option>
                  <option value="hold">hold</option>
                  <option value="release">release</option>
                  <option value="reversal">reversal</option>
                </Select>
              </div>
              <div>
                <Select label="อ้างอิง" value={refFilter} onChange={(e) => setRefFilter(e.target.value as any)}>
                  <option value="all">ทั้งหมด</option>
                  <option value="job">job</option>
                  <option value="withdrawal">withdrawal</option>
                  <option value="fee">fee</option>
                  <option value="refund">refund</option>
                </Select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="text-sm text-gray-600">ยังไม่มีรายการ</div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filtered.map((t) => (
                  <div key={t.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {t.type.toUpperCase()} • {t.reference_type}
                      </div>
                      <div className="text-xs text-gray-500">{new Date(t.created_at).toLocaleString('th-TH')}</div>
                      {t.description && <div className="text-xs text-gray-600 mt-1">{t.description}</div>}
                      <div className="text-[11px] text-gray-500 mt-1 font-mono break-all">ref:{t.reference_id}</div>
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
    </MainLayout>
  );
}

