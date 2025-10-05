import { LiveGameSession, WinReason, GameStatus } from '../../types/index.js';
import { Player } from '../../types/index.js';
import { endGame } from '../summaryService.js';

export const updateSpeedState = (game: LiveGameSession, now: number) => {
    const deadline = Number(game.turnDeadline);
    if (game.gameStatus === GameStatus.Playing && deadline && now > deadline) {
        const timedOutPlayer = game.currentPlayer;
        const winner = timedOutPlayer === Player.Black ? Player.White : Player.Black;
        
        // In Fischer time, there's no byoyomi. Running out of time is an immediate loss.
        game.lastTimeoutPlayerId = game.currentPlayer === Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
        game.lastTimeoutPlayerIdClearTime = now + 5000;
        
        endGame(game, winner, WinReason.Timeout);
    }
};