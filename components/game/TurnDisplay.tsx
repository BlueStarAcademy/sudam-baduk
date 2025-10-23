import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LiveGameSession, Player, GameStatus, GameMode, User, UserWithStatus, WinReason, GameType } from '../../types.js';
import { PLAYFUL_GAME_MODES, DICE_GO_MAIN_PLACE_TIME, DICE_GO_MAIN_ROLL_TIME, DICE_GO_LAST_CAPTURE_BONUS_BY_TOTAL_ROUNDS } from '../../constants/index.js';
import { audioService } from '../../services/audioService.js';

interface TurnDisplayProps {
    session: LiveGameSession;
    currentUser: UserWithStatus;
}

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

const getGameStatusText = (session: LiveGameSession, currentUser: UserWithStatus): string => {
    const { 
        gameStatus, currentPlayer, blackPlayerId, whitePlayerId, player1, player2, 
        mode, settings, passCount, moveHistory, alkkagiRound, blackStonesPlaced, 
        blackStoneLimit, gameType, whiteStonesPlaced, whiteStoneLimit, winReason, 
        lastTimeoutPlayerId, autoEndTurnCount, blackTimeLeft, whiteTimeLeft, 
        blackByoyomiPeriodsLeft, whiteByoyomiPeriodsLeft, round 
    } = session;

    if (winReason === WinReason.Timeout && lastTimeoutPlayerId) {
        const loser = player1.id === lastTimeoutPlayerId ? player1 : player2;
        return `${loser.nickname}님 시간초과. 시간패입니다.`;
    }
    
    const getPlayerByEnum = (playerEnum: Player): User | null => {
        const targetId = playerEnum === Player.Black ? blackPlayerId : whitePlayerId;
        if (!targetId) return null;
        return player1.id === targetId ? player1 : player2;
    };

    const isAutoScoring = autoEndTurnCount && moveHistory.length >= autoEndTurnCount;
    const lastMoveInHistory = moveHistory.length > 0 ? moveHistory[moveHistory.length - 1] : null;

    if (!isAutoScoring) {
        if (passCount >= 2 && lastMoveInHistory?.x === -1) {
            return "양측 모두 통과하여 계가를 시작합니다.";
        }
        if (gameStatus !== GameStatus.Ended && passCount === 1 && lastMoveInHistory?.x === -1) {
            const opponentOfCurrent = currentPlayer === Player.Black ? Player.White : Player.Black;
            const passingPlayer = getPlayerByEnum(opponentOfCurrent);
            if (passingPlayer) {
                return `${passingPlayer.nickname}님이 통과했습니다.`;
            }
        }
    }
    
    const currentPlayerObj = getPlayerByEnum(currentPlayer);
    const currentPlayerTimeLeft = currentPlayer === Player.Black ? blackTimeLeft : whiteTimeLeft;
    const currentPlayerByoyomiLeft = currentPlayer === Player.Black ? blackByoyomiPeriodsLeft : whiteByoyomiPeriodsLeft;

    if (currentPlayerTimeLeft <= 0 && (settings.byoyomiCount ?? 0) > 0) {
        if (currentPlayerByoyomiLeft === 1) {
            return `${currentPlayerObj?.nickname}님 마지막 초읽기입니다.`;
        }
    }
    
    switch (gameStatus) {
        case GameStatus.Scoring:
            return '계가 중입니다...';
        case GameStatus.SinglePlayerIntro:
            return '게임 방법을 확인해주세요.';
        case GameStatus.AiHiddenThinking:
            return 'AI가 히든돌을 사용합니다...';
        case GameStatus.Playing: {
            if (gameType === GameType.Survival && autoEndTurnCount) {
                const remainingTurns = autoEndTurnCount - moveHistory.length;
                if (remainingTurns <= 0) {
                    return "AI의 공격 턴이 모두 소진되었습니다. 계가를 시작합니다.";
                }
                return `AI의 공격 턴: ${remainingTurns}회 남음`;
            }
            const player = getPlayerByEnum(currentPlayer);
            return player ? `${player.nickname}님의 차례입니다.` : '대국 진행 중';
        }
        case GameStatus.Ended:
            return '대국 종료';
        case GameStatus.NoContest:
            return '무효 대국';
        case GameStatus.RematchPending:
            return '재대결 대기 중...';
        case GameStatus.HiddenPlacing:
        case GameStatus.Scanning:
        case GameStatus.MissileSelecting:
            return '아이템 사용 중...';
        case GameStatus.HiddenFinalReveal:
            return "모든 히든돌을 공개하고 계가를 시작합니다.";
        case GameStatus.AlkkagiPlacement: {
            const currentRound = alkkagiRound || 1;
            const totalRounds = settings.alkkagiRounds || 1;
            if (currentRound > 1) {
                return `돌을 다시 배치하세요. (${currentRound} / ${totalRounds} 라운드)`;
            }
            return `돌을 배치하세요. (${currentRound} / ${totalRounds} 라운드)`;
        }
        case GameStatus.AlkkagiPlaying: {
            const currentRound = alkkagiRound || 1;
            const totalRounds = settings.alkkagiRounds || 1;
            return `${currentPlayerObj?.nickname}님 차례입니다. (${currentRound} / ${totalRounds} 라운드)`;
        }
        case GameStatus.AlkkagiRoundEnd:
            return `라운드 종료! 결과를 확인하세요.`;
        case GameStatus.DiceRolling:
             return currentPlayerObj ? `${currentPlayerObj.nickname}님이 주사위를 굴릴 차례입니다.` : '주사위 굴릴 차례';
        case GameStatus.ThiefRolling:
             return currentPlayerObj ? `${currentPlayerObj.nickname}님이 주사위를 굴릴 차례입니다.` : '주사위 굴릴 차례';
        case GameStatus.CurlingTiebreakerPreferenceSelection:
        case GameStatus.CurlingTiebreakerRps:
        case GameStatus.CurlingTiebreakerRpsReveal:
            return '승부치기 순서 결정 중...';
        case GameStatus.CurlingTiebreakerPlaying:
            return `승부치기 진행 중... (${currentPlayerObj?.nickname}님 차례)`;
        default:
            if (mode === GameMode.Dice) return `주사위 바둑 (${round} / ${settings.diceGoRounds} 라운드)`;
            if (mode === GameMode.Thief) return `도둑과 경찰 (${round} 라운드)`;
            return currentPlayerObj ? `${currentPlayerObj.nickname}님의 차례입니다.` : '게임 준비 중...';
    }
};

