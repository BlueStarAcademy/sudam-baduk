import { randomUUID } from 'crypto';
import * as db from './db.js';
import { type ServerAction, type User, type VolatileState, TournamentType, PlayerForTournament, InventoryItem, InventoryItemType, TournamentState, LeagueTier, CoreStat, Guild, Round, Match, CommentaryLine } from '../types/index.js';
import * as types from '../types/index.js';
import { TOURNAMENT_DEFINITIONS, BASE_TOURNAMENT_REWARDS, CONSUMABLE_ITEMS, MATERIAL_ITEMS, TOURNAMENT_SCORE_REWARDS, BOT_NAMES, AVATAR_POOL } from '../constants/index.js';
import { updateQuestProgress } from './questService.js';
import { createItemFromTemplate, SHOP_ITEMS } from './shop.js';
import { isSameDayKST } from '../utils/timeUtils.js';
import { addItemsToInventory, createItemInstancesFromReward } from '../utils/inventoryUtils.js';
import { calculateTotalStats } from './services/statService.js';
import { handleRewardAction } from './actions/rewardActions.js';


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

const getCommentary = (p1: PlayerForTournament, p2: PlayerForTournament, p1Score: number, p2Score: number, phase: 'early' | 'mid' | 'end'): CommentaryLine => {
    const diff = Math.abs(p1Score - p2Score);
    const leadingPlayer = p1Score > p2Score ? p1 : p2;
    const trailingPlayer = p1Score > p2Score ? p2 : p1;
    
    if (phase === 'early') {
        if (diff < 5) return { text: "팽팽한 초반 탐색전이 이어집니다.", phase };
        return { text: `${leadingPlayer.nickname} 선수가 초반부터 기세를 잡아갑니다.`, phase };
    }
    if (phase === 'mid') {
        if (diff < 10) return { text: "치열한 중반 전투가 계속됩니다.", phase };
        if (diff > 30) return { text: `${leadingPlayer.nickname} 선수가 완벽한 운영으로 격차를 벌립니다.`, phase };
        return { text: `${leadingPlayer.nickname} 선수가 조금씩 우세를 점하고 있습니다.`, phase };
    }
    // end phase
    if (diff < 15) return { text: "끝까지 알 수 없는 미세한 승부입니다.", phase };
    if (diff > 50) return { text: `승부가 거의 결정되었습니다. ${leadingPlayer.nickname} 선수의 압도적인 경기력!`, phase };
    return { text: `격차를 좁히기 어려운 상황, ${leadingPlayer.nickname} 선수의 승리가 유력합니다.`, phase };
};

const simulateMatch = (p1: PlayerForTournament, p2: PlayerForTournament, tournamentType: TournamentType): { winner: PlayerForTournament, loser: PlayerForTournament, commentary: CommentaryLine[], finalScore: { player1: number, player2: number } } => {
    const commentary: CommentaryLine[] = [];
    let p1Score = 0;
    let p2Score = 0;

    const phases: ('early' | 'mid' | 'end')[] = ['early', 'mid', 'end'];
    for (const phase of phases) {
        const p1PhaseScore = (p1.stats[CoreStat.Concentration] * 0.2) + 
                             (phase === 'early' ? p1.stats[CoreStat.ThinkingSpeed] * 0.4 + p1.stats[CoreStat.CombatPower] * 0.4 : 0) +
                             (phase === 'mid' ? p1.stats[CoreStat.Judgment] * 0.5 + p1.stats[CoreStat.Stability] * 0.3 : 0) +
                             (phase === 'end' ? p1.stats[CoreStat.Calculation] * 0.6 + p1.stats[CoreStat.Stability] * 0.2 : 0);
        const p2PhaseScore = (p2.stats[CoreStat.Concentration] * 0.2) + 
                             (phase === 'early' ? p2.stats[CoreStat.ThinkingSpeed] * 0.4 + p2.stats[CoreStat.CombatPower] * 0.4 : 0) +
                             (phase === 'mid' ? p2.stats[CoreStat.Judgment] * 0.5 + p2.stats[CoreStat.Stability] * 0.3 : 0) +
                             (phase === 'end' ? p2.stats[CoreStat.Calculation] * 0.6 + p2.stats[CoreStat.Stability] * 0.2 : 0);
        
        p1Score += p1PhaseScore * (1 + (Math.random() - 0.5) * 0.2); // +-10% randomness
        p2Score += p2PhaseScore * (1 + (Math.random() - 0.5) * 0.2);
        
        commentary.push(getCommentary(p1, p2, p1Score, p2Score, phase));
    }

    const winner = p1Score > p2Score ? p1 : p2;
    const loser = p1Score > p2Score ? p2 : p1;
    
    commentary.push({ text: `[최종결과] ${winner.nickname} 선수 승리!`, phase: 'end' });
    
    return { winner, loser, commentary, finalScore: { player1: Math.round(p1Score), player2: Math.round(p2Score) } };
};


