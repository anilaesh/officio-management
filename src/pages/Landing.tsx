import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Building2, 
  Clock, 
  Calendar, 
  Package, 
  UserCheck, 
  ArrowRight,
  ShieldCheck,
  Zap
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <Building2 className="text-brand-600 h-8 w-8" />
              <span className="text-xl font-bold text-gray-900 tracking-tight">Officio</span>
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
              <a href="#features" className="hover:text-brand-600 transition-colors">Fitur</a>
              <a href="#about" className="hover:text-brand-600 transition-colors">Tentang Kami</a>
              <Link to="/login" className="bg-brand-600 text-white px-5 py-2 rounded-full hover:bg-brand-700 transition-all shadow-sm">
                Masuk ke Aplikasi
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block py-1 px-3 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold uppercase tracking-wider mb-4">
              Solusi Kantor Modern
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 mb-6 tracking-tight leading-tight">
              Manajememen Kantor <br /> 
              <span className="text-brand-600">Terintegrasi & Digital</span>
            </h1>
            <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto">
              Optimalkan produktivitas tim dengan sistem absensi, penjadwalan meeting, 
              dan manajemen inventaris yang cerdas dalam satu platform profesional.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link to="/login" className="flex items-center justify-center gap-2 bg-brand-600 text-white px-8 py-4 rounded-xl text-lg font-bold hover:bg-brand-700 transition-all transform hover:-translate-y-1 shadow-lg shadow-brand-200">
                Mulai Sekarang <ArrowRight className="h-5 w-5" />
              </Link>
              <button className="flex items-center justify-center gap-2 bg-white text-gray-900 border border-gray-200 px-8 py-4 rounded-xl text-lg font-bold hover:bg-gray-50 transition-all">
                Lihat Demo
              </button>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="mt-16 rounded-2xl overflow-hidden shadow-2xl border border-gray-100"
          >
            <div className="bg-gray-100 p-2">
              <div className="bg-white rounded-lg aspect-video flex items-center justify-center text-gray-400">
                <div className="grid grid-cols-3 gap-8 w-full p-12">
                   <div className="h-40 bg-gray-50 rounded-xl animate-pulse"></div>
                   <div className="h-40 bg-gray-50 rounded-xl animate-pulse"></div>
                   <div className="h-40 bg-gray-50 rounded-xl animate-pulse"></div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Fitur Utama Platform</h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              Segala yang Anda butuhkan untuk mengelola operasional kantor harian dengan efisien.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: UserCheck, title: "Absensi Mandiri", desc: "Karyawan dapat melakukan check-in & check-out secara mandiri melalui aplikasi." },
              { icon: Calendar, title: "Jadwal Meeting", desc: "Kelola reservasi ruangan dan jadwal meeting tim secara real-time." },
              { icon: Package, title: "Inventaris Barang", desc: "Pantau jumlah, kondisi, dan lokasi barang operasional kantor dengan mudah." },
              { icon: Clock, title: "Pengajuan Cuti", desc: "Sistem pengajuan izin dan cuti yang praktis dengan workflow persetujuan admin." },
            ].map((f, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -5 }}
                className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all"
              >
                <div className="bg-brand-50 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
                  <f.icon className="text-brand-600 h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{f.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-brand-900 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-brand-500 rounded-full blur-3xl opacity-20"></div>
        <div className="max-w-7xl mx-auto px-4 relative z-10 text-center">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
            {[
              { label: "Pengguna Aktif", val: "5,000+" },
              { label: "Kantor Terdaftar", val: "120+" },
              { label: "Pertemuan Terjadwal", val: "10k+" },
              { label: "Rating Kepuasan", val: "4.9/5" },
            ].map((s, i) => (
              <div key={i}>
                <div className="text-4xl font-bold mb-2">{s.val}</div>
                <div className="text-brand-200 text-sm uppercase tracking-widest">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Building2 className="text-brand-600 h-6 w-6" />
            <span className="text-lg font-bold text-gray-900">Officio</span>
          </div>
          <p className="text-gray-500 text-sm">
            © 2026 Officio Indonesia. Solusi Digital untuk Efisiensi Kerja.
          </p>
        </div>
      </footer>
    </div>
  );
}
