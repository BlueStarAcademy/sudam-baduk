import { randomUUID } from 'crypto';
import * as db from '../db.js';
import { TournamentState, PlayerForTournament, CoreStat, CommentaryLine, Match, User, Round, TournamentType, LeagueTier, VolatileState, ServerAction, HandleActionResult } from '../../types.js';
import { TOURNAMENT_DEFINITIONS, BASE_TOURNAMENT_REWARDS, CONSUMABLE_ITEMS, BOT_NAMES, AVATAR_POOL, BORDER_POOL, CORE_STATS_DATA, LEAGUE_DATA } from '../../constants.js';
import { updateQuestProgress } from '../questService.js';
import { createItemFromTemplate, SHOP_ITEMS } from '../shop.js';
import { isSameDayKST } from '../../utils/timeUtils.js';
import * as tournamentService from '../tournamentService.js';
import { addItemsToInventory, createItemInstancesFromReward } from '../../utils/inventoryUtils.js';
import { calculateTotalStats } from '../statService.js';

export const handleTournamentAction = async (volatileState: VolatileState, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult> => {
    const { type, payload } = action;
    const now = Date.now();

    switch (type) {
        case 'START_TOURNAMENT_SESSION': {
            const { type } = payload as { type: TournamentType };
            const definition = TOURNAMENT_DEFINITIONS[type];
            if (!definition) return { error: '유효하지 않은 토너먼트 타입입니다.' };
            
            let stateKey: keyof User;
            let playedDateKey: keyof User;
            switch (type) {
                case 'neighborhood':
                    stateKey = 'lastNeighborhoodTournament';
                    playedDateKey = 'lastNeighborhoodPlayedDate';
                    break;
                case 'national':
                    stateKey = 'lastNationalTournament';
                    playedDateKey = 'lastNationalPlayedDate';
                    break;
                case 'world':
                    stateKey = 'lastWorldTournament';
                    playedDateKey = 'lastWorldPlayedDate';
                    break;
                default:
                    return { error: 'Invalid tournament type.' };
            }

            const existingState = (user as any)[stateKey] as TournamentState | null;

            if (existingState) {
                // Session exists. Update the user's stats within it before returning.
                const userInTournament = existingState.players.find(p => p.id === user.id);
                if (userInTournament) {
                    const newStats = calculateTotalStats(user);
                    userInTournament.stats = JSON.parse(JSON.stringify(newStats));
                    userInTournament.originalStats = JSON.parse(JSON.stringify(newStats));
                    userInTournament.avatarId = user.avatarId;
                    userInTournament.borderId = user.borderId;
                }
                (user as any)[stateKey] = existingState; // Re-assign to mark for update
                await db.updateUser(user);
                return {};
            }

            if ((user as any)[playedDateKey] && isSameDayKST((user as any)[playedDateKey], now) && !user.isAdmin) {
                return { error: '이미 오늘 참가한 토너먼트입니다. 결과를 확인해주세요.' };
            }
            
            const allUsers = await db.getAllUsers();
            const myLeague = user.league;
            const myId = user.id;
        
            const potentialOpponents = allUsers
                .filter(u => u.id !== myId && u.league === myLeague)
                .sort(() => 0.5 - Math.random());
            
            const neededOpponents = definition.players - 1;
            const selectedOpponents = potentialOpponents.slice(0, neededOpponents);
        
            const botsToCreate = neededOpponents - selectedOpponents.length;
            const botNames = [...BOT_NAMES].sort(() => 0.5 - Math.random());
        
            for (let i = 0; i < botsToCreate; i++) {
                const botName = botNames[i % botNames.length];
                const botAvatar = AVATAR_POOL[Math.floor(Math.random() * AVATAR_POOL.length)];
                selectedOpponents.push({
                    id: `bot-${botName}-${i}`,
                    nickname: botName,
                    avatarId: botAvatar.id,
                    borderId: 'default',
                    league: myLeague,
                } as any);
            }
            
            const participants: PlayerForTournament[] = [user, ...selectedOpponents].map(p => {
                const initialStats = p.id.startsWith('bot-') ? createBotStats(p.league as LeagueTier, type) : calculateTotalStats(p as User);
                return {
                    id: p.id,
                    nickname: p.nickname,
                    avatarId: p.avatarId,
                    borderId: p.borderId,
                    league: p.league,
                    stats: JSON.parse(JSON.stringify(initialStats)), // Mutable copy for simulation
                    originalStats: initialStats, // Store the original stats
                    wins: 0,
                    losses: 0,
                    condition: 1000, // Initialize with a magic number for "not set"
                };
            });
            
            const shuffledParticipants = [participants[0], ...participants.slice(1).sort(() => 0.5 - Math.random())];

            const newState = tournamentService.createTournament(type, user, shuffledParticipants);
            (user as any)[stateKey] = newState;
            (user as any)[playedDateKey] = now;
            
            updateQuestProgress(user, 'tournament_participate');

            await db.updateUser(user);
            return {};
        }

        case 'START_TOURNAMENT_ROUND': {
            const { type } = payload as { type: TournamentType };
            let stateKey: keyof User;
            switch (type) {
                case 'neighborhood': stateKey = 'lastNeighborhoodTournament'; break;
                case 'national': stateKey = 'lastNationalTournament'; break;
                case 'world': stateKey = 'lastWorldTournament'; break;
                default: return { error: 'Invalid tournament type.' };
            }
            
            const freshUser = await db.getUser(user.id);
            if (!freshUser) return { error: 'User not found in DB.' };

            const tournamentState = (freshUser as any)[stateKey] as TournamentState | null;
            if (!tournamentState) return { error: '토너먼트 정보를 찾을 수 없습니다.' };
            
            const userInTournament = tournamentState.players.find(p => p.id === freshUser.id);
            if (userInTournament) {
                const newStats = calculateTotalStats(freshUser);
                userInTournament.stats = JSON.parse(JSON.stringify(newStats));
                userInTournament.originalStats = JSON.parse(JSON.stringify(newStats));
                userInTournament.avatarId = freshUser.avatarId;
                userInTournament.borderId = freshUser.borderId;
            }

            tournamentService.startNextRound(tournamentState, freshUser);
            
            await db.updateUser(freshUser);
            
            if (!volatileState.activeTournaments) volatileState.activeTournaments = {};
            volatileState.activeTournaments[user.id] = tournamentState;

            return {};
        }

        case 'SKIP_TOURNAMENT_END': {
            const { type } = payload as { type: TournamentType };
            let stateKey: keyof User;
            switch (type) {
                case 'neighborhood': stateKey = 'lastNeighborhoodTournament'; break;
                case 'national': stateKey = 'lastNationalTournament'; break;
                case 'world': stateKey = 'lastWorldTournament'; break;
                default: return { error: 'Invalid tournament type.' };
            }
            
            const freshUser = await db.getUser(user.id);
            if (!freshUser) return { error: 'User not found' };
        
            const tournamentState = (freshUser as any)[stateKey] as TournamentState | null;
            if (!tournamentState) return { error: '토너먼트 정보를 찾을 수 없습니다.' };
            
            if (tournamentState) {
                tournamentService.skipToResults(tournamentState, user.id);
            
                (freshUser as any)[stateKey] = tournamentState;
                await db.updateUser(freshUser);
        
                if (volatileState.activeTournaments?.[user.id]) {
                    delete volatileState.activeTournaments[user.id];
                }
            }
            
            return {};
        }
        
        case 'FORFEIT_TOURNAMENT': {
            const { type } = payload as { type: TournamentType };
            let stateKey: keyof User;
            switch (type) {
                case 'neighborhood': stateKey = 'lastNeighborhoodTournament'; break;
                case 'national': stateKey = 'lastNationalTournament'; break;
                case 'world': stateKey = 'lastWorldTournament'; break;
                default: return { error: 'Invalid tournament type.' };
            }
            let tournamentState: TournamentState | null | undefined = volatileState.activeTournaments?.[user.id];

            if (!tournamentState) {
                tournamentState = (user as any)[stateKey] as TournamentState | null;
                 if (!tournamentState) return { error: '토너먼트 정보를 찾을 수 없습니다.' };
            }
            
            if (tournamentState) {
                tournamentService.forfeitTournament(tournamentState, user.id);
            
                (user as any)[stateKey] = tournamentState;
                await db.updateUser(user);

                if (volatileState.activeTournaments) {
                    delete volatileState.activeTournaments[user.id];
                }
            }
            
            return {};
        }

        case 'SAVE_TOURNAMENT_PROGRESS': {
            const { type } = payload as { type: TournamentType };
            const tournamentState = volatileState.activeTournaments?.[user.id];
            
            if (tournamentState) {
                let stateKey: keyof User;
                switch (type) {
                    case 'neighborhood': stateKey = 'lastNeighborhoodTournament'; break;
                    case 'national': stateKey = 'lastNationalTournament'; break;
                    case 'world': stateKey = 'lastWorldTournament'; break;
                    default: return { error: 'Invalid tournament type.' };
                }
                (user as any)[stateKey] = tournamentState;
                await db.updateUser(user);
                if (volatileState.activeTournaments) {
                    delete volatileState.activeTournaments[user.id];
                }
            }
            return {};
        }

        case 'CLEAR_TOURNAMENT_SESSION': {
            const { type } = payload as { type?: TournamentType };
            if (type) {
                let stateKey: keyof User;
                switch (type) {
                    case 'neighborhood': stateKey = 'lastNeighborhoodTournament'; break;
                    case 'national': stateKey = 'lastNationalTournament'; break;
                    case 'world': stateKey = 'lastWorldTournament'; break;
                    default: return { error: 'Invalid tournament type.' };
                }
                (user as any)[stateKey] = null;
            } else {
                user.lastNeighborhoodTournament = null;
                user.lastNationalTournament = null;
                user.lastWorldTournament = null;
            }
            
            if (volatileState.activeTournaments?.[user.id]) {
                if (!type || volatileState.activeTournaments[user.id].type === type) {
                    delete volatileState.activeTournaments[user.id];
                }
            }

            await db.updateUser(user);
            return {};
        }
        case 'USE_CONDITION_POTION': {
            const { tournamentType, matchId, itemName } = payload;
            
            let stateKey: keyof User;
            switch (tournamentType) {
                case 'neighborhood': stateKey = 'lastNeighborhoodTournament'; break;
                case 'national': stateKey = 'lastNationalTournament'; break;
                case 'world': stateKey = 'lastWorldTournament'; break;
                default: return { error: 'Invalid tournament type.' };
            }

            const tournamentState = (user as any)[stateKey] as TournamentState | null;
            if (!tournamentState) return { error: '토너먼트 정보를 찾을 수 없습니다.' };

            const playerInTournament = tournamentState.players.find(p => p.id === user.id);
            if (!playerInTournament) return { error: '토너먼트에서 플레이어를 찾을 수 없습니다.' };
            
            let match: Match | undefined;
            for(const round of tournamentState.rounds) {
                match = round.matches.find(m => m.id === matchId);
                if(match) break;
            }
            
            if (!match || !match.isUserMatch || match.isFinished) return { error: '물약을 사용할 수 없는 경기입니다.' };

            if(match.potionUsed?.[user.id]) return { error: '이 경기에는 이미 물약을 사용했습니다.' };

            if (playerInTournament.condition >= 100) return { error: '컨디션이 이미 최대입니다.' };
            
            const itemIndex = user.inventory.findIndex(i => i.name === itemName);
            if (itemIndex === -1) return { error: '보유하지 않은 물약입니다.' };

            const item = user.inventory[itemIndex];
            if (item.quantity && item.quantity > 1) {
                item.quantity--;
            } else {
                user.inventory.splice(itemIndex, 1);
            }

            let recovery = 0;
            if (itemName === '컨디션 물약(소)') recovery = getRandomInt(1, 5);
            else if (itemName === '컨디션 물약(중)') recovery = getRandomInt(5, 10);
            else if (itemName === '컨디션 물약(대)') recovery = getRandomInt(10, 20);

            playerInTournament.condition = Math.min(100, playerInTournament.condition + recovery);
            
            if(!match.potionUsed) match.potionUsed = {};
            match.potionUsed[user.id] = true;

            if(!match.conditionBoost) match.conditionBoost = {};
            match.conditionBoost[user.id] = recovery;

            if (!match.commentary) match.commentary = [];
            match.commentary.push({
                text: `[시스템] ${user.nickname}님이 ${itemName}을(를) 사용하여 컨디션이 ${recovery}만큼 회복되었습니다. (현재: ${playerInTournament.condition})`,
                phase: 'early',
                isRandomEvent: true,
            });

            await db.updateUser(user);

            return { clientResponse: { updatedUser: user } };
        }
        default:
            return { error: 'Unknown tournament action.' };
    }
};

const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const LEAGUE_BOT_STATS: Record<LeagueTier, number> = {
    [LeagueTier.Sprout]: 120,
    [LeagueTier.Rookie]: 200,
    [LeagueTier.Rising]: 300,
    [LeagueTier.Ace]: 350,
    [LeagueTier.Diamond]: 450,
    [LeagueTier.Master]: 600,
    [LeagueTier.Grandmaster]: 700,
    [LeagueTier.Challenger]: 900,
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
        stats[key] = finalStatValue;
    }
    return stats as Record<CoreStat, number>;
};