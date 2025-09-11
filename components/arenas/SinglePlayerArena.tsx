
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Player, GameStatus, Point, GameProps, LiveGameSession, ServerAction, SinglePlayerLevel } from '../../types.js';
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
import TurnCounterPanel from '../game/TurnCounterPanel.js';
import { SINGLE_PLAYER_STAGES } from '../../constants.js';

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
    
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    const isItemModeActive = useMemo(() => 
        ['hidden_placing', 'scanning', 'missile_selecting'].includes(session.gameStatus), 
        [session.gameStatus]
    );

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

    const stageInfo = useMemo(() => SINGLE_PLAYER_STAGES.find(s => s.id === session.stageId), [session.stageId]);

    const backgroundClass = useMemo(() => {
        if (!stageInfo) return 'bg-academy-bg';
        switch (stageInfo.level) {
            case SinglePlayerLevel.입문:
                return 'bg-academy-bg';
            case SinglePlayerLevel.초급:
                return 'bg-wood-pattern';
            case SinglePlayerLevel.중급:
                return 'bg-tower-default';
            case SinglePlayerLevel.고급:
                return 'bg-tower-100';
            case SinglePlayerLevel.유단자:
                return 'bg-tertiary';
            default:
                return 'bg-academy-bg';
        }
    }, [stageInfo]);
    
    const isTurnLimitedGame = !!session.autoEndTurnCount && session.autoEndTurnCount > 0;
    
    return (
        <div className={`w-full h-dvh flex flex-col p-2 lg:p-4 ${backgroundClass} text-stone-200`}>
            {showTimeoutFoulModal && <TimeoutFoulModal gameMode={session.mode} gameStatus={session.gameStatus} onClose={() => setShowTimeoutFoulModal(false)} />}
            
            <div className="flex-1 flex flex-col gap-2 min-h-0 max-w-7xl w-full mx-auto">
                 <main className="flex-1 flex flex-col items-center justify-center min-w-0 min-h-0 gap-2">
                    <div className="w-full flex-shrink-0">
                        <PlayerPanel {...gameProps} clientTimes={clientTimes.clientTimes} isSinglePlayer={true} />
                    </div>
                    <div className="flex-1 w-full flex flex-row items-stretch gap-4 min-h-0">
                        <div className="flex-1 relative">
                             <GameArena 
                                {...gameProps}
                                isMyTurn={isMyTurn} 
                                myPlayerEnum={myPlayerEnum} 
                                handleBoardClick={handleBoardClick} 
                                isItemModeActive={isItemModeActive} 
                                showTerritoryOverlay={showFinalTerritory} 
                                isMobile={isMobile}
                                myRevealedMoves={[]}
                                showLastMoveMarker={settings.features.lastMoveMarker}
                            />
                        </div>
                    </div>
                    <div className="w-full flex-shrink-0 flex flex-col lg:flex-row gap-2">
                        <div className="flex-1 min-h-[120px]">
                           <SinglePlayerInfoPanel session={session} onOpenSettings={handlers.openSettingsModal} />
                        </div>
                        <div className="lg:w-1/3 flex flex-col gap-2">
                             <div className="flex gap-2">
                                <div className="flex-1">
                                    <TurnDisplay session={session} />
                                </div>
                                {isTurnLimitedGame && (
                                    <div className="w-24 flex-shrink-0">
                                        <TurnCounterPanel session={session} />
                                    </div>
                                )}
                            </div>
                            <SinglePlayerControls {...gameProps} currentUser={currentUserWithStatus} />
                        </div>
                    </div>
                </main>
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

export default SinglePlayerArena;
