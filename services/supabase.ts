import { createClient } from 'https://aistudiocdn.com/@supabase/supabase-js@2.58.0';
import { User } from '../types';

// Extend the Supabase User type with our app-specific metadata if needed in the future
export type SupabaseUser = User;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be provided in environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);