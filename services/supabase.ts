import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    const rootEl = document.getElementById('root');
    if (rootEl) {
        rootEl.innerHTML = '<div style="color:red;padding:2rem;text-align:center;font-family:sans-serif;"><h2>Configuration Error</h2><p>Supabase environment variables are missing. Please check your .env file and restart the server.</p></div>';
    }
    throw new Error('Supabase URL and Anon Key must be provided in environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
