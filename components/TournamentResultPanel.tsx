import React, { useMemo } from 'react';
import { TournamentState, UserWithStatus, ServerAction, TournamentType, PlayerForTournament, InventoryItem, QuestReward, User } from '../types/index.js';
import Button from './Button.js';
import Avatar from './Avatar.js';
import { AVATAR_POOL, BORDER_POOL, BASE_TOURNAMENT_REWARDS, TOURNAMENT_SCORE_REWARDS, CONSUMABLE_ITEMS } from '../constants/index.js';

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

interface TournamentResultPanelProps {
    tournamentState: TournamentState;
    currentUser: UserWithStatus;
    onAction: (action: ServerAction) => void;
    winner: PlayerForTournament | null | undefined;
}

const TournamentResultPanel: React.FC<TournamentResultPanelProps> = ({ tournamentState, currentUser, onAction, winner }) => {
    const { status, title, type, rounds, players } = tournamentState;
    
    const isTournamentFullyComplete = status === 'complete';
    const isUserEliminated = status === 'eliminated';
    
    const myRankInfo = useMemo(() => {
        const ranks = calculateRanks(tournamentState);
        return ranks.find(r => r.id === currentUser.id);
    }, [tournamentState, currentUser.id]);

    const rewardInfo = BASE_TOURNAMENT_REWARDS[type];
    let rewardKey: number;

    if (myRankInfo) {
        if (type === 'neighborhood') rewardKey = myRankInfo.rank <= 3 ? myRankInfo.rank : 4;
        else if (type === 'national') rewardKey = myRankInfo.rank <= 4 ? myRankInfo.rank : 5;
        else { // world
            if (myRankInfo.rank <= 4) rewardKey = myRankInfo.rank;
            else if (myRankInfo.rank <= 8) rewardKey = 5;
            else rewardKey = 9;
        }
    } else {
        rewardKey = 99; // No rank, no reward
    }
    
    const myReward = rewardInfo.rewards[rewardKey];
    const myScoreReward = TOURNAMENT_SCORE_REWARDS[type][rewardKey] || 0;

    const rewardClaimedKey = `${type}RewardClaimed` as keyof User;
    const isClaimed = !!(currentUser as any)[rewardClaimedKey];

    const handleClaim = () => {
        if (!isClaimed && (isTournamentFullyComplete || isUserEliminated)) {
            onAction({ type: 'CLAIM_TOURNAMENT_REWARD', payload: { tournamentType: type } });
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
                    {myReward ? (myReward.items || []).map((item, i) => <RewardItemDisplay key={i} item={item} />) : <p className="text-xs text-gray-500">획득한 보상이 없습니다.</p>}
                </div>
            </div>
        </div>
    );
};

export default TournamentResultPanel;