// server/modes/strategic.ts

import {
    type LiveGameSession,
    type ServerAction,
    type User,
    type HandleActionResult,
    Player,
    GameStatus,
    WinReason,
    GameMode,
    type Move,
    Point,
    UserStatusInfo,
    type Negotiation
} from '../../types/index.js';
import { processMove } from '../../utils/goLogic';
import { getGameResult, endGame } from '../summaryService.js';
import { makeAiMove } from '../ai/index.js';
import * as db from '../db.js';
// FIX: Import 'updateSharedGameState' to resolve a reference error.
import { transitionToPlaying, handleSharedAction, isFischerGame, switchTurnAndUpdateTimers, updateSharedGameState } from './shared.js';
import { initializeNigiri, updateNigiriState, handleNigiriAction } from './nigiri.js';
import { initializeCapture, updateCaptureState, handleCaptureAction } from './capture.js';
import { updateSpeedState } from './speed.js';
import { initializeBase, updateBaseState, handleBaseAction } from './base.js';
import { initializeHidden, updateHiddenState, handleHiddenAction } from './hidden.js';
import { initializeMissile, updateMissileState, handleMissileAction } from './missile.js';
import { VolatileState } from '../../types/api.js';
import { getNewActionButtons } from '../services/actionButtonService.js';

export const handleAiTurn = async (gameFromAction: LiveGameSession, userMove: { x: number, y: number }, userPlayerEnum: Player) => {
    try {
        const gameId = gameFromAction.id;
        
        const aiPlayerId = gameFromAction.player2.id;
        const aiPlayerEnum = gameFromAction.blackPlayerId === aiPlayerId ? Player.Black : (gameFromAction.whitePlayerId === aiPlayerId ? Player.White : Player.None);

        if (gameFromAction.currentPlayer !== aiPlayerEnum) return;

        const aiMove = await makeAiMove(gameFromAction) as (Point & { isHidden?: boolean });

        const freshGame = await db.getLiveGame(gameId);
        if (!freshGame || freshGame.currentPlayer !== aiPlayerEnum) {
            console.log(`[AI Turn] Game state changed or game ended while AI was thinking. Aborting AI move for game ${gameId}.`);
            return;
        }

        if (aiMove.isHidden) {
            freshGame.gameStatus = GameStatus.AiHiddenThinking;
            freshGame.aiTurnStartTime = Date.now();
            await db.saveGame(freshGame);

            setTimeout(async () => {
                try {
                    const gameAfterWait = await db.getLiveGame(gameId);
                    if (!gameAfterWait || gameAfterWait.gameStatus !== GameStatus.AiHiddenThinking) return;

                    gameAfterWait.aiHiddenStoneUsedThisGame = true;

                    const result = processMove(gameAfterWait.boardState, { x: aiMove.x, y: aiMove.y, player: aiPlayerEnum }, gameAfterWait.koInfo, gameAfterWait.moveHistory.length);
                    
                    if (!result.isValid) {
                        console.error(`[AI HIDDEN MOVE ERROR] AI generated an invalid move: ${JSON.stringify(aiMove)} for game ${gameAfterWait.id}. Reason: ${result.reason}. AI resigns.`);
                        const winner = aiPlayerEnum === Player.Black ? Player.White : Player.Black;
                        await endGame(gameAfterWait, winner, WinReason.Resign);
                        await db.saveGame(gameAfterWait);
                        return;
                    }

                    gameAfterWait.boardState = result.newBoardState;
                    gameAfterWait.lastMove = { x: aiMove.x, y: aiMove.y };
                    gameAfterWait.moveHistory.push({ player: aiPlayerEnum, x: aiMove.x, y: aiMove.y });
                    
                    if (!gameAfterWait.hiddenMoves) gameAfterWait.hiddenMoves = {};
                    gameAfterWait.hiddenMoves[gameAfterWait.moveHistory.length - 1] = true;

                    if (result.capturedStones.length > 0) {
                        gameAfterWait.captures[aiPlayerEnum] += result.capturedStones.length;
                    }

                    gameAfterWait.koInfo = result.newKoInfo;
                    gameAfterWait.passCount = 0;
                    gameAfterWait.gameStatus = GameStatus.Playing;
                    switchTurnAndUpdateTimers(gameAfterWait, Date.now());
                    gameAfterWait.aiTurnStartTime = undefined;
                    await db.saveGame(gameAfterWait);

                } catch (e) {
                    console.error(`[AI HIDDEN MOVE ERROR] for game ${gameId}:`, e);
                }
            }, 5000); // 5-second thinking delay
        } else {
            if (aiMove.x === -3 && aiMove.y === -3) { // Sentinel for playful AI
                await db.saveGame(freshGame); // Playful AI modifies game state directly
                return;
            }

            if (aiMove.x === -1 && aiMove.y === -1) { // AI Passed
                freshGame.passCount++;
                freshGame.lastMove = { x: -1, y: -1 };
                freshGame.moveHistory.push({ player: freshGame.currentPlayer, x: -1, y: -1 });
                if (freshGame.passCount >= 2) {
                    await getGameResult(freshGame);
                    await db.saveGame(freshGame);
                    return;
                }
            } else { // AI made a regular move
                const result = processMove(freshGame.boardState, { ...aiMove, player: freshGame.currentPlayer }, freshGame.koInfo, freshGame.moveHistory.length);
                if (!result.isValid) {
                    console.error(`[AI Error] AI generated an invalid move: ${JSON.stringify(aiMove)} for game ${freshGame.id}. Reason: ${result.reason}. AI resigns.`);
                    const winner = freshGame.currentPlayer === Player.Black ? Player.White : Player.Black;
                    await endGame(freshGame, winner, WinReason.Resign);
                    await db.saveGame(freshGame);
                    return;
                }
                freshGame.boardState = result.newBoardState;
                freshGame.lastMove = { x: aiMove.x, y: aiMove.y };
                freshGame.moveHistory.push({ player: freshGame.currentPlayer, ...aiMove });
                freshGame.koInfo = result.newKoInfo;
                freshGame.passCount = 0;
                if (result.capturedStones.length > 0) {
                     freshGame.captures[freshGame.currentPlayer] += result.capturedStones.length;
                }
            }
            switchTurnAndUpdateTimers(freshGame, Date.now());
            freshGame.aiTurnStartTime = undefined;
            await db.saveGame(freshGame);
        }
    } catch (err) {
        console.error(`[AI TURN ERROR] for game ${gameFromAction.id}:`, err);
    }
};

