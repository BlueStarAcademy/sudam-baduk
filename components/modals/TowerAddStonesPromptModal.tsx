import React from 'react';
import { LiveGameSession, ServerAction } from '../../types/index.js';
import Button from '../Button.js';

interface TowerAddStonesPromptModalProps {
    session: LiveGameSession;
    onAction: (action: ServerAction) => void;
}

const TowerAddStonesPromptModal: React.FC<TowerAddStonesPromptModalProps> = ({ session, onAction }) => {
    const cost = 100; // Diamonds

    const handlePurchase = () => {
        onAction({ type: 'TOWER_CHALLENGE_ADD_STONES', payload: { gameId: session.id } });
        // The server will set promptForMoreStones to false and resume the game.
    };

    const handleResign = () => {
        onAction({ type: 'RESIGN_GAME', payload: { gameId: session.id } });
        // The server will end the game.
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-primary border-2 border-color rounded-lg shadow-xl p-6 w-full max-w-md text-center animate-fade-in">
                <h2 className="text-2xl font-bold text-highlight mb-2">착수 부족!</h2>
                <p className="text-secondary mb-4">흑돌을 모두 사용했습니다. 다이아 {cost}개를 사용하여 착수 3회를 추가하시겠습니까?</p>
                <p className="text-xs text-tertiary mb-6">(게임을 포기하면 패배로 처리됩니다.)</p>
                <div className="flex gap-4">
                    <Button onClick={handleResign} colorScheme="red" className="w-full">포기</Button>
                    <Button onClick={handlePurchase} colorScheme="green" className="w-full">구매 (💎{cost})</Button>
                </div>
            </div>
        </div>
    );
};

export default TowerAddStonesPromptModal;
