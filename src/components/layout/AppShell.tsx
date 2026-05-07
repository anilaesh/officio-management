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
  X
} from 'lucide-react';
import { useState } from 'react';

export default function AppShell() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const menuItems = [
    { name: 'Dashboard', path: '/app', icon: BarChart3, roles: ['admin', 'employee'] },
    { name: 'Absensi', path: '/app/attendance', icon: Clock, roles: ['admin', 'employee'] },
    { name: 'Jadwal Meeting', path: '/app/meetings', icon: Calendar, roles: ['admin', 'employee'] },
    { name: 'Inventaris', path: '/app/inventory', icon: Package, roles: ['admin', 'employee'] },
    { name: 'Pengajuan Cuti', path: '/app/leave', icon: FileText, roles: ['admin', 'employee'] },
    { name: 'Data Karyawan', path: '/app/employees', icon: Users, roles: ['admin'] },
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
    <div className="min-h-screen bg-office-gray flex">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-[260px] bg-office-slate-900 text-office-slate-300 transition-transform lg:translate-x-0 lg:static lg:block",
        !isSidebarOpen && "-translate-x-full"
      )}>
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="px-8 py-8 flex items-center gap-3">
            <div className="text-brand-500 text-xl">●</div>
            <span className="text-xl font-bold tracking-tight text-white">OfficeFlow</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 space-y-1 mt-2 overflow-y-auto">
            {filteredMenu.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-6 py-3 rounded-lg text-[13px] font-semibold transition-all",
                    isActive 
                      ? "bg-brand-600 text-white" 
                      : "sidebar-item-hover"
                  )}
                >
                  <item.icon className={cn("h-4 w-4", isActive ? "text-white" : "opacity-60")} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Version/Footer Info */}
          <div className="p-6 text-[10px] opacity-40 font-bold uppercase tracking-widest">
             v2.0.4 Admin Panel
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-[64px] bg-white border-b border-office-border flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 mr-4 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
            <h2 className="font-bold text-lg text-office-slate-800">
              {filteredMenu.find(m => m.path === location.pathname)?.name || 'Dashboard'}
            </h2>
            <span className="ml-4 text-sm text-slate-400 hidden sm:inline">| {new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</span>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-bold text-gray-900">{profile?.full_name}</span>
              <span className="text-xs text-slate-500 lowercase">{profile?.role}@officeflow.com</span>
            </div>
            <button 
              onClick={handleSignOut}
              className="bg-office-gray px-4 py-2 rounded-lg text-[13px] font-extrabold text-slate-600 hover:bg-office-border hover:text-office-slate-900 transition-all flex items-center gap-2"
            >
              Logout <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Dynamic Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">
             <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
