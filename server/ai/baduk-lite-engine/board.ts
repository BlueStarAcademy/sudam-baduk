// src/board.ts
export type Cell = 0 | 1 | 2; // 0 empty, 1 black, 2 white
export const PASS = -1;

export type BoardState = {
  size: number;
    board: Uint8Array; // row-major length size*size
  toMove: 1 | 2;
  koInfo?: { point: { x: number, y: number }, turn: number } | null;
  moveHistoryLength?: number;
};

export function idx(size:number,x:number,y:number){ return y*size + x; }
export function inBounds(size:number,x:number,y:number){ return x>=0 && y>=0 && x<size && y<size; }

export function cloneState(s:BoardState): BoardState {
  return { size: s.size, board: s.board.slice() as Uint8Array, toMove: s.toMove, koInfo: s.koInfo, moveHistoryLength: s.moveHistoryLength };
}

// BFS to find group stones and liberties
export function getGroupAndLiberties(state:BoardState, start:number){
  const {size, board} = state;
  const color = board[start];
  const q:number[] = [start];
  const seen = new Uint8Array(size*size); seen[start]=1;
  const stones:number[] = [];
  const libsSet = new Uint8Array(size*size);
  for(let qi=0; qi<q.length; qi++){
    const s = q[qi]; stones.push(s);
    const x = s % size, y = Math.floor(s/size);
    const nbrs = [[1,0],[-1,0],[0,1],[0,-1]];
    for(const [dx,dy] of nbrs){
      const nx=x+dx, ny=y+dy; if(!inBounds(size,nx,ny)) continue;
      const ni = idx(size,nx,ny); const v = board[ni];
      if(v===0) libsSet[ni]=1;
      else if(v===color && !seen[ni]){ seen[ni]=1; q.push(ni); }
    }
  }
  const liberties:number[] = [];
  for(let i=0;i<size*size;i++) if(libsSet[i]) liberties.push(i);
  return { stones, liberties };
}

export function isLegalMove(state:BoardState, move:number, color:1|2){
  if(move === PASS) return true;
  if(state.board[move] !== 0) return false;

  const { size, koInfo, moveHistoryLength } = state;
  const x = move % size;
  const y = Math.floor(move / size);
  if (koInfo?.point?.x === x && koInfo?.point?.y === y && koInfo?.turn === (moveHistoryLength || 0) + 1) {
      return false;
  }

  const newBoard = state.board.slice() as Uint8Array;
  newBoard[move] = color;
  const nx = move % size, ny = Math.floor(move/size);
  const nbrs = [[1,0],[-1,0],[0,1],[0,-1]];
  let capturedAny = false;
  for(const [dx,dy] of nbrs){
    const x = nx+dx, y = ny+dy; if(!inBounds(size,x,y)) continue;
    const ni = idx(size,x,y);
    if(newBoard[ni] !== 0 && newBoard[ni] !== color){
      const {liberties} = getGroupAndLiberties({size, board:newBoard, toMove: color}, ni);
      if(liberties.length === 0) capturedAny = true;
    }
  }
  if(capturedAny) return true;
  const {liberties: myLibs} = getGroupAndLiberties({size, board:newBoard, toMove: color}, move);
  return myLibs.length > 0;
}

export function legalMoves(state:BoardState){
  const moves:number[] = [];
  const {size, board} = state;
  for(let i=0;i<size*size;i++){ if(board[i] !== 0) continue; if(isLegalMove(state, i, state.toMove)) moves.push(i); }
  moves.push(PASS);
  return moves;
}

export function playMoveMut(state:BoardState, move:number){
  if(move === PASS){ state.toMove = (state.toMove===1?2:1); return; }
  const {size, board} = state;
  const color = state.toMove; const opp = color===1?2:1;
  board[move] = color;
  const x = move % size, y = Math.floor(move/size);
  const nbrs = [[1,0],[-1,0],[0,1],[0,-1]];
  for(const [dx,dy] of nbrs){
    const nx = x+dx, ny = y+dy; if(!inBounds(size,nx,ny)) continue;
    const ni = idx(size,nx,ny);
    if(board[ni] === opp){
      const {liberties, stones} = getGroupAndLiberties(state, ni);
      if(liberties.length === 0) for(const s of stones) board[s]=0;
    }
  }
  const {liberties: myLibs, stones: myStones} = getGroupAndLiberties(state, move);
  if(myLibs.length === 0) for(const s of myStones) board[s]=0;
  state.toMove = opp as 1|2;
}