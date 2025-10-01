// utils/goLogic.js
// This file is restored to fix client-side import errors.
// Its content is a pure implementation of Go logic.

// Inlined Player enum to resolve module import issue for this JS file.
const Player = {
    None: 0,
    Black: 1,
    White: 2,
};
Object.freeze(Player); // Make it read-only like a real enum

const getNeighbors = (px, py, boardSize) => {
    const neighbors = [];
    if (px > 0) neighbors.push({ x: px - 1, y: py });
    if (px < boardSize - 1) neighbors.push({ x: px + 1, y: py });
    if (py > 0) neighbors.push({ x: px, y: py - 1 });
    if (py < boardSize - 1) neighbors.push({ x: px, y: py + 1 });
    return neighbors;
};

const findGroup = (startX, startY, playerColor, currentBoard, boardSize) => {
    if (startY < 0 || startY >= boardSize || startX < 0 || startX >= boardSize || currentBoard[startY]?.[startX] !== playerColor) return null;
    const q = [{ x: startX, y: startY }];
    const visitedStones = new Set([`${startX},${startY}`]);
    const libertyPoints = new Set();
    const stones = [];

    while (q.length > 0) {
        const { x: cx, y: cy } = q.shift();
        stones.push({ x: cx, y: cy });

        for (const n of getNeighbors(cx, cy, boardSize)) {
            const key = `${n.x},${n.y}`;
            const neighborContent = currentBoard[n.y][n.x];

            if (neighborContent === Player.None) {
                libertyPoints.add(key);
            } else if (neighborContent === playerColor) {
                if (!visitedStones.has(key)) {
                    visitedStones.add(key);
                    q.push(n);
                }
            }
        }
    }
    return { stones, liberties: libertyPoints.size, libertyPoints };
};

export const processMove = (
    boardState,
    move,
    koInfo,
    moveHistoryLength,
    options
) => {
    const { x, y, player } = move;
    const boardSize = boardState.length;
    const opponent = player === Player.Black ? Player.White : Player.Black;

    if (y < 0 || y >= boardSize || x < 0 || x >= boardSize || boardState[y]?.[x] !== Player.None) {
        return { isValid: false, reason: 'occupied', newBoardState: boardState, capturedStones: [], newKoInfo: koInfo };
    }
    
    if (koInfo?.point?.x === x && koInfo?.point?.y === y && koInfo?.turn === moveHistoryLength) {
        return { isValid: false, reason: 'ko', newBoardState: boardState, capturedStones: [], newKoInfo: koInfo };
    }

    const tempBoard = JSON.parse(JSON.stringify(boardState));
    tempBoard[y][x] = player;

    let capturedStones = [];
    let singleCapturePoint = null;
    const checkedOpponentNeighbors = new Set();

    for (const n of getNeighbors(x, y, boardSize)) {
        const key = `${n.x},${n.y}`;
        if (tempBoard[n.y][n.x] === opponent && !checkedOpponentNeighbors.has(key)) {
            const group = findGroup(n.x, n.y, opponent, tempBoard, boardSize);
            if (group && group.liberties === 0) {
                capturedStones.push(...group.stones);
                if (group.stones.length === 1) {
                    singleCapturePoint = group.stones[0];
                }
                group.stones.forEach(s => checkedOpponentNeighbors.add(`${s.x},${s.y}`));
            }
        }
    }
    
    capturedStones = Array.from(new Set(capturedStones.map(s => JSON.stringify(s)))).map(s => JSON.parse(s));

    if (capturedStones.length > 0) {
        for (const stone of capturedStones) {
            tempBoard[stone.y][stone.x] = Player.None;
        }
    }

    const myGroup = findGroup(x, y, player, tempBoard, boardSize);
    if (!options?.ignoreSuicide && myGroup && myGroup.liberties === 0) {
        return { isValid: false, reason: 'suicide', newBoardState: boardState, capturedStones: [], newKoInfo: koInfo };
    }

    let newKoInfo = null;
    if (myGroup && capturedStones.length === 1 && myGroup.stones.length === 1 && myGroup.liberties === 1) {
        if (singleCapturePoint) {
            newKoInfo = { point: singleCapturePoint, turn: moveHistoryLength + 1 };
        }
    }

    return { isValid: true, newBoardState: tempBoard, capturedStones, newKoInfo };
};


