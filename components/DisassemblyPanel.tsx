import React, { useState, useMemo } from 'react';
import { InventoryItem, InventoryItemType, ItemGrade, EquipmentSlot } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import Button from './Button';
import InventoryPanel from './InventoryPanel';
import DisassemblyResultModal from './DisassemblyResultModal';
import { MATERIAL_ITEMS } from '../constants';
import { gradeStyles } from '../utils/itemDisplayUtils';

interface DisassemblyPanelProps {
    selectedItem: InventoryItem | null;
    onSelectItem: (item: InventoryItem | null) => void;
}

const DisassemblyPanel: React.FC<DisassemblyPanelProps> = ({ selectedItem, onSelectItem }) => {
    const { currentUserWithStatus, handlers, modals } = useAppContext();

    const canDisassemble = useMemo(() => {
        return selectedItem && selectedItem.type === 'equipment' && !selectedItem.isEquipped;
    }, [selectedItem]);

    const handleDisassemble = () => {
        if (!selectedItem) return;
        handlers.handleAction({ type: 'DISASSEMBLE_ITEM', payload: { itemId: selectedItem.id } });
        onSelectItem(null); // Clear selected item after disassembly
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
        <div className="h-full flex flex-col p-4">
            {modals.disassemblyResult && (
                <DisassemblyResultModal
                    result={modals.disassemblyResult}
                    onClose={handlers.closeDisassemblyResult}
                    isTopmost={topmostModalId === 'disassemblyResult'}
                />
            )}
            <div className="flex-grow flex flex-col items-center justify-center bg-gray-900/40 p-4 rounded-lg">
                {selectedItem ? (
                    <div className="text-center w-full">
                        <div className="relative w-24 h-24 flex-shrink-0 rounded-md border-2 border-color/50 bg-tertiary/50 mx-auto mb-2">
                            <img src={gradeStyles[selectedItem.grade].background} alt={selectedItem.grade} className="absolute inset-0 w-full h-full object-cover rounded-sm" />
                            <img src={selectedItem.image || '/images/equipments/empty.png'} alt={selectedItem.name} className="relative w-full h-full object-contain p-1" />
                        </div>
                        <h3 className={`font-bold text-lg ${gradeStyles[selectedItem.grade].text}`}>{selectedItem.name}</h3>
                        <p className="text-gray-400 text-sm">+{selectedItem.stars} 강화</p>

                        <div className="mt-4 p-3 bg-gray-800/50 rounded-lg text-xs space-y-2">
                            <h4 className="font-bold text-center text-yellow-300 mb-2">예상 획득 재료</h4>
                            {getExpectedMaterials.length > 0 ? (
                                <div className="space-y-1">
                                    {getExpectedMaterials.map((mat, index) => (
                                        <div key={index} className="flex items-center justify-between gap-2 text-primary text-sm">
                                            <span className="flex items-center gap-1">
                                                <img src={mat.image} alt={mat.name} className="w-4 h-4" />
                                                {mat.name}
                                            </span>
                                            <span>x {mat.quantity}</span>
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
                            className="mt-4 w-full py-2 text-base"
                        >
                            {canDisassemble ? '분해하기' : '장착 해제 후 분해 가능'}
                        </Button>
                    </div>
                ) : (
                    <p className="text-gray-400 text-lg">분해할 장비를 선택해주세요.</p>
                )}
            </div>
        </div>
    );
};

export default DisassemblyPanel;