import React, { useMemo, useEffect, useRef } from 'react';
import { UserWithStatus, ServerAction, SinglePlayerLevel, InventoryItem, SinglePlayerStageInfo } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import { SINGLE_PLAYER_STAGES } from '../constants/singlePlayerConstants.js';
import { CONSUMABLE_ITEMS } from '../constants.js';

interface StageSelectionModalProps {
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
    levelName: string;
    levelIdPrefix: SinglePlayerLevel;
}

const StageSelectionModal: React.FC<StageSelectionModalProps> = ({ currentUser, onClose, onAction, levelName, levelIdPrefix }) => {
    
    const userProgress = currentUser.singlePlayerProgress ?? 0;

    const stagesForLevel = useMemo((): SinglePlayerStageInfo[] => {
        return SINGLE_PLAYER_STAGES.filter(stage => stage.level === levelIdPrefix);
    }, [levelIdPrefix]);

    const handleStageClick = (stageId: string) => {
        onAction({ type: 'START_SINGLE_PLAYER_GAME', payload: { stageId } });
    };
    
    const scrollContainerRef = useRef<HTMLUListElement>(null);
    const stageRefs = useRef<Map<string, HTMLLIElement | null>>(new Map());

    useEffect(() => {
        const currentStage = SINGLE_PLAYER_STAGES[userProgress];
        if (currentStage && currentStage.level === levelIdPrefix) {
            const targetElement = stageRefs.current.get(currentStage.id);
            if (targetElement && scrollContainerRef.current) {
                setTimeout(() => {
                    targetElement.scrollIntoView({ behavior: 'auto', block: 'center' });
                }, 100);
            }
        }
    }, [userProgress, levelIdPrefix]);

    return (
        <DraggableWindow title={`${levelName} 스테이지 선택`} onClose={onClose} windowId={`stage-selection-${levelIdPrefix}`} initialWidth={800}>
            <div className="h-[60vh] flex flex-col">
                <ul ref={scrollContainerRef} className="grid grid-cols-5 gap-4 overflow-y-auto pr-2">
                    {stagesForLevel.map(stage => {
                        const stageIndex = (SINGLE_PLAYER_STAGES.findIndex(s => s.id === stage.id));
                        const isLocked = userProgress < stageIndex;
                        const isCleared = userProgress > stageIndex;
                        const isCurrent = userProgress === stageIndex;

                        return (
                            <li
                                key={stage.id}
                                ref={(el) => { stageRefs.current.set(stage.id, el); }}
                                onClick={() => !isLocked && handleStageClick(stage.id)}
                                className={`p-4 rounded-lg flex flex-col items-center justify-between text-center transition-all duration-200 relative border-2 ${
                                    isLocked 
                                    ? 'bg-gray-800/50 opacity-60 cursor-not-allowed border-transparent' 
                                    : `bg-gray-700/50 hover:bg-gray-600/50 hover:scale-105 cursor-pointer ${isCleared ? 'border-green-500' : 'border-yellow-500'}`
                                }`}
                            >
                                {isCleared && <div className="absolute top-2 right-2 text-2xl">✅</div>}
                                <div className="flex-grow flex flex-col items-center justify-center">
                                    <h3 className="font-bold text-lg">{stage.name}</h3>
                                    <p className="text-xs text-gray-400 mt-1">{`목표 점수: 흑${stage.targetScore!.black}/백${stage.targetScore!.white}`}</p>
                                    <p className="text-xs text-gray-400 mt-1">AI 레벨: {stage.aiLevel}</p>
                                </div>
                                <div className="mt-4 pt-2 border-t border-gray-600 w-full flex-shrink-0">
                                    <p className="text-xs font-semibold text-yellow-300">최초 보상</p>
                                    <div className="flex items-center justify-center gap-2 mt-1 text-xs">
                                        {(stage.rewards.firstClear?.gold ?? 0) > 0 && (
                                            <span className="flex items-center gap-1" title={`골드 ${stage.rewards.firstClear?.gold}`}>
                                                <img src="/images/Gold.png" alt="골드" className="w-4 h-4" />
                                                {stage.rewards.firstClear?.gold}
                                            </span>
                                        )}
                                        {(stage.rewards.firstClear?.exp?.amount ?? 0) > 0 && (
                                            <span className="flex items-center gap-1" title={`경험치 ${stage.rewards.firstClear!.exp!.amount}`}>
                                                <span className="text-sm">⭐</span> {stage.rewards.firstClear!.exp!.amount}
                                            </span>
                                        )}
                                        {stage.rewards.firstClear?.items?.map((itemRef, idx) => {
                                            const itemName = 'itemId' in itemRef ? itemRef.itemId : itemRef.name;
                                            const itemTemplate = CONSUMABLE_ITEMS.find(ci => ci.name === itemName);
                                            if (!itemTemplate?.image) return null;
                                            const title = 'quantity' in itemRef ? `${itemName} x${itemRef.quantity}` : itemName;
                                            return (
                                                <div key={idx} className="flex items-center" title={title}>
                                                    <img src={itemTemplate.image} alt={itemName} className="w-5 h-5 object-contain" />
                                                </div>
                                            );
                                        })}
                                        {stage.rewards.firstClear?.bonus && 
                                            <span className="flex items-center gap-0.5" title={`보너스 스탯 ${stage.rewards.firstClear.bonus.replace('스탯', '')}`}>
                                                <img src="/images/icons/stat_point.png" alt="Stat Point" className="w-4 h-4" />
                                                {stage.rewards.firstClear.bonus.replace('스탯', '')}
                                            </span>
                                        }
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </DraggableWindow>
    );
};

export default StageSelectionModal;