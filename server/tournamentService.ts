import { TournamentState, PlayerForTournament, CoreStat, CommentaryLine, Match, User, Round, TournamentType, LeagueTier, VolatileState, ServerAction, HandleActionResult } from '../types.js';
import { calculateTotalStats } from './statService.js';
import { randomUUID } from 'crypto';
import { TOURNAMENT_DEFINITIONS, BASE_TOURNAMENT_REWARDS, CONSUMABLE_ITEMS, BOT_NAMES, AVATAR_POOL, BORDER_POOL, CORE_STATS_DATA, LEAGUE_DATA } from '../constants.js';
import { updateQuestProgress } from './questService.js';

const EARLY_GAME_DURATION = 40;
const MID_GAME_DURATION = 60;
const END_GAME_DURATION = 40;
const TOTAL_GAME_DURATION = EARLY_GAME_DURATION + MID_GAME_DURATION + END_GAME_DURATION;

type RandomEventDetails = NonNullable<CommentaryLine['randomEventDetails']>;

const STAT_WEIGHTS: Record<'early' | 'mid' | 'end', Partial<Record<CoreStat, number>>> = {
    early: {
        [CoreStat.CombatPower]: 0.4,
        [CoreStat.ThinkingSpeed]: 0.3,
        [CoreStat.Concentration]: 0.3,
    },
    mid: {
        [CoreStat.CombatPower]: 0.3,
        [CoreStat.Judgment]: 0.3,
        [CoreStat.Concentration]: 0.2,
        [CoreStat.Stability]: 0.2,
    },
    end: {
        [CoreStat.Calculation]: 0.5,
        [CoreStat.Stability]: 0.3,
        [CoreStat.Concentration]: 0.2,
    },
};

const COMMENTARY_POOLS = {
    start: "{p1}님과 {p2}님의 대국이 시작되었습니다.",
    general: [
        "{player} 선수, 초반부터 강하게 밀어붙입니다!",
        "차분한 시작, 서로의 의도를 탐색하고 있습니다.",
        "초반 포석 싸움이 치열합니다. 누가 기선을 제압할까요?",
        "예상치 못한 착점! {player} 선수의 노림수는 무엇일까요?",
        "견실한 행마로 안정적인 형태를 갖추는 {player} 선수.",
        "중앙에서 격렬한 전투가 벌어집니다!",
        "두 선수의 수읽기 대결이 손에 땀을 쥐게 합니다.",
        "{player} 선수, 날카로운 수로 상대의 약점을 파고듭니다.",
        "불리했던 형세, {player} 선수가 끈질기게 따라붙습니다.",
        "대마의 생사가 걸린 중요한 순간입니다!",
        "이제 끝내기 승부입니다. 작은 차이가 승패를 가릅니다.",
        "{player} 선수, 정확한 계산으로 집 차이를 벌려나갑니다.",
        "마지막까지 방심할 수 없는 접전이 이어집니다.",
        "패싸움이 승부의 분수령이 될 것 같습니다.",
        "{player} 선수, 냉정하게 마무리에 들어갑니다.",
    ],
    score: [
        "[중간 스코어] {leader} 선수 {scoreDiff}집 우세.",
        "[중간 스코어] 팽팽한 형세, 계가가 필요합니다.",
        "[중간 스코어] {leader} 쪽으로 미세하게 기웁니다.",
    ],
    win: [
        "냉정한 판단으로 끝까지 우세를 유지하며 승리를 거머쥡니다.",
        "혼신의 집중력으로 극적인 역전을 만들어냅니다!",
        "안정적인 운영으로 상대를 압도하며 대국을 마무리합니다.",
        "치열한 접전 끝에 승자는 웃고, 패자는 아쉬움을 삼킵니다."
    ]
};

const getPhase = (time: number): 'early' | 'mid' | 'end' => {
    if (time <= EARLY_GAME_DURATION) return 'early';
    if (time <= EARLY_GAME_DURATION + MID_GAME_DURATION) return 'mid';
    return 'end';
};

const getMaxStatValueForLeague = (league: LeagueTier): number => {
    switch (league) {
        case LeagueTier.Sprout:
        case LeagueTier.Rookie:
        case LeagueTier.Rising:
            return 250;
        case LeagueTier.Ace:
        case LeagueTier.Diamond:
            return 300;
        case LeagueTier.Master:
            return 500;
        case LeagueTier.Grandmaster:
        case LeagueTier.Challenger:
            return 9999;
        default:
            return 250;
    }
};

