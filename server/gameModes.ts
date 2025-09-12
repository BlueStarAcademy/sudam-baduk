import { getGoLogic } from './goLogic.js';
import { NO_CONTEST_MOVE_THRESHOLD, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, STRATEGIC_ACTION_BUTTONS_EARLY, STRATEGIC_ACTION_BUTTONS_MID, STRATEGIC_ACTION_BUTTONS_LATE, PLAYFUL_ACTION_BUTTONS_EARLY, PLAYFUL_ACTION_BUTTONS_MID, PLAYFUL_ACTION_BUTTONS_LATE, RANDOM_DESCRIPTIONS, ALKKAGI_TURN_TIME_LIMIT, ALKKAGI_PLACEMENT_TIME_LIMIT, TIME_BONUS_SECONDS_PER_POINT, DEFAULT_GAME_SETTINGS, TOWER_STAGES, SINGLE_PLAYER_STAGES } from '../constants.js';
import * as types from '../types.js';
import type { LiveGameSession, AppState, Negotiation, ActionButton, GameMode } from '../types.js';
import { aiUserId, makeAiMove, getAiUser } from './aiPlayer.js';
// FIX: Corrected import paths to point to the actual module files inside `modes`.
import { initializeStrategicGame, updateStrategicGameState } from './strategic.js';
import { initializePlayfulGame, updatePlayfulGameState } from './playful.js';
import { randomUUID } from 'crypto';
import * as db from './db.js';
import * as effectService from './effectService.js';
import { endGame, getGameResult } from './summaryService.js';

export const finalizeAnalysisResult = (baseAnalysis: types.AnalysisResult, session: types.LiveGameSession): types.AnalysisResult => {
    const finalAnalysis = JSON.parse(JSON.stringify(baseAnalysis)); // Deep copy

    const { mode, settings, baseStoneCaptures, hiddenStoneCaptures } = session;
    const isBaseMode = mode === types.GameMode.Base || (mode === types.GameMode.Mix && settings.mixedModes?.includes(types.GameMode.Base));
    const isHiddenMode = mode === types.GameMode.Hidden || (mode === types.GameMode.Mix && settings.mixedModes?.includes(types.GameMode.Hidden));
    
    // Base stone bonus
    if (isBaseMode && baseStoneCaptures) {
        finalAnalysis.scoreDetails.black.baseStoneBonus = (baseStoneCaptures[types.Player.Black] || 0) * 5;
        finalAnalysis.scoreDetails.white.baseStoneBonus = (baseStoneCaptures[types.Player.White] || 0) * 5;
    } else {
        finalAnalysis.scoreDetails.black.baseStoneBonus = 0;
        finalAnalysis.scoreDetails.white.baseStoneBonus = 0;
    }

    // Hidden stone bonus
    if (isHiddenMode && hiddenStoneCaptures) {
        finalAnalysis.scoreDetails.black.hiddenStoneBonus = (hiddenStoneCaptures[types.Player.Black] || 0) * 5; // Using 5 points as per server/modes/standard.ts
        finalAnalysis.scoreDetails.white.hiddenStoneBonus = (hiddenStoneCaptures[types.Player.White] || 0) * 5;
    } else {
        finalAnalysis.scoreDetails.black.hiddenStoneBonus = 0;
        finalAnalysis.scoreDetails.white.hiddenStoneBonus = 0;
    }
    
    // Time bonus
    if (session.mode === types.GameMode.Speed || (session.mode === types.GameMode.Mix && session.settings.mixedModes?.includes(types.GameMode.Speed))) {
        finalAnalysis.scoreDetails.black.timeBonus = Math.floor((session.blackTimeLeft || 0) / TIME_BONUS_SECONDS_PER_POINT);
        finalAnalysis.scoreDetails.white.timeBonus = Math.floor((session.whiteTimeLeft || 0) / TIME_BONUS_SECONDS_PER_POINT);
    } else {
        finalAnalysis.scoreDetails.black.timeBonus = 0;
        finalAnalysis.scoreDetails.white.timeBonus = 0;
    }
    
    // Item bonus (currently none, placeholder)
    finalAnalysis.scoreDetails.black.itemBonus = 0;
    finalAnalysis.scoreDetails.white.itemBonus = 0;

    // Recalculate totals. A dead stone is worth 2 points: 1 for the capture, 1 for the territory.
    // 'territory' is empty points. 'captures' is live captures. 'deadStones' is end-of-game captures.
    // So we multiply deadStones by 2 to account for both territory and capture points.
    finalAnalysis.scoreDetails.black.total = 
        finalAnalysis.scoreDetails.black.territory + 
        finalAnalysis.scoreDetails.black.captures + 
        ((finalAnalysis.scoreDetails.black.deadStones ?? 0) * 2) + 
        finalAnalysis.scoreDetails.black.baseStoneBonus + 
        finalAnalysis.scoreDetails.black.hiddenStoneBonus + 
        finalAnalysis.scoreDetails.black.timeBonus + 
        finalAnalysis.scoreDetails.black.itemBonus;
    
    finalAnalysis.scoreDetails.white.total = 
        finalAnalysis.scoreDetails.white.territory + 
        finalAnalysis.scoreDetails.white.captures + 
        finalAnalysis.scoreDetails.white.komi + 
        ((finalAnalysis.scoreDetails.white.deadStones ?? 0) * 2) + 
        finalAnalysis.scoreDetails.white.baseStoneBonus + 
        finalAnalysis.scoreDetails.white.hiddenStoneBonus + 
        finalAnalysis.scoreDetails.white.timeBonus + 
        finalAnalysis.scoreDetails.white.itemBonus;
    
    finalAnalysis.areaScore.black = finalAnalysis.scoreDetails.black.total;
    finalAnalysis.areaScore.white = finalAnalysis.scoreDetails.white.total;
    
    return finalAnalysis;
};


