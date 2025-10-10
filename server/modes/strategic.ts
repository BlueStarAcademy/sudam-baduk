import {
    type LiveGameSession,
    type VolatileState,
    type ServerAction,
    type User,
    type HandleActionResult,
    Player,
    GameStatus,
    WinReason,
    GameMode,
    type Move,
    Point
} from '../../types/index.js';
import { processMove } from '../../utils/goLogic';
import { getGameResult, endGame } from '../summaryService.js';
import { gnuGoServiceManager } from '../services/gnuGoService.js';
import { makeAiMove } from '../ai/index.js';
import * as db from '../db.js';
import { transitionToPlaying } from './shared.js';
import { initializeNigiri, updateNigiriState, handleNigiriAction } from './nigiri.js';
import { initializeCapture, updateCaptureState, handleCaptureAction } from './capture.js';
import { updateSpeedState } from './speed.js';
import { initializeBase, updateBaseState, handleBaseAction } from './base.js';
import { initializeHidden, updateHiddenState, handleHiddenAction } from './hidden.js';
import { initializeMissile, updateMissileState, handleMissileAction } from './missile.js';
import { handleSharedAction } from './shared.js';
import { handleAiTurn } from '../actions/negotiationActions.js';

export const isFischerGame = (game: LiveGameSession): boolean => {
    const isTimeControlFischer = game.settings.timeControl?.type === 'fischer';
    const isLegacyFischer = game.mode === GameMode.Speed || (game.mode === GameMode.Mix && !!game.settings.mixedModes?.includes(GameMode.Speed));
    return isTimeControlFischer || isLegacyFischer;
};

