
import * as types from '../types/index.js';
import { Point } from '../types/index.js';
import { aiUserId, BOT_NAMES, AVATAR_POOL, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants.js';
import { createDefaultBaseStats, createDefaultSpentStatPoints, createDefaultInventory, defaultStats, createDefaultQuests } from './initialData.js';
import { getGoLogic, processMove } from './goLogic.js';
import { getOmokLogic } from './omokLogic.js';
import { endGame, getGameResult } from './summaryService.js';
import { finishPlacingTurn as finishDiceGoPlacingTurn } from './modes/diceGo.js';
import { finishThiefPlacingTurn } from './modes/thief.js';
import { SinglePlayerLevel } from '../types/index.js';

export { aiUserId }; // Re-export for other modules

export const getAiUser = (mode: types.GameMode, difficulty: number = 1, singlePlayerLevel?: SinglePlayerLevel): types.User => {
    let botName: string;

    if (singlePlayerLevel) { // This is for Single Player or Tower Challenge with a defined level
        switch (singlePlayerLevel) {
            case SinglePlayerLevel.입문: botName = '입문봇'; break;
            case SinglePlayerLevel.초급: botName = '초급봇'; break;
            case SinglePlayerLevel.중급: botName = '중급봇'; break;
            case SinglePlayerLevel.고급: botName = '고급봇'; break;
            case SinglePlayerLevel.유단자: botName = '유단자봇'; break;
            default: botName = 'AI 상대'; break;
        }
    } else { // Waiting room AI or Tower bot without a level
        switch (mode) {
            case types.GameMode.Standard: botName = '탑봇'; break; // Generic strategic bot (used for Tower)
            case types.GameMode.Dice: botName = '주사위바둑봇'; break;
            case types.GameMode.Omok: botName = '오목봇'; break;
            case types.GameMode.Ttamok: botName = '따목봇'; break;
            case types.GameMode.Thief: botName = '도둑과경찰봇'; break;
            case types.GameMode.Alkkagi: botName = '알까기봇'; break;
            case types.GameMode.Curling: botName = '바둑컬링봇'; break;
            default: botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]; break;
        }
    }

    const baseStats = createDefaultBaseStats();
    
    Object.keys(baseStats).forEach(key => {
        const stat = key as types.CoreStat;
        baseStats[stat] = 80 + difficulty * 20 + Math.floor(Math.random() * 20 - 10);
    });

    const user: types.User = {
        id: aiUserId,
        username: `ai-${botName.toLowerCase()}`,
        nickname: botName,
        isAdmin: false,
        strategyLevel: difficulty,
        strategyXp: 0,
        playfulLevel: difficulty,
        playfulXp: 0,
        baseStats: baseStats,
        spentStatPoints: createDefaultSpentStatPoints(),
        inventory: createDefaultInventory(),
        inventorySlots: 40,
        equipment: {},
        actionPoints: { current: 999, max: 999 },
        lastActionPointUpdate: 0,
        gold: 0,
        diamonds: 0,
        mannerScore: 200,
        mail: [],
        quests: createDefaultQuests(),
        stats: JSON.parse(JSON.stringify(defaultStats)),
        avatarId: 'profile_15',
        borderId: 'default',
        ownedBorders: ['default'],
        tournamentScore: 1200 + (difficulty-1)*50,
        league: types.LeagueTier.Sprout,
        mbti: null,
        isMbtiPublic: false,
        singlePlayerProgress: 0,
        singlePlayerMissions: {},
        towerProgress: { highestFloor: 0, lastClearTimestamp: 0 },
    };
    return user;
};

