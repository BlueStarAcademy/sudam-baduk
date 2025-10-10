
import { VolatileState, ServerAction, User, HandleActionResult, GameMode, Guild, LiveGameSession, GameStatus, Player, SinglePlayerLevel, UserStatus, Negotiation } from '../../types/index.js';
import * as db from '../db.js';
import { initializeGame } from '../gameModes.js';
import { SINGLE_PLAYER_STAGES } from '../../constants/index.js';
import * as currencyService from '../currencyService.js';
import { getAiUser } from '../ai/index.js';
// FIX: Add missing import for gnuGoServiceManager to resolve reference errors.
import { gnuGoServiceManager } from '../services/gnuGoService.js';

export const handleSinglePlayerGameStart = async (volatileState: VolatileState, payload: any, user: User, guilds: Record<string, Guild>): Promise<HandleActionResult> => {
    const { stageId } = payload;
    const stage = SINGLE_PLAYER_STAGES.find(s => s.id === stageId);
    if (!stage) return { error: '스테이지 정보를 찾을 수 없습니다.' };

    const stageIndex = SINGLE_PLAYER_STAGES.findIndex(s => s.id === stageId);
    const progress = user.singlePlayerProgress ?? 0;

    if (progress < stageIndex && !user.isAdmin) {
        return { error: '아직 도전할 수 없는 스테이지입니다.' };
    }

    if (user.actionPoints.current < stage.actionPointCost && !user.isAdmin) {
        return { error: `행동력이 부족합니다. (필요: ${stage.actionPointCost})` };
    }
    
    if (!user.isAdmin) {
        user.actionPoints.current -= stage.actionPointCost;
    }

    const negotiation: Negotiation = {
        id: `neg-sp-${globalThis.crypto.randomUUID()}`,
        challenger: user,
        opponent: getAiUser(GameMode.Standard, stage.katagoLevel * 10, stageId),
        mode: stage.mode || GameMode.Standard,
        settings: {
            boardSize: stage.boardSize,
            timeLimit: 0, // SP games are untimed by default
            byoyomiCount: 3,
            byoyomiTime: 30,
            komi: 6.5,
            player1Color: Player.Black,
            aiDifficulty: stage.katagoLevel * 10,
            timeControl: stage.timeControl,
            autoEndTurnCount: stage.autoEndTurnCount,
            missileCount: stage.missileCount,
            hiddenStoneCount: stage.hiddenStoneCount,
            scanCount: stage.scanCount,
            mixedModes: stage.mixedModes
        },
        proposerId: user.id,
        status: 'pending',
        deadline: 0,
        turnCount: 0,
    };

    const game = await initializeGame(negotiation, guilds);
    game.isSinglePlayer = true;

    // User request: remove turn limit for intro and dan capture/survival stages if not explicitly defined
    if (!stage.autoEndTurnCount) {
        const stageNum = parseInt(stage.id.split('-')[1], 10);
        if (stage.level === SinglePlayerLevel.입문 || (stage.level === SinglePlayerLevel.유단자 && stageNum <= 5)) {
            if (stage.gameType === 'capture' || stage.gameType === 'survival') {
                game.autoEndTurnCount = undefined;
            }
        }
    }

    game.stageId = stage.id;
    game.gameType = stage.gameType;
    game.gameStatus = GameStatus.SinglePlayerIntro;
    
    game.blackStoneLimit = stage.blackStoneLimit;
    game.whiteStoneLimit = stage.whiteStoneLimit;
    const targetScore = stage.targetScore;
    game.effectiveCaptureTargets = targetScore ? { [Player.Black]: targetScore.black, [Player.White]: targetScore.white, [Player.None]: 0 } : undefined;
    game.blackStonesPlaced = 0;
    game.whiteStonesPlaced = 0;
    game.singlePlayerPlacementRefreshesUsed = 0;

    const { black: blackCount, white: whiteCount, blackPattern: blackPatternCount, whitePattern: whitePatternCount, centerBlackStoneChance } = stage.placements;
    
    const placeRandomStones = (player: Player, count: number, isPattern: boolean) => {
        const patternStonesKey = player === Player.Black ? 'blackPatternStones' : 'whitePatternStones';
        if (isPattern && !game[patternStonesKey]) (game as any)[patternStonesKey] = [];

        let placed = 0;
        let attempts = 0;
        while (placed < count && attempts < 200) {
            const x = Math.floor(Math.random() * stage.boardSize);
            const y = Math.floor(Math.random() * stage.boardSize);
            if (game.boardState[y][x] === Player.None) {
                game.boardState[y][x] = player;
                if (isPattern) (game as any)[patternStonesKey].push({x,y});
                placed++;
            }
            attempts++;
        }
    };
    
    placeRandomStones(Player.Black, blackCount, false);
    placeRandomStones(Player.White, whiteCount, false);
    placeRandomStones(Player.Black, blackPatternCount, true);
    placeRandomStones(Player.White, whitePatternCount, true);

    if (centerBlackStoneChance && Math.random() * 100 < centerBlackStoneChance) {
        const center = Math.floor(stage.boardSize / 2);
        if (game.boardState[center][center] === Player.None) {
            game.boardState[center][center] = Player.Black;
        }
    }

    // FIX: Corrected an invalid call to 'gnuGoServiceManager.create' that was passing too many arguments.
    // The initial board state is now correctly synced using a subsequent 'resync' call.
    const gnuGoInstance = gnuGoServiceManager.create(game.id, stage.katagoLevel, game.settings.boardSize, game.settings.komi);
    if (gnuGoInstance) {
        await gnuGoInstance.resync([], game.boardState);
    }

    await db.saveGame(game);
    volatileState.userStatuses[game.player1.id] = { status: UserStatus.InGame, mode: game.mode, gameId: game.id, stateEnteredAt: Date.now() };
    await db.updateUser(user);

    return {};
};

