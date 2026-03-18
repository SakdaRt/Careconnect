import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronDown, Search, X } from 'lucide-react';
import { MainLayout } from '../../layouts';
import { Button, Card, Input, LoadingState } from '../../components/ui';
import { BankAccount } from '../../services/api';
import { appApi } from '../../services/appApi';
import { useAuth } from '../../contexts';
import { THAI_BANK_OPTIONS, ThaiBankOption } from '../../utils/thaiBanks';

export default function BankAccountsPage() {
  const { user, activeRole } = useAuth();
  const navigate = useNavigate();

  const resolvedRole = user?.role === 'admin' ? 'admin' : (activeRole || user?.role || 'hirer');
  const isCaregiver = resolvedRole === 'caregiver';
  const walletPath = isCaregiver ? '/caregiver/wallet' : '/hirer/wallet';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);

  const [selectedBank, setSelectedBank] = useState<ThaiBankOption | null>(null);
  const [bankSearch, setBankSearch] = useState('');
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [setPrimary, setSetPrimary] = useState(true);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const bankDropdownRef = useRef<HTMLDivElement>(null);

  const filteredBanks = useMemo(() => {
    const q = bankSearch.trim().toLowerCase();
    if (!q) return THAI_BANK_OPTIONS;
    return THAI_BANK_OPTIONS.filter(
      (b) =>
        b.nameTh.toLowerCase().includes(q) ||
        b.nameEn.toLowerCase().includes(q) ||
        b.shortName.toLowerCase().includes(q) ||
        b.bankCode.includes(q)
    );
  }, [bankSearch]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(e.target as Node)) {
        setBankDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
    const errors: Record<string, string> = {};

    if (!selectedBank) {
      errors.bank = 'กรุณาเลือกธนาคาร';
    }

    const sanitizedNumber = accountNumber.replace(/[\s\-]/g, '').replace(/\D/g, '');
    if (!sanitizedNumber) {
      errors.accountNumber = 'กรุณากรอกเลขที่บัญชี';
    } else if (sanitizedNumber.length < 10) {
      errors.accountNumber = 'เลขที่บัญชีต้องมีอย่างน้อย 10 หลัก';
    }

    const trimmedName = accountName.trim();
    if (!trimmedName) {
      errors.accountName = 'กรุณากรอกชื่อบัญชี';
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error('กรุณากรอกข้อมูลให้ครบ');
      return;
    }

    setSubmitting(true);
    try {
      const res = await appApi.addBankAccount({
        bank_code: selectedBank!.shortName,
        bank_name: selectedBank!.nameTh,
        account_number: sanitizedNumber,
        account_name: trimmedName,
        set_primary: accounts.length === 0 ? true : setPrimary,
      });

      if (!res.success) {
        toast.error(res.error || 'เพิ่มบัญชีธนาคารไม่สำเร็จ');
        return;
      }

      toast.success(res.data?.message || 'เพิ่มบัญชีธนาคารสำเร็จ');
      setSelectedBank(null);
      setBankSearch('');
      setAccountNumber('');
      setAccountName('');
      setFormErrors({});
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
              <div className="space-y-3">
                {/* Bank Selector */}
                <div ref={bankDropdownRef} className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    ธนาคาร <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setBankDropdownOpen((v) => !v)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 border rounded-lg bg-white text-left transition-colors ${
                      formErrors.bank ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-300 hover:border-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500'
                    }`}
                  >
                    {selectedBank ? (
                      <span className="text-sm text-gray-900 truncate">
                        {selectedBank.nameTh} ({selectedBank.shortName})
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500">เลือกธนาคาร...</span>
                    )}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {selectedBank && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedBank(null); setBankSearch(''); setFormErrors((p) => ({ ...p, bank: '' })); }}
                          className="p-0.5 text-gray-400 hover:text-gray-600 rounded"
                          aria-label="ล้างการเลือกธนาคาร"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${bankDropdownOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {formErrors.bank && <div className="text-xs text-red-600 mt-1">{formErrors.bank}</div>}

                  {bankDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-hidden">
                      <div className="p-2 border-b border-gray-100">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={bankSearch}
                            onChange={(e) => setBankSearch(e.target.value)}
                            placeholder="ค้นหาธนาคาร..."
                            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="overflow-y-auto max-h-48">
                        {filteredBanks.length === 0 ? (
                          <div className="px-3 py-4 text-sm text-gray-500 text-center">ไม่พบธนาคารที่ค้นหา</div>
                        ) : (
                          filteredBanks.map((bank) => (
                            <button
                              key={bank.bankCode}
                              type="button"
                              onClick={() => {
                                setSelectedBank(bank);
                                setBankSearch('');
                                setBankDropdownOpen(false);
                                setFormErrors((p) => ({ ...p, bank: '' }));
                              }}
                              className={`w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 transition-colors flex items-center justify-between gap-2 ${
                                selectedBank?.bankCode === bank.bankCode ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="font-medium truncate">{bank.nameTh}</div>
                                <div className="text-xs text-gray-500">{bank.shortName} • {bank.nameEn}</div>
                              </div>
                              {selectedBank?.bankCode === bank.bankCode && (
                                <span className="text-blue-600 text-xs font-semibold flex-shrink-0">✓</span>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="เลขที่บัญชี"
                    value={accountNumber}
                    onChange={(e) => { setAccountNumber(e.target.value); setFormErrors((p) => ({ ...p, accountNumber: '' })); }}
                    placeholder="เช่น 1234567890"
                    error={formErrors.accountNumber}
                    required
                  />
                  <Input
                    label="ชื่อบัญชี"
                    value={accountName}
                    onChange={(e) => { setAccountName(e.target.value); setFormErrors((p) => ({ ...p, accountName: '' })); }}
                    placeholder="ชื่อ-นามสกุล ตามบัญชีธนาคาร"
                    error={formErrors.accountName}
                    required
                  />
                </div>
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
