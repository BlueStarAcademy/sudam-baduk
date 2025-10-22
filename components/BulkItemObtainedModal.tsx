import React, { useEffect, useMemo } from 'react';
import DraggableWindow from './DraggableWindow';
import Button from './Button';
// FIX: Separate enum and type imports.
import { ItemGrade } from '../types';
import type { InventoryItem } from '../types';
import { audioService } from '../services/audioService';
import { GRADE_LEVEL_REQUIREMENTS } from '../constants';
import { gradeStyles } from '../utils/itemDisplayUtils';

interface BulkItemObtainedModalProps {
    items: InventoryItem[];
    onClose: () => void;
    isTopmost?: boolean;
}

const gradeBorderStyles: Partial<Record<ItemGrade, string>> = {
    [ItemGrade.Rare]: 'spinning-border-rare',
    [ItemGrade.Epic]: 'spinning-border-epic',
    [ItemGrade.Legendary]: 'spinning-border-legendary',
    [ItemGrade.Mythic]: 'spinning-border-mythic',
};




const BulkItemObtainedModal: React.FC<BulkItemObtainedModalProps> = ({ items, onClose, isTopmost }) => {
    useEffect(() => {
        if (items && items.length > 0) {
            // FIX: Replaced string literals with enum members for ItemGrade.
            const gradeOrder: ItemGrade[] = [ItemGrade.Normal, ItemGrade.Uncommon, ItemGrade.Rare, ItemGrade.Epic, ItemGrade.Legendary, ItemGrade.Mythic];
            const bestItem = items.reduce((best, current) => {
                const bestGrade = best.grade || ItemGrade.Normal;
                const currentGrade = current.grade || ItemGrade.Normal;
                return gradeOrder.indexOf(currentGrade) > gradeOrder.indexOf(bestGrade) ? current : best;
            });
            if ([ItemGrade.Epic, ItemGrade.Legendary, ItemGrade.Mythic].includes(bestItem.grade)) {
                audioService.gachaEpicOrHigher();
            }
        }
    }, [items]);

    const totalItems = useMemo(() => {
        return items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    }, [items]);

    return (
        <DraggableWindow title="상자 열기 결과" onClose={onClose} windowId="bulk-item-obtained" initialWidth={600} closeOnOutsideClick={false} isTopmost={isTopmost}>
            <div className="text-center">
                <h2 className="text-xl font-bold mb-4">아이템 {totalItems}개를 획득했습니다!</h2>
                <div className="grid grid-cols-5 gap-2 max-h-[60vh] overflow-y-auto p-2 bg-gray-900/50 rounded-lg">
                    {items.map((item, index) => {
                        const styles = gradeStyles[item.grade];
                        const borderClass = gradeBorderStyles[item.grade];
                        const requiredLevel = item.type === 'equipment' ? GRADE_LEVEL_REQUIREMENTS[item.grade] : null;
                        const titleText = `${item.name}${requiredLevel ? ` (착용 레벨 합: ${requiredLevel})` : ''}`;
                        const isCurrency = item.image === '/images/Gold.png' || item.image === '/images/Zem.png';

                        return (
                            <div key={index} className="relative aspect-square rounded-md overflow-hidden" title={titleText}>
                                {borderClass && <div className={`absolute -inset-0.5 rounded-md ${borderClass}`}></div>}
                                <div className={`relative w-full h-full rounded-md flex items-center justify-center border-2 border-black/20 ${styles.bg}`}>
                                    <img src={styles.background} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-sm" />
                                    {item.image && <img src={item.image} alt={item.name} className="relative w-full h-full object-contain p-1" />}
                                    
                                    {isCurrency ? (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-sm p-1">
                                            <span className="text-white text-lg font-bold text-center break-words" style={{ textShadow: '1px 1px 2px black' }}>
                                                +{item.quantity?.toLocaleString()}
                                            </span>
                                        </div>
                                    ) : (
                                        item.quantity && item.quantity > 1 && (
                                            <span className="absolute bottom-0 right-0 text-xs font-bold text-white bg-black/60 px-1 rounded-tl-md">{item.quantity}</span>
                                        )
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <Button onClick={onClose} className="w-full mt-6 py-2.5">확인</Button>
            </div>
        </DraggableWindow>
    );
};

export default BulkItemObtainedModal;
