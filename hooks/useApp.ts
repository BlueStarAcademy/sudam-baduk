
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
    GameMode, UserStatus, ShopTab, InventoryTab, User, LiveGameSession, UserWithStatus, ServerAction, 
    Negotiation, ChatMessage, AdminLog, Announcement, OverrideAnnouncement, InventoryItem, AppState, 
    InventoryItemType, AppRoute, QuestReward, DailyQuestData, WeeklyQuestData, MonthlyQuestData, Theme, 
    SoundSettings, FeatureSettings, AppSettings, TowerRank, TournamentState, Guild, GuildBossBattleResult, 
    // FIX: Add missing import for SinglePlayerMissionState
    SinglePlayerStageInfo, UserStatusInfo, QuestLog, CoreStat, Player, LeagueTier, EquipmentPreset, SinglePlayerMissionState 
} from '../types/index.js';
import { audioService } from '../services/audioService.js';
import { stableStringify, parseHash } from '../utils/appUtils.js';
import { 
    DAILY_MILESTONE_THRESHOLDS,
    WEEKLY_MILESTONE_THRESHOLDS,
    MONTHLY_MILESTONE_THRESHOLDS,
    SLUG_BY_GAME_MODE,
    SINGLE_PLAYER_MISSIONS,
    GRADE_LEVEL_REQUIREMENTS,
    SPECIAL_GAME_MODES, 
    PLAYFUL_GAME_MODES,
    DEFAULT_GAME_SETTINGS
} from '../constants/index.js';
import { defaultSettings } from './useAppSettings.js';
import { getMissionInfoWithLevel } from '../utils/questUtils.js';
import { supabase } from '../services/supabase.js';
import { containsProfanity } from '../profanity.js';
import { createDefaultBaseStats } from '../utils/statUtils.js';
import { defaultSettings as appDefaultSettings } from '../constants/settings.js';

// --- Start of inlined data mapping logic ---

// Copied from server/initialData.ts to break server dependency
const createDefaultQuests = (): QuestLog => ({
    daily: {
        quests: [],
        activityProgress: 0,
        claimedMilestones: [false, false, false, false, false],
        lastReset: 0,
    },
    weekly: {
        quests: [],
        activityProgress: 0,
        claimedMilestones: [false, false, false, false, false],
        lastReset: 0,
    },
    monthly: {
        quests: [],
        activityProgress: 0,
        claimedMilestones: [false, false, false, false, false],
        lastReset: 0,
    },
});

const createDefaultSpentStatPoints = (): Record<CoreStat, number> => ({
    [CoreStat.Concentration]: 0,
    [CoreStat.ThinkingSpeed]: 0,
    [CoreStat.Judgment]: 0,
    [CoreStat.Calculation]: 0,
    [CoreStat.CombatPower]: 0,
    [CoreStat.Stability]: 0,
});

const allGameModes = [...SPECIAL_GAME_MODES, ...PLAYFUL_GAME_MODES].map(m => m.mode);
const defaultStats: User['stats'] = allGameModes.reduce((acc, mode) => {
    acc[mode] = { wins: 0, losses: 0, rankingScore: 0 };
    return acc;
}, {} as Record<GameMode, { wins: number; losses: number; rankingScore: number }>);

// Copied from server/db/mappers.ts to break server dependency
const safeParse = (data: any, defaultValue: any) => {
    if (data === null || data === undefined) return defaultValue;
    if (typeof data === 'object') return data;
    if (typeof data !== 'string' || data.trim() === '') return defaultValue;
    try {
        const parsed = JSON.parse(data);
        return parsed === null ? defaultValue : parsed;
    } catch (e) {
        return defaultValue;
    }
};

const ensureObject = (value: any, defaultValue: any = {}) => (typeof value === 'object' && value !== null && !Array.isArray(value)) ? value : defaultValue;
const ensureArray = (value: any, defaultValue: any = []) => Array.isArray(value) ? value : defaultValue;

