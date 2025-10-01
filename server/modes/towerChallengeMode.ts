import {
    type VolatileState, type User, type HandleActionResult, type LiveGameSession,
    GameStatus, Player, type Guild, GameMode, type Negotiation, UserStatus,
    type GameSettings,
    ChatMessage
} from '../../types/index.js';
import * as db from '../db.js';
import { initializeGame } from '../gameModes.js';
import { getAiUser } from '../ai/index.js';
import { TOWER_STAGES } from '../../constants/index.js';
import { transitionToPlaying } from './shared.js';
import * as effectService from '../services/effectService.js';
import * as currencyService from '../currencyService.js';
import { getGoLogic } from '../goLogic.js';
import { Point } from '../../types/index.js';
import { gnuGoServiceManager } from '../services/gnuGoService.js';

const placeStonesRandomly = (boardState: Player[][], boardSize: number, count: number, player: Player, avoidCenter = false) => {
    let placed = 0;
    let attempts = 0;
    const maxAttempts = boardSize * boardSize * 3; // Increased attempts for harder placements

    // A temporary game-like object for getGoLogic
    const tempGameForLogic = { boardState, settings: { boardSize } } as LiveGameSession;
    const logic = getGoLogic(tempGameForLogic);

    while (placed < count && attempts < maxAttempts) {
        attempts++;
        const x = Math.floor(Math.random() * boardSize);
        const y = Math.floor(Math.random() * boardSize);
        if (avoidCenter && x === Math.floor(boardSize / 2) && y === Math.floor(boardSize / 2)) {
            continue;
        }
        if (boardState[y][x] === Player.None) {
            // Temporarily place the stone to check for liberties
            boardState[y][x] = player;
            const group = logic.findGroup(x, y, player, boardState);
            
            // Check if the placed stone has liberties.
            if (group && group.liberties > 0) {
                // It's a valid placement, keep it.
                placed++;
            } else {
                // Invalid placement (no liberties), revert it.
                boardState[y][x] = Player.None;
            }
        }
    }

    if (placed < count) {
        console.warn(`[Tower Placement] Could only place ${placed}/${count} stones with liberties via random sampling. Trying exhaustive search.`);
        // Fallback for very dense boards: iterate through all empty spots
        const emptyPoints: Point[] = [];
        for (let y = 0; y < boardSize; y++) {
            for (let x = 0; x < boardSize; x++) {
                if (boardState[y][x] === Player.None) {
                    emptyPoints.push({ x, y });
                }
            }
        }
        emptyPoints.sort(() => Math.random() - 0.5); // Shuffle empty points

        for (const point of emptyPoints) {
            if (placed >= count) break;
            if (avoidCenter && point.x === Math.floor(boardSize / 2) && point.y === Math.floor(boardSize / 2)) {
                continue;
            }
            
            boardState[point.y][point.x] = player;
            const group = logic.findGroup(point.x, point.y, player, boardState);
            if (group && group.liberties > 0) {
                placed++;
            } else {
                boardState[point.y][point.x] = Player.None; // revert
            }
        }
    }
};

export const handleTowerChallengeGameStart = async (
    volatileState: VolatileState,
    payload: { floor: number },
    user: User,
    guilds: Record<string, Guild>
): Promise<HandleActionResult> => {
    const { floor } = payload;
    const stage = TOWER_STAGES.find(s => s.floor === floor);

    if (!stage) {
        return { error: 'Invalid tower floor.' };
    }
    if ((user.towerProgress?.highestFloor || 0) + 1 < floor) {
        return { error: 'Previous floors must be cleared first.' };
    }
    if (user.actionPoints.current < stage.actionPointCost && !user.isAdmin) {
        return { error: `Action points are not enough. (Required: ${stage.actionPointCost})` };
    }

    if (!user.isAdmin) {
        const userGuild = user.guildId ? (guilds[user.guildId] ?? null) : null;
        const effects = effectService.calculateUserEffects(user, userGuild);
        const maxAP = effects.maxActionPoints;
        const wasAtMax = user.actionPoints.current >= maxAP;
        
        user.actionPoints.current -= stage.actionPointCost;
        if(wasAtMax){
            user.lastActionPointUpdate = Date.now();
        }
    }
    
    await db.updateUser(user);
    
    const aiUser = getAiUser(GameMode.Standard, stage.katagoLevel, undefined, stage.floor);
    const negotiation: Negotiation = {
        id: `neg-tc-${globalThis.crypto.randomUUID()}`,
        challenger: user, opponent: aiUser, mode: stage.mode!,
        settings: {
            boardSize: stage.boardSize, komi: 6.5, timeLimit: stage.timeControl.mainTime,
            byoyomiTime: stage.timeControl.byoyomiTime ?? 30, byoyomiCount: stage.timeControl.byoyomiCount || 3,
            player1Color: Player.Black, aiDifficulty: stage.katagoLevel,
            missileCount: stage.missileCount, hiddenStoneCount: stage.hiddenStoneCount, scanCount: stage.scanCount,
            mixedModes: stage.mixedModes,
            timeControl: stage.timeControl,
        } as GameSettings,
        proposerId: user.id, status: 'accepted', deadline: Date.now()
    };
    
    const game = await initializeGame(negotiation, guilds);

    // Override with single player specific properties
    game.stageId = stage.id;
    game.floor = stage.floor;
    game.gameType = stage.gameType;

    const boardState = Array(stage.boardSize).fill(null).map(() => Array(stage.boardSize).fill(Player.None));
    game.boardState = boardState;
    
    placeStonesRandomly(boardState, stage.boardSize, stage.placements.black, Player.Black, true);
    placeStonesRandomly(boardState, stage.boardSize, stage.placements.white, Player.White, false);
    
    game.blackStoneLimit = stage.blackStoneLimit;
    game.whiteStoneLimit = stage.whiteStoneLimit;
    game.autoEndTurnCount = stage.autoEndTurnCount;
    
    if (stage.targetScore) {
        game.effectiveCaptureTargets = { [Player.Black]: stage.targetScore.black, [Player.White]: stage.targetScore.white, [Player.None]: 0 };
    }
    
    game.gameStatus = GameStatus.SinglePlayerIntro;

    // Add GnuGo instance creation for low-level AI
    gnuGoServiceManager.create(game.id, game.player2.playfulLevel, game.settings.boardSize, game.settings.komi);

    await db.saveGame(game);
    volatileState.userStatuses[user.id] = { status: UserStatus.InGame, mode: game.mode, gameId: game.id };

    return {};
};

