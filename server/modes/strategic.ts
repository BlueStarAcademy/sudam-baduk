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
} from '../../types/index.js';
// FIX: Corrected import path for processMove
import { processMove } from '../../utils/goLogic.js';
import { getGameResult, endGame } from '../summaryService.js';
import { makeAiMove } from '../ai/index.js';
import { gnuGoServiceManager } from '../services/gnuGoService.js';

// Import handlers from specific mode files
import { handleStandardAction, switchTurnAndUpdateTimers } from './standard.js';
import { initializeCapture, updateCaptureState, handleCaptureAction } from './capture.js';
import { updateSpeedState } from './speed.js';
import { initializeBase, updateBaseState, handleBaseAction } from './base.js';
import { initializeHidden, updateHiddenState, handleHiddenAction } from './hidden.js';
import { initializeMissile, updateMissileState, handleMissileAction } from './missile.js';
import { initializeNigiri, updateNigiriState, handleNigiriAction } from './nigiri.js';
import { handleSharedAction, transitionToPlaying } from './shared.js';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';


// Helper function
export const isFischerGame = (game: LiveGameSession): boolean => {
    // Check the specific timeControl setting first, which is most reliable for SP/Tower
    if (game.settings.timeControl?.type === 'fischer') {
        return true;
    }
    // Fallback for PvP modes
    return game.mode === GameMode.Speed || (game.mode === GameMode.Mix && !!game.settings.mixedModes?.includes(GameMode.Speed));
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
        if (game.settings.timeLimit > 0) {
            game.turnDeadline = now + game.blackTimeLeft * 1000;
            game.turnStartTime = now;
        }
    }
    
    return game;
};

export const handleStrategicGameAction = async (volatileState: VolatileState, session: LiveGameSession, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult | null> => {
    const { type, payload } = action;
    const now = Date.now();

    if (type === 'PAUSE_GAME' || type === 'RESUME_GAME') {
        if (!session.isAiGame && !session.isSinglePlayer && !session.isTowerChallenge) {
            return { error: "PvP games cannot be paused." };
        }
        const isPaused = session.gameStatus === GameStatus.Paused;
        if (type === 'PAUSE_GAME' && !isPaused) {
                session.gameStatus = GameStatus.Paused;
                if (session.turnDeadline) {
                    session.pausedTurnTimeLeft = (session.turnDeadline - now) / 1000;
                    session.turnDeadline = undefined;
                    session.turnStartTime = undefined;
                }
            } else if (type === 'RESUME_GAME' && isPaused) {
                session.gameStatus = GameStatus.Playing;
                session.promptForMoreStones = false; // Always clear prompt on resume
                if (session.pausedTurnTimeLeft) {
                    const now = Date.now();
                    session.turnDeadline = now + session.pausedTurnTimeLeft * 1000;
                    session.turnStartTime = now;
                    session.pausedTurnTimeLeft = undefined;
                }
            }
        return {};
    }

    // Timer update
    if (type === 'PLACE_STONE' || type === 'PASS_TURN') {
        const result = await handleStandardAction(volatileState, session, action, user);
        if (result) return result;
    }

    const sharedResult = await handleSharedAction(volatileState, session, action, user);
    if (sharedResult) return sharedResult;

    const nigiriResult = handleNigiriAction(session, action, user);
    if (nigiriResult) return nigiriResult;
    
    const captureResult = handleCaptureAction(session, action, user);
    if (captureResult) return captureResult;

    const baseResult = handleBaseAction(session, action, user);
    if (baseResult) return baseResult;

    const hiddenResult = handleHiddenAction(volatileState, session, action, user);
    if (hiddenResult) return hiddenResult;

    const missileResult = handleMissileAction(session, action, user);
    if (missileResult) return missileResult;

    return null;
};

export const updateStrategicGameState = async (game: LiveGameSession, now: number, volatileState: VolatileState) => {
    if (game.gameStatus === GameStatus.Paused) {
        return;
    }
    
    const isTimedGame = (game.settings.timeLimit ?? 0) > 0 || (game.settings.timeControl && (game.settings.timeControl.mainTime > 0 || game.settings.timeControl.increment));

    if (isFischerGame(game)) {
        updateSpeedState(game, now);
    } else if (isTimedGame && game.gameStatus === GameStatus.Playing && game.turnDeadline && now > game.turnDeadline) {
        const timedOutPlayer = game.currentPlayer;
        const winner = timedOutPlayer === Player.Black ? Player.White : Player.Black;
        const timeKey = timedOutPlayer === Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
        const byoyomiKey = timedOutPlayer === Player.Black ? 'blackByoyomiPeriodsLeft' : 'whiteByoyomiPeriodsLeft';

        const byoyomiTime = game.settings.byoyomiTime ?? 30;
        const byoyomiCount = game.settings.byoyomiCount ?? 0;

        const wasInMainTime = game[timeKey] > 0;

        if (wasInMainTime) {
            game[timeKey] = 0; // Enter byoyomi
            if (byoyomiCount > 0) {
                game.turnStartTime = now;
                game.turnDeadline = now + (byoyomiTime > 0 ? byoyomiTime : 30) * 1000;
            } else {
                game.lastTimeoutPlayerId = timedOutPlayer === Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
                game.lastTimeoutPlayerIdClearTime = now + 5000;
                await endGame(game, winner, WinReason.Timeout);
            }
        } else { // Already in byoyomi
            if (byoyomiCount > 0) {
                game[byoyomiKey]--;
                if (game[byoyomiKey] >= 0) { // Can be 0 after decrement
                    game.turnStartTime = now;
                    game.turnDeadline = now + (byoyomiTime > 0 ? byoyomiTime : 30) * 1000;
                } else {
                    game.lastTimeoutPlayerId = timedOutPlayer === Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
                    game.lastTimeoutPlayerIdClearTime = now + 5000;
                    await endGame(game, winner, WinReason.Timeout);
                }
            } else {
                game.lastTimeoutPlayerId = timedOutPlayer === Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
                game.lastTimeoutPlayerIdClearTime = now + 5000;
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
