import React from 'react';
import { useAppContext } from '../hooks/useAppContext';

// Import all view components. It's safe to assume they exist based on the file list.
import Profile from './Profile';
import Lobby from './Lobby';
import WaitingRoom from './waiting-room/WaitingRoom';
import Game from './Game';
import Admin from './Admin';
import TournamentLobby from './TournamentLobby';
import SinglePlayerLobby from './SinglePlayerLobby';
import TowerChallengeLobby from './TowerChallengeLobby';
import Guild from './guild/Guild';
import GuildBoss from './guild/GuildBoss';
import GuildWar from './guild/GuildWar';

const Router: React.FC = () => {
    const { currentRoute, activeGame } = useAppContext();
    
    // This component only renders content for logged-in users.
    // The logic in useApp hook handles the redirect for active games.
    
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
            window.location.hash = '#/profile';
            return null;
        case 'game':
             if (currentRoute.params.id && activeGame && activeGame.id === currentRoute.params.id) {
                return <Game session={activeGame} />;
            }
            // This case handles when the user leaves a game; useApp will redirect them.
            return <div className="flex items-center justify-center h-full">대국 종료 중...</div>;
        case 'guild':
            return <Guild />;
        case 'guildboss':
            return <GuildBoss />;
        case 'guildwar':
            return <GuildWar />;
        case 'admin':
            return <Admin />;
        case 'tournament':
            return <TournamentLobby />;
        case 'singleplayer':
             return <SinglePlayerLobby />;
        case 'towerchallenge':
             return <TowerChallengeLobby />;
        default:
            // Fallback to profile if route is unknown
            window.location.hash = '#/profile';
            return null;
    }
};

export default Router;