


import { type LiveGameSession, type Point, type DiceRoundSummary, Player, type Negotiation, type VolatileState, type ServerAction, type HandleActionResult, type User, GameMode, MythicStat, GameStatus, WinReason, RPSChoice, Guild } from '../../types/index.js';
import * as db from '../db.js';
import { getGoLogic, processMove } from '../../utils/goLogic';
import { handleSharedAction, updateSharedGameState, handleTimeoutFoul as handlePlayfulTimeoutFoul } from './shared.js';
import { aiUserId } from '../ai/index.js';
import { DICE_GO_INITIAL_WHITE_STONES_BY_ROUND, DICE_GO_LAST_CAPTURE_BONUS_BY_TOTAL_ROUNDS, DICE_GO_MAIN_PLACE_TIME, DICE_GO_MAIN_ROLL_TIME, DICE_GO_TURN_CHOICE_TIME, DICE_GO_TURN_ROLL_TIME, PLAYFUL_MODE_FOUL_LIMIT } from '../../constants/index.js';
import { calculateUserEffects } from '../../utils/statUtils.js';
import { endGame, getGameResult } from '../summaryService.js';

export function finishPlacingTurn(game: LiveGameSession, playerId: string) {
    const now = Date.now();
    const humanPlayerId = game.player1.id === aiUserId ? game.player2.id : game.player1.id;
    const aiPlayerId = game.player1.id === aiUserId ? game.player1.id : game.player2.id;

    const totalCapturesThisTurn = game.diceCapturesThisTurn || 0;
    const lastCaptureStones = game.diceLastCaptureStones || [];

    game.scores[playerId] = (game.scores[playerId] || 0) + totalCapturesThisTurn;
    game.stonesToPlace = 0;
    
    const whiteStonesLeft = game.boardState.flat().filter(s => s === Player.White).length;

    if (whiteStonesLeft === 0) {
        if (totalCapturesThisTurn > 0) { // Check if the last action was a capture
            const totalRounds = game.settings.diceGoRounds ?? 1;
            const bonus = DICE_GO_LAST_CAPTURE_BONUS_BY_TOTAL_ROUNDS[totalRounds - 1];
            game.scores[playerId] = (game.scores[playerId] || 0) + bonus;
            if (!game.diceGoBonuses) game.diceGoBonuses = {};
            game.diceGoBonuses[playerId] = (game.diceGoBonuses[playerId] || 0) + bonus;

            game.animation = {
                type: 'bonus_score',
                playerId: playerId,
                bonus: bonus,
                startTime: now,
                duration: 3000
            };
        }

        const totalRounds = game.settings.diceGoRounds ?? 3;
        if (game.round >= totalRounds && !game.isDeathmatch) {
            const p1Score = game.scores[game.player1.id] || 0;
            const p2Score = game.scores[game.player2.id] || 0;
            if (p1Score !== p2Score) {
                const winnerId = p1Score > p2Score ? game.player1.id : game.player2.id;
                const winnerEnum = winnerId === game.blackPlayerId ? Player.Black : (winnerId === game.whitePlayerId ? Player.White : Player.None);
                endGame(game, winnerEnum, WinReason.DiceWin);
                return;
            }
        }
        
        const roundSummary: DiceRoundSummary = {
            round: game.round,
            scores: { ...game.scores }
        };
        if (game.round === 1 && game.diceRollHistory) {
            roundSummary.diceStats = {};
            const playerIds = game.isAiGame ? [humanPlayerId, aiPlayerId] : [game.player1.id, game.player2.id];
            playerIds.forEach(pid => {
                const rolls = game.diceRollHistory![pid] || [];
                const rollCounts: { [roll: number]: number } = {};
                for (const roll of rolls) {
                    rollCounts[roll] = (rollCounts[roll] || 0) + 1;
                }
                roundSummary.diceStats![pid] = {
                    rolls: rollCounts,
                    totalRolls: rolls.length,
                };
            });
        }
        game.diceRoundSummary = roundSummary;
        game.gameStatus = GameStatus.DiceRoundEnd;
        game.revealEndTime = now + 20000;
        if (!game.roundEndConfirmations) game.roundEndConfirmations = {};
        if (game.isAiGame) (game.roundEndConfirmations as any)[aiUserId] = now;

    } else {
        game.lastTurnStones = game.stonesPlacedThisTurn;
        game.stonesPlacedThisTurn = [];
        game.lastMove = null;

        game.currentPlayer = game.currentPlayer === Player.Black ? Player.White : Player.Black;
        game.gameStatus = GameStatus.DiceRolling;
        game.turnDeadline = now + DICE_GO_MAIN_ROLL_TIME * 1000;
        game.turnStartTime = now;
    }
    
    game.diceCapturesThisTurn = 0;
    game.diceLastCaptureStones = [];
}


