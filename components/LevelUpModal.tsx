import React from 'react';
import Button from './Button.js';

interface LevelUpModalProps {
    levelUpInfo: { type: 'strategy' | 'playful', newLevel: number };
    onClose: () => void;
}

const LevelUpModal: React.FC<LevelUpModalProps> = ({ levelUpInfo, onClose }) => {
    const typeText = levelUpInfo.type === 'strategy' ? '전략' : '놀이';
    const colorClass = levelUpInfo.type === 'strategy' ? 'text-blue-400' : 'text-yellow-400';
    
    const handleConfirm = (e?: React.MouseEvent<HTMLButtonElement>) => {
        if (e) {
            e.stopPropagation();
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center">
            <div 
                className="bg-primary border-4 border-yellow-400 rounded-xl shadow-2xl p-8 text-center animate-level-up-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <h1 className="text-5xl font-black text-yellow-300 level-up-text" style={{ textShadow: '3px 3px 0px rgba(0,0,0,0.5)' }}>LEVEL UP!</h1>
                <p className="mt-4 text-2xl font-bold">
                    <span className={colorClass}>{typeText}</span> 레벨이 <span className="text-white">{levelUpInfo.newLevel}</span> (으)로 올랐습니다!
                </p>
                <p className="mt-2 text-lg text-green-400 font-semibold">+2 보너스 스탯 포인트 획득!</p>
                <Button onClick={handleConfirm} className="mt-8">확인</Button>
            </div>
        </div>
    );
};

export default LevelUpModal;
