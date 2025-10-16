import React from 'react';
import type { GameProps } from '../types/index.js';
import PvpArena from './arenas/PvpArena.js';
import SinglePlayerArena from './arenas/SinglePlayerArena.js';
// FIX: Changed to a named import for `TowerChallengeArena` to resolve module resolution error.
import { TowerChallengeArena } from './arenas/TowerChallengeArena.js';

const Game: React.FC<{ session: GameProps['session'] }> = ({ session }) => {
    if (session.isSinglePlayer) {
        return <SinglePlayerArena session={session} />;
    }
    if (session.isTowerChallenge) {
        return <TowerChallengeArena session={session} />;
    }
    // PvpArena handles all playful and strategic PvP modes
    return <PvpArena session={session} />;
};

export default Game;