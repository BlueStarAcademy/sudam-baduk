import { type LiveGameSession, type VolatileState, type ServerAction, type User, type HandleActionResult, Player, GameStatus, WinReason, RPSChoice } from '../../types/index.js';
import * as db from '../db.js';
import { endGame, processGameSummary } from '../summaryService.js';
import { PLAYFUL_MODE_FOUL_LIMIT } from '../../constants/index.js';

export const transitionToPlaying = (game: LiveGameSession, now: number) => {
    game.gameStatus = GameStatus.Playing;
    game.currentPlayer = Player.Black;
    if (game.settings.timeLimit > 0) {
        game.turnStartTime = now;
        game.turnDeadline = now + game.blackTimeLeft * 1000;
    }
};

export const handleTimeoutFoul = (game: LiveGameSession, timedOutPlayerId: string, now: number): boolean => {
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

export const updateSharedGameState = (game: LiveGameSession, now: number): boolean => {
    const p1Id = game.player1.id;
    const p2Id = game.player2.id;
    
    const rpsRevealStatuses = [GameStatus.DiceRpsReveal, GameStatus.ThiefRpsReveal, GameStatus.AlkkagiRpsReveal, GameStatus.CurlingRpsReveal, GameStatus.OmokRpsReveal, GameStatus.TtamokRpsReveal];
    if (rpsRevealStatuses.includes(game.gameStatus) && game.revealEndTime && now > game.revealEndTime) {
        if ((game.rpsRound || 1) < 3) {
            game.rpsRound = (game.rpsRound || 1) + 1;
            game.rpsState = { [p1Id]: null, [p2Id]: null };
            game.gameStatus = game.gameStatus.replace('Reveal', '') as GameStatus;
            game.turnDeadline = now + 30000;
            return true;
        }
    }
    
    if (game.turnDeadline && now > game.turnDeadline) {
        const rpsStatuses = [GameStatus.DiceRps, GameStatus.ThiefRps, GameStatus.AlkkagiRps, GameStatus.CurlingRps, GameStatus.OmokRps, GameStatus.TtamokRps];
        if (rpsStatuses.includes(game.gameStatus)) {
            const p1Choice = game.rpsState?.[p1Id];
            const p2Choice = game.rpsState?.[p2Id];
            if (!p1Choice) game.rpsState![p1Id] = [RPSChoice.Rock, RPSChoice.Paper, RPSChoice.Scissors][Math.floor(Math.random() * 3)];
            if (!p2Choice) game.rpsState![p2Id] = [RPSChoice.Rock, RPSChoice.Paper, RPSChoice.Scissors][Math.floor(Math.random() * 3)];
            return true;
        }
    }
    return false;
};

export const handleSharedAction = async (volatileState: VolatileState, game: LiveGameSession, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult | undefined> => {
    const { type, payload } = action;
    const now = Date.now();

    switch(type) {
        case 'RESIGN_GAME': {
            const winner = game.blackPlayerId === user.id ? Player.White : Player.Black;
            await endGame(game, winner, WinReason.Resign);
            return {};
        }
        case 'REQUEST_NO_CONTEST_LEAVE': {
            if (!game.canRequestNoContest?.[user.id]) return { error: '무효 대국을 요청할 수 없습니다.' };
            
            game.noContestInitiatorIds = [...(game.noContestInitiatorIds || []), user.id];
            
            const opponentId = game.player1.id === user.id ? game.player2.id : game.player1.id;
            
            if (game.noContestInitiatorIds.includes(opponentId)) {
                game.gameStatus = GameStatus.NoContest;
                game.winReason = WinReason.Disconnect; // for summary purposes
                await processGameSummary(game);
            }
            return {};
        }
        case 'CHOOSE_TURN_PREFERENCE': {
            if (game.gameStatus !== GameStatus.TurnPreferenceSelection) return { error: 'Not in turn selection phase.' };
            if (!game.turnChoices || typeof game.turnChoices[user.id] === 'string') return { error: 'Cannot choose now.' };
            game.turnChoices[user.id] = payload.choice;
            return {};
        }
        case 'SUBMIT_RPS_CHOICE': {
            const rpsStatuses = [GameStatus.DiceRps, GameStatus.ThiefRps, GameStatus.AlkkagiRps, GameStatus.CurlingRps, GameStatus.OmokRps, GameStatus.TtamokRps];
            if (!rpsStatuses.includes(game.gameStatus)) return { error: 'Not in RPS phase.' };
            if (!game.rpsState || game.rpsState[user.id]) return { error: 'Cannot submit choice now.' };
            game.rpsState[user.id] = payload.choice;
            
            const p1Id = game.player1.id;
            const p2Id = game.player2.id;
            if(game.rpsState[p1Id] && game.rpsState[p2Id]) {
                game.gameStatus = `${game.gameStatus}Reveal` as GameStatus;
                game.revealEndTime = now + 3000;
            }
            return {};
        }
    }
    
    return undefined;
};