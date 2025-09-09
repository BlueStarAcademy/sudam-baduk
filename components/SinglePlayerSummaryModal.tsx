
import React, { useEffect, useMemo, useState } from 'react';
import { LiveGameSession, User, Player, ServerAction } from '../types/index.js';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import { SINGLE_PLAYER_STAGES } from '../constants.js';
import { audioService } from '../services/audioService.js';
import { CONSUMABLE_ITEMS } from '../constants.js';

interface SinglePlayerSummaryModalProps {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
    onClose: () => void;
    isTopmost?: boolean;
}

const XpBar: React.FC<{
    summary: LiveGameSession['summary'];
    currentUser: User;
}> = ({ summary, currentUser }) => {
    const mySummary = summary?.[currentUser.id];
    const levelSummary = mySummary?.level;

    if (!levelSummary) {
        // Fallback display if summary is missing
        const level = currentUser.strategyLevel;
        const xp = currentUser.strategyXp;
        const maxXp = 1000 + (level - 1) * 200;
        const percentage = (xp / maxXp) * 100;
        return (
             <div className="flex items-center gap-3">
                 <span className="text-sm font-bold w-16 text-right">Lv.{level}</span>
                <div className="w-full bg-gray-700/50 rounded-full h-4 relative border border-gray-900/50 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" style={{ width: `${percentage}%` }}></div>
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
    
    const initialPercent = progress.max > 0 ? (progress.initial / progress.max) * 100 : 0;
    const finalPercent = progress.max > 0 ? (isLevelUp ? 100 : (progress.final / progress.max) * 100) : 0;
    const gainPercent = finalPercent - initialPercent;

    useEffect(() => {
        setBarWidth(initialPercent);
        setShowGainText(false);
        setGainFlashOpacity(0);

        const startTimer = setTimeout(() => {
            if(xpGain > 0) {
                setShowGainText(true);
                setGainFlashOpacity(1);
            }
            setBarWidth(finalPercent);
            
            const fadeTimer = setTimeout(() => {
                setGainFlashOpacity(0);
            }, 500);

            return () => clearTimeout(fadeTimer);
        }, 500);

        return () => clearTimeout(startTimer);
    }, [initial, final, progress, isLevelUp, initialPercent, finalPercent, xpGain]);
    
    const gainTextKey = `${xpGain}-${progress.initial}`;
    
    return (
        <div className="flex items-center gap-3">
             <span className="text-sm font-bold w-16 text-right">Lv.{final}</span>
            <div className="w-full bg-gray-700/50 rounded-full h-4 relative border border-gray-900/50 overflow-hidden">
                <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${barWidth}%` }}
                ></div>
                <div 
                    className="absolute top-0 h-full bg-gradient-to-r from-green-400 to-green-500 rounded-r-full transition-opacity duration-500 ease-out pointer-events-none"
                    style={{ 
                        left: `${initialPercent}%`, 
                        width: `${gainPercent}%`,
                        opacity: gainFlashOpacity
                    }}
                ></div>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-black/80 drop-shadow-sm">
                   {isLevelUp ? `${progress.max} / ${progress.max}` : `${progress.final} / ${progress.max}`}
                </span>
            </div>
             {showGainText && xpGain > 0 && (
                <span key={gainTextKey} className="text-sm font-bold text-green-400 whitespace-nowrap animate-fade-in-xp w-20">
                    +{xpGain} XP
                </span>
             )}
             <style>{`
                @keyframes fadeInXp {
                    from { opacity: 0; transform: scale(0.8); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in-xp {
                    animation: fadeInXp 0.5s ease-out forwards;
                }
            `}</style>
        </div>
    );
};


const SinglePlayerSummaryModal: React.FC<SinglePlayerSummaryModalProps> = ({ session, currentUser, onAction, onClose, isTopmost }) => {
    const isWinner = session.winner === Player.Black; // Human is always Black
    const currentStage = useMemo(() => SINGLE_PLAYER_STAGES.find(s => s.id === session.stageId), [session.stageId]);
    const summary = useMemo(() => session.summary?.[currentUser.id], [session.summary, currentUser.id]);
    
    const hasLeveledUp = useMemo(() => summary?.level?.initial !== summary?.level?.final, [summary]);

    useEffect(() => {
        let soundTimer: number | undefined;
        if (hasLeveledUp) {
            soundTimer = window.setTimeout(() => audioService.levelUp(), 800);
        } else if (isWinner) {
            audioService.gameWin();
        } else {
            audioService.gameLose();
        }
        return () => clearTimeout(soundTimer);
    }, [isWinner, hasLeveledUp]);

    if (!currentStage) {
        return (
            <DraggableWindow title="결과" onClose={onClose} windowId="sp-summary" isTopmost={isTopmost}>
                <p>스테이지 정보를 불러올 수 없습니다.</p>
                <Button onClick={onClose}>확인</Button>
            </DraggableWindow>
        );
    }
    
    const isFirstClear = (currentUser.singlePlayerProgress ?? 0) === SINGLE_PLAYER_STAGES.findIndex(s => s.id === currentStage.id);
    const rewards = isWinner ? (isFirstClear ? currentStage.rewards.firstClear : currentStage.rewards.repeatClear) : null;
    
    const handleRetry = () => {
        onClose();
        onAction({ type: 'START_SINGLE_PLAYER_GAME', payload: { stageId: session.stageId! } });
    };

    const handleNextStage = () => {
        const currentStageIndex = SINGLE_PLAYER_STAGES.findIndex(s => s.id === session.stageId);
        const nextStage = SINGLE_PLAYER_STAGES[currentStageIndex + 1];
        if (nextStage) {
            onClose();
            onAction({ type: 'START_SINGLE_PLAYER_GAME', payload: { stageId: nextStage.id } });
        }
    };
    
    const handleExitToLobby = () => {
        onClose();
        sessionStorage.setItem('postGameRedirect', '#/singleplayer');
        onAction({ type: 'LEAVE_AI_GAME', payload: { gameId: session.id } });
    };

    const canTryNext = useMemo(() => {
        if (!isWinner) return false;
        const currentStageIndex = SINGLE_PLAYER_STAGES.findIndex(s => s.id === session.stageId);
        const nextStage = SINGLE_PLAYER_STAGES[currentStageIndex + 1];
        return !!nextStage;
    }, [isWinner, session.stageId]);

    return (
        <DraggableWindow title="스테이지 결과" onClose={onClose} windowId="sp-summary" initialWidth={500} isTopmost={isTopmost}>
            <div className="text-center relative">
                <h2 className={`text-4xl font-black mb-2 ${isWinner ? 'text-amber-400' : 'text-stone-500'}`}>
                    {isWinner ? '승리' : '패배'}
                </h2>
                <p className="text-stone-300 mb-6">{isWinner ? "스테이지를 클리어했습니다!" : "아쉽지만 다음 기회에!"}</p>
                
                <div className="bg-stone-800/50 p-4 rounded-lg space-y-3 relative">
                    <h3 className="font-bold text-lg text-amber-300">획득 보상</h3>
                    <XpBar summary={session.summary} currentUser={currentUser} />
                    {hasLeveledUp && (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-5xl font-black text-yellow-300 animate-bounce" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.7)' }}>
                            LEVEL UP!
                        </div>
                    )}
                    {rewards && (
                        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-2 border-t border-stone-700">
                            {rewards.gold > 0 && 
                                <span className="flex items-center gap-1 text-yellow-300"><img src="/images/Gold.png" alt="골드" className="w-5 h-5"/> +{rewards.gold.toLocaleString()}</span>
                            }
                            {rewards.items?.map((itemRef, idx) => {
                                const itemTemplate = CONSUMABLE_ITEMS.find(ci => ci.name === itemRef.itemId);
                                if (!itemTemplate) return null;
                                return (
                                    <div key={idx} className="flex items-center gap-1" title={`${itemRef.itemId} x${itemRef.quantity}`}>
                                        <img src={itemTemplate.image!} alt={itemRef.itemId} className="w-6 h-6 object-contain" />
                                        <span>x{itemRef.quantity}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                
                <div className="flex justify-center gap-4 mt-8">
                    <Button onClick={handleExitToLobby} colorScheme="gray" className="flex-1">로비로</Button>
                    <Button onClick={handleRetry} colorScheme="yellow" className="flex-1">재도전</Button>
                    {isWinner && (
                        <Button onClick={handleNextStage} disabled={!canTryNext} colorScheme="accent" className="flex-1">다음 단계</Button>
                    )}
                </div>
            </div>
        </DraggableWindow>
    );
};

export default SinglePlayerSummaryModal;