const calculatePower = (player: PlayerForTournament, phase: 'early' | 'mid' | 'end') => {
    const weights = STAT_WEIGHTS[phase];
    const statCap = getMaxStatValueForLeague(player.league);
    let power = 0;
    for (const stat in weights) {
        const statKey = stat as CoreStat;
        const weight = weights[statKey]!;
        const statValue = Math.min(player.stats[statKey] || 0, statCap);
        power += statValue * weight;
    }
    const conditionModifier = (player.condition || 100) / 100;
    return (power) * conditionModifier;
};

const getRandomEvent = (p1: PlayerForTournament, p2: PlayerForTournament): { winner: PlayerForTournament; loser: PlayerForTournament; house: number; commentary: string; details: Omit<RandomEventDetails, 'score_change'> } | null => {
    const events: { stat: CoreStat; type: RandomEventDetails['type']; commentary: string; }[] = [
        { stat: CoreStat.Concentration, type: 'aggressive', commentary: "{player} 선수, 놀라운 집중력으로 묘수를 찾아냅니다!" },
        { stat: CoreStat.ThinkingSpeed, type: 'aggressive', commentary: "{player} 선수, 빠른 판단으로 상대의 허를 찌릅니다!" },
        { stat: CoreStat.Judgment, type: 'pressure', commentary: "{player} 선수, 정확한 형세 판단으로 우위를 점합니다!" },
        { stat: CoreStat.Calculation, type: 'aggressive', commentary: "{player} 선수, 날카로운 계산으로 끝내기에서 이득을 봅니다!" },
        { stat: CoreStat.CombatPower, type: 'aggressive', commentary: "{player} 선수, 강력한 전투력으로 상대를 압박합니다!" },
        { stat: CoreStat.Stability, type: 'defense', commentary: "{player} 선수, 안정적인 수비로 상대의 공격을 무력화시킵니다!" },
    ];

    const event = events[Math.floor(Math.random() * events.length)];
    const p1Stat = p1.stats[event.stat] || 100;
    const p2Stat = p2.stats[event.stat] || 100;
    const totalStat = p1Stat + p2Stat;
    
    let winner: PlayerForTournament, loser: PlayerForTournament;
    if (Math.random() * totalStat < p1Stat) {
        winner = p1;
        loser = p2;
    } else {
        winner = p2;
        loser = p1;
    }

    const house = Math.floor(Math.random() * 5) + 1;
    
    const details: Omit<RandomEventDetails, 'score_change'> = {
        type: event.type,
        stat: event.stat,
        p1_id: p1.id,
        p2_id: p2.id,
        p1_stat: p1Stat,
        p2_stat: p2Stat,
        player_id: winner.id,
    };

    return { winner, loser, house, commentary: event.commentary, details };
};

const finishMatch = (
    match: Match,
    p1: PlayerForTournament,
    p2: PlayerForTournament,
    p1Cumulative: number,
    p2Cumulative: number
): { finalCommentary: CommentaryLine[]; winner: PlayerForTournament; } => {
    const totalCumulative = p1Cumulative + p2Cumulative;
    const p1Percent = totalCumulative > 0 ? (p1Cumulative / totalCumulative) * 100 : 50;

    let winner: PlayerForTournament;
    let commentaryText: string;

    const diffPercent = Math.abs(p1Percent - 50) * 2;
    const scoreDiff = (diffPercent / 2);
    const roundedDiff = Math.round(scoreDiff);
    const finalDiff = roundedDiff + 0.5;

    if (finalDiff < 0.5) { 
        winner = Math.random() < 0.5 ? p1 : p2;
        commentaryText = `[최종결과] ${winner.nickname}, 0.5집 승리!`;
    } else {
        winner = p1Percent > 50 ? p1 : p2;
        commentaryText = `[최종결과] ${winner.nickname}, ${finalDiff.toFixed(1)}집 승리!`;
    }
    
    const winComment = COMMENTARY_POOLS.win[Math.floor(Math.random() * COMMENTARY_POOLS.win.length)].replace('{winner}', winner.nickname);
    
    return {
        finalCommentary: [
            { text: commentaryText, phase: 'end', isRandomEvent: false },
            { text: winComment, phase: 'end', isRandomEvent: false }
        ],
        winner,
    };
};

