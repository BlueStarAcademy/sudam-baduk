import React, { useState, useMemo } from 'react';
import { InventoryItem, ItemGrade } from '../types';
import DraggableWindow from './DraggableWindow';
import { useAppContext } from '../hooks/useAppContext';
import EnhancementPanel from './EnhancementModal';
import InventoryPanel from './InventoryPanel'; // Import the new panel
import { SYNTHESIS_LEVEL_BENEFITS } from '../constants';

import SynthesisPanel from './SynthesisPanel';
import DisassemblyPanel from './DisassemblyPanel';
import MaterialConversionPanel from './MaterialConversionPanel';

interface BlacksmithModalProps {
    enhancementItem: InventoryItem | null;
    initialTab?: 'enhancement' | 'synthesis' | 'disassembly' | 'material_conversion';
    onClose: () => void;
    isTopmost?: boolean;
}

type BlacksmithTab = 'enhancement' | 'synthesis' | 'disassembly' | 'material_conversion';

const gradeNames: Record<ItemGrade, string> = {
    [ItemGrade.Normal]: '일반',
    [ItemGrade.Uncommon]: '고급',
    [ItemGrade.Rare]: '희귀',
    [ItemGrade.Epic]: '에픽',
    [ItemGrade.Legendary]: '전설',
    [ItemGrade.Mythic]: '신화',
};

const BlacksmithModal: React.FC<BlacksmithModalProps> = ({ enhancementItem, initialTab, onClose, isTopmost }) => {
    const { currentUserWithStatus, handlers } = useAppContext();
    const [activeTab, setActiveTab] = useState<BlacksmithTab>(initialTab || 'enhancement');
    const [enhancementOutcome, setEnhancementOutcome] = useState<any>(null);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(enhancementItem);
    const [sortBy, setSortBy] = useState<'time' | 'grade' | 'type'>('time');

    const handleActionWithOutcome = async (action: any) => {
        const result = await handlers.handleAction(action);
        if (result && result.enhancementOutcome) {
            setEnhancementOutcome(result.enhancementOutcome);
        }
        return result;
    }

    if (!currentUserWithStatus) return null;

    const { synthesisLevel, synthesisXp } = currentUserWithStatus;
    const xpForNextLevel = synthesisLevel * 10000;
    const xpProgress = (synthesisXp / xpForNextLevel) * 100;

    const tabs: { id: BlacksmithTab; label: string }[] = [
        { id: 'enhancement', label: '장비 강화' },
        { id: 'synthesis', label: '장비 합성' },
        { id: 'disassembly', label: '장비 분해' },
        { id: 'material_conversion', label: '재료 변환' },
    ];

    return (
        <DraggableWindow title="대장간" onClose={onClose} windowId="blacksmith" initialWidth={1200} initialHeight={800} isTopmost={isTopmost}>
            <div className="h-full flex flex-row gap-4 overflow-hidden">
                {/* Left Panel */}
                <div className="w-1/3 flex flex-col items-center gap-4 bg-tertiary/50 p-4 rounded-lg h-full">
                    <div className="bg-black/20 p-1 rounded-lg shadow-lg">
                        <img src="/images/equipments/moru.png" alt="Anvil" className="w-64 h-48 object-cover rounded-md" />
                    </div>
                    <div className="w-full text-center">
                        <h3 className="font-bold text-xl text-highlight">대장간 Lv.{synthesisLevel}</h3>
                        <div className="w-full bg-secondary rounded-full h-4 mt-2 border border-color relative">
                            <div className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full" style={{ width: `${xpProgress}%` }}></div>
                            <span className="absolute inset-0 text-xs font-bold text-white flex items-center justify-center" style={{textShadow: '1px 1px 2px black'}}>
                                {synthesisXp.toLocaleString()} / {xpForNextLevel.toLocaleString()}
                            </span>
                        </div>
                    </div>
                    <div className="w-full text-xs space-y-1 text-gray-400">
                        <h4 className="font-bold text-sm text-center text-gray-300 mb-2">합성 효과</h4>
                        {Object.entries(gradeNames).map(([grade, name]) => {
                            const currentBenefit = SYNTHESIS_LEVEL_BENEFITS[synthesisLevel]?.upgradeChance[grade as ItemGrade] || 0;
                            const nextBenefit = SYNTHESIS_LEVEL_BENEFITS[synthesisLevel + 1] ? SYNTHESIS_LEVEL_BENEFITS[synthesisLevel + 1].upgradeChance[grade as ItemGrade] || 0 : 0;
                            return (
                                <div key={grade} className="flex justify-between">
                                    <span>{name} 대성공 확률:</span>
                                                                                                                                                            <span className="font-bold text-green-400">
                                                                                                                                                                {currentBenefit}%
                                                                                                                                                            </span>                                </div>
                            )
                        })}
                        <div className="flex justify-between">
                            <span>신화 더블옵션 확률:</span>
                                                                                                                            <span className="font-bold text-yellow-300">
                                                                                                                                {SYNTHESIS_LEVEL_BENEFITS[synthesisLevel]?.doubleMythicChance || 0}%
                                                                                                                            </span>                        </div>
                    </div>
                </div>
                
                <div className="w-2/3 flex flex-col gap-4">
                    {/* Right Panel */}
                    <div className="flex flex-col flex-grow">
                        <div className="flex bg-tertiary/70 p-1 rounded-lg mb-4 flex-shrink-0">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setActiveTab(tab.id);
                                        setEnhancementOutcome(null);
                                    }}
                                    className={`flex-1 py-2 text-sm font-semibold rounded-md ${activeTab === tab.id ? 'bg-accent' : 'text-tertiary'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        
                        <div className="flex-grow bg-secondary/50 rounded-lg relative">
                            {activeTab === 'enhancement' && selectedItem && (
                                 <EnhancementPanel
                                    item={selectedItem}
                                    currentUser={currentUserWithStatus}
                                    onClose={onClose}
                                    onAction={handleActionWithOutcome}
                                    enhancementOutcome={enhancementOutcome}
                                    onOutcomeConfirm={() => setEnhancementOutcome(null)}
                                    isTopmost={false}
                                />
                            )}
                            {activeTab === 'synthesis' && <SynthesisPanel />}
                            {activeTab === 'disassembly' && <DisassemblyPanel />}
                            {activeTab === 'material_conversion' && <MaterialConversionPanel />}
                        </div>
                    </div>

                    {/* Bottom Section - Inventory */}
                    <div className="flex-grow">
                        <InventoryPanel
                            items={currentUserWithStatus.inventory}
                            selectedItems={selectedItem ? [selectedItem] : []}
                            onSelectItem={setSelectedItem}
                            itemTypeFilter="equipment"
                            title="강화할 장비 선택"
                            sortBy={sortBy}
                            onSortByChange={setSortBy}
                        />
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default BlacksmithModal;
