import React from 'react';
import { LiveGameSession } from './types.js';
import { useAppContext } from './hooks/useAppContext.js';
import SinglePlayerArena from './components/arenas/SinglePlayerArena.js';
import TowerChallengeArena from './components/arenas/TowerChallengeArena.js';
import PvpArena from './components/arenas/PvpArena.js';

interface GameComponentProps {
    session: LiveGameSession;
}

const Game: React.FC<GameComponentProps> = ({ session }) => {
    const { currentUser, currentUserWithStatus } = useAppContext();

    if (!session.player1?.id || !session.player2?.id || !currentUser || !currentUserWithStatus) {
        return <div className="flex items-center justify-center min-h-screen">플레이어 정보를 불러오는 중...</div>;
    }
    
    // --- Arena Routing ---
    const isTower = session.isTowerChallenge || (session.stageId && session.stageId.startsWith('tower-'));

    if (isTower) {
        return <TowerChallengeArena session={session} />;
    }
    if (session.isSinglePlayer) {
        return <SinglePlayerArena session={session} />;
    }
    
    // Default to PvP Arena
    return <PvpArena session={session} />;
};

export default Game;
