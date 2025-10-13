
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
// FIX: Import process from 'process' to make Node.js globals available.
import process from 'process';

const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
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
        // FIX: Separate 'username' from the typed object literal to match the UserCredentials type and the createUserCredentials function signature.
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

    try {
        const sqliteDb = await open({
            filename: './sudam.sqlite',
            driver: sqlite3.Database
        });
        
        await pgPool.connect();

        await migrateUsers(sqliteDb);
        await migrateCredentials(sqliteDb);
        await migrateGames(sqliteDb);
        await migrateKvStore(sqliteDb);

        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await pgPool.end();
        process.exit(0);
    }
}

main();