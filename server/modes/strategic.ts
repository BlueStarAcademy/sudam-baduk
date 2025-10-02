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
} from '../../types/index.js';
import { processMove } from '../goLogic.js';
import { getGameResult, endGame } from '../summaryService.js';
import { makeAiHiddenMove, makeAiMove } from '../ai/index.js';
import { gnuGoServiceManager } from '../services/gnuGoService.js';

// Import handlers from specific mode files
import { handleStandardAction } from './standard.js';
import { initializeCapture, updateCaptureState, handleCaptureAction } from './capture.js';
import { updateSpeedState } from './speed.js';
import { initializeBase, updateBaseState, handleBaseAction } from './base.js';
import { initializeHidden, updateHiddenState, handleHiddenAction } from './hidden.js';
import { initializeMissile, updateMissileState, handleMissileAction } from './missile.js';
import { initializeNigiri, updateNigiriState, handleNigiriAction } from './nigiri.js';
import { handleSharedAction, transitionToPlaying } from './shared.js';


// Helper function
export const isFischerGame = (game: LiveGameSession): boolean => {
    // Check the specific timeControl setting first, which is most reliable for SP/Tower
    if (game.settings.timeControl?.type === 'fischer') {
        return true;
    }
    // Fallback for PvP modes
    return game.mode === GameMode.Speed || (game.mode === GameMode.Mix && !!game.settings.mixedModes?.includes(GameMode.Speed));
};

