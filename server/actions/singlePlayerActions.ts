

import { randomUUID } from 'crypto';
import * as db from '../db.js';
import * as types from '../../types.js';
import { initializeGame } from '../gameModes.js';
import { getAiUser } from '../aiPlayer.js';
import * as effectService from '../effectService.js';
import { getGoLogic } from '../goLogic.js';
import { SINGLE_PLAYER_STAGES, TOWER_STAGES, SINGLE_PLAYER_MISSIONS } from '../../constants.js';
import { updateQuestProgress } from '../questService.js';


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

const handleSinglePlayerGameStart = async (volatileState: types.VolatileState, payload: any, user: types.User): Promise<types.HandleActionResult> => {
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
                if (isPattern) (game[key]! as types.Point[]).push(p);
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

const handleTowerChallengeGameStart = async (volatileState: types.VolatileState, payload: any, user: types.User): Promise<types.HandleActionResult> => {
    // Similar to handleSinglePlayerGameStart but using TOWER_STAGES
    const { floor } = payload;
    const stage = TOWER_STAGES.find(s => s.floor === floor);
    if (!stage) return { error: '유효하지 않은 층입니다.' };

    const highestClearedFloor = user.towerProgress?.highestFloor ?? 0;
    if (!user.isAdmin && floor > highestClearedFloor + 1) {
         return { error: '아직 잠금 해제되지 않은 층입니다.' };
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


    const aiOpponent = getAiUser(types.GameMode.Standard, 10, stage.level);
    aiOpponent.strategyLevel = stage.katagoLevel;

    const negotiation: types.Negotiation = {
        id: `neg-tower-${randomUUID()}`,
        challenger: user,
        opponent: aiOpponent,
        mode: types.GameMode.Standard, // Tower uses a modified standard ruleset
        settings: {
            boardSize: stage.boardSize, komi: 0.5,
            timeLimit: stage.timeControl.mainTime,
            byoyomiTime: stage.timeControl.type === 'byoyomi' ? stage.timeControl.byoyomiTime : 30,
            byoyomiCount: stage.timeControl.type === 'byoyomi' ? stage.timeControl.byoyomiCount : 3,
            player1Color: types.Player.Black, aiDifficulty: stage.katagoLevel,
        } as types.GameSettings,
        proposerId: user.id, status: 'pending', deadline: 0
    };
    
    const game = await initializeGame(negotiation);
    game.isTowerChallenge = true;
    game.floor = floor;
    game.stageId = stage.id;
    game.blackStoneLimit = stage.blackStoneLimit;
    game.towerChallengePlacementRefreshesUsed = 0;
    game.addedStonesItemUsed = false;
    
    // ... placement logic from handleSinglePlayerGameStart ...
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
                if (isPattern) (game[key]! as types.Point[]).push(p);
            }
        };

        placeStones(stage.placements.black, types.Player.Black, false);
        placeStones(stage.placements.white, types.Player.White, false);
        placeStones(stage.placements.blackPattern, types.Player.Black, true);
        placeStones(stage.placements.whitePattern, types.Player.White, true);

        attempts++;
        if (attempts >= MAX_PLACEMENT_ATTEMPTS) break;
    } while (areAnyStonesCaptured(game.boardState, stage.boardSize));


    game.effectiveCaptureTargets = {
        [types.Player.Black]: stage.targetScore?.black ?? 0,
        [types.Player.White]: stage.targetScore?.white ?? 0,
        [types.Player.None]: 0,
    };
    
    await db.saveGame(game);
    await db.updateUser(user);

    volatileState.userStatuses[user.id] = { status: 'in-game', mode: game.mode, gameId: game.id };
    return { clientResponse: { updatedUser: user } };
};

