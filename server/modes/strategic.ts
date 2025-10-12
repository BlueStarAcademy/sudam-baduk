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
import { transitionToPlaying, handleSharedAction, isFischerGame, switchTurnAndUpdateTimers } from './shared.js';
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
            await db.saveGame(freshGame);
        }
    } catch (err) {
        console.error(`[AI TURN ERROR] for game ${gameFromAction.id}:`, err);
    }
};

const handleStandardAction = async (volatileState: VolatileState, game: LiveGameSession, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult | null> => {
    const { type, payload } = action;
    const now = Date.now();
    const myPlayerEnum = user.id === game.blackPlayerId ? Player.Black : (user.id === game.whitePlayerId ? Player.White : Player.None);
    const isMyTurn = myPlayerEnum === game.currentPlayer;

    switch (type) {
        case 'PLACE_STONE': {
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
            
            if(game.isSinglePlayer || game.isTowerChallenge) {
                if (game.currentPlayer === Player.Black) {
                    game.blackStonesPlaced = (game.blackStonesPlaced || 0) + 1;
                }
            }

            if (isHidden) {
                if (!game.hiddenMoves) game.hiddenMoves = {};
                game.hiddenMoves[game.moveHistory.length - 1] = true;
                const myHiddenUsedKey = user.id === game.player1.id ? 'hidden_stones_used_p1' : 'hidden_stones_used_p2';
                (game as any)[myHiddenUsedKey] = ((game as any)[myHiddenUsedKey] || 0) + 1;
                game.gameStatus = GameStatus.Playing;
            }

            if (result.capturedStones.length > 0) {
                game.captures[game.currentPlayer] += result.capturedStones.length;
            }

            if (
                game.mode === GameMode.Capture ||
                (game.mode === GameMode.Mix && game.settings.mixedModes?.includes(GameMode.Capture)) ||
                ((game.isSinglePlayer || game.isTowerChallenge) && game.gameType === 'capture')
            ) {
                const target = game.effectiveCaptureTargets?.[game.currentPlayer];
                if (target && game.captures[game.currentPlayer] >= target) {
                    await endGame(game, game.currentPlayer, WinReason.CaptureLimit);
                    return {};
                }
            }

            if(game.isSinglePlayer || game.isTowerChallenge) {
                if (game.blackStoneLimit && (game.blackStonesPlaced || 0) >= game.blackStoneLimit) {
                    await endGame(game, Player.White, WinReason.StoneLimitExceeded);
                    return {};
                }
            }

            switchTurnAndUpdateTimers(game, now);
            
            const isAiGame = game.isAiGame || game.isSinglePlayer || game.isTowerChallenge;
            const aiPlayerId = isAiGame ? game.player2.id : null;
            const aiPlayerEnum = aiPlayerId ? (game.blackPlayerId === aiPlayerId ? Player.Black : Player.White) : Player.None;
            
            if (isAiGame && game.currentPlayer === aiPlayerEnum) {
                handleAiTurn(game, { x, y }, myPlayerEnum);
            }

            return {};
        }
        case 'PASS_TURN': {
             if (!isMyTurn || game.gameStatus !== GameStatus.Playing) {
                return { error: 'Not your turn to pass.' };
            }

            game.passCount++;
            game.lastMove = { x: -1, y: -1 };
            game.moveHistory.push({ player: game.currentPlayer, x: -1, y: -1 });

            if (game.passCount >= 2) {
                await getGameResult(game);
                return {};
            }

            switchTurnAndUpdateTimers(game, now);
            
            const isAiGame = game.isAiGame || game.isSinglePlayer || game.isTowerChallenge;
            const aiPlayerId = isAiGame ? game.player2.id : null;
            const aiPlayerEnum = aiPlayerId ? (game.blackPlayerId === aiPlayerId ? Player.Black : Player.White) : Player.None;
            
            if (isAiGame && game.currentPlayer === aiPlayerEnum) {
                handleAiTurn(game, { x: -1, y: -1 }, myPlayerEnum);
            }
            return {};
        }
    }
    return null;
};


export const handleStrategicGameAction = async (volatileState: VolatileState, game: LiveGameSession, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult | null> => {
    const sharedResult = await handleSharedAction(volatileState, game, action, user);
    if (sharedResult) return sharedResult;

    const standardResult = await handleStandardAction(volatileState, game, action, user);
    if (standardResult) return standardResult;

    const baseResult = handleBaseAction(game, action, user);
    if (baseResult) return baseResult;

    const captureResult = handleCaptureAction(game, action, user);
    if (captureResult) return captureResult;

    const nigiriResult = handleNigiriAction(game, action, user);
    if (nigiriResult) return nigiriResult;
    
    const hiddenResult = handleHiddenAction(game, action, user);
    if (hiddenResult) return hiddenResult;

    const missileResult = handleMissileAction(game, action, user);
    if (missileResult) return missileResult;

    return null;
};

export const initializeStrategicGame = async (game: LiveGameSession, neg: Negotiation, now: number) => {
    const { mode, settings } = neg;

    if (game.isAiGame && !settings.player1Color) {
        settings.player1Color = Player.Black;
    }

    if (settings.player1Color) {
        game.blackPlayerId = settings.player1Color === Player.Black ? game.player1.id : game.player2.id;
        game.whitePlayerId = settings.player1Color === Player.White ? game.player1.id : game.player2.id;
        transitionToPlaying(game, now);
    } else {
        initializeNigiri(game, now);
    }
    
    if (mode === GameMode.Capture || settings.mixedModes?.includes(GameMode.Capture)) {
        initializeCapture(game, now);
    }
    if (mode === GameMode.Base || settings.mixedModes?.includes(GameMode.Base)) {
        initializeBase(game, now);
    }
    if (mode === GameMode.Hidden || settings.mixedModes?.includes(GameMode.Hidden) || game.isSinglePlayer || game.isTowerChallenge) {
        initializeHidden(game);
    }
    if (mode === GameMode.Missile || settings.mixedModes?.includes(GameMode.Missile) || game.isSinglePlayer || game.isTowerChallenge) {
        initializeMissile(game);
    }
};

export const updateStrategicGameState = async (game: LiveGameSession, now: number) => {
    updateNigiriState(game, now);
    updateCaptureState(game, now);
    updateBaseState(game, now);
    updateHiddenState(game, now);
    updateMissileState(game, now);

    const isFischer = isFischerGame(game);
    if (isFischer) {
        updateSpeedState(game, now);
    } else if ((game.settings.timeLimit ?? 0) > 0 && game.gameStatus === GameStatus.Playing && game.turnDeadline && now > game.turnDeadline) {
        const timedOutPlayer = game.currentPlayer;
        const winner = timedOutPlayer === Player.Black ? Player.White : Player.Black;
        const timeKey = timedOutPlayer === Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
        const byoyomiKey = timedOutPlayer === Player.Black ? 'blackByoyomiPeriodsLeft' : 'whiteByoyomiPeriodsLeft';

        const wasInMainTime = game[timeKey] > 0;
        if (wasInMainTime) {
            game[timeKey] = 0; // Enter byoyomi
            if ((game.settings.byoyomiCount ?? 0) > 0) {
                game.turnStartTime = now;
                game.turnDeadline = now + (game.settings.byoyomiTime * 1000);
            } else {
                await endGame(game, winner, WinReason.Timeout);
            }
        } else {
            game[byoyomiKey]--;
            if (game[byoyomiKey] >= 0) {
                game.turnStartTime = now;
                game.turnDeadline = now + (game.settings.byoyomiTime * 1000);
            } else {
                await endGame(game, winner, WinReason.Timeout);
            }
        }
    }
};