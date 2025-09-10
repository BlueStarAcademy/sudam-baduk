import * as types from '../../types/index.js';
import * as db from '../db.js';
import { handleSinglePlayerGameStart, handleSinglePlayerRefresh } from '../modes/singlePlayerMode.js';
import { handleTowerChallengeGameStart } from '../modes/towerChallengeMode.js';

type HandleActionResult = types.HandleActionResult;

export const handleAiGameAction = async (volatileState: types.VolatileState, action: types.ServerAction & { userId: string }, user: types.User): Promise<HandleActionResult> => {
    const { type, payload } = action;
    const gameId = payload?.gameId;

    switch (type) {
        case 'START_SINGLE_PLAYER_GAME':
            return handleSinglePlayerGameStart(volatileState, payload, user);
        
        case 'SINGLE_PLAYER_REFRESH_PLACEMENT': {
            if (!gameId) return { error: 'Game ID not provided.' };
            const game = await db.getLiveGame(gameId);
            if (!game) return { error: 'Game not found.' };
            return handleSinglePlayerRefresh(game, user);
        }

        case 'START_TOWER_CHALLENGE_GAME':
            return handleTowerChallengeGameStart(volatileState, payload, user);
        
        // LEAVE_AI_GAME is handled in socialActions, as it's more about session management
        
        default:
            return { error: `Unknown AI game action type: ${type}` };
    }
};