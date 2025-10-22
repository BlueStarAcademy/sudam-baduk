import React, { useState, useMemo } from 'react';
import { InventoryItem, ItemGrade } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import Button from './Button';
import InventoryPanel from './InventoryPanel';
import { MATERIAL_ITEMS } from '../constants';
import { gradeStyles } from '../utils/itemDisplayUtils';

interface MaterialConversionPanelProps {
    // No specific props needed for now
}

const MaterialConversionPanel: React.FC<MaterialConversionPanelProps> = () => {
    const { currentUserWithStatus, handlers } = useAppContext();

    const materialTiers = useMemo(() => [
        MATERIAL_ITEMS['하급 강화석'],
        MATERIAL_ITEMS['중급 강화석'],
        MATERIAL_ITEMS['상급 강화석'],
        MATERIAL_ITEMS['최상급 강화석'],
        MATERIAL_ITEMS['신비의 강화석'],
    ], []);

    if (!currentUserWithStatus) return null;

    const handleConvert = (materialName: string, type: 'upgrade' | 'downgrade') => {
        console.log(`Converting ${materialName} (${type})`);
        // TODO: Implement actual conversion logic using handlers.convertMaterial
    };

    return (
        <div className="h-full flex flex-col p-4">
            <div className="flex-grow flex flex-col bg-tertiary/50 p-4 rounded-lg">
                <h3 className="text-lg font-bold text-primary mb-4 text-center">재료 변환</h3>
                
                <div className="flex-grow flex items-center justify-center">
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                        {materialTiers.map((material, index) => (
                            <React.Fragment key={material.name}>
                                <div className="flex flex-col items-center w-24">
                                    <img src={material.image} alt={material.name} className="w-16 h-16 object-contain" />
                                    <span className={`text-sm font-bold ${gradeStyles[material.grade].text}`}>{material.name}</span>
                                    <span className="text-xs text-gray-400">보유: {currentUserWithStatus.inventory.find(item => item.name === material.name)?.quantity || 0}</span>
                                </div>
                                {index < materialTiers.length - 1 && (
                                    <div className="flex flex-col items-center gap-1">
                                        <Button 
                                            onClick={() => handleConvert(material.name, 'upgrade')}
                                            disabled={!currentUserWithStatus.inventory.find(item => item.name === material.name) || (currentUserWithStatus.inventory.find(item => item.name === material.name)?.quantity || 0) < 10}
                                            colorScheme="blue" className="!py-1 !px-2 text-xs"
                                        >
                                            <span className="text-lg">↑</span> 10:1
                                        </Button>
                                        <Button 
                                            onClick={() => handleConvert(materialTiers[index + 1].name, 'downgrade')}
                                            disabled={!currentUserWithStatus.inventory.find(item => item.name === materialTiers[index + 1].name) || (currentUserWithStatus.inventory.find(item => item.name === materialTiers[index + 1].name)?.quantity || 0) < 1}
                                            colorScheme="orange" className="!py-1 !px-2 text-xs"
                                        >
                                            <span className="text-lg">↓</span> 1:5
                                        </Button>
                                    </div>
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MaterialConversionPanel;