// server/modes/strategic.ts

import {
    type LiveGameSession,
    type ServerAction,
    type User,
    type HandleActionResult,
    Player,
    GameStatus,
    WinReason,
    GameMode,
    type Move,
    Point,
    UserStatusInfo,
    type Negotiation,
    BoardState,
    KoInfo,
    SinglePlayerStageInfo
} from '../../types/index.js';
import { TOWER_STAGES } from '../../constants/towerChallengeConstants.js';
import { SINGLE_PLAYER_STAGES } from '../../constants/singlePlayerConstants.js';
import { processMove } from '../../utils/goLogic.js';
import { getGameResult, endGame } from '../summaryService.js';
import { makeAiMove } from '../ai/index.js';
import * as db from '../db.js';
import { transitionToPlaying, handleSharedAction, isFischerGame, switchTurnAndUpdateTimers, updateSharedGameState } from './shared.js';
import { initializeNigiri, updateNigiriState, handleNigiriAction } from './nigiri.js';
import { initializeCapture, updateCaptureState, handleCaptureAction } from './capture.js';
import { updateSpeedState } from './speed.js';
import { initializeBase, updateBaseState, handleBaseAction } from './base.js';
import { initializeHidden, updateHiddenState, handleHiddenAction } from './hidden.js';
import { initializeMissile, updateMissileState, handleMissileAction } from './missile.js';
import { getNewActionButtons } from '../services/actionButtonService.js';
import { broadcast } from '../services/supabaseService.js';

const applyRandomPlacements = (game: LiveGameSession, stageInfo: SinglePlayerStageInfo) => {
    // ... (implementation unchanged)
};

export const handleAiTurn = async (gameFromAction: LiveGameSession, userMove: { x: number, y: number }, userPlayerEnum: Player): Promise<LiveGameSession | undefined> => {
    try {
        const gameId = gameFromAction.id;
        const freshGame = await db.getLiveGame(gameId);

        if (!freshGame) {
            console.log(`[AI Turn Abort] Game ${gameId}: Game not found.`);
            return undefined;
        }

        const aiPlayerId = freshGame.player2.id;
        const aiPlayerEnum = freshGame.blackPlayerId === aiPlayerId ? Player.Black : (freshGame.whitePlayerId === aiPlayerId ? Player.White : Player.None);

        if (freshGame.currentPlayer !== aiPlayerEnum) {
            console.log(`[AI Turn Abort] Game ${gameId}: It's not AI's turn. Current player is ${freshGame.currentPlayer}.`);
            return freshGame;
        }

        let aiMove = await makeAiMove(freshGame) as (Point & { isHidden?: boolean });

        if (freshGame.currentPlayer !== aiPlayerEnum) {
            console.log(`[AI Turn Debug] Game ${gameId}: Game state changed while AI was thinking. Aborting.`);
            return freshGame;
        }

        // SERVERLESS REFACTOR: Removed setTimeout for hidden moves.
        // The move is now processed immediately. Client can add a visual delay.
        if (aiMove.isHidden) {
            freshGame.aiHiddenStoneUsedThisGame = true;
            const result = processMove(freshGame.boardState, { x: aiMove.x, y: aiMove.y, player: aiPlayerEnum }, freshGame.koInfo, freshGame.moveHistory.length);
            
            if (!result.isValid) {
                console.error(`[AI HIDDEN MOVE ERROR] AI generated an invalid move: ${JSON.stringify(aiMove)}. AI resigns.`);
                await endGame(freshGame, aiPlayerEnum === Player.Black ? Player.White : Player.Black, WinReason.Resign);
                await db.saveGame(freshGame);
                await broadcast({ type: 'GAME_STATE_UPDATE', payload: { updatedGame: freshGame } });
                return freshGame;
            }

            freshGame.boardState = result.newBoardState;
            freshGame.lastMove = { x: aiMove.x, y: aiMove.y };
            freshGame.moveHistory.push({ player: aiPlayerEnum, x: aiMove.x, y: aiMove.y });
            
            if (!freshGame.hiddenMoves) freshGame.hiddenMoves = {};
            freshGame.hiddenMoves[freshGame.moveHistory.length - 1] = true;

            if (result.capturedStones.length > 0) {
                freshGame.captures[aiPlayerEnum] += result.capturedStones.length;
            }

            freshGame.koInfo = result.newKoInfo;
            freshGame.passCount = 0;
            switchTurnAndUpdateTimers(freshGame, Date.now());
            await db.saveGame(freshGame);
            await broadcast({ type: 'GAME_STATE_UPDATE', payload: { updatedGame: freshGame } });
            return freshGame;
        }

        if (aiMove.x === -3 && aiMove.y === -3) { // Sentinel for playful AI
            await db.saveGame(freshGame);
            await broadcast({ type: 'GAME_STATE_UPDATE', payload: { updatedGame: freshGame } });
            return freshGame;
        }

        if (aiMove.x === -2 && aiMove.y === -2) { // AI Resigns
            await endGame(freshGame, freshGame.currentPlayer === Player.Black ? Player.White : Player.Black, WinReason.Resign);
            await db.saveGame(freshGame);
            await broadcast({ type: 'GAME_STATE_UPDATE', payload: { updatedGame: freshGame } });
            return freshGame;
        }

        let attempts = 0;
        let result: { isValid: boolean; reason?: string; newBoardState: BoardState; capturedStones: Point[]; newKoInfo: KoInfo | null };
        do {
            result = processMove(freshGame.boardState, { ...aiMove, player: freshGame.currentPlayer }, freshGame.koInfo, freshGame.moveHistory.length);
            if (result.isValid) break;
            console.error(`[AI Error] Invalid move ${JSON.stringify(aiMove)}. Reason: ${result.reason}. Retrying...`);
            attempts++;
            if (attempts < 5) aiMove = await makeAiMove(freshGame) as Point;
        } while (attempts < 5);

        if (!result.isValid) {
            console.error(`[AI Error] AI failed to generate a valid move. AI resigns.`);
            await endGame(freshGame, freshGame.currentPlayer === Player.Black ? Player.White : Player.Black, WinReason.Resign);
            await db.saveGame(freshGame);
            await broadcast({ type: 'GAME_STATE_UPDATE', payload: { updatedGame: freshGame } });
            return undefined;
        }

        freshGame.boardState = result.newBoardState;
        freshGame.lastMove = { x: aiMove.x, y: aiMove.y };
        freshGame.moveHistory.push({ player: freshGame.currentPlayer, ...aiMove });
        freshGame.koInfo = result.newKoInfo;
        freshGame.passCount = 0;
        if (result.capturedStones.length > 0) {
             freshGame.captures[freshGame.currentPlayer] += result.capturedStones.length;
        }

        if (freshGame.autoEndTurnCount && freshGame.moveHistory.length >= freshGame.autoEndTurnCount) {
            await getGameResult(freshGame);
        } else {
            switchTurnAndUpdateTimers(freshGame, Date.now());
        }
        
        await db.saveGame(freshGame);
        await broadcast({ type: 'GAME_STATE_UPDATE', payload: { updatedGame: freshGame } });
        return freshGame;

    } catch (err) {
        console.error(`[AI TURN ERROR] for game ${gameFromAction.id}:`, err);
        return undefined;
    }
};

