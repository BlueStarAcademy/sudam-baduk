import React, { useState, useMemo } from 'react';
import { InventoryItem, ItemGrade } from '../types';
import DraggableWindow from './DraggableWindow';
import { useAppContext } from '../hooks/useAppContext';
import EnhancementModal from './EnhancementModal'; // Re-using this as a panel for now
// We need to create these panels or move logic here
// For now, let's create placeholder panels.
const SynthesisPanel: React.FC = () => <div className="p-4 text-center">장비 합성 기능이 여기에 표시됩니다.</div>;
const DisassemblyPanel: React.FC = () => <div className="p-4 text-center">장비 분해 기능이 여기에 표시됩니다.</div>;
const MaterialConversionPanel: React.FC = () => <div className="p-4 text-center">재료 변환 기능이 여기에 표시됩니다.</div>;


interface BlacksmithModalProps {
    enhancementItem: InventoryItem | null;
    initialTab: 'enhancement' | 'synthesis' | 'disassembly' | 'material_conversion';
    onClose: () => void;
}

type BlacksmithTab = 'enhancement' | 'synthesis' | 'disassembly' | 'material_conversion';

const BlacksmithModal: React.FC<BlacksmithModalProps> = ({ enhancementItem, initialTab, onClose }) => {
    const { currentUserWithStatus, handlers } = useAppContext();
    const [activeTab, setActiveTab] = useState<BlacksmithTab>(initialTab);
    const [enhancementOutcome, setEnhancementOutcome] = useState<any>(null);

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
    
    // Select the first available item for enhancement if none is passed
    const itemToEnhance = enhancementItem || currentUserWithStatus.inventory.find(i => i.type === 'equipment');

    return (
        <DraggableWindow title="대장간" onClose={onClose} windowId="blacksmith" initialWidth={900}>
            <div className="absolute top-4 right-20 z-10">
                <button
                    onClick={() => handlers.setIsBlacksmithHelpOpen(true)}
                    className="w-10 h-10 flex items-center justify-center bg-gray-600 hover:bg-gray-500 rounded-full text-white font-bold"
                    title="대장간 도움말"
                >
                    <img src="/images/button/help.png" alt="도움말" className="h-6" />
                </button>
            </div>
            <div className="h-[80vh] flex flex-col md:flex-row gap-6">
                {/* Left Panel */}
                <div className="w-full md:w-1/3 flex flex-col items-center gap-4 bg-tertiary/50 p-4 rounded-lg">
                    <img src="/images/equipments/moru.png" alt="Anvil" className="w-48 h-48" />
                    <div className="w-full text-center">
                        <h3 className="font-bold text-lg text-highlight">대장간 레벨</h3>
                        <p className="text-2xl font-bold">Lv.{synthesisLevel}</p>
                        <div className="w-full bg-secondary rounded-full h-3.5 mt-2 border border-color">
                            <div className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full" style={{ width: `${xpProgress}%` }}></div>
                        </div>
                        <p className="text-xs text-tertiary mt-1">{synthesisXp.toLocaleString()} / {xpForNextLevel.toLocaleString()}</p>
                    </div>
                </div>
                
                {/* Right Panel */}
                <div className="w-full md:w-2/3 flex flex-col">
                    <div className="flex bg-tertiary/70 p-1 rounded-lg mb-4 flex-shrink-0">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveTab(tab.id);
                                    setEnhancementOutcome(null); // Clear outcome when switching tabs
                                }}
                                className={`flex-1 py-2 text-sm font-semibold rounded-md ${activeTab === tab.id ? 'bg-accent' : 'text-tertiary'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    
                    <div className="flex-grow overflow-y-auto bg-secondary/50 rounded-lg relative">
                        {activeTab === 'enhancement' && itemToEnhance && (
                             <EnhancementModal 
                                item={itemToEnhance}
                                currentUser={currentUserWithStatus}
                                onClose={onClose}
                                onAction={handleActionWithOutcome}
                                enhancementOutcome={enhancementOutcome}
                                onOutcomeConfirm={() => setEnhancementOutcome(null)}
                                isTopmost={false} // Render as a panel
                            />
                        )}
                        {activeTab === 'synthesis' && <SynthesisPanel />}
                        {activeTab === 'disassembly' && <DisassemblyPanel />}
                        {activeTab === 'material_conversion' && <MaterialConversionPanel />}
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default BlacksmithModal;
