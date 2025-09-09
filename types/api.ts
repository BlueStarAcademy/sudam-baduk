
import {
    User, LiveGameSession, Negotiation, KomiBid,
    AdminLog, Announcement, OverrideAnnouncement, InventoryItem,
    QuestReward, DailyQuestData, WeeklyQuestData, MonthlyQuestData, TournamentState, UserWithStatus
} from './entities.js';
import { GameMode, RPSChoice, Point, Player, UserStatus, TournamentType } from './enums.js';

export type ChatMessage = {
  id: string;
  user: { id: string, nickname: string };
  text?: string;
  emoji?: string;
  system: boolean;
  timestamp: number;
  location?: string;
  actionInfo?: {
      message: string;
      scoreChange: number;
  };
};

export type HandleActionResult = { 
    clientResponse?: any;
    error?: string;
};

export interface AppState {
    users: Record<string, User>;
    userCredentials: Record<string, any>; // Not sent to client
    liveGames: Record<string, LiveGameSession>;
    userConnections: Record<string, number>;
    userStatuses: Record<string, UserStatusInfo>;
    negotiations: Record<string, Negotiation>;
    waitingRoomChats: Record<string, ChatMessage[]>;
    gameChats: Record<string, ChatMessage[]>;
    userLastChatMessage: Record<string, number>;
    adminLogs: AdminLog[];
    gameModeAvailability: Partial<Record<GameMode, boolean>>;
    announcements: Announcement[];
    globalOverrideAnnouncement: OverrideAnnouncement | null;
    announcementInterval: number;
}

export interface VolatileState {
    userConnections: Record<string, number>;
    userStatuses: Record<string, UserStatusInfo>;
    negotiations: Record<string, Negotiation>;
    waitingRoomChats: Record<string, ChatMessage[]>;
    gameChats: Record<string, ChatMessage[]>;
    userLastChatMessage: Record<string, number>;
    userConsecutiveChatMessages?: Record<string, { content: string, count: number }>;
    activeTournaments?: Record<string, TournamentState>;
    activeTournamentViewers: Set<string>;
}

export interface UserStatusInfo {
    status: UserStatus;
    mode?: GameMode;
    gameId?: string;
    spectatingGameId?: string;
}

