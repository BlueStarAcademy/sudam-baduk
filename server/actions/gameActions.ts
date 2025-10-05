import { VolatileState, ServerAction, User, HandleActionResult, GameMode, ServerActionType, Guild, LiveGameSession, GameStatus } from '../../types/index.js';
import * as db from '../db.js';
import { handleStrategicGameAction } from '../modes/strategic.js';
import { handlePlayfulGameAction } from '../modes/playful.js';
import { handleSinglePlayerGameStart, handleSinglePlayerRefresh, handleConfirmSPIntro } from '../modes/singlePlayerMode.js';
import { handleTowerChallengeGameStart, handleTowerChallengeRefresh, handleTowerAddStones } from '../modes/towerChallengeMode.js';
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


export const handleAction = async (volatileState: VolatileState, action: ServerAction & { user: User }, guilds: Record<string, Guild>): Promise<HandleActionResult> => {
    const { type, payload, user } = action;
    const { gameId } = payload || {};

    const actionWithUserId = { ...action, userId: user.id };

    if (type.startsWith('ADMIN_')) {
        return handleAdminAction(volatileState, action);
    }
    
    const guildActionTypes: ServerActionType[] = [
        'CREATE_GUILD', 'JOIN_GUILD', 'GUILD_CANCEL_APPLICATION', 'GUILD_ACCEPT_APPLICANT', 'GUILD_REJECT_APPLICANT', 'GUILD_LEAVE',
        'GUILD_KICK_MEMBER', 'GUILD_PROMOTE_MEMBER', 'GUILD_DEMOTE_MEMBER', 'GUILD_UPDATE_ANNOUNCEMENT', 'GUILD_CHECK_IN',
        'GUILD_CLAIM_CHECK_IN_REWARD', 'GUILD_UPDATE_PROFILE', 'GUILD_CLAIM_MISSION_REWARD', 'GUILD_DONATE_GOLD', 'GUILD_DONATE_DIAMOND',
        'GUILD_START_RESEARCH', 'SEND_GUILD_CHAT_MESSAGE', 'GUILD_DELETE_CHAT_MESSAGE',
        'START_GUILD_BOSS_BATTLE', 'CLAIM_GUILD_BOSS_PERSONAL_REWARD', 'GUILD_BUY_SHOP_ITEM',
        'GUILD_TRANSFER_MASTERSHIP'
    ];

    if (guildActionTypes.includes(type)) {
        return handleGuildAction(volatileState, action, guilds);
    }
    
    const negotiationActionTypes: ServerActionType[] = [
        'CHALLENGE_USER', 'SEND_CHALLENGE', 'UPDATE_NEGOTIATION', 'ACCEPT_NEGOTIATION', 'DECLINE_NEGOTIATION',
        'START_AI_GAME', 'REQUEST_REMATCH'
    ];
    if (negotiationActionTypes.includes(type)) {
        return handleNegotiationAction(volatileState, actionWithUserId, user, guilds);
    }

    if (type.startsWith('BUY_') || type === 'EXPAND_INVENTORY') {
        return handleShopAction(volatileState, actionWithUserId, user);
    }
    
    const rewardActionTypes: ServerActionType[] = [
        'CLAIM_MAIL_ATTACHMENTS', 'CLAIM_ALL_MAIL_ATTACHMENTS', 'DELETE_MAIL', 'DELETE_ALL_CLAIMED_MAIL', 'MARK_MAIL_AS_READ',
        'CLAIM_QUEST_REWARD', 'CLAIM_ACTIVITY_MILESTONE', 'CLAIM_SINGLE_PLAYER_MISSION_REWARD',
        'CLAIM_ACTION_POINT_QUIZ_REWARD', 'RESET_SINGLE_PLAYER_REWARDS', 'START_SINGLE_PLAYER_MISSION'
    ];
    if (rewardActionTypes.includes(type)) {
        return handleRewardAction(volatileState, actionWithUserId, user, guilds);
    }

    if (type.startsWith('TOGGLE_EQUIP') || type.startsWith('SELL_') || type.startsWith('ENHANCE_') || type.startsWith('DISASSEMBLE_') || type.startsWith('CRAFT_') || type.startsWith('SYNTHESIZE_') || type === 'USE_ITEM' || type === 'USE_ITEM_BULK') {
        return handleInventoryAction(volatileState, actionWithUserId, user);
    }
    
    const userSettingActions: ServerActionType[] = [
        'UPDATE_AVATAR', 'UPDATE_BORDER', 'UPDATE_MBTI', 'CHANGE_NICKNAME', 'RESET_STAT_POINTS', 
        'CONFIRM_STAT_ALLOCATION', 'CHANGE_PASSWORD', 'DELETE_ACCOUNT', 'RESET_SINGLE_STAT', 'RESET_STATS_CATEGORY', 'UPDATE_APP_SETTINGS'
    ];
    if (userSettingActions.includes(type)) {
        return handleUserAction(volatileState, actionWithUserId, user);
    }

    if (type === 'LOGOUT' || type.startsWith('FRIEND_') || type === 'SET_USER_STATUS' || type === 'ENTER_WAITING_ROOM' || type === 'LEAVE_WAITING_ROOM' || type === 'SPECTATE_GAME' || type === 'LEAVE_SPECTATING' || type === 'SEND_CHAT_MESSAGE' || type === 'LEAVE_AI_GAME' || type === 'LEAVE_GAME_ROOM') {
        return handleSocialAction(volatileState, action);
    }

    const tournamentActionTypes: ServerActionType[] = [
        'START_TOURNAMENT_SESSION', 'START_TOURNAMENT_ROUND', 'CLEAR_TOURNAMENT_SESSION', 'SAVE_TOURNAMENT_PROGRESS', 'FORFEIT_TOURNAMENT',
        'SKIP_TOURNAMENT_END', 'RESIGN_TOURNAMENT_MATCH', 'USE_CONDITION_POTION', 'CLAIM_TOURNAMENT_REWARD', 'ENTER_TOURNAMENT_VIEW', 'LEAVE_TOURNAMENT_VIEW'
    ];
     if (tournamentActionTypes.includes(type)) {
        return handleTournamentAction(volatileState, actionWithUserId, user, guilds);
    }
    
    const presetActionTypes: ServerActionType[] = ['SAVE_EQUIPMENT_PRESET', 'LOAD_EQUIPMENT_PRESET', 'RENAME_EQUIPMENT_PRESET'];
    if (presetActionTypes.includes(type)) {
        return handlePresetAction(user, action);
    }

    if (type === 'START_SINGLE_PLAYER_GAME') {
        return handleSinglePlayerGameStart(volatileState, payload, user, guilds);
    }
    if (type === 'START_TOWER_CHALLENGE_GAME') {
        return handleTowerChallengeGameStart(volatileState, payload, user, guilds);
    }
    if (type === 'CONFIRM_SP_INTRO') {
        return handleConfirmSPIntro(gameId, user);
    }

    // Actions requiring gameId from here
    if (gameId) {
        if (type === 'PAUSE_GAME' || type === 'RESUME_GAME') {
            const game = await db.getLiveGame(gameId);
            if (!game) return { error: "Game not found." };
            if (!game.isAiGame && !game.isSinglePlayer && !game.isTowerChallenge) return { error: "Can't pause this game."};

            const isPaused = game.gameStatus === GameStatus.Paused;
            const now = Date.now();
            if (type === 'PAUSE_GAME' && !isPaused) {
                game.gameStatus = GameStatus.Paused;
                if (game.turnDeadline) {
                    game.pausedTurnTimeLeft = (game.turnDeadline - now) / 1000;
                    game.turnDeadline = undefined;
                    game.turnStartTime = undefined;
                }
            } else if (type === 'RESUME_GAME' && isPaused) {
                game.gameStatus = GameStatus.Playing;
                game.promptForMoreStones = false; // Always clear prompt on resume
                if (game.pausedTurnTimeLeft) {
                    game.turnDeadline = now + game.pausedTurnTimeLeft * 1000;
                    game.turnStartTime = now;
                    game.pausedTurnTimeLeft = undefined;
                }
            }
            await db.saveGame(game);
            return {};
        }
        if (type === 'TOWER_PURCHASE_ITEM') {
            const game = await db.getLiveGame(gameId);
            if (!game || !game.isTowerChallenge) return { error: "타워 챌린지 대국이 아닙니다." };
            
            const { itemType } = payload;
            if (!game.towerItemPurchases) game.towerItemPurchases = {};
            if (game.towerItemPurchases[itemType as keyof typeof game.towerItemPurchases]) {
                return { error: '이미 구매한 아이템입니다.' };
            }

            const costs = { missile: 300, hidden: 500, scan: 100 };
            const cost = costs[itemType as keyof typeof costs];
            if (user.gold < cost) {
                return { error: '골드가 부족합니다.' };
            }

            currencyService.spendGold(user, cost, `도전의 탑 아이템 구매: ${itemType}`);
            game.towerItemPurchases[itemType as keyof typeof game.towerItemPurchases] = true;

            const stage = TOWER_STAGES.find(s => s.id === game.stageId);
            if (!stage) return { error: '스테이지 정보를 찾을 수 없습니다.' };

            if (itemType === 'missile') {
                game.missiles_p1 = (game.missiles_p1 || 0) + (stage.missileCount || 0);
            } else if (itemType === 'hidden') {
                // To grant more hidden stones, we increase the allowed count in settings for this match.
                game.settings.hiddenStoneCount = (game.settings.hiddenStoneCount || 0) + (stage.hiddenStoneCount || 0);
            } else if (itemType === 'scan') {
                game.scans_p1 = (game.scans_p1 || 0) + (stage.scanCount || 0);
            }

            await db.saveGame(game);
            await db.updateUser(user);
            
            // This is a special case where we handle it here instead of passing to handleStrategicGameAction
            return { clientResponse: { updatedUser: user } };
        }
    }


    if (!gameId) {
        return { error: 'Action requires a gameId.' };
    }

    const game = await db.getLiveGame(gameId);
    if (!game) {
        return { error: 'Game not found.' };
    }
    
    if (type === 'SINGLE_PLAYER_REFRESH_PLACEMENT') {
        return handleSinglePlayerRefresh(game, user);
    }
    if (type === 'TOWER_CHALLENGE_REFRESH_PLACEMENT') {
        return handleTowerChallengeRefresh(game, user);
    }
    if (type === 'TOWER_CHALLENGE_ADD_STONES') {
        return handleTowerAddStones(game, user);
    }

    const strategicModes = [GameMode.Standard, GameMode.Capture, GameMode.Speed, GameMode.Base, GameMode.Hidden, GameMode.Missile, GameMode.Mix];
    const playfulModes = [GameMode.Dice, GameMode.Omok, GameMode.Ttamok, GameMode.Thief, GameMode.Alkkagi, GameMode.Curling];

    let result: HandleActionResult | null;

    if (strategicModes.includes(game.mode) || game.isSinglePlayer || game.isTowerChallenge) {
        result = (await handleStrategicGameAction(volatileState, game, actionWithUserId, user)) ?? null;
    } else if (playfulModes.includes(game.mode)) {
        result = await handlePlayfulGameAction(volatileState, game, actionWithUserId, user);
    } else {
        return { error: `Unknown game mode: ${game.mode}` };
    }

    if (result) {
        await db.saveGame(game);
        return result;
    }

    return { error: `Unhandled action type: ${type}` };
};