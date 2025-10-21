import React, { useState } from 'react';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import { containsProfanity } from '../profanity.js';

interface SavePresetNameModalProps {
    defaultPresetName: string;
    onClose: () => void;
    onSave: (presetName: string) => void;
}

const SavePresetNameModal: React.FC<SavePresetNameModalProps> = ({ defaultPresetName, onClose, onSave }) => {
    const [presetName, setPresetName] = useState(defaultPresetName);
    const [error, setError] = useState('');

    const handleSaveClick = () => {
        if (!presetName.trim()) {
            setError('프리셋 이름을 입력해주세요.');
            return;
        }
        if (containsProfanity(presetName)) {
            setError('프리셋 이름에 부적절한 단어가 포함되어 있습니다.');
            return;
        }
        if (presetName.trim().length > 10) {
            setError('프리셋 이름은 10자를 초과할 수 없습니다.');
            return;
        }
        onSave(presetName.trim());
        onClose();
    };

    return (
        <DraggableWindow title="프리셋 이름 저장" onClose={onClose} windowId="save-preset-name-modal" initialWidth={400} initialHeight={200} isTopmost>
            <div className="p-4 flex flex-col gap-4">
                <p className="text-sm text-primary">저장할 프리셋 이름을 입력해주세요.</p>
                <input
                    type="text"
                    value={presetName}
                    onChange={(e) => {
                        setPresetName(e.target.value);
                        setError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveClick()}
                    className="w-full p-2 rounded-md bg-secondary border border-color text-primary"
                    maxLength={10}
                    autoFocus
                />
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <div className="flex justify-end gap-2">
                    <Button onClick={handleSaveClick} colorScheme="green">저장</Button>
                    <Button onClick={onClose} colorScheme="gray">취소</Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default SavePresetNameModal;