export const handleTowerChallengeRefresh = async (game: LiveGameSession, user: User): Promise<HandleActionResult> => {
     if (!game.isTowerChallenge || game.moveHistory.length > 0) {
        return { error: 'Cannot refresh placement after the game has started.' };
    }
    const refreshesUsed = game.towerChallengePlacementRefreshesUsed || 0;
    if (refreshesUsed >= 5) {
        return { error: 'Refresh limit reached.' };
    }
    const costs = [0, 50, 100, 200, 300];
    const cost = costs[refreshesUsed];
    if (user.gold < cost) {
        return { error: `Not enough gold. (Required: ${cost})` };
    }
    currencyService.spendGold(user, cost, `도전의 탑 ${game.floor}층 새로고침`);
    game.towerChallengePlacementRefreshesUsed = refreshesUsed + 1;

    const stage = TOWER_STAGES.find(s => s.id === game.stageId);
    if (!stage) return { error: 'Stage info not found.' };

    const boardState = Array(stage.boardSize).fill(null).map(() => Array(stage.boardSize).fill(Player.None));
    game.boardState = boardState;
    
    placeStonesRandomly(boardState, stage.boardSize, stage.placements.black, Player.Black, true);
    placeStonesRandomly(boardState, stage.boardSize, stage.placements.white, Player.White, false);

    await db.updateUser(user);
    await db.saveGame(game);
    return { clientResponse: { updatedUser: user } };
};

export const handleTowerAddStones = async (game: LiveGameSession, user: User): Promise<HandleActionResult> => {
    if (!game.isTowerChallenge) return { error: 'Not a tower challenge game.' };

    const floor = game.floor || 0;

    if (floor <= 20) {
        // Gold-based purchase for lower floors
        const uses = game.towerAddStonesUsed || 0;
        if (uses >= 3) {
            return { error: '흑돌 추가는 3번까지만 가능합니다.' };
        }
        const costs = [300, 500, 1000];
        const cost = costs[uses];

        if (user.gold < cost) {
            return { error: `골드가 부족합니다. (필요: ${cost})` };
        }

        currencyService.spendGold(user, cost, `도전의 탑 ${floor}층 흑돌 추가 (${uses + 1}회차)`);
        game.towerAddStonesUsed = uses + 1;
        game.blackStoneLimit = (game.blackStoneLimit || 0) + 3;

        // Add system message
        const message: ChatMessage = {
            id: `msg-system-${globalThis.crypto.randomUUID()}`,
            user: { id: 'system', nickname: '시스템' },
            system: true,
            text: `[시스템] ${user.nickname}님이 골드를 사용하여 흑돌 제한을 3개 늘렸습니다. (남은 횟수: ${2 - uses}회)`,
            timestamp: Date.now(),
        };
        if (!game.pendingSystemMessages) game.pendingSystemMessages = [];
        game.pendingSystemMessages.push(message);

        await db.updateUser(user);
        await db.saveGame(game);
        return { clientResponse: { updatedUser: user } };

    } else {
        // Diamond-based purchase for higher floors (prompted when out of stones)
        if (game.gameType !== 'survival' && game.gameType !== 'capture') {
           return { error: 'This item is not usable in this mode.' };
        }
        const uses = game.towerAddStonesUsed || 0;
        if (uses >= 1 && !game.promptForMoreStones) {
            return { error: 'You can only use this once per game.' };
        }

        const addStonesCost = 100;
        if (user.diamonds < addStonesCost) return { error: `Not enough diamonds. (Required: ${addStonesCost})` };
        
        currencyService.spendDiamonds(user, addStonesCost, `도전의 탑 ${game.floor}층 돌 추가`);
        game.towerAddStonesUsed = (game.towerAddStonesUsed || 0) + 1;
        game.blackStoneLimit = (game.blackStoneLimit || 0) + 3;

        if (game.promptForMoreStones) {
            game.promptForMoreStones = false;
            game.gameStatus = GameStatus.Playing;
            if (game.pausedTurnTimeLeft) {
                const now = Date.now();
                game.turnDeadline = now + game.pausedTurnTimeLeft * 1000;
                game.turnStartTime = now;
                game.pausedTurnTimeLeft = undefined;
            }
        }

        const message: ChatMessage = {
            id: `msg-system-${globalThis.crypto.randomUUID()}`,
            user: { id: 'system', nickname: '시스템' },
            system: true,
            text: `[시스템] ${user.nickname}님이 다이아를 사용하여 흑돌 제한을 3개 늘렸습니다.`,
            timestamp: Date.now(),
        };
        if (!game.pendingSystemMessages) game.pendingSystemMessages = [];
        game.pendingSystemMessages.push(message);

        await db.updateUser(user);
        await db.saveGame(game);
        return { clientResponse: { updatedUser: user } };
    }
};
