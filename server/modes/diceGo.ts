





import { type LiveGameSession, type Point, type DiceRoundSummary, Player, type Negotiation, type ServerAction, type HandleActionResult, type User, GameMode, MythicStat, GameStatus, WinReason, RPSChoice, Guild } from '../../types/index.js';
import * as db from '../db.js';
import { getGoLogic, processMove } from '../../utils/goLogic.js';
import { handleSharedAction, updateSharedGameState, handleTimeoutFoul as handlePlayfulTimeoutFoul } from './shared.js';
import { aiUserId } from '../ai/index.js';
import { DICE_GO_INITIAL_WHITE_STONES_BY_ROUND, DICE_GO_LAST_CAPTURE_BONUS_BY_TOTAL_ROUNDS, DICE_GO_MAIN_PLACE_TIME, DICE_GO_MAIN_ROLL_TIME, DICE_GO_TURN_CHOICE_TIME, DICE_GO_TURN_ROLL_TIME, PLAYFUL_MODE_FOUL_LIMIT } from '../../constants/index.js';
import { calculateUserEffects } from '../../utils/statUtils.js';
import { endGame, getGameResult } from '../summaryService.js';
import { broadcast } from '../services/supabaseService.js';

export async function finishPlacingTurn(game: LiveGameSession, playerId: string) {
    const now = Date.now();
    const humanPlayerId = game.player1.id === aiUserId ? game.player2.id : game.player1.id;
    const aiPlayerId = game.player1.id === aiUserId ? game.player1.id : game.player2.id;

    const totalCapturesThisTurn = game.diceCapturesThisTurn || 0;

    game.scores[playerId] = (game.scores[playerId] || 0) + totalCapturesThisTurn;
    game.stonesToPlace = 0;
    
    const whiteStonesLeft = game.boardState.flat().filter(s => s === Player.White).length;

    if (whiteStonesLeft === 0) {
        if (totalCapturesThisTurn > 0) {
            const totalRounds = game.settings.diceGoRounds ?? 1;
            const bonus = DICE_GO_LAST_CAPTURE_BONUS_BY_TOTAL_ROUNDS[totalRounds - 1];
            game.scores[playerId] = (game.scores[playerId] || 0) + bonus;
            if (!game.diceGoBonuses) game.diceGoBonuses = {};
            game.diceGoBonuses[playerId] = (game.diceGoBonuses[playerId] || 0) + bonus;
            game.animation = { type: 'bonus_score', playerId: playerId, bonus: bonus, startTime: now, duration: 3000 };
        }

        const totalRounds = game.settings.diceGoRounds ?? 3;
        if (game.round >= totalRounds && !game.isDeathmatch) {
            const p1Score = game.scores[game.player1.id] || 0;
            const p2Score = game.scores[game.player2.id] || 0;
            if (p1Score !== p2Score) {
                const winnerId = p1Score > p2Score ? game.player1.id : game.player2.id;
                const winnerEnum = winnerId === game.blackPlayerId ? Player.Black : (winnerId === game.whitePlayerId ? Player.White : Player.None);
                await endGame(game, winnerEnum, WinReason.DiceWin);
                return;
            }
        }
        
        const roundSummary: DiceRoundSummary = { round: game.round, scores: { ...game.scores } };
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

// ... (other helper functions like placeRandomWhiteStones remain the same)

export const initializeDiceGo = (game: LiveGameSession, neg: Negotiation, now: number, p1Guild: Guild | null, p2Guild: Guild | null) => {
    // ... (implementation unchanged)
};

export const updateDiceGoState = (game: LiveGameSession, now: number) => {
    // This logic will be triggered by a cron job
    if(updateSharedGameState(game, now)) return;
    // ... (rest of the implementation unchanged)
};

export const handleDiceGoAction = async (game: LiveGameSession, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult | null> => {
    const { type, payload } = action;
    const now = Date.now();
    const myPlayerEnum = user.id === game.blackPlayerId ? Player.Black : (user.id === game.whitePlayerId ? Player.White : Player.None);
    const isMyTurn = myPlayerEnum === game.currentPlayer;
    
    const sharedResult = await handleSharedAction(game, action, user);
    if(sharedResult) {
        await db.saveGame(game);
        await broadcast({ type: 'GAME_STATE_UPDATE', payload: { updatedGame: game } });
        return sharedResult;
    }

    switch(type) {
        case 'DICE_READY_FOR_TURN_ROLL':
            if (game.gameStatus !== GameStatus.DiceTurnRolling) return { error: 'Not in turn roll phase.' };
            if (!game.turnOrderRollReady) game.turnOrderRollReady = {};
            game.turnOrderRollReady[user.id] = true;
            break;
        case 'DICE_CHOOSE_TURN':
            if (game.gameStatus !== GameStatus.DiceTurnChoice || game.turnChooserId !== user.id) return { error: 'Not your turn to choose.' };
            if (!game.turnChoices) game.turnChoices = {};
            (game.turnChoices as any)[user.id] = payload.choice;
            break;
        case 'DICE_CONFIRM_START':
            if (game.gameStatus !== GameStatus.DiceStartConfirmation) return { error: "Not in confirmation phase." };
            if (!game.preGameConfirmations) game.preGameConfirmations = {};
            game.preGameConfirmations[user.id] = true;
            break;
        case 'DICE_ROLL': {
            if (!isMyTurn || game.gameStatus !== GameStatus.DiceRolling) return { error: "Not your turn to roll." };
            
            let diceRoll: number;
            if (payload.itemType) {
                // ... item logic ...
            } else {
                diceRoll = Math.floor(Math.random() * 6) + 1;
            }

            const goLogic = getGoLogic(game.settings);
            const liberties = goLogic.getAllLibertiesOfPlayer(Player.White, game.boardState);
            const isOvershot = liberties.length > 0 && diceRoll > liberties.length;

            game.stonesToPlace = isOvershot ? -1 : diceRoll;
            game.animation = { type: 'dice_roll_main', dice: { dice1: diceRoll, dice2: 0, dice3: 0 }, startTime: now, duration: 1500 };
            game.gameStatus = GameStatus.DiceRollingAnimating;
            game.turnDeadline = undefined;
            if(!game.diceRollHistory) game.diceRollHistory = {};
            if(!(game.diceRollHistory as any)[user.id]) (game.diceRollHistory as any)[user.id] = [];
            (game.diceRollHistory as any)[user.id].push(diceRoll);
            break;
        }
        case 'DICE_PLACE_STONE': {
            if (!isMyTurn || game.gameStatus !== GameStatus.DicePlacing) return { error: "Not your turn to place."};
            if ((game.stonesToPlace ?? 0) <= 0) return { error: "No stones left to place."};
            
            const { x, y } = payload;
            const goLogic = getGoLogic(game.settings);
            const liberties = goLogic.getAllLibertiesOfPlayer(Player.White, game.boardState);
            
            if (liberties.length > 0 && !liberties.some(p => p.x === x && p.y === y)) {
                return { error: '백돌의 활로에만 놓을 수 있습니다.' };
            }
            
            const move = { x, y, player: Player.Black };
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
                await finishPlacingTurn(game, user.id);
            }
            break;
        }
        case 'CONFIRM_ROUND_END':
            if (game.gameStatus !== GameStatus.DiceRoundEnd) return { error: "라운드 종료 확인 단계가 아닙니다."};
            if (!game.roundEndConfirmations) game.roundEndConfirmations = {};
            game.roundEndConfirmations[user.id] = now;
            break;
    }
    
    await db.saveGame(game);
    await broadcast({ type: 'GAME_STATE_UPDATE', payload: { updatedGame: game } });

    return null;
};

export const makeDiceGoAiMove = async (game: LiveGameSession): Promise<void> => {
    // ... (implementation unchanged)
};
