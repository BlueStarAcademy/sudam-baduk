

import { type LiveGameSession, type AlkkagiStone, type Point, AlkkagiLayoutType, Player, AlkkagiPlacementType, type Negotiation, MythicStat, type VolatileState, type ServerAction, type User, type HandleActionResult, GameMode, GameStatus, WinReason, RPSChoice, Guild } from '../../types/index.js';
import * as db from '../db.js';
import { handleSharedAction, updateSharedGameState, handleTimeoutFoul as handlePlayfulTimeoutFoul } from './shared.js';
import { aiUserId } from '../ai/index.js';
import { ALKKAGI_PLACEMENT_TIME_LIMIT, ALKKAGI_SIMULTANEOUS_PLACEMENT_TIME_LIMIT, ALKKAGI_TURN_TIME_LIMIT, BATTLE_PLACEMENT_ZONES, PLAYFUL_MODE_FOUL_LIMIT } from '../../constants/index.js';
import { endGame, processGameSummary } from '../summaryService.js';
// FIX: Corrected the import path for effectService to point to the root services directory where calculateUserEffects is exported.
import { calculateUserEffects } from '../../utils/statUtils.js';

// --- Simulation & Scoring Logic ---
const runServerSimulation = (game: LiveGameSession) => {
    if (!game.animation || game.animation.type !== 'alkkagi_flick' || !game.alkkagiStones) return { finalStones: game.alkkagiStones || [], stonesFallen: [] };

    const simStones: AlkkagiStone[] = JSON.parse(JSON.stringify(game.alkkagiStones));
    const { stoneId, vx, vy, duration } = game.animation;
    const stoneToAnimate = simStones.find(s => s.id === stoneId);
    if (!stoneToAnimate) return { finalStones: simStones, stonesFallen: [] };

    stoneToAnimate.vx = vx;
    stoneToAnimate.vy = vy;

    const boardSizePx = 840;
    const friction = 0.98;
    const timeStep = 1000 / 60; // 60fps simulation step
    const numSteps = Math.floor(duration / timeStep);
    const stonesFallen: AlkkagiStone[] = [];

    for (let i = 0; i < numSteps; i++) {
        let stonesAreMoving = false;
        
        for (const stone of simStones) {
            if (!stone.onBoard) continue;
            
            stone.x += stone.vx;
            stone.y += stone.vy;
            stone.vx *= friction;
            stone.vy *= friction;

            if (Math.abs(stone.vx) < 0.01) stone.vx = 0;
            if (Math.abs(stone.vy) < 0.01) stone.vy = 0;
            if (stone.vx !== 0 || stone.vy !== 0) stonesAreMoving = true;

            if (stone.x < 0 || stone.x > boardSizePx || stone.y < 0 || stone.y > boardSizePx) {
                if (stone.onBoard) {
                    stone.onBoard = false;
                    (stone as any).timeOffBoard = i; // Record the simulation step
                    stonesFallen.push(stone);
                }
            }
        }

        for (let k = 0; k < simStones.length; k++) {
            for (let j = k + 1; j < simStones.length; j++) {
                const s1 = simStones[k];
                const s2 = simStones[j];
                if (!s1.onBoard || !s2.onBoard) continue;
                const dx = s2.x - s1.x;
                const dy = s2.y - s1.y;
                const distance = Math.hypot(dx, dy);
                const radiiSum = s1.radius + s2.radius;

                if (distance < radiiSum) {
                    const nx = dx / distance;
                    const ny = dy / distance;
                    const dvx = s2.vx - s1.vx;
                    const dvy = s2.vy - s1.vy;
                    const dot = dvx * nx + dvy * ny;
                    if (dot < 0) {
                        const impulse = dot;
                        s1.vx += impulse * nx;
                        s1.vy += impulse * ny;
                        s2.vx -= impulse * nx;
                        s2.vy -= impulse * ny;
                    }
                    const overlap = (radiiSum - distance) / 2;
                    s1.x -= overlap * nx;
                    s1.y -= overlap * ny;
                    s2.x += overlap * nx;
                    s2.y += overlap * ny;
                }
            }
        }
        
        if (!stonesAreMoving) break;
    }
    
    return { finalStones: simStones, stonesFallen };
};

