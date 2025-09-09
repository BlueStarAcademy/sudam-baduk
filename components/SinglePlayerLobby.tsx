import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import Button from './Button.js';
import { SinglePlayerLevel, ServerAction, UserWithStatus } from '../types.js';
import { SINGLE_PLAYER_STAGES, SINGLE_PLAYER_MISSIONS, CONSUMABLE_ITEMS } from '../constants.js';

const LEVEL_DATA: { id: SinglePlayerLevel; name: string; unlockRequirement: number; image: string; }[] = [
    { id: SinglePlayerLevel.입문, name: '입문반', unlockRequirement: 0, image: '/images/single/Academy.png' },
    { id: SinglePlayerLevel.초급, name: '초급반', unlockRequirement: 20, image: '/images/single/Academy1.png' },
    { id: SinglePlayerLevel.중급, name: '중급반', unlockRequirement: 40, image: '/images/single/Academy2.png' },
    { id: SinglePlayerLevel.고급, name: '고급반', unlockRequirement: 60, image: '/images/single/Academy3.png' },
    { id: SinglePlayerLevel.유단자, name: '유단자', unlockRequirement: 80, image: '/images/single/Academy4.png' },
];

const StoneDisplay: React.FC<{
    baseSrc: string;
    patternSrc?: string;
    count: number;
    title: string;
}> = ({ baseSrc, patternSrc, count, title }) => {
    if (count === 0) return null;
    return (
        <div className="flex items-center gap-1.5" title={title}>
            <div className="relative w-6 h-6">
                <img src={baseSrc} alt={title} className="w-full h-full object-contain" />
                {patternSrc && <img src={patternSrc} alt="" className="w-full h-full absolute top-0 left-0 object-contain" />}
            </div>
            <span className="text-sm font-semibold">x{count}</span>
        </div>
    );
};

