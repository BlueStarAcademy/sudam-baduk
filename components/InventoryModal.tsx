import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useAppContext } from '../hooks/useAppContext';
import DraggableWindow from './DraggableWindow';
import Button from './Button';
import { InventoryItem, InventoryItemType, ItemGrade, EquipmentSlot, CoreStat, ItemOption, ItemOptions, SpecialStat, MythicStat, UserWithStatus } from '../types';
import { GRADE_LEVEL_REQUIREMENTS, emptySlotImages, CORE_STATS_DATA, SPECIAL_STATS_DATA, MYTHIC_STATS_DATA } from '../constants';
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
import { calculateTotalStats } from '../utils/statUtils';
import BulkUseModal from './BulkUseModal';
import RadarChart from './RadarChart'; // Added this import

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



const EquipmentSlotDisplay: React.FC<{
    slot: EquipmentSlot;
    item?: InventoryItem;
    onClick?: () => void;
}> = ({ slot, item, onClick }) => {
    const clickableClass = item && onClick ? 'cursor-pointer hover:scale-105 transition-transform' : '';

    if (item) {
        return (
            <div
                className={`relative w-full aspect-square rounded-md border border-color/50 bg-tertiary/50 ${clickableClass}`}
                title={item.name}
                onClick={onClick}
            >
                <img src={gradeStyles[item.grade].background} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-sm" />
                {renderStarDisplay(item.stars)}
                {item.image && <img src={item.image} alt={item.name} className="relative w-full h-full object-contain p-1"/>}
            </div>
        );
    } else {
         return (
             <img src={emptySlotImages[slot]} alt={`${slot} empty slot`} className="w-full aspect-square rounded-md bg-tertiary/50 border-2 border-dashed border-color/50" />
        );
    }
};

