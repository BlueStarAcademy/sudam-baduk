
import 'dotenv/config';
// FIX: Use default import for express and namespaced types to avoid conflicts.
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { initializeDatabase, getAllData, getUserCredentials, createUserCredentials, createUser, getUser, updateUser, getKV, setKV } from './db.js';
import { handleAction } from './actions/gameActions.js';
import { type VolatileState, type ServerAction, type User, type ChatMessage, Guild, UserStatus, type UserStatusInfo } from '../types/index.js';
import { createDefaultUser } from './initialData.js';
import { resetAndGenerateQuests, accumulateMissionRewards } from './questService.js';
import { runScheduledTasks, processWeeklyLeagueUpdates, performOneTimeReset, performOneTimeGuildResearchMigration } from './scheduledTasks.js';
import * as gameModes from './gameModes.js';
import * as db from './db.js';
import * as guildService from './guildService.js';
import { randomUUID } from 'crypto';
import { GUILD_RESEARCH_PROJECTS } from '../constants/index.js';
import { regenerateActionPoints } from './services/effectService.js';
import { getKataGoManager } from './kataGoService.js';
import { containsProfanity } from '../profanity.js';
import { broadcast } from './services/supabaseService.js';

const volatileState: VolatileState = {
    userConnections: {},
    userSessions: {},
    userStatuses: {},
    negotiations: {},
    userLastChatMessage: {},
    waitingRoomChats: {},
    gameChats: {},
    activeTournaments: {},
    activeTournamentViewers: new Set(),
};


const app = express();
const port = 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// FIX: Add explicit types for req, res, and next.
const userMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path === '/api/auth/login' || req.path === '/api/auth/register' || req.path === '/api/auth/sync' || req.path === '/api/auth/finalize-kakao' || req.path === '/api/initial-state') {
        return next();
    }

    const { userId, sessionId } = req.body;
    if (userId) {
        if (!sessionId) {
            return res.status(401).json({ message: 'Session ID is required.' });
        }
        
        let storedSessionId = volatileState.userSessions[userId];
        // If not in memory, check the DB to handle server restarts
        if (!storedSessionId) {
            const allSessions = (await getKV<Record<string, string>>('userSessions') || {}) as Record<string, string>;
            storedSessionId = allSessions[userId];
            if (storedSessionId) {
                volatileState.userSessions[userId] = storedSessionId; // Cache it
            }
        }

        if (!storedSessionId || storedSessionId !== sessionId) {
            return res.status(401).json({ message: 'Session expired due to new login.' });
        }

        const user = await getUser(userId);
        if (user) {
            req.user = user;
        } else {
            return res.status(401).json({ message: 'User not found.' });
        }
    }
    next();
};

app.use(userMiddleware);

// FIX: Add explicit types for req and res.
app.post('/api/auth/register', async (req: express.Request, res: express.Response) => {
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
        volatileState.userSessions[newUser.id] = sessionId;
        const allSessions = (await getKV<Record<string, string>>('userSessions') || {}) as Record<string, string>;
        allSessions[newUser.id] = sessionId;
        await setKV('userSessions', allSessions);

        res.json({ user: newUser, sessionId });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// FIX: Add explicit types for req and res.
app.post('/api/auth/login', async (req: express.Request, res: express.Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: '아이디와 비밀번호를 모두 입력해주세요.' });
    }
    try {
        const credentials = await getUserCredentials(username);
        if (!credentials || !credentials.hash) {
            return res.status(401).json({ message: '잘못된 아이디 또는 비밀번호입니다.' });
        }

        if (!credentials.salt) {
            console.warn(`Login attempt for user ${username} with no salt. Account requires password update.`);
            return res.status(401).json({ message: '보안 업데이트가 필요한 계정입니다. 관리자에게 문의해주세요.' });
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
        
        const now = Date.now();
        const sessionId = randomUUID();
        volatileState.userSessions[user.id] = sessionId;
        const allSessions = (await getKV<Record<string, string>>('userSessions') || {}) as Record<string, string>;
        allSessions[user.id] = sessionId;
        await setKV('userSessions', allSessions);
        
        const userStatuses = await getKV<Record<string, UserStatusInfo>>('userStatuses') || {};
        userStatuses[user.id] = { status: UserStatus.Online, stateEnteredAt: now };
        await setKV('userStatuses', userStatuses);

        res.json({ user, sessionId });
    } catch (error: any) {
        console.error(`[Login Error] for user ${username}:`, error);
        res.status(500).json({ message: 'A server error occurred during login.' });
    }
});

