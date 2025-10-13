import React, { useState, useMemo, useEffect, useRef } from 'react';
// FIX: Separate enum and type imports, and correct import path.
import { Player, GameStatus, GameMode } from '../../types/index.js';
import type { GameProps, Point } from '../../types/index.js';
import { getGoLogic } from '../../utils/goLogic';
import { audioService } from '../../services/audioService.js';
import GoBoard from '../GoBoard.js';

interface DiceGoArenaProps extends GameProps {
    isMyTurn: boolean;
    showLastMoveMarker: boolean;
    optimisticStone?: Point | null;
    setOptimisticStone: (stone: Point | null) => void;
    setIsSubmittingMove: (isSubmitting: boolean) => void;
}

const DiceGoArena: React.FC<DiceGoArenaProps> = (props) => {
    const { session, onAction, currentUser, isSpectator, isMyTurn, showLastMoveMarker, optimisticStone, setOptimisticStone, setIsSubmittingMove } = props;
    const { id: gameId, boardState, settings, lastMove, winningLine, gameStatus, currentPlayer, blackPlayerId, whitePlayerId, player1, player2, animation } = session;
    
    const myPlayerEnum = blackPlayerId === currentUser.id ? Player.Black : (whitePlayerId === currentUser.id ? Player.White : Player.None);
    
    const players = [player1, player2];
    const blackPlayer = players.find(p => p.id === blackPlayerId) || null;
    const whitePlayer = players.find(p => p.id === whitePlayerId) || null;

    const highlightedPoints = useMemo(() => {
        if (gameStatus !== 'dice_placing' || !isMyTurn) return [];
        const anyWhiteStones = boardState.flat().some(s => s === Player.White);
        if (!anyWhiteStones) {
            // If no white stones, all empty points are valid.
            const points: Point[] = [];
            for (let y = 0; y < settings.boardSize; y++) {
                for (let x = 0; x < settings.boardSize; x++) {
                    if (boardState[y][x] === Player.None) {
                        points.push({ x, y });
                    }
                }
            }
            return points;
        }
        // FIX: Pass game.settings to getGoLogic instead of the entire game session.
        return getGoLogic(session.settings).getAllLibertiesOfPlayer(Player.White, boardState);
    }, [session, gameStatus, isMyTurn, boardState, settings.boardSize]);

    const handleBoardClick = async (x: number, y: number) => {
        if (!isMyTurn || gameStatus !== 'dice_placing') return;
        
        const isValidMove = highlightedPoints.some((p: Point) => p.x === x && p.y === y);
        if (!isValidMove) {
            return;
        }
        
        setIsSubmittingMove(true);
        setOptimisticStone({ x, y });
        const result = await onAction({ type: 'DICE_PLACE_STONE', payload: { gameId, x, y } });
        if (result && !result.success) {
            setOptimisticStone(null);
            setIsSubmittingMove(false);
        }
    };

    return (
        <div className="relative w-full h-full flex flex-col items-center justify-center">
            <GoBoard
                boardState={boardState}
                boardSize={settings.boardSize}
                onBoardClick={handleBoardClick}
                lastMove={lastMove}
                isBoardDisabled={!isMyTurn || gameStatus !== 'dice_placing'}
                stoneColor={Player.Black}
                winningLine={winningLine}
                mode={session.mode}
                mixedModes={session.settings.mixedModes}
                myPlayerEnum={myPlayerEnum}
                gameStatus={gameStatus}
                currentPlayer={currentPlayer}
                highlightedPoints={highlightedPoints}
                highlightStyle="ring"
                isSpectator={isSpectator}
                currentUser={currentUser}
                blackPlayerNickname={blackPlayer?.nickname || '흑'}
                whitePlayerNickname={whitePlayer?.nickname || '백'}
                isItemModeActive={false}
                animation={animation}
                showLastMoveMarker={showLastMoveMarker}
                optimisticStone={optimisticStone ?? null}
            />
        </div>
    );
};

export default DiceGoArena;