import React from 'react';
import { LiveGameSession } from '../../types/index.js';

interface TowerStatusPanelProps {
    session: LiveGameSession;
}

const TowerStatusPanel: React.FC<TowerStatusPanelProps> = ({ session }) => {
    const { blackStoneLimit = 0, blackStonesPlaced = 0 } = session;
    const stonesLeft = blackStoneLimit - blackStonesPlaced;

    return (
        <div className="bg-black/50 border-2 border-red-800/70 rounded-lg p-4 flex flex-col items-center justify-center w-48 text-stone-200 shadow-lg">
            <h3 className="text-lg font-bold text-red-300 mb-2">남은 흑돌</h3>
            <div className="text-6xl font-black text-white" style={{ textShadow: '0 0 10px rgba(239, 68, 68, 0.7)' }}>
                {stonesLeft}
            </div>
            <div className="text-sm text-stone-400 mt-2">
                / {blackStoneLimit}
            </div>
        </div>
    );
};

export default TowerStatusPanel;