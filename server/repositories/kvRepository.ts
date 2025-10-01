import { Pool } from 'pg';

export const getKV = async <T>(db: Pool, key: string): Promise<T | null> => {
    const res = await db.query('SELECT value FROM kv WHERE key = $1', [key]);
    const row = res.rows[0];
    return row && row.value ? JSON.parse(row.value) : null;
};

export const setKV = async <T>(db: Pool, key: string, value: T): Promise<void> => {
    await db.query('INSERT INTO kv (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, JSON.stringify(value)]);
};
