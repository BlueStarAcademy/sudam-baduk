
// server/summaryService.ts
import { getGoLogic, processMove } from '../utils/goLogic.js';
import * as db from './db.js';
import * as types from '../types/index.js';
import { calculateUserEffects, createDefaultBaseStats } from '../utils/statUtils.js';
import * as mannerService from './services/mannerService.js';
import { SPECIAL_GAME_MODES, NO_CONTEST_MANNER_PENALTY, NO_CONTEST_RANKING_PENALTY, CONSUMABLE_ITEMS, PLAYFUL_GAME_MODES, SINGLE_PLAYER_STAGES, MATERIAL_ITEMS, NO_CONTEST_MOVE_THRESHOLD, TOWER_STAGES } from '../constants/index.js';
import { updateQuestProgress } from './questService.js';
import { openEquipmentBox1, createItemFromTemplate } from './shop.js';
import { createItemInstancesFromReward, addItemsToInventory } from '../utils/inventoryUtils.js';
import { defaultStats } from './initialData.js';
import { aiUserId, getAiUser } from './ai/index.js';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { calculateScores } from './scoring.js';
import { getDb } from './db/connection.js';


const getXpForLevel = (level: number): number => 1000 + (level - 1) * 200;

const processSinglePlayerGameSummary = async (game: types.LiveGameSession) => {
    const user = game.player1; // Human is always player1 in single player
    const isWinner = game.winner === types.Player.Black; // Human is always black
    
    const stageSource = game.isTowerChallenge ? TOWER_STAGES : SINGLE_PLAYER_STAGES;
    const stage = stageSource.find(s => s.id === game.stageId);

    if (!stage) {
        console.error(`[SP Summary] Could not find stage with id: ${game.stageId}`);
        return;
    }
    
    const summary: types.GameSummary = {
        xp: { initial: user.strategyXp, change: 0, final: user.strategyXp },
        rating: { initial: 1200, change: 0, final: 1200 }, // Not applicable
        manner: { initial: user.mannerScore, change: 0, final: user.mannerScore },
        gold: 0,
        items: [],
        level: { 
            initial: user.strategyLevel, 
            final: user.strategyLevel,
            progress: {
                initial: user.strategyXp,
                final: user.strategyXp,
                max: getXpForLevel(user.strategyLevel)
            }
        }
    };
    
    if (isWinner) {
        let isFirstClear = false;
        if (game.isTowerChallenge) {
            isFirstClear = !user.claimedFirstClearRewards?.includes(stage.id);
            if (isFirstClear) {
                user.claimedFirstClearRewards.push(stage.id);
            }
            if (stage.floor! > (user.towerProgress.highestFloor || 0)) {
                user.towerProgress.highestFloor = stage.floor!;
            }
            user.towerProgress.lastClearTimestamp = Date.now();
        } else { // Single player
            const stageIndex = SINGLE_PLAYER_STAGES.findIndex(s => s.id === stage.id);
            const currentProgress = user.singlePlayerProgress ?? 0;
            isFirstClear = !user.claimedFirstClearRewards?.includes(stage.id);

            if (currentProgress === stageIndex) {
                user.singlePlayerProgress = currentProgress + 1;
            }
            if (isFirstClear) {
                user.claimedFirstClearRewards.push(stage.id);
            }
        }

        const rewards = isFirstClear ? stage.rewards.firstClear : stage.rewards.repeatClear;
        
        const itemsToCreate = rewards.items ? createItemInstancesFromReward(rewards.items) : [];
        const { success } = addItemsToInventory([...user.inventory], user.inventorySlots, itemsToCreate);
        
        if (!success) {
            console.error(`[SP Summary] Insufficient inventory space for user ${user.id} on stage ${stage.id}. Items not granted.`);
        } else {
            const goldGain = rewards.gold ?? 0;
            user.gold += goldGain;
            const initialXp = user.strategyXp;
            const xpGain = rewards.exp;
            if (xpGain) {
                user.strategyXp += xpGain.amount;
            }

            addItemsToInventory(user.inventory, user.inventorySlots, itemsToCreate);
            
            summary.gold = goldGain;
            summary.xp = { initial: initialXp, change: xpGain?.amount ?? 0, final: user.strategyXp };
            summary.items = itemsToCreate;

            if (rewards.bonus && rewards.bonus.startsWith('스탯')) {
                const points = parseInt(rewards.bonus.replace('스탯', ''), 10);
                if (!isNaN(points)) {
                    user.bonusStatPoints = (user.bonusStatPoints || 0) + points;
                    if (!summary.items) summary.items = [];
                    summary.items.push({
                        id: `stat-points-${Date.now()}`,
                        name: `보너스 스탯`,
                        image: '/images/icons/stat_point.png',
                        type: 'consumable',
                        grade: types.ItemGrade.Rare,
                        quantity: points,
                        options: undefined,
                    } as any);
                }
            }
        }
    }

    const initialLevel = user.strategyLevel;
    let currentLevel = user.strategyLevel;
    let currentXp = user.strategyXp;
    let requiredXp = getXpForLevel(currentLevel);

    while (currentXp >= requiredXp) {
        currentXp -= requiredXp;
        currentLevel++;
        requiredXp = getXpForLevel(currentLevel);
    }
    
    summary.level = {
        initial: initialLevel,
        final: currentLevel,
        progress: {
            initial: summary.xp.initial,
            final: currentXp,
            max: getXpForLevel(initialLevel)
        }
    };
    
    user.strategyLevel = currentLevel;
    user.strategyXp = currentXp;

    if (!game.summary) game.summary = {};
    game.summary[user.id] = summary;
    
    await db.updateUser(user);
};

