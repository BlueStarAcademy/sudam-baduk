// server/ai/simpleAi.ts
import { LiveGameSession, Player, Point, BoardState, Move, KoInfo } from '../../types/index.js';
import { processMove } from '../../utils/goLogic.js';
import { calculateScores } from '../scoring.js';

const getNeighbors = (x: number, y: number, boardSize: number): Point[] => {
    const neighbors: Point[] = [];
    if (x > 0) neighbors.push({ x: x - 1, y });
    if (x < boardSize - 1) neighbors.push({ x: x + 1, y });
    if (y > 0) neighbors.push({ x, y: y - 1 });
    if (y < boardSize - 1) neighbors.push({ x, y: y + 1 });
    return neighbors;
};

const findGroup = (startX: number, startY: number, board: BoardState, visited: boolean[][]): { stones: Point[], liberties: Set<string> } | null => {
    const player = board[startY][startX];
    if (player === Player.None || visited[startY][startX]) {
        return null;
    }

    const stones: Point[] = [];
    const liberties = new Set<string>();
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


const getValidMoves = (game: LiveGameSession): Point[] => {
    const { boardState, settings, currentPlayer, koInfo, moveHistory } = game;
    const validMoves: Point[] = [];
    for (let y = 0; y < settings.boardSize; y++) {
        for (let x = 0; x < settings.boardSize; x++) {
            if (boardState[y][x] === Player.None) {
                const move = { x, y, player: currentPlayer };
                const result = processMove(boardState, move, koInfo, moveHistory.length);
                if (result.isValid) {
                    validMoves.push({ x, y });
                }
            }
        }
    }
    return validMoves;
};

const getRandomValidMove = (game: LiveGameSession): Point => {
    const validMoves = getValidMoves(game);
    if (validMoves.length > 0) {
        return validMoves[Math.floor(Math.random() * validMoves.length)];
    }
    return { x: -1, y: -1 }; // Pass
};

const calculateHeuristicMoveScore = (move: Point, game: LiveGameSession, level: number): number => {
    const { boardState, currentPlayer, koInfo, moveHistory, settings } = game;
    const opponent = currentPlayer === Player.Black ? Player.White : Player.Black;
    const boardSize = settings.boardSize;

    const tempBoard = boardState.map(row => [...row]);
    tempBoard[move.y][move.x] = currentPlayer;
    let score = Math.random(); 

    let captureScore = 0;
    let saveScore = 0;
    let atariScore = 0;
    let shapeScore = 0;
    let selfAtariPenalty = 0;

    for (const n of getNeighbors(move.x, move.y, boardSize)) {
        if (tempBoard[n.y][n.x] === opponent) {
            const visited = Array(boardSize).fill(null).map(() => Array(boardSize).fill(false));
            const group = findGroup(n.x, n.y, tempBoard, visited);
            if (group && group.liberties.size === 0) {
                captureScore += group.stones.length * 200;
            }
        }
    }
    
    for (const n of getNeighbors(move.x, move.y, boardSize)) {
        if (boardState[n.y][n.x] === currentPlayer) {
            const visited = Array(boardSize).fill(null).map(() => Array(boardSize).fill(false));
            const group = findGroup(n.x, n.y, boardState, visited);
            if (group && group.liberties.size === 1 && group.liberties.has(`${move.x},${move.y}`)) {
                saveScore += group.stones.length * 150;
            }
        }
    }

    for (const n of getNeighbors(move.x, move.y, boardSize)) {
        if (tempBoard[n.y][n.x] === opponent) {
            const visited = Array(boardSize).fill(null).map(() => Array(boardSize).fill(false));
            const group = findGroup(n.x, n.y, tempBoard, visited);
            if (group && group.liberties.size === 1) {
                atariScore += group.stones.length * 50;
            }
        }
    }

    const visitedSelf = Array(boardSize).fill(null).map(() => Array(boardSize).fill(false));
    const myGroup = findGroup(move.x, move.y, tempBoard, visitedSelf);
    if (myGroup && myGroup.liberties.size <= 1) {
        selfAtariPenalty = 200;
    }

    if (level >= 4) {
        for (const n of getNeighbors(move.x, move.y, boardSize)) {
            if (tempBoard[n.y][n.x] === currentPlayer) {
                shapeScore += 5; 
            }
        }
    }
    
    return (captureScore + saveScore + atariScore + shapeScore) - selfAtariPenalty;
};

export const makeSimpleAiMove = (game: LiveGameSession): Point => {
    const { settings, currentPlayer } = game;
    const difficulty = settings.aiDifficulty || 50;
    const level = Math.max(1, Math.min(10, Math.round(difficulty / 10)));

    const mistakeProbabilities = [0, 0.5, 0.4, 0.3, 0.2, 0.15, 0.1, 0.05, 0.02, 0.01, 0];
    const mistakeChance = mistakeProbabilities[level] ?? 0.05;

    if (Math.random() < mistakeChance && level < 8) {
        return getRandomValidMove(game);
    }
    
    const validMoves = getValidMoves(game);
    if (validMoves.length === 0) {
        return { x: -1, y: -1 }; // Pass
    }

    let scoredMoves: { move: Point, score: number }[];

    if (level >= 6) { // 형세판단 AI
        scoredMoves = validMoves.map(move => {
            const { newBoardState, capturedStones } = processMove(game.boardState, { ...move, player: currentPlayer }, game.koInfo, game.moveHistory.length);
            const capturesForScore = { ...game.captures };
            capturesForScore[currentPlayer] += capturedStones.length;
            
            const scores = calculateScores(newBoardState, game.settings.komi, capturesForScore);
            const scoreDiff = currentPlayer === Player.Black ? scores.black - scores.white : scores.white - scores.black;
            
            return { move, score: scoreDiff };
        });
    } else { // 휴리스틱 기반 AI
        scoredMoves = validMoves.map(move => ({
            move,
            score: calculateHeuristicMoveScore(move, game, level)
        }));
    }

    scoredMoves.sort((a, b) => b.score - a.score);

    if (scoredMoves.length > 0) {
        return scoredMoves[0].move;
    }

    return getRandomValidMove(game);
};