const checkAndEndRound = (game: LiveGameSession, now: number, stonesFallenThisTurn: AlkkagiStone[] = []): boolean => {
    if (!game.alkkagiStones) return false;
    const blackStones = game.alkkagiStones.filter(s => s.player === Player.Black && s.onBoard).length;
    const whiteStones = game.alkkagiStones.filter(s => s.player === Player.White && s.onBoard).length;
    
    let roundWinnerId: string | null = null;
    
    if (blackStones === 0 && whiteStones === 0 && stonesFallenThisTurn.length > 0) {
        // Simultaneous out: the player whose stone fell last wins
        const lastStoneFallen = stonesFallenThisTurn.reduce((last, current) => 
            ((current as any).timeOffBoard > (last as any).timeOffBoard) ? current : last
        );
        roundWinnerId = lastStoneFallen.player === Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
    } else {
        if (blackStones === 0 && game.blackPlayerId) roundWinnerId = game.whitePlayerId;
        if (whiteStones === 0 && game.whitePlayerId) roundWinnerId = game.blackPlayerId;
    }

    if (roundWinnerId) {
        const totalRounds = game.settings.alkkagiRounds || 1;
        if (game.alkkagiRound! >= totalRounds) {
            endGame(game, roundWinnerId === game.blackPlayerId ? Player.Black : Player.White, WinReason.AlkkagiWin);
        } else {
            const loserId = roundWinnerId === game.player1.id ? game.player2.id : game.player1.id;
            game.alkkagiRoundSummary = {
                round: game.alkkagiRound!,
                winnerId: roundWinnerId,
                loserId: loserId,
                refillsRemaining: {}
            };
            game.gameStatus = GameStatus.AlkkagiRoundEnd;
            game.revealEndTime = now + 30000;
            game.roundEndConfirmations = { [game.player1.id]: 0, [game.player2.id]: 0 };
            if (game.isAiGame) (game.roundEndConfirmations as any)[aiUserId] = now;
        }
        return true;
    }
    return false;
};

export const placeRandomStonesForPlayer = (game: LiveGameSession, playerEnum: Player, playerId: string, count: number) => {
    const boardSizePx = 840;
    const stoneRadius = (840 / 19) * 0.47;
    const { settings } = game;

    let placedCount = 0;
    let attempts = 0;
    const maxAttempts = 200 * count;

    while (placedCount < count && attempts < maxAttempts) {
        attempts++;
        let x: number, y: number;

        if (settings.alkkagiLayout === AlkkagiLayoutType.Battle) {
            const zones = BATTLE_PLACEMENT_ZONES[playerEnum as keyof typeof BATTLE_PLACEMENT_ZONES];
            const randomZone = zones[Math.floor(Math.random() * zones.length)];
            const cellSize = boardSizePx / 19;
            const padding = cellSize / 2;

            const zoneXStart = padding + (randomZone.x - 0.5) * cellSize;
            const zoneYStart = padding + (randomZone.y - 0.5) * cellSize;
            const zoneXEnd = zoneXStart + randomZone.width * cellSize;
            const zoneYEnd = zoneYStart + randomZone.height * cellSize;
            x = zoneXStart + Math.random() * (zoneXEnd - zoneXStart);
            y = zoneYStart + Math.random() * (zoneYEnd - zoneYStart);
        } else { 
            const whiteZoneMinY = boardSizePx * 0.15;
            const whiteZoneMaxY = boardSizePx * 0.35;
            const blackZoneMinY = boardSizePx * 0.65;
            const blackZoneMaxY = boardSizePx * 0.85;
            
            x = stoneRadius + Math.random() * (boardSizePx - stoneRadius * 2);
            if (playerEnum === Player.White) {
                y = whiteZoneMinY + Math.random() * (whiteZoneMaxY - whiteZoneMinY);
            } else {
                y = blackZoneMinY + Math.random() * (blackZoneMaxY - blackZoneMinY);
            }
        }

        const point = { x, y };
        
        const allStones = [...(game.alkkagiStones || []), ...(game.alkkagiStones_p1 || []), ...(game.alkkagiStones_p2 || [])];
        const overlaps = allStones.some(stone => Math.hypot(point.x - stone.x, point.y - stone.y) < stoneRadius * 2);

        if (!overlaps) {
            const newStone: AlkkagiStone = {
                id: Date.now() + Math.random(), player: playerEnum,
                x: point.x, y: point.y, vx: 0, vy: 0,
                radius: stoneRadius, onBoard: true
            };

            const isSimultaneous = game.gameStatus === GameStatus.AlkkagiSimultaneousPlacement;
            if (isSimultaneous) {
                const playerStonesKey = playerId === game.player1.id ? 'alkkagiStones_p1' : 'alkkagiStones_p2';
                if (!game[playerStonesKey]) (game as any)[playerStonesKey] = [];
                (game as any)[playerStonesKey]!.push(newStone);
            } else {
                if (!game.alkkagiStones) game.alkkagiStones = [];
                game.alkkagiStones.push(newStone);
            }
            
            if (!game.alkkagiStonesPlacedThisRound) game.alkkagiStonesPlacedThisRound = {};
            game.alkkagiStonesPlacedThisRound[playerId] = (game.alkkagiStonesPlacedThisRound[playerId] || 0) + 1;
            placedCount++;
        }
    }

    if (placedCount < count) {
        console.warn(`[Alkkagi Timeout] Could only place ${placedCount}/${count} random stones for player ${playerId}`);
    }
};

