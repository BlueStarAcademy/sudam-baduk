// utils/tournamentUtils.ts
import { PlayerForTournament, TournamentState } from '../types/index.js';

export const calculateRanks = (tournament: TournamentState): (PlayerForTournament & { rank: number })[] => {
    const playerWins: Record<string, number> = {};
    tournament.players.forEach(p => { playerWins[p.id] = p.wins; });
    
    const sortedPlayers = [...tournament.players].sort((a, b) => playerWins[b.id] - playerWins[a.id]);
    
    let rankedPlayers: (PlayerForTournament & { rank: number })[] = [];
    let currentRank = 0;
    let lastWins = -1;

    sortedPlayers.forEach((p, i) => {
        if (playerWins[p.id] !== lastWins) {
            currentRank = i + 1;
        }
        rankedPlayers.push({ ...p, rank: currentRank });
        lastWins = playerWins[p.id];
    });

    return rankedPlayers;
};
