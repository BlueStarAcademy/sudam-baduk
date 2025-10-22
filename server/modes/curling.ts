
import { type LiveGameSession, type AlkkagiStone, type Point, Player, type Negotiation, MythicStat, type VolatileState, type ServerAction, type User, type HandleActionResult, GameMode, GameStatus, WinReason, RPSChoice, Guild } from '../../types/index.js';
import * as db from '../db.js';
import { handleSharedAction, updateSharedGameState, handleTimeoutFoul as handlePlayfulTimeoutFoul } from './shared.js';
import { aiUserId } from '../ai/index.js';
import { CURLING_TURN_TIME_LIMIT } from '../../constants/index.js';
import { calculateUserEffects } from '../../utils/statUtils.js';
import { endGame, processGameSummary } from '../summaryService.js';

const placeRandomCurlingStone = (game: LiveGameSession, playerEnum: Player) => {
    const boardSizePx = 840;
    const stoneRadius = (840 / 19) * 0.47;
    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
        attempts++;
        const x = stoneRadius + Math.random() * (boardSizePx - stoneRadius * 2);
        const y = stoneRadius + Math.random() * (boardSizePx - stoneRadius * 2);

        const newStone: AlkkagiStone = {
            id: Date.now() + Math.random(), player: playerEnum,
            x: x, y: y, vx: 0, vy: 0,
            radius: stoneRadius, onBoard: true
        };

        const overlaps = (game.curlingStones || []).some(stone => Math.hypot(newStone.x - stone.x, newStone.y - stone.y) < stoneRadius * 2);

        if (!overlaps) {
            if (!game.curlingStones) game.curlingStones = [];
            game.curlingStones.push(newStone);
            return;
        }
    }
    console.warn(`[Curling] Could not place random stone after ${maxAttempts} attempts.`);
};

