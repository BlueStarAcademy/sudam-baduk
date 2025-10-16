import React from 'react';
import { InventoryItem, ItemGrade, ItemOption, EquipmentSlot } from '../types/index.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import { GRADE_LEVEL_REQUIREMENTS } from '../constants/index.js';
import { useAppContext } from '../hooks/useAppContext.js';

interface ItemDetailModalProps {
  item: InventoryItem;
  isOwnedByCurrentUser: boolean;
  onClose: () => void;
}

const gradeStyles: Record<ItemGrade, { bg: string, text: string, shadow: string, name: string, background: string }> = {
    normal: { bg: 'bg-gray-700', text: 'text-white', shadow: 'shadow-gray-900/50', name: '일반', background: '/images/equipments/normalbgi.png' },
    uncommon: { bg: 'bg-green-700', text: 'text-green-200', shadow: 'shadow-green-500/50', name: '고급', background: '/images/equipments/uncommonbgi.png' },
    rare: { bg: 'bg-blue-700', text: 'text-blue-200', shadow: 'shadow-blue-500/50', name: '희귀', background: '/images/equipments/rarebgi.png' },
    epic: { bg: 'bg-purple-700', text: 'text-purple-200', shadow: 'shadow-purple-500/50', name: '에픽', background: '/images/equipments/epicbgi.png' },
    legendary: { bg: 'bg-red-800', text: 'text-red-200', shadow: 'shadow-red-500/50', name: '전설', background: '/images/equipments/legendarybgi.png' },
    mythic: { bg: 'bg-orange-700', text: 'text-orange-200', shadow: 'shadow-orange-500/50', name: '신화', background: '/images/equipments/mythicbgi.png' },
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


const ItemDetailModal: React.FC<ItemDetailModalProps> = ({ item, isOwnedByCurrentUser, onClose }) => {
  const { handlers, currentUserWithStatus } = useAppContext();
  const styles = gradeStyles[item.grade];
  const requiredLevel = item.type === 'equipment' ? GRADE_LEVEL_REQUIREMENTS[item.grade] : null;
  const starInfo = getStarDisplayInfo(item.stars);

  const handleEquipToggle = () => {
    handlers.handleAction({ type: 'TOGGLE_EQUIP_ITEM', payload: { itemId: item.id } });
    onClose();
  };

  const handleSell = () => {
    if(window.confirm(`${item.name} 아이템을 판매하시겠습니까?`)) {
        handlers.handleAction({ type: 'SELL_ITEM', payload: { itemId: item.id } });
        onClose();
    }
  }

  const handleUse = () => {
      handlers.handleAction({ type: 'USE_ITEM', payload: { itemId: item.id } });
      onClose();
  };

  return (
    <DraggableWindow title={item.name} onClose={onClose} windowId={`item-detail-${item.id}`}>
      <div className="flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-1/3 flex flex-col items-center">
            <div className="relative w-32 h-32 rounded-lg">
                <img src={styles.background} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-lg" />
                {item.image && <img src={item.image} alt={item.name} className="relative w-full h-full object-contain p-4"/>}
            </div>
            <p className={`font-bold text-lg ${styles.text}`}>[{styles.name}]</p>
             <div className="flex items-baseline justify-center gap-2">
                <h2 className={`text-2xl font-bold ${starInfo.colorClass}`}>{item.name}</h2>
                {item.stars > 0 && <span className={`text-xl font-bold ${starInfo.colorClass}`}>{starInfo.text}</span>}
            </div>
            {requiredLevel && <p className="text-xs text-yellow-300">(착용 레벨 합: {requiredLevel})</p>}
        </div>
        <div className="w-full md:w-2/3 space-y-3">
            <p className="text-sm text-gray-400 italic bg-gray-900/50 p-2 rounded-md">{item.description}</p>
            {item.type === 'equipment' && item.options && (
                 <div className="w-full text-xs text-left space-y-2 max-h-48 overflow-y-auto bg-black/20 p-2 rounded-md">
                    <OptionSection title="주옵션" options={[item.options.main]} color="text-yellow-300" />
                    <OptionSection title="전투 부옵션" options={item.options.combatSubs} color="text-blue-300" />
                    <OptionSection title="특수 부옵션" options={item.options.specialSubs} color="text-green-300" />
                    <OptionSection title="신화 부옵션" options={item.options.mythicSubs} color="text-red-400" />
                </div>
            )}
             {isOwnedByCurrentUser && (
                <div className="flex gap-2 pt-2 border-t border-gray-700">
                    <Button onClick={onClose} colorScheme="gray" className="flex-1">닫기</Button>
                    {item.type === 'equipment' && <Button onClick={handleEquipToggle} colorScheme="green" className="flex-1">{item.isEquipped ? '장착 해제' : '장착'}</Button>}
                    {item.type === 'consumable' && <Button onClick={handleUse} colorScheme="blue" className="flex-1">사용</Button>}
                    {item.type === 'equipment' && <Button onClick={() => handlers.openEnhancement(item)} colorScheme="yellow" className="flex-1">강화</Button>}
                    {item.type !== 'consumable' && <Button onClick={handleSell} colorScheme="red" className="flex-1">판매</Button>}
                </div>
             )}
        </div>
      </div>
    </DraggableWindow>
  );
};

export default ItemDetailModal;
