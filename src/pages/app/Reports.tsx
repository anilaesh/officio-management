import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { supabase, Attendance, InventoryItem, InventoryRequest } from '../../lib/supabase';
import { 
  FileText, 
  Download, 
  Search, 
  Filter, 
  Clock, 
  Package, 
  Calendar,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type ReportTab = 'attendance' | 'inventory' | 'leave' | 'employees';

export default function ReportsPage() {
  const { profile, isDemo, user } = useAuth();
  const [activeTab, setActiveTab] = useState<ReportTab>('attendance');
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Data states
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
  const [leaveData, setLeaveData] = useState<any[]>([]);
  const [employeesData, setEmployeesData] = useState<any[]>([]);

  // Filter states
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  useEffect(() => {
    fetchData();
  }, [activeTab, dateRange]);

  async function fetchData() {
    setLoading(true);
    try {
      if (activeTab === 'attendance') {
        await fetchAttendanceReport();
      } else if (activeTab === 'inventory') {
        await fetchInventoryReport();
      } else if (activeTab === 'leave') {
        await fetchLeaveReport();
      } else if (activeTab === 'employees') {
        await fetchEmployeesReport();
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAttendanceReport() {
    if (isDemo) {
      const stored = localStorage.getItem('officio_demo_attendance');
      let data = stored ? JSON.parse(stored) : [];
      
      // Filter by date range
      data = data.filter((a: any) => a.date >= dateRange.start && a.date <= dateRange.end);
      
      if (profile?.role !== 'admin') {
        data = data.filter((a: any) => a.user_id === user?.id);
      }

      setAttendanceData(data);
      return;
    }

    let query = supabase
      .from('attendance')
      .select('*, profiles:user_id(full_name)')
      .gte('date', dateRange.start)
      .lte('date', dateRange.end)
      .order('date', { ascending: false });

    if (profile?.role !== 'admin') {
      query = query.eq('user_id', user?.id);
    }

    const { data } = await query;
    setAttendanceData(data || []);
  }

  async function fetchInventoryReport() {
    if (isDemo) {
      const stored = localStorage.getItem('officio_demo_inventory');
      setInventoryData(stored ? JSON.parse(stored) : []);
      return;
    }

    const { data } = await supabase.from('inventory').select('*').order('name');
    setInventoryData(data || []);
  }

  async function fetchLeaveReport() {
    if (isDemo) {
      const stored = localStorage.getItem('officio_demo_leaves');
      let data = stored ? JSON.parse(stored) : [];
      
      data = data.filter((l: any) => l.start_date >= dateRange.start || l.end_date <= dateRange.end);
      
      if (profile?.role !== 'admin') {
        data = data.filter((l: any) => l.user_id === user?.id);
      }

      setLeaveData(data);
      return;
    }

    let query = supabase
      .from('leave_requests')
      .select('*, profiles:user_id(full_name)')
      .order('created_at', { ascending: false });

    if (profile?.role !== 'admin') {
      query = query.eq('user_id', user?.id);
    }

    const { data } = await query;
    setLeaveData(data || []);
  }

  async function fetchEmployeesReport() {
    if (isDemo) {
      const stored = localStorage.getItem('officio_demo_employees');
      setEmployeesData(stored ? JSON.parse(stored) : []);
      return;
    }

    const { data } = await supabase.from('profiles').select('*').order('full_name');
    setEmployeesData(data || []);
  }

  const exportToPDF = () => {
    setIsExporting(true);
    const doc = new jsPDF();
    const timestamp = format(new Date(), 'dd-MM-yyyy HH:mm');
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(40);
    doc.text('OFFICEFLOW REPORT', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    const reportTypeLabel = 
      activeTab === 'attendance' ? 'Rekap Absensi' : 
      activeTab === 'inventory' ? 'Rekap Inventaris' : 
      activeTab === 'leave' ? 'Rekap Pengajuan Cuti' : 'Data Karyawan';
    
    doc.text(`Tipe Laporan: ${reportTypeLabel}`, 14, 30);
    doc.text(`Periode/Parameter: ${dateRange.start} s/d ${dateRange.end}`, 14, 35);
    doc.text(`Dicetak pada: ${timestamp}`, 14, 40);
    doc.text(`Oleh: ${profile?.full_name} (${profile?.role})`, 14, 45);

    if (activeTab === 'attendance') {
      const tableData = attendanceData.map(item => {
        const name = item.profiles?.full_name || item.name || item.full_name || 'Karyawan';
        return [
          format(new Date(item.date), 'dd/MM/yyyy'),
          name,
          item.check_in || '-',
          item.check_out || '-',
          item.status === 'present' ? 'Hadir' : item.status === 'late' ? 'Telat' : 'Absen'
        ];
      });

      autoTable(doc, {
        startY: 55,
        head: [['Tanggal', 'Nama Karyawan', 'Masuk', 'Pulang', 'Status']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] }
      });
    } else if (activeTab === 'inventory') {
      const tableData = inventoryData.map(item => [
        item.name,
        item.quantity.toString(),
        item.condition,
        item.location
      ]);

      autoTable(doc, {
        startY: 55,
        head: [['Nama Barang', 'Jumlah', 'Kondisi', 'Lokasi']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] }
      });
    } else if (activeTab === 'leave') {
      const tableData = leaveData.map(item => {
        const name = item.profiles?.full_name || item.name || item.full_name || 'Karyawan';
        return [
          name,
          item.type === 'cuti' ? 'Cuti' : 'Izin',
          `${item.start_date} - ${item.end_date}`,
          item.status === 'approved' ? 'Disetujui' : item.status === 'rejected' ? 'Ditolak' : 'Menunggu'
        ];
      });

      autoTable(doc, {
        startY: 55,
        head: [['Nama Karyawan', 'Tipe', 'Periode', 'Status']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] }
      });
    } else if (activeTab === 'employees') {
      const tableData = employeesData.map(item => {
        const name = item.full_name || item.name || '-';
        return [
          name,
          item.email || '-',
          item.role || '-',
          item.department || '-',
          item.position || '-'
        ];
      });

      autoTable(doc, {
        startY: 55,
        head: [['Nama Lengkap', 'Email', 'Role', 'Departemen', 'Jabatan']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] }
      });
    }

    doc.save(`OfficeFlow_${activeTab}_Report_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
    setIsExporting(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-none mb-2">Pusat Laporan & Rekap</h1>
          <p className="text-gray-500 font-medium">Analisis data operasional dan ekspor ke format PDF.</p>
        </div>
        <button 
          onClick={exportToPDF}
          disabled={loading || isExporting}
          className="flex items-center gap-2 bg-brand-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-tight hover:bg-brand-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
        >
          {isExporting ? (
            <div className="animate-spin h-4 w-4 border-2 border-white/20 border-t-white rounded-full"></div>
          ) : (
            <Download className="h-4 w-4" />
          )}
          {isExporting ? 'Mengekspor...' : 'Unduh PDF'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex p-1.5 bg-office-gray rounded-3xl w-fit overflow-x-auto">
        <button 
          onClick={() => setActiveTab('attendance')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-bold transition-all whitespace-nowrap",
            activeTab === 'attendance' ? "bg-white text-brand-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Clock className="h-4 w-4" /> Absensi
        </button>
        <button 
          onClick={() => setActiveTab('inventory')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-bold transition-all whitespace-nowrap",
            activeTab === 'inventory' ? "bg-white text-brand-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Package className="h-4 w-4" /> Inventaris
        </button>
        <button 
          onClick={() => setActiveTab('leave')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-bold transition-all whitespace-nowrap",
            activeTab === 'leave' ? "bg-white text-brand-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <FileText className="h-4 w-4" /> Pengajuan Cuti
        </button>
        {profile?.role === 'admin' && (
          <button 
            onClick={() => setActiveTab('employees')}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-bold transition-all whitespace-nowrap",
              activeTab === 'employees' ? "bg-white text-brand-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Users className="h-4 w-4" /> Karyawan
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-8 rounded-[2rem] border border-office-border shadow-sm">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Dari Tanggal</label>
            <input 
              type="date" 
              value={dateRange.start}
              onChange={e => setDateRange({...dateRange, start: e.target.value})}
              className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex-1 space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Sampai Tanggal</label>
            <input 
              type="date" 
              value={dateRange.end}
              onChange={e => setDateRange({...dateRange, end: e.target.value})}
              className="w-full bg-office-gray border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex-none flex items-end">
            <button 
              onClick={fetchData}
              className="bg-office-slate-800 text-white p-4 rounded-xl hover:bg-black transition-all"
              title="Refresh Data"
            >
              <Search className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Report View */}
      <div className="bg-white rounded-[2rem] border border-office-border shadow-sm overflow-hidden">
        <div className="p-8 border-b border-office-border bg-office-gray/30 flex justify-between items-center">
            <h3 className="text-xl font-black text-office-slate-800 uppercase tracking-tight">
                Preview Data {
                  activeTab === 'attendance' ? 'Absensi' : 
                  activeTab === 'inventory' ? 'Inventaris' : 
                  activeTab === 'leave' ? 'Cuti' : 'Karyawan'
                }
            </h3>
            <span className="bg-brand-50 text-brand-600 px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest">
                {
                  activeTab === 'attendance' ? attendanceData.length : 
                  activeTab === 'inventory' ? inventoryData.length : 
                  activeTab === 'leave' ? leaveData.length : employeesData.length
                } Records
            </span>
        </div>

        <div className="overflow-x-auto">
            {activeTab === 'attendance' && (
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="bg-office-gray">
                            <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Tanggal</th>
                            <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Karyawan</th>
                            <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Jam Masuk</th>
                            <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Jam Pulang</th>
                            <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-office-border">
                        {loading ? (
                            <tr><td colSpan={5} className="p-20 text-center animate-pulse font-bold text-slate-400">Memuat data...</td></tr>
                        ) : attendanceData.length === 0 ? (
                            <tr><td colSpan={5} className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Tak ada data ditemukan</td></tr>
                        ) : attendanceData.map((item, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                <td className="px-8 py-5 font-bold text-office-slate-700">{format(new Date(item.date), 'dd MMM yyyy', { locale: id })}</td>
                                <td className="px-8 py-5">
                                    <div className="flex items-center gap-2">
                                        {(() => {
                                          const name = item.profiles?.full_name || item.name || item.full_name || 'Karyawan';
                                          return (
                                            <>
                                              <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-[10px] uppercase">{name.charAt(0)}</div>
                                              <span className="font-bold text-slate-700">{name}</span>
                                            </>
                                          );
                                        })()}
                                    </div>
                                </td>
                                <td className="px-8 py-5 font-medium text-slate-600">{item.check_in || '--:--'}</td>
                                <td className="px-8 py-5 font-medium text-slate-600">{item.check_out || '--:--'}</td>
                                <td className="px-8 py-5">
                                    <span className={cn(
                                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight",
                                        item.status === 'present' ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'
                                    )}>{item.status === 'present' ? 'Hadir' : 'Telat'}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {activeTab === 'inventory' && (
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="bg-office-gray">
                            <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Nama Barang</th>
                            <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Jumlah</th>
                            <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Kondisi</th>
                            <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Lokasi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-office-border">
                        {loading ? (
                            <tr><td colSpan={4} className="p-20 text-center animate-pulse font-bold text-slate-400">Memuat data...</td></tr>
                        ) : inventoryData.map((item, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                <td className="px-8 py-5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center font-black"><Package size={14}/></div>
                                        <span className="font-bold text-slate-700">{item.name}</span>
                                    </div>
                                </td>
                                <td className="px-8 py-5 font-black text-office-slate-800">{item.quantity} Unit</td>
                                <td className="px-8 py-5">
                                    <span className={cn(
                                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight",
                                        item.condition === 'Baik' ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'
                                    )}>{item.condition}</span>
                                </td>
                                <td className="px-8 py-5 font-bold text-slate-500">{item.location}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {activeTab === 'leave' && (
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="bg-office-gray">
                            <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Karyawan</th>
                            <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Tipe</th>
                            <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Periode</th>
                            <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Alasan</th>
                            <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-office-border">
                        {loading ? (
                            <tr><td colSpan={5} className="p-20 text-center animate-pulse font-bold text-slate-400">Memuat data...</td></tr>
                        ) : leaveData.map((item, i) => {
                            const name = item.profiles?.full_name || item.name || item.full_name || 'Karyawan';
                            return (
                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-8 py-5 font-bold text-slate-700">{name}</td>
                                    <td className="px-8 py-5">
                                        <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                                            {item.type === 'cuti' ? 'Cuti' : 'Izin Sakit'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 font-medium text-slate-600">{item.start_date} - {item.end_date}</td>
                                    <td className="px-8 py-5 font-medium text-slate-500 max-w-xs truncate">{item.reason}</td>
                                    <td className="px-8 py-5">
                                        <span className={cn(
                                            "flex items-center gap-1 font-black uppercase tracking-tighter text-[10px]",
                                            item.status === 'approved' ? 'text-green-500' : item.status === 'rejected' ? 'text-rose-500' : 'text-amber-500'
                                        )}>
                                            {item.status === 'approved' ? <CheckCircle2 size={12}/> : item.status === 'rejected' ? <XCircle size={12}/> : <AlertCircle size={12}/>}
                                            {item.status === 'approved' ? 'Disetujui' : item.status === 'rejected' ? 'Ditolak' : 'Pending'}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}

            {activeTab === 'employees' && (
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="bg-office-gray">
                            <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Nama Lengkap</th>
                            <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Email</th>
                            <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Role</th>
                            <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Departemen</th>
                            <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Jabatan</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-office-border">
                        {loading ? (
                            <tr><td colSpan={5} className="p-20 text-center animate-pulse font-bold text-slate-400">Memuat data...</td></tr>
                        ) : employeesData.length === 0 ? (
                            <tr><td colSpan={5} className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Tak ada data ditemukan</td></tr>
                        ) : employeesData.map((item, i) => {
                            const name = item.full_name || item.name || '-';
                            return (
                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-black text-[10px] uppercase">{name.charAt(0)}</div>
                                            <span className="font-bold text-slate-700">{name}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-slate-500">{item.email || '-'}</td>
                                    <td className="px-8 py-5 text-slate-600 font-medium capitalize">{item.role || '-'}</td>
                                    <td className="px-8 py-5 text-slate-600 font-medium">{item.department || '-'}</td>
                                    <td className="px-8 py-5 text-slate-600 font-bold">{item.position || '-'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
      </div>
    </div>
  );
}
