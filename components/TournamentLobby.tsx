import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { UserWithStatus, TournamentState, TournamentType, User, ChatMessage, LeagueTier } from '../types.js';
import { TournamentBracket } from './TournamentBracket.js';
import Button from './Button.js';
import { TOURNAMENT_DEFINITIONS, AVATAR_POOL, LEAGUE_DATA, BORDER_POOL } from '../constants.js';
import Avatar from './Avatar.js';
import { isSameDayKST } from '../utils/timeUtils.js';
import { useAppContext } from '../hooks/useAppContext.js';
import LeagueTierInfoModal from './LeagueTierInfoModal.js';
import QuickAccessSidebar from './QuickAccessSidebar.js';
import ChatWindow from './waiting-room/ChatWindow.js';
import { stableStringify } from '../utils/appUtils.js';

const stringToSeed = (str: string): number => {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};

const seededRandom = (seed: number): number => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
};

const WeeklyCompetitorsPanel: React.FC<{ setHasRankChanged: (changed: boolean) => void }> = ({ setHasRankChanged }) => {
    const { currentUserWithStatus, allUsers, handlers } = useAppContext();
    const prevRankRef = useRef<number | null>(null);
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date();
            const dayOfWeek = now.getDay();
            const daysUntilMonday = (dayOfWeek === 0) ? 1 : (8 - dayOfWeek);
            const nextMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilMonday);
            nextMonday.setHours(0, 0, 0, 0);

            const diff = nextMonday.getTime() - now.getTime();
            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            setTimeLeft(`${d}D ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        };
        calculateTimeLeft();
        const interval = setInterval(calculateTimeLeft, 1000);
        return () => clearInterval(interval);
    }, []);

    const liveCompetitors = useMemo(() => {
        if (!currentUserWithStatus?.weeklyCompetitors) {
            return [];
        }
    
        const MIN_DAILY_SCORE_GAIN = 6;
        const MAX_DAILY_SCORE_GAIN = 136;
    
        const lastUpdateTs = currentUserWithStatus.lastWeeklyCompetitorsUpdate || Date.now();
        const startOfUpdateDay = new Date(lastUpdateTs);
        startOfUpdateDay.setHours(0, 0, 0, 0);

        const now = new Date();
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const diffTime = Math.max(0, startOfToday.getTime() - startOfUpdateDay.getTime());
        const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
        return (currentUserWithStatus.weeklyCompetitors).map(competitor => {
            if (competitor.id.startsWith('bot-')) {
                let totalGain = 0;
                for (let i = 0; i <= daysPassed; i++) {
                    const dateForSeed = new Date(startOfUpdateDay.getTime() + i * 24 * 60 * 60 * 1000);
                    const seedStr = `${competitor.id}-${dateForSeed.toISOString().slice(0, 10)}`;
                    const seed = stringToSeed(seedStr);
                    const randomVal = seededRandom(seed);
                    const scoreRange = MAX_DAILY_SCORE_GAIN - MIN_DAILY_SCORE_GAIN;
                    const dailyGain = MIN_DAILY_SCORE_GAIN + Math.floor(randomVal * (scoreRange * 0.75));
                    totalGain += dailyGain;
                }
                const liveScore = competitor.initialScore + totalGain;
                const scoreChange = liveScore - competitor.initialScore;
                return { ...competitor, liveScore, scoreChange };
            } else {
                const liveData = allUsers.find(u => u.id === competitor.id);
                const liveScore = liveData ? liveData.tournamentScore : competitor.initialScore;
                const scoreChange = liveScore - competitor.initialScore;
                return { ...competitor, liveScore, scoreChange };
            }
        }).sort((a, b) => b.liveScore - a.liveScore);
    }, [currentUserWithStatus?.weeklyCompetitors, currentUserWithStatus?.lastWeeklyCompetitorsUpdate, allUsers]);


    useEffect(() => {
        if (!currentUserWithStatus) return;
        const myRank = liveCompetitors.findIndex(c => c.id === currentUserWithStatus.id) + 1;
        if (myRank > 0) {
            if (prevRankRef.current !== null && prevRankRef.current !== myRank) {
                setHasRankChanged(true);
            }
            prevRankRef.current = myRank;
        }
    }, [liveCompetitors, currentUserWithStatus, setHasRankChanged]);

    if (!currentUserWithStatus || !currentUserWithStatus.weeklyCompetitors || currentUserWithStatus.weeklyCompetitors.length === 0) {
        return (
             <div className="bg-gray-800 rounded-lg p-4 flex flex-col shadow-lg h-full min-h-0 items-center justify-center text-gray-500">
                주간 경쟁 상대 정보를 불러오는 중...
            </div>
        );
    }

    return (
         <div className="bg-gray-800 rounded-lg p-4 flex flex-col shadow-lg h-full min-h-0">
            <div className="flex-shrink-0 text-center mb-3 border-b border-gray-700 pb-2">
                <h2 className="text-xl font-bold">이번주 경쟁 상대</h2>
                <p className="text-sm text-yellow-300 font-mono">{timeLeft}</p>
            </div>
            <ul className="space-y-1.5 overflow-y-auto pr-2 flex-grow min-h-0">
                {liveCompetitors.map((competitor, index) => {
                    const rank = index + 1;
                    const isCurrentUser = competitor.id === currentUserWithStatus.id;
                    const scoreChangeColor = competitor.scoreChange > 0 ? 'text-green-400' : competitor.scoreChange < 0 ? 'text-red-400' : 'text-gray-400';
                    const scoreChangeSign = competitor.scoreChange > 0 ? '▲' : competitor.scoreChange < 0 ? '▼' : '-';
                    
                    const avatarUrl = AVATAR_POOL.find(a => a.id === competitor.avatarId)?.url;
                    const borderUrl = BORDER_POOL.find(b => b.id === competitor.borderId)?.url;
                    const isClickable = !isCurrentUser && !competitor.id.startsWith('bot-');

                    return (
                        <li 
                            key={competitor.id} 
                            className={`flex items-center gap-3 p-1.5 rounded-md ${isCurrentUser ? 'bg-blue-900/50' : 'bg-gray-900/50'} ${isClickable ? 'transition-colors cursor-pointer hover:bg-gray-700/50' : ''}`}
                            onClick={isClickable ? () => handlers.openViewingUser(competitor.id) : undefined}
                            title={isClickable ? `${competitor.nickname} 프로필 보기` : ''}
                        >
                            <span className="font-bold text-lg w-6 text-center flex-shrink-0">{rank}</span>
                             <Avatar userId={competitor.id} userName={competitor.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={28} />
                            <span className="flex-grow font-semibold text-sm truncate">{competitor.nickname}</span>
                            <div className="flex items-baseline gap-1 text-xs">
                                <span className="font-mono text-yellow-300">{competitor.liveScore.toLocaleString()}</span>
                                <span className={scoreChangeColor}>({scoreChangeSign}{Math.abs(competitor.scoreChange)})</span>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

interface RankItemProps {
    user: User;
    rank: number;
    isMyRankDisplay: boolean;
}

const RankItem: React.FC<RankItemProps> = ({ user, rank, isMyRankDisplay }) => {
    const { currentUserWithStatus, handlers } = useAppContext();
    if (!currentUserWithStatus) return null;

    const score = user.tournamentScore || 0;

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
    
    const isClickable = !isMyRankDisplay && user.id !== currentUserWithStatus.id;
    const finalClass = `${baseClass} ${isMyRankDisplay ? myRankClass : (isCurrentUserInList ? highlightClass : defaultClass)} p-1.5 lg:p-2 ${isClickable ? 'cursor-pointer hover:bg-gray-700/50' : ''}`;
    const avatarUrl = AVATAR_POOL.find(a => a.id === user.avatarId)?.url;
    const borderUrl = BORDER_POOL.find(b => b.id === user.borderId)?.url;
    const leagueInfo = LEAGUE_DATA.find(l => l.tier === user.league);
    const tierImage = leagueInfo?.icon;

    return (
        <li
            className={finalClass}
            onClick={isClickable ? () => handlers.openViewingUser(user.id) : undefined}
            title={isClickable ? `${user.nickname} 프로필 보기` : ''}
        >
            <div className="w-12 text-center flex-shrink-0 flex flex-col items-center justify-center">
                {rankDisplay}
            </div>
            {tierImage && <img src={tierImage} alt={user.league} className="w-8 h-8 mr-2 flex-shrink-0" title={user.league} />}
            <Avatar userId={user.id} userName={user.nickname} size={32} avatarUrl={avatarUrl} borderUrl={borderUrl} />
            <div className="ml-2 lg:ml-3 flex-grow overflow-hidden">
                <p className="font-semibold text-sm truncate">{user.nickname}</p>
                <p className="text-xs text-yellow-400 font-mono">{score.toLocaleString()}점</p>
            </div>
        </li>
    );
};

const ChampionshipRankingPanel: React.FC = () => {
    const { currentUserWithStatus, allUsers, handlers } = useAppContext();
    const [selectedTier, setSelectedTier] = useState<LeagueTier>(LEAGUE_DATA[0].tier);
    const [isLeagueTierInfoModalOpen, setIsLeagueTierInfoModalOpen] = useState(false);

    useEffect(() => {
        if (currentUserWithStatus?.league) {
            setSelectedTier(currentUserWithStatus.league);
        }
    }, [currentUserWithStatus?.league]);

    const sortedUsers = useMemo(() => {
        if (!currentUserWithStatus) return [];
        return [...allUsers]
            .filter(u => u.league === selectedTier && typeof u.tournamentScore === 'number')
            .sort((a, b) => b.tournamentScore - a.tournamentScore);
    }, [allUsers, selectedTier, currentUserWithStatus]);
    
    const myOwnLeagueData = useMemo(() => {
        if (!currentUserWithStatus) return { rank: -1, user: null };
        const usersInMyLeague = [...allUsers]
            .filter(u => u.league === currentUserWithStatus.league && typeof u.tournamentScore === 'number')
            .sort((a, b) => b.tournamentScore - a.tournamentScore);
        const myRankIndex = usersInMyLeague.findIndex(u => u.id === currentUserWithStatus.id);
        return {
            rank: myRankIndex !== -1 ? myRankIndex + 1 : -1,
            user: myRankIndex !== -1 ? usersInMyLeague[myRankIndex] : null
        };
    }, [allUsers, currentUserWithStatus]);
    
    if (!currentUserWithStatus) {
        return (
             <div className="bg-gray-800 rounded-lg p-4 flex flex-col shadow-lg h-full min-h-0 items-center justify-center text-gray-500">
                랭킹 정보를 불러오는 중...
            </div>
        );
    }

    const topUsers = sortedUsers.slice(0, 100);

    return (
        <div className="bg-gray-800 rounded-lg p-4 flex flex-col shadow-lg h-full min-h-0">
            {isLeagueTierInfoModalOpen && <LeagueTierInfoModal onClose={() => setIsLeagueTierInfoModalOpen(false)} />}
            <div className="flex justify-between items-center mb-3 border-b border-gray-700 pb-2 flex-shrink-0">
                <h2 className="text-xl font-bold">챔피언십 랭킹</h2>
                <button 
                    onClick={() => setIsLeagueTierInfoModalOpen(true)}
                    className="text-xs bg-gray-600 hover:bg-gray-500 text-white font-bold px-2 py-1 rounded-md transition-colors"
                >
                    티어 안내
                </button>
            </div>
            <div className="flex flex-nowrap justify-start bg-gray-900/50 p-1 rounded-lg mb-3 flex-shrink-0 gap-1 tier-tabs-container overflow-x-auto">
                {LEAGUE_DATA.map(league => (
                    <button
                        key={league.tier}
                        onClick={() => setSelectedTier(league.tier)}
                        className={`p-1 rounded-md transition-all duration-200 flex-shrink-0 ${selectedTier === league.tier ? 'bg-purple-600 ring-2 ring-purple-400' : 'hover:bg-gray-600'}`}
                        title={league.name}
                    >
                        <img src={league.icon} alt={league.name} className="w-10 h-10" />
                    </button>
                ))}
            </div>
            {myOwnLeagueData.user && (
              <div className="flex-shrink-0 mb-3">
                  <RankItem user={myOwnLeagueData.user} rank={myOwnLeagueData.rank} isMyRankDisplay={true} />
              </div>
            )}
            <ul key={selectedTier} className="space-y-2 overflow-y-auto pr-2 flex-grow min-h-0">
                 {topUsers.length > 0 ? topUsers.map((user, index) => <RankItem key={user.id} user={user} rank={index + 1} isMyRankDisplay={false} />) : (
                    <p className="text-center text-gray-500 pt-8">{selectedTier} 리그에 랭크된 유저가 없습니다.</p>
                 )}
            </ul>
        </div>
    );
};

const TournamentCard: React.FC<{ 
    type: TournamentType; 
    onClick: () => void;
    onContinue: () => void;
    inProgress: TournamentState | null;
}> = ({ type, onClick, onContinue, inProgress }) => {
    const definition = TOURNAMENT_DEFINITIONS[type];
    const isSimulationInProgress = inProgress && inProgress.status === 'round_in_progress';
    const hasResultToView = inProgress && (inProgress.status === 'complete' || inProgress.status === 'eliminated');
    const isReadyToContinue = inProgress && (inProgress.status === 'bracket_ready' || inProgress.status === 'round_complete');

    let buttonText = '참가하기';
    let action = onClick;

    if (inProgress) {
        if (isSimulationInProgress) {
            buttonText = '이어서 보기';
        } else if (hasResultToView) {
            buttonText = '결과 보기';
        } else if (isReadyToContinue) {
            buttonText = '계속하기';
        }
        action = onContinue;
    }
    
    return (
        <div 
            className="group bg-gray-800 rounded-lg p-3 flex flex-col text-center transition-all transform hover:-translate-y-1 shadow-lg hover:shadow-purple-500/30 cursor-pointer h-full"
            onClick={action}
        >
            <div className="w-full aspect-video bg-gray-700 rounded-md flex items-center justify-center text-gray-500 overflow-hidden relative">
                <img src={definition.image} alt={definition.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity duration-300 p-2">
                    <h2 className="text-lg font-bold">{definition.name}</h2>
                    <span className="font-bold text-sm mt-2 text-yellow-300">{buttonText} &rarr;</span>
                </div>
            </div>
        </div>
    );
};


const PlaceholderCard: React.FC<{ title: string; description: string; imageUrl: string; }> = ({ title, description, imageUrl }) => {
    return (
        <div className="bg-gray-800 rounded-lg p-3 flex flex-col text-center shadow-lg opacity-60 cursor-not-allowed h-full">
            <div className="w-full aspect-video bg-gray-700 rounded-md flex items-center justify-center text-gray-500 overflow-hidden">
                <img src={imageUrl} alt={title} className="w-full h-full object-cover grayscale" />
            </div>
        </div>
    );
};

const TournamentLobby: React.FC = () => {
    const { currentUserWithStatus, allUsers, handlers, waitingRoomChats } = useAppContext();
    
    const [viewingTournament, setViewingTournament] = useState<TournamentState | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [hasRankChanged, setHasRankChanged] = useState(false);
    const [enrollingIn, setEnrollingIn] = useState<TournamentType | null>(null);

    // This effect handles the transition into the bracket view after a user enrolls.
    // It waits for the user object to update with the new tournament state.
    useEffect(() => {
        if (enrollingIn && currentUserWithStatus) {
            const stateKey = `last${enrollingIn.charAt(0).toUpperCase() + enrollingIn.slice(1)}Tournament` as keyof User;
            const newState = (currentUserWithStatus as any)[stateKey];
            if (newState) {
                setViewingTournament(newState);
                setEnrollingIn(null);
            }
        }
    }, [currentUserWithStatus, enrollingIn]);
    

    // This effect synchronizes the local tournament state with the global state from polling.
    // This is crucial for seeing live updates during a simulation.
    useEffect(() => {
        if (viewingTournament && currentUserWithStatus) {
            const stateKey = `last${viewingTournament.type.charAt(0).toUpperCase() + viewingTournament.type.slice(1)}Tournament` as keyof User;
            const updatedState = (currentUserWithStatus as any)[stateKey] as TournamentState | null;
            
            if (updatedState && stableStringify(updatedState) !== stableStringify(viewingTournament)) {
                setViewingTournament(updatedState);
            }
        }
    }, [currentUserWithStatus, viewingTournament]);


    useEffect(() => {
        const checkIsMobile = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', checkIsMobile);
        return () => window.removeEventListener('resize', checkIsMobile);
    }, []);

    const handleBackFromBracket = useCallback(() => {
        setViewingTournament(null);
    }, []);

    const handleEnterArena = useCallback((type: TournamentType) => {
        const now = Date.now();
        let playedDateKey: keyof User;
        switch (type) {
            case 'neighborhood': playedDateKey = 'lastNeighborhoodPlayedDate'; break;
            case 'national': playedDateKey = 'lastNationalPlayedDate'; break;
            case 'world': playedDateKey = 'lastWorldPlayedDate'; break;
        }
        const hasPlayedToday = !!(currentUserWithStatus as any)[playedDateKey] && isSameDayKST((currentUserWithStatus as any)[playedDateKey], now);

        if (hasPlayedToday && !currentUserWithStatus?.isAdmin) {
            alert('이미 오늘 참가한 토너먼트입니다. 결과를 확인해주세요.');
            handleContinueTournament(type);
            return;
        }

        setEnrollingIn(type);
        handlers.handleAction({ type: 'START_TOURNAMENT_SESSION', payload: { type } });
    }, [handlers, currentUserWithStatus]);

    const handleContinueTournament = useCallback((type: TournamentType) => {
        let stateKey: keyof User;
        switch (type) {
            case 'neighborhood': stateKey = 'lastNeighborhoodTournament'; break;
            case 'national': stateKey = 'lastNationalTournament'; break;
            case 'world': stateKey = 'lastWorldTournament'; break;
        }
        const existingState = (currentUserWithStatus as any)[stateKey] as TournamentState | null;
        if (existingState) {
            setViewingTournament(existingState);
        }
    }, [currentUserWithStatus]);


    const globalChat = useMemo(() => waitingRoomChats['global'] || [], [waitingRoomChats]);

    if (!currentUserWithStatus) return null;
    
    if (viewingTournament) {
        return <TournamentBracket 
            tournamentState={viewingTournament}
            currentUser={currentUserWithStatus}
            onBack={handleBackFromBracket}
            onAction={handlers.handleAction}
            allUsersForRanking={allUsers}
            onViewUser={handlers.openViewingUser}
            onStartNextRound={() => handlers.handleAction({ type: 'START_TOURNAMENT_ROUND', payload: { type: viewingTournament.type } })}
            onReset={() => {
                if (window.confirm('토너먼트를 포기하고 나가시겠습니까? 오늘의 참가 기회는 사라집니다.')) {
                    handlers.handleAction({ type: 'CLEAR_TOURNAMENT_SESSION', payload: { type: viewingTournament.type } });
                    setViewingTournament(null);
                }
            }}
            onSkip={() => handlers.handleAction({ type: 'SKIP_TOURNAMENT_END', payload: { type: viewingTournament.type } })}
            isMobile={isMobile}
        />
    }
    
    const filterInProgress = (state: TournamentState | null | undefined): TournamentState | null => {
        if (!state) return null;
        // Keep completed/eliminated states to show "Result" button
        return state;
    };

    const neighborhoodState = filterInProgress(currentUserWithStatus.lastNeighborhoodTournament);
    const nationalState = filterInProgress(currentUserWithStatus.lastNationalTournament);
    const worldState = filterInProgress(currentUserWithStatus.lastWorldTournament);

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-screen-2xl mx-auto flex flex-col h-[calc(100vh-5rem)] relative">
            {isMobile && (
                 <div className="absolute top-1/2 -translate-y-1/2 right-0 z-20">
                    <button 
                        onClick={() => { setIsMobileSidebarOpen(true); setHasRankChanged(false); }}
                        className="w-8 h-12 bg-gray-700/80 backdrop-blur-sm rounded-l-lg flex items-center justify-center text-white shadow-lg"
                        aria-label="랭킹 및 경쟁 상대 보기"
                    >
                        <span className="relative font-bold text-lg">
                            {'<'}
                            {hasRankChanged && <div className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-gray-700"></div>}
                        </span>
                    </button>
                </div>
            )}
            {isMobile && isMobileSidebarOpen && (
                <>
                    <div className={`fixed top-0 right-0 h-full w-[280px] bg-gray-800 shadow-2xl z-50 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                        <div className="flex flex-col h-full">
                             <button onClick={() => setIsMobileSidebarOpen(false)} className="self-end text-2xl p-2 text-gray-400 hover:text-white">×</button>
                            <div className="flex-shrink-0 p-2 border-b border-gray-700">
                                <QuickAccessSidebar mobile={true} />
                            </div>
                            <div className="flex-1 min-h-0"><WeeklyCompetitorsPanel setHasRankChanged={setHasRankChanged} /></div>
                            <div className="flex-1 min-h-0 border-t border-gray-700"><ChampionshipRankingPanel /></div>
                        </div>
                    </div>
                    <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setIsMobileSidebarOpen(false)}></div>
                </>
            )}

            <header className="flex justify-between items-center mb-6 flex-shrink-0">
                <Button onClick={() => window.location.hash = '#/profile'}>&larr; 프로필로</Button>
                <div className="text-center">
                    <h1 className="text-3xl lg:text-4xl font-bold">자동대국 챔피언십</h1>
                    <p className="text-gray-400 mt-2 text-sm">자신의 능력치와 장비로 시뮬레이션 대회에 참가하세요!</p>
                </div>
                 <div className="w-24 hidden lg:block"></div>
            </header>
            
            <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
                <main className="flex-grow grid grid-rows-[auto,1fr] gap-6 min-h-0">
                    <div className="grid grid-cols-2 gap-4 flex-shrink-0">
                        <TournamentCard type="neighborhood" onClick={() => handleEnterArena('neighborhood')} onContinue={() => handleContinueTournament('neighborhood')} inProgress={neighborhoodState || null} />
                        <TournamentCard type="national" onClick={() => handleEnterArena('national')} onContinue={() => handleContinueTournament('national')} inProgress={nationalState || null} />
                        <TournamentCard type="world" onClick={() => handleEnterArena('world')} onContinue={() => handleContinueTournament('world')} inProgress={worldState || null} />
                        <PlaceholderCard title="팀 챔피언십" description="다른 플레이어와 팀을 이루어 경쟁하세요." imageUrl="/images/Champ4.png" />
                    </div>
                    <div className="bg-gray-800/50 rounded-lg shadow-lg min-h-0">
                        <ChatWindow
                            messages={globalChat}
                            mode="global"
                            onAction={handlers.handleAction}
                            onViewUser={handlers.openViewingUser}
                            locationPrefix="[챔피언십]"
                        />
                    </div>
                </main>
                 <aside className="hidden lg:flex flex-col lg:w-[480px] flex-shrink-0 gap-6">
                    <div className="flex-1 flex flex-row gap-4 items-stretch min-h-0">
                        <div className="flex-1 min-w-0">
                            <WeeklyCompetitorsPanel setHasRankChanged={setHasRankChanged}/>
                        </div>
                        <div className="w-24 flex-shrink-0">
                            <QuickAccessSidebar fillHeight={true} />
                        </div>
                    </div>
                    <div className="flex-1 min-h-0">
                        <ChampionshipRankingPanel />
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default TournamentLobby;