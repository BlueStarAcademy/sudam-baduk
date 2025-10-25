
import { randomUUID } from 'crypto';
import * as db from './db.js';
import type { Request, Response, NextFunction } from 'express';
import { type ServerAction, type User, type VolatileState, TournamentType, PlayerForTournament, InventoryItem, InventoryItemType, TournamentState, LeagueTier, CoreStat, Guild, Round, Match, CommentaryLine } from '.././types/index.js';
import { TOURNAMENT_DEFINITIONS, BASE_TOURNAMENT_REWARDS, CONSUMABLE_ITEMS, MATERIAL_ITEMS, TOURNAMENT_SCORE_REWARDS, BOT_NAMES, AVATAR_POOL } from '../constants/index.js';
import { updateQuestProgress } from './questService.js';
import { createItemFromTemplate, SHOP_ITEMS } from './shop.js';
import { isSameDayKST } from '../utils/timeUtils.js';
import * as tournamentService from './tournamentService.js';
import { addItemsToInventory, createItemInstancesFromReward } from '../utils/inventoryUtils.js';
import { calculateTotalStats } from './services/statService.js';
import { handleRewardAction } from './actions/rewardActions.js';

export const getTournamentStateKey = (type: TournamentType): keyof User => {
    return `last${type.charAt(0).toUpperCase() + type.slice(1)}Tournament` as keyof User;
};

export const getTournamentPlayedDateKey = (type: TournamentType): keyof User => {
    return `last${type.charAt(0).toUpperCase() + type.slice(1)}PlayedDate` as keyof User;
};

const createBotForTournament = (league: LeagueTier, tournamentType: TournamentType, botId: string): PlayerForTournament => {
    const botStats = createBotStats(league, tournamentType);
    const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    const botAvatar = AVATAR_POOL[Math.floor(Math.random() * AVATAR_POOL.length)];

    return {
        id: `bot-${botId}`,
        nickname: botName,
        stats: botStats,
        originalStats: JSON.parse(JSON.stringify(botStats)),
        wins: 0,
        losses: 0,
        league: league,
        avatarId: botAvatar.id,
        borderId: 'border_001', 
        condition: 100,
        isBot: true,
    };
};

export const generateParticipants = (user: User, type: TournamentType, allUsers: User[], guilds: Record<string, Guild>): PlayerForTournament[] => {
    const definition = TOURNAMENT_DEFINITIONS[type];
    const userLeague = user.league || LeagueTier.Sprout;

    const userAsParticipant: PlayerForTournament = {
        id: user.id,
        nickname: user.nickname,
        stats: calculateTotalStats(user, user.guildId ? guilds[user.guildId] : null),
        originalStats: calculateTotalStats(user, user.guildId ? guilds[user.guildId] : null),
        wins: 0,
        losses: 0,
        league: userLeague,
        avatarId: user.avatarId,
        borderId: user.borderId,
        condition: 100,
    };

    const participants: PlayerForTournament[] = [userAsParticipant];
    const numBots = definition.players - 1;

    for (let i = 0; i < numBots; i++) {
        const botLeague = userLeague;
        participants.push(createBotForTournament(botLeague, type, `${type}-${i}`));
    }

    return participants.sort(() => Math.random() - 0.5);
};


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


const createMatchesForRoundRobin = (players: PlayerForTournament[]): Match[] => {
    const matches: Match[] = [];
    for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
            matches.push({
                id: `match-${players[i].id}-${players[j].id}`,
                players: [players[i], players[j]],
                winner: null,
                isFinished: false,
                commentary: [],
                isUserMatch: !players[i].id.startsWith('bot-') && !players[j].id.startsWith('bot-'),
                sgfFileIndex: Math.floor(Math.random() * 200) + 1,
                finalScore: null,
            });
        }
    }
    return matches;
};

const createMatchesForTournament = (players: PlayerForTournament[]): Match[] => {
    const matches: Match[] = [];
    for (let i = 0; i < players.length; i += 2) {
        const p1 = players[i];
        const p2 = players[i + 1] || null;
        matches.push({
            id: `match-${p1.id}-${p2?.id || 'bye'}`,
            players: [p1, p2],
            winner: p2 === null ? p1 : null,
            isFinished: p2 === null,
            commentary: [],
            isUserMatch: !p1.id.startsWith('bot-') && (p2 ? !p2.id.startsWith('bot-') : false),
            sgfFileIndex: Math.floor(Math.random() * 200) + 1,
            finalScore: null,
        });
    }
    return matches;
};

export const createTournament = (type: TournamentType, user: User, participants: PlayerForTournament[], guilds: Record<string, Guild>): TournamentState => {
    const definition = TOURNAMENT_DEFINITIONS[type];
    let rounds: Round[] = [];
    
    if (definition.format === 'round-robin') {
        rounds.push({
            id: 1,
            name: '풀리그',
            matches: createMatchesForRoundRobin(participants)
        });
    } else { // tournament
        rounds.push({
            id: 1,
            name: `${definition.players}강`,
            matches: createMatchesForTournament(participants)
        });
    }

    return {
        type,
        status: 'bracket_ready',
        title: definition.name,
        players: participants,
        rounds,
        currentSimulatingMatch: null,
        currentMatchCommentary: [],
        lastPlayedDate: Date.now(),
        timeElapsed: 0,
    };
};

export const startNextRound = (tournamentState: TournamentState, guilds: Record<string, Guild>, allUsers: User[]) => {
    tournamentState.status = 'round_in_progress';
};

export const skipToResults = (tournamentState: TournamentState, userId: string, guilds: Record<string, Guild>, allUsers: User[]) => {
     tournamentState.status = 'complete'; 
};

export const forfeitTournament = (tournamentState: TournamentState, userId: string, guilds: Record<string, Guild>, allUsers: User[]) => {
    tournamentState.status = 'eliminated';
    const userInTournament = tournamentState.players.find(p => p.id === userId);
    if (userInTournament) {
        userInTournament.losses = 99;
    }
};
