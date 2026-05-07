import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { supabase, MeetingRoom, Meeting } from '../../lib/supabase';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Plus,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Video,
  Edit2,
  Trash2
} from 'lucide-react';
import { format, isWithinInterval, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '../../lib/utils';

export default function MeetingsPage() {
  const { profile, isDemo, user } = useAuth();
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    title: '',
    room_id: '',
    start_time: '',
    end_time: '',
    description: ''
  });

  useEffect(() => {
    fetchData();

    const handleSync = (event: MessageEvent) => {
      if (event.data?.type === 'REFRESH_MEETINGS') {
        fetchData();
      }
    };

    const channel = new BroadcastChannel('officio_demo_sync');
    channel.onmessage = handleSync;

    // Realtime Sync for production
    let supabaseChannel: any = null;
    if (!isDemo && user) {
      supabaseChannel = supabase
        .channel('meetings-sync')
        .on('postgres_changes' as any, { event: '*', table: 'meetings' }, () => {
          fetchData();
        })
        .subscribe();
    }

    return () => {
      channel.close();
      if (supabaseChannel) {
        supabase.removeChannel(supabaseChannel);
      }
    };
  }, [user, isDemo]);

  async function fetchData() {
    setLoading(true);
    
    // Static rooms
    const mockRooms = [
      { id: '1', name: 'Ruang Toba', location: 'Lantai 1, Ruang 102', capacity: 12 },
      { id: '2', name: 'Ruang Semeru', location: 'Lantai 2, Ruang 205', capacity: 8 },
      { id: '3', name: 'Ruang Rinjani', location: 'Lantai 2, Ruang 208', capacity: 20 },
      { id: '4', name: 'Virtual Room', location: 'Google Meet', capacity: 100 },
    ];
    setRooms(mockRooms);

    if (isDemo) {
      const stored = localStorage.getItem('officio_demo_meetings');
      if (stored) {
        const parsed = JSON.parse(stored);
        setMeetings(parsed.sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()));
      } else {
        const initialMeetings = [
          { 
            id: '1', 
            title: 'Product Roadmap Q3', 
            room_id: '1', 
            start_time: '2026-04-29T09:00:00', 
            end_time: '2026-04-29T10:30:00', 
            organizer_id: '1', 
            organizer_name: 'Admin Demo',
            description: 'Review quarterly goals and vision' 
          },
          { 
            id: '2', 
            title: 'Marketing Weekly', 
            room_id: '2', 
            start_time: '2026-04-29T13:00:00', 
            end_time: '2026-04-29T14:30:00', 
            organizer_id: '2', 
            organizer_name: 'Budi Santoso',
            description: 'Campaign planning and execution' 
          },
          { 
            id: '3', 
            title: 'Staff Briefing', 
            room_id: '3', 
            start_time: '2026-04-29T10:00:00', 
            end_time: '2026-04-29T11:00:00', 
            organizer_id: '1', 
            organizer_name: 'Admin Demo',
            description: 'All hands meeting for internal update' 
          },
        ];
        localStorage.setItem('officio_demo_meetings', JSON.stringify(initialMeetings));
        setMeetings(initialMeetings);
      }
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('meetings')
      .select('*, profiles(full_name)')
      .order('start_time', { ascending: true });
      
    if (data) {
      setMeetings(data.map(m => ({
        ...m,
        organizer_name: (m as any).profiles?.full_name || 'Admin'
      })));
    }
    setLoading(false);
  }

  const checkRoomCollision = (roomId: string, start: string, end: string, excludeId?: string) => {
    if (!start || !end || !roomId) return false;
    
    try {
      const startT = parseISO(start).getTime();
      const endT = parseISO(end).getTime();

      return meetings.some(m => {
        if (m.id === excludeId) return false;
        if (m.room_id !== roomId) return false;

        const mStart = parseISO(m.start_time).getTime();
        const mEnd = parseISO(m.end_time).getTime();

        return (startT >= mStart && startT < mEnd) || 
               (endT > mStart && endT <= mEnd) ||
               (startT <= mStart && endT >= mEnd);
      });
    } catch (e) {
      return false;
    }
  };

  const handleCreateMeeting = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    setFormError(null);

    // Safety timeout
    const safetyTimeout = setTimeout(() => setIsSubmitting(false), 8000);

    if (checkRoomCollision(formData.room_id, formData.start_time, formData.end_time, editingMeeting?.id)) {
      setFormError('Maaf, ruangan ini sudah dipesan untuk jadwal tersebut. Silakan pilih ruangan lain atau ganti jam.');
      setIsSubmitting(false);
      clearTimeout(safetyTimeout);
      return;
    }

    const newMeetingData = {
      title: formData.title,
      room_id: formData.room_id,
      start_time: formData.start_time,
      end_time: formData.end_time,
      description: formData.description,
      organizer_id: user.id
    };

    if (isDemo) {
      const stored = localStorage.getItem('officio_demo_meetings');
      let current = stored ? JSON.parse(stored) : [];
      
      if (editingMeeting) {
        current = current.map((m: any) => m.id === editingMeeting.id ? { ...m, ...newMeetingData } : m);
      } else {
        const newMeeting = {
          id: Math.random().toString(36).substr(2, 9),
          ...newMeetingData,
          organizer_name: profile?.full_name || 'Admin'
        };
        current = [newMeeting, ...current];
      }

      localStorage.setItem('officio_demo_meetings', JSON.stringify(current));
      new BroadcastChannel('officio_demo_sync').postMessage({ type: 'REFRESH_MEETINGS' });
      
      clearTimeout(safetyTimeout);
      setIsModalOpen(false);
      setEditingMeeting(null);
      setFormData({ title: '', room_id: '', start_time: '', end_time: '', description: '' });
      setIsSubmitting(false);
      setToastMessage(editingMeeting ? 'Jadwal meeting berhasil diperbarui' : 'Jadwal meeting berhasil dibuat');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      
      fetchData();
      return;
    }

    try {
      let error;
      if (editingMeeting) {
        const { error: err } = await supabase.from('meetings').update(newMeetingData).eq('id', editingMeeting.id);
        error = err;
      } else {
        const { error: err } = await supabase.from('meetings').insert(newMeetingData);
        error = err;
      }
      
      if (!error) {
        clearTimeout(safetyTimeout);
        setIsModalOpen(false);
        setEditingMeeting(null);
        setFormData({ title: '', room_id: '', start_time: '', end_time: '', description: '' });
        setIsSubmitting(false);
        setToastMessage(editingMeeting ? 'Jadwal meeting berhasil diperbarui' : 'Jadwal meeting berhasil dibuat');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      clearTimeout(safetyTimeout);
      setIsSubmitting(false);
    }
  };

  const handleEdit = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setFormData({
      title: meeting.title,
      room_id: meeting.room_id,
      start_time: meeting.start_time,
      end_time: meeting.end_time,
      description: meeting.description || '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    // In demo mode or if confirm is blocked, we just delete
    // For production Supabase, we might want to keep it but for now let's make it easy
    const proceed = isDemo ? true : confirm('Hapus jadwal meeting ini?');
    if (!proceed) return;

    if (isDemo) {
      const stored = localStorage.getItem('officio_demo_meetings');
      const current = stored ? JSON.parse(stored) : [];
      const updated = current.filter((m: any) => m.id !== id);
      localStorage.setItem('officio_demo_meetings', JSON.stringify(updated));
      new BroadcastChannel('officio_demo_sync').postMessage({ type: 'REFRESH_MEETINGS' });
      await fetchData();
      setToastMessage('Jadwal meeting berhasil dihapus');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    const { error } = await supabase.from('meetings').delete().eq('id', id);
    if (!error) {
      await fetchData();
      setToastMessage('Jadwal meeting berhasil dihapus');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };
  const getRoomStatus = (roomId: string) => {
    const now = new Date();
    const activeMeeting = meetings.find(m => 
      m.room_id === roomId && 
      isWithinInterval(now, {
        start: parseISO(m.start_time),
        end: parseISO(m.end_time)
      })
    );
    return activeMeeting ? 'Dipakai' : 'Tersedia';
  };

  return (
    <div className="space-y-8 relative">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-office-slate-800 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-white/10">
            <CheckCircle2 className="h-5 w-5 text-green-400" />
            <span className="text-sm font-bold">{toastMessage}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Jadwal & Ruangan</h1>
          <p className="text-gray-500 font-medium font-sans">Pantau ketersediaan ruangan rapat dan jadwal pertemuan tim.</p>
        </div>
        {profile?.role === 'admin' && (
          <button 
            onClick={() => {
              setEditingMeeting(null);
              setFormData({ title: '', room_id: '', start_time: '', end_time: '', description: '' });
              setFormError(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-100"
          >
            <Plus className="h-5 w-5" />
            Jadwalkan Meeting
          </button>
        )}
      </div>

      {/* Create Meeting Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-office-border flex justify-between items-center bg-office-gray">
              <h2 className="text-xl font-black text-office-slate-800 uppercase tracking-tight">{editingMeeting ? 'Edit Jadwal Meeting' : 'Jadwalkan Pertemuan'}</h2>
              <button onClick={() => { setIsModalOpen(false); setEditingMeeting(null); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <XCircle size={24} />
              </button>
            </div>
            
            <form onSubmit={handleCreateMeeting} className="p-8 space-y-5">
              {formError && (
                <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                  <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                  <p className="text-xs font-bold text-red-600 uppercase tracking-tight">{formError}</p>
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Judul Pertemuan</label>
                <input 
                  required
                   value={formData.title}
                   onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500" 
                  placeholder="Contoh: Quarterly Review"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Pilih Ruangan</label>
                  <select 
                    required
                    value={formData.room_id}
                    onChange={e => setFormData({...formData, room_id: e.target.value})}
                    className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Pilih...</option>
                    {rooms.map(room => (
                      <option key={room.id} value={room.id}>{room.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Deskripsi Singkat</label>
                  <input 
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500"
                    placeholder="Opsional"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Waktu Mulai</label>
                  <input 
                    required
                    type="datetime-local"
                    value={formData.start_time}
                    onChange={e => setFormData({...formData, start_time: e.target.value})}
                    className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Waktu Selesai</label>
                  <input 
                    required
                    type="datetime-local"
                    value={formData.end_time}
                    onChange={e => setFormData({...formData, end_time: e.target.value})}
                    className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-4 rounded-2xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors uppercase tracking-tight text-xs"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-3 px-6 py-4 rounded-2xl font-bold bg-brand-600 text-white hover:bg-brand-700 transition-all shadow-lg shadow-brand-100 uppercase tracking-tight text-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Memproses...' : 'Simpan Jadwal Meeting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Room Status Grid */}
        <div className="lg:col-span-1 space-y-6">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 px-1">
            <Video className="h-5 w-5 text-brand-600" /> Status Ruangan Real-time
          </h2>
          
          {rooms.length > 0 && rooms.every(r => getRoomStatus(r.id) === 'Dipakai') && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 animate-pulse">
               <div className="bg-amber-500 rounded-full p-1">
                  <XCircle className="h-4 w-4 text-white" />
               </div>
               <div>
                  <p className="text-xs font-black text-amber-800 uppercase tracking-tight">Semua Ruangan Penuh</p>
                  <p className="text-[10px] text-amber-600 font-bold uppercase">Gunakan link virtual untuk pertemuan mendesak.</p>
               </div>
            </div>
          )}

          <div className="space-y-4">
            {rooms.map((room) => {
              const status = getRoomStatus(room.id);
              return (
                <div key={room.id} className="bg-white p-5 rounded-2xl border border-office-border shadow-sm flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                      status === 'Dipakai' ? "bg-rose-50" : "bg-green-50"
                    )}>
                      <Building2 className={cn(
                        "h-6 w-6",
                        status === 'Dipakai' ? "text-rose-600" : "text-green-600"
                      )} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{room.name}</h3>
                      <p className="text-xs text-gray-500 font-medium">Cap: {room.capacity} Orang</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={cn(
                      "text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-full",
                      status === 'Dipakai' ? "text-rose-600" : "text-green-600"
                    )}>
                      {status}
                    </span>
                    <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase">Lantai {room.location.split(',')[0].slice(-1)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Meeting Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-office-border shadow-sm overflow-hidden">
             <div className="p-8 border-b border-office-border flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Agenda Hari Ini</h2>
                <div className="text-sm font-bold text-gray-500">
                   {format(new Date(), "dd MMMM yyyy", { locale: id })}
                </div>
             </div>
             
             <div className="divide-y divide-office-border">
                {meetings.map((meeting) => (
                  <div key={meeting.id} className="p-8 flex flex-col md:flex-row gap-6 hover:bg-gray-50 transition-colors">
                     <div className="md:w-32 shrink-0">
                        <div className="text-lg font-black text-brand-600">{format(parseISO(meeting.start_time), 'HH:mm')}</div>
                        <div className="text-xs font-bold text-gray-400 mt-1">Sampai {format(parseISO(meeting.end_time), 'HH:mm')}</div>
                     </div>
                     <div className="flex-1 space-y-2">
                        <h3 className="text-xl font-bold text-gray-900">{meeting.title}</h3>
                        <p className="text-gray-500 text-sm leading-relaxed">{meeting.description}</p>
                    <div className="flex flex-wrap gap-4 pt-2">
                       <div className="flex items-center gap-2 py-1.5 px-3 bg-office-gray rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-widest border border-office-border">
                          <MapPin className="h-3 w-3 text-brand-600" />
                          {rooms.find(r => r.id === meeting.room_id)?.name}
                       </div>
                       {rooms.find(r => r.id === meeting.room_id)?.name === 'Virtual Room' && (
                         <div className="flex items-center gap-2 py-1.5 px-3 bg-blue-50 rounded-lg text-[10px] font-black text-blue-600 uppercase tracking-widest border border-blue-100">
                            <Video className="h-3 w-3" />
                            G-Meet
                         </div>
                       )}
                       <div className="flex items-center gap-2 py-1.5 px-3 bg-office-gray rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-widest border border-office-border">
                          <Users className="h-3 w-3 text-brand-600" />
                          Host: {(meeting as any).organizer_name || 'Admin'}
                       </div>
                    </div>
                     </div>
                      <div className="flex items-start gap-1">
                        {profile?.role === 'admin' ? (
                          <>
                             <button 
                               onClick={() => handleEdit(meeting)}
                               className="p-2.5 hover:bg-brand-50 text-brand-600 rounded-xl transition-all hover:scale-110"
                               title="Edit"
                             >
                                <Edit2 className="h-4 w-4" />
                             </button>
                             <button 
                               onClick={() => handleDelete(meeting.id)}
                               className="p-2.5 hover:bg-rose-50 text-rose-600 rounded-xl transition-all hover:scale-110"
                               title="Hapus"
                             >
                                <Trash2 className="h-4 w-4" />
                             </button>
                          </>
                        ) : (
                          <button className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                            <MoreVertical className="h-5 w-5 text-gray-400" />
                          </button>
                        )}
                      </div>
                  </div>
                ))}
                {meetings.length === 0 && (
                  <div className="p-12 text-center text-gray-500">Tak ada pertemuan hari ini.</div>
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Building2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </svg>
  );
}
