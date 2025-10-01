// Change to more specific imports to break circular dependency
import { Player } from '.././types/enums';
import type { LiveGameSession, Point, BoardState } from '.././types/entities';
// Corrected import path from circular dependency to the utility file.
import { processMove as processMoveUtil } from '.././utils/goLogic';
// Re-export 'processMove' to make it available to other modules that import from this file.
export { processMove } from '.././utils/goLogic';

// This is the new pure function for calculating move results.
// It does not depend on the 'game' closure and does not mutate any state.
export const getGoLogic = (game: LiveGameSession) => {
    const { boardState, settings: { boardSize } } = game;

    // This method is now impure and directly mutates the game object.
    // It's used by AI and other server logic that needs to directly manipulate the session.
    // The main player action handler should prefer the pure `processMove`.
    const placeStone = (x: number, y: number) => {
        const player = game.currentPlayer;
        const result = processMoveUtil(
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

    const getNeighbors = (x: number, y: number) => {
        const neighbors = [];
        if (x > 0) neighbors.push({ x: x - 1, y });
        if (x < boardSize - 1) neighbors.push({ x: x + 1, y });
        if (y > 0) neighbors.push({ x, y: y - 1 });
        if (y < boardSize - 1) neighbors.push({ x, y: y + 1 });
        return neighbors;
    };
    
    const findGroup = (startX: number, startY: number, playerColor: Player, currentBoard: BoardState) => {
        if (startY < 0 || startY >= boardSize || startX < 0 || startX >= boardSize || currentBoard[startY]?.[startX] !== playerColor) return null;
        
        const q: Point[] = [{ x: startX, y: startY }];
        const visitedStones = new Set([`${startX},${startY}`]);
        const libertyPoints = new Set<string>();
        const stones: Point[] = [];
    
        while (q.length > 0) {
            const { x: cx, y: cy } = q.shift()!;
            stones.push({ x: cx, y: cy });
    
            for (const n of getNeighbors(cx, cy)) {
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
    
    const getAllGroups = (playerColor: Player, currentBoard: BoardState) => {
        const groups = [];
        const visited = new Set<string>();
        for (let y = 0; y < boardSize; y++) {
            for (let x = 0; x < boardSize; x++) {
                const key = `${x},${y}`;
                if (currentBoard[y][x] === playerColor && !visited.has(key)) {
                    const group = findGroup(x, y, playerColor, currentBoard);
                    if (group) {
                        groups.push(group);
                        group.stones.forEach(s => visited.add(`${s.x},${s.y}`));
                    }
                }
            }
        }
        return groups;
    };

    const getAllLibertiesOfPlayer = (playerColor: Player, currentBoard: BoardState): Point[] => {
        const allLiberties = new Set<string>();
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
        const visited = new Set<string>();

        for (let y = 0; y < boardSize; y++) {
            for (let x = 0; x < boardSize; x++) {
                const key = `${x},${y}`;
                if (boardState[y][x] !== Player.None && !visited.has(key)) {
                    const group = findGroup(x, y, boardState[y][x], boardState);
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
                    const group = findGroup(x, y, territoryBoard[y][x], territoryBoard);
                    if (group && group.liberties === 0) {
                        group.stones.forEach(s => territoryBoard[s.y][s.x] = Player.None);
                    }
                }
            }
        }
        
        const territoryVisited = new Set<string>();
        for (let y = 0; y < boardSize; y++) {
            for (let x = 0; x < boardSize; x++) {
                const key = `${x},${y}`;
                if (territoryBoard[y][x] === Player.None && !territoryVisited.has(key)) {
                    const q: Point[] = [{ x, y }];
                    territoryVisited.add(key);
                    const group: Point[] = [];
                    let bordersBlack = false;
                    let bordersWhite = false;
                    
                    while (q.length > 0) {
                        const current = q.shift()!;
                        group.push(current);
                        for (const n of getNeighbors(current.x, current.y)) {
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
        getNeighbors,
        findGroup,
        getScore,
        getAllGroups,
        getAllLibertiesOfPlayer,
    };
};