export const getGameResult = async (game: types.LiveGameSession) => {
    if (game.gameStatus === types.GameStatus.Ended || game.gameStatus === types.GameStatus.NoContest) return;
    game.gameStatus = types.GameStatus.Scoring;
    await db.saveGame(game);

    const result = calculateScores(game.boardState, game.settings.komi, game.captures);
    
    game.finalScores = {
        black: result.black,
        white: result.white,
    };
    
    const analysisResult: Partial<types.AnalysisResult> = {
        scoreDetails: {
            black: { territory: result.black - game.captures[types.Player.Black], liveCaptures: game.captures[types.Player.Black], total: result.black, deadStones: (result.deadStones.filter(s => game.boardState[s.y][s.x] === types.Player.White).length) } as types.ScoreDetails,
            white: { territory: result.white - game.captures[types.Player.White] - game.settings.komi, liveCaptures: game.captures[types.Player.White], komi: game.settings.komi, total: result.white, deadStones: (result.deadStones.filter(s => game.boardState[s.y][s.x] === types.Player.Black).length) } as types.ScoreDetails,
        },
        areaScore: { black: result.black, white: result.white },
        deadStones: result.deadStones,
    };

    if (!game.analysisResult) game.analysisResult = {};
    game.analysisResult['system'] = analysisResult as types.AnalysisResult;
    
    const winner = game.finalScores.black > game.finalScores.white ? types.Player.Black : types.Player.White;
    await endGame(game, winner, types.WinReason.Score);
};

export const endGame = async (game: types.LiveGameSession, winner: types.Player, winReason: types.WinReason): Promise<void> => {
    if (game.gameStatus === types.GameStatus.Ended || game.gameStatus === types.GameStatus.NoContest) {
        return;
    }
    game.winner = winner;
    game.winReason = winReason;
    game.gameStatus = types.GameStatus.Ended;

    if (game.isSinglePlayer || game.isTowerChallenge) {
        await processSinglePlayerGameSummary(game);
    } else {
        const isPlayful = PLAYFUL_GAME_MODES.some(m => m.mode === game.mode);
        const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === game.mode);
        if ((isPlayful || isStrategic) && !game.statsUpdated) {
            await processGameSummary(game);
        }
    }

    game.statsUpdated = true;
    await db.saveGame(game);
};

const createConsumableItemInstance = (name: string): types.InventoryItem | null => {
    const template = CONSUMABLE_ITEMS.find(item => item.name === name);
    if (!template) {
        console.error(`[Reward] Consumable item template not found for: ${name}`);
        return null;
    }

    return {
        ...template,
        id: `item-${globalThis.crypto.randomUUID()}`,
        quantity: 1,
        createdAt: Date.now(),
        isEquipped: false,
        level: 1,
        stars: 0,
        options: undefined,
        slot: null,
    };
};

