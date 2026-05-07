import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, Profile, isSupabaseConfigured } from './supabase';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signInDemo: (role: 'admin' | 'employee') => void;
  isDemo: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    // Demo sync channel
    const demoChannel = new BroadcastChannel('officio_demo_sync');
    demoChannel.onmessage = (event) => {
      if (event.data.type === 'REFRESH_REQUIRED') {
        // Trigger a re-fetch in components by listening to a custom event if needed
        // For now, simpler is to just reload or let components handle it via storage events
        window.dispatchEvent(new Event('officio_data_update'));
      }
    };

    // Listen for storage events (backup for older browsers or simple sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'officio_demo_session' && !e.newValue) {
        setIsDemo(false);
        setUser(null);
        setProfile(null);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Check for demo session in localStorage
    const demoSession = localStorage.getItem('officio_demo_session');
    if (demoSession) {
      const { user: demoUser, profile: demoProfile } = JSON.parse(demoSession);
      setUser(demoUser);
      setProfile(demoProfile);
      setIsDemo(true);
      setLoading(false);
      return;
    }

    // Safety timeout to prevent stuck loading screen
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('Auth loading timed out. Proceeding...');
        setLoading(false);
      }
    }, 8000);

    // Fast exit if Supabase is not configured to avoid hanging loading states
    if (!isSupabaseConfigured) {
      setLoading(false);
      clearTimeout(timeoutId);
      return;
    }

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch(() => {
      setLoading(false);
    }).finally(() => {
      clearTimeout(timeoutId);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!data && !error) {
        // Profile doesn't exist, create one
        const userEmail = (await supabase.auth.getUser()).data.user?.email;
        const newProfile = {
          id: userId,
          full_name: userEmail?.split('@')[0] || 'Member',
          role: 'employee',
          position: 'Staff',
          created_at: new Date().toISOString()
        };
        
        const { data: createdData, error: insertError } = await supabase
          .from('profiles')
          .insert(newProfile)
          .select()
          .single();
        
        if (!insertError) {
          setProfile(createdData);
        } else {
          // Fallback if DB insert fails (e.g. no Supabase config)
          setProfile(newProfile as Profile);
        }
      } else if (data) {
        setProfile(data);
      }
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  }

  const signInDemo = (role: 'admin' | 'employee') => {
    const demoUser = { id: 'demo-id', email: `${role}@demo.com` } as User;
    const demoProfile: Profile = {
      id: 'demo-id',
      full_name: role === 'admin' ? 'Admin Demo' : 'Karyawan Demo',
      role: role,
      position: role === 'admin' ? 'System Administrator' : 'Senior Staff',
      contact: '0812-3456-7890',
      created_at: new Date().toISOString()
    };
    
    setUser(demoUser);
    setProfile(demoProfile);
    setIsDemo(true);
    localStorage.setItem('officio_demo_session', JSON.stringify({ user: demoUser, profile: demoProfile }));
  };

  const signOut = async () => {
    if (isDemo) {
      localStorage.removeItem('officio_demo_session');
      setUser(null);
      setProfile(null);
      setIsDemo(false);
    } else {
      await supabase.auth.signOut();
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, signInDemo, isDemo }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