export const initializeStrategicGame = async (game: LiveGameSession, neg: Negotiation, now: number) => {
    if (game.isSinglePlayer || game.isTowerChallenge) {
        // Single player games always have the human as black and start immediately.
        game.blackPlayerId = neg.challenger.id;
        game.whitePlayerId = neg.opponent.id;
        
        // This is the FIX: Call mode-specific initializers for AI/SP games too.
        if (game.mode === GameMode.Capture) {
            initializeCapture(game, now);
        }
        // No special initializers needed for AI Standard, Speed, Base, etc.
        // as they don't have pre-game phases like Nigiri or Bidding.
        
    } else { // PvP logic
        switch (game.mode) {
            case GameMode.Standard:
                initializeNigiri(game, now);
                break;
            case GameMode.Capture:
                initializeCapture(game, now);
                break;
            case GameMode.Base:
                initializeBase(game, now);
                break;
            case GameMode.Speed:
            case GameMode.Hidden:
            case GameMode.Missile:
            case GameMode.Mix:
                initializeNigiri(game, now); // Most strategic modes use Nigiri
                break;
        }
    }
    
    // Sub-initializers that apply to both PvP and SP/AI games
    if (game.mode === GameMode.Hidden || (game.mode === GameMode.Mix && game.settings.mixedModes?.includes(GameMode.Hidden)) || ((game.isSinglePlayer || game.isTowerChallenge) && game.settings.hiddenStoneCount && game.settings.hiddenStoneCount > 0)) {
        initializeHidden(game);
    }
    if (game.mode === GameMode.Missile || (game.mode === GameMode.Mix && game.settings.mixedModes?.includes(GameMode.Missile)) || (game.isSinglePlayer && game.settings.missileCount)) {
        initializeMissile(game);
    }
};

export const updateStrategicGameState = async (game: LiveGameSession, now: number) => {
    if (updateSharedGameState(game, now)) return;

    // Mode-specific state updates
    updateNigiriState(game, now);
    updateCaptureState(game, now);
    updateSpeedState(game, now);
    updateBaseState(game, now);
    updateHiddenState(game, now);
    updateMissileState(game, now);
};

