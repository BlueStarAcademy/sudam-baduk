import * as types from '../types/index.js';
// FIX: Import Point type from centralized types.
import { Point } from '../types/index.js';
import { aiUserId, BOT_NAMES, AVATAR_POOL, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants.js';
import { createDefaultBaseStats, createDefaultSpentStatPoints, createDefaultInventory, defaultStats, createDefaultQuests } from './initialData.js';
import { getGoLogic, processMove } from './goLogic.js';
import { getOmokLogic } from './omokLogic.js';
import { endGame } from './summaryService.js';
// FIX: Corrected import paths for diceGo and thief mode helper functions to resolve module export errors.
import { finishPlacingTurn as finishDiceGoPlacingTurn } from './modes/diceGo.js';
import { finishThiefPlacingTurn } from './modes/thief.js';
import { SinglePlayerLevel } from '../types/index.js';

export { aiUserId }; // Re-export for other modules

export const getAiUser = (mode: types.GameMode, difficulty: number = 1, singlePlayerLevel?: SinglePlayerLevel): types.User => {
    let botName: string;

    if (mode === types.GameMode.Standard && singlePlayerLevel === undefined) {
        botName = '탑봇';
    } else if (singlePlayerLevel) {
        switch (singlePlayerLevel) {
            case SinglePlayerLevel.입문: botName = '입문봇'; break;
            case SinglePlayerLevel.초급: botName = '초급봇'; break;
            case SinglePlayerLevel.중급: botName = '중급봇'; break;
            case SinglePlayerLevel.고급: botName = '고급봇'; break;
            case SinglePlayerLevel.유단자: botName = '유단자봇'; break;
            default: botName = 'AI 상대'; break;
        }
    } else {
        switch (mode) {
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
        // FIX: Add missing 'towerProgress' property to conform to User type.
        towerProgress: { highestFloor: 0, lastClearTimestamp: 0 },
    };
    return user;
};


const makeStrategicAiMove = async (game: types.LiveGameSession) => {
    const { boardSize } = game.settings;

    const allEmptyPoints: types.Point[] = [];
    for(let y=0; y<boardSize; y++) {
        for(let x=0; x<boardSize; x++) {
            if(game.boardState[y][x] === types.Player.None) {
                allEmptyPoints.push({x,y});
            }
        }
    }
    
    let movesToTry: Point[];

    if (game.isTowerChallenge) {
        const edgeZoneSize = 2; // Outermost 2 lines are considered edges
        const centerPoints = allEmptyPoints.filter(p => 
            p.x >= edgeZoneSize && p.x < boardSize - edgeZoneSize &&
            p.y >= edgeZoneSize && p.y < boardSize - edgeZoneSize
        );
        const edgePoints = allEmptyPoints.filter(p => 
            p.x < edgeZoneSize || p.x >= boardSize - edgeZoneSize ||
            p.y < edgeZoneSize || p.y >= boardSize - edgeZoneSize
        );

        // Shuffle both to add variety within the zones
        centerPoints.sort(() => 0.5 - Math.random());
        edgePoints.sort(() => 0.5 - Math.random());

        movesToTry = [...centerPoints, ...edgePoints];
    } else {
        allEmptyPoints.sort(() => 0.5 - Math.random());
        movesToTry = allEmptyPoints;
    }

    for (const p of movesToTry) {
        const move = { x: p.x, y: p.y, player: game.currentPlayer };
        const result = processMove(game.boardState, move, game.koInfo, game.moveHistory.length);
        if (result.isValid) {
            game.boardState = result.newBoardState;
            game.captures[game.currentPlayer] += result.capturedStones.length;
            game.koInfo = result.newKoInfo;
            game.lastMove = { x: p.x, y: p.y };
            game.moveHistory.push(move);
            game.passCount = 0;
            
            game.currentPlayer = game.currentPlayer === types.Player.Black ? types.Player.White : types.Player.Black;
            game.turnStartTime = Date.now();
            if (game.settings.timeLimit > 0) {
                const timeLeftKey = game.currentPlayer === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                game.turnDeadline = Date.now() + game[timeLeftKey] * 1000;
            }
            return;
        }
    }

    // if no valid move, pass
    game.passCount++;
    game.lastMove = {x: -1, y: -1};
    game.moveHistory.push({ player: game.currentPlayer, x: -1, y: -1 });
    game.currentPlayer = game.currentPlayer === types.Player.Black ? types.Player.White : types.Player.Black;
    game.turnStartTime = Date.now();
    if (game.settings.timeLimit > 0) {
        const timeLeftKey = game.currentPlayer === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
        game.turnDeadline = Date.now() + game[timeLeftKey] * 1000;
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

            for (let y = 0; y < boardSize; y++) {
                for (let x = 0; x < boardSize; x++) {
                    if (game.boardState[y][x] === types.Player.None) {
                        let score = 0;
                        const neighbors = logic.getLineInfo(x, y, game.boardState);
                        score += Object.values(neighbors).reduce((s, l) => s + l, 0);
                        if (score > maxScore) {
                            maxScore = score;
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
                game.passCount++;
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
                const goLogic = getGoLogic(game);
                while ((game.stonesToPlace ?? 0) > 0) {
                    let liberties: types.Point[];
                    if (myRole === 'thief') {
                        const noBlackStonesOnBoard = !game.boardState.flat().includes(types.Player.Black);
                        if (game.turnInRound === 1 || noBlackStonesOnBoard) {
                            liberties = []; // Placeholder for all empty points
                            for(let y=0; y<boardSize; y++) for(let x=0; x<boardSize; x++) if(game.boardState[y][x] === types.Player.None) liberties.push({x,y});
                        } else {
                            liberties = goLogic.getAllLibertiesOfPlayer(types.Player.Black, game.boardState);
                        }
                    } else { // police
                        liberties = goLogic.getAllLibertiesOfPlayer(types.Player.Black, game.boardState);
                    }

                    if (liberties.length === 0) break;
                    
                    const move = liberties[Math.floor(Math.random() * liberties.length)];
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