import { type LiveGameSession, type VolatileState, type ServerAction, type User, type HandleActionResult, Player, GameMode, GameStatus } from '../../types/index.js';

export const initializeHidden = (game: LiveGameSession) => {
    const isHiddenMode = game.mode === GameMode.Hidden || (game.mode === GameMode.Mix && game.settings.mixedModes?.includes(GameMode.Hidden));
    
    game.hiddenMoves = {};
    game.revealedStones = { [game.player1.id]: [], [game.player2.id]: [] };

    if (isHiddenMode) {
        game.scans_p1 = game.settings.scanCount;
        game.hidden_stones_used_p1 = 0;
        if (!game.isAiGame) {
            game.scans_p2 = game.settings.scanCount;
            game.hidden_stones_used_p2 = 0;
        }
    } else if (game.isTowerChallenge || game.isSinglePlayer) {
         if (game.settings.scanCount) {
             game.scans_p1 = game.settings.scanCount;
         }
         if (game.settings.hiddenStoneCount) {
             game.hidden_stones_used_p1 = 0;
         }
    }
};

export const updateHiddenState = (game: LiveGameSession, now: number) => {
    if (game.gameStatus === GameStatus.HiddenPlacing && game.itemUseDeadline && now > game.itemUseDeadline) {
        const timedOutPlayerId = game.currentPlayer === Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
        game.foulInfo = { message: `히든 착수 시간 초과!`, expiry: now + 4000 };
        
        // "Consume" the hidden stone usage for this turn
        const myHiddenUsedKey = timedOutPlayerId === game.player1.id ? 'hidden_stones_used_p1' : 'hidden_stones_used_p2';
        (game as any)[myHiddenUsedKey] = ((game as any)[myHiddenUsedKey] || 0) + 1;

        game.gameStatus = GameStatus.Playing;
        if (game.pausedTurnTimeLeft) {
            const timeKey = game.currentPlayer === Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
            game[timeKey] = game.pausedTurnTimeLeft;
            game.turnDeadline = now + game[timeKey] * 1000;
            game.turnStartTime = now;
        }
        game.itemUseDeadline = undefined;
        game.pausedTurnTimeLeft = undefined;
        return;
    }

    if (game.gameStatus === GameStatus.Scanning && game.itemUseDeadline && now > game.itemUseDeadline) {
        const timedOutPlayerId = game.currentPlayer === Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
        game.foulInfo = { message: `스캔 시간 초과!`, expiry: now + 4000 };
        
        // Consume one scan
        const myScansKey = timedOutPlayerId === game.player1.id ? 'scans_p1' : 'scans_p2';
        if ((game as any)[myScansKey] > 0) {
            (game as any)[myScansKey]--;
        }

        game.gameStatus = GameStatus.Playing;
        
        if (game.settings.timeLimit > 0 && game.pausedTurnTimeLeft) {
            const currentPlayerTimeKey = game.currentPlayer === Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
            game[currentPlayerTimeKey] = game.pausedTurnTimeLeft;
            game.turnDeadline = now + game[currentPlayerTimeKey] * 1000;
            game.turnStartTime = now;
        } else {
             game.turnDeadline = undefined;
             game.turnStartTime = undefined;
        }
        
        game.itemUseDeadline = undefined;
        game.pausedTurnTimeLeft = undefined;
        return;
    }

    if (game.gameStatus === GameStatus.ScanningAnimating && game.animation && now > game.animation.startTime + game.animation.duration) {
        game.animation = null;
        game.gameStatus = GameStatus.Playing;
        
        // Restore timer for the SAME player after scan.
        if (game.pausedTurnTimeLeft) {
            const timeKey = game.currentPlayer === Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
            game[timeKey] = game.pausedTurnTimeLeft;
            game.turnDeadline = now + game[timeKey] * 1000;
            game.turnStartTime = now;
        }
        
        game.pausedTurnTimeLeft = undefined;
    }
    
    if (game.gameStatus === GameStatus.HiddenRevealAnimating && game.animation && now > game.animation.startTime + game.animation.duration) {
        game.animation = null;
        
        if (game.pendingCapture) {
             // Let strategic.ts handle the turn switch after processing capture
        } else if (game.pausedTurnTimeLeft) {
             // Restore timer for the SAME player after a placement-reveal.
            const timeKey = game.currentPlayer === Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
            game[timeKey] = game.pausedTurnTimeLeft;
            game.turnDeadline = now + game[timeKey] * 1000;
            game.turnStartTime = now;
            game.pausedTurnTimeLeft = undefined;
        }
        
        game.gameStatus = GameStatus.Playing;
        game.justCaptured = undefined; // Clear the just captured info after animation
    }
};


