import {
    type VolatileState, type User, type HandleActionResult, type LiveGameSession,
    GameStatus, Player, type Guild, GameMode, type Negotiation, UserStatus, type Point
} from '../../types/index.js';
import * as db from '../db.js';
import { initializeGame } from '../gameModes.js';
import { getAiUser } from '../ai/index.js';
import { SINGLE_PLAYER_STAGES, SINGLE_PLAYER_MISSIONS } from '../../constants/index.js';
import { transitionToPlaying } from './shared.js';
// FIX: Import `calculateUserEffects` from the correct utility file.
import { calculateUserEffects } from '../../utils/statUtils.js';
import { getGoLogic } from '../goLogic.js';
import * as currencyService from '../currencyService.js';
import { gnuGoServiceManager } from '../services/gnuGoService.js';

export const handleSinglePlayerGameStart = async (
    volatileState: VolatileState,
    payload: { stageId: string },
    user: User,
    guilds: Record<string, Guild>
): Promise<HandleActionResult> => {
    const { stageId } = payload;
    const stage = SINGLE_PLAYER_STAGES.find(s => s.id === stageId);
    if (!stage) {
        return { error: '유효하지 않은 스테이지입니다.' };
    }

    if (user.actionPoints.current < stage.actionPointCost && !user.isAdmin) {
        return { error: `액션 포인트가 부족합니다. (필요: ${stage.actionPointCost})` };
    }

    if (!user.isAdmin) {
        const userGuild = user.guildId ? (guilds[user.guildId] ?? null) : null;
        const effects = calculateUserEffects(user, userGuild);
        const maxAP = effects.maxActionPoints;
        const wasAtMax = user.actionPoints.current >= maxAP;
        
        user.actionPoints.current -= stage.actionPointCost;

        if (wasAtMax) {
            user.lastActionPointUpdate = Date.now();
        }
    }
    
    await db.updateUser(user);

    const aiUser = getAiUser(GameMode.Standard, stage.katagoLevel, stage.id);
    
    const isFischer = stage.timeControl.type === 'fischer';
    const negotiation: Negotiation = {
        id: `neg-sp-${globalThis.crypto.randomUUID()}`,
        challenger: user,
        opponent: aiUser,
        mode: stage.missileCount ? GameMode.Missile : (stage.hiddenStoneCount ? GameMode.Hidden : GameMode.Standard),
        settings: {
            boardSize: stage.boardSize,
            komi: 6.5,
            timeLimit: stage.timeControl.mainTime,
            byoyomiTime: isFischer ? 0 : stage.timeControl.byoyomiTime ?? 30,
            byoyomiCount: isFischer ? 0 : (stage.timeControl.byoyomiCount || 3),
            timeIncrement: isFischer ? stage.timeControl.increment : undefined,
            player1Color: Player.Black,
            aiDifficulty: stage.katagoLevel * 10,
            missileCount: stage.missileCount,
            hiddenStoneCount: stage.hiddenStoneCount,
            scanCount: stage.scanCount,
            timeControl: stage.timeControl,
        },
        proposerId: user.id,
        status: 'accepted',
        deadline: Date.now()
    };
    
    const game = await initializeGame(negotiation, guilds);

    // Override with single player specific properties
    game.stageId = stageId;
    game.gameType = stage.gameType;

    const boardState = Array(stage.boardSize).fill(null).map(() => Array(stage.boardSize).fill(Player.None));
    game.boardState = boardState;

    const placeStonesRandomly = (count: number, player: Player, isPattern: boolean, avoidCenter = false) => {
        let placed = 0;
        let attempts = 0;
        const patternStones = [];
        const maxAttempts = stage.boardSize * stage.boardSize * 3; // Increased attempts

        // A temporary game-like object for getGoLogic
        const tempGameForLogic = { boardState, settings: { boardSize: stage.boardSize } } as LiveGameSession;
        const logic = getGoLogic(tempGameForLogic);

        while (placed < count && attempts < maxAttempts) {
            attempts++;
            const x = Math.floor(Math.random() * stage.boardSize);
            const y = Math.floor(Math.random() * stage.boardSize);
            if (avoidCenter && x === Math.floor(stage.boardSize / 2) && y === Math.floor(stage.boardSize / 2)) {
                continue;
            }
            if (boardState[y][x] === Player.None) {
                // Temporarily place the stone to check for liberties
                boardState[y][x] = player;
                const group = logic.findGroup(x, y, player, boardState);
                
                // Check if the placed stone has liberties.
                if (group && group.liberties > 0) {
                    // It's a valid placement, keep it.
                    if (isPattern) {
                        patternStones.push({ x, y });
                    }
                    placed++;
                } else {
                    // Invalid placement (no liberties), revert it.
                    boardState[y][x] = Player.None;
                }
            }
        }
        if (placed < count) {
            console.warn(`[SP Placement] Could only place ${placed}/${count} stones with liberties via random sampling. Trying exhaustive search.`);
            // Fallback for very dense boards: iterate through all empty spots
            const emptyPoints: Point[] = [];
            for (let y = 0; y < stage.boardSize; y++) {
                for (let x = 0; x < stage.boardSize; x++) {
                    if (boardState[y][x] === Player.None) emptyPoints.push({ x, y });
                }
            }
            emptyPoints.sort(() => Math.random() - 0.5); // Shuffle empty points

            for (const point of emptyPoints) {
                if (placed >= count) break;
                if (avoidCenter && point.x === Math.floor(stage.boardSize / 2) && point.y === Math.floor(stage.boardSize / 2)) continue;
                
                boardState[point.y][point.x] = player;
                const group = logic.findGroup(point.x, point.y, player, boardState);
                if (group && group.liberties > 0) {
                    if (isPattern) patternStones.push(point);
                    placed++;
                } else {
                    boardState[point.y][point.x] = Player.None; // revert
                }
            }
        }
        return patternStones;
    };
    
    if (stage.placements.centerBlackStoneChance && Math.random() * 100 < stage.placements.centerBlackStoneChance) {
        const centerX = Math.floor(stage.boardSize / 2);
        const centerY = Math.floor(stage.boardSize / 2);
        if (boardState[centerY][centerX] === Player.None) {
            boardState[centerY][centerX] = Player.Black;
        }
    }

    placeStonesRandomly(stage.placements.black, Player.Black, false, true);
    placeStonesRandomly(stage.placements.white, Player.White, false, false);
    game.blackPatternStones = placeStonesRandomly(stage.placements.blackPattern, Player.Black, true, true);
    game.whitePatternStones = placeStonesRandomly(stage.placements.whitePattern, Player.White, true, false);

    game.blackStoneLimit = stage.blackStoneLimit;
    game.whiteStoneLimit = stage.whiteStoneLimit;
    game.autoEndTurnCount = stage.autoEndTurnCount;
    
    if (stage.targetScore) {
        game.effectiveCaptureTargets = {
            [Player.None]: 0,
            [Player.Black]: stage.targetScore.black,
            [Player.White]: stage.targetScore.white,
        };
    }
    
    // All single player games should start with the intro modal.
    game.gameStatus = GameStatus.SinglePlayerIntro;

    // Add GnuGo instance creation for low-level AI
    gnuGoServiceManager.create(game.id, game.player2.playfulLevel, game.settings.boardSize, game.settings.komi);

    await db.saveGame(game);
    
    volatileState.userStatuses[user.id] = { status: UserStatus.InGame, mode: game.mode, gameId: game.id };

    return {};
};

