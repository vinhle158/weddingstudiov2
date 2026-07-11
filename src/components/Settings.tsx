import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { motion } from 'motion/react';
import { 
  Settings as SettingsIcon, 
  Database, 
  Upload, 
  Download, 
  RefreshCw, 
  Trash2, 
  Calendar, 
  Clock, 
  Save, 
  FileJson, 
  CheckCircle2, 
  AlertTriangle,
  Building,
  Phone,
  Mail,
  MapPin,
  Globe,
  Loader2,
  Server,
  Cpu,
  Activity
} from 'lucide-react';

interface StudioSettings {
  name: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  opening_hours: string;
  notes: string;
  backup_schedule: 'daily' | 'weekly' | 'monthly' | 'none';
  last_backup_time: string;
  anniversary_reminder_days: number;
}

interface BackupItem {
  id: string;
  filename: string;
  created_at: string;
  size_bytes: number;
  trigger_type: 'manual' | 'scheduled';
  status: 'success' | 'failed';
}

interface SettingsProps {
  onSettingsSaved?: () => void;
}

export default function Settings({ onSettingsSaved }: SettingsProps) {
  const [activeSubTab, setActiveSubTab] = useState<'info' | 'database'>('info');
  
  // Settings Form State
  const [settings, setSettings] = useState<StudioSettings>({
    name: 'The Will Studio',
    phone: '',
    email: '',
    address: '',
    website: '',
    opening_hours: '',
    notes: '',
    backup_schedule: 'weekly',
    last_backup_time: '',
    anniversary_reminder_days: 7
  });
  
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Backup List State
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [backupMsg, setBackupMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Import State
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  
  // Confirm Modal State
  const [showRestoreConfirm, setShowRestoreConfirm] = useState<BackupItem | null>(null);

  // System Status State
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [loadingSystemStatus, setLoadingSystemStatus] = useState(false);
  const [systemStatusError, setSystemStatusError] = useState<string | null>(null);

  const fetchSystemStatus = async () => {
    try {
      setLoadingSystemStatus(true);
      setSystemStatusError(null);
      const data = await apiRequest('/api/system/status');
      setSystemStatus(data);
    } catch (err: any) {
      setSystemStatusError(err.message || 'Không thể lấy trạng thái hệ thống');
    } finally {
      setLoadingSystemStatus(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchBackups();
    fetchSystemStatus();

    const interval = setInterval(fetchSystemStatus, 30000);
    return () => clearInterval(interval);
  }, []);


  const fetchSettings = async () => {
    try {
      setLoadingSettings(true);
      const data = await apiRequest('/api/studio/settings');
      if (data && data.name) {
        setSettings(data);
      }
    } catch (err) {
      console.error('Failed to fetch studio settings:', err);
    } finally {
      setLoadingSettings(false);
    }
  };

  const fetchBackups = async () => {
    try {
      setLoadingBackups(true);
      const data = await apiRequest('/api/database/backups');
      setBackups(data.sort((a: BackupItem, b: BackupItem) => b.created_at.localeCompare(a.created_at)));
    } catch (err) {
      console.error('Failed to fetch backup history:', err);
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMsg(null);
    try {
      const updated = await apiRequest('/api/studio/settings', 'PUT', settings);
      setSettings(updated);
      setSettingsMsg({ type: 'success', text: 'Cập nhật thông tin Studio thành công!' });
      if (onSettingsSaved) {
        onSettingsSaved();
      }
      setTimeout(() => setSettingsMsg(null), 4000);
    } catch (err: any) {
      setSettingsMsg({ type: 'error', text: err.message || 'Lỗi lưu thông tin Studio.' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleExportDatabase = () => {
    const token = localStorage.getItem('studio_token');
    if (!token) return;
    
    // Programmatically trigger a file download using standard form/link behavior to include the Bearer Token
    fetch('/api/database/export', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      if (response.ok) {
        return response.blob();
      }
      throw new Error('Export failed');
    })
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aura_bridal_database_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    })
    .catch(err => {
      alert('Không thể xuất dữ liệu: ' + err.message);
    });
  };

  const handleImportDatabase = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setImporting(true);
        setImportError(null);
        const json = JSON.parse(event.target?.result as string);
        
        await apiRequest('/api/database/import', 'POST', json);
        setBackupMsg({ type: 'success', text: 'Đã nhập dữ liệu thành công! Trình duyệt sẽ tải lại sau 2 giây.' });
        
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } catch (err: any) {
        setImportError(err.message || 'Lỗi đọc file JSON hoặc cấu trúc không hợp lệ');
        setBackupMsg({ type: 'error', text: 'Lỗi nạp file dữ liệu.' });
      } finally {
        setImporting(false);
        if (e.target) e.target.value = ''; // clear input
      }
    };
    reader.readAsText(file);
  };

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    setBackupMsg(null);
    try {
      const newBackup = await apiRequest('/api/database/backups/create', 'POST', { trigger_type: 'manual' });
      setBackups([newBackup, ...backups]);
      setBackupMsg({ type: 'success', text: 'Đã tạo bản sao lưu vật lý thành công!' });
      
      // Update local last backup time
      setSettings(prev => ({ ...prev, last_backup_time: newBackup.created_at }));
      setTimeout(() => setBackupMsg(null), 4000);
    } catch (err: any) {
      setBackupMsg({ type: 'error', text: err.message || 'Lỗi khi tạo sao lưu.' });
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleRestoreBackup = async (backup: BackupItem) => {
    setRestoringId(backup.id);
    setShowRestoreConfirm(null);
    setBackupMsg(null);
    try {
      await apiRequest(`/api/database/backups/restore/${backup.id}`, 'POST');
      setBackupMsg({ type: 'success', text: 'Đã khôi phục dữ liệu từ bản sao lưu thành công. Đang tải lại dữ liệu...' });
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setBackupMsg({ type: 'error', text: err.message || 'Lỗi khi khôi phục.' });
    } finally {
      setRestoringId(null);
    }
  };

  const handleDeleteBackup = async (id: string) => {
    setDeletingId(id);
    setBackupMsg(null);
    try {
      await apiRequest(`/api/database/backups/${id}`, 'DELETE');
      setBackups(backups.filter(b => b.id !== id));
      setBackupMsg({ type: 'success', text: 'Đã xóa bản sao lưu vật lý.' });
      setTimeout(() => setBackupMsg(null), 3000);
    } catch (err: any) {
      setBackupMsg({ type: 'error', text: err.message || 'Lỗi khi xóa bản sao lưu.' });
    } finally {
      setDeletingId(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6 animate-fade-in" id="settings-view">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gold-200/20 pb-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-wider font-display text-gold-950 italic flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-gold-600" />
            Cấu hình Hệ thống & Dữ liệu
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Thiết lập thông tin thương hiệu Studio và quản trị công cụ sao lưu, bảo trì dữ liệu.
          </p>
        </div>
      </div>

      {/* System Health Panel */}
      <div className="bg-white rounded-2xl border border-gray-150 p-4 shadow-3xs grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
        <div className="flex items-center justify-between sm:col-span-1 border-b sm:border-b-0 sm:border-r border-gray-100 pb-2 sm:pb-0 pr-2">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gold-50 text-gold-600 rounded-xl">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Hệ thống</p>
              <h4 className="text-xs font-bold text-gray-900 mt-0.5 flex items-center">
                Trạng thái
                <button 
                  onClick={fetchSystemStatus} 
                  disabled={loadingSystemStatus}
                  className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gold-600 transition-colors ml-1 cursor-pointer"
                  title="Kiểm tra lại trạng thái"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingSystemStatus ? 'animate-spin' : ''}`} />
                </button>
              </h4>
            </div>
          </div>
        </div>
        
        {/* Backend Status */}
        <div className="flex items-center justify-between sm:col-span-1 border-b sm:border-b-0 sm:border-r border-gray-100 pb-2 sm:pb-0 pr-4 pl-1">
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-gray-700">Máy chủ API</span>
          </div>
          <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
            Đang chạy
          </span>
        </div>

        {/* Database Status */}
        <div className="flex items-center justify-between sm:col-span-1 border-b sm:border-b-0 sm:border-r border-gray-100 pb-2 sm:pb-0 pr-4 pl-1">
          <div className="flex items-center space-x-2">
            {systemStatus?.database === 'online' ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-bold text-gray-700">PostgreSQL</span>
              </>
            ) : (
              <>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                <span className="text-xs font-bold text-gray-700">PostgreSQL</span>
              </>
            )}
          </div>
          {systemStatus?.database === 'online' ? (
            <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Kết nối tốt ({systemStatus?.db_latency_ms}ms)
            </span>
          ) : (
            <span className="text-[10px] bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Mất kết nối
            </span>
          )}
        </div>

        {/* Machine Stats */}
        <div className="flex items-center justify-between sm:col-span-1 pr-2 pl-1">
          <div className="flex items-center space-x-2">
            <Cpu className="w-3.5 h-3.5 text-gray-400 animate-pulse" />
            <span className="text-xs font-bold text-gray-700">Tài nguyên RAM</span>
          </div>
          {systemStatus?.memory ? (
            <span className="text-[11px] text-gray-500 font-bold">
              {systemStatus.memory.total - systemStatus.memory.free}MB / {systemStatus.memory.total}MB
            </span>
          ) : (
            <span className="text-xs text-gray-400">---</span>
          )}
        </div>
      </div>


      {/* Sub tabs navigation */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl max-w-md" id="settings-sub-tabs">
        <button
          onClick={() => setActiveSubTab('info')}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
            activeSubTab === 'info'
              ? 'bg-white text-gold-950 shadow-2xs border border-gold-200/20'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          id="btn-subtab-info"
        >
          <Building className="w-3.5 h-3.5 inline mr-1.5" />
          Thông tin Studio
        </button>
        <button
          onClick={() => setActiveSubTab('database')}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
            activeSubTab === 'database'
              ? 'bg-white text-gold-950 shadow-2xs border border-gold-200/20'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          id="btn-subtab-db"
        >
          <Database className="w-3.5 h-3.5 inline mr-1.5" />
          Quản lý Database
        </button>

      </div>

      {activeSubTab === 'info' && (
        /* STUDIO INFO SETTINGS PANEL */
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-gold-200/30 p-6 md:p-8 shadow-2xs"
          id="studio-info-panel"
        >
          <div className="border-b border-slate-100 pb-4 mb-6">
            <h3 className="font-semibold text-gold-950 text-base">Thông tin thương hiệu Studio</h3>
            <p className="text-xs text-slate-400 mt-0.5">Thông tin hiển thị trên báo cáo, hợp đồng, biên nhận và email khách hàng.</p>
          </div>

          {loadingSettings ? (
            <div className="py-12 flex justify-center items-center">
              <Loader2 className="w-8 h-8 animate-spin text-gold-500" />
            </div>
          ) : (
            <form onSubmit={handleSaveSettings} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tên Studio ảnh *</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <Building className="w-4 h-4 text-gold-600" />
                    </span>
                    <input
                      type="text"
                      value={settings.name}
                      onChange={e => setSettings({ ...settings, name: e.target.value })}
                      required
                      placeholder="Ví dụ: The Will Studio"
                      className="w-full text-sm border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-hidden bg-slate-50/40"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Số điện thoại liên hệ *</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <Phone className="w-4 h-4 text-gold-600" />
                    </span>
                    <input
                      type="text"
                      value={settings.phone}
                      onChange={e => setSettings({ ...settings, phone: e.target.value })}
                      required
                      placeholder="Ví dụ: 0901 234 567"
                      className="w-full text-sm border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-hidden bg-slate-50/40"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email giao dịch *</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <Mail className="w-4 h-4 text-gold-600" />
                    </span>
                    <input
                      type="email"
                      value={settings.email}
                      onChange={e => setSettings({ ...settings, email: e.target.value })}
                      required
                      placeholder="Ví dụ: contact@aurabridal.vn"
                      className="w-full text-sm border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-hidden bg-slate-50/40"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Địa chỉ trụ sở chính *</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <MapPin className="w-4 h-4 text-gold-600" />
                    </span>
                    <input
                      type="text"
                      value={settings.address}
                      onChange={e => setSettings({ ...settings, address: e.target.value })}
                      required
                      placeholder="Ví dụ: 123 Đường Ba Tháng Hai, Quận 10, TP. HCM"
                      className="w-full text-sm border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-hidden bg-slate-50/40"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Website chính thức</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <Globe className="w-4 h-4 text-gold-600" />
                    </span>
                    <input
                      type="text"
                      value={settings.website}
                      onChange={e => setSettings({ ...settings, website: e.target.value })}
                      placeholder="Ví dụ: https://aurabridal.vn"
                      className="w-full text-sm border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-hidden bg-slate-50/40"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Giờ làm việc</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <Clock className="w-4 h-4 text-gold-600" />
                    </span>
                    <input
                      type="text"
                      value={settings.opening_hours}
                      onChange={e => setSettings({ ...settings, opening_hours: e.target.value })}
                      placeholder="Ví dụ: 08:30 - 21:30"
                      className="w-full text-sm border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-hidden bg-slate-50/40"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Thông báo kỷ niệm trước (ngày)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <Calendar className="w-4 h-4 text-gold-600" />
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={settings.anniversary_reminder_days}
                      onChange={e => setSettings({ ...settings, anniversary_reminder_days: parseInt(e.target.value, 10) || 7 })}
                      placeholder="Mặc định: 7 ngày"
                      className="w-full text-sm border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-hidden bg-slate-50/40"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Mô tả ngắn / Slogan thương hiệu</label>
                <textarea
                  value={settings.notes}
                  onChange={e => setSettings({ ...settings, notes: e.target.value })}
                  placeholder="Giới thiệu nhanh về định hướng dịch vụ của studio..."
                  rows={3}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-hidden bg-slate-50/40"
                />
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-6">
                {settingsMsg && (
                  <div className={`text-xs font-semibold flex items-center gap-1.5 ${settingsMsg.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {settingsMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {settingsMsg.text}
                  </div>
                )}
                {!settingsMsg && <div />}

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl inline-flex items-center gap-2 transition-all shadow-2xs hover:shadow-xs disabled:opacity-50 uppercase tracking-wider"
                  id="btn-save-studio-info"
                >
                  {savingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Lưu thiết lập Studio
                </button>
              </div>
            </form>
          )}
        </motion.div>
      )}

      {activeSubTab === 'database' && (
        /* DATABASE MANAGEMENT & BACKUPS PANEL */
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
          id="database-panel"
        >
          {/* Quick Import/Export Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Export database block */}
            <div className="bg-white rounded-2xl border border-gold-200/30 p-6 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2.5 bg-gold-50 text-gold-600 rounded-xl border border-gold-200/40">
                    <Download className="w-5 h-5 text-gold-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gold-950 text-sm">Xuất cơ sở dữ liệu</h3>
                    <p className="text-[11px] text-slate-400">Export Database (JSON)</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Tải toàn bộ cấu trúc dữ liệu studio bao gồm: danh sách khách hàng, hợp đồng, lịch chụp và tiến độ công việc về máy cá nhân dưới dạng tệp tin JSON an toàn.
                </p>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-50">
                <button
                  onClick={handleExportDatabase}
                  className="w-full bg-gold-50 hover:bg-gold-100 border border-gold-200/40 text-gold-900 font-bold text-xs px-4 py-2.5 rounded-xl inline-flex items-center justify-center gap-1.5 transition-colors uppercase tracking-wider"
                  id="btn-export-db"
                >
                  <FileJson className="w-4 h-4 text-gold-600" />
                  Tải dữ liệu (.json)
                </button>
              </div>
            </div>

            {/* Import database block */}
            <div className="bg-white rounded-2xl border border-gold-200/30 p-6 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2.5 bg-gold-50 text-gold-600 rounded-xl border border-gold-200/40">
                    <Upload className="w-5 h-5 text-gold-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gold-950 text-sm">Nhập & Khôi phục dữ liệu</h3>
                    <p className="text-[11px] text-slate-400">Import / Upload Backup File</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Đè dữ liệu hiện tại bằng tệp tin sao lưu trước đó. <span className="text-rose-500 font-semibold">Cảnh báo:</span> Hành động này sẽ thay thế hoàn toàn cấu hình và lịch trình hiện tại của studio.
                </p>
                {importError && (
                  <p className="text-[11px] text-rose-500 font-medium mt-2 bg-rose-50 border border-rose-100 px-2 py-1 rounded">
                    {importError}
                  </p>
                )}
              </div>
              <div className="mt-5 pt-4 border-t border-slate-50">
                <label className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer uppercase tracking-wider">
                  <Upload className="w-4 h-4 text-slate-500" />
                  {importing ? 'Đang nạp file...' : 'Chọn file import (.json)'}
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportDatabase}
                    disabled={importing}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Backup Scheduler Setup */}
          <div className="bg-white rounded-2xl border border-gold-200/30 p-6 shadow-2xs">
            <div className="border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-semibold text-gold-950 text-sm">Cấu hình chu kỳ tự động sao lưu</h3>
              <p className="text-xs text-slate-400 mt-0.5">Lên lịch sao lưu cơ sở dữ liệu định kỳ dự phòng sự cố.</p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Tần suất lưu trữ dự phòng</label>
                <select
                  value={settings.backup_schedule}
                  onChange={e => setSettings({ ...settings, backup_schedule: e.target.value as any })}
                  className="text-sm border border-slate-200 rounded-xl px-3.5 py-2 focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 outline-hidden bg-slate-50/40 min-w-[200px]"
                >
                  <option value="none">Không tự động sao lưu</option>
                  <option value="daily">Hằng ngày (Daily Backup)</option>
                  <option value="weekly">Hằng tuần (Weekly Backup)</option>
                  <option value="monthly">Hằng tháng (Monthly Backup)</option>
                </select>
              </div>

              <div className="text-right sm:text-left">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lần sao lưu vật lý gần nhất</span>
                <span className="text-xs font-semibold text-slate-700 block mt-1 flex items-center justify-end sm:justify-start gap-1">
                  <Clock className="w-3.5 h-3.5 text-gold-600" />
                  {settings.last_backup_time ? new Date(settings.last_backup_time).toLocaleString('vi-VN') : 'Chưa có bản ghi'}
                </span>
              </div>

              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="bg-gold-500 hover:bg-gold-600 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all uppercase tracking-wider shrink-0"
              >
                Cập nhật lịch backup
              </button>
            </div>
          </div>

          {/* Backup History Table */}
          <div className="bg-white rounded-2xl border border-gold-200/30 shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="font-semibold text-gold-950 text-sm flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-gold-600" />
                  Nhật ký & Lịch sử sao lưu vật lý
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Các bản sao lưu được lưu trữ độc lập trên ổ đĩa máy chủ.</p>
              </div>
              <button
                onClick={handleCreateBackup}
                disabled={creatingBackup}
                className="bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl inline-flex items-center gap-1.5 transition-all uppercase tracking-wider shadow-2xs"
                id="btn-trigger-backup"
              >
                {creatingBackup ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Sao lưu thủ công ngay
              </button>
            </div>

            {backupMsg && (
              <div className={`mx-5 mt-4 p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                backupMsg.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'
              }`}>
                {backupMsg.type === 'success' ? <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" /> : <AlertTriangle className="w-4.5 h-4.5 text-rose-600" />}
                {backupMsg.text}
              </div>
            )}

            {loadingBackups ? (
              <div className="py-12 flex justify-center items-center">
                <Loader2 className="w-8 h-8 animate-spin text-gold-500" />
              </div>
            ) : backups.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Database className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
                <p className="text-xs">Chưa ghi nhận bản sao lưu vật lý nào trên máy chủ.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-5">Tên file sao lưu</th>
                      <th className="py-3 px-5">Ngày tạo</th>
                      <th className="py-3 px-5">Dung lượng</th>
                      <th className="py-3 px-5">Phương thức</th>
                      <th className="py-3 px-5">Trạng thái</th>
                      <th className="py-3 px-5 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {backups.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-5 font-mono text-[11px] text-slate-700 max-w-[200px] truncate" title={item.filename}>
                          {item.filename}
                        </td>
                        <td className="py-3.5 px-5 text-slate-500">
                          {new Date(item.created_at).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-3.5 px-5 font-medium text-slate-600">
                          {formatBytes(item.size_bytes)}
                        </td>
                        <td className="py-3.5 px-5">
                          {item.trigger_type === 'manual' ? (
                            <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded text-[10px] font-semibold">
                              Thủ công
                            </span>
                          ) : (
                            <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded text-[10px] font-semibold">
                              Hệ thống tự động
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 w-max">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                            Thành công
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right space-x-2">
                          <button
                            onClick={() => setShowRestoreConfirm(item)}
                            disabled={restoringId !== null}
                            className="bg-gold-50 hover:bg-gold-100 text-gold-900 border border-gold-200/40 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors inline-flex items-center gap-1 uppercase tracking-wide"
                          >
                            {restoringId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            Khôi phục
                          </button>
                          <button
                            onClick={() => handleDeleteBackup(item.id)}
                            disabled={deletingId !== null}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 p-1.5 rounded-lg text-xs transition-colors"
                            title="Xóa bản sao lưu"
                          >
                            {deletingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}



      {/* Restore Confirmation Modal */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="restore-confirm-modal">
          <div className="bg-white rounded-2xl border border-gold-200/30 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600 border-b border-amber-50 pb-3">
              <AlertTriangle className="w-6 h-6 text-amber-500 animate-bounce" />
              <h3 className="font-semibold text-slate-800 text-base">Xác nhận khôi phục dữ liệu?</h3>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed">
              Bạn có chắc chắn muốn khôi phục toàn bộ cơ sở dữ liệu studio về thời điểm <strong className="text-slate-800">{new Date(showRestoreConfirm.created_at).toLocaleString('vi-VN')}</strong>? 
            </p>
            <p className="text-xs text-rose-500 font-semibold bg-rose-50 p-2.5 rounded-lg border border-rose-100">
              Cảnh báo: Toàn bộ thay đổi phát sinh từ thời điểm đó đến nay sẽ bị xóa hoàn toàn và không thể thu hồi.
            </p>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowRestoreConfirm(null)}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs px-4 py-2 rounded-xl transition-colors uppercase tracking-wider"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => handleRestoreBackup(showRestoreConfirm)}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-2xs uppercase tracking-wider"
              >
                Đồng ý khôi phục
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
