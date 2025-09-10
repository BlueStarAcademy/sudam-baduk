import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import Button from './Button.js';
import { TOWER_STAGES, TOWER_RANKING_REWARDS } from '../constants/towerChallengeConstants.js';
import { TOWER_MAP_1, TOWER_MAP_2, TOWER_MAP_3, TOWER_MAP_4 } from '../assets.js';
import { CONSUMABLE_ITEMS } from '../constants.js';
import { LeagueRewardTier, TowerRank, UserWithStatus, SinglePlayerStageInfo } from '../types/index.js';

const TowerRankings: React.FC<{ rankings: TowerRank[], currentUser: UserWithStatus }> = ({ rankings, currentUser }) => {
    const myRank = rankings.find(r => r.user.id === currentUser.id);

    return (
        <div className="bg-stone-900/50 rounded-lg p-3 h-full flex flex-col">
            <h3 className="text-lg font-bold text-center mb-2 text-red-300 flex-shrink-0">월간 랭킹 TOP 100</h3>
            {rankings.length > 0 ? (
                <ul className="space-y-1 overflow-y-auto flex-grow pr-2">
                    {rankings.map(rank => (
                        <li key={rank.rank} className={`flex items-center gap-2 p-1 rounded-md text-xs ${rank.user.id === currentUser.id ? 'bg-amber-800/50' : 'bg-stone-800/50'}`}>
                            <span className="font-bold w-6 text-center">{rank.rank}</span>
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
                     <li className="flex items-center gap-2 p-1 rounded-md text-xs bg-amber-800/50">
                        <span className="font-bold w-6 text-center">{myRank.rank}</span>
                        <span className="font-semibold truncate flex-1">{myRank.user.nickname}</span>
                        <span className="font-mono text-stone-300">{myRank.floor}층</span>
                    </li>
                </div>
            )}
        </div>
    );
};


const StagePanel: React.FC<{
    stage: SinglePlayerStageInfo;
    isLocked: boolean;
    isCleared: boolean;
    onAction: (action: any) => void;
    currentUser: UserWithStatus;
    position: { top: string; left?: string; right?: string };
    refProp: React.Ref<HTMLDivElement>;
}> = ({ stage, isLocked, isCleared, onAction, currentUser, position, refProp }) => {
    
    const handleStageClick = (floor: number) => {
        if (!currentUser) return;
        if (currentUser.actionPoints.current < stage.actionPointCost) {
            alert('행동력이 부족합니다.');
            return;
        }
        onAction({ type: 'START_TOWER_CHALLENGE_GAME', payload: { floor } });
    };

    const rewards = isCleared ? stage.rewards.repeatClear : stage.rewards.firstClear;
    
    const renderRewardItem = (reward: { itemId: string, quantity: number }, index: number) => {
        const itemTemplate = CONSUMABLE_ITEMS.find(ci => ci.name === reward.itemId);
        if (!itemTemplate) return null;
        return (
            <div key={index} className="flex items-center gap-1 text-xs" title={`${reward.itemId} x${reward.quantity}`}>
                <img src={itemTemplate.image!} alt={reward.itemId} className="w-5 h-5 object-contain" />
            </div>
        );
    };

    return (
        <div 
            ref={refProp}
            className="absolute p-3 rounded-xl bg-black/50 backdrop-blur-sm border-2 border-stone-600/70 shadow-2xl w-52 transition-transform hover:scale-105"
            style={{ ...position, transform: 'translateY(-50%)' }}
        >
            <div className="flex justify-between items-center mb-2">
                <span className={`font-black text-2xl ${isCleared ? 'text-green-400' : 'text-amber-400'}`}>{stage.floor}층</span>
                 <Button 
                    onClick={() => handleStageClick(stage.floor!)} 
                    disabled={isLocked}
                    className="!text-xs !py-1 !px-2"
                    colorScheme={isCleared ? 'blue' : 'accent'}
                >
                    {isLocked ? '🔒' : `도전 (⚡${stage.actionPointCost})`}
                </Button>
            </div>
            <div className="text-xs text-stone-300 mt-1 pt-1 border-t border-stone-600">
                <span className="font-semibold text-stone-400">최초 보상:</span>
                <div className="flex items-center gap-3 mt-1">
                    {(stage.rewards.firstClear.gold ?? 0) > 0 && <span className="flex items-center gap-1"><img src="/images/Gold.png" alt="Gold" className="w-4 h-4"/>{stage.rewards.firstClear.gold}</span>}
                    {stage.rewards.firstClear.exp > 0 && <span className="flex items-center gap-1">⭐{stage.rewards.firstClear.exp}</span>}
                    {stage.rewards.firstClear.items?.map(renderRewardItem)}
                </div>
            </div>
        </div>
    );
};

const TowerChallengeLobby: React.FC = () => {
    const { currentUserWithStatus, towerRankings, handlers } = useAppContext();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const stageRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

    const highestFloor = currentUserWithStatus?.towerProgress?.highestFloor ?? 0;

    const chunk = (arr: any[], size: number) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
    const chunks = useMemo(() => chunk(TOWER_STAGES, 5), []);

    useEffect(() => {
        const currentFloor = highestFloor + 1;
        const targetElement = stageRefs.current.get(currentFloor);
        if (targetElement && scrollContainerRef.current) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    }, [highestFloor]);
    
    if (!currentUserWithStatus) return null;

    return (
        <div className="w-full h-full flex flex-col bg-stone-900 text-stone-200 p-4 gap-4 overflow-hidden">
            <header className="flex justify-between items-center flex-shrink-0">
                <Button onClick={() => window.location.hash = '#/profile'} colorScheme="gray">&larr; 프로필로</Button>
                <h1 className="text-3xl font-bold text-red-300">도전의 탑</h1>
                <div className="w-32"></div>
            </header>

            <main className="flex-1 flex flex-row gap-4 min-h-0">
                <div className="w-3/4 overflow-y-auto scroll-smooth" ref={scrollContainerRef}>
                    <div className="flex flex-col-reverse">
                        {chunks.map((chunk, chunkIndex) => {
                            const floorStart = chunk[0].floor!;
                            let bgImage;
                            if (floorStart >= 1 && floorStart <= 5) {
                                bgImage = TOWER_MAP_1;
                            } else if (floorStart >= 6 && floorStart <= 95) {
                                bgImage = TOWER_MAP_2;
                            }
                            
                            const chunkSize = chunk.length;

                            if (floorStart === 96) { // Special chunk for 96-100
                                return (
                                    <div key={`chunk-${chunkIndex}`} className="h-screen w-full relative flex-shrink-0">
                                        <div className="absolute inset-0 top-[20%] h-[80%]" style={{ backgroundImage: `url(${TOWER_MAP_3})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
                                        <div className="absolute inset-0 bottom-[80%] h-[20%]" style={{ backgroundImage: `url(${TOWER_MAP_4})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
                                        {chunk.map((stage, index) => {
                                            const isLocked = !currentUserWithStatus.isAdmin && stage.floor! > highestFloor + 1;
                                            const isCleared = stage.floor! <= highestFloor;
                                            const position = {
                                                top: `${10 + (chunkSize - 1 - index) * 20}%`,
                                                ...(index % 2 === 0 ? { left: '5%' } : { right: '5%' })
                                            };
                                            return <StagePanel key={stage.id} stage={stage} isLocked={isLocked} isCleared={isCleared} onAction={handlers.handleAction} currentUser={currentUserWithStatus!} position={position} refProp={(el) => { stageRefs.current.set(stage.floor!, el); }} />;
                                        })}
                                    </div>
                                );
                            }

                            return (
                                <div key={`chunk-${chunkIndex}`} className="h-screen w-full relative flex-shrink-0" style={{ backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundRepeat: 'repeat-y', backgroundPosition: 'center' }}>
                                    {chunk.map((stage, index) => {
                                        const isLocked = !currentUserWithStatus.isAdmin && stage.floor! > highestFloor + 1;
                                        const isCleared = stage.floor! <= highestFloor;
                                        const position = {
                                            top: `${10 + (chunkSize - 1 - index) * 18}%`,
                                            ...(index % 2 === 0 ? { left: '5%' } : { right: '5%' })
                                        };
                                        return <StagePanel key={stage.id} stage={stage} isLocked={isLocked} isCleared={isCleared} onAction={handlers.handleAction} currentUser={currentUserWithStatus!} position={position} refProp={(el) => { stageRefs.current.set(stage.floor!, el); }} />;
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="w-1/4">
                    {currentUserWithStatus ? (
                         <TowerRankings rankings={towerRankings} currentUser={currentUserWithStatus} />
                    ) : (
                        <div className="bg-stone-900/50 rounded-lg p-3 h-full flex flex-col">
                            <h3 className="text-lg font-bold text-center mb-2 text-red-300 flex-shrink-0">월간 랭킹 TOP 100</h3>
                            <div className="flex-grow flex items-center justify-center text-sm text-stone-500">
                                랭킹 정보 로딩 중...
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default TowerChallengeLobby;