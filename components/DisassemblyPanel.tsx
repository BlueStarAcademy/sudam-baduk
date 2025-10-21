import React, { useState, useMemo } from 'react';
import { InventoryItem, InventoryItemType, ItemGrade, EquipmentSlot } from '../types/index.js';
import { useAppContext } from '../hooks/useAppContext.js';
import Button from './Button.js';
import InventoryPanel from './InventoryPanel.js';
import DisassemblyResultModal from './DisassemblyResultModal.js';
import { MATERIAL_ITEMS } from '../constants/index.js';

const DisassemblyPanel: React.FC = () => {
    const { currentUserWithStatus, handlers, modals } = useAppContext();
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [sortBy, setSortBy] = useState<'time' | 'grade' | 'type'>('time');

    const canDisassemble = useMemo(() => {
        return selectedItem && selectedItem.type === 'equipment' && !selectedItem.isEquipped;
    }, [selectedItem]);

    const handleDisassemble = () => {
        if (!selectedItem) return;
        handlers.handleAction({ type: 'DISASSEMBLE_ITEM', payload: { itemId: selectedItem.id } });
        setSelectedItem(null);
    };

    const getExpectedMaterials = useMemo(() => {
        if (!selectedItem || selectedItem.type !== 'equipment') return [];

        const materials: { name: string; quantity: number; image: string; }[] = [];
        const baseQuantity = 1; // Base quantity for disassembly

        // Add materials based on item grade
        switch (selectedItem.grade) {
            case ItemGrade.Normal:
                materials.push({ name: '하급 강화석', quantity: baseQuantity * 2, image: MATERIAL_ITEMS['하급 강화석'].image! });
                break;
            case ItemGrade.Uncommon:
                materials.push({ name: '하급 강화석', quantity: baseQuantity * 3, image: MATERIAL_ITEMS['하급 강화석'].image! });
                materials.push({ name: '중급 강화석', quantity: baseQuantity * 1, image: MATERIAL_ITEMS['중급 강화석'].image! });
                break;
            case ItemGrade.Rare:
                materials.push({ name: '중급 강화석', quantity: baseQuantity * 2, image: MATERIAL_ITEMS['중급 강화석'].image! });
                materials.push({ name: '상급 강화석', quantity: baseQuantity * 1, image: MATERIAL_ITEMS['상급 강화석'].image! });
                break;
            case ItemGrade.Epic:
                materials.push({ name: '상급 강화석', quantity: baseQuantity * 2, image: MATERIAL_ITEMS['상급 강화석'].image! });
                materials.push({ name: '최상급 강화석', quantity: baseQuantity * 1, image: MATERIAL_ITEMS['최상급 강화석'].image! });
                break;
            case ItemGrade.Legendary:
                materials.push({ name: '최상급 강화석', quantity: baseQuantity * 2, image: MATERIAL_ITEMS['최상급 강화석'].image! });
                materials.push({ name: '신비의 강화석', quantity: baseQuantity * 1, image: MATERIAL_ITEMS['신비의 강화석'].image! });
                break;
            case ItemGrade.Mythic:
                materials.push({ name: '신비의 강화석', quantity: baseQuantity * 2, image: MATERIAL_ITEMS['신비의 강화석'].image! });
                break;
        }

        // Add materials based on enhancement level
        if (selectedItem.stars > 0) {
            const bonusMaterial = selectedItem.stars >= 5 ? '최상급 강화석' : '상급 강화석';
            const existingMaterial = materials.find(m => m.name === bonusMaterial);
            if (existingMaterial) {
                existingMaterial.quantity += Math.floor(selectedItem.stars / 2);
            } else {
                materials.push({ name: bonusMaterial, quantity: Math.floor(selectedItem.stars / 2), image: MATERIAL_ITEMS[bonusMaterial].image! });
            }
        }

        return materials;
    }, [selectedItem]);

    if (!currentUserWithStatus) return null;

    return (
        <div className="h-full flex flex-col">
            {modals.disassemblyResult && (
                <DisassemblyResultModal
                    result={modals.disassemblyResult}
                    onClose={handlers.closeDisassemblyResult}
                    isTopmost={modals.topmostModalId === 'disassemblyResult'}
                />
            )}
            <div className="flex-grow flex flex-row gap-4">
                {/* Left Panel: Selected Item Details */}
                <div className="w-1/2 bg-gray-900/40 p-4 rounded-lg flex flex-col items-center justify-center">
                    {selectedItem ? (
                        <div className="text-center">
                            <img src={selectedItem.image || '/images/equipments/empty.png'} alt={selectedItem.name} className="w-32 h-32 object-contain mx-auto mb-2" />
                            <h3 className={`font-bold text-xl ${ItemGrade[selectedItem.grade]}`}>{selectedItem.name}</h3>
                            <p className="text-gray-400 text-sm">{selectedItem.description}</p>
                            <div className="mt-4">
                                <h4 className="font-bold text-lg text-yellow-300 mb-2">예상 획득 재료</h4>
                                {getExpectedMaterials.length > 0 ? (
                                    <div className="space-y-2">
                                        {getExpectedMaterials.map((mat, index) => (
                                            <div key={index} className="flex items-center justify-center gap-2 text-primary text-base">
                                                <img src={mat.image} alt={mat.name} className="w-6 h-6" />
                                                <span>{mat.name} x {mat.quantity}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500">분해 시 획득하는 재료가 없습니다.</p>
                                )}
                            </div>
                            <Button
                                onClick={handleDisassemble}
                                disabled={!canDisassemble}
                                colorScheme="red"
                                className="mt-4 w-full"
                            >
                                {canDisassemble ? '분해하기' : '장착 해제 후 분해 가능'}
                            </Button>
                        </div>
                    ) : (
                        <p className="text-gray-400 text-lg">분해할 장비를 선택해주세요.</p>
                    )}
                </div>

                {/* Right Panel: Inventory for selection */}
                <div className="w-1/2 flex flex-col">
                    <InventoryPanel
                        items={currentUserWithStatus.inventory}
                        selectedItems={selectedItem ? [selectedItem] : []}
                        onSelectItem={setSelectedItem}
                        itemTypeFilter="equipment"
                        title="분해할 장비 선택"
                        sortBy={sortBy}
                        onSortByChange={setSortBy}
                    />
                </div>
            </div>
        </div>
    );
};

export default DisassemblyPanel;