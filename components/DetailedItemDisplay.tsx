import React, { useMemo } from 'react';
import { InventoryItem, ItemGrade, EquipmentSlot, CoreStat, SpecialStat, MythicStat, UserWithStatus } from '../types';
import { gradeStyles, getStarDisplayInfo } from '../utils/itemDisplayUtils';
import { CORE_STATS_DATA, SPECIAL_STATS_DATA, MYTHIC_STATS_DATA } from '../constants';
import { useAppContext } from '../hooks/useAppContext';
import { calculateItemStats } from '../utils/statUtils';
import { GRADE_LEVEL_REQUIREMENTS } from '../constants';

interface DetailedItemDisplayProps {
    item: InventoryItem;
    equippedItem?: InventoryItem | null; // For comparison in inventory
    isEquippedItem?: boolean; // To show equipped status
}

const DetailedItemDisplay: React.FC<DetailedItemDisplayProps> = ({ item, equippedItem, isEquippedItem }) => {
    const { currentUserWithStatus } = useAppContext();

    const itemStats = useMemo(() => calculateItemStats(item), [item]);
    const equippedItemStats = useMemo(() => equippedItem ? calculateItemStats(equippedItem) : null, [equippedItem]);

    const renderStat = (stat: CoreStat | SpecialStat | MythicStat, value: number, isPercentage: boolean, isMainStat = false) => {
        const statData = (CORE_STATS_DATA[stat as CoreStat] || SPECIAL_STATS_DATA[stat as SpecialStat] || MYTHIC_STATS_DATA[stat as MythicStat]);
        if (!statData) return null;

        let displayValue = value.toFixed(isPercentage ? 1 : 0);
        if (displayValue.endsWith('.0')) displayValue = displayValue.slice(0, -2);

        const equippedValue = equippedItemStats?.[stat] || 0;
        const diff = value - equippedValue;

        return (
            <div key={stat} className="flex justify-between items-center">
                <span className="text-gray-300 text-sm">{statData.name}:</span>
                <span className="font-bold text-primary text-sm">
                    {isMainStat ? '+' : ''}{displayValue}{isPercentage ? '%' : ''}
                    {equippedItem && diff !== 0 && (
                        <span className={`ml-1 text-xs ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            ({diff > 0 ? '+' : ''}{diff.toFixed(isPercentage ? 1 : 0)}{isPercentage ? '%' : ''})
                        </span>
                    )}
                </span>
            </div>
        );
    };

    const renderOptions = (options: ItemOption[], title: string, color: string) => {
        if (options.length === 0) return null;
        return (
            <div className="mb-2">
                <h4 className={`font-semibold ${color} border-b border-gray-600 pb-1 mb-1 text-sm`}>{title}</h4>
                <div className="space-y-1">
                    {options.map((opt, i) => renderStat(opt.type, opt.value, opt.isPercentage))}
                </div>
            </div>
        );
    };

    const userLevelSum = (currentUserWithStatus?.strategyLevel ?? 1) + (currentUserWithStatus?.playfulLevel ?? 1);
    const requiredLevel = item.type === 'equipment' ? GRADE_LEVEL_REQUIREMENTS[item.grade] : 0;
    const canEquip = userLevelSum >= requiredLevel;

    return (
        <div className="w-full h-full flex flex-col bg-gray-800/50 rounded-lg p-2 relative">
            <div className="flex items-center justify-between mb-1">
                <h3 className={`font-bold text-base ${gradeStyles[item.grade]}`}>{item.name}
                    {item.type === 'equipment' && item.options?.main && (
                        <span className="ml-2 text-sm text-blue-300">({CORE_STATS_DATA[item.options.main.type].name}: +{item.options.main.value}{item.options.main.isPercentage ? '%' : ''})</span>
                    )}
                </h3>
                {item.isEquipped && <span className="text-green-400 text-xs font-bold">[장착중]</span>}
            </div>
            <p className="text-gray-400 text-xs mb-2">{item.description}</p>

            <div className="flex items-center justify-center mb-2 relative">
                <img src={gradeStyles[item.grade].background} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-md opacity-20" />
                <img src={item.image || '/images/equipments/empty.png'} alt={item.name} className="w-16 h-16 object-contain relative z-10" />
                {item.stars > 0 && (
                    <div className="absolute bottom-0 right-0 bg-black/60 rounded-tl-md px-1 py-0.5 flex items-center gap-0.5 z-10">
                        <img src={getStarDisplayInfo(item.stars).starImage} alt="star" className="w-3 h-3" />
                        <span className={`font-bold text-sm ${getStarDisplayInfo(item.stars).numberColor}`}>{item.stars}</span>
                    </div>
                )}
            </div>

            {item.type === 'equipment' && (
                <div className="space-y-1 flex-grow overflow-y-auto pr-1">
                    {/* Main option is now next to title */}
                    {renderOptions(item.options?.combatSubs || [], '전투 부옵션', 'text-red-300')}
                    {renderOptions(item.options?.specialSubs || [], '특수 부옵션', 'text-yellow-300')}
                    {renderOptions(item.options?.mythicSubs || [], '신화 부옵션', 'text-purple-300')}
                </div>
            )}

            {item.type === 'consumable' && item.quantity && (
                <p className="text-gray-300 text-xs text-center mt-auto">수량: {item.quantity}</p>
            )}
            {item.type === 'material' && item.quantity && (
                <p className="text-gray-300 text-xs text-center mt-auto">수량: {item.quantity}</p>
            )}

            {!canEquip && item.type === 'equipment' && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-center text-sm font-bold text-red-400 rounded-lg">
                    착용 레벨 부족 (합 {requiredLevel} 필요)
                </div>
            )}
        </div>
    );
};

export default DetailedItemDisplay;
