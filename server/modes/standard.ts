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
import { getOmokLogic } from '../omokLogic.js';
import { gnuGoServiceManager } from '../services/gnuGoService.js';

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

            // For Omok/Ttamok
            if (game.mode === GameMode.Omok || game.mode === GameMode.Ttamok) {
                const omokLogic = getOmokLogic(game);
                if (game.settings.has33Forbidden && game.currentPlayer === Player.Black && omokLogic.is33(x, y, game.boardState)) {
                    return { error: '3-3 is forbidden for Black.' };
                }
            }
            
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
                game[myHiddenUsedKey] = (game[myHiddenUsedKey] || 0) + 1;
                game.gameStatus = GameStatus.Playing;
            }

            if (result.capturedStones.length > 0) {
                game.captures[game.currentPlayer] += result.capturedStones.length;
            }

            // After server state is updated, inform GnuGo
            if (game.isAiGame || game.isSinglePlayer || game.isTowerChallenge) {
                gnuGoServiceManager.playUserMove(game.id, { x, y }, myPlayerEnum, game.settings.boardSize, game.moveHistory, game.finalKomi ?? game.settings.komi).catch(e => {
                    console.error(`[Strategic Action] Failed to inform GNU Go of move for game ${game.id}`, e);
                });
            }

            // Check for Omok/Ttamok win conditions
            if (game.mode === GameMode.Omok || game.mode === GameMode.Ttamok) {
                const omokLogic = getOmokLogic(game);
                const winCheck = omokLogic.checkWin(x, y, game.boardState);
                if (winCheck) {
                    game.winningLine = winCheck.line;
                    await endGame(game, game.currentPlayer, WinReason.OmokWin);
                    return {};
                }
                if (game.mode === GameMode.Ttamok) {
                    const { capturedCount } = omokLogic.performTtamokCapture(x, y);
                    game.captures[game.currentPlayer] += capturedCount;
                    if (game.captures[game.currentPlayer] >= (game.settings.captureTarget || 10)) {
                        await endGame(game, game.currentPlayer, WinReason.CaptureLimit);
                        return {};
                    }
                }
            }

            // Check capture limit win for Capture Go (and SP/Tower modes)
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
                    // Check if player can buy more stones in Tower Challenge
                    if (game.isTowerChallenge && (game.gameType === 'survival' || game.gameType === 'capture')) {
                        const canPurchaseMore = (game.towerAddStonesUsed || 0) < 1;
                        const addStonesCost = 100; // Diamonds
                        const player = game.player1; // Human is always P1 in these modes
                        const hasEnoughCurrency = player.diamonds >= addStonesCost;
            
                        if (canPurchaseMore && hasEnoughCurrency) {
                            game.promptForMoreStones = true;
                            game.gameStatus = GameStatus.Paused;
                            if (game.turnDeadline) {
                                game.pausedTurnTimeLeft = (game.turnDeadline - now) / 1000;
                            }
                            game.turnDeadline = undefined;
                            game.turnStartTime = undefined;
                            return {}; // Return without ending game
                        }
                    }
                    await endGame(game, Player.White, WinReason.StoneLimitExceeded);
                    return {};
                }
            }

            // Timer update
            const playerWhoMoved = game.currentPlayer;
            const timeKey = playerWhoMoved === Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
            if (game.settings.timeLimit > 0) {
                const wasInByoyomi = (game as any)[timeKey] <= 0 && game.settings.byoyomiCount > 0;
                if (game.turnDeadline && !wasInByoyomi) {
                    const timeRemaining = Math.max(0, (game.turnDeadline - now) / 1000);
                    (game as any)[timeKey] = timeRemaining;
                }
                if (isFischerGame(game)) {
                    (game as any)[timeKey] += (game.settings.timeIncrement || 0);
                }
            }

            // Switch turn
            game.currentPlayer = game.currentPlayer === Player.Black ? Player.White : Player.Black;
            game.missileUsedThisTurn = false;

            if (game.settings.timeLimit > 0) {
                const nextTimeKey = game.currentPlayer === Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                const isNextInByoyomi = (game as any)[nextTimeKey] <= 0 && game.settings.byoyomiCount > 0 && !isFischerGame(game);
                if (isNextInByoyomi) {
                    game.turnDeadline = now + game.settings.byoyomiTime * 1000;
                } else {
                    game.turnDeadline = now + (game as any)[nextTimeKey] * 1000;
                }
                game.turnStartTime = now;
            }

            return {};
        }
        case 'PASS_TURN': {
             if (!isMyTurn || game.gameStatus !== 'playing') {
                return { error: 'Not your turn to pass.' };
            }

            game.passCount++;
            game.lastMove = { x: -1, y: -1 };
            game.moveHistory.push({ player: game.currentPlayer, x: -1, y: -1 });

            // Inform GnuGo of the pass
            if (game.isAiGame || game.isSinglePlayer || game.isTowerChallenge) {
                gnuGoServiceManager.playUserMove(game.id, { x: -1, y: -1 }, myPlayerEnum, game.settings.boardSize, game.moveHistory, game.finalKomi ?? game.settings.komi).catch(e => {
                    console.error(`[Strategic Action] Failed to inform GNU Go of pass for game ${game.id}`, e);
                });
            }

            if (game.passCount >= 2) {
                await getGameResult(game);
                return {};
            }

            // Timer update
            const playerWhoMoved = game.currentPlayer;
            const timeKey = playerWhoMoved === Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
            if (game.settings.timeLimit > 0) {
                const wasInByoyomi = (game as any)[timeKey] <= 0 && game.settings.byoyomiCount > 0;
                if (game.turnDeadline && !wasInByoyomi) {
                    (game as any)[timeKey] = Math.max(0, (game.turnDeadline - now) / 1000);
                }
                if (isFischerGame(game)) {
                    (game as any)[timeKey] += (game.settings.timeIncrement || 0);
                }
            }

            // Switch turn
            game.currentPlayer = game.currentPlayer === Player.Black ? Player.White : Player.Black;
            game.missileUsedThisTurn = false;
            
            if (game.settings.timeLimit > 0) {
                const nextTimeKey = game.currentPlayer === Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                 const isNextInByoyomi = (game as any)[nextTimeKey] <= 0 && game.settings.byoyomiCount > 0 && !isFischerGame(game);
                if (isNextInByoyomi) {
                    game.turnDeadline = now + game.settings.byoyomiTime * 1000;
                } else {
                    game.turnDeadline = now + (game as any)[nextTimeKey] * 1000;
                }
                game.turnStartTime = now;
            }
            
            return {};
        }
    }
    return null;
};
