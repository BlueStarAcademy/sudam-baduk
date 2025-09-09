import { randomUUID } from 'crypto';
import * as db from '../db.js';
import * as types from '../../types/index.js';
import { SINGLE_PLAYER_STAGES, SINGLE_PLAYER_MISSIONS, CONSUMABLE_ITEMS } from '../../constants.js';
import { initializeGame } from '../gameModes.js';
import { getAiUser } from '../aiPlayer.js';
import * as effectService from '../effectService.js';


type HandleActionResult = types.HandleActionResult;

export const handleSinglePlayerAction = async (volatileState: types.VolatileState, action: types.ServerAction & { userId: string }, user: types.User): Promise<HandleActionResult> => {
    const { type, payload } = action;
    const now = Date.now();

    switch (type) {
        case 'START_SINGLE_PLAYER_GAME': {
            const { stageId } = payload;
            const stage = SINGLE_PLAYER_STAGES.find(s => s.id === stageId);
            if (!stage) {
                return { error: '유효하지 않은 스테이지입니다.' };
            }

            const stageIndex = SINGLE_PLAYER_STAGES.findIndex(s => s.id === stageId);
            if ((user.singlePlayerProgress ?? 0) < stageIndex) {
                return { error: '아직 잠금 해제되지 않은 스테이지입니다.' };
            }
            
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

            const aiOpponent = getAiUser(types.GameMode.Standard); // Or a specific AI for SP
            aiOpponent.strategyLevel = stage.katagoLevel;

            const negotiation: types.Negotiation = {
                id: `neg-sp-${randomUUID()}`,
                challenger: user,
                opponent: aiOpponent,
                mode: types.GameMode.Standard, // All SP games are standard Go
                settings: {
                    boardSize: stage.boardSize,
                    komi: 0.5,
                    timeLimit: stage.timeControl.mainTime,
                    byoyomiTime: stage.timeControl.byoyomiTime ?? 30,
                    byoyomiCount: stage.timeControl.byoyomiCount ?? 3,
                    timeIncrement: stage.timeControl.increment,
                    player1Color: types.Player.Black,
                    aiDifficulty: stage.katagoLevel,
                    // other settings with defaults
                } as types.GameSettings,
                proposerId: user.id,
                status: 'pending',
                deadline: 0
            };
            
            const game = await initializeGame(negotiation);
            game.isSinglePlayer = true;
            game.stageId = stageId;
            
            // Set up pattern stones
            const allPoints: types.Point[] = [];
            for (let y = 0; y < stage.boardSize; y++) {
                for (let x = 0; x < stage.boardSize; x++) {
                    allPoints.push({ x, y });
                }
            }
            allPoints.sort(() => 0.5 - Math.random());

            const placeStones = (count: number, player: types.Player) => {
                for (let i = 0; i < count; i++) {
                    if (allPoints.length === 0) break;
                    const p = allPoints.pop()!;
                    game.boardState[p.y][p.x] = player;
                }
            };
            
            const placePatternStones = (count: number, player: types.Player) => {
                const key = player === types.Player.Black ? 'blackPatternStones' : 'whitePatternStones';
                if (!game[key]) game[key] = [];
                 for (let i = 0; i < count; i++) {
                    if (allPoints.length === 0) break;
                    const p = allPoints.pop()!;
                    game.boardState[p.y][p.x] = player;
                    game[key]!.push(p);
                }
            };

            placeStones(stage.placements.black, types.Player.Black);
            placeStones(stage.placements.white, types.Player.White);
            placePatternStones(stage.placements.blackPattern, types.Player.Black);
            placePatternStones(stage.placements.whitePattern, types.Player.White);

            if (stage.placements.centerBlackStoneChance && Math.random() * 100 < stage.placements.centerBlackStoneChance) {
                 const center = Math.floor(stage.boardSize / 2);
                 if (game.boardState[center][center] === types.Player.None) {
                     game.boardState[center][center] = types.Player.Black;
                 }
            }
            
            // Set capture target
            game.effectiveCaptureTargets = {
                [types.Player.Black]: stage.targetScore.black,
                [types.Player.White]: stage.targetScore.white,
                [types.Player.None]: 0,
            };
            
            game.blackStonesPlaced = 0;
            game.blackStoneLimit = (stage.boardSize * stage.boardSize) - (stage.placements.black + stage.placements.white + stage.placements.blackPattern + stage.placements.whitePattern);


            await db.saveGame(game);
            await db.updateUser(user);

            volatileState.userStatuses[user.id] = { status: 'in-game', mode: game.mode, gameId: game.id };
            return { clientResponse: { updatedUser: user } };
        }
        case 'SINGLE_PLAYER_REFRESH_PLACEMENT': {
            const { gameId } = payload;
            const game = await db.getLiveGame(gameId);
            if (!game || !game.isSinglePlayer || !game.stageId) return { error: 'Invalid single player game.' };
            if (game.moveHistory.length > 0) return { error: 'Game has already started.' };

            const refreshesUsed = game.singlePlayerPlacementRefreshesUsed || 0;
            if (refreshesUsed >= 5) return { error: 'No more refreshes available.' };
            
            const costs = [0, 50, 100, 200, 300];
            const cost = costs[refreshesUsed];

            if (user.gold < cost) return { error: '골드가 부족합니다.' };
            user.gold -= cost;

            game.singlePlayerPlacementRefreshesUsed = refreshesUsed + 1;

            const stage = SINGLE_PLAYER_STAGES.find(s => s.id === game.stageId);
            if (!stage) return { error: 'Stage not found.' };

            game.boardState = Array(stage.boardSize).fill(0).map(() => Array(stage.boardSize).fill(types.Player.None));
            game.blackPatternStones = [];
            game.whitePatternStones = [];

            const allPoints: types.Point[] = [];
            for (let y = 0; y < stage.boardSize; y++) for (let x = 0; x < stage.boardSize; x++) allPoints.push({ x, y });
            allPoints.sort(() => 0.5 - Math.random());

            const placeStones = (count: number, player: types.Player) => {
                for (let i = 0; i < count; i++) {
                    if (allPoints.length === 0) break;
                    const p = allPoints.pop()!;
                    game.boardState[p.y][p.x] = player;
                }
            };
            
            const placePatternStones = (count: number, player: types.Player) => {
                const key = player === types.Player.Black ? 'blackPatternStones' : 'whitePatternStones';
                game[key] = [];
                 for (let i = 0; i < count; i++) {
                    if (allPoints.length === 0) break;
                    const p = allPoints.pop()!;
                    game.boardState[p.y][p.x] = player;
                    game[key]!.push(p);
                }
            };

            placeStones(stage.placements.black, types.Player.Black);
            placeStones(stage.placements.white, types.Player.White);
            placePatternStones(stage.placements.blackPattern, types.Player.Black);
            placePatternStones(stage.placements.whitePattern, types.Player.White);
            
            if (stage.placements.centerBlackStoneChance && Math.random() * 100 < stage.placements.centerBlackStoneChance) {
                 const center = Math.floor(stage.boardSize / 2);
                 if (game.boardState[center][center] === types.Player.None) {
                     game.boardState[center][center] = types.Player.Black;
                 }
            }

            await db.saveGame(game);
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }
        case 'START_SINGLE_PLAYER_MISSION': {
            const { missionId } = payload;
            const missionInfo = SINGLE_PLAYER_MISSIONS.find(m => m.id === missionId);
            if (!missionInfo) return { error: 'Invalid mission.' };

            if (!user.singlePlayerMissions) user.singlePlayerMissions = {};
            if (user.singlePlayerMissions[missionId]?.isStarted) return { error: 'Mission already started.' };

            user.singlePlayerMissions[missionId] = {
                id: missionId,
                isStarted: true,
                lastCollectionTime: now,
                accumulatedAmount: 0,
            };
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }
        case 'CLAIM_SINGLE_PLAYER_MISSION_REWARD': {
            const { missionId } = payload;
            if (!user.singlePlayerMissions?.[missionId]?.isStarted) return { error: 'Mission not started or does not exist.' };
            
            const missionState = user.singlePlayerMissions[missionId];
            const missionInfo = SINGLE_PLAYER_MISSIONS.find(m => m.id === missionId)!;
            
            // Re-calculate accumulated amount right before claiming to get the latest value
            if (missionState.accumulatedAmount < missionInfo.maxCapacity) {
                const elapsedMs = now - missionState.lastCollectionTime;
                const productionIntervalMs = missionInfo.productionRateMinutes * 60 * 1000;
                if (productionIntervalMs > 0) {
                    const cycles = Math.floor(elapsedMs / productionIntervalMs);
                    if (cycles > 0) {
                        const generatedAmount = cycles * missionInfo.rewardAmount;
                        missionState.accumulatedAmount = Math.min(missionInfo.maxCapacity, missionState.accumulatedAmount + generatedAmount);
                        missionState.lastCollectionTime += cycles * productionIntervalMs;
                    }
                }
            }

            const amountToClaim = Math.floor(missionState.accumulatedAmount);

            if (amountToClaim < 1) return { error: '수령할 보상이 없습니다.' };
            
            const claimedReward: types.QuestReward = {};

            if (missionInfo.rewardType === 'gold') {
                user.gold += amountToClaim;
                claimedReward.gold = amountToClaim;
            } else if (missionInfo.rewardType === 'diamonds') {
                user.diamonds += amountToClaim;
                claimedReward.diamonds = amountToClaim;
            }
            
            missionState.accumulatedAmount -= amountToClaim;
            
            // Reset the timer correctly by accounting for any partial progress towards the next reward
            const productionIntervalMs = missionInfo.productionRateMinutes * 60 * 1000;
            if (productionIntervalMs > 0) {
                const elapsedSinceLastTick = now - missionState.lastCollectionTime;
                const remainderMs = elapsedSinceLastTick % productionIntervalMs;
                missionState.lastCollectionTime = now - remainderMs;
            } else {
                missionState.lastCollectionTime = now;
            }
            
            await db.updateUser(user);
            return {
                clientResponse: {
                    updatedUser: user,
                    rewardSummary: {
                        reward: claimedReward,
                        items: [],
                        title: `${missionInfo.name} 과제 보상`
                    }
                }
            };
        }
        default:
            return { error: 'Unknown single player action.' };
    }
};