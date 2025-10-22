import React from 'react';
import type { GameProps } from '../types';
import PvpArena from './arenas/PvpArena';
import SinglePlayerArena from './arenas/SinglePlayerArena';
// FIX: Changed to a named import for `TowerChallengeArena` to resolve module resolution error.
import { TowerChallengeArena } from './arenas/TowerChallengeArena';

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