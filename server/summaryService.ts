
import { LiveGameSession, Player, WinReason, GameSummary, User, StatChange, GameMode, GameStatus, Guild, QuestReward, InventoryItem, SinglePlayerStageInfo, SpecialStat } from '../types/index.js';
import * as db from './db.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, SINGLE_PLAYER_STAGES, TOWER_STAGES } from '../constants/index.js';
import { getGoLogic } from './goLogic.js';
import { updateQuestProgress } from './questService.js';
import * as currencyService from './currencyService.js';
import * as guildService from './guildService.js';
import { getMannerRank, getMannerScore } from './services/manner.js';
import { calculateUserEffects } from './services/effectService.js';
import { createItemInstancesFromReward, addItemsToInventory } from '../utils/inventoryUtils.js';
import { analyzeGame } from './kataGoService.js';
import { gnuGoServiceManager } from './services/gnuGoService.js';

const getXpForLevel = (level: number) => level * 100;

const calculateLevelUp = (level: number, xp: number, xpGain: number) => {
    let newLevel = level;
    let newXp = xp + xpGain;
    let xpForNext = getXpForLevel(newLevel);
    while (newXp >= xpForNext) {
        newXp -= xpForNext;
        newLevel++;
        xpForNext = getXpForLevel(newLevel);
    }
    return { newLevel, newXp };
};