// --- Simulation & Scoring Logic ---
const runServerSimulation = (initialStones: AlkkagiStone[], flickedStone: AlkkagiStone, velocity: Point, duration: number): { finalStones: AlkkagiStone[], stonesFallen: AlkkagiStone[] } => {
    let simStones: AlkkagiStone[] = JSON.parse(JSON.stringify(initialStones || []));
    let stoneToAnimate = { ...flickedStone, vx: velocity.x, vy: velocity.y, onBoard: true };
    simStones.push(stoneToAnimate);

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
                const distance = Math.hypot(dx,dy);
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


const endCurlingRound = (game: LiveGameSession, now: number) => {
    const boardSizePx = 840;
    const center = { x: boardSizePx / 2, y: boardSizePx / 2 };
    const cellSize = boardSizePx / 19;
    
    let houseScoreBlack = 0;
    let houseScoreWhite = 0;
    const scoredStones: { [stoneId: number]: number } = {};

    const onBoardStones = (game.curlingStones || []).filter(s => s.onBoard);
    
    // Score all stones in the house for both players
    for (const stone of onBoardStones) {
        const dist = Math.hypot(stone.x - center.x, stone.y - center.y);
        let score = 0;
        if (dist <= cellSize * 0.5) score = 5;
        else if (dist <= cellSize * 2) score = 3;
        else if (dist <= cellSize * 4) score = 2;
        else if (dist <= cellSize * 6) score = 1;
        
        if (score > 0) {
            scoredStones[stone.id] = score;
            if (stone.player === Player.Black) houseScoreBlack += score;
            else houseScoreWhite += score;
        }
    }

    const blackCumulativeBeforeRound = game.curlingRoundSummary?.cumulativeScores?.[Player.Black] || 0;
    const whiteCumulativeBeforeRound = game.curlingRoundSummary?.cumulativeScores?.[Player.White] || 0;
    
    if (!game.curlingScores) {
        game.curlingScores = { [Player.Black]: 0, [Player.White]: 0, [Player.None]: 0, [Player.BlackPattern]: 0, [Player.WhitePattern]: 0 };
    }

    const blackKnockoutsThisRound = (game.curlingScores[Player.Black] || 0) - blackCumulativeBeforeRound;
    const whiteKnockoutsThisRound = (game.curlingScores[Player.White] || 0) - whiteCumulativeBeforeRound;

    game.curlingScores[Player.Black] += houseScoreBlack;
    game.curlingScores[Player.White] += houseScoreWhite;
    
    const blackTotal = houseScoreBlack + blackKnockoutsThisRound;
    const whiteTotal = houseScoreWhite + whiteKnockoutsThisRound;

    game.curlingRoundSummary = {
        round: game.curlingRound!,
        roundWinner: blackTotal > whiteTotal ? Player.Black : (whiteTotal > blackTotal ? Player.White : null),
        black: { houseScore: houseScoreBlack, knockoutScore: blackKnockoutsThisRound, total: blackTotal },
        white: { houseScore: houseScoreWhite, knockoutScore: whiteKnockoutsThisRound, total: whiteTotal },
        cumulativeScores: { ...game.curlingScores! },
        stonesState: game.curlingStones!,
        scoredStones: scoredStones
    };
    
    game.gameStatus = GameStatus.CurlingRoundEnd;
    game.revealEndTime = now + 15000;
    if (game.isAiGame) {
        if (!game.roundEndConfirmations) game.roundEndConfirmations = {};
        (game.roundEndConfirmations as any)[aiUserId] = now;
    }
};


// --- Game State Management ---

export const initializeCurling = (game: LiveGameSession, neg: Negotiation, now: number, p1Guild: Guild | null, p2Guild: Guild | null) => {
    const p1 = game.player1;
    const p2 = game.player2;
    
    game.curlingStones = [];
    game.activeCurlingItems = {};

    const p1Effects = calculateUserEffects(p1, p1Guild);
    const p2Effects = calculateUserEffects(p2, p2Guild);
    const p1SlowBonus = p1Effects.mythicStatBonuses[MythicStat.AlkkagiSlowBonus]?.flat || 0;
    const p1AimBonus = p1Effects.mythicStatBonuses[MythicStat.AlkkagiAimingBonus]?.flat || 0;
    const p2SlowBonus = p2Effects.mythicStatBonuses[MythicStat.AlkkagiSlowBonus]?.flat || 0;
    const p2AimBonus = p2Effects.mythicStatBonuses[MythicStat.AlkkagiAimingBonus]?.flat || 0;

    game.curlingItemUses = {
        [p1.id]: { slow: (neg.settings.curlingSlowItemCount || 0) + p1SlowBonus, aimingLine: (neg.settings.curlingAimingLineItemCount || 0) + p1AimBonus },
        [p2.id]: { slow: (neg.settings.curlingSlowItemCount || 0) + p2SlowBonus, aimingLine: (neg.settings.curlingAimingLineItemCount || 0) + p2AimBonus }
    };

    // Place initial random stones if setting is enabled
    if (game.settings.curlingInitialRandomStones && game.settings.curlingInitialRandomStones > 0) {
        const numInitialStones = game.settings.curlingInitialRandomStones;
        // Curling stones are all the same color initially, so we just place them as Player.None
        // The actual player color is assigned when they are flicked.
        // For initial random placement, we can alternate colors or assign based on player ID.
        // Let's assume for now they are just generic stones, and their player property will be set later.
        // Or, if the intent is to have pre-placed stones that belong to a player, we need to clarify.
        // For now, I will place them as Player.None and let the game logic assign them later.
        // However, the request specifically mentions "흑돌/백돌" (black/white stones).
        // So, I will place half as black and half as white.
        const blackStonesToPlace = Math.ceil(numInitialStones / 2);
        const whiteStonesToPlace = Math.floor(numInitialStones / 2);

        for (let i = 0; i < blackStonesToPlace; i++) {
            placeRandomCurlingStone(game, Player.Black);
        }
        for (let i = 0; i < whiteStonesToPlace; i++) {
            placeRandomCurlingStone(game, Player.White);
        }
    }

    if (game.isAiGame) {
        const humanPlayerColor = neg.settings.player1Color || Player.Black;
        if (humanPlayerColor === Player.Black) {
            game.blackPlayerId = p1.id;
            game.whitePlayerId = p2.id;
        } else {
            game.whitePlayerId = p1.id;
            game.blackPlayerId = p2.id;
        }
        
        // Default: 백(후공) gets the hammer (last stone advantage)
        game.hammerPlayerId = game.whitePlayerId; 
        game.currentPlayer = Player.Black; // 선공 starts
        game.gameStatus = GameStatus.CurlingPlaying;
        game.curlingRound = 1;
        game.curlingScores = { [Player.Black]: 0, [Player.White]: 0, [Player.None]: 0, [Player.BlackPattern]: 0, [Player.WhitePattern]: 0 };
        game.curlingTurnDeadline = now + CURLING_TURN_TIME_LIMIT * 1000;
        game.turnDeadline = game.curlingTurnDeadline;
        game.turnStartTime = now;

    } else {
        game.gameStatus = GameStatus.TurnPreferenceSelection;
        game.turnChoices = { [p1.id]: null, [p2.id]: null };
        game.turnChoiceDeadline = now + 30000;
        game.turnSelectionTiebreaker = 'rps';
    }
};

export const updateCurlingState = async (game: LiveGameSession, now: number) => {
    if (updateSharedGameState(game, now)) return;

    const p1Id = game.player1.id;
    const p2Id = game.player2.id;
    
    switch (game.gameStatus) {
        case GameStatus.CurlingRpsReveal:
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
                        
                        game.gameStatus = GameStatus.CurlingStartConfirmation; 
                        game.revealEndTime = now + 30000;
                        game.preGameConfirmations = { [p1Id]: false, [p2Id]: false };
                        if (game.isAiGame) (game.preGameConfirmations as any)[aiUserId] = true;
                    }
                }
            }
            break;
        case GameStatus.CurlingStartConfirmation: {
            const bothConfirmed = game.preGameConfirmations?.[p1Id] && game.preGameConfirmations?.[p2Id];
            const deadlinePassed = game.revealEndTime && now > game.revealEndTime;
            if (bothConfirmed || deadlinePassed) {
                const rpsWinnerId = game.blackPlayerId === p1Id ? p1Id : p2Id;
                const rpsWinnerChoice = game.turnChoices?.[rpsWinnerId];

                if (rpsWinnerChoice === 'second') { 
                    game.hammerPlayerId = rpsWinnerId;
                } else {
                    game.hammerPlayerId = rpsWinnerId === p1Id ? p2Id : p1Id;
                }
                
                game.currentPlayer = game.hammerPlayerId === game.blackPlayerId ? Player.White : Player.Black;
                
                game.gameStatus = GameStatus.CurlingPlaying;
                game.curlingRound = 1;
                game.curlingScores = { [Player.Black]: 0, [Player.White]: 0, [Player.None]: 0, [Player.BlackPattern]: 0, [Player.WhitePattern]: 0 };
                game.curlingStones = [];
                game.stonesThrownThisRound = { [p1Id]: 0, [p2Id]: 0 };
                game.curlingTurnDeadline = now + CURLING_TURN_TIME_LIMIT * 1000;
                game.turnDeadline = game.curlingTurnDeadline;
                game.turnStartTime = now;
                // Clean up pre-game state
                game.preGameConfirmations = {};
                game.revealEndTime = undefined;
                game.rpsState = undefined;
                game.rpsRound = undefined;
            }
            break;
        }

        case GameStatus.CurlingPlaying:
        case GameStatus.CurlingTiebreakerPlaying:
            if (game.curlingTurnDeadline && now > game.curlingTurnDeadline) {
                const timedOutPlayerId = game.currentPlayer === Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
                const gameEnded = handlePlayfulTimeoutFoul(game, timedOutPlayerId, now);
                if (!gameEnded) {
                    if (!game.curlingStonesLostToFoul) game.curlingStonesLostToFoul = {};
                    game.curlingStonesLostToFoul[timedOutPlayerId] = (game.curlingStonesLostToFoul[timedOutPlayerId] || 0) + 1;
                    
                    if (!game.stonesThrownThisRound) game.stonesThrownThisRound = {};
                    game.stonesThrownThisRound[timedOutPlayerId] = (game.stonesThrownThisRound[timedOutPlayerId] || 0) + 1;
                    
                    const totalStones = game.settings.curlingStoneCount || 5;
                    const p1Thrown = game.stonesThrownThisRound[game.player1.id] || 0;
                    const p2Thrown = game.stonesThrownThisRound[game.player2.id] || 0;
                    
                    if (p1Thrown >= totalStones && p2Thrown >= totalStones) {
                        endCurlingRound(game, now);
                    } else {
                        game.currentPlayer = game.currentPlayer === Player.Black ? Player.White : Player.Black;
                        game.curlingTurnDeadline = now + CURLING_TURN_TIME_LIMIT * 1000;
                        game.turnDeadline = game.curlingTurnDeadline;
                        game.turnStartTime = now;
                    }
                }
            }
            break;

        case GameStatus.CurlingAnimating:
            if (game.revealEndTime && now > game.revealEndTime) {
                const animation = game.animation;
                if (animation && animation.type === 'curling_flick') {
                    const { stone, velocity, duration } = animation;
                    const simResult = runServerSimulation(game.curlingStones || [], stone, velocity, duration);
                    game.curlingStones = simResult.finalStones;
                    
                    for (const fallenStone of simResult.stonesFallen) {
                        // The player who did NOT throw the stone gets the point
                        if (fallenStone.player === Player.Black) {
                            if (game.curlingScores) game.curlingScores[Player.White]++;
                        } else {
                            if (game.curlingScores) game.curlingScores[Player.Black]++;
                        }
                    }
                }
                
                game.animation = null;
                game.revealEndTime = undefined;

                if (game.isTiebreaker) {
                    game.tiebreakerStonesThrown = (game.tiebreakerStonesThrown || 0) + 1;
                    if (game.tiebreakerStonesThrown >= 2) {
                        endCurlingRound(game, now);
                    } else {
                        game.gameStatus = GameStatus.CurlingTiebreakerPlaying;
                        game.currentPlayer = game.currentPlayer === Player.Black ? Player.White : Player.Black;
                        game.curlingTurnDeadline = now + CURLING_TURN_TIME_LIMIT * 1000;
                        game.turnDeadline = game.curlingTurnDeadline;
                        game.turnStartTime = now;
                    }
                    return;
                }

                const totalStones = game.settings.curlingStoneCount || 5;
                const p1Thrown = game.stonesThrownThisRound?.[p1Id] || 0;
                const p2Thrown = game.stonesThrownThisRound?.[p2Id] || 0;

                if (p1Thrown >= totalStones && p2Thrown >= totalStones) {
                    endCurlingRound(game, now);
                } else {
                    game.gameStatus = GameStatus.CurlingPlaying;
                    game.currentPlayer = game.currentPlayer === Player.Black ? Player.White : Player.Black;
                    
                    const DELAY_AFTER_ANIMATION = 500;
                    game.curlingTurnDeadline = now + DELAY_AFTER_ANIMATION + CURLING_TURN_TIME_LIMIT * 1000;
                    game.turnDeadline = game.curlingTurnDeadline;
                    game.turnStartTime = now + DELAY_AFTER_ANIMATION;
                }
            }
            break;

        case GameStatus.CurlingRoundEnd: {
            if (!game.curlingRoundSummary) {
                console.error(`[Curling] Invalid state: gameStatus is 'curling_round_end' but curlingRoundSummary is missing. Game ID: ${game.id}. Forcing no_contest.`);
                game.gameStatus = GameStatus.NoContest;
                game.winReason = WinReason.Disconnect;
                await processGameSummary(game);
                return;
            }
            const bothConfirmedRoundEnd = game.roundEndConfirmations?.[p1Id] && game.roundEndConfirmations?.[p2Id];
            const roundEndDeadlinePassed = game.revealEndTime && now > game.revealEndTime;
            const totalRounds = game.settings.curlingRounds || 3;
            const isFinalPhase = game.isTiebreaker || game.curlingRound! >= totalRounds;

            // For final rounds/tiebreakers, ONLY confirmation works. For other rounds, deadline also works.
            const shouldTransition = (isFinalPhase && bothConfirmedRoundEnd) || (!isFinalPhase && (bothConfirmedRoundEnd || roundEndDeadlinePassed));

            if (shouldTransition) {
                if (game.isTiebreaker) {
                    if (game.curlingRoundSummary) {
                        const { black, white } = game.curlingRoundSummary;
                        const finalWinner = (black.total > white.total) ? Player.Black : Player.White;
                        endGame(game, finalWinner, WinReason.CurlingWin);
                    }
                    return;
                }

                if (game.curlingRound! >= totalRounds) {
                     if (!game.curlingScores) {
                        console.error(`[Curling] Invalid state: Game ending but curlingScores is missing. Game ID: ${game.id}.`);
                        game.gameStatus = GameStatus.NoContest;
                        await processGameSummary(game);
                        return;
                     }
                    const p1Score = game.curlingScores[game.player1.id === game.blackPlayerId ? Player.Black : Player.White];
                    const p2Score = game.curlingScores[game.player2.id === game.blackPlayerId ? Player.Black : Player.White];
                    
                    if (p1Score !== p2Score) {
                        const winnerId = p1Score > p2Score ? p1Id : p2Id;
                        const winnerEnum = winnerId === game.blackPlayerId ? Player.Black : Player.White;
                        endGame(game, winnerEnum, WinReason.CurlingWin);
                    } else { // Tiebreaker
                        game.isTiebreaker = true;
                        game.tiebreakerStonesThrown = 0;
                        game.gameStatus = GameStatus.CurlingTiebreakerPlaying;
                        game.currentPlayer = game.hammerPlayerId === game.blackPlayerId ? Player.White : Player.Black; // Player without hammer starts
                        game.curlingTurnDeadline = now + CURLING_TURN_TIME_LIMIT * 1000;
                        game.turnDeadline = game.curlingTurnDeadline;
                        game.turnStartTime = now;
                    }
                } else {
                    game.curlingRound!++;
                    game.stonesThrownThisRound = { [p1Id]: 0, [p2Id]: 0 };
                    game.gameStatus = GameStatus.CurlingPlaying;
                    
                    const lastRoundWinner = game.curlingRoundSummary?.roundWinner;
                    if (!lastRoundWinner) { // Blank end
                        game.currentPlayer = game.hammerPlayerId === game.blackPlayerId ? Player.White : Player.Black;
                    } else { // Winner of last round starts
                        game.currentPlayer = lastRoundWinner;
                        game.hammerPlayerId = lastRoundWinner === Player.Black ? game.whitePlayerId! : game.blackPlayerId!;
                    }
                    
                    game.curlingTurnDeadline = now + CURLING_TURN_TIME_LIMIT * 1000;
                    game.turnDeadline = game.curlingTurnDeadline;
                    game.turnStartTime = now;
                    game.curlingStones = [];
                }
            }
            break;
        }
    }
};