// FIX: Add explicit types for req and res.
app.post('/api/auth/sync', async (req: express.Request, res: express.Response) => {
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
            res.json({
                needsRegistration: true,
                kakaoId: kakaoId,
                suggestedNickname: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || '카카오 유저',
            });
            return;
        }
        
        user = await resetAndGenerateQuests(user);
        
        const now = Date.now();
        const sessionId = randomUUID();
        volatileState.userSessions[user.id] = sessionId;
        const allSessions = (await getKV<Record<string, string>>('userSessions') || {}) as Record<string, string>;
        allSessions[user.id] = sessionId;
        await setKV('userSessions', allSessions);
        
        const userStatuses = await getKV<Record<string, UserStatusInfo>>('userStatuses') || {};
        userStatuses[user.id] = { status: UserStatus.Online, stateEnteredAt: now };
        await setKV('userStatuses', userStatuses);

        res.json({ user, sessionId });

    } catch (error: any) {
        console.error('Error during user sync:', error);
        res.status(500).json({ message: 'Failed to sync user.' });
    }
});

// FIX: Add explicit types for req and res.
app.post('/api/auth/finalize-kakao', async (req: express.Request, res: express.Response) => {
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
        volatileState.userSessions[newUser.id] = sessionId;
        const allSessions = (await getKV<Record<string, string>>('userSessions') || {}) as Record<string, string>;
        allSessions[newUser.id] = sessionId;
        await setKV('userSessions', allSessions);
        
        const userStatuses = await getKV<Record<string, UserStatusInfo>>('userStatuses') || {};
        userStatuses[newUser.id] = { status: UserStatus.Online, stateEnteredAt: Date.now() };
        await setKV('userStatuses', userStatuses);
        
        res.json({ user: newUser, sessionId });
    } catch (error: any) {
        console.error(`[Kakao Finalize Error] for kakaoId ${kakaoId}:`, error);
        res.status(500).json({ message: 'An internal server error occurred during registration.' });
    }
});

