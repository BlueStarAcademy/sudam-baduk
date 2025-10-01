
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { UserWithStatus, TournamentState, PlayerForTournament, ServerAction, User, CoreStat, Match, Round, CommentaryLine, TournamentType, LeagueTier, InventoryItem } from '../types/index.js';
import Button from './Button.js';
import { TOURNAMENT_DEFINITIONS, BASE_TOURNAMENT_REWARDS, TOURNAMENT_SCORE_REWARDS, CONSUMABLE_ITEMS, AVATAR_POOL, BORDER_POOL, CORE_STATS_DATA, LEAGUE_DATA } from '../constants/index.js';
import Avatar from './Avatar.js';
import RadarChart from './RadarChart.js';
import SgfViewer from './SgfViewer.js';
import { audioService } from '../services/audioService.js';
import DraggableWindow from './DraggableWindow.js';
import { CommentaryPanel, ScoreGraph, SimulationProgressBar } from './ScoreGraphAndCommentary.js';

// ... (Rest of the components like RandomEventDetails, parseCommentary, etc. remain the same) ...
const EARLY_GAME_DURATION = 20;
const MID_GAME_DURATION = 30;
const END_GAME_DURATION = 20;
const TOTAL_GAME_DURATION = EARLY_GAME_DURATION + MID_GAME_DURATION + END_GAME_DURATION;


const getPhase = (time: number): 'early' | 'mid' | 'end' => {
    if (time <= EARLY_GAME_DURATION) return 'early';
    if (time <= EARLY_GAME_DURATION + MID_GAME_DURATION) return 'mid';
    return 'end';
};

interface RandomEventDetailsProps {
    details: NonNullable<CommentaryLine['randomEventDetails']>;
    p1Nickname?: string;
    p2Nickname?: string;
}

const RandomEventDetails: React.FC<RandomEventDetailsProps> = ({ details, p1Nickname, p2Nickname }) => {
    const { stat, p1_stat, p2_stat } = details;
    
    // Consistent naming for display
    const p1 = { nickname: p1Nickname || 'Player 1', stat: p1_stat };
    const p2 = { nickname: p2Nickname || 'Player 2', stat: p2_stat };

    const totalStat = p1.stat + p2.stat;
    const p1Percent = totalStat > 0 ? (p1.stat / totalStat) * 100 : 50;
    const p2Percent = 100 - p1Percent;

    return (
        <div className="text-xs text-gray-400 mt-1 p-2 bg-gray-900/30 rounded-md">
            <p className="font-semibold text-center mb-1">{stat} 능력치 비교</p>
            <div className="flex w-full h-3 bg-gray-700 rounded-full overflow-hidden border border-black/20">
                <div className="bg-blue-500" style={{ width: `${p1Percent}%` }} title={`${p1.nickname}: ${p1.stat}`}></div>
                <div className="bg-red-500" style={{ width: `${p2Percent}%` }} title={`${p2.nickname}: ${p2.stat}`}></div>
            </div>
            <div className="flex justify-between mt-0.5">
                <span className="truncate max-w-[45%]">{p1.nickname}: {p1.stat}</span>
                <span className="truncate max-w-[45%] text-right">{p2.nickname}: {p2.stat}</span>
            </div>
        </div>
    );
};

const parseCommentary = (commentaryLine: CommentaryLine, p1Nickname?: string, p2Nickname?: string) => {
    const { text, isRandomEvent, randomEventDetails } = commentaryLine;

    if (text.startsWith('최종 결과 발표!') || text.startsWith('[최종결과]')) {
        return <strong className="text-yellow-400">{text}</strong>;
    }

    const leadRegex = /(\d+\.\d+집|\d+\.5집)/g;
    const parts = text.split(leadRegex);

    const baseText = (
        <span className={isRandomEvent ? 'text-cyan-400' : ''}>
            {parts.map((part, index) => {
                if (leadRegex.test(part)) {
                    return <strong key={index} className="text-yellow-400">{part}</strong>;
                }
                return part;
            })}
        </span>
    );
    
    return (
        <div>
            <span>
                {baseText}
                {isRandomEvent && randomEventDetails && (
                    <span className="font-bold text-yellow-400 ml-1">
                        (+{randomEventDetails.score_change.toFixed(1).replace('.0', '')}집)
                    </span>
                )}
            </span>
            {randomEventDetails && <RandomEventDetails details={randomEventDetails} p1Nickname={p1Nickname} p2Nickname={p2Nickname} />}
        </div>
    );
};


