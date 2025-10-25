// server/modes/omokLogic.ts
import { LiveGameSession, Point, BoardState, Player, GameMode, WinReason, HandleActionResult, User, ServerAction, GameStatus, Negotiation } from '../../types/index.js';
import { handleSharedAction, updateSharedGameState, transitionToPlaying, switchTurnAndUpdateTimers } from './shared.js';
import { endGame } from '../summaryService.js';
import * as db from '../db.js';
import { broadcast } from '../services/supabaseService.js';

export const getOmokLogic = (game: LiveGameSession) => {
    const { settings: { boardSize } } = game;
    const player = game.currentPlayer;
    const opponent = player === Player.Black ? Player.White : Player.Black;

    const getLine = (x: number, y: number, dx: number, dy: number, board: BoardState): Point[] => {
        const line: Point[] = [{x, y}];
        const p = board[y][x];
        if (p === Player.None) return [];

        for(let i = 1; i < 6; i++) {
            const nx = x + i * dx;
            const ny = y + i * dy;
            if (nx < 0 || nx >= boardSize || ny < 0 || ny >= boardSize || board[ny][nx] !== p) break;
            line.push({x: nx, y: ny});
        }
        for(let i = 1; i < 6; i++) {
            const nx = x - i * dx;
            const ny = y - i * dy;
            if (nx < 0 || nx >= boardSize || ny < 0 || ny >= boardSize || board[ny][nx] !== p) break;
            line.unshift({x: nx, y: ny});
        }
        return line;
    };
    
    const getLineInfo = (x: number, y: number, board: BoardState) => {
        const directions = [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 1, dy: -1 }];
        const result: { [key: string]: number } = {};
        let i = 0;
        for (const { dx, dy } of directions) {
            const line = getLine(x, y, dx, dy, board);
            result[i] = line.length;
            i++;
        }
        return result;
    }

    const checkWin = (x: number, y: number, board: BoardState): { line: Point[] } | null => {
        const p = board[y][x];
        if (p === Player.None) return null;

        const directions = [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 1, dy: -1 }];
        for (const { dx, dy } of directions) {
            const line = getLine(x, y, dx, dy, board);
            
            if (line.length >= 5) {
                if (game.settings.hasOverlineForbidden && p === Player.Black && line.length > 5) {
                    continue;
                }
                return { line: line.slice(0, 5) };
            }
        }
        return null;
    };
    
    const checkOpenState = (line: (Player | null)[]) => {
        let openEnds = 0;
        if (line[0] === Player.None) openEnds++;
        if (line[line.length-1] === Player.None) openEnds++;
        return openEnds;
    };

    const is33 = (x: number, y: number, board: BoardState): boolean => {
        // The original logic was buggy and preventing valid moves.
        // As per the request, this check is disabled.
        return false;
    };


    const performTtamokCapture = (x: number, y: number): { capturedCount: number } => {
        let capturedCount = 0;
        const directions = [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 1, dy: -1 }];

        for (const { dx, dy } of directions) {
            for (const dir of [1, -1]) { // Check both ways on an axis
                const n1x = x + dir * dx; const n1y = y + dir * dy;
                const n2x = x + dir * 2 * dx; const n2y = y + dir * 2 * dy;
                const n3x = x + dir * 3 * dx; const n3y = y + dir * 3 * dy;

                if(n3x < 0 || n3x >= boardSize || n3y < 0 || n3y >= boardSize) continue;

                if (
                    game.boardState[n1y]?.[n1x] === opponent &&
                    game.boardState[n2y]?.[n2x] === opponent &&
                    game.boardState[n3y]?.[n3x] === player
                ) {
                    game.boardState[n1y][n1x] = Player.None;
                    game.boardState[n2y][n2x] = Player.None;
                    capturedCount += 2;
                }
            }
        }
        return { capturedCount };
    };

    return {
        checkWin,
        is33,
        performTtamokCapture,
    };
};

export const initializeOmok = (game: LiveGameSession, neg: Negotiation, now: number) => {
    const p1 = game.player1;
    const p2 = game.player2;

    if (game.isAiGame) {
        const humanPlayerColor = neg.settings.player1Color || Player.Black;
        game.blackPlayerId = humanPlayerColor === Player.Black ? p1.id : p2.id;
        game.whitePlayerId = humanPlayerColor === Player.Black ? p2.id : p1.id;
        transitionToPlaying(game, now);
    } else {
        game.gameStatus = GameStatus.TurnPreferenceSelection;
        game.turnChoices = { [p1.id]: null, [p2.id]: null };
        game.turnChoiceDeadline = now + 30000;
        game.turnSelectionTiebreaker = 'rps';
    }
};

export const updateOmokState = async (game: LiveGameSession, now: number) => {
    if (updateSharedGameState(game, now)) return;

    const isTimedGame = (game.settings.timeLimit ?? 0) > 0;
    
    if (isTimedGame && game.gameStatus === GameStatus.Playing && game.turnDeadline && now > game.turnDeadline) {
        const timedOutPlayer = game.currentPlayer;
        const winner = timedOutPlayer === Player.Black ? Player.White : Player.Black;
        // ... (timeout logic remains for cron job)
        await endGame(game, winner, WinReason.Timeout);
    }
};

export const handleOmokAction = async (game: LiveGameSession, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult | null> => {
    const { type, payload } = action as any;
    const now = Date.now();
    const myPlayerEnum = user.id === game.blackPlayerId ? Player.Black : (user.id === game.whitePlayerId ? Player.White : Player.None);
    const isMyTurn = myPlayerEnum === game.currentPlayer;

    const sharedResult = await handleSharedAction(game, action, user);
    if (sharedResult) {
        await db.saveGame(game);
        await broadcast({ type: 'GAME_STATE_UPDATE', payload: { updatedGame: game } });
        return sharedResult;
    }

    if (type === 'PLACE_STONE' && (game.mode === GameMode.Omok || game.mode === GameMode.Ttamok)) {
        if (!isMyTurn || game.gameStatus !== 'playing') {
            return { error: 'Not your turn.' };
        }

        const { x, y } = payload;
        if (game.boardState[y][x] !== Player.None) {
            return { error: 'Stone already placed there.' };
        }
        
        const logic = getOmokLogic(game);
        
        if (game.settings.has33Forbidden && game.currentPlayer === Player.Black && logic.is33(x, y, game.boardState)) {
            return { error: '3-3 is forbidden for Black.' };
        }

        game.boardState[y][x] = game.currentPlayer;
        game.lastMove = { x, y };
        game.moveHistory.push({ player: game.currentPlayer, ...payload });

        const winCheck = logic.checkWin(x, y, game.boardState);
        if (winCheck) {
            game.winningLine = winCheck.line;
            await endGame(game, game.currentPlayer, WinReason.OmokWin);
        } else if (game.mode === GameMode.Ttamok) {
            const { capturedCount } = logic.performTtamokCapture(x, y);
            game.captures[game.currentPlayer] += capturedCount;
            if (game.captures[game.currentPlayer] >= (game.settings.captureTarget || 10)) {
                await endGame(game, game.currentPlayer, WinReason.CaptureLimit);
            }
        } else {
             // Only switch turn if game hasn't ended
            switchTurnAndUpdateTimers(game, now);
        }
        
        await db.saveGame(game);
        await broadcast({ type: 'GAME_STATE_UPDATE', payload: { updatedGame: game } });
        
        return {};
    }

    return null;
};

export const makeOmokAiMove = async (game: LiveGameSession): Promise<void> => {
    // ... (implementation unchanged)
};