export const handleSinglePlayerRefresh = async (game: LiveGameSession, user: User): Promise<HandleActionResult> => {
    if (!game.isSinglePlayer || game.moveHistory.length > 0) {
        return { error: '이미 시작된 대국에서는 새로고침할 수 없습니다.' };
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
    
    currencyService.spendGold(user, cost, `싱글플레이어 새로고침 (${refreshesUsed + 1}회)`);
    game.singlePlayerPlacementRefreshesUsed = refreshesUsed + 1;

    // Reset board and placements
    const stage = SINGLE_PLAYER_STAGES.find(s => s.id === game.stageId);
    if (!stage) return { error: '스테이지 정보를 찾을 수 없습니다.' };

    game.boardState = Array(stage.boardSize).fill(0).map(() => Array(stage.boardSize).fill(Player.None));
    game.blackPatternStones = [];
    game.whitePatternStones = [];
    
    const { black: blackCount, white: whiteCount, blackPattern: blackPatternCount, whitePattern: whitePatternCount, centerBlackStoneChance } = stage.placements;
    const placeRandomStones = (player: Player, count: number, isPattern: boolean) => {
        const patternStonesKey = player === Player.Black ? 'blackPatternStones' : 'whitePatternStones';
        if (isPattern && !game[patternStonesKey]) (game as any)[patternStonesKey] = [];

        let placed = 0;
        let attempts = 0;
        while (placed < count && attempts < 200) {
            const x = Math.floor(Math.random() * stage.boardSize);
            const y = Math.floor(Math.random() * stage.boardSize);
            if (game.boardState[y][x] === Player.None) {
                game.boardState[y][x] = player;
                if (isPattern) (game as any)[patternStonesKey].push({x,y});
                placed++;
            }
            attempts++;
        }
    };
    
    placeRandomStones(Player.Black, blackCount, false);
    placeRandomStones(Player.White, whiteCount, false);
    placeRandomStones(Player.Black, blackPatternCount, true);
    placeRandomStones(Player.White, whitePatternCount, true);

    if (centerBlackStoneChance && Math.random() * 100 < centerBlackStoneChance) {
        const center = Math.floor(stage.boardSize / 2);
        if (game.boardState[center][center] === Player.None) {
            game.boardState[center][center] = Player.Black;
        }
    }
    
    // FIX: Expected 1 arguments, but got 2.
    // The `resync` method now correctly handles a board state argument, resolving the error.
    await gnuGoServiceManager.get(game.id)?.resync([], game.boardState);

    await db.updateUser(user);
    // Game is already saved by the caller (handleAction)
    return { clientResponse: { updatedUser: user } };
};

export const handleConfirmSPIntro = async (gameId: string, user: User): Promise<HandleActionResult> => {
    const game = await db.getLiveGame(gameId);
    if (!game || !(game.isSinglePlayer || game.isTowerChallenge) || game.player1.id !== user.id) {
        return { error: "Invalid game." };
    }

    if (game.gameStatus === GameStatus.SinglePlayerIntro) {
        game.gameStatus = GameStatus.Playing;
        game.currentPlayer = Player.Black;
        
        const now = Date.now();
        game.turnStartTime = now;
        
        const tc = game.settings.timeControl;
        
        if (tc) {
            const mainTimeSeconds = (tc.mainTime || 0) * 60;
            
            game.blackTimeLeft = mainTimeSeconds;
            game.whiteTimeLeft = mainTimeSeconds;

            if (tc.type === 'byoyomi') {
                game.blackByoyomiPeriodsLeft = tc.byoyomiCount || 3;
                game.whiteByoyomiPeriodsLeft = tc.byoyomiCount || 3;

                if (mainTimeSeconds > 0) {
                    game.turnDeadline = now + mainTimeSeconds * 1000;
                } else {
                    game.turnDeadline = now + (tc.byoyomiTime || 30) * 1000;
                }
            } else if (tc.type === 'fischer') {
                game.turnDeadline = now + mainTimeSeconds * 1000;
            }
        }
        
        await db.saveGame(game);
    }
    return {};
};
