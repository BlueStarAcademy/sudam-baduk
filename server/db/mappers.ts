import { createDefaultQuests, createDefaultBaseStats, createDefaultSpentStatPoints, defaultStats } from '../initialData.js';
import type { User, LiveGameSession, QuestLog, DailyQuestData, WeeklyQuestData, MonthlyQuestData, EquipmentPreset, AppSettings } from '../../types/index.js';
import { LeagueTier, Player, GameMode } from '../../types/index.js';
import { DEFAULT_GAME_SETTINGS } from '../../constants/gameSettings.js';
import { defaultSettings } from '../../constants/settings.js';

// An even safer parsing function. It handles non-string, null, undefined, empty strings, and parsing errors.
const safeParse = (data: any, defaultValue: any) => {
    // 1. Handle null/undefined input
    if (data === null || data === undefined) {
        return defaultValue;
    }
    // 2. If it's already a valid object (not a string), return it directly.
    if (typeof data === 'object') {
        return data;
    }
    // 3. Handle non-string primitives that can't be parsed
    if (typeof data !== 'string') {
        return defaultValue;
    }
    // 4. Handle empty strings
    if (data.trim() === '') {
        return defaultValue;
    }
    // 5. Try to parse
    try {
        const parsed = JSON.parse(data);
        // 6. Ensure parsed value is not null, as `JSON.parse("null")` is valid.
        if (parsed === null) {
            return defaultValue;
        }
        return parsed;
    } catch (e) {
        return defaultValue;
    }
};


// A helper to ensure a parsed value is an object before merging.
const ensureObject = (value: any, defaultValue: any = {}) => {
    return (typeof value === 'object' && value !== null && !Array.isArray(value)) ? value : defaultValue;
};

// A helper to ensure a parsed value is an array before merging.
const ensureArray = (value: any, defaultValue: any = []) => {
    return Array.isArray(value) ? value : defaultValue;
};