const calculateGameRewards = (
    game: types.LiveGameSession, 
    player: types.User,
    isWinner: boolean, 
    isDraw: boolean,
    itemDropBonus: number,
    materialDropBonus: number,
    rewardMultiplier: number
): { gold: number; items: types.InventoryItem[] } => {
    const { mode, settings, isAiGame } = game;
    const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === mode);
    
    const baseGold = isStrategic ? 100 : 50;
    const outcomeMultiplier = isWinner ? 1.0 : isDraw ? 0.5 : 0.25;
    let goldReward = Math.round(baseGold * outcomeMultiplier);
    
    if (isAiGame) {
        goldReward = Math.round(goldReward * 0.2);
    }

    goldReward = Math.round(goldReward * rewardMultiplier);

    const itemsDropped: types.InventoryItem[] = [];
    if (isWinner && !isAiGame) {
        const dropChance = 20 * (1 + itemDropBonus / 100) * rewardMultiplier;
        if (Math.random() * 100 < dropChance) {
            const droppedItem = openEquipmentBox1();
            itemsDropped.push(droppedItem);
        }
    }
    
    return { gold: goldReward, items: itemsDropped };
};

const calculateEloChange = (playerRating: number, opponentRating: number, result: 'win' | 'loss' | 'draw'): number => {
    const K = 32;
    const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    const actualScore = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
    const ratingChange = K * (actualScore - expectedScore);
    return Math.round(ratingChange);
};

