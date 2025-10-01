import { type User } from '../../types/index.js';
import { Database } from 'sqlite';
import { rowToUser } from './mappers.js';

export const getAllUsers = async (db: Database): Promise<User[]> => {
    const rows = await db.all('SELECT * FROM users');
    return rows.map(rowToUser).filter((u): u is User => u !== null);
};

// Implement missing repository functions.
export const getUser = async (db: Database, id: string): Promise<User | null> => {
    const row = await db.get('SELECT * FROM users WHERE id = ?', id);
    return rowToUser(row);
};

export const getUserByNickname = async (db: Database, nickname: string): Promise<User | null> => {
    const row = await db.get('SELECT * FROM users WHERE nickname = ?', nickname);
    return rowToUser(row);
};

export const createUser = async (db: Database, user: User): Promise<void> => {
    const columns = Object.keys(user);
    const placeholders = columns.map(() => '?').join(',');
    const values = columns.map(key => {
        const value = (user as any)[key];
        return typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
    });
    await db.run(`INSERT INTO users (${columns.join(',')}) VALUES (${placeholders})`, ...values);
};


export const updateUser = async (db: Database, user: User): Promise<void> => {
    const columns = Object.keys(user).filter(key => key !== 'id');
    const setClause = columns.map(key => `${key} = ?`).join(', ');
    const values = columns.map(key => {
        const value = (user as any)[key];
        return typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
    });
    
    await db.run(`UPDATE users SET ${setClause} WHERE id = ?`, ...values, user.id);
};

export const deleteUser = async (db: Database, id: string): Promise<void> => {
    await db.run('DELETE FROM users WHERE id = ?', id);
};