const simulateAndFinishMatch = (match: Match, players: PlayerForTournament[]) => {
    if (match.isFinished) return;
    if (!match.players[0] || !match.players[1]) {
        match.winner = match.players[0] || null;
        match.isFinished = true;
        return;
    }

    const p1 = players.find(p => p.id === match.players[0]!.id)!;
    const p2 = players.find(p => p.id === match.players[1]!.id)!;
    
    if (p1.originalStats) {
        p1.stats = JSON.parse(JSON.stringify(p1.originalStats));
    }
    if (p2.originalStats) {
        p2.stats = JSON.parse(JSON.stringify(p2.originalStats));
    }

    p1.condition = Math.floor(Math.random() * 61) + 40; // 40-100
    p2.condition = Math.floor(Math.random() * 61) + 40; // 40-100

    let p1CumulativeScore = 0;
    let p2CumulativeScore = 0;

    for (let t = 1; t <= TOTAL_GAME_DURATION; t++) {
        const phase = getPhase(t);
        p1CumulativeScore += calculatePower(p1, phase);
        p2CumulativeScore += calculatePower(p2, phase);
    }
    
    const { winner } = finishMatch(match, p1, p2, p1CumulativeScore, p2CumulativeScore);
    
    match.winner = winner;
    match.isFinished = true;
    
    const totalScore = p1CumulativeScore + p2CumulativeScore;
    const p1Percent = totalScore > 0 ? (p1CumulativeScore / totalScore) * 100 : 50;
    match.finalScore = { player1: p1Percent, player2: 100 - p1Percent };

    match.commentary = [{text: "경기가 자동으로 진행되었습니다.", phase: 'end', isRandomEvent: false}];
};

const prepareNextRound = (state: TournamentState, user: User) => {
    const lastRound = state.rounds[state.rounds.length - 1];
    if (lastRound.matches.every(m => m.isFinished)) {
        const winners = lastRound.matches.map(m => m.winner).filter(Boolean) as PlayerForTournament[];
        
        // Set condition for winners advancing to the next round
        winners.forEach(winner => {
            const playerInState = state.players.find(p => p.id === winner.id);
            if (playerInState) {
                playerInState.condition = Math.floor(Math.random() * 61) + 40; // 40-100
            }
        });

        if (winners.length > 1) {
            if (winners.length === 2 && (state.type === 'national' || state.type === 'world') && lastRound.matches.length === 2) {
                const losers = lastRound.matches.map(m => m.players.find(p => p && p.id !== m.winner?.id)).filter(Boolean) as PlayerForTournament[];
                if (losers.length === 2) {
                    const thirdPlaceMatch: Match = {
                        id: `m-${state.rounds.length + 1}-3rd`,
                        players: [losers[0], losers[1]],
                        winner: null, isFinished: false, commentary: [],
                        isUserMatch: (losers[0]?.id === user.id || losers[1]?.id === user.id),
                        finalScore: null,
                        sgfFileIndex: Math.floor(Math.random() * 20) + 1,
                    };
                    state.rounds.push({ id: state.rounds.length + 1, name: "3,4위전", matches: [thirdPlaceMatch] });
                }
            }
            
            const nextRoundMatches: Match[] = [];
            for (let i = 0; i < winners.length; i += 2) {
                const p1 = winners[i];
                const p2 = winners[i + 1] || null;
                nextRoundMatches.push({
                    id: `m-${state.rounds.length + 1}-${i / 2}`,
                    players: [p1, p2],
                    winner: p2 === null ? p1 : null,
                    isFinished: !p2,
                    commentary: [],
                    isUserMatch: (p1?.id === user.id || p2?.id === user.id),
                    finalScore: null,
                    sgfFileIndex: Math.floor(Math.random() * 20) + 1,
                });
            }
            const roundName = winners.length === 2 ? "결승" : `${winners.length}강`;
            state.rounds.push({ id: state.rounds.length + 1, name: roundName, matches: nextRoundMatches });
        }
    }
};

