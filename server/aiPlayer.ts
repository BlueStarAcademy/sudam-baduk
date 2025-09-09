
import * as types from '../types/index.js';
import { aiUserId, BOT_NAMES, AVATAR_POOL, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants.js';
import { createDefaultBaseStats, createDefaultSpentStatPoints, createDefaultInventory, defaultStats, createDefaultQuests } from './initialData.js';
import { getGoLogic, processMove } from './goLogic.js';
import { getOmokLogic } from './omokLogic.js';

export { aiUserId }; // Re-export for other modules

export const getAiUser = (mode: types.GameMode, difficulty: number = 1): types.User => {
    const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    const baseStats = createDefaultBaseStats();
    
    Object.keys(baseStats).forEach(key => {
        const stat = key as types.CoreStat;
        baseStats[stat] = 80 + difficulty * 20 + Math.floor(Math.random() * 20 - 10);
    });

    const user: types.User = {
        id: aiUserId, // Use imported constant
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
        avatarId: AVATAR_POOL[Math.floor(Math.random() * AVATAR_POOL.length)].id,
        borderId: 'default',
        ownedBorders: ['default'],
        tournamentScore: 1200 + (difficulty-1)*50,
        league: types.LeagueTier.Sprout,
        mbti: null,
        isMbtiPublic: false,
        singlePlayerProgress: 0,
        singlePlayerMissions: {},
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
    
    allEmptyPoints.sort(() => 0.5 - Math.random());

    for (const p of allEmptyPoints) {
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

    if(game.mode === types.GameMode.Omok || game.mode === types.GameMode.Ttamok) {
        const logic = getOmokLogic(game);
        let bestMove: types.Point | null = null;
        let maxScore = -1;

        for (let y = 0; y < boardSize; y++) {
            for (let x = 0; x < boardSize; x++) {
                if (game.boardState[y][x] === types.Player.None) {
                    let score = 0;
                    // Some simple scoring logic
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
        } else {
            game.passCount++;
        }
    }

    if (game.mode === types.GameMode.Dice) {
        if (game.gameStatus === 'dice_rolling') {
            game.stonesToPlace = Math.floor(Math.random() * 6) + 1;
            game.gameStatus = 'dice_placing';
        } else if (game.gameStatus === 'dice_placing') {
            const goLogic = getGoLogic(game);
            const liberties = goLogic.getAllLibertiesOfPlayer(types.Player.White, game.boardState);
            if (liberties.length > 0) {
                const move = liberties[Math.floor(Math.random() * liberties.length)];
                
                const result = processMove(game.boardState, { ...move, player: types.Player.Black }, game.koInfo, game.moveHistory.length, { ignoreSuicide: true });
                if (result.isValid) {
                    game.boardState = result.newBoardState;
                }
            }
            game.stonesToPlace = (game.stonesToPlace || 1) - 1;
        }
    }
    
    game.currentPlayer = game.currentPlayer === types.Player.Black ? types.Player.White : types.Player.Black;
    game.turnStartTime = Date.now();
    if (game.settings.timeLimit > 0) {
        const timeLeftKey = game.currentPlayer === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
        game.turnDeadline = Date.now() + game[timeLeftKey] * 1000;
    }
};

export const makeAiMove = async (game: types.LiveGameSession): Promise<void> => {
    if (SPECIAL_GAME_MODES.some(m => m.mode === game.mode)) {
        await makeStrategicAiMove(game);
    } else if (PLAYFUL_GAME_MODES.some(m => m.mode === game.mode)) {
        await makePlayfulAiMove(game);
    }
};
