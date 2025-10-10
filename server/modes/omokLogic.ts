// server/modes/omokLogic.ts
import { LiveGameSession, Point, BoardState, Player, GameMode, WinReason, HandleActionResult, VolatileState, User, ServerAction, GameStatus, Negotiation } from '../../types/index.js';
import { handleSharedAction, updateSharedGameState, transitionToPlaying } from './shared.js';
import { endGame } from '../summaryService.js';
// FIX: Corrected import for switchTurnAndUpdateTimers from strategic.js
import { switchTurnAndUpdateTimers } from './strategic.js';


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

    const checkPotentialCaptures = (x: number, y: number, player: Player, board: BoardState): number => {
        let capturedCount = 0;
        const opponent = player === Player.Black ? Player.White : Player.Black;
        const directions = [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 1, dy: -1 }];
        const boardSize = board.length;

        for (const { dx, dy } of directions) {
            for (const dir of [1, -1]) {
                const n1x = x + dir * dx; const n1y = y + dir * dy;
                const n2x = x + dir * 2 * dx; const n2y = y + dir * 2 * dy;
                const n3x = x + dir * 3 * dx; const n3y = y + dir * 3 * dy;

                if (n3x < 0 || n3x >= boardSize || n3y < 0 || n3y >= boardSize) continue;

                if (
                    board[n1y]?.[n1x] === opponent &&
                    board[n2y]?.[n2x] === opponent &&
                    board[n3y]?.[n3x] === player
                ) {
                    capturedCount += 2;
                }
            }
        }
        return capturedCount;
    };
    
    const getLineStats = (x: number, y: number, player: Player, board: BoardState, dx: number, dy: number): { length: number; openEnds: number } => {
        const boardSize = board.length;
        let length = 1;
        
        let line: Point[] = [{x, y}];

        // Forward
        for (let i = 1; i < 6; i++) {
            const nx = x + i * dx;
            const ny = y + i * dy;
            if (nx < 0 || nx >= boardSize || ny < 0 || ny >= boardSize || board[ny][nx] !== player) break;
            length++;
            line.push({x: nx, y: ny});
        }
        // Backward
        for (let i = 1; i < 6; i++) {
            const nx = x - i * dx;
            const ny = y - i * dy;
            if (nx < 0 || nx >= boardSize || ny < 0 || ny >= boardSize || board[ny][nx] !== player) break;
            length++;
            line.unshift({x: nx, y: ny});
        }

        let openEnds = 0;
        // Check end of the line
        const end = line[line.length - 1];
        const endNextX = end.x + dx;
        const endNextY = end.y + dy;
        if (endNextX >= 0 && endNextX < boardSize && endNextY >= 0 && endNextY < boardSize && board[endNextY][endNextX] === Player.None) {
            openEnds++;
        }

        // Check start of the line
        const start = line[0];
        const startPrevX = start.x - dx;
        const startPrevY = start.y - dy;
        if (startPrevX >= 0 && startPrevX < boardSize && startPrevY >= 0 && startPrevY < boardSize && board[startPrevY][startPrevX] === Player.None) {
            openEnds++;
        }

        return { length, openEnds };
    };

    const calculateMoveScore = (x: number, y: number, playerToSim: Player, board: BoardState): number => {
        const tempBoard = JSON.parse(JSON.stringify(board));
        tempBoard[y][x] = playerToSim;

        if (checkWin(x, y, tempBoard)) {
            const p = tempBoard[y][x];
            if (game.settings.hasOverlineForbidden && p === Player.Black) {
                const directions = [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 1, dy: -1 }];
                for (const { dx, dy } of directions) {
                    if (getLine(x, y, dx, dy, tempBoard).length > 5) return 0; // Invalid move
                }
            }
            return 100000;
        }

        let score = 0;
        const directions = [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 1, dy: -1 }];
        
        for (const { dx, dy } of directions) {
            const { length, openEnds } = getLineStats(x, y, playerToSim, tempBoard, dx, dy);
            
            if (length === 4) {
                if (openEnds === 2) score += 5000; // Open four
                else if (openEnds === 1) score += 500; // Closed four
            } else if (length === 3) {
                if (openEnds === 2) score += 200; // Open three
                else if (openEnds === 1) score += 50; // Closed three
            } else if (length === 2) {
                if (openEnds === 2) score += 10; // Open two
            }
        }
        
        if (game.mode === GameMode.Ttamok) {
            const captures = checkPotentialCaptures(x, y, playerToSim, tempBoard);
            score += captures * 100; // Each capture is valuable
        }

        return score;
    };

    return {
        checkWin,
        is33,
        performTtamokCapture,
        checkPotentialCaptures,
        getLineStats,
        calculateMoveScore,
    };
};

