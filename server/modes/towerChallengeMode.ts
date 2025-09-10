import { randomUUID } from 'crypto';
import * as db from '../db.js';
import * as types from '../../types/index.js';
import { TOWER_STAGES } from '../../constants.js';
import { initializeGame } from '../gameModes.js';
import { getAiUser } from '../aiPlayer.js';
import * as effectService from '../effectService.js';

export const handleTowerChallengeGameStart = async (volatileState: types.VolatileState, payload: any, user: types.User): Promise<types.HandleActionResult> => {
    const { floor } = payload;
    const stage = TOWER_STAGES.find(s => s.floor === floor);
    if (!stage) {
        return { error: '유효하지 않은 층입니다.' };
    }

    const highestClearedFloor = user.towerProgress?.highestFloor ?? 0;
    if (floor > highestClearedFloor + 1) {
         return { error: '아직 잠금 해제되지 않은 층입니다.' };
    }

    const effects = effectService.calculateUserEffects(user);
    const maxAP = effects.maxActionPoints;
    const wasAtMax = user.actionPoints.current >= maxAP;
    
    if (user.actionPoints.current < stage.actionPointCost) {
        return { error: '행동력이 부족합니다.' };
    }

    const now = Date.now();
    user.actionPoints.current -= stage.actionPointCost;
    if (wasAtMax) {
        user.lastActionPointUpdate = now;
    }

    const aiOpponent = getAiUser(types.GameMode.Standard, 10, stage.level);
    aiOpponent.strategyLevel = stage.katagoLevel;

    const negotiation: types.Negotiation = {
        id: `neg-tower-${randomUUID()}`,
        challenger: user,
        opponent: aiOpponent,
        mode: types.GameMode.Standard,
        settings: {
            boardSize: stage.boardSize,
            komi: 0.5,
            timeLimit: stage.timeControl.mainTime,
            byoyomiTime: stage.timeControl.type === 'byoyomi' ? stage.timeControl.byoyomiTime : 30,
            byoyomiCount: stage.timeControl.type === 'byoyomi' ? stage.timeControl.byoyomiCount : 3,
            timeIncrement: stage.timeControl.type === 'fischer' ? stage.timeControl.increment : 5,
            player1Color: types.Player.Black,
            aiDifficulty: stage.katagoLevel,
        } as types.GameSettings,
        proposerId: user.id,
        status: 'pending',
        deadline: 0
    };
    
    const game = await initializeGame(negotiation);
    game.isSinglePlayer = true;
    game.isTowerChallenge = true;
    game.floor = floor;
    game.stageId = stage.id;
    
    const allPoints: types.Point[] = Array.from({ length: stage.boardSize * stage.boardSize }, (_, i) => ({ x: i % stage.boardSize, y: Math.floor(i / stage.boardSize) })).sort(() => 0.5 - Math.random());
    const placeStones = (count: number, player: types.Player) => {
        for (let i = 0; i < count; i++) {
            if (allPoints.length === 0) break;
            const p = allPoints.pop()!;
            game.boardState[p.y][p.x] = player;
        }
    };
    placeStones(stage.placements.black, types.Player.Black);
    placeStones(stage.placements.white, types.Player.White);

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