export const createTournament = (type: TournamentType, user: User, players: PlayerForTournament[], guilds: Record<string, Guild>): TournamentState => {
    const definition = TOURNAMENT_DEFINITIONS[type];
    if (!definition) throw new Error("Invalid tournament type");

    let rounds: Round[] = [];
    if (type === TournamentType.Neighborhood) { // Round Robin
        const matches: Match[] = [];
        for (let i = 0; i < players.length; i++) {
            for (let j = i + 1; j < players.length; j++) {
                matches.push({
                    id: `match-${randomUUID()}`,
                    players: [players[i], players[j]],
                    winner: null,
                    isFinished: false,
                    commentary: [],
                    isUserMatch: players[i].id === user.id || players[j].id === user.id,
                    finalScore: null,
                });
            }
        }
        rounds.push({ id: 1, name: '풀리그', matches });
    } else { // Single Elimination
        let currentPlayers = [...players];
        let roundIndex = 0;
        let roundNames = type === TournamentType.World ? ['16강', '8강', '4강'] : ['8강', '4강'];
        
        while (currentPlayers.length > 2) {
            const matches: Match[] = [];
            for (let i = 0; i < currentPlayers.length; i += 2) {
                matches.push({
                    id: `match-${randomUUID()}`,
                    players: [currentPlayers[i], currentPlayers[i+1] || null],
                    winner: null,
                    isFinished: false,
                    commentary: [],
                    isUserMatch: currentPlayers[i]?.id === user.id || currentPlayers[i+1]?.id === user.id,
                    finalScore: null,
                });
            }
            rounds.push({ id: roundIndex, name: roundNames[roundIndex] || `Round ${roundIndex + 1}`, matches });
            currentPlayers = matches.map(() => null as any); // Prepare for next round winners
            roundIndex++;
        }
        rounds.push({ id: roundIndex, name: '결승', matches: [] });
        if (type !== TournamentType.World) {
            rounds.push({ id: roundIndex + 1, name: '3,4위전', matches: [] });
        }
    }

    return {
        type,
        status: 'bracket_ready',
        title: definition.name,
        players,
        rounds,
        currentSimulatingMatch: null,
        currentMatchCommentary: [],
        lastPlayedDate: Date.now(),
        timeElapsed: 0,
    };
};

const processRoundRobin = (state: TournamentState, guilds: Record<string, Guild>, allUsers: User[]) => {
    const round = state.rounds[0];
    if (!round) return;

    for (let i = 0; i < round.matches.length; i++) {
        const match = round.matches[i];
        if (match.isFinished) continue;

        const [p1, p2] = match.players;
        if (!p1 || !p2) {
            match.isFinished = true;
            continue;
        }
        
        // Update player stats before simulation
        [p1, p2].forEach(playerInMatch => {
            if (!playerInMatch.id.startsWith('bot-')) {
                const freshUser = allUsers.find(u => u.id === playerInMatch.id);
                const tournamentPlayer = state.players.find(p => p.id === playerInMatch.id);
                if (freshUser && tournamentPlayer) {
                    const guild = freshUser.guildId ? guilds[freshUser.guildId] : null;
                    const newStats = calculateTotalStats(freshUser, guild);
                    tournamentPlayer.stats = { ...newStats };
                    tournamentPlayer.originalStats = { ...newStats };
                }
            }
        });

        const result = simulateMatch(p1, p2, state.type);
        match.winner = result.winner;
        match.commentary = result.commentary;
        match.finalScore = result.finalScore;
        match.isFinished = true;
        
        const winnerInPlayers = state.players.find(p => p.id === result.winner.id);
        const loserInPlayers = state.players.find(p => p.id === result.loser.id);

        if (winnerInPlayers) winnerInPlayers.wins++;
        if (loserInPlayers) loserInPlayers.losses++;
    }
    state.status = 'complete';
};