export const initializeOmok = (game: LiveGameSession, neg: Negotiation, now: number) => {
    const p1 = game.player1;
    const p2 = game.player2;

    if (game.isAiGame) {
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
                game[byoyomiKey]--; // Decrement a period
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
};

export const handleOmokAction = async (volatileState: VolatileState, game: LiveGameSession, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult | null> => {
    const { type, payload } = action as any;
    const now = Date.now();
    const myPlayerEnum = user.id === game.blackPlayerId ? Player.Black : (user.id === game.whitePlayerId ? Player.White : Player.None);
    const isMyTurn = myPlayerEnum === game.currentPlayer;

    const sharedResult = await handleSharedAction(volatileState, game, action, user);
    if (sharedResult) return sharedResult;

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
            return {};
        }

        if (game.mode === GameMode.Ttamok) {
            const { capturedCount } = logic.performTtamokCapture(x, y);
            game.captures[game.currentPlayer] += capturedCount;
            if (game.captures[game.currentPlayer] >= (game.settings.captureTarget || 10)) {
                await endGame(game, game.currentPlayer, WinReason.CaptureLimit);
                return {};
            }
        }
        
        switchTurnAndUpdateTimers(game, now);
        
        return {};
    }

    return null;
};

export const makeOmokAiMove = async (game: LiveGameSession): Promise<void> => {
    const aiId = game.player2.id;
    const myPlayerEnum = game.whitePlayerId === aiId ? Player.White : Player.Black;
    if (game.currentPlayer !== myPlayerEnum) return;

    const logic = getOmokLogic(game);
    const emptyPoints: Point[] = [];
    for (let y = 0; y < game.settings.boardSize; y++) {
        for (let x = 0; x < game.settings.boardSize; x++) {
            if (game.boardState[y][x] === Player.None) {
                emptyPoints.push({ x, y });
            }
        }
    }
    
    if (emptyPoints.length === 0) { // Should not happen in Omok
        game.passCount = (game.passCount || 0) + 1;
        return;
    }

    let bestMove: Point | null = null;
    let bestScore = -Infinity;

    // Evaluate my moves
    for (const point of emptyPoints) {
        const score = logic.calculateMoveScore(point.x, point.y, myPlayerEnum, game.boardState);
        if (score > bestScore) {
            bestScore = score;
            bestMove = point;
        }
    }
    
    // Evaluate opponent's potential moves to block
    let opponentBestScore = -Infinity;
    let blockMove: Point | null = null;
    const opponentPlayerEnum = myPlayerEnum === Player.Black ? Player.White : Player.Black;
    for (const point of emptyPoints) {
        const score = logic.calculateMoveScore(point.x, point.y, opponentPlayerEnum, game.boardState);
        if (score > opponentBestScore) {
            opponentBestScore = score;
            blockMove = point;
        }
    }
    
    // If opponent has a winning move, block it. Otherwise, make my best move.
    if (opponentBestScore >= 100000 && opponentBestScore > bestScore) {
        bestMove = blockMove;
    }
    
    if (!bestMove) {
        bestMove = emptyPoints[Math.floor(Math.random() * emptyPoints.length)];
    }

    const { x, y } = bestMove!;
    game.boardState[y][x] = game.currentPlayer;
    game.lastMove = { x, y };
    game.moveHistory.push({ player: game.currentPlayer, x, y });
    
    const winCheck = logic.checkWin(x, y, game.boardState);
    if (winCheck) {
        game.winningLine = winCheck.line;
        await endGame(game, game.currentPlayer, WinReason.OmokWin);
        return;
    }
    
    if (game.mode === GameMode.Ttamok) {
        const { capturedCount } = logic.performTtamokCapture(x, y);
        game.captures[game.currentPlayer] += capturedCount;
        if (game.captures[game.currentPlayer] >= (game.settings.captureTarget || 10)) {
            await endGame(game, game.currentPlayer, WinReason.CaptureLimit);
            return;
        }
    }

    switchTurnAndUpdateTimers(game, Date.now());
};