export const initializeAlkkagi = (game: LiveGameSession, neg: Negotiation, now: number, p1Guild: Guild | null, p2Guild: Guild | null) => {
    const p1 = game.player1;
    const p2 = game.player2;

    game.alkkagiStones = [];
    game.alkkagiStones_p1 = [];
    game.alkkagiStones_p2 = [];
    game.alkkagiStonesPlacedThisRound = { [p1.id]: 0, [p2.id]: 0 };
    game.alkkagiRound = 1;
    game.activeAlkkagiItems = {};
    game.alkkagiRefillsUsed = { [p1.id]: 0, [p2.id]: 0 };
    game.alkkagiRoundSummary = undefined;
    game.timeoutFouls = { [p1.id]: 0, [p2.id]: 0 };

    const p1Effects = calculateUserEffects(p1, p1Guild);
    const p2Effects = calculateUserEffects(p2, p2Guild);
    const p1SlowBonus = p1Effects.mythicStatBonuses[MythicStat.AlkkagiSlowBonus]?.flat || 0;
    const p1AimBonus = p1Effects.mythicStatBonuses[MythicStat.AlkkagiAimingBonus]?.flat || 0;
    const p2SlowBonus = p2Effects.mythicStatBonuses[MythicStat.AlkkagiSlowBonus]?.flat || 0;
    const p2AimBonus = p2Effects.mythicStatBonuses[MythicStat.AlkkagiAimingBonus]?.flat || 0;

    game.alkkagiItemUses = {
        [p1.id]: { slow: (game.settings.alkkagiSlowItemCount || 0) + p1SlowBonus, aimingLine: (game.settings.alkkagiAimingLineItemCount || 0) + p1AimBonus },
        [p2.id]: { slow: (game.settings.alkkagiSlowItemCount || 0) + p2SlowBonus, aimingLine: (game.settings.alkkagiAimingLineItemCount || 0) + p2AimBonus }
    };

    if (game.isAiGame) {
        const humanPlayerColor = neg.settings.player1Color || Player.Black;
        if (humanPlayerColor === Player.Black) {
            game.blackPlayerId = p1.id;
            game.whitePlayerId = p2.id;
        } else {
            game.whitePlayerId = p1.id;
            game.blackPlayerId = p2.id;
        }
        
        const placementType = game.settings.alkkagiPlacementType;
        game.gameStatus = placementType === AlkkagiPlacementType.TurnByTurn 
            ? GameStatus.AlkkagiPlacement 
            : GameStatus.AlkkagiSimultaneousPlacement;
        game.currentPlayer = placementType === AlkkagiPlacementType.TurnByTurn ? Player.Black : Player.None;
        game.alkkagiPlacementDeadline = now + (placementType === AlkkagiPlacementType.TurnByTurn ? ALKKAGI_PLACEMENT_TIME_LIMIT : ALKKAGI_SIMULTANEOUS_PLACEMENT_TIME_LIMIT) * 1000;
        game.turnDeadline = game.alkkagiPlacementDeadline;
        
        // AI places stones immediately for simultaneous placement
        if (game.gameStatus === GameStatus.AlkkagiSimultaneousPlacement) {
            const aiPlayerEnum = humanPlayerColor === Player.Black ? Player.White : Player.Black;
            const targetStones = game.settings.alkkagiStoneCount || 5;
            placeRandomStonesForPlayer(game, aiPlayerEnum, aiUserId, targetStones);
        }

    } else {
        game.gameStatus = GameStatus.TurnPreferenceSelection;
        game.turnChoices = { [p1.id]: null, [p2.id]: null };
        game.turnChoiceDeadline = now + 30000;
        game.turnSelectionTiebreaker = 'rps';
    }
};

