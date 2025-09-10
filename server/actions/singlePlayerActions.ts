import * as types from '../../types/index.js';
import * as db from '../db.js';
import { handleSinglePlayerGameStart, handleSinglePlayerRefresh } from '../modes/singlePlayerMode.js';
import { handleTowerChallengeGameStart, handleTowerChallengeRefresh } from '../modes/towerChallengeMode.js';
import { updateQuestProgress } from '../questService.js';

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
            updateQuestProgress(user, 'tower_challenge_participate');
            return handleTowerChallengeGameStart(volatileState, payload, user);

        case 'TOWER_CHALLENGE_REFRESH_PLACEMENT': {
            if (!gameId) return { error: 'Game ID not provided.' };
            const game = await db.getLiveGame(gameId);
            if (!game) return { error: 'Game not found.' };
            return handleTowerChallengeRefresh(game, user);
        }

        case 'TOWER_CHALLENGE_ADD_STONES': {
            if (!gameId) return { error: 'Game ID not provided.' };
            const game = await db.getLiveGame(gameId);
            if (!game) return { error: 'Game not found.' };

            if (game.addedStonesItemUsed) {
                return { error: '이미 돌 추가 아이템을 사용했습니다.' };
            }
            const cost = 300;
            if (user.gold < cost && !user.isAdmin) {
                return { error: '골드가 부족합니다.' };
            }

            if (!user.isAdmin) {
                user.gold -= cost;
            }

            game.blackStoneLimit = (game.blackStoneLimit || 0) + 3;
            game.addedStonesItemUsed = true;
            
            await db.saveGame(game);
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }
        
        // LEAVE_AI_GAME is handled in socialActions, as it's more about session management
        
        default:
            return { error: `Unknown AI game action type: ${type}` };
    }
};