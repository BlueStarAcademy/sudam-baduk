import { VolatileState, ServerAction, User, HandleActionResult, GameMode, Negotiation, Guild, LiveGameSession } from '../../types/index.js';
import { initializeDiceGo, updateDiceGoState, handleDiceGoAction } from './diceGo.js';
import { initializeThief, updateThiefState, handleThiefAction } from './thief.js';
import { initializeAlkkagi, updateAlkkagiState, handleAlkkagiAction } from './alkkagi.js';
import { initializeCurling, updateCurlingState, handleCurlingAction } from './curling.js';
import { initializeOmok, updateOmokState, handleOmokAction } from './omokLogic.js';

export const initializePlayfulGame = async (game: LiveGameSession, neg: Negotiation, now: number, p1Guild: Guild | null, p2Guild: Guild | null) => {
    switch (game.mode) {
        case GameMode.Dice:
            initializeDiceGo(game, neg, now, p1Guild, p2Guild);
            break;
        case GameMode.Thief:
            initializeThief(game, neg, now, p1Guild, p2Guild);
            break;
        case GameMode.Alkkagi:
            initializeAlkkagi(game, neg, now, p1Guild, p2Guild);
            break;
        case GameMode.Curling:
            initializeCurling(game, neg, now, p1Guild, p2Guild);
            break;
        case GameMode.Omok:
        case GameMode.Ttamok:
            initializeOmok(game, neg, now);
            break;
    }
};

export const updatePlayfulGameState = async (game: LiveGameSession, now: number) => {
    switch (game.mode) {
        case GameMode.Dice:
            updateDiceGoState(game, now);
            break;
        case GameMode.Thief:
            updateThiefState(game, now);
            break;
        case GameMode.Alkkagi:
            await updateAlkkagiState(game, now);
            break;
        case GameMode.Curling:
            await updateCurlingState(game, now);
            break;
        case GameMode.Omok:
        case GameMode.Ttamok:
            await updateOmokState(game, now);
            break;
    }
};

export const handlePlayfulGameAction = async (volatileState: VolatileState, game: LiveGameSession, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult | null> => {
    switch (game.mode) {
        case GameMode.Dice:
            return handleDiceGoAction(volatileState, game, action, user);
        case GameMode.Thief:
            return handleThiefAction(volatileState, game, action, user);
        case GameMode.Alkkagi:
            return handleAlkkagiAction(volatileState, game, action, user);
        case GameMode.Curling:
            return handleCurlingAction(volatileState, game, action, user);
        case GameMode.Omok:
        case GameMode.Ttamok:
            return handleOmokAction(volatileState, game, action, user);
    }
    return null;
};