export type ServerAction =
    // Auth
    | { type: 'REGISTER', payload: any }
    | { type: 'LOGIN', payload: any }
    | { type: 'LOGOUT', payload?: never }
    // Social
    | { type: 'SEND_CHAT_MESSAGE', payload: { channel: string; text?: string; emoji?: string, location?: string } }
    | { type: 'SET_USER_STATUS', payload: { status: any } }
    | { type: 'ENTER_WAITING_ROOM', payload: { mode: GameMode } }
    | { type: 'LEAVE_WAITING_ROOM', payload?: never }
    | { type: 'LEAVE_GAME_ROOM', payload: { gameId: string } }
    | { type: 'SPECTATE_GAME', payload: { gameId: string } }
    // FIX: The payload for LEAVE_SPECTATING is made optional to accommodate different call signatures in the codebase.
    | { type: 'LEAVE_SPECTATING', payload?: { gameId?: string } }
    // Negotiation
    | { type: 'CHALLENGE_USER', payload: { opponentId: string; mode: GameMode } }
    | { type: 'SEND_CHALLENGE', payload: { negotiationId: string; settings: any } }
    | { type: 'UPDATE_NEGOTIATION', payload: { negotiationId: string; settings: any } }
    | { type: 'ACCEPT_NEGOTIATION', payload: { negotiationId: string; settings: any } }
    | { type: 'DECLINE_NEGOTIATION', payload: { negotiationId: string } }
    | { type: 'START_AI_GAME', payload: { mode: GameMode, settings: any } }
    | { type: 'REQUEST_REMATCH', payload: { opponentId: string, originalGameId: string } }
    // Game
    | { type: 'PLACE_STONE', payload: { gameId: string; x: number; y: number, isHidden?: boolean } }
    | { type: 'PASS_TURN', payload: { gameId: string } }
    | { type: 'RESIGN_GAME', payload: { gameId: string, andLeave?: boolean } }
    | { type: 'LEAVE_AI_GAME', payload: { gameId: string } }
    | { type: 'REQUEST_NO_CONTEST_LEAVE', payload: { gameId: string } }
    | { type: 'USE_ACTION_BUTTON', payload: { gameId: string; buttonName: string } }
    // Nigiri
    | { type: 'NIGIRI_GUESS', payload: { gameId: string; guess: 1 | 2 } }
    // Capture Go
    | { type: 'UPDATE_CAPTURE_BID', payload: { gameId: string; bid: number } }
    | { type: 'CONFIRM_CAPTURE_REVEAL', payload: { gameId: string } }
    // Base Go
    | { type: 'PLACE_BASE_STONE', payload: { gameId: string; x: number; y: number } }
    | { type: 'PLACE_REMAINING_BASE_STONES_RANDOMLY', payload?: never }
    | { type: 'UPDATE_KOMI_BID', payload: { gameId: string, bid: KomiBid } }
    | { type: 'CONFIRM_BASE_REVEAL', payload: { gameId: string } }
    // Hidden Go
    | { type: 'START_HIDDEN_PLACEMENT', payload: { gameId: string } }
    | { type: 'START_SCANNING', payload: { gameId: string } }
    | { type: 'SCAN_BOARD', payload: { gameId: string, x: number, y: number } }
    // Missile Go
    | { type: 'START_MISSILE_SELECTION', payload: { gameId: string } }
    | { type: 'LAUNCH_MISSILE', payload: { gameId: string, from: Point, direction: 'up' | 'down' | 'left' | 'right' } }
    | { type: 'MISSILE_INVALID_SELECTION', payload: { gameId: string } }
    // Omok
    | { type: 'OMOK_PLACE_STONE', payload: { gameId: string, x: number, y: number } }
    // Turn Preference (Alkkagi, Curling, Omok, Ttamok)
    | { type: 'CHOOSE_TURN_PREFERENCE', payload: { gameId: string, choice: 'first' | 'second' } }
    | { type: 'SUBMIT_RPS_CHOICE', payload: { gameId: string, choice: RPSChoice } }
    // Dice Go
    | { type: 'DICE_READY_FOR_TURN_ROLL', payload: { gameId: string } }
    | { type: 'DICE_CHOOSE_TURN', payload: { gameId: string; choice: 'first' | 'second' } }
    | { type: 'DICE_CONFIRM_START', payload: { gameId: string } }
    | { type: 'DICE_ROLL', payload: { gameId: string; itemType?: 'odd' | 'even' } }
    | { type: 'DICE_PLACE_STONE', payload: { gameId: string, x: number, y: number } }
   // Thief Go
    | { type: 'THIEF_UPDATE_ROLE_CHOICE', payload: { gameId: string; choice: 'thief' | 'police' } }
    | { type: 'CONFIRM_THIEF_ROLE', payload: { gameId: string } }
    | { type: 'THIEF_ROLL_DICE', payload: { gameId: string } }
    | { type: 'THIEF_PLACE_STONE', payload: { gameId: string; x: number; y: number } }
    // Alkkagi
    | { type: 'CONFIRM_ALKKAGI_START', payload: { gameId: string } }
    | { type: 'ALKKAGI_PLACE_STONE', payload: { gameId: string, point: Point } }
    | { type: 'ALKKAGI_FLICK_STONE', payload: { gameId: string, stoneId: number, vx: number, vy: number } }
    | { type: 'USE_ALKKAGI_ITEM', payload: { gameId: string, itemType: 'slow' | 'aimingLine' } }
    // Curling
    | { type: 'CONFIRM_CURLING_START', payload: { gameId: string } }
    | { type: 'CURLING_FLICK_STONE', payload: { gameId: string, launchPosition: Point, velocity: Point } }
    | { type: 'USE_CURLING_ITEM', payload: { gameId: string, itemType: 'slow' | 'aimingLine' } }
    // Shared round end
    | { type: 'CONFIRM_ROUND_END', payload: { gameId: string } }
    // User Actions
    | { type: 'UPDATE_AVATAR', payload: { avatarId: string } }
    | { type: 'UPDATE_BORDER', payload: { borderId: string } }
    | { type: 'CHANGE_NICKNAME', payload: { newNickname: string } }
    | { type: 'UPDATE_MBTI', payload: { mbti: string, isMbtiPublic: boolean } }
    | { type: 'RESET_STAT_POINTS', payload?: never }
    | { type: 'CONFIRM_STAT_ALLOCATION', payload: { newStatPoints: any } }
    | { type: 'RESET_SINGLE_STAT', payload: { mode: GameMode } }
    | { type: 'RESET_STATS_CATEGORY', payload: { category: 'strategic' | 'playful' } }
    // Inventory & Item Actions
    | { type: 'USE_ITEM', payload: { itemId: string } }
    | { type: 'USE_ALL_ITEMS_OF_TYPE', payload: { itemName: string } }
    | { type: 'TOGGLE_EQUIP_ITEM', payload: { itemId: string } }
    | { type: 'SELL_ITEM', payload: { itemId: string } }
    | { type: 'ENHANCE_ITEM', payload: { itemId: string } }
    | { type: 'DISASSEMBLE_ITEM', payload: { itemIds: string[] } }
    | { type: 'CRAFT_MATERIAL', payload: { materialName: string, craftType: 'upgrade' | 'downgrade', quantity: number } }
    // Reward Actions
    | { type: 'CLAIM_MAIL_ATTACHMENTS', payload: { mailId: string } }
    | { type: 'CLAIM_ALL_MAIL_ATTACHMENTS', payload?: never }
    | { type: 'DELETE_MAIL', payload: { mailId: string } }
    | { type: 'DELETE_ALL_CLAIMED_MAIL', payload?: never }
    | { type: 'MARK_MAIL_AS_READ', payload: { mailId: string } }
    | { type: 'CLAIM_QUEST_REWARD', payload: { questId: string } }
    | { type: 'CLAIM_ACTIVITY_MILESTONE', payload: { milestoneIndex: number, questType: 'daily' | 'weekly' | 'monthly' } }
    // Shop
    | { type: 'BUY_SHOP_ITEM', payload: { itemId: string } }
    | { type: 'BUY_SHOP_ITEM_BULK', payload: { itemId: string, quantity: number } }
    | { type: 'BUY_MATERIAL_BOX', payload: { itemId: string, quantity: number } }
    | { type: 'PURCHASE_ACTION_POINTS', payload?: never }
    | { type: 'EXPAND_INVENTORY', payload?: never }
    | { type: 'BUY_BORDER', payload: { borderId: string } }
    // Admin
    | { type: 'ADMIN_APPLY_SANCTION', payload: { targetUserId: string; sanctionType: 'chat' | 'connection'; durationMinutes: number } }
    | { type: 'ADMIN_LIFT_SANCTION', payload: { targetUserId: string; sanctionType: 'chat' | 'connection' } }
    | { type: 'ADMIN_RESET_USER_DATA', payload: { targetUserId: string; resetType: 'stats' | 'full' } }
    | { type: 'ADMIN_DELETE_USER', payload: { targetUserId: string } }
    | { type: 'ADMIN_CREATE_USER', payload: { username: string, password: string, nickname: string } }
    | { type: 'ADMIN_FORCE_LOGOUT', payload: { targetUserId: string } }
    | { type: 'ADMIN_SEND_MAIL', payload: any }
    | { type: 'ADMIN_REORDER_ANNOUNCEMENTS', payload: { announcements: Announcement[] } }
    | { type: 'ADMIN_ADD_ANNOUNCEMENT', payload: { message: string } }
    | { type: 'ADMIN_REMOVE_ANNOUNCEMENT', payload: { id: string } }
    | { type: 'ADMIN_SET_ANNOUNCEMENT_INTERVAL', payload: { interval: number } }
    | { type: 'ADMIN_SET_OVERRIDE_ANNOUNCEMENT', payload: { message: string } }
    | { type: 'ADMIN_CLEAR_OVERRIDE_ANNOUNCEMENT', payload?: never }
    | { type: 'ADMIN_TOGGLE_GAME_MODE', payload: { mode: GameMode; isAvailable: boolean } }
    | { type: 'ADMIN_SET_GAME_DESCRIPTION', payload: { gameId: string, description: string } }
    | { type: 'ADMIN_FORCE_DELETE_GAME', payload: { gameId: string } }
    | { type: 'ADMIN_FORCE_WIN', payload: { gameId: string, winnerId: string } }
    | { type: 'ADMIN_UPDATE_USER_DETAILS', payload: { targetUserId: string, updatedDetails: Partial<User> } }
    // Tournament
    | { type: 'START_TOURNAMENT_SESSION', payload: { type: TournamentType } }
    | { type: 'START_TOURNAMENT_ROUND', payload: { type: TournamentType } }
    | { type: 'CLEAR_TOURNAMENT_SESSION', payload: { type?: TournamentType } }
    | { type: 'SAVE_TOURNAMENT_PROGRESS', payload: { type: TournamentType } }
    | { type: 'FORFEIT_TOURNAMENT', payload: { type: TournamentType } }
    | { type: 'SKIP_TOURNAMENT_END', payload: { type: TournamentType } }
    | { type: 'CLAIM_TOURNAMENT_REWARD', payload: { tournamentType: TournamentType } }
    | { type: 'ENTER_TOURNAMENT_VIEW', payload?: never }
    | { type: 'LEAVE_TOURNAMENT_VIEW', payload?: never }
    // Single Player
    | { type: 'START_SINGLE_PLAYER_GAME', payload: { stageId: string } }
    | { type: 'SINGLE_PLAYER_REFRESH_PLACEMENT', payload: { gameId: string } }
    | { type: 'START_SINGLE_PLAYER_MISSION', payload: { missionId: string } }
    | { type: 'CLAIM_SINGLE_PLAYER_MISSION_REWARD', payload: { missionId: string } }
    ;

export interface GameProps {
    session: LiveGameSession;
    currentUser: UserWithStatus;
    onAction: (action: ServerAction) => void;
    isSpectator: boolean;
    onlineUsers: UserWithStatus[];
    onViewUser: (userId: string) => void;
    activeNegotiation: Negotiation | null;
    waitingRoomChat: ChatMessage[];
    gameChat: ChatMessage[];
    negotiations: Negotiation[];
}

export interface AdminProps {
    currentUser: UserWithStatus;
    allUsers: User[];
    liveGames: LiveGameSession[];
    adminLogs: AdminLog[];
    onAction: (action: ServerAction) => void;
    onBack: () => void;
    gameModeAvailability: Partial<Record<GameMode, boolean>>;
    announcements: Announcement[];
    globalOverrideAnnouncement: OverrideAnnouncement | null;
    announcementInterval: number;
}
