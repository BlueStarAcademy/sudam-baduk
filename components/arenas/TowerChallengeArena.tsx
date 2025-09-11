import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Player, GameStatus, Point, GameProps, LiveGameSession, ServerAction } from '../../types.js';
import GameArena from '../GameArena.js';
import PlayerPanel from '../game/PlayerPanel.js';
import GameModals from '../game/GameModals.js';
import TurnDisplay from '../game/TurnDisplay.js';
import { audioService } from '../../services/audioService.js';
import TowerChallengeControls from '../game/TowerChallengeControls.js';
import TowerChallengeInfoPanel from '../game/TowerChallengeInfoPanel.js';
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

interface TowerChallengeArenaProps {
    session: LiveGameSession;
}

const TowerChallengeArena: React.FC<TowerChallengeArenaProps> = ({ session }) => {
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
    
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    useEffect(() => {
        const checkIsMobile = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', checkIsMobile);
        return () => window.removeEventListener('resize', checkIsMobile);
    }, []);

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
    
    const backgroundClass = useMemo(() => {
        return session.floor === 100 ? 'bg-tower-100' : 'bg-tower-default';
    }, [session.floor]);
    
    return (
        <div className={`w-full h-dvh flex flex-col p-2 lg:p-4 ${backgroundClass} text-stone-200`}>
            {showTimeoutFoulModal && <TimeoutFoulModal gameMode={session.mode} gameStatus={session.gameStatus} onClose={() => setShowTimeoutFoulModal(false)} />}
            
            <div className="flex-1 flex flex-col gap-2 min-h-0 max-w-7xl w-full mx-auto">
                 <main className="flex-1 flex flex-col items-center justify-center min-w-0 min-h-0 gap-2">
                    <div className="w-full flex-shrink-0">
                        <PlayerPanel {...gameProps} clientTimes={clientTimes.clientTimes} isTowerChallenge={true} />
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
                                isMobile={isMobile}
                                myRevealedMoves={[]}
                                showLastMoveMarker={settings.features.lastMoveMarker}
                            />
                        </div>
                    </div>
                    <div className="w-full flex-shrink-0">
                        <TurnDisplay session={session} />
                    </div>
                     <div className="w-full flex-shrink-0 flex flex-col lg:flex-row gap-2">
                        {!isMobile && (
                            <div className="flex-1 min-h-[120px]">
                               <TowerChallengeInfoPanel session={session} onOpenSettings={handlers.openSettingsModal} />
                            </div>
                        )}
                        <div className={isMobile ? "w-full" : "lg:w-1/3"}>
                            <TowerChallengeControls {...gameProps} currentUser={currentUserWithStatus} />
                        </div>
                    </div>
                </main>
                 {isMobile && (
                    <>
                        <div className="absolute top-1/2 -translate-y-1/2 right-0 z-20">
                            <button 
                                onClick={() => setIsMobileSidebarOpen(true)} 
                                className="w-8 h-12 bg-secondary/80 backdrop-blur-sm rounded-l-lg flex items-center justify-center text-primary shadow-lg"
                                aria-label="정보 보기"
                            >
                                <span className="relative font-bold text-lg">{'<'}</span>
                            </button>
                        </div>

                        <div className={`fixed top-0 right-0 h-full w-[280px] bg-primary shadow-2xl z-50 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                            <div className="flex flex-col h-full p-2">
                                 <button onClick={() => setIsMobileSidebarOpen(false)} className="self-end text-2xl font-bold text-tertiary hover:text-primary">&times;</button>
                                 <div className="flex-grow">
                                    <TowerChallengeInfoPanel session={session} onOpenSettings={handlers.openSettingsModal} />
                                 </div>
                            </div>
                        </div>
                        {isMobileSidebarOpen && <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setIsMobileSidebarOpen(false)}></div>}
                    </>
                )}
            </div>

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

export default TowerChallengeArena;