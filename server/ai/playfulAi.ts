import { LiveGameSession, GameMode } from '../../types/index.js';
import { makeDiceGoAiMove } from '../modes/diceGo.js';
import { makeThiefGoAiMove } from '../modes/thief.js';
import { makeAlkkagiAiMove } from '../modes/alkkagi.js';
import { makeCurlingAiMove } from '../modes/curling.js';
// FIX: Correct import path for omok AI logic.
import { makeOmokAiMove } from '../modes/omokLogic.js';

// This file centralizes AI move logic for all playful modes.
// It acts as a dispatcher based on the current game mode.

export const makePlayfulAiMove = async (game: LiveGameSession): Promise<void> => {
    switch (game.mode) {
        case GameMode.Dice:
            await makeDiceGoAiMove(game);
            break;
        case GameMode.Thief:
            await makeThiefGoAiMove(game);
            break;
        case GameMode.Alkkagi:
            await makeAlkkagiAiMove(game);
            break;
        case GameMode.Curling:
            await makeCurlingAiMove(game);
            break;
        case GameMode.Omok:
        case GameMode.Ttamok:
            await makeOmokAiMove(game);
            break;
        default:
            console.warn(`[AI] No playful AI logic implemented for mode: ${game.mode}`);
            // Fallback: AI passes its turn to prevent getting stuck
            game.passCount = (game.passCount || 0) + 1;
            break;
    }
};