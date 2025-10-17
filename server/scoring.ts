
// server/scoring.ts
import { BoardState, Player, Point } from '../types/index.js';

const getNeighbors = (x: number, y: number, boardSize: number): Point[] => {
    const neighbors: Point[] = [];
    if (x > 0) neighbors.push({ x: x - 1, y });
    if (x < boardSize - 1) neighbors.push({ x: x + 1, y });
    if (y > 0) neighbors.push({ x, y: y - 1 });
    if (y < boardSize - 1) neighbors.push({ x, y: y + 1 });
    return neighbors;
};

const findGroup = (startX: number, startY: number, board: BoardState, visited: boolean[][]): { stones: Point[], liberties: Set<string> } | null => {
    // FIX: Use startX and startY for initial check.
    const player = board[startY][startX];
    // FIX: Use startX and startY for initial check.
    if (player === Player.None || visited[startY][startX]) {
        return null;
    }

    const stones: Point[] = [];
    const liberties = new Set<string>();
    // FIX: Use startX and startY for initial queue.
    const queue: Point[] = [{ x: startX, y: startY }];
    visited[startY][startX] = true;
    const boardSize = board.length;

    while (queue.length > 0) {
        const stone = queue.shift()!;
        stones.push(stone);

        for (const n of getNeighbors(stone.x, stone.y, boardSize)) {
            const neighborState = board[n.y][n.x];
            if (neighborState === Player.None) {
                liberties.add(`${n.x},${n.y}`);
            } else if (neighborState === player && !visited[n.y][n.x]) {
                visited[n.y][n.x] = true;
                queue.push(n);
            }
        }
    }
    return { stones, liberties };
};

const isEye = (point: Point, player: Player, board: BoardState): boolean => {
    const boardSize = board.length;
    if (board[point.y][point.x] !== Player.None) return false;

    // All adjacent points must be friendly stones
    for (const n of getNeighbors(point.x, point.y, boardSize)) {
        if (board[n.y][n.x] !== player) return false;
    }

    // Diagonal check for false eyes
    let opponentCorners = 0;
    const opponent = player === Player.Black ? Player.White : Player.Black;
    const corners = [
        { x: point.x - 1, y: point.y - 1 }, { x: point.x + 1, y: point.y - 1 },
        { x: point.x - 1, y: point.y + 1 }, { x: point.x + 1, y: point.y + 1 }
    ];

    for (const c of corners) {
        if (c.x >= 0 && c.x < boardSize && c.y >= 0 && c.y < boardSize) {
            if (board[c.y][c.x] === opponent) {
                opponentCorners++;
            }
        } else {
            // Off-board corners count as friendly for eye-shape purposes
        }
    }
    
    // It's a true eye if at most one diagonal point is an opponent stone.
    // This is a simplification but works for most common cases.
    return opponentCorners <= 1;
};

const isAlive = (group: { stones: Point[], liberties: Set<string> }, player: Player, board: BoardState): boolean => {
    // A group is unconditionally alive if it has two or more distinct eyes.
    if (group.liberties.size >= 2) {
        let eyeCount = 0;
        const libertyPoints = Array.from(group.liberties).map(l => ({ x: parseInt(l.split(',')[0]), y: parseInt(l.split(',')[1]) }));
        
        for(const liberty of libertyPoints) {
            if (isEye(liberty, player, board)) {
                eyeCount++;
            }
        }
        if (eyeCount >= 2) return true;
    }
    
    // Heuristic: groups with many liberties are likely to be alive
    if (group.liberties.size >= 7) return true;

    // Seki (mutual life) is very complex. This is a simple heuristic:
    // If a group has 2 liberties, and it shares those liberties with an opponent group that also only has those 2 liberties, it's likely a seki.
    if (group.liberties.size === 2) {
        const opponent = player === Player.Black ? Player.White : Player.Black;
        const libertyPoints = Array.from(group.liberties);
        const [lib1, lib2] = libertyPoints;
        const lib1Point = { x: parseInt(lib1.split(',')[0]), y: parseInt(lib1.split(',')[1]) };

        for (const neighbor of getNeighbors(lib1Point.x, lib1Point.y, board.length)) {
             if (board[neighbor.y][neighbor.x] === opponent) {
                 const visited: boolean[][] = Array(board.length).fill(0).map(() => Array(board.length).fill(false));
                 const opponentGroup = findGroup(neighbor.x, neighbor.y, board, visited);
                 if (opponentGroup && opponentGroup.liberties.size === 2 && opponentGroup.liberties.has(lib1) && opponentGroup.liberties.has(lib2)) {
                     return true; // Likely seki
                 }
             }
        }
    }

    return false;
};

export const calculateScores = (board: BoardState, komi: number, captures: { [key in Player]: number }) => {
    const boardSize = board.length;
    const finalBoard = board.map(row => [...row]);
    let visited: boolean[][] = Array(boardSize).fill(0).map(() => Array(boardSize).fill(false));

    const deadStones: Point[] = [];
    // Identify dead stones
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (finalBoard[y][x] !== Player.None && !visited[y][x]) {
                const group = findGroup(x, y, finalBoard, visited);
                if (group && !isAlive(group, finalBoard[y][x], finalBoard)) {
                    deadStones.push(...group.stones);
                }
            }
        }
    }

    // Remove dead stones from the board for territory counting
    const deadStoneCounts: {[key: number]: number} = { [Player.Black]: 0, [Player.White]: 0 };
    for (const stone of deadStones) {
        const player = finalBoard[stone.y]?.[stone.x];
        if (player === Player.Black) {
             deadStoneCounts[Player.Black]++;
        } else if (player === Player.White) {
             deadStoneCounts[Player.White]++;
        }
        if (player !== undefined) {
            finalBoard[stone.y][stone.x] = Player.None;
        }
    }

    // Count territory
    const scores: {[key: number]: number} = { [Player.Black]: 0, [Player.White]: 0 };
    visited = Array(boardSize).fill(0).map(() => Array(boardSize).fill(false));
    
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (finalBoard[y][x] === Player.None && !visited[y][x]) {
                const territory: Point[] = [];
                const borders = new Set<Player>();
                const queue: Point[] = [{ x, y }];
                visited[y][x] = true;
                let isDame = false;

                while(queue.length > 0) {
                    const point = queue.shift()!;
                    territory.push(point);

                    for (const n of getNeighbors(point.x, point.y, boardSize)) {
                        const neighborState = finalBoard[n.y][n.x];
                        if (neighborState !== Player.None) {
                            borders.add(neighborState);
                        } else if (!visited[n.y][n.x]) {
                            visited[n.y][n.x] = true;
                            queue.push(n);
                        }
                    }
                    if (borders.size > 1) {
                        isDame = true;
                        break;
                    }
                }
                
                if (!isDame && borders.size === 1) {
                    const owner = borders.values().next().value;
                    if (owner === Player.Black || owner === Player.White) {
                        scores[owner] += territory.length;
                    }
                }
            }
        }
    }

    // Final score calculation
    scores[Player.Black] += captures[Player.Black] + deadStoneCounts[Player.White];
    scores[Player.White] += captures[Player.White] + deadStoneCounts[Player.Black] + komi;
    
    return {
        black: scores[Player.Black],
        white: scores[Player.White],
        deadStones,
    };
};
