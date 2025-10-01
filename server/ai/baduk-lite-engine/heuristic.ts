// src/heuristic.ts
// FIX: Changed import to be a type-only import for BoardState.
import type { BoardState } from './board.js';
import { cloneState, legalMoves, idx, inBounds, getGroupAndLiberties, PASS, playMoveMut } from './board.js';
import { defaultPatterns } from './patterns.js';
import { type BotConfig } from '../botLevels.js';
import { GameMode } from '../../../types/index.js';

// --- Pattern Matching Logic ---
type PatternDB = { [key: string]: number };
let PATTERN_3x3: PatternDB = defaultPatterns.p3;
let PATTERN_5x5: PatternDB = defaultPatterns.p5;
let PATTERN_3x3_KEYS: string[];
let PATTERN_5x5_KEYS: string[];

export function setPatterns(p3: PatternDB, p5: PatternDB) {
    PATTERN_3x3 = p3;
    PATTERN_5x5 = p5;
}

function getPatternScore(state: BoardState, x: number, y: number, color: 1 | 2, config: BotConfig): { score: number, patternName: string } {
    const { size, board } = state;
    const opp = color === 1 ? 2 : 1;
    let totalScore = 0;
    let bestPattern = "none";

    if (!PATTERN_3x3_KEYS) PATTERN_3x3_KEYS = Object.keys(PATTERN_3x3);
    if (!PATTERN_5x5_KEYS) PATTERN_5x5_KEYS = Object.keys(PATTERN_5x5);

    const check = (patternSize: 3 | 5, db: PatternDB, dbKeys: string[]) => {
        const limitedKeys = new Set(dbKeys.slice(0, config.patternLimit));
        const radius = Math.floor(patternSize / 2);
        let key = '';
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const curX = x + dx;
                const curY = y + dy;
                if (!inBounds(size, curX, curY)) {
                    key += '3'; // Use '3' for off-board
                    continue;
                }
                const cell = board[idx(size, curX, curY)];
                if (cell === 0) key += '0';
                else if (cell === color) key += '1';
                else if (cell === opp) key += '2';
            }
        }
        if(limitedKeys.has(key)) {
            const score = db[key];
            if (score !== undefined) {
                totalScore += score;
                if (Math.abs(score) > Math.abs(db[bestPattern] || 0)) {
                    bestPattern = key;
                }
            }
        }
    };

    check(3, PATTERN_3x3, PATTERN_3x3_KEYS);
    check(5, PATTERN_5x5, PATTERN_5x5_KEYS);
    return { score: totalScore, patternName: bestPattern };
}
// --- End of Pattern Logic ---

export function scoreMoveHeuristic(state:BoardState, move:number, color:1|2, config: BotConfig, mode: GameMode): {score: number, pattern: string} {
  if(move === PASS) return {score: 0, pattern: "pass"};
  const {size, board} = state;
  const x = move % size, y = Math.floor(move/size);
  let score = 0;
  
  // Basic Heuristics
  const nbrs = [[1,0],[-1,0],[0,1],[-1,0]] as number[][];
  let adjOpp=0, adjOwn=0, adjEmpty=0;
  for(const [dx,dy] of nbrs){
    const nx=x+dx, ny=y+dy; if(!inBounds(size,nx,ny)) continue;
    const ni = idx(size,nx,ny);
    if(board[ni]===0) adjEmpty++;
    else if(board[ni]===color) adjOwn++;
    else adjOpp++;
  }
  score += adjOpp*2; score += adjOwn*1; score += adjEmpty*0.5;

  const tempState = cloneState(state);
  playMoveMut(tempState, move);
  const captures = tempState.board.filter((v, i) => state.board[i] !== 0 && v === 0).length;

  if (mode === GameMode.Capture) {
    score += captures * 200 * config.captureBias;
  } else {
    score += captures * 50 * config.captureBias;
  }
  
  for(const [dx,dy] of nbrs){
    const nx=x+dx, ny=y+dy; if(!inBounds(size,nx,ny)) continue;
    const ni = idx(size,nx,ny);
    if(board[ni] !== 0 && board[ni] !== color){
      const {liberties} = getGroupAndLiberties(state, ni);
      if(liberties.length === 1) score += 40;
      else if(liberties.length === 2) score += 8;
    }
  }
  const cx = (size-1)/2, cy = (size-1)/2; const dist = Math.hypot(x-cx,y-cy);
  score += Math.max(0, 6 - dist) * 0.2 * config.territoryBias;
  const minDistEdge = Math.min(x, y, size-1-x, size-1-y);
  score += (minDistEdge >= 3) ? (0.5 * config.territoryBias) : 0;
  
  const patternResult = getPatternScore(state, x, y, color, config);
  score += patternResult.score;

  return {score, pattern: patternResult.patternName};
}

export function topKCandidatesWithDetails(state: BoardState, K=12, config: BotConfig, mode: GameMode) {
    const moves = legalMoves(state);
    const color = state.toMove;
    const scored = moves.map(m => {
        const { score, pattern } = scoreMoveHeuristic(state, m as number, color, config, mode);
        return { m, s: score, pattern };
    });
    scored.sort((a, b) => b.s - a.s);
    const take = Math.max(1, Math.min(K, scored.length));
    return scored.slice(0, take);
}

export function topKCandidates(state:BoardState, K=12, config: BotConfig, mode: GameMode){
  return topKCandidatesWithDetails(state, K, config, mode).map(x => x.m);
}