export const getNewActionButtons = (game: types.LiveGameSession): ActionButton[] => {
    const { mode, moveHistory } = game;
    
    let phase: 'early' | 'mid' | 'late';
    const isPlayful = PLAYFUL_GAME_MODES.some((m: { mode: GameMode }) => m.mode === mode);

    if (isPlayful) {
        // Use round-based phase for most playful games
        const currentRound = game.alkkagiRound || game.curlingRound || game.round || 1;
        const totalRounds = game.settings.alkkagiRounds || game.settings.curlingRounds || game.settings.diceGoRounds || 2;

        if (currentRound === 1) {
            phase = 'early';
        } else if (currentRound === totalRounds) {
            phase = 'late';
        } else {
            phase = 'mid';
        }
    } else { // Strategic
        const moveCount = moveHistory.length;
        if (moveCount <= 30) {
            phase = 'early';
        } else if (moveCount >= 31 && moveCount <= 150) {
            phase = 'mid';
        } else { // moveCount >= 151
            phase = 'late';
        }
    }

    let sourceDeck: ActionButton[];

    if (isPlayful) {
        switch (phase) {
            case 'early': sourceDeck = PLAYFUL_ACTION_BUTTONS_EARLY; break;
            case 'mid':   sourceDeck = PLAYFUL_ACTION_BUTTONS_MID; break;
            case 'late':  sourceDeck = PLAYFUL_ACTION_BUTTONS_LATE; break;
        }
    } else { // Strategic
        switch (phase) {
            case 'early': sourceDeck = STRATEGIC_ACTION_BUTTONS_EARLY; break;
            case 'mid':   sourceDeck = STRATEGIC_ACTION_BUTTONS_MID; break;
            case 'late':  sourceDeck = STRATEGIC_ACTION_BUTTONS_LATE; break;
        }
    }

    const shuffledButtons = [...sourceDeck].sort(() => 0.5 - Math.random());
    const manners = shuffledButtons.filter(b => b.type === 'manner');
    const unmanners = shuffledButtons.filter(b => b.type === 'unmannerly');

    const mannerCount = Math.random() > 0.5 ? 1 : 2;
    const selectedManners = manners.slice(0, mannerCount);
    
    const neededUnmanners = 3 - selectedManners.length;
    const selectedUnmanners = unmanners.slice(0, neededUnmanners);

    let result = [...selectedManners, ...selectedUnmanners];
    
    if (result.length < 3) {
        const existingNames = new Set(result.map(b => b.name));
        const filler = shuffledButtons.filter(b => !existingNames.has(b.name));
        result.push(...filler.slice(0, 3 - result.length));
    }
    
    return result.slice(0, 3).sort(() => 0.5 - Math.random());
};

