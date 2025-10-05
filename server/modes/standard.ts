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
import { processMove } from '../../utils/goLogic.js';
import { getGameResult, endGame } from '../summaryService.js';
import { isFischerGame } from './strategic.js';
import { gnuGoServiceManager } from '../services/gnuGoService.js';
import { makeAiMove } from '../ai/index.js';

export const switchTurnAndUpdateTimers = (game: LiveGameSession, now: number) => {
    const isFischer = isFischerGame(game);
    const hasTimeLimit = (game.settings.timeLimit ?? 0) > 0 || isFischer;

    // 1. Update time for the player who just moved.
    // This logic is now robust: it calculates time used in the turn and subtracts it from the player's total remaining time.
    // The previous buggy implementation was overwriting the total time with the time remaining in just the turn, causing massive desync and incorrect time calculations.
    if (hasTimeLimit && game.turnStartTime) {
        const playerWhoMoved = game.currentPlayer;
        const timeKey = playerWhoMoved === Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
        
        const timeUsed = (now - game.turnStartTime) / 1000; // Time used for the turn in seconds

        if (isFischer) {
            // In Fischer, subtract time used and add the increment.
            game[timeKey] -= timeUsed;
            game[timeKey] += (game.settings.timeIncrement ?? 0);
        } else { // Byoyomi style
            // Only subtract from the main time. Byoyomi time is handled by the timeout logic in strategic.ts.
            if (game[timeKey] > 0) {
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
        
        if (isFischer) {
             game.turnDeadline = now + Math.max(0, game[nextTimeKey]) * 1000;
        } else { // Byoyomi
            if (game[nextTimeKey] > 0) {
                game.turnDeadline = now + game[nextTimeKey] * 1000;
            } else {
                game.turnDeadline = now + (game.settings.byoyomiTime * 1000);
            }
        }
    } else {
        game.turnDeadline = undefined;
        game.turnStartTime = undefined;
    }
};

export const handleStandardAction = async (volatileState: VolatileState, game: LiveGameSession, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult | null> => {
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
            const aiPlayerEnum = game.blackPlayerId === aiPlayerId ? Player.Black : (game.whitePlayerId === aiPlayerId ? Player.White : Player.None);
            
            if (isAiGame && game.currentPlayer === aiPlayerEnum) {
                await gnuGoServiceManager.playUserMove(game.id, { x, y }, myPlayerEnum, game.settings.boardSize, game.moveHistory, game.finalKomi ?? game.settings.komi);
                game.pendingAiMove = makeAiMove(game);
                const aiMove = await game.pendingAiMove;
                game.pendingAiMove = undefined;
                
                if (aiMove.x === -3 && aiMove.y === -3) { // Sentinel for playful AI which handles its own state
                    return {};
                }
                
                if (aiMove.x === -1 && aiMove.y === -1) {
                    game.passCount++;
                    game.lastMove = { x: -1, y: -1 };
                    game.moveHistory.push({ player: game.currentPlayer, x: -1, y: -1 });
                    if (game.passCount >= 2) {
                        await getGameResult(game);
                        return {};
                    }
                } else {
                    const aiResult = processMove(game.boardState, { ...aiMove, player: game.currentPlayer }, game.koInfo, game.moveHistory.length);
                    if (!aiResult.isValid) {
                        console.error(`[AI Error] AI generated an invalid move: ${JSON.stringify(aiMove)} for game ${game.id}. Reason: ${aiResult.reason}`);
                        const winner = game.currentPlayer === Player.Black ? Player.White : Player.Black;
                        await endGame(game, winner, WinReason.Resign);
                        return {};
                    }
                    game.boardState = aiResult.newBoardState;
                    game.lastMove = { x: aiMove.x, y: aiMove.y };
                    game.moveHistory.push({ player: game.currentPlayer, ...aiMove });
                    game.koInfo = aiResult.newKoInfo;
                    game.passCount = 0;
                    if (aiResult.capturedStones.length > 0) {
                         game.captures[game.currentPlayer] += aiResult.capturedStones.length;
                    }
                }
                switchTurnAndUpdateTimers(game, Date.now());
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
            const aiPlayerEnum = game.blackPlayerId === aiPlayerId ? Player.Black : (game.whitePlayerId === aiPlayerId ? Player.White : Player.None);
            
            if (isAiGame && game.currentPlayer === aiPlayerEnum) {
                await gnuGoServiceManager.playUserMove(game.id, { x: -1, y: -1 }, myPlayerEnum, game.settings.boardSize, game.moveHistory, game.finalKomi ?? game.settings.komi);
                game.pendingAiMove = makeAiMove(game);
                const aiMove = await game.pendingAiMove;
                game.pendingAiMove = undefined;

                if (aiMove.x === -3 && aiMove.y === -3) { // Sentinel for playful AI
                    return {};
                }
                
                if (aiMove.x === -1 && aiMove.y === -1) {
                    game.passCount++;
                    game.lastMove = { x: -1, y: -1 };
                    game.moveHistory.push({ player: game.currentPlayer, x: -1, y: -1 });
                    if (game.passCount >= 2) {
                        await getGameResult(game);
                        return {};
                    }
                } else {
                    const aiResult = processMove(game.boardState, { ...aiMove, player: game.currentPlayer }, game.koInfo, game.moveHistory.length);
                    if (!aiResult.isValid) {
                        console.error(`[AI Error] AI generated an invalid move: ${JSON.stringify(aiMove)} for game ${game.id}. Reason: ${aiResult.reason}`);
                        const winner = game.currentPlayer === Player.Black ? Player.White : Player.Black;
                        await endGame(game, winner, WinReason.Resign);
                        return {};
                    }
                    game.boardState = aiResult.newBoardState;
                    game.lastMove = { x: aiMove.x, y: aiMove.y };
                    game.moveHistory.push({ player: game.currentPlayer, ...aiMove });
                    game.koInfo = aiResult.newKoInfo;
                    game.passCount = 0;
                    if (aiResult.capturedStones.length > 0) {
                         game.captures[game.currentPlayer] += aiResult.capturedStones.length;
                    }
                }
                switchTurnAndUpdateTimers(game, Date.now());
            }
            return {};
        }
    }
    return null;
};
