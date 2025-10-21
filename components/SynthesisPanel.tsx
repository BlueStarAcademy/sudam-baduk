import React, { useState, useMemo } from 'react';
import { InventoryItem, ItemGrade, EquipmentSlot } from '../types/index.js';
import { useAppContext } from '../hooks/useAppContext.js';
import Button from './Button.js';
import InventoryPanel from './InventoryPanel.js';
import SynthesisResultModal from './SynthesisResultModal.js';
import DetailedItemDisplay from './DetailedItemDisplay.js';
import { SYNTHESIS_COSTS, SYNTHESIS_LEVEL_BENEFITS } from '../constants/index.js';

interface SynthesisPanelProps {
    // No specific props needed for now
}

const SynthesisPanel: React.FC<SynthesisPanelProps> = () => {
    const { currentUserWithStatus, handlers, modals } = useAppContext();
    const [selectedItems, setSelectedItems] = useState<InventoryItem[]>([]);
    const [sortBy, setSortBy] = useState<'time' | 'grade' | 'type'>('time');

    const synthesisLevel = currentUserWithStatus?.synthesisLevel || 1;
    const synthesisBenefit = SYNTHESIS_LEVEL_BENEFITS[synthesisLevel];

    const canSynthesize = useMemo(() => {
        if (selectedItems.length !== 3) return false;
        const firstItem = selectedItems[0];
        if (firstItem.type !== 'equipment') return false; // Only equipment can be synthesized

        // All items must be of the same grade and type
        const allSameGrade = selectedItems.every(item => item.grade === firstItem.grade);
        const allSameType = selectedItems.every(item => item.slot === firstItem.slot);
        if (!allSameGrade || !allSameType) return false;

        // Cannot synthesize Mythic grade items
        if (firstItem.grade === ItemGrade.Mythic) return false;

        // Check if the grade is synthesizable at current level
        if (!synthesisBenefit.synthesizableGrades.includes(firstItem.grade)) return false;

        const cost = SYNTHESIS_COSTS[firstItem.grade];
        if (currentUserWithStatus && currentUserWithStatus.gold < cost) return false;

        return true;
    }, [selectedItems, currentUserWithStatus, synthesisBenefit]);

    const handleSynthesize = () => {
        if (!canSynthesize) return;
        handlers.handleAction({ type: 'SYNTHESIZE_EQUIPMENT', payload: { itemIds: selectedItems.map(item => item.id) } });
        setSelectedItems([]);
    };

    const toggleSelectItem = (item: InventoryItem) => {
        setSelectedItems(prev => {
            if (prev.some(si => si.id === item.id)) {
                return prev.filter(si => si.id !== item.id);
            } else if (prev.length < 3) {
                return [...prev, item];
            }
            return prev;
        });
    };

    const selectedGrade = selectedItems.length > 0 ? selectedItems[0].grade : null;
    const synthesisCost = selectedGrade ? SYNTHESIS_COSTS[selectedGrade] : 0;

    if (!currentUserWithStatus) return null;

    return (
        <div className="h-full flex flex-col lg:flex-row gap-4 p-4">
            {modals.synthesisResult && (
                <SynthesisResultModal
                    result={modals.synthesisResult}
                    onClose={handlers.closeSynthesisResult}
                    isTopmost={modals.topmostModalId === 'synthesisResult'}
                />
            )}

            {/* Left Panel: Selected Items for Synthesis */}
            <div className="w-full lg:w-1/2 flex flex-col bg-tertiary/50 p-4 rounded-lg">
                <h3 className="text-lg font-bold text-primary mb-4">합성할 장비 선택 (3개)</h3>
                <div className="flex-grow grid grid-cols-3 gap-2 items-center justify-center">
                    {Array.from({ length: 3 }).map((_, index) => (
                        selectedItems[index] ? (
                            <DetailedItemDisplay key={selectedItems[index].id} item={selectedItems[index]} />
                        ) : (
                            <div key={index} className="w-full aspect-square rounded-md bg-gray-700/50 flex items-center justify-center text-gray-400 text-sm">
                                슬롯 비어있음
                            </div>
                        )
                    ))}
                </div>
                
                {selectedItems.length === 3 && selectedGrade && (
                    <div className="mt-4 p-3 bg-gray-800/50 rounded-lg text-sm space-y-2">
                        <div className="flex justify-between">
                            <span className="text-gray-300">합성 등급:</span>
                            <span className={`font-bold ${ItemGrade[selectedGrade]}`}>{selectedGrade}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-300">합성 비용:</span>
                            <span className="font-bold text-yellow-300">{synthesisCost.toLocaleString()} 골드</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-300">성공 확률:</span>
                            <span className="font-bold text-green-400">{synthesisBenefit.upgradeChance[selectedGrade] || 0}%</span>
                        </div>
                        {selectedGrade === ItemGrade.Legendary && (
                            <div className="flex justify-between">
                                <span className="text-gray-300">신화 더블옵션 확률:</span>
                                <span className="font-bold text-purple-400">{synthesisBenefit.doubleMythicChance}%</span>
                            </div>
                        )}
                    </div>
                )}

                <Button
                    onClick={handleSynthesize}
                    disabled={!canSynthesize}
                    colorScheme="blue"
                    className="w-full mt-4"
                >
                    장비 합성
                </Button>
            </div>

            {/* Right Panel: Inventory for selection */}
            <div className="w-full lg:w-1/2 flex flex-col">
                <InventoryPanel
                    items={currentUserWithStatus.inventory.filter(item => item.type === 'equipment' && !item.isEquipped)}
                    selectedItems={selectedItems}
                    onSelectItem={toggleSelectItem}
                    itemTypeFilter="equipment"
                    title="합성 재료 선택"
                    sortBy={sortBy}
                    onSortByChange={setSortBy}
                />
            </div>
        </div>
    );
};

export default SynthesisPanel;
