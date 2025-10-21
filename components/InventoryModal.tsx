import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import { InventoryItem, InventoryItemType, ItemGrade, EquipmentSlot, CoreStat, ItemOption, ItemOptions, SpecialStat, MythicStat, UserWithStatus } from '../types/index.js';
import { GRADE_LEVEL_REQUIREMENTS, emptySlotImages, CORE_STATS_DATA, SPECIAL_STATS_DATA, MYTHIC_STATS_DATA } from '../constants/index.js';
import { gradeStyles, getStarDisplayInfo } from '../utils/itemDisplayUtils';
import { calculateTotalStats } from '../utils/statUtils';
import BulkUseModal from './BulkUseModal.js';
import RadarChart from './RadarChart.js'; // Added this import

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
                <img src={gradeBackgrounds[item.grade]} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-sm" />
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
            <img src={gradeBackgrounds[item.grade]} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-sm" />
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


import DetailedItemDisplay from './DetailedItemDisplay.js';

import SavePresetNameModal from './SavePresetNameModal.js';



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
        {bulkUseItem && (
            <BulkUseModal
                item={bulkUseItem}
                currentUserGold={currentUserWithStatus.gold}
                currentUserDiamonds={currentUserWithStatus.diamonds}
                onClose={() => setBulkUseItem(null)}
                onAction={handlers.handleAction}
                isTopmost={topmostModalId === `bulk-use-${bulkUseItem.id}`}
            />
        )}

        {showSavePresetModal && (
            <SavePresetNameModal
                defaultPresetName={currentUserWithStatus.equipmentPresets[selectedPresetIndex]?.name || `프리셋 ${selectedPresetIndex + 1}`}
                onClose={() => setShowSavePresetModal(false)}
                onSave={handleConfirmSavePreset}
            />
        )}

      <div className="h-full flex flex-col overflow-hidden">
          {/* Top Viewer Section */}
          <div className="flex-shrink-0 bg-tertiary/50 p-2 rounded-lg mb-2" style={{ height: '420px' }}>
              {selectedItem ? (
                  selectedItem.type === 'equipment' ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 h-full">
                          {/* Left Column: Equipped items + Radar Chart */}
                          <div className="flex flex-col bg-tertiary/50 p-2 rounded-lg flex-1 min-h-0">
                              <h4 className="font-bold text-primary mb-2 flex-shrink-0">장착 장비</h4>
                              <div className="grid grid-cols-3 gap-1 mb-2 flex-shrink-0">
                                  {([
                                      EquipmentSlot.Fan,
                                      EquipmentSlot.Top,
                                      EquipmentSlot.Bottom,
                                      EquipmentSlot.Board,
                                      EquipmentSlot.Bowl,
                                      EquipmentSlot.Stones,
                                  ] as EquipmentSlot[]).map(slot => (
                                      <EquipmentSlotDisplay
                                          key={slot}
                                          slot={slot}
                                          item={getItemForSlot(slot)}
                                          onClick={() => {
                                              const item = getItemForSlot(slot);
                                              if (item) setSelectedItem(item); // Allow selecting equipped item
                                          }}
                                      />
                                  ))}
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-2">
                                  {Object.values(CoreStat).map(stat => {
                                      const baseValue = currentUserWithStatus.baseStats[stat] || 0;
                                      const totalValue = totalStats[stat] || 0;
                                      const diff = totalValue - baseValue;
                                      return (
                                          <div key={stat} className="flex items-center justify-between">
                                              <span className="text-tertiary">{CORE_STATS_DATA[stat].name}:</span>
                                              <span className="font-bold text-primary">
                                                  {totalValue}
                                                  {diff !== 0 && (
                                                      <span className={`ml-1 ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                          ({diff > 0 ? '+' : ''}{diff})
                                                      </span>
                                                  )}
                                              </span>
                                          </div>
                                      );
                                  })}
                              </div>
                              <div className="w-full mt-auto pt-2 border-t border-gray-700">
                                  <select
                                      value={selectedPresetIndex}
                                      onChange={(e) => setSelectedPresetIndex(Number(e.target.value))}
                                      className="w-full bg-secondary border border-color rounded-md p-1 text-xs font-semibold text-primary hover:bg-tertiary transition-colors mb-2"
                                  >
                                      {currentUserWithStatus.equipmentPresets.map((preset, index) => (
                                          <option key={index} value={index}>{preset.name}</option>
                                      ))}
                                  </select>
                                  <div className="flex gap-2">
                                      <Button onClick={handleSavePreset} colorScheme="green" className="flex-1 !text-xs !py-1">저장</Button>
                                      <Button onClick={handleUnequipAll} colorScheme="red" className="flex-1 !text-xs !py-1">모두 해제</Button>
                                  </div>
                              </div>
  
                          </div>

                          {/* Middle Column: Currently equipped item in selected slot */}
                          <div className="flex flex-col bg-tertiary/50 p-2 rounded-lg">
                              <h4 className="font-bold text-primary mb-2">현재 장착</h4>
                              <div className="flex-grow flex items-center justify-center">
                                  {selectedItem.slot && equippedItem ? (
                                      <DetailedItemDisplay item={equippedItem} isEquippedItem={true} />
                                  ) : (
                                      <p className="text-center text-tertiary text-sm">장착된 아이템 없음</p>
                                  )}
                              </div>
                          </div>

                          {/* Right Column: Selected item with comparison */}
                          <div className="flex flex-col bg-tertiary/50 p-2 rounded-lg">
                              <h4 className="font-bold text-primary mb-2 flex-shrink-0">선택 장비</h4>
                              <div className="flex-grow overflow-y-auto">
                                  <DetailedItemDisplay item={selectedItem} equippedItem={equippedItem} />
                              </div>
                              <div className="flex-shrink-0 flex items-center justify-center gap-2 mt-auto p-2">
                                  {selectedItem.type === 'equipment' && (
                                      <>
                                          <button onClick={() => handlers.openBlacksmith(selectedItem)} className="w-12 h-12 p-1 hover:bg-white/10 rounded-md"><img src="/images/button/enhance.png" alt="강화" /></button>
                                          {selectedItem.isEquipped ? (
                                              <Button onClick={() => handlers.handleAction({ type: 'TOGGLE_EQUIP_ITEM', payload: { itemId: selectedItem.id } })} colorScheme="red" className="!text-sm !py-2">해제</Button>
                                          ) : (
                                              <Button onClick={() => handlers.handleAction({ type: 'TOGGLE_EQUIP_ITEM', payload: { itemId: selectedItem.id } })} colorScheme="green" className="!text-sm !py-2">장착</Button>
                                          )}
                                      </>
                                  )}
                                  <Button onClick={() => setSelectedItem(null)} colorScheme="gray" className="!text-sm !py-2">닫기</Button>
                              </div>
                          </div>
                      </div>
                  ) : (
                      // Centered display for non-equipment items
                      <div className="flex flex-col h-full items-center justify-center text-center">
                          <div className="relative w-24 h-24">
                              <img src={gradeBackgrounds[selectedItem.grade]} alt={selectedItem.grade} className="absolute inset-0 w-full h-full object-cover rounded-md" />
                              {renderStarDisplay(selectedItem.stars)}
                              {selectedItem.image && <img src={selectedItem.image} alt={selectedItem.name} className="relative w-full h-full object-contain p-2" />}
                          </div>
                          <h3 className="font-bold text-primary text-xl mt-2">{selectedItem.name}</h3>
                          <ItemActionGuide item={selectedItem} />

                          <div className="flex items-center justify-center gap-2 mt-4">
                              {selectedItem.type === 'consumable' && (
                                  <>
                                      <Button onClick={() => handlers.handleAction({ type: 'USE_ITEM', payload: { itemId: selectedItem.id } })} colorScheme="green" className="!text-sm !py-2">사용</Button>
                                      <Button onClick={() => setBulkUseItem(selectedItem)} colorScheme="blue" className="!text-sm !py-2">일괄 사용</Button>
                                  </>
                              )}
                              {selectedItem.type === 'material' && (
                                  <button onClick={() => handlers.openBlacksmith(selectedItem)} className="w-12 h-12 p-1 hover:bg-white/10 rounded-md"><img src="/images/button/enhance.png" alt="대장간" /></button>
                              )}
                              <Button onClick={() => setSelectedItem(null)} colorScheme="gray" className="!text-sm !py-2">닫기</Button>
                          </div>
                      </div>
                  )
              ) : (
                  <p className="text-center text-tertiary flex items-center justify-center h-full">아이템을 선택하여 상세 정보를 확인하세요.</p>
              )}
          </div>

          {/* Bottom Inventory Section */}
          <div className="flex-shrink-0 flex flex-col flex-grow min-h-0">
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
                  <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'time' | 'grade' | 'type')}
                      className="bg-secondary border border-color rounded-md p-1 text-xs font-semibold text-primary hover:bg-tertiary transition-colors ml-2"
                  >
                      <option value="time">획득순</option>
                      <option value="grade">등급별</option>
                      <option value="type">종류별</option>
                  </select>
              </div>
              
              <div className="flex-grow overflow-y-auto pr-2">
              <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(15, 1fr)' }}>
                      {filteredItems.map(item => (
                          <ItemCard key={item.id} item={item} onClick={() => setSelectedItem(item)} />
                      ))}
                      {Array.from({ length: numEmptySlots }).map((_, index) => (
                          <EmptySlotCard key={`empty-${index}`} />
                      ))}
                      {activeTab !== 'all' && <ExpandSlotCard onClick={() => handlers.handleAction({ type: 'EXPAND_INVENTORY', payload: { tab: activeTab } })} />}
                  </div>
              </div>
          </div>
      </div>
    </DraggableWindow>
  );
};

export default InventoryModal;