const processMatchCompletion = (state: TournamentState, user: User, completedMatch: Match, roundIndex: number) => {
    state.currentSimulatingMatch = null;

    updateQuestProgress(user, 'tournament_match_played');

    completedMatch.players.forEach(p => {
        if (p) {
            const playerInState = state.players.find(player => player.id === p.id);
            if (playerInState) {
                if (playerInState.originalStats) {
                    playerInState.stats = JSON.parse(JSON.stringify(playerInState.originalStats));
                }
            }
        }
    });

    if (state.type === 'neighborhood') {
        const allMatchesInTournamentFinished = state.rounds[0].matches.every(m => m.isFinished);
        if (allMatchesInTournamentFinished) {
            state.status = 'complete';
        } else {
            state.status = 'round_complete';
             // Set condition for the user's NEXT match
            const nextUserMatch = state.rounds[0].matches.find(m => m.isUserMatch && !m.isFinished);
            if (nextUserMatch) {
                nextUserMatch.players.forEach(p => {
                    if (p) {
                        const playerInState = state.players.find(player => player.id === p.id);
                        if (playerInState) {
                            playerInState.condition = Math.floor(Math.random() * 61) + 40; // 40-100
                        }
                    }
                });
            }
        }
    } else { // Knockout tournament logic
        const userWon = completedMatch.winner?.id === user.id;

        if (!userWon) {
            state.status = 'eliminated';
            const currentRound = state.rounds[roundIndex];
            currentRound.matches.forEach(match => {
                if (!match.isFinished) {
                    simulateAndFinishMatch(match, state.players);
                }
            });
            for (let safety = 0; safety < 10; safety++) {
                const lastRound = state.rounds[state.rounds.length - 1];
                if (lastRound.matches.every(m => m.isFinished)) {
                    // FIX: Refactored complex chained expression to be safer and more readable.
                    const finalRound = state.rounds.find(r => r.name === '결승');
                    const isFinalOver = finalRound ? finalRound.matches.every(m => m.isFinished) : false;
                     if(isFinalOver) {
                         state.status = 'complete';
                         break;
                     }
                    prepareNextRound(state, user);
                    const nextRound = state.rounds[state.rounds.length - 1];
                    nextRound.matches.forEach(m => simulateAndFinishMatch(m, state.players));
                } else {
                     break;
                }
            }
        } else {
            state.status = 'round_complete';
            prepareNextRound(state, user);
        }
    }
};

export const createTournament = (type: TournamentType, user: User, players: PlayerForTournament[]): TournamentState => {
    const definition = TOURNAMENT_DEFINITIONS[type];
    const rounds: Round[] = [];
    
    players.forEach(p => p.condition = 1000); // Initialize with "not set"

    if (definition.format === 'tournament') {
        const matches: Match[] = [];
        for (let i = 0; i < players.length; i += 2) {
            const p1 = players[i];
            const p2 = players[i + 1] || null;
            matches.push({
                id: `m-1-${i / 2}`,
                players: [p1, p2],
                winner: p2 === null ? p1 : null,
                isFinished: !p2,
                commentary: [],
                isUserMatch: (p1?.id === user.id || p2?.id === user.id),
                finalScore: null,
                sgfFileIndex: Math.floor(Math.random() * 20) + 1,
            });
        }
        rounds.push({ id: 1, name: `${players.length}강`, matches });
    } else {
        const roundMatches: Match[] = [];
        const numPlayers = players.length;
        
        const schedule: [number, number][] = [];
        for (let i = 0; i < numPlayers; i++) {
            for (let j = i + 1; j < numPlayers; j++) {
                schedule.push([i, j]);
            }
        }

        schedule.forEach((pair, index) => {
            const p1 = players[pair[0]];
            const p2 = players[pair[1]];
            roundMatches.push({
                id: `m-1-${index}`,
                players: [p1, p2],
                winner: null, isFinished: false, commentary: [],
                isUserMatch: (p1.id === user.id || p2.id === user.id),
                finalScore: null,
                sgfFileIndex: Math.floor(Math.random() * 20) + 1,
            });
        });
        
        rounds.push({ id: 1, name: '풀리그', matches: roundMatches });
    }

    // Set initial condition for the user's first match
    const firstUserMatch = rounds.flatMap(r => r.matches).find(m => m.isUserMatch);
    if (firstUserMatch) {
        firstUserMatch.players.forEach(p => {
            if (p) {
                const playerInState = players.find(player => player.id === p.id);
                if (playerInState) {
                    playerInState.condition = Math.floor(Math.random() * 61) + 40; // 40-100
                }
            }
        });
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
        nextRoundStartTime: Date.now() + 5000,
        timeElapsed: 0,
    };
};