export const updateAlkkagiState = async (game: LiveGameSession, now: number) => {
    if (updateSharedGameState(game, now)) return;

    const p1Id = game.player1.id;
    const p2Id = game.player2.id;
    
    switch (game.gameStatus) {
        case GameStatus.AlkkagiRpsReveal:
            if (game.revealEndTime && now > game.revealEndTime) {
                const p1Choice = game.rpsState?.[p1Id];
                const p2Choice = game.rpsState?.[p2Id];

                if (p1Choice && p2Choice) {
                    let winnerId: string | null = null;
                    if (p1Choice !== p2Choice) {
                        const p1Wins = (p1Choice === RPSChoice.Rock && p2Choice === RPSChoice.Scissors) ||
                                       (p1Choice === RPSChoice.Scissors && p2Choice === RPSChoice.Paper) ||
                                       (p1Choice === RPSChoice.Paper && p2Choice === RPSChoice.Rock);
                        winnerId = p1Wins ? p1Id : p2Id;
                    } else { // Handle tie
                        if ((game.rpsRound || 1) >= 3) {
                            winnerId = Math.random() < 0.5 ? p1Id : p2Id;
                        } else {
                            return; // Let shared state handle re-roll
                        }
                    }
                    
                    if (winnerId) {
                        const loserId = winnerId === p1Id ? p2Id : p1Id;
                        const winnerChoice = game.turnChoices![winnerId]!;

                        if (winnerChoice === 'first') {
                            game.blackPlayerId = winnerId;
                            game.whitePlayerId = loserId;
                        } else {
                            game.whitePlayerId = winnerId;
                            game.blackPlayerId = loserId;
                        }
                        
                        game.gameStatus = GameStatus.AlkkagiStartConfirmation; 
                        game.revealEndTime = now + 30000;
                        game.preGameConfirmations = { [p1Id]: false, [p2Id]: false };
                        if (game.isAiGame) (game.preGameConfirmations as any)[aiUserId] = true;
                    }
                }
            }
            break;
        case GameStatus.AlkkagiStartConfirmation: {
            const bothConfirmed = game.preGameConfirmations?.[p1Id] && game.preGameConfirmations?.[p2Id];
            const deadlinePassed = game.revealEndTime && now > game.revealEndTime;
            if (bothConfirmed || deadlinePassed) {
                const placementType = game.settings.alkkagiPlacementType;
                game.gameStatus = placementType === AlkkagiPlacementType.TurnByTurn 
                    ? GameStatus.AlkkagiPlacement 
                    : GameStatus.AlkkagiSimultaneousPlacement;
                game.currentPlayer = placementType === AlkkagiPlacementType.TurnByTurn ? Player.Black : Player.None;
                game.alkkagiPlacementDeadline = now + (placementType === AlkkagiPlacementType.TurnByTurn ? ALKKAGI_PLACEMENT_TIME_LIMIT : ALKKAGI_SIMULTANEOUS_PLACEMENT_TIME_LIMIT) * 1000;
                game.turnDeadline = game.alkkagiPlacementDeadline;
                
                game.preGameConfirmations = {};
                game.revealEndTime = undefined;
                game.turnChoices = undefined;
                game.rpsState = undefined;
                game.rpsRound = undefined;
            }
            break;
        }
        case GameStatus.AlkkagiPlacement:
        case GameStatus.AlkkagiSimultaneousPlacement: {
            if (!game.alkkagiStonesPlacedThisRound) game.alkkagiStonesPlacedThisRound = {};
            if (game.alkkagiPlacementDeadline && now > game.alkkagiPlacementDeadline) {
                 const targetStones = game.settings.alkkagiStoneCount || 5;

                if (game.gameStatus === GameStatus.AlkkagiPlacement) {
                    const timedOutPlayerId = game.currentPlayer === Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
                    const timedOutPlayerEnum = game.currentPlayer!;
                    
                    if (!game.timeoutFouls) game.timeoutFouls = {};
                    game.timeoutFouls[timedOutPlayerId] = (game.timeoutFouls[timedOutPlayerId] || 0) + 1;
                    game.foulInfo = { message: `타임오버 파울!`, expiry: now + 4000 };

                    if (game.timeoutFouls[timedOutPlayerId] >= PLAYFUL_MODE_FOUL_LIMIT) {
                        const winnerId = game.player1.id === timedOutPlayerId ? game.player2.id : game.player1.id;
                        const winnerEnum = winnerId === game.blackPlayerId ? Player.Black : Player.White;
                        endGame(game, winnerEnum, WinReason.Timeout);
                        return;
                    }

                    const placedCount = game.alkkagiStonesPlacedThisRound[timedOutPlayerId] || 0;
                    if (placedCount < targetStones) {
                        // Place one stone randomly
                        placeRandomStonesForPlayer(game, timedOutPlayerEnum, timedOutPlayerId, 1);
                    }
                    
                    // Switch turn even after random placement
                    game.currentPlayer = game.currentPlayer === Player.Black ? Player.White : Player.Black;
                    game.alkkagiPlacementDeadline = now + ALKKAGI_PLACEMENT_TIME_LIMIT * 1000;
                    game.turnDeadline = game.alkkagiPlacementDeadline;

                } else { // simultaneous
                    const p1Enum = p1Id === game.blackPlayerId ? Player.Black : Player.White;
                    const p2Enum = p2Id === game.blackPlayerId ? Player.Black : Player.White;
            
                    const p1StonesCount = game.alkkagiStonesPlacedThisRound[p1Id] || 0;
                    const p2StonesCount = game.alkkagiStonesPlacedThisRound[p2Id] || 0;
            
                    const p1Missing = targetStones - p1StonesCount;
                    const p2Missing = targetStones - p2StonesCount;
                    
                    let gameEnded = false;
                    if (p1Missing > 0) {
                        if (!game.timeoutFouls) game.timeoutFouls = {};
                        game.timeoutFouls[p1Id] = (game.timeoutFouls[p1Id] || 0) + 1;
                        if (game.timeoutFouls[p1Id] >= PLAYFUL_MODE_FOUL_LIMIT) {
                             endGame(game, p2Enum, WinReason.Timeout);
                            gameEnded = true;
                        } else {
                           placeRandomStonesForPlayer(game, p1Enum, p1Id, p1Missing);
                        }
                    }
                    if (p2Missing > 0 && !gameEnded) {
                        if (!game.timeoutFouls) game.timeoutFouls = {};
                        game.timeoutFouls[p2Id] = (game.timeoutFouls[p2Id] || 0) + 1;
                        if (game.timeoutFouls[p2Id] >= PLAYFUL_MODE_FOUL_LIMIT) {
                             endGame(game, p1Enum, WinReason.Timeout);
                        } else {
                           placeRandomStonesForPlayer(game, p2Enum, p2Id, p2Missing);
                        }
                    }
                     game.foulInfo = { message: `타임오버 파울!`, expiry: now + 4000 };
                }
            }
            
            const targetStones = game.settings.alkkagiStoneCount || 5;
            
            const p1PlacedThisRound = game.alkkagiStonesPlacedThisRound?.[p1Id] || 0;
            const p2PlacedThisRound = game.alkkagiStonesPlacedThisRound?.[p2Id] || 0;

            const p1Done = p1PlacedThisRound >= targetStones;
            const p2Done = p2PlacedThisRound >= targetStones;
            
            if (p1Done && p2Done) {
                if (!game.alkkagiStones) game.alkkagiStones = [];
                game.alkkagiStones.push(...(game.alkkagiStones_p1 || []), ...(game.alkkagiStones_p2 || []));
                game.alkkagiStones_p1 = [];
                game.alkkagiStones_p2 = [];
                
                game.gameStatus = GameStatus.AlkkagiPlaying;
                game.currentPlayer = Player.Black;
                game.alkkagiTurnDeadline = now + ALKKAGI_TURN_TIME_LIMIT * 1000;
                game.turnDeadline = game.alkkagiTurnDeadline;
                game.turnStartTime = now;
            }
            break;
        }
        case GameStatus.AlkkagiPlaying:
            if (game.alkkagiTurnDeadline && now > game.alkkagiTurnDeadline) {
                const timedOutPlayerId = game.currentPlayer === Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
                const gameEnded = handlePlayfulTimeoutFoul(game, timedOutPlayerId, now);
                if (!gameEnded) {
                    game.currentPlayer = game.currentPlayer === Player.Black ? Player.White : Player.Black;
                    game.alkkagiTurnDeadline = now + ALKKAGI_TURN_TIME_LIMIT * 1000;
                    game.turnDeadline = game.alkkagiTurnDeadline;
                    game.turnStartTime = now;
                }
            }
            break;
        case GameStatus.AlkkagiAnimating:
            if (game.revealEndTime && now > game.revealEndTime) {
                const animation = game.animation;
                if (!animation || animation.type !== 'alkkagi_flick') return;
                const { stoneId, vx, vy, duration } = animation;
                const stone = game.alkkagiStones?.find(s => s.id === stoneId);
                if (!stone) return;

                const simResult = runServerSimulation(game);
                game.alkkagiStones = simResult.finalStones;
                
                game.animation = null;
                game.revealEndTime = undefined;
                const roundEnded = checkAndEndRound(game, now, simResult.stonesFallen);
                if (!roundEnded) {
                    game.gameStatus = GameStatus.AlkkagiPlaying;
                    game.currentPlayer = game.currentPlayer === Player.Black ? Player.White : Player.Black;
                    game.alkkagiTurnDeadline = now + ALKKAGI_TURN_TIME_LIMIT * 1000;
                    game.turnDeadline = game.alkkagiTurnDeadline;
                    game.turnStartTime = now;
                }
            }
            break;
        case GameStatus.AlkkagiRoundEnd: {
            if (!game.alkkagiRoundSummary) {
                console.error(`[Alkkagi] Invalid state: gameStatus is 'alkkagi_round_end' but alkkagiRoundSummary is missing. Game ID: ${game.id}. Forcing no_contest.`);
                game.gameStatus = GameStatus.NoContest;
                game.winReason = WinReason.Disconnect;
                await processGameSummary(game);
                return;
            }
            if ((game.roundEndConfirmations?.[p1Id] && game.roundEndConfirmations?.[p2Id]) || (game.revealEndTime && now > game.revealEndTime)) {
                const totalRounds = game.settings.alkkagiRounds || 1;
                if (game.alkkagiRound! >= totalRounds) {
                    const winnerId = game.alkkagiRoundSummary.winnerId;
                    endGame(game, winnerId === game.blackPlayerId ? Player.Black : Player.White, WinReason.AlkkagiWin);
                } else {
                    game.alkkagiRound!++;
                    
                    // Winner keeps their on-board stones. Loser's are already off-board.
                    if (!game.alkkagiStones) game.alkkagiStones = [];
                    game.alkkagiStones = game.alkkagiStones.filter(s => s.onBoard);

                    const placementType = game.settings.alkkagiPlacementType;
                    const loserId = game.alkkagiRoundSummary.loserId;
                    const loserEnum = loserId === game.blackPlayerId ? Player.Black : Player.White;

                    if (placementType === AlkkagiPlacementType.TurnByTurn) {
                        game.gameStatus = GameStatus.AlkkagiPlacement;
                        game.currentPlayer = loserEnum; // Loser of the round places first
                        game.alkkagiPlacementDeadline = now + ALKKAGI_PLACEMENT_TIME_LIMIT * 1000;
                        game.turnDeadline = game.alkkagiPlacementDeadline;
                    } else {
                        game.gameStatus = GameStatus.AlkkagiSimultaneousPlacement;
                        game.currentPlayer = Player.None;
                        game.alkkagiPlacementDeadline = now + ALKKAGI_SIMULTANEOUS_PLACEMENT_TIME_LIMIT * 1000;
                        game.turnDeadline = game.alkkagiPlacementDeadline;
                    }

                    game.alkkagiStonesPlacedThisRound = { [p1Id]: 0, [p2Id]: 0 }; 
                    game.alkkagiStones_p1 = [];
                    game.alkkagiStones_p2 = [];
                }
            }
            break;
        }
    }
};

