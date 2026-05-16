import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { supabase, InventoryItem, InventoryRequest, InventoryRequestType } from '../../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
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
  Trash2,
  FileDown,
  Upload,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import * as XLSX from 'xlsx';

type ActiveTab = 'items' | 'requests' | 'my-requests';
type ModalType = 'add-item' | 'borrow' | 'report-damage' | 'request-new' | 'request-detail' | 'import-excel';

export default function InventoryPage() {
  const { profile, isDemo, user, loading: authLoading } = useAuth();
  
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pagination State
  const [currentPageItems, setCurrentPageItems] = useState(1);
  const [currentPageRequests, setCurrentPageRequests] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    setSelectedIds([]);
    setSelectedRequestIds([]);
  }, [activeTab]);

  // Toggle single selection items
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Toggle select all items
  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedItems.map(i => i.id));
    }
  };

  // Selection Requests
  const toggleSelectRequest = (id: string) => {
    setSelectedRequestIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAllRequests = () => {
    if (selectedRequestIds.length === paginatedRequests.length) {
      setSelectedRequestIds([]);
    } else {
      setSelectedRequestIds(paginatedRequests.map(r => r.id));
    }
  };

  // Bulk delete selected items
  const handleBulkDelete = async () => {
    if (!profile || profile.role !== 'admin' || selectedIds.length === 0) return;
    
    const confirmMsg = `Hapus ${selectedIds.length} barang terpilih?`;
    if (!window.confirm(confirmMsg)) return;

    setIsSubmitting(true);
    try {
      if (effectivelyDemo) {
        const remaining = items.filter(i => !selectedIds.includes(i.id));
        localStorage.setItem('officio_demo_inventory', JSON.stringify(remaining));
        new BroadcastChannel('officio_demo_sync').postMessage({ type: 'REFRESH_INVENTORY' });
      } else {
        const { error } = await supabase.from('inventory').delete().in('id', selectedIds);
        if (error) throw error;
      }
      
      toast(`${selectedIds.length} barang berhasil dihapus!`);
      setSelectedIds([]);
      await fetchItems();
    } catch (err) {
      console.error(err);
      toast('Gagal menghapus beberapa barang.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bulk delete selected requests
  const handleBulkDeleteRequests = async () => {
    if (!profile || profile.role !== 'admin' || selectedRequestIds.length === 0) return;
    
    const confirmMsg = `Hapus ${selectedRequestIds.length} permintaan terpilih?`;
    if (!window.confirm(confirmMsg)) return;

    setIsSubmitting(true);
    try {
      if (effectivelyDemo) {
        const remaining = requests.filter(r => !selectedRequestIds.includes(r.id));
        localStorage.setItem('officio_demo_inventory_requests', JSON.stringify(remaining));
        new BroadcastChannel('officio_demo_sync').postMessage({ type: 'REFRESH_REQUIRED' });
      } else {
        const { error } = await supabase.from('inventory_requests').delete().in('id', selectedRequestIds);
        if (error) throw error;
      }
      
      toast(`${selectedRequestIds.length} permintaan berhasil dihapus!`);
      setSelectedRequestIds([]);
      await fetchRequests();
    } catch (err) {
      console.error(err);
      toast('Gagal menghapus beberapa permintaan.');
    } finally {
      setIsSubmitting(false);
    }
  };
  const [showSuccessToast, setShowSuccessToast] = useState<{show: boolean, message: string}>({ show: false, message: '' });
  const [importData, setImportData] = useState<any[]>([]);
  
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
    type: 'borrow' as InventoryRequestType,
    borrow_start_date: '',
    borrow_end_date: ''
  });

  const [adminNote, setAdminNote] = useState('');

  useEffect(() => {
    if (!authLoading) {
      fetchItems();
      fetchRequests();
    }

    const handleSync = (event: MessageEvent) => {
      if ((event.data?.type === 'REFRESH_INVENTORY' || event.data?.type === 'REFRESH_REQUESTS') && !authLoading) {
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
    if (effectivelyDemo || isDemo) {
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
        setTimeout(() => reject(new Error('Fetch timeout')), 4000)
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
    if (effectivelyDemo || isDemo) {
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
            borrow_start_date: '2026-05-10',
            borrow_end_date: '2026-05-15',
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

  const confirmDeleteAll = async () => {
    if (!profile || profile.role !== 'admin') return;
    setIsSubmitting(true);
    
    if (effectivelyDemo) {
      localStorage.setItem('officio_demo_inventory', JSON.stringify([]));
      new BroadcastChannel('officio_demo_sync').postMessage({ type: 'REFRESH_INVENTORY' });
      toast('Semua barang berhasil dihapus!');
      setIsDeletingAll(false);
      setIsSubmitting(false);
      await fetchItems();
      return;
    }

    try {
      const { error } = await supabase.from('inventory').delete().neq('id', '0'); // Delete all rows
      if (error) throw error;
      
      toast('Semua barang berhasil dihapus!');
      setIsDeletingAll(false);
      await fetchItems();
    } catch (err) {
      console.error(err);
      toast('Gagal menghapus semua barang.');
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
    
    // Validate quantity for borrow requests
    if (requestFormData.type === 'borrow' && selectedItem) {
      if (Number(requestFormData.quantity) > selectedItem.quantity) {
        toast(`Stok tidak mencukupi. Tersedia: ${selectedItem.quantity}`);
        return;
      }
    }

    setIsSubmitting(true);

    const newRequest: Partial<InventoryRequest> = {
      user_id: user?.id || 'demo-user',
      user_name: profile?.full_name || 'Demo User',
      item_id: requestFormData.item_id || undefined,
      item_name: requestFormData.item_name,
      type: requestFormData.type,
      quantity: Number(requestFormData.quantity),
      reason: requestFormData.reason,
      borrow_start_date: requestFormData.type === 'borrow' ? requestFormData.borrow_start_date : undefined,
      borrow_end_date: requestFormData.type === 'borrow' ? requestFormData.borrow_end_date : undefined,
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
      const storedItems = localStorage.getItem('officio_demo_inventory');
      let currentItems = storedItems ? JSON.parse(storedItems) : [];

      // If approved and type is borrow, decrement inventory quantity
      if (status === 'approved' && selectedRequest.type === 'borrow') {
        const itemIndex = currentItems.findIndex((i: InventoryItem) => i.id === selectedRequest.item_id);
        if (itemIndex !== -1) {
          if (currentItems[itemIndex].quantity < selectedRequest.quantity) {
            toast('Stok tidak cukup untuk menyetujui peminjaman ini.');
            setIsSubmitting(false);
            return;
          }
          currentItems[itemIndex].quantity -= selectedRequest.quantity;
          localStorage.setItem('officio_demo_inventory', JSON.stringify(currentItems));
          new BroadcastChannel('officio_demo_sync').postMessage({ type: 'REFRESH_INVENTORY' });
        }
      }

      const storedRequests = localStorage.getItem('officio_demo_inventory_requests');
      let currentRequests = storedRequests ? JSON.parse(storedRequests) : [];
      currentRequests = currentRequests.map((r: any) => 
        r.id === selectedRequest.id ? { ...r, status, admin_note: adminNote } : r
      );
      localStorage.setItem('officio_demo_inventory_requests', JSON.stringify(currentRequests));
      new BroadcastChannel('officio_demo_sync').postMessage({ type: 'REFRESH_REQUESTS' });
      
      setModalType(null);
      setAdminNote('');
      setIsSubmitting(false);
      toast(`Permintaan telah di${status === 'approved' ? 'setujui' : 'tolak'}.`);
      
      await fetchItems();
      await fetchRequests();
      return;
    }

    try {
      // If approved and type is borrow, decrement inventory quantity in Supabase
      if (status === 'approved' && selectedRequest.type === 'borrow' && selectedRequest.item_id) {
        // Fetch current quantity first to be safe
        const { data: itemData, error: itemError } = await supabase
          .from('inventory')
          .select('quantity')
          .eq('id', selectedRequest.item_id)
          .single();
        
        if (itemError) throw itemError;
        
        if (itemData.quantity < selectedRequest.quantity) {
          toast('Stok tidak cukup untuk menyetujui peminjaman ini.');
          setIsSubmitting(false);
          return;
        }

        const { error: updateItemError } = await supabase
          .from('inventory')
          .update({ quantity: itemData.quantity - selectedRequest.quantity })
          .eq('id', selectedRequest.item_id);
        
        if (updateItemError) throw updateItemError;
      }

      const { error } = await supabase
        .from('inventory_requests')
        .update({ status, admin_note: adminNote })
        .eq('id', selectedRequest.id);
      
      if (error) throw error;
      
      setModalType(null);
      setAdminNote('');
      setIsSubmitting(false);
      toast(`Permintaan telah di${status === 'approved' ? 'setujui' : 'tolak'}.`);
      await fetchItems();
      await fetchRequests();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnItem = async () => {
    if (!selectedRequest || selectedRequest.type !== 'borrow' || selectedRequest.status !== 'approved') return;
    setIsSubmitting(true);

    if (effectivelyDemo) {
      const storedItems = localStorage.getItem('officio_demo_inventory');
      let currentItems = storedItems ? JSON.parse(storedItems) : [];
      
      const itemIndex = currentItems.findIndex((i: InventoryItem) => i.id === selectedRequest.item_id);
      if (itemIndex !== -1) {
        currentItems[itemIndex].quantity += selectedRequest.quantity;
        localStorage.setItem('officio_demo_inventory', JSON.stringify(currentItems));
      }

      const storedRequests = localStorage.getItem('officio_demo_inventory_requests');
      let currentRequests = storedRequests ? JSON.parse(storedRequests) : [];
      currentRequests = currentRequests.map((r: any) => 
        r.id === selectedRequest.id ? { ...r, status: 'returned' } : r
      );
      localStorage.setItem('officio_demo_inventory_requests', JSON.stringify(currentRequests));
      
      new BroadcastChannel('officio_demo_sync').postMessage({ type: 'REFRESH_INVENTORY' });
      new BroadcastChannel('officio_demo_sync').postMessage({ type: 'REFRESH_REQUESTS' });

      setModalType(null);
      setIsSubmitting(false);
      toast('Barang telah dikembalikan ke stok.');
      await fetchItems();
      await fetchRequests();
      return;
    }

    try {
      if (selectedRequest.item_id) {
        const { data: itemData, error: itemError } = await supabase
          .from('inventory')
          .select('quantity')
          .eq('id', selectedRequest.item_id)
          .single();
        if (itemError) throw itemError;

        await supabase
          .from('inventory')
          .update({ quantity: (itemData?.quantity || 0) + selectedRequest.quantity })
          .eq('id', selectedRequest.item_id);
      }

      await supabase
        .from('inventory_requests')
        .update({ status: 'returned' })
        .eq('id', selectedRequest.id);

      setModalType(null);
      setIsSubmitting(false);
      toast('Barang telah dikembalikan ke stok.');
      await fetchItems();
      await fetchRequests();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      { 'Nama Barang': 'Laptop Macbook Air M2', 'Jumlah': 10, 'Kondisi': 'Baik', 'Lokasi': 'Gudang IT' },
      { 'Nama Barang': 'Monitor LG 24"', 'Jumlah': 5, 'Kondisi': 'Baik', 'Lokasi': 'Gudang IT' }
    ];
    
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Inventaris");
    XLSX.writeFile(wb, "Template_Inventaris_OfficeFlow.xlsx");
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
        name: row['Nama Barang'] || row['name'] || row['Nama'],
        quantity: parseInt(row['Jumlah'] || row['quantity'] || row['Qty'] || 0),
        condition: row['Kondisi'] || row['condition'] || 'Baik',
        location: row['Lokasi'] || row['location'] || 'Gudang IT',
        updated_at: new Date().toISOString()
      })).filter(item => item.name);

      if (effectivelyDemo) {
        const stored = localStorage.getItem('officio_demo_inventory');
        let current = stored ? JSON.parse(stored) : [];
        
        const newData = formattedData.map(item => ({
          id: Math.random().toString(36).substr(2, 9),
          ...item
        }));
        
        current = [...newData, ...current];
        localStorage.setItem('officio_demo_inventory', JSON.stringify(current));
        new BroadcastChannel('officio_demo_sync').postMessage({ type: 'REFRESH_INVENTORY' });
        toast(`${newData.length} Barang berhasil diimport!`);
      } else {
        const { error } = await supabase.from('inventory').insert(formattedData);
        if (error) throw error;
        toast(`${formattedData.length} Barang berhasil diimport!`);
      }
      
      setModalType(null);
      setImportData([]);
      await fetchItems();
    } catch (err) {
      console.error(err);
      toast('Gagal mengimport data. Pastikan format kolom benar.');
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
      type: 'borrow',
      borrow_start_date: '',
      borrow_end_date: ''
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

  // Pagination Logic - Items
  const totalPagesItems = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPageItems - 1) * itemsPerPage,
    currentPageItems * itemsPerPage
  );

  // Pagination Logic - Requests
  const totalPagesRequests = Math.ceil(filteredRequests.length / itemsPerPage);
  const paginatedRequests = filteredRequests.slice(
    (currentPageRequests - 1) * itemsPerPage,
    currentPageRequests * itemsPerPage
  );

  useEffect(() => {
    setCurrentPageItems(1);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPageRequests(1);
  }, [activeTab]);

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
              <div className="flex gap-2">
                <button 
                    onClick={downloadTemplate}
                    className="flex items-center gap-2 bg-white border border-office-border text-slate-700 px-4 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm group"
                    title="Unduh Template Excel"
                >
                    <FileDown className="h-5 w-5 text-slate-400 group-hover:text-slate-600" /> 
                    <span className="hidden sm:inline">Template</span>
                </button>
                <button 
                    onClick={() => {
                        setImportData([]);
                        setModalType('import-excel');
                    }}
                    className="flex items-center gap-2 bg-white border border-office-border text-slate-700 px-4 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm group"
                    title="Import dari Excel"
                >
                    <Upload className="h-5 w-5 text-slate-400 group-hover:text-slate-600" />
                    <span className="hidden sm:inline">Import Excel</span>
                </button>
                <button 
                    onClick={() => setModalType('add-item')}
                    className="flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-100"
                >
                    <Package className="h-5 w-5" /> <span className="hidden sm:inline">Tambah Barang</span><span className="sm:hidden">Tambah</span>
                </button>
              </div>
            )}
        </div>
      </div>

      {/* Delete All Confirmation Modal */}
      {isDeletingAll && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl relative"
          >
            <button 
                onClick={() => setIsDeletingAll(false)}
                className="absolute top-6 right-6 p-2 h-10 w-10 flex items-center justify-center bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 transition-all active:scale-95"
            >
                <X size={20} />
            </button>
            <div className="mb-6 text-center">
              <div className="bg-rose-50 w-20 h-20 rounded-[2rem] flex items-center justify-center text-rose-500 mx-auto mb-4">
                <Trash2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 leading-tight">Hapus Semua?</h3>
              <p className="text-slate-500 font-bold mt-2">Data barang tidak dapat dikembalikan setelah dihapus.</p>
            </div>
            <div className="flex flex-col gap-3">
              <button 
                onClick={confirmDeleteAll}
                disabled={isSubmitting}
                className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50"
              >
                Ya, Hapus Semua
              </button>
              <button 
                onClick={() => setIsDeletingAll(false)}
                className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
              >
                Batal
              </button>
            </div>
          </motion.div>
        </div>
      )}

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
                  <p className="text-2xl font-black text-gray-900">
                    {(items.reduce((acc, curr) => acc + curr.quantity, 0) + 
                      requests.filter(r => r.type === 'borrow' && r.status === 'approved').reduce((acc, curr) => acc + curr.quantity, 0)
                    )} Unit
                  </p>
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
                  <p className="text-2xl font-black text-gray-900">{requests.filter(r => r.type === 'borrow' && r.status === 'approved').reduce((acc, curr) => acc + curr.quantity, 0)} Unit</p>
               </div>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-office-border shadow-sm overflow-hidden mb-safe">
            <div className="p-8 lg:px-10 border-b border-office-border flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="relative flex-1 max-w-md w-full">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                 <input 
                    type="text" 
                    placeholder="Cari nama barang..." 
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all placeholder:text-slate-300"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                 />
              </div>
              <div className="flex gap-2">
                 <button className="flex-1 md:flex-none flex items-center justify-center gap-2 h-12 px-6 bg-slate-50 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all active:scale-95">
                    <Filter size={16} /> Filter
                 </button>
                 {profile?.role === 'admin' && selectedIds.length > 0 && (
                    <button 
                      onClick={handleBulkDelete}
                      className="hidden md:flex flex-1 md:flex-none items-center justify-center gap-2 h-12 px-6 bg-rose-600 rounded-2xl text-xs font-black uppercase tracking-widest text-white hover:bg-rose-700 transition-all active:scale-95 shadow-lg shadow-rose-100"
                    >
                      <Trash2 size={16} /> Hapus Terpilih ({selectedIds.length})
                    </button>
                 )}
                 {profile?.role === 'admin' && filteredItems.length > 0 && selectedIds.length === 0 && (
                    <button 
                      onClick={() => setIsDeletingAll(true)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 h-12 px-6 bg-rose-50 rounded-2xl text-xs font-black uppercase tracking-widest text-rose-500 hover:bg-rose-100 transition-all active:scale-95"
                    >
                      <Trash2 size={16} /> Hapus Semua
                    </button>
                 )}
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
                          checked={selectedIds.length === filteredItems.length && filteredItems.length > 0}
                          onChange={toggleSelectAll}
                          className="w-5 h-5 rounded-lg border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                        />
                      </th>
                    )}
                    <th className={cn("py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]", profile?.role !== 'admin' && "pl-10")}>Nama Barang</th>
                    <th className="px-10 py-5 font-black text-slate-400 font-black uppercase tracking-widest text-[10px] text-center">Stok</th>
                    <th className="px-10 py-5 font-black text-slate-400 font-black uppercase tracking-widest text-[10px]">Kondisi</th>
                    <th className="px-10 py-5 font-black text-slate-400 font-black uppercase tracking-widest text-[10px]">Lokasi</th>
                    <th className="px-10 py-5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-office-border text-sm">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={`skeleton-items-${i}`} className="animate-pulse">
                        <td className="px-10 py-6 h-20" colSpan={6}><div className="h-4 w-full bg-slate-100 rounded-full"></div></td>
                      </tr>
                    ))
                  ) : paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-10 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Belum ada data barang.</td>
                    </tr>
                  ) : paginatedItems.map((item) => (
                    <tr key={item.id} className={cn("group hover:bg-slate-50/50 transition-colors", selectedIds.includes(item.id) && "bg-brand-50/30")}>
                      {profile?.role === 'admin' && (
                        <td className="pl-10 py-6">
                          <input 
                            type="checkbox" 
                            checked={selectedIds.includes(item.id)}
                            onChange={() => toggleSelect(item.id)}
                            className="w-5 h-5 rounded-lg border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className={cn("py-6", profile?.role !== 'admin' && "pl-10")}>
                        <div className="flex items-center gap-4">
                           <div className="bg-brand-50 p-3 rounded-2xl text-brand-600 group-hover:scale-110 transition-transform"><Package size={20} /></div>
                           <span className="font-black text-slate-900 text-base tracking-tight">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-10 py-6 text-center">
                        <span className="font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">{item.quantity}</span>
                      </td>
                      <td className="px-10 py-6">
                        <span className={cn(
                          "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                          item.condition === 'Baik' ? "bg-emerald-50 text-emerald-600" :
                          item.condition === 'Rusak' ? "bg-rose-50 text-rose-600" :
                          "bg-amber-50 text-amber-600"
                        )}>
                          {item.condition}
                        </span>
                      </td>
                      <td className="px-10 py-6">
                        <span className="text-slate-500 font-bold">{item.location}</span>
                      </td>
                      <td className="px-10 py-6 text-right">
                        <div className="flex gap-3 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            {profile?.role === 'admin' ? (
                              <>
                                <button 
                                    onClick={() => handleEditItem(item)}
                                    className="p-2.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                >
                                    <Edit2 size={18} />
                                </button>
                                <button 
                                    onClick={() => setDeletingId(item.id)}
                                    className="p-2.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                >
                                    <Trash2 size={18} />
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
                                    className="px-5 py-2.5 bg-office-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95 disabled:opacity-50"
                                >
                                    Pinjam
                                </button>
                                <button 
                                    onClick={() => {
                                        setSelectedItem(item);
                                        resetRequestForm();
                                        setRequestFormData(prev => ({ ...prev, item_id: item.id, item_name: item.name, type: 'report_damage' }));
                                        setModalType('report-damage');
                                    }}
                                    className="p-2.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                >
                                    <AlertTriangle size={18} />
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

            {/* Mobile Card View (Items) */}
            <div className="md:hidden divide-y divide-office-border">
               {loading ? (
                  [...Array(3)].map((_, i) => (
                     <div key={i} className="p-6 space-y-4 animate-pulse">
                        <div className="flex items-center gap-4">
                           <div className="h-12 w-12 bg-slate-100 rounded-2xl"></div>
                           <div className="h-6 w-40 bg-slate-100 rounded"></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="h-10 bg-slate-50 rounded-xl"></div>
                           <div className="h-10 bg-slate-50 rounded-xl"></div>
                        </div>
                     </div>
                  ))
               ) : paginatedItems.length === 0 ? (
                  <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Belum ada data barang.</div>
                ) : paginatedItems.map((item) => (
                  <div key={item.id} className="relative overflow-hidden bg-white first:rounded-t-[2rem] last:rounded-b-[2rem]">
                    {/* Swipe Actions Background */}
                    <div className="absolute inset-0 flex justify-end items-stretch">
                      <button 
                        onClick={() => handleEditItem(item)}
                        className="w-24 bg-indigo-600 text-white flex flex-col items-center justify-center gap-1 active:bg-indigo-700 transition-colors"
                      >
                        <Edit2 size={20} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Edit</span>
                      </button>
                      <button 
                        onClick={() => setDeletingId(item.id)}
                        className="w-24 bg-rose-600 text-white flex flex-col items-center justify-center gap-1 active:bg-rose-700 transition-colors"
                      >
                        <Trash2 size={20} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Hapus</span>
                      </button>
                    </div>

                    {/* Draggable Card Content */}
                    <motion.div 
                      drag="x"
                      dragConstraints={{ left: profile?.role === 'admin' ? -192 : 0, right: 0 }}
                      dragElastic={0.1}
                      whileTap={{ cursor: 'grabbing' }}
                      className={cn(
                        "relative p-6 bg-white border-b border-office-border last:border-b-0 transition-shadow active:shadow-lg active:z-10 flex gap-4",
                        selectedIds.includes(item.id) && "bg-brand-50/30"
                      )}
                    >
                      {profile?.role === 'admin' && (
                        <div className="pt-2">
                           <input 
                              type="checkbox" 
                              checked={selectedIds.includes(item.id)}
                              onChange={() => toggleSelect(item.id)}
                              className="w-6 h-6 rounded-xl border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                           />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4">
                             <div className="bg-brand-50 p-3 rounded-2xl text-brand-600"><Package size={24} /></div>
                             <div>
                                <h3 className="font-black text-slate-900 text-lg leading-tight tracking-tight">{item.name}</h3>
                                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mt-1">{item.location}</p>
                             </div>
                          </div>
                        <span className={cn(
                          "whitespace-nowrap px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                          item.condition === 'Baik' ? "bg-emerald-50 text-emerald-600" :
                          item.condition === 'Rusak' ? "bg-rose-50 text-rose-600" :
                          "bg-amber-50 text-amber-600"
                        )}>
                          {item.condition}
                        </span>
                      </div>
                    </div>

                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-xl border border-slate-100">
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stok</span>
                           <span className="text-lg font-black text-slate-900">{item.quantity}</span>
                        </div>
                      </div>

                      {profile?.role !== 'admin' && (
                        <div className="flex gap-2 pt-4">
                          <button 
                              onClick={() => {
                                  setSelectedItem(item);
                                  resetRequestForm();
                                  setRequestFormData(prev => ({ ...prev, item_id: item.id, item_name: item.name, type: 'borrow' }));
                                  setModalType('borrow');
                              }}
                              disabled={item.quantity === 0 || item.condition === 'Rusak'}
                              className="flex-[2] py-4 bg-office-slate-800 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 disabled:opacity-30"
                          >
                              Pinjam Barang
                          </button>
                          <button 
                              onClick={() => {
                                  setSelectedItem(item);
                                  resetRequestForm();
                                  setRequestFormData(prev => ({ ...prev, item_id: item.id, item_name: item.name, type: 'report_damage' }));
                                  setModalType('report-damage');
                              }}
                              className="flex-1 flex items-center justify-center gap-2 py-4 bg-rose-50 text-rose-600 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all"
                          >
                              <AlertTriangle size={16} /> Lapor
                          </button>
                        </div>
                      )}
                      
                      {profile?.role === 'admin' && (
                        <div className="mt-2 text-center md:hidden">
                          <p className="text-[9px] text-slate-300 font-black uppercase tracking-widest">← Swipe ke kiri untuk edit/hapus</p>
                        </div>
                      )}
                    </motion.div>
                  </div>
               ))}
            </div>

            {/* Pagination Controls - Items */}
            {totalPagesItems > 1 && (
              <div className="p-8 border-t border-office-border flex items-center justify-between gap-4 bg-white">
                <div className="hidden sm:block">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Halaman {currentPageItems} dari {totalPagesItems}
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => setCurrentPageItems(prev => Math.max(1, prev - 1))}
                    disabled={currentPageItems === 1}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 h-10 px-4 bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-all active:scale-95"
                  >
                    <ChevronLeft size={16} /> Prev
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPagesItems) }).map((_, i) => {
                      // Simple windowing for pagination numbers
                      let pageNum = i + 1;
                      if (totalPagesItems > 5 && currentPageItems > 3) {
                        pageNum = Math.min(currentPageItems - 2 + i, totalPagesItems - 4 + i);
                      }
                      return (
                        <button
                          key={i}
                          onClick={() => setCurrentPageItems(pageNum)}
                          className={`hidden sm:flex h-10 w-10 items-center justify-center rounded-xl text-[10px] font-black transition-all ${
                            currentPageItems === pageNum 
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
                    onClick={() => setCurrentPageItems(prev => Math.min(totalPagesItems, prev + 1))}
                    disabled={currentPageItems === totalPagesItems}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 h-10 px-4 bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-all active:scale-95"
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Bulk Actions Sticky Bar */}
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
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{selectedIds.length} Barang Terpilih</span>
                       <span className="font-black text-slate-900">Opsi Hapus Masal</span>
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
        </>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-office-border shadow-sm overflow-hidden mb-safe">
            {/* Header for Requests */}
            {profile?.role === 'admin' ? (
              <div className="p-8 lg:px-10 border-b border-office-border flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex-1">
                   <h2 className="text-xl font-black text-slate-900 tracking-tight">Manajemen Permintaan</h2>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Kelola perizinan peminjaman dan request barang</p>
                </div>
                <div className="flex gap-2">
                   {selectedRequestIds.length > 0 && (
                      <button 
                        onClick={handleBulkDeleteRequests}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 h-12 px-6 bg-rose-600 rounded-2xl text-xs font-black uppercase tracking-widest text-white hover:bg-rose-700 transition-all active:scale-95 shadow-lg shadow-rose-100"
                      >
                        <Trash2 size={16} /> Hapus Terpilih ({selectedRequestIds.length})
                      </button>
                   )}
                </div>
              </div>
            ) : (
              <div className="p-8 lg:px-10 border-b border-office-border">
                   <h2 className="text-xl font-black text-slate-900 tracking-tight">Riwayat Permintaan Saya</h2>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Status pengajuan peminjaman dan request barang Anda</p>
              </div>
            )}

            {/* Tablet/Desktop Table View (Requests) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50">
                    {profile?.role === 'admin' && (
                      <th className="pl-10 py-5 w-10">
                        <input 
                          type="checkbox" 
                          checked={selectedRequestIds.length === paginatedRequests.length && paginatedRequests.length > 0}
                          onChange={toggleSelectAllRequests}
                          className="w-5 h-5 rounded-lg border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                        />
                      </th>
                    )}
                    <th className={cn("py-5 font-black text-slate-400 font-black uppercase tracking-widest text-[10px]", profile?.role !== 'admin' && "pl-10")}>Tgl Pengajuan</th>
                    <th className="px-10 py-5 font-black text-slate-400 font-black uppercase tracking-widest text-[10px]">Tipe</th>
                    <th className="px-10 py-5 font-black text-slate-400 font-black uppercase tracking-widest text-[10px]">Barang</th>
                    <th className="px-10 py-5 font-black text-slate-400 font-black uppercase tracking-widest text-[10px]">Pemohon</th>
                    <th className="px-10 py-5 font-black text-slate-400 font-black uppercase tracking-widest text-[10px]">Status</th>
                    <th className="px-10 py-5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-office-border text-sm">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={`skeleton-reqs-${i}`} className="animate-pulse">
                        <td className="px-10 py-6 h-20"><div className="h-4 w-full bg-slate-100 rounded-full"></div></td>
                        <td colSpan={5}></td>
                      </tr>
                    ))
                  ) : paginatedRequests.length === 0 ? (
                    <tr>
                         <td colSpan={6} className="px-10 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Belum ada data permintaan.</td>
                    </tr>
                  ) : paginatedRequests.map((req) => (
                    <tr key={req.id} className={cn("group hover:bg-slate-50/50 transition-colors", selectedRequestIds.includes(req.id) && "bg-brand-50/30")}>
                      {profile?.role === 'admin' && (
                        <td className="pl-10 py-6">
                           <input 
                              type="checkbox"
                              checked={selectedRequestIds.includes(req.id)}
                              onChange={() => toggleSelectRequest(req.id)}
                              className="w-5 h-5 rounded-lg border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                           />
                        </td>
                      )}
                      <td className={cn("py-6 font-bold text-slate-500", profile?.role !== 'admin' && "pl-10")}>
                        {format(new Date(req.created_at), 'dd MMM yyyy')}
                      </td>
                      <td className="px-10 py-6">
                         <span className={cn(
                             "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                             req.type === 'borrow' ? "bg-blue-50 text-blue-600" :
                             req.type === 'new_item' ? "bg-indigo-50 text-indigo-600" :
                             "bg-rose-50 text-rose-600"
                         )}>
                             {req.type === 'borrow' ? 'Pinjam' : req.type === 'new_item' ? 'Request Baru' : 'Lapor Rusak'}
                         </span>
                      </td>
                      <td className="px-10 py-6">
                        <div className="flex flex-col">
                            <span className="font-black text-slate-900 tracking-tight">{req.item_name}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{req.quantity} Unit</span>
                                {req.type === 'borrow' && req.borrow_start_date && (
                                    <>
                                        <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                                        <span className="text-[10px] text-brand-600 font-black uppercase tracking-widest">
                                            {format(new Date(req.borrow_start_date), 'dd/MM')} - {format(new Date(req.borrow_end_date!), 'dd/MM')}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-black">{req.user_name.charAt(0)}</div>
                             <span className="font-bold text-slate-700">{req.user_name}</span>
                        </div>
                      </td>
                      <td className="px-10 py-6">
                         <span className={cn(
                            "inline-flex items-center gap-2 font-black text-[10px] uppercase tracking-widest",
                            req.status === 'pending' ? "text-amber-500" :
                            req.status === 'approved' ? "text-emerald-500" :
                            "text-rose-500"
                         )}>
                            <div className={cn("w-1.5 h-1.5 rounded-full", 
                               req.status === 'pending' ? "bg-amber-500 animate-pulse" :
                               req.status === 'approved' ? "bg-emerald-500" : "bg-rose-500"
                            )}></div>
                            {req.status === 'pending' ? 'Pending' : req.status === 'approved' ? 'Disetujui' : 'Ditolak'}
                         </span>
                      </td>
                      <td className="px-10 py-6 text-right">
                         <button 
                            onClick={() => {
                                setSelectedRequest(req);
                                setAdminNote(req.admin_note || '');
                                setModalType('request-detail');
                            }}
                            className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-brand-50 hover:text-brand-600 transition-all opacity-0 group-hover:opacity-100"
                         >
                            <ArrowUpRight size={18} />
                         </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View (Requests) */}
            <div className="md:hidden divide-y divide-office-border pb-safe">
               {loading ? (
                  [...Array(3)].map((_, i) => (
                    <div key={i} className="p-6 space-y-4 animate-pulse">
                       <div className="h-6 w-32 bg-slate-100 rounded"></div>
                       <div className="h-10 w-full bg-slate-50 rounded-xl"></div>
                    </div>
                  ))
               ) : paginatedRequests.length === 0 ? (
                  <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Tidak ada permintaan.</div>
               ) : paginatedRequests.map((req) => (
                  <div key={req.id} className={cn(
                    "p-6 bg-white active:bg-slate-50 transition-all space-y-4 flex gap-4",
                    selectedRequestIds.includes(req.id) && "bg-brand-50/30"
                  )}>
                     {profile?.role === 'admin' && (
                        <div className="pt-2">
                           <input 
                              type="checkbox"
                              checked={selectedRequestIds.includes(req.id)}
                              onChange={() => toggleSelectRequest(req.id)}
                              className="w-6 h-6 rounded-xl border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                           />
                        </div>
                     )}
                     <div 
                        className="flex-1 space-y-4"
                        onClick={() => {
                          setSelectedRequest(req);
                          setAdminNote(req.admin_note || '');
                          setModalType('request-detail');
                        }}
                     >
                       <div className="flex items-start justify-between">
                          <div>
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                {format(new Date(req.created_at), 'dd MMM yyyy')}
                                {req.type === 'borrow' && req.borrow_start_date && (
                                    <span className="text-brand-600 ml-2">
                                        • {format(new Date(req.borrow_start_date), 'dd/MM')} - {format(new Date(req.borrow_end_date!), 'dd/MM')}
                                    </span>
                                )}
                             </p>
                             <h3 className="font-black text-slate-900 text-lg leading-tight tracking-tight">{req.item_name}</h3>
                          </div>
                          <span className={cn(
                              "px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                              req.type === 'borrow' ? "bg-blue-50 text-blue-600" :
                              req.type === 'new_item' ? "bg-indigo-50 text-indigo-600" :
                              "bg-rose-50 text-rose-600"
                          )}>
                              {req.type === 'borrow' ? 'Pinjam' : req.type === 'new_item' ? 'Request' : 'Rusak'}
                          </span>
                       </div>

                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                             <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-black text-[10px] uppercase">
                                {req.user_name.charAt(0)}
                             </div>
                             <span className="text-xs font-bold text-slate-600">{req.user_name}</span>
                          </div>
                          <div className={cn(
                              "flex items-center gap-1.5 font-black text-[10px] uppercase tracking-widest",
                              req.status === 'pending' ? "text-amber-500" :
                              req.status === 'approved' ? "text-emerald-500" :
                              "text-rose-500"
                          )}>
                             <div className={cn("w-1.5 h-1.5 rounded-full",
                                req.status === 'pending' ? "bg-amber-500" :
                                req.status === 'approved' ? "bg-emerald-500" : "bg-rose-500"
                             )}></div>
                             {req.status}
                          </div>
                       </div>
                     </div>
                  </div>
               ))}
            </div>

            {/* Pagination Controls - Requests */}
            {totalPagesRequests > 1 && (
              <div className="p-8 border-t border-office-border flex items-center justify-between gap-4 bg-white">
                <div className="hidden sm:block">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Halaman {currentPageRequests} dari {totalPagesRequests}
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => setCurrentPageRequests(prev => Math.max(1, prev - 1))}
                    disabled={currentPageRequests === 1}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 h-10 px-4 bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-all active:scale-95"
                  >
                    <ChevronLeft size={16} /> Prev
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPagesRequests) }).map((_, i) => {
                      let pageNum = i + 1;
                      if (totalPagesRequests > 5 && currentPageRequests > 3) {
                        pageNum = Math.min(currentPageRequests - 2 + i, totalPagesRequests - 4 + i);
                      }
                      return (
                        <button
                          key={i}
                          onClick={() => setCurrentPageRequests(pageNum)}
                          className={`hidden sm:flex h-10 w-10 items-center justify-center rounded-xl text-[10px] font-black transition-all ${
                            currentPageRequests === pageNum 
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
                    onClick={() => setCurrentPageRequests(prev => Math.min(totalPagesRequests, prev + 1))}
                    disabled={currentPageRequests === totalPagesRequests}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 h-10 px-4 bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-all active:scale-95"
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Bulk Actions Sticky Bar - Requests (Mobile) */}
            <div className="md:hidden">
              <AnimatePresence>
                {selectedRequestIds.length > 0 && (
                  <motion.div 
                    initial={{ y: 100 }}
                    animate={{ y: 0 }}
                    exit={{ y: 100 }}
                    className="fixed bottom-24 left-4 right-4 bg-white rounded-[2rem] shadow-2xl border border-office-border p-4 z-[90] flex items-center justify-between"
                  >
                    <div className="flex flex-col pl-4">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{selectedRequestIds.length} Permintaan Terpilih</span>
                       <span className="font-black text-slate-900">Opsi Hapus Masal</span>
                    </div>
                    <button 
                      onClick={handleBulkDeleteRequests}
                      className="bg-rose-600 text-white px-6 py-4 rounded-3xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all shadow-lg shadow-rose-200"
                    >
                      Hapus ({selectedRequestIds.length})
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
        </div>
      )}

      {/* Item Action Modals */}
      {modalType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="p-8 border-b border-office-border flex justify-between items-center bg-white sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-black text-office-slate-800 uppercase tracking-tight">
                            {modalType === 'add-item' && (editingItem ? 'Edit Barang' : 'Tambah Barang Baru')}
                            {modalType === 'borrow' && 'Pengajuan Pinjam'}
                            {modalType === 'report-damage' && 'Lapor Barang Rusak'}
                            {modalType === 'request-new' && 'Request Barang Baru'}
                            {modalType === 'request-detail' && 'Detail Permintaan'}
                            {modalType === 'import-excel' && 'Import Data Inventaris'}
                        </h2>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Form Inventaris</p>
                    </div>
                    <button onClick={() => {
                        setModalType(null);
                        setEditingItem(null);
                        setItemFormData({ name: '', quantity: 1, condition: 'Baik', location: '' });
                        setImportData([]);
                    }} className="h-12 w-12 flex items-center justify-center bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 transition-all active:scale-95">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8 overflow-y-auto">
                    {modalType === 'import-excel' ? (
                        <div className="space-y-6">
                            <div className="bg-brand-50 p-6 rounded-[2rem] border border-brand-100 text-center">
                                <Upload className="h-12 w-12 text-brand-600 mx-auto mb-4" />
                                <h3 className="text-lg font-black text-brand-900 tracking-tight">Unggah File Excel/CSV</h3>
                                <p className="text-sm font-medium text-brand-700 mt-2 mb-6">
                                    Pastikan file Anda memiliki kolom: <br/> 
                                    <span className="font-bold">Nama Barang, Jumlah, Kondisi, Lokasi</span>
                                </p>
                                <input 
                                    type="file" 
                                    accept=".xlsx, .xls, .csv" 
                                    onChange={handleFileUpload}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-xs file:font-black file:uppercase file:bg-brand-600 file:text-white hover:file:bg-brand-700 transition-all"
                                />
                            </div>

                            {importData.length > 0 && (
                                <div className="space-y-4">
                                    <div className="bg-office-gray p-4 rounded-2xl flex justify-between items-center">
                                        <span className="text-sm font-bold text-slate-700">{importData.length} Baris data ditemukan</span>
                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    </div>
                                    
                                    {/* Preview Table */}
                                    <div className="max-h-40 overflow-y-auto border border-office-border rounded-xl">
                                        <table className="w-full text-[10px] text-left">
                                            <thead className="bg-white sticky top-0 border-b">
                                                <tr>
                                                    <th className="p-2 font-black uppercase">Barang</th>
                                                    <th className="p-2 font-black uppercase text-center">Qty</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white">
                                                {importData.slice(0, 5).map((row, idx) => (
                                                    <tr key={idx} className="border-b last:border-0">
                                                        <td className="p-2 font-bold truncate max-w-[150px]">{row['Nama Barang'] || row['name'] || '---'}</td>
                                                        <td className="p-2 text-center">{row['Jumlah'] || row['quantity'] || '0'}</td>
                                                    </tr>
                                                ))}
                                                {importData.length > 5 && (
                                                    <tr>
                                                        <td colSpan={2} className="p-2 text-center text-slate-400 italic">...dan {importData.length - 5} lainnya</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    <button 
                                        onClick={processImport}
                                        disabled={isSubmitting}
                                        className="w-full bg-brand-600 text-white font-black uppercase tracking-tight py-4 rounded-2xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-100 disabled:opacity-50"
                                    >
                                        {isSubmitting ? 'Memproses Import...' : 'Konfirmasi Import'}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : modalType === 'add-item' ? (
                        <form onSubmit={handleAddItem} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nama Barang</label>
                                <input 
                                    type="text"
                                    required 
                                    value={itemFormData.name} 
                                    onChange={e => setItemFormData({...itemFormData, name: e.target.value})} 
                                    className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500 outline-none transition-all" 
                                    placeholder="Monitor LG 27 Inch"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Jumlah</label>
                                    <input 
                                        type="number"
                                        required 
                                        min="1" 
                                        value={itemFormData.quantity} 
                                        onChange={e => setItemFormData({...itemFormData, quantity: parseInt(e.target.value) || 0})} 
                                        className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Kondisi</label>
                                    <select 
                                        value={itemFormData.condition} 
                                        onChange={e => setItemFormData({...itemFormData, condition: e.target.value })} 
                                        className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                                    >
                                        <option value="Baik">Baik</option>
                                        <option value="Rusak Ringan">Rusak Ringan</option>
                                        <option value="Rusak Berat">Rusak Berat</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Lokasi</label>
                                <input 
                                    type="text"
                                    required 
                                    value={itemFormData.location} 
                                    onChange={e => setItemFormData({...itemFormData, location: e.target.value})} 
                                    className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500 outline-none transition-all" 
                                    placeholder="Gudang IT"
                                />
                            </div>
                            <button disabled={isSubmitting} type="submit" className="w-full bg-brand-600 text-white font-black uppercase tracking-tight py-4 rounded-2xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-100 disabled:opacity-50">
                                {isSubmitting ? 'Memproses...' : (editingItem ? 'Perbarui Barang' : 'Simpan Barang')}
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
                                        selectedRequest?.status === 'approved' ? 'text-green-500' : 
                                        selectedRequest?.status === 'returned' ? 'text-blue-500' : 'text-rose-500'
                                    )}>{selectedRequest?.status === 'pending' ? 'Menunggu' : selectedRequest?.status === 'approved' ? 'Disetujui' : selectedRequest?.status === 'returned' ? 'Dikembalikan' : 'Ditolak'}</p>
                                </div>
                            </div>

                            {selectedRequest?.type === 'borrow' && selectedRequest.borrow_start_date && (
                                <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100">
                                    <p className="text-[10px] font-black text-indigo-400 uppercase mb-2 tracking-widest">Periode Peminjaman</p>
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-indigo-400 uppercase">Mulai</span>
                                            <span className="font-black text-indigo-900">{format(new Date(selectedRequest.borrow_start_date), 'dd MMM yyyy')}</span>
                                        </div>
                                        <div className="h-0.5 w-8 bg-indigo-200 rounded-full"></div>
                                        <div className="flex flex-col text-right">
                                            <span className="text-[10px] font-bold text-indigo-400 uppercase">Hingga</span>
                                            <span className="font-black text-indigo-900">{format(new Date(selectedRequest.borrow_end_date!), 'dd MMM yyyy')}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

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
                            ) : profile?.role === 'admin' && selectedRequest?.type === 'borrow' && selectedRequest?.status === 'approved' ? (
                                <div className="pt-4 space-y-4">
                                     {selectedRequest.admin_note && (
                                         <div>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Catatan Admin</p>
                                            <div className="bg-brand-50/50 p-4 rounded-2xl text-brand-700 text-sm font-bold">
                                                {selectedRequest.admin_note}
                                            </div>
                                         </div>
                                     )}
                                     <button 
                                        onClick={handleReturnItem}
                                        disabled={isSubmitting}
                                        className="w-full bg-blue-600 text-white font-bold uppercase py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                                     >
                                        <History size={18} /> Tandai Sudah Dikembalikan
                                     </button>
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

                            {requestFormData.type === 'borrow' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Mulai Pinjam</label>
                                        <input 
                                            required 
                                            type="date" 
                                            value={requestFormData.borrow_start_date} 
                                            onChange={e => setRequestFormData({...requestFormData, borrow_start_date: e.target.value})} 
                                            className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Selesai Pinjam</label>
                                        <input 
                                            required 
                                            type="date" 
                                            value={requestFormData.borrow_end_date} 
                                            onChange={e => setRequestFormData({...requestFormData, borrow_end_date: e.target.value})} 
                                            className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500"
                                        />
                                    </div>
                                </div>
                            )}

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
          <div className="bg-white rounded-[2rem] w-full max-w-sm shadow-2xl p-8 animate-in fade-in zoom-in-95 duration-200 relative">
            <button 
                onClick={() => setDeletingId(null)}
                className="absolute top-6 right-6 p-2 h-10 w-10 flex items-center justify-center bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 transition-all active:scale-95"
            >
                <X size={20} />
            </button>
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
