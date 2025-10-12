
import { type User } from '../../types/index.js';
import { Pool } from 'pg';
import { rowToUser } from './mappers.js';

export const getAllUsers = async (db: Pool): Promise<User[]> => {
    const res = await db.query('SELECT * FROM users');
    return res.rows.map(rowToUser).filter((u): u is User => u !== null);
};

export const getUser = async (db: Pool, id: string): Promise<User | null> => {
    const res = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    return rowToUser(res.rows[0]);
};

export const getUserByNickname = async (db: Pool, nickname: string): Promise<User | null> => {
    const res = await db.query('SELECT * FROM users WHERE nickname = $1', [nickname]);
    return rowToUser(res.rows[0]);
};

export const getUserByKakaoId = async (db: Pool, kakaoId: string): Promise<User | null> => {
    const res = await db.query('SELECT * FROM users WHERE "kakaoId" = $1', [kakaoId]);
    return rowToUser(res.rows[0]);
};

export const createUser = async (db: Pool, user: User): Promise<void> => {
    const columns = Object.keys(user);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(',');
    const values = columns.map(key => {
        const value = (user as any)[key];
        if (value === undefined) {
            return null;
        }
        return typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
    });
    
    await db.query(`INSERT INTO users (${columns.map(c => `"${c}"`).join(',')}) VALUES (${placeholders})`, values);
};


export const updateUser = async (db: Pool, user: User): Promise<void> => {
    const columns = Object.keys(user).filter(key => key !== 'id');
    const setClause = columns.map((key, i) => `"${key}" = $${i + 1}`).join(', ');
    const values = columns.map(key => {
        const value = (user as any)[key];
        if (value === undefined) {
            return null;
        }
        return typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
    });
    
    await db.query(`UPDATE users SET ${setClause} WHERE id = $${columns.length + 1}`, [...values, user.id]);
};

export const deleteUser = async (db: Pool, id: string): Promise<void> => {
    await db.query('DELETE FROM users WHERE id = $1', [id]);
};