const processAiGameSummary = async (game: LiveGameSession) => {
    if (!game.isAiGame || game.statsUpdated) return;

    const humanPlayer = game.player1;
    const user = await db.getUser(humanPlayer.id);
    if (!user) return;
    
    let summaryForUser: GameSummary;
    
    // Logic for SP and Tower
    if (game.isSinglePlayer || game.isTowerChallenge) {
        const isWinner = game.winner === Player.Black; // Human is always black in SP/Tower

        const stageList = game.isTowerChallenge ? TOWER_STAGES : SINGLE_PLAYER_STAGES;
        const stage = stageList.find(s => s.id === game.stageId);
        if (!stage) {
            console.error(`[AI Summary] Could not find stage info for stageId: ${game.stageId}`);
            game.summary = {}; // Ensure summary is not undefined
            game.statsUpdated = true;
            return;
        }
        
        const isScoringNeeded = game.isTowerChallenge && (game.floor ?? 0) >= 21;
        if (isScoringNeeded && !game.analysisResult) {
            try {
                const analysis = await analyzeGame(game);
                game.analysisResult = { 'system': analysis };
                const { black: blackScore, white: whiteScore } = analysis.areaScore;
                game.finalScores = { black: blackScore, white: whiteScore };
            } catch (e) {
                console.error(`[Scoring] KataGo analysis failed for Tower game ${game.id}.`, e);
            }
        }
        
        const initialStrategyXp = user.strategyXp;
        const initialStrategyLevel = user.strategyLevel;
        const initialMannerScore = user.mannerScore;

        if (isWinner) {
            const isFirstClear = !user.claimedFirstClearRewards?.includes(stage.id);
            const reward = isFirstClear ? stage.rewards.firstClear : stage.rewards.repeatClear;
            const rewardReason = `${stage.name} ${isFirstClear ? '최초' : '반복'} 클리어 보상`;

            const goldChange = reward.gold || 0;
            const xpChange = reward.exp?.amount || 0;
            const addedItems = reward.items ? createItemInstancesFromReward(reward.items) : [];

            if (goldChange > 0) currencyService.grantGold(user, goldChange, rewardReason);
            if (reward.diamonds) currencyService.grantDiamonds(user, reward.diamonds, rewardReason);
            if (reward.actionPoints) user.actionPoints.current = Math.min(user.actionPoints.max, user.actionPoints.current + reward.actionPoints);

            if (addedItems.length > 0) {
                addItemsToInventory(user.inventory, user.inventorySlots, addedItems);
            }

            if (reward.bonus && reward.bonus.startsWith('스탯+')) {
                const points = parseInt(reward.bonus.replace('스탯+', ''), 10);
                if (!isNaN(points)) {
                    user.bonusStatPoints = (user.bonusStatPoints || 0) + points;
                }
            }
            
            const { newLevel, newXp } = calculateLevelUp(initialStrategyLevel, initialStrategyXp, xpChange);
            user.strategyLevel = newLevel;
            user.strategyXp = newXp;

            if (isFirstClear) {
                if (!user.claimedFirstClearRewards) user.claimedFirstClearRewards = [];
                user.claimedFirstClearRewards.push(stage.id);

                if (game.isSinglePlayer) {
                    const stageIndex = SINGLE_PLAYER_STAGES.findIndex(s => s.id === stage.id);
                    if (stageIndex !== -1) {
                        user.singlePlayerProgress = Math.max(user.singlePlayerProgress ?? 0, stageIndex + 1);
                    }
                } else if (game.isTowerChallenge) {
                    if (!user.towerProgress) user.towerProgress = { highestFloor: 0, lastClearTimestamp: 0 };
                    user.towerProgress.highestFloor = Math.max(user.towerProgress.highestFloor, stage.floor!);
                    user.towerProgress.lastClearTimestamp = Date.now();
                    if (user.guildId) {
                        if (stage.floor === 50) await guildService.updateGuildMissionProgress(user.guildId, 'towerFloor50Conquerors', user.id);
                        if (stage.floor === 100) await guildService.updateGuildMissionProgress(user.guildId, 'towerFloor100Conquerors', user.id);
                    }
                }
            }

            summaryForUser = {
                xp: { initial: initialStrategyXp, final: newXp, change: xpChange },
                level: { 
                    initial: initialStrategyLevel, 
                    final: newLevel, 
                    progress: { initial: initialStrategyXp, final: newXp, max: getXpForLevel(newLevel > initialStrategyLevel ? initialStrategyLevel : newLevel) }
                },
                rating: { initial: 0, final: 0, change: 0 },
                gold: goldChange,
                items: addedItems,
                manner: { initial: initialMannerScore, final: user.mannerScore, change: 0 },
            };
        } else { // Loser
            summaryForUser = {
                xp: { initial: initialStrategyXp, final: initialStrategyXp, change: 0 },
                level: { 
                    initial: initialStrategyLevel, 
                    final: initialStrategyLevel,
                    progress: { initial: initialStrategyXp, final: initialStrategyXp, max: getXpForLevel(initialStrategyLevel) }
                },
                rating: { initial: 0, final: 0, change: 0 },
                gold: 0,
                items: [],
                manner: { initial: initialMannerScore, final: user.mannerScore, change: 0 },
            };
        }
    
        game.summary = { [user.id]: summaryForUser };
        game.statsUpdated = true;
    
        await db.updateUser(user);
        return;
    }
    
    // Standard AI games from waiting room
    const guilds = await db.getKV<Record<string, Guild>>('guilds') || {};
    const userGuild = user.guildId ? (guilds[user.guildId] ?? null) : null;
    
    const humanIsBlack = game.blackPlayerId === user.id;
    const isWinner = (game.winner === Player.Black && humanIsBlack) || (game.winner === Player.White && !humanIsBlack);
    
    const isPlayful = PLAYFUL_GAME_MODES.some(m => m.mode === game.mode);
    const xpChange = isWinner ? 25 : 10;
    
    const currentLevel = isPlayful ? user.playfulLevel : user.strategyLevel;
    const currentXp = isPlayful ? user.playfulXp : user.strategyXp;
    
    const { newLevel, newXp } = calculateLevelUp(currentLevel, currentXp, xpChange);

    const xpSummary: StatChange = { initial: currentXp, final: newXp, change: xpChange };
    const levelSummary = { initial: currentLevel, final: newLevel, progress: { initial: currentXp, final: newXp, max: getXpForLevel(currentLevel) } };

    if(isPlayful) {
        user.playfulXp = newXp;
        user.playfulLevel = newLevel;
    } else {
        user.strategyXp = newXp;
        user.strategyLevel = newLevel;
    }

    const rating = user.stats[game.mode]?.rankingScore || 1200;
    const mannerScore = getMannerScore(user);

    const effects = calculateUserEffects(user, userGuild);
    // FIX: Property 'goldBonusPercent' does not exist on type 'CalculatedEffects'.
    const itemGoldBonus = effects.specialStatBonuses[SpecialStat.GoldBonus]?.percent || 0;
    const modeSpecificBonus = isPlayful ? effects.playfulGoldBonusPercent : effects.strategicGoldBonusPercent;
    const goldBonus = 1 + ((itemGoldBonus + modeSpecificBonus) / 100);
    const goldReward = Math.floor((isWinner ? 20 : 5) * goldBonus);
    currencyService.grantGold(user, goldReward, `${game.mode} AI 대국 보상`);
    
    game.summary = {
        [user.id]: {
            xp: xpSummary,
            level: levelSummary,
            rating: { initial: rating, final: rating, change: 0 },
            gold: goldReward,
            manner: { initial: mannerScore, final: mannerScore, change: 0 },
            overallRecord: { wins: (user.stats[game.mode]?.wins || 0) + (isWinner ? 1 : 0), losses: (user.stats[game.mode]?.losses || 0) + (isWinner ? 0 : 1) }
        }
    };
    
    game.statsUpdated = true;
    
    if (user.stats[game.mode]) {
        if (isWinner) {
            user.stats[game.mode].wins++;
        } else {
            user.stats[game.mode].losses++;
        }
    }

    await db.updateUser(user);
};