export const rowToUser = (row: any): User | null => {
    if (!row) return null;
    try {
        const defaultQuests = createDefaultQuests();
        const questsFromDb = ensureObject(safeParse(row.quests, {}));
        
        const dailyFromDb = ensureObject(questsFromDb.daily);
        const weeklyFromDb = ensureObject(questsFromDb.weekly);
        const monthlyFromDb = ensureObject(questsFromDb.monthly);

        const quests: QuestLog = {
            daily: { ...defaultQuests.daily, ...dailyFromDb, quests: ensureArray(dailyFromDb.quests), claimedMilestones: ensureArray(dailyFromDb.claimedMilestones, [false,false,false,false,false]) },
            weekly: { ...defaultQuests.weekly, ...weeklyFromDb, quests: ensureArray(weeklyFromDb.quests), claimedMilestones: ensureArray(weeklyFromDb.claimedMilestones, [false,false,false,false,false]) },
            monthly: { ...defaultQuests.monthly, ...monthlyFromDb, quests: ensureArray(monthlyFromDb.quests), claimedMilestones: ensureArray(monthlyFromDb.claimedMilestones, [false,false,false,false,false]) },
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
            graphics: { ...defaultSettings.graphics, ...ensureObject(userAppSettingsFromDb.graphics) },
            sound: { ...defaultSettings.sound, ...ensureObject(userAppSettingsFromDb.sound) },
            features: { ...defaultSettings.features, ...ensureObject(userAppSettingsFromDb.features) },
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


        const user: User = {
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
            inventorySlots: row.inventorySlots ?? 40,
            chatBanUntil: row.chatBanUntil ?? undefined,
            connectionBanUntil: row.connectionBanUntil ?? undefined,
            lastActionPointUpdate: row.lastActionPointUpdate ?? 0,
            actionPointPurchasesToday: row.actionPointPurchasesToday ?? 0,
            lastActionPointPurchaseDate: row.lastActionPointPurchaseDate ?? 0,
            actionPointQuizzesToday: row.actionPointQuizzesToday ?? 0,
            lastActionPointQuizDate: row.lastActionPointQuizDate ?? 0,
            dailyShopPurchases: ensureObject(safeParse(row.dailyShopPurchases, {})),
            avatarId: row.avatarId || 'profile_1',
            borderId: row.borderId || 'default',
            ownedBorders: ensureArray(safeParse(row.ownedBorders, ['default', 'simple_black'])),
            tournamentScore: row.tournamentScore ?? 0,
            league: row.league || LeagueTier.Sprout,
            mannerMasteryApplied: !!row.mannerMasteryApplied,
            mannerScore: row.mannerScore ?? 200,
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
            lastNeighborhoodPlayedDate: row.lastNeighborhoodPlayedDate ?? undefined,
            neighborhoodRewardClaimed: !!row.neighborhoodRewardClaimed,
            lastNeighborhoodTournament: ensureObject(safeParse(row.lastNeighborhoodTournament, null), null),
            lastNationalPlayedDate: row.lastNationalPlayedDate ?? undefined,
            nationalRewardClaimed: !!row.nationalRewardClaimed,
            lastNationalTournament: ensureObject(safeParse(row.lastNationalTournament, null), null),
            lastWorldPlayedDate: row.lastWorldPlayedDate ?? undefined,
            worldRewardClaimed: !!row.worldRewardClaimed,
            lastWorldTournament: ensureObject(safeParse(row.lastWorldTournament, null), null),
            dailyChampionshipMatchesPlayed: row.dailyChampionshipMatchesPlayed ?? 0,
            lastChampionshipMatchDate: row.lastChampionshipMatchDate ?? 0,
            weeklyCompetitors: ensureArray(safeParse(row.weeklyCompetitors, [])),
            lastWeeklyCompetitorsUpdate: row.lastWeeklyCompetitorsUpdate ?? 0,
            lastLeagueUpdate: row.lastLeagueUpdate ?? 0,
            monthlyGoldBuffExpiresAt: row.monthlyGoldBuffExpiresAt ?? 0,
            mbti: row.mbti ?? null,
            isMbtiPublic: !!row.isMbtiPublic,
            singlePlayerProgress: row.singlePlayerProgress ?? 0,
            bonusStatPoints: row.bonusStatPoints ?? 0,
            singlePlayerMissions: ensureObject(safeParse(row.singlePlayerMissions, {})),
            towerProgress: { highestFloor: 0, lastClearTimestamp: 0, ...towerProgressFromDb },
            claimedFirstClearRewards: ensureArray(safeParse(row.claimedFirstClearRewards, [])),
            currencyLogs: ensureArray(safeParse(row.currencyLogs, [])),
            guildId: row.guildId ?? null,
            guildApplications: ensureArray(safeParse(row.guildApplications, [])),
            guildLeaveCooldownUntil: row.guildLeaveCooldownUntil ?? 0,
            guildCoins: row.guildCoins ?? 0,
            guildBossAttempts: row.guildBossAttempts ?? 0,
            lastGuildBossAttemptDate: row.lastGuildBossAttemptDate ?? 0,
            lastLoginAt: row.lastLoginAt ?? 0,
            dailyDonations: { gold: 0, diamond: 0, date: 0, ...dailyDonationsFromDb },
            dailyMissionContribution: { amount: 0, date: 0, ...dailyMissionContributionFromDb },
            guildShopPurchases: ensureObject(safeParse(row.guildShopPurchases, {})),
            appSettings,
        };
        return user;
    } catch (e) {
        console.error(`[FATAL] Unrecoverable error processing user data for row ID ${row?.id}:`, e);
        return null;
    }
};

export const rowToGame = (row: any): LiveGameSession | null => {
    if (!row) return null;
    try {
        const player1Object = safeParse(row.player1, null);
        const player2Object = safeParse(row.player2, null);

        // This check is critical. If player data in the game row is corrupt, the whole game is invalid.
        if (!player1Object || typeof player1Object !== 'object' || !player2Object || typeof player2Object !== 'object') {
            console.error(`[DB Mapper] Corrupt or missing player data object for game ID ${row.id}. Discarding game record.`);
            return null;
        }

        const player1 = rowToUser(player1Object);
        const player2 = rowToUser(player2Object);
        
        // If the recursive mapping fails (due to deeper corruption), also discard.
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
            currentPlayer: row.currentPlayer,
            boardState: ensureArray(safeParse(row.boardState, [])),
            moveHistory: ensureArray(safeParse(row.moveHistory, [])),
            captures: ensureObject(safeParse(row.captures, { [Player.Black]: 0, [Player.White]: 0, [Player.None]: 0 })),
            baseStoneCaptures: ensureObject(safeParse(row.baseStoneCaptures, { [Player.Black]: 0, [Player.White]: 0, [Player.None]: 0 })),
            hiddenStoneCaptures: ensureObject(safeParse(row.hiddenStoneCaptures, { [Player.Black]: 0, [Player.White]: 0, [Player.None]: 0 })),
            winner: row.winner ?? null,
            winReason: row.winReason ?? null,
            finalScores: ensureObject(safeParse(row.finalScores, null), null),
            createdAt: row.createdAt,
            lastMove: ensureObject(safeParse(row.lastMove, null), null),
            lastTurnStones: ensureArray(safeParse(row.lastTurnStones, null), null),
            stonesPlacedThisTurn: ensureArray(safeParse(row.stonesPlacedThisTurn, null), null),
            passCount: row.passCount ?? 0,
            koInfo: ensureObject(safeParse(row.koInfo, null), null),
            winningLine: ensureArray(safeParse(row.winningLine, null), null),
            statsUpdated: !!row.statsUpdated,
            summary: ensureObject(safeParse(row.summary, undefined), undefined),
            animation: ensureObject(safeParse(row.animation, undefined), undefined),
            blackTimeLeft: row.blackTimeLeft,
            whiteTimeLeft: row.whiteTimeLeft,
            blackByoyomiPeriodsLeft: row.blackByoyomiPeriodsLeft,
            whiteByoyomiPeriodsLeft: row.whiteByoyomiPeriodsLeft,
            turnDeadline: row.turnDeadline ?? undefined,
            turnStartTime: row.turnStartTime ?? undefined,
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
            guessDeadline: row.guessDeadline ?? undefined,
            bids: ensureObject(safeParse(row.bids, undefined), undefined),
            biddingRound: row.biddingRound ?? undefined,
            captureBidDeadline: row.captureBidDeadline ?? undefined,
            effectiveCaptureTargets: ensureObject(safeParse(row.effectiveCaptureTargets, undefined), undefined),
            baseStones: ensureArray(safeParse(row.baseStones, undefined), undefined),
            baseStones_p1: ensureArray(safeParse(row.baseStones_p1, undefined), undefined),
            baseStones_p2: ensureArray(safeParse(row.baseStones_p2, undefined), undefined),
            basePlacementDeadline: row.basePlacementDeadline ?? undefined,
            komiBids: ensureObject(safeParse(row.komiBids, undefined), undefined),
            komiBiddingDeadline: row.komiBiddingDeadline ?? undefined,
            komiBiddingRound: row.komiBiddingRound ?? undefined,
            komiBidRevealProcessed: !!row.komiBidRevealProcessed,
            finalKomi: row.finalKomi ?? undefined,
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
            pendingAiMove: undefined, // This is transient
            missiles_p1: row.missiles_p1 ?? undefined,
            missiles_p2: row.missiles_p2 ?? undefined,
            missileUsedThisTurn: !!row.missileUsedThisTurn,
            rpsState: ensureObject(safeParse(row.rpsState, null), null),
            rpsRound: row.rpsRound ?? undefined,
            dice: ensureObject(safeParse(row.dice, null), null),
            stonesToPlace: row.stonesToPlace ?? undefined,
            turnOrderRolls: ensureObject(safeParse(row.turnOrderRolls, null), null),
            turnOrderRollReady: ensureObject(safeParse(row.turnOrderRollReady, null), null),
            turnOrderRollResult: row.turnOrderRollResult ?? undefined,
            turnOrderRollTies: row.turnOrderRollTies ?? undefined,
            turnOrderRollDeadline: row.turnOrderRollDeadline ?? undefined,
            turnOrderAnimationEndTime: row.turnOrderAnimationEndTime ?? undefined,
            turnChoiceDeadline: row.turnChoiceDeadline ?? undefined,
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
            thiefCapturesThisRound: row.thiefCapturesThisRound ?? undefined,
            alkkagiStones: ensureArray(safeParse(row.alkkagiStones, null), null),
            alkkagiStones_p1: ensureArray(safeParse(row.alkkagiStones_p1, null), null),
            alkkagiStones_p2: ensureArray(safeParse(row.alkkagiStones_p2, null), null),
            alkkagiTurnDeadline: row.alkkagiTurnDeadline ?? undefined,
            alkkagiPlacementDeadline: row.alkkagiPlacementDeadline ?? undefined,
            alkkagiItemUses: ensureObject(safeParse(row.alkkagiItemUses, {})),
            activeAlkkagiItems: ensureObject(safeParse(row.activeAlkkagiItems, {})),
            alkkagiRound: row.alkkagiRound ?? undefined,
            alkkagiRefillsUsed: ensureObject(safeParse(row.alkkagiRefillsUsed, {})),
            alkkagiStonesPlacedThisRound: ensureObject(safeParse(row.alkkagiStonesPlacedThisRound, {})),
            alkkagiRoundSummary: ensureObject(safeParse(row.alkkagiRoundSummary, null), null),
            curlingStones: ensureArray(safeParse(row.curlingStones, null), null),
            curlingTurnDeadline: row.curlingTurnDeadline ?? undefined,
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
            pausedTurnTimeLeft: row.pausedTurnTimeLeft ?? undefined,
            itemUseDeadline: row.itemUseDeadline ?? undefined,
            lastTimeoutPlayerId: row.lastTimeoutPlayerId ?? undefined,
            lastTimeoutPlayerIdClearTime: row.lastTimeoutPlayerIdClearTime ?? undefined,
            revealAnimationEndTime: row.revealAnimationEndTime ?? undefined,
            revealEndTime: row.revealEndTime ?? undefined,
            isAiGame: !!row.isAiGame,
            aiTurnStartTime: row.aiTurnStartTime ?? undefined,
            mythicBonuses: ensureObject(safeParse(row.mythicBonuses, {})),
            lastPlayfulGoldCheck: ensureObject(safeParse(row.lastPlayfulGoldCheck, {})),
            pendingSystemMessages: ensureArray(safeParse(row.pendingSystemMessages, undefined), undefined),
            isSinglePlayer: !!row.isSinglePlayer,
            stageId: row.stageId ?? undefined,
            blackPatternStones: ensureArray(safeParse(row.blackPatternStones, null), null),
            whitePatternStones: ensureArray(safeParse(row.whitePatternStones, null), null),
            singlePlayerPlacementRefreshesUsed: row.singlePlayerPlacementRefreshesUsed ?? 0,
            towerChallengePlacementRefreshesUsed: row.towerChallengePlacementRefreshesUsed ?? 0,
            towerAddStonesUsed: row.towerAddStonesUsed ?? 0,
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