// FIX: Add explicit types for req and res.
app.post('/api/initial-state', async (req: express.Request, res: express.Response) => {
    const { userId, sessionId } = req.body;
    if (userId && sessionId) {
        volatileState.userConnections[userId] = Date.now();
    }
    
    const data = await getAllData();
    
    const negotiations = await getKV('negotiations') || {};
    const waitingRoomChats = await getKV('waitingRoomChats') || {};
    const gameChats = await getKV('gameChats') || {};
    const userStatuses = await getKV('userStatuses') || {};

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

// FIX: Add explicit types for req and res.
app.post('/api/action', async (req: express.Request, res: express.Response) => {
    const user = req.user;
    if (!user) {
        if (req.body.type === 'LOGOUT' && req.body.userId) {
            console.log(`Processing beacon logout for user ${req.body.userId}`);
            const userId = req.body.userId;
            delete volatileState.userConnections[userId];
            const userStatuses = (await getKV<Record<string, UserStatusInfo>>('userStatuses') || {}) as Record<string, UserStatusInfo>;
            delete userStatuses[userId];
            await setKV('userStatuses', userStatuses);
            delete volatileState.userSessions[userId];
            const allSessions = (await getKV<Record<string, string>>('userSessions') || {}) as Record<string, string>;
            delete allSessions[userId];
            await setKV('userSessions', allSessions);
            return res.json({ success: true });
        }
        return res.status(401).json({ message: 'Authentication required for this action.' });
    }
    
    volatileState.userConnections[user.id] = Date.now();

    const guilds = await db.getKV<Record<string, Guild>>('guilds') || {};

    const action: ServerAction & { user: User } = { ...req.body, user };
    
    try {
        const result = await handleAction(action, volatileState);
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

const startServer = async () => {
    await initializeDatabase();
    await performOneTimeReset();
    await performOneTimeGuildResearchMigration();

    getKataGoManager().initialize().catch(err => {
        console.warn("[Server Start] KataGo analysis engine could not be started. Analysis will be unavailable.", err.message);
    });

    setInterval(async () => {
        try {
            const allActiveGames = await db.getAllActiveGames();
            const guilds = await db.getKV<Record<string, Guild>>('guilds') || {};
            const updatedGames = await gameModes.updateGameStates(allActiveGames, Date.now(), guilds);

            for (const game of updatedGames) {
                await db.saveGame(game);
            }
        } catch (e) {
            console.error("Error in game loop:", e);
        }
    }, 1000);

    setInterval(async () => {
        const now = Date.now();
        const CONNECTION_TIMEOUT_MS = 60 * 1000;
        const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

        const userStatuses = await getKV<Record<string, UserStatusInfo>>('userStatuses') || {};
        let statusesChanged = false;

        for (const userId in userStatuses) {
            const lastSeen = volatileState.userConnections[userId];
            if (!lastSeen || now - lastSeen > CONNECTION_TIMEOUT_MS) {
                const userStatus = userStatuses[userId];
                
                if (userStatus?.status === UserStatus.InGame && userStatus.gameId) {
                    const game = await db.getLiveGame(userStatus.gameId);
                    if (game && (game.isAiGame || game.isSinglePlayer || game.isTowerChallenge)) {
                        await db.deleteGame(game.id);
                    } else {
                        if (!lastSeen) {
                           console.log(`[Cleanup] User ${userId} connection is gone. Cleaning up status.`);
                           delete userStatuses[userId];
                           statusesChanged = true;
                        }
                        continue;
                    }
                }
                
                console.log(`[Cleanup] User ${userId} connection timed out. Setting to offline.`);
                delete volatileState.userConnections[userId];
                delete userStatuses[userId];
                statusesChanged = true;
                delete volatileState.userSessions[userId];
            } else {
                 const userStatus = userStatuses[userId];
                if (userStatus.status === UserStatus.Waiting && userStatus.stateEnteredAt) {
                    if (now - userStatus.stateEnteredAt > IDLE_TIMEOUT_MS) {
                        console.log(`[Idle Check] User ${userId} idle in waiting room. Setting status to Resting.`);
                        userStatus.status = UserStatus.Resting;
                        userStatus.stateEnteredAt = now;
                        statusesChanged = true;
                    }
                }
            }
        }

        const negotiations = await getKV<Record<string, any>>('negotiations') || {};
        let negotiationsChanged = false;
        for (const negId in negotiations) {
            if (now > negotiations[negId].deadline) {
                const neg = negotiations[negId];
                if (userStatuses[neg.challenger.id]) {
                    userStatuses[neg.challenger.id].status = UserStatus.Waiting;
                    statusesChanged = true;
                }
                delete negotiations[negId];
                negotiationsChanged = true;
            }
        }
        if (negotiationsChanged) await setKV('negotiations', negotiations);
        if (statusesChanged) await setKV('userStatuses', userStatuses);


        const guilds = await getKV<Record<string, Guild>>('guilds') || {};
        let guildsUpdated = false;
        for (const guild of Object.values(guilds)) {
            const completedResearchId = await guildService.checkCompletedResearch(guild);
            if (completedResearchId) {
                guildsUpdated = true;
                const message: ChatMessage = {
                    id: `msg-guild-${randomUUID()}`,
                    user: { id: 'system', nickname: '시스템' },
                    system: true,
                    text: `연구 [${GUILD_RESEARCH_PROJECTS[completedResearchId].name}]가 완료되었습니다!`,
                    timestamp: Date.now(),
                };
                if (!guild.chatHistory) guild.chatHistory = [];
                guild.chatHistory.push(message);
                if (guild.chatHistory.length > 100) {
                    guild.chatHistory.shift();
                }
            }
        }
        if (guildsUpdated) {
            await db.setKV('guilds', guilds);
        }
        
        const allUserIds = (await db.getAllUsers()).map(u => u.id);

        for (const userId of allUserIds) {
            const user = await db.getUser(userId);
            if (!user) continue;
    
            const originalUserSnapshot = JSON.stringify(user);
            let userToUpdate = JSON.parse(originalUserSnapshot);
    
            const guild = user.guildId ? guilds[user.guildId] : null;
    
            userToUpdate = await resetAndGenerateQuests(userToUpdate);
            userToUpdate = regenerateActionPoints(userToUpdate, guild);
            userToUpdate = accumulateMissionRewards(userToUpdate);
            
            if (JSON.stringify(userToUpdate) !== originalUserSnapshot) {
                await db.updateUser(userToUpdate);
            }
        }
    }, 5000);

    setInterval(async () => {
        try {
            const allUsers = await db.getAllUsers();
            for (const user of allUsers) {
                const updatedUser = await processWeeklyLeagueUpdates(user, allUsers);
                if (updatedUser !== user) {
                    await db.updateUser(updatedUser);
                }
            }
            await runScheduledTasks();
        } catch(e) {
            console.error("Error in scheduled tasks:", e);
        }
    }, 60 * 60 * 1000);
};

startServer();

export default app;
