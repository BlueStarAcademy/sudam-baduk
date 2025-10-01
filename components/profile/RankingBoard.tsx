
import React, { useState, useMemo } from 'react';
import { User, UserWithStatus, GameMode, Guild, LeagueTier, CoreStat } from '../../types';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, RANKING_TIERS, LEAGUE_DATA, AVATAR_POOL, BORDER_POOL } from '../../constants';
import Avatar from '../Avatar.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { calculateTotalStats } from '../../services/statService.js';

type RankingTab = 'combat' | 'championship' | 'strategic' | 'playful' | 'manner';

const getTier = (score: number, rank: number, totalPlayers: number) => {
    if (totalPlayers === 0) return RANKING_TIERS[RANKING_TIERS.length - 1];
    for (const tier of RANKING_TIERS) {
        if (tier.threshold(score, rank, totalPlayers)) {
            return tier;
        }
    }
    return RANKING_TIERS[RANKING_TIERS.length - 1];
};

const RankItem: React.FC<{ user: User; rank: number; score: number; scoreLabel: string; isMyRankDisplay: boolean; }> = ({ user, rank, score, scoreLabel, isMyRankDisplay }) => {
    const { handlers, currentUserWithStatus } = useAppContext();
    if (!currentUserWithStatus) return null;

    const rankDisplay = useMemo(() => {
        if (rank === 1) return <span className="text-3xl" role="img" aria-label="Gold Trophy">🥇</span>;
        if (rank === 2) return <span className="text-3xl" role="img" aria-label="Silver Trophy">🥈</span>;
        if (rank === 3) return <span className="text-3xl" role="img" aria-label="Bronze Trophy">🥉</span>;
        return <span className="text-2xl font-bold text-gray-300">{rank}</span>;
    }, [rank]);

    const isCurrentUserInList = !isMyRankDisplay && user.id === currentUserWithStatus.id;
    const baseClass = 'flex items-center rounded-lg';
    const myRankClass = 'bg-yellow-900/40 border border-yellow-700';
    const highlightClass = 'bg-blue-900/60 border border-blue-600';
    const defaultClass = 'bg-gray-900/50';
    
    const isClickable = !isMyRankDisplay && user.id !== currentUserWithStatus.id && !user.id.startsWith('bot-');
    const finalClass = `${baseClass} ${isMyRankDisplay ? myRankClass : (isCurrentUserInList ? highlightClass : defaultClass)} p-1.5 lg:p-2 ${isClickable ? 'cursor-pointer hover:bg-gray-700/50' : ''}`;
    const avatarUrl = AVATAR_POOL.find(a => a.id === user.avatarId)?.url;
    const borderUrl = BORDER_POOL.find(b => b.id === user.borderId)?.url;

    return (
        <li
            className={finalClass}
            onClick={isClickable ? () => handlers.openViewingUser(user.id) : undefined}
            title={isClickable ? `${user.nickname} 프로필 보기` : ''}
        >
            <div className="w-12 text-center flex-shrink-0 flex flex-col items-center justify-center">
                {rankDisplay}
            </div>
            <Avatar userId={user.id} userName={user.nickname} size={32} avatarUrl={avatarUrl} borderUrl={borderUrl} />
            <div className="ml-2 lg:ml-3 flex-grow overflow-hidden">
                <p className="font-semibold text-sm truncate">{user.nickname}</p>
                <p className="text-xs text-yellow-400 font-mono">{score.toLocaleString()} {scoreLabel}</p>
            </div>
        </li>
    );
};

