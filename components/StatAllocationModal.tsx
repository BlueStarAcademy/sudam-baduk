import React, { useState, useMemo, useEffect, useCallback } from 'react';
// FIX: Separate enum and type imports.
import { CoreStat } from '../types/index.js';
import type { UserWithStatus, ServerAction } from '../types/index.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import RadarChart from './RadarChart.js';
import { CORE_STATS_DATA } from '../constants.js';

// FIX: Add missing props to the interface
interface StatAllocationModalProps {
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => Promise<{ success: boolean; error?: string;[key: string]: any; } | undefined>;
    isTopmost?: boolean;
}

const createDefaultSpentStatPoints = (): Record<CoreStat, number> => ({
    [CoreStat.Concentration]: 0,
    [CoreStat.ThinkingSpeed]: 0,
    [CoreStat.Judgment]: 0,
    [CoreStat.Calculation]: 0,
    [CoreStat.CombatPower]: 0,
    [CoreStat.Stability]: 0,
});


const StatAllocationModal: React.FC<StatAllocationModalProps> = ({ currentUser, onClose, onAction, isTopmost }) => {
    const initialSpentPoints = useMemo(() => {
        return currentUser.spentStatPoints || createDefaultSpentStatPoints();
    }, [currentUser.spentStatPoints]);

    const [tempPoints, setTempPoints] = useState<Record<CoreStat, number>>(
        JSON.parse(JSON.stringify(initialSpentPoints))
    );
    const [resetCost, setResetCost] = useState<number | null>(null);
    const [isFetchingCost, setIsFetchingCost] = useState(false);

    useEffect(() => {
        setTempPoints(JSON.parse(JSON.stringify(currentUser.spentStatPoints || createDefaultSpentStatPoints())));
    }, [currentUser.spentStatPoints]);

    const levelPoints = (currentUser.strategyLevel - 1) * 2 + (currentUser.playfulLevel - 1) * 2;
    const masteryBonus = currentUser.mannerMasteryApplied ? 20 : 0;
    const bonusStatPoints = currentUser.bonusStatPoints || 0;
    const totalPoints = levelPoints + masteryBonus + bonusStatPoints;

    const initialSpentTotal = useMemo(() => {
        return Object.values(initialSpentPoints).reduce((sum, points) => sum + points, 0);
    }, [initialSpentPoints]);

    const availablePointsToDistribute = totalPoints - initialSpentTotal;

    const newlySpentPoints = useMemo(() => {
        let spent = 0;
        for (const stat of Object.values(CoreStat)) {
            spent += (tempPoints[stat] || 0) - (initialSpentPoints[stat] || 0);
        }
        return spent;
    }, [tempPoints, initialSpentPoints]);
    
    const remainingPoints = availablePointsToDistribute - newlySpentPoints;

    const isLocked = availablePointsToDistribute <= 0;

    const fetchResetCost = useCallback(async () => {
        setIsFetchingCost(true);
        const result = await onAction({ type: 'RESET_STAT_POINTS', payload: { dryRun: true } });
        if (result && typeof result.cost === 'number') {
            setResetCost(result.cost);
        }
        setIsFetchingCost(false);
    }, [onAction]);

    useEffect(() => {
        fetchResetCost();
    }, [fetchResetCost]);

    const handlePointChange = (stat: CoreStat, value: string) => {
        const newValue = Number(value) || 0;
        const initialValueForStat = initialSpentPoints[stat];

        if (newValue < initialValueForStat) {
            return;
        }

        const increase = newValue - tempPoints[stat];
        
        if (increase > remainingPoints) {
            setTempPoints(prev => ({ ...prev, [stat]: prev[stat] + remainingPoints }));
        } else {
            setTempPoints(prev => ({ ...prev, [stat]: newValue }));
        }
    };

    const handleReset = async () => {
        if (resetCost === null) return;
        if (window.confirm(`골드 ${resetCost.toLocaleString()}개를 사용하여 모든 보너스 포인트를 초기화하시겠습니까?`)) {
            await onAction({ type: 'RESET_STAT_POINTS' });
            fetchResetCost();
        }
    };
    
    const handleConfirm = async () => {
        await onAction({ type: 'CONFIRM_STAT_ALLOCATION', payload: { newStatPoints: tempPoints } });
    };

    const chartStats = useMemo(() => {
        const result: Record<string, number> = {};
        for (const key of Object.values(CoreStat)) {
            result[key] = (currentUser.baseStats[key] || 0) + (tempPoints[key] || 0);
        }
        return result;
    }, [currentUser.baseStats, tempPoints]);

    const radarDatasets = useMemo(() => [
        { stats: chartStats, color: '#60a5fa', fill: 'rgba(59, 130, 246, 0.4)' }
    ], [chartStats]);

    const canAffordReset = resetCost !== null && currentUser.gold >= resetCost;

    const isUnchanged = useMemo(() => {
        return JSON.stringify(tempPoints) === JSON.stringify(currentUser.spentStatPoints || createDefaultSpentStatPoints());
    }, [tempPoints, currentUser.spentStatPoints]);

    return (
        <DraggableWindow title="능력치 포인트 분배" onClose={onClose} windowId="stat-allocation" initialWidth={700} isTopmost={isTopmost}>
            <div className="flex flex-col md:flex-row gap-6 h-[calc(var(--vh,1vh)*70)]">
                <div className="w-full md:w-1/2 flex flex-col items-center justify-center bg-gray-900/50 p-4 rounded-lg">
                    <h3 className="text-lg font-bold mb-4">최종 능력치</h3>
                    <RadarChart datasets={radarDatasets} maxStatValue={300} size={250} />
                </div>
                <div className="w-full md:w-1/2 flex flex-col">
                    <div className="bg-gray-900/50 p-4 rounded-lg mb-4 text-center">
                        <p className="text-gray-300">사용 가능한 보너스 포인트</p>
                        <p className="text-3xl font-bold text-green-400">{remainingPoints}</p>
                    </div>
                    <div className="flex-grow space-y-2 overflow-y-auto pr-2">
                        {Object.values(CoreStat).map(stat => {
                            const currentSpent = tempPoints[stat] || 0;
                            const initialSpentForStat = initialSpentPoints[stat];
                            const maxForThisStat = currentSpent + remainingPoints;
                            
                            return (
                                <div key={stat} className="bg-gray-900/40 p-2 md:p-3 rounded-md">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-gray-200 text-sm md:text-base">{stat}</span>
                                        <span className="font-mono font-bold text-lg" title={`기본: ${currentUser.baseStats[stat]}, 보너스: ${currentSpent}`}>
                                            {chartStats[stat]}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="range"
                                            min={initialSpentForStat}
                                            max={maxForThisStat}
                                            value={currentSpent}
                                            onChange={(e) => handlePointChange(stat, e.target.value)}
                                            disabled={isLocked}
                                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                                        />
                                        <input
                                            type="number"
                                            value={currentSpent}
                                            onChange={(e) => handlePointChange(stat, e.target.value)}
                                            disabled={isLocked}
                                            min={initialSpentForStat}
                                            className="w-16 bg-gray-700 border border-gray-600 rounded-md p-1 text-center"
                                        />
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">{CORE_STATS_DATA[stat].description}</p>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex justify-between mt-4 pt-4 border-t border-gray-700">
                        <Button 
                            onClick={handleReset} 
                            colorScheme="red" 
                            disabled={isFetchingCost || resetCost === null || !canAffordReset}
                            title={resetCost !== null && !canAffordReset ? `골드 부족: ${resetCost.toLocaleString()} 필요` : ''}
                        >
                            {isFetchingCost ? '비용 확인 중...' : resetCost !== null ? `초기화 (💰${resetCost.toLocaleString()})` : '초기화'}
                        </Button>
                        <div className="flex gap-2">
                            <Button onClick={onClose} colorScheme="gray">닫기</Button>
                            <Button onClick={handleConfirm} colorScheme="green" disabled={isLocked || isUnchanged}>
                                {isLocked ? '분배 완료됨' : '분배 완료'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default StatAllocationModal;