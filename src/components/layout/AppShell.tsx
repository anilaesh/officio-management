import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { cn } from '../../lib/utils';
import { 
  BarChart3, 
  Users, 
  Calendar, 
  Clock, 
  Package, 
  FileText, 
  UserCircle,
  LogOut,
  ChevronRight,
  Building2,
  Menu,
  TrendingUp,
  X
} from 'lucide-react';
import { useState } from 'react';

export default function AppShell() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const menuItems = [
    { name: 'Dashboard', path: '/app', icon: BarChart3, roles: ['admin', 'employee'] },
    { name: 'Absensi', path: '/app/attendance', icon: Clock, roles: ['admin', 'employee'] },
    { name: 'Meeting', path: '/app/meetings', icon: Calendar, roles: ['admin', 'employee'] },
    { name: 'Inventaris', path: '/app/inventory', icon: Package, roles: ['admin', 'employee'] },
    { name: 'Cuti', path: '/app/leave', icon: FileText, roles: ['admin', 'employee'] },
    { name: 'Laporan', path: '/app/reports', icon: TrendingUp, roles: ['admin', 'employee'] },
    { name: 'Karyawan', path: '/app/employees', icon: Users, roles: ['admin'] },
  ];

  const userRole = profile?.role || 'employee';
  const filteredMenu = menuItems.filter(item => 
    item.roles.includes(userRole)
  );

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-office-gray flex flex-col lg:flex-row">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-[280px] bg-office-slate-900 text-office-slate-300 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:block",
        !isSidebarOpen && "-translate-x-full"
      )}>
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="px-8 py-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-brand-500 text-xl">●</div>
              <span className="text-xl font-bold tracking-tight text-white">OfficeFlow</span>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-2 text-office-slate-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 space-y-1.5 mt-2 overflow-y-auto custom-scrollbar">
            {filteredMenu.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-5 py-3.5 rounded-xl text-[14px] font-bold transition-all transition-duration-200",
                    isActive 
                      ? "bg-brand-600 text-white shadow-lg shadow-brand-900/20" 
                      : "hover:bg-office-slate-800 hover:text-white"
                  )}
                >
                  <item.icon size={18} className={cn(isActive ? "text-white" : "opacity-50")} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User Profile in Sidebar (Mobile) */}
          <div className="p-4 lg:hidden border-t border-office-slate-800 bg-office-slate-900/50">
             <div className="flex items-center gap-3 p-3 bg-office-slate-800 rounded-xl mb-3">
                <div className="h-10 w-10 rounded-lg bg-brand-500 flex items-center justify-center text-white font-black">
                   {profile?.full_name?.charAt(0)}
                </div>
                <div className="overflow-hidden">
                   <p className="text-sm font-bold text-white truncate">{profile?.full_name}</p>
                   <p className="text-[10px] text-slate-400 uppercase tracking-widest truncate">{profile?.role}</p>
                </div>
             </div>
             <button 
               onClick={handleSignOut}
               className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-office-slate-800 text-rose-400 text-sm font-bold hover:bg-rose-500/10 transition-all border border-rose-500/10"
             >
               <LogOut size={16} /> Logout
             </button>
          </div>

          {/* Version/Footer Info */}
          <div className="hidden lg:block p-8 text-[11px] font-black text-slate-500 uppercase tracking-widest">
             PRO EDITION V2.0
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-[72px] bg-white border-b border-office-border flex items-center justify-between px-4 lg:px-8 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2.5 bg-office-gray rounded-xl text-slate-600 hover:bg-office-border transition-all active:scale-95"
            >
              <Menu size={22} />
            </button>
            <div className="flex flex-col">
              <h2 className="font-black text-lg lg:text-xl text-slate-900 tracking-tight leading-tight">
                {filteredMenu.find(m => m.path === location.pathname)?.name || 'Dashboard'}
              </h2>
              <p className="text-[10px] lg:text-xs text-slate-400 font-bold uppercase tracking-widest hidden sm:block">
                 {new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-black text-slate-900">{profile?.full_name}</span>
              <span className="text-[10px] text-brand-600 font-black uppercase tracking-widest">{profile?.role}</span>
            </div>
            <button 
              onClick={handleSignOut}
              className="hidden lg:flex p-3.5 bg-office-gray rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all group"
            >
              <LogOut size={20} className="group-hover:rotate-12 transition-transform" />
            </button>
            <div className="lg:hidden h-10 w-10 rounded-xl bg-office-gray flex items-center justify-center text-slate-900 font-black border border-office-border">
               {profile?.full_name?.charAt(0)}
            </div>
          </div>
        </header>

        {/* Dynamic Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-10 pb-10">
          <div className="max-w-7xl mx-auto">
             <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
