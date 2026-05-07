import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { supabase, InventoryItem, InventoryRequest, InventoryRequestType } from '../../lib/supabase';
import { 
  Package, 
  Search, 
  Filter, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  Archive,
  BarChart2,
  ArrowUpRight,
  XCircle,
  History,
  ClipboardList,
  User,
  Clock,
  Check,
  X,
  MessageSquare,
  Edit2,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '../../lib/utils';

type ActiveTab = 'items' | 'requests' | 'my-requests';
type ModalType = 'add-item' | 'borrow' | 'report-damage' | 'request-new' | 'request-detail';

export default function InventoryPage() {
  const { profile, isDemo, user } = useAuth();
  
  // Static check for demo mode
  const isDemoInitial = !import.meta.env.VITE_SUPABASE_URL || 
                        import.meta.env.VITE_SUPABASE_URL.includes('your-project-url') ||
                        import.meta.env.VITE_SUPABASE_URL.includes('placeholder') ||
                        import.meta.env.VITE_SUPABASE_URL === '';

  const [effectivelyDemo, setEffectivelyDemo] = useState(isDemoInitial);
  const [activeTab, setActiveTab] = useState<ActiveTab>('items');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [requests, setRequests] = useState<InventoryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalType, setModalType] = useState<ModalType | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<InventoryRequest | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState<{show: boolean, message: string}>({ show: false, message: '' });
  
  // Form States
  const [itemFormData, setItemFormData] = useState({
    name: '',
    quantity: 1,
    condition: 'Baik',
    location: ''
  });

  const [requestFormData, setRequestFormData] = useState({
    item_id: '',
    item_name: '',
    quantity: 1,
    reason: '',
    type: 'borrow' as InventoryRequestType
  });

  const [adminNote, setAdminNote] = useState('');

  useEffect(() => {
    fetchItems();
    fetchRequests();

    const handleSync = (event: MessageEvent) => {
      if (event.data?.type === 'REFRESH_INVENTORY' || event.data?.type === 'REFRESH_REQUESTS') {
        fetchItems();
        fetchRequests();
      }
    };

    const channel = new BroadcastChannel('officio_demo_sync');
    channel.onmessage = handleSync;

    return () => channel.close();
  }, [effectivelyDemo]);

  async function fetchItems() {
    setLoading(true);
    if (effectivelyDemo) {
      const stored = localStorage.getItem('officio_demo_inventory');
      if (stored) {
        setItems(JSON.parse(stored));
      } else {
        const initialItems = [
          { id: '1', name: 'Laptop Macbook Air M2', quantity: 15, condition: 'Baik', location: 'Gudang IT', updated_at: '2026-04-20T10:00:00' },
          { id: '2', name: 'Monitor Dell 24"', quantity: 30, condition: 'Baik', location: 'Gudang IT', updated_at: '2026-04-21T14:30:00' },
          { id: '3', name: 'Keyboard Logitech K120', quantity: 5, condition: 'Perlu Perbaikan', location: 'Gudang IT', updated_at: '2026-04-22T09:00:00' },
          { id: '4', name: 'Kursi Kantor Ergonomis', quantity: 45, condition: 'Baik', location: 'Area Kerja Utama', updated_at: '2026-04-25T11:00:00' },
          { id: '5', name: 'Proyektor BenQ', quantity: 2, condition: 'Rusak', location: 'Gudang Umum', updated_at: '2026-04-26T15:00:00' },
        ];
        localStorage.setItem('officio_demo_inventory', JSON.stringify(initialItems));
        setItems(initialItems);
      }
      setLoading(false);
      return;
    }

    try {
      const fetchPromise = supabase.from('inventory').select('*').order('updated_at', { ascending: false });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Fetch timeout')), 10000)
      );

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;
      
      if (error) {
        if (error.message && (error.message.includes('inventory') && error.message.includes('cache'))) {
          console.warn('Inventory table not found. Switching to Demo Mode.');
          setEffectivelyDemo(true);
          return;
        }
        throw error;
      }
      
      if (data) setItems(data);
    } catch (err) {
      console.error('Fetch failed, falling back to demo:', err);
      setEffectivelyDemo(true);
    } finally {
      setLoading(false);
    }
  }

  async function fetchRequests() {
    if (effectivelyDemo) {
      const stored = localStorage.getItem('officio_demo_inventory_requests');
      if (stored) {
        setRequests(JSON.parse(stored));
      } else {
        const initialRequests: InventoryRequest[] = [
          { 
            id: 'r1', 
            user_id: 'any-user', 
            user_name: 'Budi Santoso', 
            item_id: '1', 
            item_name: 'Laptop Macbook Air M2', 
            type: 'borrow', 
            quantity: 1, 
            reason: 'Untuk pengerjaan proyek desain di luar kantor', 
            status: 'pending', 
            created_at: new Date().toISOString() 
          },
          { 
            id: 'r2', 
            user_id: 'another-user', 
            user_name: 'Lia Ananda', 
            item_name: 'Headset Noise Cancelling', 
            type: 'new_item', 
            quantity: 2, 
            reason: 'Sangat dibutuhkan oleh tim customer service yang baru', 
            status: 'approved', 
            admin_note: 'Disetujui untuk dibeli minggu depan',
            created_at: new Date().toISOString() 
          }
        ];
        localStorage.setItem('officio_demo_inventory_requests', JSON.stringify(initialRequests));
        setRequests(initialRequests);
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from('inventory_requests')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (data) setRequests(data);
    } catch (e) {
      console.warn('Request fetch failed', e);
    }
  }

  const handleAddItem = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const itemData = {
      name: itemFormData.name,
      quantity: Number(itemFormData.quantity),
      condition: itemFormData.condition,
      location: itemFormData.location,
      updated_at: new Date().toISOString()
    };

    if (effectivelyDemo) {
      const stored = localStorage.getItem('officio_demo_inventory');
      let current = stored ? JSON.parse(stored) : [];
      
      if (editingItem) {
        current = current.map((i: any) => i.id === editingItem.id ? { ...i, ...itemData } : i);
        toast('Barang berhasil diperbarui!');
      } else {
        const newItemWithId = { id: Math.random().toString(36).substr(2, 9), ...itemData };
        current = [newItemWithId, ...current];
        toast('Barang berhasil ditambahkan!');
      }

      localStorage.setItem('officio_demo_inventory', JSON.stringify(current));
      new BroadcastChannel('officio_demo_sync').postMessage({ type: 'REFRESH_INVENTORY' });
      
      setModalType(null);
      setEditingItem(null);
      setItemFormData({ name: '', quantity: 1, condition: 'Baik', location: '' });
      setIsSubmitting(false);
      
      await fetchItems();
      return;
    }

    try {
      let error;
      if (editingItem) {
        const { error: err } = await supabase.from('inventory').update(itemData).eq('id', editingItem.id);
        error = err;
      } else {
        const { error: err } = await supabase.from('inventory').insert(itemData);
        error = err;
      }

      if (error) throw error;

      setModalType(null);
      setEditingItem(null);
      setItemFormData({ name: '', quantity: 1, condition: 'Baik', location: '' });
      setIsSubmitting(false);
      toast(editingItem ? 'Barang berhasil diperbarui!' : 'Barang berhasil ditambahkan!');
      await fetchItems();
    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes('inventory') && err.message.includes('cache')) {
        setEffectivelyDemo(true);
        toast('Kesalahan database, beralih ke Demo Mode. Silakan coba lagi.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    setIsSubmitting(true);
    
    if (effectivelyDemo) {
      const stored = localStorage.getItem('officio_demo_inventory');
      let current = stored ? JSON.parse(stored) : [];
      current = current.filter((i: any) => i.id !== deletingId);
      localStorage.setItem('officio_demo_inventory', JSON.stringify(current));
      new BroadcastChannel('officio_demo_sync').postMessage({ type: 'REFRESH_INVENTORY' });
      toast('Barang berhasil dihapus!');
      setDeletingId(null);
      setIsSubmitting(false);
      await fetchItems();
      return;
    }

    try {
      const { error } = await supabase.from('inventory').delete().eq('id', deletingId);
      if (error) throw error;
      
      toast('Barang berhasil dihapus!');
      setDeletingId(null);
      await fetchItems();
    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes('inventory') && err.message.includes('cache')) {
        setEffectivelyDemo(true);
        toast('Gagal menghapus: Database belum siap.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setItemFormData({
      name: item.name,
      quantity: item.quantity,
      condition: item.condition,
      location: item.location
    });
    setModalType('add-item');
  };

  const handleSubmitRequest = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const newRequest: Partial<InventoryRequest> = {
      user_id: user?.id || 'demo-user',
      user_name: profile?.full_name || 'Demo User',
      item_id: requestFormData.item_id || undefined,
      item_name: requestFormData.item_name,
      type: requestFormData.type,
      quantity: Number(requestFormData.quantity),
      reason: requestFormData.reason,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    if (effectivelyDemo) {
      const stored = localStorage.getItem('officio_demo_inventory_requests');
      const current = stored ? JSON.parse(stored) : [];
      const reqWithId = { id: 'req-' + Date.now(), ...newRequest };
      localStorage.setItem('officio_demo_inventory_requests', JSON.stringify([reqWithId, ...current]));
      new BroadcastChannel('officio_demo_sync').postMessage({ type: 'REFRESH_REQUESTS' });
      
      setModalType(null);
      resetRequestForm();
      setIsSubmitting(false);
      toast('Permintaan Anda telah terkirim!');
      
      await fetchRequests();
      return;
    }

    try {
      const { error } = await supabase.from('inventory_requests').insert(newRequest);
      if (error) throw error;
      
      setModalType(null);
      resetRequestForm();
      setIsSubmitting(false);
      toast('Permintaan Anda telah terkirim!');
      await fetchRequests();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (status: 'approved' | 'rejected') => {
    if (!selectedRequest) return;
    setIsSubmitting(true);

    if (effectivelyDemo) {
      const stored = localStorage.getItem('officio_demo_inventory_requests');
      let current = stored ? JSON.parse(stored) : [];
      current = current.map((r: any) => 
        r.id === selectedRequest.id ? { ...r, status, admin_note: adminNote } : r
      );
      localStorage.setItem('officio_demo_inventory_requests', JSON.stringify(current));
      new BroadcastChannel('officio_demo_sync').postMessage({ type: 'REFRESH_REQUESTS' });
      
      setModalType(null);
      setAdminNote('');
      setIsSubmitting(false);
      toast(`Permintaan telah di${status === 'approved' ? 'setujui' : 'tolak'}.`);
      
      await fetchRequests();
      return;
    }

    try {
      const { error } = await supabase
        .from('inventory_requests')
        .update({ status, admin_note: adminNote })
        .eq('id', selectedRequest.id);
      
      if (error) throw error;
      
      setModalType(null);
      setAdminNote('');
      setIsSubmitting(false);
      toast(`Permintaan telah di${status === 'approved' ? 'setujui' : 'tolak'}.`);
      await fetchRequests();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetRequestForm = () => {
    setRequestFormData({
      item_id: '',
      item_name: '',
      quantity: 1,
      reason: '',
      type: 'borrow'
    });
  };

  const toast = (message: string) => {
    setShowSuccessToast({ show: true, message });
    setTimeout(() => setShowSuccessToast({ show: false, message: '' }), 3000);
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRequests = profile?.role === 'admin' 
    ? requests 
    : requests.filter(r => r.user_id === user?.id);

  return (
    <div className="space-y-8">
      {/* Success Toast */}
      {showSuccessToast.show && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-office-slate-800 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-white/10">
            <CheckCircle2 className="h-5 w-5 text-green-400" />
            <span className="text-sm font-bold">{showSuccessToast.message}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Inventaris</h1>
          <p className="text-gray-500 font-medium">Manajemen aset dan perlengkapan operasional kantor.</p>
        </div>
        <div className="flex gap-2">
            {profile?.role !== 'admin' && (
              <button 
                  onClick={() => {
                    resetRequestForm();
                    setRequestFormData(prev => ({ ...prev, type: 'new_item' }));
                    setModalType('request-new');
                  }}
                  className="flex items-center gap-2 bg-white border border-office-border text-slate-700 px-5 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm"
              >
                  <Plus className="h-5 w-5" /> Request Baru
              </button>
            )}
            {profile?.role === 'admin' && (
            <button 
                onClick={() => setModalType('add-item')}
                className="flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-100"
            >
                <Package className="h-5 w-5" /> Tambah Barang
            </button>
            )}
        </div>
      </div>

      {/* Custom Tabs */}
      <div className="flex p-1.5 bg-office-gray rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('items')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
            activeTab === 'items' ? "bg-white text-brand-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Archive className="h-4 w-4" /> Daftar Barang
        </button>
        <button 
          onClick={() => setActiveTab('requests')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
            activeTab === 'requests' ? "bg-white text-brand-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <ClipboardList className="h-4 w-4" /> {profile?.role === 'admin' ? 'Manajemen Permintaan' : 'Permintaan Saya'}
          {profile?.role === 'admin' && requests.filter(r => r.status === 'pending').length > 0 && (
            <span className="bg-rose-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full ml-1">
                {requests.filter(r => r.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'items' ? (
        <>
          {/* Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-office-border flex items-center gap-4">
               <div className="bg-brand-50 p-4 rounded-2xl text-brand-600"><BarChart2 className="h-6 w-6" /></div>
               <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Total Aset</p>
                  <p className="text-2xl font-black text-gray-900">{items.reduce((acc, curr) => acc + curr.quantity, 0)} Unit</p>
               </div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-office-border flex items-center gap-4">
               <div className="bg-rose-50 p-4 rounded-2xl text-rose-600"><AlertTriangle className="h-6 w-6" /></div>
               <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Kondisi Buruk</p>
                  <p className="text-2xl font-black text-gray-900">{items.filter(i => i.condition !== 'Baik').length} Kategori</p>
               </div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-office-border flex items-center gap-4">
               <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600"><History className="h-6 w-6" /></div>
               <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Dipinjam Saat Ini</p>
                  <p className="text-2xl font-black text-gray-900">{requests.filter(r => r.type === 'borrow' && r.status === 'approved').length} Unit</p>
               </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-office-border shadow-sm overflow-hidden">
            <div className="p-8 border-b border-office-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                 <input 
                    type="text" 
                    placeholder="Cari nama barang..." 
                    className="w-full pl-10 pr-4 py-2 bg-office-gray border border-office-border rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                 />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-office-gray">
                    <th className="px-8 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Nama Barang</th>
                    <th className="px-8 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs text-center">Tersedia</th>
                    <th className="px-8 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Kondisi</th>
                    <th className="px-8 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Lokasi</th>
                    <th className="px-8 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-office-border text-sm">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                           <div className="bg-brand-50 p-2 rounded-lg text-brand-600"><Package className="h-5 w-5" /></div>
                           <span className="font-bold text-gray-900">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <span className="font-black text-gray-700">{item.quantity}</span>
                      </td>
                      <td className="px-8 py-5">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-xs font-bold",
                          item.condition === 'Baik' ? "bg-green-100 text-green-700" :
                          item.condition === 'Rusak' ? "bg-rose-100 text-rose-700" :
                          "bg-amber-100 text-amber-700"
                        )}>
                          {item.condition}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-gray-600 font-medium">{item.location}</span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex gap-2 justify-end">
                            {profile?.role === 'admin' ? (
                              <>
                                <button 
                                    onClick={() => handleEditItem(item)}
                                    className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors cursor-pointer"
                                >
                                    <Edit2 size={14} /> Edit
                                </button>
                                <button 
                                    onClick={() => setDeletingId(item.id)}
                                    className="flex items-center gap-1.5 bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-100 transition-colors cursor-pointer"
                                >
                                    <Trash2 size={14} /> Hapus
                                </button>
                              </>
                            ) : (
                              <>
                                <button 
                                    onClick={() => {
                                        setSelectedItem(item);
                                        resetRequestForm();
                                        setRequestFormData(prev => ({ ...prev, item_id: item.id, item_name: item.name, type: 'borrow' }));
                                        setModalType('borrow');
                                    }}
                                    disabled={item.quantity === 0 || item.condition === 'Rusak'}
                                    className="flex items-center gap-1.5 bg-office-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black transition-colors disabled:opacity-50"
                                >
                                    <History size={14} /> Pinjam
                                </button>
                                <button 
                                    onClick={() => {
                                        setSelectedItem(item);
                                        resetRequestForm();
                                        setRequestFormData(prev => ({ ...prev, item_id: item.id, item_name: item.name, type: 'report_damage' }));
                                        setModalType('report-damage');
                                    }}
                                    className="flex items-center gap-1.5 bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-100 transition-colors"
                                >
                                    <AlertTriangle size={14} /> Lapor
                                </button>
                              </>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-3xl border border-office-border shadow-sm overflow-hidden">
             <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-office-gray">
                    <th className="px-8 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Tgl Pengajuan</th>
                    <th className="px-8 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Tipe</th>
                    <th className="px-8 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Barang</th>
                    <th className="px-8 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Pemohon</th>
                    <th className="px-8 py-4 font-bold text-gray-500 uppercase tracking-wider text-xs">Status</th>
                    <th className="px-8 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-office-border text-sm">
                  {filteredRequests.length === 0 ? (
                    <tr>
                         <td colSpan={6} className="px-8 py-20 text-center text-gray-400 font-medium">Belum ada data permintaan.</td>
                    </tr>
                  ) : filteredRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-8 py-5 font-medium text-gray-500">
                        {format(new Date(req.created_at), 'dd MMM yyyy')}
                      </td>
                      <td className="px-8 py-5">
                         <span className={cn(
                             "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                             req.type === 'borrow' ? "bg-blue-50 text-blue-600" :
                             req.type === 'new_item' ? "bg-indigo-50 text-indigo-600" :
                             "bg-rose-50 text-rose-600"
                         )}>
                             {req.type === 'borrow' ? 'Pinjam' : req.type === 'new_item' ? 'Request Baru' : 'Lapor Rusak'}
                         </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                            <span className="font-bold text-gray-900">{req.item_name}</span>
                            <span className="text-[10px] text-gray-400 font-bold">{req.quantity} Unit</span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                             <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><User size={14}/></div>
                             <span className="font-bold text-gray-700">{req.user_name}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                         <span className={cn(
                             "flex items-center gap-1.5 font-black uppercase tracking-tighter text-[10px]",
                             req.status === 'pending' ? "text-amber-500" :
                             req.status === 'approved' ? "text-green-500" : "text-rose-500"
                         )}>
                             {req.status === 'pending' ? <Clock size={12}/> : req.status === 'approved' ? <Check size={12}/> : <X size={12}/>}
                             {req.status === 'pending' ? 'Menunggu' : req.status === 'approved' ? 'Disetujui' : 'Ditolak'}
                         </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                         <button 
                            onClick={() => {
                                setSelectedRequest(req);
                                setAdminNote(req.admin_note || '');
                                setModalType('request-detail');
                            }}
                            className="bg-office-gray hover:bg-slate-200 p-2 rounded-lg transition-colors"
                         >
                            <ArrowUpRight size={16} />
                         </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
             </div>
        </div>
      )}

      {/* Item Action Modals */}
      {modalType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-8 border-b border-office-border flex justify-between items-center bg-office-gray">
                    <div>
                        <h2 className="text-xl font-black text-office-slate-800 uppercase tracking-tight">
                            {modalType === 'add-item' && (editingItem ? 'Edit Barang' : 'Tambah Barang Baru')}
                            {modalType === 'borrow' && 'Pengajuan Pinjam'}
                            {modalType === 'report-damage' && 'Lapor Barang Rusak'}
                            {modalType === 'request-new' && 'Request Barang Baru'}
                            {modalType === 'request-detail' && 'Detail Permintaan'}
                        </h2>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Form Inventaris</p>
                    </div>
                    <button onClick={() => {
                        setModalType(null);
                        setEditingItem(null);
                        setItemFormData({ name: '', quantity: 1, condition: 'Baik', location: '' });
                    }} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8">
                    {modalType === 'add-item' ? (
                        <form onSubmit={handleAddItem} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nama Barang</label>
                                <input required value={itemFormData.name} onChange={e => setItemFormData({...itemFormData, name: e.target.value})} className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500" placeholder="Monitor LG 27 Inch"/>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Jumlah</label>
                                    <input required type="number" min="1" value={itemFormData.quantity} onChange={e => setItemFormData({...itemFormData, quantity: parseInt(e.target.value)})} className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Kondisi</label>
                                    <select value={itemFormData.condition} onChange={e => setItemFormData({...itemFormData, condition: e.target.value})} className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500">
                                        <option value="Baik">Baik</option>
                                        <option value="Perlu Perbaikan">Perlu Perbaikan</option>
                                        <option value="Rusak">Rusak</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Lokasi</label>
                                <input required value={itemFormData.location} onChange={e => setItemFormData({...itemFormData, location: e.target.value})} className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500" placeholder="Gudang IT"/>
                            </div>
                            <button disabled={isSubmitting} type="submit" className="w-full bg-brand-600 text-white font-black uppercase tracking-tight py-4 rounded-2xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-100 disabled:opacity-50">
                                {isSubmitting ? 'Memproses...' : 'Simpan Barang'}
                            </button>
                        </form>
                    ) : modalType === 'request-detail' ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-office-gray p-4 rounded-2xl">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Pemohon</p>
                                    <p className="font-bold text-gray-900">{selectedRequest?.user_name}</p>
                                </div>
                                <div className="bg-office-gray p-4 rounded-2xl">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Status</p>
                                    <p className={cn(
                                        "font-bold uppercase text-xs",
                                        selectedRequest?.status === 'pending' ? 'text-amber-500' : 
                                        selectedRequest?.status === 'approved' ? 'text-green-500' : 'text-rose-500'
                                    )}>{selectedRequest?.status === 'pending' ? 'Menunggu' : selectedRequest?.status === 'approved' ? 'Disetujui' : 'Ditolak'}</p>
                                </div>
                            </div>
                            <div className="bg-office-gray p-5 rounded-2xl">
                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Barang & Kebutuhan</p>
                                <p className="font-bold text-gray-900 text-lg leading-tight">{selectedRequest?.item_name}</p>
                                <p className="text-sm font-bold text-brand-600 mt-1">Jumlah: {selectedRequest?.quantity} Unit</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 flex items-center gap-2"><MessageSquare size={12}/> Alasan Pengajuan</p>
                                <div className="bg-slate-50 p-4 rounded-2xl border border-office-border italic text-slate-600 text-sm">
                                    "{selectedRequest?.reason}"
                                </div>
                            </div>
                            
                            {profile?.role === 'admin' && selectedRequest?.status === 'pending' ? (
                                <div className="space-y-4 pt-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Catatan Admin</label>
                                        <textarea 
                                            value={adminNote}
                                            onChange={e => setAdminNote(e.target.value)}
                                            placeholder="Berikan alasan persetujuan atau penolakan..."
                                            className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500 h-24"
                                        />
                                    </div>
                                    <div className="flex gap-3">
                                        <button 
                                            onClick={() => handleUpdateStatus('rejected')}
                                            disabled={isSubmitting}
                                            className="flex-1 bg-rose-50 text-rose-600 font-bold uppercase py-4 rounded-2xl hover:bg-rose-100 transition-all border border-rose-100 disabled:opacity-50"
                                        >
                                            Tolak
                                        </button>
                                        <button 
                                            onClick={() => handleUpdateStatus('approved')}
                                            disabled={isSubmitting}
                                            className="flex-3 bg-green-600 text-white font-bold uppercase py-4 rounded-2xl hover:bg-green-700 transition-all shadow-lg shadow-green-100 disabled:opacity-50"
                                        >
                                            Setujui
                                        </button>
                                    </div>
                                </div>
                            ) : selectedRequest?.admin_note && (
                                <div className="pt-4 border-t border-office-border">
                                     <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Catatan Admin</p>
                                     <div className="bg-brand-50/50 p-4 rounded-2xl text-brand-700 text-sm font-bold">
                                         {selectedRequest.admin_note}
                                     </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmitRequest} className="space-y-5">
                            <div className="bg-brand-50 p-4 rounded-2xl border border-brand-100 mb-6">
                                <p className="text-[10px] font-bold text-brand-400 uppercase mb-1">Barang Yang Dipilih</p>
                                <p className="font-bold text-brand-900">
                                    {modalType === 'request-new' ? 'Pengajuan Barang Baru (Belum ada di aset)' : requestFormData.item_name}
                                </p>
                            </div>

                            {modalType === 'request-new' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nama Barang Yang Diminta</label>
                                    <input required value={requestFormData.item_name} onChange={e => setRequestFormData({...requestFormData, item_name: e.target.value})} className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500" placeholder="Contoh: Meja Lipat X4"/>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Jumlah Unit</label>
                                <input required type="number" min="1" max={modalType === 'borrow' ? (selectedItem?.quantity || 1) : 100} value={requestFormData.quantity} onChange={e => setRequestFormData({...requestFormData, quantity: parseInt(e.target.value)})} className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500"/>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Alasan & Detail</label>
                                <textarea required value={requestFormData.reason} onChange={e => setRequestFormData({...requestFormData, reason: e.target.value})} className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500 h-28" placeholder={modalType === 'report-damage' ? "Jelaskan kronologi kerusakan..." : "Kenapa Anda membutuhkan barang ini?"}/>
                            </div>

                            <button disabled={isSubmitting} type="submit" className="w-full bg-office-slate-800 text-white font-black uppercase tracking-tight py-4 rounded-2xl hover:bg-black transition-all shadow-xl disabled:opacity-50">
                                {isSubmitting ? 'Memproses...' : 'Kirim Pengajuan'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
          </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-sm shadow-2xl p-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center">
                <Trash2 size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight">Hapus Barang?</h3>
                <p className="text-sm font-medium text-gray-500 mt-2">
                  Tindakan ini tidak dapat dibatalkan. Apakah Anda yakin ingin menghapus barang ini?
                </p>
              </div>
              <div className="flex w-full gap-3 mt-6">
                <button 
                  onClick={() => setDeletingId(null)}
                  className="flex-1 bg-office-gray text-slate-700 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-tight"
                >
                  Batal
                </button>
                <button 
                  onClick={confirmDelete}
                  disabled={isSubmitting}
                  className="flex-1 bg-rose-600 text-white font-bold py-4 rounded-2xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 uppercase tracking-tight disabled:opacity-50"
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
