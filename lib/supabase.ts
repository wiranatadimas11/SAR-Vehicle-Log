import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type VehicleStatus = 'TERSEDIA' | 'SEDANG DIGUNAKAN' | 'MAINTENANCE' | 'TIDAK AKTIF';

export type Vehicle = {
  id: string;
  name: string;
  status: VehicleStatus;
  current_km: number;
  fuel_tank_capacity_liters: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type VehicleLog = {
  id: string;
  vehicle_id: string;
  personnel_name: string;
  destination: string;
  purpose: string;
  exit_time: string;
  entry_time: string | null;
  km_exit: number;
  km_entry: number | null;
  total_distance: number | null;
  exit_odometer_photo: string;
  entry_odometer_photo: string | null;
  fuel_exit_percentage: number | null;
  fuel_entry_percentage: number | null;
  total_fuel_percentage: number | null;
  vehicle_condition: string;
  notes: string | null;
  vehicle?: {
    name: string;
    fuel_tank_capacity_liters: number | null;
  } | null;
};
