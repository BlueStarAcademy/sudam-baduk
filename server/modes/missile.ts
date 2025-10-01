
import { type LiveGameSession, Player, GameMode, GameStatus, type ServerAction, type User, type HandleActionResult, type Point } from '../../types/index.js';
import { getGoLogic } from '../goLogic.js';
import { makeAiMove } from '../ai/index.js';

export const initializeMissile = (game: LiveGameSession) => {
    const isMissileMode = game.mode === GameMode.Missile || (game.mode === GameMode.Mix && game.settings.mixedModes?.includes(GameMode.Missile));
    
    if (isMissileMode) {
        game.missiles_p1 = game.settings.missileCount;
        if (!game.isAiGame) { // AI doesn't get missiles by default in PvP mix mode
            game.missiles_p2 = game.settings.missileCount;
        }
    } else if (game.isTowerChallenge || game.isSinglePlayer) {
         // Explicitly grant missiles in these modes if the setting exists
         if (game.settings.missileCount) {
             game.missiles_p1 = game.settings.missileCount;
         }
    }
};

export const updateMissileState = (game: LiveGameSession, now: number) => {
    if (game.gameStatus === GameStatus.MissileSelecting && game.itemUseDeadline && now > game.itemUseDeadline) {
        // Item use timed out. Cancel item mode, but keep the turn with the current player.
        const timedOutPlayerEnum = game.currentPlayer;
        const timedOutPlayerId = timedOutPlayerEnum === Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
        
        game.foulInfo = { message: `${game.player1.id === timedOutPlayerId ? game.player1.nickname : game.player2.nickname}님의 아이템 시간 초과!`, expiry: now + 4000 };
        game.gameStatus = GameStatus.Playing;
        // currentPlayer remains timedOutPlayerEnum

        // Restore the timer for the current player
        if (game.settings.timeLimit > 0 && game.pausedTurnTimeLeft) {
            const currentPlayerTimeKey = timedOutPlayerEnum === Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
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

    if (game.gameStatus === GameStatus.MissileAnimating) {
        if (game.animation && now > game.animation.startTime + game.animation.duration) {
            game.animation = null;

            // Restore timer for the SAME player after missile use.
            if (game.settings.timeLimit > 0 && game.pausedTurnTimeLeft) {
                const timeKey = game.currentPlayer === Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
                game[timeKey] = game.pausedTurnTimeLeft;
                game.turnDeadline = now + game[timeKey] * 1000;
                game.turnStartTime = now;
            } else {
                game.turnDeadline = undefined;
                game.turnStartTime = undefined;
            }

            game.pausedTurnTimeLeft = undefined;
            game.gameStatus = GameStatus.Playing; // Return to playing state for the same player.

            // The AI has just used a missile, now it needs to make a regular move.
            // The main game loop will handle this since the status is back to 'playing'.
            if (game.isAiGame || game.isSinglePlayer || game.isTowerChallenge) {
                const aiPlayerId = game.player2.id;
                const aiPlayerEnum = game.blackPlayerId === aiPlayerId ? Player.Black : Player.White;
                if (game.currentPlayer === aiPlayerEnum) {
                     game.pendingAiMove = makeAiMove(game).then(() => ({x: -1, y: -1}));
                }
            }
        }
    }
};

export const handleMissileAction = (game: LiveGameSession, action: ServerAction & { userId: string }, user: User): HandleActionResult | null => {
    const { type, payload } = action;
    const now = Date.now();
    const myPlayerEnum = user.id === game.blackPlayerId ? Player.Black : (user.id === game.whitePlayerId ? Player.White : Player.None);
    const isMyTurn = myPlayerEnum === game.currentPlayer;

    switch (type) {
        case 'START_MISSILE_SELECTION':
            if (!isMyTurn || game.gameStatus !== GameStatus.Playing) return { error: "Not your turn to use an item." };
            if (game.missileUsedThisTurn) return { error: "You have already used a missile this turn." };
            game.gameStatus = GameStatus.MissileSelecting;
            if(game.turnDeadline) {
                game.pausedTurnTimeLeft = (game.turnDeadline - now) / 1000;
            }
            game.turnDeadline = undefined;
            game.turnStartTime = undefined;
            game.itemUseDeadline = now + 30000;
            return {};
        case 'LAUNCH_MISSILE':
            if (game.gameStatus !== GameStatus.MissileSelecting) return { error: "Not in missile selection mode." };
            
            // Immediately disable the timeout timer to prevent race conditions.
            game.itemUseDeadline = undefined;
            
            const { from, direction } = payload;
            if (game.boardState[from.y][from.x] !== myPlayerEnum) return { error: "Not your stone." };

            let to: Point = from;
            let dir: Point = { x: 0, y: 0 };
            if(direction === 'up') dir.y = -1;
            else if(direction === 'down') dir.y = 1;
            else if(direction === 'left') dir.x = -1;
            else if(direction === 'right') dir.x = 1;

            let current = from;
            while(true) {
                const next = { x: current.x + dir.x, y: current.y + dir.y };
                if (next.x < 0 || next.x >= game.settings.boardSize || next.y < 0 || next.y >= game.settings.boardSize || game.boardState[next.y][next.x] !== Player.None) {
                    break;
                }
                current = next;
            }
            to = current;
            
            if (to.x === from.x && to.y === from.y) return { error: "Cannot move stone." };
            
            if (game.baseStones) {
                const baseStoneIndex = game.baseStones.findIndex(bs => bs.x === from.x && bs.y === from.y);
                if (baseStoneIndex !== -1) {
                    game.baseStones[baseStoneIndex].x = to.x;
                    game.baseStones[baseStoneIndex].y = to.y;
                }
            }

            // Find and update the move in history for KataGo analysis.
            let moveIndexToUpdate = -1;
            for (let i = game.moveHistory.length - 1; i >= 0; i--) {
                const move = game.moveHistory[i];
                if (move.x === from.x && move.y === from.y) {
                    if (game.boardState[from.y][from.x] === move.player) {
                        moveIndexToUpdate = i;
                        break;
                    }
                }
            }

            if (moveIndexToUpdate === -1) {
                console.warn(`[Missile Go] Could not find move in history for stone at ${JSON.stringify(from)} in game ${game.id}. KataGo analysis may fail.`);
            } else {
                // Immutable update of moveHistory to prevent bugs
                game.moveHistory = game.moveHistory.map((move, index) => {
                    if (index === moveIndexToUpdate) {
                        return { ...move, x: to.x, y: to.y };
                    }
                    return move;
                });
            }

            const wasHiddenStone = moveIndexToUpdate !== -1 && game.hiddenMoves?.[moveIndexToUpdate];

            if (wasHiddenStone) {
                game.animation = { type: 'hidden_missile', from, to, player: myPlayerEnum, startTime: now, duration: 3000 };
            } else {
                game.animation = { type: 'missile', from, to, player: myPlayerEnum, startTime: now, duration: 2000 };
            }

            game.boardState[from.y][from.x] = Player.None;
            game.boardState[to.y][to.x] = myPlayerEnum;

            const logic = getGoLogic(game);
            const opponentEnum = myPlayerEnum === Player.Black ? Player.White : Player.Black;
            let totalCapturedStones: Point[] = [];

            const neighbors = logic.getNeighbors(to.x, to.y);
            for (const n of neighbors) {
                if (game.boardState[n.y]?.[n.x] === opponentEnum) {
                    const group = logic.findGroup(n.x, n.y, opponentEnum, game.boardState);
                    if (group && group.liberties === 0) {
                        totalCapturedStones.push(...group.stones);
                    }
                }
            }
            
            if (totalCapturedStones.length > 0) {
                const uniqueCaptured = Array.from(new Set(totalCapturedStones.map(p => `${p.x},${p.y}`))).map(s => {
                    const [x, y] = s.split(',').map(Number);
                    return { x, y };
                });

                for (const stone of uniqueCaptured) {
                    game.captures[myPlayerEnum]++;
                    const isBaseStone = game.baseStones?.some(bs => bs.x === stone.x && bs.y === stone.y);
                    let wasHidden = false;
                    for (let i = game.moveHistory.length - 2; i >= 0; i--) { // -2 because current move is already pushed
                        if (game.moveHistory[i].x === stone.x && game.moveHistory[i].y === stone.y) {
                            if (game.hiddenMoves?.[i]) wasHidden = true;
                            break;
                        }
                    }

                    if (isBaseStone) game.baseStoneCaptures[myPlayerEnum]++;
                    else if (wasHidden) game.hiddenStoneCaptures[myPlayerEnum]++;
                    
                    game.boardState[stone.y][stone.x] = Player.None;
                }
            }

            const missileKey = user.id === game.player1.id ? 'missiles_p1' : 'missiles_p2';
            game[missileKey] = (game[missileKey] ?? 0) - 1;

            game.gameStatus = GameStatus.MissileAnimating;
            game.missileUsedThisTurn = true;
            return {};
        case 'MISSILE_INVALID_SELECTION': {
            if (game.gameStatus !== GameStatus.MissileSelecting) return { error: "Not in missile selection mode." };
            game.foulInfo = { message: '움직일 수 없는 돌입니다.', expiry: now + 4000 };
            return {};
        }
    }
    return null;
};
