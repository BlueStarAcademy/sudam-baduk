

import * as types from '../../types/index.js';
// FIX: Import SinglePlayerLevel from types instead of constants.
import { SinglePlayerLevel } from '../../types/index.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, BOT_NAMES, AVATAR_POOL, TOWER_STAGES, defaultSettings, SINGLE_PLAYER_STAGES, aiUserId } from '../../constants/index.js';
import { createDefaultSpentStatPoints, defaultStats, createDefaultQuests } from '../initialData.js';
// FIX: Import createDefaultBaseStats from shared utils.
import { createDefaultBaseStats } from '../../utils/statUtils.js';
import { makePlayfulAiMove } from './playfulAi.js';
import { gnuGoServiceManager } from '../services/gnuGoService.js';
import { processMove } from '../../utils/goLogic';


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
    // FIX: Changed inventorySlots to be an object to match the User type definition.
    inventorySlots: { equipment: 30, consumable: 30, material: 30 },
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
    synthesisLevel: 1,
    synthesisXp: 0,
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
        botName = '도전의탑 봇';
        botStrategyLevel = displayLevel;

    } else if (stageId) { // Single Player
        const stage = SINGLE_PLAYER_STAGES.find(s => s.id === stageId);
        if (stage) {
            const aiStage = stage.katagoLevel; // This is 1-10
            const displayLevel = aiStage * 5;
            
            let botBaseName = '';
            switch(stage.level) {
                case SinglePlayerLevel.입문: botBaseName = '입문봇'; break;
                case SinglePlayerLevel.초급: botBaseName = '초급봇'; break;
                case SinglePlayerLevel.중급: botBaseName = '중급봇'; break;
                case SinglePlayerLevel.고급: botBaseName = '고급봇'; break;
                case SinglePlayerLevel.유단자: botBaseName = '유단자봇'; break;
            }
            botName = botBaseName;
            botStrategyLevel = displayLevel;
        }
    } else { // PvP AI
        const difficultyStep = Math.max(1, Math.min(10, Math.round(difficulty / 10)));
        const displayLevel = difficultyStep * 5;
        const isPlayful = PLAYFUL_GAME_MODES.some(m => m.mode === mode);
        const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === mode);

        if (isPlayful) {
            botPlayfulLevel = displayLevel;
        } else { // Strategic
            botStrategyLevel = displayLevel;
        }

        switch(mode) {
            case types.GameMode.Standard: botName = '클래식봇'; break;
            case types.GameMode.Capture: botName = '따내기봇'; break;
            case types.GameMode.Speed: botName = '스피드봇'; break;
            case types.GameMode.Hidden: botName = '히든봇'; break;
            case types.GameMode.Missile: botName = '미사일봇'; break;
            case types.GameMode.Mix: botName = '믹스룰봇'; break;
            default: botName = `${mode}봇`; break;
        }
    }
    
    bot.nickname = botName;
    bot.strategyLevel = botStrategyLevel;
    bot.playfulLevel = botPlayfulLevel;
    
    aiUserCache.set(cacheKey, bot);
    return bot;
};

export const makeAiMove = async (game: types.LiveGameSession): Promise<types.Point & { isHidden?: boolean }> => {
    const aiPlayerId = game.player2.id;
    const aiPlayerEnum = game.blackPlayerId === aiPlayerId ? types.Player.Black : (game.whitePlayerId === aiPlayerId ? types.Player.White : types.Player.None);
    const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === game.mode) || game.isSinglePlayer || game.isTowerChallenge;

    if (!isStrategic) {
        // Playful AI move logic now directly modifies the game state.
        // It returns a sentinel value to indicate that the move has been handled.
        await makePlayfulAiMove(game);
        return {x: -3, y: -3};
    }
    
    // NEW HIDDEN LOGIC for SP/Tower
    if ((game.isSinglePlayer || game.isTowerChallenge) && game.gameType === 'hidden' && !game.aiHiddenStoneUsedThisGame) {
        const moveCount = game.moveHistory.length;
        if (moveCount >= 10 && moveCount <= 20) {
            // AI will use its hidden stone on its first opportunity within this turn window.
            const move = await gnuGoServiceManager.generateMove(game.id, aiPlayerEnum, game.settings.boardSize);
            return { ...move, isHidden: true };
        }
    }
    
    // Regular move
    const move = await gnuGoServiceManager.generateMove(game.id, aiPlayerEnum, game.settings.boardSize);
    return { ...move, isHidden: false };
};