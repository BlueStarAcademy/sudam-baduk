// server/ai/simpleAi.ts
import { LiveGameSession, Player, Point, BoardState, Move, KoInfo } from '../../types/index.js';
import { processMove, getGoLogic } from '../../utils/goLogic.js';
import { calculateScores } from '../scoring.js';

const getValidMoves = (game: LiveGameSession): Point[] => {
    const { boardState, settings, currentPlayer, koInfo, moveHistory } = game;
    const { getNeighbors } = getGoLogic(settings);
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
    const { boardState, currentPlayer, settings } = game;
    const opponent = currentPlayer === Player.Black ? Player.White : Player.Black;
    const boardSize = settings.boardSize;
    const { getNeighbors, findGroup } = getGoLogic(settings);

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
            const group = findGroup(n.x, n.y, opponent, tempBoard);
            if (group && group.liberties === 0) {
                captureScore += group.stones.length * 200;
            }
        }
    }
    
    for (const n of getNeighbors(move.x, move.y, boardSize)) {
        if (boardState[n.y][n.x] === currentPlayer) {
            const group = findGroup(n.x, n.y, currentPlayer, boardState);
            if (group && group.liberties === 1 && group.libertyPoints.has(`${move.x},${move.y}`)) {
                saveScore += group.stones.length * 150;
            }
        }
    }

    for (const n of getNeighbors(move.x, move.y, boardSize)) {
        if (tempBoard[n.y][n.x] === opponent) {
            const group = findGroup(n.x, n.y, opponent, tempBoard);
            if (group && group.liberties === 1) {
                atariScore += group.stones.length * 50;
            }
        }
    }

    const myGroup = findGroup(move.x, move.y, currentPlayer, tempBoard);
    if (myGroup && myGroup.liberties <= 1) {
        selfAtariPenalty = 200;
    }

    if (level >= 4) {
        for (const n of getNeighbors(move.x, move.y, boardSize)) {
            if (tempBoard[n.y][n.x] === currentPlayer) {
                shapeScore += 5; 
            }
        }
    }
    
    // 여기에 level 1일 때의 특별 로직을 추가합니다.
    if (level === 1) {
        // 1단계 AI는 따내기만 집중하도록 다른 점수들을 무시하고 따내기 점수에만 가중치를 줍니다.
        return captureScore * 1000 + Math.random(); // 따내기 점수에 매우 높은 가중치 부여, 동점 방지용 랜덤
    } else {
        return (captureScore + saveScore + atariScore + shapeScore) - selfAtariPenalty + Math.random(); // 동점 방지용 랜덤
    }
};

export const makeSimpleAiMove = (game: LiveGameSession): Point => {
    const { settings, currentPlayer } = game;
    const difficulty = settings.aiDifficulty || 50;
    const level = Math.max(1, Math.min(10, Math.round(difficulty / 10)));

    const mistakeProbabilities = [0, 0.5, 0.4, 0.3, 0.2, 0.15, 0.1, 0.05, 0.02, 0.01, 0];
    const mistakeChance = mistakeProbabilities[level] ?? 0.05;

    console.log(`[Simple AI Debug] Game ${game.id}: Difficulty ${difficulty}, Level ${level}, Mistake Chance ${mistakeChance}`);

    if (Math.random() < mistakeChance && level < 8) {
        const randomMove = getRandomValidMove(game);
        console.log(`[Simple AI Debug] Game ${game.id}: Making a random (mistake) move: ${JSON.stringify(randomMove)}`);
        return randomMove;
    }
    
    const validMoves = getValidMoves(game);
    console.log(`[Simple AI Debug] Game ${game.id}: Found ${validMoves.length} valid moves.`);

    if (validMoves.length === 0) {
        console.log(`[Simple AI Debug] Game ${game.id}: No valid moves, AI passes.`);
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
        const bestMove = scoredMoves[0].move;
        console.log(`[Simple AI Debug] Game ${game.id}: Best move found: ${JSON.stringify(bestMove)} with score ${scoredMoves[0].score}`);
        return bestMove;
    }

    const fallbackMove = getRandomValidMove(game);
    console.log(`[Simple AI Debug] Game ${game.id}: Fallback to random move: ${JSON.stringify(fallbackMove)}`);
    return fallbackMove;
};