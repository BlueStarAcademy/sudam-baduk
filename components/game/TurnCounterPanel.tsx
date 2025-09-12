import React from 'react';
import { LiveGameSession, Player } from '../../types.js';

interface TurnCounterPanelProps {
    session: LiveGameSession;
}

const TurnCounterPanel: React.FC<TurnCounterPanelProps> = ({ session }) => {
    const { moveHistory, autoEndTurnCount } = session;

    if (!autoEndTurnCount) {
        return null;
    }
    
    const totalTurns = moveHistory.length;
    const remainingTurns = Math.max(0, autoEndTurnCount - totalTurns);

    return (
        <div className="flex flex-col items-center justify-center w-24 flex-shrink-0 aspect-square rounded-lg shadow-lg border-2 p-1 text-center bg-gradient-to-br from-gray-800 to-black border-gray-600">
            <span className="text-yellow-300 text-[clamp(0.6rem,2vmin,0.75rem)] font-semibold whitespace-nowrap">계가까지</span>
            <span className="font-mono font-bold text-[clamp(1.5rem,6vmin,2.5rem)] tracking-tighter my-1 text-white">
                {remainingTurns}
            </span>
        </div>
    );
};

export default TurnCounterPanel;