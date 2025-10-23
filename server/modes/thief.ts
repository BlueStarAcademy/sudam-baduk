





import { type LiveGameSession, type Point, Player, type Negotiation, type ServerAction, type HandleActionResult, type User, GameMode, GameStatus, WinReason, RPSChoice, Guild } from '../../types/index.js';






import * as db from '../db.js';






import { getGoLogic, processMove } from '../../utils/goLogic.js';






import { handleSharedAction, updateSharedGameState, handleTimeoutFoul as handlePlayfulTimeoutFoul } from './shared.js';






import { aiUserId } from '../ai/index.js';






import { DICE_GO_MAIN_ROLL_TIME, DICE_GO_MAIN_PLACE_TIME } from '../../constants/index.js';






import { endGame, processGameSummary } from '../summaryService.js';






import { broadcast } from '../services/supabaseService.js';













export async function finishThiefPlacingTurn(game: LiveGameSession, userId: string) {






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






            player1: { id: p1Id, role: p1IsThief ? 'thief' : 'police', roundScore: p1IsThief ? finalThiefStonesLeft : capturesThisRound, cumulativeScore: game.scores[p1Id] ?? 0 },






            player2: { id: p2Id, role: !p1IsThief ? 'thief' : 'police', roundScore: !p1IsThief ? finalThiefStonesLeft : capturesThisRound, cumulativeScore: game.scores[game.player2.id] ?? 0 }






        };













        const totalRounds = 2;






        if (game.round >= totalRounds && !game.isDeathmatch && game.scores[p1Id] !== game.scores[p2Id]) {






            const winnerId = game.scores[p1Id]! > game.scores[game.player2.id]! ? p1Id : p2Id;






            const winnerEnum = winnerId === game.blackPlayerId ? Player.Black : (winnerId === game.whitePlayerId ? Player.White : Player.None);






            await endGame(game, winnerEnum, WinReason.TotalScore);






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













// ... (other helper functions like initializeThief, placeRandomWhiteStones remain the same)













export const initializeThief = (game: LiveGameSession, neg: Negotiation, now: number, p1Guild: Guild | null, p2Guild: Guild | null) => {






    // ... (implementation unchanged)






};













export const updateThiefState = (game: LiveGameSession, now: number) => {






    // This logic will be triggered by a cron job






    // ... (implementation unchanged)






};













export const handleThiefAction = async (game: LiveGameSession, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult | null> => {






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






        case 'THIEF_UPDATE_ROLE_CHOICE': {






            if (game.gameStatus !== GameStatus.ThiefRoleSelection || !game.roleChoices || typeof game.roleChoices[user.id] === 'string') {






                return { error: 'Cannot choose role now.' };






            }






            game.roleChoices[user.id] = payload.choice;






            break;






        }






        case 'CONFIRM_THIEF_ROLE': {






            if (game.gameStatus !== GameStatus.ThiefRoleConfirmed) return { error: "Not in confirmation phase." };






            if (!game.preGameConfirmations) game.preGameConfirmations = {};






            game.preGameConfirmations[user.id] = true;






            break;






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






            break;






        }






        case 'THIEF_PLACE_STONE': {






            if (!isMyTurn || game.gameStatus !== GameStatus.ThiefPlacing) return { error: "Not your turn to place."};






            if ((game.stonesToPlace ?? 0) <= 0) return { error: "No stones left to place." };






            






            const { x, y } = payload;






            const goLogic = getGoLogic(game.settings);






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






                await finishThiefPlacingTurn(game, user.id);






            }






            break;






        }






         case 'CONFIRM_ROUND_END':






            if (game.gameStatus !== GameStatus.ThiefRoundEnd) return { error: "라운드 종료 확인 단계가 아닙니다."};






            if (!game.roundEndConfirmations) game.roundEndConfirmations = {};






            game.roundEndConfirmations[user.id] = now;






            break;






    }






    






    await db.saveGame(game);






    await broadcast({ type: 'GAME_STATE_UPDATE', payload: { updatedGame: game } });













    return null;






};













export const makeThiefGoAiMove = async (game: LiveGameSession): Promise<void> => {






    // ... (implementation unchanged)






};
