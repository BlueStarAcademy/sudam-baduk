// server/server.ts
import express, { type Express, type RequestHandler } from 'express';
import cors from 'cors';
import * as crypto from 'crypto';
import { initializeDatabase, getAllData, getUserCredentials, createUserCredentials, createUser, getUser, updateUser, getKV, setKV, updateUserStatus, removeUserStatus } from './db.js';
import { handleAction } from './actions/gameActions.js';
import { type ServerAction, type User, type ChatMessage, Guild, UserStatus, type UserStatusInfo } from '../types/index.js';
import { createDefaultUser } from './initialData.js';
import { resetAndGenerateQuests } from './questService.js';
import { performOneTimeReset, performOneTimeGuildResearchMigration, performOneTimeMbtiReset } from './scheduledTasks.js';
import * as db from './db.js';
import { randomUUID } from 'crypto';
import { containsProfanity } from '../profanity.js';
import { broadcast } from './services/supabaseService.js';

// Volatile state is removed. All state will be managed in the database.

const app: Express = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const userMiddleware: RequestHandler = async (req, res, next) => {
    // Skip middleware for public auth paths
    if (['/api/auth/login', '/api/auth/register', '/api/auth/sync', '/api/auth/finalize-kakao', '/api/initial-state'].includes(req.path)) {
        return next();
    }

    const { userId, sessionId } = req.body;
    if (!userId || !sessionId) {
        // For actions that require auth, enforce it.
        // The LOGOUT action is a special case handled in the action endpoint itself.
        if (req.body.type !== 'LOGOUT') {
            return res.status(401).json({ message: 'User ID and Session ID are required.' });
        }
        return next();
    }
    
    const allSessions = (await getKV<Record<string, string>>('userSessions') || {}) as Record<string, string>;
    const storedSessionId = allSessions[userId];

    if (!storedSessionId || storedSessionId !== sessionId) {
        return res.status(401).json({ message: 'Session expired or invalid.' });
    }
    
    const user = await getUser(userId);
    if (user) {
        req.user = user;
    } else {
        return res.status(404).json({ message: 'User not found.' });
    }
    next();
};

app.use(userMiddleware);

import { handleCronTick } from './cron.js';

app.get('/api/cron/tick', handleCronTick);

app.post('/api/auth/register', async (req, res) => {
    const { username, password, nickname } = req.body;
    if (!username || !password || !nickname) {
        return res.status(400).json({ message: 'Username, password, and nickname are required.' });
    }
    try {
        const existingByUsername = await getUserCredentials(username);
        if (existingByUsername) {
            return res.status(409).json({ message: 'Username already exists.' });
        }
        
        const allUsers = await db.getAllUsers();
        if (allUsers.some(u => u.nickname.toLowerCase() === nickname.toLowerCase())) {
            return res.status(409).json({ message: 'Nickname already exists.' });
        }

        const newUser = createDefaultUser(`user-${globalThis.crypto.randomUUID()}`, username, nickname, false);
        await createUser(newUser);
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
        await createUserCredentials(username, hash, salt, newUser.id);

        const sessionId = randomUUID();
        const allSessions = (await getKV<Record<string, string>>('userSessions') || {}) as Record<string, string>;
        allSessions[newUser.id] = sessionId;
        await setKV('userSessions', allSessions);

        res.json({ user: newUser, sessionId });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: '아이디와 비밀번호를 모두 입력해주세요.' });
    }
    try {
        const credentials = await getUserCredentials(username);
        if (!credentials || !credentials.hash || !credentials.salt) {
            return res.status(401).json({ message: '잘못된 아이디 또는 비밀번호입니다.' });
        }

        const hashToCompare = crypto.pbkdf2Sync(password, credentials.salt, 10000, 64, 'sha512').toString('hex');
        if (credentials.hash !== hashToCompare) {
            return res.status(401).json({ message: '잘못된 아이디 또는 비밀번호입니다.' });
        }
        
        let user = await getUser(credentials.userId);
        if (!user) {
            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }
        
        user = await resetAndGenerateQuests(user);
        
        const sessionId = randomUUID();
        const allSessions = (await getKV<Record<string, string>>('userSessions') || {}) as Record<string, string>;
        allSessions[user.id] = sessionId;
        await setKV('userSessions', allSessions);
        
        const statusInfo: UserStatusInfo = { status: UserStatus.Online, stateEnteredAt: Date.now() };
        await updateUserStatus(user.id, statusInfo);
        
        // Broadcast the user's new status
        const userStatuses = await getKV('userStatuses') || {};
        userStatuses[user.id] = statusInfo;
        await setKV('userStatuses', userStatuses);
        await broadcast({ type: 'USER_STATUS_UPDATE', payload: { userId: user.id, statusInfo } });

        res.json({ user, sessionId });
    } catch (error: any) {
        console.error(`[Login Error] for user ${username}:`, error);
        res.status(500).json({ message: error.message || 'A server error occurred during login.' });
    }
});