const rowToUser = (row: any): User | null => {
    if (!row) return null;
    try {
        const defaultQuests = createDefaultQuests();
        const questsFromDb = ensureObject(safeParse(row.quests, {}));
        const dailyFromDb = ensureObject(questsFromDb.daily);
        const weeklyFromDb = ensureObject(questsFromDb.weekly);
        const monthlyFromDb = ensureObject(questsFromDb.monthly);

        const quests: QuestLog = {
            daily: { ...defaultQuests.daily, ...dailyFromDb, lastReset: Number(dailyFromDb.lastReset || 0), quests: ensureArray(dailyFromDb.quests), claimedMilestones: ensureArray(dailyFromDb.claimedMilestones, [false,false,false,false,false]) },
            weekly: { ...defaultQuests.weekly, ...weeklyFromDb, lastReset: Number(weeklyFromDb.lastReset || 0), quests: ensureArray(weeklyFromDb.quests), claimedMilestones: ensureArray(weeklyFromDb.claimedMilestones, [false,false,false,false,false]) },
            monthly: { ...defaultQuests.monthly, ...monthlyFromDb, lastReset: Number(monthlyFromDb.lastReset || 0), quests: ensureArray(monthlyFromDb.quests), claimedMilestones: ensureArray(monthlyFromDb.claimedMilestones, [false,false,false,false,false]) },
        };
        
        const actionPointsFromDb = ensureObject(safeParse(row.actionPoints, { current: 30, max: 30 }));
        const actionPoints = {
            current: typeof actionPointsFromDb.current === 'number' ? actionPointsFromDb.current : 30,
            max: typeof actionPointsFromDb.max === 'number' ? actionPointsFromDb.max : 30,
        };

        const defaultPresets: EquipmentPreset[] = Array(5).fill(null).map((_, i) => ({ name: `프리셋 ${i + 1}`, equipment: {} }));
        const userPresets = ensureArray(safeParse(row.equipmentPresets, defaultPresets));
        for (let i = 0; i < 5; i++) {
            if (!userPresets[i]) userPresets[i] = { name: `프리셋 ${i + 1}`, equipment: {} };
        }
        
        const userAppSettingsFromDb = ensureObject(safeParse(row.appSettings, {}));
        const appSettings: AppSettings = {
            graphics: { ...appDefaultSettings.graphics, ...ensureObject(userAppSettingsFromDb.graphics) },
            sound: { ...appDefaultSettings.sound, ...ensureObject(userAppSettingsFromDb.sound) },
            features: { ...appDefaultSettings.features, ...ensureObject(userAppSettingsFromDb.features) },
        };

        const statsFromDb = ensureObject(safeParse(row.stats, {}));
        const finalStats = JSON.parse(JSON.stringify(defaultStats));
        for (const mode of Object.keys(finalStats)) {
            const modeKey = mode as GameMode;
            if (statsFromDb[modeKey] && typeof statsFromDb[modeKey] === 'object') {
                Object.assign(finalStats[modeKey], statsFromDb[modeKey]);
            }
        }
        
        const towerProgressFromDb = ensureObject(safeParse(row.towerProgress, {}));
        const dailyDonationsFromDb = ensureObject(safeParse(row.dailyDonations, {}));
        const dailyMissionContributionFromDb = ensureObject(safeParse(row.dailyMissionContribution, {}));

        const spMissionsFromDb = ensureObject(safeParse(row.singlePlayerMissions, {}));
        const finalSpMissions: Record<string, SinglePlayerMissionState> = {};
        for (const missionId in spMissionsFromDb) {
            const state = spMissionsFromDb[missionId];
            finalSpMissions[missionId] = {
                isStarted: state.isStarted,
                lastCollectionTime: Number(state.lastCollectionTime || 0),
                claimableAmount: state.claimableAmount ?? state.accumulatedAmount ?? 0,
                progressTowardNextLevel: state.progressTowardNextLevel ?? 0,
                level: state.level ?? 1,
            };
        }
        
        const slotsFromDb = safeParse(row.inventorySlots, null);
        let finalSlots;
        if (typeof slotsFromDb === 'number') {
            finalSlots = { equipment: slotsFromDb, consumable: 30, material: 30 };
        } else if (typeof slotsFromDb === 'object' && slotsFromDb !== null) {
            finalSlots = { equipment: slotsFromDb.equipment ?? 30, consumable: slotsFromDb.consumable ?? 30, material: slotsFromDb.material ?? 30 };
        } else {
            finalSlots = { equipment: 30, consumable: 30, material: 30 };
        }

        const user: User = {
            id: row.id,
            username: row.username,
            nickname: row.nickname,
            isAdmin: !!row.isAdmin,
            strategyLevel: Number(row.strategyLevel ?? 1),
            strategyXp: Number(row.strategyXp ?? 0),
            playfulLevel: Number(row.playfulLevel ?? 1),
            playfulXp: Number(row.playfulXp ?? 0),
            gold: Number(row.gold ?? 0),
            diamonds: Number(row.diamonds ?? 0),
            inventorySlots: finalSlots,
            synthesisLevel: row.synthesisLevel ?? 1,
            synthesisXp: row.synthesisXp ?? 0,
            chatBanUntil: row.chatBanUntil ? Number(row.chatBanUntil) : undefined,
            connectionBanUntil: row.connectionBanUntil ? Number(row.connectionBanUntil) : undefined,
            lastActionPointUpdate: Number(row.lastActionPointUpdate ?? 0),
            actionPointPurchasesToday: Number(row.actionPointPurchasesToday ?? 0),
            lastActionPointPurchaseDate: Number(row.lastActionPointPurchaseDate ?? 0),
            actionPointQuizzesToday: Number(row.actionPointQuizzesToday ?? 0),
            lastActionPointQuizDate: Number(row.lastActionPointQuizDate ?? 0),
            dailyShopPurchases: ensureObject(safeParse(row.dailyShopPurchases, {})),
            avatarId: row.avatarId || 'profile_1',
            borderId: row.borderId || 'default',
            ownedBorders: ensureArray(safeParse(row.ownedBorders, ['default', 'simple_black'])),
            tournamentScore: Number(row.tournamentScore ?? 0),
            league: row.league || LeagueTier.Sprout,
            mannerMasteryApplied: !!row.mannerMasteryApplied,
            mannerScore: Number(row.mannerScore ?? 200),
            pendingPenaltyNotification: ensureObject(safeParse(row.pendingPenaltyNotification, null), null),
            previousSeasonTier: row.previousSeasonTier ?? null,
            seasonHistory: ensureObject(safeParse(row.seasonHistory, {})),
            stats: finalStats,
            baseStats: { ...createDefaultBaseStats(), ...ensureObject(safeParse(row.baseStats, {})) },
            spentStatPoints: { ...createDefaultSpentStatPoints(), ...ensureObject(safeParse(row.spentStatPoints, {})) },
            inventory: ensureArray(safeParse(row.inventory, [])),
            equipment: ensureObject(safeParse(row.equipment, {})),
            equipmentPresets: userPresets,
            actionPoints,
            mail: ensureArray(safeParse(row.mail, [])),
            quests,
            lastNeighborhoodPlayedDate: row.lastNeighborhoodPlayedDate ? Number(row.lastNeighborhoodPlayedDate) : undefined,
            neighborhoodRewardClaimed: !!row.neighborhoodRewardClaimed,
            lastNeighborhoodTournament: ensureObject(safeParse(row.lastNeighborhoodTournament, null), null),
            lastNationalPlayedDate: row.lastNationalPlayedDate ? Number(row.lastNationalPlayedDate) : undefined,
            nationalRewardClaimed: !!row.nationalRewardClaimed,
            lastNationalTournament: ensureObject(safeParse(row.lastNationalTournament, null), null),
            lastWorldPlayedDate: row.lastWorldPlayedDate ? Number(row.lastWorldPlayedDate) : undefined,
            worldRewardClaimed: !!row.worldRewardClaimed,
            lastWorldTournament: ensureObject(safeParse(row.lastWorldTournament, null), null),
            dailyChampionshipMatchesPlayed: Number(row.dailyChampionshipMatchesPlayed ?? 0),
            lastChampionshipMatchDate: Number(row.lastChampionshipMatchDate ?? 0),
            weeklyCompetitors: ensureArray(safeParse(row.weeklyCompetitors, [])),
            lastWeeklyCompetitorsUpdate: Number(row.lastWeeklyCompetitorsUpdate ?? 0),
            lastLeagueUpdate: Number(row.lastLeagueUpdate ?? 0),
            monthlyGoldBuffExpiresAt: Number(row.monthlyGoldBuffExpiresAt ?? 0),
            mbti: row.mbti ?? null,
            isMbtiPublic: !!row.isMbtiPublic,
            singlePlayerProgress: Number(row.singlePlayerProgress ?? 0),
            bonusStatPoints: Number(row.bonusStatPoints ?? 0),
            singlePlayerMissions: finalSpMissions,
            towerProgress: { highestFloor: 0, lastClearTimestamp: 0, ...towerProgressFromDb },
            claimedFirstClearRewards: ensureArray(safeParse(row.claimedFirstClearRewards, [])),
            currencyLogs: ensureArray(safeParse(row.currencyLogs, [])),
            guildId: row.guildId ?? null,
            guildApplications: ensureArray(safeParse(row.guildApplications, [])),
            guildLeaveCooldownUntil: row.guildLeaveCooldownUntil ? Number(row.guildLeaveCooldownUntil) : 0,
            guildCoins: Number(row.guildCoins ?? 0),
            guildBossAttempts: Number(row.guildBossAttempts ?? 0),
            lastGuildBossAttemptDate: Number(row.lastGuildBossAttemptDate ?? 0),
            lastLoginAt: Number(row.lastLoginAt ?? 0),
            dailyDonations: { gold: 0, diamond: 0, ...dailyDonationsFromDb, date: Number(dailyDonationsFromDb.date || 0) },
            dailyMissionContribution: { amount: 0, ...dailyMissionContributionFromDb, date: Number(dailyMissionContributionFromDb.date || 0) },
            guildShopPurchases: ensureObject(safeParse(row.guildShopPurchases, {})),
            appSettings,
            kakaoId: row.kakaoId ?? undefined,
        };
        return user;
    } catch (e) {
        console.error(`[FATAL] Unrecoverable error processing user data for row ID ${row?.id}:`, e);
        return null;
    }
};