export const initializeStrategicGame = async (game: LiveGameSession, neg: Negotiation, now: number) => {
    // ... (implementation unchanged)
};

export const updateStrategicGameState = async (game: LiveGameSession, now: number) => {
    if (updateSharedGameState(game, now)) return;
    // ... (implementation unchanged)
};

export const handleStrategicGameAction = async (game: LiveGameSession, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult | null> => {
    const { type, payload } = action;
    const now = Date.now();
    const myPlayerEnum = user.id === game.blackPlayerId ? Player.Black : (user.id === game.whitePlayerId ? Player.White : Player.None);
    const isMyTurn = myPlayerEnum === game.currentPlayer;

    // SERVERLESS REFACTOR: `handleSharedAction` is now stateless
    const sharedResult = await handleSharedAction(game, action, user);
    if (sharedResult) {
        await db.saveGame(game);
        await broadcast({ type: 'GAME_STATE_UPDATE', payload: { updatedGame: game } });
        return sharedResult;
    }

    if (type === 'PLACE_STONE') {
        if (!isMyTurn || (game.gameStatus !== GameStatus.Playing && game.gameStatus !== GameStatus.HiddenPlacing)) {
            return { error: 'Not your turn or game is not in a playable state.' };
        }

        const { x, y, isHidden } = payload;
        const result = processMove(game.boardState, { x, y, player: game.currentPlayer }, game.koInfo, game.moveHistory.length);

        if (!result.isValid) {
            return { error: `Invalid move: ${result.reason}` };
        }
        
        game.boardState = result.newBoardState;
        game.koInfo = result.newKoInfo;
        game.lastMove = { x, y };
        game.moveHistory.push({ player: game.currentPlayer, x, y });
        game.passCount = 0;

        if (game.autoEndTurnCount && game.moveHistory.length >= game.autoEndTurnCount) {
            await getGameResult(game);
            await db.saveGame(game);
            await broadcast({ type: 'GAME_STATE_UPDATE', payload: { updatedGame: game } });
            return { clientResponse: { updatedGame: game } };
        }
        
        if (result.capturedStones.length > 0) {
            // ... capture logic ...
        }

        if (game.isAiGame || game.isSinglePlayer || game.isTowerChallenge) {
            switchTurnAndUpdateTimers(game, now); // Switch turn before calling AI
            await db.saveGame(game);
            await broadcast({ type: 'GAME_STATE_UPDATE', payload: { updatedGame: game } });
            // AI turn is now triggered by a subsequent client action, not immediately.
        } else {
            switchTurnAndUpdateTimers(game, now);
            await db.saveGame(game);
            await broadcast({ type: 'GAME_STATE_UPDATE', payload: { updatedGame: game } });
        }
    }

    if (type === 'PASS_TURN') {
        if (!isMyTurn) return { error: 'Not your turn.' };
        game.passCount++;
        game.lastMove = { x: -1, y: -1 };
        game.moveHistory.push({ player: game.currentPlayer, x: -1, y: -1 });

        if (game.passCount >= 2) {
            await getGameResult(game);
        } else {
            if (game.isAiGame || game.isSinglePlayer || game.isTowerChallenge) {
                switchTurnAndUpdateTimers(game, now);
                // AI turn triggered by client
            } else {
                switchTurnAndUpdateTimers(game, now);
            }
        }
        await db.saveGame(game);
        await broadcast({ type: 'GAME_STATE_UPDATE', payload: { updatedGame: game } });
    }
    
    // ... other handlers ...
    const nigiriResult = handleNigiriAction(game, action, user);
    if (nigiriResult) {
        await db.saveGame(game);
        await broadcast({ type: 'GAME_STATE_UPDATE', payload: { updatedGame: game } });
        return nigiriResult;
    }

    // ... and so on for other sub-handlers

    return null;
};