import { Pool } from 'pg';
import { UserCredentials } from '../../types/index.js';

export const getUserCredentials = async (db: Pool, username: string): Promise<UserCredentials | null> => {
    const res = await db.query<UserCredentials>('SELECT * FROM user_credentials WHERE username = $1', [username.toLowerCase()]);
    return res.rows[0] ?? null;
};

export const getUserCredentialsByUserId = async (db: Pool, userId: string): Promise<UserCredentials | null> => {
    const res = await db.query<UserCredentials>('SELECT * FROM user_credentials WHERE "userId" = $1', [userId]);
    return res.rows[0] ?? null;
};

export const createUserCredentials = async (db: Pool, username: string, hash: string, salt: string, userId: string): Promise<void> => {
    await db.query('INSERT INTO user_credentials (username, hash, salt, "userId") VALUES ($1, $2, $3, $4)', [username.toLowerCase(), hash, salt, userId]);
};

export const updateUserPassword = async (db: Pool, userId: string, newPasswordHash: string): Promise<void> => {
    // This function would need to be updated to handle hashing if used, but for now we focus on login/register.
    const userCreds = await getUserCredentialsByUserId(db, userId);
    if (userCreds) {
        await db.query('UPDATE user_credentials SET hash = $1 WHERE "userId" = $2', [newPasswordHash, userId]);
    }
};

export const deleteUserCredentials = async (db: Pool, username: string): Promise<void> => {
    await db.query('DELETE FROM user_credentials WHERE username = $1', [username.toLowerCase()]);
};