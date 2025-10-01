import { User, LiveGameSession } from '../types/index.js';
import { createDefaultQuests, createDefaultBaseStats, createDefaultSpentStatPoints, defaultStats } from '../server/initialData.js';
import { LeagueTier, Player } from '../types/index.js';
import { DEFAULT_GAME_SETTINGS } from '../constants/gameSettings.js';
import { defaultSettings } from '../constants/settings.js';

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

export const rowToUser = (row: any): User | null => {
    if (!row) return null;
    try {
        const defaultQuests = createDefaultQuests();
        const questsFromDb = ensureObject(safeParse(row.quests, {}));
        const dailyFromDb = ensureObject(questsFromDb.daily);
        const weeklyFromDb = ensureObject(questsFromDb.weekly);
        const monthlyFromDb = ensureObject(questsFromDb.monthly);

        const quests = {
            daily: { ...defaultQuests.daily, ...dailyFromDb, quests: ensureArray(dailyFromDb.quests), claimedMilestones: ensureArray(dailyFromDb.claimedMilestones, [false,false,false,false,false]) },
            weekly: { ...defaultQuests.weekly, ...weeklyFromDb, quests: ensureArray(weeklyFromDb.quests), claimedMilestones: ensureArray(weeklyFromDb.claimedMilestones, [false,false,false,false,false]) },
            monthly: { ...defaultQuests.monthly, ...monthlyFromDb, quests: ensureArray(monthlyFromDb.quests), claimedMilestones: ensureArray(monthlyFromDb.claimedMilestones, [false,false,false,false,false]) },
        };
        
        const actionPointsFromDb = ensureObject(safeParse(row.actionPoints, { current: 30, max: 30 }));
        
        const finalStats = JSON.parse(JSON.stringify(defaultStats));
        const statsFromDb = ensureObject(safeParse(row.stats, {}));
        for (const mode of Object.keys(finalStats)) {
            if (statsFromDb[mode] && typeof statsFromDb[mode] === 'object') {
                Object.assign(finalStats[mode], statsFromDb[mode]);
            }
        }

        return {
            id: row.id,
            username: row.username,
            nickname: row.nickname,
            isAdmin: !!row.isAdmin,
            strategyLevel: row.strategyLevel ?? 1,
            strategyXp: row.strategyXp ?? 0,
            playfulLevel: row.playfulLevel ?? 1,
            playfulXp: row.playfulXp ?? 0,
            gold: row.gold ?? 0,
            diamonds: row.diamonds ?? 0,
            inventory: ensureArray(safeParse(row.inventory, [])),
            equipment: ensureObject(safeParse(row.equipment, {})),
            stats: finalStats,
            inventorySlots: row.inventorySlots ?? 40,
            actionPoints: {
                current: typeof actionPointsFromDb.current === 'number' ? actionPointsFromDb.current : 30,
                max: typeof actionPointsFromDb.max === 'number' ? actionPointsFromDb.max : 30,
            },
            lastActionPointUpdate: row.lastActionPointUpdate ?? 0,
            mannerScore: row.mannerScore ?? 200,
            mail: ensureArray(safeParse(row.mail, [])),
            quests: quests,
            chatBanUntil: row.chatBanUntil,
            avatarId: row.avatarId || 'profile_1',
            borderId: row.borderId || 'default',
            previousSeasonTier: row.previousSeasonTier,
            seasonHistory: ensureObject(safeParse(row.seasonHistory, {})),
            baseStats: { ...createDefaultBaseStats(), ...ensureObject(safeParse(row.baseStats, {})) },
            spentStatPoints: { ...createDefaultSpentStatPoints(), ...ensureObject(safeParse(row.spentStatPoints, {})) },
            actionPointPurchasesToday: row.actionPointPurchasesToday ?? 0,
            lastActionPointPurchaseDate: row.lastActionPointPurchaseDate ?? 0,
            dailyShopPurchases: ensureObject(safeParse(row.dailyShopPurchases, {})),
            tournamentScore: row.tournamentScore ?? 0,
            league: row.league || LeagueTier.Sprout,
            mannerMasteryApplied: !!row.mannerMasteryApplied,
            pendingPenaltyNotification: ensureObject(safeParse(row.pendingPenaltyNotification, null), null),
            lastNeighborhoodPlayedDate: row.lastNeighborhoodPlayedDate,
            neighborhoodRewardClaimed: !!row.neighborhoodRewardClaimed,
            lastNeighborhoodTournament: ensureObject(safeParse(row.lastNeighborhoodTournament, null), null),
            lastNationalPlayedDate: row.lastNationalPlayedDate,
            nationalRewardClaimed: !!row.nationalRewardClaimed,
            lastNationalTournament: ensureObject(safeParse(row.lastNationalTournament, null), null),
            lastWorldPlayedDate: row.lastWorldPlayedDate,
            worldRewardClaimed: !!row.worldRewardClaimed,
            lastWorldTournament: ensureObject(safeParse(row.lastWorldTournament, null), null),
            weeklyCompetitors: ensureArray(safeParse(row.weeklyCompetitors, [])),
            lastWeeklyCompetitorsUpdate: row.lastWeeklyCompetitorsUpdate ?? 0,
            lastLeagueUpdate: row.lastLeagueUpdate ?? 0,
            ownedBorders: ensureArray(safeParse(row.ownedBorders, ['default', 'simple_black'])),
            connectionBanUntil: row.connectionBanUntil,
            mbti: row.mbti,
            isMbtiPublic: !!row.isMbtiPublic,
            singlePlayerProgress: row.singlePlayerProgress ?? 0,
            bonusStatPoints: row.bonusStatPoints ?? 0,
            singlePlayerMissions: ensureObject(safeParse(row.singlePlayerMissions, {})),
            towerProgress: ensureObject(safeParse(row.towerProgress, { highestFloor: 0, lastClearTimestamp: 0 })),
            claimedFirstClearRewards: ensureArray(safeParse(row.claimedFirstClearRewards, [])),
            actionPointQuizzesToday: row.actionPointQuizzesToday ?? 0,
            lastActionPointQuizDate: row.lastActionPointQuizDate ?? 0,
            currencyLogs: ensureArray(safeParse(row.currencyLogs, [])),
            guildId: row.guildId,
            guildApplications: ensureArray(safeParse(row.guildApplications, [])),
            guildLeaveCooldownUntil: row.guildLeaveCooldownUntil ?? 0,
            guildCoins: row.guildCoins ?? 0,
            guildBossAttempts: row.guildBossAttempts ?? 0,
            lastGuildBossAttemptDate: row.lastGuildBossAttemptDate ?? 0,
            lastLoginAt: row.lastLoginAt ?? 0,
            dailyDonations: ensureObject(safeParse(row.dailyDonations, { gold: 0, diamond: 0, date: 0 })),
            guildShopPurchases: ensureObject(safeParse(row.guildShopPurchases, {})),
            monthlyGoldBuffExpiresAt: row.monthlyGoldBuffExpiresAt ?? 0,
            dailyMissionContribution: ensureObject(safeParse(row.dailyMissionContribution, { amount: 0, date: 0 })),
            equipmentPresets: ensureArray(safeParse(row.equipmentPresets, [])),
            appSettings: { ...defaultSettings, ...ensureObject(safeParse(row.appSettings, {})) },
            dailyChampionshipMatchesPlayed: row.dailyChampionshipMatchesPlayed ?? 0,
            lastChampionshipMatchDate: row.lastChampionshipMatchDate ?? 0,
        };
    } catch (e) {
        console.error(`Failed to map user row: ${row?.id}`, e);
        return null;
    }
};

