import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { supabase, LeaveRequest } from '../../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  AlertCircle,
  Filter,
  User,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Image as ImageIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '../../lib/utils';

export default function LeaveRequestsPage() {
  const { user, profile, isDemo } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ employees, setEmployees] = useState<any[]>([]);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteType, setNoteType] = useState<'approved' | 'rejected' | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const toast = (message: string) => {
    alert(message);
  };

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Form State
  const [formData, setFormData] = useState({
    user_id: user?.id || '',
    custom_name: '',
    type: 'cuti',
    start_date: '',
    end_date: '',
    reason: '',
    certificate: '' as string | null
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (user?.id && !formData.user_id) {
      setFormData(prev => ({ ...prev, user_id: user.id }));
    }
  }, [user]);

  useEffect(() => {
    async function init() {
      await fetchEmployees();
      await fetchRequests();
    }
    
    init();

    const handleUpdate = () => {
      fetchRequests();
    };
    window.addEventListener('officio_data_update', handleUpdate);

    // Realtime Sync
    if (!isDemo && user) {
      const channel = supabase
        .channel('leave-requests-sync')
        .on('postgres_changes' as any, { 
          event: '*', 
          table: 'leave_requests',
          filter: profile?.role === 'admin' ? undefined : `user_id=eq.${user.id}` 
        }, () => {
          fetchRequests();
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

    const { data, error } = await supabase.from('profiles').select('id, full_name');
    if (data) setEmployees(data);
  }

  async function fetchRequests() {
    if (!user) return;
    
    if (isDemo) {
      const stored = localStorage.getItem('officio_demo_leaves');
      let demoData: LeaveRequest[] = stored ? JSON.parse(stored) : [];
      
      if (demoData.length === 0) {
        demoData = [
          { 
            id: '1', 
            user_id: user.id, 
            type: 'cuti', 
            reason: 'Liburan Akhir Tahun bersama keluarga di Bali', 
            start_date: '2026-05-10', 
            end_date: '2026-05-15', 
            status: 'pending', 
            created_at: new Date().toISOString() 
          },
          { 
            id: '2', 
            user_id: user.id, 
            type: 'izin_sakit', 
            reason: 'Gejala Typhus, istirahat total sesuai anjuran dokter', 
            start_date: '2026-04-10', 
            end_date: '2026-04-12', 
            status: 'approved', 
            admin_note: 'Semoga lekas sembuh.', 
            created_at: '2026-04-09T08:00:00' 
          },
        ];
        localStorage.setItem('officio_demo_leaves', JSON.stringify(demoData));
      }

      // Filter based on role
      let filtered = demoData;
      if (profile?.role !== 'admin') {
        filtered = demoData.filter(d => d.user_id === user.id);
      } else {
        // Add profile names for demo
        filtered = demoData.map(d => ({
          ...d,
          profiles: { full_name: d.user_id === user.id ? (profile.full_name || 'Admin') : 'Karyawan Demo' }
        })) as any;
      }

      setRequests(filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setLoading(false);
      return;
    }

    let query = supabase.from('leave_requests').select(`
      *,
      profiles:user_id (full_name)
    `);
    
    if (profile?.role !== 'admin') {
      query = query.eq('user_id', user.id);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching requests:', error);
    } else {
      setRequests(data || []);
    }
    setLoading(false);
  }

  const handleCreateRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    // Safety check: Admin cannot create leave requests
    if (profile?.role === 'admin') {
      alert('Admin tidak diperbolehkan membuat pengajuan cuti.');
      return;
    }

    setIsSubmitting(true);

    const tempId = Math.random().toString(36).substr(2, 9);
    const newRequestData = {
      user_id: formData.user_id === 'custom' ? user.id : (formData.user_id || user.id),
      type: formData.type as 'cuti' | 'izin_sakit',
      start_date: formData.start_date,
      end_date: formData.end_date,
      reason: formData.reason,
      status: 'pending'
    };

    if (isDemo) {
      const stored = localStorage.getItem('officio_demo_leaves');
      const current = stored ? JSON.parse(stored) : [];

      let displayName = 'Karyawan Demo';
      if (formData.user_id === 'custom') {
        displayName = formData.custom_name;
      } else {
        const selectedEmployee = employees.find(e => e.id === newRequestData.user_id);
        displayName = selectedEmployee?.full_name || (newRequestData.user_id === user.id ? (profile?.full_name || 'Anda') : 'Karyawan Demo');
      }

      const newRequest: LeaveRequest = {
        id: tempId,
        ...newRequestData as any,
        medical_certificate_url: formData.certificate,
        profiles: { full_name: displayName },
        created_at: new Date().toISOString()
      };
      
      localStorage.setItem('officio_demo_leaves', JSON.stringify([newRequest, ...current]));
      new BroadcastChannel('officio_demo_sync').postMessage({ type: 'REFRESH_REQUIRED' });
      
      setIsModalOpen(false);
      setFormData({ user_id: user?.id || '', custom_name: '', type: 'cuti', start_date: '', end_date: '', reason: '', certificate: null });
      setSelectedFile(null);
      setIsSubmitting(false);
      
      await fetchRequests();
      return;
    }

    try {
      const { error } = await supabase.from('leave_requests').insert({
        ...newRequestData,
        medical_certificate_url: formData.certificate
      });
      if (!error) {
        setIsModalOpen(false);
        setFormData({ user_id: user.id, type: 'cuti', start_date: '', end_date: '', reason: '', certificate: null, custom_name: '' });
        setSelectedFile(null);
        setIsSubmitting(false);
        await fetchRequests();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAction = async (id: string, status: 'approved' | 'rejected', note?: string) => {
    if (profile?.role !== 'admin') return;
    
    if (isDemo) {
      const stored = localStorage.getItem('officio_demo_leaves');
      const current: LeaveRequest[] = stored ? JSON.parse(stored) : [];
      const updated = current.map(r => r.id === id ? { ...r, status, admin_note: note } : r);
      localStorage.setItem('officio_demo_leaves', JSON.stringify(updated));
      
      new BroadcastChannel('officio_demo_sync').postMessage({ type: 'REFRESH_REQUIRED' });
      await fetchRequests();
      return;
    }

    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status, admin_note: note })
        .eq('id', id);
      
      if (!error) {
        await fetchRequests();
      }
      if (error) throw error;
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    setIsSubmitting(true);

    if (isDemo) {
      const stored = localStorage.getItem('officio_demo_leaves');
      const current: LeaveRequest[] = stored ? JSON.parse(stored) : [];
      const updated = current.filter(r => r.id !== deletingId);
      localStorage.setItem('officio_demo_leaves', JSON.stringify(updated));
      
      try {
        const channel = new BroadcastChannel('officio_demo_sync');
        channel.postMessage({ type: 'REFRESH_REQUIRED' });
        channel.close();
      } catch (e) {}
      
      setDeletingId(null);
      setIsSubmitting(false);
      fetchRequests();
      return;
    }

    try {
      const { error } = await supabase
        .from('leave_requests')
        .delete()
        .eq('id', deletingId);
      
      if (error) throw error;
      setDeletingId(null);
      fetchRequests();
    } catch (err) {
      console.error('Error deleting request:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Selection Logic
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedRequests.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedRequests.map(r => r.id));
    }
  };

  const handleBulkDelete = async () => {
    if (!profile || profile.role !== 'admin' || selectedIds.length === 0) return;
    
    if (!confirm(`Hapus ${selectedIds.length} pengajuan terpilih?`)) return;

    setIsBulkDeleting(true);
    try {
      if (isDemo) {
        const stored = localStorage.getItem('officio_demo_leaves');
        const current: LeaveRequest[] = stored ? JSON.parse(stored) : [];
        const updated = current.filter(r => !selectedIds.includes(r.id));
        localStorage.setItem('officio_demo_leaves', JSON.stringify(updated));
        
        try {
          const channel = new BroadcastChannel('officio_demo_sync');
          channel.postMessage({ type: 'REFRESH_REQUIRED' });
          channel.close();
        } catch (e) {}
      } else {
        const { error } = await supabase
          .from('leave_requests')
          .delete()
          .in('id', selectedIds);
        
        if (error) throw error;
      }
      
      setSelectedIds([]);
      toast(`${selectedIds.length} pengajuan berhasil dihapus!`);
      fetchRequests();
    } catch (err: any) {
      console.error('Bulk delete failed:', err);
      alert('Gagal menghapus beberapa data: ' + (err.message || 'Error tidak diketahui'));
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Pagination Logic
  const totalPages = Math.ceil(requests.length / itemsPerPage);
  const paginatedRequests = requests.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [requests.length]);

  return (
    <div className="space-y-8">
      {/* Note Action Modal (Approval/Rejection) */}
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
                  setRejectionNote('');
                }} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Catatan Admin (Opsional)</label>
                <textarea 
                  rows={4}
                  value={rejectionNote}
                  onChange={e => setRejectionNote(e.target.value)}
                  className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-office-blue transition-all"
                  placeholder={noteType === 'approved' ? "Contoh: Selamat berlibur, semoga menyenangkan!" : "Contoh: Mohon maaf, sedang ada deadline mendesak."}
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  onClick={() => {
                    setIsNoteModalOpen(false);
                    setPendingActionId(null);
                    setNoteType(null);
                    setRejectionNote('');
                  }}
                  className="flex-1 px-4 py-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors uppercase tracking-tight text-xs"
                >
                  Batal
                </button>
                <button 
                  onClick={() => {
                    if (pendingActionId && noteType) {
                      handleAction(pendingActionId, noteType, rejectionNote.trim());
                      setIsNoteModalOpen(false);
                      setPendingActionId(null);
                      setNoteType(null);
                      setRejectionNote('');
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

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Pengajuan Cuti & Izin</h1>
          <p className="text-gray-500 font-medium">Manajemen permohonan ketidakhadiran karyawan.</p>
        </div>
        {profile?.role !== 'admin' && (
          <button 
            onClick={() => {
              setFormData(prev => ({ ...prev, user_id: user?.id || '' }));
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-100"
          >
            <Plus className="h-5 w-5" /> Buat Pengajuan
          </button>
        )}
      </div>

      {/* Create Leave Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-office-border flex justify-between items-center bg-office-gray">
              <h2 className="text-xl font-black text-office-slate-800 uppercase tracking-tight">Form Pengajuan</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <XCircle size={24} />
              </button>
            </div>
            
            <form onSubmit={handleCreateRequest} className="p-8 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Pilih Karyawan</label>
                <div className="space-y-3">
                  <select 
                    required
                    value={formData.user_id}
                    onChange={e => setFormData({...formData, user_id: e.target.value})}
                    className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500 transition-all"
                  >
                    <option value="">Pilih Karyawan...</option>
                    <option value={user?.id}>Saya Sendiri ({profile?.full_name})</option>
                    {profile?.role === 'admin' && employees.filter(emp => emp.id !== user?.id).map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                    ))}
                    <option value="custom">+ Ketik Nama Manual...</option>
                  </select>

                  {formData.user_id === 'custom' && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <input 
                        type="text"
                        required
                        placeholder="Masukkan Nama Lengkap..."
                        value={formData.custom_name}
                        onChange={e => setFormData({...formData, custom_name: e.target.value})}
                        className="w-full bg-white border-2 border-brand-100 rounded-xl p-4 text-sm font-bold focus:border-brand-500 focus:ring-0 outline-none placeholder:text-slate-400 shadow-sm transition-all"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Jenis Pengajuan</label>
                <div className="grid grid-cols-2 gap-3">
                  {['cuti', 'izin_sakit'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({...formData, type: type as any})}
                      className={cn(
                        "py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-tight transition-all border-2",
                        formData.type === type 
                          ? "bg-brand-50 border-brand-500 text-brand-600" 
                          : "bg-white border-transparent text-slate-400 hover:bg-slate-50"
                      )}
                    >
                      {type === 'cuti' ? 'Cuti Tahunan' : 'Izin Sakit'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Tanggal Mulai</label>
                  <input 
                    required
                    type="date"
                    value={formData.start_date}
                    onChange={e => setFormData({...formData, start_date: e.target.value})}
                    className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Tanggal Selesai</label>
                  <input 
                    required
                    type="date"
                    value={formData.end_date}
                    onChange={e => setFormData({...formData, end_date: e.target.value})}
                    className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Alasan Pengajuan</label>
                <textarea 
                  required
                  rows={3}
                  value={formData.reason}
                  onChange={e => setFormData({...formData, reason: e.target.value})}
                  className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500"
                  placeholder="Jelaskan secara singkat alasan Anda..."
                />
              </div>

              {formData.type === 'izin_sakit' && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Surat Dokter (Optional)</label>
                  <div className="relative group">
                    <input 
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSelectedFile(file);
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setFormData(prev => ({ ...prev, certificate: reader.result as string }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                      id="certificate-upload"
                    />
                    <label 
                      htmlFor="certificate-upload"
                      className="flex items-center justify-center gap-3 w-full p-6 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-all"
                    >
                      {formData.certificate ? (
                        <div className="flex items-center gap-3 text-brand-600 font-bold">
                          <CheckCircle2 size={24} />
                          <span className="text-sm truncate max-w-[200px]">{selectedFile?.name || 'File terpilih'}</span>
                        </div>
                      ) : (
                         <div className="flex flex-col items-center gap-2 text-slate-400 font-bold group-hover:text-brand-500">
                            <Plus size={24} />
                            <span className="text-xs uppercase tracking-widest">Upload Surat Dokter</span>
                         </div>
                      )}
                    </label>
                  </div>
                  {formData.certificate && (
                    <button 
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, certificate: null }));
                        setSelectedFile(null);
                      }}
                      className="mt-2 text-[10px] font-black text-rose-500 uppercase tracking-widest hover:underline"
                    >
                      Hapus Lampiran
                    </button>
                  )}
                </div>
              )}

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
                  {isSubmitting ? 'Memproses...' : 'Kirim Pengajuan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Helper Card */}
        <div className="lg:col-span-1 space-y-6">
           <div className="bg-brand-600 rounded-3xl p-8 text-white shadow-xl shadow-brand-100">
              <h3 className="text-lg font-bold mb-4">Informasi Kuota</h3>
              <div className="space-y-4">
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-brand-200">Cuti Tahunan</span>
                    <span className="font-bold">12 Hari</span>
                 </div>
                 <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-white w-1/3"></div>
                 </div>
                 <p className="text-[10px] text-brand-300 font-medium">4 Hari telah digunakan dari total 12 hari</p>
              </div>
           </div>

           <div className="bg-white rounded-3xl p-8 border border-office-border shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Panduan Izin</h3>
              <ul className="space-y-4 text-xs font-medium text-gray-500">
                 <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-brand-600 shrink-0" />
                    <span>Ajukan cuti minimal 3 hari sebelum tanggal mulai.</span>
                 </li>
                 <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-brand-600 shrink-0" />
                    <span>Lampirkan surat dokter jika mengajukan izin sakit &gt; 1 hari.</span>
                 </li>
              </ul>
           </div>
        </div>

        {/* List of Requests */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-3xl border border-office-border shadow-sm overflow-hidden text-sm">
             <div className="p-8 border-b border-office-border flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                   {profile?.role === 'admin' && (
                     <input 
                       type="checkbox" 
                       checked={selectedIds.length === paginatedRequests.length && paginatedRequests.length > 0}
                       onChange={toggleSelectAll}
                       className="w-5 h-5 rounded-lg border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                     />
                   )}
                   <h2 className="text-xl font-bold text-gray-900">Daftar Pengajuan</h2>
                </div>
                <div className="flex items-center gap-2">
                  {profile?.role === 'admin' && selectedIds.length > 0 && (
                    <button 
                      onClick={handleBulkDelete}
                      className="hidden md:flex items-center gap-2 h-10 px-4 bg-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-rose-700 transition-all active:scale-95 shadow-lg shadow-rose-100"
                    >
                      <Trash2 size={14} /> Hapus ({selectedIds.length})
                    </button>
                  )}
                  <button className="flex items-center gap-2 text-gray-500 font-bold hover:text-brand-600 transition-colors">
                     <Filter className="h-4 w-4" /> Filter
                  </button>
                </div>
             </div>

             <div className="divide-y divide-office-border">
                {paginatedRequests.length === 0 ? (
                  <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Belum ada pengajuan.</div>
                ) : paginatedRequests.map((request) => (
                  <div key={request.id} className={cn(
                    "p-8 flex flex-col sm:flex-row gap-6 hover:bg-gray-50 transition-colors relative",
                    selectedIds.includes(request.id) && "bg-brand-50/30"
                  )}>
                     {profile?.role === 'admin' && (
                       <div className="absolute top-8 left-8 sm:relative sm:top-0 sm:left-0 pt-2">
                          <input 
                            type="checkbox"
                            checked={selectedIds.includes(request.id)}
                            onChange={() => toggleSelect(request.id)}
                            className="w-6 h-6 rounded-xl border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                          />
                       </div>
                     )}
                     <div className="sm:w-20 shrink-0 flex flex-col items-center ml-10 sm:ml-0">
                        <div className={cn(
                           "w-12 h-12 rounded-2xl flex items-center justify-center mb-2",
                           request.type === 'cuti' ? "bg-indigo-50 text-indigo-600" : "bg-rose-50 text-rose-600"
                        )}>
                           <FileText className="h-6 w-6" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-center">
                           {request.type === 'cuti' ? 'Cuti' : 'Sakit'}
                        </span>
                     </div>
                     
                     <div className="flex-1 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                           {profile?.role === 'admin' && (request as any).profiles?.full_name && (
                             <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                               <User className="h-3.5 w-3.5 text-slate-500" />
                               <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{(request as any).profiles.full_name}</span>
                             </div>
                           )}
                           <div className="bg-office-gray px-4 py-2 rounded-xl flex items-center gap-3">
                              <Calendar className="h-4 w-4 text-brand-600" />
                              <span className="font-bold text-gray-700">
                                 {format(new Date(request.start_date), 'dd MMM')} - {format(new Date(request.end_date), 'dd MMM yyyy')}
                              </span>
                           </div>
                           <span className={cn(
                              "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-center",
                              request.status === 'approved' ? "bg-green-100 text-green-700" :
                              request.status === 'rejected' ? "bg-rose-100 text-rose-700" :
                              "bg-amber-100 text-amber-700"
                           )}>
                              {request.status === 'approved' ? 'Disetujui' : request.status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                           </span>
                        </div>
                        
                        <div className="flex items-start gap-3">
                           {profile?.role === 'admin' && (
                              <div className="h-8 w-8 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                                 <User className="h-4 w-4 text-brand-600" />
                              </div>
                           )}
                           <div className="text-gray-600 font-medium leading-relaxed italic">
                              "{request.reason}"
                           </div>
                        </div>

                        {request.medical_certificate_url && (
                          <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                             <a 
                               href={request.medical_certificate_url} 
                               target="_blank" 
                               rel="noreferrer"
                               className="inline-flex items-center gap-2 px-4 py-2 bg-brand-50 text-brand-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-100 transition-all border border-brand-100"
                             >
                               <ImageIcon size={14} /> Lihat Surat Dokter
                             </a>
                          </div>
                        )}

                        {request.admin_note && (
                           <div className="bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-[2rem] p-6 mt-4 animate-in fade-in slide-in-from-top-2 duration-500">
                              <div className="flex items-center gap-2 mb-2">
                                 <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Catatan Admin:</span>
                               </div>
                              <p className="text-sm font-bold text-slate-700 leading-relaxed">
                                {request.admin_note}
                              </p>
                           </div>
                        )}
                     </div>

                      {(profile?.role === 'admin' && request.status === 'pending') && (
                        <div className="flex flex-row sm:flex-col gap-2 shrink-0">
                           <button 
                              onClick={() => {
                                setPendingActionId(request.id);
                                setNoteType('approved');
                                setIsNoteModalOpen(true);
                              }}
                              className="p-3 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all shadow-sm group"
                              title="Setujui"
                           >
                              <CheckCircle2 className="h-6 w-6 group-hover:scale-110 transition-transform" />
                           </button>
                           <button 
                              onClick={() => {
                                setPendingActionId(request.id);
                                setNoteType('rejected');
                                setIsNoteModalOpen(true);
                              }}
                              className="p-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm group"
                              title="Tolak"
                           >
                              <XCircle className="h-6 w-6 group-hover:scale-110 transition-transform" />
                           </button>
                        </div>
                      )}

                      {(profile?.role === 'admin' || (profile?.role !== 'admin' && request.status === 'pending')) && (
                        <div className="flex shrink-0">
                          <button 
                            onClick={() => setDeletingId(request.id)}
                            className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all shadow-sm group border border-transparent hover:border-rose-100 cursor-pointer"
                            title={profile?.role === 'admin' ? "Hapus Pengajuan" : "Batalkan Pengajuan"}
                          >
                            <Trash2 className="h-6 w-6 group-hover:scale-110 transition-transform" />
                          </button>
                        </div>
                      )}
                     
                     <div className="sm:hidden flex justify-end">
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                     </div>
                  </div>
                ))}
             </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-8 border-t border-office-border flex items-center justify-between gap-4 bg-white">
                <div className="hidden sm:block">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Halaman {currentPage} dari {totalPages}
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 h-10 px-4 bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-all active:scale-95"
                  >
                    <ChevronLeft size={16} /> Prev
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                      let pageNum = i + 1;
                      if (totalPages > 5 && currentPage > 3) {
                        pageNum = Math.min(currentPage - 2 + i, totalPages - 4 + i);
                      }
                      return (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`hidden sm:flex h-10 w-10 items-center justify-center rounded-xl text-[10px] font-black transition-all ${
                            currentPage === pageNum 
                              ? "bg-brand-600 text-white shadow-lg shadow-brand-100" 
                              : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 h-10 px-4 bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-all active:scale-95"
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Bulk Actions Sticky Bar - Mobile */}
            <div className="md:hidden">
              <AnimatePresence>
                {profile?.role === 'admin' && selectedIds.length > 0 && (
                  <motion.div 
                    initial={{ y: 100 }}
                    animate={{ y: 0 }}
                    exit={{ y: 100 }}
                    className="fixed bottom-24 left-4 right-4 bg-white rounded-[2rem] shadow-2xl border border-office-border p-4 z-[90] flex items-center justify-between"
                  >
                    <div className="flex flex-col pl-4">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{selectedIds.length} Pengajuan Terpilih</span>
                       <span className="font-black text-slate-900">Hapus Masal</span>
                    </div>
                    <button 
                      onClick={handleBulkDelete}
                      className="bg-rose-600 text-white px-6 py-4 rounded-3xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all shadow-lg shadow-rose-200"
                    >
                      Hapus ({selectedIds.length})
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
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
                <h3 className="text-xl font-black text-gray-900 tracking-tight">Hapus Pengajuan?</h3>
                <p className="text-sm font-medium text-gray-500 mt-2">
                  Tindakan ini tidak dapat dibatalkan. Apakah Anda yakin ingin menghapus pengajuan ini?
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
                  disabled={isSubmitting}
                  className="flex-1 bg-rose-600 text-white font-bold py-4 rounded-2xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 uppercase tracking-tight text-xs disabled:opacity-50"
                >
                  {isSubmitting ? '...' : 'Hapus'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
