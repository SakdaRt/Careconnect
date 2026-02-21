import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../../layouts';
import { Button, Card, Input, LoadingState, Select } from '../../components/ui';
import api, { AdminUserListItem } from '../../services/api';

type BanType = 'suspend' | 'delete' | 'ban_login' | 'ban_job_create' | 'ban_job_accept' | 'ban_withdraw';

const BAN_LABELS: Record<BanType, string> = {
  suspend: 'ระงับบัญชี',
  delete: 'ลบบัญชี (soft)',
  ban_login: 'แบนเข้าสู่ระบบ',
  ban_job_create: 'แบนสร้างงาน',
  ban_job_accept: 'แบนรับงาน',
  ban_withdraw: 'แบนถอนเงิน',
};

/* ─── Inline editable cell ─────────────────────────────────────────── */
function EditCell({
  value, onSave, type = 'text', options,
}: {
  value: string | number | boolean | null;
  onSave: (v: any) => Promise<void>;
  type?: 'text' | 'select' | 'boolean' | 'number';
  options?: { label: string; value: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ''));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  const startEdit = () => { setDraft(String(value ?? '')); setEditing(true); };
  useEffect(() => { if (editing) (inputRef.current as any)?.focus(); }, [editing]);

  const save = async () => {
    setSaving(true);
    try {
      let parsed: any = draft;
      if (type === 'number') parsed = Number(draft);
      if (type === 'boolean') parsed = draft === 'true';
      await onSave(parsed);
      setEditing(false);
    } finally { setSaving(false); }
  };

  const cancel = () => setEditing(false);

  if (!editing) {
    const display = type === 'boolean'
      ? (value ? <span className="text-green-600 font-semibold">✓</span> : <span className="text-gray-400">✗</span>)
      : (value === null || value === '' || value === undefined ? <span className="text-gray-300 italic">-</span> : String(value));
    return (
      <span
        className="group cursor-pointer hover:bg-blue-50 rounded px-1 py-0.5 transition-colors inline-flex items-center gap-1"
        onDoubleClick={startEdit}
        title="ดับเบิลคลิกเพื่อแก้ไข"
      >
        {display}
        <span className="opacity-0 group-hover:opacity-40 text-[10px] text-blue-400">✎</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      {type === 'select' && options ? (
        <select
          ref={inputRef as any}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
          className="text-xs border border-blue-400 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : type === 'boolean' ? (
        <select
          ref={inputRef as any}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
          className="text-xs border border-blue-400 rounded px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="true">✓ ใช่</option>
          <option value="false">✗ ไม่</option>
        </select>
      ) : (
        <input
          ref={inputRef as any}
          type={type === 'number' ? 'number' : 'text'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
          className="text-xs border border-blue-400 rounded px-1 py-0.5 w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      )}
      <button onClick={save} disabled={saving} className="text-green-600 hover:text-green-800 text-xs font-bold px-1" title="บันทึก (Enter)">
        {saving ? '…' : '✓'}
      </button>
      <button onClick={cancel} className="text-gray-400 hover:text-gray-600 text-xs px-1" title="ยกเลิก (Esc)">✕</button>
    </span>
  );
}

/* ─── Toggle switch ─────────────────────────────────────────────────── */
function Toggle({ checked, onChange, loading }: { checked: boolean; onChange: (v: boolean) => void; loading?: boolean }) {
  return (
    <button
      onClick={() => !loading && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${checked ? 'bg-red-500' : 'bg-gray-300'} ${loading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [regType, setRegType] = useState<'all' | 'email' | 'phone'>('all');
  const [status, setStatus] = useState<'all' | 'active' | 'suspended' | 'deleted'>('all');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [walletData, setWalletData] = useState<any>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const statusBadge = (s: string) => s === 'active' ? 'bg-green-100 text-green-800' : s === 'suspended' ? 'bg-yellow-100 text-yellow-800' : s === 'deleted' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800';
  const trustBadge = (t: string) => t === 'L3' ? 'bg-purple-100 text-purple-800' : t === 'L2' ? 'bg-blue-100 text-blue-800' : t === 'L1' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600';
  const displayPrimary = (u: any) => u.email || u.phone_number || '-';
  const fmt = (iso?: string | null) => iso ? new Date(iso).toLocaleString('th-TH') : '-';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.adminGetUsers({ q: q.trim() || undefined, reg_type: regType === 'all' ? undefined : regType, status: status === 'all' ? undefined : status, page, limit: 20 });
      if (!res.success || !res.data) { setUsers([]); setTotalPages(1); setTotal(0); return; }
      setUsers(res.data.data || []);
      setTotalPages(res.data.totalPages || 1);
      setTotal(res.data.total || 0);
    } finally { setLoading(false); }
  }, [page, q, regType, status]);

  useEffect(() => { load(); }, [load]);

  const openDetail = useCallback(async (userId: string) => {
    setSelectedUser(null); setWalletData(null); setBanReason('');
    setWalletLoading(true);
    const [userRes, walletRes] = await Promise.all([
      api.adminGetUser(userId),
      api.adminGetUserWallet(userId),
    ]);
    setWalletLoading(false);
    if (!userRes.success || !userRes.data?.user) { toast.error(userRes.error || 'โหลดข้อมูลไม่สำเร็จ'); return; }
    setSelectedUser(userRes.data.user);
    if (walletRes.success && walletRes.data) setWalletData(walletRes.data);
  }, []);

  const saveField = useCallback(async (field: string, value: any) => {
    if (!selectedUser) return;
    const res = await api.adminEditUser(selectedUser.id, { [field]: value });
    if (!res.success) { toast.error((res as any).error || 'บันทึกไม่สำเร็จ'); throw new Error('save failed'); }
    toast.success('บันทึกแล้ว');
    setSelectedUser((prev: any) => ({ ...prev, [field]: value }));
    setUsers((prev) => prev.map((u) => u.id === selectedUser.id ? { ...u, [field]: value } as any : u));
  }, [selectedUser]);

  const handleBan = async (banType: BanType, value: boolean) => {
    if (!selectedUser) return;
    if (banType === 'delete' && !window.confirm('ลบบัญชีแบบ soft delete ใช่หรือไม่?')) return;
    setActionLoading(`ban_${banType}`);
    try {
      const res = await api.adminSetBan(selectedUser.id, banType, value, banReason || undefined);
      if (!res.success) { toast.error((res as any).error || 'ทำรายการไม่สำเร็จ'); return; }
      toast.success((res as any).message || 'อัปเดตแล้ว');
      await openDetail(selectedUser.id);
      load();
    } finally { setActionLoading(null); }
  };

  return (
    <AdminLayout>
      <div className="space-y-3">
        {/* Search bar */}
        <Card className="p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[180px]">
              <Input label="ค้นหา" value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="id / email / phone / ชื่อ"
                onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); load(); } }} />
            </div>
            <div>
              <Select label="ลงทะเบียนด้วย" value={regType}
                onChange={(e) => { setRegType(e.target.value as any); setPage(1); }}>
                <option value="all">ทั้งหมด</option>
                <option value="email">อีเมล</option>
                <option value="phone">เบอร์โทร</option>
              </Select>
            </div>
            <div>
              <Select label="Status" value={status}
                onChange={(e) => { setStatus(e.target.value as any); setPage(1); }}>
                <option value="all">ทั้งหมด</option>
                <option value="active">active</option>
                <option value="suspended">suspended</option>
                <option value="deleted">deleted</option>
              </Select>
            </div>
            <div className="flex gap-2 items-end">
              <Button variant="primary" size="sm" onClick={() => { setPage(1); load(); }}>ค้นหา</Button>
              <Button variant="outline" size="sm" onClick={() => { setQ(''); setRegType('all'); setStatus('all'); setPage(1); }}>ล้าง</Button>
              <Button variant="outline" size="sm" onClick={load}>↺</Button>
              {total > 0 && <span className="text-xs text-gray-400 pb-0.5">พบ {total.toLocaleString()} คน</span>}
            </div>
          </div>
        </Card>

        <div className={`grid gap-3 ${selectedUser ? 'grid-cols-1 xl:grid-cols-[1fr_500px]' : 'grid-cols-1'}`}>
          {/* User Table */}
          <Card className="p-0 overflow-hidden">
            {loading ? (
              <div className="p-6"><LoadingState message="กำลังโหลด..." /></div>
            ) : users.length === 0 ? (
              <div className="p-6 text-sm text-gray-500">ไม่พบผู้ใช้</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">ผู้ใช้</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Trust</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Status</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">แบน</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500">งาน</th>
                      <th className="px-3 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {users.map((u) => (
                      <tr key={u.id}
                        className={`hover:bg-blue-50/50 cursor-pointer transition-colors ${selectedUser?.id === u.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}
                        onClick={() => openDetail(u.id)}>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-gray-900 truncate max-w-[150px]">{(u as any).display_name || displayPrimary(u)}</div>
                          <div className="text-[11px] text-gray-400 truncate max-w-[150px]">{u.email || u.phone_number || '-'}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[11px] px-1.5 py-0.5 rounded font-semibold ${trustBadge(u.trust_level)}`}>
                            {u.trust_level} · {(u as any).trust_score ?? 0}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(u.status)}`}>{u.status}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-0.5">
                            {(u as any).ban_login && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">login</span>}
                            {(u as any).ban_job_create && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">create</span>}
                            {(u as any).ban_job_accept && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">accept</span>}
                            {(u as any).ban_withdraw && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">withdraw</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center text-xs text-gray-500">{u.completed_jobs_count}</td>
                        <td className="px-3 py-2.5">
                          <button onClick={(e) => { e.stopPropagation(); openDetail(u.id); }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors">
                            เปิด →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between gap-3 bg-gray-50/50">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ ก่อนหน้า</Button>
              <span className="text-xs text-gray-500">หน้า {page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>ถัดไป ›</Button>
            </div>
          </Card>

          {/* ── Detail Panel (unified: profile + wallet + ban) ── */}
          {selectedUser && (
            <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-160px)]">

              {/* Header */}
              <Card className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold text-gray-900">{selectedUser.display_name || displayPrimary(selectedUser)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(selectedUser.status)}`}>{selectedUser.status}</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${trustBadge(selectedUser.trust_level)}`}>{selectedUser.trust_level} · {selectedUser.trust_score ?? 0}pt</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{selectedUser.role} · {selectedUser.account_type}</div>
                    <div className="text-[10px] text-gray-400 font-mono mt-0.5 break-all">{selectedUser.id}</div>
                  </div>
                  <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-gray-700 text-lg leading-none shrink-0 mt-0.5">✕</button>
                </div>
                <div className="mt-2 text-[11px] text-blue-500 italic">💡 ดับเบิลคลิกที่ค่าเพื่อแก้ไข</div>
              </Card>

              {/* ── Section: ข้อมูลพื้นฐาน (Editable) ── */}
              <Card className="p-4">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">ข้อมูลพื้นฐาน</div>
                <div className="space-y-0 divide-y divide-gray-100">
                  {[
                    { label: 'Email', field: 'email', value: selectedUser.email, type: 'text' as const },
                    { label: 'Phone', field: 'phone_number', value: selectedUser.phone_number, type: 'text' as const },
                    { label: 'Trust Level', field: 'trust_level', value: selectedUser.trust_level, type: 'select' as const,
                      options: [{ label: 'L0', value: 'L0' }, { label: 'L1', value: 'L1' }, { label: 'L2', value: 'L2' }, { label: 'L3', value: 'L3' }] },
                    { label: 'Trust Score', field: 'trust_score', value: selectedUser.trust_score ?? 0, type: 'number' as const },
                    { label: 'Email ยืนยัน', field: 'is_email_verified', value: selectedUser.is_email_verified, type: 'boolean' as const },
                    { label: 'Phone ยืนยัน', field: 'is_phone_verified', value: selectedUser.is_phone_verified, type: 'boolean' as const },
                    { label: '2FA', field: 'two_factor_enabled', value: selectedUser.two_factor_enabled, type: 'boolean' as const },
                  ].map(({ label, field, value, type, options }: any) => (
                    <div key={field} className="flex items-center justify-between py-2 gap-2">
                      <span className="text-xs text-gray-500 w-28 shrink-0">{label}</span>
                      <div className="flex-1 text-right text-xs">
                        <EditCell value={value} type={type} options={options}
                          onSave={(v) => saveField(field, v)} />
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-2 gap-2">
                    <span className="text-xs text-gray-500 w-28 shrink-0">หมายเหตุ (admin)</span>
                    <div className="flex-1 text-right text-xs">
                      <EditCell value={selectedUser.admin_note ?? ''} type="text"
                        onSave={(v) => saveField('admin_note', v)} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2 gap-2">
                    <span className="text-xs text-gray-500 w-28 shrink-0">สมัครเมื่อ</span>
                    <span className="text-xs text-gray-700">{fmt(selectedUser.created_at)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 gap-2">
                    <span className="text-xs text-gray-500 w-28 shrink-0">Login ล่าสุด</span>
                    <span className="text-xs text-gray-700">{fmt(selectedUser.last_login_at)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 gap-2">
                    <span className="text-xs text-gray-500 w-28 shrink-0">งานสำเร็จ</span>
                    <span className="text-xs font-semibold text-gray-800">{selectedUser.completed_jobs_count}</span>
                  </div>
                </div>
              </Card>

              {/* ── Section: กระเป๋าเงิน ── */}
              <Card className="p-4">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">กระเป๋าเงิน</div>
                {walletLoading ? <LoadingState message="กำลังโหลด..." /> : !walletData ? (
                  <div className="text-xs text-gray-400">ไม่พบข้อมูล</div>
                ) : (
                  <div className="space-y-3">
                    {walletData.wallets.length === 0 ? (
                      <div className="text-xs text-gray-400">ไม่มีกระเป๋าเงิน</div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                        {walletData.wallets.map((w: any) => (
                          <div key={w.id} className="rounded-lg border border-gray-200 p-3 bg-gradient-to-r from-gray-50 to-white">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs font-bold text-gray-700 uppercase">{w.wallet_type}</span>
                              <span className="text-[10px] text-gray-400">{w.currency || 'THB'}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-green-50 rounded p-2 text-center">
                                <div className="text-[10px] text-gray-500 mb-0.5">Available</div>
                                <div className="text-sm font-bold text-green-700">{Number(w.available_balance || 0).toLocaleString()} ฿</div>
                              </div>
                              <div className="bg-yellow-50 rounded p-2 text-center">
                                <div className="text-[10px] text-gray-500 mb-0.5">Held</div>
                                <div className="text-sm font-bold text-yellow-700">{Number(w.held_balance || 0).toLocaleString()} ฿</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {walletData.bank_accounts.length > 0 && (
                      <div>
                        <div className="text-[11px] font-semibold text-gray-500 mb-1.5">บัญชีธนาคาร</div>
                        <div className="space-y-1.5">
                          {walletData.bank_accounts.map((b: any) => (
                            <div key={b.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-xs bg-white">
                              <div>
                                <span className="font-medium text-gray-700">{b.bank_name || b.bank_code}</span>
                                <span className="text-gray-400 ml-1">•••• {b.account_number_last4}</span>
                                <div className="text-gray-400 text-[11px]">{b.account_name}</div>
                              </div>
                              <span className={`text-[11px] px-1.5 py-0.5 rounded ${b.is_verified ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                {b.is_verified ? 'ยืนยันแล้ว' : 'ยังไม่ยืนยัน'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {walletData.recent_transactions.length > 0 && (
                      <div>
                        <div className="text-[11px] font-semibold text-gray-500 mb-1.5">รายการล่าสุด 20 รายการ</div>
                        <div className="space-y-0 divide-y divide-gray-100 max-h-48 overflow-y-auto rounded border border-gray-100">
                          {walletData.recent_transactions.map((t: any) => (
                            <div key={t.id} className="flex justify-between items-center px-2 py-1.5 text-xs hover:bg-gray-50">
                              <div>
                                <span className="font-medium text-gray-700">{t.type}</span>
                                {t.reference_type && <span className="text-gray-400 ml-1">· {t.reference_type}</span>}
                                <div className="text-[10px] text-gray-400">{fmt(t.created_at)}</div>
                              </div>
                              <span className={`font-semibold ${Number(t.amount) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                {Number(t.amount || 0).toLocaleString()} ฿
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>

              {/* ── Section: จัดการแบน ── */}
              {selectedUser.role !== 'admin' ? (
                <Card className="p-4">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">จัดการแบน / สถานะ</div>
                  <div className="mb-3">
                    <label className="text-xs text-gray-500">เหตุผล (ไม่บังคับ)</label>
                    <input type="text" value={banReason} onChange={(e) => setBanReason(e.target.value)}
                      placeholder="ระบุเหตุผล..."
                      className="mt-1 w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>

                  <div className="mb-3">
                    <div className="text-[11px] font-semibold text-gray-500 mb-2">สถานะบัญชี</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedUser.status !== 'suspended' ? (
                        <Button variant="outline" size="sm" loading={actionLoading === 'ban_suspend'} onClick={() => handleBan('suspend', true)}>ระงับบัญชี</Button>
                      ) : (
                        <Button variant="primary" size="sm" loading={actionLoading === 'ban_suspend'} onClick={() => handleBan('suspend', false)}>ปลดระงับ</Button>
                      )}
                      {selectedUser.status !== 'deleted' && (
                        <Button variant="danger" size="sm" loading={actionLoading === 'ban_delete'} onClick={() => handleBan('delete', true)}>ลบบัญชี (soft)</Button>
                      )}
                    </div>
                  </div>

                  <div className="text-[11px] font-semibold text-gray-500 mb-2">แบนเฉพาะฟีเจอร์</div>
                  <div className="space-y-2">
                    {(['ban_login', 'ban_job_create', 'ban_job_accept', 'ban_withdraw'] as BanType[]).map((bt) => {
                      const isActive = !!selectedUser[bt];
                      return (
                        <div key={bt} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                          <div>
                            <div className="text-xs font-medium text-gray-800">{BAN_LABELS[bt]}</div>
                            <div className="text-[10px] text-gray-400">{bt}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] px-1.5 py-0.5 rounded ${isActive ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                              {isActive ? 'แบนอยู่' : 'ปกติ'}
                            </span>
                            <Toggle checked={isActive} loading={actionLoading === `ban_${bt}`}
                              onChange={(v) => handleBan(bt, v)} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ) : (
                <Card className="p-4">
                  <div className="text-xs text-gray-400 text-center py-2">ไม่สามารถแบนบัญชี admin ได้</div>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

