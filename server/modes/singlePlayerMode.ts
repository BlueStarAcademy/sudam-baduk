import { randomUUID } from 'crypto';
import * as db from '../db.js';
import * as types from '../../types.js';
import { SINGLE_PLAYER_STAGES } from '../../constants.js';
import { initializeGame } from '../gameModes.js';
import { getAiUser } from '../aiPlayer.js';
import * as effectService from '../effectService.js';
import { getGoLogic } from '../goLogic.js';

const areAnyStonesCaptured = (boardState: types.BoardState, boardSize: number): boolean => {
    const logic = getGoLogic({ boardState, settings: { boardSize } } as types.LiveGameSession);
    const blackGroups = logic.getAllGroups(types.Player.Black, boardState);
    if (blackGroups.some(g => g.liberties === 0)) return true;
    const whiteGroups = logic.getAllGroups(types.Player.White, boardState);
    if (whiteGroups.some(g => g.liberties === 0)) return true;
    return false;
};

const gameTypeToMode: Record<types.GameType, types.GameMode> = {
    'capture': types.GameMode.Capture,
    'survival': types.GameMode.Standard,
    'speed': types.GameMode.Speed,
    'missile': types.GameMode.Missile,
    'hidden': types.GameMode.Hidden
};

export const handleSinglePlayerGameStart = async (volatileState: types.VolatileState, payload: any, user: types.User): Promise<types.HandleActionResult> => {
    const { stageId } = payload;
    const stage = SINGLE_PLAYER_STAGES.find(s => s.id === stageId);
    if (!stage) {
        return { error: '유효하지 않은 스테이지입니다.' };
    }

    const stageIndex = SINGLE_PLAYER_STAGES.findIndex(s => s.id === stageId);
    if (!user.isAdmin && (user.singlePlayerProgress ?? 0) < stageIndex) {
        return { error: '아직 잠금 해제되지 않은 스테이지입니다.' };
    }
    
    const now = Date.now();
    if (!user.isAdmin) {
        const effects = effectService.calculateUserEffects(user);
        const maxAP = effects.maxActionPoints;
        const wasAtMax = user.actionPoints.current >= maxAP;
        
        if (user.actionPoints.current < stage.actionPointCost) {
            return { error: '행동력이 부족합니다.' };
        }
    
        user.actionPoints.current -= stage.actionPointCost;
        if (wasAtMax) {
            user.lastActionPointUpdate = now;
        }
    }

    const aiOpponent = getAiUser(types.GameMode.Standard, 1, stage.level);
    aiOpponent.strategyLevel = stage.katagoLevel;

    const mode = stage.gameType ? gameTypeToMode[stage.gameType] : types.GameMode.Standard;

    const gameSettings: types.GameSettings = {
        boardSize: stage.boardSize,
        komi: 0.5,
        timeLimit: stage.timeControl.mainTime,
        byoyomiTime: stage.timeControl.type === 'byoyomi' ? stage.timeControl.byoyomiTime : 30,
        byoyomiCount: stage.timeControl.type === 'byoyomi' ? stage.timeControl.byoyomiCount : 3,
        timeIncrement: stage.timeControl.type === 'fischer' ? stage.timeControl.increment : 5,
        aiDifficulty: stage.katagoLevel,
        missileCount: stage.missileCount,
        hiddenStoneCount: stage.hiddenStoneCount,
        scanCount: stage.scanCount,
        captureTarget: stage.targetScore?.black,
    } as types.GameSettings;
    
    const game: types.LiveGameSession = {
        id: `game-sp-${randomUUID()}`,
        mode: mode,
        settings: gameSettings,
        player1: user,
        player2: aiOpponent,
        isAiGame: true,
        isSinglePlayer: true,
        stageId: stageId,
        boardState: Array(stage.boardSize).fill(0).map(() => Array(stage.boardSize).fill(types.Player.None)),
        moveHistory: [],
        captures: { [types.Player.None]: 0, [types.Player.Black]: 0, [types.Player.White]: 0 },
        baseStoneCaptures: { [types.Player.None]: 0, [types.Player.Black]: 0, [types.Player.White]: 0 },
        hiddenStoneCaptures: { [types.Player.None]: 0, [types.Player.Black]: 0, [types.Player.White]: 0 },
        winner: null,
        winReason: null,
        createdAt: now,
        lastMove: null,
        passCount: 0,
        koInfo: null,
        winningLine: null,
        statsUpdated: false,
        blackPlayerId: user.id,
        whitePlayerId: aiOpponent.id,
        currentPlayer: types.Player.Black,
        gameStatus: 'playing',
        blackTimeLeft: stage.timeControl.mainTime * 60,
        whiteTimeLeft: stage.timeControl.mainTime * 60,
        blackByoyomiPeriodsLeft: stage.timeControl.type === 'byoyomi' ? stage.timeControl.byoyomiCount : 0,
        whiteByoyomiPeriodsLeft: stage.timeControl.type === 'byoyomi' ? stage.timeControl.byoyomiCount : 0,
        disconnectionCounts: { [user.id]: 0, [aiOpponent.id]: 0 },
        turnStartTime: now,
        turnDeadline: now + stage.timeControl.mainTime * 60 * 1000,
        gameType: stage.gameType,
        autoEndTurnCount: stage.autoEndTurnCount,
        whiteStoneLimit: stage.whiteStoneLimit,
        whiteStonesPlaced: 0,
        blackStonesPlaced: 0,
        blackStoneLimit: stage.blackStoneLimit,
        effectiveCaptureTargets: {
            [types.Player.Black]: stage.targetScore?.black ?? 0,
            [types.Player.White]: stage.targetScore?.white ?? 0,
            [types.Player.None]: 0,
        },
        round: 1,
        turnInRound: 1,
        scores: { [user.id]: 0, [aiOpponent.id]: 0 },
        // FIX: Added missing 'currentActionButtons' property required by LiveGameSession type.
        currentActionButtons: { [user.id]: [], [aiOpponent.id]: [] },
    };

    let attempts = 0;
    const MAX_PLACEMENT_ATTEMPTS = 10;
    do {
        game.boardState = Array(stage.boardSize).fill(0).map(() => Array(stage.boardSize).fill(types.Player.None));
        game.blackPatternStones = [];
        game.whitePatternStones = [];
        
        const allPoints: types.Point[] = Array.from({ length: stage.boardSize * stage.boardSize }, (_, i) => ({ x: i % stage.boardSize, y: Math.floor(i / stage.boardSize) })).sort(() => 0.5 - Math.random());
        
        const placeStones = (count: number, player: types.Player, isPattern: boolean) => {
            const key = player === types.Player.Black ? 'blackPatternStones' : 'whitePatternStones';
            if (isPattern && !game[key]) game[key] = [];
            for (let i = 0; i < count; i++) {
                if (allPoints.length === 0) break;
                const p = allPoints.pop()!;
                game.boardState[p.y][p.x] = player;
                if (isPattern) game[key]!.push(p);
            }
        };
        
        placeStones(stage.placements.black, types.Player.Black, false);
        placeStones(stage.placements.white, types.Player.White, false);
        placeStones(stage.placements.blackPattern, types.Player.Black, true);
        placeStones(stage.placements.whitePattern, types.Player.White, true);
        
        attempts++;
        if (attempts >= MAX_PLACEMENT_ATTEMPTS) {
            console.warn(`[Placement] Could not generate a stable board for stage ${stage.id} after ${MAX_PLACEMENT_ATTEMPTS} attempts. Using last attempt.`);
            break;
        }
    } while (areAnyStonesCaptured(game.boardState, stage.boardSize));

    await db.saveGame(game);
    await db.updateUser(user);

    volatileState.userStatuses[user.id] = { status: 'in-game', mode: game.mode, gameId: game.id };
    return { clientResponse: { updatedUser: user } };
};

