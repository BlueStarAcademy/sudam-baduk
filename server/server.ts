






import 'dotenv/config';
// FIX: Import Request, Response, NextFunction types from express
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { initializeDatabase, getAllData, getUserCredentials, createUserCredentials, createUser, getUser, updateUser, getKV } from './db.js';
import { handleAction } from './actions/gameActions.js';
import { type VolatileState, type ServerAction, type User, type ChatMessage, Guild, UserStatus, type UserStatusInfo } from '../types/index.js';
import { createDefaultUser } from './initialData.js';
import { resetAndGenerateQuests, accumulateMissionRewards } from './questService.js';
import { runScheduledTasks, processWeeklyLeagueUpdates, performOneTimeReset } from './scheduledTasks.js';
import * as gameModes from './gameModes.js';
import * as db from './db.js';
import * as guildService from './guildService.js';
import { randomUUID } from 'crypto';
import { GUILD_RESEARCH_PROJECTS } from '../constants/index.js';
import { regenerateActionPoints } from './services/effectService.js';
import { getKataGoManager } from './kataGoService.js';

const volatileState: VolatileState = {
    userStatuses: {},
    userConnections: {},
    negotiations: {},
    userLastChatMessage: {},
    waitingRoomChats: { global: [] },
    gameChats: {},
    activeTournaments: {},
    activeTournamentViewers: new Set(),
    userSessions: {},
};


const app = express();
const port = 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// FIX: Use namespace-qualified types for Express Request, Response, and NextFunction to resolve type errors.
const userMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // For login/register, no session check is needed
    if (req.path === '/api/auth/login' || req.path === '/api/auth/register' || req.path === '/api/auth/sync') {
        return next();
    }

    const { userId, sessionId } = req.body;
    if (userId) {
        if (!sessionId) {
            return res.status(401).json({ message: 'Session ID is required.' });
        }
        
        const storedSessionId = volatileState.userSessions[userId];

        if (!storedSessionId || storedSessionId !== sessionId) {
            // New login from another tab/device. Invalidate this session.
            return res.status(401).json({ message: 'Session expired due to new login.' });
        }

        const user = await getUser(userId);
        if (user) {
            req.user = user;
        } else {
            // User might have been deleted, but session still exists.
            return res.status(401).json({ message: 'User not found.' });
        }
    }
    next();
};

app.use(userMiddleware);

// FIX: Use namespace-qualified types for Express Request and Response.
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

        res.json({ user: newUser, sessionId });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// FIX: Use namespace-qualified types for Express Request and Response.
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
        volatileState.userStatuses[user.id] = { status: UserStatus.Online, stateEnteredAt: now };

        res.json({ user, sessionId });
    } catch (error: any) {
        console.error(`[Login Error] for user ${username}:`, error);
        res.status(500).json({ message: 'A server error occurred during login.' });
    }
});

// FIX: Use namespace-qualified types for Express Request and Response.
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
            // User does not exist, create a new one.
            const nickname = supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || '카카오 유저';
            
            // Ensure nickname is unique
            let uniqueNickname = nickname;
            let existingByNickname = await db.getUserByNickname(uniqueNickname);
            let counter = 1;
            while(existingByNickname) {
                uniqueNickname = `${nickname}${counter}`;
                existingByNickname = await db.getUserByNickname(uniqueNickname);
                counter++;
            }

            user = createDefaultUser(
                `user-${randomUUID()}`, 
                `kakao_${kakaoId}`, 
                uniqueNickname, 
                false, 
                kakaoId
            );
            await db.createUser(user);
        }
        
        user = await resetAndGenerateQuests(user);
        
        const now = Date.now();
        const sessionId = randomUUID();
        volatileState.userSessions[user.id] = sessionId;
        volatileState.userStatuses[user.id] = { status: UserStatus.Online, stateEnteredAt: now };

        res.json({ user, sessionId });

    } catch (error: any) {
        console.error('Error during user sync:', error);
        res.status(500).json({ message: 'Failed to sync user.' });
    }
});

// FIX: Use namespace-qualified types for Express Request and Response.
app.post('/api/state', async (req: express.Request, res: express.Response) => {
    const user = req.user;
    let userStatus: UserStatusInfo | undefined;
    if (user) {
        volatileState.userConnections[user.id] = Date.now();
        userStatus = volatileState.userStatuses[user.id];
        if (!userStatus) {
            userStatus = { status: UserStatus.Online, stateEnteredAt: Date.now() };
            volatileState.userStatuses[user.id] = userStatus;
        }
    }
    const data = await getAllData();

    if (userStatus?.status === 'in-game' && userStatus.gameId && !data.liveGames[userStatus.gameId]) {
        const endedGame = await db.getLiveGame(userStatus.gameId);
        if (endedGame) {
            data.liveGames[endedGame.id] = endedGame;
        }
    }

    res.json({ ...data, userStatuses: volatileState.userStatuses, negotiations: volatileState.negotiations, waitingRoomChats: volatileState.waitingRoomChats, gameChats: volatileState.gameChats });
});

