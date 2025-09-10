import * as types from '../../types.js';
import * as db from '../db.js';
import { getOmokLogic } from '../omokLogic.js';
import { handleSharedAction, updateSharedGameState } from './shared.js';
import { initializeNigiri, updateNigiriState, handleNigiriAction } from './nigiri.js';
import { transitionToPlaying } from './shared.js';

export const initializeOmok = (game: types.LiveGameSession, neg: types.Negotiation, now: number) => {
    if (game.isAiGame) {
        const humanPlayerColor = neg.settings.player1Color || types.Player.Black;
        if (humanPlayerColor === types.Player.Black) {
            game.blackPlayerId = game.player1.id;
            game.whitePlayerId = game.player2.id;
        } else {
            game.whitePlayerId = game.player1.id;
            game.blackPlayerId = game.player2.id;
        }
        transitionToPlaying(game, now);
    } else {
        game.gameStatus = 'turn_preference_selection';
        game.turnChoices = { [game.player1.id]: null, [game.player2.id]: null };
        game.turnChoiceDeadline = now + 30000;
        game.turnSelectionTiebreaker = 'rps';
    }
};

export const updateOmokState = (game: types.LiveGameSession, now: number) => {
    if (updateSharedGameState(game, now)) return;

    if (game.gameStatus === 'playing' && game.turnDeadline && now > game.turnDeadline) {
         const timedOutPlayer = game.currentPlayer;
        game.winner = timedOutPlayer === types.Player.Black ? types.Player.White : types.Player.Black;
        game.winReason = 'timeout';
        game.gameStatus = 'ended';
    }
    
    // Handle RPS reveal for Omok/Ttamok after a tie in turn preference
    const p1Id = game.player1.id;
    const p2Id = game.player2.id;
    if (game.gameStatus === 'omok_rps_reveal' || game.gameStatus === 'ttamok_rps_reveal') {
        if (game.revealEndTime && now > game.revealEndTime) {
            const p1Choice = game.rpsState?.[p1Id];
            const p2Choice = game.rpsState?.[p2Id];

            if (p1Choice && p2Choice) {
                let winnerId: string | null = null;
                if (p1Choice !== p2Choice) {
                    const p1Wins = (p1Choice === 'rock' && p2Choice === 'scissors') ||
                                   (p1Choice === 'scissors' && p2Choice === 'paper') ||
                                   (p1Choice === 'paper' && p2Choice === 'rock');
                    winnerId = p1Wins ? p1Id : p2Id;
                } else { // Tie on final round
                    if ((game.rpsRound || 1) >= 3) {
                        winnerId = Math.random() < 0.5 ? p1Id : p2Id;
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
                    
                    transitionToPlaying(game, now);
                    // Clean up RPS state
                    game.turnChoices = undefined;
                    game.rpsState = undefined;
                    game.rpsRound = undefined;
                }
            }
        }
    }
};


export const handleOmokAction = async (volatileState: types.VolatileState, game: types.LiveGameSession, action: types.ServerAction & { userId: string }, user: types.User): Promise<types.HandleActionResult | undefined> => {
    const { type, payload } = action as any;
    const now = Date.now();
    
    const sharedResult = await handleSharedAction(volatileState, game, action, user);
    if (sharedResult) return sharedResult;

    const myPlayerEnum = user.id === game.blackPlayerId ? types.Player.Black : (user.id === game.whitePlayerId ? types.Player.White : types.Player.None);
    const isMyTurn = myPlayerEnum === game.currentPlayer;
    
    switch (type) {
        case 'OMOK_PLACE_STONE': {
            if (game.gameStatus !== 'playing') return { error: "Cannot place stone now." };
            if (!isMyTurn) return { error: "상대방의 차례입니다." };
            const { x, y } = payload;
            const logic = getOmokLogic(game);
            
            if (game.boardState[y][x] !== types.Player.None) return { error: "Position occupied." };
            if (game.settings.has33Forbidden && myPlayerEnum === types.Player.Black && logic.is33(x, y, game.boardState)) {
                return { error: "3-3 is forbidden for Black." };
            }
            
            game.boardState[y][x] = myPlayerEnum;
            game.lastMove = { x, y };
            game.lastTurnStones = null;
            game.moveHistory.push({ player: myPlayerEnum, x, y });
            
            if (game.mode === types.GameMode.Ttamok) {
                const { capturedCount } = logic.performTtamokCapture(x, y);
                game.captures[myPlayerEnum] += capturedCount;
                if (game.captures[myPlayerEnum] >= (game.settings.captureTarget || 10)) {
                    game.winner = myPlayerEnum;
                    game.winReason = 'capture_limit';
                    game.gameStatus = 'ended';
                    return {};
                }
            }

            const winCheck = logic.checkWin(x, y, game.boardState);
            if (winCheck) {
                game.winner = myPlayerEnum;
                game.winReason = 'omok_win';
                game.winningLine = winCheck.line;
                game.gameStatus = 'ended';
            } else {
                const boardIsFull = game.boardState.flat().every(cell => cell !== types.Player.None);
                if (boardIsFull) {
                    game.gameStatus = 'ended';
                    game.winReason = 'score'; // Or a new reason like 'full_board'
                    if (game.mode === types.GameMode.Ttamok) {
                        const p1Enum = game.player1.id === game.blackPlayerId ? types.Player.Black : (game.player1.id === game.whitePlayerId ? types.Player.White : types.Player.None);
                        const p2Enum = game.player2.id === game.blackPlayerId ? types.Player.Black : (game.player2.id === game.whitePlayerId ? types.Player.White : types.Player.None);
                        const p1Captures = game.captures[p1Enum];
                        const p2Captures = game.captures[p2Enum];

                        if (p1Captures > p2Captures) {
                            game.winner = p1Enum;
                        } else if (p2Captures > p1Captures) {
                            game.winner = p2Enum;
                        } else {
                             game.winner = Math.random() < 0.5 ? types.Player.Black : types.Player.White;
                        }
                    } else { // Omok
                        game.winner = Math.random() < 0.5 ? types.Player.Black : types.Player.White;
                    }
                } else {
                    const playerWhoMoved = myPlayerEnum;
                    if (game.settings.timeLimit > 0) {
                        const timeKey = playerWhoMoved === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                        
                        if (game.turnDeadline) {
                            const timeRemaining = Math.max(0, (game.turnDeadline - now) / 1000);
                            game[timeKey] = timeRemaining;
                        }
                    }

                    game.currentPlayer = myPlayerEnum === types.Player.Black ? types.Player.White : types.Player.Black;
                    
                    if (game.settings.timeLimit > 0) {
                        const nextPlayer = game.currentPlayer;
                        const nextTimeKey = nextPlayer === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                        const isNextInByoyomi = game[nextTimeKey] <= 0 && game.settings.byoyomiCount > 0;

                        if (isNextInByoyomi) {
                            game.turnDeadline = now + game.settings.byoyomiTime * 1000;
                        } else {
                            game.turnDeadline = now + game[nextTimeKey] * 1000;
                        }
                        game.turnStartTime = now;
                    }
                }
            }
            return {};
        }
    }
    return undefined;
}
