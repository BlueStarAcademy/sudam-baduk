// src/mcts.ts
import type { BotConfig } from '../botLevels.js';
import type { BoardState } from './board.js';
import { cloneState, legalMoves, playMoveMut, PASS } from './board.js';
import { topKCandidates, scoreMoveHeuristic } from './heuristic.js';
import { GameMode } from '../../../types/index.js';

class Node {
  parent: Node | null;
  move: number | null;
  visits = 0;
  wins = 0;
  children = new Map<number, Node>();
  untried: number[];
  amafN = new Map<number, number>();
  amafW = new Map<number, number>();
  prior = 0;
  constructor(parent: Node|null, move: number|null, state:BoardState){
    this.parent = parent; this.move = move; this.untried = legalMoves(state).slice();
  }
}

function evaluateSimple(s:BoardState): 1|2 {
  const counts = [0,0,0];
  for(let i=0;i<s.board.length;i++) counts[s.board[i]]++;
  return counts[1] >= counts[2] ? 1 : 2;
}

function rollout(state:BoardState, config: BotConfig, mode: GameMode, maxSteps=200){
  const s = cloneState(state);
  for(let i=0;i<maxSteps;i++){
    const moves = topKCandidates(s, 8, config, mode);
    if(moves.length===0) return evaluateSimple(s);
    const mv = moves[Math.floor(Math.random()*moves.length)];
    playMoveMut(s, mv as number);
  }
  return evaluateSimple(s);
}

function uctScore(node:Node, parent:Node, mv:number){
  const q = node.wins / (node.visits + 1e-9);
  const c = 1.0 * Math.sqrt(Math.log(parent.visits + 1) / (node.visits + 1));
  const beta = node.visits / (node.visits + 300 + 1e-9);
  const amafN = parent.amafN.get(mv) || 0;
  const amafW = parent.amafW.get(mv) || 0;
  const amafQ = amafN>0 ? (amafW / amafN) : 0.5;
  const blendedQ = (1-beta)*q + beta*amafQ;
  const priorBonus = node.prior * 0.001;
  return blendedQ + c + priorBonus;
}

export function mcts(rootState:BoardState, timeMs=300, config: BotConfig, mode: GameMode){
  const start = Date.now();
  const root = new Node(null, null, rootState);
  
  // FIX: Prevent AI from passing when other moves are available.
  const legalNonPassMoves = legalMoves(rootState).filter(m => m !== PASS);

  if (legalNonPassMoves.length === 0) {
    return PASS;
  }

  while(Date.now() - start < timeMs){
    let node = root;
    const state = cloneState(rootState);
    const played:number[] = [];
    // selection
    while(node.untried.length === 0 && node.children.size>0){
      let bestMv = -1; let bestScore = -Infinity; let bestChild:Node|null = null;
      for(const [mv, child] of node.children.entries()){
        const sc = uctScore(child, node, mv);
        if(sc > bestScore){ bestScore = sc; bestMv = mv; bestChild = child; }
      }
      if(!bestChild) break;
      playMoveMut(state, bestMv);
      played.push(bestMv);
      node = bestChild;
    }
    // expansion
    if(node.untried.length > 0){
      const mi = Math.floor(Math.random()*node.untried.length);
      const mv = node.untried.splice(mi,1)[0];
      playMoveMut(state, mv);
      const child = new Node(node, mv, state);
      child.prior = scoreMoveHeuristic(rootState, mv as number, rootState.toMove, config, mode).score;
      node.children.set(mv, child);
      node = child;
      played.push(mv);
    }
    // rollout
    const winner = rollout(state, config, mode, 200);
    // backprop
    let cur: Node | null = node;
    while(cur){
      cur.visits += 1;
      if(winner === rootState.toMove) cur.wins += 1;
      if(cur.parent){
        for(const mv of played){
          const pn = cur.parent.amafN.get(mv) || 0; cur.parent.amafN.set(mv, pn+1);
          const pw = cur.parent.amafW.get(mv) || 0; if(winner === rootState.toMove) cur.parent.amafW.set(mv, pw+1);
        }
      }
      cur = cur.parent;
    }
  }

  // Find the best move among the children that is NOT a pass.
  let bestNonPassMove = PASS;
  let bestNonPassVisits = -1;
  
  for (const [mv, child] of root.children.entries()) {
    if (mv !== PASS && child.visits > bestNonPassVisits) {
      bestNonPassVisits = child.visits;
      bestNonPassMove = mv;
    }
  }
  
  // If MCTS explored at least one non-pass move, return the best one it found.
  if (bestNonPassMove !== PASS) {
    return bestNonPassMove;
  }
  
  // Fallback: If MCTS didn't explore any non-pass moves (e.g., very short search time),
  // or if it only explored PASS, pick a random legal non-pass move from the pre-calculated list.
  return legalNonPassMoves[Math.floor(Math.random() * legalNonPassMoves.length)];
}
