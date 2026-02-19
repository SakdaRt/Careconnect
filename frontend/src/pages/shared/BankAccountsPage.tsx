import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MainLayout } from '../../layouts';
import { Button, Card, Input, LoadingState } from '../../components/ui';
import { BankAccount } from '../../services/api';
import { appApi } from '../../services/appApi';
import { useAuth } from '../../contexts';

export default function BankAccountsPage() {
  const { user, activeRole } = useAuth();
  const navigate = useNavigate();

  const resolvedRole = user?.role === 'admin' ? 'admin' : (activeRole || user?.role || 'hirer');
  const isCaregiver = resolvedRole === 'caregiver';
  const walletPath = isCaregiver ? '/caregiver/wallet' : '/hirer/wallet';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);

  const [bankCode, setBankCode] = useState('SCB');
  const [bankName, setBankName] = useState('Siam Commercial Bank');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [setPrimary, setSetPrimary] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await appApi.getBankAccounts();
      if (!res.success) {
        toast.error(res.error || 'โหลดบัญชีธนาคารไม่สำเร็จ');
        setAccounts([]);
        return;
      }

      const list = res.data || [];
      setAccounts(list);
      if (list.length > 0) {
        setSetPrimary(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddBankAccount = async () => {
    const normalizedCode = bankCode.trim().toUpperCase();
    const normalizedName = accountName.trim();
    const normalizedNumber = accountNumber.replace(/\s+/g, '');

    if (!normalizedCode || !normalizedName || !normalizedNumber) {
      toast.error('กรอกข้อมูลให้ครบ');
      return;
    }

    setSubmitting(true);
    try {
      const res = await appApi.addBankAccount({
        bank_code: normalizedCode,
        bank_name: bankName.trim() || undefined,
        account_number: normalizedNumber,
        account_name: normalizedName,
        set_primary: accounts.length === 0 ? true : setPrimary,
      });

      if (!res.success) {
        toast.error(res.error || 'เพิ่มบัญชีธนาคารไม่สำเร็จ');
        return;
      }

      toast.success(res.data?.message || 'เพิ่มบัญชีธนาคารสำเร็จ');
      setAccountNumber('');
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">บัญชีธนาคาร</h1>
            <p className="text-sm text-gray-600">
              {isCaregiver
                ? 'จัดการบัญชีสำหรับถอนเงิน และเตรียมยอดประกันงาน'
                : 'จัดการบัญชีสำหรับธุรกรรมและการเงินในระบบ'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(walletPath)}>
              กลับหน้ากระเป๋าเงิน
            </Button>
            <Button variant="outline" onClick={load}>
              รีเฟรช
            </Button>
          </div>
        </div>

        {loading ? (
          <LoadingState message="กำลังโหลดบัญชีธนาคาร..." />
        ) : (
          <>
            <Card className="p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">บัญชีที่บันทึกไว้</h2>
              {accounts.length === 0 ? (
                <div className="text-sm text-gray-600">ยังไม่มีบัญชีธนาคาร</div>
              ) : (
                <div className="space-y-2">
                  {accounts.map((account) => (
                    <div key={account.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {account.bank_name || account.bank_code} • •••• {account.account_number_last4}
                        </span>
                        {account.is_primary && (
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">บัญชีหลัก</span>
                        )}
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            account.is_verified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {account.is_verified ? 'ยืนยันแล้ว' : 'รอยืนยัน'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">{account.account_name}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">เพิ่มบัญชีธนาคาร</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Bank Code"
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                  placeholder="เช่น SCB"
                />
                <Input
                  label="Bank Name"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="ชื่อธนาคาร"
                />
                <Input
                  label="Account Number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="เช่น 1234567890"
                />
                <Input
                  label="Account Name"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="ชื่อบัญชี"
                />
              </div>

              <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={setPrimary}
                  onChange={(e) => setSetPrimary(e.target.checked)}
                />
                ตั้งเป็นบัญชีหลัก
              </label>

              <div className="mt-4">
                <Button variant="primary" loading={submitting} onClick={handleAddBankAccount}>
                  เพิ่มบัญชี
                </Button>
              </div>
              <div className="text-xs text-gray-500 mt-2">โหมด dev จะ mark verified อัตโนมัติ</div>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}