export const initializeGame = async (neg: Negotiation): Promise<LiveGameSession> => {
    const gameId = `game-${randomUUID()}`;
    const { settings: settingsFromNeg, mode } = neg;
    const now = Date.now();
    
    const settings: types.GameSettings = { ...DEFAULT_GAME_SETTINGS, ...settingsFromNeg };
    
    const challenger = await db.getUser(neg.challenger.id);
    const opponent = neg.opponent.id === aiUserId ? getAiUser(neg.mode) : await db.getUser(neg.opponent.id);

    if (!challenger || !opponent) {
        throw new Error(`Could not find one or more players to start the game: ${neg.challenger.id}, ${neg.opponent.id}`);
    }
    
    const isAiGame = opponent.id === aiUserId;
    
    const descriptions = RANDOM_DESCRIPTIONS[mode] || [`${mode} 한 판!`];
    const randomDescription = descriptions[Math.floor(Math.random() * descriptions.length)];

    const game: LiveGameSession = {
        id: gameId,
        mode, settings, description: randomDescription, player1: challenger, player2: opponent, isAiGame,
        boardState: Array(settings.boardSize).fill(0).map(() => Array(settings.boardSize).fill(types.Player.None)),
        moveHistory: [], captures: { [types.Player.None]: 0, [types.Player.Black]: 0, [types.Player.White]: 0 },
        baseStoneCaptures: { [types.Player.None]: 0, [types.Player.Black]: 0, [types.Player.White]: 0 }, 
        hiddenStoneCaptures: { [types.Player.None]: 0, [types.Player.Black]: 0, [types.Player.White]: 0 },
        winner: null, winReason: null, createdAt: now, lastMove: null, passCount: 0, koInfo: null,
        winningLine: null, statsUpdated: false, blackTimeLeft: settings.timeLimit * 60, whiteTimeLeft: settings.timeLimit * 60,
        blackByoyomiPeriodsLeft: settings.byoyomiCount, whiteByoyomiPeriodsLeft: settings.byoyomiCount,
        disconnectionState: null, disconnectionCounts: { [challenger.id]: 0, [opponent.id]: 0 },
        currentActionButtons: { [challenger.id]: [], [opponent.id]: [] },
        actionButtonCooldownDeadline: {},
        actionButtonUsedThisCycle: { [challenger.id]: false, [opponent.id]: false },
        missileUsedThisTurn: false,
        maxActionButtonUses: 5, actionButtonUses: { [challenger.id]: 0, [opponent.id]: 0 },
        round: 1, turnInRound: 1, newlyRevealed: [], scores: { [challenger.id]: 0, [opponent.id]: 0 },
        analysisResult: null, isAnalyzing: false,
        gameStatus: 'pending', blackPlayerId: null, whitePlayerId: null, currentPlayer: types.Player.None,
    };

    if (SPECIAL_GAME_MODES.some((m: { mode: GameMode }) => m.mode === mode)) {
        initializeStrategicGame(game, neg, now);
    } else if (PLAYFUL_GAME_MODES.some((m: { mode: GameMode; }) => m.mode === mode)) {
        await initializePlayfulGame(game, neg, now);
    }
    
    if (game.gameStatus === 'playing' && game.currentPlayer === types.Player.None) {
        game.currentPlayer = types.Player.Black;
        if (settings.timeLimit > 0) game.turnDeadline = now + game.blackTimeLeft * 1000;
        game.turnStartTime = now;
    }
    
    return game;
};

export const resetGameForRematch = (game: LiveGameSession, negotiation: types.Negotiation): LiveGameSession => {
    const newGame = { ...game, id: `game-${randomUUID()}` };

    newGame.mode = negotiation.mode;
    newGame.settings = negotiation.settings;
    
    const now = Date.now();
    const baseFields = {
        winner: null, winReason: null, statsUpdated: false, summary: undefined, finalScores: undefined,
        winningLine: null,
        boardState: Array(newGame.settings.boardSize).fill(0).map(() => Array(newGame.settings.boardSize).fill(types.Player.None)),
        moveHistory: [], captures: { [types.Player.None]: 0, [types.Player.Black]: 0, [types.Player.White]: 0 }, 
        baseStoneCaptures: { [types.Player.None]: 0, [types.Player.Black]: 0, [types.Player.White]: 0 }, 
        hiddenStoneCaptures: { [types.Player.None]: 0, [types.Player.Black]: 0, [types.Player.White]: 0 }, 
        lastMove: null, passCount: 0, koInfo: null,
        blackTimeLeft: newGame.settings.timeLimit * 60, whiteTimeLeft: newGame.settings.timeLimit * 60,
        blackByoyomiPeriodsLeft: newGame.settings.byoyomiCount, whiteByoyomiPeriodsLeft: newGame.settings.byoyomiCount,
        currentActionButtons: { [game.player1.id]: [], [game.player2.id]: [] },
        actionButtonCooldownDeadline: {},
        actionButtonUsedThisCycle: { [game.player1.id]: false, [game.player2.id]: false },
        missileUsedThisTurn: false,
        actionButtonUses: { [game.player1.id]: 0, [game.player2.id]: 0 },
        isAnalyzing: false, analysisResult: null, round: 1, turnInRound: 1,
        scores: { [game.player1.id]: 0, [game.player2.id]: 0 },
        rematchRejectionCount: undefined,
    };

    Object.assign(newGame, baseFields);

    if (SPECIAL_GAME_MODES.some((m: { mode: GameMode }) => m.mode === newGame.mode)) {
        initializeStrategicGame(newGame, negotiation, now);
    } else if (PLAYFUL_GAME_MODES.some((m: { mode: GameMode }) => m.mode === newGame.mode)) {
        initializePlayfulGame(newGame, negotiation, now);
    }
    
    return newGame;
};

