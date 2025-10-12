import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Player, GameStatus, Point, GameProps, LiveGameSession, ServerAction, SinglePlayerLevel, GameMode, User, UserWithStatus, TowerRank } from '../../types/index.js';
import GameArena from '../GameArena.js';
import Sidebar from '../game/Sidebar.js';
import PlayerPanel from '../game/PlayerPanel.js';
import GameModals from '../game/GameModals.js';
import TurnDisplay from '../game/TurnDisplay.js';
import { audioService } from '../../services/audioService.js';
import TowerChallengeControls from '../game/TowerChallengeControls.js';
import TowerChallengeInfoPanel from '../game/TowerChallengeInfoPanel.js';
import TowerStatusPanel from '../game/TowerStatusPanel.js';
import { useClientTimer } from '../../hooks/useClientTimer.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import TurnCounterPanel from '../game/TurnCounterPanel.js';
import { TOWER_STAGES, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants/index.js';
import SinglePlayerIntroModal from '../modals/SinglePlayerIntroModal.js';
import TowerAddStonesPromptModal from '../modals/TowerAddStonesPromptModal.js';
import { processMove } from '../../utils/goLogic';
import Button from '../Button.js';
import CurrencyPanel from '../game/CurrencyPanel.js';
import ChatWindow from '../waiting-room/ChatWindow.js';
import WisdomPanel from '../game/WisdomPanel.js';

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

export const TowerChallengeArena: React.FC<TowerChallengeArenaProps> = ({ session }) => {
    const { 
        currentUser,
        currentUserWithStatus,
        handlers,
        waitingRoomChats,
        gameChats,
        negotiations,
        activeNegotiation,
        onlineUsers,
        settings,
    } = useAppContext();

    const { id: gameId, gameStatus, player1, player2, blackByoyomiPeriodsLeft, blackTimeLeft, settings: gameSettings, mode, currentPlayer, moveHistory } = session;

    if (!currentUser || !currentUserWithStatus) {
        return <div className="flex items-center justify-center min-h-screen">플레이어 정보를 불러오는 중...</div>;
    }
    
    const gameProps: GameProps = useMemo(() => ({
        session,
        onAction: handlers.handleAction,
        currentUser: currentUserWithStatus!,
        waitingRoomChat: waitingRoomChats['global'] || [],
        gameChat: [],
        isSpectator: false,
        onlineUsers,
        activeNegotiation,
        negotiations: Object.values(negotiations),
        onViewUser: handlers.openViewingUser,
    }), [session, handlers, currentUserWithStatus, waitingRoomChats, onlineUsers, activeNegotiation, negotiations]);

    const [confirmModalType, setConfirmModalType] = useState<'resign' | null>(null);
    const [showResultModal, setShowResultModal] = useState(false);
    const [showFinalTerritory, setShowFinalTerritory] = useState(false);
    const [optimisticStone, setOptimisticStone] = useState<Point | null>(null);
    const [isSubmittingMove, setIsSubmittingMove] = useState(false);
    const [pendingMove, setPendingMove] = useState<Point | null>(null);
    
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isPauseCooldown, setIsPauseCooldown] = useState(false);

    const isItemModeActive = useMemo(() => 
        ['hidden_placing', 'scanning', 'missile_selecting', 'ai_hidden_thinking'].includes(session.gameStatus), 
        [session.gameStatus]
    );
    
    const handleIntroConfirm = () => {
        return handlers.handleAction({ type: 'CONFIRM_SP_INTRO', payload: { gameId: session.id } });
    };

    useEffect(() => {
        const checkIsMobile = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', checkIsMobile);
        return () => window.removeEventListener('resize', checkIsMobile);
    }, []);

    const prevGameStatus = usePrevious(gameStatus);
    const prevLastMove = usePrevious(session.lastMove);

    useEffect(() => {
        setOptimisticStone(null);
        setIsSubmittingMove(false);
    }, [session.moveHistory]);

    const handleExitToLobby = useCallback(() => {
        if (['ended', 'no_contest'].includes(session.gameStatus)) {
            handlers.setPostGameRedirect('#/towerchallenge');
            handlers.handleAction({ type: 'LEAVE_AI_GAME', payload: { gameId: session.id } });
        } else {
            setConfirmModalType('resign');
        }
    }, [handlers, session.id, session.gameStatus]);
    
    const handlePauseToggle = () => {
        if (isPauseCooldown) return;
        const actionType = session.gameStatus === GameStatus.Paused ? 'RESUME_GAME' : 'PAUSE_GAME';
        handlers.handleAction({ type: actionType, payload: { gameId: session.id } });
        setIsPauseCooldown(true);
        setTimeout(() => setIsPauseCooldown(false), 5000);
    };

    useEffect(() => {
        const gameHasJustEnded =
            (gameStatus === GameStatus.Ended || gameStatus === GameStatus.NoContest) &&
            prevGameStatus !== GameStatus.Ended &&
            prevGameStatus !== GameStatus.NoContest &&
            prevGameStatus !== GameStatus.RematchPending;

        if (gameHasJustEnded) {
            setShowResultModal(true);
            setShowFinalTerritory(true);
            if (session.winner === Player.Black) { 
                audioService.gameWin();
            } else {
                audioService.gameLose();
            }
        }
    }, [gameStatus, prevGameStatus, session.winner]);
    
    useEffect(() => {
        if (session.lastMove && session.lastMove.x !== -1 && JSON.stringify(session.lastMove) !== JSON.stringify(prevLastMove)) {
            if (SPECIAL_GAME_MODES.some(m => m.mode === session.mode)) audioService.placeStone();
        }
    }, [session.lastMove, prevLastMove, session.mode]);

    const myPlayerEnum = useMemo(() => Player.Black, []);
    const clientTimes = useClientTimer(session, myPlayerEnum);
    
    const isMyTurn = useMemo(() => myPlayerEnum === session.currentPlayer, [myPlayerEnum, session.currentPlayer]);
    
    useEffect(() => {
        if (!isMyTurn) {
            setIsSubmittingMove(false);
        }
    }, [isMyTurn]);

    const prevMoveCount = usePrevious(moveHistory?.length);
    const prevByoyomiBlack = usePrevious(blackByoyomiPeriodsLeft);
    const warningSoundPlayedForTurn = useRef(false);

    useEffect(() => {
        const isGameOver = ['ended', 'no_contest'].includes(gameStatus);
        const hasTurnChanged = prevMoveCount !== undefined && moveHistory && moveHistory.length > prevMoveCount;
        const byoyomiUsed = prevByoyomiBlack !== undefined && blackByoyomiPeriodsLeft < prevByoyomiBlack;

        if (!isMyTurn || hasTurnChanged || isGameOver || byoyomiUsed) {
            if (warningSoundPlayedForTurn.current) {
                audioService.stopTimerWarning();
                warningSoundPlayedForTurn.current = false;
            }
        }
        
        if (isMyTurn && !isGameOver) {
            const myTime = clientTimes.black;
            const myMainTimeLeft = blackTimeLeft;
            const hasByoyomi = (gameSettings.byoyomiCount ?? 0) > 0;
            const isFischer = (gameSettings.timeIncrement ?? 0) > 0;
            const isInByoyomi = myMainTimeLeft <= 0 && hasByoyomi && !isFischer;
            
            // For SP/Tower games, only byoyomi and fischer modes should have warnings.
            const shouldWarn = isInByoyomi || isFischer;

            if (shouldWarn && myTime <= 10 && myTime > 0 && !warningSoundPlayedForTurn.current) {
                audioService.timerWarning();
                warningSoundPlayedForTurn.current = true;
            }
        }
    }, [isMyTurn, clientTimes.black, moveHistory, prevMoveCount, gameStatus, blackByoyomiPeriodsLeft, prevByoyomiBlack, blackTimeLeft, gameSettings.byoyomiCount, gameSettings.timeIncrement]);

    const isSpectator = false;

    const handleBoardClick = useCallback(async (x: number, y: number) => {
        if (isSubmittingMove || isSpectator || session.gameStatus === 'missile_animating') return;

        // Client-side move validation for standard Go moves
        if (['playing', 'hidden_placing'].includes(gameStatus) && isMyTurn) {
            const validationResult = processMove(
                session.boardState,
                { x, y, player: Player.Black },
                session.koInfo,
                session.moveHistory.length
            );
            if (!validationResult.isValid) {
                console.log(`Client-side validation failed: ${validationResult.reason}`);
                return;
            }
        }

        if (isMobile && settings.features.mobileConfirm && isMyTurn && !isItemModeActive) {
            if (pendingMove && pendingMove.x === x && pendingMove.y === y) return;
            setPendingMove({ x, y });
            return;
        }
        
        let actionType: ServerAction['type'] | null = null;
        let payload: any = { gameId, x, y };

        if ((mode === GameMode.Omok || mode === GameMode.Ttamok) && gameStatus === 'playing' && isMyTurn) {
            actionType = 'PLACE_STONE';
        } else if (gameStatus === 'scanning' && isMyTurn) {
            audioService.stopScanBgm();
            actionType = 'SCAN_BOARD';
        } else if (gameStatus === 'base_placement') {
            const myStones = currentUser!.id === player1.id ? session.baseStones_p1 : session.baseStones_p2;
            if ((myStones?.length || 0) < (session.settings.baseStones || 4)) actionType = 'PLACE_BASE_STONE';
        } else if (['playing', 'hidden_placing'].includes(gameStatus) && isMyTurn) {
            actionType = 'PLACE_STONE'; 
            payload.isHidden = gameStatus === 'hidden_placing';
            if (payload.isHidden) audioService.stopScanBgm();
        }

        if (actionType) {
            setIsSubmittingMove(true);
            setOptimisticStone({x, y});
            const result = await handlers.handleAction({ type: actionType, payload } as ServerAction);
            if (result && !result.success) {
                setOptimisticStone(null);
                 setIsSubmittingMove(false);
            }
        }
    }, [isSubmittingMove, isSpectator, session, gameStatus, isMyTurn, handlers, isMobile, settings.features.mobileConfirm, pendingMove, isItemModeActive, gameId, mode, currentUser, player1.id]);

    const handleConfirmMove = useCallback(async () => {
        audioService.stopTimerWarning();
        if (!pendingMove || isSubmittingMove) return;
        
        let actionType: ServerAction['type'] | null = null;
        let payload: any = { gameId: session.id, x: pendingMove.x, y: pendingMove.y };

        if ((mode === GameMode.Omok || mode === GameMode.Ttamok) && gameStatus === 'playing' && isMyTurn) {
            actionType = 'PLACE_STONE';
        } else if (['playing', 'hidden_placing'].includes(gameStatus) && isMyTurn) {
            actionType = 'PLACE_STONE'; 
            payload.isHidden = gameStatus === 'hidden_placing';
        }
        
        if (actionType) {
            setIsSubmittingMove(true);
            setOptimisticStone({x: pendingMove.x, y: pendingMove.y});
            const result = await handlers.handleAction({ type: actionType, payload } as ServerAction);
            if (result && !result.success) {
                setOptimisticStone(null);
                setIsSubmittingMove(false);
            }
        }
        
        setPendingMove(null);
    }, [pendingMove, session.id, handlers, gameStatus, isMyTurn, mode, isSubmittingMove]);
    
    const handleCancelMove = useCallback(() => setPendingMove(null), []);
    
    const backgroundClass = useMemo(() => {
        if (session.floor === 100) return 'bg-tower-100';
        return 'bg-tower-default';
    }, [session.floor]);

    const middlePanelComponent = useMemo(() => {
        if (session.autoEndTurnCount && session.autoEndTurnCount > 0) {
            return <TurnCounterPanel session={session} />;
        }
        return <TowerStatusPanel session={session} />;
    }, [session]);
    
    const isPaused = session.gameStatus === GameStatus.Paused;

    const gameArenaProps = {
        ...gameProps,
        isMyTurn,
        myPlayerEnum,
        handleBoardClick,
        isItemModeActive,
        showTerritoryOverlay: showFinalTerritory,
        isMobile,
        myRevealedMoves: session.revealedHiddenMoves?.[currentUser!.id] || [],
        showLastMoveMarker: settings.features.lastMoveMarker,
        optimisticStone,
        setOptimisticStone,
        setIsSubmittingMove,
    };
    
    return (
        <div className={`w-full h-full flex flex-col p-2 lg:p-4 text-stone-200 overflow-hidden relative ${backgroundClass}`}>
            {session.gameStatus === GameStatus.SinglePlayerIntro && (
                <SinglePlayerIntroModal session={session} onConfirm={handleIntroConfirm} />
            )}
            {session.promptForMoreStones && !['ended', 'no_contest'].includes(session.gameStatus) && (
                <TowerAddStonesPromptModal session={session} onAction={handlers.handleAction} />
            )}
            
            <main className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">
                <main className="flex-1 flex flex-col items-center justify-center min-w-0 min-h-0 gap-2">
                    <div className="w-full flex-shrink-0">
                        <PlayerPanel 
                            {...gameProps} 
                            clientTimes={clientTimes} 
                            isTowerChallenge={true}
                            middleComponent={middlePanelComponent}
                        />
                    </div>
                    {isPaused ? (
                        <div className="flex-1 w-full flex items-center justify-center text-primary text-2xl font-bold">
                            일시정지됨
                        </div>
                    ) : (
                        <div className="flex-1 w-full flex items-center justify-center min-h-0">
                             <div className="relative w-full h-full max-w-full max-h-full aspect-square">
                                <div className="absolute inset-0">
                                    <GameArena {...gameArenaProps} />
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="w-full flex-shrink-0 flex flex-col lg:flex-row gap-2">
                        <div className="lg:w-full flex flex-col gap-2">
                            <div className="flex-1">
                                <TurnDisplay session={session} currentUser={currentUserWithStatus} />
                            </div>
                            <TowerChallengeControls
                                {...gameProps}
                                currentUser={currentUserWithStatus}
                                pendingMove={pendingMove}
                                onConfirmMove={handleConfirmMove}
                                onCancelMove={handleCancelMove}
                                setConfirmModalType={setConfirmModalType}
                            />
                        </div>
                    </div>
                </main>
                {!isMobile && (
                     <aside className="w-full lg:w-[320px] xl:w-[360px] flex-shrink-0">
                        <Sidebar
                            {...gameProps}
                            onLeaveOrResign={handleExitToLobby}
                            isNoContestLeaveAvailable={false}
                            onOpenSettings={handlers.openSettingsModal}
                            isPausable={true}
                            isPaused={isPaused}
                            onPauseToggle={handlePauseToggle}
                        />
                    </aside>
                )}
                {isMobile && (
                    <>
                        <div className="absolute top-1/2 -translate-y-1/2 right-0 z-20">
                            <button 
                                onClick={() => setIsMobileSidebarOpen(true)} 
                                className="w-8 h-12 bg-secondary/80 backdrop-blur-sm rounded-l-lg flex items-center justify-center text-primary shadow-lg"
                                aria-label="메뉴 열기"
                            >
                                <span className="relative font-bold text-lg">{'<'}</span>
                            </button>
                        </div>

                        <div className={`fixed top-0 right-0 h-full w-[280px] bg-primary shadow-2xl z-50 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                            <button onClick={() => setIsMobileSidebarOpen(false)} className="self-end text-2xl font-bold text-tertiary hover:text-primary mb-2">&times;</button>
                             <Sidebar
                                {...gameProps}
                                onLeaveOrResign={handleExitToLobby}
                                isNoContestLeaveAvailable={false}
                                onOpenSettings={handlers.openSettingsModal}
                                isPausable={true}
                                isPaused={isPaused}
                                onPauseToggle={handlePauseToggle}
                                onClose={() => setIsMobileSidebarOpen(false)}
                            />
                        </div>
                        {isMobileSidebarOpen && <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setIsMobileSidebarOpen(false)}></div>}
                    </>
                )}
            </main>

             <GameModals 
                {...gameProps}
                confirmModalType={confirmModalType}
                onHideConfirmModal={() => setConfirmModalType(null)}
                showResultModal={showResultModal}
                onCloseResults={(cleanupAndRedirect = true) => {
                    setShowResultModal(false);
                    if (cleanupAndRedirect) {
                        handlers.setPostGameRedirect('#/towerchallenge');
                        handlers.handleAction({ type: 'LEAVE_AI_GAME', payload: { gameId: session.id } });
                    }
                }}
            />
        </div>
    );
};