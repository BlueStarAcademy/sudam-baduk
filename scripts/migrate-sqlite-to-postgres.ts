

import 'dotenv/config';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { Pool } from 'pg';
import { rowToUser as sqliteRowToUser, rowToGame as sqliteRowToGame } from './sqliteMappers.js';
import { User, LiveGameSession, UserCredentials } from '../types/index.js';
import * as pgUserRepo from '../server/repositories/userRepository.js';
import * as pgGameRepo from '../server/repositories/gameRepository.js';
import * as pgKvRepo from '../server/repositories/kvRepository.js';
import * as pgCredRepo from '../server/repositories/credentialsRepository.js';
import { URL } from 'url';
import fs from 'fs';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.warn('Supabase server-side environment variables VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY are missing.');
    throw new Error('DATABASE_URL is not set in your environment variables.');
}

try {
    new URL(connectionString);
} catch (e) {
    console.error(`[DB Migration] The DATABASE_URL in your .env file is not a valid URL. Please check for typos or special characters that might need to be encoded (like '#' or '@' in the password). It is also recommended to wrap the entire URL in double quotes in your .env file.`);
    console.error(`[DB Migration] Invalid value: "${connectionString}"`);
    process.exit(1);
}

const pgPool = new Pool({
    connectionString: connectionString,
});

const migrateUsers = async (sqliteDb: any) => {
    console.log('Migrating users...');
    const users = await sqliteDb.all('SELECT * FROM users');
    for (const row of users) {
        const user = sqliteRowToUser(row);
        if (user) {
            try {
                await pgUserRepo.createUser(pgPool, user);
            } catch (e: any) {
                if (e.code === '23505') { // unique_violation
                    console.log(`User ${user.username} already exists, updating...`);
                    await pgUserRepo.updateUser(pgPool, user);
                } else {
                    console.error(`Error migrating user ${user.username}:`, e);
                }
            }
        }
    }
    console.log(`Migrated ${users.length} users.`);
};

const migrateCredentials = async (sqliteDb: any) => {
    console.log('Migrating credentials...');
    const creds = await sqliteDb.all('SELECT * FROM user_credentials');
    for (const row of creds) {
        const userCreds = {
            userId: row.userId,
            hash: row.hash,
            salt: row.salt,
        };
        if (userCreds && userCreds.hash && userCreds.salt && row.username) {
             await pgCredRepo.createUserCredentials(pgPool, row.username, userCreds.hash, userCreds.salt, userCreds.userId);
        }
    }
    console.log(`Migrated ${creds.length} credentials.`);
};

const migrateGames = async (sqliteDb: any) => {
    console.log('Migrating games...');
    const games = await sqliteDb.all('SELECT * FROM live_games');
    for (const row of games) {
        const game = sqliteRowToGame(row);
        if (game) {
            await pgGameRepo.saveGame(pgPool, game);
        }
    }
    console.log(`Migrated ${games.length} games.`);
};

const migrateKvStore = async (sqliteDb: any) => {
    console.log('Migrating key-value store...');
    const kvs = await sqliteDb.all('SELECT * FROM kv');
    for (const row of kvs) {
        await pgKvRepo.setKV(pgPool, row.key, JSON.parse(row.value));
    }
    console.log(`Migrated ${kvs.length} key-value pairs.`);
};

async function main() {
    console.log('Starting SQLite to PostgreSQL migration...');

    const sqliteDbPath = './database.sqlite';
    if (!fs.existsSync(sqliteDbPath)) {
        console.log(`\n✅ SQLite database file not found at ${sqliteDbPath}. This is normal for a new setup.`);
        console.log('Migration script finished successfully by skipping migration.');
        process.exit(0);
    }
    
    let sqliteDb;
    try {
        sqliteDb = await open({
            filename: sqliteDbPath,
            driver: sqlite3.Database
        });
        
        // Check if the 'users' table exists. If not, it's not a valid DB to migrate from.
        const usersTableExists = await sqliteDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
        if (!usersTableExists) {
            console.log(`\n✅ SQLite database at ${sqliteDbPath} is empty or uninitialized. This is normal for a new setup.`);
            console.log('Migration script finished successfully by skipping migration.');
            process.exit(0);
        }

        await pgPool.connect();

        await migrateUsers(sqliteDb);
        await migrateCredentials(sqliteDb);
        await migrateGames(sqliteDb);
        await migrateKvStore(sqliteDb);

        console.log('\n✅ Migration from SQLite to PostgreSQL completed successfully!');
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
    } finally {
        if (sqliteDb) await sqliteDb.close();
        await pgPool.end();
        process.exit(0);
    }
}

main();
