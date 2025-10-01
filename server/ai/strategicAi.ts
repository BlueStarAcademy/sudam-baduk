import { LiveGameSession, Point, Player, GameMode, GameStatus } from '../../types/index.js';
import { getGoLogic, processMove } from '../goLogic.js';

const botLevelsConfig: Record<number, { [key: string]: number }> = {
    1: { h1: 100, h2: 20, h3: 20, h4: 20, h5: 50, h6: 20, h7: 40, h8: 50, h9: 50, h10: 20, h11: 20, h12: 20, h13: 100, h14: 50, h15: 50, h16: 100, h17: 20 },
    2: { h1: 100, h2: 40, h3: 35, h4: 35, h5: 60, h6: 30, h7: 60, h8: 70, h9: 60, h10: 30, h11: 30, h12: 30, h13: 100, h14: 60, h15: 65, h16: 100, h17: 30 },
    3: { h1: 100, h2: 60, h3: 50, h4: 50, h5: 70, h6: 40, h7: 80, h8: 90, h9: 70, h10: 40, h11: 40, h12: 40, h13: 100, h14: 70, h15: 80, h16: 100, h17: 40 },
    4: { h1: 100, h2: 80, h3: 65, h4: 65, h5: 80, h6: 50, h7: 100, h8: 100, h9: 80, h10: 50, h11: 50, h12: 50, h13: 100, h14: 80, h15: 90, h16: 100, h17: 50 },
    5: { h1: 100, h2: 100, h3: 80, h4: 80, h5: 90, h6: 60, h7: 100, h8: 100, h9: 90, h10: 60, h11: 60, h12: 60, h13: 100, h14: 90, h15: 100, h16: 100, h17: 60 },
    6: { h1: 100, h2: 100, h3: 100, h4: 95, h5: 100, h6: 70, h7: 100, h8: 100, h9: 100, h10: 70, h11: 70, h12: 70, h13: 100, h14: 100, h15: 100, h16: 100, h17: 70 },
    7: { h1: 100, h2: 100, h3: 100, h4: 100, h5: 100, h6: 80, h7: 100, h8: 100, h9: 100, h10: 80, h11: 80, h12: 80, h13: 100, h14: 100, h15: 100, h16: 100, h17: 80 },
    8: { h1: 100, h2: 100, h3: 100, h4: 100, h5: 100, h6: 90, h7: 100, h8: 100, h9: 100, h10: 90, h11: 90, h12: 90, h13: 100, h14: 100, h15: 100, h16: 100, h17: 90 },
    9: { h1: 100, h2: 100, h3: 100, h4: 100, h5: 100, h6: 100, h7: 100, h8: 100, h9: 100, h10: 100, h11: 100, h12: 100, h13: 100, h14: 100, h15: 100, h16: 100, h17: 100 },
};

