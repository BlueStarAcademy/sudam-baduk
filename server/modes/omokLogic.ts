// server/modes/omokLogic.ts
import { LiveGameSession, Point, BoardState, Player, GameMode, WinReason, HandleActionResult, User, ServerAction, GameStatus, Negotiation } from '../../types/index.js';
import { handleSharedAction, updateSharedGameState, transitionToPlaying, switchTurnAndUpdateTimers } from './shared.js';
import { endGame } from '../summaryService.js';
import * as db from '../db.js';
import { broadcast } from '../services/supabaseService.js';

export const getOmokLogic = (game: LiveGameSession) => {
    // ... (implementation unchanged)
};

export const initializeOmok = (game: LiveGameSession, neg: Negotiation, now: number) => {
    const p1 = game.player1;
    const p2 = game.player2;

    if (game.isAiGame) {
        const humanPlayerColor = neg.settings.player1Color || Player.Black;
        game.blackPlayerId = humanPlayerColor === Player.Black ? p1.id : p2.id;
        game.whitePlayerId = humanPlayerColor === Player.Black ? p2.id : p1.id;
        transitionToPlaying(game, now);
    } else {
        game.gameStatus = GameStatus.TurnPreferenceSelection;
        game.turnChoices = { [p1.id]: null, [p2.id]: null };
        game.turnChoiceDeadline = now + 30000;
        game.turnSelectionTiebreaker = 'rps';
    }
};

export const updateOmokState = async (game: LiveGameSession, now: number) => {
    if (updateSharedGameState(game, now)) return;

    const isTimedGame = (game.settings.timeLimit ?? 0) > 0;
    
    if (isTimedGame && game.gameStatus === GameStatus.Playing && game.turnDeadline && now > game.turnDeadline) {
        const timedOutPlayer = game.currentPlayer;
        const winner = timedOutPlayer === Player.Black ? Player.White : Player.Black;
        // ... (timeout logic remains for cron job)
        await endGame(game, winner, WinReason.Timeout);
    }
};

export const handleOmokAction = async (game: LiveGameSession, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult | null> => {
    const { type, payload } = action as any;
    const now = Date.now();
    const myPlayerEnum = user.id === game.blackPlayerId ? Player.Black : (user.id === game.whitePlayerId ? Player.White : Player.None);
    const isMyTurn = myPlayerEnum === game.currentPlayer;

    const sharedResult = await handleSharedAction(game, action, user);
    if (sharedResult) {
        await db.saveGame(game);
        await broadcast({ type: 'GAME_STATE_UPDATE', payload: { updatedGame: game } });
        return sharedResult;
    }

    if (type === 'PLACE_STONE' && (game.mode === GameMode.Omok || game.mode === GameMode.Ttamok)) {
        if (!isMyTurn || game.gameStatus !== 'playing') {
            return { error: 'Not your turn.' };
        }

        const { x, y } = payload;
        if (game.boardState[y][x] !== Player.None) {
            return { error: 'Stone already placed there.' };
        }
        
        const logic = getOmokLogic(game);
        
        if (game.settings.has33Forbidden && game.currentPlayer === Player.Black && logic.is33(x, y, game.boardState)) {
            return { error: '3-3 is forbidden for Black.' };
        }

        game.boardState[y][x] = game.currentPlayer;
        game.lastMove = { x, y };
        game.moveHistory.push({ player: game.currentPlayer, ...payload });

        const winCheck = logic.checkWin(x, y, game.boardState);
        if (winCheck) {
            game.winningLine = winCheck.line;
            await endGame(game, game.currentPlayer, WinReason.OmokWin);
        } else if (game.mode === GameMode.Ttamok) {
            const { capturedCount } = logic.performTtamokCapture(x, y);
            game.captures[game.currentPlayer] += capturedCount;
            if (game.captures[game.currentPlayer] >= (game.settings.captureTarget || 10)) {
                await endGame(game, game.currentPlayer, WinReason.CaptureLimit);
            }
        } else {
             // Only switch turn if game hasn't ended
            switchTurnAndUpdateTimers(game, now);
        }
        
        await db.saveGame(game);
        await broadcast({ type: 'GAME_STATE_UPDATE', payload: { updatedGame: game } });
        
        return {};
    }

    return null;
};

export const makeOmokAiMove = async (game: LiveGameSession): Promise<void> => {
    // ... (implementation unchanged)
};