export const initializeStrategicGame = (game: LiveGameSession, neg: any, now: number) => {
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
        transitionToPlaying(game, now);
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

export const updateStrategicGameState = async (game: LiveGameSession, now: number) => {
    if (game.gameStatus === GameStatus.Paused) {
        return; // Don't process timers or AI moves if paused
    }

    if (isFischerGame(game)) {
        updateSpeedState(game, now);
    }
    
    // Timeout logic
    const deadline = Number(game.turnDeadline);
    if (game.gameStatus === GameStatus.Playing && deadline && now > deadline && !isFischerGame(game)) {
        const timedOutPlayer = game.currentPlayer;
        const winner = timedOutPlayer === Player.Black ? Player.White : Player.Black;
        const timeKey = timedOutPlayer === Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
        const byoyomiKey = timedOutPlayer === Player.Black ? 'blackByoyomiPeriodsLeft' : 'whiteByoyomiPeriodsLeft';

        const wasInMainTime = (game as any)[timeKey] > 0;

        if (wasInMainTime) {
            (game as any)[timeKey] = 0; // Enter byoyomi
            if ((game.settings.byoyomiCount ?? 0) > 0) {
                // This is the first byoyomi period, count is NOT decremented yet.
                game.turnDeadline = now + game.settings.byoyomiTime * 1000;
                game.turnStartTime = now;
                return; // Game continues
            }
        } else { // Already in byoyomi
            if ((game.settings.byoyomiCount ?? 0) > 0) {
                // Decrement a byoyomi period because this one has timed out.
                (game as any)[byoyomiKey]--;
                const periodsLeft = (game as any)[byoyomiKey];
                
                // If they have periods left (>= 1), give them another turn.
                // If this decrement made it 0, they had 1 left, and now have 0 left. They lose.
                if (periodsLeft > 0) {
                    game.turnDeadline = now + game.settings.byoyomiTime * 1000;
                    game.turnStartTime = now;
                    return; // Game continues
                }
            }
        }
        
        // If we reach here, it's a timeout loss
        game.lastTimeoutPlayerId = game.currentPlayer === Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
        game.lastTimeoutPlayerIdClearTime = now + 5000;
        
        await endGame(game, winner, WinReason.Timeout);
    }
    
    // AI Game Logic
    const isAiGame = game.isAiGame || game.isSinglePlayer || game.isTowerChallenge;
    const aiPlayerId = isAiGame ? game.player2.id : null;
    const aiPlayerEnum = game.blackPlayerId === aiPlayerId ? Player.Black : (game.whitePlayerId === aiPlayerId ? Player.White : Player.None);
    
    // AI move initiation
    if (isAiGame && game.currentPlayer === aiPlayerEnum && !game.pendingAiMove) {
        if (game.gameStatus === GameStatus.HiddenPlacing) {
            game.gameStatus = GameStatus.AiHiddenThinking;
            game.aiTurnStartTime = now + 1500;
        } else if (game.gameStatus === GameStatus.Playing) {
             makeAiMove(game);
        }
    }

    // AI "thinking" for hidden moves
    if (game.gameStatus === GameStatus.AiHiddenThinking) {
        if (now >= (game.aiTurnStartTime ?? Infinity)) {
            await makeAiHiddenMove(game);
            game.aiTurnStartTime = undefined;
        }
        return;
    }
    
    // Process a completed AI move
    if (isAiGame && game.currentPlayer === aiPlayerEnum && game.pendingAiMove) {
        const aiMove = await game.pendingAiMove;
        game.pendingAiMove = undefined;

        if (aiMove.x === -3 && aiMove.y === -3) { // Special code for "move handled internally by playful AI"
            return;
        }

        const now_ai_move = Date.now();
        const playerWhoMoved = game.currentPlayer;
        const timeKey = playerWhoMoved === Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
        
        // Update time used - CORRECTED LOGIC
        const wasInByoyomi = (game as any)[timeKey] <= 0 && game.settings.byoyomiCount > 0 && !isFischerGame(game);
        if (game.turnStartTime && !wasInByoyomi) {
            const timeUsed = (now_ai_move - game.turnStartTime) / 1000;
            (game as any)[timeKey] -= timeUsed;
            if ((game as any)[timeKey] < 0) (game as any)[timeKey] = 0;
        }
        
        if (isFischerGame(game)) {
            (game as any)[timeKey] += (game.settings.timeIncrement || 0);
        }
        
        if (aiMove.x === -2 && aiMove.y === -2) { // AI resigns
            const winner = game.currentPlayer === Player.Black ? Player.White : Player.Black;
            await endGame(game, winner, WinReason.Resign);
            console.log(`[AI] AI resigns in game ${game.id} due to no legal moves.`);
            return;
        }

        if (aiMove.x === -1 && aiMove.y === -1) { // AI passes
            game.passCount++;
            game.lastMove = { x: -1, y: -1 };
            game.moveHistory.push({ player: game.currentPlayer, x: -1, y: -1 });
            if (game.passCount >= 2) {
                await getGameResult(game);
                return;
            }
        } else {
            const result = processMove(game.boardState, { ...aiMove, player: game.currentPlayer }, game.koInfo, game.moveHistory.length);
            if (result.isValid) {
                game.boardState = result.newBoardState;
                game.lastMove = { x: aiMove.x, y: aiMove.y };
                game.moveHistory.push({ player: game.currentPlayer, ...aiMove });
                
                if (game.isAiGame || game.isSinglePlayer || game.isTowerChallenge) {
                    gnuGoServiceManager.playUserMove(game.id, aiMove, aiPlayerEnum, game.settings.boardSize, game.moveHistory, game.finalKomi ?? game.settings.komi).catch(e => {
                        console.error(`[Strategic Action] Failed to inform GNU Go of AI move for game ${game.id}`, e);
                    });
                }
    
                game.koInfo = result.newKoInfo;
                game.passCount = 0;
    
                if (result.capturedStones.length > 0) {
                     game.captures[game.currentPlayer] += result.capturedStones.length;
                }
    
                if(game.isSinglePlayer || game.isTowerChallenge) {
                    if (game.currentPlayer === Player.White) {
                        game.whiteStonesPlaced = (game.whiteStonesPlaced || 0) + 1;
                    }
                }
    
                const isSpOrTowerCapture = (game.isSinglePlayer || game.isTowerChallenge) && game.gameType === 'capture';
                if (isSpOrTowerCapture) {
                    const blackTarget = game.effectiveCaptureTargets?.[Player.Black] || Infinity;
                    const whiteTarget = game.effectiveCaptureTargets?.[Player.White] || Infinity;

                    if (blackTarget && game.captures[Player.Black] >= blackTarget) {
                        await endGame(game, Player.Black, WinReason.CaptureLimit);
                        return;
                    }
                    if (whiteTarget && game.captures[Player.White] >= whiteTarget) {
                        await endGame(game, Player.White, WinReason.CaptureLimit);
                        return;
                    }
                }

                if (game.gameType === 'survival') {
                    if (game.whiteStoneLimit && (game.whiteStonesPlaced || 0) >= game.whiteStoneLimit) {
                        await endGame(game, Player.Black, WinReason.StoneLimitExceeded);
                        return;
                    }
                }
    
            } else {
                console.error(`[AI Error] AI generated an invalid move: ${JSON.stringify(aiMove)} for game ${game.id}. Reason: ${result.reason}`);
                const winner = game.currentPlayer === Player.Black ? Player.White : Player.Black;
                await endGame(game, winner, WinReason.Resign);
                return;
            }
        }
        
        if (game.autoEndTurnCount && game.moveHistory.length >= game.autoEndTurnCount) {
            await getGameResult(game);
            return;
        }

        // Switch turn
        game.currentPlayer = game.currentPlayer === Player.Black ? Player.White : Player.Black;
        game.missileUsedThisTurn = false;

        if (game.settings.timeLimit > 0) {
            const nextTimeKey = game.currentPlayer === Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
            const isNextInByoyomi = (game as any)[nextTimeKey] <= 0 && game.settings.byoyomiCount > 0 && !isFischerGame(game);
            
            game.turnStartTime = now_ai_move;
            if (isNextInByoyomi) {
                game.turnDeadline = now_ai_move + game.settings.byoyomiTime * 1000;
            } else {
                game.turnDeadline = now_ai_move + (game as any)[nextTimeKey] * 1000;
            }
        }
    }
    
    // Time-based updates for each mode
    updateNigiriState(game, now);
    updateCaptureState(game, now);
    updateBaseState(game, now);
    updateHiddenState(game, now);
    updateMissileState(game, now);
    
    if (isFischerGame(game)) {
        updateSpeedState(game, now);
    }
};