import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { supabase, Attendance } from '../../lib/supabase';
import { 
  Clock, 
  Calendar, 
  MapPin, 
  CheckCircle2, 
  LogOut, 
  LogIn,
  Search,
  Filter,
  ArrowUpRight,
  UserCheck,
  XCircle,
  User,
  Trash2
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '../../lib/utils';

export default function AttendancePage() {
  const { user, profile, isDemo } = useAuth();
  const [history, setHistory] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [manualData, setManualData] = useState({
    user_id: user?.id || '',
    custom_name: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    check_in: '08:00',
    check_out: '17:00',
    status: 'present'
  });

  useEffect(() => {
    if (user?.id && !manualData.user_id) {
      setManualData(prev => ({ ...prev, user_id: user.id }));
    }
  }, [user]);

  useEffect(() => {
    async function init() {
      // Both roles need some employee data for display or selection
      await fetchEmployees();
      await fetchAttendance();
    }
    
    init();

    // Listen for cross-tab demo updates
    const handleUpdate = () => {
      fetchAttendance();
    };
    window.addEventListener('officio_data_update', handleUpdate);

    // Realtime Sync
    if (!isDemo && user) {
      const channel = supabase
        .channel('attendance-sync')
        .on('postgres_changes' as any, { 
          event: '*', 
          table: 'attendance',
          filter: profile?.role === 'admin' ? undefined : `user_id=eq.${user.id}` 
        }, () => {
          fetchAttendance();
        })
        .subscribe();
      
      return () => {
        supabase.removeChannel(channel);
        window.removeEventListener('officio_data_update', handleUpdate);
      };
    }

    return () => {
      window.removeEventListener('officio_data_update', handleUpdate);
    };
  }, [user, profile, isDemo]);

  async function fetchEmployees() {
    if (isDemo) {
      const stored = localStorage.getItem('officio_demo_employees');
      if (stored) {
        setEmployees(JSON.parse(stored).map((emp: any) => ({
          id: emp.id,
          full_name: emp.name
        })));
      } else {
        setEmployees([
          { id: 'emp-1', full_name: 'Andi Pratama' },
          { id: 'emp-2', full_name: 'Budi Santoso' },
          { id: 'emp-3', full_name: 'Citra Lestari' },
          { id: 'emp-4', full_name: 'Dedi Kurniawan' },
          { id: 'emp-5', full_name: 'Eka Putri' }
        ]);
      }
      return;
    }
    const { data } = await supabase.from('profiles').select('id, full_name');
    if (data) setEmployees(data);
  }

  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const handleManualSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;
    setIsProcessing(true);
    const safetyTimeout = setTimeout(() => setIsProcessing(false), 8000);

    const newRecord: any = {
      id: Math.random().toString(36).substr(2, 9),
      user_id: manualData.user_id,
      date: manualData.date,
      check_in: manualData.check_in + ':00',
      check_out: manualData.check_out ? manualData.check_out + ':00' : null,
      status: manualData.status,
      created_at: new Date().toISOString()
    };

    if (isDemo) {
      const stored = localStorage.getItem('officio_demo_attendance');
      const current = stored ? JSON.parse(stored) : [];
      
      // Use the actual selected user's name or custom name
      let displayName = 'Karyawan Demo';
      if (manualData.user_id === 'custom') {
        displayName = manualData.custom_name;
      } else {
        const selectedEmployee = employees.find(e => e.id === manualData.user_id);
        displayName = selectedEmployee?.full_name || (manualData.user_id === user?.id ? profile?.full_name : 'Karyawan Demo');
      }

      const recordWithProfile = {
        ...newRecord,
        profiles: { full_name: displayName }
      };

      localStorage.setItem('officio_demo_attendance', JSON.stringify([recordWithProfile, ...current]));
      new BroadcastChannel('officio_demo_sync').postMessage({ type: 'REFRESH_REQUIRED' });
      
      clearTimeout(safetyTimeout);
      setIsManualModalOpen(false);
      setIsProcessing(false);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
      
      fetchAttendance();
      return;
    }

    // For Supabase, omit ID to let DB generate UUID if it's not provided or mismatched
    const { user_id, date, check_in, check_out, status } = newRecord;
    const { error } = await supabase.from('attendance').insert({
      user_id,
      date,
      check_in,
      check_out,
      status
    });
    
    clearTimeout(safetyTimeout);
    if (!error) {
      setIsManualModalOpen(false);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
      setIsProcessing(false);
      fetchAttendance();
    } else {
      setIsProcessing(false);
    }
  };

  async function fetchAttendance() {
    if (!user) return;
    
    setLoading(true);
    
    if (isDemo) {
      const stored = localStorage.getItem('officio_demo_attendance');
      let demoData: Attendance[] = stored ? JSON.parse(stored) : [];
      
      // Filter for current user if not admin
      if (profile?.role !== 'admin') {
        demoData = demoData.filter(d => d.user_id === user.id);
      } else {
        // Mock profile names for demo if they don't have them
        demoData = demoData.map(d => {
          const row = d as any;
          if (row.profiles) return d;
          const emp = employees.find(e => e.id === d.user_id);
          return {
            ...d,
            profiles: { full_name: emp?.full_name || (d.user_id === user.id ? profile.full_name : 'Karyawan Demo') }
          };
        }) as any;
      }

      // Ensure at least some data exists for better experience
      if (demoData.length === 0 && profile?.role !== 'admin') {
         demoData = [
          { 
            id: 'mock-1', 
            user_id: user.id, 
            date: format(new Date(), 'yyyy-MM-dd'), 
            check_in: '08:00:00', 
            check_out: null, 
            status: 'present', 
            created_at: new Date().toISOString() 
          }
        ];
      }
      
      setHistory(demoData);
      const today = format(new Date(), 'yyyy-MM-dd');
      const todayRec = demoData.find(d => d.date === today && d.user_id === user.id);
      setTodayAttendance(todayRec || null);
      setLoading(false);
      return;
    }

    try {
      // Fetch today's record (always for the current user)
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: todayData } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();
      
      setTodayAttendance(todayData);

      // Fetch history (Admins see everyone, employees see self)
      let query = supabase
        .from('attendance')
        .select(`
          *,
          profiles:user_id (full_name)
        `);

      if (profile?.role === 'admin') {
        // Admin sees everything, newest first
        query = query.order('date', { ascending: false }).order('check_in', { ascending: false });
      } else {
        // Employee only sees their own
        query = query.eq('user_id', user.id).order('date', { ascending: false });
      }

      const { data, error } = await query.limit(100);

      if (!error) setHistory(data || []);
    } catch (err) {
      console.warn('Supabase not connected, using restricted mode');
    } finally {
      setLoading(false);
    }
  }

  const handleCheckIn = async () => {
    if (!user) return;
    setIsProcessing(true);
    
    const now = new Date();
    const newRecord: Attendance = {
      id: Math.random().toString(),
      user_id: user.id,
      date: format(now, 'yyyy-MM-dd'),
      check_in: format(now, 'HH:mm:ss'),
      check_out: null,
      status: now.getHours() > 9 ? 'late' : 'present',
      created_at: now.toISOString()
    };

    if (isDemo) {
      const stored = localStorage.getItem('officio_demo_attendance');
      const current = stored ? JSON.parse(stored) : [];
      
      const recordWithProfile = {
        ...newRecord,
        profiles: { full_name: profile?.full_name || 'Anda' }
      };
      
      localStorage.setItem('officio_demo_attendance', JSON.stringify([recordWithProfile, ...current]));
      
      new BroadcastChannel('officio_demo_sync').postMessage({ type: 'REFRESH_REQUIRED' });
      fetchAttendance();
      setIsProcessing(false);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
      return;
    }

    const { error } = await supabase.from('attendance').insert({
      user_id: user.id,
      date: format(now, 'yyyy-MM-dd'),
      check_in: format(now, 'HH:mm:ss'),
      status: now.getHours() > 9 ? 'late' : 'present'
    });

    if (!error) {
       await fetchAttendance();
       new BroadcastChannel('officio_demo_sync').postMessage({ type: 'REFRESH_REQUIRED' });
       setShowSuccessToast(true);
       setTimeout(() => setShowSuccessToast(false), 3000);
    }
    setIsProcessing(false);
  };

  const handleCheckOut = async () => {
    if (!user || !todayAttendance) return;
    setIsProcessing(true);
    const now = new Date();

    if (isDemo) {
      const updatedRecord = { ...todayAttendance, check_out: format(now, 'HH:mm:ss') };
      
      const stored = localStorage.getItem('officio_demo_attendance');
      const current: Attendance[] = stored ? JSON.parse(stored) : [];
      const updated = current.map(r => r.id === todayAttendance.id ? updatedRecord : r);
      localStorage.setItem('officio_demo_attendance', JSON.stringify(updated));

      new BroadcastChannel('officio_demo_sync').postMessage({ type: 'REFRESH_REQUIRED' });
      await fetchAttendance();
      setIsProcessing(false);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
      return;
    }

    const { error } = await supabase
      .from('attendance')
      .update({ check_out: format(now, 'HH:mm:ss') })
      .eq('id', todayAttendance.id);

    if (!error) {
      await fetchAttendance();
      new BroadcastChannel('officio_demo_sync').postMessage({ type: 'REFRESH_REQUIRED' });
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    }
    setIsProcessing(false);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    setIsProcessing(true);

    if (isDemo) {
      const stored = localStorage.getItem('officio_demo_attendance');
      const current: Attendance[] = stored ? JSON.parse(stored) : [];
      const updated = current.filter(r => r.id !== deletingId);
      localStorage.setItem('officio_demo_attendance', JSON.stringify(updated));
      
      new BroadcastChannel('officio_demo_sync').postMessage({ type: 'REFRESH_REQUIRED' });
      setDeletingId(null);
      setIsProcessing(false);
      fetchAttendance();
      return;
    }

    try {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('id', deletingId);
      
      if (error) throw error;
      setDeletingId(null);
      fetchAttendance();
    } catch (err) {
      console.error('Error deleting attendance:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Manual Attendance Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-office-border flex justify-between items-center bg-office-gray">
              <h2 className="text-xl font-black text-office-slate-800 uppercase tracking-tight">Input Absensi Manual</h2>
              <button onClick={() => setIsManualModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <XCircle size={24} />
              </button>
            </div>
            
            <form onSubmit={handleManualSubmit} className="p-8 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Pilih Karyawan</label>
                <div className="space-y-3">
                  <select 
                    required
                    value={manualData.user_id}
                    onChange={e => setManualData({...manualData, user_id: e.target.value})}
                    className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500 transition-all"
                  >
                    <option value="">Pilih Karyawan...</option>
                    <option value={user?.id}>Saya Sendiri ({profile?.full_name})</option>
                    {profile?.role === 'admin' && employees.filter(emp => emp.id !== user?.id).map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                    ))}
                    <option value="custom">+ Ketik Nama Manual...</option>
                  </select>

                  {manualData.user_id === 'custom' && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <input 
                        type="text"
                        required
                        placeholder="Masukkan Nama Lengkap..."
                        value={manualData.custom_name}
                        onChange={e => setManualData({...manualData, custom_name: e.target.value})}
                        className="w-full bg-white border-2 border-brand-100 rounded-xl p-4 text-sm font-bold focus:border-brand-500 focus:ring-0 outline-none placeholder:text-slate-400 shadow-sm transition-all"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Tanggal Absensi</label>
                <input 
                  required
                  type="date"
                  value={manualData.date}
                  onChange={e => setManualData({...manualData, date: e.target.value})}
                  className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Jam Masuk</label>
                  <input 
                    required
                    type="time"
                    value={manualData.check_in}
                    onChange={e => setManualData({...manualData, check_in: e.target.value})}
                    className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Jam Pulang</label>
                  <input 
                    type="time"
                    value={manualData.check_out}
                    onChange={e => setManualData({...manualData, check_out: e.target.value})}
                    className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Status Kehadiran</label>
                <div className="grid grid-cols-3 gap-3">
                  {['present', 'late', 'absent'].map(status => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setManualData({...manualData, status})}
                      className={cn(
                        "py-3 px-2 rounded-xl text-[10px] font-bold uppercase tracking-tight transition-all border-2",
                        manualData.status === status 
                          ? "bg-brand-50 border-brand-500 text-brand-600" 
                          : "bg-white border-transparent text-slate-400 hover:bg-slate-50"
                      )}
                    >
                      {status === 'present' ? 'Hadir' : status === 'late' ? 'Telat' : 'Absen'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="flex-1 px-6 py-4 rounded-2xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors uppercase tracking-tight text-xs"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={isProcessing}
                  className="flex-3 px-6 py-4 rounded-2xl font-bold bg-brand-600 text-white hover:bg-brand-700 transition-all shadow-lg shadow-brand-100 uppercase tracking-tight text-xs disabled:opacity-50"
                >
                  {isProcessing ? 'Memproses...' : 'Simpan Absensi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-office-slate-800 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-white/10">
            <CheckCircle2 className="h-5 w-5 text-green-400" />
            <span className="text-sm font-bold">Data absensi berhasil disimpan!</span>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Absensi Karyawan</h1>
          <p className="text-gray-500 font-medium tracking-tight">Mencatat waktu kehadiran dan kepulangan Anda secara digital.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={() => {
                setManualData(prev => ({ ...prev, user_id: user?.id || '' }));
                setIsManualModalOpen(true);
              }}
              className="flex items-center gap-2 bg-office-slate-800 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-black transition-all shadow-lg active:scale-95"
            >
              <UserCheck className="h-4 w-4" />
              <span className="text-sm tracking-tight font-black uppercase">Input Manual</span>
            </button>
           <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-office-border shadow-sm">
            <Calendar className="h-4 w-4 text-brand-600" />
            <span className="font-bold text-sm text-gray-700">{format(new Date(), "dd MMMM yyyy", { locale: id })}</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Check In/Out Widget */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl p-8 border border-office-border shadow-sm flex flex-col items-center text-center sticky top-8">
            <div className="w-24 h-24 rounded-full bg-brand-50 flex items-center justify-center mb-6">
              <Clock className="h-10 w-10 text-brand-600" />
            </div>
            <div className="text-5xl font-black text-gray-900 mb-2 leading-none">
              {format(new Date(), 'HH:mm')}
            </div>
            <div className="text-brand-600 font-bold text-sm uppercase tracking-widest mb-8">
              Waktu Lokal Indonesia
            </div>

            <div className="w-full space-y-4">
              {!todayAttendance ? (
                <button 
                  onClick={handleCheckIn}
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center gap-3 bg-brand-600 text-white py-5 rounded-2xl font-bold text-lg hover:bg-brand-700 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-brand-100 disabled:opacity-70"
                >
                  {isProcessing ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-white/20 border-t-white"></div>
                  ) : (
                    <>
                      <LogIn className="h-6 w-6" />
                      Masuk Sekarang
                    </>
                  )}
                </button>
              ) : todayAttendance.check_out ? (
                <div className="p-6 bg-green-50 rounded-2xl flex flex-col items-center gap-2 border border-green-100 animate-in fade-in zoom-in duration-300">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                  <p className="text-gray-900 font-bold">Terima Kasih!</p>
                  <p className="text-gray-500 text-sm">Absensi hari ini selesai.</p>
                </div>
              ) : (
                <button 
                  onClick={handleCheckOut}
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center gap-3 bg-rose-600 text-white py-5 rounded-2xl font-bold text-lg hover:bg-rose-700 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-rose-100 disabled:opacity-70"
                >
                  {isProcessing ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-white/20 border-t-white"></div>
                  ) : (
                    <>
                      <LogOut className="h-6 w-6" />
                      Absen Pulang
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="mt-10 pt-8 border-t border-office-border w-full grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Ceking In</p>
                <p className="text-lg font-black text-gray-900">{todayAttendance?.check_in || '--:--'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Ceking Out</p>
                <p className="text-lg font-black text-gray-900">{todayAttendance?.check_out || '--:--'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Attendance History */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-office-border shadow-sm overflow-hidden text-sm">
            <div className="p-8 border-b border-office-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                Riwayat Kehadiran
                <span className="bg-brand-50 text-brand-600 text-xs px-3 py-1 rounded-full">{history.length} Hari Terakhir</span>
              </h2>
              <div className="flex gap-2">
                <button className="p-2 border border-office-border rounded-lg hover:bg-gray-50 transition-colors">
                  <Search className="h-5 w-5 text-gray-400" />
                </button>
                <button className="flex items-center gap-2 px-4 py-2 border border-office-border rounded-lg hover:bg-gray-50 transition-colors font-bold text-gray-600">
                  <Filter className="h-4 w-4" /> Filter
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-office-gray">
                    <th className="px-8 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Tanggal</th>
                    <th className="px-8 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Masuk</th>
                    <th className="px-8 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Pulang</th>
                    <th className="px-8 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Status</th>
                    <th className="px-8 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-office-border">
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={5} className="px-8 py-6 h-16 bg-gray-50/50"></td>
                      </tr>
                    ))
                  ) : history.length > 0 ? (
                    history.map((record: any) => (
                      <tr key={record.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-8 py-5">
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900">{format(new Date(record.date), 'dd MMM yyyy', { locale: id })}</span>
                            {profile?.role === 'admin' && record.profiles?.full_name && (
                              <span className="text-[10px] text-brand-600 font-bold uppercase tracking-tight">{record.profiles.full_name}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <span className="flex items-center gap-2 font-medium text-gray-600">
                            <Clock className="h-4 w-4 text-brand-400" />
                            {record.check_in || '-'}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <span className="flex items-center gap-2 font-medium text-gray-600">
                            <Clock className="h-4 w-4 text-rose-400" />
                            {record.check_out || '-'}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold",
                            record.status === 'present' ? "bg-green-100 text-green-700" :
                            record.status === 'late' ? "bg-amber-100 text-amber-700" :
                            "bg-rose-100 text-rose-700"
                          )}>
                            <div className={cn("w-1.5 h-1.5 rounded-full",
                              record.status === 'present' ? "bg-green-500" :
                              record.status === 'late' ? "bg-amber-500" :
                              "bg-rose-500"
                            )}></div>
                            {record.status === 'present' ? 'Hadir Tepat Waktu' : record.status === 'late' ? 'Terlambat' : 'Absen'}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex justify-end gap-2">
                            {profile?.role === 'admin' && (
                              <button 
                                onClick={() => setDeletingId(record.id)}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                title="Hapus Absensi"
                              >
                                <Trash2 size={18} />
                              </button>
                            )}
                            <button className="text-gray-400 hover:text-brand-600">
                              <ArrowUpRight className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-8 py-12 text-center text-gray-500">
                        Belum ada riwayat absensi.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="p-6 bg-office-gray/50 border-t border-office-border text-center">
               <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pencatatan Berdasarkan Lokasi Perangkat & Waktu Server</p>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-sm shadow-2xl p-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center">
                <Trash2 size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight">Hapus Absensi?</h3>
                <p className="text-sm font-medium text-gray-500 mt-2">
                  Tindakan ini tidak dapat dibatalkan. Apakah Anda yakin ingin menghapus data absensi ini?
                </p>
              </div>
              <div className="flex w-full gap-3 mt-6">
                <button 
                  onClick={() => setDeletingId(null)}
                  className="flex-1 bg-office-gray text-slate-700 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-tight text-xs"
                >
                  Batal
                </button>
                <button 
                  onClick={confirmDelete}
                  disabled={isProcessing}
                  className="flex-1 bg-rose-600 text-white font-bold py-4 rounded-2xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 uppercase tracking-tight text-xs disabled:opacity-50"
                >
                  {isProcessing ? '...' : 'Hapus'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
