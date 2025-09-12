import React from 'react';
import { LiveGameSession, Player } from '../../types.js';

interface TowerStatusPanelProps {
    session: LiveGameSession;
}

const TowerStatusPanel: React.FC<TowerStatusPanelProps> = ({ session }) => {
    const isSurvival = session.gameType === 'survival';
    const { blackStoneLimit = 0, blackStonesPlaced = 0, captures, effectiveCaptureTargets } = session;
    
    const isTower = session.isTowerChallenge;

    const panelClasses = isTower 
        ? "bg-black/50 border-2 border-red-800/70 text-stone-200"
        : "bg-stone-800/60 border-2 border-stone-700/50 text-stone-200";
    const titleClasses = isTower ? "text-red-300" : "text-amber-300";
    const numberClasses = isTower ? "text-white" : "text-stone-100";
    const shadowStyle = isTower 
        ? { textShadow: '0 0 10px rgba(239, 68, 68, 0.7)' } 
        : { textShadow: '0 0 8px rgba(250, 204, 21, 0.6)' };

    let title: string;
    let number: number;

    if (isSurvival) {
        const aiCaptures = captures[Player.White] || 0;
        const livesLeft = (effectiveCaptureTargets?.[Player.White] ?? 5) - aiCaptures;
        title = '남은 생명';
        number = livesLeft;
    } else {
        const stonesLeft = blackStoneLimit - blackStonesPlaced;
        title = '남은 흑돌';
        number = stonesLeft;
    }

    return (
        <div className={`rounded-lg p-4 flex flex-col items-center justify-center aspect-square h-full shadow-lg ${panelClasses}`}>
            <div className={`text-6xl font-black ${numberClasses}`} style={shadowStyle}>
                {number}
            </div>
            <h3 className={`text-lg font-bold mt-2 ${titleClasses}`}>{title}</h3>
        </div>
    );
};

export default TowerStatusPanel;