const makeStrategicAiMove = async (game: types.LiveGameSession) => {
    const logic = getGoLogic(game);
    const board = game.boardState;
    const boardSize = game.settings.boardSize;
    const aiPlayer = game.currentPlayer;
    const humanPlayer = aiPlayer === types.Player.Black ? types.Player.White : types.Player.Black;
    const aiLevel = game.settings.aiDifficulty || 1;

    const allEmptyPoints: Point[] = [];
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (board[y][x] === types.Player.None) {
                allEmptyPoints.push({ x, y });
            }
        }
    }

    const validMoves = allEmptyPoints.filter(p => processMove(board, { ...p, player: aiPlayer }, game.koInfo, game.moveHistory.length).isValid);
    if (validMoves.length === 0) {
        await endGame(game, humanPlayer, 'resign');
        return;
    }

    const handleSurvivalPostAiMove = async () => {
        if (game.gameType !== 'survival') return false; // Not a survival game
        
        game.whiteStonesPlaced = (game.whiteStonesPlaced ?? 0) + 1;

        const aiTarget = game.effectiveCaptureTargets![aiPlayer];
        if (game.captures[aiPlayer] >= aiTarget) {
            await endGame(game, aiPlayer, 'capture_limit');
            return true; // Game ended
        }

        if (game.whiteStonesPlaced! >= game.whiteStoneLimit!) {
            await endGame(game, humanPlayer, 'stone_limit_exceeded');
            return true; // Game ended
        }
        
        return false; // Game continues
    }

    const setHumanPlayerTurn = () => {
        const now = Date.now();
        game.currentPlayer = humanPlayer;
        game.turnStartTime = now;
        if (game.settings.timeLimit > 0 || game.isSinglePlayer || game.isTowerChallenge) { // SP also needs timer reset.
            const humanTimeKey = humanPlayer === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
            const byoyomiKey = humanPlayer === types.Player.Black ? 'blackByoyomiPeriodsLeft' : 'whiteByoyomiPeriodsLeft';
            // FIX: The `timeControl` property does not exist on `LiveGameSession`.
            // For single-player AI games, the mode is set directly, so we can check `game.mode`.
            const isFischer = game.mode === types.GameMode.Speed;
            
            const isInByoyomi = game[humanTimeKey] <= 0 && game.settings.byoyomiCount > 0 && !isFischer;
            if (isInByoyomi) {
                game.turnDeadline = now + game.settings.byoyomiTime * 1000;
            } else {
                if (isFischer) {
                    // FIX: The time increment is stored in `game.settings`, not on a `timeControl` object.
                    game[humanTimeKey] += game.settings.timeIncrement || 0;
                }
                game.turnDeadline = now + game[humanTimeKey] * 1000;
            }
        }
    };

    const makeMove = async (move: Point, isHidden: boolean = false) => {
        const result = processMove(game.boardState, { ...move, player: aiPlayer }, game.koInfo, game.moveHistory.length);
        if (result.isValid) {
            game.boardState = result.newBoardState;
            game.captures[aiPlayer] += result.capturedStones.length;
            game.koInfo = result.newKoInfo;
            game.lastMove = move;
            game.moveHistory.push({ player: aiPlayer, ...move });
            if (isHidden) {
                if (!game.hiddenMoves) game.hiddenMoves = {};
                game.hiddenMoves[game.moveHistory.length - 1] = true;
                game.hidden_stones_used_p2 = (game.hidden_stones_used_p2 || 0) + 1;
            }
            game.passCount = 0;

            // FIX: The `timeControl` property does not exist on `LiveGameSession`.
            // For single-player AI games, the mode is set directly, so we can check `game.mode`.
            if (game.mode === types.GameMode.Speed) {
                const aiTimeKey = aiPlayer === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                // FIX: The time increment is stored in `game.settings`, not on a `timeControl` object.
                game[aiTimeKey] += game.settings.timeIncrement || 0;
            }

            if (game.autoEndTurnCount && game.moveHistory.length >= game.autoEndTurnCount) {
                getGameResult(game);
                return;
            }

            const gameEnded = await handleSurvivalPostAiMove();
            if (gameEnded) return;

            if ((game.isSinglePlayer || game.isTowerChallenge) && (game.gameType === 'capture' || game.gameType === 'survival')) {
                const aiTarget = game.effectiveCaptureTargets![aiPlayer];
                if (game.captures[aiPlayer] >= aiTarget) {
                    await endGame(game, aiPlayer, 'capture_limit');
                    return;
                }
    
                const humanTarget = game.effectiveCaptureTargets![humanPlayer];
                if (game.captures[humanPlayer] >= humanTarget) {
                    await endGame(game, humanPlayer, 'capture_limit');
                    return;
                }
            }

            setHumanPlayerTurn();
        } else {
            console.error(`[AI Error] AI tried to make an invalid move: ${JSON.stringify(move)}, reason: ${result.reason}`);
            await passTurn();
        }
    };

    const passTurn = async () => {
        game.passCount++;
        game.lastMove = { x: -1, y: -1 };
        game.moveHistory.push({ player: aiPlayer, x: -1, y: -1 });

        // FIX: The `timeControl` property does not exist on `LiveGameSession`.
        // For single-player AI games, the mode is set directly, so we can check `game.mode`.
        if (game.mode === types.GameMode.Speed) {
            const aiTimeKey = aiPlayer === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
            // FIX: The time increment is stored in `game.settings`, not on a `timeControl` object.
            game[aiTimeKey] += game.settings.timeIncrement || 0;
        }

        if (game.autoEndTurnCount && game.moveHistory.length >= game.autoEndTurnCount) {
            getGameResult(game);
            return;
        }
        
        const gameEnded = await handleSurvivalPostAiMove();
        if (gameEnded) return;

        setHumanPlayerTurn();
    };
    
    // AI Hidden stone logic
    if (game.isSinglePlayer && game.gameType === 'hidden' && aiPlayer === types.Player.White) {
        const hiddenStonesLeft = (game.settings.hiddenStoneCount || 0) - (game.hidden_stones_used_p2 || 0);
        if (hiddenStonesLeft > 0) {
            const moveNumber = game.moveHistory.length + 1;
            const turnNumber = Math.ceil(moveNumber / 2);

            let shouldPlaceHidden = false;
            // First hidden stone
            if ((game.hidden_stones_used_p2 || 0) === 0 && turnNumber >= 1 && turnNumber <= 10) {
                shouldPlaceHidden = true;
            }
            // Second hidden stone (if applicable)
            if ((game.settings.hiddenStoneCount || 0) >= 2 && (game.hidden_stones_used_p2 || 0) === 1 && turnNumber >= 25 && turnNumber <= 30) {
                shouldPlaceHidden = true;
            }

            if (shouldPlaceHidden) {
                if (validMoves.length > 0) {
                    const chosenMove = validMoves[Math.floor(Math.random() * validMoves.length)];
                    await makeMove(chosenMove, true);
                    return; // Move made, exit function
                }
            }
        }
    }

    const avoidSelfAtariProb = 0.5 + (aiLevel - 1) * 0.05;
    const shouldAvoidSelfAtari = Math.random() < avoidSelfAtariProb;

    const isSelfAtari = (move: Point, currentBoard: types.BoardState): boolean => {
        const captureResult = processMove(currentBoard, { ...move, player: aiPlayer }, game.koInfo, game.moveHistory.length);
        if (captureResult.capturedStones.length > 0) {
            return false;
        }

        const tempBoard = JSON.parse(JSON.stringify(currentBoard));
        tempBoard[move.y][move.x] = aiPlayer;
        const group = logic.findGroup(move.x, move.y, aiPlayer, tempBoard);
        return group !== null && group.liberties === 1;
    };

    // --- 1. Immediate Capture (100% rule) ---
    const capturingMoves: { move: Point; captures: number }[] = [];
    for (const p of allEmptyPoints) {
        const result = processMove(board, { ...p, player: aiPlayer }, game.koInfo, game.moveHistory.length);
        if (result.isValid && result.capturedStones.length > 0) {
            capturingMoves.push({ move: p, captures: result.capturedStones.length });
        }
    }

    let validCapturingMoves = capturingMoves;
    if (shouldAvoidSelfAtari) {
        validCapturingMoves = capturingMoves.filter(m => !isSelfAtari(m.move, board));
    }

    if (validCapturingMoves.length > 0) {
        validCapturingMoves.sort((a, b) => b.captures - a.captures);
        const bestCaptureCount = validCapturingMoves[0].captures;
        const bestMoves = validCapturingMoves.filter(m => m.captures === bestCaptureCount);
        const chosenMove = bestMoves[Math.floor(Math.random() * bestMoves.length)].move;
        await makeMove(chosenMove);
        return;
    }

    // --- 2. Put opponent groups in atari (100% rule) ---
    const atariMoves: { move: Point; groupSize: number }[] = [];
    const opponentGroups = logic.getAllGroups(humanPlayer, board);
    for (const p of allEmptyPoints) {
        const result = processMove(board, { ...p, player: aiPlayer }, game.koInfo, game.moveHistory.length);
        if (result.isValid) {
            for (const group of opponentGroups) {
                if (group.libertyPoints.has(`${p.x},${p.y}`)) {
                    const groupAfterMove = logic.findGroup(group.stones[0].x, group.stones[0].y, humanPlayer, result.newBoardState);
                    if (groupAfterMove && groupAfterMove.liberties === 1) {
                        atariMoves.push({ move: p, groupSize: group.stones.length });
                        break; 
                    }
                }
            }
        }
    }

    let validAtariMoves = atariMoves;
    if (shouldAvoidSelfAtari) {
        validAtariMoves = atariMoves.filter(m => !isSelfAtari(m.move, board));
    }

    if (validAtariMoves.length > 0) {
        validAtariMoves.sort((a, b) => b.groupSize - a.groupSize);
        const bestGroupSize = validAtariMoves[0].groupSize;
        const bestMoves = validAtariMoves.filter(m => m.groupSize === bestGroupSize);
        const chosenMove = bestMoves[Math.floor(Math.random() * bestMoves.length)].move;
        await makeMove(chosenMove);
        return;
    }

    // --- 3. Save own groups from atari (Probabilistic rule) ---
    let saveProb = 0.5 + (aiLevel - 1) * 0.05;
    if (aiLevel >= 10) saveProb = 1;

    if (Math.random() < saveProb) {
        const myGroups = logic.getAllGroups(aiPlayer, board);
        const atariGroups = myGroups.filter(g => g.liberties === 1);
        if (atariGroups.length > 0) {
            const savingMoves: { move: Point; groupSize: number }[] = [];
            for (const group of atariGroups) {
                const libertyPointKey = group.libertyPoints.values().next().value;
                if (libertyPointKey) {
                    const [x, y] = libertyPointKey.split(',').map(Number);
                    const move = { x, y };
                    // Ensure the saving move isn't suicide
                    const result = processMove(board, { ...move, player: aiPlayer }, game.koInfo, game.moveHistory.length);
                    if (result.isValid) {
                        savingMoves.push({ move, groupSize: group.stones.length });
                    }
                }
            }

            if (savingMoves.length > 0) {
                savingMoves.sort((a, b) => b.groupSize - a.groupSize); // Prioritize saving larger groups
                const chosenMove = savingMoves[0].move;
                await makeMove(chosenMove);
                return;
            }
        }
    }
    
    // --- 4. Center-oriented positional play (100% rule) ---
    let validPositionalMoves = validMoves;
    if (shouldAvoidSelfAtari) {
        validPositionalMoves = validMoves.filter(p => !isSelfAtari(p, board));
        if (validPositionalMoves.length === 0) {
            validPositionalMoves = validMoves;
        }
    }

    const centerPoints = validPositionalMoves.filter(p => p.x >= 2 && p.x < boardSize - 2 && p.y >= 2 && p.y < boardSize - 2);
    if (centerPoints.length > 0) {
        const chosenMove = centerPoints[Math.floor(Math.random() * centerPoints.length)];
        await makeMove(chosenMove);
        return;
    } else {
        const chosenMove = validPositionalMoves[Math.floor(Math.random() * validPositionalMoves.length)];
        await makeMove(chosenMove);
        return;
    }
};