const handleTimeoutFoul = (game: LiveGameSession, timedOutPlayerId: string, now: number): boolean => {
    if (!game.timeoutFouls) {
        game.timeoutFouls = {};
    }
    game.timeoutFouls[timedOutPlayerId] = (game.timeoutFouls[timedOutPlayerId] || 0) + 1;
    
    const foulPlayer = game.player1.id === timedOutPlayerId ? game.player1 : game.player2;
    game.foulInfo = { message: `${foulPlayer.nickname}님의 타임오버 파울!`, expiry: now + 4000 };

    if (game.timeoutFouls[timedOutPlayerId] >= PLAYFUL_MODE_FOUL_LIMIT) {
        const winnerId = game.player1.id === timedOutPlayerId ? game.player2.id : game.player1.id;
        const winnerEnum = winnerId === game.blackPlayerId ? Player.Black : Player.White;
        endGame(game, winnerEnum, WinReason.FoulLimit);
        return true; // Game ended
    }
    return false; // Game continues
};


const placeRandomWhiteStones = (game: LiveGameSession, count: number) => {
    const { boardSize } = game.settings;
    let placed = 0;
    let attempts = 0;
    while(placed < count && attempts < boardSize * boardSize) {
        const x = Math.floor(Math.random() * boardSize);
        const y = Math.floor(Math.random() * boardSize);
        if (game.boardState[y][x] === Player.None) {
            game.boardState[y][x] = Player.White;
            placed++;
        }
        attempts++;
    }
};

export const initializeDiceGo = (game: LiveGameSession, neg: Negotiation, now: number, p1Guild: Guild | null, p2Guild: Guild | null) => {
    const p1 = game.player1;
    const p2 = game.player2;
    
    game.round = 1;
    game.scores = { [p1.id]: 0, [p2.id]: 0 };
    game.turnInRound = 1;
    game.isDeathmatch = false;
    game.diceCapturesThisTurn = 0;
    game.diceLastCaptureStones = [];
    game.diceRollHistory = { [p1.id]: [], [p2.id]: [] };

    const p1Effects = calculateUserEffects(p1, p1Guild);
    const p2Effects = calculateUserEffects(p2, p2Guild);
    
    game.diceGoItemUses = {
        [p1.id]: { odd: (game.settings.oddDiceCount || 0) + (p1Effects.mythicStatBonuses[MythicStat.DiceGoOddBonus]?.flat || 0), even: game.settings.evenDiceCount || 0 },
        [p2.id]: { odd: (game.settings.oddDiceCount || 0) + (p2Effects.mythicStatBonuses[MythicStat.DiceGoOddBonus]?.flat || 0), even: game.settings.evenDiceCount || 0 }
    };

    placeRandomWhiteStones(game, DICE_GO_INITIAL_WHITE_STONES_BY_ROUND[0]);
    
    if (game.isAiGame) {
        const humanGoesFirst = Math.random() < 0.5;
        game.blackPlayerId = humanGoesFirst ? p1.id : p2.id;
        game.whitePlayerId = humanGoesFirst ? p2.id : p1.id;
        game.currentPlayer = Player.Black;
        game.gameStatus = GameStatus.DiceRolling;
        game.turnDeadline = now + DICE_GO_MAIN_ROLL_TIME * 1000;
        game.turnStartTime = now;
    } else {
        game.gameStatus = GameStatus.DiceTurnRolling;
        game.turnOrderRollReady = { [p1.id]: false, [p2.id]: false };
        game.turnOrderRolls = { [p1.id]: null, [p2.id]: null };
        game.turnOrderRollDeadline = now + DICE_GO_TURN_ROLL_TIME * 1000;
    }
};

