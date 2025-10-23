


import { ServerAction, User, HandleActionResult, GameMode, ServerActionType, Guild, LiveGameSession, GameStatus, WinReason } from '../../types/index.js';
import * as db from '../db.js';
import { handleAiTurn, handleStrategicGameAction } from '../modes/strategic.js';
import { Player } from '../../types/index.js';
import { handlePlayfulGameAction } from '../modes/playful.js';
import { handleAiGameStart, handleAiGameRefresh, handleTowerAddStones, handleConfirmIntro } from '../modes/singlePlayerMode.js';
import { handleUserAction } from './userActions.js';
import { handleNegotiationAction } from './negotiationActions.js';
import { handleInventoryAction } from './inventoryActions.js';
import { handleShopAction } from './shopActions.js';
import { handleRewardAction } from './rewardActions.js';
import { handleSocialAction } from './socialActions.js';
import { handleTournamentAction } from './tournamentActions.js';
import { handleAdminAction } from './adminActions.js';
import { handleGuildAction } from './guildActions.js';
import { handlePresetAction } from './presetActions.js';
import { TOWER_STAGES } from '../../constants/index.js';
import * as currencyService from '../currencyService.js';

// TODO: Refactor all downstream action handlers to be stateless.
import { ServerAction, User, HandleActionResult, GameMode, ServerActionType, Guild } from '../../types/index.js';
import * as db from '../db.js';
import { handleAiTurn, handleStrategicGameAction } from '../modes/strategic.js';
import { Player } from '../../types/index.js';
import { handlePlayfulGameAction } from '../modes/playful.js';
import { handleAiGameStart, handleConfirmIntro } from '../modes/singlePlayerMode.js';
import { handleUserAction } from './userActions.js';
import { handleNegotiationAction } from './negotiationActions.js';
import { handleInventoryAction } from './inventoryActions.js';
import { handleShopAction } from './shopActions.js';
import { handleRewardAction } from './rewardActions.js';
import { handleSocialAction } from './socialActions.js';
import { handleTournamentAction } from './tournamentActions.js';
import { handleAdminAction } from './adminActions.js';
import { handleGuildAction } from './guildActions.js';
import { handlePresetAction } from './presetActions.js';