const rowToGame = (row: any): LiveGameSession | null => {
    if (!row) return null;
    try {
        const player1Object = safeParse(row.player1, null);
        const player2Object = safeParse(row.player2, null);

        if (!player1Object || typeof player1Object !== 'object' || !player2Object || typeof player2Object !== 'object') {
            console.error(`[DB Mapper] Corrupt or missing player data object for game ID ${row.id}. Discarding game record.`);
            return null;
        }

        const player1 = rowToUser(player1Object);
        const player2 = rowToUser(player2Object);
        
        if (!player1?.id || !player2?.id) {
             console.error(`[DB Mapper] Failed to fully map player data (missing ID) for game ID ${row.id}. Discarding game record.`);
             return null;
        }
        
        const game: LiveGameSession = {
            id: row.id,
            mode: row.mode,
            description: row.description ?? undefined,
            player1,
            player2,
            blackPlayerId: row.blackPlayerId ?? null,
            whitePlayerId: row.whitePlayerId ?? null,
            gameStatus: row.gameStatus,
            currentPlayer: Number(row.currentPlayer ?? 0),
            boardState: ensureArray(safeParse(row.boardState, [])),
            moveHistory: ensureArray(safeParse(row.moveHistory, [])),
            captures: ensureObject(safeParse(row.captures, { [Player.Black]: 0, [Player.White]: 0, [Player.None]: 0 })),
            baseStoneCaptures: ensureObject(safeParse(row.baseStoneCaptures, { [Player.Black]: 0, [Player.White]: 0, [Player.None]: 0 })),
            hiddenStoneCaptures: ensureObject(safeParse(row.hiddenStoneCaptures, { [Player.Black]: 0, [Player.White]: 0, [Player.None]: 0 })),
            winner: row.winner != null ? Number(row.winner) : null,
            winReason: row.winReason ?? null,
            finalScores: ensureObject(safeParse(row.finalScores, null), null),
            createdAt: Number(row.createdAt ?? 0),
            lastMove: ensureObject(safeParse(row.lastMove, null), null),
            lastTurnStones: ensureArray(safeParse(row.lastTurnStones, null), null),
            stonesPlacedThisTurn: ensureArray(safeParse(row.stonesPlacedThisTurn, null), null),
            passCount: Number(row.passCount ?? 0),
            koInfo: ensureObject(safeParse(row.koInfo, null), null),
            winningLine: ensureArray(safeParse(row.winningLine, null), null),
            statsUpdated: !!row.statsUpdated,
            summary: ensureObject(safeParse(row.summary, undefined), undefined),
            animation: ensureObject(safeParse(row.animation, undefined), undefined),
            blackTimeLeft: Number(row.blackTimeLeft ?? 0),
            whiteTimeLeft: Number(row.whiteTimeLeft ?? 0),
            blackByoyomiPeriodsLeft: Number(row.blackByoyomiPeriodsLeft ?? 0),
            whiteByoyomiPeriodsLeft: Number(row.whiteByoyomiPeriodsLeft ?? 0),
            turnDeadline: row.turnDeadline ? Number(row.turnDeadline) : undefined,
            turnStartTime: row.turnStartTime ? Number(row.turnStartTime) : undefined,
            disconnectionState: ensureObject(safeParse(row.disconnectionState, null), null),
            disconnectionCounts: ensureObject(safeParse(row.disconnectionCounts, {})),
            noContestInitiatorIds: ensureArray(safeParse(row.noContestInitiatorIds, undefined), undefined),
            currentActionButtons: ensureObject(safeParse(row.currentActionButtons, {})),
            actionButtonCooldownDeadline: ensureObject(safeParse(row.actionButtonCooldownDeadline, undefined), undefined),
            actionButtonUses: ensureObject(safeParse(row.actionButtonUses, undefined), undefined),
            maxActionButtonUses: row.maxActionButtonUses ?? undefined,
            actionButtonUsedThisCycle: ensureObject(safeParse(row.actionButtonUsedThisCycle, undefined), undefined),
            mannerScoreChanges: ensureObject(safeParse(row.mannerScoreChanges, undefined), undefined),
            nigiri: ensureObject(safeParse(row.nigiri, undefined), undefined),
            guessDeadline: row.guessDeadline ? Number(row.guessDeadline) : undefined,
            bids: ensureObject(safeParse(row.bids, undefined), undefined),
            biddingRound: row.biddingRound ?? undefined,
            captureBidDeadline: row.captureBidDeadline ? Number(row.captureBidDeadline) : undefined,
            effectiveCaptureTargets: ensureObject(safeParse(row.effectiveCaptureTargets, undefined), undefined),
            baseStones: ensureArray(safeParse(row.baseStones, undefined), undefined),
            baseStones_p1: ensureArray(safeParse(row.baseStones_p1, undefined), undefined),
            baseStones_p2: ensureArray(safeParse(row.baseStones_p2, undefined), undefined),
            basePlacementDeadline: row.basePlacementDeadline ? Number(row.basePlacementDeadline) : undefined,
            komiBids: ensureObject(safeParse(row.komiBids, undefined), undefined),
            komiBiddingDeadline: row.komiBiddingDeadline ? Number(row.komiBiddingDeadline) : undefined,
            komiBiddingRound: row.komiBiddingRound ?? undefined,
            komiBidRevealProcessed: !!row.komiBidRevealProcessed,
            finalKomi: row.finalKomi ? Number(row.finalKomi) : undefined,
            hiddenMoves: ensureObject(safeParse(row.hiddenMoves, undefined), undefined),
            scans_p1: row.scans_p1 ?? undefined,
            scans_p2: row.scans_p2 ?? undefined,
            revealedStones: ensureObject(safeParse(row.revealedStones, {}), {}),
            revealedHiddenMoves: ensureObject(safeParse(row.revealedHiddenMoves, {}), {}),
            newlyRevealed: ensureArray(safeParse(row.newlyRevealed, undefined), undefined),
            justCaptured: ensureArray(safeParse(row.justCaptured, undefined), undefined),
            hidden_stones_used_p1: row.hidden_stones_used_p1 ?? undefined,
            hidden_stones_used_p2: row.hidden_stones_used_p2 ?? undefined,
            pendingCapture: ensureObject(safeParse(row.pendingCapture, undefined), undefined),
            permanentlyRevealedStones: ensureArray(safeParse(row.permanentlyRevealedStones, undefined), undefined),
            pendingAiMove: undefined,
            missileUsedThisTurn: !!row.missileUsedThisTurn,
            missiles_p1: row.missiles_p1 ?? undefined,
            missiles_p2: row.missiles_p2 ?? undefined,
            rpsState: ensureObject(safeParse(row.rpsState, null), null),
            rpsRound: row.rpsRound ?? undefined,
            dice: ensureObject(safeParse(row.dice, null), null),
            stonesToPlace: row.stonesToPlace ?? undefined,
            turnOrderRolls: ensureObject(safeParse(row.turnOrderRolls, null), null),
            turnOrderRollReady: ensureObject(safeParse(row.turnOrderRollReady, null), null),
            turnOrderRollResult: row.turnOrderRollResult ?? undefined,
            turnOrderRollTies: row.turnOrderRollTies ?? undefined,
            turnOrderRollDeadline: row.turnOrderRollDeadline ? Number(row.turnOrderRollDeadline) : undefined,
            turnOrderAnimationEndTime: row.turnOrderAnimationEndTime ? Number(row.turnOrderAnimationEndTime) : undefined,
            turnChoiceDeadline: row.turnChoiceDeadline ? Number(row.turnChoiceDeadline) : undefined,
            turnChooserId: row.turnChooserId ?? undefined,
            turnChoices: ensureObject(safeParse(row.turnChoices, null), null),
            turnSelectionTiebreaker: row.turnSelectionTiebreaker ?? undefined,
            diceRollHistory: ensureObject(safeParse(row.diceRollHistory, null), null),
            diceRoundSummary: ensureObject(safeParse(row.diceRoundSummary, null), null),
            lastWhiteGroupInfo: ensureObject(safeParse(row.lastWhiteGroupInfo, null), null),
            diceGoItemUses: ensureObject(safeParse(row.diceGoItemUses, {})),
            diceGoBonuses: ensureObject(safeParse(row.diceGoBonuses, {})),
            diceCapturesThisTurn: row.diceCapturesThisTurn ?? undefined,
            diceLastCaptureStones: ensureArray(safeParse(row.diceLastCaptureStones, null), null),
            round: row.round ?? 1,
            isDeathmatch: !!row.isDeathmatch,
            turnInRound: row.turnInRound ?? 1,
            scores: ensureObject(safeParse(row.scores, {})),
            thiefPlayerId: row.thiefPlayerId ?? undefined,
            policePlayerId: row.policePlayerId ?? undefined,
            roleChoices: ensureObject(safeParse(row.roleChoices, {})),
            roleChoiceWinnerId: row.roleChoiceWinnerId ?? undefined,
            thiefRoundSummary: ensureObject(safeParse(row.thiefRoundSummary, null), null),
            thiefDiceRollHistory: ensureObject(safeParse(row.thiefDiceRollHistory, null), null),
            thiefCapturesThisRound: row.thiefCapturesThisTurn ?? undefined,
            alkkagiStones: ensureArray(safeParse(row.alkkagiStones, null), null),
            alkkagiStones_p1: ensureArray(safeParse(row.alkkagiStones_p1, null), null),
            alkkagiStones_p2: ensureArray(safeParse(row.alkkagiStones_p2, null), null),
            alkkagiTurnDeadline: row.alkkagiTurnDeadline ? Number(row.alkkagiTurnDeadline) : undefined,
            alkkagiPlacementDeadline: row.alkkagiPlacementDeadline ? Number(row.alkkagiPlacementDeadline) : undefined,
            alkkagiItemUses: ensureObject(safeParse(row.alkkagiItemUses, {})),
            activeAlkkagiItems: ensureObject(safeParse(row.activeAlkkagiItems, {})),
            alkkagiRound: row.alkkagiRound ?? undefined,
            alkkagiRefillsUsed: ensureObject(safeParse(row.alkkagiRefillsUsed, {})),
            alkkagiStonesPlacedThisRound: ensureObject(safeParse(row.alkkagiStonesPlacedThisRound, {})),
            alkkagiRoundSummary: ensureObject(safeParse(row.alkkagiRoundSummary, null), null),
            curlingStones: ensureArray(safeParse(row.curlingStones, null), null),
            curlingTurnDeadline: row.curlingTurnDeadline ? Number(row.curlingTurnDeadline) : undefined,
            curlingScores: ensureObject(safeParse(row.curlingScores, {})),
            curlingRound: row.curlingRound ?? undefined,
            curlingRoundSummary: ensureObject(safeParse(row.curlingRoundSummary, null), null),
            curlingItemUses: ensureObject(safeParse(row.curlingItemUses, {})),
            activeCurlingItems: ensureObject(safeParse(row.activeCurlingItems, {})),
            hammerPlayerId: row.hammerPlayerId ?? undefined,
            isTiebreaker: !!row.isTiebreaker,
            tiebreakerStonesThrown: row.tiebreakerStonesThrown ?? undefined,
            stonesThrownThisRound: ensureObject(safeParse(row.stonesThrownThisRound, {})),
            preGameConfirmations: ensureObject(safeParse(row.preGameConfirmations, null), null),
            roundEndConfirmations: ensureObject(safeParse(row.roundEndConfirmations, null), null),
            rematchRejectionCount: ensureObject(safeParse(row.rematchRejectionCount, null), null),
            timeoutFouls: ensureObject(safeParse(row.timeoutFouls, {})),
            curlingStonesLostToFoul: ensureObject(safeParse(row.curlingStonesLostToFoul, {})),
            foulInfo: ensureObject(safeParse(row.foulInfo, null), null),
            isAnalyzing: !!row.isAnalyzing,
            analysisResult: ensureObject(safeParse(row.analysisResult, null), null),
            previousAnalysisResult: ensureObject(safeParse(row.previousAnalysisResult, null), null),
            settings: { ...DEFAULT_GAME_SETTINGS, ...ensureObject(safeParse(row.settings, {})) },
            canRequestNoContest: ensureObject(safeParse(row.canRequestNoContest, undefined), undefined),
            pausedTurnTimeLeft: row.pausedTurnTimeLeft ? Number(row.pausedTurnTimeLeft) : undefined,
            itemUseDeadline: row.itemUseDeadline ? Number(row.itemUseDeadline) : undefined,
            lastTimeoutPlayerId: row.lastTimeoutPlayerId ?? undefined,
            lastTimeoutPlayerIdClearTime: row.lastTimeoutPlayerIdClearTime ? Number(row.lastTimeoutPlayerIdClearTime) : undefined,
            revealAnimationEndTime: row.revealAnimationEndTime ? Number(row.revealAnimationEndTime) : undefined,
            revealEndTime: row.revealEndTime ? Number(row.revealEndTime) : undefined,
            isAiGame: !!row.isAiGame,
            aiTurnStartTime: row.aiTurnStartTime ? Number(row.aiTurnStartTime) : undefined,
            mythicBonuses: ensureObject(safeParse(row.mythicBonuses, {})),
            lastPlayfulGoldCheck: ensureObject(safeParse(row.lastPlayfulGoldCheck, {})),
            pendingSystemMessages: ensureArray(safeParse(row.pendingSystemMessages, undefined), undefined),
            isSinglePlayer: !!row.isSinglePlayer,
            stageId: row.stageId ?? undefined,
            blackPatternStones: ensureArray(safeParse(row.blackPatternStones, null), null),
            whitePatternStones: ensureArray(safeParse(row.whitePatternStones, null), null),
            singlePlayerPlacementRefreshesUsed: Number(row.singlePlayerPlacementRefreshesUsed ?? 0),
            towerChallengePlacementRefreshesUsed: Number(row.towerChallengePlacementRefreshesUsed ?? 0),
            towerAddStonesUsed: Number(row.towerAddStonesUsed ?? 0),
            towerItemPurchases: ensureObject(safeParse(row.towerItemPurchases, {})),
            blackStonesPlaced: row.blackStonesPlaced ?? undefined,
            blackStoneLimit: row.blackStoneLimit ?? undefined,
            isTowerChallenge: !!row.isTowerChallenge,
            floor: row.floor ?? undefined,
            gameType: row.gameType ?? undefined,
            whiteStonesPlaced: row.whiteStonesPlaced ?? undefined,
            whiteStoneLimit: row.whiteStoneLimit ?? undefined,
            autoEndTurnCount: row.autoEndTurnCount ?? undefined,
            promptForMoreStones: !!row.promptForMoreStones,
        };
        return game;
    } catch (e) {
        console.error(`[FATAL] Error processing game data for row ID ${row?.id}:`, e);
        return null;
    }
};

