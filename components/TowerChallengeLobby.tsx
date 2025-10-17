import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import BackButton from './BackButton.js';
import Button from './Button.js';
// FIX: Corrected import path for TOWER_STAGES constant.
import { TOWER_STAGES } from '../constants/towerChallengeConstants.js';
import { CONSUMABLE_ITEMS, AVATAR_POOL, BORDER_POOL } from '../constants/index.js';
import Avatar from './Avatar.js';
import TowerRankingRewardsModal from './TowerRankingRewardsModal.js';
import { SinglePlayerStageInfo, TowerRank, UserWithStatus, GameType, InventoryItem } from '../types/index.js';

interface TowerRankingsProps {
    rankings: TowerRank[];
    currentUser: UserWithStatus;
    onViewUser: (userId: string) => void;
}

const TowerRankings: React.FC<TowerRankingsProps> = ({ rankings, currentUser, onViewUser }) => {
    const myRank = rankings.find(r => r.user.id === currentUser.id);

    return (
        <div className="flex flex-col h-full">
            <h3 className="text-lg font-bold text-center mb-2 text-primary flex-shrink-0">도전의 탑 TOP 100</h3>
            {rankings.length > 0 ? (
                <ul className="space-y-1 overflow-y-auto flex-grow pr-2">
                    {rankings.slice(0, 100).map(rank => {
                        const avatarUrl = AVATAR_POOL.find(a => a.id === rank.user.avatarId)?.url;
                        const borderUrl = BORDER_POOL.find(b => b.id === rank.user.borderId)?.url;
                        const isClickable = rank.user.id !== currentUser.id;
                        return (
                            <li
                                key={rank.rank}
                                className={`flex items-center gap-2 p-1.5 rounded-md text-xs ${
                                    rank.user.id === currentUser.id ? 'bg-amber-800/50' : 'bg-stone-900/50'
                                } ${isClickable ? 'cursor-pointer hover:bg-stone-700/50' : ''}`}
                                onClick={() => isClickable && onViewUser(rank.user.id)}
                                title={isClickable ? `${rank.user.nickname} 프로필 보기` : ''}
                            >
                                <span className="font-black text-base w-6 text-center">{rank.rank}</span>
                                <Avatar userId={rank.user.id} userName={rank.user.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={28} />
                                <span className="font-semibold truncate flex-1">{rank.user.nickname}</span>
                                <span className="font-mono text-stone-300">{rank.floor}층</span>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <div className="flex-grow flex items-center justify-center text-sm text-stone-500">
                    랭킹 정보가 없습니다.
                </div>
            )}
            {myRank && (
                <div className="mt-2 pt-2 border-t border-stone-700 flex-shrink-0">
                     <li className="flex items-center gap-2 p-1.5 rounded-md text-xs bg-amber-800/50">
                        <span className="font-black text-base w-6 text-center">{myRank.rank}</span>
                        <Avatar userId={myRank.user.id} userName={myRank.user.nickname} size={28} />
                        <span className="font-semibold truncate flex-1">{myRank.user.nickname}</span>
                        <span className="font-mono text-stone-300">{myRank.floor}층</span>
                    </li>
                </div>
            )}
        </div>
    );
};

const StageListItem: React.FC<{
    stage: SinglePlayerStageInfo;
    isLocked: boolean;
    isCleared: boolean;
    isCurrent: boolean;
    onAction: (action: any) => void;
    currentUser: UserWithStatus;
    refProp: React.Ref<HTMLLIElement>;
}> = ({ stage, isLocked, isCleared, isCurrent, onAction, currentUser, refProp }) => {
    
    const handleStageClick = (floor: number) => {
        if (!currentUser || isLocked) return;
        if (currentUser.actionPoints.current < stage.actionPointCost) {
            alert('행동력이 부족합니다.');
            return;
        }
        onAction({ type: 'START_TOWER_CHALLENGE_GAME', payload: { floor } });
    };
    
    const borderClass = isCurrent ? 'border-yellow-400 ring-2 ring-yellow-400/50' 
                      : isCleared ? 'border-green-600' 
                      : 'border-stone-700';
                      
    const rewards = isCleared ? stage.rewards.repeatClear : stage.rewards.firstClear;
    const rewardTitle = isCleared ? "반복 클리어 보상" : "최초 클리어 보상";
    const gameTypeDisplay = stage.gameType ? gameTypeKorean[stage.gameType] : '클래식';
    
    const renderRewardItem = (reward: InventoryItem | { itemId: string; quantity: number }, index: number) => {
        // Correctly handle union type
        const itemName = 'itemId' in reward ? reward.itemId : reward.name;
        const itemTemplate = CONSUMABLE_ITEMS.find(ci => ci.name === itemName);
        if (!itemTemplate?.image) return null;
        const quantity = 'quantity' in reward ? reward.quantity : 1;
        const title = `${itemName} x${quantity}`;
        return (
            <span key={index} className="flex items-center gap-1" title={title}>
                <img src={itemTemplate.image} alt={itemName} className="w-5 h-5 object-contain" />
            </span>
        );
    };

    return (
        <li 
            ref={refProp}
            className={`p-2 rounded-lg flex items-center gap-3 transition-all duration-200 border ${
                isLocked ? 'bg-black/40 opacity-60' : `bg-stone-800/70 ${borderClass} hover:bg-tertiary/60`
            }`}
        >
            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-xl font-black text-primary bg-stone-900/50 rounded-md border border-stone-600">
                {stage.floor}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs text-stone-400" title={rewardTitle}>
                    <span className={isCleared ? "text-green-400 font-bold" : "text-yellow-400 font-bold"}>{rewardTitle}:</span>
                    <div className="flex items-center flex-wrap justify-end gap-x-1.5">
                        {(rewards.gold ?? 0) > 0 && 
                            <span className="flex items-center gap-0.5" title={`골드 ${rewards.gold}`}>
                                <img src="/images/Gold.png" alt="Gold" className="w-3 h-3"/> {rewards.gold}
                            </span>
                        }
                        {(rewards.exp?.amount ?? 0) > 0 &&
                             <span className="flex items-center gap-0.5" title={`경험치 ${rewards.exp!.amount}`}>
                                <span className="text-sm">⭐</span> {rewards.exp!.amount}
                            </span>
                        }
                        {rewards.items?.map(renderRewardItem)}
                        {rewards.bonus && 
                            <span className="flex items-center gap-0.5" title={`보너스 스탯 +${rewards.bonus.replace('스탯', '')}`}>
                                <img src="/images/icons/stat_point.png" alt="Stat Point" className="w-4 h-4" />
                                <span className="font-semibold text-sm">+{rewards.bonus.replace('스탯', '')}</span>
                            </span>
                        }
                    </div>
                </div>
            </div>
            <div className="flex-shrink-0 w-24 text-center">
                 {isLocked ? (
                    <div className="text-stone-500 font-bold text-sm px-3">잠김</div>
                ) : (
                     <Button 
                        onClick={() => handleStageClick(stage.floor!)} 
                        className="!py-1.5 !px-2 w-full !text-xs"
                        colorScheme={isCurrent ? 'yellow' : 'blue'}
                    >
                        {isCurrent ? '도전' : '재도전'} (⚡{stage.actionPointCost})
                    </Button>
                )}
            </div>
        </li>
    );
};

const gameTypeKorean: Record<GameType, string> = {
    'capture': '따내기',
    'survival': '살리기',
    'speed': '스피드',
    'missile': '미사일',
    'hidden': '히든'
};

const TowerChallengeLobby: React.FC = () => {
    const { currentUserWithStatus, towerRankings, handlers } = useAppContext();
    const [isRewardInfoOpen, setIsRewardInfoOpen] = useState(false);
    const [isRankingPanelOpen, setIsRankingPanelOpen] = useState(false);
    const scrollContainerRef = useRef<HTMLUListElement>(null);
    const stageRefs = useRef<Map<number, HTMLLIElement | null>>(new Map());
    
    const myHighestFloor = currentUserWithStatus?.towerProgress?.highestFloor ?? 0;
    const avatarUrl = useMemo(() => AVATAR_POOL.find(a => a.id === currentUserWithStatus?.avatarId)?.url, [currentUserWithStatus?.avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find(b => b.id === currentUserWithStatus?.borderId)?.url, [currentUserWithStatus?.borderId]);
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const calculateTime = () => {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            const nextMonth = new Date(year, month + 1, 1);
            const diff = nextMonth.getTime() - now.getTime();

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            setTimeLeft(`${days}일 ${hours}시간 남음`);
        };
        calculateTime();
        const interval = setInterval(calculateTime, 60 * 60 * 1000); // Update every hour
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const currentFloor = myHighestFloor + 1;
        const targetElement = stageRefs.current.get(currentFloor);
        if (targetElement && scrollContainerRef.current) {
            setTimeout(() => targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
        }
    }, [myHighestFloor]);

    if (!currentUserWithStatus) return null;
    
    const RankingPanelContent = (
        <div className="flex flex-col h-full gap-4">
            <div className="flex-shrink-0 bg-black/60 backdrop-blur-sm rounded-lg p-3 border border-stone-700/50">
                <h3 className="font-semibold text-stone-400 text-sm text-center mb-2">내 기록</h3>
                <div className="flex items-center gap-4">
                    <Avatar userId={currentUserWithStatus.id} userName={currentUserWithStatus.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={64} />
                    <div className="flex-1 space-y-1">
                        <p className="font-bold text-lg text-white truncate">{currentUserWithStatus.nickname}</p>
                        <div className="text-sm text-stone-300">
                            <p>순위: <span className="font-mono font-semibold text-white">{towerRankings.find(r => r.user.id === currentUserWithStatus.id)?.rank ?? 'Unranked'}</span></p>
                            <p>층수: <span className="font-mono font-semibold text-white">{myHighestFloor}층</span></p>
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex-1 min-h-0 bg-black/60 backdrop-blur-sm rounded-lg p-3 border border-stone-700/50">
                 <TowerRankings rankings={towerRankings} currentUser={currentUserWithStatus} onViewUser={handlers.openViewingUser} />
            </div>
        </div>
    );
    
    const FloorListContent = (
         <div className="flex flex-col h-full">
            <h3 className="text-lg font-bold text-center mb-2 text-primary flex-shrink-0">층 선택</h3>
            <ul ref={scrollContainerRef} className="space-y-2 flex flex-col-reverse overflow-y-auto pr-2">
                {TOWER_STAGES.slice(0, 100).map((stage) => {
                    const isLocked = !currentUserWithStatus.isAdmin && stage.floor! > myHighestFloor + 1;
                    const isCleared = stage.floor! <= myHighestFloor;
                    const isCurrent = stage.floor! === myHighestFloor + 1;
                    return (
                        <StageListItem
                            key={stage.id} stage={stage} isLocked={isLocked} isCleared={isCleared} isCurrent={isCurrent}
                            onAction={handlers.handleAction} currentUser={currentUserWithStatus}
                            refProp={(el) => { stageRefs.current.set(stage.floor!, el); }}
                        />
                    );
                })}
            </ul>
        </div>
    );

    return (
        <div className="w-full h-full flex flex-col bg-tertiary lg:bg-tower-default text-stone-200 overflow-hidden relative">
            {isRewardInfoOpen && <TowerRankingRewardsModal onClose={() => setIsRewardInfoOpen(false)} isTopmost />}
            
            <header className="flex justify-between items-center flex-shrink-0 px-4 pt-4">
                <BackButton onClick={() => window.location.hash = '#/profile'} />
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-white" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.7)'}}>도전의 탑</h1>
                    <p className="text-xs text-stone-300">랭킹 초기화까지: {timeLeft}</p>
                </div>
                <div className="w-32 text-right">
                    <Button onClick={() => setIsRewardInfoOpen(true)} colorScheme="yellow" className="!text-sm">보상 정보</Button>
                </div>
            </header>

            <main className="flex-1 flex flex-col lg:flex-row p-4 gap-4 min-h-0">
                {/* Mobile & Tablet Layout */}
                <div className="lg:hidden flex-1 flex flex-col gap-4 min-h-0">
                    <div className="h-1/2 flex-shrink-0 relative">
                         <img src="/images/tower/Tower1.png" alt="도전의 탑" className="w-full h-full object-contain" />
                    </div>
                    <div className="h-1/2 bg-black/60 backdrop-blur-sm rounded-lg p-3 flex flex-col border border-stone-700/50 min-h-0">
                        {FloorListContent}
                    </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden lg:flex flex-1 gap-4 min-h-0">
                    <div className="w-1/3 bg-black/60 backdrop-blur-sm rounded-lg p-3 flex flex-col border border-stone-700/50">
                       {FloorListContent}
                    </div>
                    <div className="w-1/3 flex items-center justify-center">
                        <img src="/images/tower/Tower1.png" alt="도전의 탑" className="max-w-full max-h-full object-contain" />
                    </div>
                    <div className="w-1/3">
                       {RankingPanelContent}
                    </div>
                </div>
            </main>
            
            <button 
                onClick={() => setIsRankingPanelOpen(o => !o)}
                className="lg:hidden fixed top-1/2 -translate-y-1/2 right-0 z-30 bg-secondary/80 backdrop-blur-sm p-2 rounded-l-lg text-2xl"
                aria-label="랭킹 보기"
            >
                &lt;
            </button>
            
            <div className={`lg:hidden fixed top-0 right-0 h-full w-[300px] bg-primary shadow-2xl z-50 transition-transform duration-300 ${isRankingPanelOpen ? 'translate-x-0' : 'translate-x-full'} border-l border-color p-2 flex flex-col`}>
                 <button onClick={() => setIsRankingPanelOpen(false)} className="self-end text-2xl font-bold text-tertiary hover:text-primary mb-2">&times;</button>
                 {RankingPanelContent}
            </div>
            {isRankingPanelOpen && <div className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setIsRankingPanelOpen(false)}></div>}
        </div>
    );
};

export default TowerChallengeLobby;
