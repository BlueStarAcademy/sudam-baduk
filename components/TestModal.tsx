import React from 'react';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';

interface TestModalProps {
    onClose: () => void;
    isTopmost?: boolean;
}

const TestModal: React.FC<TestModalProps> = ({ onClose, isTopmost }) => {
    return (
        <DraggableWindow title="테스트 모달" onClose={onClose} windowId="test-modal" initialWidth={400} initialHeight={300} isTopmost={isTopmost}>
            <div className="p-4 flex flex-col items-center justify-center gap-4">
                <p className="text-primary text-lg">이것은 테스트 모달입니다!</p>
                <Button onClick={onClose} colorScheme="blue">닫기</Button>
            </div>
        </DraggableWindow>
    );
};

export default TestModal;