const ItemCard: React.FC<{ item: InventoryItem; onClick: () => void; }> = ({ item, onClick }) => {
    const { currentUserWithStatus: rawCurrentUserWithStatus } = useAppContext();
    if (!rawCurrentUserWithStatus) return null; // Should not happen due to parent guard, but for type safety
    const currentUserWithStatus = rawCurrentUserWithStatus as UserWithStatus;
    const userLevelSum = (currentUserWithStatus.strategyLevel ?? 1) + (currentUserWithStatus.playfulLevel ?? 1);
    const requiredLevel = item.type === 'equipment' ? GRADE_LEVEL_REQUIREMENTS[item.grade] : 0;
    const canEquip = userLevelSum >= requiredLevel;

    return (
        <div
            className="relative aspect-square rounded-md border-2 border-color/50 bg-tertiary/50 cursor-pointer group"
            onClick={onClick}
        >
            <img src={gradeStyles[item.grade].background} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-sm" />
            {item.isEquipped && <div className="absolute top-0.5 right-0.5 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold z-10" title="장착중">E</div>}
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

const ExpandSlotCard: React.FC<{ onClick: () => void; }> = ({ onClick }) => {
    return (
        <div
            className="relative aspect-square rounded-md border-2 border-dashed border-color/50 bg-tertiary/30 cursor-pointer group hover:bg-tertiary/50 flex items-center justify-center"
            onClick={onClick}
        >
            <span className="text-4xl text-color/50 group-hover:text-color/80">+</span>
        </div>
    );
};

const EmptySlotCard: React.FC = () => {
    return <div className="aspect-square rounded-md bg-tertiary/20" />;
};

const ItemActionGuide: React.FC<{ item: InventoryItem }> = ({ item }) => {
    if (item.type === 'material') {
        return <MaterialConversionGuide item={item} />;
    }

    return <p className="text-tertiary text-sm mt-2">{item.description}</p>;
};

const MaterialConversionGuide: React.FC<{ item: InventoryItem }> = ({ item }) => {
    const materialTiers = ['하급 강화석', '중급 강화석', '상급 강화석', '최상급 강화석', '신비의 강화석'];
    const tierIndex = materialTiers.indexOf(item.name);

    if (tierIndex === -1) {
        return <p className="text-tertiary text-sm mt-2">{item.description}</p>;
    }

    const canUpgrade = tierIndex < materialTiers.length - 1;
    const canDowngrade = tierIndex > 0;

    return (
        <div className="text-sm text-tertiary mt-4 space-y-4 p-4 bg-black/20 rounded-lg">
            {canUpgrade && (
                <div className="flex items-center justify-center gap-2">
                    <div className="flex items-center gap-1">
                        <img src={`/images/materials/materials${tierIndex + 1}.png`} alt={item.name} className="w-6 h-6" />
                        <span>{item.name} x10</span>
                    </div>
                    <span className="text-lg font-bold">→</span>
                    <div className="flex items-center gap-1">
                        <img src={`/images/materials/materials${tierIndex + 2}.png`} alt={materialTiers[tierIndex + 1]} className="w-6 h-6" />
                        <span>{materialTiers[tierIndex + 1]} x1</span>
                    </div>
                </div>
            )}
            {canDowngrade && (
                <div className="flex items-center justify-center gap-2">
                    <div className="flex items-center gap-1">
                        <img src={`/images/materials/materials${tierIndex + 1}.png`} alt={item.name} className="w-6 h-6" />
                        <span>{item.name} x1</span>
                    </div>
                    <span className="text-lg font-bold">→</span>
                    <div className="flex items-center gap-1">
                        <img src={`/images/materials/materials${tierIndex}.png`} alt={materialTiers[tierIndex - 1]} className="w-6 h-6" />
                        <span>{materialTiers[tierIndex - 1]} x5</span>
                    </div>
                </div>
            )}
        </div>
    );
};


import DetailedItemDisplay from './DetailedItemDisplay';

import SavePresetNameModal from './SavePresetNameModal';



const InventoryModal: React.FC<{ onClose: () => void; isTopmost: boolean; }> = ({ onClose, isTopmost }) => {

  const { currentUserWithStatus, handlers, modals, myGuild, topmostModalId } = useAppContext();

  const [activeTab, setActiveTab] = useState<InventoryItemType | 'all'>('all');

  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  const [bulkUseItem, setBulkUseItem] = useState<InventoryItem | null>(null);

  const [sortBy, setSortBy] = useState<'time' | 'grade' | 'type'>('time');

  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);

  const [showSavePresetModal, setShowSavePresetModal] = useState(false);



  const handleSavePreset = useCallback(() => {

    setShowSavePresetModal(true);

  }, []);



  const handleConfirmSavePreset = useCallback((presetName: string) => {

    if (!currentUserWithStatus) return;

    const currentEquipment = currentUserWithStatus.equipment;

    handlers.handleAction({ type: 'SAVE_EQUIPMENT_PRESET', payload: { presetIndex: selectedPresetIndex, equipment: currentEquipment, presetName } });

    setShowSavePresetModal(false);

  }, [currentUserWithStatus, selectedPresetIndex, handlers]);

  const handleUnequipAll = useCallback(() => {
    if (!currentUserWithStatus) return;
    handlers.handleAction({ type: 'UNEQUIP_ALL_ITEMS' });
  }, [currentUserWithStatus, handlers]);

  useEffect(() => {
    if (selectedItem && currentUserWithStatus) {
        const updatedItem = currentUserWithStatus.inventory.find(item => item.id === selectedItem.id);
        if (updatedItem) {
            setSelectedItem(updatedItem);
        } else {
            setSelectedItem(null);
        }
    }
  }, [currentUserWithStatus, selectedItem]);

  const gradeOrder: Record<ItemGrade, number> = {
    mythic: 5,
    legendary: 4,
    epic: 3,
    rare: 2,
    uncommon: 1,
    normal: 0,
  };

  const slotOrder: Record<EquipmentSlot, number> = {
    [EquipmentSlot.Fan]: 0,
    [EquipmentSlot.Top]: 1,
    [EquipmentSlot.Bottom]: 2,
    [EquipmentSlot.Board]: 3,
    [EquipmentSlot.Bowl]: 4,
    [EquipmentSlot.Stones]: 5,
  };

  if (!currentUserWithStatus) return null;

  const equippedItem = useMemo(() => {
      if (!selectedItem || selectedItem.slot === null) return undefined;
      const slot = selectedItem.slot as EquipmentSlot;
      return currentUserWithStatus?.inventory.find(i => i.id === currentUserWithStatus?.equipment[slot]);
  }, [currentUserWithStatus, selectedItem]);

  const { inventory, inventorySlots } = currentUserWithStatus;

  // --- New code for Left Column ---
  const equippedItems = useMemo(() => {
      return (currentUserWithStatus.inventory || []).filter(item => item.isEquipped);
  }, [currentUserWithStatus.inventory]);

  const getItemForSlot = useCallback((slot: EquipmentSlot) => {
      return equippedItems.find(e => e && e.slot === slot);
  }, [equippedItems]);

  const totalStats = useMemo(() => calculateTotalStats(currentUserWithStatus, myGuild), [currentUserWithStatus, myGuild]);

  const radarDataset = useMemo(() => [{
      stats: totalStats,
      color: '#60a5fa',
      fill: 'rgba(59, 130, 246, 0.4)',
  }], [totalStats]);
  // --- End New code for Left Column ---
  
  const filteredItems = useMemo(() => {
    let sorted = [...inventory];

    if (activeTab === 'equipment' && sortBy === 'type') {
        sorted.sort((a, b) => (slotOrder[a.slot as EquipmentSlot] - slotOrder[b.slot as EquipmentSlot]) || (gradeOrder[b.grade] - gradeOrder[a.grade]) || (b.createdAt - a.createdAt));
    } else {
        switch (sortBy) {
            case 'time':
                sorted.sort((a, b) => b.createdAt - a.createdAt);
                break;
            case 'grade':
                sorted.sort((a, b) => (gradeOrder[b.grade] - gradeOrder[a.grade]) || (b.createdAt - a.createdAt));
                break;
            case 'type':
                sorted.sort((a, b) => a.type.localeCompare(b.type) || (gradeOrder[b.grade] - gradeOrder[a.grade]) || (b.createdAt - a.createdAt));
                break;
        }
    }

    if (activeTab === 'all') return sorted;
    return sorted.filter(item => item.type === activeTab);
  }, [inventory, activeTab, sortBy]);

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

  const maxSlots = getSlotMax(activeTab);
  const numEmptySlots = (() => {
    if (activeTab === 'all') {
        const totalMaxSlots = Object.values(inventorySlots).reduce((sum, val) => sum + val, 0);
        return Math.max(0, totalMaxSlots - inventory.length);
    } else {
        return Math.max(0, maxSlots - filteredItems.length);
    }
  })();

  return (
    <DraggableWindow title="가방" onClose={onClose} windowId="inventory" initialWidth={1000} initialHeight={800} isTopmost={isTopmost}>
        <div>Loading Inventory...</div>
    </DraggableWindow>
  );
};

export default InventoryModal;