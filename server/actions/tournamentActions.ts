
import { randomUUID } from 'crypto';
import * as db from '../db.js';
import { type ServerAction, type User, type VolatileState, TournamentType, PlayerForTournament, InventoryItem, InventoryItemType, TournamentState, LeagueTier, CoreStat, Guild, Round, Match, CommentaryLine } from '../../types/index.js';
import { TOURNAMENT_DEFINITIONS, BASE_TOURNAMENT_REWARDS, CONSUMABLE_ITEMS, MATERIAL_ITEMS, TOURNAMENT_SCORE_REWARDS, BOT_NAMES, AVATAR_POOL } from '../../constants/index.js';
import { updateQuestProgress } from '../questService.js';
import { createItemFromTemplate, SHOP_ITEMS } from '../shop.js';
import { isSameDayKST } from '../../utils/timeUtils.js';
import * as tournamentService from '../tournamentService.js';
import { addItemsToInventory, createItemInstancesFromReward } from '../../utils/inventoryUtils.js';
import { calculateTotalStats } from '../services/statService.js';
import { handleRewardAction } from './rewardActions.js';
import { broadcast } from '../services/supabaseService.js';

type HandleActionResult = { 
    clientResponse?: any;
    error?: string;
};

const LEAGUE_BOT_STATS: Record<LeagueTier, number> = {
    [LeagueTier.Sprout]: 100,
    [LeagueTier.Rookie]: 120,
    [LeagueTier.Rising]: 140,
    [LeagueTier.Ace]: 160,
    [LeagueTier.Diamond]: 200,
    [LeagueTier.Master]: 240,
    [LeagueTier.Grandmaster]: 275,
    [LeagueTier.Challenger]: 300,
};

const TOURNAMENT_BOT_STAT_MULTIPLIER: Record<TournamentType, number> = {
    neighborhood: 0.8,
    national: 1.0,
    world: 1.2,
};

const createBotStats = (league: LeagueTier, tournamentType: TournamentType): Record<CoreStat, number> => {
    const baseStatValue = LEAGUE_BOT_STATS[league] || 100;
    const multiplier = TOURNAMENT_BOT_STAT_MULTIPLIER[tournamentType] || 1.0;
    const finalStatValue = Math.round(baseStatValue * multiplier);

    const stats: Partial<Record<CoreStat, number>> = {};
    for (const key of Object.values(CoreStat)) {
        stats[key as CoreStat] = finalStatValue;
    }
    return stats as Record<CoreStat, number>;
};

export const handleTournamentAction = async (action: ServerAction & { userId: string }, user: User, guilds: Record<string, Guild>): Promise<HandleActionResult> => {
    const { type, payload } = action;
    const now = Date.now();

    switch (type) {
        case 'START_TOURNAMENT_SESSION': {
            const { type } = payload as { type: TournamentType };
            const definition = TOURNAMENT_DEFINITIONS[type];
            if (!definition) return { error: '유효하지 않은 토너먼트 타입입니다.' };
            
            const stateKey = tournamentService.getTournamentStateKey(type);
            const playedDateKey = tournamentService.getTournamentPlayedDateKey(type);

            const existingState = user[stateKey] as TournamentState | null;

            if (existingState) {
                const userInTournament = existingState.players.find(p => p.id === user.id);
                if (userInTournament) {
                    const newStats = calculateTotalStats(user, user.guildId ? guilds[user.guildId] : null);
                    userInTournament.stats = JSON.parse(JSON.stringify(newStats));
                    userInTournament.originalStats = JSON.parse(JSON.stringify(newStats));
                    userInTournament.avatarId = user.avatarId;
                    userInTournament.borderId = user.borderId;
                }
                await db.updateUser(user);
                await broadcast({ type: 'USER_DATA_UPDATE', payload: { userId: user.id, updatedUser: user } });
                return {};
            }

            if (user[playedDateKey] && isSameDayKST(user[playedDateKey] as number, now) && !user.isAdmin) {
                return { error: '이미 오늘 참가한 토너먼트입니다. 결과를 확인해주세요.' };
            }
            
            const allUsers = await db.getAllUsers();
            const participants = tournamentService.generateParticipants(user, type, allUsers, guilds);
            const newState = tournamentService.createTournament(type, user, participants, guilds);
            
            (user as any)[stateKey] = newState;
            (user as any)[playedDateKey] = now;
            
            updateQuestProgress(user, 'tournament_participate');

            await db.updateUser(user);
            await broadcast({ type: 'USER_DATA_UPDATE', payload: { userId: user.id, updatedUser: user } });
            return {};
        }

        case 'START_TOURNAMENT_ROUND': {
            const { type } = payload as { type: TournamentType };
            const stateKey = tournamentService.getTournamentStateKey(type);
            const tournamentState = user[stateKey] as TournamentState | null;

            if (!tournamentState) return { error: '토너먼트 정보를 찾을 수 없습니다.' };
            
            const allUsers = await db.getAllUsers();
            tournamentService.startNextRound(tournamentState, guilds, allUsers);
            
            await db.updateUser(user);
            await broadcast({ type: 'USER_DATA_UPDATE', payload: { userId: user.id, updatedUser: user } });
            return {};
        }

        case 'SKIP_TOURNAMENT_END':
        case 'FORFEIT_TOURNAMENT': {
            const { type: tournamentType } = payload as { type: TournamentType };
            const stateKey = tournamentService.getTournamentStateKey(tournamentType);
            const tournamentState = user[stateKey] as TournamentState | null;

            if (!tournamentState) return { error: '토너먼트 정보를 찾을 수 없습니다.' };
            
            const allUsers = await db.getAllUsers();
            if (type === 'SKIP_TOURNAMENT_END') {
                tournamentService.skipToResults(tournamentState, user.id, guilds, allUsers);
            } else {
                tournamentService.forfeitTournament(tournamentState, user.id, guilds, allUsers);
            }
        
            await db.updateUser(user);
            await broadcast({ type: 'USER_DATA_UPDATE', payload: { userId: user.id, updatedUser: user } });
            return {};
        }

        case 'CLEAR_TOURNAMENT_SESSION': {
            const { type } = payload as { type?: TournamentType };
            if (type) {
                const stateKey = tournamentService.getTournamentStateKey(type);
                (user as any)[stateKey] = null;
            } else {
                user.lastNeighborhoodTournament = null;
                user.lastNationalTournament = null;
                user.lastWorldTournament = null;
            }
            
            await db.updateUser(user);
            await broadcast({ type: 'USER_DATA_UPDATE', payload: { userId: user.id, updatedUser: user } });
            return {};
        }

        case 'CLAIM_TOURNAMENT_REWARD': {
            return handleRewardAction(action, user, guilds);
        }

        default:
            return { error: `Action ${type} is not handled by tournamentActions.` };
    }
};
