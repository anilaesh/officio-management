import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { 
  Users, 
  Search, 
  Filter, 
  Plus, 
  Mail, 
  Phone, 
  Briefcase,
  MoreVertical,
  ShieldCheck,
  UserCheck,
  X,
  CheckCircle2,
  Edit2,
  Trash2
} from 'lucide-react';

export default function EmployeesPage() {
  const { user, profile } = useAuth();
  
  // Static check for demo mode
  const isDemoInitial = !import.meta.env.VITE_SUPABASE_URL || 
                        import.meta.env.VITE_SUPABASE_URL.includes('your-project-url') ||
                        import.meta.env.VITE_SUPABASE_URL.includes('placeholder') ||
                        import.meta.env.VITE_SUPABASE_URL === '';

  const [effectivelyDemo, setEffectivelyDemo] = useState(isDemoInitial);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    role: 'employee',
    position: '',
    contact: '',
    email: ''
  });

  useEffect(() => {
    fetchEmployees();

    const handleSync = (event: MessageEvent) => {
      if (event.data?.type === 'REFRESH_EMPLOYEES') {
        fetchEmployees();
      }
    };

    const channel = new BroadcastChannel('officio_demo_sync');
    channel.onmessage = handleSync;

    // Listen for custom data updates
    const handleDataUpdate = () => fetchEmployees();
    window.addEventListener('officio_data_update', handleDataUpdate);

    return () => {
      channel.close();
      window.removeEventListener('officio_data_update', handleDataUpdate);
    };
  }, [effectivelyDemo]);

  async function fetchEmployees() {
    setLoading(true);
    if (effectivelyDemo) {
      const stored = localStorage.getItem('officio_demo_employees');
      if (stored) {
        setEmployees(JSON.parse(stored));
      } else {
        const initial = [
          { id: 'emp-1', name: 'Andi Pratama', role: 'admin', position: 'HR Manager', contact: '0812-3456-7890', email: 'andi@officio.com' },
          { id: 'emp-2', name: 'Budi Santoso', role: 'employee', position: 'Frontend Developer', contact: '0812-9876-5432', email: 'budi@officio.com' },
          { id: 'emp-3', name: 'Citra Lestari', role: 'employee', position: 'UI/UX Designer', contact: '0811-3344-5566', email: 'citra@officio.com' },
          { id: 'emp-4', name: 'Dedi Kurniawan', role: 'employee', position: 'Backend Engineer', contact: '0855-6677-8899', email: 'dedi@officio.com' },
          { id: 'emp-5', name: 'Eka Putri', role: 'employee', position: 'Digital Marketing', contact: '0813-1122-3344', email: 'eka@officio.com' },
        ];
        localStorage.setItem('officio_demo_employees', JSON.stringify(initial));
        setEmployees(initial);
      }
      setLoading(false);
      return;
    }

    try {
      // Add a timeout fallback for database fetch
      const fetchPromise = supabase.from('profiles').select('*').order('full_name');
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Fetch timeout')), 10000)
      );

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;
      
      if (error) {
        if (error.message.includes('profiles') && error.message.includes('cache')) {
          console.warn('Profiles table not found. Switching to Demo Mode for this component.');
          setEffectivelyDemo(true);
          return;
        }
        throw error;
      }

      if (data) {
        setEmployees(data.map(d => ({
          id: d.id,
          name: d.full_name,
          role: d.role,
          position: d.position || 'Karyawan',
          contact: d.phone || '-',
          email: d.email || '-'
        })));
      }
    } catch (err) {
      console.error('Fetch failed, falling back to demo:', err);
      setEffectivelyDemo(true);
    } finally {
      setLoading(false);
    }
  }

  const [formError, setFormError] = useState<string | null>(null);
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError(null);
    
    // Strict validation
    const trimmedName = formData.name.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedPosition = formData.position.trim();
    const trimmedContact = formData.contact.trim();

    if (!trimmedName) {
      setFormError('Nama Lengkap wajib diisi.');
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setFormError('Email Perusahaan tidak valid.');
      return;
    }
    if (!trimmedPosition) {
      setFormError('Jabatan wajib diisi.');
      return;
    }

    console.log('--- Start Submit ---', { isEditing: !!editingEmployee, mode: effectivelyDemo ? 'Demo' : 'Supabase' });
    setIsSubmitting(true);

    // Safety timeout
    const safetyTimeout = setTimeout(() => {
      console.warn('Safety timeout reached');
      setIsSubmitting(false);
    }, 8000);
    
    try {
      if (effectivelyDemo) {
        console.log('Saving to LocalStorage...');
        const stored = localStorage.getItem('officio_demo_employees');
        let current = stored ? JSON.parse(stored) : [];
        
        const preparedData = {
          name: trimmedName,
          email: trimmedEmail,
          position: trimmedPosition,
          contact: trimmedContact,
          role: formData.role
        };

        let updatedList;
        if (editingEmployee) {
          updatedList = current.map((emp: any) => emp.id === editingEmployee.id ? { ...emp, ...preparedData } : emp);
        } else {
          const newEmp = {
            id: `emp-${Date.now()}-${Math.random().toString(16).substring(2, 10)}`,
            ...preparedData
          };
          updatedList = [newEmp, ...current];
        }

        localStorage.setItem('officio_demo_employees', JSON.stringify(updatedList));
        
        // Sync & Update UI immediately
        setEmployees(updatedList);
        
        try {
          const channel = new BroadcastChannel('officio_demo_sync');
          channel.postMessage({ type: 'REFRESH_EMPLOYEES' });
          setTimeout(() => channel.close(), 100);
        } catch (e) {}
        
        clearTimeout(safetyTimeout);
        setIsSubmitting(false);
        handleCloseModal();
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 3000);
        return;
      }

      // Supabase Mode
      if (editingEmployee) {
        const { error } = await supabase.from('profiles').update({
          full_name: trimmedName,
          role: formData.role as 'admin' | 'employee',
          position: trimmedPosition,
          phone: trimmedContact
        }).eq('id', editingEmployee.id);

        if (error) throw error;
      } else {
        const newId = crypto.randomUUID?.() || `emp-${Date.now()}`;
        
        const { error } = await supabase.from('profiles').insert({
          id: newId,
          email: trimmedEmail,
          full_name: trimmedName,
          role: formData.role as 'admin' | 'employee',
          position: trimmedPosition,
          phone: trimmedContact
        });

        if (error) throw error;
      }

      clearTimeout(safetyTimeout);
      setIsSubmitting(false);
      handleCloseModal();
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
      
      fetchEmployees();
    } catch (err: any) {
      clearTimeout(safetyTimeout);
      console.error('Save failed:', err);
      
      // If table missing, fallback to demo immediately for this action
      if (err.message && err.message.includes('profiles') && err.message.includes('cache')) {
        console.warn('Action failed due to missing table. Switching to Demo mode...');
        setEffectivelyDemo(true);
        setIsSubmitting(false);
        setFormError('Sistem sedang disiapkan. Silakan klik "Tambah Karyawan" sekali lagi untuk menyimpan.');
      } else {
        setIsSubmitting(false);
        setFormError(`Gagal: ${err.message || 'Kesalahan Server'}`);
      }
    } finally {
      clearTimeout(safetyTimeout);
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
    setFormData({ name: '', role: 'employee', position: '', contact: '', email: '' });
    setFormError(null);
  };

  const handleEdit = (emp: any) => {
    setEditingEmployee(emp);
    setFormData({
      name: emp.name,
      role: emp.role,
      position: emp.position,
      contact: emp.contact,
      email: emp.email
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data karyawan ini?')) return;

    if (effectivelyDemo) {
      const stored = localStorage.getItem('officio_demo_employees');
      const current = stored ? JSON.parse(stored) : [];
      const updated = current.filter((emp: any) => emp.id !== id);
      localStorage.setItem('officio_demo_employees', JSON.stringify(updated));
      
      try {
        const channel = new BroadcastChannel('officio_demo_sync');
        channel.postMessage({ type: 'REFRESH_EMPLOYEES' });
        channel.close();
      } catch (e) {}
      
      fetchEmployees();
      return;
    }

    try {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;
      
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
      fetchEmployees();
    } catch (err: any) {
      console.error('Error deleting employee:', err);
      alert('Gagal menghapus karyawan: ' + (err.message || 'Error tidak diketahui'));
    }
  };

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    emp.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-office-slate-800 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-white/10">
            <CheckCircle2 className="h-5 w-5 text-green-400" />
            <span className="text-sm font-bold">Data berhasil diproses!</span>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Data Karyawan</h1>
          <p className="text-gray-500 font-medium">Manajemen seluruh personil dan hak akses platform.</p>
        </div>
        {profile?.role === 'admin' && (
          <button 
            type="button"
            onClick={() => {
              handleCloseModal();
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-100"
          >
            <Plus className="h-5 w-5" /> Tambah Karyawan
          </button>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCloseModal} />
          <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-office-gray p-8 border-b border-office-border flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight">{editingEmployee ? 'Edit Karyawan' : 'Tambah Karyawan Baru'}</h2>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Informasi Personil</p>
              </div>
              <button type="button" onClick={handleCloseModal} className="p-2 hover:bg-white rounded-full transition-colors">
                <X className="h-6 w-6 text-slate-400" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-5" id="employee-form">
              {formError && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-bold border border-red-100 animate-in fade-in slide-in-from-top-2">
                  {formError}
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nama Lengkap</label>
                <input 
                  type="text"
                  value={formData.name}
                  onChange={e => {
                    setFormData({...formData, name: e.target.value});
                    if (formError) setFormError(null);
                  }}
                  className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500 transition-all"
                  placeholder="Contoh: Budi Santoso"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Jabatan</label>
                  <input 
                    type="text"
                    value={formData.position}
                    onChange={e => {
                      setFormData({...formData, position: e.target.value});
                      if (formError) setFormError(null);
                    }}
                    className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500 transition-all"
                    placeholder="Contoh: Designer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Role Akses</label>
                  <select 
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value})}
                    className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all"
                  >
                    <option value="employee">Employee</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Email Perusahaan</label>
                <input 
                  type="email"
                  value={formData.email}
                  onChange={e => {
                    setFormData({...formData, email: e.target.value});
                    if (formError) setFormError(null);
                  }}
                  className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500 transition-all"
                  placeholder="email@officio.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nomor Telepon</label>
                <input 
                  type="tel"
                  value={formData.contact}
                  onChange={e => {
                    setFormData({...formData, contact: e.target.value});
                    if (formError) setFormError(null);
                  }}
                  className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500 transition-all"
                  placeholder="0812xxxx"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-4 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all active:scale-95"
                >
                  Batal
                </button>
                <button 
                  id="submit-employee-btn"
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-4 rounded-xl font-bold bg-black text-white hover:bg-slate-800 transition-all shadow-lg shadow-black/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Memproses...</span>
                    </>
                  ) : (
                    editingEmployee ? 'Simpan Perubahan' : 'Tambah Karyawan'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-office-border shadow-sm overflow-hidden">
        <div className="p-8 border-b border-office-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
             <input 
                type="text" 
                placeholder="Cari nama atau jabatan..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-office-gray border border-office-border rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all"
             />
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-3 border border-office-border rounded-xl hover:bg-gray-50 transition-colors font-bold text-gray-600 text-xs uppercase tracking-widest">
              <Filter className="h-4 w-4" /> Filter
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-office-gray">
                <th className="px-8 py-4 font-bold text-gray-500 uppercase tracking-wider text-[10px]">Informasi Karyawan</th>
                <th className="px-8 py-4 font-bold text-gray-500 uppercase tracking-wider text-[10px]">Jabatan</th>
                <th className="px-8 py-4 font-bold text-gray-500 uppercase tracking-wider text-[10px]">Role</th>
                <th className="px-8 py-4 font-bold text-gray-500 uppercase tracking-wider text-[10px]">Kontak</th>
                <th className="px-8 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-office-border text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-10 w-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
                      <p className="text-slate-400 font-bold">Memuat data...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-slate-400 font-bold">
                    Tidak ada data karyawan ditemukan.
                  </td>
                </tr>
              ) : filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50/80 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                       <div className="h-12 w-12 rounded-2xl bg-brand-100 flex items-center justify-center text-brand-600 font-black text-lg transition-transform group-hover:scale-110">
                          {emp.name.charAt(0)}
                       </div>
                       <div>
                          <p className="font-bold text-gray-900">{emp.name}</p>
                          <p className="text-xs text-gray-400 font-medium">{emp.email}</p>
                       </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2 text-gray-600 font-bold">
                       <Briefcase className="h-4 w-4 text-brand-400" />
                       {emp.position}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      emp.role === 'admin' ? "bg-office-slate-800 text-white" : "bg-gray-100 text-gray-500"
                    }`}>
                      {emp.role === 'admin' ? <ShieldCheck className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                      {emp.role}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="space-y-1">
                       <div className="flex items-center gap-2 text-xs text-gray-500 font-semibold italic">
                          <Phone className="h-3 w-3 text-brand-500" /> {emp.contact}
                       </div>
                       <div className="flex items-center gap-2 text-xs text-gray-500 font-semibold">
                          <Mail className="h-3 w-3 text-brand-500" /> {emp.email}
                       </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    {profile?.role === 'admin' && (
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleEdit(emp)}
                          className="p-2.5 hover:bg-brand-50 text-brand-600 rounded-xl transition-all hover:scale-110"
                          title="Edit"
                        >
                           <Edit2 className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(emp.id)}
                          className="p-2.5 hover:bg-red-50 text-red-600 rounded-xl transition-all hover:scale-110"
                          title="Hapus"
                        >
                           <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
