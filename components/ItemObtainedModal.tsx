import React, { useEffect } from 'react';
import DraggableWindow from './DraggableWindow';
import Button from './Button';
import { InventoryItem, ItemGrade, ItemOption, CoreStat, SpecialStat, MythicStat } from '../types';
import { audioService } from '../services/audioService';
import { GRADE_LEVEL_REQUIREMENTS } from '../constants';
import { gradeStyles, getStarDisplayInfo } from '../utils/itemDisplayUtils';

interface ItemObtainedModalProps {
    item: InventoryItem;
    onClose: () => void;
    isTopmost?: boolean;
}

const gradeBorderStyles: Partial<Record<ItemGrade, string>> = {
    [ItemGrade.Rare]: 'spinning-border-rare',
    [ItemGrade.Epic]: 'spinning-border-epic',
    [ItemGrade.Legendary]: 'spinning-border-legendary',
    [ItemGrade.Mythic]: 'spinning-border-mythic',
};



const OptionSection: React.FC<{ title: string; options: ItemOption[]; color: string; }> = ({ title, options, color }) => {
    if (options.length === 0) return null;
    return (
        <div>
            <h5 className={`font-semibold ${color} border-b border-gray-600 pb-1 mb-1 text-sm`}>{title}</h5>
            <ul className="list-disc list-inside space-y-0.5 text-gray-300 text-xs">
                {options.map((opt, i) => <li key={i}>{opt.display}</li>)}
            </ul>
        </div>
    );
};

const renderOptions = (item: InventoryItem) => {
    if (!item.options) return null;
    const { main, combatSubs, specialSubs, mythicSubs } = item.options;
    return (
        <div className="w-full text-xs text-left space-y-2">
            <OptionSection title="주옵션" options={[main]} color="text-yellow-300" />
            <OptionSection title="전투 부옵션" options={combatSubs} color="text-blue-300" />
            <OptionSection title="특수 부옵션" options={specialSubs} color="text-green-300" />
            <OptionSection title="신화 부옵션" options={mythicSubs} color="text-red-400" />
        </div>
    )
};

const ItemObtainedModal: React.FC<ItemObtainedModalProps> = ({ item, onClose, isTopmost }) => {
    const styles = gradeStyles[item.grade];
    const requiredLevel = item.type === 'equipment' ? GRADE_LEVEL_REQUIREMENTS[item.grade] : null;
    const starInfo = getStarDisplayInfo(item.stars);
    const borderClass = gradeBorderStyles[item.grade];
    const isCurrency = item.image === '/images/Gold.png' || item.image === '/images/Zem.png';

    useEffect(() => {
        if ([ItemGrade.Epic, ItemGrade.Legendary, ItemGrade.Mythic].includes(item.grade)) {
            audioService.gachaEpicOrHigher();
        }
    }, [item.grade]);

    return (
        <DraggableWindow title="아이템 획득" onClose={onClose} windowId="item-obtained" initialWidth={500} isTopmost={isTopmost}>
            <div className="text-center">
                <div className="p-6 rounded-lg">
                    <div className="relative w-48 h-48 mx-auto rounded-lg mb-4 overflow-hidden">
                        {borderClass && (
                            <div className={`absolute -inset-1 rounded-lg ${borderClass}`}></div>
                        )}
                        <div className="relative w-full h-full rounded-lg flex items-center justify-center border-2 border-black/50 overflow-hidden">
                            <img src={styles.background} alt={item.grade} className="absolute inset-0 w-full h-full object-cover" />
                            {item.image && <img src={item.image} alt={item.name} className="relative w-full h-full object-contain p-4" />}
                            {isCurrency && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-sm p-1">
                                    <span className="text-white text-3xl font-bold text-center break-words" style={{ textShadow: '1px 1px 2px black' }}>
                                        +{item.quantity?.toLocaleString()}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                    <p className={`font-bold text-lg ${styles.text}`}>[{styles.name}]</p>
                    <div className="flex items-baseline justify-center gap-2">
                        <h2 className={`text-3xl font-bold ${starInfo.colorClass}`}>{item.name}</h2>
                        {item.stars > 0 && <span className={`text-2xl font-bold ${starInfo.colorClass}`}>{starInfo.text}</span>}
                    </div>
                    {requiredLevel && <p className="text-xs text-yellow-300">(착용 레벨 합: {requiredLevel})</p>}
                    {item.type === 'equipment' && (
                        <div className="w-full text-xs text-left space-y-2 mt-4 max-h-48 overflow-y-auto bg-black/20 p-2 rounded-md">
                            {renderOptions(item)}
                        </div>
                    )}
                </div>
                <Button onClick={onClose} className="w-full mt-6 py-2.5">확인</Button>
            </div>
        </DraggableWindow>
    );
};

export default ItemObtainedModal;