const useRankingData = (
    tab: RankingTab, 
    allUsers: User[], 
    currentUser: UserWithStatus,
    guilds: Record<string, Guild>
) => {
    return useMemo(() => {
        let sortedUsers: (User & { score: number })[] = [];
        let scoreLabel = '';

        switch (tab) {
            case 'combat':
                scoreLabel = '전투력';
                sortedUsers = allUsers.map(user => {
                    const myGuild = user.guildId ? guilds[user.guildId] : null;
                    const totalStats = calculateTotalStats(user, myGuild);
                    const score = Object.values(totalStats).reduce((a, b) => a + Number(b), 0);
                    return { ...user, score };
                }).sort((a, b) => b.score - a.score);
                break;
            case 'manner':
                scoreLabel = '점';
                sortedUsers = allUsers
                    .map(u => ({ ...u, score: u.mannerScore ?? 0 }))
                    .sort((a, b) => b.score - a.score);
                break;
            case 'championship':
                scoreLabel = '점';
                sortedUsers = allUsers
                    .filter(u => u.tournamentScore !== undefined)
                    .map(u => ({ ...u, score: (u.tournamentScore || 0) - 500 }))
                    .sort((a, b) => b.score - a.score);
                break;
            case 'strategic':
                scoreLabel = '점';
                const strategicModes = SPECIAL_GAME_MODES.map(m => m.mode);
                sortedUsers = allUsers.map(user => {
                    const score = strategicModes.reduce((sum, mode) => {
                        const s = user.stats?.[mode];
                        if (s && (s.wins > 0 || s.losses > 0)) {
                            sum += (s.rankingScore - 1200);
                        }
                        return sum;
                    }, 0);
                    return { ...user, score };
                }).sort((a, b) => b.score - a.score);
                break;
            case 'playful':
                scoreLabel = '점';
                const playfulModes = PLAYFUL_GAME_MODES.map(m => m.mode);
                sortedUsers = allUsers.map(user => {
                    const score = playfulModes.reduce((sum, mode) => {
                        const s = user.stats?.[mode];
                        if (s && (s.wins > 0 || s.losses > 0)) {
                            sum += (s.rankingScore - 1200);
                        }
                        return sum;
                    }, 0);
                    return { ...user, score };
                }).sort((a, b) => b.score - a.score);
                break;
        }
        
        const myRankIndex = sortedUsers.findIndex(u => u.id === currentUser.id);
        const myRankData = myRankIndex !== -1 ? { user: sortedUsers[myRankIndex], rank: myRankIndex + 1 } : null;

        const topUsers = sortedUsers.slice(0, 50);

        return { topUsers, myRankData, scoreLabel };

    }, [tab, allUsers, guilds, currentUser.id]);
};

const RankingPanel: React.FC<{
    title: string;
    tabs: { id: RankingTab, label: string }[];
    activeTab: RankingTab;
    onTabClick: (tab: RankingTab) => void;
    allUsers: User[];
    currentUser: UserWithStatus;
    guilds: Record<string, Guild>;
}> = ({ title, tabs, activeTab, onTabClick, allUsers, currentUser, guilds }) => {
    const { topUsers, myRankData, scoreLabel } = useRankingData(activeTab, allUsers, currentUser, guilds);
    
    return (
        <div className="bg-panel border border-color text-on-panel rounded-lg p-2 md:p-4 flex flex-col h-full">
            <h3 className="text-xl font-bold text-center mb-2 text-primary flex-shrink-0">{title}</h3>
            <div className="flex bg-tertiary/70 p-1 rounded-lg mb-2 flex-shrink-0">
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => onTabClick(tab.id)} className={`flex-1 py-1.5 text-xs font-semibold rounded-md ${activeTab === tab.id ? 'bg-accent' : 'text-tertiary'}`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {myRankData && (
              <div className="flex-shrink-0 mb-2">
                  <RankItem user={myRankData.user} rank={myRankData.rank} score={myRankData.user.score} scoreLabel={scoreLabel} isMyRankDisplay={true} />
              </div>
            )}
            
            <ul className="space-y-1.5 overflow-y-auto pr-2 flex-grow min-h-0">
                 {topUsers.length > 0 ? topUsers.map((user, index) => <RankItem key={user.id} user={user} rank={index + 1} score={user.score} scoreLabel={scoreLabel} isMyRankDisplay={false} />) : (
                     <p className="text-center text-tertiary pt-8">랭킹 정보가 없습니다.</p>
                 )}
            </ul>
        </div>
    );
};


const RankingBoard: React.FC<{ allUsers: User[]; currentUser: UserWithStatus; guilds: Record<string, Guild> }> = ({ allUsers, currentUser, guilds }) => {
    const [activeTab1, setActiveTab1] = useState<RankingTab>('combat');
    const [activeTab2, setActiveTab2] = useState<RankingTab>('championship');

    const tabs1: { id: RankingTab, label: string }[] = [ {id: 'combat', label: '전투력'}, {id: 'manner', label: '매너'} ];
    const tabs2: { id: RankingTab, label: string }[] = [ {id: 'championship', label: '챔피언십'}, {id: 'strategic', label: '전략'}, {id: 'playful', label: '놀이'} ];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 h-full min-h-0">
            <div className="min-h-0">
                <RankingPanel title="종합 랭킹" tabs={tabs1} activeTab={activeTab1} onTabClick={setActiveTab1} allUsers={allUsers} currentUser={currentUser} guilds={guilds} />
            </div>
            <div className="min-h-0">
                <RankingPanel title="게임 랭킹" tabs={tabs2} activeTab={activeTab2} onTabClick={setActiveTab2} allUsers={allUsers} currentUser={currentUser} guilds={guilds} />
            </div>
        </div>
    );
};

export default RankingBoard;
