import { createClient } from '@supabase/supabase-js';

// The Supabase URL and public anon key are now read from Vite's environment variables.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    const rootEl = document.getElementById('root');
    if (rootEl) {
        rootEl.innerHTML = '<div style="color:red;padding:2rem;text-align:center;font-family:sans-serif;"><h2>Configuration Error</h2><p>VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be configured in your .env file.</p></div>';
    }
    throw new Error('Supabase URL and Anon Key must be provided in .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