export const rowToGame = (row: any): LiveGameSession | null => {
    if (!row) return null;
    try {
        const player1 = rowToUser(safeParse(row.player1, null));
        const player2 = rowToUser(safeParse(row.player2, null));
        if (!player1 || !player2) {
            console.error(`Could not parse player data for game ${row.id}`);
            return null;
        }

        return {
            ...row,
            player1,
            player2,
            currentPlayer: parseInt(row.currentPlayer, 10),
            winner: row.winner ? parseInt(row.winner, 10) : null,
            boardState: safeParse(row.boardState, []),
            moveHistory: safeParse(row.moveHistory, []),
            captures: safeParse(row.captures, { [Player.Black]: 0, [Player.White]: 0, [Player.None]: 0 }),
            baseStoneCaptures: safeParse(row.baseStoneCaptures, { [Player.Black]: 0, [Player.White]: 0, [Player.None]: 0 }),
            hiddenStoneCaptures: safeParse(row.hiddenStoneCaptures, { [Player.Black]: 0, [Player.White]: 0, [Player.None]: 0 }),
            finalScores: safeParse(row.finalScores, null),
            lastMove: safeParse(row.lastMove, null),
            koInfo: safeParse(row.koInfo, null),
            winningLine: safeParse(row.winningLine, null),
            summary: safeParse(row.summary, undefined),
            animation: safeParse(row.animation, undefined),
            disconnectionState: safeParse(row.disconnectionState, null),
            disconnectionCounts: safeParse(row.disconnectionCounts, {}),
            noContestInitiatorIds: safeParse(row.noContestInitiatorIds, undefined),
            currentActionButtons: safeParse(row.currentActionButtons, {}),
            actionButtonCooldownDeadline: safeParse(row.actionButtonCooldownDeadline, undefined),
            actionButtonUses: safeParse(row.actionButtonUses, undefined),
            actionButtonUsedThisCycle: safeParse(row.actionButtonUsedThisCycle, undefined),
            mannerScoreChanges: safeParse(row.mannerScoreChanges, undefined),
            nigiri: safeParse(row.nigiri, undefined),
            bids: safeParse(row.bids, undefined),
            effectiveCaptureTargets: safeParse(row.effectiveCaptureTargets, undefined),
            baseStones: safeParse(row.baseStones, undefined),
            baseStones_p1: safeParse(row.baseStones_p1, undefined),
            baseStones_p2: safeParse(row.baseStones_p2, undefined),
            komiBids: safeParse(row.komiBids, undefined),
            hiddenMoves: safeParse(row.hiddenMoves, undefined),
            revealedStones: safeParse(row.revealedStones, {}),
            newlyRevealed: safeParse(row.newlyRevealed, undefined),
            justCaptured: safeParse(row.justCaptured, undefined),
            pendingCapture: safeParse(row.pendingCapture, undefined),
            permanentlyRevealedStones: safeParse(row.permanentlyRevealedStones, undefined),
            rpsState: safeParse(row.rpsState, null),
            dice: safeParse(row.dice, null),
            turnOrderRolls: safeParse(row.turnOrderRolls, null),
            turnOrderRollReady: safeParse(row.turnOrderRollReady, null),
            turnChoices: safeParse(row.turnChoices, null),
            diceRollHistory: safeParse(row.diceRollHistory, null),
            diceRoundSummary: safeParse(row.diceRoundSummary, null),
            lastWhiteGroupInfo: safeParse(row.lastWhiteGroupInfo, null),
            diceGoItemUses: safeParse(row.diceGoItemUses, {}),
            diceGoBonuses: safeParse(row.diceGoBonuses, {}),
            diceLastCaptureStones: safeParse(row.diceLastCaptureStones, null),
            scores: safeParse(row.scores, {}),
            roleChoices: safeParse(row.roleChoices, {}),
            thiefRoundSummary: safeParse(row.thiefRoundSummary, null),
            thiefDiceRollHistory: safeParse(row.thiefDiceRollHistory, null),
            analysisResult: safeParse(row.analysisResult, null),
            previousAnalysisResult: safeParse(row.previousAnalysisResult, null),
            settings: { ...DEFAULT_GAME_SETTINGS, ...safeParse(row.settings, {}) },
            canRequestNoContest: safeParse(row.canRequestNoContest, undefined),
            mythicBonuses: safeParse(row.mythicBonuses, {}),
            lastPlayfulGoldCheck: safeParse(row.lastPlayfulGoldCheck, {}),
            pendingSystemMessages: safeParse(row.pendingSystemMessages, undefined),
            blackPatternStones: safeParse(row.blackPatternStones, null),
            whitePatternStones: safeParse(row.whitePatternStones, null),
            alkkagiStones: safeParse(row.alkkagiStones, null),
            alkkagiStones_p1: safeParse(row.alkkagiStones_p1, null),
            alkkagiStones_p2: safeParse(row.alkkagiStones_p2, null),
            alkkagiItemUses: safeParse(row.alkkagiItemUses, {}),
            activeAlkkagiItems: safeParse(row.activeAlkkagiItems, {}),
            alkkagiRefillsUsed: safeParse(row.alkkagiRefillsUsed, {}),
            alkkagiStonesPlacedThisRound: safeParse(row.alkkagiStonesPlacedThisRound, {}),
            alkkagiRoundSummary: safeParse(row.alkkagiRoundSummary, null),
            curlingStones: safeParse(row.curlingStones, null),
            curlingScores: safeParse(row.curlingScores, {}),
            curlingRoundSummary: safeParse(row.curlingRoundSummary, null),
            curlingItemUses: safeParse(row.curlingItemUses, {}),
            activeCurlingItems: safeParse(row.activeCurlingItems, {}),
            stonesThrownThisRound: safeParse(row.stonesThrownThisRound, {}),
            preGameConfirmations: safeParse(row.preGameConfirmations, null),
            roundEndConfirmations: safeParse(row.roundEndConfirmations, null),
            rematchRejectionCount: safeParse(row.rematchRejectionCount, null),
            timeoutFouls: safeParse(row.timeoutFouls, {}),
            curlingStonesLostToFoul: safeParse(row.curlingStonesLostToFoul, {}),
            foulInfo: safeParse(row.foulInfo, null),
            towerItemPurchases: safeParse(row.towerItemPurchases, {}),
        };
    } catch(e) {
        console.error(`Failed to map game row: ${row?.id}`, e);
        return null;
    }
};