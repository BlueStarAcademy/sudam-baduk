import React, { useState, useMemo } from 'react';
import { InventoryItem, ItemGrade, EquipmentSlot } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import Button from './Button';
import SynthesisResultModal from './SynthesisResultModal';
import { SYNTHESIS_COSTS, SYNTHESIS_LEVEL_BENEFITS, slotNames } from '../constants';

interface SynthesisPanelProps {
    selectedItems: InventoryItem[];
    onSelectItem: (item: InventoryItem) => void;
}

const SynthesisPanel: React.FC<SynthesisPanelProps> = ({ selectedItems, onSelectItem }) => {
    const { currentUserWithStatus, handlers, modals } = useAppContext();

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

    const synthesisOutcomeProbabilities = useMemo(() => {
        if (selectedItems.length !== 3) return [];

        const slotCounts: Record<EquipmentSlot, number> = {
            [EquipmentSlot.Fan]: 0,
            [EquipmentSlot.Board]: 0,
            [EquipmentSlot.Top]: 0,
            [EquipmentSlot.Bottom]: 0,
            [EquipmentSlot.Bowl]: 0,
            [EquipmentSlot.Stones]: 0,
        };

        selectedItems.forEach(item => {
            if (item.slot) {
                slotCounts[item.slot]++;
            }
        });

        const probabilities: { slotName: string; probability: number }[] = [];
        let totalProbability = 0;

        for (const slot in slotCounts) {
            const count = slotCounts[slot as EquipmentSlot];
            if (count > 0) {
                const probability = Math.floor((count / 3) * 100);
                probabilities.push({ slotName: slotNames[slot as EquipmentSlot], probability });
                totalProbability += probability;
            }
        }

        // Adjust for rounding errors if necessary
        if (totalProbability !== 100 && probabilities.length > 0) {
            const diff = 100 - totalProbability;
            probabilities[0].probability += diff;
        }

        return probabilities;
    }, [selectedItems]);

    const handleSynthesize = () => {
        if (!canSynthesize) return;
        handlers.handleAction({ type: 'SYNTHESIZE_EQUIPMENT', payload: { itemIds: selectedItems.map(item => item.id) } });
        onSelectItem(selectedItems[0]); // Clear selected items after synthesis
    };

    const selectedGrade = selectedItems.length > 0 ? selectedItems[0].grade : null;
    const synthesisCost = selectedGrade ? SYNTHESIS_COSTS[selectedGrade] : 0;

    if (!currentUserWithStatus) return null;

    return (
        <div className="h-full flex flex-col p-4">
            {modals.synthesisResult && (
                <SynthesisResultModal
                    result={modals.synthesisResult}
                    onClose={handlers.closeSynthesisResult}
                    isTopmost={modals.topmostModalId === 'synthesisResult'}
                />
            )}

            <div className="flex-grow flex flex-col bg-tertiary/50 p-4 rounded-lg">
                <h3 className="text-lg font-bold text-primary mb-4 text-center">합성할 장비 선택 (3개)</h3>
                <div className="flex justify-center gap-2 mb-4">
                    {Array.from({ length: 3 }).map((_, index) => (
                        selectedItems[index] ? (
                            <div key={selectedItems[index].id} className="relative w-20 h-20 rounded-md border-2 border-color/50 bg-gray-700/50 flex items-center justify-center">
                                <img src={selectedItems[index].image} alt={selectedItems[index].name} className="w-full h-full object-contain p-1" />
                                <span className="absolute bottom-0 right-0 text-xs font-bold text-white bg-black/60 px-1 rounded-tl-md">{selectedItems[index].quantity || 1}</span>
                            </div>
                        ) : (
                            <div key={index} className="w-20 h-20 rounded-md border-2 border-color/50 bg-gray-700/50 flex items-center justify-center text-gray-400 text-xs">
                                슬롯 비어있음
                            </div>
                        )
                    ))}
                </div>

                {selectedItems.length === 3 && selectedGrade && (
                    <div className="space-y-3 flex-grow">
                        <div className="bg-gray-900/50 p-3 rounded-lg text-xs space-y-1">
                            <h4 className="font-bold text-center text-blue-300 mb-2">합성 결과 예측</h4>
                            {synthesisOutcomeProbabilities.length > 0 ? (
                                synthesisOutcomeProbabilities.map((outcome, index) => (
                                    <div key={index} className="flex justify-between">
                                        <span>{outcome.slotName}:</span>
                                        <span className="font-bold text-blue-400">{outcome.probability}%</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-500 text-center">합성 가능한 조합이 아닙니다.</p>
                            )}
                        </div>

                        <div className="bg-gray-900/50 p-3 rounded-lg text-xs space-y-1">
                            <h4 className="font-bold text-center text-yellow-300 mb-2">합성 상세</h4>
                            <div className="flex justify-between">
                                <span>합성 등급:</span>
                                <span className={`font-bold ${gradeStyles[selectedGrade].text}`}>{selectedGrade}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>합성 비용:</span>
                                <span className="font-bold text-yellow-300">{synthesisCost.toLocaleString()} 골드</span>
                            </div>
                            <div className="flex justify-between">
                                <span>성공 확률:</span>
                                <span className="font-bold text-green-400">{synthesisBenefit.upgradeChance[selectedGrade] || 0}%</span>
                            </div>
                            {selectedGrade === ItemGrade.Legendary && (
                                <div className="flex justify-between">
                                    <span>신화 더블옵션 확률:</span>
                                    <span className="font-bold text-purple-400">{synthesisBenefit.doubleMythicChance}%</span>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex-grow flex items-center justify-center">
                        <p className="text-gray-400 text-lg">합성할 장비를 3개 선택해주세요.</p>
                    </div>
                )}

                <Button
                    onClick={handleSynthesize}
                    disabled={!canSynthesize}
                    colorScheme="blue"
                    className="w-full py-2 mt-4 text-base"
                >
                    장비 합성
                </Button>
            </div>
        </div>
    );
};

export default SynthesisPanel;
