
// FIX: Corrected imports. These types are now defined in entities.ts and exported via index.ts
import { User, UserWithStatus, LiveGameSession, Negotiation, ChatMessage, Guild, TournamentState, TowerRank } from './index.js';
import { UserStatus, GameMode } from './enums.js';

export interface UserStatusInfo {
    status: UserStatus;
    mode?: GameMode;
    gameId?: string;
    spectatingGameId?: string;
    stateEnteredAt: number;
}

export interface AppState {
    users: Record<string, User>;
    userCredentials: Record<string, UserCredentials>;
    userStatuses: Record<string, UserStatusInfo>;
    liveGames: Record<string, LiveGameSession>;
    negotiations: Record<string, Negotiation>;
    waitingRoomChats: Record<string, ChatMessage[]>;
    gameChats: Record<string, ChatMessage[]>;
    adminLogs: any[]; // AdminLog type is in entities
    announcements: any[]; // Announcement type is in entities
    globalOverrideAnnouncement: any | null; // OverrideAnnouncement type is in entities
    gameModeAvailability: Record<GameMode, boolean>;
    announcementInterval: number;
    guilds: Record<string, Guild>;
    towerRankings: TowerRank[];
    onlineUsers: UserWithStatus[];
    // Add userLastChatMessage to AppState
    userLastChatMessage: Record<string, number>;
}

export interface VolatileState {
    userConnections: Record<string, any>; // Maps userId to connection object/timestamp
    userSessions: Record<string, string>; // Maps userId to a unique session ID for auth
    activeTournaments?: Record<string, TournamentState>; // In-memory simulation state
    activeTournamentViewers?: Set<string>; // Users currently watching a simulation
    // FIX: Add missing properties to align with usage across the server.
    userStatuses: Record<string, UserStatusInfo>;
    negotiations: Record<string, Negotiation>;
    userLastChatMessage: Record<string, number>;
    waitingRoomChats: Record<string, ChatMessage[]>;
    gameChats: Record<string, ChatMessage[]>;
}

// FIX: Add missing type definitions for Guild Boss Battles
export interface BattleLogEntry {
    turn: number;
    icon?: string;
    message: string;
    isUserAction?: boolean;
    damageTaken?: number;
    healingDone?: number;
    bossHealingDone?: number;
    isCrit?: boolean;
    debuffsApplied?: { type: 'user_combat_power_reduction_percent' | 'user_heal_reduction_percent', value: number, turns: number }[];
}

export interface GuildBossBattleResult {
    damageDealt: number;
    turnsSurvived: number;
    rewards: { guildCoins: number };
    battleLog: BattleLogEntry[];
    bossHpBefore: number;
    bossHpAfter: number;
    bossMaxHp: number;
    userHp: number;
    maxUserHp: number;
}


