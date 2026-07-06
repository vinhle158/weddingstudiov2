import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/api';
import { User, Shield, Building, Phone, Mail, MapPin, LogOut, Save, Bell } from 'lucide-react';

interface MobileSettingsProps {
  user: any;
  role: any;
  onLogout: () => void;
  studioSettings: any;
}

export default function MobileSettings({ user, role, onLogout, studioSettings }: MobileSettingsProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [hours, setHours] = useState('');
  const [saving, setSaving] = useState(false);

  // Local settings
  const [notifEnabled, setNotifEnabled] = useState(() => {
    return localStorage.getItem('mobile_notif_enabled') !== 'false';
  });

  const isAdmin = role?.id === 'role-admin' || role?.id === 'role-manager';

  useEffect(() => {
    if (studioSettings) {
      setName(studioSettings.name || '');
      setPhone(studioSettings.phone || '');
      setEmail(studioSettings.email || '');
      setAddress(studioSettings.address || '');
      setHours(studioSettings.opening_hours || '');
    }
  }, [studioSettings]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      setSaving(true);
      const payload = {
        ...studioSettings,
        name,
        phone,
        email,
        address,
        opening_hours: hours
      };
      await apiRequest('/api/studio/settings', 'PUT', payload);
      alert('Đã lưu thông tin Studio thành công!');
    } catch (err: any) {
      alert(err.message || 'Lỗi lưu thông tin');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleNotif = () => {
    const nextVal = !notifEnabled;
    setNotifEnabled(nextVal);
    localStorage.setItem('mobile_notif_enabled', String(nextVal));
  };

  return (
    <div className="space-y-6 pb-6 animate-fade-in">
      {/* Profile Capsule */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/50 shadow-2xs space-y-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hồ sơ cá nhân</p>
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-full bg-gold-600 text-white font-extrabold flex items-center justify-center text-sm font-mono shadow-2xs">
            {user?.full_name?.charAt(0).toUpperCase()}
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-800 leading-tight">{user?.full_name}</h4>
            <span className="text-[8px] bg-gold-50 border border-gold-200 text-gold-700 font-bold px-2 py-0.5 rounded uppercase tracking-wide">
              {role?.display_name || 'Nhân viên'}
            </span>
            <p className="text-[10px] text-slate-400 font-semibold">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Push notifications setting */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/50 shadow-2xs space-y-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tùy chỉnh thiết bị</p>
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-2 text-slate-700 font-bold">
            <Bell className="w-4 h-4 text-gold-600" />
            <span>Thông báo đẩy di động</span>
          </div>
          <button 
            onClick={handleToggleNotif}
            className={`w-10 h-5 rounded-full transition-all relative border flex items-center ${notifEnabled ? 'bg-gold-500 border-gold-600 justify-end' : 'bg-slate-100 border-slate-200 justify-start'}`}
          >
            <span className="w-4 h-4 bg-white rounded-full mx-0.5 shadow-2xs"></span>
          </button>
        </div>
      </div>

      {/* Studio Settings Form */}
      {isAdmin && (
        <form onSubmit={handleSaveSettings} className="bg-white p-5 rounded-2xl border border-slate-200/50 shadow-2xs space-y-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Building className="w-4 h-4 text-gold-600" />
            <span>Thông tin Studio thương hiệu</span>
          </p>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tên Studio</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Hotline</label>
              <input 
                type="text" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Email liên hệ</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Địa chỉ studio</label>
              <input 
                type="text" 
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Giờ mở cửa</label>
              <input 
                type="text" 
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-xs focus:outline-none"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={saving}
            className="w-full bg-gradient-to-r from-gold-500 to-gold-600 text-white font-bold py-2.5 rounded-xl text-xs shadow-md flex items-center justify-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Đang lưu...' : 'Lưu thông tin thương hiệu'}</span>
          </button>
        </form>
      )}

      {/* Logout button */}
      <button 
        onClick={onLogout}
        className="w-full bg-rose-50 hover:bg-rose-100/50 text-rose-600 border border-rose-200 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
      >
        <LogOut className="w-4 h-4" />
        <span>Đăng xuất tài khoản</span>
      </button>
    </div>
  );
}
