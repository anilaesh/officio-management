import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
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
  Trash2,
  FileDown,
  Upload,
  UserPlus,
  Crown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function EmployeesPage() {
  const { user, profile, isDemo, loading: authLoading } = useAuth();
  
  // Static check for demo mode
  const isDemoInitial = isDemo || !import.meta.env.VITE_SUPABASE_URL || 
                        import.meta.env.VITE_SUPABASE_URL.includes('your-project-url') ||
                        import.meta.env.VITE_SUPABASE_URL.includes('placeholder') ||
                        import.meta.env.VITE_SUPABASE_URL === '';

  const [effectivelyDemo, setEffectivelyDemo] = useState(isDemoInitial);

  // Sync effectivelyDemo with isDemo from context
  useEffect(() => {
    if (isDemo) setEffectivelyDemo(true);
  }, [isDemo]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'form' | 'import'>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  
  const [formData, setFormData] = useState({
    name: '',
    role: 'employee',
    position: '',
    contact: '',
    email: ''
  });

  useEffect(() => {
    if (!authLoading) {
      fetchEmployees();
    }

    const handleSync = (event: MessageEvent) => {
      if (event.data?.type === 'REFRESH_EMPLOYEES' && !authLoading) {
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
    if (effectivelyDemo || isDemo) {
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
        setTimeout(() => reject(new Error('Fetch timeout')), 4000)
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
    setImportData([]);
    setModalType('form');
  };

  const downloadTemplate = () => {
    const template = [
      { 'Nama Lengkap': 'Andi Pratama', 'Email': 'andi@officio.com', 'Jabatan': 'HR Manager', 'Akses': 'admin', 'Telepon': '0812-3456-7890' },
      { 'Nama Lengkap': 'Budi Santoso', 'Email': 'budi@officio.com', 'Jabatan': 'Frontend Developer', 'Akses': 'employee', 'Telepon': '0812-9876-5432' }
    ];
    
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Karyawan");
    XLSX.writeFile(wb, "Template_Karyawan_OfficeFlow.xlsx");
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      setImportData(data);
    };
    reader.readAsBinaryString(file);
  };

  const processImport = async () => {
    if (importData.length === 0) return;
    setIsSubmitting(true);
    
    try {
      const formattedData = importData.map(row => ({
        full_name: row['Nama Lengkap'] || row['full_name'] || row['name'],
        email: row['Email'] || row['email'],
        position: row['Jabatan'] || row['position'] || 'Karyawan',
        role: (row['Akses'] || row['role'] || 'employee').toLowerCase(),
        phone: row['Telepon'] || row['phone'] || row['contact'] || '-'
      })).filter(emp => emp.email && emp.full_name);

      if (effectivelyDemo) {
        const stored = localStorage.getItem('officio_demo_employees');
        let current = stored ? JSON.parse(stored) : [];
        
        const newData = formattedData.map(emp => ({
          id: `emp-${Date.now()}-${Math.random().toString(16).substring(2, 10)}`,
          name: emp.full_name,
          email: emp.email,
          position: emp.position,
          role: emp.role,
          contact: emp.phone
        }));
        
        const updatedList = [...newData, ...current];
        localStorage.setItem('officio_demo_employees', JSON.stringify(updatedList));
        
        setEmployees(updatedList);
        const channel = new BroadcastChannel('officio_demo_sync');
        channel.postMessage({ type: 'REFRESH_EMPLOYEES' });
        setTimeout(() => channel.close(), 100);
      } else {
        const insertBatch = formattedData.map(emp => ({
          id: crypto.randomUUID?.() || `emp-${Date.now()}-${Math.random()}`,
          full_name: emp.full_name,
          email: emp.email,
          position: emp.position,
          role: emp.role,
          phone: emp.phone,
          updated_at: new Date().toISOString()
        }));

        const { error } = await supabase.from('profiles').insert(insertBatch);
        if (error) throw error;
        fetchEmployees();
      }
      
      handleCloseModal();
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (err: any) {
      console.error('Import failed:', err);
      alert('Gagal mengimport data: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
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

  // Pagination Logic
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Selection Logic
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredEmployees.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEmployees.map(e => e.id));
    }
  };

  const handleBulkDelete = async () => {
    if (!profile || profile.role !== 'admin' || selectedIds.length === 0) return;
    
    if (!confirm(`Hapus ${selectedIds.length} karyawan terpilih?`)) return;

    setIsSubmitting(true);
    try {
      if (effectivelyDemo) {
        const stored = localStorage.getItem('officio_demo_employees');
        const current = stored ? JSON.parse(stored) : [];
        const updated = current.filter((emp: any) => !selectedIds.includes(emp.id));
        localStorage.setItem('officio_demo_employees', JSON.stringify(updated));
        
        try {
          const channel = new BroadcastChannel('officio_demo_sync');
          channel.postMessage({ type: 'REFRESH_EMPLOYEES' });
          channel.close();
        } catch (e) {}
      } else {
        const { error } = await supabase.from('profiles').delete().in('id', selectedIds);
        if (error) throw error;
      }
      
      setShowSuccessToast(true);
      setSelectedIds([]);
      setTimeout(() => setShowSuccessToast(false), 3000);
      fetchEmployees();
    } catch (err: any) {
      console.error('Bulk delete failed:', err);
      alert('Gagal menghapus beberapa karyawan: ' + (err.message || 'Error tidak diketahui'));
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <div className="flex gap-2">
            <button 
                type="button"
                onClick={downloadTemplate}
                className="flex items-center gap-2 bg-white border border-office-border text-slate-700 px-4 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm group"
                title="Unduh Template Excel"
            >
                <FileDown className="h-5 w-5 text-slate-400 group-hover:text-slate-600" />
                <span className="hidden sm:inline">Template</span>
            </button>
            <button 
                type="button"
                onClick={() => {
                    handleCloseModal();
                    setModalType('import');
                    setIsModalOpen(true);
                }}
                className="flex items-center gap-2 bg-white border border-office-border text-slate-700 px-4 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm group"
                title="Import Excel"
            >
                <Upload className="h-5 w-5 text-slate-400 group-hover:text-slate-600" />
                <span className="hidden sm:inline">Import</span>
            </button>
            <button 
              type="button"
              onClick={() => {
                handleCloseModal();
                setModalType('form');
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-100"
            >
              <Plus className="h-5 w-5" /> <span className="hidden sm:inline">Tambah Karyawan</span><span className="sm:hidden">Tambah</span>
            </button>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="bg-white p-6 rounded-[2rem] border border-office-border flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
           <div className="bg-brand-50 p-4 rounded-2xl text-brand-600">
              <Users className="h-7 w-7" />
           </div>
           <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Personil</p>
              <p className="text-3xl font-black text-slate-900 tracking-tight">{employees.length} Orang</p>
           </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-office-border flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
           <div className="bg-office-slate-800 p-4 rounded-2xl text-white">
              <Crown className="h-7 w-7" />
           </div>
           <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Administrator</p>
              <p className="text-3xl font-black text-slate-900 tracking-tight">{employees.filter(e => e.role === 'admin').length} Akun</p>
           </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-office-border flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
           <div className="bg-brand-50 p-4 rounded-2xl text-brand-600">
              <UserPlus className="h-7 w-7" />
           </div>
           <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Karyawan Aktif</p>
              <p className="text-3xl font-black text-slate-900 tracking-tight">{employees.filter(e => e.role !== 'admin').length} Orang</p>
           </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCloseModal} />
          <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-office-gray p-8 border-b border-office-border flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight">
                    {modalType === 'import' ? 'Import Data Karyawan' : (editingEmployee ? 'Edit Karyawan' : 'Tambah Karyawan Baru')}
                </h2>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                    {modalType === 'import' ? 'Excel / CSV' : 'Informasi Personil'}
                </p>
              </div>
              <button type="button" onClick={handleCloseModal} className="p-2 hover:bg-white rounded-full transition-colors">
                <X className="h-6 w-6 text-slate-400" />
              </button>
            </div>
            
            <div className="p-8">
              {modalType === 'import' ? (
                <div className="space-y-6">
                    <div className="bg-brand-50 p-6 rounded-[2rem] border border-brand-100 text-center">
                        <Upload className="h-12 w-12 text-brand-600 mx-auto mb-4" />
                        <h3 className="text-lg font-black text-brand-900 tracking-tight">Unggah File Excel</h3>
                        <p className="text-sm font-medium text-brand-700 mt-2 mb-6 text-balance">
                            Pastikan file Anda memiliki kolom: <br/> 
                            <span className="font-bold">Nama Lengkap, Email, Jabatan, Akses, Telepon</span>
                        </p>
                        <input 
                            type="file" 
                            accept=".xlsx, .xls, .csv" 
                            onChange={handleFileUpload}
                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-xs file:font-black file:uppercase file:bg-brand-600 file:text-white hover:file:bg-brand-700 transition-all cursor-pointer"
                        />
                    </div>

                    {importData.length > 0 && (
                        <div className="space-y-4">
                            <div className="bg-white p-4 rounded-2xl border border-office-border max-h-40 overflow-y-auto shadow-inner">
                                <table className="w-full text-[10px] text-left">
                                    <thead className="bg-white sticky top-0 border-b">
                                        <tr>
                                            <th className="pb-2 font-black uppercase text-slate-400">Nama</th>
                                            <th className="pb-2 font-black uppercase text-slate-400">Email</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {importData.slice(0, 5).map((row, idx) => (
                                            <tr key={idx}>
                                                <td className="py-2 font-bold text-slate-700">{row['Nama Lengkap'] || row['full_name'] || '---'}</td>
                                                <td className="py-2 text-slate-500">{row['Email'] || row['email'] || '---'}</td>
                                            </tr>
                                        ))}
                                        {importData.length > 5 && (
                                            <tr><td colSpan={2} className="py-2 text-center text-slate-400 italic">...dan {importData.length - 5} lainnya</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <button 
                                onClick={processImport}
                                disabled={isSubmitting}
                                className="w-full bg-brand-600 text-white font-black uppercase tracking-tight py-4 rounded-2xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-100 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Memproses...</span>
                                    </>
                                ) : (
                                    <span>Konfirmasi Import {importData.length} Karyawan</span>
                                )}
                            </button>
                        </div>
                    )}
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5" id="employee-form">
                    {formError && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-bold border border-red-100 animate-in fade-in slide-in-from-top-2">
                        {formError}
                        </div>
                    )}
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nama Lengkap</label>
                        <input 
                        type="text"
                        required
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
                            required
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
                        required
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
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] border border-office-border shadow-sm overflow-hidden mb-safe">
        <div className="p-8 lg:px-10 border-b border-office-border flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="relative flex-1 max-w-md w-full">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
             <input 
                type="text" 
                placeholder="Cari nama atau jabatan..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all placeholder:text-slate-300"
             />
          </div>
          <div className="flex gap-2">
            {profile?.role === 'admin' && selectedIds.length > 0 && (
              <button 
                onClick={handleBulkDelete}
                className="hidden md:flex items-center justify-center gap-2 h-12 px-6 bg-rose-600 rounded-2xl text-xs font-black uppercase tracking-widest text-white hover:bg-rose-700 transition-all active:scale-95 shadow-lg shadow-rose-100"
              >
                <Trash2 size={16} /> Hapus ({selectedIds.length})
              </button>
            )}
            <button className="flex-1 md:flex-none flex items-center justify-center gap-2 h-12 px-6 bg-slate-50 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all active:scale-95">
              <Filter className="h-4 w-4" /> Filter
            </button>
          </div>
        </div>

        {/* Tablet/Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                {profile?.role === 'admin' && (
                  <th className="pl-10 py-5 w-10">
                    <input 
                      type="checkbox"
                      checked={selectedIds.length === filteredEmployees.length && filteredEmployees.length > 0}
                      onChange={toggleSelectAll}
                      className="w-5 h-5 rounded-lg border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                  </th>
                )}
                <th className={`${profile?.role === 'admin' ? 'px-4' : 'px-10'} py-5 font-black text-slate-400 font-black uppercase tracking-widest text-[10px]`}>Informasi Karyawan</th>
                <th className="px-10 py-5 font-black text-slate-400 font-black uppercase tracking-widest text-[10px]">Jabatan</th>
                <th className="px-10 py-5 font-black text-slate-400 font-black uppercase tracking-widest text-[10px]">Role</th>
                <th className="px-10 py-5 font-black text-slate-400 font-black uppercase tracking-widest text-[10px]">Kontak</th>
                <th className="px-10 py-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-office-border text-sm">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="animate-pulse">
                    <td className="px-10 py-6 h-24"><div className="h-4 w-full bg-slate-100 rounded-full"></div></td>
                    <td colSpan={4}></td>
                  </tr>
                ))
              ) : paginatedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-10 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                    Tidak ada data karyawan ditemukan.
                  </td>
                </tr>
              ) : paginatedEmployees.map((emp) => (
                <tr key={emp.id} className={`hover:bg-slate-50/50 transition-colors group ${selectedIds.includes(emp.id) ? 'bg-brand-50/30' : ''}`}>
                  {profile?.role === 'admin' && (
                    <td className="pl-10 py-6">
                      <input 
                        type="checkbox"
                        checked={selectedIds.includes(emp.id)}
                        onChange={() => toggleSelect(emp.id)}
                        className="w-5 h-5 rounded-lg border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                      />
                    </td>
                  )}
                  <td className={`${profile?.role === 'admin' ? 'px-4' : 'px-10'} py-6`}>
                    <div className="flex items-center gap-4">
                       <div className="h-14 w-14 rounded-[1.25rem] bg-brand-50 flex items-center justify-center text-brand-600 font-black text-xl transition-transform group-hover:scale-110">
                          {emp.name.charAt(0)}
                       </div>
                       <div>
                          <p className="font-black text-slate-900 text-base leading-none tracking-tight">{emp.name}</p>
                          <p className="text-[11px] text-slate-400 font-bold mt-1.5 uppercase tracking-widest">{emp.email}</p>
                       </div>
                    </div>
                  </td>
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-2 text-slate-600 font-black">
                       <Briefcase className="h-4 w-4 text-brand-400" />
                       {emp.position}
                    </div>
                  </td>
                  <td className="px-10 py-6">
                    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      emp.role === 'admin' ? "bg-office-slate-800 text-white" : "bg-slate-100 text-slate-500"
                    }`}>
                      {emp.role === 'admin' ? <ShieldCheck size={12} /> : <UserCheck size={12} />}
                      {emp.role}
                    </span>
                  </td>
                  <td className="px-10 py-6">
                    <div className="space-y-1.5">
                       <div className="flex items-center gap-2 text-[11px] text-slate-500 font-bold">
                          <Phone size={12} className="text-brand-500" /> {emp.contact}
                       </div>
                       <div className="flex items-center gap-2 text-[11px] text-slate-500 font-bold">
                          <Mail size={12} className="text-brand-500" /> {emp.email}
                       </div>
                    </div>
                  </td>
                  <td className="px-10 py-6 text-right">
                    {profile?.role === 'admin' && (
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEdit(emp)}
                          className="p-3 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          title="Edit"
                        >
                           <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(emp.id)}
                          className="p-3 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          title="Hapus"
                        >
                           <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View (Employees) */}
        <div className="md:hidden divide-y divide-office-border">
          {loading ? (
             [...Array(3)].map((_, i) => (
                <div key={i} className="p-6 space-y-4 animate-pulse">
                   <div className="flex items-center gap-4">
                      <div className="h-14 w-14 bg-slate-100 rounded-2xl"></div>
                      <div className="space-y-2">
                         <div className="h-6 w-32 bg-slate-100 rounded"></div>
                         <div className="h-4 w-48 bg-slate-100 rounded"></div>
                      </div>
                   </div>
                   <div className="h-12 w-full bg-slate-50 rounded-2xl"></div>
                </div>
             ))
          ) : paginatedEmployees.length === 0 ? (
             <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Tidak ada data karyawan.</div>
          ) : paginatedEmployees.map((emp) => (
             <div key={emp.id} className={`p-6 bg-white active:bg-slate-50 transition-all space-y-4 ${selectedIds.includes(emp.id) ? 'bg-brand-50/30' : ''}`}>
                <div className="flex items-start justify-between">
                   <div className="flex items-center gap-4">
                      {profile?.role === 'admin' && (
                        <div className="mr-2">
                           <input 
                              type="checkbox"
                              checked={selectedIds.includes(emp.id)}
                              onChange={() => toggleSelect(emp.id)}
                              className="w-6 h-6 rounded-xl border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                           />
                        </div>
                      )}
                      <div className="h-16 w-16 rounded-2xl bg-brand-100 flex items-center justify-center text-brand-600 font-black text-2xl">
                         {emp.name.charAt(0)}
                      </div>
                      <div>
                         <h3 className="font-black text-slate-900 text-lg leading-none tracking-tight mb-2">{emp.name}</h3>
                         <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                           emp.role === 'admin' ? "bg-office-slate-800 text-white" : "bg-slate-100 text-slate-500"
                         }`}>
                           {emp.role === 'admin' ? <ShieldCheck size={10} /> : <UserCheck size={10} />}
                           {emp.role}
                         </span>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                   <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <Briefcase className="h-5 w-5 text-brand-500" />
                      <div>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jabatan</p>
                         <p className="font-bold text-slate-700 text-sm">{emp.position}</p>
                      </div>
                   </div>
                   <div className="flex flex-col gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-2">
                         <Mail size={14} className="text-brand-500" />
                         <span className="text-xs font-bold text-slate-600 truncate">{emp.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                         <Phone size={14} className="text-brand-500" />
                         <span className="text-xs font-bold text-slate-600">{emp.contact}</span>
                      </div>
                   </div>
                </div>

                {profile?.role === 'admin' && (
                   <div className="flex gap-2 pt-2">
                      <button 
                         onClick={() => handleEdit(emp)}
                         className="flex-1 flex items-center justify-center gap-2 py-4 bg-office-gray text-slate-600 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all"
                      >
                         <Edit2 size={16} /> Edit Profile
                      </button>
                      <button 
                         onClick={() => handleDelete(emp.id)}
                         className="p-4 bg-rose-50 text-rose-500 rounded-2xl active:scale-95 transition-all"
                      >
                         <Trash2 size={18} />
                      </button>
                   </div>
                )}
             </div>
          ))}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-8 border-t border-office-border flex items-center justify-between gap-4">
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
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`hidden sm:flex h-10 w-10 items-center justify-center rounded-xl text-[10px] font-black transition-all ${
                      currentPage === i + 1 
                        ? "bg-brand-600 text-white shadow-lg shadow-brand-100" 
                        : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
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

        {/* Bulk Actions Sticky Bar (Mobile) */}
        <div className="md:hidden">
          <AnimatePresence>
            {selectedIds.length > 0 && (
              <motion.div 
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                exit={{ y: 100 }}
                className="fixed bottom-24 left-4 right-4 bg-white rounded-[2rem] shadow-2xl border border-office-border p-4 z-[90] flex items-center justify-between"
              >
                <div className="flex flex-col pl-4">
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{selectedIds.length} Terpilih</span>
                   <span className="font-black text-slate-900 leading-tight">Hapus Masal</span>
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
  );
}