// FIX: Use namespace-qualified types for Express Request and Response.
app.post('/api/action', async (req: express.Request, res: express.Response) => {
    const user = req.user;
    if (!user) {
        if (req.body.type === 'LOGOUT' && req.body.userId) {
            console.log(`Processing beacon logout for user ${req.body.userId}`);
            delete volatileState.userConnections[req.body.userId];
            delete volatileState.userStatuses[req.body.userId];
            delete volatileState.userSessions[req.body.userId];
            return res.json({ success: true });
        }
        return res.status(401).json({ message: 'Authentication required for this action.' });
    }

    const guilds = await db.getKV<Record<string, Guild>>('guilds') || {};

    const action: ServerAction & { user: User } = { ...req.body, user };
    
    try {
        const result = await handleAction(volatileState, action, guilds);
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

    // Eagerly initialize KataGo to make scoring faster on first game
    getKataGoManager().initialize().catch(err => {
        console.warn("[Server Start] KataGo analysis engine could not be started. Analysis will be unavailable.", err.message);
    });

    // Game loop
    setInterval(async () => {
        try {
            const allActiveGames = await db.getAllActiveGames();
            const guilds = await db.getKV<Record<string, Guild>>('guilds') || {};
            const updatedGames = await gameModes.updateGameStates(allActiveGames, Date.now(), volatileState, guilds);
            for (const game of updatedGames) {
                await db.saveGame(game);
            }
        } catch (e) {
            console.error("Error in game loop:", e);
        }
    }, 1000);

    // Volatile state cleanup & User state updates
    setInterval(async () => {
        const now = Date.now();
        const CONNECTION_TIMEOUT_MS = 60 * 1000; // 60 seconds
        const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

        // Cleanup disconnected users & check for idle users
        for (const userId in volatileState.userConnections) {
            const lastSeen = volatileState.userConnections[userId];
            if (now - lastSeen > CONNECTION_TIMEOUT_MS) {
                const userStatus = volatileState.userStatuses[userId];
                // CRITICAL FIX: Do NOT time out users who are currently in a game.
                // The game itself has its own timers (byoyomi, etc.) which are the only
                // timers that should apply during a match.
                if (userStatus?.status === UserStatus.InGame) {
                    continue; // Skip to the next user in the loop
                }
                
                console.log(`[Cleanup] User ${userId} connection timed out. Setting to offline.`);
                delete volatileState.userConnections[userId];
                delete volatileState.userStatuses[userId];
            }
        }
        
        for (const userId in volatileState.userStatuses) {
            const userStatus = volatileState.userStatuses[userId];
            if (userStatus.status === UserStatus.Waiting && userStatus.stateEnteredAt) {
                if (now - userStatus.stateEnteredAt > IDLE_TIMEOUT_MS) {
                    console.log(`[Idle Check] User ${userId} idle in waiting room. Setting status to Resting.`);
                    userStatus.status = UserStatus.Resting;
                    userStatus.stateEnteredAt = now; // Update timestamp for the new state
                }
            }
        }


        // Cleanup expired negotiations
        for (const negId in volatileState.negotiations) {
            if (now > volatileState.negotiations[negId].deadline) {
                const neg = volatileState.negotiations[negId];
                if (neg.challenger.id && volatileState.userStatuses[neg.challenger.id]) {
                    volatileState.userStatuses[neg.challenger.id].status = UserStatus.Waiting;
                }
                delete volatileState.negotiations[negId];
            }
        }

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
        
        // --- User State Update Loop ---
        const allUserIds = (await db.getAllUsers()).map(u => u.id);

        for (const userId of allUserIds) {
            // Fetch the most up-to-date user object for each iteration to prevent race conditions.
            const user = await db.getUser(userId);
            if (!user) continue;
    
            const originalUserSnapshot = JSON.stringify(user);
            let userToUpdate = JSON.parse(originalUserSnapshot); // Create a mutable copy to work on
    
            const guild = user.guildId ? guilds[user.guildId] : null;
    
            // These functions perform time-based updates (quest resets, AP regen, mission accumulation)
            // and will only modify the object if a change is needed.
            userToUpdate = await resetAndGenerateQuests(userToUpdate);
            userToUpdate = regenerateActionPoints(userToUpdate, guild);
            userToUpdate = accumulateMissionRewards(userToUpdate);
            
            // If any of the background tasks modified the user object, save it.
            if (JSON.stringify(userToUpdate) !== originalUserSnapshot) {
                await db.updateUser(userToUpdate);
            }
        }
    }, 5000);

    // Scheduled tasks (like weekly rewards)
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

// For local development, start the server and listen.
// For Vercel, this block will be ignored and the exported `app` will be used.
if (!process.env.VERCEL) {
    app.listen(port, () => {
        console.log(`Server listening on port ${port}`);
    });
}

export default app;