import React, { useEffect, useMemo, useState, useRef } from 'react';
import { LiveGameSession, User, Player, ServerAction, UserWithStatus } from '../types.js';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import { TOWER_STAGES } from '../constants.js';
import { audioService } from '../services/audioService.js';
import { CONSUMABLE_ITEMS } from '../constants.js';

interface TowerChallengeSummaryModalProps {
    session: LiveGameSession;
    currentUser: UserWithStatus;
    onAction: (action: ServerAction) => void;
    onClose: () => void;
    isTopmost?: boolean;
}

const useAnimationKey = (summary: LiveGameSession['summary'], currentUser: User) => {
    const mySummary = summary?.[currentUser.id];
    if (!mySummary) {
        return `${currentUser.strategyLevel}-${currentUser.strategyXp}`;
    }
    const { xp, level } = mySummary;
    return `${level?.initial}-${level?.final}-${xp?.initial}-${xp?.change}`;
};

const XpBar: React.FC<{
    summary: LiveGameSession['summary'];
    currentUser: User;
}> = React.memo(({ summary, currentUser }) => {
    const mySummary = summary?.[currentUser.id];
    const levelSummary = mySummary?.level;
    const getXpForLevel = (level: number): number => 1000 + (level - 1) * 200;

    if (!levelSummary) {
        const level = currentUser.strategyLevel;
        const xp = currentUser.strategyXp;
        const maxXp = getXpForLevel(level);
        const percentage = (xp / maxXp) * 100;
        return (
             <div className="flex items-center gap-3">
                 <span className="text-sm font-bold w-16 text-right">Lv.{level}</span>
                <div className="w-full bg-gray-700/50 rounded-full h-4 relative border border-gray-900/50 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full" style={{ width: `${percentage}%` }}></div>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-black/80 drop-shadow-sm">
                       {xp} / {maxXp}
                    </span>
                </div>
                 <div className="w-20"></div>
            </div>
        );
    }

    const { initial, final, progress } = levelSummary;
    const xpGain = mySummary?.xp?.change ?? 0;
    const isLevelUp = initial < final;
    
    const [barWidth, setBarWidth] = useState(0); 
    const [gainFlashOpacity, setGainFlashOpacity] = useState(0); 
    const [showGainText, setShowGainText] = useState(false);
    const [levelUpTextVisible, setLevelUpTextVisible] = useState(false);

    const initialPercent = progress.max > 0 ? (progress.initial / progress.max) * 100 : 0;
    const finalPercent = progress.max > 0 ? (isLevelUp ? 100 : (progress.final / progress.max) * 100) : 0;
    const gainPercent = finalPercent - initialPercent;

    const animationKey = useAnimationKey(summary, currentUser);

    useEffect(() => {
        setBarWidth(initialPercent);
        setShowGainText(false);
        setGainFlashOpacity(0);
        setLevelUpTextVisible(false);

        const startTimer = setTimeout(() => {
            if(xpGain > 0) {
                setShowGainText(true);
                setGainFlashOpacity(1);
            }
            setBarWidth(finalPercent);

            if (isLevelUp) {
                setTimeout(() => setLevelUpTextVisible(true), 800);
            }
            
            const fadeTimer = setTimeout(() => {
                setGainFlashOpacity(0);
            }, 500);

            return () => clearTimeout(fadeTimer);
        }, 500);

        return () => clearTimeout(startTimer);
    }, [animationKey, initialPercent, finalPercent, xpGain, isLevelUp]);
    
    const gainTextKey = `${xpGain}-${progress.initial}`;
    
    return (
        <div className="flex items-center gap-3 relative">
             <span className="text-sm font-bold w-16 text-right">Lv.{final}</span>
            <div className="w-full bg-gray-700/50 rounded-full h-4 relative border border-gray-900/50 overflow-hidden">
                <div 
                    className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${barWidth}%` }}
                ></div>
                <div 
                    className="absolute top-0 h-full bg-gradient-to-r from-green-400 to-green-500 rounded-r-full transition-opacity duration-500 ease-out pointer-events-none"
                    style={{ left: `${initialPercent}%`, width: `${gainPercent}%`, opacity: gainFlashOpacity }}
                ></div>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-black/80 drop-shadow-sm">
                   {isLevelUp ? `${progress.max} / ${progress.max}` : `${progress.final} / ${progress.max}`}
                </span>
                 {levelUpTextVisible && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-2xl font-black text-yellow-300 animate-bounce" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.7)'}}>
                        LEVEL UP!
                    </div>
                )}
            </div>
             {showGainText && xpGain > 0 && (
                <span key={gainTextKey} className="text-sm font-bold text-green-400 whitespace-nowrap animate-fade-in-xp w-20">
                    +{xpGain} XP
                </span>
             )}
        </div>
    );
});


const TowerChallengeSummaryModal: React.FC<TowerChallengeSummaryModalProps> = ({ session, currentUser, onAction, onClose, isTopmost }) => {
    const isWinner = session.winner === Player.Black;
    const soundPlayed = useRef(false);

    const mySummary = session.summary?.[currentUser.id];
    const stage = TOWER_STAGES.find(s => s.id === session.stageId);
    const hasLeveledUp = useMemo(() => mySummary?.level?.initial !== mySummary?.level?.final, [mySummary]);

    useEffect(() => {
        if (soundPlayed.current) return;
        let soundTimer: number | undefined;

        if (hasLeveledUp) {
            soundTimer = window.setTimeout(() => audioService.levelUp(), 800);
        } else if (isWinner) {
            audioService.gameWin();
        } else {
            audioService.gameLose();
        }
        soundPlayed.current = true;
        return () => clearTimeout(soundTimer);
    }, [isWinner, hasLeveledUp]);

    const title = isWinner ? '도전 성공!' : '도전 실패!';
    const color = isWinner ? 'text-green-400' : 'text-red-400';

    const currentStageIndex = TOWER_STAGES.findIndex(s => s.id === session.stageId);
    const nextStage = TOWER_STAGES[currentStageIndex + 1];
    const canTryNext = isWinner && nextStage && (currentUser.towerProgress?.highestFloor ?? 0) >= stage!.floor!;
    
    const currentStageCost = stage?.actionPointCost;
    const nextStageCost = nextStage?.actionPointCost;

    const handleRetry = () => {
        if (stage && currentUser.actionPoints.current >= stage.actionPointCost) {
            onAction({ type: 'START_TOWER_CHALLENGE_GAME', payload: { floor: stage.floor! } });
            onClose();
        }
    };

    const handleNextStage = () => {
        if (canTryNext && currentUser.actionPoints.current >= nextStage.actionPointCost) {
            onAction({ type: 'START_TOWER_CHALLENGE_GAME', payload: { floor: nextStage.floor! } });
            onClose();
        }
    };

    const handleExitToLobby = () => {
        sessionStorage.setItem('postGameRedirect', '#/towerchallenge');
        onAction({ type: 'LEAVE_AI_GAME', payload: { gameId: session.id } });
        onClose();
    };

    const rewardItem = mySummary?.items?.[0];
    const rewardItemTemplate = rewardItem ? CONSUMABLE_ITEMS.find(item => item.name === rewardItem.name) : null;

    return (
        <DraggableWindow title={`${stage?.floor}층 결과`} onClose={onClose} windowId="tower-summary" initialWidth={500} isTopmost={isTopmost}>
            <div className="text-white text-center">
                <h1 className={`text-5xl font-black mb-4 ${color}`}>{title}</h1>
                <p className="text-gray-300 mb-6">{isWinner ? `축하합니다! ${stage?.name}을(를) 클리어했습니다.` : `아쉽지만 다음 기회에 다시 도전해보세요.`}</p>

                {mySummary && (
                    <div className="bg-gray-900/50 p-4 rounded-lg space-y-4">
                        <XpBar summary={session.summary} currentUser={currentUser} />
                        
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="bg-gray-800 p-2 rounded-md">
                                <p className="text-gray-400">획득 골드</p>
                                <p className="font-semibold text-yellow-300 flex items-center justify-center gap-1">
                                    <img src="/images/Gold.png" alt="골드" className="w-4 h-4" /> {(mySummary.gold ?? 0).toLocaleString()}
                                </p>
                            </div>
                            <div className="bg-gray-800 p-2 rounded-md">
                                <p className="text-gray-400">획득 아이템</p>
                                 <div className="font-semibold h-6 flex items-center justify-center">
                                    {rewardItem && rewardItemTemplate ? (
                                        <div className="flex items-center gap-2">
                                            <img src={rewardItemTemplate.image!} alt={rewardItem.name} className="w-6 h-6 object-contain" />
                                            <p className="text-xs">{rewardItem.name}</p>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-500">없음</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="text-sm text-gray-300 mt-4">
                    현재 행동력: ⚡ {currentUser.actionPoints.current}
                </div>

                <div className="grid grid-cols-3 gap-3 mt-2">
                    <Button onClick={handleExitToLobby} colorScheme="gray">로비로</Button>
                    <Button 
                        onClick={handleRetry} 
                        colorScheme="yellow"
                        disabled={currentUser.actionPoints.current < (currentStageCost || 0)}
                    >
                        재도전 (⚡{currentStageCost})
                    </Button>
                    <Button 
                        onClick={handleNextStage} 
                        colorScheme="accent" 
                        disabled={!canTryNext || currentUser.actionPoints.current < (nextStageCost || 0)}
                    >
                        {nextStage ? `다음 (⚡${nextStageCost})` : '다음 단계'}
                    </Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default TowerChallengeSummaryModal;