const processPlayerSummary = async (
    player: types.User,
    opponent: types.User,
    isWinner: boolean,
    isDraw: boolean,
    game: types.LiveGameSession,
    isNoContest: boolean,
    isInitiator: boolean
): Promise<{ summary: types.GameSummary; updatedPlayer: types.User }> => {
    
    const updatedPlayer: types.User = JSON.parse(JSON.stringify(player));
    const { mode, winReason, isAiGame, moveHistory } = game;

    const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === mode);
    const initialLevel = isStrategic ? updatedPlayer.strategyLevel : updatedPlayer.playfulLevel;
    const opponentLevel = isStrategic ? opponent.strategyLevel : opponent.playfulLevel;
    const initialXp = isStrategic ? updatedPlayer.strategyXp : updatedPlayer.playfulXp;
    let xpGain = isNoContest ? 0 : (isWinner ? 100 : (isDraw ? 50 : 25));

    if (isAiGame) {
        xpGain = Math.round(xpGain * 0.2);
    }

    const levelDiff = opponentLevel - initialLevel;
    let levelMultiplier = 1 + (levelDiff * 0.1);
    levelMultiplier = Math.max(0.5, Math.min(1.5, levelMultiplier));
    xpGain = Math.round(xpGain * levelMultiplier);

    const effects = calculateUserEffects(updatedPlayer, null); 

    const xpBonusPercent = isStrategic 
        ? effects.specialStatBonuses[types.SpecialStat.StrategyXpBonus].percent 
        : effects.specialStatBonuses[types.SpecialStat.PlayfulXpBonus].percent;
    if (xpBonusPercent > 0) xpGain = Math.round(xpGain * (1 + xpBonusPercent / 100));

    let currentXp = initialXp + xpGain;
    let currentLevel = initialLevel;
    let requiredXpForCurrentLevel = getXpForLevel(currentLevel);
    while (currentXp >= requiredXpForCurrentLevel) {
        currentXp -= requiredXpForCurrentLevel;
        currentLevel++;
        requiredXpForCurrentLevel = getXpForLevel(currentLevel);
    }
    
    const xpSummary: types.StatChange = { initial: initialXp, change: xpGain, final: currentXp };
    const levelSummary = {
        initial: initialLevel,
        final: currentLevel,
        progress: { 
            initial: initialXp, 
            final: currentXp, 
            max: getXpForLevel(initialLevel) 
        }
    };

    if (isStrategic) {
        updatedPlayer.strategyLevel = currentLevel;
        updatedPlayer.strategyXp = currentXp;
    } else {
        updatedPlayer.playfulLevel = currentLevel;
        updatedPlayer.playfulXp = currentXp;
    }
    
    if (!updatedPlayer.stats) updatedPlayer.stats = JSON.parse(JSON.stringify(defaultStats));
    const gameStats = updatedPlayer.stats[mode] ?? { wins: 0, losses: 0, rankingScore: 1200 };
    const initialRating = gameStats.rankingScore;
    const opponentStats = opponent.stats?.[mode] ?? defaultStats[mode];
    const opponentRating = opponent.id === aiUserId ? (initialRating - 50 + Math.random() * 100) : opponentStats.rankingScore;
    let ratingChange = 0;
    if (!isNoContest && !isAiGame) {
        const result = isWinner ? 'win' : isDraw ? 'draw' : 'loss';
        ratingChange = calculateEloChange(initialRating, opponentRating, result);
    }
    gameStats.rankingScore = Math.max(0, initialRating + ratingChange);
    const ratingSummary: types.StatChange = { initial: initialRating, change: ratingChange, final: gameStats.rankingScore };

    const mannerChangeFromActions = game.mannerScoreChanges?.[player.id] || 0;
    const initialMannerBeforeGame = player.mannerScore - mannerChangeFromActions;

    let mannerChangeFromGameEnd = 0;
    if (winReason === 'disconnect' && !isWinner && !isDraw) mannerChangeFromGameEnd = -20;
    
    const finalMannerScore = player.mannerScore + mannerChangeFromGameEnd;
    updatedPlayer.mannerScore = Math.max(0, finalMannerScore);
    const totalMannerChange = mannerChangeFromActions + mannerChangeFromGameEnd;
    const mannerSummary: types.StatChange = { initial: initialMannerBeforeGame, change: totalMannerChange, final: updatedPlayer.mannerScore };
    await mannerService.applyMannerRankChange(updatedPlayer, initialMannerBeforeGame);

    if (!isNoContest) {
        if (isWinner) gameStats.wins++;
        else if (!isDraw) gameStats.losses++;
    }
    updatedPlayer.stats[mode] = gameStats;
    
    const itemDropBonus = effects.specialStatBonuses[types.SpecialStat.ItemDropRate].percent;
    const materialDropBonus = effects.specialStatBonuses[types.SpecialStat.MaterialDropRate].percent;
    const rewards = isNoContest ? { gold: 0, items: [] } : calculateGameRewards(game, updatedPlayer, isWinner, isDraw, itemDropBonus, materialDropBonus, 1.0);
    updatedPlayer.gold += rewards.gold ?? 0;

    if (rewards.items.length > 0) addItemsToInventory(updatedPlayer.inventory, updatedPlayer.inventorySlots, rewards.items);
    
    if (!isNoContest && !isAiGame) {
        updateQuestProgress(updatedPlayer, 'participate', mode, 1);
        if (isWinner) updateQuestProgress(updatedPlayer, 'win', mode, 1);
    }

    const summary: types.GameSummary = {
        xp: xpSummary,
        rating: ratingSummary,
        manner: mannerSummary,
        mannerActionChange: mannerChangeFromActions,
        overallRecord: { wins: gameStats.wins, losses: gameStats.losses },
        gold: rewards.gold ?? 0,
        items: rewards.items,
        level: levelSummary
    };

    return { summary, updatedPlayer };
};