// --- End of inlined data mapping logic ---

function usePrevious<T>(value: T): T | undefined {
    const ref = useRef<T | undefined>(undefined);
    useEffect(() => {
        ref.current = value;
    }, [value]);
    return ref.current;
}

export const useApp = () => {
    // --- State Management ---
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [kakaoRegistrationData, setKakaoRegistrationData] = useState<{ kakaoId: string; suggestedNickname: string } | null>(null);

    useEffect(() => {
        try {
            const stored = localStorage.getItem('sessionData');
            if (stored) {
                const { user, sessionId: sid } = JSON.parse(stored);
                setCurrentUser(user);
                setSessionId(sid);
            }
        } catch (e) {
            console.error('Failed to initialize session from storage', e);
            localStorage.removeItem('sessionData');
        }
    }, []);

    const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => parseHash(window.location.hash));
    const currentRouteRef = useRef(currentRoute);
    const [error, setError] = useState<string | null>(null);
    const [successToast, setSuccessToast] = useState<string | null>(null);
    const isLoggingOut = useRef(false);
    const isExitingGame = useRef(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    
    // --- App Settings State ---
    const [settings, setSettings] = useState<AppSettings>(() => {
        try {
            const storedSettings = localStorage.getItem('appSettings');
            if (storedSettings) {
                const parsed = JSON.parse(storedSettings);
                // Deep merge with defaults to ensure all keys are present
                return {
                    graphics: { ...defaultSettings.graphics, ...(parsed.graphics || {}) },
                    sound: { ...defaultSettings.sound, ...(parsed.sound || {}) },
                    features: { ...defaultSettings.features, ...(parsed.features || {}) },
                };
            }
        } catch (e) { console.error('Failed to load settings from localStorage', e); }
        return defaultSettings;
    });

    useEffect(() => {
        const checkIsMobile = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', checkIsMobile);
        return () => window.removeEventListener('resize', checkIsMobile);
    }, []);
    
    const doLogoutClientSide = useCallback(() => {
        setCurrentUser(null);
        setSessionId(null);
        isLoggingOut.current = false;
        window.location.hash = '';
    }, []);

    const handleAction = useCallback(async (action: ServerAction): Promise<{success: boolean, error?: string, [key: string]: any} | undefined> => {
        if (
            action.type.startsWith('LEAVE_') || 
            action.type.startsWith('RESIGN_') ||
            action.type === 'REQUEST_NO_CONTEST_LEAVE'
        ) {
            isExitingGame.current = true;
            // Failsafe timeout to prevent getting stuck
            setTimeout(() => { isExitingGame.current = false; }, 3000);
        }

        if (action.type === 'CLEAR_TOURNAMENT_SESSION') {
            setCurrentUser(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    lastNeighborhoodTournament: null,
                    lastNationalTournament: null,
                    lastWorldTournament: null,
                };
            });
        }
        if (action.type === 'TOGGLE_EQUIP_ITEM') {
            const itemToToggle = currentUser?.inventory.find(i => i.id === action.payload.itemId);

            if (currentUser && itemToToggle && !itemToToggle.isEquipped) {
                const requiredLevel = GRADE_LEVEL_REQUIREMENTS[itemToToggle.grade];
                const userLevelSum = currentUser.strategyLevel + currentUser.playfulLevel;
                if (userLevelSum < requiredLevel) {
                    showError(`착용 레벨 합이 부족합니다. (필요: ${requiredLevel}, 현재: ${userLevelSum})`);
                    return { success: false, error: `착용 레벨 합이 부족합니다. (필요: ${requiredLevel}, 현재: ${userLevelSum})` };
                }
            }

            setCurrentUser(prevUser => {
                if (!prevUser) return null;
                const { itemId } = action.payload;
                const itemToToggle = prevUser.inventory.find(i => i.id === itemId);
    
                if (!itemToToggle || itemToToggle.type !== 'equipment' || !itemToToggle.slot) {
                    return prevUser;
                }
    
                const slotToUpdate = itemToToggle.slot;
                const isEquipping = !itemToToggle.isEquipped;
                
                const newEquipment = { ...prevUser.equipment };
                if (isEquipping) {
                    newEquipment[slotToUpdate] = itemToToggle.id;
                } else {
                    delete newEquipment[slotToUpdate];
                }
    
                const newInventory = prevUser.inventory.map(item => {
                    if (item.id === itemId) return { ...item, isEquipped: isEquipping };
                    if (isEquipping && item.slot === slotToUpdate && item.id !== itemId) return { ...item, isEquipped: false };
                    return item;
                });
                
                return { ...prevUser, inventory: newInventory, equipment: newEquipment };
            });
        }

        try {
            audioService.initialize();
            const res = await fetch('/api/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...action, userId: currentUser?.id, sessionId }),
            });

            if (!res.ok) {
                if (res.status === 401) {
                    showError('다른 기기에서 로그인하여 세션이 만료되었습니다. 다시 로그인해주세요.');
                    if (!isLoggingOut.current) {
                        isLoggingOut.current = true;
                        doLogoutClientSide();
                    }
                    return { success: false, error: 'Session expired' };
                }

                const errorData = await res.json();
                showError(errorData.message || 'An unknown error occurred.');
                 if (action.type === 'TOGGLE_EQUIP_ITEM' || action.type === 'USE_ITEM') {
                    setCurrentUser(prevUser => prevUser ? { ...prevUser } : null);
                 }
                return { success: false, error: errorData.message || 'An unknown error occurred.' };
            } else {
                const result = await res.json();
                
                if (result.updatedUser) {
                    setCurrentUser(result.updatedUser);
                }
                
                if (result.successMessage) {
                    setSuccessToast(result.successMessage);
                    setTimeout(() => setSuccessToast(null), 3000);
                }
                
                if (result.obtainedItemsBulk) setLastUsedItemResult(result.obtainedItemsBulk);
                if (result.rewardSummary) setRewardSummary(result.rewardSummary);
                if (result.claimAllSummary) { setClaimAllSummary(result.claimAllSummary); setIsClaimAllSummaryOpen(true); }
                if (result.disassemblyResult) { setDisassemblyResult(result.disassemblyResult); if (result.disassemblyResult.jackpot) audioService.disassemblyJackpot(); }
                if (result.craftResult) setCraftResult(result.craftResult);
                if (result.synthesisResult) setSynthesisResult(result.synthesisResult);
                if (result.enhancementOutcome) {
                    const { message, success, itemBefore, itemAfter } = result.enhancementOutcome;
                    setEnhancementResult({ message, success });
                    setEnhancementOutcome({ message, success, itemBefore, itemAfter });
                    if (success) {
                        audioService.enhancementSuccess();
                    } else {
                        audioService.enhancementFail();
                    }
                }
                if (result.enhancementAnimationTarget) setEnhancementAnimationTarget(result.enhancementAnimationTarget);
                if (result.guildBossBattleResult) {
                    const bossName = action.payload?.bossName || '보스'; 
                    setGuildBossBattleResult({ ...result.guildBossBattleResult, bossName });
                }
                if (result.donationResult) {
                    setGuildDonationAnimation(result.donationResult);
                    setTimeout(() => setGuildDonationAnimation(null), 2500);
                }
                return result;
            }
        } catch (err: any) {
            showError(err.message);
            return { success: false, error: err.message };
        }
    }, [currentUser?.id, sessionId, doLogoutClientSide, currentUser]);

    const handleLogout = useCallback(async () => {
        if (isLoggingOut.current) return;
        isLoggingOut.current = true;
        
        await (supabase.auth as any).signOut();
    }, []);
    
    useEffect(() => {
        const handler = setTimeout(() => {
            try {
                localStorage.setItem('appSettings', JSON.stringify(settings));
            } catch (e) {
                console.error('Failed to save settings to localStorage', e);
            }
        }, 1000); // Debounce save

        return () => {
            clearTimeout(handler);
        };
    }, [settings]);


    useEffect(() => {
        document.documentElement.setAttribute('data-theme', settings.graphics.theme);
    }, [settings.graphics.theme]);

    useEffect(() => {
        audioService.updateSettings(settings.sound);
    }, [settings.sound]);

    const updateTheme = useCallback((theme: Theme) => {
        setSettings(s => ({ 
            ...s, 
            graphics: { 
                ...s.graphics, 
                theme,
                // Reset custom colors when theme changes
                panelColor: undefined, 
                textColor: undefined,
            } 
        }));
    }, []);

    const updatePanelColor = useCallback((color: string) => {
        setSettings(s => ({ ...s, graphics: { ...s.graphics, panelColor: color }}));
    }, []);

    const updateTextColor = useCallback((color: string) => {
        setSettings(s => ({ ...s, graphics: { ...s.graphics, textColor: color }}));
    }, []);
    
    const resetGraphicsToDefault = useCallback(() => {
        setSettings(s => ({ ...s, graphics: { ...s.graphics, panelColor: undefined, textColor: undefined } }));
    }, []);

    const updateSoundSetting = useCallback(<K extends keyof SoundSettings>(key: K, value: SoundSettings[K]) => {
        setSettings(s => ({ ...s, sound: { ...s.sound, [key]: value } }));
    }, []);

    const updateFeatureSetting = useCallback(<K extends keyof FeatureSettings>(key: K, value: FeatureSettings[K]) => {
        setSettings(s => ({ ...s, features: { ...s.features, [key]: value } }));
    }, []);

    // --- Server State ---
    const [usersMap, setUsersMap] = useState<Record<string, User>>({});
    const [userStatuses, setUserStatuses] = useState<Record<string, UserStatusInfo>>({});
    const [liveGames, setLiveGames] = useState<Record<string, LiveGameSession>>({});
    const [negotiations, setNegotiations] = useState<Record<string, Negotiation>>({});
    const [waitingRoomChats, setWaitingRoomChats] = useState<Record<string, ChatMessage[]>>({});
    const [gameChats, setGameChats] = useState<Record<string, ChatMessage[]>>({});
    const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
    const [gameModeAvailability, setGameModeAvailability] = useState<Record<GameMode, boolean>>({} as Record<GameMode, boolean>);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [globalOverrideAnnouncement, setGlobalOverrideAnnouncement] = useState<OverrideAnnouncement | null>(null);
    const [announcementInterval, setAnnouncementInterval] = useState(3);
    const [towerRankings, setTowerRankings] = useState<TowerRank[]>([]);
    const [guilds, setGuilds] = useState<Record<string, Guild>>({});
    
    // --- UI Modals & Toasts ---
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isInventoryOpen, setIsInventoryOpen] = useState(false);
    const [inventoryInitialTab, setInventoryInitialTab] = useState<InventoryTab>('all');
    const [isMailboxOpen, setIsMailboxOpen] = useState(false);
    const [isQuestsOpen, setIsQuestsOpen] = useState(false);
    const [isShopOpen, setIsShopOpen] = useState(false);
    const [shopInitialTab, setShopInitialTab] = useState<ShopTab>('equipment');
    const [isActionPointQuizOpen, setIsActionPointQuizOpen] = useState(false);
    const [lastUsedItemResult, setLastUsedItemResult] = useState<InventoryItem[] | null>(null);
    const [disassemblyResult, setDisassemblyResult] = useState<{ gained: { name: string, amount: number }[], jackpot: boolean } | null>(null);
    const [craftResult, setCraftResult] = useState<{ gained: { name: string; amount: number }[]; used: { name: string; amount: number }[]; craftType: 'upgrade' | 'downgrade'; } | null>(null);
    const [synthesisResult, setSynthesisResult] = useState<{ item: InventoryItem; wasUpgraded: boolean; } | null>(null);
    const [rewardSummary, setRewardSummary] = useState<{ reward: QuestReward; items: InventoryItem[]; title: string } | null>(null);
    const [isClaimAllSummaryOpen, setIsClaimAllSummaryOpen] = useState(false);
    const [claimAllSummary, setClaimAllSummary] = useState<{ gold: number; diamonds: number; actionPoints: number } | null>(null);
    const [viewingUser, setViewingUser] = useState<UserWithStatus | null>(null);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [isEncyclopediaOpen, setIsEncyclopediaOpen] = useState(false);
    const [isStatAllocationModalOpen, setIsStatAllocationModalOpen] = useState(false);
    const [enhancementResult, setEnhancementResult] = useState<{ message: string; success: boolean } | null>(null);
    const [enhancementOutcome, setEnhancementOutcome] = useState<{ message: string; success: boolean; itemBefore: InventoryItem; itemAfter: InventoryItem; } | null>(null);
    const [enhancementAnimationTarget, setEnhancementAnimationTarget] = useState<{ itemId: string; stars: number } | null>(null);
    const [pastRankingsInfo, setPastRankingsInfo] = useState<{ user: UserWithStatus; mode: GameMode; } | null>(null);
    const [enhancingItem, setEnhancingItem] = useState<InventoryItem | null>(null);
    const [viewingItem, setViewingItem] = useState<{ item: InventoryItem; isOwnedByCurrentUser: boolean; } | null>(null);
    const [showExitToast, setShowExitToast] = useState(false);
    const exitToastTimer = useRef<number | null>(null);
    const [isProfileEditModalOpen, setIsProfileEditModalOpen] = useState(false);
    const [moderatingUser, setModeratingUser] = useState<UserWithStatus | null>(null);
    const [isTowerRewardInfoOpen, setIsTowerRewardInfoOpen] = useState(false);
    const [levelUpInfo, setLevelUpInfo] = useState<{ type: 'strategy' | 'playful', newLevel: number } | null>(null);
    const [isGuildEffectsModalOpen, setIsGuildEffectsModalOpen] = useState(false);
    const [guildBossBattleResult, setGuildBossBattleResult] = useState<(GuildBossBattleResult & { bossName: string }) | null>(null);
    const [guildDonationAnimation, setGuildDonationAnimation] = useState<{ coins: number; research: number } | null>(null);
    const [isEquipmentEffectsModalOpen, setIsEquipmentEffectsModalOpen] = useState(false);
    const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);

    // --- Derived State ---
    const allUsers = useMemo(() => Object.values(usersMap), [usersMap]);

    const onlineUsers: UserWithStatus[] = useMemo(() => {
        return Object.entries(userStatuses)
            .map(([id, statusInfo]) => {
                const user = usersMap[id];
                if (!user) return null;
                return { ...user, ...statusInfo };
            })
            .filter((u): u is UserWithStatus => u !== null);
    }, [usersMap, userStatuses]);

    const currentUserWithStatus: UserWithStatus | null = useMemo(() => {
        if (!currentUser) return null;
        const statusInfo = userStatuses[currentUser.id];
        return { ...currentUser, ...(statusInfo || { status: UserStatus.Online, stateEnteredAt: Date.now() }) };
    }, [currentUser, userStatuses]);

    const activeGame = useMemo(() => {
        if (!currentUserWithStatus) return null;
        const gameId = currentUserWithStatus.gameId || currentUserWithStatus.spectatingGameId;
        if (gameId && (currentUserWithStatus.status === 'in-game' || currentUserWithStatus.status === 'spectating' || currentUserWithStatus.status === 'negotiating')) {
             const game = liveGames[gameId];
             if (game) return game;
        }
        return null;
    }, [currentUserWithStatus, liveGames]);

    const myGuild = useMemo(() => {
        if (!currentUserWithStatus?.guildId) return null;
        return guilds[currentUserWithStatus.guildId];
    }, [currentUserWithStatus?.guildId, guilds]);

    const activeNegotiation = useMemo(() => {
        if (!currentUserWithStatus) return null;
        return Object.values(negotiations).find(neg => (
            (neg.challenger.id === currentUserWithStatus.id) ||
            (neg.opponent.id === currentUserWithStatus.id && neg.status === 'pending')
        )) || null;
    }, [currentUserWithStatus, negotiations]);

    const unreadMailCount = useMemo(() => currentUser?.mail.filter(m => !m.isRead).length || 0, [currentUser?.mail]);

    const hasClaimableQuest = useMemo(() => {
        if (!currentUser?.quests) return false;
        const { daily, weekly, monthly } = currentUser.quests;
    
        const checkQuestList = (questData?: DailyQuestData | WeeklyQuestData | MonthlyQuestData) => {
            if (!questData) return false;
            return questData.quests.some(q => q.progress >= q.target && !q.isClaimed);
        };
    
        const checkMilestones = (questData?: DailyQuestData | WeeklyQuestData | MonthlyQuestData, thresholds?: number[]) => {
            if (!questData || !thresholds) return false;
            return questData.claimedMilestones.some((claimed, index) => {
                return !claimed && questData.activityProgress >= thresholds[index];
            });
        };
    
        return checkQuestList(daily) ||
               checkQuestList(weekly) ||
               checkQuestList(monthly) ||
               checkMilestones(daily, DAILY_MILESTONE_THRESHOLDS) ||
               checkMilestones(weekly, WEEKLY_MILESTONE_THRESHOLDS) ||
               checkMilestones(monthly, MONTHLY_MILESTONE_THRESHOLDS);
    }, [currentUser?.quests]);
    
    const hasFullMissionReward = useMemo(() => {
        if (!currentUserWithStatus?.singlePlayerMissions) return false;
        
        const now = Date.now();
        for (const missionId in currentUserWithStatus.singlePlayerMissions) {
            const missionState = currentUserWithStatus.singlePlayerMissions[missionId];
            const missionInfo = SINGLE_PLAYER_MISSIONS.find(m => m.id === missionId);
            
            if (missionState && missionInfo && missionState.isStarted) {
                const currentLevel = missionState.level || 1;
                const leveledMissionInfo = getMissionInfoWithLevel(missionInfo as SinglePlayerStageInfo, currentLevel);
                
                const productionIntervalMs = (leveledMissionInfo as any)?.productionRateMinutes * 60 * 1000;
                if (!productionIntervalMs || productionIntervalMs <= 0) {
                    if (missionState.claimableAmount >= (leveledMissionInfo as any)?.maxCapacity) {
                        return true;
                    }
                    continue;
                }
                
                const elapsedMs = now - missionState.lastCollectionTime;
                const rewardsGenerated = Math.floor(elapsedMs / productionIntervalMs);
                const amountGenerated = rewardsGenerated * (leveledMissionInfo as any)?.rewardAmount;
                const newAccumulated = (missionState.claimableAmount || 0) + amountGenerated;

                if (newAccumulated >= (leveledMissionInfo as any)?.maxCapacity) {
                    return true;
                }
            }
        }
        return false;
    }, [currentUserWithStatus?.singlePlayerMissions]);
    
    const hasUnclaimedTournamentReward = useMemo(() => {
        if (!currentUser) return false;
        
        const tournaments: { state: TournamentState | null; claimed: boolean | undefined }[] = [
            { state: currentUser.lastNeighborhoodTournament, claimed: currentUser.neighborhoodRewardClaimed },
            { state: currentUser.lastNationalTournament, claimed: currentUser.nationalRewardClaimed },
            { state: currentUser.lastWorldTournament, claimed: currentUser.worldRewardClaimed }
        ];

        return tournaments.some(t => {
            if (t.state && (t.state.status === 'complete' || t.state.status === 'eliminated')) {
                return !t.claimed;
            }
            return false;
        });
    }, [currentUser]);

    const showError = (message: string) => {
        let displayMessage = message;
        if (message.includes('Invalid move: ko')) {
            displayMessage = "패 모양입니다. 다른 곳에 착수 후 다시 둘 수 있는 자리입니다.";
        } else if (message.includes('action point')) {
            displayMessage = "상대방의 행동력이 충분하지 않습니다.";
        }
        setError(displayMessage);
        setTimeout(() => setError(null), 5000);
    };
    
    const login = useCallback((user: User, sid: string) => {
        setCurrentUser(user);
        setSessionId(sid);
        setKakaoRegistrationData(null); // Clear registration data on successful login/registration.
    }, []);

    useEffect(() => {
        if (currentUser && sessionId) {
            localStorage.setItem('sessionData', JSON.stringify({ user: currentUser, sessionId }));
        } else {
            localStorage.removeItem('sessionData');
        }
    }, [currentUser, sessionId]);

    useEffect(() => {
        const { data: authListener } = (supabase.auth as any).onAuthStateChange(async (event: any, session: any) => {
            const currentKakaoId = currentUser?.kakaoId;
            const newKakaoId = session?.user?.identities?.find(
                (id: any) => id.provider === 'kakao'
            )?.id;
            
            if (event === 'SIGNED_IN' && session) {
                if (currentKakaoId && currentKakaoId === newKakaoId) {
                    return;
                }
                try {
                    const response = await fetch('/api/auth/sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ session }),
                    });
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Failed to sync user data.');
                    }
                    const data = await response.json();
                    if (data.needsRegistration) {
                        setKakaoRegistrationData({ kakaoId: data.kakaoId, suggestedNickname: data.suggestedNickname });
                    } else {
                        login(data.user, data.sessionId);
                        window.location.hash = '#/profile';
                    }
                } catch (error: any) {
                    console.error('Error during user sync:', error);
                    showError(error.message);
                    await (supabase.auth as any).signOut();
                }
            } else if (event === 'SIGNED_OUT') {
                if (isLoggingOut.current) { 
                    await handleAction({ type: 'LOGOUT' });
                    doLogoutClientSide();
                }
            }
        });
    
        const hash = window.location.hash;
        if (hash.includes('access_token') && hash.includes('provider_token')) {
            setTimeout(() => {
                if (window.location.hash.includes('access_token')) {
                    window.location.hash = '';
                }
            }, 500);
        }
    
        return () => {
            authListener?.subscription.unsubscribe();
        };
    }, [login, handleAction, doLogoutClientSide, currentUser?.kakaoId]);


    // --- State Fetching and Real-time Subscriptions ---
    useEffect(() => {
        if (!currentUser?.id || !sessionId) return;
        let isCancelled = false;
    
        const fetchInitialState = async () => {
            if (isCancelled) return;
            try {
                const response = await fetch('/api/initial-state', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUser.id, sessionId }),
                });
                if (isCancelled || !response.ok) return;
                const data = await response.json();
                if (isCancelled) return;
                
                // Set initial data
                setUsersMap(data.users || {});
                setLiveGames(data.liveGames || {});
                setGuilds(data.guilds || {});
                setAdminLogs(data.adminLogs || []);
                setAnnouncements(data.announcements || []);
                setGlobalOverrideAnnouncement(data.globalOverrideAnnouncement || null);
                setAnnouncementInterval(data.announcementInterval || 3);
                setTowerRankings(data.towerRankings || []);
                
                // Get volatile state from KV store
                setNegotiations(data.negotiations || {});
                setWaitingRoomChats(data.waitingRoomChats || {});
                setGameChats(data.gameChats || {});
                setUserStatuses(data.userStatuses || {});

            } catch (err) {
                console.error("Initial state fetch error:", err);
            }
        };

        fetchInitialState();
        
        const handleKvUpdate = (payload: any) => {
             const { key, value } = payload.new;
             switch(key) {
                case 'guilds': setGuilds(value); break;
                case 'negotiations': setNegotiations(value); break;
                case 'userStatuses': setUserStatuses(value); break;
                case 'waitingRoomChats': setWaitingRoomChats(value); break;
                case 'gameChats': setGameChats(value); break;
                case 'adminLogs': setAdminLogs(value); break;
                case 'announcements': setAnnouncements(value); break;
                case 'globalOverrideAnnouncement': setGlobalOverrideAnnouncement(value); break;
                case 'announcementInterval': setAnnouncementInterval(value); break;
                case 'gameModeAvailability': setGameModeAvailability(value); break;
             }
        }

        const usersChannel = supabase
            .channel('public:users')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, (payload) => {
                const updatedUser = rowToUser(payload.new);
                if(updatedUser) {
                    setUsersMap(current => ({ ...current, [updatedUser.id]: updatedUser }));
                    if (updatedUser.id === currentUser.id) {
                        setCurrentUser(updatedUser);
                    }
                }
            })
            .subscribe();
            
        const gamesChannel = supabase
            .channel('public:live_games')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'live_games' }, (payload) => {
                if(payload.eventType === 'DELETE') {
                    setLiveGames(current => {
                        const newGames = { ...current };
                        delete newGames[payload.old.id];
                        return newGames;
                    });
                } else {
                    const updatedGame = rowToGame(payload.new);
                    if(updatedGame) {
                        setLiveGames(current => ({ ...current, [updatedGame.id]: updatedGame }));
                    }
                }
            })
            .subscribe();
        
        const kvChannel = supabase
            .channel('public:kv')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kv' }, handleKvUpdate)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kv' }, handleKvUpdate)
            .subscribe();
    
        return () => {
            isCancelled = true;
            supabase.removeChannel(usersChannel);
            supabase.removeChannel(gamesChannel);
            supabase.removeChannel(kvChannel);
        };
    }, [currentUser?.id, sessionId]);

    // --- Navigation Logic ---
    const initialRedirectHandled = useRef(false);
    useEffect(() => { currentRouteRef.current = currentRoute; }, [currentRoute]);
    
    useEffect(() => {
        const handleHashChange = () => {
            const prevRoute = currentRouteRef.current;
            const newRoute = parseHash(window.location.hash);
            const isExiting = (prevRoute.view === 'profile' && newRoute.view === 'profile' && window.location.hash === '');
            
            if (isExiting && currentUser) {
                if (showExitToast) { handleLogout(); } 
                else {
                    setShowExitToast(true);
                    exitToastTimer.current = window.setTimeout(() => setShowExitToast(false), 2000);
                    window.history.pushState(null, '', '#/profile');
                    return;
                }
            } else {
                if (exitToastTimer.current) clearTimeout(exitToastTimer.current);
                if (showExitToast) setShowExitToast(false);
            }
            
            setCurrentRoute(newRoute);
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [currentUser, handleLogout, showExitToast]);

    useEffect(() => {
        if (!activeGame) {
            isExitingGame.current = false;
        }

        if (!currentUser) {
            initialRedirectHandled.current = false;
            // Removed line that clears hash on load
            return;
        }
        
        if (!initialRedirectHandled.current) {
            initialRedirectHandled.current = true;
            if (window.location.hash === '' || window.location.hash === '#/') {
                if (activeGame) {
                    window.location.hash = `#/game/${activeGame.id}`;
                    return;
                }
                window.location.hash = '#/profile';
                return;
            }
        }
        
        const isGamePage = currentRoute.view === 'game';

        if (activeGame && (!isGamePage || currentRoute.params.id !== activeGame.id) && !isExitingGame.current) {
            console.warn("Router: Mismatch between route and active game state. Redirecting to game.");
            window.location.hash = `#/game/${activeGame.id}`;
        } else if (!activeGame && isGamePage) {
            const postGameRedirect = sessionStorage.getItem('postGameRedirect');
            let targetHash = postGameRedirect;
            
            if (targetHash) {
                sessionStorage.removeItem('postGameRedirect');
            } else if (currentUserWithStatus?.status === 'waiting' && currentUserWithStatus?.mode) {
                const slug = SLUG_BY_GAME_MODE.get(currentUserWithStatus.mode);
                if (slug) {
                    targetHash = `#/waiting/${slug}`;
                }
            }
            
            if (!targetHash) {
                 targetHash = '#/profile';
            }

            if (window.location.hash !== targetHash) {
                window.location.hash = targetHash;
            }
        }
    }, [currentUser, activeGame, currentRoute, currentUserWithStatus]);
    
    // --- Misc UseEffects ---
    useEffect(() => {
        const setVh = () => document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
        setVh();
        window.addEventListener('resize', setVh);
        window.addEventListener('orientationchange', setVh);
        return () => { window.removeEventListener('resize', setVh); window.removeEventListener('orientationchange', setVh); };
    }, []);

    useEffect(() => {
        if (enhancementResult) {
            const timer = setTimeout(() => {
                setEnhancementResult(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [enhancementResult]);

    useEffect(() => {
        if (enhancementOutcome) {
            setEnhancingItem(prevItem => {
                if (prevItem && prevItem.id === enhancementOutcome.itemAfter.id) {
                    return enhancementOutcome.itemAfter;
                }
                return prevItem;
            });
        }
    }, [enhancementOutcome]);
    const prevUser = usePrevious(currentUser);
    useEffect(() => {
        if (prevUser && currentUser && !levelUpInfo) {
            if (currentUser.strategyLevel > prevUser.strategyLevel) {
                setLevelUpInfo({ type: 'strategy', newLevel: currentUser.strategyLevel });
                audioService.levelUp();
            } else if (currentUser.playfulLevel > prevUser.playfulLevel) {
                setLevelUpInfo({ type: 'playful', newLevel: currentUser.playfulLevel });
                audioService.levelUp();
            }
        }
    }, [currentUser, prevUser, levelUpInfo]);

    const activeModalIds = useMemo(() => {
        const ids: string[] = [];
        if (activeNegotiation) ids.push('negotiation');
        if (isSettingsModalOpen) ids.push('settings');
        if (isInventoryOpen) ids.push('inventory');
        if (isMailboxOpen) ids.push('mailbox');
        if (isQuestsOpen) ids.push('quests');
        if (rewardSummary) ids.push('rewardSummary');
        if (isClaimAllSummaryOpen) ids.push('claimAllSummary');
        if (isShopOpen) ids.push('shop');
        if (isActionPointQuizOpen) ids.push('actionPointQuiz');
        if (lastUsedItemResult) ids.push('itemObtained');
        if (disassemblyResult) ids.push('disassemblyResult');
        if (craftResult) ids.push('craftResult');
        if (synthesisResult) ids.push('synthesisResult');
        if (viewingUser) ids.push('viewingUser');
        if (isInfoModalOpen) ids.push('infoModal');
        if (isEncyclopediaOpen) ids.push('encyclopedia');
        if (isStatAllocationModalOpen) ids.push('statAllocation');
        if (isProfileEditModalOpen) ids.push('profileEdit');
        if (pastRankingsInfo) ids.push('pastRankings');
        if (moderatingUser) ids.push('moderatingUser');
        if (viewingItem) ids.push('viewingItem');
        if (enhancingItem) ids.push('enhancingItem');
        if (isTowerRewardInfoOpen) ids.push('towerRewardInfo');
        if (isGuildEffectsModalOpen) ids.push('guildEffects');
        if (isEquipmentEffectsModalOpen) ids.push('equipmentEffects');
        if (isPresetModalOpen) ids.push('preset');
        if (levelUpInfo) ids.push('levelUp');
        if (guildBossBattleResult) ids.push('guildBossBattleResult');
        return ids;
    }, [
        activeNegotiation, isSettingsModalOpen, isInventoryOpen, isMailboxOpen, isQuestsOpen,
        rewardSummary, isClaimAllSummaryOpen, isShopOpen, isActionPointQuizOpen, lastUsedItemResult,
        disassemblyResult, craftResult, synthesisResult, viewingUser, isInfoModalOpen,
        isEncyclopediaOpen, isStatAllocationModalOpen, isProfileEditModalOpen, pastRankingsInfo,
        moderatingUser, viewingItem, enhancingItem, isTowerRewardInfoOpen, isGuildEffectsModalOpen,
        isPresetModalOpen, levelUpInfo, guildBossBattleResult
    ]);

    const handleEnterWaitingRoom = (mode: GameMode) => {
        handlers.handleAction({ type: 'ENTER_WAITING_ROOM', payload: { mode } });
        const slug = SLUG_BY_GAME_MODE.get(mode);
        if (slug) {
            window.location.hash = `#/waiting/${slug}`;
        }
    };
    
    const handleViewUser = useCallback((userId: string) => {
        const userToView = onlineUsers.find(u => u.id === userId) || allUsers.find(u => u.id === userId);
        if (userToView) {
            const statusInfo = onlineUsers.find(u => u.id === userId);
            const finalUser: UserWithStatus = {
                ...userToView,
                status: statusInfo?.status || UserStatus.Online,
                mode: statusInfo?.mode,
                gameId: statusInfo?.gameId,
                spectatingGameId: statusInfo?.spectatingGameId,
                stateEnteredAt: statusInfo?.stateEnteredAt || Date.now(),
            };
            setViewingUser(finalUser);
        }
    }, [onlineUsers, allUsers]);

    const openModerationModal = useCallback((userId: string) => {
        const userToView = onlineUsers.find(u => u.id === userId) || allUsers.find(u => u.id === userId);
        if (userToView) {
            const statusInfo = onlineUsers.find(u => u.id === userId);
            const finalUser: UserWithStatus = {
                ...userToView,
                status: statusInfo?.status || UserStatus.Online,
                mode: statusInfo?.mode,
                gameId: statusInfo?.gameId,
                spectatingGameId: statusInfo?.spectatingGameId,
                stateEnteredAt: statusInfo?.stateEnteredAt || Date.now(),
            };
            setModeratingUser(finalUser);
        }
    }, [onlineUsers, allUsers]);

    const closeModerationModal = useCallback(() => setModeratingUser(null), []);
    const openEnhancingItem = useCallback((item: InventoryItem) => { setEnhancingItem(item); }, []);
    const openEnhancementFromDetail = useCallback((item: InventoryItem) => { setEnhancingItem(item); }, []);
    const openViewingItem = useCallback((item: InventoryItem, isOwnedByCurrentUser: boolean) => { setViewingItem({ item, isOwnedByCurrentUser }); }, []);
    const clearEnhancementOutcome = useCallback(() => {
        if (enhancementOutcome?.success) {
            const enhancedItem = enhancementOutcome.itemAfter;
            setViewingItem(currentItem => {
                if (currentItem && enhancedItem && currentItem.item.id === enhancedItem.id) {
                    return { ...currentItem, item: enhancedItem };
                }
                return currentItem;
            });
            setCurrentUser(prevUser => {
                if (!prevUser) return null;
                return {
                    ...prevUser,
                    inventory: prevUser.inventory.map(invItem => 
                        invItem.id === enhancedItem.id ? enhancedItem : invItem
                    ),
                };
            });
        }
        setEnhancementOutcome(null);
    }, [enhancementOutcome]);
    const closeEnhancementModal = useCallback(() => { setEnhancingItem(null); setEnhancementOutcome(null); }, []);
    const closeClaimAllSummary = useCallback(() => { setIsClaimAllSummaryOpen(false); setClaimAllSummary(null); }, []);
    const closeSynthesisResult = useCallback(() => setSynthesisResult(null), []);
    const openTowerRewardInfoModal = useCallback(() => setIsTowerRewardInfoOpen(true), []);
    const closeTowerRewardInfoModal = useCallback(() => setIsTowerRewardInfoOpen(false), []);
    const closeLevelUpModal = useCallback(() => setLevelUpInfo(null), []);
    const closeGuildBossBattleResultModal = useCallback(() => setGuildBossBattleResult(null), []);
    const setPostGameRedirect = useCallback((path: string) => { sessionStorage.setItem('postGameRedirect', path); }, []);
    const openGuildEffectsModal = useCallback(() => setIsGuildEffectsModalOpen(true), []);
    const closeGuildEffectsModal = useCallback(() => setIsGuildEffectsModalOpen(false), []);
    const openInventory = useCallback((initialTab: InventoryTab = 'all') => { setInventoryInitialTab(initialTab); setIsInventoryOpen(true); }, []);
    const openShop = useCallback((initialTab: ShopTab = 'equipment') => { setShopInitialTab(initialTab); setIsShopOpen(true); }, []);

    const handlers = {
        handleAction, handleLogout, handleEnterWaitingRoom,
        openInventory,
        openSettingsModal: () => setIsSettingsModalOpen(true),
        closeSettingsModal: () => setIsSettingsModalOpen(false),
        closeInventory: () => setIsInventoryOpen(false),
        openMailbox: () => setIsMailboxOpen(true),
        closeMailbox: () => setIsMailboxOpen(false),
        openQuests: () => setIsQuestsOpen(true),
        closeQuests: () => setIsQuestsOpen(false),
        openShop,
        closeShop: () => setIsShopOpen(false),
        openActionPointQuiz: () => setIsActionPointQuizOpen(true),
        closeActionPointQuiz: () => setIsActionPointQuizOpen(false),
        closeItemObtained: () => setLastUsedItemResult(null),
        closeDisassemblyResult: () => setDisassemblyResult(null),
        closeCraftResult: () => setCraftResult(null),
        closeSynthesisResult,
        closeRewardSummary: () => setRewardSummary(null),
        closeClaimAllSummary,
        openViewingUser: handleViewUser,
        closeViewingUser: () => setViewingUser(null),
        openInfoModal: () => setIsInfoModalOpen(true),
        closeInfoModal: () => setIsInfoModalOpen(false),
        openEncyclopedia: () => setIsEncyclopediaOpen(true),
        closeEncyclopedia: () => setIsEncyclopediaOpen(false),
        openStatAllocationModal: () => setIsStatAllocationModalOpen(true),
        closeStatAllocationModal: () => setIsStatAllocationModalOpen(false),
        openProfileEditModal: () => setIsProfileEditModalOpen(true),
        closeProfileEditModal: () => setIsProfileEditModalOpen(false),
        openPastRankings: (info: { user: UserWithStatus; mode: GameMode; }) => setPastRankingsInfo(info),
        closePastRankings: () => setPastRankingsInfo(null),
        openViewingItem,
        closeViewingItem: () => setViewingItem(null),
        openEnhancingItem,
        openEnhancementFromDetail,
        closeEnhancementModal,
        clearEnhancementOutcome,
        clearEnhancementAnimation: () => setEnhancementAnimationTarget(null),
        openModerationModal,
        closeModerationModal,
        openTowerRewardInfoModal,
        closeTowerRewardInfoModal,
        closeLevelUpModal,
        setPostGameRedirect,
        openGuildEffectsModal,
        closeGuildEffectsModal,
        closeGuildBossBattleResultModal,
        openEquipmentEffectsModal: () => setIsEquipmentEffectsModalOpen(true),
        closeEquipmentEffectsModal: () => setIsEquipmentEffectsModalOpen(false),
        openPresetModal: () => setIsPresetModalOpen(true),
        closePresetModal: () => setIsPresetModalOpen(false),
    };
    
    return {
        currentUser,
        sessionId,
        kakaoRegistrationData,
        login,
        handleLogout,
        currentRoute,
        error,
        successToast,
        showExitToast,
        settings,
        updateTheme,
        updatePanelColor,
        updateTextColor,
        resetGraphicsToDefault,
        updateSoundSetting,
        updateFeatureSetting,
        usersMap,
        userStatuses,
        liveGames,
        negotiations,
        waitingRoomChats,
        gameChats,
        adminLogs,
        gameModeAvailability,
        announcements,
        globalOverrideAnnouncement,
        announcementInterval,
        towerRankings,
        guilds,
        allUsers,
        onlineUsers,
        currentUserWithStatus,
        activeGame,
        myGuild,
        activeNegotiation,
        unreadMailCount,
        hasClaimableQuest,
        hasFullMissionReward,
        hasUnclaimedTournamentReward,
        handlers,
        isMobile,
        modals: {
            isSettingsModalOpen,
            isInventoryOpen,
            inventoryInitialTab,
            isMailboxOpen,
            isQuestsOpen,
            isShopOpen,
            shopInitialTab,
            isActionPointQuizOpen,
            lastUsedItemResult,
            disassemblyResult,
            craftResult,
            synthesisResult,
            rewardSummary,
            isClaimAllSummaryOpen,
            claimAllSummary,
            viewingUser,
            isInfoModalOpen,
            isEncyclopediaOpen,
            isStatAllocationModalOpen,
            enhancementResult,
            enhancementOutcome,
            enhancementAnimationTarget,
            pastRankingsInfo,
            enhancingItem,
            viewingItem,
            isProfileEditModalOpen,
            moderatingUser,
            isTowerRewardInfoOpen,
            levelUpInfo,
            isGuildEffectsModalOpen,
            guildBossBattleResult,
            guildDonationAnimation,
            isEquipmentEffectsModalOpen,
            isPresetModalOpen,
            activeModalIds
        }
    };
};
