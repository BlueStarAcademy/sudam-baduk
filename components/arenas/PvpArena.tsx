import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Player, GameMode, GameStatus, Point, GameProps, LiveGameSession, AlkkagiStone, ServerAction, User, UserWithStatus, WinReason } from '../../types/index.js';
import GameArena from '../GameArena.js';
import Sidebar from '../game/Sidebar.js';
import PlayerPanel from '../game/PlayerPanel.js';
import GameModals from '../game/GameModals.js';
import TurnDisplay from '../game/TurnDisplay.js';
import { audioService } from '../../services/audioService.js';
import { TerritoryAnalysisWindow } from '../game/AnalysisWindows.js';
import GameControls from '../game/GameControls.js';
import { PLAYFUL_GAME_MODES, SPECIAL_GAME_MODES, SLUG_BY_GAME_MODE } from '../../constants/index.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import DisconnectionModal from '../DisconnectionModal.js';
import { useClientTimer } from '../../hooks/useClientTimer.js';
import TurnCounterPanel from '../game/TurnCounterPanel.js';
import { processMove } from '../../utils/goLogic';

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

interface PvpArenaProps {
    session: LiveGameSession;
}

const PvpArena: React.FC<PvpArenaProps> = ({ session }) => {
    const { 
        currentUser,
        currentUserWithStatus,
        handlers,
        onlineUsers,
        waitingRoomChats,
        gameChats,
        negotiations,
        activeNegotiation,
        settings,
    } = useAppContext();

    const { id: gameId, currentPlayer, gameStatus, player1, player2, mode, blackPlayerId, whitePlayerId } = session;
    
    const [confirmModalType, setConfirmModalType] = useState<'resign' | null>(null);
    
    const [showResultModal, setShowResultModal] = useState(false);
    const [showFinalTerritory, setShowFinalTerritory] = useState(false);
    const [justScanned, setJustScanned] = useState(false);
    const [pendingMove, setPendingMove] = useState<Point | null>(null);
    const [optimisticStone, setOptimisticStone] = useState<Point | null>(null);
    const [isAnalysisActive, setIsAnalysisActive] = useState(false);
    const [isSubmittingMove, setIsSubmittingMove] = useState(false);
    
    const prevGameStatus = usePrevious(gameStatus);
    const prevCurrentPlayer = usePrevious(currentPlayer);
    const prevCaptures = usePrevious(session.captures);
    const prevAnimationType = usePrevious(session.animation?.type);
    const warningSoundPlayedForTurn = useRef(false);
    const prevMoveCount = usePrevious(session.moveHistory?.length);
    const prevByoyomiBlack = usePrevious(session.blackByoyomiPeriodsLeft);
    const prevByoyomiWhite = usePrevious(session.whiteByoyomiPeriodsLeft);

    const isSpectator = useMemo(() => currentUserWithStatus?.status === 'spectating', [currentUserWithStatus]);

    const myPlayerEnum = useMemo(() => {
        if (isSpectator) return Player.None;
        if (blackPlayerId === currentUser!.id) return Player.Black;
        if (whitePlayerId === currentUser!.id) return Player.White;
        if ((mode === GameMode.Base || (mode === GameMode.Mix && session.settings.mixedModes?.includes(GameMode.Base))) && gameStatus === GameStatus.BasePlacement) {
             return currentUser!.id === player1.id ? Player.Black : Player.White;
        }
        return Player.None;
    }, [currentUser, blackPlayerId, whitePlayerId, isSpectator, mode, gameStatus, player1.id, session.settings.mixedModes]);
    
    const clientTimes = useClientTimer(session, myPlayerEnum);
    
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [hasNewMessage, setHasNewMessage] = useState(false);
    const gameChat = useMemo(() => gameChats[session.id] || [], [gameChats, session.id]);
    const prevChatLength = usePrevious(gameChat.length);
    const [isPaused, setIsPaused] = useState(session.gameStatus === GameStatus.Paused);
    const [isPauseCooldown, setIsPauseCooldown] = useState(false);

    useEffect(() => {
        setIsPaused(session.gameStatus === GameStatus.Paused);
    }, [session.gameStatus]);

    const handlePauseToggle = useCallback(() => {
        if (isPauseCooldown || !session.isAiGame) return;
        const actionType = isPaused ? 'RESUME_GAME' : 'PAUSE_GAME';
        handlers.handleAction({ type: actionType, payload: { gameId: session.id } });
        setIsPauseCooldown(true);
        setTimeout(() => setIsPauseCooldown(false), 2000); // 2 second cooldown to prevent spam
    }, [isPauseCooldown, session.isAiGame, isPaused, handlers, session.id]);

    useEffect(() => {
        setOptimisticStone(null);
        setIsSubmittingMove(false);
    }, [session.moveHistory]);


    useEffect(() => {
        const checkIsMobile = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', checkIsMobile);
        return () => window.removeEventListener('resize', checkIsMobile);
    }, []);

    useEffect(() => {
        if (!isMobileSidebarOpen && prevChatLength !== undefined && gameChat.length > prevChatLength) {
            setHasNewMessage(true);
        }
    }, [gameChat.length, prevChatLength, isMobileSidebarOpen]);

    const openMobileSidebar = () => {
        setIsMobileSidebarOpen(true);
        setHasNewMessage(false);
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
        }
    }, [gameStatus, prevGameStatus]);
    
    const handleCloseResults = useCallback(() => {
        setShowResultModal(false);
    }, []);
    
    const isMyTurn = useMemo(() => {
        if (isSpectator) return false;
        if (gameStatus === 'alkkagi_simultaneous_placement' && session.settings.alkkagiPlacementType === '일괄 배치') {
            const myStonesOnBoard = (session.alkkagiStones || []).filter((s: AlkkagiStone) => s.player === myPlayerEnum).length;
            const myStonesInPlacement = (currentUser!.id === player1.id ? session.alkkagiStones_p1 : session.alkkagiStones_p2)?.length || 0;
            return (myStonesOnBoard + myStonesInPlacement) < (session.settings.alkkagiStoneCount || 5);
        }
        switch (gameStatus) {
            case GameStatus.DiceTurnRolling: return session.turnOrderRolls?.[currentUser!.id] === null;
            case GameStatus.DiceTurnChoice: return session.turnChooserId === currentUser!.id;
            case GameStatus.Playing: case GameStatus.HiddenPlacing: case GameStatus.Scanning: case GameStatus.MissileSelecting: 
            case GameStatus.AlkkagiPlacement: case GameStatus.AlkkagiPlaying: case GameStatus.CurlingPlaying:
            case GameStatus.DiceRolling: case GameStatus.DicePlacing: case GameStatus.ThiefRolling: case GameStatus.ThiefPlacing:
                return myPlayerEnum !== Player.None && myPlayerEnum === currentPlayer;
            case GameStatus.BasePlacement: {
                 const myStones = currentUser!.id === player1.id ? session.baseStones_p1 : session.baseStones_p2;
                 return (myStones?.length || 0) < (session.settings.baseStones || 4);
            }
            default: return false;
        }
    }, [myPlayerEnum, currentPlayer, gameStatus, isSpectator, session, currentUser, player1.id, session.settings]);
    
    const prevIsMyTurn = usePrevious(isMyTurn);
    useEffect(() => {
        if (isMyTurn && !prevIsMyTurn) {
            const isPlayfulTurnSoundMode = [ GameMode.Dice, GameMode.Thief, GameMode.Alkkagi, GameMode.Curling, ].includes(session.mode);
            if (isPlayfulTurnSoundMode) audioService.myTurn();
        }
        if (!isMyTurn) {
            setIsSubmittingMove(false);
        }
    }, [isMyTurn, prevIsMyTurn, session.mode]);

    const prevLastMove = usePrevious(session.lastMove);
    useEffect(() => {
        if (session.lastMove && session.lastMove.x !== -1 && JSON.stringify(session.lastMove) !== JSON.stringify(prevLastMove)) {
            const isGoBasedGame = SPECIAL_GAME_MODES.some(m => m.mode === session.mode) || 
                                  [GameMode.Omok, GameMode.Ttamok, GameMode.Dice, GameMode.Thief].includes(session.mode);
            if (isGoBasedGame) audioService.placeStone();
        }
    }, [session.lastMove, prevLastMove, session.mode]);
    
     useEffect(() => { if (prevCaptures) { /* Capture sounds removed */ } }, [session.captures, prevCaptures, session.justCaptured, session.blackPlayerId, currentUser?.id]);

    useEffect(() => {
        if (gameStatus === GameStatus.Scanning && prevGameStatus !== GameStatus.Scanning) audioService.playScanBgm();
        else if (gameStatus !== GameStatus.Scanning && prevGameStatus === GameStatus.Scanning) audioService.stopScanBgm();
        return () => { if (gameStatus === GameStatus.Scanning) audioService.stopScanBgm(); };
    }, [gameStatus, prevGameStatus]);

    useEffect(() => {
        const anim = session.animation;
        if (anim && anim.type !== prevAnimationType) { 
            switch(anim.type) {
                case 'missile': case 'hidden_missile': audioService.launchMissile(); break;
                case 'hidden_reveal': if (!justScanned) audioService.revealHiddenStone(); break;
                case 'scan':
                    setJustScanned(true); setTimeout(() => setJustScanned(false), 1000);
                    if (anim.success) audioService.scanSuccess(); else audioService.scanFail();
                    break;
            }
        }
    }, [session.animation, prevAnimationType, justScanned]);

    useEffect(() => {
        const activeStartStatuses: GameStatus[] = [ GameStatus.Playing, GameStatus.AlkkagiPlacement, GameStatus.AlkkagiSimultaneousPlacement, GameStatus.CurlingPlaying, GameStatus.DiceRolling, GameStatus.ThiefRolling ];
        if (activeStartStatuses.includes(gameStatus) && (prevGameStatus === undefined || !activeStartStatuses.includes(prevGameStatus))) audioService.gameStart();
    }, [gameStatus, prevGameStatus]);

    useEffect(() => { return () => audioService.stopScanBgm(); }, []);

    useEffect(() => {
        const isGameOver = ['ended', 'no_contest', 'scoring'].includes(gameStatus);
        const hasTurnChanged = prevMoveCount !== undefined && session.moveHistory && session.moveHistory.length > prevMoveCount;
    
        const myByoyomiPeriods = myPlayerEnum === Player.Black ? session.blackByoyomiPeriodsLeft : session.whiteByoyomiPeriodsLeft;
        const prevMyByoyomiPeriods = myPlayerEnum === Player.Black ? prevByoyomiBlack : prevByoyomiWhite;
        const byoyomiUsed = prevMyByoyomiPeriods !== undefined && myByoyomiPeriods < prevMyByoyomiPeriods;

        if (!isMyTurn || hasTurnChanged || isGameOver || byoyomiUsed) {
            if (warningSoundPlayedForTurn.current) {
                audioService.stopTimerWarning();
                warningSoundPlayedForTurn.current = false;
            }
        }
        
        if (isMyTurn && !isGameOver) {
            const myTime = myPlayerEnum === Player.Black ? clientTimes.black : clientTimes.white;
            
            const myMainTimeLeft = myPlayerEnum === Player.Black ? session.blackTimeLeft : session.whiteTimeLeft;
            const hasByoyomi = (session.settings.byoyomiCount ?? 0) > 0;
            const isFischer = (session.settings.timeIncrement ?? 0) > 0;
            
            const isInByoyomi = myMainTimeLeft <= 0 && hasByoyomi && !isFischer;
            const isPlayfulFoulMode = PLAYFUL_GAME_MODES.some(m => m.mode === session.mode) && ![GameMode.Omok, GameMode.Ttamok].includes(session.mode);

            // The user wants the warning ONLY for byoyomi, time foul, and fischer modes.
            // Standard go main time should not have a warning. This logic achieves that.
            const shouldWarn = isInByoyomi || isPlayfulFoulMode || isFischer;

            if (shouldWarn && myTime <= 10 && myTime > 0 && !warningSoundPlayedForTurn.current) {
                audioService.timerWarning();
                warningSoundPlayedForTurn.current = true;
            }
        }
    }, [isMyTurn, clientTimes, myPlayerEnum, session.moveHistory, prevMoveCount, gameStatus, session.blackByoyomiPeriodsLeft, session.whiteByoyomiPeriodsLeft, prevByoyomiBlack, prevByoyomiWhite, session.blackTimeLeft, session.whiteTimeLeft, session.settings.byoyomiCount, session.mode, session.settings.mixedModes, session.settings.timeIncrement]);

    const isNoContestLeaveAvailable = useMemo(() => !isSpectator && !session.isAiGame && !!session.canRequestNoContest?.[currentUser!.id], [session.canRequestNoContest, currentUser, isSpectator, session.isAiGame]);

    const handleLeaveOrResignClick = useCallback(() => {
        const slug = SLUG_BY_GAME_MODE.get(session.mode);
        const redirectUrl = slug ? `#/waiting/${slug}` : '#/profile';
        sessionStorage.setItem('postGameRedirect', redirectUrl);
    
        if (isSpectator) {
            handlers.handleAction({ type: 'LEAVE_SPECTATING', payload: { gameId, mode: session.mode } });
            return;
        }
    
        if (['ended', 'no_contest', 'rematch_pending'].includes(gameStatus)) {
            if (session.isAiGame) {
                handlers.handleAction({ type: 'LEAVE_AI_GAME', payload: { gameId: session.id } });
            } else {
                handlers.handleAction({ type: 'LEAVE_GAME_ROOM', payload: { gameId, mode: session.mode } });
            }
            return;
        }
    
        if (isNoContestLeaveAvailable) {
            if (window.confirm("상대방의 장고로 인해 페널티 없이 무효 처리하고 나가시겠습니까?")) {
                handlers.handleAction({ type: 'REQUEST_NO_CONTEST_LEAVE', payload: { gameId } });
            }
        } else {
            setConfirmModalType('resign');
        }
    }, [isSpectator, handlers, session.mode, gameId, gameStatus, isNoContestLeaveAvailable, session.isAiGame]);

    const isItemModeActive = ['hidden_placing', 'scanning', 'missile_selecting', 'missile_animating', 'scanning_animating'].includes(gameStatus);

    const handleBoardClick = useCallback(async (x: number, y: number) => {
        if (isSubmittingMove || isSpectator || session.gameStatus === 'missile_animating') return;

        // Client-side move validation for standard Go moves
        if (['playing', 'hidden_placing'].includes(gameStatus) && isMyTurn) {
            const validationResult = processMove(
                session.boardState,
                { x, y, player: myPlayerEnum },
                session.koInfo,
                session.moveHistory.length
            );
            if (!validationResult.isValid) {
                console.log(`Client-side validation failed: ${validationResult.reason}`);
                // Optionally show a quick error toast/message here instead of just console logging
                return; // Invalid move, do not proceed with optimistic update or server action
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
            actionType = 'PLACE_STONE'; // Omok uses the standard PLACE_STONE now
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
    }, [isSubmittingMove, isSpectator, session, gameStatus, isMyTurn, myPlayerEnum, isMobile, settings.features.mobileConfirm, isItemModeActive, pendingMove, gameId, mode, handlers, currentUser, player1.id]);

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
    
    const globalChat = useMemo(() => waitingRoomChats['global'] || [], [waitingRoomChats]);
    
    const gameProps: GameProps = {
        session, onAction: handlers.handleAction, currentUser: currentUserWithStatus!, waitingRoomChat: globalChat,
        gameChat: gameChat, isSpectator, onlineUsers, activeNegotiation, negotiations: Object.values(negotiations), onViewUser: handlers.openViewingUser
    };

    const rightPlayerUser = useMemo(() => {
        if (session.isTowerChallenge) {
            const match = player2.nickname.match(/(.*) Lv\.(\d+)/);
            if (match) {
                const [, name, level] = match;
                return { ...player2, nickname: name.trim(), strategyLevel: parseInt(level, 10) };
            }
        }
        return player2;
    }, [session.isTowerChallenge, player2]);

    const gameControlsProps = {
        session, isMyTurn, isSpectator, onAction: handlers.handleAction, setShowResultModal, setConfirmModalType, currentUser: currentUserWithStatus!,
        onlineUsers, pendingMove, onConfirmMove: handleConfirmMove, onCancelMove: handleCancelMove, settings, isMobile,
    };

    const middlePanelComponent = useMemo(() => {
        if (session.isAiGame && session.autoEndTurnCount) {
            return <TurnCounterPanel session={session} />;
        }
        return undefined;
    }, [session]);

    const backgroundClass = SPECIAL_GAME_MODES.some(m => m.mode === mode) ? 'bg-strategic' : 'bg-playful';
    
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
        <div className={`w-full h-full flex flex-col p-2 lg:p-4 ${backgroundClass}`}>
            {session.disconnectionState && <DisconnectionModal session={session} currentUser={currentUser!} />}
            {session.gameStatus === 'scoring' && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-30">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-gray-100 mb-4"></div>
                    <p className="text-xl font-bold text-white">계가 중...</p>
                </div>
            )}
            <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
                <main className="flex-1 flex flex-col items-center justify-center min-w-0 min-h-0 gap-2">
                    <div className="flex-shrink-0 w-full">
                        <PlayerPanel {...gameProps} clientTimes={clientTimes} middleComponent={middlePanelComponent} />
                    </div>
                    <div className="flex-1 w-full flex items-center justify-center min-h-0">
                        {isPaused && session.isAiGame ? (
                            <div className="w-full h-full flex items-center justify-center text-primary text-2xl font-bold">
                                일시정지됨
                            </div>
                        ) : (
                            <div className="relative w-full h-full max-w-full max-h-full aspect-square">
                                <div className="absolute inset-0">
                                    <GameArena {...gameArenaProps} />
                                </div>
                            </div>
                        )}
                    </div>
                     <div className="flex-shrink-0 w-full flex flex-col gap-1">
                        <TurnDisplay session={session} currentUser={currentUserWithStatus!} />
                        <GameControls {...gameControlsProps} />
                    </div>
                </main>
                
                {!isMobile && (
                     <aside className="w-full lg:w-[320px] xl:w-[360px] flex-shrink-0">
                        <Sidebar 
                            {...gameProps}
                            onLeaveOrResign={handleLeaveOrResignClick}
                            isNoContestLeaveAvailable={isNoContestLeaveAvailable}
                            onOpenSettings={handlers.openSettingsModal}
                            isPausable={session.isAiGame}
                            isPaused={isPaused}
                            onPauseToggle={handlePauseToggle}
                        />
                    </aside>
                )}
                
                {isMobile && (
                    <>
                        <div className="absolute top-1/2 -translate-y-1/2 right-0 z-20">
                            <button 
                                onClick={openMobileSidebar} 
                                className="w-8 h-12 bg-secondary/80 backdrop-blur-sm rounded-l-lg flex items-center justify-center text-primary shadow-lg"
                                aria-label="메뉴 열기"
                            >
                                <span className="relative font-bold text-lg">
                                    {'<'}
                                    {hasNewMessage && <div className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-danger rounded-full border-2 border-secondary"></div>}
                                </span>
                            </button>
                        </div>

                        <div className={`fixed top-0 right-0 h-full w-[280px] bg-secondary shadow-2xl z-50 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                            <Sidebar 
                                {...gameProps}
                                onLeaveOrResign={handleLeaveOrResignClick}
                                isNoContestLeaveAvailable={isNoContestLeaveAvailable}
                                onClose={() => setIsMobileSidebarOpen(false)}
                                onOpenSettings={handlers.openSettingsModal}
                                isPausable={session.isAiGame}
                                isPaused={isPaused}
                                onPauseToggle={handlePauseToggle}
                            />
                        </div>
                        {isMobileSidebarOpen && <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setIsMobileSidebarOpen(false)}></div>}
                    </>
                )}
            </div>
            
            {isAnalysisActive && session.analysisResult?.[currentUser!.id] && (
                <TerritoryAnalysisWindow session={session} result={session.analysisResult[currentUser!.id]} onClose={() => setIsAnalysisActive(false)} />
            )}
            
            <GameModals 
                {...gameProps}
                confirmModalType={confirmModalType}
                onHideConfirmModal={() => setConfirmModalType(null)}
                showResultModal={showResultModal}
                onCloseResults={handleCloseResults}
            />
        </div>
    );
};

export default PvpArena;