export const handleSinglePlayerRefresh = async (game: types.LiveGameSession, user: types.User): Promise<types.HandleActionResult> => {
    if (game.moveHistory.length > 0) return { error: 'Game has already started.' };
    const refreshesUsed = game.singlePlayerPlacementRefreshesUsed || 0;
    if (refreshesUsed >= 5) return { error: 'No more refreshes available.' };
    
    const costs = [0, 50, 100, 200, 300];
    const cost = costs[refreshesUsed];
    if (user.gold < cost && !user.isAdmin) return { error: '골드가 부족합니다.' };
    
    if (!user.isAdmin) {
        user.gold -= cost;
    }
    game.singlePlayerPlacementRefreshesUsed = refreshesUsed + 1;

    const stage = SINGLE_PLAYER_STAGES.find(s => s.id === game.stageId);
    if (!stage) return { error: 'Stage not found.' };

    let attempts = 0;
    const MAX_PLACEMENT_ATTEMPTS = 10;
    do {
        game.boardState = Array(stage.boardSize).fill(0).map(() => Array(stage.boardSize).fill(types.Player.None));
        game.blackPatternStones = [];
        game.whitePatternStones = [];

        const allPoints: types.Point[] = Array.from({ length: stage.boardSize * stage.boardSize }, (_, i) => ({ x: i % stage.boardSize, y: Math.floor(i / stage.boardSize) })).sort(() => 0.5 - Math.random());
        const placeStones = (count: number, player: types.Player, isPattern: boolean) => {
            const key = player === types.Player.Black ? 'blackPatternStones' : 'whitePatternStones';
            if (isPattern) game[key] = [];
            for (let i = 0; i < count; i++) {
                if (allPoints.length === 0) break;
                const p = allPoints.pop()!;
                game.boardState[p.y][p.x] = player;
                if (isPattern) game[key]!.push(p);
            }
        };
        
        placeStones(stage.placements.black, types.Player.Black, false);
        placeStones(stage.placements.white, types.Player.White, false);
        placeStones(stage.placements.blackPattern, types.Player.Black, true);
        placeStones(stage.placements.whitePattern, types.Player.White, true);
        
        attempts++;
        if (attempts >= MAX_PLACEMENT_ATTEMPTS) {
            console.warn(`[Placement] Could not generate a stable board for stage ${stage.id} after ${MAX_PLACEMENT_ATTEMPTS} attempts. Using last attempt.`);
            break;
        }
    } while (areAnyStonesCaptured(game.boardState, stage.boardSize));
    
    await db.saveGame(game);
    await db.updateUser(user);
    return { clientResponse: { updatedUser: user } };
};
