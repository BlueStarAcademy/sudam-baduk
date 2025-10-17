// server/ai/index.ts
import { LiveGameSession, GameMode, User, Player, Point } from '../../types/index.js';
import { aiUserId, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, strategicAiDisplayMap, captureAiLevelMap } from '../../constants/index.js';
import { makePlayfulAiMove } from './playfulAi.js';
import { makeSimpleAiMove } from './simpleAi.js';
import { createDefaultUser } from '../initialData.js';

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
        if(stageId.startsWith('입문')) {
            botName = '입문봇';
            engineLevel = 1;
        } else if(stageId.startsWith('초급')) {
            botName = '초급봇';
            engineLevel = 3;
        } else if(stageId.startsWith('중급')) {
            botName = '중급봇';
            engineLevel = 5;
        } else if(stageId.startsWith('고급')) {
            botName = '고급봇';
            engineLevel = 7;
        } else if(stageId.startsWith('유단자')) {
            botName = '유단자봇';
            engineLevel = 9;
        }
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
            botName = `${mode}봇 ${engineLevel}단계`;
        }
    }
    
    // Create a full user object for the AI to prevent crashes in services that expect a complete User object.
    const aiUser = createDefaultUser(aiUserId, 'ai_player', botName);

    // Override specific properties for this AI instance
    aiUser.strategyLevel = isStrategic ? displayLevel : 1;
    aiUser.playfulLevel = isPlayful ? displayLevel : 1;

    return aiUser;
};

const canAiUseHiddenMove = (game: LiveGameSession): boolean => {
    if (game.mode === GameMode.Hidden || (game.mode === GameMode.Mix && game.settings.mixedModes?.includes(GameMode.Hidden))) {
        return true;
    }

    if (!((game.isSinglePlayer || game.isTowerChallenge) && game.settings.hiddenStoneCount && game.settings.hiddenStoneCount > 0)) {
        return false;
    }

    if (game.isSinglePlayer && game.stageId) {
        if (game.stageId.startsWith('고급-')) {
            return true;
        }
        if (game.stageId.startsWith('유단자-')) {
            const stageNum = parseInt(game.stageId.split('-')[1], 10);
            if (stageNum >= 16 && stageNum <= 20) {
                return true;
            }
        }
    }

    if (game.isTowerChallenge && game.stageId) {
        const floor = parseInt(game.stageId.split('-')[1], 10);
        if (floor >= 21 && floor <= 100) {
            return true;
        }
    }

    return false;
}

export const makeAiMove = async (game: LiveGameSession): Promise<Point & { isHidden?: boolean }> => {
    const isPlayful = PLAYFUL_GAME_MODES.some(m => m.mode === game.mode);
    if (isPlayful) {
        await makePlayfulAiMove(game);
        return {x: -3, y: -3}; // sentinel value indicating playful AI modified game state directly
    } 
    
    // Always use the self-contained simple AI
    const move = makeSimpleAiMove(game);

    if (canAiUseHiddenMove(game)) {
        // Simple logic for hidden move
        if (!game.aiHiddenStoneUsedThisGame && Math.random() < 0.2) {
            return { ...move, isHidden: true };
        }
    }
    
    return move;
};

export { aiUserId };