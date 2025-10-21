// server/ai/simpleAi.ts
import { LiveGameSession, Player, Point, BoardState, Move, KoInfo } from '../../types/index.js';
import { processMove as originalProcessMove, getGoLogic } from '../../utils/goLogic.js';
import { calculateScores } from '../scoring.js';

type ProcessMoveFunction = (boardState: BoardState, move: Move, koInfo: KoInfo | null, moveIndex: number) => { isValid: boolean; reason?: string; newBoardState: BoardState; capturedStones: Point[]; newKoInfo: KoInfo | null };

const processMove: ProcessMoveFunction = originalProcessMove;

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
    return { x: -2, y: -2 }; // Resign
};

const calculateHeuristicMoveScore = (move: Point, game: LiveGameSession, level: number, gameType: string | undefined): number => {
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

    for (const n of getNeighbors(move.x, move.y)) {
        if (tempBoard[n.y][n.x] === opponent) {
            const group = findGroup(n.x, n.y, opponent, tempBoard);
            if (group && group.liberties === 0) {
                captureScore += group.stones.length * 200;
            }
        }
    }
    
    for (const n of getNeighbors(move.x, move.y)) {
        if (boardState[n.y][n.x] === currentPlayer) {
            const group = findGroup(n.x, n.y, currentPlayer, boardState);
            if (group && group.liberties === 1 && group.libertyPoints.has(`${move.x},${move.y}`)) {
                saveScore += group.stones.length * 150;
            }
        }
    }

    for (const n of getNeighbors(move.x, move.y)) {
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
        for (const n of getNeighbors(move.x, move.y)) {
            if (tempBoard[n.y][n.x] === currentPlayer) {
                shapeScore += 5; 
            }
        }
    }
    
    // 여기에 level 1일 때의 특별 로직을 추가합니다.
    if (level === 1 || gameType === 'capture' || gameType === 'survival') {
        // For level 1, or in capture/survival modes, focus heavily on captures.
        return (captureScore * 1000) + (atariScore * 50) + (saveScore * 10) - selfAtariPenalty + Math.random();
    } else {
        return (captureScore + saveScore + atariScore + shapeScore) - selfAtariPenalty + Math.random(); // Default scoring
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
        console.log(`[Simple AI Debug] Game ${game.id}: No valid moves, AI resigns.`);
        return { x: -2, y: -2 }; // Resign
    }

    let scoredMoves: { move: Point, score: number }[];

    if (level >= 6) { // Minimax AI
        if (game.gameType === 'capture' || game.gameType === 'survival') {
            // In capture/survival modes, the goal is to capture stones, not to score territory.
            // The AI will prioritize moves that lead to immediate captures.
            scoredMoves = validMoves.map(myMove => {
                const { capturedStones: myCapturedStones, newBoardState: boardAfterMyMove, newKoInfo: koAfterMyMove } = processMove(game.boardState, { ...myMove, player: currentPlayer }, game.koInfo, game.moveHistory.length);

                // Find opponent's best reply in terms of captures
                const opponent = currentPlayer === Player.Black ? Player.White : Player.Black;
                const opponentMoves = getValidMoves({ ...game, boardState: boardAfterMyMove, currentPlayer: opponent, koInfo: koAfterMyMove });
                let maxOpponentCaptures = 0;
                if (opponentMoves.length > 0) {
                    for (const opponentMove of opponentMoves) {
                        const { capturedStones: opponentCapturedStones } = processMove(boardAfterMyMove, { ...opponentMove, player: opponent }, koAfterMyMove, game.moveHistory.length + 1);
                        if (opponentCapturedStones.length > maxOpponentCaptures) {
                            maxOpponentCaptures = opponentCapturedStones.length;
                        }
                    }
                }
                // Score is our captures minus opponent's best capture reply.
                return { move: myMove, score: myCapturedStones.length - maxOpponentCaptures };
            });
        } else {
            // Standard Minimax AI with 1-ply lookahead for territory
            scoredMoves = validMoves.map(myMove => {
                // 1. AI makes a move
                const { newBoardState: boardAfterMyMove, capturedStones: myCapturedStones, newKoInfo: koAfterMyMove } = processMove(game.boardState, { ...myMove, player: currentPlayer }, game.koInfo, game.moveHistory.length);
                const capturesAfterMyMove = { ...game.captures };
                capturesAfterMyMove[currentPlayer] += myCapturedStones.length;

                // 2. Find opponent's best response
                const opponent = currentPlayer === Player.Black ? Player.White : Player.Black;
                const opponentMoves = getValidMoves({ ...game, boardState: boardAfterMyMove, currentPlayer: opponent, koInfo: koAfterMyMove });

                let bestOpponentReplyScore = -Infinity;
                if (opponentMoves.length > 0) {
                    for (const opponentMove of opponentMoves) {
                        const { newBoardState: boardAfterOpponentMove, capturedStones: opponentCapturedStones } = processMove(boardAfterMyMove, { ...opponentMove, player: opponent }, koAfterMyMove, game.moveHistory.length + 1);
                        const capturesAfterOpponentMove = { ...capturesAfterMyMove };
                        capturesAfterOpponentMove[opponent] += opponentCapturedStones.length;
                        const scores = calculateScores(boardAfterOpponentMove, game.settings.komi, capturesAfterOpponentMove);
                        const opponentScore = opponent === Player.Black ? scores.black - scores.white : scores.white - scores.black;
                        if (opponentScore > bestOpponentReplyScore) {
                            bestOpponentReplyScore = opponentScore;
                        }
                    }
                } else {
                    // If opponent has no moves, it's a huge advantage for us. Calculate score from our perspective.
                    const scores = calculateScores(boardAfterMyMove, game.settings.komi, capturesAfterMyMove);
                    bestOpponentReplyScore = -(currentPlayer === Player.Black ? scores.black - scores.white : scores.white - scores.black);
                }

                // The score of our move is how good it is for us, minus how good the opponent's reply is for them.
                const scoresAfterMyMove = calculateScores(boardAfterMyMove, game.settings.komi, capturesAfterMyMove);
                const myScore = currentPlayer === Player.Black ? scoresAfterMyMove.black - scoresAfterMyMove.white : scoresAfterMyMove.white - scoresAfterMyMove.black;
                
                return { move: myMove, score: myScore - bestOpponentReplyScore };
            });
        }
    } else { // Heuristic-based AI
        scoredMoves = validMoves.map(move => ({
            move,
            score: calculateHeuristicMoveScore(move, game, level, game.gameType)
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