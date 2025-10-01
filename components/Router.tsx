



import React from 'react';
import { useAppContext } from '../hooks/useAppContext.js';

// Import all view components
import Login from './Login.js';
import Register from './Register.js';
import Profile from './Profile.js';
import Lobby from './Lobby.js';
import WaitingRoom from './waiting-room/WaitingRoom.js';
import Game from '../Game.js';
import Admin from './Admin.js';
import TournamentLobby from './TournamentLobby.js';
import SinglePlayerLobby from './SinglePlayerLobby.js';
import TowerChallengeLobby from './TowerChallengeLobby.js';
import Guild from './Guild.js';
// FIX: Changed to default import to match named export from GuildBoss.tsx
import GuildBoss from './guild/GuildBoss.js';

const Router: React.FC = () => {
    const { currentRoute, currentUser, activeGame } = useAppContext();

    if (!currentUser) {
        if (currentRoute.view === 'register') {
            return <Register />;
        }
        return <Login />;
    }
    
    // If user is logged in, but their game is still active, force them into the game view
    if (activeGame && currentRoute.view !== 'game') {
        // The logic in useApp hook will handle the redirect, we can show a loading state here
        return <div className="flex items-center justify-center h-full">재접속 중...</div>;
    }
    
    switch (currentRoute.view) {
        case 'profile':
            return <Profile />;
        case 'lobby':
            const lobbyType = currentRoute.params.type === 'playful' ? 'playful' : 'strategic';
            return <Lobby lobbyType={lobbyType} />;
        case 'waiting':
            if (currentRoute.params.mode) {
                return <WaitingRoom mode={currentRoute.params.mode} />;
            }
            // Fallback if mode is missing
            window.location.hash = '#/profile';
            return null;
        case 'game':
             if (currentRoute.params.id && activeGame && activeGame.id === currentRoute.params.id) {
                return <Game session={activeGame} />;
            }
            // Instead of redirecting here, we show a loading state.
            // The useEffect in useApp.ts is responsible for the actual redirect logic.
            // This prevents a race condition where this component redirects to /profile
            // before useApp.ts can redirect to the correct waiting room.
            return <div className="flex items-center justify-center h-full">대국 종료 중...</div>;
        case 'guild':
            return <Guild />;
        case 'guildboss':
            return <GuildBoss />;
        case 'admin':
            return <Admin />;
        case 'tournament':
            return <TournamentLobby />;
        case 'singleplayer':
             return <SinglePlayerLobby />;
        case 'towerchallenge':
             return <TowerChallengeLobby />;
        default:
            window.location.hash = '#/profile';
            return null;
    }
};

export default Router;