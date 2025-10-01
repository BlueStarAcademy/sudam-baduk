import React, { useMemo } from 'react';
// FIX: Separate enum and type imports, and correct import path.
import { Player, GameMode } from '../../types/index.js';
import type { GameProps, Point } from '../../types/index.js';
import GoBoard from '../GoBoard.js';
import { getGoLogic } from '../../utils/goLogic.js';

interface ThiefGoArenaProps extends GameProps {
    isMyTurn: boolean;
    showLastMoveMarker: boolean;
    optimisticStone?: Point | null;
    setOptimisticStone: (stone: Point | null) => void;
    setIsSubmittingMove: (isSubmitting: boolean) => void;
}

const ThiefGoArena: React.FC<ThiefGoArenaProps> = (props) => {
    const { session, onAction, currentUser, isMyTurn, isSpectator, showLastMoveMarker, optimisticStone, setOptimisticStone, setIsSubmittingMove } = props;
    const { id: gameId, boardState, settings, lastMove, winningLine, gameStatus, currentPlayer, blackPlayerId, whitePlayerId, thiefPlayerId, player1, player2 } = session;
    
    const myPlayerEnum = blackPlayerId === currentUser.id ? Player.Black : (whitePlayerId === currentUser.id ? Player.White : Player.None);
    const myRole = currentUser.id === thiefPlayerId ? '도둑' : '경찰';
    
    const players = [player1, player2];
    const blackPlayer = players.find(p => p.id === blackPlayerId) || null;
    const whitePlayer = players.find(p => p.id === whitePlayerId) || null;

    const handleBoardClick = async (x: number, y: number) => {
        if (!isMyTurn || gameStatus !== 'thief_placing') return;
        setIsSubmittingMove(true);
        setOptimisticStone({ x, y });
        const result = await onAction({ type: 'THIEF_PLACE_STONE', payload: { gameId, x, y } });
        if (result && !result.success) {
            setOptimisticStone(null);
            setIsSubmittingMove(false);
        }
    };

    const highlightedPoints = useMemo(() => {
        if (gameStatus !== 'thief_placing' || !isMyTurn) return [];
    
        const logic = getGoLogic(session);
        const allEmptyPoints = () => {
            const points: Point[] = [];
            for (let y = 0; y < settings.boardSize; y++) {
                for (let x = 0; x < settings.boardSize; x++) {
                    if (boardState[y][x] === Player.None) {
                        points.push({ x, y });
                    }
                }
            }
            return points;
        };
    
        if (myRole === '도둑') {
            const noBlackStonesOnBoard = !boardState.flat().includes(Player.Black);
            const canPlaceFreely = (session.turnInRound === 1 || noBlackStonesOnBoard);
            if (canPlaceFreely) {
                return allEmptyPoints();
            } else {
                const blackStonesOnBoard = boardState.flat().includes(Player.Black);
                if (blackStonesOnBoard) {
                    const liberties = logic.getAllLibertiesOfPlayer(Player.Black, boardState);
                    return liberties.length > 0 ? liberties : allEmptyPoints();
                } else {
                    return allEmptyPoints();
                }
            }
        } else { // Police
            const blackStonesOnBoard = boardState.flat().includes(Player.Black);
            if (blackStonesOnBoard) {
                const liberties = logic.getAllLibertiesOfPlayer(Player.Black, boardState);
                return liberties.length > 0 ? liberties : allEmptyPoints();
            } else {
                return allEmptyPoints();
            }
        }
    }, [gameStatus, isMyTurn, session, boardState, myRole, settings.boardSize]);
    
    return (
        <div className="relative w-full h-full">
            <GoBoard
                boardState={boardState}
                boardSize={settings.boardSize}
                onBoardClick={handleBoardClick}
                lastMove={lastMove}
                isBoardDisabled={!isMyTurn || gameStatus !== 'thief_placing'}
                stoneColor={myPlayerEnum}
                winningLine={winningLine}
                mode={session.mode}
                mixedModes={session.settings.mixedModes}
                myPlayerEnum={myPlayerEnum}
                gameStatus={gameStatus}
                currentPlayer={currentPlayer}
                highlightedPoints={highlightedPoints}
                isSpectator={isSpectator}
                currentUser={currentUser}
                blackPlayerNickname={blackPlayer?.nickname || '흑'}
                whitePlayerNickname={whitePlayer?.nickname || '백'}
                isItemModeActive={false}
                showLastMoveMarker={showLastMoveMarker}
                optimisticStone={optimisticStone ?? null}
            />
        </div>
    );
};

export default ThiefGoArena;