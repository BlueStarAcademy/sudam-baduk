import 'dotenv/config';
// FIX: Corrected Express type imports to use named imports for Request, Response, and NextFunction.
import express, { Request, Response, NextFunction } from 'express';
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

// FIX: Corrected Express request/response types.
const userMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    // For login/register, no session check is needed
    if (req.path === '/api/auth/login' || req.path === '/api/auth/register') {
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
            (req as any).user = user;
        } else {
            // User might have been deleted, but session still exists.
            return res.status(401).json({ message: 'User not found.' });
        }
    }
    next();
};

app.use(userMiddleware);

// FIX: Corrected Express request/response types.
app.post('/api/auth/register', async (req: Request, res: Response) => {
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

        const newUser = createDefaultUser(`user-${globalThis.crypto.randomUUID()}`, username, nickname);
        await createUser(newUser);

        // Hash the password
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

// FIX: Corrected Express request/response types.
app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }
    try {
        const credentials = await getUserCredentials(username);
        if (!credentials || !credentials.hash || !credentials.salt) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        const hashToCompare = crypto.pbkdf2Sync(password, credentials.salt, 10000, 64, 'sha512').toString('hex');

        if (credentials.hash !== hashToCompare) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        let user = await getUser(credentials.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        
        user = await resetAndGenerateQuests(user);
        
        const sessionId = randomUUID();
        volatileState.userSessions[user.id] = sessionId;
        volatileState.userStatuses[user.id] = { status: UserStatus.Online };

        res.json({ user, sessionId });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// FIX: Corrected Express request/response types.
app.post('/api/state', async (req: Request, res: Response) => {
    const user = (req as any).user as User;
    let userStatus: UserStatusInfo | undefined;
    if (user) {
        volatileState.userConnections[user.id] = Date.now();
        userStatus = volatileState.userStatuses[user.id];
        if (!userStatus) {
            userStatus = { status: UserStatus.Online };
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

// FIX: Corrected Express request/response types.
app.post('/api/action', async (req: Request, res: Response) => {
    const user = (req as any).user as User;
    if (!user) {
        // For beacon calls on logout, user might not be attached if session check fails.
        // We still need to process the logout.
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
            const updatedGames = await gameModes.updateGameStates(allActiveGames, Date.now(), guilds);
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
        
        const thirtyMinutes = 30 * 60 * 1000;
        for (const userId in volatileState.userConnections) {
            const lastSeen = volatileState.userConnections[userId];
            const userStatus = volatileState.userStatuses[userId];

            // If user is 'waiting' and hasn't polled in 30 minutes, set to 'resting'
            if (userStatus?.status === UserStatus.Waiting && (now - lastSeen) > thirtyMinutes) {
                console.log(`[Idle] User ${userId} idle for 30 mins in waiting room. Setting to Resting.`);
                userStatus.status = UserStatus.Resting;
            }
        }

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