const makePlayfulAiMove = async (game: types.LiveGameSession) => {
    const { boardSize } = game.settings;
    const now = Date.now();
    
    switch (game.mode) {
        case types.GameMode.Omok:
        case types.GameMode.Ttamok: {
            const logic = getOmokLogic(game);
            let bestMove: types.Point | null = null;
            let maxScore = -1;
            const opponent = game.currentPlayer === types.Player.Black ? types.Player.White : types.Player.Black;

            const calculateScore = (x: number, y: number, player: types.Player, board: types.BoardState) => {
                let score = 0;
                const directions = [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }, { dx: 1, dy: -1 }];
                
                const tempBoard = JSON.parse(JSON.stringify(board));
                tempBoard[y][x] = player;

                for (const { dx, dy } of directions) {
                    const { length, openEnds } = logic.getLineStats(x, y, player, tempBoard, dx, dy);
                    
                    if (length >= 5) {
                         if (player === types.Player.Black && game.settings.hasOverlineForbidden && length > 5) {
                            return -100000;
                        }
                        return 100000;
                    }
                    if (length === 4) {
                        if (openEnds === 2) score += 5000;
                        else if (openEnds === 1) score += 500;
                    }
                    if (length === 3) {
                        if (openEnds === 2) score += 200;
                        else if (openEnds === 1) score += 20;
                    }
                    if (length === 2) {
                        if (openEnds === 2) score += 5;
                        else if (openEnds === 1) score += 1;
                    }
                }
                
                if (game.mode === types.GameMode.Ttamok) {
                    const potentialCaptures = logic.checkPotentialCaptures(x, y, player, tempBoard);
                    if (potentialCaptures > 0) {
                        score += potentialCaptures * 25;
                    }
                }

                return score;
            };

            for (let y = 0; y < boardSize; y++) {
                for (let x = 0; x < boardSize; x++) {
                    if (game.boardState[y][x] === types.Player.None) {
                        if (game.settings.has33Forbidden && game.currentPlayer === types.Player.Black && logic.is33(x, y, game.boardState)) {
                            continue;
                        }
                        
                        const myScore = calculateScore(x, y, game.currentPlayer, game.boardState);
                        const opponentScore = calculateScore(x, y, opponent, game.boardState);

                        const totalScore = myScore + opponentScore * 0.9;

                        if (totalScore > maxScore) {
                            maxScore = totalScore;
                            bestMove = { x, y };
                        }
                    }
                }
            }
            
            if (bestMove) {
                game.boardState[bestMove.y][bestMove.x] = game.currentPlayer;
                game.lastMove = bestMove;
                game.moveHistory.push({ player: game.currentPlayer, ...bestMove });
                
                const winCheck = logic.checkWin(bestMove.x, bestMove.y, game.boardState);
                if (winCheck) {
                    endGame(game, game.currentPlayer, 'omok_win');
                    return;
                }

                if(game.mode === types.GameMode.Ttamok) {
                    const { capturedCount } = logic.performTtamokCapture(bestMove.x, bestMove.y);
                    game.captures[game.currentPlayer] += capturedCount;
                    if (game.captures[game.currentPlayer] >= (game.settings.captureTarget || 10)) {
                        endGame(game, game.currentPlayer, 'capture_limit');
                        return;
                    }
                }
            } else {
                 const emptyPoints: Point[] = [];
                for (let y = 0; y < boardSize; y++) {
                    for (let x = 0; x < boardSize; x++) {
                        if (game.boardState[y][x] === types.Player.None) {
                            emptyPoints.push({ x, y });
                        }
                    }
                }
                if (emptyPoints.length > 0) {
                    bestMove = emptyPoints[Math.floor(Math.random() * emptyPoints.length)];
                    game.boardState[bestMove.y][bestMove.x] = game.currentPlayer;
                    game.lastMove = bestMove;
                    game.moveHistory.push({ player: game.currentPlayer, ...bestMove });
                } else {
                    game.passCount++;
                }
            }

            game.currentPlayer = game.currentPlayer === types.Player.Black ? types.Player.White : types.Player.Black;
            break;
        }

        case types.GameMode.Dice: {
            if (game.gameStatus === 'dice_rolling') {
                const dice1 = Math.floor(Math.random() * 6) + 1;
                const logic = getGoLogic(game);
                const liberties = logic.getAllLibertiesOfPlayer(types.Player.White, game.boardState);
                const isOvershot = liberties.length > 0 && dice1 > liberties.length;
                
                game.stonesToPlace = isOvershot ? -1 : dice1;
                game.animation = { type: 'dice_roll_main', dice: { dice1, dice2: 0, dice3: 0 }, startTime: now, duration: 1500 };
                game.gameStatus = 'dice_rolling_animating';
            } else if (game.gameStatus === 'dice_placing') {
                const goLogic = getGoLogic(game);
                while ((game.stonesToPlace ?? 0) > 0) {
                    const liberties = goLogic.getAllLibertiesOfPlayer(types.Player.White, game.boardState);
                    if (liberties.length === 0) {
                        break;
                    }

                    let maxCaptures = -1;
                    let bestMoves: types.Point[] = [];

                    for (const liberty of liberties) {
                        // Simulate placing a stone at the liberty to see the outcome
                        const tempResult = processMove(game.boardState, { ...liberty, player: types.Player.Black }, game.koInfo, game.moveHistory.length, { ignoreSuicide: true });
                        
                        if (tempResult.isValid) {
                            const captures = tempResult.capturedStones.length;
                            if (captures > maxCaptures) {
                                maxCaptures = captures;
                                bestMoves = [liberty]; // New best move found, start a new list
                            } else if (captures === maxCaptures) {
                                bestMoves.push(liberty); // Another move with the same capture count
                            }
                        }
                    }
                    
                    if (bestMoves.length === 0) {
                        // This should technically not be reached if liberties.length > 0
                        // because maxCaptures starts at -1 and any valid move has captures >= 0.
                        // But as a safeguard:
                        console.warn("[AI Dice Go] No valid moves found among liberties. Breaking.");
                        break;
                    }

                    const move = bestMoves[Math.floor(Math.random() * bestMoves.length)];
                    const result = processMove(game.boardState, { ...move, player: types.Player.Black }, game.koInfo, game.moveHistory.length, { ignoreSuicide: true });
                    
                    if(result.isValid) {
                        game.boardState = result.newBoardState;
                        game.diceCapturesThisTurn = (game.diceCapturesThisTurn || 0) + result.capturedStones.length;
                        if(result.capturedStones.length > 0) {
                            game.diceLastCaptureStones = result.capturedStones;
                        }
                    } else {
                        console.error(`AI Dice Go placement failed for a chosen 'best move'. Liberty was: ${JSON.stringify(move)}`);
                        // If somehow the best move is invalid, break to avoid issues.
                        break;
                    }
                    game.stonesToPlace = (game.stonesToPlace ?? 1) - 1;
                }
                finishDiceGoPlacingTurn(game, aiUserId);
            }
            return;
        }

        case types.GameMode.Thief: {
            const myRole = aiUserId === game.thiefPlayerId ? 'thief' : 'police';
            if (game.gameStatus === 'thief_rolling') {
                const dice1 = Math.floor(Math.random() * 6) + 1;
                let dice2 = 0;
                if (myRole === 'police') {
                    dice2 = Math.floor(Math.random() * 6) + 1;
                    game.stonesToPlace = dice1 + dice2;
                } else {
                    game.stonesToPlace = dice1;
                }
                game.animation = { type: 'dice_roll_main', dice: { dice1, dice2, dice3: 0 }, startTime: now, duration: 1500 };
                game.gameStatus = 'thief_rolling_animating';
            } else if (game.gameStatus === 'thief_placing') {
                while ((game.stonesToPlace ?? 0) > 0) {
                    const goLogic = getGoLogic(game);
                    let liberties: types.Point[];
                    if (myRole === 'thief') {
                        const noBlackStonesOnBoard = !game.boardState.flat().includes(types.Player.Black);
                        if (game.turnInRound === 1 || noBlackStonesOnBoard) {
                            liberties = [];
                            for (let y = 0; y < boardSize; y++) for (let x = 0; x < boardSize; x++) if (game.boardState[y][x] === types.Player.None) liberties.push({ x, y });
                        } else {
                            liberties = goLogic.getAllLibertiesOfPlayer(types.Player.Black, game.boardState);
                        }
                    } else { // police
                        liberties = goLogic.getAllLibertiesOfPlayer(types.Player.Black, game.boardState);
                    }
                    if (liberties.length === 0) break;
        
                    let move: types.Point;
                    if (myRole === 'thief') {
                        let bestMoves: types.Point[] = [];
                        let maxLiberties = -1;
        
                        for (const liberty of liberties) {
                            const tempBoard = JSON.parse(JSON.stringify(game.boardState));
                            tempBoard[liberty.y][liberty.x] = types.Player.Black;
                            const tempGameForLogic = { ...game, boardState: tempBoard };
                            const tempGoLogic = getGoLogic(tempGameForLogic);
                            const newLiberties = tempGoLogic.getAllLibertiesOfPlayer(types.Player.Black, tempBoard).length;
        
                            if (newLiberties > maxLiberties) {
                                maxLiberties = newLiberties;
                                bestMoves = [liberty];
                            } else if (newLiberties === maxLiberties) {
                                bestMoves.push(liberty);
                            }
                        }
                        
                        if (bestMoves.length > 0) {
                            move = bestMoves[Math.floor(Math.random() * bestMoves.length)];
                        } else {
                            move = liberties[Math.floor(Math.random() * liberties.length)];
                        }
                    } else {
                        // Police logic remains random
                        move = liberties[Math.floor(Math.random() * liberties.length)];
                    }
                    
                    const result = processMove(game.boardState, { ...move, player: game.currentPlayer }, game.koInfo, game.moveHistory.length, { ignoreSuicide: true });
                    if (result.isValid) {
                        game.boardState = result.newBoardState;
                        if (myRole === 'police' && result.capturedStones.length > 0) {
                            game.thiefCapturesThisRound = (game.thiefCapturesThisRound || 0) + result.capturedStones.length;
                        }
                    } else {
                        break; 
                    }
                    game.stonesToPlace = (game.stonesToPlace ?? 1) - 1;
                }
                finishThiefPlacingTurn(game);
            }
            return;
        }
        
        case types.GameMode.Alkkagi: {
            if (game.gameStatus === 'alkkagi_playing') {
                const myStones = (game.alkkagiStones || []).filter(s => s.player === game.currentPlayer && s.onBoard);
                if (myStones.length > 0) {
                    const stoneToFlick = myStones[Math.floor(Math.random() * myStones.length)];
                    const vx = (Math.random() - 0.5) * 25; // Random velocity
                    const vy = (Math.random() - 0.5) * 25;
                    
                    game.animation = { type: 'alkkagi_flick', stoneId: stoneToFlick.id, vx, vy, startTime: Date.now(), duration: 5000 };
                    game.gameStatus = 'alkkagi_animating';
                }
            }
            return;
        }

        case types.GameMode.Curling: {
             if (game.gameStatus === 'curling_playing') {
                const boardSizePx = 840;
                const cellSize = boardSizePx / 19;
                const padding = cellSize / 2;
                const launchAreaCellSize = 1;
                const launchAreaPx = launchAreaCellSize * cellSize;
                const stoneRadius = cellSize * 0.47;

                const launchAreas = [
                    { x: padding, y: padding, player: types.Player.White },
                    { x: boardSizePx - padding - launchAreaPx, y: padding, player: types.Player.White },
                    { x: padding, y: boardSizePx - padding - launchAreaPx, player: types.Player.Black },
                    { x: boardSizePx - padding - launchAreaPx, y: boardSizePx - padding - launchAreaPx, player: types.Player.Black },
                ].filter(a => a.player === game.currentPlayer);

                const launchArea = launchAreas[Math.floor(Math.random() * launchAreas.length)];
                const launchPosition = { x: launchArea.x + launchAreaPx / 2, y: launchArea.y + launchAreaPx / 2 };
                
                const targetX = boardSizePx / 2 + (Math.random() - 0.5) * cellSize * 4;
                const targetY = boardSizePx / 2 + (Math.random() - 0.5) * cellSize * 4;
                
                const dx = targetX - launchPosition.x;
                const dy = targetY - launchPosition.y;
                const mag = Math.hypot(dx, dy);
                const launchStrength = (Math.random() * 10) + 10;
                
                const vx = (dx / mag) * launchStrength;
                const vy = (dy / mag) * launchStrength;
                
                const newStone: types.AlkkagiStone = {
                    id: Date.now(), player: game.currentPlayer,
                    x: launchPosition.x, y: launchPosition.y,
                    vx: 0, vy: 0, radius: stoneRadius, onBoard: false
                };

                game.animation = { type: 'curling_flick', stone: newStone, velocity: { x: vx, y: vy }, startTime: now, duration: 8000 };
                game.gameStatus = 'curling_animating';
                game.stonesThrownThisRound![aiUserId]++;
            }
            return;
        }
    }

    game.turnStartTime = now;
    if (game.settings.timeLimit > 0) {
        const timeLeftKey = game.currentPlayer === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
        game.turnDeadline = now + game[timeLeftKey] * 1000;
    }
};

export const makeAiMove = async (game: types.LiveGameSession): Promise<void> => {
    if (SPECIAL_GAME_MODES.some(m => m.mode === game.mode) || game.isSinglePlayer || game.isTowerChallenge) {
        await makeStrategicAiMove(game);
    } else if (PLAYFUL_GAME_MODES.some(m => m.mode === game.mode)) {
        await makePlayfulAiMove(game);
    }
};
