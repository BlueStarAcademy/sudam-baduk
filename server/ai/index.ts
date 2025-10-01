import * as types from '../../types/index.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, BOT_NAMES, AVATAR_POOL, TOWER_STAGES, defaultSettings, SINGLE_PLAYER_STAGES, aiUserId, strategicAiDisplayMap, captureAiLevelMap } from '../../constants/index.js';
import { createDefaultBaseStats, createDefaultSpentStatPoints, defaultStats, createDefaultQuests } from '../initialData.js';
import { makePlayfulAiMove } from './playfulAi.js';
import { gnuGoServiceManager } from '../services/gnuGoService.js';


export { aiUserId };

const baseAiUser: types.User = {
    id: aiUserId,
    username: 'ai-player',
    nickname: 'AI 상대',
    isAdmin: false,
    strategyLevel: 1,
    strategyXp: 0,
    playfulLevel: 1,
    playfulXp: 0,
    baseStats: createDefaultBaseStats(),
    spentStatPoints: createDefaultSpentStatPoints(),
    inventory: [],
    inventorySlots: 0,
    equipment: {},
    equipmentPresets: [],
    actionPoints: { current: 9999, max: 9999 },
    lastActionPointUpdate: 0,
    actionPointPurchasesToday: 0,
    lastActionPointPurchaseDate: 0,
    actionPointQuizzesToday: 0,
    lastActionPointQuizDate: 0,
    dailyShopPurchases: {},
    gold: 0,
    diamonds: 0,
    mannerScore: 200,
    mannerMasteryApplied: false,
    pendingPenaltyNotification: null,
    mail: [],
    quests: createDefaultQuests(),
    stats: defaultStats,
    chatBanUntil: 0,
    connectionBanUntil: 0,
    avatarId: 'bot_avatar',
    borderId: 'default',
    ownedBorders: [],
    previousSeasonTier: null,
    seasonHistory: {},
    tournamentScore: 1200,
    league: types.LeagueTier.Sprout,
    weeklyCompetitors: [],
    lastWeeklyCompetitorsUpdate: 0,
    lastLeagueUpdate: 0,
    monthlyGoldBuffExpiresAt: 0,
    mbti: null,
    isMbtiPublic: false,
    singlePlayerProgress: 0,
    bonusStatPoints: 0,
    singlePlayerMissions: {},
    towerProgress: { highestFloor: 0, lastClearTimestamp: 0 },
    claimedFirstClearRewards: [],
    currencyLogs: [],
    guildId: null,
    guildApplications: [],
    guildLeaveCooldownUntil: 0,
    guildCoins: 0,
    guildBossAttempts: 0,
    lastGuildBossAttemptDate: 0,
    lastLoginAt: 0,
    dailyDonations: { gold: 0, diamond: 0, date: 0 },
    dailyMissionContribution: { amount: 0, date: 0 },
    guildShopPurchases: {},
    appSettings: defaultSettings,
    lastNeighborhoodTournament: null,
    neighborhoodRewardClaimed: false,
    lastNationalTournament: null,
    nationalRewardClaimed: false,
    lastWorldTournament: null,
    worldRewardClaimed: false,
    dailyChampionshipMatchesPlayed: 0,
    lastChampionshipMatchDate: 0,
};

const aiUserCache = new Map<string, types.User>();

export const getAiUser = (mode: types.GameMode, difficulty: number = 50, stageId?: string, floor?: number): types.User => {
    const cacheKey = `${mode}-${difficulty}-${stageId || 'none'}-${floor || 'none'}`;
    if (aiUserCache.has(cacheKey)) {
        return aiUserCache.get(cacheKey)!;
    }

    const bot = JSON.parse(JSON.stringify(baseAiUser));
    
    let gnuGoLevel = 1;
    let botName = 'AI 상대';
    let botStrategyLevel = 1; // for display only

    if (floor) { // Tower Challenge
        gnuGoLevel = Math.min(10, Math.floor(floor / 10) + 1);
        botName = `도전의 탑 ${floor}층 AI (그누고 ${gnuGoLevel}단)`;
        botStrategyLevel = floor; // Just for display
    } else if (stageId) { // Single Player
        const stage = SINGLE_PLAYER_STAGES.find(s => s.id === stageId);
        if (stage) {
            gnuGoLevel = Math.min(10, stage.katagoLevel); // katagoLevel now maps to GnuGo level
            botName = `${stage.name} AI (그누고 ${gnuGoLevel}단)`;
            botStrategyLevel = stage.katagoLevel;
        }
    } else { // PvP AI
        const difficultyStep = Math.max(1, Math.min(10, Math.round(difficulty / 10)));
        const isPlayful = PLAYFUL_GAME_MODES.some(m => m.mode === mode);

        if (isPlayful) {
            gnuGoLevel = difficultyStep;
            botName = `${mode}봇 ${gnuGoLevel}단`;
            botStrategyLevel = gnuGoLevel;
        } else { // Strategic (or fallback)
            gnuGoLevel = difficultyStep;
            botName = `AI 상대 (그누고 ${gnuGoLevel}단)`;
            botStrategyLevel = gnuGoLevel;
        }
    }

    bot.nickname = botName;
    bot.strategyLevel = botStrategyLevel;
    bot.playfulLevel = Math.max(0, gnuGoLevel - 1); // Use playfulLevel to store the GnuGo engine level (0-9)
    
    aiUserCache.set(cacheKey, bot);
    return bot;
};

export const makeAiMove = async (game: types.LiveGameSession): Promise<types.Point> => {
    const aiPlayerId = game.player2.id;
    const aiPlayerEnum = game.blackPlayerId === aiPlayerId ? types.Player.Black : types.Player.White;
    const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === game.mode) || game.isSinglePlayer || game.isTowerChallenge;

    if (!isStrategic) {
        // For playful modes, a separate AI logic dispatcher is used.
        game.pendingAiMove = makePlayfulAiMove(game).then(() => ({x: -3, y: -3}));
        return { x: -2, y: -2 }; // Signal that AI move is handled internally
    }
    
    // For ALL strategic modes, now use GnuGo
    const movePromise: Promise<types.Point> = gnuGoServiceManager.generateMove(game.id, aiPlayerEnum, game.settings.boardSize);
    
    game.pendingAiMove = movePromise;
    return movePromise;
};


export const makeAiHiddenMove = async (game: types.LiveGameSession): Promise<void> => {
    // Simple logic: if AI has hidden stones left, use one with 50% chance.
    const hiddenStonesUsed = game.hidden_stones_used_p1 ?? 0; // AI is always P1 in SP
    const maxHiddenStones = game.settings.hiddenStoneCount ?? 0;
    
    if (hiddenStonesUsed < maxHiddenStones && Math.random() < 0.5) {
        game.pendingAiMove = makeAiMove(game).then(point => ({ ...point, isHidden: true }));
    } else {
        game.pendingAiMove = makeAiMove(game);
    }
};