const KEY_STATS_BY_PHASE: Record<'early' | 'mid' | 'end', CoreStat[]> = {
    early: [CoreStat.CombatPower, CoreStat.ThinkingSpeed, CoreStat.Concentration],
    mid: [CoreStat.CombatPower, CoreStat.Judgment, CoreStat.Concentration, CoreStat.Stability],
    end: [CoreStat.Calculation, CoreStat.Stability, CoreStat.Concentration],
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

interface PotionSelectionModalProps {
    currentUser: UserWithStatus;
    matchId: string;
    tournamentType: TournamentType;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
}

interface TournamentBracketProps {
    tournamentState: TournamentState;
    currentUser: UserWithStatus;
    onBack: () => void;
    allUsersForRanking: User[];
    onViewUser: (userId: string) => void;
    onAction: (action: ServerAction) => void;
    onStartNextRound: () => void;
    onSkip: () => void;
    isMobile: boolean;
    onReset: () => void;
}
const RewardItemDisplay: React.FC<{ item: InventoryItem | { itemId: string; quantity: number } }> = ({ item }) => {
    const itemName = 'itemId' in item ? item.itemId : (item as any).name;
    const quantity = 'quantity' in item ? item.quantity : 1;
    const itemTemplate = CONSUMABLE_ITEMS.find(i => i.name === itemName);

    if (!itemTemplate) return null;

    return (
        <div className="flex items-center gap-2 bg-tertiary/50 p-1.5 rounded-md" title={`${itemName} x${quantity}`}>
            <img src={itemTemplate.image!} alt={itemName} className="w-6 h-6 object-contain" />
            <span className="text-xs text-primary">{itemName} x{quantity}</span>
        </div>
    );
};

const PotionSelectionModal: React.FC<PotionSelectionModalProps> = ({ currentUser, matchId, tournamentType, onClose, onAction }) => {
    const potions = useMemo(() => {
        const potionTemplates = [
            { name: '컨디션 물약(소)', image: '/images/use/con1.png', grade: 'uncommon', description: '피로도 1~5 회복' },
            { name: '컨디션 물약(중)', image: '/images/use/con2.png', grade: 'rare', description: '피로도 5~10 회복' },
            { name: '컨디션 물약(대)', image: '/images/use/con3.png', grade: 'epic', description: '피로도 10~20 회복' },
        ];
        return potionTemplates.map(template => ({
            ...template,
            quantity: currentUser.inventory.find(i => i.name === template.name)?.quantity || 0,
        }));
    }, [currentUser.inventory]);

    const handleUse = (itemName: string) => {
        onAction({
            type: 'USE_CONDITION_POTION',
            payload: { tournamentType, matchId, itemName }
        });
        onClose();
    };

    return (
        <DraggableWindow title="컨디션 회복 물약 사용" onClose={onClose} windowId="potion-selection" initialWidth={400}>
            <div className="space-y-4">
                {potions.map(potion => (
                    <div key={potion.name} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <img src={potion.image} alt={potion.name} className="w-12 h-12" />
                            <div>
                                <p className="font-semibold">{potion.name}</p>
                                <p className="text-xs text-gray-400">{potion.description}</p>
                                <p className="text-xs text-gray-400">보유: {potion.quantity}개</p>
                            </div>
                        </div>
                        <Button onClick={() => handleUse(potion.name)} disabled={potion.quantity <= 0} colorScheme="green" className="!text-xs">
                            사용
                        </Button>
                    </div>
                ))}
            </div>
        </DraggableWindow>
    );
};

const PlayerProfilePanel: React.FC<{ 
    player: PlayerForTournament | null, 
    initialPlayer: PlayerForTournament | null,
    allUsers: User[], 
    currentUserId: string, 
    onViewUser: (userId: string) => void,
    highlightPhase: 'early' | 'mid' | 'end' | 'none';
    isPreMatchView?: boolean;
    matchId?: string;
    onUsePotion?: (matchId: string) => void;
    tournamentState: TournamentState;
}> = ({ player, initialPlayer, allUsers, currentUserId, onViewUser, highlightPhase, isPreMatchView, matchId, onUsePotion, tournamentState }) => {
    
    const [statAnimations, setStatAnimations] = useState<Partial<Record<CoreStat, { change: number; key: number }>>>({});

    useEffect(() => {
        if (!tournamentState?.lastStatChanges || !player) return;

        const myChange = tournamentState.lastStatChanges.find(c => c.playerId === player.id);
        if (myChange) {
            setStatAnimations(prev => ({
                ...prev,
                [myChange.stat]: { change: myChange.change, key: Date.now() }
            }));
            const timer = setTimeout(() => setStatAnimations(prev => {
                const newPrev = {...prev};
                delete newPrev[myChange.stat];
                return newPrev;
            }), 1500);
            return () => clearTimeout(timer);
        }
    }, [tournamentState?.lastStatChanges, player?.id]);

    if (!player) return <div className="p-2 text-center text-gray-500 flex items-center justify-center h-full bg-gray-900/50 rounded-lg">선수 대기 중...</div>;

    const fullUserData = useMemo(() => allUsers.find(u => u.id === player.id), [allUsers, player.id]);

    const cumulativeStats = useMemo(() => {
        const result = { wins: 0, losses: 0 };
        if (fullUserData?.stats) {
            Object.values(fullUserData.stats).forEach(s => {
                result.wins += s.wins;
                result.losses += s.losses;
            });
        }
        return result;
    }, [fullUserData]);

    const isClickable = !player.id.startsWith('bot-') && player.id !== currentUserId;
    const avatarUrl = AVATAR_POOL.find(a => a.id === player.avatarId)?.url;
    const borderUrl = BORDER_POOL.find(b => b.id === player.borderId)?.url;

    const isStatHighlighted = (stat: CoreStat) => {
        if (highlightPhase === 'none') return false;
        return KEY_STATS_BY_PHASE[highlightPhase].includes(stat);
    };

    const canUsePotion = isPreMatchView && player.id === currentUserId && player.condition < 100 && onUsePotion && matchId;
    
    return (
        <div className={`bg-gray-900/50 p-3 rounded-lg flex flex-col items-center gap-2 h-full ${isClickable ? 'cursor-pointer hover:bg-gray-700/50' : ''}`} onClick={isClickable ? () => onViewUser(player.id) : undefined} title={isClickable ? `${player.nickname} 프로필 보기` : ''}>
            <div className="flex items-center gap-2">
                 <Avatar userId={player.id} userName={player.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={40} />
                 <div>
                    <h4 className="font-bold text-base truncate">{player.nickname}</h4>
                    <p className="text-xs text-gray-400">({cumulativeStats.wins}승 {cumulativeStats.losses}패)</p>
                 </div>
            </div>
            <div className="font-bold text-sm mt-1 relative flex items-center justify-center gap-2">
                <span>컨디션: <span className="text-yellow-300">{player.condition === 1000 ? '-' : Math.round(player.condition)}</span></span>
                {isPreMatchView && player.id === currentUserId && onUsePotion && matchId && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onUsePotion(matchId); }} 
                        className="w-5 h-5 flex items-center justify-center bg-green-600 hover:bg-green-500 rounded-full text-white font-bold shadow-md transition-transform hover:scale-110 disabled:bg-gray-500 disabled:cursor-not-allowed"
                        title="물약 사용"
                        disabled={player.condition >= 100}
                    >
                        +
                    </button>
                )}
            </div>
            <div className="w-full grid grid-cols-2 gap-x-1 sm:gap-x-3 gap-y-0.5 text-xs mt-2 border-t border-gray-600 pt-2">
                {Object.values(CoreStat).map(stat => {
                    const initialValue = initialPlayer?.originalStats?.[stat] ?? player.originalStats?.[stat] ?? 0;
                    const currentValue = player.stats[stat];
                    const cumulativeChange = currentValue - initialValue;
                    const animation = statAnimations[stat];

                    return (
                        <React.Fragment key={stat}>
                            <span className={`text-gray-400 ${isStatHighlighted(stat) ? 'text-yellow-400 font-bold' : ''}`}>{stat}</span>
                            <div className="flex justify-end items-baseline relative">
                                <span className={`font-mono text-white ${isStatHighlighted(stat) ? 'text-yellow-400 font-bold' : ''}`}>{currentValue}</span>
                                {cumulativeChange !== 0 && (
                                    <span className={`ml-1 text-xs ${cumulativeChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        ({cumulativeChange > 0 ? '+' : ''}{cumulativeChange.toFixed(0)})
                                    </span>
                                )}
                                {animation && (
                                    <span key={animation.key} className={`absolute -right-6 text-sm font-bold ${animation.change > 0 ? 'text-green-400' : 'text-red-400'} animate-float-up-and-fade`}>
                                        {animation.change > 0 ? '+' : ''}{animation.change}
                                    </span>
                                )}
                            </div>
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};

const calculateRanks = (tournament: TournamentState): (PlayerForTournament & { rank: number })[] => {
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

const TournamentResultPanel: React.FC<{
    tournamentState: TournamentState;
    currentUser: UserWithStatus;
    onAction: (action: ServerAction) => void;
    winner: PlayerForTournament | null | undefined;
}> = ({ tournamentState, currentUser, onAction, winner }) => {
    const isTournamentFullyComplete = tournamentState.status === 'complete';
    const isUserEliminated = tournamentState.status === 'eliminated';
    
    const { type } = tournamentState;
    
    const myRankInfo = useMemo(() => {
        const ranks = calculateRanks(tournamentState);
        return ranks.find(r => r.id === currentUser.id);
    }, [tournamentState, currentUser.id]);

    const rewardKey = useMemo(() => {
        if (!myRankInfo) return 99;
        if (type === 'neighborhood') return myRankInfo.rank <= 3 ? myRankInfo.rank : 4;
        if (type === 'national') return myRankInfo.rank <= 4 ? myRankInfo.rank : 5;
        if (myRankInfo.rank <= 4) return myRankInfo.rank;
        if (myRankInfo.rank <= 8) return 5;
        return 9;
    }, [myRankInfo, type]);

    const reward = useMemo(() => {
        if (!myRankInfo) return null;
        const rewardInfo = BASE_TOURNAMENT_REWARDS[type];
        if (!rewardInfo) return null;
        return rewardInfo.rewards[rewardKey];
    }, [myRankInfo, type, rewardKey]);
    
    const rewardClaimedKey = useMemo(() => `${type}RewardClaimed` as keyof User, [type]);
    const isClaimed = useMemo(() => !!(currentUser as any)[rewardClaimedKey], [currentUser, rewardClaimedKey]);

    const handleClaim = () => {
        if (!isClaimed && (isTournamentFullyComplete || isUserEliminated)) {
            onAction({ type: 'CLAIM_TOURNAMENT_REWARD', payload: { tournamentType: type } })
        }
    };
    
    if (!isTournamentFullyComplete && !isUserEliminated) {
         return (
            <div className="h-full w-full bg-gray-800/50 rounded-lg p-3 text-center flex flex-col items-center justify-center">
                <img src="/images/Ranking.png" alt="Trophy" className="w-16 h-16 mb-2" />
                <h4 className="font-bold text-gray-400">우승자</h4>
                {winner ? <p className="text-xl font-semibold text-yellow-300">{winner.nickname}</p> : <p className="text-sm text-gray-500 animate-pulse">진행 중...</p>}
            </div>
        );
    }
    
    return (
        <div className="h-full bg-gray-800/50 rounded-lg p-2 text-center flex flex-col items-center justify-between w-full">
            <div className="w-full">
                <img src="/images/Ranking.png" alt="Trophy" className="w-14 h-14 mb-1 mx-auto" />
                <h4 className="font-bold text-gray-400 text-sm">우승자</h4>
                {winner ? <p className="text-base font-semibold text-yellow-300">{winner.nickname}</p> : <p className="text-xs text-gray-500">집계 중...</p>}
                
                { myRankInfo &&
                    <p className="mt-1 text-xs text-gray-300">나의 순위: <span className="font-bold text-white">{myRankInfo.rank}위</span></p>
                }
            </div>

            <div className="w-full">
                <h4 className="font-bold text-gray-400 text-xs mb-1">보상 내역</h4>
                <div 
                    className={`min-h-[40px] relative flex items-center justify-center gap-2 flex-wrap p-2 rounded-md ${!isClaimed ? 'cursor-pointer hover:bg-gray-700/50' : ''}`}
                    onClick={!isClaimed ? handleClaim : undefined}
                    title={isClaimed ? '수령 완료' : '클릭하여 보상 수령'}
                >
                    {isClaimed && <div className="absolute inset-0 bg-black/50 rounded-md flex items-center justify-center text-green-400 font-bold">수령 완료</div>}
                    {/* FIX: Changed undefined variable `myReward` to the correct `reward` variable to display tournament rewards. */}
                    {reward ? (reward.items || []).map((item, i) => <RewardItemDisplay key={i} item={item} />) : <p className="text-xs text-gray-500">획득한 보상이 없습니다.</p>}
                </div>
            </div>
        </div>
    );
};

const MatchBox: React.FC<{ match: Match; currentUser: UserWithStatus }> = ({ match, currentUser }) => {
    const p1 = match.players[0];
    const p2 = match.players[1];

    const PlayerDisplay: React.FC<{ player: PlayerForTournament | null, isWinner: boolean }> = ({ player, isWinner }) => {
        if (!player) return <div className="h-8 flex items-center"><span className="text-gray-600 truncate">...</span></div>;
        
        const playerClass = !isWinner && match.isFinished ? 'opacity-60' : '';
        const winnerClass = isWinner ? 'text-yellow-300' : '';
        const avatarUrl = AVATAR_POOL.find(a => a.id === player.avatarId)?.url;
        const borderUrl = BORDER_POOL.find(b => b.id === player.borderId)?.url;

        return (
            <div className={`flex items-center gap-2 ${playerClass}`}>
                <Avatar userId={player.id} userName={player.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={28} />
                <span className={`truncate font-semibold ${winnerClass}`}>{player.nickname}</span>
            </div>
        );
    };
    
    const p1IsWinner = match.isFinished && match.winner?.id === p1?.id;
    const p2IsWinner = match.isFinished && match.winner?.id === p2?.id;
    const isMyMatch = p1?.id === currentUser.id || p2?.id === currentUser.id;

    return (
        <div className={`p-1.5 rounded-lg text-sm space-y-1 ${isMyMatch ? 'bg-blue-900/40 border border-blue-700' : 'bg-gray-700/50'}`}>
            <div className="flex justify-between items-center">
                <PlayerDisplay player={p1} isWinner={p1IsWinner} />
                {p1IsWinner && <span className="font-bold text-green-400">W</span>}
            </div>
            <div className="flex justify-between items-center">
                <PlayerDisplay player={p2} isWinner={p2IsWinner} />
                {p2IsWinner && <span className="font-bold text-green-400">W</span>}
            </div>
        </div>
    );
};

const RoundColumn: React.FC<{ name: string; matches: Match[] | undefined; currentUser: UserWithStatus }> = ({ name, matches, currentUser }) => {
    return (
        <div className="flex flex-col gap-4 flex-shrink-0 w-44">
            <h5 className="text-center font-bold text-sm text-gray-400">{name}</h5>
            <div className="flex flex-col gap-6">
                {matches?.map(match => (
                    <MatchBox key={match.id} match={match} currentUser={currentUser} />
                ))}
            </div>
        </div>
    );
};

const RoundRobinDisplay: React.FC<{
    tournamentState: TournamentState;
    currentUser: UserWithStatus;
}> = ({ tournamentState, currentUser }) => {
    const { players, rounds, status, currentRoundRobinRound } = tournamentState;
    const matches = rounds[0]?.matches || [];

    const playerStats = useMemo(() => {
        const stats: Record<string, { wins: number; losses: number }> = {};
        players.forEach(p => { stats[p.id] = { wins: 0, losses: 0 }; });
        matches.forEach(match => {
            if (match.isFinished && match.winner) {
                const winnerId = match.winner.id;
                if (stats[winnerId]) stats[winnerId].wins++;
                const loser = match.players.find(p => p && p.id !== winnerId);
                if (loser && stats[loser.id]) stats[loser.id].losses++;
            }
        });
        return stats;
    }, [players, matches]);

    const sortedPlayers = useMemo(() => {
        return [...players].sort((a, b) => (playerStats[b.id]?.wins || 0) - (playerStats[a.id]?.wins || 0));
    }, [players, playerStats]);

    const schedule = [
        [[0, 5], [1, 4], [2, 3]], [[0, 4], [5, 3], [1, 2]], [[0, 3], [4, 2], [5, 1]],
        [[0, 2], [3, 1], [4, 5]], [[0, 1], [2, 5], [3, 4]],
    ];
    
    const roundForDisplay = status === 'bracket_ready' ? 1 : Math.min(5, (currentRoundRobinRound || 1));
    
    const tabs = Array.from({ length: 5 }, (_, i) => i + 1);
    const [activeTab, setActiveTab] = useState(roundForDisplay);

    useEffect(() => {
        setActiveTab(roundForDisplay);
    }, [roundForDisplay]);
    
    const roundPairings = schedule[activeTab - 1];

    const currentRoundMatches = useMemo(() => {
        if (!roundPairings) return [];
        return roundPairings.map(pair => {
            const p1Id = players[pair[0]].id;
            const p2Id = players[pair[1]].id;
            return matches.find(m =>
                (m.players[0]?.id === p1Id && m.players[1]?.id === p2Id) ||
                (m.players[0]?.id === p2Id && m.players[1]?.id === p1Id)
            );
        }).filter((m): m is Match => !!m);
    }, [roundPairings, players, matches]);

    return (
        <div className="h-full flex flex-col min-h-0">
            <h4 className="font-bold text-center mb-2 flex-shrink-0 text-gray-300">풀리그 대진표</h4>
            <div className="flex bg-gray-900/70 p-1 rounded-lg mb-2 flex-shrink-0">
                 {tabs.map(tabNum => (
                    <button key={tabNum} onClick={() => setActiveTab(tabNum)} className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${activeTab === tabNum ? 'bg-blue-600' : 'text-gray-400 hover:bg-gray-700/50'}`}>{tabNum}회차</button>
                 ))}
            </div>
            <div className="overflow-y-auto pr-2 flex-grow min-h-0">
                <div className="flex flex-col items-center justify-around h-full gap-4">
                    {currentRoundMatches.map(match => (<MatchBox key={match.id} match={match} currentUser={currentUser} />))}
                </div>
            </div>
        </div>
    );
};


const TournamentRoundViewer: React.FC<{ rounds: Round[]; currentUser: UserWithStatus; tournamentType: TournamentType; }> = ({ rounds, currentUser, tournamentType }) => {
    type TabData = { name: string; matches: Match[]; isInProgress: boolean; };
    
    const getRoundsForTabs = useMemo((): TabData[] | null => {
        const roundMap = new Map<string, Match[]>();
        rounds.forEach(r => roundMap.set(r.name, r.matches));
        
        let availableTabs: string[] = [];
        if (tournamentType === 'world') {
            availableTabs = ["16강", "8강", "4강", "결승 및 3/4위전"];
        } else if (tournamentType === 'national') {
            availableTabs = ["8강", "4강", "결승 및 3/4위전"];
        } else {
            return null;
        }

        const tabData = availableTabs.map((tabName): TabData => {
            let roundMatches: Match[] = [];
            let roundNames: string[] = [];
            if (tabName === "결승 및 3/4위전") {
                roundNames = ["결승", "3,4위전"];
                roundMatches = (roundMap.get("결승") || []).concat(roundMap.get("3,4위전") || []);
            } else {
                roundNames = [tabName];
                roundMatches = roundMap.get(tabName) || [];
            }
            return {
                name: tabName,
                matches: roundMatches,
                isInProgress: roundMatches.length > 0 && roundMatches.some(m => !m.isFinished)
            };
        }).filter(tab => tab.matches.length > 0);
        
        return tabData;
    }, [rounds, tournamentType]);

    const initialTabIndex = useMemo(() => {
        if (!getRoundsForTabs) return 0;
        const inProgressIndex = getRoundsForTabs.findIndex(tab => tab.isInProgress);
        if (inProgressIndex !== -1) {
            return inProgressIndex;
        }
        return Math.max(0, getRoundsForTabs.length - 1);
    }, [getRoundsForTabs]);

    const [activeTab, setActiveTab] = useState(initialTabIndex);

    useEffect(() => {
        setActiveTab(initialTabIndex);
    }, [initialTabIndex]);

    if (!getRoundsForTabs) {
        const desiredOrder = ["16강", "8강", "4강", "3,4위전", "결승"];
        const sortedRounds = [...rounds].sort((a, b) => desiredOrder.indexOf(a.name) - desiredOrder.indexOf(b.name));
        return (
            <div className="h-full flex flex-col min-h-0">
                <h4 className="font-bold text-center mb-2 flex-shrink-0 text-gray-300">대진표</h4>
                <div className="flex-grow overflow-auto">
                     <div className="flex items-center justify-start h-full p-4 space-x-4" style={{ minWidth: `${sortedRounds.length * 12}rem` }}>
                        {sortedRounds.map((round) => (
                            <RoundColumn key={round.id} name={round.name} matches={round.matches} currentUser={currentUser} />
                        ))}
                    </div>
                </div>
            </div>
        );
    }
    
    const activeTabData = getRoundsForTabs[activeTab];

    const renderBracketForTab = (tab: typeof activeTabData) => {
        if (tab.name === "결승 및 3/4위전") {
             const finalMatch = tab.matches.filter(m => rounds.find(r => r.matches.includes(m))?.name === '결승');
             const thirdPlaceMatch = tab.matches.filter(m => rounds.find(r => r.matches.includes(m))?.name === '3,4위전');
             return (
                <div className="flex flex-col justify-center items-center gap-8 h-full">
                    <RoundColumn name="결승" matches={finalMatch} currentUser={currentUser} />
                    {thirdPlaceMatch.length > 0 && <RoundColumn name="3,4위전" matches={thirdPlaceMatch} currentUser={currentUser} />}
                </div>
             );
        }

        return (
             <div className="flex justify-center items-center h-full gap-4 p-4">
                <RoundColumn name={tab.name} matches={tab.matches} currentUser={currentUser} />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col min-h-0">
            <h4 className="font-bold text-center mb-2 flex-shrink-0 text-gray-300">대진표</h4>
            <div className="flex bg-gray-900/70 p-1 rounded-lg mb-2 flex-shrink-0">
                {getRoundsForTabs.map((tab, index) => (
                    <button
                        key={tab.name}
                        onClick={() => setActiveTab(index)}
                        className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${activeTab === index ? 'bg-blue-600' : 'text-gray-400 hover:bg-gray-700/50'}`}
                    >
                        {tab.name}
                    </button>
                ))}
            </div>
            <div className="flex-grow overflow-auto">
                {activeTabData && renderBracketForTab(activeTabData)}
            </div>
        </div>
    );
};

export const TournamentBracket = (props: TournamentBracketProps) => {
    const { tournamentState, currentUser, onBack, allUsersForRanking, onViewUser, onAction, onStartNextRound, onSkip, isMobile } = props;
    const [lastUserMatchSgfIndex, setLastUserMatchSgfIndex] = useState<number | null>(null);
    const [initialMatchPlayers, setInitialMatchPlayers] = useState<{ p1: PlayerForTournament | null, p2: PlayerForTournament | null }>({ p1: null, p2: null });
    const prevStatusRef = useRef(tournamentState.status);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [potionModalInfo, setPotionModalInfo] = useState<{ matchId: string; tournamentType: TournamentType } | null>(null);
    
    const safeRounds = useMemo(() => 
        Array.isArray(tournamentState.rounds) ? tournamentState.rounds : [], 
        [tournamentState.rounds]
    );

    useEffect(() => {
        onAction({ type: 'ENTER_TOURNAMENT_VIEW' });
        return () => {
            onAction({ type: 'LEAVE_TOURNAMENT_VIEW' });
        };
    }, [onAction]);

    useEffect(() => {
        const status = tournamentState.status;
        const prevStatus = prevStatusRef.current;
    
        if ((status === 'round_complete' || status === 'eliminated' || status === 'complete') && prevStatus === 'round_in_progress') {
            const lastFinishedUserMatch = [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
            if (lastFinishedUserMatch && lastFinishedUserMatch.sgfFileIndex) {
                setLastUserMatchSgfIndex(lastFinishedUserMatch.sgfFileIndex);
            }
        } else if (status === 'bracket_ready') {
            setLastUserMatchSgfIndex(null);
        } else if (status === 'round_in_progress' && tournamentState.timeElapsed === 1) {
             const matchInfo = tournamentState.currentSimulatingMatch;
            if (matchInfo) {
                const match = safeRounds[matchInfo.roundIndex].matches[matchInfo.matchIndex];
                const p1 = tournamentState.players.find(p => p.id === match.players[0]?.id) || null;
                const p2 = tournamentState.players.find(p => p.id === match.players[1]?.id) || null;
                setInitialMatchPlayers({
                    p1: p1 ? JSON.parse(JSON.stringify(p1)) : null,
                    p2: p2 ? JSON.parse(JSON.stringify(p2)) : null,
                });
            }
        } else if (status !== 'round_in_progress') {
            setInitialMatchPlayers({ p1: null, p2: null });
        }
    
        prevStatusRef.current = status;
    }, [tournamentState, safeRounds]);
    
    const handleForfeitClick = useCallback(() => {
        if (window.confirm('토너먼트를 포기하고 나가시겠습니까? 오늘의 참가 기회는 사라집니다.')) {
            onAction({ type: 'FORFEIT_TOURNAMENT', payload: { type: tournamentState.type } });
        }
    }, [onAction, tournamentState.type]);

    const handleBackClick = useCallback(() => {
        if (tournamentState.status === 'round_in_progress') {
            handleForfeitClick();
        } else {
            onBack();
        }
    }, [onBack, handleForfeitClick, tournamentState.status]);

    const isSimulating = tournamentState.status === 'round_in_progress';
    const currentSimMatch = isSimulating && tournamentState.currentSimulatingMatch 
        ? safeRounds[tournamentState.currentSimulatingMatch.roundIndex].matches[tournamentState.currentSimulatingMatch.matchIndex]
        : null;
        
    const lastFinishedUserMatch = useMemo(() => {
        return [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
    }, [safeRounds]);
    
    const matchForDisplay = isSimulating 
        ? currentSimMatch 
        : (lastFinishedUserMatch || safeRounds.flatMap(r => r.matches).find(m => m.isUserMatch) || safeRounds[0]?.matches[0]);
    
    const winner = useMemo(() => {
        if (tournamentState.status !== 'complete') return null;
        if (tournamentState.type === 'neighborhood') {
             const wins: Record<string, number> = {};
            tournamentState.players.forEach(p => wins[p.id] = 0);
            safeRounds[0].matches.forEach(m => { if(m.winner) wins[m.winner.id]++; });
            return [...tournamentState.players].sort((a,b) => wins[b.id] - wins[a.id])[0];
        } else {
            const finalMatch = safeRounds.find(r => r.name === '결승');
            return finalMatch?.matches[0]?.winner;
        }
    }, [tournamentState.status, tournamentState.type, tournamentState.players, safeRounds]);
    
    const myResultText = useMemo(() => {
        if (tournamentState.status === 'complete' || tournamentState.status === 'eliminated') {
            if (tournamentState.type === 'neighborhood') {
                const allMyMatches = safeRounds.flatMap(r => r.matches).filter(m => m.isUserMatch && m.isFinished);
                const winsCount = allMyMatches.filter(m => m.winner?.id === currentUser.id).length;
                const lossesCount = allMyMatches.length - winsCount;

                const playerWins: Record<string, number> = {};
                tournamentState.players.forEach(p => { playerWins[p.id] = 0; });
                safeRounds[0].matches.forEach(m => {
                    if (m.winner) playerWins[m.winner.id] = (playerWins[m.winner.id] || 0) + 1;
                });

                const sortedPlayers = [...tournamentState.players].sort((a, b) => playerWins[b.id] - playerWins[a.id]);
                let myRank = -1; let currentRankValue = 1;
                for (let i = 0; i < sortedPlayers.length; i++) {
                    if (i > 0 && playerWins[sortedPlayers[i].id] < playerWins[sortedPlayers[i-1].id]) currentRankValue = i + 1;
                    if (sortedPlayers[i].id === currentUser.id) { myRank = currentRankValue; break; }
                }
                return `${winsCount}승 ${lossesCount}패! ${myRank}위`;
            }

            if (winner?.id === currentUser.id) return "🏆 우승!";

            const lastUserMatch = [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
            if (lastUserMatch) {
                const roundOfLastMatch = safeRounds.find(r => r.matches.some(m => m.id === lastUserMatch.id));
                if (roundOfLastMatch?.name === '결승') return "준우승!";

                if (roundOfLastMatch?.name === '4강') {
                    const thirdPlaceMatch = safeRounds.flatMap(r => r.matches).find(m => {
                        const round = safeRounds.find(r => r.matches.some(match => match.id === m.id));
                        return m.isUserMatch && round?.name === '3,4위전';
                    });
                    if (thirdPlaceMatch) {
                        const won3rdPlace = thirdPlaceMatch.winner?.id === currentUser.id;
                        return won3rdPlace ? "3위" : "4위";
                    }
                }
                return `${roundOfLastMatch?.name || ''}에서 탈락`;
            }
            return "토너먼트 탈락";
        }

        if (tournamentState.status === 'round_complete' || tournamentState.status === 'bracket_ready') {
            const lastFinishedUserMatch = [...safeRounds].reverse().flatMap(r => r.matches).find(m => m.isUserMatch && m.isFinished);
            if (lastFinishedUserMatch) {
                const userWonLastMatch = lastFinishedUserMatch.winner?.id === currentUser.id;
                if (tournamentState.type === 'neighborhood') {
                    const allMyMatches = safeRounds.flatMap(r => r.matches).filter(m => m.isUserMatch && m.isFinished);
                    const wins = allMyMatches.filter(m => m.winner?.id === currentUser.id).length;
                    const losses = allMyMatches.length - wins;
                    return `${allMyMatches.length}차전 ${userWonLastMatch ? '승리' : '패배'}! (${wins}승 ${losses}패)`;
                } else if (userWonLastMatch) {
                    const nextUnplayedRound = safeRounds.find(r => r.matches.some(m => !m.isFinished && m.players.some(p => p?.id === currentUser.id)));
                    if (nextUnplayedRound) return `${nextUnplayedRound.name} 진출!`;
                }
            }
        }
        
        const currentRound = safeRounds.find(r => r.matches.some(m => m.isUserMatch && !m.isFinished));
        return currentRound ? `${currentRound.name} 진행 중` : "대회 준비 중";
    }, [currentUser.id, tournamentState, winner, safeRounds]);
    
    const p1_from_match = matchForDisplay?.players[0] || null;
    const p2_from_match = matchForDisplay?.players[1] || null;

    const p1 = p1_from_match ? tournamentState.players.find(p => p.id === p1_from_match.id) || p1_from_match : null;
    const p2 = p2_from_match ? tournamentState.players.find(p => p.id === p2_from_match.id) || p2_from_match : null;
    
    const maxStatValue = useMemo(() => {
        if (!p1 || !p2) return 250;
        const league1 = p1.league;
        const league2 = p2.league;

        const isDynamicLeague = [LeagueTier.Grandmaster, LeagueTier.Challenger];
        if (isDynamicLeague.includes(league1) || isDynamicLeague.includes(league2)) {
            const allStats = [...Object.values(p1.stats), ...Object.values(p2.stats)];
            const maxStat = Math.max(...allStats, 0);
            return Math.max(250, Math.ceil((maxStat + 25) / 50) * 50); // Round up to nearest 50, with a min of 250
        }
        
        const getCap = (league: LeagueTier) => {
            if ([LeagueTier.Ace, LeagueTier.Diamond, LeagueTier.Master].includes(league)) return 500;
            return 250;
        };
        
        return Math.max(getCap(league1), getCap(league2));
    }, [p1, p2]);

    const radarDatasets = useMemo(() => [
        { stats: p1?.stats || {}, color: '#60a5fa', fill: 'rgba(59, 130, 246, 0.4)' },
        { stats: p2?.stats || {}, color: '#f87171', fill: 'rgba(239, 68, 68, 0.4)' },
    ], [p1, p2]);

    const currentPhase = useMemo((): 'early' | 'mid' | 'end' | 'none' => {
        if (tournamentState.status !== 'round_in_progress') return 'none';
        return getPhase(tournamentState.timeElapsed);
    }, [tournamentState.timeElapsed, tournamentState.status]);

    const p1Cumulative = tournamentState.currentMatchScores?.player1 || 0;
    const p2Cumulative = tournamentState.currentMatchScores?.player2 || 0;
    const totalCumulative = p1Cumulative + p2Cumulative;
    const p1Percent = totalCumulative > 0 ? (p1Cumulative / totalCumulative) * 100 : 50;
    const p2Percent = totalCumulative > 0 ? (p2Cumulative / totalCumulative) * 100 : 50;
    
    const handleStartNextRoundWithLock = useCallback(() => {
        if (isTransitioning) return;
        setIsTransitioning(true);
        onStartNextRound();
        setTimeout(() => setIsTransitioning(false), 2000);
    }, [isTransitioning, onStartNextRound]);

    const nextUserMatch = useMemo(() => {
        if (!tournamentState || tournamentState.status === 'round_in_progress') return null;
        return tournamentState.rounds
            .flatMap(r => r.matches)
            .find(m => m.isUserMatch && !m.isFinished);
    }, [tournamentState]);

    const nextMatchPlayers = useMemo(() => {
        if (!nextUserMatch) return { p1: null, p2: null };
        const p1 = tournamentState.players.find(p => p.id === nextUserMatch.players[0]?.id) || null;
        const p2 = tournamentState.players.find(p => p.id === nextUserMatch.players[1]?.id) || null;
        return { p1, p2 };
    }, [nextUserMatch, tournamentState.players]);

    const renderFooterButton = () => {
        const { status } = tournamentState;

        if (status === 'round_in_progress') {
            return (
                <div className="flex items-center justify-center gap-4">
                    <Button disabled colorScheme="green">경기 진행 중...</Button>
                    <Button onClick={handleForfeitClick} colorScheme="red">포기</Button>
                </div>
            );
        }
        
        if (status === 'complete') {
            return <Button onClick={onBack} colorScheme="gray" className="w-full">로비로 돌아가기</Button>;
        }

        if (status === 'eliminated') {
             return (
                <div className="flex items-center justify-center gap-4">
                    <Button onClick={onBack} colorScheme="gray">나가기</Button>
                    <Button onClick={onSkip} colorScheme="yellow">결과 스킵</Button>
                </div>
            );
        }

        const hasUnfinishedUserMatch = safeRounds.some(r =>
            r.matches.some(m => m.isUserMatch && !m.isFinished)
        );

        if ((status === 'round_complete' || status === 'bracket_ready') && hasUnfinishedUserMatch) {
            return (
                <div className="flex items-center justify-center gap-4">
                    <Button onClick={handleStartNextRoundWithLock} disabled={isTransitioning} colorScheme="green" className="animate-pulse">경기 시작</Button>
                    <Button onClick={handleForfeitClick} colorScheme="red">포기</Button>
                </div>
            );
        }
        
        // This case handles when a player won their match, but other matches in the tournament are still being simulated.
        return (
            <div className="flex items-center justify-center gap-4">
                <Button disabled colorScheme="gray">다른 경기 진행 중...</Button>
                <Button onClick={onSkip} colorScheme="yellow">결과 스킵</Button>
            </div>
        );
    };

    const mainContent = (
        <main className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
            <aside className="w-full lg:w-[35%] xl:w-[25%] flex flex-col gap-2">
                 <div className="flex-1 bg-gray-800/50 rounded-lg p-2 min-h-0">
                    {tournamentState.type === 'neighborhood' ? (
                        <RoundRobinDisplay tournamentState={tournamentState} currentUser={currentUser} />
                    ) : (
                        <TournamentRoundViewer rounds={safeRounds} currentUser={currentUser} tournamentType={tournamentState.type} />
                    )}
                </div>
                {!isSimulating && (
                    <div className="flex-shrink-0">
                        <TournamentResultPanel tournamentState={tournamentState} currentUser={currentUser} onAction={onAction} winner={winner} />
                    </div>
                )}
            </aside>

            <div className="flex-grow flex flex-col gap-2 min-h-0 min-w-0">
                {isSimulating ? (
                    <section className="flex-shrink-0 flex flex-row gap-1 md:gap-2 items-stretch p-2 bg-gray-800/50 rounded-lg">
                        <div className="flex-1 min-w-0 flex-shrink-0">
                            <PlayerProfilePanel player={p1} initialPlayer={initialMatchPlayers.p1} allUsers={allUsersForRanking} currentUserId={currentUser.id} onViewUser={onViewUser} highlightPhase={currentPhase} tournamentState={tournamentState}/>
                        </div>
                        <div className="flex-shrink-0 w-44 sm:w-52 flex flex-col items-center justify-center min-w-0">
                            <RadarChart datasets={radarDatasets} maxStatValue={maxStatValue} size={isMobile ? 140 : undefined} />
                            <div className="flex justify-center gap-2 sm:gap-4 text-[10px] sm:text-xs mt-1">
                                <span className="flex items-center gap-1"><div className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm" style={{backgroundColor: 'rgba(59, 130, 246, 0.6)'}}></div>{p1?.nickname || '...'}</span>
                                <span className="flex items-center gap-1"><div className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm" style={{backgroundColor: 'rgba(239, 68, 68, 0.6)'}}></div>{p2?.nickname || '...'}</span>
                            </div>
                        </div>
                        <div className="flex-1 min-w-0 flex-shrink-0">
                            <PlayerProfilePanel player={p2} initialPlayer={initialMatchPlayers.p2} allUsers={allUsersForRanking} currentUserId={currentUser.id} onViewUser={onViewUser} highlightPhase={currentPhase} tournamentState={tournamentState}/>
                        </div>
                    </section>
                ) : nextUserMatch ? (
                    <section className="flex-shrink-0 flex flex-row gap-1 md:gap-2 items-stretch p-2 bg-gray-800/50 rounded-lg">
                         <div className="flex-1 min-w-0 flex-shrink-0">
                            <PlayerProfilePanel player={nextMatchPlayers.p1} initialPlayer={null} allUsers={allUsersForRanking} currentUserId={currentUser.id} onViewUser={onViewUser} highlightPhase={'none'} isPreMatchView={true} matchId={nextUserMatch.id} onUsePotion={() => setPotionModalInfo({ matchId: nextUserMatch.id, tournamentType: tournamentState.type })} tournamentState={tournamentState} />
                        </div>
                         <div className="flex-shrink-0 w-44 sm:w-52 flex flex-col items-center justify-center min-w-0 text-gray-400">
                             <h3 className="text-lg font-bold text-yellow-300">다음 경기</h3>
                             <p className="text-4xl font-bold my-4">VS</p>
                         </div>
                         <div className="flex-1 min-w-0 flex-shrink-0">
                            <PlayerProfilePanel player={nextMatchPlayers.p2} initialPlayer={null} allUsers={allUsersForRanking} currentUserId={currentUser.id} onViewUser={onViewUser} highlightPhase={'none'} isPreMatchView={true} matchId={nextUserMatch.id} onUsePotion={() => setPotionModalInfo({ matchId: nextUserMatch.id, tournamentType: tournamentState.type })} tournamentState={tournamentState}/>
                        </div>
                    </section>
                ) : (
                    <div className="flex-shrink-0 flex-1 bg-gray-800/50 rounded-lg p-2 text-center flex flex-col items-center justify-center">
                        <p className="text-xl font-bold">모든 경기가 종료되었습니다.</p>
                        <p className="text-gray-400 mt-2">결과를 확인하고 보상을 수령하세요.</p>
                    </div>
                )}
                
                <section className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
                    <div className="bg-gray-800/50 rounded-lg flex flex-col min-h-0 h-full">
                        <CommentaryPanel commentary={tournamentState.currentMatchCommentary} isSimulating={isSimulating} p1Nickname={p1?.nickname} p2Nickname={p2?.nickname}/>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg flex flex-col p-2 gap-2 min-h-0 h-full">
                        <div className="flex-shrink-0">
                            <ScoreGraph p1Percent={p1Percent} p2Percent={p2Percent} p1Nickname={p1?.nickname} p2Nickname={p2?.nickname} />
                             <div className="mt-2">
                                <SimulationProgressBar timeElapsed={tournamentState.timeElapsed} totalDuration={TOTAL_GAME_DURATION} />
                            </div>
                        </div>
                        <div className="flex-grow relative min-h-0">
                            <SgfViewer 
                                timeElapsed={tournamentState.timeElapsed}
                                fileIndex={matchForDisplay?.sgfFileIndex ?? lastUserMatchSgfIndex}
                                showLastMoveOnly={tournamentState.status !== 'round_in_progress'}
                            />
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );

    if (isMobile) {
        return (
             <div className="flex flex-col h-full bg-gray-800 p-2 gap-2">
                <header className="flex justify-between items-center flex-shrink-0">
                    <Button onClick={handleBackClick} colorScheme="gray" className="!px-3 !py-1">&larr;</Button>
                    <div className="text-center">
                        <h3 className="text-xl font-bold">{tournamentState.title}</h3>
                        <p className="text-sm font-bold text-yellow-300">{myResultText}</p>
                    </div>
                    <div className="w-16"></div>
                </header>
                {mainContent}
                <footer className="flex-shrink-0 py-2 border-t border-gray-700">
                    {renderFooterButton()}
                </footer>
            </div>
        );
    }

    return (
        <div className="p-4 flex flex-col h-full bg-gray-800 rounded-lg shadow-lg">
             {potionModalInfo && (
                <PotionSelectionModal 
                    currentUser={currentUser}
                    matchId={potionModalInfo.matchId}
                    tournamentType={potionModalInfo.tournamentType}
                    onClose={() => setPotionModalInfo(null)}
                    onAction={onAction}
                />
            )}
            <header className="flex justify-between items-center mb-4 flex-shrink-0">
                <Button onClick={handleBackClick} colorScheme="gray">&larr; 로비로</Button>
                <div className="text-center">
                    <h3 className="text-3xl font-bold">{tournamentState.title}</h3>
                    <p className="text-lg font-bold text-yellow-300">{myResultText}</p>
                </div>
                <div className="w-24"></div>
            </header>
            {mainContent}
             <footer className="flex-shrink-0 pt-4 mt-4 border-t border-gray-700">
                {renderFooterButton()}
            </footer>
        </div>
    );
};
