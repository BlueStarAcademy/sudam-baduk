import * as types from '../../types/index.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, BOT_NAMES, AVATAR_POOL, TOWER_STAGES, defaultSettings, SINGLE_PLAYER_STAGES, aiUserId } from '../../constants/index.js';
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
    
    let botName = 'AI 상대';
    let botStrategyLevel = 1;
    let botPlayfulLevel = 1;

    if (floor) { // Tower Challenge
        let aiStage: number;
        if (floor <= 30) aiStage = 7;
        else if (floor <= 60) aiStage = 8;
        else if (floor <= 90) aiStage = 9;
        else aiStage = 10;
        
        const displayLevel = aiStage * 5;
        botName = `도전의 탑 ${floor}층 AI (${displayLevel}레벨)`;
        botStrategyLevel = displayLevel;

    } else if (stageId) { // Single Player
        const stage = SINGLE_PLAYER_STAGES.find(s => s.id === stageId);
        if (stage) {
            const aiStage = stage.katagoLevel; // This is 1-10
            const displayLevel = aiStage * 5;
            botName = `${stage.name} AI (${displayLevel}레벨)`;
            botStrategyLevel = displayLevel;
        }
    } else { // PvP AI
        const difficultyStep = Math.max(1, Math.min(10, Math.round(difficulty / 10)));
        const displayLevel = difficultyStep * 5;
        const isPlayful = PLAYFUL_GAME_MODES.some(m => m.mode === mode);

        if (isPlayful) {
            botName = `${mode}봇 ${displayLevel}레벨`;
            botPlayfulLevel = displayLevel;
        } else { // Strategic
            botName = `${mode}봇 ${displayLevel}레벨`;
            botStrategyLevel = displayLevel;
        }
    }
    
    bot.nickname = botName;
    bot.strategyLevel = botStrategyLevel;
    bot.playfulLevel = botPlayfulLevel;
    
    aiUserCache.set(cacheKey, bot);
    return bot;
};

export const makeAiMove = async (game: types.LiveGameSession): Promise<types.Point> => {
    const aiPlayerId = game.player2.id;
    const aiPlayerEnum = game.blackPlayerId === aiPlayerId ? types.Player.Black : (game.whitePlayerId === aiPlayerId ? types.Player.White : types.Player.None);
    const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === game.mode) || game.isSinglePlayer || game.isTowerChallenge;

    if (!isStrategic) {
        // Playful AI move logic now directly modifies the game state.
        // It returns a sentinel value to indicate that the move has been handled.
        await makePlayfulAiMove(game);
        return {x: -3, y: -3};
    }
    
    return gnuGoServiceManager.generateMove(game.id, aiPlayerEnum, game.settings.boardSize);
};