export const handleAction = async (action: ServerAction & { user: User }): Promise<HandleActionResult> => {
    const { type, payload, user } = action;
    const { gameId } = payload || {};
    const actionWithUserId = { ...action, userId: user.id };

    if (type.startsWith('ADMIN_')) {
        return handleAdminAction(action);
    }
    
    const guilds = await db.getKV<Record<string, Guild>>('guilds') || {};
    
    const guildActionTypes: ServerActionType[] = [
        'CREATE_GUILD', 'JOIN_GUILD', 'GUILD_CANCEL_APPLICATION', 'GUILD_ACCEPT_APPLICANT', 'GUILD_REJECT_APPLICANT', 'GUILD_LEAVE',
        'GUILD_KICK_MEMBER', 'GUILD_PROMOTE_MEMBER', 'GUILD_DEMOTE_MEMBER', 'GUILD_UPDATE_ANNOUNCEMENT', 'GUILD_CHECK_IN',
        'GUILD_CLAIM_CHECK_IN_REWARD', 'GUILD_UPDATE_PROFILE', 'GUILD_CLAIM_MISSION_REWARD', 'GUILD_DONATE_GOLD', 'GUILD_DONATE_DIAMOND',
        'GUILD_START_RESEARCH', 'SEND_GUILD_CHAT_MESSAGE', 'GUILD_DELETE_CHAT_MESSAGE',
        'START_GUILD_BOSS_BATTLE', 'CLAIM_GUILD_BOSS_PERSONAL_REWARD', 'GUILD_BUY_SHOP_ITEM',
        'GUILD_TRANSFER_MASTERSHIP'
    ];
    if (guildActionTypes.includes(type)) {
        return handleGuildAction(action, guilds);
    }
    
    const negotiationActionTypes: ServerActionType[] = [
        'CHALLENGE_USER', 'SEND_CHALLENGE', 'UPDATE_NEGOTIATION', 'ACCEPT_NEGOTIATION', 'DECLINE_NEGOTIATION',
        'REQUEST_REMATCH'
    ];
    if (negotiationActionTypes.includes(type)) {
        return handleNegotiationAction(actionWithUserId, user, guilds);
    }

    if (type.startsWith('BUY_') || type === 'EXPAND_INVENTORY') {
        return handleShopAction(actionWithUserId, user);
    }
    
    const rewardActionTypes: ServerActionType[] = [
        'CLAIM_MAIL_ATTACHMENTS', 'CLAIM_ALL_MAIL_ATTACHMENTS', 'DELETE_MAIL', 'DELETE_ALL_CLAIMED_MAIL', 'MARK_MAIL_AS_READ',
        'CLAIM_QUEST_REWARD', 'CLAIM_ACTIVITY_MILESTONE', 'CLAIM_SINGLE_PLAYER_MISSION_REWARD',
        'CLAIM_ACTION_POINT_QUIZ_REWARD', 'RESET_SINGLE_PLAYER_REWARDS', 'START_SINGLE_PLAYER_MISSION',
        'UPGRADE_SINGLE_PLAYER_MISSION'
    ];
    if (rewardActionTypes.includes(type)) {
        return handleRewardAction(actionWithUserId, user, guilds);
    }

    if (type.startsWith('TOGGLE_EQUIP') || type.startsWith('SELL_') || type.startsWith('ENHANCE_') || type.startsWith('DISASSEMBLE_') || type.startsWith('CRAFT_') || type.startsWith('SYNTHESIZE_') || type === 'USE_ITEM' || type === 'USE_ITEM_BULK') {
        return handleInventoryAction(actionWithUserId, user);
    }
    
    const userSettingActions: ServerActionType[] = [
        'UPDATE_AVATAR', 'UPDATE_BORDER', 'UPDATE_MBTI', 'CHANGE_NICKNAME', 'RESET_STAT_POINTS', 
        'CONFIRM_STAT_ALLOCATION', 'CHANGE_PASSWORD', 'DELETE_ACCOUNT', 'RESET_SINGLE_STAT', 'RESET_STATS_CATEGORY', 'UPDATE_APP_SETTINGS'
    ];
    if (userSettingActions.includes(type)) {
        return handleUserAction(actionWithUserId, user);
    }

    if (type === 'HEARTBEAT' || type === 'LOGOUT' || type.startsWith('FRIEND_') || type === 'SET_USER_STATUS' || type === 'ENTER_WAITING_ROOM' || type === 'LEAVE_WAITING_ROOM' || type === 'SPECTATE_GAME' || type === 'LEAVE_SPECTATING' || type === 'SEND_CHAT_MESSAGE' || type === 'LEAVE_AI_GAME' || type === 'LEAVE_GAME_ROOM') {
        return handleSocialAction(action);
    }

    const tournamentActionTypes: ServerActionType[] = [
        'START_TOURNAMENT_SESSION', 'START_TOURNAMENT_ROUND', 'CLEAR_TOURNAMENT_SESSION', 'FORFEIT_TOURNAMENT',
        'SKIP_TOURNAMENT_END', 'RESIGN_TOURNAMENT_MATCH', 'USE_CONDITION_POTION', 'CLAIM_TOURNAMENT_REWARD', 'ENTER_TOURNAMENT_VIEW', 'LEAVE_TOURNAMENT_VIEW'
    ];
     if (tournamentActionTypes.includes(type)) {
        return handleTournamentAction(actionWithUserId, user, guilds);
    }
    
    const presetActionTypes: ServerActionType[] = ['SAVE_EQUIPMENT_PRESET', 'LOAD_EQUIPMENT_PRESET', 'RENAME_EQUIPMENT_PRESET'];
    if (presetActionTypes.includes(type)) {
        return handlePresetAction(user, action);
    }

    if (type === 'START_SINGLE_PLAYER_GAME') {
        return handleAiGameStart(payload, user, guilds, 'single-player');
    }
    if (type === 'START_TOWER_CHALLENGE_GAME') {
        return handleAiGameStart(payload, user, guilds, 'tower-challenge');
    }
    if (type === 'START_AI_GAME') {
        const { mode, aiDifficulty } = payload;
        return handleAiGameStart({ mode, aiDifficulty }, user, guilds, 'ai-match');
    }
    if (type === 'CONFIRM_SP_INTRO') {
        return handleConfirmIntro(gameId, user);
    }

    if (type === 'TRIGGER_AI_MOVE') {
        const game = await db.getLiveGame(gameId);
        if (!game) return { error: "Game not found." };

        const aiPlayerId = game.player2.id;
        const aiPlayerEnum = game.blackPlayerId === aiPlayerId ? Player.Black : (game.whitePlayerId === aiPlayerId ? Player.White : Player.None);

        if (game.currentPlayer === aiPlayerEnum && (game.isAiGame || game.isSinglePlayer || game.isTowerChallenge)) {
            await handleAiTurn(game, game.lastMove!, myPlayerEnum);
            return { clientResponse: { success: true } };
        }
        return { clientResponse: { success: true } }; // Not AI's turn, do nothing
    }

    if (!gameId) {
        return { error: 'Action requires a gameId.' };
    }
    
    const game = await db.getLiveGame(gameId);
    if (!game) {
        return { error: 'Game not found.' };
    }

    const strategicModes = [GameMode.Standard, GameMode.Capture, GameMode.Speed, GameMode.Base, GameMode.Hidden, GameMode.Missile, GameMode.Mix];
    const playfulModes = [GameMode.Dice, GameMode.Omok, GameMode.Ttamok, GameMode.Thief, GameMode.Alkkagi, GameMode.Curling];

    if (strategicModes.includes(game.mode) || game.isSinglePlayer || game.isTowerChallenge) {
        return (await handleStrategicGameAction(game, actionWithUserId, user)) ?? null;
    } else if (playfulModes.includes(game.mode)) {
        return await handlePlayfulGameAction(game, actionWithUserId, user);
    } 

    return { error: `Unhandled action type: ${type}` };
};
