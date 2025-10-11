// server/services/actionButtonService.ts
import { LiveGameSession, ActionButton } from '../../types/index.js';
import { 
    PLAYFUL_GAME_MODES, 
    STRATEGIC_ACTION_BUTTONS_EARLY, 
    STRATEGIC_ACTION_BUTTONS_MID, 
    STRATEGIC_ACTION_BUTTONS_LATE, 
    PLAYFUL_ACTION_BUTTONS_EARLY, 
    PLAYFUL_ACTION_BUTTONS_MID, 
    PLAYFUL_ACTION_BUTTONS_LATE 
} from '../../constants/index.js';

export const getNewActionButtons = (game: LiveGameSession): ActionButton[] => {
    const { mode, moveHistory } = game;
    
    let phase: 'early' | 'mid' | 'late';
    const isPlayful = PLAYFUL_GAME_MODES.some(m => m.mode === mode);

    if (isPlayful) {
        // Use round-based phase for most playful games
        const currentRound = game.alkkagiRound || game.curlingRound || game.round || 1;
        const totalRounds = game.settings.alkkagiRounds || game.settings.curlingRounds || game.settings.diceGoRounds || 2;

        if (currentRound === 1) {
            phase = 'early';
        } else if (currentRound === totalRounds) {
            phase = 'late';
        } else {
            phase = 'mid';
        }
    } else { // Strategic
        const moveCount = moveHistory.length;
        if (moveCount <= 30) {
            phase = 'early';
        } else if (moveCount >= 31 && moveCount <= 150) {
            phase = 'mid';
        } else { // moveCount >= 151
            phase = 'late';
        }
    }

    let sourceDeck: ActionButton[];

    if (isPlayful) {
        switch (phase) {
            case 'early': sourceDeck = PLAYFUL_ACTION_BUTTONS_EARLY; break;
            case 'mid':   sourceDeck = PLAYFUL_ACTION_BUTTONS_MID; break;
            case 'late':  sourceDeck = PLAYFUL_ACTION_BUTTONS_LATE; break;
        }
    } else { // Strategic
        switch (phase) {
            case 'early': sourceDeck = STRATEGIC_ACTION_BUTTONS_EARLY; break;
            case 'mid':   sourceDeck = STRATEGIC_ACTION_BUTTONS_MID; break;
            case 'late':  sourceDeck = STRATEGIC_ACTION_BUTTONS_LATE; break;
        }
    }

    const shuffledButtons = [...sourceDeck].sort(() => 0.5 - Math.random());
    const manners = shuffledButtons.filter(b => b.type === 'manner');
    const unmanners = shuffledButtons.filter(b => b.type === 'unmannerly');

    const mannerCount = Math.random() > 0.5 ? 1 : 2;
    const selectedManners = manners.slice(0, mannerCount);
    
    const neededUnmanners = 3 - selectedManners.length;
    const selectedUnmanners = unmanners.slice(0, neededUnmanners);

    let result = [...selectedManners, ...selectedUnmanners];
    
    if (result.length < 3) {
        const existingNames = new Set(result.map(b => b.name));
        const filler = shuffledButtons.filter(b => !existingNames.has(b.name));
        result.push(...filler.slice(0, 3 - result.length));
    }
    
    return result.slice(0, 3).sort(() => 0.5 - Math.random());
};
