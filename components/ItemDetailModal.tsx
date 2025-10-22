import React, { useMemo, useCallback } from 'react';
import { InventoryItem, ItemGrade, ItemOption, EquipmentSlot } from '../types';
import DraggableWindow from './DraggableWindow';
import Button from './Button';
import { GRADE_LEVEL_REQUIREMENTS } from '../constants';
import { useAppContext } from '../hooks/useAppContext';
import { gradeStyles } from '../utils/itemDisplayUtils';

const getStarDisplayInfo = (stars: number): { text: string; colorClass: string; starImage: string; numberColor: string; } => {
    if (stars >= 10) {
        return { text: `(★${stars})`, colorClass: "prism-text-effect", starImage: '/images/star-rainbow.png', numberColor: 'text-white' };
    } else if (stars >= 7) {
        return { text: `(★${stars})`, colorClass: "text-blue-400", starImage: '/images/star-blue.png', numberColor: 'text-blue-300' };
    } else if (stars >= 4) {
        return { text: `(★${stars})`, colorClass: "text-amber-400", starImage: '/images/star-gold.png', numberColor: 'text-yellow-300' };
    } else if (stars >= 1) {
        return { text: `(★${stars})`, colorClass: "text-white", starImage: '/images/star-white.png', numberColor: 'text-white' };
    }
    return { text: "", colorClass: "text-white", starImage: '', numberColor: '' };
};

const renderStarDisplay = (stars: number) => {
    if (stars === 0) return null;
    const starInfo = getStarDisplayInfo(stars);
    
    return (
        <div className="absolute top-0.5 left-0.5 flex items-center gap-0.5 bg-black/40 rounded-br-md px-1 py-0.5 z-10" style={{ textShadow: '1px 1px 2px black' }}>
            <img src={starInfo.starImage} alt="star" className="w-3 h-3" />
            <span className={`font-bold text-xs leading-none ${starInfo.numberColor}`}>{stars}</span>
        </div>
    );
};



// Copied from InventoryModal.tsx
const ComparisonDiff: React.FC<{ diff: number }> = ({ diff }) => {
    if (diff === 0) {
        return <span className="text-tertiary">(-)</span>;
    }
    const sign = diff > 0 ? '+' : '';
    const color = diff > 0 ? 'text-green-400' : 'text-red-400';
    return <span className={color}>({sign}{diff})</span>;
};

// Copied from InventoryModal.tsx
const DetailedItemDisplay: React.FC<{
    item: InventoryItem;
    isEquippedItem?: boolean;
    comparedToOption?: ItemOption; // For main option comparison
    equippedItem?: InventoryItem; // For all option comparisons
}> = ({ item, isEquippedItem, comparedToOption, equippedItem }) => {
    const styles = gradeStyles[item.grade];
    const requiredLevel = item.type === 'equipment' ? GRADE_LEVEL_REQUIREMENTS[item.grade] : null;
    const starInfo = getStarDisplayInfo(item.stars);

    const mainOptionDiff = useMemo(() => {
        if (!item.options?.main || !comparedToOption) return 0;
        return item.options.main.value - comparedToOption.value;
    }, [item.options?.main, comparedToOption]);

    const getOptionDiff = useCallback((selectedOpt: ItemOption, equippedOpts?: ItemOption[]) => {
        if (!equippedOpts) return 0;
        const equippedOpt = equippedOpts.find(opt => opt.type === selectedOpt.type && opt.isPercentage === selectedOpt.isPercentage);
        return selectedOpt.value - (equippedOpt?.value || 0);
    }, []);

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 p-1 flex-shrink-0">
                <div className="relative w-20 h-20 flex-shrink-0">
                    <img src={styles.background} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-lg" />
                    {item.image && <img src={item.image} alt={item.name} className="relative w-full h-full object-contain p-2" />}
                    {renderStarDisplay(item.stars)}
                </div>
                <div className="flex-grow">
                    <h3 className={`font-bold text-base ${starInfo.colorClass}`}>{item.name} {item.stars > 0 && <span className="text-xs">({starInfo.text})</span>}</h3>
                    {requiredLevel && <p className="text-xs text-yellow-300">착용 레벨 합: {requiredLevel}</p>}
                    {item.options?.main && (
                        <div className="text-xs text-yellow-300 flex justify-between">
                            <span>주옵션: {item.options.main.display}</span>
                            {comparedToOption && <ComparisonDiff diff={mainOptionDiff} />}
                        </div>
                    )}
                </div>
            </div>
            {item.options && (
                <div className="flex-grow overflow-y-auto p-2 text-xs space-y-1">
                    {item.options.combatSubs.length > 0 && (
                        <ul className="list-disc list-inside ml-2">
                            {item.options.combatSubs.map((opt, i) => {
                                const diff = equippedItem ? getOptionDiff(opt, equippedItem.options?.combatSubs) : 0;
                                return (
                                    <li key={i} className="text-blue-300 flex justify-between">
                                        <span>{opt.display}</span>
                                        {equippedItem && <ComparisonDiff diff={diff} />}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {item.options.specialSubs.length > 0 && (
                        <ul className="list-disc list-inside ml-2">
                            {item.options.specialSubs.map((opt, i) => {
                                const diff = equippedItem ? getOptionDiff(opt, equippedItem.options?.specialSubs) : 0;
                                return (
                                    <li key={i} className="text-green-300 flex justify-between">
                                        <span>{opt.display}</span>
                                        {equippedItem && <ComparisonDiff diff={diff} />}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {item.options.mythicSubs.length > 0 && (
                        <ul className="list-disc list-inside ml-2">
                            {item.options.mythicSubs.map((opt, i) => {
                                const diff = equippedItem ? getOptionDiff(opt, equippedItem.options?.mythicSubs) : 0;
                                return (
                                    <li key={i} className="text-red-400 flex justify-between">
                                        <span>{opt.display}</span>
                                        {equippedItem && <ComparisonDiff diff={diff} />}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
};

interface ItemDetailModalProps {
  item: InventoryItem;
  isOwnedByCurrentUser: boolean;
  onClose: () => void;
}

const ItemDetailModal: React.FC<ItemDetailModalProps> = ({ item, isOwnedByCurrentUser, onClose }) => {
  const { handlers, topmostModalId } = useAppContext();

  return (
    <DraggableWindow title={item.name} onClose={onClose} windowId={`item-detail-${item.id}`} initialWidth={500} isTopmost={topmostModalId === `item-detail-${item.id}`}>
      <div>
        <DetailedItemDisplay item={item} />
        <div className="flex gap-2 pt-2 border-t border-gray-700 mt-2">
            <Button onClick={() => { handlers.openBlacksmith(item); onClose(); }} colorScheme="blue" className="flex-1">대장간</Button>
            <Button onClick={onClose} colorScheme="gray" className="flex-1">확인</Button>
        </div>
      </div>
    </DraggableWindow>
  );
};

export default ItemDetailModal;
