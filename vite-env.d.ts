// FIX: Removed failing triple-slash directive as it was causing a "Cannot find type definition file" error.
// /// <reference types="vite/client" />

// FIX: Removed failing triple-slash reference to "node" and manually defined the necessary NodeJS.ErrnoException type below to resolve compilation errors.
// /// <reference types="node" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// This file augments the NodeJS.ProcessEnv type to include Vite environment variables.
// This is necessary for server-side scripts that might use process.env.
declare namespace NodeJS {
  interface ProcessEnv {
    VITE_SUPABASE_URL: string;
    VITE_SUPABASE_ANON_KEY: string;
    DATABASE_URL?: string;
  }
  // FIX: Manually define NodeJS.ErrnoException to fix type errors in server files.
  interface ErrnoException extends Error {
    errno?: number;
    code?: string;
    path?: string;
    syscall?: string;
  }
}

declare module '*.css';

declare module 'https://aistudiocdn.com/@supabase/supabase-js@2.58.0' {
  export function createClient(supabaseUrl: string, supabaseKey: string, options?: any): any;
  export type AuthChangeEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'USER_DELETED' | 'PASSWORD_RECOVERY' | 'MFA_CHALLENGE_VERIFIED';
  export type Session = any;
  export type UserIdentity = any;
}