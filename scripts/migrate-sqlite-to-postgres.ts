import 'dotenv/config';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import pg from 'pg';
import { rowToUser as sqliteRowToUser, rowToGame as sqliteRowToGame } from './sqliteMappers.js';
import { User, LiveGameSession, UserCredentials, Guild, AdminLog, Announcement, OverrideAnnouncement, GameMode, TowerRank } from '../types/index.js';
import { runSchemaAndMigrations } from '../server/db/connection.js';

const { Pool } = pg;

const migrate = async () => {
    console.log('[MIGRATE] Starting migration script...');

    // --- Connect to Databases ---
    let sqliteDb, pgPool, pgClient;
    try {
        console.log('[MIGRATE] Connecting to SQLite...');
        sqliteDb = await open({
            filename: './database.sqlite',
            driver: sqlite3.Database
        });
        console.log('[MIGRATE] SQLite connected.');

        console.log('[MIGRATE] Connecting to PostgreSQL...');
        if (!process.env.DATABASE_URL) {
            console.error('\n❌ [오류] 데이터베이스 연결 주소를 찾을 수 없습니다.');
            console.error('================================================================================');
            console.error('해결 방법:');
            console.error('1. 프로젝트 최상위 폴더(package.json 파일이 있는 곳)에 `.env` 라는 이름의 파일을 만드세요.');
            console.error('   - 파일 이름은 반드시 점(.)으로 시작해야 합니다.');
            console.error('   - 예: `C:\\firstproject\\BSBaduk\\.env`');
            console.error('\n2. `.env` 파일 안에 Supabase에서 복사한 "Connection String"을 아래와 같이 붙여넣으세요.');
            console.error('   DATABASE_URL="postgres://postgres.[...]:[YOUR-PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres"');
            console.error('\n3. 가장 중요: `[YOUR-PASSWORD]` 부분을 실제 데이터베이스 비밀번호로 수정해주세요.');
            console.error('   - 대괄호 `[]`도 함께 지워야 합니다.');
            console.error('\n4. 파일을 저장한 후, 다시 `npm run migrate` 명령어를 실행하세요.');
            console.error('================================================================================\n');
            process.exit(1);
        }
        pgPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
        
        // Drop existing tables to ensure a clean slate with the correct schema
        const tempClient = await pgPool.connect();
        try {
            console.log('[MIGRATE] Dropping existing tables to ensure a clean migration...');
            await tempClient.query(`
                DROP TABLE IF EXISTS kv CASCADE;
                DROP TABLE IF EXISTS users CASCADE;
                DROP TABLE IF EXISTS user_credentials CASCADE;
                DROP TABLE IF EXISTS live_games CASCADE;
                DROP TABLE IF EXISTS schema_version CASCADE;
            `);
            console.log('[MIGRATE] Tables dropped successfully.');
        } catch (e) {
            console.error('[MIGRATE] Error dropping tables:', e);
            throw e; // Stop if we can't drop tables
        } finally {
            tempClient.release();
        }

        console.log('[MIGRATE] Running PostgreSQL schema setup...');
        await runSchemaAndMigrations(pgPool);
        console.log('[MIGRATE] PostgreSQL schema is up to date.');

        pgClient = await pgPool.connect();
        console.log('[MIGRATE] PostgreSQL connected.');
    } catch (err: any) {
        console.error('[MIGRATE] Database connection failed:', err.message);
        if (err.message.includes('password authentication failed')) {
            console.error('[MIGRATE] HINT: The password in your .env file seems to be incorrect. Please double-check it.');
        } else if (err.message.includes('searchParams')) {
             console.error('\n❌ [오류] 데이터베이스 연결 주소를 찾을 수 없습니다.');
            console.error('================================================================================');
            console.error('해결 방법:');
            console.error('1. 프로젝트 최상위 폴더(package.json 파일이 있는 곳)에 `.env` 라는 이름의 파일을 만드세요.');
            console.error('   - 파일 이름은 반드시 점(.)으로 시작해야 합니다.');
            console.error('   - 예: `C:\\firstproject\\BSBaduk\\.env`');
            console.error('\n2. `.env` 파일 안에 Supabase에서 복사한 "Connection String"을 아래와 같이 붙여넣으세요.');
            console.error('   DATABASE_URL="postgres://postgres.[...]:[YOUR-PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres"');
            console.error('\n3. 가장 중요: `[YOUR-PASSWORD]` 부분을 실제 데이터베이스 비밀번호로 수정해주세요.');
            console.error('   - 대괄호 `[]`도 함께 지워야 합니다.');
            console.error('\n4. 파일을 저장한 후, 다시 `npm run migrate` 명령어를 실행하세요.');
            console.error('================================================================================\n');
        }
        else {
            console.error('[MIGRATE] HINT: Please check if your DATABASE_URL in the .env file is correct and that you have internet access.');
        }
        process.exit(1);
    }

    try {
        await pgClient.query('BEGIN');
        console.log('[MIGRATE] Started PostgreSQL transaction.');

        // --- Migrate Users ---
        console.log('[MIGRATE] Migrating users...');
        const users = await sqliteDb.all('SELECT * FROM users');
        for (const userRow of users) {
            const user = sqliteRowToUser(userRow);
            if (user) {
                const columns = Object.keys(user);
                const placeholders = columns.map((_, i) => `$${i + 1}`).join(',');
                const values = columns.map(key => {
                    const value = (user as any)[key];
                    return typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
                });
                await pgClient.query(`INSERT INTO users (${columns.map(c => `"${c}"`).join(',')}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`, values);
            }
        }
        console.log(`[MIGRATE] Migrated ${users.length} users.`);

        // --- Migrate Credentials ---
        console.log('[MIGRATE] Migrating user_credentials...');
        const credentials = await sqliteDb.all('SELECT * FROM user_credentials');
        for (const cred of credentials) {
            await pgClient.query('INSERT INTO user_credentials (username, "passwordHash", "userId") VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING', [cred.username, cred.passwordHash, cred.userId]);
        }
        console.log(`[MIGRATE] Migrated ${credentials.length} credentials.`);

        // --- Migrate Live Games ---
        console.log('[MIGRATE] Migrating live_games...');
        const games = await sqliteDb.all('SELECT * FROM live_games');
        for (const gameRow of games) {
            const game = sqliteRowToGame(gameRow);
            if (game) {
                const serialized: any = {};
                for (const key in game) {
                    const value = (game as any)[key];
                    if (typeof value === 'object' && value !== null) {
                        serialized[key] = JSON.stringify(value);
                    } else {
                        serialized[key] = value;
                    }
                }
                
                delete serialized.pendingAiMove;
                
                const columns = Object.keys(serialized);
                const placeholders = columns.map((_, i) => `$${i + 1}`).join(',');
                const values = columns.map(key => serialized[key]);

                await pgClient.query(`INSERT INTO live_games (${columns.map(c => `"${c}"`).join(',')}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`, values);
            }
        }
        console.log(`[MIGRATE] Migrated ${games.length} games.`);

        // --- Migrate KV Store ---
        console.log('[MIGRATE] Migrating kv store...');
        const kvPairs = await sqliteDb.all('SELECT * FROM kv');
        for (const pair of kvPairs) {
            await pgClient.query('INSERT INTO kv (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [pair.key, pair.value]);
        }
        console.log(`[MIGRATE] Migrated ${kvPairs.length} key-value pairs.`);

        await pgClient.query('COMMIT');
        console.log('[MIGRATE] Transaction committed.');
        console.log('[MIGRATE] Migration complete!');
    } catch (err: any) {
        console.error('[MIGRATE] An error occurred during migration:', err.message);
        console.error(err.stack);
        await pgClient.query('ROLLBACK');
        console.error('[MIGRATE] Transaction rolled back.');
    } finally {
        if (sqliteDb) await sqliteDb.close();
        if (pgClient) pgClient.release();
        if (pgPool) await pgPool.end();
        console.log('[MIGRATE] Database connections closed.');
    }
};

migrate();
