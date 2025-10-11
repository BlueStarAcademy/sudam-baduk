

import { VolatileState, ServerAction, User, HandleActionResult, GameMode, Guild, LiveGameSession, GameStatus, Player, SinglePlayerLevel, UserStatus, Negotiation, SinglePlayerStageInfo, UserStatusInfo } from '../../types/index.js';
import * as db from '../db.js';
import { initializeGame } from '../gameModes.js';
import { SINGLE_PLAYER_STAGES, TOWER_STAGES } from '../../constants/index.js';
import * as currencyService from '../currencyService.js';
import { getAiUser } from '../ai/index.js';
import { gnuGoServiceManager } from '../services/gnuGoService.js';

const placeInitialStonesRandomly = (game: LiveGameSession, stage: SinglePlayerStageInfo) => {
    game.boardState = Array(stage.boardSize).fill(0).map(() => Array(stage.boardSize).fill(Player.None));
    game.blackPatternStones = [];
    game.whitePatternStones = [];

    const { black: blackCount, white: whiteCount, blackPattern: blackPatternCount, whitePattern: whitePatternCount, centerBlackStoneChance } = stage.placements;
    
    const placeRandomStones = (player: Player, count: number, isPattern: boolean) => {
        const patternStonesKey = player === Player.Black ? 'blackPatternStones' : 'whitePatternStones';
        let placed = 0;
        let attempts = 0;
        while (placed < count && attempts < 500) {
            const x = Math.floor(Math.random() * stage.boardSize);
            const y = Math.floor(Math.random() * stage.boardSize);
            if (game.boardState[y][x] === Player.None) {
                game.boardState[y][x] = player;
                if (isPattern) {
                    (game as any)[patternStonesKey].push({x,y});
                }
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
};


export const handleAiGameStart = async (
    volatileState: VolatileState, 
    payload: any, 
    user: User, 
    guilds: Record<string, Guild>, 
    type: 'single-player' | 'tower-challenge'
): Promise<HandleActionResult> => {
    const isTower = type === 'tower-challenge';
    const stageSource = isTower ? TOWER_STAGES : SINGLE_PLAYER_STAGES;
    const stageId = isTower ? `tower-${payload.floor}` : payload.stageId;
    
    const stage = stageSource.find(s => s.id === stageId);
    if (!stage) return { error: '스테이지 정보를 찾을 수 없습니다.' };

    if (isTower) {
        const progress = user.towerProgress?.highestFloor ?? 0;
        if (progress < stage.floor! - 1 && !user.isAdmin) {
            return { error: '아직 도전할 수 없는 층입니다.' };
        }
    } else {
        const stageIndex = SINGLE_PLAYER_STAGES.findIndex(s => s.id === stageId);
        const progress = user.singlePlayerProgress ?? 0;
        if (progress < stageIndex && !user.isAdmin) {
            return { error: '아직 도전할 수 없는 스테이지입니다.' };
        }
    }
    
    if (user.actionPoints.current < stage.actionPointCost && !user.isAdmin) {
        return { error: `행동력이 부족합니다. (필요: ${stage.actionPointCost})` };
    }
    
    if (!user.isAdmin) {
        user.actionPoints.current -= stage.actionPointCost;
    }

    const negotiation: Negotiation = {
        id: isTower ? `neg-tc-${globalThis.crypto.randomUUID()}` : `neg-sp-${globalThis.crypto.randomUUID()}`,
        challenger: user,
        opponent: getAiUser(GameMode.Standard, stage.katagoLevel, stageId, isTower ? stage.floor : undefined),
        mode: stage.mode || GameMode.Standard,
        settings: {
            boardSize: stage.boardSize,
            timeLimit: 0,
            byoyomiCount: 3,
            byoyomiTime: 30,
            komi: 6.5,
            player1Color: Player.Black,
            aiDifficulty: stage.katagoLevel,
            timeControl: stage.timeControl,
            autoEndTurnCount: stage.autoEndTurnCount,
            missileCount: stage.missileCount,
            hiddenStoneCount: stage.hiddenStoneCount,
            scanCount: stage.scanCount,
            mixedModes: stage.mixedModes
        },
        proposerId: user.id, status: 'pending', deadline: 0, turnCount: 0
    };

    const game = await initializeGame(negotiation, guilds);
    game.isSinglePlayer = !isTower;
    game.isTowerChallenge = isTower;
    
    // If the stage config doesn't specify a turn count (e.g., for capture missions),
    // make sure the default from initializeGame is removed.
    if (!stage.autoEndTurnCount && stage.gameType === 'capture') {
        game.autoEndTurnCount = undefined;
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

    if (isTower) {
        game.towerChallengePlacementRefreshesUsed = 0;
        game.towerAddStonesUsed = 0;
    } else {
        game.singlePlayerPlacementRefreshesUsed = 0;
    }
    
    placeInitialStonesRandomly(game, stage);

    const gnuGoInstance = gnuGoServiceManager.create(game.id, stage.katagoLevel, game.settings.boardSize, game.settings.komi);
    if (gnuGoInstance) {
        await gnuGoInstance.resync([], game.boardState);
    }

    game.currentPlayer = Player.Black;

    await db.saveGame(game);
    const userStatuses = await db.getKV<Record<string, UserStatusInfo>>('userStatuses') || {};
    userStatuses[game.player1.id] = { status: UserStatus.InGame, mode: game.mode, gameId: game.id, stateEnteredAt: Date.now() };
    await db.setKV('userStatuses', userStatuses);
    
    await db.updateUser(user);

    return {};
};

export const handleAiGameRefresh = async (game: LiveGameSession, user: User, type: 'single-player' | 'tower-challenge'): Promise<HandleActionResult> => {
    if (game.moveHistory.length > 0) {
        return { error: '이미 시작된 대국에서는 새로고침할 수 없습니다.' };
    }
    const isTower = type === 'tower-challenge';
    const refreshesUsedKey = isTower ? 'towerChallengePlacementRefreshesUsed' : 'singlePlayerPlacementRefreshesUsed';
    const refreshesUsed = (game as any)[refreshesUsedKey] || 0;

    if (refreshesUsed >= 5) {
        return { error: '새로고침 횟수를 모두 사용했습니다.' };
    }
    
    const costs = [0, 50, 100, 200, 300];
    const cost = costs[refreshesUsed];

    if (user.gold < cost && !user.isAdmin) {
        return { error: `골드가 부족합니다. (필요: ${cost})` };
    }
    
    if(!user.isAdmin) {
        currencyService.spendGold(user, cost, `${isTower ? '도전의탑' : '싱글플레이어'} 새로고침 (${refreshesUsed + 1}회)`);
    }
    (game as any)[refreshesUsedKey] = refreshesUsed + 1;
    
    const stageSource = isTower ? TOWER_STAGES : SINGLE_PLAYER_STAGES;
    const stage = stageSource.find(s => s.id === game.stageId);
    if (!stage) return { error: '스테이지 정보를 찾을 수 없습니다.' };

    game.moveHistory = [];
    placeInitialStonesRandomly(game, stage);
    
    await gnuGoServiceManager.get(game.id)?.resync([], game.boardState);

    game.currentPlayer = Player.Black;

    await db.updateUser(user);
    // Game is already saved by the caller (handleAction)
    return { clientResponse: { updatedUser: user } };
};

export const handleTowerAddStones = async (game: LiveGameSession, user: User): Promise<HandleActionResult> => {
    if (!game.isTowerChallenge || game.gameStatus !== GameStatus.Playing) {
        return { error: '지금은 흑돌을 추가할 수 없습니다.' };
    }
    
    const uses = game.towerAddStonesUsed || 0;
    if (uses >= 3) return { error: '흑돌 추가 횟수를 모두 사용했습니다.' };

    const costs = [300, 500, 1000];
    const cost = costs[uses];
    if (user.gold < cost && !user.isAdmin) return { error: `골드가 부족합니다. (필요: ${cost})` };
    
    if (!user.isAdmin) {
        currencyService.spendGold(user, cost, `도전의탑 흑돌 추가 (${uses + 1}회)`);
    }
    
    game.towerAddStonesUsed = uses + 1;
    game.blackStoneLimit = (game.blackStoneLimit || 0) + 3;
    game.promptForMoreStones = false;
    
    if (game.pausedTurnTimeLeft) {
        const now = Date.now();
        game.turnDeadline = now + game.pausedTurnTimeLeft * 1000;
        game.turnStartTime = now;
        game.pausedTurnTimeLeft = undefined;
    }

    await db.updateUser(user);
    return { clientResponse: { updatedUser: user } };
};

export const handleConfirmIntro = async (gameId: string, user: User): Promise<HandleActionResult> => {
    const game = await db.getLiveGame(gameId);
    if (!game || !(game.isSinglePlayer || game.isTowerChallenge) || game.player1.id !== user.id) {
        return { error: "Invalid game." };
    }

    if (game.gameStatus === GameStatus.SinglePlayerIntro) {
        game.gameStatus = GameStatus.Playing;
        
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