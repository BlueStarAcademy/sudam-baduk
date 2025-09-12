import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import Button from './Button.js';
import { TOWER_STAGES } from '../constants/towerChallengeConstants.js';
import { SinglePlayerStageInfo, TowerRank, UserWithStatus } from '../types/index.js';
import { CONSUMABLE_ITEMS, AVATAR_POOL, BORDER_POOL } from '../constants.js';
import Avatar from './Avatar.js';

const TowerRankings: React.FC<{ rankings: TowerRank[], currentUser: UserWithStatus }> = ({ rankings, currentUser }) => {
    const myRank = rankings.find(r => r.user.id === currentUser.id);

    return (
        <div className="flex flex-col h-full">
            <h3 className="text-lg font-bold text-center mb-2 text-primary flex-shrink-0">도전의 탑 TOP 100</h3>
            {rankings.length > 0 ? (
                <ul className="space-y-1 overflow-y-auto flex-grow pr-2">
                    {rankings.slice(0, 100).map(rank => (
                        <li key={rank.rank} className={`flex items-center gap-2 p-1.5 rounded-md text-xs ${rank.user.id === currentUser.id ? 'bg-amber-800/50' : 'bg-stone-900/50'}`}>
                            <span className="font-black text-base w-6 text-center">{rank.rank}</span>
                            <span className="font-semibold truncate flex-1">{rank.user.nickname}</span>
                            <span className="font-mono text-stone-300">{rank.floor}층</span>
                        </li>
                    ))}
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
    
    const renderRewardItem = (reward: { itemId: string, quantity: number }, index: number) => {
        const itemTemplate = CONSUMABLE_ITEMS.find(ci => ci.name === reward.itemId);
        if (!itemTemplate) return null;
        return (
            <div key={index} className="flex items-center" title={`${reward.itemId} x${reward.quantity}`}>
                <img src={itemTemplate.image!} alt={reward.itemId} className="w-5 h-5 object-contain" />
            </div>
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
                    <div className="flex items-center gap-1.5">
                        {(rewards.gold ?? 0) > 0 && 
                            <span className="flex items-center gap-0.5" title={`골드 ${rewards.gold}`}>
                                <img src="/images/Gold.png" alt="Gold" className="w-3 h-3"/>
                                {rewards.gold}
                            </span>
                        }
                         {(rewards.exp ?? 0) > 0 &&
                             <span className="flex items-center gap-0.5" title={`경험치 ${rewards.exp}`}>
                                <span className="text-sm">⭐</span> {rewards.exp}
                            </span>
                        }
                        {rewards.items?.map(renderRewardItem)}
                        {rewards.bonus && 
                            <span className="flex items-center gap-0.5" title={`보너스 스탯 ${rewards.bonus.replace('스탯', '')}`}>
                                <img src="/images/icons/stat_point.png" alt="Stat Point" className="w-4 h-4" />
                                {rewards.bonus.replace('스탯', '')}
                            </span>
                        }
                    </div>
                </div>
            </div>
            <div className="flex-shrink-0 w-24 text-center">
                 {isLocked ? (
                    <div className="text-stone-500 font-bold text-sm px-3">잠김</div>
                ) : isCurrent ? (
                     <Button 
                        onClick={() => handleStageClick(stage.floor!)} 
                        disabled={isLocked}
                        className="!py-1.5 !px-2 w-full !text-xs"
                        colorScheme={'yellow'}
                    >
                        도전하기 (⚡{stage.actionPointCost})
                    </Button>
                ) : ( // isCleared
                     <Button 
                        onClick={() => handleStageClick(stage.floor!)} 
                        disabled={isLocked}
                        className="!py-1.5 !px-2 w-full !text-xs"
                        colorScheme={'blue'}
                    >
                        재도전 (⚡{stage.actionPointCost})
                    </Button>
                )}
            </div>
        </li>
    );
};


const TowerChallengeLobby: React.FC = () => {
    const { currentUserWithStatus, towerRankings, handlers } = useAppContext();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const stageRefs = useRef<Map<number, HTMLLIElement | null>>(new Map());
    
    const highestFloor = currentUserWithStatus?.towerProgress?.highestFloor ?? 0;
    const myHighestFloor = currentUserWithStatus?.towerProgress?.highestFloor ?? 0;

    const myRank = useMemo(() => {
        return towerRankings.find(r => r.user.id === currentUserWithStatus?.id);
    }, [towerRankings, currentUserWithStatus?.id]);

    const avatarUrl = useMemo(() => AVATAR_POOL.find(a => a.id === currentUserWithStatus?.avatarId)?.url, [currentUserWithStatus?.avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find(b => b.id === currentUserWithStatus?.borderId)?.url, [currentUserWithStatus?.borderId]);


    useEffect(() => {
        const currentFloor = highestFloor + 1;
        const targetElement = stageRefs.current.get(currentFloor);
        if (targetElement && scrollContainerRef.current) {
            setTimeout(() => {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }, [highestFloor]);

    if (!currentUserWithStatus) return null;
    
    return (
        <div className="w-full h-full flex flex-col bg-tertiary text-stone-200 p-4 gap-4 overflow-hidden">
            <header className="flex justify-between items-center flex-shrink-0 px-4">
                <Button onClick={() => window.location.hash = '#/profile'} colorScheme="gray">&larr;</Button>
                <h1 className="text-3xl font-bold text-white" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.7)'}}>도전의 탑</h1>
                <div className="w-16"></div>
            </header>

            <main className="flex-1 flex flex-row items-stretch justify-center gap-4 min-h-0">
                {/* Left Panel */}
                <div ref={scrollContainerRef} className="w-[450px] flex-shrink-0 bg-black/60 backdrop-blur-sm rounded-lg p-3 flex flex-col border border-stone-700/50 overflow-y-auto">
                    <h3 className="text-lg font-bold text-center mb-2 text-primary flex-shrink-0">층 선택</h3>
                    <ul className="space-y-2 flex flex-col-reverse">
                        {TOWER_STAGES.slice(0, 100).map(stage => {
                            const isLocked = !currentUserWithStatus.isAdmin && stage.floor! > highestFloor + 1;
                            const isCleared = stage.floor! <= highestFloor;
                            const isCurrent = stage.floor! === highestFloor + 1;
                            return (
                                <StageListItem
                                    key={stage.id}
                                    stage={stage}
                                    isLocked={isLocked}
                                    isCleared={isCleared}
                                    isCurrent={isCurrent}
                                    onAction={handlers.handleAction}
                                    currentUser={currentUserWithStatus}
                                    refProp={(el) => { stageRefs.current.set(stage.floor!, el); }}
                                />
                            );
                        })}
                    </ul>
                </div>

                {/* Center Panel */}
                <div className="flex-1 flex flex-col min-w-0 min-h-0 items-center justify-center rounded-lg border border-stone-700/50 overflow-hidden">
                    <img src="/images/tower/Tower1.png" alt="도전의 탑" className="max-w-full max-h-full object-contain" />
                </div>

                {/* Right Panel */}
                <div className="w-[300px] flex-shrink-0 flex flex-col gap-4">
                    <div className="flex-shrink-0 bg-black/60 backdrop-blur-sm rounded-lg p-3 border border-stone-700/50">
                        <h3 className="font-semibold text-stone-400 text-sm text-center mb-2">내 기록</h3>
                        <div className="flex items-center gap-4">
                            <Avatar
                                userId={currentUserWithStatus.id}
                                userName={currentUserWithStatus.nickname}
                                avatarUrl={avatarUrl}
                                borderUrl={borderUrl}
                                size={64}
                            />
                            <div className="flex-1 space-y-1">
                                <p className="font-bold text-lg text-white truncate">{currentUserWithStatus.nickname}</p>
                                <div className="text-sm text-stone-300">
                                    <p>순위: <span className="font-mono font-semibold text-white">{myRank ? `${myRank.rank}위` : 'Unranked'}</span></p>
                                    <p>층수: <span className="font-mono font-semibold text-white">{myHighestFloor}층</span></p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0 bg-black/60 backdrop-blur-sm rounded-lg p-3 border border-stone-700/50">
                         <TowerRankings rankings={towerRankings} currentUser={currentUserWithStatus} />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default TowerChallengeLobby;