const isPlacementValid = (game: LiveGameSession, point: Point, player: Player): boolean => {
    if (player === Player.None) return false;

    const { settings } = game;
    const boardSizePx = 840;
    const stoneRadius = (840 / 19) * 0.47;
    const { x: svgX, y: svgY } = point;
    const cellSize = boardSizePx / 19;
    const padding = cellSize / 2;

    if (svgX < stoneRadius || svgX > boardSizePx - stoneRadius || svgY < stoneRadius || svgY > boardSizePx - stoneRadius) {
        return false;
    }

    let inZone = false;
    if (settings.alkkagiLayout === AlkkagiLayoutType.Battle) {
        const zones = BATTLE_PLACEMENT_ZONES[player as keyof typeof BATTLE_PLACEMENT_ZONES];
        inZone = zones.some(zone => {
             const zoneXStart = padding + (zone.x - 0.5) * cellSize;
             const zoneYStart = padding + (zone.y - 0.5) * cellSize;
             const zoneXEnd = zoneXStart + zone.width * cellSize;
             const zoneYEnd = zoneYStart + zone.height * cellSize;
             return svgX >= zoneXStart && svgX <= zoneXEnd && svgY >= zoneYStart && svgY <= zoneYEnd;
        });
    } else { 
        const whiteZoneMinY = boardSizePx * 0.15;
        const whiteZoneMaxY = boardSizePx * 0.35;
        const blackZoneMinY = boardSizePx * 0.65;
        const blackZoneMaxY = boardSizePx * 0.85;

        if (player === Player.White) {
            if (svgY >= whiteZoneMinY && svgY <= whiteZoneMaxY) inZone = true;
        } else {
            if (svgY >= blackZoneMinY && svgY <= blackZoneMaxY) inZone = true;
        }
    }
    if (!inZone) return false;
    
    const allStones = [...(game.alkkagiStones || []), ...(game.alkkagiStones_p1 || []), ...(game.alkkagiStones_p2 || [])];
    for (const stone of allStones) {
        if (stone.player === player) {
            const distance = Math.hypot(svgX - stone.x, svgY - stone.y);
            if (distance < stone.radius * 2) {
                return false; // Overlapping
            }
        }
    }
    return true;
};

