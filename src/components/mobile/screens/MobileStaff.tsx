import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/api';
import BottomSheet from '../shared/BottomSheet';
import { Users, Shield, CheckCircle, XCircle, ChevronRight, Mail, Key } from 'lucide-react';

interface MobileStaffProps {
  userRole: string;
}

export default function MobileStaff({ userRole }: MobileStaffProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected User
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Edit fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [isActive, setIsActive] = useState(true);

  const isAdmin = userRole === 'role-admin' || userRole === 'role-manager';

  const fetchStaffData = async () => {
    try {
      setLoading(true);
      const [usersData, rolesData] = await Promise.all([
        apiRequest('/api/users'),
        apiRequest('/api/roles')
      ]);
      setUsers(usersData || []);
      setRoles(rolesData || []);
    } catch (err) {
      console.error('Failed to fetch staff:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchStaffData();
    }
  }, [userRole]);

  const handleSelectUser = (usr: any) => {
    setSelectedUser(usr);
    setFullName(usr.full_name);
    setEmail(usr.email);
    setPassword(''); // keep blank by default
    setRoleId(usr.role_id);
    setIsActive(usr.is_active);
    setIsDetailOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const payload: any = {
        full_name: fullName,
        email: email,
        role_id: roleId,
        is_active: isActive
      };
      if (password.trim() !== '') {
        payload.password = password;
      }

      await apiRequest(`/api/users/${selectedUser.id}`, 'PUT', payload);
      alert('Cập nhật tài khoản nhân sự thành công!');
      setIsDetailOpen(false);
      fetchStaffData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu thông tin');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(p => p[0])
      .filter(Boolean)
      .slice(-2)
      .join('')
      .toUpperCase();
  };

  if (!isAdmin) {
    return (
      <div className="bg-rose-50 text-rose-700 p-4 rounded-xl text-xs flex items-center gap-2">
        <Shield className="w-5 h-5 shrink-0" />
        <span>Bạn không có quyền quản lý nhân sự.</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Danh sách nhân sự studio ({users.length})</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-gold-500"></div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {users.map(usr => (
            <div
              key={usr.id}
              onClick={() => handleSelectUser(usr)}
              className="bg-white p-4 rounded-xl border border-slate-200/50 shadow-3xs flex justify-between items-center cursor-pointer active:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-extrabold text-[10px] flex items-center justify-center">
                  {getInitials(usr.full_name)}
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    {usr.full_name}
                    {!usr.is_active && <XCircle className="w-3.5 h-3.5 text-rose-500" />}
                  </span>
                  <p className="text-[9px] text-slate-400 font-semibold uppercase">{usr.role_display_name || usr.role_id}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          ))}
        </div>
      )}

      {/* DETAIL / EDIT SHEET */}
      <BottomSheet
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title="Quản lý tài khoản nhân viên"
      >
        {selectedUser && (
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Họ và tên</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email đăng nhập</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mật khẩu mới (Để trống nếu giữ nguyên)</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vai trò phân quyền</label>
                <select
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                  className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
                >
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.display_name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trạng thái kích hoạt</label>
                <select
                  value={isActive ? 'true' : 'false'}
                  onChange={(e) => setIsActive(e.target.value === 'true')}
                  className="w-full bg-slate-50 border rounded-xl py-2.5 px-3 text-xs focus:outline-none"
                >
                  <option value="true">Đang kích hoạt</option>
                  <option value="false">Tạm dừng</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-gold-500 to-gold-600 text-white font-bold py-2.5 rounded-xl text-xs shadow-md mt-2"
            >
              Lưu thay đổi nhân sự
            </button>
          </form>
        )}
      </BottomSheet>
    </div>
  );
}