export const updateGameStates = async (games: LiveGameSession[], now: number): Promise<LiveGameSession[]> => {
    const updatedGames: LiveGameSession[] = [];
    for (const game of games) {
        if (game.disconnectionState && (now - game.disconnectionState.timerStartedAt > 90000)) {
            game.winner = game.blackPlayerId === game.disconnectionState.disconnectedPlayerId ? types.Player.White : types.Player.Black;
            game.winReason = 'disconnect';
            game.gameStatus = 'ended';
            game.disconnectionState = null;
        }

        if (game.lastTimeoutPlayerIdClearTime && now >= game.lastTimeoutPlayerIdClearTime) {
            game.lastTimeoutPlayerId = null;
            game.lastTimeoutPlayerIdClearTime = undefined;
        }

        if (!game.player1 || !game.player2) {
            console.warn(`[Game Loop] Skipping corrupted game ${game.id} with missing player data.`);
            continue;
        }

        const p1 = await db.getUser(game.player1.id);
        
        let p2;
        if (game.player2.id === aiUserId) {
            const stageList = game.isTowerChallenge ? TOWER_STAGES : SINGLE_PLAYER_STAGES;
            const stage = stageList.find((s: { id: string; }) => s.id === game.stageId);
            p2 = getAiUser(game.mode, 1, stage?.level);
            if (stage) {
                p2.strategyLevel = stage.katagoLevel;
            }
        } else {
            p2 = await db.getUser(game.player2.id);
        }

        if (p1) game.player1 = p1;
        if (p2) game.player2 = p2;

        const p1Id = game.player1.id;
        const p2Id = game.player2.id;
        const players = [game.player1, game.player2].filter(p => p.id !== aiUserId);

        const playableStatuses: types.GameStatus[] = [
            'playing',
            'alkkagi_playing',
            'curling_playing',
            'dice_rolling',
            'dice_placing',
            'thief_rolling',
            'thief_placing',
        ];
        
        if (playableStatuses.includes(game.gameStatus)) {
            for (const player of players) {
                const deadline = game.actionButtonCooldownDeadline?.[player.id];
                if (typeof deadline !== 'number' || now >= deadline) {
                    game.currentActionButtons[player.id] = getNewActionButtons(game);
                    
                    const effects = effectService.calculateUserEffects(player);
                    const cooldown = (5 * 60 - (effects.mythicStatBonuses[types.MythicStat.MannerActionCooldown]?.flat || 0)) * 1000;

                    if (!game.actionButtonCooldownDeadline) game.actionButtonCooldownDeadline = {};
                    game.actionButtonCooldownDeadline[player.id] = now + cooldown;
                    if (game.actionButtonUsedThisCycle) {
                        game.actionButtonUsedThisCycle[player.id] = false;
                    }
                }
            }
        }
        
        const isAiTurn = game.isAiGame && game.currentPlayer !== types.Player.None && 
                        (game.currentPlayer === types.Player.Black ? game.blackPlayerId === aiUserId : game.whitePlayerId === aiUserId);
        
        if (isAiTurn && game.gameStatus !== 'ended' && !['missile_animating', 'hidden_reveal_animating', 'alkkagi_animating', 'curling_animating'].includes(game.gameStatus)) {
            if (!game.aiTurnStartTime) {
                 game.aiTurnStartTime = now + (1000 + Math.random() * 1500);
            }
            if (now >= game.aiTurnStartTime) {
                await makeAiMove(game);
                game.aiTurnStartTime = undefined;
            }
        }
        
        if (SPECIAL_GAME_MODES.some((m: { mode: GameMode; }) => m.mode === game.mode) || game.isSinglePlayer || game.isTowerChallenge) {
            await updateStrategicGameState(game, now);
        } else if (PLAYFUL_GAME_MODES.some((m: { mode: GameMode }) => m.mode === game.mode)) {
            await updatePlayfulGameState(game, now);
        }
        updatedGames.push(game);
    }
    return updatedGames;
};