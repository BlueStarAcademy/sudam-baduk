import * as types from '../../types.js';
import * as db from '../db.js';

// Import all the handlers
import { handleAdminAction } from './adminActions.js';
import { handleInventoryAction } from './inventoryActions.js';
import { handleNegotiationAction } from './negotiationActions.js';
import { handleRewardAction } from './rewardActions.js';
import { handleShopAction } from './shopActions.js';
import { handleSocialAction } from './socialActions.js';
import { handleTournamentAction } from './tournamentActions.js';
import { handleUserAction } from './userActions.js';
import { handleAiGameAction } from './singlePlayerActions.js';
import { handleStrategicGameAction } from '../modes/strategic.js';
import { handlePlayfulGameAction } from '../modes/playful.js';
// Corrected import path
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants.js';

export const handleAction = async (volatileState: types.VolatileState, action: types.ServerAction & { userId: string, user: types.User }): Promise<types.HandleActionResult> => {
    const { type, payload, user } = action;
    const gameId = payload?.gameId;

    // Route to handlers based on action type prefix or category
    if (type.startsWith('ADMIN_')) return handleAdminAction(volatileState, action, user);
    if (type.startsWith('START_SINGLE_PLAYER') || type.startsWith('TOWER_CHALLENGE') || type.includes('REFRESH_PLACEMENT') || type.startsWith('START_SINGLE_PLAYER_MISSION')) return handleAiGameAction(volatileState, action, user);
    if (type.startsWith('NEGOTIATION') || ['START_AI_GAME', 'REQUEST_REMATCH', 'CHALLENGE_USER', 'SEND_CHALLENGE', 'UPDATE_NEGOTIATION', 'ACCEPT_NEGOTIATION', 'DECLINE_NEGOTIATION'].includes(type)) return handleNegotiationAction(volatileState, action, user);
    if (type.startsWith('CLAIM_') || type.startsWith('DELETE_MAIL') || type === 'MARK_MAIL_AS_READ') return handleRewardAction(volatileState, action, user);
    if (type.startsWith('BUY_') || ['PURCHASE_ACTION_POINTS', 'EXPAND_INVENTORY'].includes(type)) return handleShopAction(volatileState, action, user);
    if (type.startsWith('TOURNAMENT') || ['START_TOURNAMENT_SESSION', 'FORFEIT_TOURNAMENT', 'SKIP_TOURNAMENT_END', 'USE_CONDITION_POTION', 'CLEAR_TOURNAMENT_SESSION', 'SAVE_TOURNAMENT_PROGRESS', 'START_TOURNAMENT_ROUND'].includes(type)) return handleTournamentAction(volatileState, action, user);
    if (['TOGGLE_EQUIP_ITEM', 'SELL_ITEM', 'ENHANCE_ITEM', 'DISASSEMBLE_ITEM', 'USE_ITEM', 'USE_ITEM_BULK', 'CRAFT_MATERIAL', 'SYNTHESIZE_EQUIPMENT'].includes(type)) return handleInventoryAction(volatileState, action, user);
    if (['UPDATE_AVATAR', 'UPDATE_BORDER', 'CHANGE_NICKNAME', 'UPDATE_MBTI', 'RESET_STAT_POINTS', 'CONFIRM_STAT_ALLOCATION', 'CHANGE_PASSWORD', 'DELETE_ACCOUNT', 'RESET_SINGLE_STAT', 'RESET_STATS_CATEGORY'].includes(type)) return handleUserAction(volatileState, action, user);

    // Game-specific actions need to fetch the game first
    if (gameId) {
        const game = await db.getLiveGame(gameId);
        if (!game) return { error: 'Game not found.' };
        
        let result: types.HandleActionResult | null | undefined = null;
        
        // Added explicit types for 'm'
        if (SPECIAL_GAME_MODES.some((m: {mode: types.GameMode}) => m.mode === game.mode) || game.isSinglePlayer || game.isTowerChallenge) {
            result = await handleStrategicGameAction(volatileState, game, action, user);
        } else if (PLAYFUL_GAME_MODES.some((m: {mode: types.GameMode}) => m.mode === game.mode)) {
            result = await handlePlayfulGameAction(volatileState, game, action, user);
        }

        if (result !== null && result !== undefined) {
            await db.saveGame(game);
            return result;
        }
    }
    
    // Social actions are often game-independent or have their own game fetching logic
    const socialResult = await handleSocialAction(volatileState, action, user);
    if (socialResult) return socialResult;

    return { error: `Unhandled action type: ${type}` };
};