export const processGameSummary = async (game: types.LiveGameSession): Promise<void> => {
    const { winner, player1, player2, blackPlayerId, whitePlayerId, noContestInitiatorIds, mode, winReason, isAiGame, moveHistory } = game;
    if (!player1 || !player2) {
        console.error(`[Summary] Missing player data for game ${game.id}`);
        return;
    }

    const isEarlyGameAbort =
        !game.noContestInitiatorIds?.length && // Don't apply penalty if it's a mutually agreed no-contest
        !isAiGame &&
        moveHistory.length < NO_CONTEST_MOVE_THRESHOLD * 2 &&
        (winReason === types.WinReason.Resign || winReason === types.WinReason.Disconnect);

    if (isEarlyGameAbort) {
        console.log(`[Summary] Game ${game.id} is an early-game abort. Processing with penalties.`);

        const p1IsWinner = (winner === types.Player.Black && player1.id === blackPlayerId) || (winner === types.Player.White && player1.id === whitePlayerId);
        
        const initiatorId = winReason === types.WinReason.Resign 
            ? (p1IsWinner ? player2.id : player1.id)
            : (p1IsWinner ? player2.id : player1.id);
        
        const initiator = await db.getUser(initiatorId);
        const opponentId = player1.id === initiatorId ? player2.id : player1.id;
        const opponent = await db.getUser(opponentId);

        if (!initiator || !opponent) {
             console.error(`[Summary] Could not find initiator or opponent for early abort penalty in game ${game.id}`);
             return;
        }

        const initialMannerScore = initiator.mannerScore;
        const initialRating = initiator.stats[mode]?.rankingScore || 1200;
        
        initiator.mannerScore = Math.max(0, initiator.mannerScore - NO_CONTEST_MANNER_PENALTY);
        if (initiator.stats[mode]) {
            initiator.stats[mode].rankingScore = Math.max(0, initialRating - NO_CONTEST_RANKING_PENALTY);
        }
        initiator.pendingPenaltyNotification = { type: 'no_contest', details: { mode, opponentNickname: opponent.nickname, penalty: NO_CONTEST_RANKING_PENALTY } };
        
        if (!game.summary) game.summary = {};

        const baseSummary = {
            xp: { initial: 0, change: 0, final: 0 },
            level: { initial: 0, final: 0, progress: { initial: 0, final: 0, max: 0 } },
            gold: 0, items: [], overallRecord: { wins: 0, losses: 0 }
        };

        game.summary[initiator.id] = {
            ...baseSummary,
            rating: { initial: initialRating, change: -NO_CONTEST_RANKING_PENALTY, final: initiator.stats[mode]?.rankingScore ?? initialRating },
            manner: { initial: initialMannerScore, change: -NO_CONTEST_MANNER_PENALTY, final: initiator.mannerScore },
        };
        game.summary[opponent.id] = {
            ...baseSummary,
            rating: { initial: opponent.stats[mode]?.rankingScore || 1200, change: 0, final: opponent.stats[mode]?.rankingScore || 1200 },
            manner: { initial: opponent.mannerScore, change: 0, final: opponent.mannerScore },
        };

        game.gameStatus = types.GameStatus.NoContest;
        game.statsUpdated = true;
        
        await db.updateUser(initiator);
        await db.saveGame(game);
        return;
    }
    
    const p1 = player1.id === aiUserId ? getAiUser(game.mode) : await db.getUser(player1.id);
    const p2 = player2.id === aiUserId ? getAiUser(game.mode) : await db.getUser(player2.id);

    if (!p1 || !p2) {
        console.error(`[Summary] Could not find one or more users from DB for game ${game.id}`);
        game.statsUpdated = true;
        await db.saveGame(game);
        return;
    }

    const isDraw = winner === types.Player.None;
    const isNoContest = game.gameStatus === 'no_contest';

    const p1IsWinner = !isDraw && !isNoContest && ((winner === types.Player.Black && p1.id === blackPlayerId) || (winner === types.Player.White && p1.id === whitePlayerId));
    const p2IsWinner = !isDraw && !isNoContest && ((winner === types.Player.Black && p2.id === blackPlayerId) || (winner === types.Player.White && p2.id === whitePlayerId));
    
    const p1IsNoContestInitiator = !!(isNoContest && noContestInitiatorIds?.includes(p1.id));
    const p2IsNoContestInitiator = !!(isNoContest && noContestInitiatorIds?.includes(p2.id));

    const { summary: p1Summary, updatedPlayer: updatedP1 } = await processPlayerSummary(p1, p2, p1IsWinner, isDraw, game, isNoContest, p1IsNoContestInitiator);
    const { summary: p2Summary, updatedPlayer: updatedP2 } = await processPlayerSummary(p2, p1, p2IsWinner, isDraw, game, isNoContest, p2IsNoContestInitiator);

    if (!game.summary) game.summary = {};
    game.summary[p1.id] = p1Summary;
    game.summary[p2.id] = p2Summary;
    
    if (p1.id !== aiUserId) {
        await db.updateUser(updatedP1);
        await db.updateUserStatus(p1.id, { status: types.UserStatus.Waiting, mode: game.mode, stateEnteredAt: Date.now() });
    }
    if (p2.id !== aiUserId) {
        await db.updateUser(updatedP2);
        await db.updateUserStatus(p2.id, { status: types.UserStatus.Waiting, mode: game.mode, stateEnteredAt: Date.now() });
    }
};
