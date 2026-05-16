import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { supabase, Attendance } from '../../lib/supabase';
import { 
  FileText,
  Users, 
  MapPin, 
  Clock, 
  Calendar,
  Package,
  CheckCircle2,
  AlertCircle,
  XCircle,
  TrendingUp,
  ArrowRight,
  Zap,
  Building2
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '../../lib/utils';

export default function Dashboard() {
  const { profile, user, isDemo } = useAuth();
  const [stats, setStats] = useState({
    attendanceToday: 0,
    activeMeetings: 0,
    pendingLeaves: 0,
    inventoryAlerts: 0
  });
  const [activities, setActivities] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Action Note State
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteType, setNoteType] = useState<'approved' | 'rejected' | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState('');

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      
      if (isDemo) {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const storedAtt = localStorage.getItem('officio_demo_attendance');
        const demoAtt: Attendance[] = storedAtt ? JSON.parse(storedAtt) : [];
        
        const storedLeaves = localStorage.getItem('officio_demo_leaves');
        const demoLeaves = storedLeaves ? JSON.parse(storedLeaves) : [];

        const storedMeetings = localStorage.getItem('officio_demo_meetings');
        const demoMeetings: any[] = storedMeetings ? JSON.parse(storedMeetings) : [];

        const todayCount = demoAtt.filter(a => a.date === todayStr).length;
        const pendingCount = demoLeaves.filter((l: any) => l.status === 'pending').length;
        const todayMeetings = demoMeetings.filter(m => m.start_time.startsWith(todayStr));

        // Mock stats based on real demo data
        setStats({
          attendanceToday: todayCount || (demoAtt.length > 0 ? 0 : 12),
          activeMeetings: todayMeetings.length,
          pendingLeaves: pendingCount,
          inventoryAlerts: 1
        });

        setMeetings(todayMeetings.slice(0, 3).map(m => ({
          ...m,
          time: m.start_time.substring(11, 16),
          room: m.room_id === '1' ? 'Toba' : m.room_id === '2' ? 'Semeru' : m.room_id === '3' ? 'Rinjani' : 'Virtual',
          color: m.room_id === '1' ? 'bg-brand-500' : m.room_id === '2' ? 'bg-blue-500' : 'bg-purple-500'
        })));

        const latestAtt = demoAtt.slice(0, 8).map(a => ({
          name: (a as any).profiles?.full_name || (a.user_id === user.id ? (profile?.full_name || 'Anda') : 'Karyawan Demo'),
          time: a.check_in?.substring(0, 5) || '--:--',
          action: a.status === 'late' ? 'Absen Masuk (Telat)' : a.status === 'absent' ? 'Izin/Alpa' : 'Absen Masuk (Tepat Waktu)',
          type: a.status === 'late' ? 'late' : a.status === 'absent' ? 'leave' : 'attendance'
        }));

        const mockActs = [
          ...latestAtt,
          { name: 'Sistem', time: format(new Date(), 'HH:mm'), action: 'Mode Demo: Menggunakan Data Lokal', type: 'inventory' },
        ];
        
        if (profile?.role === 'admin') {
          setActivities(mockActs);
          setPendingApprovals(demoLeaves.filter((l: any) => l.status === 'pending').map((p: any) => ({
            id: p.id,
            user: p.profiles?.full_name || (p.user_id === user.id ? profile.full_name : 'Karyawan Demo'),
            type: p.type === 'cuti' ? 'Cuti Tahunan' : 'Izin Sakit',
            reason: p.reason,
            time: 'Baru Saja'
          })));
        }
        
        // Employee today record
        if (profile?.role === 'employee') {
          const myToday = demoAtt.find(a => a.date === todayStr && a.user_id === user.id);
          setTodayAttendance(myToday || null);
        }

        setLoading(false);
        return;
      }

      try {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        
        const fetchPromise = Promise.all([
          supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('date', todayStr),
          supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          profile?.role === 'employee' ? supabase.from('attendance').select('*').eq('user_id', user.id).eq('date', todayStr).maybeSingle() : Promise.resolve({ data: null }),
          profile?.role === 'admin' ? supabase.from('attendance').select('*, profiles(full_name)').order('created_at', { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
          profile?.role === 'admin' ? supabase.from('leave_requests').select('*, profiles(full_name)').eq('status', 'pending').order('created_at', { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
          supabase.from('meetings').select('*, rooms(name)').gte('start_time', todayStr + 'T00:00:00').lte('start_time', todayStr + 'T23:59:59').limit(3)
        ]);

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Fetch timeout')), 4000)
        );

        const [attCount, leaveCount, myAtt, recentAtt, pending, todayMeets] = await Promise.race([fetchPromise, timeoutPromise]) as any;

        setStats({
          attendanceToday: attCount.count || 0,
          activeMeetings: todayMeets.data?.length || 0,
          pendingLeaves: leaveCount.count || 0,
          inventoryAlerts: 2
        });

        if (todayMeets.data) {
          setMeetings(todayMeets.data.map((m: any) => ({
            ...m,
            time: format(new Date(m.start_time), 'HH:mm'),
            room: m.rooms?.name || 'TBA',
            color: 'bg-brand-500'
          })));
        }

        if (myAtt?.data) setTodayAttendance(myAtt.data);

        if (recentAtt?.data) {
          setActivities(recentAtt.data.map((a: any) => ({
            name: a.profiles?.full_name || 'Karyawan',
            time: format(new Date(a.created_at), 'HH:mm'),
            action: a.status === 'late' ? 'Absen Masuk (Telat)' : 'Absen Masuk (Tepat Waktu)',
            type: a.status === 'late' ? 'late' : 'attendance'
          })));
        }

        if (pending?.data) {
          setPendingApprovals(pending.data.map((p: any) => ({
            id: p.id,
            user: p.profiles?.full_name || 'Karyawan',
            type: p.type === 'cuti' ? 'Cuti Tahunan' : 'Izin Sakit',
            reason: p.reason,
            time: format(new Date(p.created_at), 'HH:mm')
          })));
        }
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    // Listen for cross-tab demo updates
    const demoSyncChannel = new BroadcastChannel('officio_demo_sync');
    demoSyncChannel.onmessage = (event) => {
      if (['REFRESH_REQUIRED', 'REFRESH_MEETINGS', 'REFRESH_EMPLOYEES'].includes(event.data?.type)) {
        fetchData();
      }
    };

    const handleUpdate = () => {
      fetchData();
    };
    window.addEventListener('officio_data_update', handleUpdate);

    let dashboardChannel: any = null;

    // Realtime Subscriptions
    if (!isDemo && profile?.role === 'admin') {
      dashboardChannel = supabase
        .channel('dashboard-monitor')
        .on('postgres_changes' as any, { event: 'INSERT', table: 'attendance' }, () => {
          fetchData();
        })
        .on('postgres_changes' as any, { event: 'INSERT', table: 'leave_requests' }, () => {
          fetchData();
        })
        .on('postgres_changes' as any, { event: 'UPDATE', table: 'leave_requests' }, () => {
          fetchData();
        })
        .on('postgres_changes' as any, { event: '*', table: 'meetings' }, () => {
          fetchData();
        })
        .subscribe();
    }

    return () => {
      window.removeEventListener('officio_data_update', handleUpdate);
      demoSyncChannel.close();
      if (dashboardChannel) {
        supabase.removeChannel(dashboardChannel);
      }
    };
  }, [profile, user, isDemo]);

  const handleQuickAction = async (id: string, status: 'approved' | 'rejected', note?: string) => {
    if (isDemo) {
      const stored = localStorage.getItem('officio_demo_leaves');
      const current: any[] = stored ? JSON.parse(stored) : [];
      const updated = current.map(r => r.id === id ? { ...r, status, admin_note: note } : r);
      localStorage.setItem('officio_demo_leaves', JSON.stringify(updated));
      
      new BroadcastChannel('officio_demo_sync').postMessage({ type: 'REFRESH_REQUIRED' });
      
      // Update local state temporarily for immediate feedback
      setPendingApprovals(prev => prev.filter(a => a.id !== id));
      setStats(prev => ({ ...prev, pendingLeaves: Math.max(0, prev.pendingLeaves - 1) }));
      return;
    }

    try {
      await supabase.from('leave_requests').update({ status, admin_note: note }).eq('id', id);
      // Realtime will trigger refresh
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return (
    <div className="space-y-8 animate-pulse">
      <div className="h-44 bg-slate-100 rounded-[2.5rem] border border-slate-200"></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-slate-100 rounded-3xl border border-slate-200"></div>)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 h-64 bg-slate-50 rounded-3xl border border-slate-100"></div>
        <div className="h-64 bg-slate-50 rounded-3xl border border-slate-100"></div>
      </div>
    </div>
  );

  const isAdmin = profile?.role === 'admin';

  return (
    <div className="space-y-8">
      {/* Note Action Modal (Dashboard Quick Action) */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className={`p-6 border-b border-office-border flex justify-between items-center ${noteType === 'approved' ? 'bg-green-50' : 'bg-rose-50'}`}>
              <h2 className={`text-lg font-black uppercase tracking-tight ${noteType === 'approved' ? 'text-green-600' : 'text-rose-600'}`}>
                {noteType === 'approved' ? 'Setujui Pengajuan' : 'Tolak Pengajuan'}
              </h2>
              <button 
                onClick={() => {
                  setIsNoteModalOpen(false);
                  setPendingActionId(null);
                  setNoteType(null);
                  setNoteContent('');
                }} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Catatan Admin (Opsional)</label>
                <textarea 
                  rows={4}
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                  className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500 transition-all text-slate-900"
                  placeholder={noteType === 'approved' ? "Contoh: Selamat berlibur!" : "Contoh: Mohon maaf, ada deadline."}
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  onClick={() => {
                    setIsNoteModalOpen(false);
                    setPendingActionId(null);
                    setNoteType(null);
                    setNoteContent('');
                  }}
                  className="flex-1 px-4 py-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors uppercase tracking-tight text-xs"
                >
                  Batal
                </button>
                <button 
                  onClick={() => {
                    if (pendingActionId && noteType) {
                      handleQuickAction(pendingActionId, noteType, noteContent.trim());
                      setIsNoteModalOpen(false);
                      setPendingActionId(null);
                      setNoteType(null);
                      setNoteContent('');
                    }
                  }}
                  className={`flex-2 px-4 py-3 rounded-xl font-bold text-white transition-all shadow-lg uppercase tracking-tight text-xs
                    ${noteType === 'approved' ? 'bg-green-600 shadow-green-100 hover:bg-green-700' : 'bg-rose-600 shadow-rose-100 hover:bg-rose-700'}`}
                >
                  Konfirmasi {noteType === 'approved' ? 'Setujui' : 'Tolak'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header & Role Badge */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight leading-none mb-3">
            Halo, {profile?.full_name?.split(' ')[0]}!
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-gray-500 font-bold text-sm bg-slate-50 px-3 py-1 rounded-lg">
              {format(new Date(), "EEEE, d MMMM yyyy", { locale: id })}
            </p>
            <span className={cn(
              "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
              isAdmin ? "bg-amber-100 text-amber-700" : "bg-brand-100 text-brand-700"
            )}>
              {isAdmin ? 'Administrator' : 'Karyawan'}
            </span>
            {isAdmin && (
              <span className={cn(
                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5",
                isDemo ? "bg-slate-100 text-slate-500" : "bg-green-100 text-green-700"
              )}>
                <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isDemo ? "bg-slate-400" : "bg-green-500")}></div>
                {isDemo ? 'Mode Demo' : 'Realtime Aktif'}
              </span>
            )}
          </div>
        </div>
        
        <div className="relative z-10 flex items-center gap-4">
          {!isAdmin && (
            <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div className={cn(
                  "w-3 h-3 rounded-full animate-pulse",
                  todayAttendance ? "bg-green-500" : "bg-rose-500"
                )}></div>
                <span className="text-[13px] font-black text-slate-600 uppercase tracking-tight">
                  {todayAttendance ? 'Sudah Absen' : 'Belum Absen'}
                </span>
            </div>
          )}
          <div className="hidden lg:flex h-12 w-12 rounded-2xl bg-brand-600 items-center justify-center text-white shadow-lg shadow-brand-200">
             <Zap size={24} fill="currentColor" />
          </div>
        </div>

        {/* Decorative background element */}
        <div className="absolute right-0 top-0 w-32 h-32 bg-brand-50 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl opacity-50"></div>
        <Building2 size={120} className="absolute -right-4 -bottom-6 text-slate-50 opacity-40 rotate-12" />
      </div>

      {isAdmin ? (
        /* ================= ADMIN VIEW ================= */
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard label="Kehadiran Hari Ini" value={stats.attendanceToday} subtitle="89% dari 128 Staff" color="slate" icon={Users} />
            <StatCard label="Cuti Menunggu" value={stats.pendingLeaves} subtitle="Membutuhkan Persetujuan" color="amber" icon={FileText} />
            <StatCard label="Ruang Rapat" value={stats.activeMeetings} subtitle="3 Meeting Berjalan" color="blue" icon={Calendar} />
            <StatCard label="Aset/Inventaris" value="98%" subtitle="Kondisi Baik" color="green" icon={CheckCircle2} />
          </div>

          {/* New Shortcut Navigation - The "7 Parts" */}
          <div className="space-y-6">
            <h2 className="text-[15px] font-black text-slate-800 uppercase tracking-widest">Akses Cepat (7 Bagian)</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
              <ShortcutButton icon={Clock} label="Absensi" link="/app/attendance" color="bg-amber-50 text-amber-600" />
              <ShortcutButton icon={Calendar} label="Meeting" link="/app/meetings" color="bg-blue-50 text-blue-600" />
              <ShortcutButton icon={Package} label="Inventaris" link="/app/inventory" color="bg-brand-50 text-brand-600" />
              <ShortcutButton icon={FileText} label="Cuti" link="/app/leave" color="bg-purple-50 text-purple-600" />
              <ShortcutButton icon={TrendingUp} label="Laporan" link="/app/reports" color="bg-indigo-50 text-indigo-600" />
              <ShortcutButton icon={Users} label="Karyawan" link="/app/employees" color="bg-slate-50 text-slate-600" />
              <ShortcutButton icon={Building2} label="Profil" link="/app/profile" color="bg-rose-50 text-rose-600" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <SectionHeader title="Aktivitas Perusahaan" link="/app/attendance" />
              <div className="bg-white rounded-3xl border border-office-border overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {activities.map((act, i) => (
                    <div key={i} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors animate-in fade-in slide-in-from-top duration-300">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs uppercase",
                          act.type === 'attendance' ? "bg-green-50 text-green-600" :
                          act.type === 'late' ? "bg-rose-50 text-rose-600" :
                          act.type === 'leave' ? "bg-amber-50 text-amber-600" :
                          "bg-blue-50 text-blue-600"
                        )}>
                          {act.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-office-slate-800">{act.name}</p>
                          <p className="text-[12px] text-slate-400">{act.action}</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase">{act.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <SectionHeader title="Persetujuan Cepat" link="/app/leave" />
              <div className="bg-office-slate-800 rounded-3xl p-6 text-white space-y-6">
                <div>
                   <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-1">Total Menunggu</p>
                   <p className="text-3xl font-black">{stats.pendingLeaves}</p>
                </div>
                <div className="space-y-3">
                   {pendingApprovals.map((app, i) => (
                     <div key={app.id} className="bg-white/10 rounded-2xl p-4 space-y-3 animate-in fade-in slide-in-from-right duration-300">
                        <div className="flex justify-between items-center text-[11px] font-bold text-white/60">
                           <span>PENGAJUAN #{app.id}</span>
                           <span>{app.time}</span>
                        </div>
                        <p className="text-sm font-bold">{app.user}</p>
                        <p className="text-xs text-white/70">{app.type}</p>
                        <div className="flex gap-2 pt-1">
                           <button 
                             onClick={() => {
                               setPendingActionId(app.id);
                               setNoteType('approved');
                               setIsNoteModalOpen(true);
                             }}
                             className="flex-1 bg-white text-office-slate-800 rounded-lg py-2 text-[10px] font-black uppercase hover:bg-slate-100 transition-colors"
                           >
                             Setujui
                           </button>
                           <button 
                             onClick={() => {
                               setPendingActionId(app.id);
                               setNoteType('rejected');
                               setIsNoteModalOpen(true);
                             }}
                             className="flex-1 border border-white/20 rounded-lg py-2 text-[10px] font-black uppercase hover:bg-white/5 transition-colors"
                           >
                             Tolak
                           </button>
                        </div>
                     </div>
                   ))}
                </div>
                <Link to="/app/leave" className="block text-center text-xs font-bold text-brand-400 hover:text-brand-300 transition-colors uppercase tracking-widest pt-2">
                   Lihat Semua Antrean →
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ================= EMPLOYEE VIEW ================= */
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Shortcut Navigation - The "6 Parts" */}
          <div className="space-y-6">
            <h2 className="text-[15px] font-black text-slate-800 uppercase tracking-widest">Akses Cepat (6 Bagian)</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <ShortcutButton icon={Clock} label="Absensi" link="/app/attendance" color="bg-amber-50 text-amber-600" />
              <ShortcutButton icon={Calendar} label="Meeting" link="/app/meetings" color="bg-blue-50 text-blue-600" />
              <ShortcutButton icon={Package} label="Inventaris" link="/app/inventory" color="bg-brand-50 text-brand-600" />
              <ShortcutButton icon={FileText} label="Cuti" link="/app/leave" color="bg-purple-50 text-purple-600" />
              <ShortcutButton icon={TrendingUp} label="Laporan" link="/app/reports" color="bg-indigo-50 text-indigo-600" />
              <ShortcutButton icon={Building2} label="Profil" link="/app/profile" color="bg-rose-50 text-rose-600" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* My Status Column */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-3xl border-2 border-slate-100 p-8 shadow-sm relative overflow-hidden">
                <div className="relative z-10 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center">
                       <Clock className="text-brand-600 h-8 w-8" />
                    </div>
                    <div>
                       <h3 className="text-xl font-black text-office-slate-800 leading-tight">Absensi Harian</h3>
                       <p className="text-slate-400 text-sm font-medium">Jam kerja Shift Pagi</p>
                    </div>
                  </div>

                  {!todayAttendance ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3">
                         <AlertCircle className="text-amber-500 h-5 w-5 shrink-0 mt-0.5" />
                         <p className="text-xs font-bold text-amber-700 leading-relaxed uppercase tracking-tight">
                           Anda belum melakukan absensi masuk hari ini.
                         </p>
                      </div>
                      <Link to="/app/attendance" className="block text-center bg-brand-600 text-white font-black py-5 rounded-2xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-100 uppercase tracking-widest text-sm">
                         Masuk Sekarang
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-6 bg-green-50 rounded-2xl border border-green-100 text-center">
                         <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Check In Sukses</p>
                         <p className="text-3xl font-black text-office-slate-800 leading-none">{todayAttendance.check_in.substring(0, 5)}</p>
                         <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-wide">Selamat Bekerja!</p>
                      </div>
                      {!todayAttendance.check_out && (
                        <Link to="/app/attendance" className="block text-center bg-rose-600 text-white font-black py-5 rounded-2xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 uppercase tracking-widest text-sm">
                           Absen Pulang
                        </Link>
                      )}
                    </div>
                  )}
                </div>
                <div className="absolute -right-8 -bottom-8 opacity-[0.03] rotate-12">
                   <Clock size={200} />
                </div>
              </div>

              <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                 <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Ringkasan Anda</h4>
                 <div className="grid grid-cols-2 gap-4">
                   <div className="bg-white p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Sisa Cuti</p>
                      <p className="text-2xl font-black text-office-slate-800">12</p>
                      <p className="text-[9px] font-bold text-brand-600 uppercase mt-1">Hari</p>
                   </div>
                   <div className="bg-white p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Meeting</p>
                      <p className="text-2xl font-black text-office-slate-800">3</p>
                      <p className="text-[9px] font-bold text-blue-500 uppercase mt-1">Hari Ini</p>
                   </div>
                 </div>
              </div>
            </div>

            {/* Schedule & Feed Column */}
            <div className="lg:col-span-2 space-y-8">
              <div className="space-y-4">
                <SectionHeader title="Jadwal Meeting Anda" link="/app/meetings" />
                <div className="space-y-4">
                  {meetings.map((item, i) => (
                    <div key={i} className="group bg-white p-5 rounded-3xl border border-slate-100 hover:border-slate-200 transition-all flex items-center gap-6">
                      <div className="text-center w-14">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-0.5">Mulai</p>
                        <p className="text-lg font-black text-office-slate-800 leading-none">{item.time}</p>
                      </div>
                      <div className={cn("w-1 h-10 rounded-full", item.color || 'bg-brand-500')}></div>
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900 group-hover:text-brand-600 transition-colors uppercase tracking-tight text-sm">{item.title}</h4>
                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1 flex items-center gap-1.5">
                           <MapPin size={10} className="text-slate-300" />
                           Ruangan {item.room}
                        </p>
                      </div>
                      <ArrowRight size={18} className="text-slate-200 group-hover:text-brand-400 group-hover:translate-x-1 transition-all" />
                    </div>
                  ))}
                  {meetings.length === 0 && (
                    <div className="bg-slate-50 border border-dashed border-slate-200 p-8 rounded-3xl text-center">
                       <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                       <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tak ada jadwal pertemuan hari ini</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-office-slate-800 rounded-3xl p-8 text-white relative shadow-2xl shadow-slate-200 overflow-hidden">
                <div className="relative z-10">
                   <h3 className="text-xl font-black uppercase tracking-tight mb-2">Pengumuman Internal</h3>
                   <div className="w-12 h-1.5 bg-brand-500 rounded-full mb-6"></div>
                   <p className="text-white/70 text-sm leading-relaxed mb-6 font-medium">
                     Jangan lupa untuk memperbarui data inventaris Anda di ruangan masing-masing untuk audit kuartal ini. Batas waktu pelaporan adalah hari Jumat ini.
                   </p>
                   <button className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-brand-400 hover:text-white transition-colors">
                      Baca Selengkapnya <TrendingUp size={14} />
                   </button>
                </div>
                <TrendingUp size={160} className="absolute -right-8 -bottom-12 text-white/[0.03] rotate-[-15deg]" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, link }: { title: string, link: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-[15px] font-black text-slate-800 uppercase tracking-widest">{title}</h2>
      <Link to={link} className="text-[11px] font-black text-brand-600 hover:text-brand-700 transition-colors flex items-center gap-1 uppercase tracking-tight group">
        Lihat Semua <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  );
}

function ShortcutButton({ icon: Icon, label, link, color }: any) {
  return (
    <Link 
      to={link}
      className="bg-white p-4 rounded-3xl border border-office-border flex flex-col items-center justify-center gap-3 hover:shadow-xl hover:shadow-slate-100 hover:border-brand-100 transition-all group"
    >
      <div className={cn("p-4 rounded-2xl group-hover:scale-110 transition-transform", color)}>
        <Icon size={24} />
      </div>
      <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{label}</span>
    </Link>
  );
}

function StatCard({ label, value, subtitle, color, icon: Icon }: any) {
  const accentColors: any = {
    green: 'bg-green-50 text-green-600',
    slate: 'bg-slate-50 text-slate-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  const textColors: any = {
    green: 'text-green-600',
    slate: 'text-slate-400',
    blue: 'text-brand-500',
    amber: 'text-amber-600',
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-office-border flex flex-col justify-between group hover:shadow-xl hover:shadow-slate-100 hover:border-brand-100 transition-all duration-300">
      <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", accentColors[color])}>
        <Icon size={20} />
      </div>
      <div>
        <div className="text-slate-400 text-[10px] font-black mb-1 uppercase tracking-[0.15em]">{label}</div>
        <div className="text-3xl font-black text-office-slate-800 leading-none">{value}</div>
        <div className={cn("text-[10px] font-bold mt-2 uppercase tracking-tight", textColors[color])}>
          {subtitle}
        </div>
      </div>
    </div>
  );
}