const processTournament = (state: TournamentState, guilds: Record<string, Guild>, allUsers: User[]) => {
    let currentRoundIndex = state.rounds.findIndex(r => r.matches.some(m => !m.isFinished));
    if (currentRoundIndex === -1) {
         currentRoundIndex = state.rounds.findIndex(r => r.matches.length === 0);
    }
    if (currentRoundIndex === -1) {
        state.status = 'complete';
        return;
    }
    let currentRound = state.rounds[currentRoundIndex];
    if (currentRound.matches.length === 0 && (currentRound.name === '결승' || currentRound.name === '3,4위전')) {
        const semifinalRound = state.rounds[currentRoundIndex - 1];
        if (!semifinalRound) { state.status = 'complete'; return; }
        const winners = semifinalRound.matches.map(m => m.winner).filter((p): p is PlayerForTournament => p !== null);
        const losers = semifinalRound.matches.map(m => m.players.find(p => p && p.id !== m.winner?.id) || null).filter((p): p is PlayerForTournament => p !== null);
        
        if (currentRound.name === '결승' && winners.length >= 2) {
             const userInMatch = winners.some(p => allUsers.some(u => u.id === p.id));
             currentRound.matches.push({ id: `match-${randomUUID()}`, players: [winners[0], winners[1]], winner: null, isFinished: false, commentary: [], isUserMatch: userInMatch, finalScore: null });
        }
        if (currentRound.name === '3,4위전' && losers.length >= 2) {
             const userInMatch = losers.some(p => allUsers.some(u => u.id === p.id));
             currentRound.matches.push({ id: `match-${randomUUID()}`, players: [losers[0], losers[1]], winner: null, isFinished: false, commentary: [], isUserMatch: userInMatch, finalScore: null });
        }
    }
    
    for (const match of currentRound.matches) {
        if (match.isFinished) continue;
        const [p1, p2] = match.players;
        if (!p1) { match.winner = p2; match.isFinished = true; continue; }
        if (!p2) { match.winner = p1; match.isFinished = true; continue; }

        [p1, p2].forEach(playerInMatch => {
            if (!playerInMatch.id.startsWith('bot-')) {
                const freshUser = allUsers.find(u => u.id === playerInMatch.id);
                const tournamentPlayer = state.players.find(p => p.id === playerInMatch.id);
                if (freshUser && tournamentPlayer) {
                    const guild = freshUser.guildId ? guilds[freshUser.guildId] : null;
                    const newStats = calculateTotalStats(freshUser, guild);
                    tournamentPlayer.stats = { ...newStats };
                    tournamentPlayer.originalStats = { ...newStats };
                }
            }
        });

        const result = simulateMatch(p1, p2, state.type);
        match.winner = result.winner;
        match.commentary = result.commentary;
        match.finalScore = result.finalScore;
        match.isFinished = true;
    }

    const nextRoundIndex = currentRoundIndex + 1;
    if (nextRoundIndex < state.rounds.length) {
        const winners = currentRound.matches.map(m => m.winner);
        const nextRound = state.rounds[nextRoundIndex];
        
        if (nextRound.name !== '결승' && nextRound.name !== '3,4위전') {
             for (let i = 0; i < winners.length; i += 2) {
                const nextMatchIndex = i / 2;
                if (nextRound.matches[nextMatchIndex]) {
                    nextRound.matches[nextMatchIndex].players = [winners[i], winners[i+1] || null];
                }
            }
        }
    } else {
        state.status = 'complete';
    }
};

export const startNextRound = (state: TournamentState, guilds: Record<string, Guild>, allUsers: User[]) => {
    if (state.status === 'round_in_progress') return;

    state.status = 'round_in_progress';
    state.currentSimulatingMatch = { roundIndex: 0, matchIndex: 0 };
    state.timeElapsed = 0;
    state.currentMatchCommentary = [];
    
    // Reset condition at the start of each round, not the entire tournament
    state.players.forEach(p => p.condition = 100);

    if (state.type === TournamentType.Neighborhood) {
        processRoundRobin(state, guilds, allUsers);
    } else {
        processTournament(state, guilds, allUsers);
    }
    
    if (state.rounds.every(r => r.matches.every(m => m.isFinished))) {
        state.status = 'complete';
    } else {
        state.status = 'round_complete';
    }
};

export const skipToResults = (state: TournamentState, userId: string, guilds: Record<string, Guild>, allUsers: User[]) => {
    // The while loop condition `state.status !== 'complete' && state.status !== 'eliminated'`
    // can cause a TypeScript control flow analysis error. By rewriting this as a `for` loop
    // with a safety break and explicit checks inside, we avoid this limitation.
    for (let i = 0; i < 10; i++) { // Safety break for a maximum of 10 rounds
        // FIX: Add type assertion to bypass incorrect type narrowing by TypeScript's control flow analysis within the loop.
        if ((state.status as types.TournamentState['status']) === 'complete' || (state.status as types.TournamentState['status']) === 'eliminated') {
            break;
        }

        startNextRound(state, guilds, allUsers); // This function mutates state.status

        // After mutation, check again
        if (state.status === 'complete' || state.status === 'eliminated') {
            continue;
        }

        const userIsInNextRound = state.rounds.some(r => r.matches.some(m => !m.isFinished && m.players.some(p => p?.id === userId)));
        if (!userIsInNextRound) {
            state.status = 'eliminated';
        }
    }
};
        
export const forfeitTournament = (state: TournamentState, userId: string, guilds: Record<string, Guild>, allUsers: User[]) => {
    for (const round of state.rounds) {
        for (const match of round.matches) {
            if (match.isUserMatch && !match.isFinished) {
                const opponent = match.players.find(p => p && p.id !== userId);
                match.isFinished = true;
                match.winner = opponent || null;
                match.commentary = [{ text: `${opponent?.nickname || '상대'}의 기권승.`, phase: 'start' }];
                const loser = state.players.find(p => p.id === userId);
                if (loser) loser.losses++;
                if (opponent) {
                    const winner = state.players.find(p => p.id === opponent.id);
                    if (winner) winner.wins++;
                }
            }
        }
    }
    state.status = 'eliminated';
    skipToResults(state, userId, guilds, allUsers);
};