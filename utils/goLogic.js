// This file has been manually transpiled from goLogic.ts to fix a server startup crash.
// The original file tried to `export * from './goLogic.ts'`, which is not valid in Node.js ESM.
const Player = {
    None: 0,
    Black: 1,
    White: 2,
};

const getNeighbors = (x, y, boardSize) => {
  const neighbors = [];
  if (x > 0) neighbors.push({ x: x - 1, y });
  if (x < boardSize - 1) neighbors.push({ x: x + 1, y });
  if (y > 0) neighbors.push({ x, y: y - 1 });
  if (y < boardSize - 1) neighbors.push({ x, y: y + 1 });
  return neighbors;
};

const findGroup = (startX, startY, playerColor, board) => {
  const boardSize = board.length;
  if (startY < 0 || startY >= boardSize || startX < 0 || startX >= boardSize || board[startY]?.[startX] !== playerColor) return null;
  
  const q = [{ x: startX, y: startY }];
  const visitedStones = new Set([`${startX},${startY}`]);
  const libertyPoints = new Set();
  const stones = [{ x: startX, y: startY }];

  while (q.length > 0) {
      const { x: cx, y: cy } = q.shift();
      for (const n of getNeighbors(cx, cy, boardSize)) {
          const key = `${n.x},${n.y}`;
          const neighborContent = board[n.y][n.x];

          if (neighborContent === Player.None) {
            libertyPoints.add(key);
          } else if (neighborContent === playerColor) {
              if (!visitedStones.has(key)) {
                  visitedStones.add(key);
                  q.push(n);
                  stones.push(n);
              }
          }
      }
  }
  return { stones, liberties: libertyPoints.size, libertyPoints };
};

export const getGoLogic = (game) => {
    const { boardSize } = game.settings;
    return {
        findGroup: (x, y, player, board) => findGroup(x, y, player, board),
        getNeighbors: (x, y) => getNeighbors(x, y, boardSize),
        getAllLibertiesOfPlayer: (player, board) => {
            const liberties = new Set();
            for (let y = 0; y < boardSize; y++) {
                for (let x = 0; x < boardSize; x++) {
                    if (board[y][x] === player) {
                        const neighbors = getNeighbors(x, y, boardSize);
                        for (const n of neighbors) {
                            if (board[n.y][n.x] === Player.None) {
                                liberties.add(`${n.x},${n.y}`);
                            }
                        }
                    }
                }
            }
            return Array.from(liberties).map(s => {
                const [x, y] = String(s).split(',').map(Number);
                return { x, y };
            });
        },
    };
};

export const processMove = (boardState, move, koInfo, moveIndex, options = {}) => {
    const { x, y, player } = move;
    const { ignoreSuicide = false } = options;
    const boardSize = boardState.length;
    
    if (x === -1 || y === -1) return { isValid: true, newBoardState: boardState, capturedStones: [], newKoInfo: koInfo };
    
    if (x >= boardSize || y >= boardSize || x < 0 || y < 0 || boardState[y]?.[x] !== Player.None) return { isValid: false, reason: 'Point is not empty', newBoardState: boardState, capturedStones: [], newKoInfo: koInfo };

    if (koInfo && koInfo.point.x === x && koInfo.point.y === y && koInfo.turn === moveIndex - 1) {
        return { isValid: false, reason: 'ko', newBoardState: boardState, capturedStones: [], newKoInfo: koInfo };
    }
    
    const newBoard = boardState.map(row => [...row]);
    newBoard[y][x] = player;

    const opponent = player === Player.Black ? Player.White : Player.Black;
    let capturedStones = [];
    const neighbors = getNeighbors(x, y, boardSize);

    for (const n of neighbors) {
        if (newBoard[n.y]?.[n.x] === opponent) {
            const group = findGroup(n.x, n.y, opponent, newBoard);
            if (group && group.liberties === 0) {
                const newCaptures = group.stones.filter(s => !capturedStones.some(cs => cs.x === s.x && cs.y === s.y));
                capturedStones.push(...newCaptures);
            }
        }
    }
    
    if (capturedStones.length > 0) {
        for (const stone of capturedStones) {
            newBoard[stone.y][stone.x] = Player.None;
        }
    }
    
    if (!ignoreSuicide && capturedStones.length === 0) {
        const myGroup = findGroup(x, y, player, newBoard);
        if (myGroup && myGroup.liberties === 0) {
            return { isValid: false, reason: 'suicide', newBoardState: boardState, capturedStones: [], newKoInfo: koInfo };
        }
    }
    
    let newKoInfo = koInfo && koInfo.turn === moveIndex - 1 ? null : koInfo;
    if (capturedStones.length === 1) {
        const capturedPoint = capturedStones[0];
        const group = findGroup(x, y, player, newBoard);
        if (group && group.stones.length === 1 && group.liberties === 1) {
            const onlyLibertyKey = Array.from(group.libertyPoints)[0];
            if(onlyLibertyKey && `${capturedPoint.x},${capturedPoint.y}` === onlyLibertyKey) {
                newKoInfo = { point: capturedPoint, turn: moveIndex };
            }
        }
    }

    return { isValid: true, newBoardState: newBoard, capturedStones, newKoInfo };
};