export const handleCurlingAction = async (volatileState: VolatileState, game: LiveGameSession, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult | null> => {
    const { type, payload } = action;
    const now = Date.now();
    const myPlayerEnum = user.id === game.blackPlayerId ? Player.Black : (user.id === game.whitePlayerId ? Player.White : Player.None);
    const isMyTurn = myPlayerEnum === game.currentPlayer;
    
    const sharedResult = await handleSharedAction(volatileState, game, action, user);
    if (sharedResult) return sharedResult;

    switch(type) {
        case 'CONFIRM_CURLING_START': {
            if (game.mode !== GameMode.Curling) return null;
            if (game.gameStatus !== GameStatus.CurlingStartConfirmation) return { error: "Not in confirmation phase." };
            if (!game.preGameConfirmations) game.preGameConfirmations = {};
            if (game.isAiGame) (game.preGameConfirmations as any)[aiUserId] = true;
            
            game.preGameConfirmations[user.id] = true;
            
            return {};
        }
        case 'CURLING_FLICK_STONE': {
            if (!isMyTurn || (game.gameStatus !== GameStatus.CurlingPlaying && game.gameStatus !== GameStatus.CurlingTiebreakerPlaying)) return { error: "Not your turn to flick."};
            const { launchPosition, velocity } = payload as { launchPosition: Point, velocity: Point };
            
            const stoneRadius = (840 / 19) * 0.47;
            const newStoneToLaunch: AlkkagiStone = {
                id: Date.now() + Math.random(),
                player: myPlayerEnum,
                x: launchPosition.x,
                y: launchPosition.y,
                vx: 0,
                vy: 0,
                radius: stoneRadius,
                onBoard: true // Will be set to true in simulation
            };
            
            const animationDuration = 8000;
            
            game.animation = { type: 'curling_flick', stone: newStoneToLaunch, velocity, startTime: now, duration: animationDuration };
            
            if (!game.isTiebreaker) {
                if (!game.stonesThrownThisRound) game.stonesThrownThisRound = {};
                game.stonesThrownThisRound[user.id] = (game.stonesThrownThisRound[user.id] || 0) + 1;
            }

            if (game.activeCurlingItems) {
                delete game.activeCurlingItems[user.id];
            }

            game.gameStatus = GameStatus.CurlingAnimating;
            game.revealEndTime = now + animationDuration;
            
            game.curlingTurnDeadline = undefined;
            game.turnDeadline = undefined;
            game.turnStartTime = undefined;
            return {};
        }
        case 'USE_CURLING_ITEM': {
            if (game.gameStatus !== GameStatus.CurlingPlaying || !isMyTurn) return { error: 'Not your turn to use an item.' };
            const { itemType } = payload as { itemType: 'slow' | 'aimingLine' };
            const myActiveItems = (game.activeCurlingItems as any)?.[user.id] || [];

            if (myActiveItems.includes(itemType)) return { error: '아이템이 이미 활성화되어 있습니다.' };

            if (!game.curlingItemUses || !(game.curlingItemUses as any)[user.id] || (game.curlingItemUses as any)[user.id][itemType] <= 0) {
                return { error: 'No items of that type left.' };
            }
            (game.curlingItemUses as any)[user.id][itemType]--;
            if (!game.activeCurlingItems) game.activeCurlingItems = {};
            if (!(game.activeCurlingItems as any)[user.id]) (game.activeCurlingItems as any)[user.id] = [];
            (game.activeCurlingItems as any)[user.id].push(itemType);
            return {};
        }
        case 'CONFIRM_ROUND_END': {
            if (game.gameStatus !== GameStatus.CurlingRoundEnd) return { error: "Not in round end confirmation phase." };
            if (!game.roundEndConfirmations) game.roundEndConfirmations = {};
            game.roundEndConfirmations[user.id] = now;
            return {};
        }
    }
    
    return null;
};

export const makeCurlingAiMove = async (game: LiveGameSession): Promise<void> => {
    const aiId = game.player2.id;
    const myPlayerEnum = game.whitePlayerId === aiId ? Player.White : Player.Black;
    if (game.currentPlayer !== myPlayerEnum) return;

    if (game.gameStatus === GameStatus.CurlingPlaying || game.gameStatus === GameStatus.CurlingTiebreakerPlaying) {
        const boardSizePx = 840;
        const cellSize = boardSizePx / 19;
        const padding = cellSize / 2;
        const stoneRadius = (840 / 19) * 0.47;
        
        const launchAreas = [
            { x: padding, y: padding, player: Player.White }, // Top-left
            { x: boardSizePx - padding - cellSize, y: padding, player: Player.White }, // Top-right
            { x: padding, y: boardSizePx - padding - cellSize, player: Player.Black }, // Bottom-left
            { x: boardSizePx - padding - cellSize, y: boardSizePx - padding - cellSize, player: Player.Black }, // Bottom-right
        ];
        
        const myLaunchAreas = launchAreas.filter(a => a.player === myPlayerEnum);
        const launchArea = myLaunchAreas[Math.floor(Math.random() * myLaunchAreas.length)];
        
        const launchPosition = { x: launchArea.x + stoneRadius, y: launchArea.y + stoneRadius };

        const newStoneToLaunch: AlkkagiStone = {
            id: Date.now() + Math.random(), player: myPlayerEnum,
            x: launchPosition.x, y: launchPosition.y,
            vx: 0, vy: 0, radius: stoneRadius, onBoard: true
        };
        
        const target = { x: boardSizePx / 2, y: boardSizePx / 2 };
        const dx = target.x - launchPosition.x;
        const dy = target.y - launchPosition.y;
        const mag = Math.hypot(dx, dy);

        const power = 40 + Math.random() * 40;
        const launchStrength = power / 100 * 25;
        
        const vx = mag > 0 ? (dx / mag) * launchStrength : 0;
        const vy = mag > 0 ? (dy / mag) * launchStrength : 0;
        
        const animationDuration = 8000;
        game.animation = { type: 'curling_flick', stone: newStoneToLaunch, velocity: { x: vx, y: vy }, startTime: Date.now(), duration: animationDuration };
        if (!game.stonesThrownThisRound) game.stonesThrownThisRound = {};
        game.stonesThrownThisRound[aiId] = (game.stonesThrownThisRound[aiId] || 0) + 1;
        game.gameStatus = GameStatus.CurlingAnimating;
        game.revealEndTime = Date.now() + animationDuration;
    }
};