app.post('/api/auth/sync', async (req, res) => {
    const { session } = req.body;
    if (!session || !session.user) {
        return res.status(400).json({ message: 'Session data is required.' });
    }

    const supabaseUser = session.user;
    const kakaoIdentity = supabaseUser.identities?.find((id: any) => id.provider === 'kakao');

    if (!kakaoIdentity) {
        return res.status(400).json({ message: 'Kakao identity not found in session.' });
    }

    const kakaoId = kakaoIdentity.id;

    try {
        let user = await db.getUserByKakaoId(kakaoId);
        
        if (!user) {
            return res.json({
                needsRegistration: true,
                kakaoId: kakaoId,
                suggestedNickname: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || '카카오 유저',
            });
        }
        
        user = await resetAndGenerateQuests(user);
        
        const sessionId = randomUUID();
        const allSessions = (await getKV<Record<string, string>>('userSessions') || {}) as Record<string, string>;
        allSessions[user.id] = sessionId;
        await setKV('userSessions', allSessions);
        
        const statusInfo: UserStatusInfo = { status: UserStatus.Online, stateEnteredAt: Date.now() };
        await updateUserStatus(user.id, statusInfo);

        const userStatuses = await getKV('userStatuses') || {};
        userStatuses[user.id] = statusInfo;
        await setKV('userStatuses', userStatuses);
        await broadcast({ type: 'USER_STATUS_UPDATE', payload: { userId: user.id, statusInfo } });

        res.json({ user, sessionId });

    } catch (error: any) {
        console.error('Error during user sync:', error);
        res.status(500).json({ message: 'Failed to sync user.' });
    }
});

app.post('/api/auth/finalize-kakao', async (req, res) => {
    const { kakaoId, nickname } = req.body;
    if (!kakaoId || !nickname) {
        return res.status(400).json({ message: '카카오 정보 또는 닉네임이 누락되었습니다.' });
    }
    try {
        if (nickname.trim().length < 2 || nickname.trim().length > 12) {
            return res.status(400).json({ message: '닉네임은 2자 이상 12자 이하로 입력해주세요.' });
        }
        if (containsProfanity(nickname)) {
            return res.status(400).json({ message: '닉네임에 부적절한 단어가 포함되어 있습니다.' });
        }
        const allUsers = await db.getAllUsers();
        if (allUsers.some(u => u.nickname.toLowerCase() === nickname.toLowerCase())) {
            return res.status(409).json({ message: '이미 사용 중인 닉네임입니다.' });
        }

        const newUser = createDefaultUser(`user-${randomUUID()}`, `kakao_${kakaoId}`, nickname.trim(), false, kakaoId);
        await db.createUser(newUser);

        const sessionId = randomUUID();
        const allSessions = (await getKV<Record<string, string>>('userSessions') || {}) as Record<string, string>;
        allSessions[newUser.id] = sessionId;
        await setKV('userSessions', allSessions);
        
        const statusInfo: UserStatusInfo = { status: UserStatus.Online, stateEnteredAt: Date.now() };
        await updateUserStatus(newUser.id, statusInfo);
        
        const userStatuses = await getKV('userStatuses') || {};
        userStatuses[newUser.id] = statusInfo;
        await setKV('userStatuses', userStatuses);
        await broadcast({ type: 'USER_STATUS_UPDATE', payload: { userId: newUser.id, statusInfo } });
        
        res.json({ user: newUser, sessionId });
    } catch (error: any) {
        console.error(`[Kakao Finalize Error] for kakaoId ${kakaoId}:`, error);
        res.status(500).json({ message: 'An internal server error occurred during registration.' });
    }
});