export const startNextRound = (state: TournamentState, user: User) => {
    if (state.status === 'round_in_progress') return;
    
    if (state.type === 'neighborhood') {
        if (state.status === 'bracket_ready') {
            state.currentRoundRobinRound = 1;
        } else if (state.status === 'round_complete') {
            state.currentRoundRobinRound = (state.currentRoundRobinRound || 0) + 1;
        }
    
        const currentRoundNum = state.currentRoundRobinRound || 1;
        if (currentRoundNum > 5) {
            state.status = 'complete';
            return;
        }
    
        const players = state.players;
        const schedule = [
            [[0, 5], [1, 4], [2, 3]], [[0, 4], [5, 3], [1, 2]], [[0, 3], [4, 2], [5, 1]],
            [[0, 2], [3, 1], [4, 5]], [[0, 1], [2, 5], [3, 4]],
        ];
        const roundPairings = schedule[currentRoundNum - 1];
        const matchesForThisRound = roundPairings.map(pair => {
            const p1Id = players[pair[0]].id;
            const p2Id = players[pair[1]].id;
            return state.rounds[0].matches.find(m =>
                (m.players[0]?.id === p1Id && m.players[1]?.id === p2Id) ||
                (m.players[0]?.id === p2Id && m.players[1]?.id === p1Id)
            );
        }).filter((m): m is Match => !!m);
    
        const userMatchInRound = matchesForThisRound.find(m => m.isUserMatch && !m.isFinished);
    
        if (userMatchInRound) {
            const matchIndex = state.rounds[0].matches.findIndex(m => m.id === userMatchInRound.id);

            state.status = 'round_in_progress';
            state.currentSimulatingMatch = { roundIndex: 0, matchIndex };
            state.currentMatchCommentary = [];
            state.timeElapsed = 0;
            state.currentMatchScores = { player1: 0, player2: 0 };
        } else {
            matchesForThisRound.forEach(match => {
                if (!match.isFinished) {
                    simulateAndFinishMatch(match, state.players);
                }
            });
            state.status = 'round_complete'; 
        }
        
        return;
    }
    
    const nextMatchToSimulate = state.rounds
        .flatMap((round, roundIndex) => round.matches.map((match, matchIndex) => ({ match, roundIndex, matchIndex })))
        .find(({ match }) => !match.isFinished && match.isUserMatch);

    if (nextMatchToSimulate) {
        state.status = 'round_in_progress';
        state.currentSimulatingMatch = {
            roundIndex: nextMatchToSimulate.roundIndex,
            matchIndex: nextMatchToSimulate.matchIndex,
        };
        state.currentMatchCommentary = [];
        state.timeElapsed = 0;
        state.currentMatchScores = { player1: 0, player2: 0 };
    } else {
        state.status = 'round_complete';
    }
};