export const processGameSummary = async (game: LiveGameSession) => {
    const { player1, player2, winner, mode, gameStatus } = game;
    if (!player1 || !player2 || game.statsUpdated) return;

    const p1 = await db.getUser(player1.id);
    const p2 = await db.getUser(player2.id);
    if (!p1 || !p2) return;

    const summary: Record<string, GameSummary> = {};

    const isPlayful = PLAYFUL_GAME_MODES.some(m => m.mode === mode);
    const isNoContest = gameStatus === GameStatus.NoContest;
    
    const guilds = await db.getKV<Record<string, Guild>>('guilds') || {};

    [p1, p2].forEach(user => {
        const isWinner = (winner === Player.Black && user.id === game.blackPlayerId) || (winner === Player.White && user.id === game.whitePlayerId);
        
        const xpChange = isNoContest ? 0 : isWinner ? 50 : 20;
        
        const currentLevel = isPlayful ? user.playfulLevel : user.strategyLevel;
        const currentXp = isPlayful ? user.playfulXp : user.strategyXp;
        
        const { newLevel, newXp } = calculateLevelUp(currentLevel, currentXp, xpChange);

        const xpSummary: StatChange = { initial: currentXp, final: newXp, change: xpChange };
        const levelSummary = { initial: currentLevel, final: newLevel, progress: { initial: currentXp, final: newXp, max: getXpForLevel(currentLevel) } };

        if(isPlayful) {
            user.playfulXp = newXp;
            user.playfulLevel = newLevel;
        } else {
            user.strategyXp = newXp;
            user.strategyLevel = newLevel;
        }

        const rating = user.stats[mode]?.rankingScore || 1200;
        const ratingChange = isNoContest ? 0 : isWinner ? 10 : -10;
        const newRating = rating + ratingChange;
        if(user.stats[mode]) user.stats[mode].rankingScore = newRating;

        const mannerScore = getMannerScore(user);
        const mannerActionChange = game.mannerScoreChanges?.[user.id] || 0;
        const mannerGameChange = isNoContest ? -20 : isWinner ? 2 : -2;
        const mannerChange = mannerActionChange + mannerGameChange;
        
        const oldMannerRank = getMannerRank(mannerScore).rank;
        user.mannerScore = Math.max(0, mannerScore + mannerChange);
        const newMannerRank = getMannerRank(user.mannerScore).rank;

        const userGuild = user.guildId ? guilds[user.guildId] : null;
        const effects = calculateUserEffects(user, userGuild);
        // FIX: Property 'goldBonusPercent' does not exist on type 'CalculatedEffects'.
        const itemGoldBonus = effects.specialStatBonuses[SpecialStat.GoldBonus]?.percent || 0;
        const modeSpecificBonus = isPlayful ? effects.playfulGoldBonusPercent : effects.strategicGoldBonusPercent;
        const goldBonus = 1 + ((itemGoldBonus + modeSpecificBonus) / 100);
        const goldReward = isNoContest ? 0 : Math.floor((isWinner ? 100 : 50) * goldBonus);
        currencyService.grantGold(user, goldReward, `${mode} 대국 보상`);
        
        if(newMannerRank !== oldMannerRank && newMannerRank === '마스터' && !user.mannerMasteryApplied) {
            user.bonusStatPoints = (user.bonusStatPoints || 0) + 20;
            user.mannerMasteryApplied = true;
        } else if (newMannerRank !== oldMannerRank && oldMannerRank === '마스터' && user.mannerMasteryApplied) {
            user.bonusStatPoints = Math.max(0, (user.bonusStatPoints || 0) - 20);
            user.mannerMasteryApplied = false;
        }

        summary[user.id] = {
            xp: xpSummary,
            level: levelSummary,
            rating: { initial: rating, final: newRating, change: ratingChange },
            gold: goldReward,
            manner: { initial: mannerScore, final: user.mannerScore, change: mannerChange },
            mannerActionChange,
            overallRecord: { wins: (user.stats[mode]?.wins ?? 0) + (isWinner ? 1 : 0), losses: (user.stats[mode]?.losses ?? 0) + (isWinner ? 0 : 1) }
        };
    });

    game.summary = summary;
    game.statsUpdated = true;

    if (winner === Player.Black) {
        if (p1.stats[mode]) { p1.id === game.blackPlayerId ? p1.stats[mode].wins++ : p1.stats[mode].losses++; }
        if (p2.stats[mode]) { p2.id === game.blackPlayerId ? p2.stats[mode].wins++ : p2.stats[mode].losses++; }
    } else if (winner === Player.White) {
        if (p1.stats[mode]) { p1.id === game.whitePlayerId ? p1.stats[mode].wins++ : p1.stats[mode].losses++; }
        if (p2.stats[mode]) { p2.id === game.whitePlayerId ? p2.stats[mode].wins++ : p2.stats[mode].losses++; }
    }
    
    updateQuestProgress(p1, 'participate', mode);
    updateQuestProgress(p2, 'participate', mode);

    if(winner !== null) {
        const winnerUser = (winner === Player.Black ? (p1.id === game.blackPlayerId ? p1 : p2) : (p1.id === game.whitePlayerId ? p1 : p2));
        updateQuestProgress(winnerUser, 'win', mode);
        
        if (winnerUser.guildId) {
            const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === mode);
            const missionKey = isStrategic ? 'strategicWins' : 'playfulWins';
            guildService.updateGuildMissionProgress(winnerUser.guildId, missionKey, 1);
        }
    }
    
    await db.updateUser(p1);
    await db.updateUser(p2);
};