export const updateDiceGoState = (game: LiveGameSession, now: number) => {
    if(updateSharedGameState(game, now)) return;

    const p1Id = game.player1.id;
    const p2Id = game.player2.id;
    
    switch(game.gameStatus) {
        case GameStatus.DiceTurnRolling:
            if (game.turnOrderRollDeadline && now > game.turnOrderRollDeadline) {
                if (!game.turnOrderRollReady![p1Id]) game.turnOrderRollReady![p1Id] = true;
                if (!game.turnOrderRollReady![p2Id]) game.turnOrderRollReady![p2Id] = true;
            }
            if (game.turnOrderRollReady![p1Id] && game.turnOrderRollReady![p2Id]) {
                const p1Roll = Math.floor(Math.random() * 6) + 1;
                const p2Roll = Math.floor(Math.random() * 6) + 1;
                game.turnOrderRolls = { [p1Id]: p1Roll, [p2Id]: p2Roll };
                game.animation = { type: 'dice_roll_turn', p1Roll, p2Roll, startTime: now, duration: 1500 };
                game.gameStatus = GameStatus.DiceTurnRollingAnimating;
                game.turnOrderAnimationEndTime = now + 1500;
                game.turnDeadline = undefined;
            }
            break;
        case GameStatus.DiceTurnRollingAnimating:
            if (game.turnOrderAnimationEndTime && now > game.turnOrderAnimationEndTime) {
                const p1Roll = game.turnOrderRolls![p1Id]!;
                const p2Roll = game.turnOrderRolls![p2Id]!;
                if (p1Roll !== p2Roll) {
                    game.turnChooserId = p1Roll > p2Roll ? p1Id : p2Id;
                    game.gameStatus = GameStatus.DiceTurnChoice;
                    game.turnChoiceDeadline = now + DICE_GO_TURN_CHOICE_TIME * 1000;
                    if(game.isAiGame && game.turnChooserId === aiUserId) {
                        game.turnChoices = { [p1Id]: null, [p2Id]: null };
                        (game.turnChoices as any)[aiUserId] = 'first';
                    }
                } else {
                    game.turnOrderRollResult = 'tie';
                    game.turnOrderRollReady = { [p1Id]: false, [p2Id]: false };
                    game.turnOrderRolls = { [p1Id]: null, [p2Id]: null };
                    game.turnOrderRollDeadline = now + 3000 + DICE_GO_TURN_ROLL_TIME * 1000;
                    game.revealEndTime = now + 3000;
                    game.turnOrderRollTies = (game.turnOrderRollTies || 0) + 1;
                }
                game.animation = null;
                game.turnOrderAnimationEndTime = undefined;
            }
            break;
        case GameStatus.DiceTurnChoice:
            if (game.turnChoiceDeadline && now > game.turnChoiceDeadline) {
                const choices = ['first', 'second'] as const;
                if (!game.turnChoices![game.turnChooserId!]) {
                    (game.turnChoices as any)[game.turnChooserId!] = choices[Math.floor(Math.random() * 2)];
                }
            }
             if (game.turnChoices![p1Id] || game.turnChoices![p2Id]) {
                 const chooserChoice = game.turnChoices![p1Id] || game.turnChoices![p2Id];
                 const chooserId = game.turnChooserId!;
                 const otherId = chooserId === p1Id ? p2Id : p1Id;

                 game.blackPlayerId = chooserChoice === 'first' ? chooserId : otherId;
                 game.whitePlayerId = chooserChoice === 'first' ? otherId : chooserId;
                 
                 game.gameStatus = GameStatus.DiceStartConfirmation;
                 game.revealEndTime = now + 10000;
                 game.preGameConfirmations = { [p1Id]: false, [p2Id]: false };
                 if(game.isAiGame) (game.preGameConfirmations as any)[aiUserId] = true;
            }
            break;
        case GameStatus.DiceStartConfirmation: {
            const bothConfirmed = game.preGameConfirmations?.[p1Id] && game.preGameConfirmations?.[p2Id];
            const deadlinePassed = game.revealEndTime && now > game.revealEndTime;
            if (bothConfirmed || deadlinePassed) {
                game.gameStatus = GameStatus.DiceRolling;
                game.currentPlayer = Player.Black;
                game.turnDeadline = now + DICE_GO_MAIN_ROLL_TIME * 1000;
                game.turnStartTime = now;
            }
            break;
        }
        case GameStatus.DiceRolling:
        case GameStatus.DicePlacing:
            if (game.turnDeadline && now > game.turnDeadline) {
                const timedOutPlayerId = game.currentPlayer === Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
                const gameEnded = handlePlayfulTimeoutFoul(game, timedOutPlayerId, now);
                if (gameEnded) return;

                if (game.gameStatus === GameStatus.DicePlacing) {
                     finishPlacingTurn(game, timedOutPlayerId);
                } else {
                     game.currentPlayer = game.currentPlayer === Player.Black ? Player.White : Player.Black;
                     game.gameStatus = GameStatus.DiceRolling;
                     game.turnDeadline = now + DICE_GO_MAIN_ROLL_TIME * 1000;
                     game.turnStartTime = now;
                }
            }
            break;
        case GameStatus.DiceRollingAnimating:
            if (game.animation?.type === 'dice_roll_main' && now > game.animation.startTime + game.animation.duration) {
                game.dice = game.animation.dice;
                game.animation = null;
                game.gameStatus = GameStatus.DicePlacing;
                game.turnDeadline = now + DICE_GO_MAIN_PLACE_TIME * 1000;
                game.turnStartTime = now;
            }
            break;
        case GameStatus.DiceRoundEnd:
            if ((game.roundEndConfirmations?.[p1Id] && game.roundEndConfirmations?.[p2Id]) || (game.revealEndTime && now > game.revealEndTime)) {
                const p1Score = game.scores[p1Id] || 0;
                const p2Score = game.scores[p2Id] || 0;
                const totalRounds = game.settings.diceGoRounds ?? 3;
                
                if (game.round >= totalRounds) {
                     if (p1Score !== p2Score) {
                        const winnerId = p1Score > p2Score ? p1Id : p2Id;
                        const winnerEnum = winnerId === game.blackPlayerId ? Player.Black : Player.White;
                        endGame(game, winnerEnum, WinReason.DiceWin);
                        return;
                     }
                }
                
                game.round++;
                game.isDeathmatch = game.round > totalRounds;
                game.turnInRound = 1;
                game.boardState = Array(game.settings.boardSize).fill(0).map(() => Array(game.settings.boardSize).fill(Player.None));
                placeRandomWhiteStones(game, DICE_GO_INITIAL_WHITE_STONES_BY_ROUND[game.round - 1]);
                
                // Swap who goes first
                game.currentPlayer = game.currentPlayer === Player.Black ? Player.White : Player.Black;
                game.gameStatus = GameStatus.DiceRolling;
                game.turnDeadline = now + DICE_GO_MAIN_ROLL_TIME * 1000;
                game.turnStartTime = now;
            }
            break;
    }
};

