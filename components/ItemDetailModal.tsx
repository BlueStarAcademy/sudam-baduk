import React from 'react';
import { InventoryItem, ItemGrade, ItemOption } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';

interface ItemDetailModalProps {
    item: InventoryItem;
    isOwnedByCurrentUser: boolean;
    onClose: () => void;
    onStartEnhance: (item: InventoryItem) => void;
    isTopmost?: boolean;
}

const gradeStyles: Record<ItemGrade, { name: string; color: string; background: string; }> = {
    normal: { name: '일반', color: 'text-gray-300', background: '/images/equipments/normalbgi.png' },
    uncommon: { name: '고급', color: 'text-green-400', background: '/images/equipments/uncommonbgi.png' },
    rare: { name: '희귀', color: 'text-blue-400', background: '/images/equipments/rarebgi.png' },
    epic: { name: '에픽', color: 'text-purple-400', background: '/images/equipments/epicbgi.png' },
    legendary: { name: '전설', color: 'text-red-500', background: '/images/equipments/legendarybgi.png' },
    mythic: { name: '신화', color: 'text-orange-400', background: '/images/equipments/mythicbgi.png' },
};

const getStarDisplayInfo = (stars: number) => {
    if (stars >= 10) {
        return { text: `(★${stars})`, colorClass: "prism-text-effect" };
    } else if (stars >= 7) {
        return { text: `(★${stars})`, colorClass: "text-purple-400" };
    } else if (stars >= 4) {
        return { text: `(★${stars})`, colorClass: "text-amber-400" };
    } else if (stars >= 1) {
        return { text: `(★${stars})`, colorClass: "text-white" };
    }
    return { text: "", colorClass: "text-white" };
};

const OptionSection: React.FC<{ title: string; options: ItemOption[]; color: string; }> = ({ title, options, color }) => (
    <div>
        <h5 className={`font-semibold ${color} border-b border-gray-600 pb-1 mb-1`}>{title}</h5>
        <ul className="list-disc list-inside space-y-0.5 text-gray-300">
            {options.map((opt, i) => <li key={i}>{opt.display}</li>)}
        </ul>
    </div>
);


const ItemDetailModal: React.FC<ItemDetailModalProps> = ({ item, isOwnedByCurrentUser, onClose, onStartEnhance, isTopmost }) => {
    const styles = gradeStyles[item.grade];
    const starInfo = getStarDisplayInfo(item.stars);

    return (
        <DraggableWindow title="장비 상세 정보" onClose={onClose} windowId={`item-detail-${item.id}`} initialWidth={350} isTopmost={isTopmost}>
            <div className="flex flex-col items-center text-center">
                <div className="relative w-32 h-32 rounded-lg mb-4">
                    <img src={styles.background} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-lg" />
                    {item.image && <img src={item.image} alt={item.name} className="relative w-full h-full object-contain p-4"/>}
                </div>
                <div className="flex items-baseline justify-center gap-2">
                    <h3 className={`text-2xl font-bold ${starInfo.colorClass}`}>{item.name}</h3>
                    {item.stars > 0 && <span className={`text-xl font-bold ${starInfo.colorClass}`}>{starInfo.text}</span>}
                </div>
                <p className="text-sm text-center mb-4">
                    <span className={`font-bold ${styles.color}`}>[{styles.name}]</span>
                    {item.options?.main && (
                        <span className="font-semibold text-yellow-300 ml-2">{item.options.main.display}</span>
                    )}
                </p>
                
                <div className="w-full text-sm text-left space-y-3 bg-gray-900/50 p-3 rounded-lg">
                    {item.options?.combatSubs && item.options.combatSubs.length > 0 && (
                         <OptionSection title="전투 부옵션" options={item.options.combatSubs} color="text-blue-300" />
                    )}
                    {item.options?.specialSubs && item.options.specialSubs.length > 0 && (
                         <OptionSection title="특수 부옵션" options={item.options.specialSubs} color="text-green-300" />
                    )}
                    {item.options?.mythicSubs && item.options.mythicSubs.length > 0 && (
                         <OptionSection title="신화 부옵션" options={item.options.mythicSubs} color="text-red-400" />
                    )}
                </div>

                {isOwnedByCurrentUser && item.type === 'equipment' && (
                    <div className="w-full mt-6 pt-4 border-t border-gray-700">
                        <Button
                            onClick={() => onStartEnhance(item)}
                            disabled={item.stars >= 10}
                            colorScheme="yellow"
                            className="w-full"
                        >
                            {item.stars >= 10 ? '최대 강화' : '강화하기'}
                        </Button>
                    </div>
                )}
            </div>
        </DraggableWindow>
    );
};

export default ItemDetailModal;