app.post('/api/initial-state', async (req, res) => {
    const { userId } = req.body;
    
    const data = await getAllData(userId);
    
    const negotiations = await getKV('negotiations') || {};
    const waitingRoomChats = await getKV('waitingRoomChats') || {};
    const gameChats = await getKV('gameChats') || {};
    const userStatuses = await getKV('userStatuses') || {};

    // This logic might need adjustment depending on how game state is managed.
    const userStatus = userId ? (userStatuses as any)[userId] : undefined;
    if (userStatus?.status === 'in-game' && userStatus.gameId && !data.liveGames[userStatus.gameId]) {
        const endedGame = await db.getLiveGame(userStatus.gameId);
        if (endedGame) {
            data.liveGames[endedGame.id] = endedGame;
        }
    }

    res.json({ 
        ...data, 
        negotiations, 
        waitingRoomChats, 
        gameChats,
        userStatuses,
    });
});

app.post('/api/action', async (req, res) => {
    // Logout is a special case that can be called without full user context
    if (req.body.type === 'LOGOUT' && req.body.userId) {
        console.log(`Processing beacon logout for user ${req.body.userId}`);
        const userId = req.body.userId;
        
        await removeUserStatus(userId);
        
        const allSessions = (await getKV<Record<string, string>>('userSessions') || {}) as Record<string, string>;
        delete allSessions[userId];
        await setKV('userSessions', allSessions);

        const userStatuses = await getKV('userStatuses') || {};
        delete userStatuses[userId];
        await setKV('userStatuses', userStatuses);
        await broadcast({ type: 'USER_STATUS_UPDATE', payload: { userId, statusInfo: null } }); // Notify clients of logout

        return res.json({ success: true });
    }

    const user = req.user;
    if (!user) {
        return res.status(401).json({ message: 'Authentication required for this action.' });
    }
    
    // The `handleAction` function needs to be refactored to not use volatileState.
    // This is a temporary solution that passes a dummy object.
    // TODO: Refactor handleAction to be stateless.
    const dummyVolatileState = {
        userConnections: {}, userSessions: {}, userStatuses: {}, negotiations: {},
        userLastChatMessage: {}, waitingRoomChats: {}, gameChats: {},
        activeTournaments: {}, activeTournamentViewers: new Set(),
    };

    const action: ServerAction & { user: User } = { ...req.body, user };
    
    try {
        // IMPORTANT: handleAction must be refactored to be stateless.
        // It should fetch state from DB, perform action, save state, and return events to broadcast.
        const result = await handleAction(action, dummyVolatileState);

        // After the action, we should broadcast any state changes that result from it.
        // The `result` from `handleAction` should ideally contain information about what changed.
        // For example: await broadcast({ type: 'GAME_STATE_UPDATE', payload: newGameState });

        if (result?.error) {
            res.status(400).json({ message: result.error });
        } else {
            res.json(result?.clientResponse || { success: true });
        }
    } catch (error: any) {
        console.error('Error handling action:', action.type, error);
        res.status(500).json({ message: error.message || 'An internal server error occurred.' });
    }
});

// The `startServer` and `setInterval` logic is removed.
// It will be replaced by Vercel Cron Jobs that call specific API endpoints.

// Example of what a cron job handler would look like:
/*
app.get('/api/cron/minute-tick', async (req, res) => {
    // IMPORTANT: Add authentication to prevent unauthorized execution
    // For example, check a secret from process.env
    if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).send('Unauthorized');
    }

    // All the logic from the old setInterval(..., 5000) would go here.
    // e.g., checking for timed out users, idle users, expired negotiations.
    // It needs to be adapted to be stateless (read from DB, write to DB, broadcast changes).
    
    res.status(200).send('Cron job executed.');
});
*/

// Initialize the database once when the function is loaded.
// Vercel will keep the function "warm" for a period, so this won't run on every single request.
initializeDatabase().catch(err => {
    console.error('[Server] Failed to initialize database:', err);
});

export default app;