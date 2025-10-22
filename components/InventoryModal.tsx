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
        {showSavePresetModal && (
            <SavePresetNameModal
                onClose={() => setShowSavePresetModal(false)}
                onSave={handleConfirmSavePreset}
                isTopmost={topmostModalId === 'inventory'}
            />
        )}
        {bulkUseItem && (
            <BulkUseModal
                item={bulkUseItem}
                onClose={() => setBulkUseItem(null)}
                isTopmost={topmostModalId === 'inventory'}
            />
        )}
        <div className="flex flex-col h-full overflow-hidden">
            {/* Top Viewer Section: Fixed height, 3 columns */}
            <div className="h-[500px] flex p-2 gap-2 bg-black/30 rounded-lg mb-2">
                {/* Left Column: Equipped Items & Presets */}
                <div className="w-1/3 flex flex-col p-2 border border-color/20 rounded-md">
                    <h4 className="text-lg font-bold text-white mb-2 text-shadow-sm">장착 장비</h4>
                    <div className="grid grid-cols-3 gap-1 mb-2">
                        {Object.values(EquipmentSlot).map(slot => (
                            <EquipmentSlotDisplay
                                key={slot}
                                slot={slot}
                                item={getItemForSlot(slot)}
                                onClick={() => {
                                    const item = getItemForSlot(slot);
                                    if (item) setSelectedItem(item);
                                }}
                            />
                        ))}
                    </div>
                    <Button onClick={handleUnequipAll} className="mb-2 bg-red-600 hover:bg-red-700" small>
                        모두 해제
                    </Button>
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-md font-bold text-white text-shadow-sm">장비 프리셋</h4>
                        <Button onClick={handleSavePreset} small>저장</Button>
                    </div>
                    <select
                        className="bg-gray-700 text-white text-sm rounded px-2 py-1 mb-2"
                        value={selectedPresetIndex}
                        onChange={(e) => {
                            const newIndex = parseInt(e.target.value);
                            setSelectedPresetIndex(newIndex);
                            handlers.handleAction({ type: 'LOAD_EQUIPMENT_PRESET', payload: { presetIndex: newIndex } });
                        }}
                    >
                        {currentUserWithStatus.equipmentPresets.map((preset, index) => (
                            <option key={index} value={index}>
                                {preset?.name || `프리셋 ${index + 1}`}
                            </option>
                        ))}
                    </select>
                    <h4 className="text-md font-bold text-white mb-1 text-shadow-sm">총 능력치</h4>
                    <div className="flex flex-col gap-0.5 text-sm">
                        {Object.values(CoreStat).map(stat => (
                            <div key={stat} className="flex justify-between">
                                <span className="text-gray-400">{CORE_STATS_DATA[stat].name}:</span>
                                <span className="text-white font-bold">{totalStats[stat]?.toFixed(0) || 0}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Middle Column: Currently Equipped Item */}
                <div className="w-1/3 flex flex-col p-2 border border-color/20 rounded-md">
                    <h4 className="text-lg font-bold text-white mb-2 text-shadow-sm">현재 장착 장비</h4>
                    {selectedItem && selectedItem.type === 'equipment' && equippedItem ? (
                        <DetailedItemDisplay
                            item={equippedItem}
                            isEquipped={true}
                            currentUserLevelSum={(currentUserWithStatus.strategyLevel ?? 1) + (currentUserWithStatus.playfulLevel ?? 1)}
                        />
                    ) : (
                        <p className="text-gray-400 text-center flex-grow flex items-center justify-center">장착된 장비 없음</p>
                    )}
                </div>

                {/* Right Column: Selected Item (with comparison) */}
                <div className="w-1/3 flex flex-col p-2 border border-color/20 rounded-md">
                    <h4 className="text-lg font-bold text-white mb-2 text-shadow-sm">선택된 아이템</h4>
                    {selectedItem ? (
                        <DetailedItemDisplay
                            item={selectedItem}
                            onEquip={() => handlers.handleAction({ type: 'EQUIP_ITEM', payload: { itemId: selectedItem.id, slot: selectedItem.slot } })}
                            onUnequip={() => handlers.handleAction({ type: 'UNEQUIP_ITEM', payload: { itemId: selectedItem.id, slot: selectedItem.slot } })}
                            onUse={() => {
                                if (selectedItem.type === 'consumable' && selectedItem.quantity && selectedItem.quantity > 1) {
                                    setBulkUseItem(selectedItem);
                                } else {
                                    handlers.handleAction({ type: 'USE_ITEM', payload: { itemId: selectedItem.id } });
                                }
                            }}
                            onDisassemble={() => handlers.handleAction({ type: 'DISASSEMBLE_ITEM', payload: { itemId: selectedItem.id } })}
                            onEnhance={() => handlers.openBlacksmith(selectedItem)}
                            onMaterialConvert={() => handlers.handleAction({ type: 'CONVERT_MATERIAL', payload: { itemId: selectedItem.id } })}
                            isEquipped={selectedItem.isEquipped}
                            equippedItem={equippedItem} // Pass equipped item for comparison
                            currentUserLevelSum={(currentUserWithStatus.strategyLevel ?? 1) + (currentUserWithStatus.playfulLevel ?? 1)}
                        />
                    ) : (
                        <p className="text-gray-400 text-center flex-grow flex items-center justify-center">아이템을 선택하여 상세 정보를 확인하세요.</p>
                    )}
                </div>
            </div>

            {/* Bottom Inventory Section: Tabs, Sort, and Item Grid */}
            <div className="flex flex-col flex-grow bg-black/30 rounded-lg p-2">
                {/* Tabs */}
                <div className="flex border-b border-color/20 mb-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`px-4 py-2 text-sm font-medium ${activeTab === tab.id ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-gray-200'}`}
                            onClick={() => {
                                setActiveTab(tab.id);
                                setSelectedItem(null); // Clear selected item when changing tabs
                            }}
                        >
                            {tab.label} ({getSlotCount(tab.id)}/{getSlotMax(tab.id)})
                        </button>
                    ))}
                </div>

                {/* Sort & Filter */}
                <div className="p-2 flex items-center justify-between bg-black/20 rounded-md mb-2">
                    <div className="flex gap-2">
                        <span className="text-sm text-gray-300">정렬:</span>
                        <select
                            className="bg-gray-700 text-white text-sm rounded px-2 py-1"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as 'time' | 'grade' | 'type')}
                        >
                            <option value="time">획득 시간</option>
                            <option value="grade">등급</option>
                            <option value="type">유형</option>
                        </select>
                    </div>
                    <Button small onClick={() => handlers.handleAction({ type: 'EXPAND_INVENTORY_SLOTS', payload: { itemType: activeTab === 'all' ? 'all' : activeTab } })}>슬롯 확장 ({getSlotCount(activeTab)}/{getSlotMax(activeTab)})</Button>
                </div>

                {/* Item Grid */}
                <div className="flex-grow grid grid-cols-15 gap-1 p-2 overflow-y-auto custom-scrollbar">
                    {filteredItems.map(item => (
                        <ItemCard key={item.id} item={item} onClick={() => setSelectedItem(item)} />
                    ))}
                    {Array.from({ length: numEmptySlots }).map((_, index) => (
                        <EmptySlotCard key={`empty-${index}`} />
                    ))}
                    {activeTab !== 'all' && numEmptySlots === 0 && getSlotCount(activeTab) < getSlotMax(activeTab) && (
                        <ExpandSlotCard onClick={() => handlers.handleAction({ type: 'EXPAND_INVENTORY_SLOTS', payload: { itemType: activeTab } })} />
                    )}
                </div>
            </div>
        </div>
    </DraggableWindow>
  );
};

export default InventoryModal;