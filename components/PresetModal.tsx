import React, { useState, useMemo } from 'react';
import { UserWithStatus, ServerAction, EquipmentPreset } from '../types';
import DraggableWindow from './DraggableWindow';
import Button from './Button';
import { containsProfanity } from '../profanity';

interface PresetModalProps {
    user: UserWithStatus;
    onAction: (action: ServerAction) => void;
    onClose: () => void;
}

const PresetModal: React.FC<PresetModalProps> = ({ user, onAction, onClose }) => {
    const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
    const [newName, setNewName] = useState('');

    const presets = useMemo(() => {
        const userPresets = user.equipmentPresets || [];
        const fullPresets: EquipmentPreset[] = Array(5).fill(null).map((_, i) => 
            userPresets[i] || { name: `프리셋 ${i + 1}`, equipment: {} }
        );
        return fullPresets;
    }, [user.equipmentPresets]);

    const handleSave = (presetIndex: number) => {
        if (window.confirm(`'${presets[presetIndex].name}'에 현재 장착한 장비를 저장하시겠습니까?`)) {
            onAction({ type: 'SAVE_EQUIPMENT_PRESET', payload: { presetIndex } });
        }
    };

    const startRename = (presetIndex: number) => {
        setRenamingIndex(presetIndex);
        setNewName(presets[presetIndex].name);
    };

    const handleRename = () => {
        if (renamingIndex === null || !newName.trim()) {
            setRenamingIndex(null); // Cancel if name is empty
            return;
        }
        if (containsProfanity(newName)) {
            alert("프리셋 이름에 부적절한 단어가 포함되어 있습니다.");
            return;
        }
        if (newName.trim().length > 10) {
            alert("프리셋 이름은 10자를 초과할 수 없습니다.");
            return;
        }
        
        onAction({
            type: 'RENAME_EQUIPMENT_PRESET',
            payload: { presetIndex: renamingIndex, newName: newName.trim() }
        });
        setRenamingIndex(null);
        setNewName('');
    };

    return (
        <DraggableWindow title="프리셋 관리" onClose={onClose} windowId="equipment-preset-modal" isTopmost>
            <div className="space-y-4">
                <p className="text-sm text-tertiary text-center">현재 장착한 장비를 프리셋에 저장하거나, 프리셋 이름을 변경할 수 있습니다.</p>
                {presets.map((preset, index) => (
                    <div key={index} className="bg-secondary p-3 rounded-lg flex items-center justify-between gap-2">
                        {renamingIndex === index ? (
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onBlur={handleRename}
                                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                                className="bg-tertiary border border-color p-1 rounded-md text-primary font-semibold flex-grow"
                                autoFocus
                            />
                        ) : (
                            <span className="font-semibold text-primary truncate">{preset.name}</span>
                        )}

                        <div className="flex items-center gap-2 flex-shrink-0">
                            <Button onClick={() => handleSave(index)} colorScheme="green" className="!text-xs !py-1">현재 장비 저장</Button>
                            <Button onClick={() => startRename(index)} colorScheme="gray" className="!text-xs !py-1">이름 변경</Button>
                        </div>
                    </div>
                ))}
            </div>
        </DraggableWindow>
    );
};

export default PresetModal;