export const advanceSimulation = (state: TournamentState, user: User) => {
    if (state.status !== 'round_in_progress' || !state.currentSimulatingMatch) return;

    const { roundIndex, matchIndex } = state.currentSimulatingMatch;
    const match = state.rounds[roundIndex].matches[matchIndex];

    if (!match.players[0] || !match.players[1]) {
        match.winner = match.players[0] || null;
        match.isFinished = true;
        processMatchCompletion(state, user, match, roundIndex);
        return;
    }
    
    if (state.timeElapsed === 0) {
        state.currentMatchScores = { player1: 0, player2: 0 };
    }

    state.timeElapsed++;
    
    const p1 = state.players.find(p => p.id === match.players[0]!.id)!;
    const p2 = state.players.find(p => p.id === match.players[1]!.id)!;

    if (state.timeElapsed === 1) {
        if (p1.originalStats) p1.stats = JSON.parse(JSON.stringify(p1.originalStats));
        if (p2.originalStats) p2.stats = JSON.parse(JSON.stringify(p2.originalStats));
    }
    
    const allStats = Object.values(CoreStat);
    const statToChange = allStats[Math.floor(Math.random() * allStats.length)];

    const applyStatFluctuation = (player: PlayerForTournament) => {
        if (!player) return;
        const probPositive = 45 + (player.condition / 2);
        const isPositive = Math.random() * 100 < probPositive;
        const changeAmount = Math.floor(Math.random() * 3) + 1;
        const finalChange = isPositive ? changeAmount : -changeAmount;
        
        player.stats[statToChange] = Math.max(0, (player.stats[statToChange] || 0) + finalChange);
    };
    
    applyStatFluctuation(p1);
    applyStatFluctuation(p2);
    
    const phase = getPhase(state.timeElapsed);
    const p1Power = calculatePower(p1, phase);
    const p2Power = calculatePower(p2, phase);

    const p1Cumulative = (state.currentMatchScores?.player1 || 0) + p1Power;
    const p2Cumulative = (state.currentMatchScores?.player2 || 0) + p2Power;
    state.currentMatchScores = { player1: p1Cumulative, player2: p2Cumulative };
    
    const totalCumulative = p1Cumulative + p2Cumulative;
    const p1ScorePercent = totalCumulative > 0 ? (p1Cumulative / totalCumulative) * 100 : 50;

    if (state.timeElapsed === 1) {
        state.currentMatchCommentary.push({ text: COMMENTARY_POOLS.start.replace('{p1}', p1.nickname).replace('{p2}', p2.nickname), phase, isRandomEvent: false });
    } else if (state.timeElapsed < TOTAL_GAME_DURATION) {
        if (state.timeElapsed % 20 === 0) {
            const leadPercent = Math.abs(p1ScorePercent - 50) * 2;
            const scoreDiff = (leadPercent / 2);
            const roundedDiff = Math.round(scoreDiff);
            const finalDiff = roundedDiff + 0.5;
            const leader = p1ScorePercent > 50 ? p1.nickname : p2.nickname;
            
            let commentaryText;
            if (finalDiff > 0.5) {
                commentaryText = COMMENTARY_POOLS.score[0].replace('{leader}', leader).replace('{scoreDiff}', finalDiff.toFixed(1));
            } else {
                commentaryText = COMMENTARY_POOLS.score[1];
            }
            state.currentMatchCommentary.push({ text: commentaryText, phase, isRandomEvent: false });
        } else if (state.timeElapsed % 5 === 0) {
            const event = getRandomEvent(p1, p2);
            if (event) {
                const totalScore = state.currentMatchScores!.player1 + state.currentMatchScores!.player2;
                const scoreChange = totalScore > 0 
                    ? Math.round(totalScore * (event.house * 0.02))
                    : event.house * 10;

                if (event.winner.id === p1.id) {
                    state.currentMatchScores!.player1 += scoreChange;
                } else {
                    state.currentMatchScores!.player2 += scoreChange;
                }
                
                const commentaryText = event.commentary.replace('{player}', event.winner.nickname) + ` (${event.house}집 이득!)`;
                
                const details: RandomEventDetails = {
                    ...event.details,
                    score_change: scoreChange
                };

                state.currentMatchCommentary.push({
                    text: commentaryText,
                    phase: phase,
                    isRandomEvent: true,
                    randomEventDetails: details
                });
            }
        } else {
            const comment = COMMENTARY_POOLS.general[Math.floor(Math.random() * COMMENTARY_POOLS.general.length)];
            const playerForComment = Math.random() < 0.5 ? p1.nickname : p2.nickname;
            state.currentMatchCommentary.push({ text: comment.replace('{player}', playerForComment), phase, isRandomEvent: false });
        }
    }
    
    if (state.timeElapsed >= TOTAL_GAME_DURATION) {
        const { finalCommentary, winner } = finishMatch(match, p1, p2, p1Cumulative, p2Cumulative);
        
        state.currentMatchCommentary.push(...finalCommentary);
        
        match.winner = winner;
        match.isFinished = true;
        match.commentary = [...state.currentMatchCommentary];
        match.finalScore = { player1: p1ScorePercent, player2: 100 - p1ScorePercent };
        
        processMatchCompletion(state, user, match, roundIndex);
    }
};

