
import { Pool } from 'pg';
import { initializeAndGetDb, getDb } from './db/connection.js';
import { User, LiveGameSession, AppState, UserCredentials, AdminLog, Announcement, OverrideAnnouncement, GameMode, Guild, TowerRank, UserStatusInfo, UserWithStatus } from '../types/index.js';
import { getInitialState } from './initialData.js';

// --- Initialization and Seeding ---
let isInitialized = false;

const seedInitialData = async (db: Pool) => {
    console.log('[DB] Ensuring initial data is present...');
    const userRepository = await import('./repositories/userRepository.js');
    const credentialsRepository = await import('./repositories/credentialsRepository.js');
    const initialState = getInitialState();
    const usersToEnsure = Object.values(initialState.users);
    const credentialsToEnsure = initialState.userCredentials;

    for (const user of usersToEnsure) {
        const existingUser = await userRepository.getUserByUsername(db, user.username);
        if (!existingUser) {
            console.log(`[DB] Creating initial user: ${user.nickname}`);
            await userRepository.createUser(db, user);
        } else {
            // Update existing user to ensure data consistency, e.g., isAdmin status
            console.log(`[DB] Updating initial user: ${user.nickname}`);
            await userRepository.updateUser(db, user);
        }
    }
    
    for (const username of Object.keys(credentialsToEnsure)) {
        const cred = credentialsToEnsure[username];
        const existingCreds = await credentialsRepository.getUserCredentials(db, username);
        if (!existingCreds) {
            console.log(`[DB] Creating credentials for initial user: ${username}`);
            if (cred.hash && cred.salt) {
                await credentialsRepository.createUserCredentials(db, username, cred.hash, cred.salt, cred.userId);
            }
        } else if (existingCreds.hash !== cred.hash || existingCreds.salt !== cred.salt) {
            console.log(`[DB] Updating credentials for initial user: ${username}`);
            if (cred.hash && cred.salt) {
                await credentialsRepository.updateUserPassword(db, cred.userId, cred.hash, cred.salt);
            }
        }
    }
    console.log('[DB] Initial data presence ensured.');
};

export const initializeDatabase = async () => {
    if (isInitialized) return;
    const db = await initializeAndGetDb();
    const userCountResult = await db.query<{ count: string }>('SELECT COUNT(*) as count FROM users');
    const userCount = userCountResult.rows[0] ? parseInt(userCountResult.rows[0].count, 10) : 0;
    // Always ensure initial data is present for development/testing
    await seedInitialData(db);
    isInitialized = true;
};


// --- Repository Functions ---

// --- Key-Value Store ---
export const getKV = async <T>(key: string): Promise<T | null> => {
    const kvRepository = await import('./repositories/kvRepository.js');
    return kvRepository.getKV(await getDb(), key);
};
export const setKV = async <T>(key: string, value: T): Promise<void> => {
    const kvRepository = await import('./repositories/kvRepository.js');
    return kvRepository.setKV(await getDb(), key, value);
};

// --- Atomic Status Updates ---
export const updateUserStatus = async (userId: string, statusInfo: UserStatusInfo): Promise<void> => {
    const db = await getDb();
    await db.query(
        `INSERT INTO kv (key, value)
         VALUES ('userStatuses', jsonb_build_object($1::text, $2::jsonb))
         ON CONFLICT (key) DO UPDATE
         SET value = kv.value || jsonb_build_object($1::text, $2::jsonb);`,
        [userId, JSON.stringify(statusInfo)]
    );
};

export const removeUserStatus = async (userId: string): Promise<void> => {
    const db = await getDb();
    await db.query(`
        UPDATE kv
        SET value = value - $1::text
        WHERE key = 'userStatuses';
    `, [userId]);
};

export const getUserStatus = async (userId: string): Promise<UserStatusInfo | null> => {
    const userStatuses = await getKV<Record<string, UserStatusInfo>>('userStatuses') || {};
    return userStatuses[userId] || null;
};


// --- User Functions ---
export const getAllUsers = async (): Promise<User[]> => {
    const userRepository = await import('./repositories/userRepository.js');
    return userRepository.getAllUsers(await getDb());
};
export const getUser = async (id: string): Promise<User | null> => {
    const userRepository = await import('./repositories/userRepository.js');
    return userRepository.getUser(await getDb(), id);
};
export const getUserByNickname = async (nickname: string): Promise<User | null> => {
    const userRepository = await import('./repositories/userRepository.js');
    return userRepository.getUserByNickname(await getDb(), nickname);
};

export const getUserByKakaoId = async (kakaoId: string): Promise<User | null> => {
    const userRepository = await import('./repositories/userRepository.js');
    return userRepository.getUserByKakaoId(await getDb(), kakaoId);
};

export const createUser = async (user: User): Promise<void> => {
    const userRepository = await import('./repositories/userRepository.js');
    return userRepository.createUser(await getDb(), user);
};
export const updateUser = async (user: User): Promise<void> => {
    const userRepository = await import('./repositories/userRepository.js');
    return userRepository.updateUser(await getDb(), user);
};
export const deleteUser = async (id: string): Promise<void> => {
    const db = await getDb();
    const userRepository = await import('./repositories/userRepository.js');
    const credentialsRepository = await import('./repositories/credentialsRepository.js');
    const user = await userRepository.getUser(db, id);
    if (user) {
        await credentialsRepository.deleteUserCredentials(db, user.username);
        await userRepository.deleteUser(db, id);
    }
};

