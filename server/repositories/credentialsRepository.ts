import { Pool } from 'pg';
import { UserCredentials } from '../../types/index.js';

export const getUserCredentials = async (db: Pool, username: string): Promise<UserCredentials | null> => {
    const res = await db.query<UserCredentials>('SELECT * FROM user_credentials WHERE username = $1', [username.toLowerCase()]);
    return res.rows[0] ?? null;
};

export const getUserCredentialsByUserId = async (db: Pool, userId: string): Promise<UserCredentials | null> => {
    const res = await db.query<UserCredentials>('SELECT * FROM user_credentials WHERE userId = $1', [userId]);
    return res.rows[0] ?? null;
};

export const createUserCredentials = async (db: Pool, username: string, passwordHash: string, userId: string): Promise<void> => {
    await db.query('INSERT INTO user_credentials (username, passwordHash, userId) VALUES ($1, $2, $3)', [username.toLowerCase(), passwordHash, userId]);
};

export const updateUserPassword = async (db: Pool, userId: string, newPasswordHash: string): Promise<void> => {
    await db.query('UPDATE user_credentials SET passwordHash = $1 WHERE userId = $2', [newPasswordHash, userId]);
};

export const deleteUserCredentials = async (db: Pool, username: string): Promise<void> => {
    await db.query('DELETE FROM user_credentials WHERE username = $1', [username.toLowerCase()]);
};
