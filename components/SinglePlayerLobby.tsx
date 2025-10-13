
import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import { SINGLE_PLAYER_STAGES, SINGLE_PLAYER_MISSIONS } from '../constants/singlePlayerConstants.js';
import { SinglePlayerLevel, GameType } from '../types/enums.js';
import type { ServerAction, UserWithStatus, InventoryItem, SinglePlayerStageInfo } from '../types/index.js';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import { getMissionInfoWithLevel } from '../utils/questUtils.js';
// FIX: Add missing import for CONSUMABLE_ITEMS
import { CONSUMABLE_ITEMS } from '../constants/items.js';

interface UpgradeMissionModalProps {
    mission: SinglePlayerStageInfo;
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
}

const UpgradeMissionModal: React.FC<UpgradeMissionModalProps> = ({ mission, currentUser, onClose, onAction }) => {
    const missionState = currentUser.singlePlayerMissions?.[mission.id];
    const currentLevel = missionState?.level || 1;
    
    const currentInfo = getMissionInfoWithLevel(mission, currentLevel);
    const nextInfo = getMissionInfoWithLevel(mission, currentLevel + 1);

    const progressTowardNextLevel = missionState?.progressTowardNextLevel ?? 0;

    const goldCost = useMemo(() => {
        if (currentInfo.rewardType === 'gold') {
            return (currentInfo.maxCapacity ?? 0) * 5;
        } else { // diamonds
            return (currentInfo.maxCapacity ?? 0) * 1000;
        }
    }, [currentInfo]);

    const canAfford = currentUser.gold >= goldCost;
    const upgradeTarget = (currentInfo.maxCapacity ?? 1) * 10;
    const canUpgrade = progressTowardNextLevel >= upgradeTarget;

    const handleConfirm = () => {
        if (canAfford && canUpgrade) {
            onAction({ type: 'UPGRADE_SINGLE_PLAYER_MISSION', payload: { missionId: mission.id } });
            onClose();
        }
    };

    return (
        <DraggableWindow title={`${mission.name} 강화`} onClose={onClose} windowId={`upgrade-mission-${mission.id}`}>
            <div className="text-center">
                <h2 className="text-xl font-bold mb-4">수련 과제를 강화하시겠습니까?</h2>
                <div className="grid grid-cols-2 gap-4 my-4">
                    <div className="bg-secondary p-3 rounded-lg">
                        <h3 className="font-bold text-lg text-gray-400">현재 레벨 ({currentLevel})</h3>
                        <p>최대 저장량: {(currentInfo.maxCapacity ?? 0).toLocaleString()}</p>
                        <p>생산 속도: {currentInfo.productionRateMinutes}분 / {currentInfo.rewardAmount}개</p>
                    </div>
                     <div className="bg-secondary p-3 rounded-lg border-2 border-yellow-400">
                        <h3 className="font-bold text-lg text-yellow-300">다음 레벨 ({currentLevel + 1})</h3>
                        <p>최대 저장량: {(nextInfo.maxCapacity ?? 0).toLocaleString()}</p>
                        <p>생산 속도: {nextInfo.productionRateMinutes}분 / {nextInfo.rewardAmount}개</p>
                    </div>
                </div>
                <div className="bg-tertiary p-3 rounded-lg text-sm">
                    <p>강화 조건: 누적 수령량 {upgradeTarget.toLocaleString()} / {progressTowardNextLevel.toLocaleString()}</p>
                    <p>강화 비용:</p>
                    <div className="flex justify-center gap-4 mt-2">
                        <p className={`font-bold text-lg flex items-center gap-1 ${!canAfford ? 'text-red-400' : 'text-highlight'}`}>
                            <img src="/images/Gold.png" alt="Gold" className="w-5 h-5" /> {goldCost.toLocaleString()}
                        </p>
                    </div>
                </div>
                 <div className="flex justify-end gap-4 mt-6">
                    <Button onClick={onClose} colorScheme="gray">취소</Button>
                    <Button onClick={handleConfirm} colorScheme="green" disabled={!canAfford || !canUpgrade}>강화</Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

const gameTypeKorean: Record<GameType, string> = {
    'capture': '따내기',
    'survival': '살리기',
    'speed': '스피드',
    'missile': '미사일',
    'hidden': '히든'
};

const StageListItem: React.FC<{
    stage: SinglePlayerStageInfo;
    isLocked: boolean;
    isCleared: boolean;
    isCurrent: boolean;
    onAction: (action: ServerAction) => void;
    currentUser: UserWithStatus;
    refProp: React.Ref<HTMLLIElement>;
}> = ({ stage, isLocked, isCleared, isCurrent, onAction, currentUser, refProp }) => {
    
    const handleStageClick = (stageId: string) => {
        onAction({ type: 'START_SINGLE_PLAYER_GAME', payload: { stageId } });
    };

    const canAfford = currentUser.actionPoints.current >= stage.actionPointCost;

    const borderClass = isCurrent ? 'border-yellow-400 ring-2 ring-yellow-400' 
                      : isCleared ? 'border-green-600' 
                      : 'border-color';
                      
    const rewards = isCleared ? stage.rewards.repeatClear : stage.rewards.firstClear;
    const rewardTitle = isCleared ? "반복 클리어 보상" : "최초 클리어 보상";

    const getEndConditionText = (stage: SinglePlayerStageInfo): string => {
        if (stage.gameType === 'capture' && stage.targetScore) {
            return `따내기 목표: 흑 ${stage.targetScore.black}`;
        }
        if (stage.gameType === 'survival' && stage.whiteStoneLimit) {
            return `생존 조건: 백돌 ${stage.whiteStoneLimit}수`;
        }
        if (stage.autoEndTurnCount) {
            return `종료 조건: ${stage.autoEndTurnCount}수 후 계가`;
        }
        return '';
    };
    
    const renderRewardItem = (reward: InventoryItem | { itemId: string; quantity: number }, index: number) => {
        const itemName = 'itemId' in reward ? reward.itemId : reward.name;
        const quantity = 'quantity' in reward ? reward.quantity : 1;
        const itemTemplate = CONSUMABLE_ITEMS.find(ci => ci.name === itemName);
        if (!itemTemplate?.image) return null;
        const title = `${itemName} x${quantity}`;
        return (
            <div key={index} className="flex items-center" title={title}>
                <img src={itemTemplate.image} alt={itemName} className="w-5 h-5 object-contain" />
            </div>
        );
    };

    const RewardDisplay: React.FC<{ reward: typeof rewards; title: string }> = ({ reward, title }) => (
        <div className="flex flex-col items-center" title={title}>
            <h4 className="text-[10px] text-yellow-400 font-semibold">{title}</h4>
            <div className="flex items-center flex-wrap justify-center gap-x-1.5 mt-0.5">
                {(reward.gold ?? 0) > 0 &&
                    <span className="flex items-center gap-0.5 text-xs" title={`골드 ${reward.gold}`}>
                        <img src="/images/Gold.png" alt="골드" className="w-3 h-3" />
                        {reward.gold}
                    </span>
                }
                {(reward.exp?.amount ?? 0) > 0 &&
                     <span className="flex items-center gap-0.5 text-xs" title={`경험치 ${reward.exp!.amount}`}>
                        <span className="text-sm">⭐</span> {reward.exp!.amount}
                    </span>
                }
                {reward.items?.map(renderRewardItem)}
                {reward.bonus && 
                    <span className="flex items-center gap-0.5" title={`보너스 스탯 ${reward.bonus.replace('스탯', '')}`}>
                        <img src="/images/icons/stat_point.png" alt="Stat Point" className="w-4 h-4" />
                        {reward.bonus.replace('스탯', '')}
                    </span>
                }
            </div>
        </div>
    );

    return (
        <li ref={refProp} className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all duration-200 ${
            isLocked ? 'bg-secondary/30 opacity-60' : `bg-secondary/60 ${borderClass} hover:bg-tertiary/60`
        }`}>
            <div className="flex-shrink-0 w-12 h-12 flex flex-col items-center justify-center bg-tertiary rounded-lg border-2 border-color shadow-inner">
                {isCleared ? (
                    <span className="text-2xl" title="클리어">✅</span>
                ) : (
                    <>
                        <span className="text-[10px] text-tertiary">스테이지</span>
                        <span className="font-bold text-lg text-primary -my-1">{stage.name.replace('스테이지 ', '')}</span>
                    </>
                )}
            </div>

            <div className="flex-1 flex flex-col justify-center text-xs text-secondary min-w-0 px-2">
                <h4 className="font-bold text-sm text-primary truncate">{getEndConditionText(stage)}</h4>
                <p className="text-xs text-tertiary">종료: {stage.autoEndTurnCount || '없음'}수</p>
            </div>
            
            <div className="flex items-center gap-2">
                <div className="flex-1 h-full flex items-center justify-center min-w-[100px]">
                    <RewardDisplay reward={rewards} title={rewardTitle} />
                </div>
                <Button 
                    onClick={() => handleStageClick(stage.id)} 
                    disabled={isLocked || !canAfford}
                    className="!py-1.5 !px-2 !text-xs w-24"
                    title={!canAfford ? '행동력이 부족합니다.' : `행동력 ${stage.actionPointCost} 소모`}
                >
                    {isLocked ? '🔒 잠김' : `입장 (⚡${stage.actionPointCost})`}
                </Button>
            </div>
        </li>
    );
};


const MissionCard: React.FC<{
    mission: SinglePlayerStageInfo;
    isUnlocked: boolean;
    onStart: () => void;
    onClaim: () => void;
    onUpgrade: (mission: SinglePlayerStageInfo) => void;
}> = ({ mission, isUnlocked, onStart, onClaim, onUpgrade }) => {
    const { currentUserWithStatus } = useAppContext();
    const missionState = currentUserWithStatus?.singlePlayerMissions?.[mission.id];
    const isStarted = !!missionState?.isStarted;
    const currentLevel = missionState?.level || 1;
    const claimableAmount = missionState?.claimableAmount ?? 0;
    const progressTowardNextLevel = missionState?.progressTowardNextLevel ?? 0;
    const lastCollectionTime = missionState?.lastCollectionTime ?? 0;
    
    const leveledMissionInfo = useMemo(() => getMissionInfoWithLevel(mission, currentLevel), [mission, currentLevel]);
    const upgradeTarget = (leveledMissionInfo.maxCapacity ?? 1) * 10;
    const upgradeProgress = Math.min(100, (progressTowardNextLevel / (upgradeTarget || 1)) * 100);
    const canUpgrade = upgradeProgress >= 100 && currentLevel < 10;
    
    const rewardIcon = mission.rewardType === 'gold' ? '/images/Gold.png' : '/images/Zem.png';
    const [tick, setTick] = useState(0);

    useEffect(() => {
        if (!isStarted || claimableAmount >= (leveledMissionInfo.maxCapacity ?? Infinity)) return;
        const timerId = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(timerId);
    }, [isStarted, claimableAmount, leveledMissionInfo.maxCapacity]);

    const { displayAmount, timeToNextReward } = useMemo(() => {
        if (!isStarted) return { displayAmount: 0, timeToNextReward: 0 };
        const productionIntervalMs = (leveledMissionInfo.productionRateMinutes ?? 0) * 60 * 1000;
        if (productionIntervalMs <= 0) return { displayAmount: claimableAmount, timeToNextReward: 0 };

        const elapsedMs = Date.now() - lastCollectionTime;
        const rewardsGenerated = Math.floor(elapsedMs / productionIntervalMs);
        const amountGenerated = rewardsGenerated * (leveledMissionInfo.rewardAmount ?? 0);
        const newAccumulated = claimableAmount + amountGenerated;
        
        const currentDisplayAmount = Math.min(newAccumulated, leveledMissionInfo.maxCapacity ?? 0);

        let nextRewardTime = 0;
        if (currentDisplayAmount < (leveledMissionInfo.maxCapacity ?? 0)) {
            const effectiveLastCollection = lastCollectionTime + (rewardsGenerated * productionIntervalMs);
            const elapsedSinceLastTick = Date.now() - effectiveLastCollection;
            nextRewardTime = productionIntervalMs - elapsedSinceLastTick;
        }
        return { displayAmount: currentDisplayAmount, timeToNextReward: nextRewardTime };
    }, [isStarted, lastCollectionTime, claimableAmount, leveledMissionInfo, tick]);

    if (!isUnlocked) {
        const unlockText = mission.unlockStageId ? `${mission.unlockStageId} 클리어 필요` : '이전 단계 클리어 필요';
        return (
            <div className="bg-secondary/30 p-2 rounded-lg flex flex-col items-center text-center opacity-60 h-full">
                 <div className="relative w-[50px] h-[50px] flex-shrink-0 mb-1">
                    <img src={mission.image} alt={mission.name} className="w-full h-full object-cover p-1 rounded-md grayscale" />
                    <div className="absolute inset-0 bg-black/60 rounded-md flex items-center justify-center">
                        <span className="text-4xl" role="img" aria-label="Locked">🔒</span>
                    </div>
                </div>
                <h4 className="font-bold text-sm text-tertiary flex-grow truncate">{mission.name}</h4>
                <p className="text-xs text-red-400 mt-1 font-semibold">{unlockText}</p>
            </div>
        );
    }
    
    const progressPercent = (displayAmount / (leveledMissionInfo.maxCapacity || 1)) * 100;

    const formatTime = (ms: number): string => {
        if (ms <= 0) return "00:00";
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="bg-secondary/60 p-2 rounded-lg flex flex-col h-full border-2 border-color text-on-panel">
            <div className="flex-grow flex flex-col items-center gap-2 text-center">
                <img src={mission.image} alt={mission.name} className="w-16 h-16 object-cover p-1 rounded-md bg-tertiary" />
                <h4 className="font-bold text-sm text-highlight truncate" title={mission.name}>{mission.name}</h4>
                <p className="text-[10px] text-tertiary flex-grow min-h-[2rem]">{mission.description}</p>
            </div>
            
            {isStarted ? (
                <div className="flex-shrink-0 space-y-1 mt-1">
                    <div className="w-full bg-tertiary rounded-full h-3 relative overflow-hidden border border-black/20" title="수령 가능 보상">
                        <div className="bg-green-500 h-full rounded-full" style={{ width: `${progressPercent}%` }}></div>
                        <span className="absolute inset-0 text-[10px] font-bold text-white flex items-center justify-center" style={{ textShadow: '1px 1px 1px black' }}>
                            {Math.floor(displayAmount).toLocaleString()}/{(leveledMissionInfo.maxCapacity ?? 0).toLocaleString()}
                             ({displayAmount < (leveledMissionInfo.maxCapacity ?? 0) ? formatTime(timeToNextReward) : 'MAX'})
                        </span>
                    </div>
                    <div className="w-full bg-tertiary rounded-full h-2.5 relative overflow-hidden border border-black/20" title="강화 진행도">
                        <div className="bg-yellow-500 h-full rounded-full" style={{ width: `${upgradeProgress}%` }}></div>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                        <Button onClick={() => onUpgrade(mission)} disabled={!canUpgrade} colorScheme="blue" className="flex-1 !py-1 !text-[10px] lg:!text-xs">
                            강화
                        </Button>
                        <Button onClick={onClaim} disabled={Math.floor(displayAmount) < 1} colorScheme="green" className="flex-1 !py-1 !text-[10px] lg:!text-xs">
                            수령
                        </Button>
                    </div>
                </div>
            ) : (
                 <div className="flex-shrink-0 mt-auto">
                    <div className="text-[10px] text-tertiary text-center mb-1">
                        <img src={rewardIcon} alt={mission.rewardType} className="w-4 h-4 inline-block mr-1" />
                        <span>{(mission.rewardAmount ?? 0).toLocaleString()}/{(mission.productionRateMinutes ?? 0)}분 (최대: {(mission.maxCapacity ?? 0).toLocaleString()})</span>
                    </div>
                    <Button onClick={onStart} colorScheme="blue" className="w-full mt-auto !py-1 !text-[10px] lg:!text-xs">
                        시작하기
                    </Button>
                </div>
            )}
        </div>
    );
};


const LEVEL_DATA: { id: SinglePlayerLevel; name: string; unlockRequirement: number; image: string; }[] = [
    { id: SinglePlayerLevel.입문, name: '입문반', unlockRequirement: 0, image: '/images/single/Academy.png' },
    { id: SinglePlayerLevel.초급, name: '초급반', unlockRequirement: 20, image: '/images/single/Academy1.png' },
    { id: SinglePlayerLevel.중급, name: '중급반', unlockRequirement: 40, image: '/images/single/Academy2.png' },
    { id: SinglePlayerLevel.고급, name: '고급반', unlockRequirement: 60, image: '/images/single/Academy3.png' },
    { id: SinglePlayerLevel.유단자, name: '유단자', unlockRequirement: 80, image: '/images/single/Academy4.png' },
];

const getRequiredProgressForStageId = (stageId: string): number => {
    const index = SINGLE_PLAYER_STAGES.findIndex(s => s.id === stageId);
    if (index !== -1) return index + 1;
    const parts = stageId.split('-');
    if (parts.length !== 2) return Infinity; 
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

const SinglePlayerLobby: React.FC = () => {
    const { currentUserWithStatus, handlers } = useAppContext();
    const [activeLevelIndex, setActiveLevelIndex] = useState(0);
    const [upgradingMission, setUpgradingMission] = useState<SinglePlayerStageInfo | null>(null);
    const scrollContainerRef = useRef<HTMLUListElement>(null);
    const stageRefs = useRef<Map<string, HTMLLIElement | null>>(new Map());

    const userProgress = useMemo(() => currentUserWithStatus?.singlePlayerProgress ?? 0, [currentUserWithStatus?.singlePlayerProgress]);

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
    
    const activeLevelData = LEVEL_DATA[activeLevelIndex];
    const stagesForLevel = useMemo((): SinglePlayerStageInfo[] => {
        return SINGLE_PLAYER_STAGES.filter(stage => stage.level === activeLevelData.id)
            .sort((a, b) => {
                const numA = parseInt(a.id.split('-')[1]);
                const numB = parseInt(b.id.split('-')[1]);
                return numA - numB;
            });
    }, [activeLevelData.id]);
    
     useEffect(() => {
        const currentStage = SINGLE_PLAYER_STAGES[userProgress];
        if (currentStage && currentStage.level === activeLevelData.id) {
            const targetElement = stageRefs.current.get(currentStage.id);
            if (targetElement && scrollContainerRef.current) {
                setTimeout(() => {
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            }
        }
    }, [userProgress, activeLevelData.id]);

    const handleNextLevel = useCallback(() => setActiveLevelIndex(prev => (prev + 1) % LEVEL_DATA.length), []);
    const handlePrevLevel = useCallback(() => setActiveLevelIndex(prev => (prev - 1 + LEVEL_DATA.length) % LEVEL_DATA.length), []);

    const handleStart = (stageId: string | undefined) => {
        if (!stageId) {
            return;
        }
        if (!currentUserWithStatus) return;

        const stage = SINGLE_PLAYER_STAGES.find(s => s.id === stageId);
        if (!stage) return;
        if (currentUserWithStatus.actionPoints.current < stage.actionPointCost) {
            alert('행동력이 부족합니다.');
            return;
        }
        
        handlers.handleAction({ type: 'START_SINGLE_PLAYER_GAME', payload: { stageId } });
    };

    if (!currentUserWithStatus) return null;

    return (
        <div className="w-full h-full flex flex-col bg-academy-bg text-primary overflow-hidden">
            {upgradingMission && (
                <UpgradeMissionModal
                    mission={upgradingMission}
                    currentUser={currentUserWithStatus}
                    onClose={() => setUpgradingMission(null)}
                    onAction={handlers.handleAction}
                />
            )}
            <header className="flex justify-between items-center flex-shrink-0 px-4 pt-4">
                 <Button onClick={() => window.location.hash = '#/profile'} colorScheme="gray">&larr; 프로필로</Button>
                <h1 className="text-[clamp(1.75rem,1.25rem+2.5vw,2.25rem)] font-bold whitespace-nowrap">싱글플레이</h1>
                <div className="w-32 text-right">
                    <Button
                        onClick={() => handleStart(currentUserWithStatus?.lastSinglePlayerStageId)}
                        colorScheme="yellow"
                        className="!text-sm"
                        disabled={!currentUserWithStatus?.lastSinglePlayerStageId}
                    >
                        이어하기
                    </Button>
                </div>
            </header>

            <main className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 p-4">
                {/* Panel 1: Level Selection */}
                <div className="w-full lg:w-1/4 flex items-center">
                    <div className="bg-panel border border-color rounded-lg p-4 flex flex-col w-full h-full">
                        <div className="w-full relative flex-1 min-h-0">
                            <div className="relative w-full h-full rounded-lg overflow-hidden bg-black">
                                <img key={activeLevelData.id} src={activeLevelData.image} alt={activeLevelData.name} className="w-full h-full object-cover animate-fade-in" />
                            </div>
                        </div>
                        <div className="flex items-center justify-center gap-4 mt-2 flex-shrink-0">
                            <Button onClick={handlePrevLevel} className="!px-3 !py-1 text-xl font-bold">&lt;</Button>
                            <h3 className="text-[clamp(1.2rem,1rem+2.5vw,1.5rem)] font-bold text-white text-center drop-shadow-lg">{activeLevelData.name}</h3>
                            <Button onClick={handleNextLevel} className="!px-3 !py-1 text-xl font-bold">&gt;</Button>
                        </div>
                    </div>
                </div>

                {/* Panel 2: Stage List */}
                <div className="w-full lg:w-1/2 min-w-0 flex flex-col bg-panel border border-color rounded-lg p-4">
                    <h3 className="text-xl font-bold text-center mb-2 text-primary flex-shrink-0">{activeLevelData.name} 스테이지</h3>
                    <ul ref={scrollContainerRef} className="space-y-2 flex flex-col overflow-y-auto pr-2">
                        {stagesForLevel.map((stage) => {
                            const stageIndex = (SINGLE_PLAYER_STAGES.findIndex(s => s.id === stage.id));
                            const isLocked = !currentUserWithStatus.isAdmin && userProgress < stageIndex;
                            const isCleared = userProgress > stageIndex;
                            const isCurrent = userProgress === stageIndex;
                            return (
                                <StageListItem
                                    key={stage.id} stage={stage} isLocked={isLocked} isCleared={isCleared} isCurrent={isCurrent}
                                    onAction={handlers.handleAction} currentUser={currentUserWithStatus}
                                    refProp={(el) => { stageRefs.current.set(stage.id, el); }}
                                />
                            );
                        })}
                    </ul>
                </div>

                {/* Panel 3: Training Tasks */}
                <div className="w-full lg:w-1/4 flex flex-col">
                    <div className="bg-panel border border-color rounded-lg p-2 lg:p-4 flex flex-col min-h-0 w-full h-full">
                        <h2 className="text-xl font-bold text-highlight text-center mb-2 lg:mb-4 flex-shrink-0">수련 과제</h2>
                        <div className="grid grid-cols-2 grid-rows-3 gap-2 lg:gap-3 flex-grow lg:flex-grow-0 overflow-y-auto lg:overflow-visible pr-1 lg:pr-0">
                            {SINGLE_PLAYER_MISSIONS.map(mission => {
                                const requiredProgress = mission.unlockStageId ? getRequiredProgressForStageId(mission.unlockStageId) : 0;
                                const isUnlocked = userProgress >= requiredProgress;
                                
                                return (
                                    <MissionCard 
                                        key={mission.id}
                                        mission={mission}
                                        isUnlocked={isUnlocked}
                                        onStart={() => handlers.handleAction({ type: 'START_SINGLE_PLAYER_MISSION', payload: { missionId: mission.id } })}
                                        onClaim={() => handlers.handleAction({ type: 'CLAIM_SINGLE_PLAYER_MISSION_REWARD', payload: { missionId: mission.id } })}
                                        onUpgrade={(m) => setUpgradingMission(m)}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
export default SinglePlayerLobby;
