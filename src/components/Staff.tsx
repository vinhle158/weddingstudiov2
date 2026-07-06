import React, { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import { 
  Users, 
  UserPlus, 
  Key, 
  Shield, 
  CheckCircle, 
  XCircle, 
  Edit, 
  X, 
  Plus, 
  AlertCircle, 
  Lock,
  Mail,
  Check,
  Trash2
} from 'lucide-react';


interface StaffProps {
  userRole: string;
}

export default function Staff({ userRole }: StaffProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User form states
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userFullName, setUserFullName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRoleId, setUserRoleId] = useState('');
  const [userIsActive, setUserIsActive] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);

  // Role form states
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDisplayName, setRoleDisplayName] = useState('');
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [roleError, setRoleError] = useState<string | null>(null);


  const permissionKeys = [
    { key: 'orders.view', name: 'Xem đơn hàng' },
    { key: 'orders.create', name: 'Ký mới đơn hàng' },
    { key: 'orders.edit', name: 'Sửa thông tin / Chuyển trạng thái đơn hàng' },
    { key: 'tasks.view_own', name: 'Xem công việc cá nhân được giao' },
    { key: 'tasks.view_all', name: 'Xem toàn bộ công việc của studio' },
    { key: 'tasks.assign', name: 'Phân công và giao việc' },
    { key: 'customers.view', name: 'Xem thông tin khách hàng' },
    { key: 'customers.edit', name: 'Thêm / Sửa hồ sơ khách hàng' },
    { key: 'leads.manage', name: 'Tư vấn và chăm sóc khách hàng' },
    { key: 'leads.view_all', name: 'Xem toàn bộ dữ liệu tư vấn' },
    { key: 'reports.view', name: 'Xem thống kê doanh thu' },
    { key: 'users.manage', name: 'Quản lý tài khoản và phân quyền *' }
  ];

  const getPermissionDisplayName = (key: string) => {
    const found = permissionKeys.find(pk => pk.key === key);
    return found ? found.name.replace(' *', '') : key;
  };



  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersData, rolesData] = await Promise.all([
        apiRequest('/api/users'),
        apiRequest('/api/roles')
      ]);
      setUsers(usersData);
      setRoles(rolesData);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách tài khoản');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreateUser = () => {
    setIsEditingUser(false);
    setSelectedUserId('');
    setUserFullName('');
    setUserEmail('');
    setUserPassword('');
    setUserRoleId(roles[0]?.id || '');
    setUserIsActive(true);
    setUserError(null);
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (usr: any) => {
    setIsEditingUser(true);
    setSelectedUserId(usr.id);
    setUserFullName(usr.full_name);
    setUserEmail(usr.email);
    setUserPassword(''); // blank means keep old password
    setUserRoleId(usr.role_id);
    setUserIsActive(usr.is_active);
    setUserError(null);
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);

    if (!userFullName || !userEmail || (!isEditingUser && !userPassword) || !userRoleId) {
      setUserError('Vui lòng điền đầy đủ các trường bắt buộc');
      return;
    }

    try {
      if (isEditingUser) {
        await apiRequest(`/api/users/${selectedUserId}`, 'PUT', {
          full_name: userFullName,
          email: userEmail,
          password: userPassword || undefined,
          role_id: userRoleId,
          is_active: userIsActive
        });
      } else {
        await apiRequest('/api/users', 'POST', {
          full_name: userFullName,
          email: userEmail,
          password: userPassword,
          role_id: userRoleId
        });
      }
      setIsUserModalOpen(false);
      fetchData();
    } catch (err: any) {
      setUserError(err.message || 'Lỗi lưu thông tin tài khoản');
    }
  };

  const handleToggleActiveUser = async (usr: any) => {
    try {
      await apiRequest(`/api/users/${usr.id}`, 'PUT', {
        is_active: !usr.is_active
      });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Không thể thay đổi trạng thái tài khoản');
    }
  };

  const handleOpenCreateRole = () => {
    setIsEditingRole(false);
    setSelectedRoleId(null);
    setRoleName('');
    setRoleDisplayName('');
    setRolePermissions([]);
    setRoleError(null);
    setIsRoleModalOpen(true);
  };

  const handleOpenEditRole = (role: any) => {
    setIsEditingRole(true);
    setSelectedRoleId(role.id);
    setRoleName(role.name);
    setRoleDisplayName(role.display_name);
    setRolePermissions(role.permissions);
    setRoleError(null);
    setIsRoleModalOpen(true);
  };

  const handleDeleteRole = async (role: any) => {
    if (role.id === 'role-admin') {
      alert('Không thể xóa vai trò quản trị tối cao của hệ thống');
      return;
    }
    const confirm = window.confirm(`Bạn có chắc chắn muốn xóa vai trò "${role.display_name}"? Hành động này không thể hoàn tác.`);

    if (!confirm) return;

    try {
      await apiRequest(`/api/roles/${role.id}`, 'DELETE');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Không thể xóa vai trò');
    }
  };

  const handlePermissionCheck = (permKey: string) => {
    setRolePermissions(prev => {
      if (prev.includes(permKey)) {
        return prev.filter(k => k !== permKey);
      } else {
        return [...prev, permKey];
      }
    });
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoleError(null);

    if (!roleDisplayName || rolePermissions.length === 0) {
      setRoleError('Vui lòng điền tên hiển thị vai trò và chọn ít nhất 1 quyền hạn');
      return;
    }

    try {
      if (isEditingRole && selectedRoleId) {
        await apiRequest(`/api/roles/${selectedRoleId}`, 'PUT', {
          display_name: roleDisplayName,
          permissions: rolePermissions
        });
      } else {
        if (!roleName) {
          setRoleError('Vui lòng nhập mã vai trò');
          return;
        }
        await apiRequest('/api/roles', 'POST', {
          name: roleName.toLowerCase().replace(/\s+/g, '_'),
          display_name: roleDisplayName,
          permissions: rolePermissions
        });
      }
      setIsRoleModalOpen(false);
      fetchData();
    } catch (err: any) {
      setRoleError(err.message || (isEditingRole ? 'Không thể cập nhật vai trò' : 'Không thể tạo vai trò mới'));
    }
  };


  if (userRole !== 'admin') {
    return (
      <div className="bg-red-50 border border-red-100 text-red-700 p-6 rounded-2xl flex items-center shadow-xs">
        <Shield className="w-6 h-6 mr-3 text-red-500 shrink-0" />
        <div>
          <h4 className="font-bold text-base">Từ chối truy cập!</h4>
          <p className="text-sm text-red-600 mt-1">Màn hình quản lý nhân viên chỉ dành riêng cho tài khoản Quản trị viên (Admin).</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Title */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-950">Quản lý nhân sự và vai trò</h2>
          <p className="text-sm text-gray-500 mt-1">Tạo mới, phân bổ quyền và cấu hình tài khoản cho kỹ thuật viên.</p>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={handleOpenCreateRole}
            className="border border-gray-200 hover:bg-gray-50 text-gray-700 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center transition-colors"
          >
            <Shield className="w-4 h-4 mr-2 text-gray-400" /> Tạo vai trò (Role)
          </button>
          <button 
            onClick={handleOpenCreateUser}
            className="bg-gold-500 hover:bg-gold-600 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs flex items-center transition-colors"
          >
            <UserPlus className="w-4 h-4 mr-2" /> Thêm tài khoản nhân viên
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold-500"></div>
          <span className="ml-2.5 text-gray-400 text-sm">Đang nạp dữ liệu nhân sự...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm flex items-center">
          <AlertCircle className="w-5 h-5 mr-2 shrink-0" />
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* User Accounts List */}
          <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-xs space-y-4">
            <h3 className="font-bold text-gray-900 text-base flex items-center pb-2 border-b border-gray-100">
              <Users className="w-5 h-5 mr-2 text-gold-500" /> Danh sách tài khoản kỹ thuật viên
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                    <th className="p-4 pl-6">Nhân viên</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Vai trò (Role)</th>
                    <th className="p-4">Trạng thái</th>
                    <th className="p-4 text-right pr-6">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs text-gray-700">
                  {users.map((usr) => (
                    <tr key={usr.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 pl-6">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-gold-50 border border-gold-100 text-gold-600 font-bold flex items-center justify-center text-xs">
                            {usr.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{usr.full_name}</p>
                            <p className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {usr.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 flex items-center mt-3.5 border-none">
                        <Mail className="w-3.5 h-3.5 text-gray-400 mr-1.5 shrink-0" />
                        {usr.email}
                      </td>
                      <td className="p-4">
                        <span className="font-medium bg-gray-100 px-2 py-0.5 rounded text-gray-600 capitalize">
                          {usr.role_name}
                        </span>
                      </td>
                      <td className="p-4">
                        <button 
                          onClick={() => handleToggleActiveUser(usr)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center ${
                            usr.is_active 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                              : 'bg-rose-50 text-rose-700 border-rose-100'
                          }`}
                        >
                          {usr.is_active ? (
                            <><CheckCircle className="w-3 h-3 mr-1" /> Hoạt động</>
                          ) : (
                            <><XCircle className="w-3 h-3 mr-1" /> Tạm dừng</>
                          )}
                        </button>
                      </td>
                      <td className="p-4 text-right pr-6">
                        <button 
                          onClick={() => handleOpenEditUser(usr)}
                          className="text-gold-500 hover:text-gold-700 font-semibold p-1.5 hover:bg-gold-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Roles & Permissions Grid Card */}
          <div className="xl:col-span-1 bg-white rounded-2xl border border-gray-100 p-5 shadow-xs space-y-4 h-fit">
            <h3 className="font-bold text-gray-900 text-base flex items-center pb-2 border-b border-gray-100">
              <Shield className="w-5 h-5 mr-2 text-gold-500" /> Vai trò & Ma trận phân quyền
            </h3>
            
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
              {roles.map((r) => (
                <div key={r.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2 min-w-0">
                      <h4 className="font-bold text-gray-950 text-sm capitalize truncate">{r.display_name}</h4>
                      <span className="text-[9px] bg-gold-100/70 text-gold-800 font-mono font-bold px-1.5 py-0.5 rounded shrink-0">
                        {r.name}
                      </span>
                    </div>
                    {/* Action buttons (only for non-admin roles) */}
                    {r.id !== 'role-admin' && (

                      <div className="flex items-center space-x-0.5 shrink-0 ml-2">
                        <button 
                          onClick={() => handleOpenEditRole(r)} 
                          className="p-1 hover:bg-gold-50 text-gray-400 hover:text-gold-600 rounded-lg transition-colors cursor-pointer"
                          title="Sửa vai trò"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteRole(r)} 
                          className="p-1 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                          title="Xóa vai trò"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {r.permissions.map((perm: string) => (
                      <span key={perm} className="bg-white border border-gray-200 text-gray-600 rounded-lg px-2.5 py-0.5 text-[10px] font-semibold shadow-3xs">
                        {getPermissionDisplayName(perm)}
                      </span>
                    ))}
                  </div>

                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* User Account form Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden border border-gray-100 animate-scale-in">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-base">
                {isEditingUser ? 'Sửa tài khoản nhân viên' : 'Đăng ký tài khoản nhân viên mới'}
              </h3>
              <button onClick={() => setIsUserModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              {userError && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-xs flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1.5 shrink-0" />
                  {userError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Họ và tên nhân viên *</label>
                <input 
                  type="text"
                  value={userFullName}
                  onChange={(e) => setUserFullName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn Hải"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-gold-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Email liên hệ *</label>
                <input 
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="Ví dụ: photographer1@aura.vn"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-gold-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider flex justify-between">
                  <span>Mật khẩu đăng nhập *</span>
                  {isEditingUser && <span className="text-[10px] text-gray-400 lowercase font-normal">(để trống nếu giữ nguyên)</span>}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input 
                    type="password"
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    placeholder={isEditingUser ? "••••••••" : "Nhập mật khẩu cho nhân viên"}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-gold-500"
                    required={!isEditingUser}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Gán Vai trò quản trị (Role) *</label>
                <select 
                  value={userRoleId}
                  onChange={(e) => setUserRoleId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-gold-500"
                  required
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.display_name}</option>
                  ))}
                </select>
              </div>

              {isEditingUser && (
                <div className="flex items-center space-x-2 pt-2">
                  <input 
                    type="checkbox" 
                    id="is_active_chk"
                    checked={userIsActive}
                    onChange={(e) => setUserIsActive(e.target.checked)}
                    className="rounded border-gray-300 text-gold-600 focus:ring-gold-500"
                  />
                  <label htmlFor="is_active_chk" className="text-xs font-semibold text-gray-700">Tài khoản nhân viên được phép hoạt động</label>
                </div>
              )}

              <div className="flex space-x-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsUserModalOpen(false)}
                  className="w-1/2 border border-gray-200 hover:bg-gray-50 text-gray-700 py-2.5 rounded-xl text-xs font-semibold"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit"
                  className="w-1/2 bg-gold-500 hover:bg-gold-600 text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs"
                >
                  Lưu tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role Creation Modal */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl overflow-hidden border border-gray-100 animate-scale-in">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-base">
                {isEditingRole ? 'Chỉnh sửa vai trò & phân quyền' : 'Tạo vai trò và phân quyền (Role)'}
              </h3>
              <button onClick={() => setIsRoleModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="p-6 space-y-4">
              {roleError && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-xs flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1.5 shrink-0" />
                  {roleError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Mã vai trò (chữ thường liền)</label>
                  <input 
                    type="text"
                    placeholder="photographer_vip"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    disabled={isEditingRole}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Tên hiển thị</label>
                  <input 
                    type="text"
                    placeholder="Nhiếp ảnh gia chính"
                    value={roleDisplayName}
                    onChange={(e) => setRoleDisplayName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block">Chọn danh mục quyền hạn cấp phép</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto border border-gray-100 p-3 rounded-xl bg-gray-50/50">
                  {permissionKeys.map((perm) => {
                    const checked = rolePermissions.includes(perm.key);
                    return (
                      <div 
                        key={perm.key} 
                        onClick={() => handlePermissionCheck(perm.key)}
                        className={`p-2.5 rounded-lg border text-[11px] font-semibold flex items-center justify-between cursor-pointer transition-all ${
                          checked 
                            ? 'bg-gold-50 border-gold-300 text-gold-900 shadow-3xs' 
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span>{perm.name}</span>
                        {checked && <Check className="w-3.5 h-3.5 text-gold-600 shrink-0 ml-1" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsRoleModalOpen(false)}
                  className="w-1/2 border border-gray-200 hover:bg-gray-50 text-gray-700 py-2.5 rounded-xl text-xs font-semibold"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit"
                  className="w-1/2 bg-gold-500 hover:bg-gold-600 text-white py-2.5 rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                >
                  {isEditingRole ? 'Lưu thay đổi' : 'Xác nhận Tạo vai trò'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
