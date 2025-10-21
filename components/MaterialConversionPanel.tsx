import React, { useState, useMemo } from 'react';
import { InventoryItem, ItemGrade } from '../types/index.js';
import { useAppContext } from '../hooks/useAppContext.js';
import Button from './Button.js';
import InventoryPanel from './InventoryPanel.js';
import { MATERIAL_ITEMS } from '../constants/index.js';

interface MaterialConversionPanelProps {
    // No specific props needed for now
}

const MaterialConversionPanel: React.FC<MaterialConversionPanelProps> = () => {
    const { currentUserWithStatus, handlers } = useAppContext();
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [conversionType, setConversionType] = useState<'upgrade' | 'downgrade' | null>(null);
    const [sortBy, setSortBy] = useState<'time' | 'grade' | 'type'>('time');

    const materialTiers = useMemo(() => [
        MATERIAL_ITEMS['하급 강화석'],
        MATERIAL_ITEMS['중급 강화석'],
        MATERIAL_ITEMS['상급 강화석'],
        MATERIAL_ITEMS['최상급 강화석'],
        MATERIAL_ITEMS['신비의 강화석'],
    ], []);

    const selectedMaterialInfo = useMemo(() => {
        if (!selectedItem || selectedItem.type !== 'material') return null;
        const tierIndex = materialTiers.findIndex(mat => mat.name === selectedItem.name);
        if (tierIndex === -1) return null;
        return { tierIndex, material: materialTiers[tierIndex] };
    }, [selectedItem, materialTiers]);

    const canUpgrade = useMemo(() => {
        if (!selectedMaterialInfo) return false;
        const { tierIndex, material } = selectedMaterialInfo;
        if (tierIndex >= materialTiers.length - 1) return false; // Already highest tier
        return material.quantity >= 10; // Need 10 of current material to upgrade
    }, [selectedMaterialInfo, materialTiers]);

    const canDowngrade = useMemo(() => {
        if (!selectedMaterialInfo) return false;
        const { tierIndex } = selectedMaterialInfo;
        return tierIndex > 0; // Can downgrade if not lowest tier
    }, [selectedMaterialInfo]);

    const handleConvert = () => {
        if (!selectedItem || !conversionType) return;
        handlers.handleAction({
            type: 'CRAFT_MATERIAL',
            payload: {
                itemId: selectedItem.id,
                conversionType: conversionType,
            },
        });
        setSelectedItem(null);
        setConversionType(null);
    };

    if (!currentUserWithStatus) return null;

    return (
        <div className="h-full flex flex-col lg:flex-row gap-4 p-4">
            {/* Left Panel: Selected Material Details */}
            <div className="w-full lg:w-1/2 flex flex-col bg-tertiary/50 p-4 rounded-lg">
                <h3 className="text-lg font-bold text-primary mb-4">선택 재료</h3>
                <div className="flex-grow flex items-center justify-center">
                    {selectedItem ? (
                        <div className="text-center">
                            <img src={selectedItem.image || '/images/materials/empty.png'} alt={selectedItem.name} className="w-32 h-32 object-contain mx-auto mb-2" />
                            <h3 className={`font-bold text-xl ${ItemGrade[selectedItem.grade]}`}>{selectedItem.name}</h3>
                            <p className="text-gray-400 text-sm">수량: {selectedItem.quantity}</p>
                            
                            {selectedMaterialInfo && (
                                <div className="mt-4 space-y-2">
                                    {canUpgrade && (
                                        <div className="flex items-center justify-center gap-2 text-primary text-base">
                                            <span>{selectedMaterialInfo.material.name} x10</span>
                                            <span className="text-lg font-bold">→</span>
                                            <span>{materialTiers[selectedMaterialInfo.tierIndex + 1].name} x1</span>
                                            <Button onClick={() => setConversionType('upgrade')} disabled={!canUpgrade} colorScheme="blue" className="!text-xs !py-1">상위 변환</Button>
                                        </div>
                                    )}
                                    {canDowngrade && (
                                        <div className="flex items-center justify-center gap-2 text-primary text-base">
                                            <span>{selectedMaterialInfo.material.name} x1</span>
                                            <span className="text-lg font-bold">→</span>
                                            <span>{materialTiers[selectedMaterialInfo.tierIndex - 1].name} x5</span>
                                            <Button onClick={() => setConversionType('downgrade')} disabled={!canDowngrade} colorScheme="orange" className="!text-xs !py-1">하위 변환</Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {conversionType && (
                                <Button
                                    onClick={handleConvert}
                                    colorScheme="green"
                                    className="mt-4 w-full"
                                >
                                    변환 확인
                                </Button>
                            )}
                        </div>
                    ) : (
                        <p className="text-gray-400 text-lg">변환할 재료를 선택해주세요.</p>
                    )}
                </div>
            </div>

            {/* Right Panel: Inventory for selection */}
            <div className="w-full lg:w-1/2 flex flex-col">
                <InventoryPanel
                    items={currentUserWithStatus.inventory}
                    selectedItems={selectedItem ? [selectedItem] : []}
                    onSelectItem={setSelectedItem}
                    itemTypeFilter="material"
                    title="변환할 재료 선택"
                    sortBy={sortBy}
                    onSortByChange={setSortBy}
                />
            </div>
        </div>
    );
};

export default MaterialConversionPanel;