const handleRefreshPlacement = async (
    game: types.LiveGameSession,
    user: types.User,
    type: 'singlePlayer' | 'tower'
): Promise<types.HandleActionResult> => {
    if (game.moveHistory.length > 0) return { error: 'Game has already started.' };

    const refreshesUsed = (type === 'singlePlayer' 
        ? game.singlePlayerPlacementRefreshesUsed 
        : game.towerChallengePlacementRefreshesUsed) || 0;
    
    if (refreshesUsed >= 5) return { error: '더 이상 새로고침할 수 없습니다.' };
    
    const costs = [0, 50, 100, 200, 300];
    const cost = costs[refreshesUsed];

    if (user.gold < cost && !user.isAdmin) return { error: `골드가 부족합니다. (필요: ${cost} 골드)` };
    
    if (!user.isAdmin) {
        user.gold -= cost;
    }

    if (type === 'singlePlayer') {
        game.singlePlayerPlacementRefreshesUsed = refreshesUsed + 1;
    } else {
        game.towerChallengePlacementRefreshesUsed = refreshesUsed + 1;
    }

    const stageList = type === 'singlePlayer' ? SINGLE_PLAYER_STAGES : TOWER_STAGES;
    const stage = stageList.find(s => s.id === game.stageId);
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
            if (isPattern && !game[key]) game[key] = [];
            for (let i = 0; i < count; i++) {
                if (allPoints.length === 0) break;
                const p = allPoints.pop()!;
                game.boardState[p.y][p.x] = player;
                if (isPattern) (game[key]! as types.Point[]).push(p);
            }
        };

        placeStones(stage.placements.black, types.Player.Black, false);
        placeStones(stage.placements.white, types.Player.White, false);
        placeStones(stage.placements.blackPattern, types.Player.Black, true);
        placeStones(stage.placements.whitePattern, types.Player.White, true);

        attempts++;
        if (attempts >= MAX_PLACEMENT_ATTEMPTS) break;
    } while (areAnyStonesCaptured(game.boardState, stage.boardSize));
    
    await db.saveGame(game);
    await db.updateUser(user);
    return { clientResponse: { updatedUser: user } };
};

export const handleAiGameAction = async (volatileState: types.VolatileState, action: types.ServerAction & { userId: string }, user: types.User): Promise<types.HandleActionResult> => {
    const { type, payload } = action;
    const gameId = payload?.gameId;

    switch (type) {
        case 'START_SINGLE_PLAYER_GAME':
            return handleSinglePlayerGameStart(volatileState, payload, user);
        
        case 'SINGLE_PLAYER_REFRESH_PLACEMENT': {
            if (!gameId) return { error: 'Game ID not provided.' };
            const game = await db.getLiveGame(gameId);
            if (!game) return { error: 'Game not found.' };
            return handleRefreshPlacement(game, user, 'singlePlayer');
        }

        case 'START_TOWER_CHALLENGE_GAME':
            updateQuestProgress(user, 'tower_challenge_participate');
            return handleTowerChallengeGameStart(volatileState, payload, user);

        case 'TOWER_CHALLENGE_REFRESH_PLACEMENT': {
            if (!gameId) return { error: 'Game ID not provided.' };
            const game = await db.getLiveGame(gameId);
            if (!game) return { error: 'Game not found.' };
            return handleRefreshPlacement(game, user, 'tower');
        }

        case 'TOWER_CHALLENGE_ADD_STONES': {
            if (!gameId) return { error: 'Game ID not provided.' };
            const game = await db.getLiveGame(gameId);
            if (!game) return { error: 'Game not found.' };

            if (game.addedStonesItemUsed) {
                return { error: '이미 돌 추가 아이템을 사용했습니다.' };
            }
            const cost = 300;
            if (user.gold < cost && !user.isAdmin) {
                return { error: '골드가 부족합니다.' };
            }

            if (!user.isAdmin) {
                user.gold -= cost;
            }

            game.blackStoneLimit = (game.blackStoneLimit || 0) + 3;
            game.addedStonesItemUsed = true;
            
            await db.saveGame(game);
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }
        
        case 'START_SINGLE_PLAYER_MISSION': {
            const { missionId } = payload;
            const mission = SINGLE_PLAYER_MISSIONS.find(m => m.id === missionId);
            if (!mission) return { error: '미션을 찾을 수 없습니다.' };
        
            if (!user.singlePlayerMissions) user.singlePlayerMissions = {};
            if (user.singlePlayerMissions[missionId]?.isStarted) return { error: '이미 시작된 미션입니다.' };
        
            user.singlePlayerMissions[missionId] = {
                id: missionId,
                isStarted: true,
                lastCollectionTime: Date.now(),
                accumulatedAmount: 0,
            };
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }

        default:
            return { error: `Unknown AI game action type: ${type}` };
    }
};