export const handleSinglePlayerRefresh = async (game: LiveGameSession, user: User): Promise<HandleActionResult> => {
    if (!game.isSinglePlayer || game.moveHistory.length > 0) {
        return { error: '대국이 시작된 후에는 배치를 변경할 수 없습니다.' };
    }

    const refreshesUsed = game.singlePlayerPlacementRefreshesUsed || 0;
    if (refreshesUsed >= 5) {
        return { error: '새로고침 횟수를 모두 사용했습니다.' };
    }

    const costs = [0, 50, 100, 200, 300];
    const cost = costs[refreshesUsed];
    
    if (user.gold < cost) {
        return { error: `골드가 부족합니다. (필요: ${cost})` };
    }

    currencyService.spendGold(user, cost, `싱글플레이 새로고침 (${refreshesUsed + 1}회차)`);
    game.singlePlayerPlacementRefreshesUsed = refreshesUsed + 1;

    // Re-run placement logic
    const stage = SINGLE_PLAYER_STAGES.find(s => s.id === game.stageId);
    if (!stage) return { error: '스테이지 정보를 찾을 수 없습니다.' };
    
    const boardState = Array(stage.boardSize).fill(null).map(() => Array(stage.boardSize).fill(Player.None));
    game.boardState = boardState;

    const placeStonesRandomly = (count: number, player: Player, isPattern: boolean, avoidCenter = false) => {
        let placed = 0;
        let attempts = 0;
        const patternStones = [];
        const maxAttempts = stage.boardSize * stage.boardSize * 3;

        const tempGameForLogic = { boardState, settings: { boardSize: stage.boardSize } } as LiveGameSession;
        const logic = getGoLogic(tempGameForLogic);

        while (placed < count && attempts < maxAttempts) {
            attempts++;
            const x = Math.floor(Math.random() * stage.boardSize);
            const y = Math.floor(Math.random() * stage.boardSize);
            if (avoidCenter && x === Math.floor(stage.boardSize / 2) && y === Math.floor(stage.boardSize / 2)) {
                continue;
            }
            if (boardState[y][x] === Player.None) {
                boardState[y][x] = player;
                const group = logic.findGroup(x, y, player, boardState);
                if (group && group.liberties > 0) {
                    if (isPattern) patternStones.push({ x, y });
                    placed++;
                } else {
                    boardState[y][x] = Player.None;
                }
            }
        }

        if (placed < count) {
            console.warn(`[SP Refresh] Could only place ${placed}/${count} stones with liberties via random sampling. Trying exhaustive search.`);
            const emptyPoints: Point[] = [];
            for (let y = 0; y < stage.boardSize; y++) {
                for (let x = 0; x < stage.boardSize; x++) {
                    if (boardState[y][x] === Player.None) emptyPoints.push({ x, y });
                }
            }
            emptyPoints.sort(() => Math.random() - 0.5);
            for (const point of emptyPoints) {
                if (placed >= count) break;
                if (avoidCenter && point.x === Math.floor(stage.boardSize / 2) && point.y === Math.floor(stage.boardSize / 2)) continue;
                boardState[point.y][point.x] = player;
                const group = logic.findGroup(point.x, point.y, player, boardState);
                if (group && group.liberties > 0) {
                    if (isPattern) patternStones.push(point);
                    placed++;
                } else {
                    boardState[point.y][point.x] = Player.None;
                }
            }
        }
        return patternStones;
    };
    
    if (stage.placements.centerBlackStoneChance && Math.random() * 100 < stage.placements.centerBlackStoneChance) {
        const centerX = Math.floor(stage.boardSize / 2);
        const centerY = Math.floor(stage.boardSize / 2);
        if (boardState[centerY][centerX] === Player.None) {
            boardState[centerY][centerX] = Player.Black;
        }
    }

    placeStonesRandomly(stage.placements.black, Player.Black, false, true);
    placeStonesRandomly(stage.placements.white, Player.White, false, false);
    game.blackPatternStones = placeStonesRandomly(stage.placements.blackPattern, Player.Black, true, true);
    game.whitePatternStones = placeStonesRandomly(stage.placements.whitePattern, Player.White, true, false);

    await db.updateUser(user);
    await db.saveGame(game);
    return { clientResponse: { updatedUser: user } };
};


export const handleConfirmSPIntro = async (gameId: string, user: User): Promise<HandleActionResult> => {
    const game = await db.getLiveGame(gameId);
    if (!game || game.player1.id !== user.id || game.gameStatus !== GameStatus.SinglePlayerIntro) {
        return { error: 'Invalid action.' };
    }
    
    transitionToPlaying(game, Date.now());
    
    await db.saveGame(game);
    return {};
};