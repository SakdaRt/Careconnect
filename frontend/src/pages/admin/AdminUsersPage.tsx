import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../../layouts';
import { Button, Card, Input, LoadingState } from '../../components/ui';
import api, { AdminUserListItem } from '../../services/api';

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'all' | 'hirer' | 'caregiver' | 'admin'>('all');
  const [status, setStatus] = useState<'all' | 'active' | 'suspended' | 'deleted'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.adminGetUsers({
        q: q.trim() || undefined,
        role: role === 'all' ? undefined : role,
        status: status === 'all' ? undefined : status,
        page,
        limit: 20,
      });
      if (!res.success || !res.data) {
        setUsers([]);
        setTotalPages(1);
        return;
      }
      setUsers(res.data.data || []);
      setTotalPages(res.data.totalPages || 1);
    } finally {
      setLoading(false);
    }
  }, [page, q, role, status]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = () => {
    setPage(1);
    load();
  };

  const openDetail = async (userId: string) => {
    setSelectedId(userId);
    setSelectedUser(null);
    const res = await api.adminGetUser(userId);
    if (!res.success || !res.data?.user) {
      toast.error(res.error || 'โหลดข้อมูลผู้ใช้ไม่สำเร็จ');
      return;
    }
    setSelectedUser(res.data.user);
  };

  const handleSetStatus = async (user: AdminUserListItem, next: 'active' | 'suspended' | 'deleted') => {
    setActionLoading(user.id);
    try {
      let reason: string | undefined;
      if (next === 'suspended') {
        const input = window.prompt('เหตุผลในการระงับบัญชี');
        if (!input) return;
        reason = input;
      }
      if (next === 'deleted') {
        const ok = window.confirm('ต้องการลบผู้ใช้แบบ soft delete ใช่หรือไม่?');
        if (!ok) return;
        reason = window.prompt('เหตุผลในการลบ (ถ้ามี)') || undefined;
      }
      const res = await api.adminSetUserStatus(user.id, next, reason);
      if (!res.success) {
        toast.error(res.error || 'อัปเดตสถานะไม่สำเร็จ');
        return;
      }
      toast.success('อัปเดตสถานะแล้ว');
      await load();
      if (selectedId === user.id) await openDetail(user.id);
    } finally {
      setActionLoading(null);
    }
  };

  const statusBadge = (s: string) => {
    if (s === 'active') return 'bg-green-100 text-green-800';
    if (s === 'suspended') return 'bg-yellow-100 text-yellow-800';
    if (s === 'deleted') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  const roleLabel = (r: string) => {
    if (r === 'hirer') return 'ผู้ว่าจ้าง';
    if (r === 'caregiver') return 'ผู้ดูแล';
    return 'แอดมิน';
  };

  const displayPrimary = (u: AdminUserListItem) => u.email || u.phone_number || '-';

  const selectedSummary = useMemo(() => {
    if (!selectedUser) return null;
    return {
      id: selectedUser.id as string,
      role: selectedUser.role as string,
      status: selectedUser.status as string,
      trust_level: selectedUser.trust_level as string,
      is_email_verified: !!selectedUser.is_email_verified,
      is_phone_verified: !!selectedUser.is_phone_verified,
      completed_jobs_count: Number(selectedUser.completed_jobs_count || 0),
      created_at: selectedUser.created_at as string,
      display_name: selectedUser.display_name as string | null | undefined,
    };
  }, [selectedUser]);

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        <Card className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="flex-1">
              <Input
                label="ค้นหา"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหา id / email / phone / ชื่อโปรไฟล์"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Role</label>
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as any);
                  setPage(1);
                }}
              >
                <option value="all">ทั้งหมด</option>
                <option value="hirer">hirer</option>
                <option value="caregiver">caregiver</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Status</label>
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as any);
                  setPage(1);
                }}
              >
                <option value="all">ทั้งหมด</option>
                <option value="active">active</option>
                <option value="suspended">suspended</option>
                <option value="deleted">deleted</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" onClick={handleSearch}>
                ค้นหา
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setQ('');
                  setRole('all');
                  setStatus('all');
                  setPage(1);
                }}
              >
                ล้าง
              </Button>
            </div>
          </div>
        </Card>

        {selectedSummary && (
          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900">
                  {selectedSummary.display_name || displayPrimary(selectedUser)}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {roleLabel(selectedSummary.role)} • {selectedSummary.trust_level}
                </div>
                <div className="text-[11px] text-gray-500 mt-2 font-mono break-all">{selectedSummary.id}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded ${statusBadge(selectedSummary.status)}`}>
                  {selectedSummary.status}
                </span>
                <Button variant="outline" size="sm" onClick={() => { setSelectedId(null); setSelectedUser(null); }}>
                  ปิด
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <div className="text-xs text-gray-700">
                Email verified: <strong>{selectedSummary.is_email_verified ? 'yes' : 'no'}</strong>
              </div>
              <div className="text-xs text-gray-700">
                Phone verified: <strong>{selectedSummary.is_phone_verified ? 'yes' : 'no'}</strong>
              </div>
              <div className="text-xs text-gray-700">
                Completed jobs: <strong>{selectedSummary.completed_jobs_count}</strong>
              </div>
              <div className="text-xs text-gray-700">
                Created: <strong>{new Date(selectedSummary.created_at).toLocaleString('th-TH')}</strong>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-0 overflow-hidden">
          {loading ? (
            <div className="p-6">
              <LoadingState message="กำลังโหลดผู้ใช้..." />
            </div>
          ) : users.length === 0 ? (
            <div className="p-6 text-sm text-gray-600">ไม่พบผู้ใช้</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {users.map((u) => (
                <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-gray-900">
                        {u.display_name || displayPrimary(u)}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${statusBadge(u.status)}`}>{u.status}</span>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {roleLabel(u.role)} • {u.trust_level} • jobs:{u.completed_jobs_count}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-2 font-mono break-all">{u.id}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openDetail(u.id)}>
                      รายละเอียด
                    </Button>
                    {u.role !== 'admin' && u.status === 'active' && (
                      <Button
                        variant="outline"
                        size="sm"
                        loading={actionLoading === u.id}
                        onClick={() => handleSetStatus(u, 'suspended')}
                      >
                        ระงับ
                      </Button>
                    )}
                    {u.role !== 'admin' && u.status === 'suspended' && (
                      <Button
                        variant="primary"
                        size="sm"
                        loading={actionLoading === u.id}
                        onClick={() => handleSetStatus(u, 'active')}
                      >
                        ปลดระงับ
                      </Button>
                    )}
                    {u.role !== 'admin' && u.status !== 'deleted' && (
                      <Button
                        variant="danger"
                        size="sm"
                        loading={actionLoading === u.id}
                        onClick={() => handleSetStatus(u, 'deleted')}
                      >
                        ลบ
                      </Button>
                    )}
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
      </div>
    </AdminLayout>
  );
}