export const makeStrategicAiMove = async (game: LiveGameSession, overrideLevel?: number): Promise<void> => {
    const aiPlayerLevel = (overrideLevel ?? game.player2.playfulLevel) || 1;
    const config = botLevelsConfig[Math.min(aiPlayerLevel, 9)];

    const logic = getGoLogic(game);
    const aiPlayer = game.currentPlayer;
    const opponentPlayer = aiPlayer === Player.Black ? Player.White : Player.Black;
    const { boardSize } = game.settings;

    const legalMoves: Point[] = [];
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (game.boardState[y][x] === Player.None) {
                const result = processMove(game.boardState, { x, y, player: aiPlayer }, game.koInfo, game.moveHistory.length);
                if (result.isValid) {
                    legalMoves.push({ x, y });
                }
            }
        }
    }

    if (legalMoves.length === 0) {
        game.pendingAiMove = Promise.resolve({ x: -2, y: -2 });
        return;
    }

    // 1. Determine active heuristics for this turn
    const activeHeuristics = new Set<string>();
    for (const key in config) {
        if (key.startsWith('h') && Math.random() * 100 < config[key]) {
            activeHeuristics.add(key);
        }
    }

    let scoredMoves: { move: Point; score: number; reasons: string[] }[] = legalMoves.map(m => ({ move: m, score: 1, reasons: ['legal'] }));

    const allOpponentGroups = logic.getAllGroups(opponentPlayer, game.boardState);
    const allMyGroups = logic.getAllGroups(aiPlayer, game.boardState);
    
    const weakestMyGroup = allMyGroups.length > 0 ? allMyGroups.reduce((min, g) => (g.liberties < min.liberties ? g : min)) : null;
    const weakestOpponentGroup = allOpponentGroups.length > 0 ? allOpponentGroups.reduce((min, g) => (g.liberties < min.liberties ? g : min)) : null;
    
    // 2. Determine overall strategy (defensive/offensive) for this turn
    let isDefensive = false;
    if (weakestMyGroup && weakestOpponentGroup && weakestMyGroup.liberties <= weakestOpponentGroup.liberties && weakestMyGroup.liberties < 3) {
        if (activeHeuristics.has('h4')) {
            isDefensive = true;
        }
    }

    // H8: Don't save dead stones. If the group has 1 liberty, check h8.
    if (isDefensive && weakestMyGroup && weakestMyGroup.liberties === 1) {
        if (activeHeuristics.has('h8')) {
            isDefensive = false;
        }
    }

    // Pre-calculate sets of key liberty points for efficiency
    const weakestMyGroupLiberties = isDefensive && weakestMyGroup ? new Set(weakestMyGroup.libertyPoints.values()) : new Set<string>();
    const weakestOpponentGroupLiberties = !isDefensive && weakestOpponentGroup && activeHeuristics.has('h1') ? new Set(weakestOpponentGroup.libertyPoints.values()) : new Set<string>();

    const getLine = (p: Point) => Math.min(p.y, boardSize - 1 - p.y, p.x, boardSize - 1 - p.x) + 1;

    // 3. Score all legal moves based on the active heuristics
    for (const scoredMove of scoredMoves) {
        const { move } = scoredMove;
        const moveKey = `${move.x},${move.y}`;
        const neighbors = logic.getNeighbors(move.x, move.y);

        // --- Penalties ---
        if (activeHeuristics.has('h14')) {
            const result = processMove(game.boardState, { ...move, player: aiPlayer }, game.koInfo, game.moveHistory.length);
            if (result.isValid && result.capturedStones.length === 0) {
                const myNewGroup = logic.findGroup(move.x, move.y, aiPlayer, result.newBoardState);
                if (myNewGroup && myNewGroup.liberties === 1) {
                    scoredMove.score -= 500;
                    scoredMove.reasons.push('h14:self_atari');
                }
            }
        }
        if (activeHeuristics.has('h13')) {
            const friendlyGroups = [...new Set(neighbors.filter(n => game.boardState[n.y][n.x] === aiPlayer).map(n => allMyGroups.find(g => g.stones.some(s => s.x === n.x && s.y === n.y))))];
            if (friendlyGroups.length > 1) {
                const tempBoardAfterMyMove = processMove(game.boardState, { ...move, player: aiPlayer }, game.koInfo, game.moveHistory.length).newBoardState;
                const opponentNeighbors = neighbors.filter(n => game.boardState[n.y][n.x] === opponentPlayer);
                for (const oppN of opponentNeighbors) {
                    const group = logic.findGroup(oppN.x, oppN.y, opponentPlayer, tempBoardAfterMyMove);
                    if (group && group.liberties <= 2) {
                        scoredMove.score -= 10000;
                        scoredMove.reasons.push('h13:bad_connect');
                        break;
                    }
                }
            }
        }
        if (activeHeuristics.has('h16')) {
            const result = processMove(game.boardState, { ...move, player: aiPlayer }, game.koInfo, game.moveHistory.length);
            if (result.capturedStones.length === 0) {
                const line = getLine(move);
                if (line === 1) {
                    scoredMove.score -= 200;
                    scoredMove.reasons.push('h16:1st_line');
                } else if (line === 2) {
                    scoredMove.score -= 100;
                    scoredMove.reasons.push('h16:2nd_line');
                }
            }
        }
        
        // --- High-value bonuses ---
        if (activeHeuristics.has('h7')) {
            const result = processMove(game.boardState, { ...move, player: aiPlayer }, game.koInfo, game.moveHistory.length);
            if (result.isValid && result.capturedStones.length > 0) {
                let captureScore = 1000 * result.capturedStones.length;
                if (game.mode === GameMode.Capture) {
                    const currentCaptures = game.captures[aiPlayer] || 0;
                    const target = game.effectiveCaptureTargets?.[aiPlayer] || 20;
                    if (currentCaptures + result.capturedStones.length >= target) {
                        captureScore *= 100;
                    }
                }
                scoredMove.score += captureScore;
                scoredMove.reasons.push(`h7:capture(${result.capturedStones.length})`);
            }
        }
        if (weakestMyGroupLiberties.has(moveKey)) {
            let defenseScore = 500 / weakestMyGroup!.liberties;
            if (activeHeuristics.has('h3') && neighbors.some(n => game.boardState[n.y][n.x] === opponentPlayer)) {
                defenseScore *= 1.5;
            }
            scoredMove.score += defenseScore;
            scoredMove.reasons.push(`h3/h4:defend`);
        }
        if (weakestOpponentGroupLiberties.has(moveKey)) {
            let attackScore = 1000 / weakestOpponentGroup!.liberties;
            if (activeHeuristics.has('h2')) {
                attackScore += (5 - getLine(move)) * 50;
            }
            scoredMove.score += attackScore;
            scoredMove.reasons.push(`h1/h2:attack`);
        }

        // --- Positional bonuses ---
        if (activeHeuristics.has('h5')) {
            const friendlyNeighbors = neighbors.filter(n => game.boardState[n.y][n.x] === aiPlayer);
            if (friendlyNeighbors.length >= 1) {
                const neighborGroups = [...new Set(friendlyNeighbors.map(n => allMyGroups.find(g => g.stones.some(s => s.x === n.x && s.y === n.y))))];
                if (neighborGroups.length > 1) {
                    let connectionScore = 300;
                    if (activeHeuristics.has('h11') && neighborGroups.some(g => g && g.liberties < 4)) {
                        connectionScore *= 3;
                    }
                    scoredMove.score += connectionScore;
                    scoredMove.reasons.push('h5/h11:connect');
                } else if (activeHeuristics.has('h10')) {
                    scoredMove.score += 25;
                    scoredMove.reasons.push('h10:extend');
                }
            }
        }
        if (activeHeuristics.has('h6')) {
            const line = getLine(move);
            const cornerDist = Math.min(move.x, boardSize - 1 - move.x) + Math.min(move.y, boardSize - 1 - move.y);
            let territoryScore = 0;
            if (line === 4) territoryScore += 50;
            if (line === 3) territoryScore += 40;
            if (cornerDist < 5) territoryScore += 30; else if (line <= 4) territoryScore += 20;
            if (aiPlayerLevel >= 2 && aiPlayerLevel <= 8 && neighbors.some(n => {
                const group = allOpponentGroups.find(g => g.stones.some(s => s.x === n.x && s.y === n.y));
                return group && group.liberties > 3;
            })) {
                territoryScore *= 0.5;
            }
            scoredMove.score += territoryScore;
            scoredMove.reasons.push('h6:territory');
        }
        if (activeHeuristics.has('h9')) {
            const line = getLine(move);
            if (line === 3 || line === 4) {
                scoredMove.score += 50;
                scoredMove.reasons.push('h9:3-4line');
            }
        }
        if (activeHeuristics.has('h12')) {
            const line = getLine(move);
            if (line === 3 || line === 4) {
                const { x, y } = move; let hasBacking = false;
                if (y > 0 && y < boardSize - 1 && x > 0 && x < boardSize - 1) {
                    if ((y < line && game.boardState[y-1][x] === aiPlayer) || (y > boardSize - 1 - line && game.boardState[y+1][x] === aiPlayer) || (x < line && game.boardState[y][x-1] === aiPlayer) || (x > boardSize - 1 - line && game.boardState[y][x+1] === aiPlayer)) hasBacking = true;
                }
                if (hasBacking) {
                    scoredMove.score += 60;
                    scoredMove.reasons.push('h12:wall');
                }
            }
        }
        if (activeHeuristics.has('h15')) {
            const opponentNeighbors = neighbors.filter(n => game.boardState[n.y][n.x] === opponentPlayer);
            const friendlyNeighbors = neighbors.filter(n => game.boardState[n.y][n.x] === aiPlayer);
            if (opponentNeighbors.length > 0 && friendlyNeighbors.length > 0) {
                let maxLibs = 0;
                for (const fn of friendlyNeighbors) {
                    const group = allMyGroups.find(g => g.stones.some(s => s.x === fn.x && s.y === fn.y));
                    if (group && group.liberties > maxLibs) maxLibs = group.liberties;
                }
                if (maxLibs > 2) {
                    scoredMove.score += maxLibs * 10;
                    scoredMove.reasons.push('h15:strong_connect_attack');
                }
            }
        }
        if (activeHeuristics.has('h17')) {
            const opponentNeighbors = neighbors.filter(n => game.boardState[n.y][n.x] === opponentPlayer);
            for (const on of opponentNeighbors) {
                const oppGroup = allOpponentGroups.find(g => g.stones.some(s => s.x === on.x && s.y === on.y));
                if (oppGroup && oppGroup.stones.length <= 3) {
                    const oppNeighbors = oppGroup.stones.flatMap(s => logic.getNeighbors(s.x, s.y));
                    const uniqueOppNeighbors = [...new Set(oppNeighbors.map(n => `${n.x},${n.y}`))];
                    let friendlyInfluence = 0;
                    for (const key of uniqueOppNeighbors) {
                        // FIX: Cast 'key' to string to resolve 'split does not exist on type unknown' error, which is likely due to a type inference issue in the environment.
                        const [nx, ny] = (key as string).split(',').map(Number);
                        if (game.boardState[ny][nx] === aiPlayer) friendlyInfluence++;
                    }
                    if (friendlyInfluence > uniqueOppNeighbors.length / 2) {
                        scoredMove.score += 150;
                        scoredMove.reasons.push('h17:defend_territory');
                        break;
                    }
                }
            }
        }
    }

    scoredMoves.sort((a, b) => b.score - a.score);
    
    // Choose from top 3 candidates to add some randomness
    const topCandidates = scoredMoves.slice(0, 3);
    const bestMoveObject = topCandidates[Math.floor(Math.random() * topCandidates.length)];

    if (!bestMoveObject) {
        game.pendingAiMove = Promise.resolve({ x: -1, y: -1 }); // Pass if no valid moves
    } else {
        game.pendingAiMove = Promise.resolve(bestMoveObject.move);
    }
};

export const makeAiHiddenMove = async (game: LiveGameSession): Promise<void> => {
    game.gameStatus = GameStatus.Playing;
    await makeStrategicAiMove(game);
};