export type ServerActionType =
  | 'TRIGGER_AI_MOVE'
  | 'HEARTBEAT'
  | 'LOGIN'
  | 'REGISTER'
  | 'LOGOUT'
  | 'ENTER_WAITING_ROOM'
  | 'LEAVE_WAITING_ROOM'
  | 'CHALLENGE_USER'
  | 'SEND_CHALLENGE'
  | 'UPDATE_NEGOTIATION'
  | 'ACCEPT_NEGOTIATION'
  | 'DECLINE_NEGOTIATION'
  | 'START_AI_GAME'
  | 'START_AI_GAME'
  | 'LEAVE_AI_GAME'
  | 'PLACE_STONE'
  | 'PASS_TURN'
  | 'RESIGN_GAME'
  | 'SEND_CHAT_MESSAGE'
  | 'SET_USER_STATUS'
  | 'SPECTATE_GAME'
  | 'LEAVE_SPECTATING'
  | 'REQUEST_REMATCH'
  | 'LEAVE_GAME_ROOM'
  | 'NIGIRI_GUESS'
  | 'UPDATE_CAPTURE_BID'
  | 'CONFIRM_CAPTURE_REVEAL'
  | 'PLACE_BASE_STONE'
  | 'PLACE_REMAINING_BASE_STONES_RANDOMLY'
  | 'UPDATE_KOMI_BID'
  | 'CONFIRM_BASE_REVEAL'
  | 'START_HIDDEN_PLACEMENT'
  | 'START_SCANNING'
  | 'SCAN_BOARD'
  | 'START_MISSILE_SELECTION'
  | 'LAUNCH_MISSILE'
  | 'MISSILE_INVALID_SELECTION'
  | 'REQUEST_NO_CONTEST_LEAVE'
  | 'TOGGLE_EQUIP_ITEM'
  | 'SELL_ITEM'
  | 'USE_ITEM'
  | 'USE_ITEM_BULK'
  | 'ENHANCE_ITEM'
  | 'DISASSEMBLE_ITEM'
  | 'CRAFT_MATERIAL'
  | 'SYNTHESIZE_EQUIPMENT'
  | 'EXPAND_INVENTORY'
  | 'BUY_SHOP_ITEM'
  | 'BUY_MATERIAL_BOX'
  | 'BUY_ACTION_POINTS'
  | 'CLAIM_MAIL_ATTACHMENTS'
  | 'CLAIM_ALL_MAIL_ATTACHMENTS'
  | 'DELETE_MAIL'
  | 'DELETE_ALL_CLAIMED_MAIL'
  | 'MARK_MAIL_AS_READ'
  | 'CLAIM_QUEST_REWARD'
  | 'CLAIM_ACTIVITY_MILESTONE'
  | 'UPDATE_AVATAR'
  | 'UPDATE_BORDER'
  | 'BUY_BORDER'
  | 'CHANGE_NICKNAME'
  | 'RESET_STAT_POINTS'
  | 'CONFIRM_STAT_ALLOCATION'
  | 'CHANGE_PASSWORD'
  | 'DELETE_ACCOUNT'
  | 'RESET_SINGLE_STAT'
  | 'RESET_STATS_CATEGORY'
  | 'USE_ACTION_BUTTON'
  | 'CHOOSE_TURN_PREFERENCE'
  | 'SUBMIT_RPS_CHOICE'
  | 'DICE_READY_FOR_TURN_ROLL'
  | 'DICE_CHOOSE_TURN'
  | 'DICE_CONFIRM_START'
  | 'DICE_ROLL'
  | 'DICE_PLACE_STONE'
  | 'THIEF_UPDATE_ROLE_CHOICE'
  | 'CONFIRM_THIEF_ROLE'
  | 'THIEF_ROLL_DICE'
  | 'THIEF_PLACE_STONE'
  | 'ALKKAGI_PLACE_STONE'
  | 'ALKKAGI_FLICK_STONE'
  | 'USE_ALKKAGI_ITEM'
  | 'CONFIRM_ROUND_END'
  | 'CONFIRM_ALKKAGI_START'
  | 'CURLING_FLICK_STONE'
  | 'USE_CURLING_ITEM'
  | 'CONFIRM_CURLING_START'
  | 'START_TOURNAMENT_SESSION'
  | 'START_TOURNAMENT_ROUND'
  | 'CLEAR_TOURNAMENT_SESSION'
  | 'SAVE_TOURNAMENT_PROGRESS'
  | 'FORFEIT_TOURNAMENT'
  | 'SKIP_TOURNAMENT_END'
  | 'RESIGN_TOURNAMENT_MATCH'
  | 'USE_CONDITION_POTION'
  | 'CLAIM_TOURNAMENT_REWARD'
  | 'ENTER_TOURNAMENT_VIEW'
  | 'LEAVE_TOURNAMENT_VIEW'
  | 'UPDATE_MBTI'
  | 'START_SINGLE_PLAYER_GAME'
  | 'SINGLE_PLAYER_REFRESH_PLACEMENT'
  | 'START_SINGLE_PLAYER_MISSION'
  | 'CLAIM_SINGLE_PLAYER_MISSION_REWARD'
  | 'UPGRADE_SINGLE_PLAYER_MISSION'
  | 'CONFIRM_SP_INTRO'
  | 'START_TOWER_CHALLENGE_GAME'
  | 'TOWER_CHALLENGE_REFRESH_PLACEMENT'
  | 'TOWER_CHALLENGE_ADD_STONES'
  | 'TOWER_PURCHASE_ITEM'
  | 'CLAIM_ACTION_POINT_QUIZ_REWARD'
  | 'RESET_SINGLE_PLAYER_REWARDS'
  | 'SAVE_EQUIPMENT_PRESET'
  | 'LOAD_EQUIPMENT_PRESET'
  | 'RENAME_EQUIPMENT_PRESET'
  | 'UNEQUIP_ALL_ITEMS'
  | 'PAUSE_GAME'
  | 'RESUME_GAME'
  | 'UPDATE_APP_SETTINGS'
  | 'ADMIN_APPLY_SANCTION'
  | 'ADMIN_LIFT_SANCTION'
  | 'ADMIN_RESET_USER_DATA'
  | 'ADMIN_DELETE_USER'
  | 'ADMIN_CREATE_USER'
  | 'ADMIN_FORCE_LOGOUT'
  | 'ADMIN_SEND_MAIL'
  | 'ADMIN_GIVE_ACTION_POINTS'
  | 'ADMIN_REORDER_ANNOUNCEMENTS'
  | 'ADMIN_ADD_ANNOUNCEMENT'
  | 'ADMIN_REMOVE_ANNOUNCEMENT'
  | 'ADMIN_SET_ANNOUNCEMENT_INTERVAL'
  | 'ADMIN_SET_OVERRIDE_ANNOUNCEMENT'
  | 'ADMIN_CLEAR_OVERRIDE_ANNOUNCEMENT'
  | 'ADMIN_TOGGLE_GAME_MODE'
  | 'ADMIN_SET_GAME_DESCRIPTION'
  | 'ADMIN_FORCE_DELETE_GAME'
  | 'ADMIN_FORCE_WIN'
  | 'ADMIN_UPDATE_USER_DETAILS'
  | 'ADMIN_UPDATE_GUILD_DETAILS'
  | 'ADMIN_APPLY_GUILD_SANCTION'
  | 'ADMIN_DELETE_GUILD'
  | 'CREATE_GUILD'
  | 'JOIN_GUILD'
  | 'GUILD_CANCEL_APPLICATION'
  | 'GUILD_ACCEPT_APPLICANT'
  | 'GUILD_REJECT_APPLICANT'
  | 'GUILD_LEAVE'
  | 'GUILD_KICK_MEMBER'
  | 'GUILD_PROMOTE_MEMBER'
  | 'GUILD_DEMOTE_MEMBER'
  | 'GUILD_UPDATE_ANNOUNCEMENT'
  | 'GUILD_CHECK_IN'
  | 'GUILD_CLAIM_CHECK_IN_REWARD'
  | 'GUILD_CLAIM_MISSION_REWARD'
  | 'GUILD_UPDATE_PROFILE'
  | 'GUILD_DONATE_GOLD'
  | 'GUILD_DONATE_DIAMOND'
  | 'GUILD_START_RESEARCH'
  | 'GUILD_BUY_SHOP_ITEM'
  | 'BUY_GUILD_SHOP_ITEM'
  | 'SEND_GUILD_CHAT_MESSAGE'
  | 'GUILD_DELETE_CHAT_MESSAGE'
  | 'START_GUILD_BOSS_BATTLE'
  | 'CLAIM_GUILD_BOSS_PERSONAL_REWARD'
  | 'GUILD_TRANSFER_MASTERSHIP';
  