export const handleAlkkagiAction = async (volatileState: VolatileState, game: LiveGameSession, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult | null> => {
    const { type, payload } = action;
    const now = Date.now();
    const myPlayerEnum = user.id === game.blackPlayerId ? Player.Black : (user.id === game.whitePlayerId ? Player.White : Player.None);
    const isMyTurn = myPlayerEnum === game.currentPlayer;
    
    const sharedResult = await handleSharedAction(volatileState, game, action, user);
    if (sharedResult) return sharedResult;
    
    switch(type) {
        case 'CONFIRM_ALKKAGI_START': {
            if (game.mode !== GameMode.Alkkagi) return null;
            if (game.gameStatus !== GameStatus.AlkkagiStartConfirmation) return { error: "Not in confirmation phase." };
            if (!game.preGameConfirmations) game.preGameConfirmations = {};
            if (game.isAiGame) (game.preGameConfirmations as any)[aiUserId] = true;
            
            game.preGameConfirmations[user.id] = true;
            
            return {};
        }
        case 'ALKKAGI_PLACE_STONE': {
            const isSimultaneous = game.gameStatus === GameStatus.AlkkagiSimultaneousPlacement;
            if (game.gameStatus !== GameStatus.AlkkagiPlacement && !isSimultaneous) return { error: '배치 단계가 아닙니다.' };
            if (!isSimultaneous && !isMyTurn) return { error: '당신의 차례가 아닙니다.' };

            // This is the number of stones to REFILL each round
            const stonesToPlaceThisRound = game.settings.alkkagiStoneCount || 5;
            const alreadyPlacedThisRound = game.alkkagiStonesPlacedThisRound?.[user.id] || 0;

            if (alreadyPlacedThisRound >= stonesToPlaceThisRound) {
                return { error: '이번 라운드에 배치할 돌을 모두 놓았습니다.' };
            }
            
            if (isPlacementValid(game, payload.point, myPlayerEnum)) {
                const newStone: AlkkagiStone = {
                    id: Date.now() + Math.random(), player: myPlayerEnum,
                    x: payload.point.x, y: payload.point.y, vx: 0, vy: 0,
                    radius: (840 / 19) * 0.47, onBoard: true
                };

                if (isSimultaneous) {
                    const playerStonesKey = user.id === game.player1.id ? 'alkkagiStones_p1' : 'alkkagiStones_p2';
                    if (!(game as any)[playerStonesKey]) (game as any)[playerStonesKey] = [];
                    (game as any)[playerStonesKey]!.push(newStone);
                } else {
                    if (!game.alkkagiStones) game.alkkagiStones = [];
                    game.alkkagiStones.push(newStone);
                }
                
                if (!game.alkkagiStonesPlacedThisRound) game.alkkagiStonesPlacedThisRound = {};
                game.alkkagiStonesPlacedThisRound[user.id] = alreadyPlacedThisRound + 1;
                
                if (game.gameStatus === GameStatus.AlkkagiPlacement) {
                    game.currentPlayer = game.currentPlayer === Player.Black ? Player.White : Player.Black;
                    game.alkkagiPlacementDeadline = now + ALKKAGI_PLACEMENT_TIME_LIMIT * 1000;
                    game.turnDeadline = game.alkkagiPlacementDeadline;
                }
            } else {
                return { error: '유효하지 않은 위치입니다.' };
            }
            return {};
        }
        case 'ALKKAGI_FLICK_STONE': {
            if (game.gameStatus !== GameStatus.AlkkagiPlaying || !isMyTurn) return { error: "지금은 공격할 수 없습니다."};
            const { stoneId, vx, vy } = payload;
            
            const duration = 5000;
            game.animation = { type: 'alkkagi_flick', stoneId, vx, vy, startTime: now, duration };
            game.gameStatus = GameStatus.AlkkagiAnimating;
            game.revealEndTime = now + duration;
            if (game.activeAlkkagiItems) {
                delete game.activeAlkkagiItems[user.id];
            }
            game.alkkagiTurnDeadline = undefined;
            game.turnDeadline = undefined;
            game.turnStartTime = undefined;
            return {};
        }
        case 'USE_ALKKAGI_ITEM': {
            if (game.gameStatus !== GameStatus.AlkkagiPlaying || !isMyTurn) return { error: "Not your turn to use an item." };
            const { itemType } = payload as { itemType: 'slow' | 'aimingLine' };

            if (game.activeAlkkagiItems?.[user.id]?.includes(itemType)) return { error: '아이템이 이미 활성화되어 있습니다.' };

            if (!game.alkkagiItemUses || !(game.alkkagiItemUses as any)[user.id] || (game.alkkagiItemUses as any)[user.id][itemType] <= 0) {
                return { error: '해당 아이템이 없습니다.' };
            }
            (game.alkkagiItemUses as any)[user.id][itemType]--;
            if (!game.activeAlkkagiItems) game.activeAlkkagiItems = {};
            if (!Array.isArray(game.activeAlkkagiItems[user.id])) {
                (game.activeAlkkagiItems as any)[user.id] = [];
            }
            (game.activeAlkkagiItems as any)[user.id].push(itemType);
            return {};
        }
        case 'CONFIRM_ROUND_END': {
            if (game.gameStatus !== GameStatus.AlkkagiRoundEnd) return { error: "라운드 종료 확인 단계가 아닙니다." };
            if (!game.roundEndConfirmations) game.roundEndConfirmations = {};
            game.roundEndConfirmations[user.id] = now;
            return {};
        }
    }
    
    return null;
};

export const makeAlkkagiAiMove = async (game: LiveGameSession): Promise<void> => {
    const aiId = game.player2.id;
    const myPlayerEnum = game.whitePlayerId === aiId ? Player.White : Player.Black;
    if (game.currentPlayer !== myPlayerEnum) return;

    if (game.gameStatus === GameStatus.AlkkagiPlaying) {
        if (!game.alkkagiStones || game.alkkagiStones.length === 0) return;
        const myStones = game.alkkagiStones.filter(s => s.player === myPlayerEnum && s.onBoard);
        if (myStones.length === 0) return;

        const stoneToFlick = myStones[Math.floor(Math.random() * myStones.length)];
        
        // Simple strategy: flick towards the center of the opponent's cluster
        const opponentStones = game.alkkagiStones.filter(s => s.player !== myPlayerEnum && s.onBoard);
        let target = { x: 420, y: 420 }; // board center
        if (opponentStones.length > 0) {
            target.x = opponentStones.reduce((sum, s) => sum + s.x, 0) / opponentStones.length;
            target.y = opponentStones.reduce((sum, s) => sum + s.y, 0) / opponentStones.length;
        }

        const dx = target.x - stoneToFlick.x;
        const dy = target.y - stoneToFlick.y;
        const mag = Math.hypot(dx, dy);
        
        const power = 50 + Math.random() * 50; // Random power between 50 and 100
        const launchStrength = power / 100 * 25;
        
        const vx = mag > 0 ? (dx / mag) * launchStrength : 0;
        const vy = mag > 0 ? (dy / mag) * launchStrength : 0;

        const duration = 5000;
        game.animation = { type: 'alkkagi_flick', stoneId: stoneToFlick.id, vx, vy, startTime: Date.now(), duration };
        game.gameStatus = GameStatus.AlkkagiAnimating;
        game.revealEndTime = Date.now() + duration;
    } else if (game.gameStatus === GameStatus.AlkkagiPlacement) {
        // AI places one stone randomly
        const targetStones = game.settings.alkkagiStoneCount || 5;
        const placedCount = game.alkkagiStonesPlacedThisRound?.[aiId] || 0;
        if (placedCount < targetStones) {
            placeRandomStonesForPlayer(game, myPlayerEnum, aiId, 1);
            game.currentPlayer = game.currentPlayer === Player.Black ? Player.White : Player.Black;
            game.alkkagiPlacementDeadline = Date.now() + ALKKAGI_PLACEMENT_TIME_LIMIT * 1000;
            game.turnDeadline = game.alkkagiPlacementDeadline;
        }
    }
};
