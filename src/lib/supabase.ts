/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = 
  supabaseUrl && 
  supabaseUrl !== 'your_supabase_project_url' && 
  supabaseAnonKey && 
  supabaseAnonKey !== 'your_supabase_anon_key';

if (!isSupabaseConfigured) {
  console.warn('Supabase URL or Anon Key is missing or placeholder. Running in limited mode.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

export type Role = 'admin' | 'employee';

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  position: string;
  contact: string;
  avatar_url?: string;
  created_at: string;
}

export interface Attendance {
  id: string;
  user_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: 'present' | 'absent' | 'late';
  created_at: string;
}

export interface MeetingRoom {
  id: string;
  name: string;
  location: string;
  capacity: number;
}

export interface Meeting {
  id: string;
  title: string;
  room_id: string;
  organizer_id: string;
  start_time: string;
  end_time: string;
  description?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  condition: string;
  location: string;
  updated_at: string;
}

export type InventoryRequestType = 'borrow' | 'new_item' | 'report_damage';
export type InventoryRequestStatus = 'pending' | 'approved' | 'rejected';

export interface InventoryRequest {
  id: string;
  user_id: string;
  user_name?: string;
  item_id?: string;
  item_name: string;
  type: InventoryRequestType;
  quantity: number;
  reason: string;
  borrow_start_date?: string;
  borrow_end_date?: string;
  status: InventoryRequestStatus;
  admin_note?: string;
  created_at: string;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  type: 'cuti' | 'izin_sakit';
  reason: string;
  start_date: string;
  end_date: string;
  status: 'pending' | 'approved' | 'rejected';
  medical_certificate_url?: string;
  admin_note?: string;
  created_at: string;
}
