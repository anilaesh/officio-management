import React, { useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { 
  UserCircle, 
  Mail, 
  Phone, 
  Briefcase, 
  Camera, 
  Save, 
  ShieldCheck,
  Building2
} from 'lucide-react';
import { cn } from '../../lib/utils';

export default function ProfilePage() {
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    position: profile?.position || '',
    contact: profile?.contact || '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    // Real implementation would update profile in Supabase
    setTimeout(() => setIsSaving(false), 800);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Akun Saya</h1>
        <p className="text-gray-500 font-medium">Kelola informasi profil dan pengaturan akun Anda.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl border border-office-border shadow-sm overflow-hidden text-center p-8">
             <div className="relative inline-block mb-6">
                <div className="w-32 h-32 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-black text-4xl border-4 border-white shadow-md">
                   {profile?.full_name?.charAt(0) || 'U'}
                </div>
                <button className="absolute bottom-0 right-0 p-2 bg-brand-600 text-white rounded-full border-2 border-white shadow-lg hover:scale-110 transition-transform">
                   <Camera className="h-4 w-4" />
                </button>
             </div>
             <h2 className="text-xl font-bold text-gray-900">{profile?.full_name}</h2>
             <p className="text-brand-600 font-bold text-sm mb-6">{profile?.position}</p>
             
             <div className="space-y-3 pt-6 border-t border-office-border">
                <div className="flex items-center gap-3 text-sm text-gray-500 font-medium">
                   <ShieldCheck className="h-4 w-4 text-brand-500" />
                   Role: <span className="text-gray-900 font-bold capitalize">{profile?.role}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500 font-medium">
                   <Building2 className="h-4 w-4 text-brand-500" />
                   Department: <span className="text-gray-900 font-bold">Teknologi Informasi</span>
                </div>
             </div>
          </div>
        </div>

        {/* Update Form */}
        <div className="lg:col-span-2">
           <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-office-border shadow-sm p-8 space-y-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Informasi Pribadi</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Nama Lengkap</label>
                    <div className="relative">
                       <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                       <input 
                          type="text" 
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-office-border rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none focus:bg-white transition-all text-sm font-medium"
                          value={formData.full_name}
                          onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                       />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Jabatan</label>
                    <div className="relative">
                       <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                       <input 
                          type="text" 
                          disabled
                          className="w-full pl-10 pr-4 py-3 bg-gray-100 border border-office-border rounded-xl text-gray-400 cursor-not-allowed text-sm font-medium"
                          value={formData.position}
                       />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Nomor Kontak</label>
                    <div className="relative">
                       <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                       <input 
                          type="text" 
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-office-border rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none focus:bg-white transition-all text-sm font-medium"
                          value={formData.contact}
                          onChange={(e) => setFormData({...formData, contact: e.target.value})}
                       />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Email Kantor</label>
                    <div className="relative">
                       <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                       <input 
                          type="email" 
                          disabled
                          className="w-full pl-10 pr-4 py-3 bg-gray-100 border border-office-border rounded-xl text-gray-400 cursor-not-allowed text-sm font-medium"
                          value={profile?.full_name?.toLowerCase().replace(' ', '.') + "@company.com"}
                       />
                    </div>
                 </div>
              </div>

              <div className="pt-6 border-t border-office-border flex justify-end">
                 <button 
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-brand-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-100 disabled:opacity-50"
                 >
                    {isSaving ? <div className="animate-spin h-5 w-5 border-2 border-white/20 border-t-white rounded-full"></div> : <Save className="h-5 w-5" />}
                    Simpan Perubahan
                 </button>
              </div>
           </form>
        </div>
      </div>
    </div>
  );
}
