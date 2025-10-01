import { type LiveGameSession, type Point, type DiceRoundSummary, Player, type Negotiation, type VolatileState, type ServerAction, type HandleActionResult, type User, GameMode, MythicStat, GameStatus, WinReason, RPSChoice, Guild } from '../../types/index.js';
import * as db from '../db.js';
import { getGoLogic, processMove } from '../../utils/goLogic.js';
import { handleSharedAction, updateSharedGameState, handleTimeoutFoul as handlePlayfulTimeoutFoul } from './shared.js';
import { aiUserId } from '../ai/index.js';
import { DICE_GO_MAIN_PLACE_TIME, DICE_GO_MAIN_ROLL_TIME, DICE_GO_TURN_CHOICE_TIME, DICE_GO_TURN_ROLL_TIME, PLAYFUL_MODE_FOUL_LIMIT } from '../../constants/index.js';
import * as effectService from '../services/effectService.js';
import { endGame, processGameSummary } from '../summaryService.js';

export function finishThiefPlacingTurn(game: LiveGameSession, userId: string) {
    const now = Date.now();
    const p1Id = game.player1.id;
    const p2Id = game.player2.id;
    
    game.turnInRound = (game.turnInRound || 0) + 1;
    const totalTurnsInRound = 10;
    const allThievesCaptured = !game.boardState.flat().includes(Player.Black);

    if (game.turnInRound > totalTurnsInRound || allThievesCaptured) {
        const finalThiefStonesLeft = game.boardState.flat().filter(s => s === Player.Black).length;
        const capturesThisRound = game.thiefCapturesThisRound || 0;
        
        game.scores[game.thiefPlayerId!] = (game.scores[game.thiefPlayerId!] || 0) + finalThiefStonesLeft;
        game.scores[game.policePlayerId!] = (game.scores[game.policePlayerId!] || 0) + capturesThisRound;
        
        const p1IsThief = game.player1.id === game.thiefPlayerId;

        game.thiefRoundSummary = {
            round: game.round,
            isDeathmatch: !!game.isDeathmatch,
            player1: {
                id: p1Id,
                role: p1IsThief ? 'thief' : 'police',
                roundScore: p1IsThief ? finalThiefStonesLeft : capturesThisRound,
                cumulativeScore: game.scores[p1Id] ?? 0,
            },
            player2: {
                id: p2Id,
                role: !p1IsThief ? 'thief' : 'police',
                roundScore: !p1IsThief ? finalThiefStonesLeft : capturesThisRound,
                cumulativeScore: game.scores[game.player2.id] ?? 0,
            }
        };

        const totalRounds = 2;
        if (game.round >= totalRounds && !game.isDeathmatch && game.scores[p1Id] !== game.scores[p2Id]) {
            const winnerId = game.scores[p1Id]! > game.scores[game.player2.id]! ? p1Id : p2Id;
            const winnerEnum = winnerId === game.blackPlayerId ? Player.Black : (winnerId === game.whitePlayerId ? Player.White : Player.None);
            endGame(game, winnerEnum, WinReason.TotalScore);
            return;
        }
        
        game.gameStatus = GameStatus.ThiefRoundEnd;
        game.revealEndTime = now + 20000;
        game.roundEndConfirmations = { [game.player1.id]: 0, [game.player2.id]: 0 };
    } else {
        game.currentPlayer = game.currentPlayer === Player.Black ? Player.White : Player.Black;
        game.gameStatus = GameStatus.ThiefRolling;
        game.turnDeadline = now + DICE_GO_MAIN_ROLL_TIME * 1000;
        game.turnStartTime = now;
    }
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

export const initializeThief = (game: LiveGameSession, neg: Negotiation, now: number, p1Guild: Guild | null, p2Guild: Guild | null) => {
    const p1 = game.player1;
    const p2 = game.player2;
    
    // Shared properties for both AI and PvP
    game.round = 1;
    game.scores = { [p1.id]: 0, [p2.id]: 0 };
    game.turnInRound = 1;
    game.thiefCapturesThisRound = 0;
    game.thiefDiceRollHistory = { [p1.id]: [], [p2.id]: [] };
    game.timeoutFouls = { [p1.id]: 0, [p2.id]: 0 };
    game.blackTimeLeft = DICE_GO_MAIN_ROLL_TIME;
    game.whiteTimeLeft = DICE_GO_MAIN_ROLL_TIME;
    game.isDeathmatch = false;
    game.thiefPlayerId = undefined;
    game.policePlayerId = undefined;
    game.thiefRoundSummary = undefined;
    game.dice = undefined;


    if (game.isAiGame) {
        // AI logic
        game.thiefPlayerId = p1.id;
        game.policePlayerId = p2.id;
        game.blackPlayerId = game.thiefPlayerId;
        game.whitePlayerId = game.policePlayerId;
        game.gameStatus = GameStatus.ThiefRolling;
        game.currentPlayer = Player.Black; // Thief always starts
        game.turnDeadline = now + DICE_GO_MAIN_ROLL_TIME * 1000;
        game.turnStartTime = now;
        game.preGameConfirmations = {};
        game.roleChoices = {};
    } else {
        // PvP logic
        game.blackPlayerId = null;
        game.whitePlayerId = null;
        game.gameStatus = GameStatus.ThiefRoleSelection;
        game.roleChoices = { [p1.id]: null, [p2.id]: null };
        game.turnChoiceDeadline = now + 30000; // 30s
        game.currentPlayer = Player.None;
        game.preGameConfirmations = {};
    }
};

export const updateThiefState = (game: LiveGameSession, now: number) => {
    const p1Id = game.player1.id;
    const p2Id = game.player2.id;
    
    if (game.gameStatus === GameStatus.ThiefRolling || game.gameStatus === GameStatus.ThiefPlacing) {
        if (game.turnDeadline && now > game.turnDeadline) {
            const timedOutPlayerId = game.currentPlayer === Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
            const gameEnded = handlePlayfulTimeoutFoul(game, timedOutPlayerId, now);
            if (gameEnded) return;

            if (game.gameStatus === GameStatus.ThiefPlacing) {
                 finishThiefPlacingTurn(game, timedOutPlayerId);
            } else {
                 game.currentPlayer = game.currentPlayer === Player.Black ? Player.White : Player.Black;
                 game.gameStatus = GameStatus.ThiefRolling;
                 game.turnDeadline = now + DICE_GO_MAIN_ROLL_TIME * 1000;
                 game.turnStartTime = now;
            }
        }
    }

    switch(game.gameStatus) {
        case GameStatus.ThiefRoleSelection: {
            const deadlinePassed = game.turnChoiceDeadline && now > game.turnChoiceDeadline;

            if (deadlinePassed) {
                // If deadline passes, finalize choices for any player who hasn't chosen
                const p1Choice = game.roleChoices?.[p1Id];
                const p2Choice = game.roleChoices?.[p2Id];
                const choices = ['thief', 'police'] as const;

                if (!p1Choice) {
                    game.roleChoices![p1Id] = choices[Math.floor(Math.random() * 2)];
                }
                if (!p2Choice) {
                    game.roleChoices![p2Id] = choices[Math.floor(Math.random() * 2)];
                }
            }

            const finalP1Choice = game.roleChoices?.[p1Id];
            const finalP2Choice = game.roleChoices?.[p2Id];

            // If both players have made a choice (either manually or by timeout), proceed
            if (finalP1Choice && finalP2Choice) {
                game.turnChoiceDeadline = undefined; // Stop the timer

                if (finalP1Choice === finalP2Choice) {
                    game.gameStatus = GameStatus.ThiefRps;
                    game.rpsState = { [p1Id]: null, [p2Id]: null };
                    game.rpsRound = 1;
                    game.turnDeadline = now + 30000; // RPS timeout
                } else {
                    // Assign roles based on different choices
                    if (finalP1Choice === 'thief') {
                        game.thiefPlayerId = p1Id;
                        game.policePlayerId = p2Id;
                    } else {
                        game.thiefPlayerId = p2Id;
                        game.policePlayerId = p1Id;
                    }
                    game.blackPlayerId = game.thiefPlayerId ?? null;
                    game.whitePlayerId = game.policePlayerId ?? null;
                    game.gameStatus = GameStatus.ThiefRoleConfirmed;
                    game.revealEndTime = now + 10000;
                    game.preGameConfirmations = { [p1Id]: false, [p2Id]: false };
                }
            }
            break;
        }
        case GameStatus.ThiefRpsReveal: {
            const p1Choice = game.rpsState?.[p1Id];
            const p2Choice = game.rpsState?.[p2Id];

            if (p1Choice && p2Choice) {
                let winnerId: string;
                if (p1Choice === p2Choice) {
                    winnerId = Math.random() < 0.5 ? p1Id : p2Id;
                } else {
                    const p1Wins = (p1Choice === RPSChoice.Rock && p2Choice === RPSChoice.Scissors) ||
                                       (p1Choice === RPSChoice.Scissors && p2Choice === RPSChoice.Paper) ||
                                       (p1Choice === RPSChoice.Paper && p2Choice === RPSChoice.Rock);
                    winnerId = p1Wins ? p1Id : p2Id;
                }
                
                const loserId = winnerId === p1Id ? p2Id : p1Id;
                
                if (!game.roleChoices) {
                    console.error(`[Thief] Missing roleChoices during RPS reveal for game ${game.id}. Assigning random roles.`);
                    game.roleChoices = {};
                    (game.roleChoices as any)[winnerId] = Math.random() < 0.5 ? 'thief' : 'police';
                }

                const winnerChoice = game.roleChoices[winnerId]!;
                
                if(winnerChoice === 'thief') {
                    game.thiefPlayerId = winnerId;
                    game.policePlayerId = loserId;
                } else {
                    game.policePlayerId = winnerId;
                    game.thiefPlayerId = loserId;
                }
                
                game.blackPlayerId = game.thiefPlayerId ?? null;
                game.whitePlayerId = game.policePlayerId ?? null;
                game.gameStatus = GameStatus.ThiefRoleConfirmed;
                game.revealEndTime = now + 10000;
                game.preGameConfirmations = { [p1Id]: false, [p2Id]: false };
            }
            break;
        }
        case GameStatus.ThiefRoleConfirmed: {
            if (game.isAiGame) {
                if (!game.preGameConfirmations) game.preGameConfirmations = {};
                (game.preGameConfirmations as any)[aiUserId] = true;
            }
            const bothConfirmed = game.preGameConfirmations?.[p1Id] && game.preGameConfirmations?.[p2Id];
            const deadlinePassed = game.revealEndTime && now > game.revealEndTime;
            if (bothConfirmed || deadlinePassed) {
                game.gameStatus = GameStatus.ThiefRolling;
                game.currentPlayer = Player.Black; // Thief always starts
                game.turnDeadline = now + DICE_GO_MAIN_ROLL_TIME * 1000;
                game.turnStartTime = now;
                
                game.preGameConfirmations = {};
                game.revealEndTime = undefined;
            }
            break;
        }
        case GameStatus.ThiefRollingAnimating: {
            const animation = game.animation;
            if (animation && animation.type === 'dice_roll_main' && now > animation.startTime + animation.duration) {
                game.dice = animation.dice;
                game.animation = null;
                game.gameStatus = GameStatus.ThiefPlacing;
                game.turnDeadline = now + DICE_GO_MAIN_PLACE_TIME * 1000;
                game.turnStartTime = now;
            }
            break;
        }
        case GameStatus.ThiefRoundEnd: {
            if ((game.roundEndConfirmations?.[p1Id] && game.roundEndConfirmations?.[p2Id]) || (game.revealEndTime && now > game.revealEndTime)) {
                const p1Score = game.scores[p1Id] || 0;
                const p2Score = game.scores[p2Id] || 0;
                const totalRounds = 2;
                
                if ((game.round >= totalRounds && p1Score !== p2Score) || game.isDeathmatch) {
                     if (p1Score !== p2Score) {
                        const winnerId = p1Score > p2Score ? p1Id : p2Id;
                        const winnerEnum = winnerId === game.blackPlayerId ? Player.Black : Player.White;
                        endGame(game, winnerEnum, WinReason.TotalScore);
                        return;
                     }
                }
                
                game.round++;
                game.isDeathmatch = game.round > totalRounds;
                game.turnInRound = 1;
                game.boardState = Array(game.settings.boardSize).fill(0).map(() => Array(game.settings.boardSize).fill(Player.None));
                game.thiefCapturesThisRound = 0;
                
                // Swap roles
                const oldThiefId = game.thiefPlayerId;
                game.thiefPlayerId = game.policePlayerId;
                game.policePlayerId = oldThiefId;
                game.blackPlayerId = game.thiefPlayerId ?? null;
                game.whitePlayerId = game.policePlayerId ?? null;

                game.currentPlayer = Player.Black;
                game.gameStatus = GameStatus.ThiefRolling;
                game.turnDeadline = now + DICE_GO_MAIN_ROLL_TIME * 1000;
                game.turnStartTime = now;
            }
            break;
        }
    }
};

export const handleThiefAction = async (volatileState: VolatileState, game: LiveGameSession, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult | null> => {
    const { type, payload } = action;
    const now = Date.now();
    const myPlayerEnum = user.id === game.blackPlayerId ? Player.Black : (user.id === game.whitePlayerId ? Player.White : Player.None);
    const isMyTurn = myPlayerEnum === game.currentPlayer;
    
    const sharedResult = await handleSharedAction(volatileState, game, action, user);
    if(sharedResult) return sharedResult;

    switch(type) {
        case 'THIEF_UPDATE_ROLE_CHOICE': {
            if (game.gameStatus !== GameStatus.ThiefRoleSelection || !game.roleChoices || typeof game.roleChoices[user.id] === 'string') {
                return { error: 'Cannot choose role now.' };
            }
            game.roleChoices[user.id] = payload.choice;
            return {};
        }
        case 'CONFIRM_THIEF_ROLE': {
            if (game.gameStatus !== GameStatus.ThiefRoleConfirmed) return { error: "Not in confirmation phase." };
            if (!game.preGameConfirmations) game.preGameConfirmations = {};
            game.preGameConfirmations[user.id] = true;
            return {};
        }
        case 'THIEF_ROLL_DICE': {
            if (!isMyTurn || game.gameStatus !== GameStatus.ThiefRolling) return { error: "Not your turn to roll." };
            const myRole = user.id === game.thiefPlayerId ? 'thief' : 'police';
            const diceCount = myRole === 'thief' ? 1 : 2;
            
            const dice1 = Math.floor(Math.random() * 6) + 1;
            const dice2 = diceCount === 2 ? Math.floor(Math.random() * 6) + 1 : 0;

            game.stonesToPlace = dice1 + dice2;
            game.animation = { type: 'dice_roll_main', dice: { dice1, dice2, dice3: 0 }, startTime: now, duration: 1500 };
            game.gameStatus = GameStatus.ThiefRollingAnimating;
            game.turnDeadline = undefined;
            return {};
        }
        case 'THIEF_PLACE_STONE': {
            if (!isMyTurn || game.gameStatus !== GameStatus.ThiefPlacing) return { error: "Not your turn to place."};
            if ((game.stonesToPlace ?? 0) <= 0) return { error: "No stones left to place."};
            
            const { x, y } = payload;
            const goLogic = getGoLogic(game);
            const myRole = user.id === game.thiefPlayerId ? 'thief' : 'police';
            let liberties: Point[];

            if (myRole === 'thief') {
                const noBlackStonesOnBoard = !game.boardState.flat().includes(Player.Black);
                if (game.turnInRound === 1 || noBlackStonesOnBoard) {
                    liberties = [];
                     for (let i = 0; i < game.settings.boardSize; i++) for (let j = 0; j < game.settings.boardSize; j++) if (game.boardState[i][j] === Player.None) liberties.push({x:j, y:i});
                } else {
                    liberties = goLogic.getAllLibertiesOfPlayer(Player.Black, game.boardState);
                }
            } else { // police
                liberties = goLogic.getAllLibertiesOfPlayer(Player.Black, game.boardState);
            }

            if (liberties.length > 0 && !liberties.some(p => p.x === x && p.y === y)) {
                return { error: 'Invalid placement.' };
            }
            
            const move = { x, y, player: myPlayerEnum };
            const result = processMove(game.boardState, move, game.koInfo, game.moveHistory.length, { ignoreSuicide: true });

            if (!result.isValid) return { error: `Invalid move: ${result.reason}` };

            game.boardState = result.newBoardState;
            if (myRole === 'police' && result.capturedStones.length > 0) {
                game.thiefCapturesThisRound = (game.thiefCapturesThisRound || 0) + result.capturedStones.length;
            }

            game.stonesToPlace = (game.stonesToPlace ?? 1) - 1;

            if (game.stonesToPlace === 0) {
                finishThiefPlacingTurn(game, user.id);
            }
            return {};
        }
         case 'CONFIRM_ROUND_END':
            if (game.gameStatus !== GameStatus.ThiefRoundEnd) return { error: "라운드 종료 확인 단계가 아닙니다."};
            if (!game.roundEndConfirmations) game.roundEndConfirmations = {};
            game.roundEndConfirmations[user.id] = now;
            return {};
    }
    
    return null;
};

export const makeThiefGoAiMove = async (game: LiveGameSession): Promise<void> => {
    const aiId = game.player2.id;
    const myPlayerEnum = game.whitePlayerId === aiId ? Player.White : Player.Black;
    if (game.currentPlayer !== myPlayerEnum) return;
    
    const myRole = aiId === game.thiefPlayerId ? 'thief' : 'police';

    if (game.gameStatus === GameStatus.ThiefRolling) {
        const diceCount = myRole === 'thief' ? 1 : 2;
        const dice1 = Math.floor(Math.random() * 6) + 1;
        const dice2 = diceCount === 2 ? Math.floor(Math.random() * 6) + 1 : 0;
        game.stonesToPlace = dice1 + dice2;
        game.animation = { type: 'dice_roll_main', dice: { dice1, dice2, dice3: 0 }, startTime: Date.now(), duration: 1500 };
        game.gameStatus = GameStatus.ThiefRollingAnimating;
    } else if (game.gameStatus === GameStatus.ThiefPlacing) {
        if ((game.stonesToPlace ?? 0) <= 0) {
            finishThiefPlacingTurn(game, aiId);
            return;
        }

        const logic = getGoLogic(game);
        let liberties: Point[];
        if (myRole === 'thief') {
            const noBlackStonesOnBoard = !game.boardState.flat().includes(Player.Black);
            if (game.turnInRound === 1 || noBlackStonesOnBoard) {
                liberties = [];
                for (let y = 0; y < game.settings.boardSize; y++) {
                    for (let x = 0; x < game.settings.boardSize; x++) {
                        if (game.boardState[y][x] === Player.None) liberties.push({ x, y });
                    }
                }
            } else {
                liberties = logic.getAllLibertiesOfPlayer(Player.Black, game.boardState);
            }
        } else { // police
            liberties = logic.getAllLibertiesOfPlayer(Player.Black, game.boardState);
        }

        if (liberties.length > 0) {
            const move = liberties[Math.floor(Math.random() * liberties.length)];
            const result = processMove(game.boardState, { ...move, player: myPlayerEnum }, game.koInfo, game.moveHistory.length, { ignoreSuicide: true });
            if (result.isValid) {
                game.boardState = result.newBoardState;
                if (myRole === 'police' && result.capturedStones.length > 0) {
                    game.thiefCapturesThisRound = (game.thiefCapturesThisRound || 0) + result.capturedStones.length;
                }
            }
        }
        
        game.stonesToPlace = (game.stonesToPlace ?? 1) - 1;
    }
};