// --- User Credentials Functions ---
export const getUserCredentials = async (username: string): Promise<UserCredentials | null> => {
    const credentialsRepository = await import('./repositories/credentialsRepository.js');
    return credentialsRepository.getUserCredentials(await getDb(), username);
};
export const getUserCredentialsByUserId = async (userId: string): Promise<UserCredentials | null> => {
    const credentialsRepository = await import('./repositories/credentialsRepository.js');
    return credentialsRepository.getUserCredentialsByUserId(await getDb(), userId);
};
export const createUserCredentials = async (username: string, hash: string, salt: string, userId: string): Promise<void> => {
    const credentialsRepository = await import('./repositories/credentialsRepository.js');
    return credentialsRepository.createUserCredentials(await getDb(), username, hash, salt, userId);
};
export const updateUserPassword = async (userId: string, newHash: string, newSalt: string): Promise<void> => {
    const credentialsRepository = await import('./repositories/credentialsRepository.js');
    return credentialsRepository.updateUserPassword(await getDb(), userId, newHash, newSalt);
};


// --- Game Functions ---
export const getLiveGame = async (id: string): Promise<LiveGameSession | null> => {
    const gameRepository = await import('./repositories/gameRepository.js');
    return gameRepository.getLiveGame(await getDb(), id);
};
export const getAllActiveGames = async (): Promise<LiveGameSession[]> => {
    const gameRepository = await import('./repositories/gameRepository.js');
    return gameRepository.getAllActiveGames(await getDb());
};
export const getAllEndedGames = async (): Promise<LiveGameSession[]> => {
    const gameRepository = await import('./repositories/gameRepository.js');
    return gameRepository.getAllEndedGames(await getDb());
};
export const saveGame = async (game: LiveGameSession): Promise<void> => {
    const gameRepository = await import('./repositories/gameRepository.js');
    return gameRepository.saveGame(await getDb(), game);
};
export const deleteGame = async (id: string): Promise<void> => {
    const gameRepository = await import('./repositories/gameRepository.js');
    return gameRepository.deleteGame(await getDb(), id);
};


// --- Full State Retrieval (for client sync) ---
export const getAllData = async (userId: string): Promise<Pick<AppState, 'users' | 'liveGames' | 'announcements' | 'globalOverrideAnnouncement' | 'gameModeAvailability' | 'announcementInterval' | 'guilds' | 'towerRankings' | 'onlineUsers'>> => {
    const db = await getDb();
    const userRepository = await import('./repositories/userRepository.js');
    const gameRepository = await import('./repositories/gameRepository.js');
    const kvRepository = await import('./repositories/kvRepository.js');
    
    const currentUser = await userRepository.getUser(db, userId);
    const liveGames = currentUser?.gameId ? [await gameRepository.getLiveGame(db, currentUser.gameId)].filter(Boolean) as LiveGameSession[] : [];
    
    const announcements = await kvRepository.getKV<Announcement[]>(db, 'announcements') || [];
    const globalOverrideAnnouncement = await kvRepository.getKV<OverrideAnnouncement | null>(db, 'globalOverrideAnnouncement');
    const gameModeAvailability = await kvRepository.getKV<Record<GameMode, boolean>>(db, 'gameModeAvailability') || {} as Record<GameMode, boolean>;
    const announcementInterval = await kvRepository.getKV<number>(db, 'announcementInterval') || 3;
    const guilds = await kvRepository.getKV<Record<string, Guild>>(db, 'guilds') || {};
    
    // Fetch all users for ranking purposes
    const allDbUsers = await userRepository.getAllUsers(db);

    const userStatuses = await kvRepository.getKV<Record<string, UserStatusInfo>>(db, 'userStatuses') || {};
    const onlineUsersWithStatus: UserWithStatus[] = (await Promise.all(allDbUsers.map(async user => {
        const statusInfo = userStatuses[user.id];
        if (statusInfo) {
            return { ...user, ...statusInfo };
        }
        return null;
    }))).filter(Boolean) as UserWithStatus[];

    const towerRankings = allDbUsers
        .filter(u => u && u.towerProgress && u.towerProgress.highestFloor > 0)
        .sort((a, b) => {
            if (b!.towerProgress!.highestFloor !== a!.towerProgress!.highestFloor) {
                return b!.towerProgress!.highestFloor - a!.towerProgress!.highestFloor;
            }
            return a!.towerProgress!.lastClearTimestamp - b!.towerProgress!.lastClearTimestamp;
        })
        .map((user, index): TowerRank => ({
            rank: index + 1,
            user: user!,
            floor: user!.towerProgress!.highestFloor,
        }));

    return {
        users: allDbUsers.reduce((acc: Record<string, User>, user: User) => { acc[user.id] = user; return acc; }, {}),
        liveGames: liveGames.reduce((acc: Record<string, LiveGameSession>, game: LiveGameSession) => { acc[game.id] = game; return acc; }, {}),
        announcements,
        globalOverrideAnnouncement,
        gameModeAvailability,
        announcementInterval,
        guilds,
        towerRankings,
        onlineUsers: onlineUsersWithStatus, // Add onlineUsers to the returned data
    };
};
