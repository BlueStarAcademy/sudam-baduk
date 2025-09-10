import React from 'react';
import { LiveGameSession, Player } from '../../types/index.js';

interface TurnCounterPanelProps {
    session: LiveGameSession;
}

const TurnCounterPanel: React.FC<TurnCounterPanelProps> = ({ session }) => {
    const { moveHistory, autoEndTurnCount, blackPlayerId, whitePlayerId, player1, player2 } = session;

    if (!autoEndTurnCount) {
        return null;
    }

    const totalTurnsPerPlayer = autoEndTurnCount / 2;
    const blackTurns = moveHistory.filter(m => m.player === Player.Black).length;
    const whiteTurns = moveHistory.filter(m => m.player === Player.White).length;

    const blackPlayer = player1.id === blackPlayerId ? player1 : player2;
    const whitePlayer = player1.id === whitePlayerId ? player1 : player2;
    
    return (
        <div className="bg-stone-800/60 backdrop-blur-sm rounded-lg p-3 flex flex-col items-center justify-center w-full h-full border border-stone-700/50 text-stone-200">
            <h3 className="text-lg font-bold text-amber-300 mb-4">남은 턴</h3>
            <div className="space-y-4 w-full text-center">
                <div>
                    <p className="font-semibold">{blackPlayer.nickname} (흑)</p>
                    <p className="text-3xl font-mono font-black">{Math.max(0, totalTurnsPerPlayer - blackTurns)}</p>
                    <p className="text-xs text-stone-400">({blackTurns}/{totalTurnsPerPlayer})</p>
                </div>
                <div>
                    <p className="font-semibold">{whitePlayer.nickname} (백)</p>
                    <p className="text-3xl font-mono font-black">{Math.max(0, totalTurnsPerPlayer - whiteTurns)}</p>
                    <p className="text-xs text-stone-400">({whiteTurns}/{totalTurnsPerPlayer})</p>
                </div>
            </div>
        </div>
    );
};

export default TurnCounterPanel;