const TurnDisplay: React.FC<TurnDisplayProps> = ({ session, currentUser }) => {
    const [timeLeft, setTimeLeft] = useState(30);
    const [percentage, setPercentage] = useState(100);
    const [foulMessage, setFoulMessage] = useState<string | null>(null);
    const [byoyomiMessage, setByoyomiMessage] = useState<string | null>(null);
    

    
    const prevTimeoutPlayerId = usePrevious(session.lastTimeoutPlayerId);
    const prevFoulInfoMessage = usePrevious(session.foulInfo?.message);
    const { blackByoyomiPeriodsLeft, whiteByoyomiPeriodsLeft, player1, player2, blackPlayerId, whitePlayerId, settings } = session;
    const prevBlackByoyomi = usePrevious(blackByoyomiPeriodsLeft);
    const prevWhiteByoyomi = usePrevious(whiteByoyomiPeriodsLeft);
    const prevBlackTimeLeft = usePrevious(session.blackTimeLeft);
    const prevWhiteTimeLeft = usePrevious(session.whiteTimeLeft);


    const isPlayfulTurn = useMemo(() => {
        return PLAYFUL_GAME_MODES.some(m => m.mode === session.mode) && 
               session.turnDeadline && 
               session.turnStartTime &&
               [GameStatus.DiceRolling, GameStatus.DicePlacing, GameStatus.ThiefRolling, GameStatus.ThiefPlacing].includes(session.gameStatus);
    }, [session.mode, session.turnDeadline, session.turnStartTime, session.gameStatus]);

    useEffect(() => {
        if (!isPlayfulTurn) {
            setPercentage(100);
            return;
        }

        const totalDuration = session.turnDeadline! - session.turnStartTime!;
        if (totalDuration <= 0) return;

        const updateBar = () => {
            const remaining = session.turnDeadline! - Date.now();
            const newPercentage = Math.max(0, (remaining / totalDuration) * 100);
            setPercentage(newPercentage);
        };

        updateBar();
        const interval = setInterval(updateBar, 100);
        return () => clearInterval(interval);
    }, [isPlayfulTurn, session.turnDeadline, session.turnStartTime]);


    useEffect(() => {
        if (session.foulInfo && session.foulInfo.message !== prevFoulInfoMessage) {
            setFoulMessage(session.foulInfo.message);
            audioService.timeoutFoul();
            const timer = setTimeout(() => setFoulMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [session.foulInfo, prevFoulInfoMessage]);

    useEffect(() => {
        if (session.lastTimeoutPlayerId && session.lastTimeoutPlayerId !== prevTimeoutPlayerId) {
            const isFoulMode = PLAYFUL_GAME_MODES.some(m => m.mode === session.mode);
            if (isFoulMode) {
                 const foulPlayer = session.player1.id === session.lastTimeoutPlayerId ? session.player1 : session.player2;
                 setFoulMessage(`${foulPlayer.nickname}님의 타임오버 파울!`);
                 const timer = setTimeout(() => setFoulMessage(null), 5000);
                 return () => clearTimeout(timer);
            }
        }
    }, [session.lastTimeoutPlayerId, prevTimeoutPlayerId, session.mode, session.player1, session.player2]);
    
    useEffect(() => {
        const resetStatuses: GameStatus[] = [
            GameStatus.Playing, GameStatus.Ended, GameStatus.NoContest, // Strategic/General
            GameStatus.AlkkagiPlaying, GameStatus.CurlingPlaying, GameStatus.DiceRolling, GameStatus.DicePlacing, GameStatus.ThiefRolling, GameStatus.ThiefPlacing // Playful
        ];
    
        if (resetStatuses.includes(session.gameStatus)) {
            setFoulMessage(null);
        }
    }, [session.gameStatus]);

    const isItemMode = [GameStatus.HiddenPlacing, GameStatus.Scanning, GameStatus.MissileSelecting].includes(session.gameStatus);

    useEffect(() => {
        if (!isItemMode || !session.itemUseDeadline) {
            return;
        }

        const updateTimer = () => {
            const remaining = Math.max(0, Math.ceil((session.itemUseDeadline! - Date.now()) / 1000));
            setTimeLeft(remaining);
        };

        updateTimer();
        const timerId = setInterval(updateTimer, 500);

        return () => clearInterval(timerId);
    }, [isItemMode, session.itemUseDeadline]);
    
    useEffect(() => {
        let msg = '';
        const { byoyomiCount, byoyomiTime } = settings;
        let playByoyomiSound = false;
    
        const blackEnteredByoyomi = prevBlackTimeLeft !== undefined && prevBlackTimeLeft > 0 && session.blackTimeLeft <= 0;
        const whiteEnteredByoyomi = prevWhiteTimeLeft !== undefined && prevWhiteTimeLeft > 0 && session.whiteTimeLeft <= 0;
    
        if (blackEnteredByoyomi && byoyomiCount > 0) {
            const blackPlayerName = blackPlayerId === player1.id ? player1.nickname : player2.nickname;
            msg = `${blackPlayerName}님 초읽기를 시작합니다. ${byoyomiTime}초 초읽기 ${byoyomiCount}회 입니다.`;
            playByoyomiSound = true;
        } else if (whiteEnteredByoyomi && byoyomiCount > 0) {
            const whitePlayerName = whitePlayerId === player1.id ? player1.nickname : player2.nickname;
            msg = `${whitePlayerName}님 초읽기를 시작합니다. ${byoyomiTime}초 초읽기 ${byoyomiCount}회 입니다.`;
            playByoyomiSound = true;
        } else if (prevBlackByoyomi !== undefined && blackByoyomiPeriodsLeft < prevBlackByoyomi) {
            const blackPlayerName = blackPlayerId === player1.id ? player1.nickname : player2.nickname;
            playByoyomiSound = true;
            if (blackByoyomiPeriodsLeft === 1) {
                msg = `${blackPlayerName}님 마지막 초읽기입니다.`;
            } else if (blackByoyomiPeriodsLeft > 1) {
                msg = `${blackPlayerName}님, 초읽기 ${blackByoyomiPeriodsLeft}회 남았습니다.`;
            }
        } else if (prevWhiteByoyomi !== undefined && whiteByoyomiPeriodsLeft < prevWhiteByoyomi) {
            const whitePlayerName = whitePlayerId === player1.id ? player1.nickname : player2.nickname;
            playByoyomiSound = true;
            if (whiteByoyomiPeriodsLeft === 1) {
                msg = `${whitePlayerName}님 마지막 초읽기입니다.`;
            } else if (whiteByoyomiPeriodsLeft > 1) {
                msg = `${whitePlayerName}님, 초읽기 ${whiteByoyomiPeriodsLeft}회 남았습니다.`;
            }
        }
    
        if (msg) {
            setByoyomiMessage(msg);
            const timer = setTimeout(() => setByoyomiMessage(null), 5000);
            if (playByoyomiSound) {
                audioService.timeoutFoul();
            }
            return () => clearTimeout(timer);
        }
    }, [
        session.blackTimeLeft, session.whiteTimeLeft, 
        session.blackByoyomiPeriodsLeft, session.whiteByoyomiPeriodsLeft, 
        prevBlackTimeLeft, prevWhiteTimeLeft, 
        prevBlackByoyomi, prevWhiteByoyomi,
        player1, player2, blackPlayerId, whitePlayerId, settings
    ]);

    const isSinglePlayer = session.isSinglePlayer;
    const isTowerChallenge = session.isTowerChallenge;
    const baseClasses = "flex-shrink-0 rounded-lg flex flex-col items-center justify-center shadow-inner py-2 h-auto border";
    
    const themeClasses = isTowerChallenge 
        ? "bg-black/50 border-red-800/50"
        : isSinglePlayer 
            ? "bg-stone-800/70 backdrop-blur-sm border-stone-700/50" 
            : "bg-secondary border-color";
    const textClass = isTowerChallenge ? "text-red-300" : isSinglePlayer ? "text-amber-300" : "text-highlight";
    const statusTextSize = "text-[clamp(0.9rem,3vmin,1.2rem)]";
    const foulTextSize = "text-[clamp(1rem,3.5vmin,1.5rem)]";

    if (foulMessage) {
        return (
            <div className={`flex-shrink-0 bg-danger rounded-lg flex items-center justify-center shadow-inner animate-pulse py-2 h-auto border-2 border-red-500`}>
                <p className={`font-bold text-white tracking-wider ${foulTextSize}`}>{foulMessage}</p>
            </div>
        );
    }
    
    if (byoyomiMessage) {
        return (
            <div className={`flex-shrink-0 bg-yellow-600 rounded-lg flex items-center justify-center shadow-inner py-2 h-auto border-2 border-yellow-400`}>
                <p className={`font-bold text-white tracking-wider animate-pulse ${statusTextSize}`}>{byoyomiMessage}</p>
            </div>
        );
    }

    if (session.mode === GameMode.Dice && session.gameStatus === GameStatus.DicePlacing && session.dice) {
        return (
            <div className={`${baseClasses} ${themeClasses} px-4 gap-1`}>
                <div className="flex items-center gap-2">
                    <span className={`font-bold text-tertiary ${statusTextSize}`}>주사위: <span className={`${textClass}`}>{session.dice.dice1}</span></span>
                    <div className={`w-px h-5 ${isSinglePlayer ? 'bg-stone-600' : 'bg-border-color'}`}></div>
                    <span className={`font-bold text-tertiary ${statusTextSize}`}>남은 돌: <span className={`${textClass}`}>{session.stonesToPlace}</span></span>
                </div>
                {isPlayfulTurn && <div className="w-full h-1 bg-tertiary rounded-full mt-1"><div className="h-1 bg-red-500 rounded-full" style={{width: `${percentage}%`}} /></div>}
            </div>
        )
    }

    if (session.mode === GameMode.Thief && session.gameStatus === GameStatus.ThiefPlacing && session.dice) {
        const { dice1, dice2 } = session.dice;
        const diceDisplay = dice2 > 0 ? `${dice1}, ${dice2}` : `${dice1}`;
        return (
             <div className={`${baseClasses} ${themeClasses} px-4 gap-2`}>
                 <span className={`font-bold text-tertiary ${statusTextSize}`}>주사위: <span className={`${textClass}`}>{diceDisplay}</span></span>
                 <div className={`w-px h-5 ${isSinglePlayer ? 'bg-stone-600' : 'bg-border-color'}`}></div>
                 <span className={`font-bold text-tertiary ${statusTextSize}`}>남은 착수: <span className={`${textClass}`}>{session.stonesToPlace}</span></span>
            </div>
        )
    }

    if (isItemMode) {
        let itemText = "아이템 사용시간";
        if (session.gameStatus === GameStatus.HiddenPlacing) itemText = "히든 사용시간";
        if (session.gameStatus === GameStatus.Scanning) itemText = "스캔 사용시간";
        if (session.gameStatus === GameStatus.MissileSelecting) itemText = "미사일 조준";

        const percentage = (timeLeft / 30) * 100;

        return (
            <div className={`${baseClasses} ${themeClasses} px-4 gap-2`}>
                <span className={`font-bold ${textClass} tracking-wider flex-shrink-0 ${statusTextSize}`}>{itemText}</span>
                <div className={`w-full bg-tertiary rounded-full h-[clamp(0.5rem,1.5vh,0.75rem)] relative overflow-hidden border-2 ${isSinglePlayer ? 'border-black/20' : 'border-tertiary'}`}>
                    <div className="absolute inset-0 bg-highlight rounded-full" style={{ width: `${percentage}%`, transition: 'width 0.5s linear' }}></div>
                </div>
                <span className={`font-mono font-bold text-primary w-[clamp(3rem,10vmin,4rem)] text-center text-[clamp(1rem,3.5vmin,1.4rem)]`}>{timeLeft}초</span>
            </div>
        );
    }
    
    const statusText = getGameStatusText(session, currentUser);

    return (
        <div className={`${baseClasses} ${themeClasses}`}>
            <p className={`font-bold ${textClass} tracking-wider ${statusTextSize} text-center px-2`}>{statusText}</p>
            {isPlayfulTurn && <div className="w-11/12 h-1 bg-tertiary rounded-full mt-1"><div className="h-1 bg-red-500 rounded-full" style={{width: `${percentage}%`}} /></div>}
        </div>
    );
};

export default TurnDisplay;