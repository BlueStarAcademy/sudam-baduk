import React from 'react';
import { GameProps, Player, GameMode, Point } from '../types/index.js';

// Import the new arena components
import GoGameArena from './arenas/GoGameArena.js';
import AlkkagiArena from './arenas/AlkkagiArena.js';
import CurlingArena from './arenas/CurlingArena.js';
import DiceGoArena from './arenas/DiceGoArena.js';
import ThiefGoArena from './arenas/ThiefGoArena.js';

interface GameArenaProps extends GameProps {
    isMyTurn: boolean;
    myPlayerEnum: Player;
    handleBoardClick: (x: number, y: number) => void;
    isItemModeActive: boolean;
    showTerritoryOverlay: boolean;
    isMobile: boolean;
    myRevealedMoves: number[];
    showLastMoveMarker: boolean;
    optimisticStone?: Point | null;
    // FIX: Add missing props to pass down to child arenas.
    setOptimisticStone: (stone: Point | null) => void;
    setIsSubmittingMove: (isSubmitting: boolean) => void;
}

const GameArena: React.FC<GameArenaProps> = (props) => {
    const { session } = props;
    const { mode } = session;

    // This component is now a simple dispatcher.
    switch(mode) {
        case GameMode.Alkkagi: 
            return <AlkkagiArena {...props} />;
        case GameMode.Curling: 
            return <CurlingArena {...props} />;
        case GameMode.Dice: 
            return <DiceGoArena {...props} />;
        case GameMode.Thief: 
            return <ThiefGoArena {...props} />;
        
        // All other Go-based games are handled by the GoGameArena
        case GameMode.Standard:
        case GameMode.Capture:
        case GameMode.Speed:
        case GameMode.Base:
        case GameMode.Hidden:
        case GameMode.Missile:
        case GameMode.Mix:
        case GameMode.Omok:
        case GameMode.Ttamok:
        default:
            return <GoGameArena {...props} />;
    }
}

export default GameArena;