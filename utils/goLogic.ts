// utils/goLogic.ts
// FIX: Implemented Go logic here and removed circular dependency.

import { Point, Player, LiveGameSession, BoardState, KoInfo, Move } from '../types/index.js';

const getNeighbors = (x: number, y: number, boardSize: number): Point[] => {
  const neighbors: Point[] = [];
  if (x > 0) neighbors.push({ x: x - 1, y });
  if (x < boardSize - 1) neighbors.push({ x: x + 1, y });
  if (y > 0) neighbors.push({ x, y: y - 1 });
  if (y < boardSize - 1) neighbors.push({ x, y: y + 1 });
  return neighbors;
};

const findGroup = (startX: number, startY: number, playerColor: Player, board: BoardState): { stones: Point[], liberties: number, libertyPoints: Set<string> } | null => {
  const boardSize = board.length;
  if (startY < 0 || startY >= boardSize || startX < 0 || startX >= boardSize || board[startY]?.[startX] !== playerColor) return null;
  
  const q: Point[] = [{ x: startX, y: startY }];
  const visitedStones = new Set([`${startX},${startY}`]);
  const libertyPoints = new Set<string>();
  const stones: Point[] = [{ x: startX, y: startY }];

  while (q.length > 0) {
      const { x: cx, y: cy } = q.shift()!;
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

export const getGoLogic = (game: Pick<LiveGameSession, 'settings'>) => {
    const { boardSize } = game.settings;
    return {
        findGroup: (x: number, y: number, player: Player, board: BoardState) => findGroup(x, y, player, board),
        getNeighbors: (x: number, y: number) => getNeighbors(x, y, boardSize),
        getAllLibertiesOfPlayer: (player: Player, board: BoardState): Point[] => {
            const liberties = new Set<string>();
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
                const [x, y] = s.split(',').map(Number);
                return { x, y };
            });
        },
    };
};

export const processMove = (
    boardState: BoardState,
    move: Move,
    koInfo: KoInfo | null,
    moveIndex: number,
    options: { ignoreSuicide?: boolean } = {}
): { isValid: boolean; reason?: string; newBoardState: BoardState; capturedStones: Point[]; newKoInfo: KoInfo | null } => {
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
    let capturedStones: Point[] = [];
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
    
    let newKoInfo: KoInfo | null = koInfo && koInfo.turn === moveIndex - 1 ? null : koInfo;
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
