import { Pool } from 'pg';
import { broadcast } from '../services/supabaseService.js';

export const getKV = async <T>(db: Pool, key: string): Promise<T | null> => {
    const res = await db.query('SELECT value FROM kv WHERE key = $1', [key]);
    const row = res.rows[0];
    // The 'pg' driver automatically parses JSONB columns into JS objects.
    // Calling JSON.parse on an object that's already parsed will cause an error.
    // We can just return the value directly.
    return row?.value ?? null;
};

export const setKV = async <T>(db: Pool, key: string, value: T): Promise<void> => {
    await db.query('INSERT INTO kv (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, JSON.stringify(value)]);
    await broadcast({ event: 'KV_UPDATE', payload: { key, value } });
};