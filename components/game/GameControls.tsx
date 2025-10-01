import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GameMode, LiveGameSession, ServerAction, GameProps, Player, User, Point, GameStatus, AppSettings } from '../../types/index.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants/index.js';
import Button from '../Button.js';
import Dice from '../Dice.js';
import { audioService } from '../../services/audioService.js';

interface GameControlsProps {
    session: LiveGameSession;
    isMyTurn: boolean;
    isSpectator: boolean;
    onAction: (action: ServerAction) => void;
    setShowResultModal: (show: boolean) => void;
    setConfirmModalType: (type: 'resign' | null) => void;
    currentUser: GameProps['currentUser'];
    onlineUsers: GameProps['onlineUsers'];
    pendingMove: Point | null;
    onConfirmMove: () => void;
    onCancelMove: () => void;
    isMobile: boolean;
    settings: AppSettings;
}

const formatCooldown = (ms: number) => {
    if (ms <= 0) return 'READY';
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

interface ActionButtonsPanelProps {
    session: LiveGameSession;
    isSpectator: boolean;
    onAction: (action: ServerAction) => void;
    currentUser: GameProps['currentUser'];
}

const ACTIVE_GAME_STATUSES: GameStatus[] = [
    GameStatus.Playing,
    GameStatus.HiddenPlacing,
    GameStatus.Scanning,
    GameStatus.MissileSelecting,
    GameStatus.AlkkagiPlaying,
    GameStatus.CurlingPlaying,
    GameStatus.DiceRolling,
    GameStatus.DicePlacing,
    GameStatus.ThiefRolling,
    GameStatus.ThiefPlacing,
];

const ActionButtonsPanel: React.FC<ActionButtonsPanelProps> = ({ session, isSpectator, onAction, currentUser }) => {
    const [cooldownTime, setCooldownTime] = useState('00:00');
    const { id: gameId, mode, gameStatus } = session;

    useEffect(() => {
        const deadline = session.actionButtonCooldownDeadline?.[currentUser.id];
        if (!deadline) {
            setCooldownTime('READY');
            return;
        }

        const update = () => {
            const remaining = deadline - Date.now();
            setCooldownTime(formatCooldown(remaining));
        };

        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [session.actionButtonCooldownDeadline, currentUser.id]);

    const isGameEnded = [GameStatus.Ended, GameStatus.NoContest, GameStatus.RematchPending].includes(gameStatus);
    const canUseActions = SPECIAL_GAME_MODES.some(m => m.mode === mode) || PLAYFUL_GAME_MODES.some(m => m.mode === mode);

    if (isGameEnded || isSpectator || !canUseActions) {
        return null;
    }

    const myActionButtons = session.currentActionButtons?.[currentUser.id];
    const hasButtons = myActionButtons && myActionButtons.length > 0;
    const isGameActive = ACTIVE_GAME_STATUSES.includes(gameStatus);
    const hasUsedThisCycle = session.actionButtonUsedThisCycle?.[currentUser.id];
    const isReady = cooldownTime === 'READY';

    return (
        <div className="flex items-center justify-center gap-2 flex-wrap">
            {hasButtons && !hasUsedThisCycle ? (
                myActionButtons.map(button => (
                    <Button
                        key={button.name}
                        onClick={() => onAction({ type: 'USE_ACTION_BUTTON', payload: { gameId, buttonName: button.name } })}
                        colorScheme={button.type === 'manner' ? 'green' : 'orange'}
                        className="whitespace-nowrap text-[clamp(0.5rem,1.8vmin,0.75rem)] px-[clamp(0.3rem,1.5vmin,0.5rem)] py-[clamp(0.15rem,1vmin,0.25rem)]"
                        title={button.message}
                        disabled={isSpectator || !isGameActive}
                    >
                        {button.name}
                    </Button>
                ))
            ) : (
                <span className="text-xs text-gray-400">다음 액션 대기중...</span>
            )}
            <span className={`text-xs font-mono ${isReady && !hasUsedThisCycle ? 'text-green-400' : 'text-gray-400'}`}>
                {cooldownTime}
            </span>
        </div>
    );
};


const DicePanel: React.FC<{ session: LiveGameSession, isMyTurn: boolean, onAction: (a: ServerAction) => void, currentUser: User }> = ({ session, isMyTurn, onAction, currentUser }) => {
    const { id: gameId, gameStatus } = session;

    const isRolling = gameStatus === GameStatus.DiceRollingAnimating;
    
    const handleRoll = (itemType?: 'odd' | 'even') => {
        if (isMyTurn && gameStatus === GameStatus.DiceRolling) {
            audioService.rollDice(1);
            onAction({ type: 'DICE_ROLL', payload: { gameId, itemType } });
        }
    };

    const myItemUses = session.diceGoItemUses?.[currentUser.id];
    const oddCount = myItemUses?.odd ?? 0;
    const evenCount = myItemUses?.even ?? 0;
    const canRoll = isMyTurn && gameStatus === GameStatus.DiceRolling;
    
    const diceValue = isRolling ? null : session.dice?.dice1;

    return (
        <div className={`flex flex-row items-center justify-center gap-3 transition-all ${canRoll ? 'animate-pulse-border-yellow' : 'border-2 border-transparent p-2 rounded-lg'}`}>
            <div className="flex flex-col items-center">
                <Dice 
                    value={diceValue ?? null} 
                    isRolling={isRolling} 
                    size={48}
                    onClick={() => handleRoll()}
                    disabled={!canRoll}
                />
            </div>
            <div className="flex flex-col items-center">
                <Dice 
                    displayText="홀" 
                    color="blue" 
                    value={null} 
                    isRolling={isRolling} 
                    size={48}
                    onClick={() => handleRoll('odd')}
                    disabled={!canRoll || oddCount <= 0}
                />
                <span className="text-xs mt-1 font-bold">{oddCount}개</span>
            </div>
             <div className="flex flex-col items-center">
                <Dice 
                    displayText="짝" 
                    color="yellow" 
                    value={null} 
                    isRolling={isRolling} 
                    size={48}
                    onClick={() => handleRoll('even')}
                    disabled={!canRoll || evenCount <= 0}
                />
                <span className="text-xs mt-1 font-bold">{evenCount}개</span>
            </div>
        </div>
    );
};

const AlkkagiItemPanel: React.FC<{ session: LiveGameSession; isMyTurn: boolean; onAction: (a: ServerAction) => void; currentUser: User; }> = ({ session, isMyTurn, onAction, currentUser }) => {
    const { id: gameId, gameStatus, activeAlkkagiItems } = session;
    const myItems = session.alkkagiItemUses?.[currentUser.id];
    const slowCount = myItems?.slow ?? session.settings.alkkagiSlowItemCount ?? 0;
    const aimCount = myItems?.aimingLine ?? session.settings.alkkagiAimingLineItemCount ?? 0;
    const myActiveItems = activeAlkkagiItems?.[currentUser.id] || [];

    const useItem = (itemType: 'slow' | 'aimingLine') => {
        onAction({ type: 'USE_ALKKAGI_ITEM', payload: { gameId, itemType } });
    };

    const isSlowActive = myActiveItems.includes('slow');
    const isAimActive = myActiveItems.includes('aimingLine');
    const canUse = isMyTurn && gameStatus === GameStatus.AlkkagiPlaying;
    const buttonClasses = "!p-1 flex flex-col items-center justify-center h-full w-14 relative";
    const iconClass = "w-6 h-6 object-contain";
    const textClass = "text-[10px] font-semibold mt-1";

    const totalRounds = session.settings.alkkagiRounds || 1;
    if (totalRounds <= 1) {
        return (
            <div className="flex items-center justify-center gap-2">
                <Button
                    onClick={() => useItem('slow')}
                    disabled={!canUse || slowCount <= 0 || isSlowActive}
                    colorScheme={isSlowActive ? 'green' : 'blue'}
                    className={buttonClasses}
                    title={`파워 게이지 속도를 50% 감소시킵니다. 남은 개수: ${slowCount}`}
                >
                    <img src="/images/button/slow.png" alt="슬로우" className={iconClass} />
                    <span className={textClass}>슬로우</span>
                    <span className="absolute top-0 right-0 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{slowCount}</span>
                </Button>
                <Button
                    onClick={() => useItem('aimingLine')}
                    disabled={!canUse || aimCount <= 0 || isAimActive}
                    colorScheme={isAimActive ? 'green' : 'purple'}
                    className={buttonClasses}
                    title={`조준선 길이를 1000% 증가시킵니다. 남은 개수: ${aimCount}`}
                >
                    <img src="/images/button/target.png" alt="조준선" className={iconClass} />
                    <span className={textClass}>조준선</span>
                    <span className="absolute top-0 right-0 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{aimCount}</span>
                </Button>
            </div>
        );
    }
    
    const maxRefills = totalRounds - 1;
    const myRefillsUsed = session.alkkagiRefillsUsed?.[currentUser.id] || 0;
    const myRefillsLeft = maxRefills - myRefillsUsed;

    return (
        <div className="flex items-center justify-center gap-2">
            <div className="flex flex-col text-center text-xs font-semibold">
                <span className="text-yellow-300">리필: {myRefillsLeft} / {maxRefills}</span>
            </div>
             <div className="h-8 w-px bg-gray-600 mx-2"></div>
            <div className="flex items-center justify-center gap-2">
                 <Button
                    onClick={() => useItem('slow')}
                    disabled={!canUse || slowCount <= 0 || isSlowActive}
                    colorScheme={isSlowActive ? 'green' : 'blue'}
                    className={buttonClasses}
                    title={`파워 게이지 속도를 50% 감소시킵니다. 남은 개수: ${slowCount}`}
                >
                    <img src="/images/button/slow.png" alt="슬로우" className={iconClass} />
                    <span className={textClass}>슬로우</span>
                    <span className="absolute top-0 right-0 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{slowCount}</span>
                </Button>
                <Button
                    onClick={() => useItem('aimingLine')}
                    disabled={!canUse || aimCount <= 0 || isAimActive}
                    colorScheme={isAimActive ? 'green' : 'purple'}
                    className={buttonClasses}
                    title={`조준선 길이를 1000% 증가시킵니다. 남은 개수: ${aimCount}`}
                >
                    <img src="/images/button/target.png" alt="조준선" className={iconClass} />
                    <span className={textClass}>조준선</span>
                    <span className="absolute top-0 right-0 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{aimCount}</span>
                </Button>
            </div>
        </div>
    );
};


const PlayfulStonesPanel: React.FC<{ session: LiveGameSession, currentUser: GameProps['currentUser'] }> = ({ session, currentUser }) => {
    // This panel is now a fallback for playful modes without special item controls.
    // Currently, it displays nothing for Omok/Ttamok, which is acceptable.
    // A potential future implementation for Ttamok capture count could go here.
    return null;
};

interface ThiefPanelProps {
    session: LiveGameSession;
    isMyTurn: boolean;
    onAction: (a: ServerAction) => void;
    currentUser: User;
}

const ThiefPanel: React.FC<ThiefPanelProps> = ({ session, isMyTurn, onAction, currentUser }) => {
    const { id: gameId, gameStatus, animation, currentPlayer, blackPlayerId, whitePlayerId, thiefPlayerId } = session;

    const diceAnimation = animation?.type === 'dice_roll_main' ? animation : null;
    const isRolling = !!diceAnimation && Date.now() < (diceAnimation.startTime + diceAnimation.duration);
    
    const currentPlayerId = currentPlayer === Player.Black ? blackPlayerId : whitePlayerId;
    const currentPlayerRole = currentPlayerId === thiefPlayerId ? 'thief' : 'police';
    const diceCount = currentPlayerRole === 'thief' ? 1 : 2;

    const handleRoll = () => {
        if (isMyTurn && gameStatus === GameStatus.ThiefRolling) {
            audioService.rollDice(diceCount);
            onAction({ type: 'THIEF_ROLL_DICE', payload: { gameId } });
        }
    };
    
    return (
        <div className="flex items-center justify-center gap-2">
            {Array.from({ length: diceCount }).map((_, index) => {
                const diceKey = index === 0 ? 'dice1' : 'dice2';
                const diceValue = diceAnimation ? diceAnimation.dice[diceKey as keyof typeof diceAnimation.dice] : session.dice?.[diceKey as keyof typeof session.dice];
                return (
                    <Dice
                        key={index}
                        value={diceValue ?? null}
                        isRolling={isRolling}
                        size={48}
                        onClick={handleRoll}
                        disabled={!isMyTurn || gameStatus !== GameStatus.ThiefRolling}
                    />
                );
            })}
        </div>
    );
};

const CurlingItemPanel: React.FC<{ session: LiveGameSession; isMyTurn: boolean; onAction: (a: ServerAction) => void; currentUser: User; }> = ({ session, isMyTurn, onAction, currentUser }) => {
    const { id: gameId, gameStatus, activeCurlingItems } = session;
    const myItems = session.curlingItemUses?.[currentUser.id];
    const slowCount = myItems?.slow ?? session.settings.curlingSlowItemCount ?? 0;
    const aimCount = myItems?.aimingLine ?? session.settings.curlingAimingLineItemCount ?? 0;
    const myActiveItems = activeCurlingItems?.[currentUser.id] || [];


    const useItem = (itemType: 'slow' | 'aimingLine') => {
        onAction({ type: 'USE_CURLING_ITEM', payload: { gameId, itemType } });
    };

    const isSlowActive = myActiveItems.includes('slow');
    const isAimActive = myActiveItems.includes('aimingLine');
    const canUse = isMyTurn && gameStatus === GameStatus.CurlingPlaying;
    const buttonClasses = "!p-1 flex flex-col items-center justify-center h-full w-14 relative";
    const iconClass = "w-6 h-6 object-contain";
    const textClass = "text-[10px] font-semibold mt-1";

    return (
        <div className="flex items-center justify-center gap-2">
            <Button
                onClick={() => useItem('slow')}
                disabled={!canUse || slowCount <= 0 || isSlowActive}
                colorScheme={isSlowActive ? 'green' : 'blue'}
                className={buttonClasses}
                title={`파워 게이지 속도를 50% 감소시킵니다. 남은 개수: ${slowCount}`}
            >
                <img src="/images/button/slow.png" alt="슬로우" className={iconClass} />
                <span className={textClass}>슬로우</span>
                <span className="absolute top-0 right-0 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{slowCount}</span>
            </Button>
            <Button
                onClick={() => useItem('aimingLine')}
                disabled={!canUse || aimCount <= 0 || isAimActive}
                colorScheme={isAimActive ? 'green' : 'purple'}
                className={buttonClasses}
                title={`조준선 길이를 1000% 증가시킵니다. 남은 개수: ${aimCount}`}
            >
                <img src="/images/button/target.png" alt="조준선" className={iconClass} />
                <span className={textClass}>조준선</span>
                <span className="absolute top-0 right-0 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{aimCount}</span>
            </Button>
        </div>
    );
};


const GameControls: React.FC<GameControlsProps> = (props) => {
    const { session, isMyTurn, isSpectator, onAction, setShowResultModal, setConfirmModalType, currentUser, onlineUsers, pendingMove, onConfirmMove, onCancelMove, isMobile, settings } = props;
    const { id: gameId, mode, gameStatus, blackPlayerId, whitePlayerId, player1, player2 } = session;
    const isMixMode = mode === GameMode.Mix;
    const isGameEnded = ['ended', 'no_contest', 'rematch_pending'].includes(gameStatus);
    const isGameActive = ACTIVE_GAME_STATUSES.includes(gameStatus);
    const isPreGame = !isGameActive && !isGameEnded;
    const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === mode);
    const handlePass = () => { if (isMyTurn && !isSpectator && gameStatus === 'playing') onAction({ type: 'PASS_TURN', payload: { gameId } }); };
    const handleResign = () => { if (!isSpectator && !session.isAiGame && isGameActive) setConfirmModalType('resign'); };
    const handleUseItem = (item: 'hidden' | 'scan' | 'missile') => { if(gameStatus !== 'playing') return; const actionType = item === 'hidden' ? 'START_HIDDEN_PLACEMENT' : (item === 'scan' ? 'START_SCANNING' : 'START_MISSILE_SELECTION'); onAction({ type: actionType, payload: { gameId } }); };

    const myPlayerEnum = currentUser.id === blackPlayerId ? Player.Black : Player.White;
    const opponentPlayerEnum = myPlayerEnum === Player.Black ? Player.White : Player.Black;

    const canScan = useMemo(() => {
        if (!session.hiddenMoves || !session.moveHistory) {
            return false;
        }
    
        // Check if there is AT LEAST ONE opponent hidden stone on the board that has NOT been permanently revealed.
        return Object.entries(session.hiddenMoves).some(([moveIndexStr, isHidden]) => {
            if (!isHidden) return false;
            
            const move = session.moveHistory[parseInt(moveIndexStr)];
            if (!move || move.player !== opponentPlayerEnum) {
                return false;
            }
    
            const { x, y } = move;
    
            // Condition 1: The stone must still be on the board.
            if (session.boardState[y]?.[x] !== opponentPlayerEnum) {
                return false;
            }
    
            // Condition 2: The stone must NOT be permanently revealed to everyone.
            const isPermanentlyRevealed = session.permanentlyRevealedStones?.some(p => p.x === x && p.y === y);
            
            return !isPermanentlyRevealed;
        });
    }, [session.hiddenMoves, session.moveHistory, session.boardState, session.permanentlyRevealedStones, opponentPlayerEnum]);
    
    const buttonClasses = "!p-1 flex flex-col items-center justify-center h-full w-14 relative";
    const iconClass = "w-6 h-6 object-contain";
    const textClass = "text-[10px] font-semibold mt-1";

    const renderItemButtons = () => {
        const isHiddenMode = mode === GameMode.Hidden || (mode === GameMode.Mix && (session.settings.mixedModes || []).includes(GameMode.Hidden));
        const isMissileMode = mode === GameMode.Missile || (mode === GameMode.Mix && (session.settings.mixedModes || []).includes(GameMode.Missile));
        const p1Id = session.player1.id;
        const myHiddenUsed = currentUser.id === p1Id ? (session.hidden_stones_used_p1 ?? 0) : (session.hidden_stones_used_p2 ?? 0);
        const myScansLeft = currentUser.id === p1Id ? session.scans_p1 : session.scans_p2;
        const myMissilesLeft = currentUser.id === p1Id ? session.missiles_p1 : session.missiles_p2;
        const hiddenLeft = (session.settings.hiddenStoneCount || 0) - myHiddenUsed;
        
        return ( <> {isHiddenMode && <Button onClick={() => handleUseItem('hidden')} disabled={!isMyTurn || isSpectator || gameStatus !== 'playing' || hiddenLeft <= 0} colorScheme="purple" className={`${buttonClasses} relative`}><img src="/images/button/hidden.png" alt="히든" className={iconClass} /><span className={textClass}>히든</span><span className="absolute top-0 right-0 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{hiddenLeft}</span></Button>} {isHiddenMode && <Button onClick={() => handleUseItem('scan')} disabled={!isMyTurn || isSpectator || gameStatus !== 'playing' || (myScansLeft ?? 0) <= 0 || !canScan} colorScheme="purple" className={`${buttonClasses} relative`}><img src="/images/button/scan.png" alt="스캔" className={iconClass} /><span className={textClass}>스캔</span><span className="absolute top-0 right-0 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{myScansLeft ?? 0}</span></Button>} {isMissileMode && <Button onClick={() => handleUseItem('missile')} disabled={!isMyTurn || isSpectator || gameStatus !== 'playing' || (myMissilesLeft ?? 0) <= 0} colorScheme="orange" className={`${buttonClasses} relative`}><img src="/images/button/missile.png" alt="미사일" className={iconClass} /><span className={textClass}>미사일</span><span className="absolute top-0 right-0 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{myMissilesLeft ?? 0}</span></Button>} </> );
    };

    const hasItems = (mode === GameMode.Hidden || mode === GameMode.Missile) || (mode === GameMode.Mix && (session.settings.mixedModes || []).some(m => [GameMode.Hidden, GameMode.Missile].includes(m)));
    if (isSpectator && !currentUser.isAdmin) return null;

    const usesLeft = (session.maxActionButtonUses ?? 0) - (session.actionButtonUses?.[currentUser.id] ?? 0);
    const maxUses = session.maxActionButtonUses;
    const usesLeftText = (typeof usesLeft === 'number' && typeof maxUses === 'number') ? `(${usesLeft})` : '';
    
    const isRequestingAnalysis = session.isAnalyzing;

    return (
        <footer className="responsive-controls flex-shrink-0 bg-gray-800 rounded-lg p-1 flex flex-col items-stretch justify-center gap-1 w-full">
            {isMobile && settings.features.mobileConfirm && pendingMove && (
                 <div className="flex gap-4 p-2 justify-center">
                    <Button onClick={onCancelMove} colorScheme="red" className="!py-3 !px-6">취소</Button>
                    <Button onClick={onConfirmMove} colorScheme="green" className="!py-3 !px-6 animate-pulse">착수</Button>
                </div>
            )}
            {/* Row 1: Manner Actions */}
            <div className="bg-gray-900/50 rounded-md p-2 flex flex-row items-center gap-4 w-full">
                <h3 className="text-xs font-bold text-gray-300 whitespace-nowrap">매너 액션 {usesLeftText}</h3>
                <div className="flex-grow flex items-center justify-center">
                    <ActionButtonsPanel session={session} isSpectator={isSpectator} onAction={onAction} currentUser={currentUser} />
                </div>
            </div>

            {/* Row 2: Game and Special/Playful Functions */}
            <div className="flex flex-col lg:flex-row gap-1 w-full">
                {/* Panel 1: 대국 기능 */}
                <div className="bg-gray-900/50 rounded-md p-2 flex flex-row items-center gap-4 flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-gray-300 whitespace-nowrap">대국 기능</h3>
                    <div className="flex items-center justify-center gap-2 flex-wrap flex-grow">
                        {isGameEnded ? (
                            <Button onClick={() => setShowResultModal(true)} colorScheme="yellow" className="!text-sm !py-2">결과 보기</Button>
                        ) : (
                            <>
                                {isStrategic && mode !== GameMode.Capture && !session.isAiGame && <Button onClick={handlePass} disabled={!isMyTurn || isSpectator || isPreGame} colorScheme="blue" className={buttonClasses}><img src="/images/button/pass.png" alt="통과" className={iconClass} /><span className={textClass}>통과</span></Button>}
                                <Button onClick={handleResign} disabled={isSpectator || session.isAiGame || isPreGame} colorScheme="red" className={buttonClasses}><img src="/images/button/giveup.png" alt="기권" className={iconClass} /><span className={textClass}>기권</span></Button>
                            </>
                        )}
                    </div>
                </div>
                
                {/* Panel 2: 특수/놀이 기능 */}
                <div className="bg-gray-900/50 rounded-md p-2 flex flex-row items-center gap-4 flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-gray-300 whitespace-nowrap">{isStrategic ? '특수 기능' : '놀이 기능'}</h3>
                    <div className="flex items-center justify-center gap-2 flex-wrap flex-grow">
                        {isStrategic ? (
                            <>
                                {!isGameEnded && hasItems && renderItemButtons()}
                            </>
                        ) : (
                            mode === GameMode.Dice ? <DicePanel session={session} isMyTurn={isMyTurn} onAction={onAction} currentUser={currentUser} /> :
                            mode === GameMode.Thief ? <ThiefPanel session={session} isMyTurn={isMyTurn} onAction={onAction} currentUser={currentUser} /> :
                            mode === GameMode.Curling ? <CurlingItemPanel session={session} isMyTurn={isMyTurn} onAction={onAction} currentUser={currentUser} /> :
                            mode === GameMode.Alkkagi ? <AlkkagiItemPanel session={session} isMyTurn={isMyTurn} onAction={onAction} currentUser={currentUser} /> :
                            <PlayfulStonesPanel session={session} currentUser={currentUser} />
                        )}
                    </div>
                </div>
            </div>
             {/* Admin Controls */}
            {isSpectator && currentUser.isAdmin && isGameActive && (
                <div className="bg-purple-900/50 rounded-md p-2 flex flex-row items-center gap-4 w-full mt-1">
                    <h3 className="text-xs font-bold text-purple-300 whitespace-nowrap">관리자 기능</h3>
                    <div className="flex items-center justify-center gap-2 flex-wrap flex-grow">
                        <Button
                            onClick={() => {
                                if (window.confirm(`${player1.nickname}님을 기권승 처리하시겠습니까?`)) {
                                    onAction({ type: 'ADMIN_FORCE_WIN', payload: { gameId, winnerId: player1.id } })
                                }
                            }}
                            colorScheme="purple"
                            className="!text-xs !py-1 !px-2"
                        >
                            {player1.nickname} 기권승
                        </Button>
                        <Button
                            onClick={() => {
                                 if (window.confirm(`${player2.nickname}님을 기권승 처리하시겠습니까?`)) {
                                    onAction({ type: 'ADMIN_FORCE_WIN', payload: { gameId, winnerId: player2.id } })
                                 }
                            }}
                            colorScheme="purple"
                            className="!text-xs !py-1 !px-2"
                        >
                            {player2.nickname} 기권승
                        </Button>
                    </div>
                </div>
            )}
        </footer>
    );
};

export default GameControls;