import React, { useMemo } from 'react';
import { UserWithStatus, Guild, CoreStat, SpecialStat, MythicStat } from '../types/index.js';
import DraggableWindow from './DraggableWindow.js';
import RadarChart from './RadarChart.js';
import { calculateUserEffects } from '../utils/statUtils.js';
import { calculateTotalStats } from '../utils/statUtils.js';
import { MYTHIC_STATS_DATA } from '../constants/index.js';

interface EquipmentEffectsModalProps {
    user: UserWithStatus;
    guild: Guild | null;
    onClose: () => void;
}

const StatRow: React.FC<{ label: string; value: string; colorClass?: string; }> = ({ label, value, colorClass = 'text-primary' }) => (
    <div className="flex justify-between items-center text-sm py-1 border-b border-color/50">
        <span className="text-secondary">{label}</span>
        <span className={`font-bold font-mono ${colorClass}`}>{value}</span>
    </div>
);

const EquipmentEffectsModal: React.FC<EquipmentEffectsModalProps> = ({ user, guild, onClose }) => {
    const effects = useMemo(() => calculateUserEffects(user, guild), [user, guild]);
    const totalStats = useMemo(() => calculateTotalStats(user, guild), [user, guild]);

    const radarDataset = useMemo(() => [{
        stats: totalStats,
        color: '#60a5fa', // blue-400
        fill: 'rgba(59, 130, 246, 0.4)', // blue-500 with alpha
    }], [totalStats]);

    return (
        <DraggableWindow title="장비 및 길드 효과 요약" onClose={onClose} windowId="equipment-effects-modal" initialWidth={700}>
            <div className="flex flex-col md:flex-row gap-6 h-[calc(var(--vh,1vh)*65)]">
                {/* Left Panel: Radar Chart */}
                <div className="w-full md:w-1/2 flex flex-col items-center bg-tertiary/50 p-4 rounded-lg">
                    <h3 className="text-lg font-bold text-highlight mb-4">최종 능력치</h3>
                    <RadarChart datasets={radarDataset} maxStatValue={1000} size={250} />
                </div>

                {/* Right Panel: Detailed Effects */}
                <div className="w-full md:w-1/2 flex flex-col gap-4 overflow-y-auto pr-2">
                    {/* Core Stats */}
                    <div className="bg-tertiary/50 p-3 rounded-lg">
                        <h4 className="font-semibold text-blue-300 mb-2">전투 능력치 보너스</h4>
                        <div className="space-y-1">
                            {Object.values(CoreStat).map(stat => {
                                const bonus = effects.coreStatBonuses[stat];
                                if (bonus.flat === 0 && bonus.percent === 0) return null;
                                return (
                                    <StatRow 
                                        key={stat}
                                        label={stat}
                                        value={`${bonus.flat > 0 ? `+${bonus.flat}` : ''} ${bonus.percent > 0 ? `+${bonus.percent.toFixed(1)}%` : ''}`.trim()}
                                    />
                                );
                            })}
                        </div>
                    </div>

                    {/* Special Stats */}
                    <div className="bg-tertiary/50 p-3 rounded-lg">
                        <h4 className="font-semibold text-green-300 mb-2">특수 능력치 보너스</h4>
                        <div className="space-y-1">
{/* FIX: Used optional chaining and nullish coalescing to safely access properties on a potentially 'unknown' type, resolving the error. */}
                             <StatRow label="행동력 최대치" value={`+${effects.specialStatBonuses[SpecialStat.ActionPointMax]?.flat ?? 0}`} />
                             <StatRow label="행동력 회복속도" value={`+${(effects.specialStatBonuses[SpecialStat.ActionPointRegen]?.percent ?? 0).toFixed(1)}%`} />
                             <StatRow label="전략 경험치" value={`+${(effects.strategicXpBonusPercent + (effects.specialStatBonuses[SpecialStat.StrategyXpBonus]?.percent ?? 0)).toFixed(1)}%`} />
                             <StatRow label="놀이 경험치" value={`+${(effects.playfulXpBonusPercent + (effects.specialStatBonuses[SpecialStat.PlayfulXpBonus]?.percent ?? 0)).toFixed(1)}%`} />
                             <StatRow label="골드 보상" value={`+${(effects.goldBonusPercent + (effects.specialStatBonuses[SpecialStat.GoldBonus]?.percent ?? 0)).toFixed(1)}%`} />
                             <StatRow label="장비 획득률" value={`+${(effects.itemDropRateBonus + (effects.specialStatBonuses[SpecialStat.ItemDropRate]?.percent ?? 0)).toFixed(1)}%`} />
                             <StatRow label="재료 획득률" value={`+${(effects.specialStatBonuses[SpecialStat.MaterialDropRate]?.percent ?? 0).toFixed(1)}%`} />
                        </div>
                    </div>
                    
                    {/* Mythic Stats */}
                    {Object.values(effects.mythicStatBonuses).some(b => (b as any)?.flat > 0) && (
                        <div className="bg-tertiary/50 p-3 rounded-lg">
                            <h4 className="font-semibold text-red-400 mb-2">신화 효과</h4>
                             <div className="space-y-1">
                                {Object.entries(effects.mythicStatBonuses).map(([stat, bonus]) => {
                                     if ((bonus as any).flat === 0) return null;
                                     const statInfo = MYTHIC_STATS_DATA[stat as MythicStat];
                                     return <StatRow key={stat} label={statInfo.name} value={`+${(bonus as any).flat}`} />;
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DraggableWindow>
    );
};

export default EquipmentEffectsModal;