export const getGoLogic = (game) => {
    const { boardState, settings: { boardSize } } = game;

    const placeStone = (x, y) => {
        const player = game.currentPlayer;
        const result = processMove(
            game.boardState,
            { x, y, player },
            game.koInfo,
            game.moveHistory.length
        );

        if (result.isValid) {
            game.boardState = result.newBoardState;
            game.captures[player] += result.capturedStones.length;
            game.koInfo = result.newKoInfo;
        }

        return result;
    };

    const findGroupLocal = (startX, startY, playerColor, currentBoard) => {
        return findGroup(startX, startY, playerColor, currentBoard, boardSize);
    };
    
    const getAllGroups = (playerColor, currentBoard) => {
        const groups = [];
        const visited = new Set();
        for (let y = 0; y < boardSize; y++) {
            for (let x = 0; x < boardSize; x++) {
                const key = `${x},${y}`;
                if (currentBoard[y][x] === playerColor && !visited.has(key)) {
                    const group = findGroupLocal(x, y, playerColor, currentBoard);
                    if (group) {
                        groups.push(group);
                        group.stones.forEach(s => visited.add(`${s.x},${s.y}`));
                    }
                }
            }
        }
        return groups;
    };

    const getAllLibertiesOfPlayer = (playerColor, currentBoard) => {
        const allLiberties = new Set();
        const groups = getAllGroups(playerColor, currentBoard);
        groups.forEach(group => {
            group.libertyPoints.forEach(libertyKey => {
                allLiberties.add(libertyKey);
            });
        });
        return Array.from(allLiberties).map(key => {
            const [x, y] = key.split(',').map(Number);
            return { x, y };
        });
    };

    const getScore = () => {
        const score = { black: 0, white: 0 };
        const visited = new Set();

        for (let y = 0; y < boardSize; y++) {
            for (let x = 0; x < boardSize; x++) {
                const key = `${x},${y}`;
                if (boardState[y][x] !== Player.None && !visited.has(key)) {
                    const group = findGroupLocal(x, y, boardState[y][x], boardState);
                    if (group) {
                        if (group.liberties === 0) {
                            if (boardState[y][x] === Player.Black) {
                                score.white += group.stones.length;
                            } else {
                                score.black += group.stones.length;
                            }
                        }
                        group.stones.forEach(s => visited.add(`${s.x},${s.y}`));
                    }
                }
            }
        }

        const territoryBoard = JSON.parse(JSON.stringify(boardState));
        for (let y = 0; y < boardSize; y++) {
            for (let x = 0; x < boardSize; x++) {
                if (territoryBoard[y][x] !== Player.None) {
                    const group = findGroupLocal(x, y, territoryBoard[y][x], territoryBoard);
                    if (group && group.liberties === 0) {
                        group.stones.forEach(s => territoryBoard[s.y][s.x] = Player.None);
                    }
                }
            }
        }
        
        const territoryVisited = new Set();
        for (let y = 0; y < boardSize; y++) {
            for (let x = 0; x < boardSize; x++) {
                const key = `${x},${y}`;
                if (territoryBoard[y][x] === Player.None && !territoryVisited.has(key)) {
                    const q = [{ x, y }];
                    territoryVisited.add(key);
                    const group = [];
                    let bordersBlack = false;
                    let bordersWhite = false;
                    
                    while (q.length > 0) {
                        const current = q.shift();
                        group.push(current);
                        for (const n of getNeighbors(current.x, current.y, boardSize)) {
                            const nKey = `${n.x},${n.y}`;
                            if (territoryBoard[n.y][n.x] === Player.None && !territoryVisited.has(nKey)) {
                                territoryVisited.add(nKey);
                                q.push(n);
                            } else if (territoryBoard[n.y][n.x] === Player.Black) {
                                bordersBlack = true;
                            } else if (territoryBoard[n.y][n.x] === Player.White) {
                                bordersWhite = true;
                            }
                        }
                    }
                    
                    if (bordersBlack && !bordersWhite) {
                        score.black += group.length;
                    } else if (!bordersBlack && bordersWhite) {
                        score.white += group.length;
                    }
                }
            }
        }

        return { score };
    };

    return {
        placeStone,
        getNeighbors: (x, y) => getNeighbors(x, y, boardSize),
        findGroup: findGroupLocal,
        getScore,
        getAllGroups,
        getAllLibertiesOfPlayer,
    };
};