export const endGame = async (game: LiveGameSession, winner: Player | null, reason: WinReason) => {
    const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === game.mode) || game.isSinglePlayer || game.isTowerChallenge;
    const isScorableEnd = reason !== WinReason.Disconnect;

    // For strategic games, always try to get the final score analysis unless it was a no-contest/disconnect
    if (isStrategic && isScorableEnd) {
        // getGameResult will set status, scores, analysis, and call the appropriate summary processor
        await getGameResult(game);
        
        // getGameResult determines winner by score. We need to honor the actual reason for ending.
        // For pass-out games, `reason` will be `Score` so we don't override.
        if (reason !== WinReason.Score) {
            game.winner = winner;
            game.winReason = reason;
        }
    } else {
        // For playful games or non-scorable endings, do the normal process.
        game.winner = winner;
        game.winReason = reason;
        game.gameStatus = GameStatus.Ended;
        
        if (game.isAiGame || game.isSinglePlayer || game.isTowerChallenge) {
            await processAiGameSummary(game);
        } else {
            await processGameSummary(game);
        }
    }
    
    if (game.isAiGame && game.player2.playfulLevel < 10) {
        gnuGoServiceManager.destroy(game.id);
    }

    await db.saveGame(game);
};

export const getGameResult = async (game: LiveGameSession) => {
    game.gameStatus = GameStatus.Scoring;
    await db.saveGame(game); // Let client know we're scoring

    try {
        const analysis = await analyzeGame(game);
        game.analysisResult = { 'system': analysis };
        const { black: blackScore, white: whiteScore } = analysis.areaScore;
        
        game.finalScores = { black: blackScore, white: whiteScore };
        game.winner = blackScore > whiteScore ? Player.Black : Player.White;
        game.winReason = WinReason.Score;
        
        game.gameStatus = GameStatus.Ended;
        if (game.isAiGame || game.isSinglePlayer || game.isTowerChallenge) {
            await processAiGameSummary(game);
        } else {
            await processGameSummary(game);
        }
        await db.saveGame(game);
    } catch (e) {
        console.error(`[Scoring] KataGo analysis failed for game ${game.id}. Ending as no-contest.`, e);
        game.gameStatus = GameStatus.NoContest;
        game.winReason = WinReason.Disconnect; // Represents a technical issue
        game.summary = {}; // Add empty summary to signify processing is done
        game.statsUpdated = true;

        // Refund action points for the human player since it was a system error
        if (game.player1 && (game.isSinglePlayer || game.isTowerChallenge)) {
            const user = await db.getUser(game.player1.id);
            if (user) {
                const stageList = game.isTowerChallenge ? TOWER_STAGES : SINGLE_PLAYER_STAGES;
                const stage = stageList.find(s => s.id === game.stageId);
                if (stage) {
                    user.actionPoints.current += stage.actionPointCost;
                    await db.updateUser(user);
                }
            }
        }
        
        await db.saveGame(game);
    }
};
