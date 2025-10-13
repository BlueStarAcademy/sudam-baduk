// server/ai/index.ts
import { LiveGameSession, GameMode, User, Player, Point } from '../../types/index.js';
import { aiUserId } from '../../constants/index.js';
import { makePlayfulAiMove } from './playfulAi.js';
import { makeSimpleAiMove } from './simpleAi.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, strategicAiDisplayMap, captureAiLevelMap } from '../../constants/index.js';

export const getAiUser = (mode: GameMode, difficulty: number = 50, stageId?: string, floor?: number): User => {
    const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === mode);
    const isPlayful = PLAYFUL_GAME_MODES.some(m => m.mode === mode);
    
    let botName = `${mode}봇`;
    let displayLevel: number;
    let engineLevel = Math.max(1, Math.min(10, Math.round(difficulty / 10)));

    if (floor) {
        engineLevel = Math.ceil(floor / 10);
        botName = `도전의 탑 ${floor}층`;
        displayLevel = floor;
    } else if (stageId) {
        if(stageId.startsWith('입문')) engineLevel = 1;
        else if(stageId.startsWith('초급')) engineLevel = 3;
        else if(stageId.startsWith('중급')) engineLevel = 5;
        else if(stageId.startsWith('고급')) engineLevel = 7;
        else if(stageId.startsWith('유단자')) engineLevel = 9;
        botName = `수련의 장 ${stageId}`;
        displayLevel = engineLevel;
    } else if (isPlayful) {
        displayLevel = engineLevel;
        botName = `${mode}봇 ${displayLevel}단계`;
    } else { // Strategic PvP AI
        if (mode === GameMode.Capture) {
            displayLevel = captureAiLevelMap[engineLevel - 1];
            botName = `따내기봇 ${displayLevel}단`;
        } else {
            displayLevel = strategicAiDisplayMap[engineLevel - 1];
            // FIX: The variable 'difficultyStep' was not defined. Based on the logic, 'engineLevel' should be used here.
            botName = `${mode}봇 ${engineLevel}단계`;
        }
    }
    
    // This is a partial User object, which is what seems to be expected.
    return {
        id: aiUserId,
        username: 'ai_player',
        nickname: botName,
        isAdmin: false,
        strategyLevel: isStrategic ? displayLevel : 1,
        playfulLevel: isPlayful ? displayLevel : 1,
    } as User;
};

export const makeAiMove = async (game: LiveGameSession): Promise<Point & { isHidden?: boolean }> => {
    const isPlayful = PLAYFUL_GAME_MODES.some(m => m.mode === game.mode);
    if (isPlayful) {
        await makePlayfulAiMove(game);
        return {x: -3, y: -3}; // sentinel value indicating playful AI modified game state directly
    } 
    
    // Always use the self-contained simple AI
    const move = makeSimpleAiMove(game);

    if (game.mode === GameMode.Hidden || (game.mode === GameMode.Mix && game.settings.mixedModes?.includes(GameMode.Hidden)) || ((game.isSinglePlayer || game.isTowerChallenge) && game.settings.hiddenStoneCount && game.settings.hiddenStoneCount > 0)) {
        // Simple logic for hidden move
        if (!game.aiHiddenStoneUsedThisGame && Math.random() < 0.2) {
            return { ...move, isHidden: true };
        }
    }
    
    return move;
};

export { aiUserId };