export const switchTurnAndUpdateTimers = (game: LiveGameSession, now: number) => {
    const isFischer = isFischerGame(game);
    const hasTimeLimit = (game.settings.timeLimit ?? 0) > 0 || !!game.settings.timeControl;

    // 1. Update time for the player who just moved.
    if (hasTimeLimit && game.turnStartTime) {
        const playerWhoMoved = game.currentPlayer;
        const timeKey = playerWhoMoved === Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
        const byoyomiKey = playerWhoMoved === Player.Black ? 'blackByoyomiPeriodsLeft' : 'whiteByoyomiPeriodsLeft';
        
        const timeUsed = (now - game.turnStartTime) / 1000;

        if (isFischer) {
            game[timeKey] -= timeUsed;
            game[timeKey] += (game.settings.timeIncrement ?? 0);
        } else { // Byoyomi style
            if (game[timeKey] > 0) {
                // In main time
                game[timeKey] -= timeUsed;
            }
        }
        game[timeKey] = Math.max(0, game[timeKey]);
    }

    // 2. Switch player
    game.currentPlayer = game.currentPlayer === Player.Black ? Player.White : Player.Black;
    game.missileUsedThisTurn = false;
    
    // 3. Set up next turn's deadline
    if (hasTimeLimit) {
        game.turnStartTime = now;
        const nextPlayer = game.currentPlayer;
        const nextTimeKey = nextPlayer === Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
        const nextByoyomiKey = nextPlayer === Player.Black ? 'blackByoyomiPeriodsLeft' : 'whiteByoyomiPeriodsLeft';
        
        if (isFischer) {
             game.turnDeadline = now + Math.max(0, game[nextTimeKey]) * 1000;
        } else { // Byoyomi
            if (game[nextTimeKey] > 0) {
                // Next player still has main time
                game.turnDeadline = now + game[nextTimeKey] * 1000;
            } else {
                // Next player is in byoyomi
                if ((game[nextByoyomiKey] ?? 0) > 0) {
                    game.turnDeadline = now + (game.settings.byoyomiTime * 1000);
                } else {
                    // This player is already out of time. The game loop's timeout check will end the game.
                    game.turnDeadline = now; 
                }
            }
        }
    } else {
        game.turnDeadline = undefined;
        game.turnStartTime = undefined;
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


export const initializeStrategicGame = async (game: LiveGameSession, neg: any, now: number) => {
    const p1 = game.player1;
    const p2 = game.player2;
    
    // Determine black player
    if (game.isAiGame || game.isSinglePlayer || game.isTowerChallenge) {
        const humanPlayerColor = neg.settings.player1Color || Player.Black;
        if (humanPlayerColor === Player.Black) {
            game.blackPlayerId = p1.id;
            game.whitePlayerId = p2.id;
        } else {
            game.whitePlayerId = p1.id;
            game.blackPlayerId = p2.id;
        }
        // transitionToPlaying is now called at the end of the intro modal for SP games
        if (!game.isSinglePlayer && !game.isTowerChallenge) {
            transitionToPlaying(game, now);
        }
    } else {
        // Nigiri for player games in standard mode
        if (game.mode === GameMode.Standard) {
             initializeNigiri(game, now);
        } else {
            // For other strategic modes, default to P1 as black unless specified
            const p1Color = neg.settings.player1Color || Player.Black;
            if (p1Color === Player.Black) {
                game.blackPlayerId = p1.id;
                game.whitePlayerId = p2.id;
            } else {
                game.whitePlayerId = p1.id;
                game.blackPlayerId = p2.id;
            }
            transitionToPlaying(game, now);
        }
    }
    
    // Mode specific initializations
    if (game.isSinglePlayer || game.isTowerChallenge) {
        if (game.settings.missileCount) initializeMissile(game);
        if (game.settings.hiddenStoneCount) initializeHidden(game);
    } else {
        switch (game.mode) {
            case GameMode.Capture:
                initializeCapture(game, now);
                break;
            case GameMode.Base:
                initializeBase(game, now);
                break;
            case GameMode.Hidden:
                initializeHidden(game);
                break;
            case GameMode.Missile:
                initializeMissile(game);
                break;
            case GameMode.Mix:
                if (game.settings.mixedModes?.includes(GameMode.Base)) initializeBase(game, now);
                if (game.settings.mixedModes?.includes(GameMode.Capture)) initializeCapture(game, now);
                if (game.settings.mixedModes?.includes(GameMode.Hidden)) initializeHidden(game);
                if (game.settings.mixedModes?.includes(GameMode.Missile)) initializeMissile(game);
                break;
        }
    }
    
    if (game.gameStatus === GameStatus.Playing && game.currentPlayer === Player.None) {
        game.currentPlayer = Player.Black;
        if (game.settings.timeLimit > 0 || game.settings.timeControl) {
            game.turnDeadline = now + (game.settings.timeControl?.mainTime ?? game.settings.timeLimit) * 60 * 1000;
            game.turnStartTime = now;
        }
    }
    
    return game;
};

export const updateStrategicGameState = async (game: LiveGameSession, now: number, volatileState: VolatileState) => {
    if (game.gameStatus === GameStatus.Paused) return;

    if (game.gameStatus === GameStatus.AiHiddenThinking && game.aiTurnStartTime) {
        if (now > game.aiTurnStartTime + 5000) {
            // This logic is now handled inside the setTimeout in handleAiTurn.
            // Leaving a placeholder in case we need to add a failsafe.
        }
        return; // Don't process other timers while AI is "thinking"
    }

    const isTimedGame = !!game.settings.timeControl || (game.settings.timeLimit ?? 0) > 0;

    if (isTimedGame && game.gameStatus === GameStatus.Playing && game.turnDeadline && now > game.turnDeadline) {
        const timedOutPlayer = game.currentPlayer;
        const winner = timedOutPlayer === Player.Black ? Player.White : Player.Black;
        
        const timeKey = timedOutPlayer === Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
        const byoyomiKey = timedOutPlayer === Player.Black ? 'blackByoyomiPeriodsLeft' : 'whiteByoyomiPeriodsLeft';

        const byoyomiTime = game.settings.byoyomiTime ?? 30;
        const byoyomiCount = game.settings.byoyomiCount ?? 0;
        
        if (game[timeKey] > 0) { // Main time ran out
            game[timeKey] = 0;
            if (byoyomiCount > 0) {
                game[byoyomiKey] = byoyomiCount;
                game.turnStartTime = now;
                game.turnDeadline = now + (byoyomiTime > 0 ? byoyomiTime : 30) * 1000;
            } else { // No byoyomi
                await endGame(game, winner, WinReason.Timeout);
            }
        } else { // Byoyomi time ran out
            if (byoyomiCount > 0) {
                if (game[byoyomiKey] > 0) {
                    game[byoyomiKey]--; // Decrement a period
                    game.turnStartTime = now;
                    game.turnDeadline = now + (byoyomiTime > 0 ? byoyomiTime : 30) * 1000;
                } else {
                    await endGame(game, winner, WinReason.Timeout);
                }
            } else { // Should have already been caught by main time, but as a failsafe
                await endGame(game, winner, WinReason.Timeout);
            }
        }
    }

    // Time-based updates for each mode
    updateNigiriState(game, now);
    updateCaptureState(game, now);
    updateBaseState(game, now);
    updateHiddenState(game, now);
    updateMissileState(game, now);
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
    
    const hiddenResult = handleHiddenAction(volatileState, game, action, user);
    if (hiddenResult) return hiddenResult;

    const missileResult = handleMissileAction(game, action, user);
    if (missileResult) return missileResult;

    return null;
};