export const skipToResults = (state: TournamentState, userId: string) => {
    if (state.status === 'round_in_progress' && state.currentSimulatingMatch) {
        const { roundIndex, matchIndex } = state.currentSimulatingMatch;
        const match = state.rounds[roundIndex].matches[matchIndex];
        if (!match.isFinished) {
            let p1Cumulative = state.currentMatchScores?.player1 || 0;
            let p2Cumulative = state.currentMatchScores?.player2 || 0;
            const p1 = state.players.find(p => p.id === match.players[0]!.id)!;
            const p2 = state.players.find(p => p.id === match.players[1]!.id)!;
            for (let t = state.timeElapsed + 1; t <= TOTAL_GAME_DURATION; t++) {
                const phase = getPhase(t);
                p1Cumulative += calculatePower(p1, phase);
                p2Cumulative += calculatePower(p2, phase);
            }
            const { winner } = finishMatch(match, p1, p2, p1Cumulative, p2Cumulative);
            match.winner = winner;
            match.isFinished = true;
        }
    }

    let safety = 0;
    while (state.status !== 'complete' && safety < 10) {
        safety++;
        const lastRound = state.rounds[state.rounds.length - 1];
        if (lastRound.matches.every(m => m.isFinished)) {
            prepareNextRound(state, { id: userId } as User);
        }
        
        const currentRoundToSimulate = state.rounds[state.rounds.length - 1];
        currentRoundToSimulate.matches.forEach(m => {
            if (!m.isFinished) {
                simulateAndFinishMatch(m, state.players);
            }
        });

        const isLastRoundFinished = state.rounds[state.rounds.length - 1].matches.every(m => m.isFinished);
        const finalMatchExists = state.rounds.some(r => r.name === '결승');
        if (isLastRoundFinished && finalMatchExists) {
             state.status = 'complete';
             break;
        }
    }
    state.status = 'complete';
};

export const forfeitTournament = (state: TournamentState, userId: string) => {
    if (state.status === 'complete' || state.status === 'eliminated') return;

    state.rounds.forEach(round => {
        round.matches.forEach(match => {
            if (!match.isFinished && match.players.some(p => p?.id === userId)) {
                match.isFinished = true;
                match.winner = match.players.find(p => p && p.id !== userId) || null;
            }
        });
    });

    state.status = 'eliminated';
    skipToResults(state, userId);
};

export const calculateRanks = (tournament: TournamentState): { id: string, nickname: string, rank: number }[] => {
    const definition = TOURNAMENT_DEFINITIONS[tournament.type];
    const players = tournament.players;
    const rankedPlayers: { id: string, nickname: string, rank: number }[] = [];

    if (definition.format === 'round-robin') {
        const wins: Record<string, number> = {};
        players.forEach(p => { wins[p.id] = 0; });

        tournament.rounds.forEach(round => {
            round.matches.forEach(match => {
                if (match.winner) {
                    wins[match.winner.id]++;
                }
            });
        });

        const sortedPlayers = [...players].sort((a, b) => wins[b.id] - wins[a.id]);
        
        let currentRank = 1;
        for (let i = 0; i < sortedPlayers.length; i++) {
            const player = sortedPlayers[i];
            if (i > 0 && wins[player.id] < wins[sortedPlayers[i - 1].id]) {
                currentRank = i + 1;
            }
            rankedPlayers.push({ id: player.id, nickname: player.nickname, rank: currentRank });
        }
    } else { // tournament
        const playerRanks: Map<string, number> = new Map();
        const rankedPlayerIds = new Set<string>();

        for (let i = tournament.rounds.length - 1; i >= 0; i--) {
            const round = tournament.rounds[i];
            round.matches.forEach(match => {
                if (match.isFinished && match.winner && match.players[0] && match.players[1]) {
                    const loser = match.winner.id === match.players[0].id ? match.players[1] : match.players[0];
                    if (!rankedPlayerIds.has(loser.id)) {
                        let rank = 0;
                        if(round.name.includes("강")) rank = parseInt(round.name.replace("강",""));
                        else if(round.name.includes("결승")) rank = 2;
                        else if(round.name.includes("3,4위전")) rank = 4;
                        playerRanks.set(loser.id, rank);
                        rankedPlayerIds.add(loser.id);
                    }
                }
            });
        }
        
        const finalMatch = tournament.rounds.find(r => r.name === '결승')?.matches[0];
        if (finalMatch?.winner) {
            playerRanks.set(finalMatch.winner.id, 1);
            rankedPlayerIds.add(finalMatch.winner.id);
        }
        
        players.forEach(p => {
            if (playerRanks.has(p.id)) {
                rankedPlayers.push({ id: p.id, nickname: p.nickname, rank: playerRanks.get(p.id)! });
            }
        });
        rankedPlayers.sort((a,b) => a.rank - b.rank);
    }
    return rankedPlayers;
};