const StageListItem: React.FC<{
    stage: typeof SINGLE_PLAYER_STAGES[0];
    isLocked: boolean;
    isCleared: boolean;
    isCurrent: boolean;
    onAction: (action: ServerAction) => void;
    currentUser: UserWithStatus;
}> = ({ stage, isLocked, isCleared, isCurrent, onAction, currentUser }) => {
    
    const handleStageClick = (stageId: string) => {
        onAction({ type: 'START_SINGLE_PLAYER_GAME', payload: { stageId } });
    };

    const canAfford = currentUser.actionPoints.current >= stage.actionPointCost;

    const borderClass = isCurrent ? 'border-yellow-400 ring-2 ring-yellow-400' 
                      : isCleared ? 'border-green-600' 
                      : 'border-color';
                      
    const rewards = isCleared ? stage.rewards.repeatClear : stage.rewards.firstClear;
    const rewardTitle = isCleared ? "반복 클리어 보상" : "최초 클리어 보상";

    return (
        <div className={`flex items-center gap-3 p-2 rounded-lg border-2 transition-all duration-200 ${
            isLocked ? 'bg-secondary/30 opacity-60' : `bg-secondary/60 ${borderClass} hover:bg-tertiary/60`
        }`}>
            <div className="flex-shrink-0 w-16 h-16 flex flex-col items-center justify-center bg-tertiary rounded-lg border-2 border-color shadow-inner">
                {isCleared ? (
                    <span className="text-4xl" title="클리어">✅</span>
                ) : (
                    <>
                        <span className="text-xs text-tertiary">스테이지</span>
                        <span className="font-bold text-[clamp(1.125rem,0.9rem+1.5vw,1.5rem)] text-primary">{stage.name.replace('스테이지 ', '')}</span>
                    </>
                )}
            </div>
            
            <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-secondary">
                <div className="flex items-center gap-2" title={`AI 레벨 ${stage.katagoLevel}`}>
                    <span className="text-xl">🤖</span>
                    <span className="font-semibold">Lv.{stage.katagoLevel}</span>
                </div>
                <div className="flex items-center gap-2 text-[clamp(0.875rem,0.75rem+1vw,1.125rem)]" title={`목표 점수 흑 ${stage.targetScore.black} / 백 ${stage.targetScore.white}`}>
                    <span className="font-bold text-tertiary">목표:</span>
                    <span className="font-bold text-highlight">흑{stage.targetScore.black}/백{stage.targetScore.white}</span>
                </div>
                <div className="flex items-center gap-3">
                    <StoneDisplay baseSrc="/images/single/Black.png" count={stage.placements.black} title={`흑돌 ${stage.placements.black}개`} />
                    <StoneDisplay baseSrc="/images/single/Black.png" patternSrc="/images/single/BlackDouble.png" count={stage.placements.blackPattern} title={`흑 문양돌 ${stage.placements.blackPattern}개`} />
                </div>
                <div className="flex items-center gap-3">
                    <StoneDisplay baseSrc="/images/single/White.png" count={stage.placements.white} title={`백돌 ${stage.placements.white}개`} />
                    <StoneDisplay baseSrc="/images/single/White.png" patternSrc="/images/single/WhiteDouble.png" count={stage.placements.whitePattern} title={`백 문양돌 ${stage.placements.whitePattern}개`} />
                </div>
            </div>
            
             <div className="w-32 flex-shrink-0 text-left">
                <div className="flex flex-col items-start gap-1" title={rewardTitle}>
                    <p className="text-xs text-yellow-400 font-semibold">{rewardTitle}</p>
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                        {rewards.gold > 0 &&
                            <span className="flex items-center gap-1 text-xs" title={`골드 ${rewards.gold}`}>
                                <img src="/images/Gold.png" alt="골드" className="w-5 h-5" />
                                {rewards.gold}
                            </span>
                        }
                        {rewards.exp > 0 &&
                             <span className="flex items-center gap-1 text-xs" title={`경험치 ${rewards.exp}`}>
                                <span className="text-lg">⭐</span> {rewards.exp}
                            </span>
                        }
                        {rewards.items?.map((itemRef, idx) => {
                            const itemTemplate = CONSUMABLE_ITEMS.find(ci => ci.name === itemRef.itemId);
                            if (!itemTemplate?.image) return null;
                            return (
                                <div key={idx} className="flex items-center gap-1 text-xs" title={`${itemRef.itemId} x${itemRef.quantity}`}>
                                    <img src={itemTemplate.image} alt={itemRef.itemId} className="w-6 h-6 object-contain" />
                                    <span>x{itemRef.quantity}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
             <Button 
                onClick={() => handleStageClick(stage.id)} 
                disabled={isLocked || !canAfford}
                className="!py-4 w-28"
                title={!canAfford ? '행동력이 부족합니다.' : `행동력 ${stage.actionPointCost} 소모`}
            >
                {isLocked ? '🔒' : `입장 (⚡${stage.actionPointCost})`}
             </Button>
        </div>
    );
};

const formatTime = (ms: number): string => {
    if (ms <= 0) return "00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const getRequiredProgressForStageId = (stageId: string): number => {
    const index = SINGLE_PLAYER_STAGES.findIndex(s => s.id === stageId);
    if (index !== -1) return index + 1; // Progress is index + 1
    const parts = stageId.split('-');
    if (parts.length !== 2) return Infinity; // Cannot parse, lock it
    const levelPart = parts[0];
    const stageNum = parseInt(parts[1], 10);
    if (isNaN(stageNum)) return Infinity;
    let baseProgress = 0;
    switch (levelPart) {
        case '입문': baseProgress = 0; break;
        case '초급': baseProgress = 20; break;
        case '중급': baseProgress = 40; break;
        case '고급': baseProgress = 60; break;
        case '유단자': baseProgress = 80; break;
        default: return Infinity;
    }
    return baseProgress + stageNum;
};

const MissionCard: React.FC<{
    mission: typeof SINGLE_PLAYER_MISSIONS[0];
    isUnlocked: boolean;
    isStarted: boolean;
    accumulatedAmount: number;
    lastCollectionTime: number;
    onStart: () => void;
    onClaim: () => void;
}> = ({ mission, isUnlocked, isStarted, accumulatedAmount, lastCollectionTime, onStart, onClaim }) => {
    const rewardIcon = mission.rewardType === 'gold' ? '/images/Gold.png' : '/images/Zem.png';
    const [tick, setTick] = useState(0);

    useEffect(() => {
        if (!isStarted) return;
        const timerId = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(timerId);
    }, [isStarted]);

    const { displayAmount, timeToNextReward } = useMemo(() => {
        if (!isStarted) {
            return { displayAmount: 0, timeToNextReward: 0 };
        }

        const productionIntervalMs = mission.productionRateMinutes * 60 * 1000;
        if (productionIntervalMs <= 0) {
            return { displayAmount: accumulatedAmount, timeToNextReward: 0 };
        }
        
        const currentAmount = accumulatedAmount;

        let nextRewardTime = 0;
        if (currentAmount < mission.maxCapacity) {
            const now = Date.now();
            const elapsedMs = now - lastCollectionTime;
            nextRewardTime = productionIntervalMs - (elapsedMs % productionIntervalMs);
        }
        
        return { displayAmount: currentAmount, timeToNextReward: nextRewardTime };

    }, [isStarted, lastCollectionTime, accumulatedAmount, mission.productionRateMinutes, mission.maxCapacity, tick]);


    if (!isUnlocked) {
        const unlockText = mission.unlockStageId ? `${mission.unlockStageId} 클리어 필요` : '이전 단계 클리어 필요';
        return (
            <div className="bg-secondary/30 p-2 rounded-lg flex flex-col items-center text-center opacity-60 h-full">
                 <div className="relative w-[50px] h-[50px] flex-shrink-0 mb-2">
                    <img src={mission.image} alt={mission.name} className="w-full h-full object-cover p-1 rounded-md grayscale" />
                    <div className="absolute inset-0 bg-black/60 rounded-md flex items-center justify-center">
                        <span className="text-4xl" role="img" aria-label="Locked">🔒</span>
                    </div>
                </div>
                <h4 className="font-bold text-sm text-tertiary flex-grow">{mission.name}</h4>
                <p className="text-xs text-red-400 mt-1 font-semibold">{unlockText}</p>
            </div>
        );
    }
    
    const progressPercent = (displayAmount / mission.maxCapacity) * 100;

    return (
        <div className="bg-secondary/60 p-2 rounded-lg flex flex-col h-full border-2 border-color text-on-panel">
            <div className="flex flex-col items-center gap-1 mb-1 flex-grow text-center">
                <div className="w-[50px] h-[50px] flex-shrink-0 bg-tertiary rounded-md">
                    <img src={mission.image} alt={mission.name} className="w-full h-full object-cover p-1" />
                </div>
                <div className="flex flex-col min-w-0">
                    <h4 className="font-bold text-sm text-highlight" title={mission.name}>{mission.name}</h4>
                    <p className="text-[10px] text-tertiary mt-0.5">{mission.description}</p>
                </div>
            </div>
            
            {isStarted ? (
                <div className="flex-shrink-0 space-y-1">
                     <div className="flex items-center justify-between text-xs text-tertiary">
                        <span className="flex items-center gap-1">
                            <img src={rewardIcon} alt={mission.rewardType} className="w-4 h-4" />
                            <span>{mission.rewardAmount.toLocaleString()}/{mission.productionRateMinutes}분</span>
                        </span>
                        <span>
                           {displayAmount < mission.maxCapacity ? formatTime(timeToNextReward) : 'MAX'}
                        </span>
                    </div>
                    <div className="w-full bg-tertiary rounded-full h-3 relative overflow-hidden border border-black/20">
                        <div className="bg-green-500 h-full rounded-full" style={{ width: `${progressPercent}%` }}></div>
                        <span className="absolute inset-0 text-[10px] font-bold text-white flex items-center justify-center" style={{ textShadow: '1px 1px 1px black' }}>
                            {displayAmount.toLocaleString()}/{mission.maxCapacity.toLocaleString()}
                        </span>
                    </div>
                    <Button
                        onClick={onClaim}
                        disabled={displayAmount < 1}
                        colorScheme="green"
                        className="w-full !py-1 !text-xs"
                    >
                        수령하기 ({displayAmount.toLocaleString()})
                    </Button>
                </div>
            ) : (
                 <div className="flex-shrink-0">
                    <div className="text-[10px] text-tertiary text-center mb-1">
                        <img src={rewardIcon} alt={mission.rewardType} className="w-4 h-4 inline-block mr-1" />
                        <span>{mission.rewardAmount.toLocaleString()}/{mission.productionRateMinutes}분 (최대: {mission.maxCapacity.toLocaleString()})</span>
                    </div>
                    <Button onClick={onStart} colorScheme="blue" className="w-full mt-auto !py-1 !text-xs">
                        시작하기
                    </Button>
                </div>
            )}
        </div>
    );
};


const SinglePlayerMissions: React.FC<{onClose?: () => void}> = ({ onClose }) => {
    const { currentUserWithStatus, handlers } = useAppContext();

    if (!currentUserWithStatus) return null;

    const userProgress = currentUserWithStatus.singlePlayerProgress ?? 0;

    return (
        <div className="bg-panel border border-color rounded-lg p-2 flex flex-col h-full min-h-0 w-full">
            <div className="flex justify-between items-center mb-2 flex-shrink-0">
                <h2 className="text-xl font-bold text-center text-highlight">수련 과제</h2>
                {onClose && <button onClick={onClose} className="text-2xl font-bold text-tertiary hover:text-primary">&times;</button>}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 flex-grow overflow-y-auto pr-1">
                {SINGLE_PLAYER_MISSIONS.map(mission => {
                    const requiredProgress = getRequiredProgressForStageId(mission.unlockStageId);
                    const isUnlocked = userProgress >= requiredProgress;

                    const missionState = currentUserWithStatus.singlePlayerMissions?.[mission.id];
                    const isStarted = !!missionState?.isStarted;
                    
                    return (
                        <MissionCard 
                            key={mission.id}
                            mission={mission}
                            isUnlocked={isUnlocked}
                            isStarted={isStarted}
                            accumulatedAmount={missionState?.accumulatedAmount ?? 0}
                            lastCollectionTime={missionState?.lastCollectionTime ?? 0}
                            onStart={() => handlers.handleAction({ type: 'START_SINGLE_PLAYER_MISSION', payload: { missionId: mission.id } })}
                            onClaim={() => handlers.handleAction({ type: 'CLAIM_SINGLE_PLAYER_MISSION_REWARD', payload: { missionId: mission.id } })}
                        />
                    );
                })}
            </div>
        </div>
    );
};

const StageList: React.FC<{
    activeLevelData: typeof LEVEL_DATA[0];
    userProgress: number;
    currentUserWithStatus: UserWithStatus;
    handlers: any;
}> = ({ activeLevelData, userProgress, currentUserWithStatus, handlers }) => {
    
    const stagesForLevel = useMemo(() => {
        return SINGLE_PLAYER_STAGES.filter(stage => stage.level === activeLevelData.id);
    }, [activeLevelData.id]);

    const { clearedInLevel, stagesInLevel } = useMemo(() => {
        const currentLevelInfo = activeLevelData;
        const unlockRequirement = currentLevelInfo.unlockRequirement;
        const stagesInThisLevel = stagesForLevel.length;
        const cleared = Math.max(0, Math.min(stagesInThisLevel, userProgress - unlockRequirement));
        return { clearedInLevel: cleared, stagesInLevel: stagesInThisLevel };
    }, [activeLevelData, userProgress, stagesForLevel]);

    const getUnlockMessage = (requirement: number): string => {
        if (requirement <= 20) return "입문반 20 스테이지를 모두 클리어해야 열립니다.";
        if (requirement <= 40) return "초급반 20 스테이지를 모두 클리어해야 열립니다.";
        if (requirement <= 60) return "중급반 20 스테이지를 모두 클리어해야 열립니다.";
        if (requirement <= 80) return "고급반 20 스테이지를 모두 클리어해야 열립니다.";
        return "모든 이전 단계를 클리어해야 합니다.";
    };

    const isCurrentLevelLocked = userProgress < activeLevelData.unlockRequirement;

    return (
        <div key={activeLevelData.id} className="w-full bg-panel border border-color rounded-lg p-4 flex flex-col min-h-0 animate-fade-in h-full">
            <h2 className="text-[clamp(1rem,0.8rem+1vw,1.25rem)] font-bold mb-4 flex-shrink-0 flex flex-wrap items-baseline gap-x-2">
                <span>{activeLevelData.id} 스테이지 목록 ({clearedInLevel}/{stagesInLevel})</span>
                <span className="text-sm font-normal text-tertiary ml-2 whitespace-nowrap">(총 진행도: {userProgress}/{SINGLE_PLAYER_STAGES.length})</span>
            </h2>

            {isCurrentLevelLocked && (
                <div className="bg-tertiary/50 p-3 rounded-lg text-center text-sm text-yellow-300 mb-4">
                    {getUnlockMessage(activeLevelData.unlockRequirement)}
                </div>
            )}
            
            <div className="flex-grow overflow-y-auto space-y-2 pr-2">
                {stagesForLevel.map(stage => {
                    const stageIndex = SINGLE_PLAYER_STAGES.findIndex(s => s.id === stage.id);
                    const isLocked = userProgress < stageIndex;
                    const isCleared = userProgress > stageIndex;
                    const isCurrent = userProgress === stageIndex;
                    return (
                        <StageListItem 
                            key={stage.id}
                            stage={stage}
                            isLocked={isLocked || isCurrentLevelLocked}
                            isCleared={isCleared}
                            isCurrent={isCurrent}
                            onAction={handlers.handleAction}
                            currentUser={currentUserWithStatus}
                        />
                    );
                })}
            </div>
        </div>
    );
};

const LevelSelectionPanel: React.FC<{
    activeLevelData: typeof LEVEL_DATA[0];
    onPrev: () => void;
    onNext: () => void;
    className?: string;
}> = React.memo(({ activeLevelData, onPrev, onNext, className }) => (
    <div className={`bg-panel border border-color rounded-lg p-4 flex flex-col items-center w-full ${className}`}>
        <h2 className="text-[clamp(1.1rem,0.9rem+1vw,1.25rem)] font-bold mb-2">레벨 선택</h2>
        <div className="w-full flex items-center justify-center gap-2 relative group">
            <button onClick={onPrev} className="absolute left-0 -translate-x-full z-10 w-10 h-10 rounded-full bg-secondary/70 text-primary text-xl hover:bg-tertiary transition-all flex items-center justify-center flex-shrink-0" aria-label="Previous Level">&#x276E;</button>
            <div className="relative w-full rounded-lg overflow-hidden bg-black">
                <img key={activeLevelData.id} src={activeLevelData.image} alt={activeLevelData.name} className="w-full h-auto object-contain animate-fade-in" />
                <div className="absolute inset-0 bg-black/20"></div>
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent pointer-events-none">
                    <h3 key={`${activeLevelData.id}-title`} className="text-[clamp(1.5rem,1rem+2.5vw,1.875rem)] font-bold text-white text-center animate-fade-in drop-shadow-lg">{activeLevelData.name}</h3>
                </div>
            </div>
            <button onClick={onNext} className="absolute right-0 translate-x-full z-10 w-10 h-10 rounded-full bg-secondary/70 text-primary text-xl hover:bg-tertiary transition-all flex items-center justify-center flex-shrink-0" aria-label="Next Level">&#x276F;</button>
        </div>
    </div>
));


const SinglePlayerLobby: React.FC = () => {
    const { currentUserWithStatus, handlers } = useAppContext();
    const [activeLevelIndex, setActiveLevelIndex] = useState(0);
    const [isMissionsPanelOpen, setIsMissionsPanelOpen] = useState(false);

    const userProgress = useMemo(() => {
        return currentUserWithStatus?.singlePlayerProgress ?? 0;
    }, [currentUserWithStatus?.singlePlayerProgress]);

    useEffect(() => {
        if (currentUserWithStatus) {
            const progress = currentUserWithStatus.singlePlayerProgress ?? 0;
            let highestUnlockedIndex = 0;
            for (let i = LEVEL_DATA.length - 1; i >= 0; i--) {
                if (progress >= LEVEL_DATA[i].unlockRequirement) {
                    highestUnlockedIndex = i;
                    break;
                }
            }
            setActiveLevelIndex(highestUnlockedIndex);
        }
    }, [currentUserWithStatus]);

    if (!currentUserWithStatus) return null;

    const activeLevelData = LEVEL_DATA[activeLevelIndex];
    
    const handleNextLevel = useCallback(() => setActiveLevelIndex(prev => (prev + 1) % LEVEL_DATA.length), []);
    const handlePrevLevel = useCallback(() => setActiveLevelIndex(prev => (prev - 1 + LEVEL_DATA.length) % LEVEL_DATA.length), []);

    return (
        <div className="w-full h-full flex flex-col bg-tertiary text-primary p-4 gap-4">
            <header className="flex justify-between items-center flex-shrink-0">
                 <Button onClick={() => window.location.hash = '#/profile'} colorScheme="gray">&larr; 프로필로</Button>
                <h1 className="text-[clamp(1.75rem,1.25rem+2.5vw,2.25rem)] font-bold whitespace-nowrap">싱글플레이</h1>
                <div className="w-32"></div>
            </header>

            <main className="flex-1 min-h-0">
                {/* DESKTOP LAYOUT */}
                <div className="hidden lg:flex flex-row gap-4 h-full">
                    <div className="w-[350px] flex-shrink-0 flex flex-col gap-4">
                        {/* FIX: Removed invalid activeLevelIndex prop */}
                        <LevelSelectionPanel className="h-auto" activeLevelData={activeLevelData} onPrev={handlePrevLevel} onNext={handleNextLevel} />
                        <div className="flex-1 min-h-0 w-full">
                           <SinglePlayerMissions />
                        </div>
                    </div>
                    <div className="flex-1 min-h-0">
                        <StageList activeLevelData={activeLevelData} userProgress={userProgress} currentUserWithStatus={currentUserWithStatus} handlers={handlers} />
                    </div>
                </div>

                {/* MOBILE LAYOUT */}
                <div className="lg:hidden flex flex-col h-full gap-4 relative">
                    {/* FIX: Removed invalid activeLevelIndex prop */}
                    <LevelSelectionPanel className="flex-shrink-0 max-w-xl mx-auto" activeLevelData={activeLevelData} onPrev={handlePrevLevel} onNext={handleNextLevel} />
                    <div className="flex-1 min-h-0">
                        <StageList activeLevelData={activeLevelData} userProgress={userProgress} currentUserWithStatus={currentUserWithStatus} handlers={handlers} />
                    </div>
                    
                    <div className="absolute top-1/2 -translate-y-1/2 right-0 z-20">
                        <button onClick={() => setIsMissionsPanelOpen(true)} className="w-8 h-12 bg-secondary/80 backdrop-blur-sm rounded-l-lg flex items-center justify-center text-primary shadow-lg" aria-label="수련 과제 열기">
                            <span className="font-bold text-lg">{'<'}</span>
                        </button>
                    </div>
                    <div className={`fixed top-0 right-0 h-full w-[320px] bg-primary shadow-2xl z-50 transition-transform duration-300 ease-in-out ${isMissionsPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                        <div className="p-2 h-full">
                            <SinglePlayerMissions onClose={() => setIsMissionsPanelOpen(false)} />
                        </div>
                    </div>
                    {isMissionsPanelOpen && <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setIsMissionsPanelOpen(false)}></div>}
                </div>
            </main>
        </div>
    );
};

export default SinglePlayerLobby;