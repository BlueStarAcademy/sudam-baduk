import React from 'react';
// Correctly import LiveGameSession from the types barrel file.
import { LiveGameSession } from './types/index';
import { useAppContext } from './hooks/useAppContext';
import SinglePlayerArena from './components/arenas/SinglePlayerArena';
import TowerChallengeArena from './components/arenas/TowerChallengeArena';
import PvpArena from './components/arenas/PvpArena';

interface GameComponentProps {
    session: LiveGameSession;
}

const Game: React.FC<GameComponentProps> = ({ session }) => {
    const { currentUser, currentUserWithStatus } = useAppContext();

    if (!session.player1?.id || !session.player2?.id || !currentUser || !currentUserWithStatus) {
        return <div className="flex items-center justify-center min-h-screen">플레이어 정보를 불러오는 중...</div>;
    }
    
    // --- Arena Routing ---
    if (session.isTowerChallenge) {
        return <TowerChallengeArena session={session} />;
    }
    if (session.isSinglePlayer) {
        return <SinglePlayerArena session={session} />;
    }
    
    // Default to PvP Arena
    return <PvpArena session={session} />;
};

export default Game;