export const handleHiddenAction = (volatileState: VolatileState, game: LiveGameSession, action: ServerAction & { userId: string }, user: User): HandleActionResult | null => {
    const { type, payload } = action;
    const now = Date.now();
    const myPlayerEnum = user.id === game.blackPlayerId ? Player.Black : (user.id === game.whitePlayerId ? Player.White : Player.None);
    const isMyTurn = myPlayerEnum === game.currentPlayer;

    switch(type) {
        case 'START_HIDDEN_PLACEMENT': {
            if (!isMyTurn || game.gameStatus !== GameStatus.Playing) return { error: "Not your turn to use an item." };
            
            const myHiddenUsedKey = user.id === game.player1.id ? 'hidden_stones_used_p1' : 'hidden_stones_used_p2';
            const myHiddenUsed = game[myHiddenUsedKey] || 0;
            if (myHiddenUsed >= game.settings.hiddenStoneCount!) return { error: "히든돌을 모두 사용했습니다."};

            game.gameStatus = GameStatus.HiddenPlacing;
            if(game.turnDeadline) {
                game.pausedTurnTimeLeft = (game.turnDeadline - now) / 1000;
            }
            game.turnDeadline = undefined;
            game.turnStartTime = undefined;
            game.itemUseDeadline = now + 30000;
            return {};
        }

        case 'START_SCANNING': {
            if (!isMyTurn || game.gameStatus !== GameStatus.Playing) return { error: "Not your turn to use an item." };

            const myScansKey = user.id === game.player1.id ? 'scans_p1' : 'scans_p2';
            if ((game[myScansKey] ?? 0) <= 0) return { error: "스캔을 모두 사용했습니다." };
            
            game.gameStatus = GameStatus.Scanning;
            if (game.turnDeadline) {
                game.pausedTurnTimeLeft = (game.turnDeadline - now) / 1000;
            }
            game.turnDeadline = undefined;
            game.turnStartTime = undefined;
            game.itemUseDeadline = now + 30000;
            return {};
        }
        
        case 'SCAN_BOARD': {
            if (game.gameStatus !== GameStatus.Scanning || !isMyTurn) return { error: "Not in scan mode." };
            
            game.itemUseDeadline = undefined; // Stop timeout timer

            const myScansKey = user.id === game.player1.id ? 'scans_p1' : 'scans_p2';
            if ((game[myScansKey] ?? 0) <= 0) return { error: "스캔을 모두 사용했습니다." };

            (game[myScansKey] as number)--;

            const { x, y } = payload;
            const opponentEnum = myPlayerEnum === Player.Black ? Player.White : Player.Black;

            let foundHidden = false;
            let revealedIndex = -1;

            if (game.moveHistory && game.hiddenMoves) {
                for (let i = game.moveHistory.length - 1; i >= 0; i--) {
                    const move = game.moveHistory[i];
                    if (move.x === x && move.y === y && move.player === opponentEnum && game.hiddenMoves[i]) {
                        if (!game.revealedHiddenMoves) game.revealedHiddenMoves = {};
                        if (!game.revealedHiddenMoves[user.id]) game.revealedHiddenMoves[user.id] = [];
                        
                        const isPermanentlyRevealed = game.permanentlyRevealedStones?.some(p => p.x === x && p.y === y);
                        const alreadyRevealedByMe = game.revealedHiddenMoves[user.id].includes(i);

                        if (!isPermanentlyRevealed && !alreadyRevealedByMe) {
                            game.revealedHiddenMoves[user.id].push(i);
                            foundHidden = true;
                            revealedIndex = i;
                        }
                        break; 
                    }
                }
            }

            game.animation = {
                type: 'scan',
                point: { x, y },
                success: foundHidden,
                playerId: user.id,
                startTime: now,
                duration: 2000
            };
            
            game.gameStatus = GameStatus.ScanningAnimating;

            return {};
        }
    }
    return null;
};