export const handleDiceGoAction = async (volatileState: VolatileState, game: LiveGameSession, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult | null> => {
    const { type, payload } = action;
    const now = Date.now();
    const myPlayerEnum = user.id === game.blackPlayerId ? Player.Black : (user.id === game.whitePlayerId ? Player.White : Player.None);
    const isMyTurn = myPlayerEnum === game.currentPlayer;
    
    // FIX: Pass 'volatileState' to handleSharedAction.
    const sharedResult = await handleSharedAction(volatileState, game, action, user);
    if(sharedResult) return sharedResult;

    switch(type) {
        case 'DICE_READY_FOR_TURN_ROLL':
            if (game.gameStatus !== GameStatus.DiceTurnRolling) return { error: 'Not in turn roll phase.' };
            if (!game.turnOrderRollReady) game.turnOrderRollReady = {};
            game.turnOrderRollReady[user.id] = true;
            return {};
        case 'DICE_CHOOSE_TURN':
            if (game.gameStatus !== GameStatus.DiceTurnChoice || game.turnChooserId !== user.id) return { error: 'Not your turn to choose.' };
            if (!game.turnChoices) game.turnChoices = {};
            (game.turnChoices as any)[user.id] = payload.choice;
            return {};
        case 'DICE_CONFIRM_START':
            if (game.gameStatus !== GameStatus.DiceStartConfirmation) return { error: "Not in confirmation phase." };
            if (!game.preGameConfirmations) game.preGameConfirmations = {};
            game.preGameConfirmations[user.id] = true;
            return {};
        case 'DICE_ROLL': {
            if (!isMyTurn || game.gameStatus !== GameStatus.DiceRolling) return { error: "Not your turn to roll." };
            
            let diceRoll: number;
            if (payload.itemType) {
                const itemKey = payload.itemType as 'odd' | 'even';
                if (!game.diceGoItemUses || !(game.diceGoItemUses as any)[user.id] || (game.diceGoItemUses as any)[user.id][itemKey] <= 0) {
                    return { error: "아이템이 없습니다." };
                }
                (game.diceGoItemUses as any)[user.id][itemKey]--;

                if (itemKey === 'odd') {
                    diceRoll = [1, 3, 5][Math.floor(Math.random() * 3)];
                } else {
                    diceRoll = [2, 4, 6][Math.floor(Math.random() * 3)];
                }
            } else {
                diceRoll = Math.floor(Math.random() * 6) + 1;
            }

            const goLogic = getGoLogic(game);
            const liberties = goLogic.getAllLibertiesOfPlayer(Player.White, game.boardState);
            const isOvershot = liberties.length > 0 && diceRoll > liberties.length;

            game.stonesToPlace = isOvershot ? -1 : diceRoll;
            game.animation = { type: 'dice_roll_main', dice: { dice1: diceRoll, dice2: 0, dice3: 0 }, startTime: now, duration: 1500 };
            game.gameStatus = GameStatus.DiceRollingAnimating;
            game.turnDeadline = undefined;
            if(!game.diceRollHistory) game.diceRollHistory = {};
            if(!(game.diceRollHistory as any)[user.id]) (game.diceRollHistory as any)[user.id] = [];
            (game.diceRollHistory as any)[user.id].push(diceRoll);

            return {};
        }
        case 'DICE_PLACE_STONE': {
            if (!isMyTurn || game.gameStatus !== GameStatus.DicePlacing) return { error: "Not your turn to place."};
            if ((game.stonesToPlace ?? 0) <= 0) return { error: "No stones left to place."};
            
            const { x, y } = payload;
            const goLogic = getGoLogic(game);
            const liberties = goLogic.getAllLibertiesOfPlayer(Player.White, game.boardState);
            
            if (liberties.length > 0 && !liberties.some(p => p.x === x && p.y === y)) {
                return { error: '백돌의 활로에만 놓을 수 있습니다.' };
            }
            
            const move = { x, y, player: Player.Black }; // In Dice Go, players only place black stones
            const result = processMove(game.boardState, move, game.koInfo, game.moveHistory.length, { ignoreSuicide: true });

            if (!result.isValid) return { error: `Invalid move: ${result.reason}` };

            game.boardState = result.newBoardState;
            game.koInfo = result.newKoInfo;
            if(!game.stonesPlacedThisTurn) game.stonesPlacedThisTurn = [];
            game.stonesPlacedThisTurn.push({x, y});

            if (result.capturedStones.length > 0) {
                game.diceCapturesThisTurn = (game.diceCapturesThisTurn || 0) + result.capturedStones.length;
                game.diceLastCaptureStones = result.capturedStones;
            }

            game.stonesToPlace = (game.stonesToPlace ?? 1) - 1;

            if (game.stonesToPlace === 0) {
                finishPlacingTurn(game, user.id);
            }
            return {};
        }
        case 'CONFIRM_ROUND_END':
            if (game.gameStatus !== GameStatus.DiceRoundEnd) return { error: "라운드 종료 확인 단계가 아닙니다."};
            if (!game.roundEndConfirmations) game.roundEndConfirmations = {};
            game.roundEndConfirmations[user.id] = now;
            return {};
    }
    
    return null;
};

export const makeDiceGoAiMove = async (game: LiveGameSession): Promise<void> => {
    const aiId = game.player2.id;
    if (game.currentPlayer !== (game.whitePlayerId === aiId ? Player.White : Player.Black)) return;

    if (game.gameStatus === GameStatus.DiceRolling) {
        const diceRoll = Math.floor(Math.random() * 6) + 1;
        const logic = getGoLogic(game);
        const liberties = logic.getAllLibertiesOfPlayer(Player.White, game.boardState);
        game.stonesToPlace = liberties.length > 0 && diceRoll > liberties.length ? -1 : diceRoll;
        game.animation = { type: 'dice_roll_main', dice: { dice1: diceRoll, dice2: 0, dice3: 0 }, startTime: Date.now(), duration: 1500 };
        game.gameStatus = GameStatus.DiceRollingAnimating;
    } else if (game.gameStatus === GameStatus.DicePlacing) {
        if ((game.stonesToPlace ?? 0) <= 0) {
            finishPlacingTurn(game, aiId);
            return;
        }

        const logic = getGoLogic(game);
        const liberties = logic.getAllLibertiesOfPlayer(Player.White, game.boardState);
        if (liberties.length > 0) {
            const move = liberties[Math.floor(Math.random() * liberties.length)];
            const result = processMove(game.boardState, { ...move, player: game.currentPlayer }, game.koInfo, game.moveHistory.length, { ignoreSuicide: true });
            if (result.isValid) {
                game.boardState = result.newBoardState;
                game.koInfo = result.newKoInfo;
                if (result.capturedStones.length > 0) {
                    game.diceCapturesThisTurn = (game.diceCapturesThisTurn || 0) + result.capturedStones.length;
                    game.diceLastCaptureStones = result.capturedStones;
                }
            }
        }
        game.stonesToPlace = (game.stonesToPlace ?? 1) - 1;
    }
};
