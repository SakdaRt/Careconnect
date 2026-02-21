import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../../layouts';
import { Button, Card, Input, LoadingState } from '../../components/ui';
import api, { AdminUserListItem } from '../../services/api';

type BanType = 'suspend' | 'delete' | 'ban_login' | 'ban_job_create' | 'ban_job_accept' | 'ban_withdraw';

const BAN_LABELS: Record<BanType, string> = {
  suspend: 'ระงับบัญชี',
  delete: 'ลบบัญชี',
  ban_login: 'แบนเข้าสู่ระบบ',
  ban_job_create: 'แบนสร้างงาน',
  ban_job_accept: 'แบนรับงาน',
  ban_withdraw: 'แบนถอนเงิน',
};

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'all' | 'hirer' | 'caregiver' | 'admin'>('all');
  const [status, setStatus] = useState<'all' | 'active' | 'suspended' | 'deleted'>('all');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [walletData, setWalletData] = useState<any>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'profile' | 'wallet' | 'ban'>('profile');
  const [banReason, setBanReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.adminGetUsers({ q: q.trim() || undefined, role: role === 'all' ? undefined : role, status: status === 'all' ? undefined : status, page, limit: 20 });
      if (!res.success || !res.data) { setUsers([]); setTotalPages(1); setTotal(0); return; }
      setUsers(res.data.data || []);
      setTotalPages(res.data.totalPages || 1);
      setTotal(res.data.total || 0);
    } finally { setLoading(false); }
  }, [page, q, role, status]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (userId: string) => {
    setSelectedUser(null); setWalletData(null); setDetailTab('profile'); setBanReason('');
    const res = await api.adminGetUser(userId);
    if (!res.success || !res.data?.user) { toast.error(res.error || 'โหลดข้อมูลไม่สำเร็จ'); return; }
    setSelectedUser(res.data.user);
  };

  const loadWallet = useCallback(async (userId: string) => {
    setWalletLoading(true);
    try {
      const res = await api.adminGetUserWallet(userId);
      if (res.success && res.data) setWalletData(res.data);
    } finally { setWalletLoading(false); }
  }, []);

  useEffect(() => {
    if (selectedUser && detailTab === 'wallet' && !walletData) loadWallet(selectedUser.id);
  }, [detailTab, selectedUser, walletData, loadWallet]);

  const handleBan = async (banType: BanType, value: boolean) => {
    if (!selectedUser) return;
    if (banType === 'delete' && !window.confirm('ลบบัญชีแบบ soft delete ใช่หรือไม่?')) return;
    setActionLoading(`ban_${banType}`);
    try {
      const res = await api.adminSetBan(selectedUser.id, banType, value, banReason || undefined);
      if (!res.success) { toast.error(res.error || 'ทำรายการไม่สำเร็จ'); return; }
      toast.success((res as any).message || 'อัปเดตแล้ว');
      await openDetail(selectedUser.id);
      await load();
    } finally { setActionLoading(null); }
  };

  const statusBadge = (s: string) => {
    if (s === 'active') return 'bg-green-100 text-green-800';
    if (s === 'suspended') return 'bg-yellow-100 text-yellow-800';
    if (s === 'deleted') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };
  const trustBadge = (t: string) => {
    if (t === 'L3') return 'bg-purple-100 text-purple-800';
    if (t === 'L2') return 'bg-blue-100 text-blue-800';
    if (t === 'L1') return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-600';
  };
  const roleLabel = (r: string) => r === 'hirer' ? 'ผู้ว่าจ้าง' : r === 'caregiver' ? 'ผู้ดูแล' : 'แอดมิน';
  const displayPrimary = (u: any) => u.email || u.phone_number || '-';

  const banFlags = useMemo(() => !selectedUser ? {} : {
    ban_login: !!selectedUser.ban_login,
    ban_job_create: !!selectedUser.ban_job_create,
    ban_job_accept: !!selectedUser.ban_job_accept,
    ban_withdraw: !!selectedUser.ban_withdraw,
  }, [selectedUser]);

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Search & Filter */}
        <Card className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="flex-1">
              <Input label="ค้นหา" value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหา id / email / phone / ชื่อโปรไฟล์"
                onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); load(); } }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Role</label>
              <select className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm" value={role}
                onChange={(e) => { setRole(e.target.value as any); setPage(1); }}>
                <option value="all">ทั้งหมด</option>
                <option value="hirer">hirer</option>
                <option value="caregiver">caregiver</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Status</label>
              <select className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm" value={status}
                onChange={(e) => { setStatus(e.target.value as any); setPage(1); }}>
                <option value="all">ทั้งหมด</option>
                <option value="active">active</option>
                <option value="suspended">suspended</option>
                <option value="deleted">deleted</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => { setPage(1); load(); }}>ค้นหา</Button>
              <Button variant="outline" onClick={() => { setQ(''); setRole('all'); setStatus('all'); setPage(1); }}>ล้าง</Button>
              <Button variant="outline" onClick={load}>รีเฟรช</Button>
            </div>
          </div>
          {total > 0 && <div className="text-xs text-gray-500 mt-2">พบ {total.toLocaleString()} ผู้ใช้</div>}
        </Card>

        <div className={`grid gap-4 ${selectedUser ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
          {/* User Table */}
          <Card className="p-0 overflow-hidden">
            {loading ? (
              <div className="p-6"><LoadingState message="กำลังโหลดผู้ใช้..." /></div>
            ) : users.length === 0 ? (
              <div className="p-6 text-sm text-gray-600">ไม่พบผู้ใช้</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">ผู้ใช้</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Role / Level</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">สถานะ / แบน</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600">งาน</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {users.map((u) => (
                      <tr key={u.id} className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectedUser?.id === u.id ? 'bg-blue-50' : ''}`}
                        onClick={() => openDetail(u.id)}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 truncate max-w-[180px]">{u.display_name || displayPrimary(u)}</div>
                          <div className="text-[11px] text-gray-400 truncate max-w-[180px]">{u.email || u.phone_number || '-'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-gray-700">{roleLabel(u.role)}</div>
                          <span className={`text-[11px] px-1.5 py-0.5 rounded font-semibold ${trustBadge(u.trust_level)}`}>{u.trust_level} • {(u as any).trust_score ?? 0}pt</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded ${statusBadge(u.status)}`}>{u.status}</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(u as any).ban_login && <span className="text-[10px] bg-red-100 text-red-700 px-1 rounded">login</span>}
                            {(u as any).ban_job_create && <span className="text-[10px] bg-red-100 text-red-700 px-1 rounded">create</span>}
                            {(u as any).ban_job_accept && <span className="text-[10px] bg-red-100 text-red-700 px-1 rounded">accept</span>}
                            {(u as any).ban_withdraw && <span className="text-[10px] bg-red-100 text-red-700 px-1 rounded">withdraw</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-gray-600">{u.completed_jobs_count}</td>
                        <td className="px-4 py-3">
                          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openDetail(u.id); }}>ดู</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="p-3 border-t border-gray-200 flex items-center justify-between gap-3">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>ก่อนหน้า</Button>
              <div className="text-xs text-gray-600">หน้า {page} / {totalPages}</div>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>ถัดไป</Button>
            </div>
          </Card>

          {/* Detail Panel */}
          {selectedUser && (
            <Card className="p-4 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-semibold text-gray-900">{selectedUser.display_name || displayPrimary(selectedUser)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{roleLabel(selectedUser.role)} • {selectedUser.email || selectedUser.phone_number || '-'}</div>
                  <div className="text-[11px] text-gray-400 mt-1 font-mono break-all">{selectedUser.id}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-1 rounded ${statusBadge(selectedUser.status)}`}>{selectedUser.status}</span>
                  <Button variant="outline" size="sm" onClick={() => setSelectedUser(null)}>ปิด</Button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 border-b border-gray-200">
                {(['profile', 'wallet', 'ban'] as const).map((tab) => (
                  <button key={tab} onClick={() => setDetailTab(tab)}
                    className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${detailTab === tab ? 'border-blue-500 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {tab === 'profile' ? 'โปรไฟล์' : tab === 'wallet' ? 'กระเป๋าเงิน' : 'จัดการแบน'}
                  </button>
                ))}
              </div>

              {/* Profile Tab */}
              {detailTab === 'profile' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-gray-500">Trust Level</div>
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${trustBadge(selectedUser.trust_level)}`}>{selectedUser.trust_level}</span>
                    </div>
                    <div><div className="text-xs text-gray-500">Trust Score</div><div className="font-semibold">{selectedUser.trust_score ?? 0} / 100</div></div>
                    <div><div className="text-xs text-gray-500">งานสำเร็จ</div><div className="font-semibold">{selectedUser.completed_jobs_count}</div></div>
                    <div><div className="text-xs text-gray-500">Account Type</div><div className="font-semibold">{selectedUser.account_type}</div></div>
                    <div>
                      <div className="text-xs text-gray-500">Email</div>
                      <div className="text-xs">{selectedUser.email || '-'} {selectedUser.is_email_verified ? <span className="text-green-600">✓</span> : <span className="text-gray-400">✗</span>}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Phone</div>
                      <div className="text-xs">{selectedUser.phone_number || '-'} {selectedUser.is_phone_verified ? <span className="text-green-600">✓</span> : <span className="text-gray-400">✗</span>}</div>
                    </div>
                    <div><div className="text-xs text-gray-500">สมัครเมื่อ</div><div className="text-xs font-medium">{new Date(selectedUser.created_at).toLocaleString('th-TH')}</div></div>
                    <div><div className="text-xs text-gray-500">เข้าสู่ระบบล่าสุด</div><div className="text-xs font-medium">{selectedUser.last_login_at ? new Date(selectedUser.last_login_at).toLocaleString('th-TH') : '-'}</div></div>
                  </div>
                </div>
              )}

              {/* Wallet Tab */}
              {detailTab === 'wallet' && (
                <div className="space-y-3">
                  {walletLoading ? <LoadingState message="กำลังโหลดกระเป๋าเงิน..." /> : !walletData ? (
                    <div className="text-sm text-gray-500">ไม่พบข้อมูล</div>
                  ) : (
                    <>
                      <div>
                        <div className="text-xs font-semibold text-gray-700 mb-2">กระเป๋าเงิน</div>
                        {walletData.wallets.length === 0 ? <div className="text-xs text-gray-500">ไม่มีกระเป๋าเงิน</div> : (
                          <div className="space-y-2">
                            {walletData.wallets.map((w: any) => (
                              <div key={w.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                                <div className="flex justify-between items-center">
                                  <span className="font-medium text-gray-700">{w.wallet_type}</span>
                                  <span className="text-xs text-gray-500">{w.currency || 'THB'}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                                  <div><span className="text-gray-500">Available: </span><span className="font-semibold text-green-700">{Number(w.available_balance || 0).toLocaleString()} ฿</span></div>
                                  <div><span className="text-gray-500">Held: </span><span className="font-semibold text-yellow-700">{Number(w.held_balance || 0).toLocaleString()} ฿</span></div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {walletData.bank_accounts.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-gray-700 mb-2">บัญชีธนาคาร</div>
                          <div className="space-y-2">
                            {walletData.bank_accounts.map((b: any) => (
                              <div key={b.id} className="bg-gray-50 rounded-lg p-3 text-xs">
                                <div className="flex justify-between">
                                  <span className="font-medium">{b.bank_name || b.bank_code} •••• {b.account_number_last4}</span>
                                  <span className={b.is_verified ? 'text-green-600' : 'text-gray-400'}>{b.is_verified ? 'ยืนยันแล้ว' : 'ยังไม่ยืนยัน'}</span>
                                </div>
                                <div className="text-gray-500 mt-0.5">{b.account_name}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {walletData.recent_transactions.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-gray-700 mb-2">รายการล่าสุด (20 รายการ)</div>
                          <div className="space-y-1 max-h-64 overflow-y-auto">
                            {walletData.recent_transactions.map((t: any) => (
                              <div key={t.id} className="flex justify-between items-center text-xs py-1.5 border-b border-gray-100">
                                <div>
                                  <span className="font-medium text-gray-700">{t.type}</span>
                                  <span className="text-gray-400 ml-1">• {t.reference_type || '-'}</span>
                                  <div className="text-gray-400">{new Date(t.created_at).toLocaleString('th-TH')}</div>
                                </div>
                                <span className="font-semibold text-gray-800">{Number(t.amount || 0).toLocaleString()} ฿</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Ban Tab */}
              {detailTab === 'ban' && selectedUser.role !== 'admin' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700">เหตุผล (ไม่บังคับ)</label>
                    <input type="text" value={banReason} onChange={(e) => setBanReason(e.target.value)}
                      placeholder="ระบุเหตุผลสำหรับการดำเนินการ"
                      className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-gray-700 mb-1">สถานะบัญชี</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedUser.status !== 'suspended' && (
                        <Button variant="outline" size="sm" loading={actionLoading === 'ban_suspend'}
                          onClick={() => handleBan('suspend', true)}>
                          ระงับบัญชี
                        </Button>
                      )}
                      {selectedUser.status === 'suspended' && (
                        <Button variant="primary" size="sm" loading={actionLoading === 'ban_suspend'}
                          onClick={() => handleBan('suspend', false)}>
                          ปลดระงับบัญชี
                        </Button>
                      )}
                      {selectedUser.status !== 'deleted' && (
                        <Button variant="danger" size="sm" loading={actionLoading === 'ban_delete'}
                          onClick={() => handleBan('delete', true)}>
                          ลบบัญชี (soft)
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-gray-700 mb-1">แบนเฉพาะฟีเจอร์</div>
                    <div className="grid grid-cols-1 gap-2">
                      {((['ban_login', 'ban_job_create', 'ban_job_accept', 'ban_withdraw'] as BanType[])).map((bt) => {
                        const isActive = !!(banFlags as any)[bt];
                        return (
                          <div key={bt} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <div className="text-sm font-medium text-gray-800">{BAN_LABELS[bt]}</div>
                              <div className="text-xs text-gray-500">{bt}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-2 py-0.5 rounded ${isActive ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {isActive ? 'แบนอยู่' : 'ปกติ'}
                              </span>
                              <Button
                                variant={isActive ? 'primary' : 'outline'}
                                size="sm"
                                loading={actionLoading === `ban_${bt}`}
                                onClick={() => handleBan(bt, !isActive)}>
                                {isActive ? 'ยกเลิกแบน' : 'แบน'}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              {detailTab === 'ban' && selectedUser.role === 'admin' && (
                <div className="text-sm text-gray-500 py-4 text-center">ไม่สามารถแบนบัญชี admin ได้</div>
              )}
            </Card>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