export const handleStrategicGameAction = async (volatileState: VolatileState, game: LiveGameSession, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult | null> => {
    const { type, payload } = action;
    const now = Date.now();
    const myPlayerEnum = user.id === game.blackPlayerId ? Player.Black : (user.id === game.whitePlayerId ? Player.White : Player.None);
    const isMyTurn = myPlayerEnum === game.currentPlayer;

    const sharedResult = await handleSharedAction(volatileState, game, action, user);
    if (sharedResult) return sharedResult;

    if (type === 'PLACE_STONE') {
        if (!isMyTurn || (game.gameStatus !== GameStatus.Playing && game.gameStatus !== GameStatus.HiddenPlacing)) {
            return { error: 'Not your turn or game is not in a playable state.' };
        }

        const { x, y, isHidden } = payload;

        const result = processMove(game.boardState, { x, y, player: game.currentPlayer }, game.koInfo, game.moveHistory.length);

        if (!result.isValid) {
            return { error: `Invalid move: ${result.reason}` };
        }
        
        game.boardState = result.newBoardState;
        game.koInfo = result.newKoInfo;
        game.lastMove = { x, y };
        game.moveHistory.push({ player: game.currentPlayer, x, y });
        game.passCount = 0;
        
        if (isHidden) {
            const myHiddenUsedKey = user.id === game.player1.id ? 'hidden_stones_used_p1' : 'hidden_stones_used_p2';
            (game as any)[myHiddenUsedKey] = ((game as any)[myHiddenUsedKey] || 0) + 1;
            if (!game.hiddenMoves) game.hiddenMoves = {};
            game.hiddenMoves[game.moveHistory.length - 1] = true;
            game.gameStatus = GameStatus.Playing;
            game.itemUseDeadline = undefined;
            if (game.pausedTurnTimeLeft) {
                const timeKey = game.currentPlayer === Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                game[timeKey] = game.pausedTurnTimeLeft;
            }
        }
        
        if (result.capturedStones.length > 0) {
            game.justCaptured = [];
            
            for (const stone of result.capturedStones) {
                const moveIndex = game.moveHistory.findIndex(m => m.x === stone.x && m.y === stone.y);
                const wasHidden = !!(moveIndex !== -1 && game.hiddenMoves?.[moveIndex]);
                game.justCaptured.push({ point: stone, player: game.boardState[stone.y][stone.x], wasHidden });
                
                if (wasHidden) game.hiddenStoneCaptures[game.currentPlayer]++;
                else {
                    const isBaseStone = game.baseStones?.some(bs => bs.x === stone.x && bs.y === stone.y);
                    if (isBaseStone) game.baseStoneCaptures[game.currentPlayer]++;
                    else game.captures[game.currentPlayer]++;
                }
            }
            game.animation = { type: 'capture', stones: result.capturedStones, startTime: now, duration: 1000 };
        }

        if (game.mode === GameMode.Capture && (game.captures[game.currentPlayer] >= (game.effectiveCaptureTargets?.[game.currentPlayer] ?? Infinity))) {
            await endGame(game, game.currentPlayer, WinReason.CaptureLimit);
            return {};
        }

        switchTurnAndUpdateTimers(game, now);
        
        if (game.isAiGame || game.isSinglePlayer || game.isTowerChallenge) {
            game.aiTurnStartTime = Date.now();
            void handleAiTurn(game, { x, y }, myPlayerEnum);
        }
        
        return {};
    }

    if (type === 'PASS_TURN') {
        if (!isMyTurn) return { error: 'Not your turn.' };
        game.passCount++;
        game.lastMove = { x: -1, y: -1 };
        game.moveHistory.push({ player: game.currentPlayer, x: -1, y: -1 });

        if (game.passCount >= 2) {
            await getGameResult(game);
        } else {
            switchTurnAndUpdateTimers(game, now);
            if (game.isAiGame || game.isSinglePlayer || game.isTowerChallenge) {
                game.aiTurnStartTime = Date.now();
                void handleAiTurn(game, { x: -1, y: -1 }, myPlayerEnum);
            }
        }
        return {};
    }
    
    if (type === 'USE_ACTION_BUTTON') {
        const { buttonName } = payload;
        const myActionButtons = game.currentActionButtons[user.id];
        const button = myActionButtons.find(b => b.name === buttonName);
        
        if (!button || game.actionButtonUsedThisCycle?.[user.id]) return { error: 'Cannot use this action now.' };
        
        if (game.actionButtonUsedThisCycle) {
            game.actionButtonUsedThisCycle[user.id] = true;
        }
        if (!game.mannerScoreChanges) game.mannerScoreChanges = {};
        const change = button.type === 'manner' ? 1 : -1;
        game.mannerScoreChanges[user.id] = (game.mannerScoreChanges[user.id] || 0) + change;
        
        return { clientResponse: { actionInfo: { message: button.message, userNickname: user.nickname } } };
    }
    
    const nigiriResult = handleNigiriAction(game, action, user);
    if (nigiriResult) return nigiriResult;

    const captureResult = handleCaptureAction(game, action, user);
    if (captureResult) return captureResult;
    
    const baseResult = handleBaseAction(game, action, user);
    if (baseResult) return baseResult;
    
    const hiddenResult = handleHiddenAction(game, action, user);
    if (hiddenResult) return hiddenResult;
    
    const missileResult = handleMissileAction(game, action, user);
    if (missileResult) return missileResult;

    return null;
};