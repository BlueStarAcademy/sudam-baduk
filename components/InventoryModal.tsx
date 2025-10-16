import React, { useState, useMemo } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import { InventoryItem, InventoryItemType, ItemGrade, EquipmentSlot } from '../types/index.js';
import { GRADE_LEVEL_REQUIREMENTS, emptySlotImages } from '../constants/index.js';

const gradeBackgrounds: Record<ItemGrade, string> = {
    normal: '/images/equipments/normalbgi.png',
    uncommon: '/images/equipments/uncommonbgi.png',
    rare: '/images/equipments/rarebgi.png',
    epic: '/images/equipments/epicbgi.png',
    legendary: '/images/equipments/legendarybgi.png',
    mythic: '/images/equipments/mythicbgi.png',
};

const renderStarDisplay = (stars: number) => {
    if (stars === 0) return null;
    let starImage = '/images/equipments/Star1.png';
    let numberColor = 'text-white';
    if (stars >= 10) { starImage = '/images/equipments/Star4.png'; numberColor = "prism-text-effect"; }
    else if (stars >= 7) { starImage = '/images/equipments/Star3.png'; numberColor = "text-purple-400"; }
    else if (stars >= 4) { starImage = '/images/equipments/Star2.png'; numberColor = "text-amber-400"; }
    
    return (
        <div className="absolute top-0.5 left-0.5 flex items-center gap-0.5 bg-black/40 rounded-br-md px-1 py-0.5 z-10" style={{ textShadow: '1px 1px 2px black' }}>
            <img src={starImage} alt="star" className="w-3 h-3" />
            <span className={`font-bold text-xs leading-none ${numberColor}`}>{stars}</span>
        </div>
    );
};

const ItemCard: React.FC<{ item: InventoryItem; onClick: () => void; }> = ({ item, onClick }) => {
    const { currentUserWithStatus } = useAppContext();
    const userLevelSum = (currentUserWithStatus?.strategyLevel ?? 1) + (currentUserWithStatus?.playfulLevel ?? 1);
    const requiredLevel = item.type === 'equipment' ? GRADE_LEVEL_REQUIREMENTS[item.grade] : 0;
    const canEquip = userLevelSum >= requiredLevel;

    return (
        <div
            className="relative aspect-square rounded-md border-2 border-color/50 bg-tertiary/50 cursor-pointer group"
            onClick={onClick}
        >
            <img src={gradeBackgrounds[item.grade]} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-sm" />
            {item.isEquipped && <div className="absolute top-1 right-1 w-2 h-2 bg-green-400 rounded-full z-10" title="장착중"></div>}
            {renderStarDisplay(item.stars)}
            {item.image && <img src={item.image} alt={item.name} className="relative w-full h-full object-contain p-1 group-hover:scale-110 transition-transform" />}
            {item.quantity && item.quantity > 1 && (
                <span className="absolute bottom-0 right-0 text-xs font-bold text-white bg-black/60 px-1 rounded-tl-md">{item.quantity}</span>
            )}
            {!canEquip && item.type === 'equipment' && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-center text-xs font-bold text-red-400" title={`착용 레벨 합 필요: ${requiredLevel}`}>
                    레벨 부족
                </div>
            )}
        </div>
    );
};


const InventoryModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { currentUserWithStatus, handlers } = useAppContext();
  const [activeTab, setActiveTab] = useState<InventoryItemType | 'all'>('all');
  
  if (!currentUserWithStatus) return null;

  const { inventory, inventorySlots } = currentUserWithStatus;
  
  const filteredItems = useMemo(() => {
    const sorted = [...inventory].sort((a, b) => b.createdAt - a.createdAt);
    if (activeTab === 'all') return sorted;
    return sorted.filter(item => item.type === activeTab);
  }, [inventory, activeTab]);

  const getSlotCount = (type: InventoryItemType | 'all') => {
      if (type === 'all') return inventory.length;
      return inventory.filter(i => i.type === type).length;
  };
  
  const getSlotMax = (type: InventoryItemType | 'all') => {
      if (type === 'all') return Object.values(inventorySlots).reduce((sum, val) => sum + val, 0);
      return inventorySlots[type] || 0;
  };
  
  const tabs: { id: InventoryItemType | 'all', label: string }[] = [
      { id: 'all', label: '전체' },
      { id: 'equipment', label: '장비' },
      { id: 'consumable', label: '소모품' },
      { id: 'material', label: '재료' },
  ];

  return (
    <DraggableWindow title="인벤토리" onClose={onClose} windowId="inventory" initialWidth={700}>
        <div className="absolute top-4 right-20 z-10">
            <button
                onClick={handlers.openBlacksmith}
                className="w-10 h-10 rounded-full bg-secondary hover:bg-tertiary border-2 border-color p-2 transition-transform hover:scale-110"
                title="대장간으로 이동"
            >
                <img src="/images/button/enhance.png" alt="대장간" />
            </button>
        </div>
      <div className="h-[80vh] flex flex-col">
          <div className="flex bg-tertiary/70 p-1 rounded-lg mb-4 flex-shrink-0">
              {tabs.map(tab => (
                  <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 py-2 text-sm font-semibold rounded-md ${activeTab === tab.id ? 'bg-accent' : 'text-tertiary'}`}
                  >
                      {tab.label} ({getSlotCount(tab.id)}/{getSlotMax(tab.id)})
                  </button>
              ))}
          </div>
          
          <div className="flex-grow overflow-y-auto pr-2">
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 gap-2">
                  {filteredItems.map(item => (
                      <ItemCard key={item.id} item={item} onClick={() => handlers.openViewingItem(item, true)} />
                  ))}
              </div>
          </div>
      </div>
    </DraggableWindow>
  );
};

export default InventoryModal;