export interface ServerAction {
    type: ServerActionType;
    payload?: any;
    userId?: string;
    user?: User; // server-side
}

export interface HandleActionResult {
    clientResponse?: any;
    error?: string;
}

export interface GameProps {
    session: LiveGameSession;
    onAction: (action: ServerAction) => Promise<{ success: boolean; error?: string; [key: string]: any; } | undefined>;
    currentUser: UserWithStatus;
    waitingRoomChat: ChatMessage[];
    gameChat: ChatMessage[];
    isSpectator: boolean;
    onlineUsers: UserWithStatus[];
    activeNegotiation: Negotiation | null;
    negotiations: Negotiation[];
    onViewUser: (userId: string) => void;
}

export interface AdminProps {
    currentUser: UserWithStatus;
    allUsers: User[];
    liveGames: LiveGameSession[];
    adminLogs: any[]; // AdminLog
    onAction: (action: ServerAction) => void;
    onBack: () => void;
    gameModeAvailability: Record<GameMode, boolean>;
    announcements: any[]; // Announcement
    globalOverrideAnnouncement: any | null; // OverrideAnnouncement
    announcementInterval: number;
    guilds: Record<string, Guild>;
}

export interface UserCredentials {
    passwordHash?: string; // Kept for potential migration, but new records will use hash/salt
    hash?: string;
    salt?: string;
    userId: string;
}
