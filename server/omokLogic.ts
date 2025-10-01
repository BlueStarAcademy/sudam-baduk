// FIX: Corrected import path for types.
import { LiveGameSession, Point, BoardState, Player, GameMode, WinReason } from '../types/index.js';

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
