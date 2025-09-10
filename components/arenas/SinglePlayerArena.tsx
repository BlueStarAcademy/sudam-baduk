import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Player, GameStatus, Point, GameProps, LiveGameSession, ServerAction } from '../../types/index.js';
import GameArena from '../GameArena.js';
import PlayerPanel from '../game/PlayerPanel.js';
import GameModals from '../game/GameModals.js';
import TurnDisplay from '../game/TurnDisplay.js';
import { audioService } from '../../services/audioService.js';
import SinglePlayerControls from '../game/SinglePlayerControls.js';
import SinglePlayerInfoPanel from '../game/SinglePlayerInfoPanel.js';
import { useClientTimer } from '../../hooks/useClientTimer.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import TimeoutFoulModal from '../TimeoutFoulModal.js';

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

interface SinglePlayerArenaProps {
    session: LiveGameSession;
}

const SinglePlayerArena: React.FC<SinglePlayerArenaProps> = ({ session }) => {
    const { 
        currentUser, currentUserWithStatus, handlers, onlineUsers,
        waitingRoomChats, gameChats, negotiations, activeNegotiation, settings,
    } = useAppContext();

    const { id: gameId, gameStatus, player1, player2 } = session;

    if (!player1?.id || !player2?.id || !currentUser || !currentUserWithStatus) {
        return <div className="flex items-center justify-center min-h-screen">플레이어 정보를 불러오는 중...</div>;
    }

    const [confirmModalType, setConfirmModalType] = useState<'resign' | null>(null);
    const clientTimes = useClientTimer(session);
    const [showResultModal, setShowResultModal] = useState(false);
    const [showFinalTerritory, setShowFinalTerritory] = useState(false);
    const [showTimeoutFoulModal, setShowTimeoutFoulModal] = useState(false);
    
    const prevGameStatus = usePrevious(gameStatus);
    const prevByoyomiBlack = usePrevious(session.blackByoyomiPeriodsLeft);
    const prevLastMove = usePrevious(session.lastMove);

    useEffect(() => {
        const gameHasJustEnded =
            (gameStatus === 'ended' || gameStatus === 'no_contest') &&
            prevGameStatus !== 'ended' &&
            prevGameStatus !== 'no_contest' &&
            prevGameStatus !== 'rematch_pending';

        if (gameHasJustEnded) {
            setShowResultModal(true);
            setShowFinalTerritory(true);
            if (session.winner === Player.Black) { // Human is always black
                audioService.gameWin();
            } else {
                audioService.gameLose();
            }
        }
    }, [gameStatus, prevGameStatus, session.winner]);

    useEffect(() => {
        if (session.lastMove && session.lastMove.x !== -1 && JSON.stringify(session.lastMove) !== JSON.stringify(prevLastMove)) {
            audioService.placeStone();
        }
    }, [session.lastMove, prevLastMove]);

    const myPlayerEnum = useMemo(() => Player.Black, []);
    
    const isMyTurn = useMemo(() => {
        return myPlayerEnum === session.currentPlayer;
    }, [myPlayerEnum, session.currentPlayer]);

    useEffect(() => {
        if (prevByoyomiBlack !== undefined && session.blackByoyomiPeriodsLeft < prevByoyomiBlack) {
            audioService.timeoutFoul();
            setShowTimeoutFoulModal(true);
        }
    }, [session.blackByoyomiPeriodsLeft, prevByoyomiBlack]);

    const handleBoardClick = useCallback((x: number, y: number) => {
        if (!isMyTurn) return;
        handlers.handleAction({ type: 'PLACE_STONE', payload: { gameId, x, y } } as ServerAction);
    }, [isMyTurn, gameId, handlers.handleAction]);

    const gameProps: GameProps = {
        session, onAction: handlers.handleAction, currentUser: currentUserWithStatus, waitingRoomChat: waitingRoomChats['global'] || [],
        gameChat: gameChats[session.id] || [], isSpectator: false, onlineUsers, activeNegotiation, negotiations: Object.values(negotiations), onViewUser: handlers.openViewingUser
    };

    const backgroundClass = 'bg-academy-bg';
    
    return (
        <div className={`w-full h-dvh flex flex-col px-4 py-1 lg:p-4 ${backgroundClass} text-stone-200`}>
            <button onClick={handlers.openSettingsModal} className="absolute top-2 right-2 z-30 p-2 rounded-lg text-xl hover:bg-black/20 transition-colors" title="설정">⚙️</button>
            {showTimeoutFoulModal && <TimeoutFoulModal gameMode={session.mode} gameStatus={session.gameStatus} onClose={() => setShowTimeoutFoulModal(false)} />}
            
            <main className="flex-1 flex flex-col items-center justify-center gap-2 lg:gap-4 max-w-5xl w-full mx-auto min-h-0">
                <div className="w-full flex-shrink-0">
                    <PlayerPanel {...gameProps} clientTimes={clientTimes.clientTimes} isSinglePlayer={true} />
                </div>
                <div className="flex-1 w-full relative">
                    <div className="absolute inset-0">
                         <GameArena 
                            {...gameProps}
                            isMyTurn={isMyTurn} 
                            myPlayerEnum={myPlayerEnum} 
                            handleBoardClick={handleBoardClick} 
                            isItemModeActive={false} 
                            showTerritoryOverlay={showFinalTerritory} 
                            isMobile={false}
                            myRevealedMoves={[]}
                            showLastMoveMarker={settings.features.lastMoveMarker}
                        />
                    </div>
                </div>
                <div className="w-full flex flex-col-reverse md:flex-row gap-2 lg:gap-4 items-stretch flex-shrink-0">
                    <div className="flex-1">
                        <SinglePlayerInfoPanel session={session} />
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0 w-full md:w-auto">
                        <TurnDisplay session={session} />
                        <SinglePlayerControls {...gameProps} currentUser={currentUserWithStatus} />
                    </div>
                </div>
            </main>

             <GameModals 
                {...gameProps}
                confirmModalType={confirmModalType}
                onHideConfirmModal={() => setConfirmModalType(null)}
                showResultModal={showResultModal}
                onCloseResults={() => setShowResultModal(false)}
            />
        </div>
    );
};

export default SinglePlayerArena;