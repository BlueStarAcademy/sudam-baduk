// @ts-nocheck
import { SinglePlayerLevel, GameType, GameMode } from '../types/enums.js';
import type { SinglePlayerStageInfo, QuestReward, LeagueRewardTier } from '../types/entities.js';

const parsed_random_placement_data: { [key: string]: { randomBlackStones: number; randomWhiteStones: number; randomBlackPatternedStones: number; randomWhitePatternedStones: number; } } = {
  "입문-1": { "randomBlackStones": 2, "randomWhiteStones": 3, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "입문-2": { "randomBlackStones": 2, "randomWhiteStones": 3, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 1 },
  "입문-3": { "randomBlackStones": 2, "randomWhiteStones": 3, "randomBlackPatternedStones": 1, "randomWhitePatternedStones": 1 },
  "입문-4": { "randomBlackStones": 2, "randomWhiteStones": 4, "randomBlackPatternedStones": 2, "randomWhitePatternedStones": 1 },
  "입문-5": { "randomBlackStones": 2, "randomWhiteStones": 5, "randomBlackPatternedStones": 2, "randomWhitePatternedStones": 1 },
  "입문-6": { "randomBlackStones": 3, "randomWhiteStones": 7, "randomBlackPatternedStones": 2, "randomWhitePatternedStones": 0 },
  "입문-7": { "randomBlackStones": 3, "randomWhiteStones": 6, "randomBlackPatternedStones": 2, "randomWhitePatternedStones": 2 },
  "입문-8": { "randomBlackStones": 3, "randomWhiteStones": 7, "randomBlackPatternedStones": 3, "randomWhitePatternedStones": 2 },
  "입문-9": { "randomBlackStones": 3, "randomWhiteStones": 6, "randomBlackPatternedStones": 3, "randomWhitePatternedStones": 3 },
  "입문-10": { "randomBlackStones": 4, "randomWhiteStones": 7, "randomBlackPatternedStones": 2, "randomWhitePatternedStones": 3 },
  "입문-11": { "randomBlackStones": 3, "randomWhiteStones": 13, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "입문-12": { "randomBlackStones": 4, "randomWhiteStones": 14, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 1 },
  "입문-13": { "randomBlackStones": 5, "randomWhiteStones": 15, "randomBlackPatternedStones": 1, "randomWhitePatternedStones": 1 },
  "입문-14": { "randomBlackStones": 4, "randomWhiteStones": 15, "randomBlackPatternedStones": 2, "randomWhitePatternedStones": 1 },
  "입문-15": { "randomBlackStones": 3, "randomWhiteStones": 14, "randomBlackPatternedStones": 2, "randomWhitePatternedStones": 1 },
  "입문-16": { "randomBlackStones": 2, "randomWhiteStones": 13, "randomBlackPatternedStones": 2, "randomWhitePatternedStones": 0 },
  "입문-17": { "randomBlackStones": 3, "randomWhiteStones": 15, "randomBlackPatternedStones": 2, "randomWhitePatternedStones": 2 },
  "입문-18": { "randomBlackStones": 4, "randomWhiteStones": 16, "randomBlackPatternedStones": 3, "randomWhitePatternedStones": 2 },
  "입문-19": { "randomBlackStones": 5, "randomWhiteStones": 17, "randomBlackPatternedStones": 3, "randomWhitePatternedStones": 3 },
  "입문-20": { "randomBlackStones": 5, "randomWhiteStones": 18, "randomBlackPatternedStones": 2, "randomWhitePatternedStones": 3 },
  "초급-1": { "randomBlackStones": 4, "randomWhiteStones": 6, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "초급-2": { "randomBlackStones": 5, "randomWhiteStones": 8, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "초급-3": { "randomBlackStones": 6, "randomWhiteStones": 9, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "초급-4": { "randomBlackStones": 7, "randomWhiteStones": 10, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "초급-5": { "randomBlackStones": 8, "randomWhiteStones": 12, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "초급-6": { "randomBlackStones": 9, "randomWhiteStones": 12, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "초급-7": { "randomBlackStones": 8, "randomWhiteStones": 11, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "초급-8": { "randomBlackStones": 7, "randomWhiteStones": 10, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "초급-9": { "randomBlackStones": 5, "randomWhiteStones": 8, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "초급-10": { "randomBlackStones": 3, "randomWhiteStones": 7, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "초급-11": { "randomBlackStones": 4, "randomWhiteStones": 8, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "초급-12": { "randomBlackStones": 5, "randomWhiteStones": 9, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "초급-13": { "randomBlackStones": 4, "randomWhiteStones": 8, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "초급-14": { "randomBlackStones": 4, "randomWhiteStones": 8, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "초급-15": { "randomBlackStones": 4, "randomWhiteStones": 10, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "초급-16": { "randomBlackStones": 4, "randomWhiteStones": 9, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "초급-17": { "randomBlackStones": 4, "randomWhiteStones": 9, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "초급-18": { "randomBlackStones": 4, "randomWhiteStones": 9, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "초급-19": { "randomBlackStones": 5, "randomWhiteStones": 10, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "초급-20": { "randomBlackStones": 5, "randomWhiteStones": 12, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "중급-1": { "randomBlackStones": 4, "randomWhiteStones": 7, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "중급-2": { "randomBlackStones": 5, "randomWhiteStones": 9, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "중급-3": { "randomBlackStones": 6, "randomWhiteStones": 10, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "중급-4": { "randomBlackStones": 7, "randomWhiteStones": 11, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "중급-5": { "randomBlackStones": 8, "randomWhiteStones": 13, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "중급-6": { "randomBlackStones": 9, "randomWhiteStones": 13, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "중급-7": { "randomBlackStones": 8, "randomWhiteStones": 12, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "중급-8": { "randomBlackStones": 7, "randomWhiteStones": 11, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "중급-9": { "randomBlackStones": 5, "randomWhiteStones": 9, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "중급-10": { "randomBlackStones": 3, "randomWhiteStones": 8, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "중급-11": { "randomBlackStones": 4, "randomWhiteStones": 9, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "중급-12": { "randomBlackStones": 5, "randomWhiteStones": 10, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "중급-13": { "randomBlackStones": 4, "randomWhiteStones": 9, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "중급-14": { "randomBlackStones": 4, "randomWhiteStones": 9, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "중급-15": { "randomBlackStones": 4, "randomWhiteStones": 11, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "중급-16": { "randomBlackStones": 4, "randomWhiteStones": 10, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "중급-17": { "randomBlackStones": 4, "randomWhiteStones": 10, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "중급-18": { "randomBlackStones": 4, "randomWhiteStones": 10, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "중급-19": { "randomBlackStones": 5, "randomWhiteStones": 11, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "중급-20": { "randomBlackStones": 5, "randomWhiteStones": 13, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "고급-1": { "randomBlackStones": 4, "randomWhiteStones": 8, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "고급-2": { "randomBlackStones": 5, "randomWhiteStones": 10, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "고급-3": { "randomBlackStones": 6, "randomWhiteStones": 11, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "고급-4": { "randomBlackStones": 7, "randomWhiteStones": 12, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "고급-5": { "randomBlackStones": 8, "randomWhiteStones": 14, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "고급-6": { "randomBlackStones": 9, "randomWhiteStones": 14, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "고급-7": { "randomBlackStones": 8, "randomWhiteStones": 13, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "고급-8": { "randomBlackStones": 7, "randomWhiteStones": 12, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "고급-9": { "randomBlackStones": 5, "randomWhiteStones": 10, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "고급-10": { "randomBlackStones": 3, "randomWhiteStones": 9, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "고급-11": { "randomBlackStones": 4, "randomWhiteStones": 10, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "고급-12": { "randomBlackStones": 5, "randomWhiteStones": 11, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "고급-13": { "randomBlackStones": 4, "randomWhiteStones": 10, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "고급-14": { "randomBlackStones": 4, "randomWhiteStones": 10, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "고급-15": { "randomBlackStones": 4, "randomWhiteStones": 12, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "고급-16": { "randomBlackStones": 4, "randomWhiteStones": 11, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "고급-17": { "randomBlackStones": 4, "randomWhiteStones": 11, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "고급-18": { "randomBlackStones": 4, "randomWhiteStones": 11, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "고급-19": { "randomBlackStones": 5, "randomWhiteStones": 12, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 },
  "고급-20": { "randomBlackStones": 5, "randomWhiteStones": 14, "randomBlackPatternedStones": 0, "randomWhitePatternedStones": 0 }
};

const getStageId = (floor: number): string | undefined => {
    if (floor >= 1 && floor <= 20) {
        return `입문-${floor}`;
    } else if (floor >= 21 && floor <= 40) {
        return `초급-${floor - 20}`;
    } else if (floor >= 41 && floor <= 60) {
        return `중급-${floor - 40}`;
    } else if (floor >= 61 && floor <= 80) {
        return `고급-${floor - 60}`;
    }
    return undefined;
};

export const TOWER_PROVERBS = [
    { term: "不得貪勝 (부득탐승)", meaning: "승리를 탐하면 이길 수 없다." },
    { term: "入界宜緩 (입계의완)", meaning: "상대 집 모양에 들어갈 때는 천천히, 서두르지 마라." },
    { term: "攻彼顧我 (공피고아)", meaning: "상대를 공격할 때는 먼저 나 자신을 돌아보라." },
    { term: "棄子爭先 (기자쟁선)", meaning: "돌 몇 점을 버리더라도 선수를 잡아라." },
    { term: "彼强自保 (피강자보)", meaning: "상대가 강한 곳에서는 나 자신을 먼저 지켜라." },
    { term: "動須相應 (동수상응)", meaning: "돌이 움직일 때는 서로 호응하며 행마하라." },
    { term: "愼勿輕速 (신물경속)", meaning: "경솔하고 빠르게 두지 말고, 신중하게 두어라." },
    { term: "我生然後殺他 (아생연후살타)", meaning: "먼저 내 돌을 살린 후에 상대 돌을 잡으러 가라." },
];

const rawData = [
    // 1-20층: 따내기, AI 레벨 6
    { floor: 1, ap: 2, board: 7, bTarget: 5, wTarget: 5, ai: 60, bLimit: 15, bStones: 2, wStones: 3, bPattern: 0, wPattern: 0, fcReward: '골드100', fcExp: 20, rcReward: '골드10', rcExp: 10 },
    { floor: 2, ap: 2, board: 7, bTarget: 6, wTarget: 5, ai: 60, bLimit: 15, bStones: 2, wStones: 3, bPattern: 0, wPattern: 1, fcReward: '골드100', fcExp: 20, rcReward: '골드10', rcExp: 10 },
    { floor: 3, ap: 2, board: 7, bTarget: 7, wTarget: 5, ai: 60, bLimit: 15, bStones: 2, wStones: 3, bPattern: 1, wPattern: 1, fcReward: '골드100', fcExp: 20, rcReward: '골드10', rcExp: 10 },
    { floor: 4, ap: 2, board: 7, bTarget: 8, wTarget: 5, ai: 60, bLimit: 15, bStones: 2, wStones: 4, bPattern: 2, wPattern: 1, fcReward: '골드100', fcExp: 20, rcReward: '골드10', rcExp: 10 },
    { floor: 5, ap: 2, board: 7, bTarget: 9, wTarget: 5, ai: 60, bLimit: 15, bStones: 2, wStones: 5, bPattern: 2, wPattern: 1, fcReward: '골드꾸러미1', fcExp: 30, rcReward: '골드10', rcExp: 10 },
    { floor: 6, ap: 2, board: 7, bTarget: 10, wTarget: 5, ai: 60, bLimit: 15, bStones: 3, wStones: 7, bPattern: 2, wPattern: 0, fcReward: '골드100', fcExp: 20, rcReward: '골드10', rcExp: 10 },
    { floor: 7, ap: 2, board: 7, bTarget: 11, wTarget: 5, ai: 60, bLimit: 15, bStones: 3, wStones: 6, bPattern: 2, wPattern: 2, fcReward: '골드100', fcExp: 20, rcReward: '골드10', rcExp: 10 },
    { floor: 8, ap: 2, board: 7, bTarget: 12, wTarget: 5, ai: 60, bLimit: 15, bStones: 3, wStones: 7, bPattern: 3, wPattern: 2, fcReward: '골드100', fcExp: 20, rcReward: '골드10', rcExp: 10 },
    { floor: 9, ap: 2, board: 7, bTarget: 13, wTarget: 5, ai: 60, bLimit: 15, bStones: 3, wStones: 6, bPattern: 3, wPattern: 3, fcReward: '골드100', fcExp: 20, rcReward: '골드10', rcExp: 10 },
    { floor: 10, ap: 2, board: 7, bTarget: 15, wTarget: 5, ai: 60, bLimit: 20, bStones: 4, wStones: 7, bPattern: 2, wPattern: 3, fcReward: '장비상자1', fcExp: 100, rcReward: '골드15', rcExp: 10 },
    { floor: 11, ap: 2, board: 9, bTarget: 15, wTarget: 5, ai: 60, bLimit: 20, bStones: 3, wStones: 13, bPattern: 0, wPattern: 0, fcReward: '골드150', fcExp: 20, rcReward: '골드10', rcExp: 10 },
    { floor: 12, ap: 2, board: 9, bTarget: 16, wTarget: 5, ai: 60, bLimit: 20, bStones: 4, wStones: 14, bPattern: 0, wPattern: 1, fcReward: '골드150', fcExp: 20, rcReward: '골드10', rcExp: 10 },
    { floor: 13, ap: 2, board: 9, bTarget: 17, wTarget: 5, ai: 60, bLimit: 20, bStones: 5, wStones: 15, bPattern: 1, wPattern: 1, fcReward: '골드150', fcExp: 20, rcReward: '골드10', rcExp: 10 },
    { floor: 14, ap: 2, board: 9, bTarget: 18, wTarget: 5, ai: 60, bLimit: 20, bStones: 4, wStones: 15, bPattern: 2, wPattern: 1, fcReward: '골드150', fcExp: 20, rcReward: '골드10', rcExp: 10 },
    { floor: 15, ap: 2, board: 9, bTarget: 19, wTarget: 5, ai: 60, bLimit: 20, bStones: 3, wStones: 14, bPattern: 2, wPattern: 1, fcReward: '재료상자1', fcExp: 50, rcReward: '골드10', rcExp: 10 },
    { floor: 16, ap: 2, board: 9, bTarget: 20, wTarget: 5, ai: 60, bLimit: 22, bStones: 2, wStones: 13, bPattern: 2, wPattern: 0, fcReward: '골드150', fcExp: 30, rcReward: '골드15', rcExp: 10 },
    { floor: 17, ap: 2, board: 9, bTarget: 21, wTarget: 5, ai: 60, bLimit: 24, bStones: 3, wStones: 15, bPattern: 2, wPattern: 2, fcReward: '골드150', fcExp: 30, rcReward: '골드15', rcExp: 10 },
    { floor: 18, ap: 2, board: 9, bTarget: 22, wTarget: 5, ai: 60, bLimit: 26, bStones: 4, wStones: 16, bPattern: 3, wPattern: 2, fcReward: '골드150', fcExp: 30, rcReward: '골드15', rcExp: 10 },
    { floor: 19, ap: 2, board: 9, bTarget: 23, wTarget: 5, ai: 60, bLimit: 28, bStones: 5, wStones: 17, bPattern: 3, wPattern: 3, fcReward: '골드150', fcExp: 30, rcReward: '골드15', rcExp: 10 },
    { floor: 20, ap: 2, board: 9, bTarget: 25, wTarget: 5, ai: 60, bLimit: 30, bStones: 5, wStones: 18, bPattern: 2, wPattern: 3, fcReward: '다이아꾸러미1', fcExp: 30, rcReward: '골드15', rcExp: 10 },
    
    // 21-40층: 계가 + 아이템, AI 레벨 8
    { floor: 21, ap: 3, board: 9, ai: 80, autoEndTurn: 40, bStones: 4, wStones: 6, missile: 1, hidden: 1, scan: 1, fcReward: '골드200', fcExp: 30, rcReward: '골드30', rcExp: 20 },
    { floor: 22, ap: 3, board: 9, ai: 80, autoEndTurn: 40, bStones: 5, wStones: 8, missile: 1, hidden: 1, scan: 1, fcReward: '골드200', fcExp: 30, rcReward: '골드30', rcExp: 20 },
    { floor: 23, ap: 3, board: 9, ai: 80, autoEndTurn: 40, bStones: 6, wStones: 9, missile: 1, hidden: 1, scan: 1, fcReward: '골드200', fcExp: 30, rcReward: '골드30', rcExp: 20 },
    { floor: 24, ap: 3, board: 9, ai: 80, autoEndTurn: 40, bStones: 7, wStones: 10, missile: 1, hidden: 1, scan: 1, fcReward: '골드200', fcExp: 30, rcReward: '골드30', rcExp: 20 },
    { floor: 25, ap: 3, board: 9, ai: 80, autoEndTurn: 40, bStones: 8, wStones: 12, missile: 1, hidden: 1, scan: 1, fcReward: '골드꾸러미2', fcExp: 50, rcReward: '골드30', rcExp: 20 },
    { floor: 26, ap: 3, board: 9, ai: 80, autoEndTurn: 40, bStones: 9, wStones: 12, missile: 1, hidden: 1, scan: 1, fcReward: '골드200', fcExp: 40, rcReward: '골드30', rcExp: 20 },
    { floor: 27, ap: 3, board: 9, ai: 80, autoEndTurn: 40, bStones: 8, wStones: 11, missile: 1, hidden: 1, scan: 1, fcReward: '골드200', fcExp: 40, rcReward: '골드30', rcExp: 20 },
    { floor: 28, ap: 3, board: 9, ai: 80, autoEndTurn: 40, bStones: 7, wStones: 10, missile: 1, hidden: 1, scan: 1, fcReward: '골드200', fcExp: 40, rcReward: '골드30', rcExp: 20 },
    { floor: 29, ap: 3, board: 9, ai: 80, autoEndTurn: 40, bStones: 5, wStones: 8, missile: 1, hidden: 1, scan: 1, fcReward: '골드200', fcExp: 40, rcReward: '골드30', rcExp: 20 },
    { floor: 30, ap: 3, board: 9, ai: 80, autoEndTurn: 40, bStones: 3, wStones: 7, missile: 1, hidden: 1, scan: 1, fcReward: '장비상자2', fcExp: 100, rcReward: '골드40', rcExp: 20 },
    { floor: 31, ap: 3, board: 9, ai: 80, autoEndTurn: 40, bStones: 4, wStones: 8, missile: 1, hidden: 1, scan: 1, fcReward: '골드250', fcExp: 50, rcReward: '골드30', rcExp: 20 },
    { floor: 32, ap: 3, board: 9, ai: 80, autoEndTurn: 40, bStones: 5, wStones: 9, missile: 1, hidden: 1, scan: 1, fcReward: '골드250', fcExp: 50, rcReward: '골드30', rcExp: 20 },
    { floor: 33, ap: 3, board: 9, ai: 80, autoEndTurn: 40, bStones: 4, wStones: 8, missile: 1, hidden: 1, scan: 1, fcReward: '골드250', fcExp: 50, rcReward: '골드30', rcExp: 20 },
    { floor: 34, ap: 3, board: 9, ai: 80, autoEndTurn: 40, bStones: 4, wStones: 10, missile: 1, hidden: 1, scan: 1, fcReward: '골드250', fcExp: 50, rcReward: '골드30', rcExp: 20 },
    { floor: 35, ap: 3, board: 9, ai: 80, autoEndTurn: 40, bStones: 4, wStones: 10, missile: 1, hidden: 1, scan: 1, fcReward: '재료상자2', fcExp: 100, rcReward: '골드30', rcExp: 20 },
    { floor: 36, ap: 3, board: 9, ai: 80, autoEndTurn: 40, bStones: 4, wStones: 9, missile: 1, hidden: 1, scan: 1, fcReward: '골드250', fcExp: 60, rcReward: '골드30', rcExp: 20 },
    { floor: 37, ap: 3, board: 9, ai: 80, autoEndTurn: 40, bStones: 4, wStones: 9, missile: 1, hidden: 1, scan: 1, fcReward: '골드250', fcExp: 60, rcReward: '골드30', rcExp: 20 },
    { floor: 38, ap: 3, board: 9, ai: 80, autoEndTurn: 40, bStones: 5, wStones: 10, missile: 1, hidden: 1, scan: 1, fcReward: '골드250', fcExp: 60, rcReward: '골드30', rcExp: 20 },
    { floor: 39, ap: 3, board: 9, ai: 80, autoEndTurn: 40, bStones: 4, wStones: 9, missile: 1, hidden: 1, scan: 1, fcReward: '골드250', fcExp: 60, rcReward: '골드30', rcExp: 20 },
    { floor: 40, ap: 3, board: 9, ai: 80, autoEndTurn: 40, bStones: 5, wStones: 12, missile: 1, hidden: 1, scan: 1, fcReward: '다이아꾸러미2', fcExp: 150, rcReward: '골드40', rcExp: 20 },
    // 41-100층: AI 레벨 10
    { floor: 41, ap: 4, board: 11, ai: 100, autoEndTurn: 60, bStones: 4, wStones: 7, missile: 1, hidden: 1, scan: 1, fcReward: '골드300', fcExp: 100, rcReward: '골드50', rcExp: 30 },
    { floor: 42, ap: 4, board: 11, ai: 100, autoEndTurn: 60, bStones: 5, wStones: 9, missile: 1, hidden: 1, scan: 1, fcReward: '골드300', fcExp: 100, rcReward: '골드50', rcExp: 30 },
    { floor: 43, ap: 4, board: 11, ai: 100, autoEndTurn: 60, bStones: 6, wStones: 10, missile: 1, hidden: 1, scan: 1, fcReward: '골드300', fcExp: 100, rcReward: '골드50', rcExp: 30 },
    { floor: 44, ap: 4, board: 11, ai: 100, autoEndTurn: 60, bStones: 7, wStones: 11, missile: 1, hidden: 1, scan: 1, fcReward: '골드300', fcExp: 100, rcReward: '골드50', rcExp: 30 },
    { floor: 45, ap: 4, board: 11, ai: 100, autoEndTurn: 60, bStones: 8, wStones: 13, missile: 1, hidden: 1, scan: 1, fcReward: '골드꾸러미3', fcExp: 150, rcReward: '골드50', rcExp: 30 },
    { floor: 46, ap: 4, board: 11, ai: 100, autoEndTurn: 60, bStones: 9, wStones: 13, missile: 1, hidden: 1, scan: 1, fcReward: '골드300', fcExp: 100, rcReward: '골드50', rcExp: 30 },
    { floor: 47, ap: 4, board: 11, ai: 100, autoEndTurn: 60, bStones: 8, wStones: 12, missile: 1, hidden: 1, scan: 1, fcReward: '골드300', fcExp: 100, rcReward: '골드50', rcExp: 30 },
    { floor: 48, ap: 4, board: 11, ai: 100, autoEndTurn: 60, bStones: 7, wStones: 11, missile: 1, hidden: 1, scan: 1, fcReward: '골드300', fcExp: 100, rcReward: '골드50', rcExp: 30 },
    { floor: 49, ap: 4, board: 11, ai: 100, autoEndTurn: 60, bStones: 5, wStones: 9, missile: 1, hidden: 1, scan: 1, fcReward: '골드300', fcExp: 100, rcReward: '골드50', rcExp: 30 },
    { floor: 50, ap: 4, board: 11, ai: 100, autoEndTurn: 60, bStones: 3, wStones: 8, missile: 1, hidden: 1, scan: 1, fcReward: '장비상자3', fcExp: 200, rcReward: '골드50', rcExp: 30 },
    { floor: 51, ap: 4, board: 11, ai: 100, autoEndTurn: 60, bStones: 4, wStones: 9, missile: 1, hidden: 1, scan: 1, fcReward: '골드400', fcExp: 150, rcReward: '골드50', rcExp: 30 },
    { floor: 52, ap: 4, board: 11, ai: 100, autoEndTurn: 60, bStones: 5, wStones: 10, missile: 1, hidden: 1, scan: 1, fcReward: '골드400', fcExp: 150, rcReward: '골드50', rcExp: 30 },
    { floor: 53, ap: 4, board: 11, ai: 100, autoEndTurn: 60, bStones: 4, wStones: 9, missile: 1, hidden: 1, scan: 1, fcReward: '골드400', fcExp: 150, rcReward: '골드50', rcExp: 30 },
    { floor: 54, ap: 4, board: 11, ai: 100, autoEndTurn: 60, bStones: 4, wStones: 9, missile: 1, hidden: 1, scan: 1, fcReward: '재료상자3', fcExp: 200, rcReward: '골드50', rcExp: 30 },
    { floor: 55, ap: 4, board: 11, ai: 100, autoEndTurn: 60, bStones: 4, wStones: 10, missile: 1, hidden: 1, scan: 1, fcReward: '골드400', fcExp: 150, rcReward: '골드50', rcExp: 30 },
    { floor: 56, ap: 4, board: 11, ai: 100, autoEndTurn: 60, bStones: 4, wStones: 10, missile: 1, hidden: 1, scan: 1, fcReward: '골드400', fcExp: 150, rcReward: '골드50', rcExp: 30 },
    { floor: 57, ap: 4, board: 11, ai: 100, autoEndTurn: 60, bStones: 4, wStones: 10, missile: 1, hidden: 1, scan: 1, fcReward: '골드400', fcExp: 150, rcReward: '골드50', rcExp: 30 },
    { floor: 58, ap: 4, board: 11, ai: 100, autoEndTurn: 60, bStones: 5, wStones: 11, missile: 1, hidden: 1, scan: 1, fcReward: '골드400', fcExp: 150, rcReward: '골드50', rcExp: 30 },
    { floor: 59, ap: 4, board: 11, ai: 100, autoEndTurn: 60, bStones: 4, wStones: 11, missile: 1, hidden: 1, scan: 1, fcReward: '다이아꾸러미3', fcExp: 200, rcReward: '골드50', rcExp: 30 },
    { floor: 60, ap: 4, board: 11, ai: 100, autoEndTurn: 60, bStones: 5, wStones: 13, missile: 1, hidden: 1, scan: 1, fcReward: '장비상자4', fcExp: 250, rcReward: '골드50', rcExp: 30 },
    { floor: 61, ap: 5, board: 13, ai: 100, autoEndTurn: 80, bStones: 4, wStones: 8, missile: 1, hidden: 1, scan: 1, fcReward: '골드500', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 62, ap: 5, board: 13, ai: 100, autoEndTurn: 80, bStones: 5, wStones: 10, missile: 1, hidden: 1, scan: 1, fcReward: '골드500', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 63, ap: 5, board: 13, ai: 100, autoEndTurn: 80, bStones: 6, wStones: 11, missile: 1, hidden: 1, scan: 1, fcReward: '골드500', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 64, ap: 5, board: 13, ai: 100, autoEndTurn: 80, bStones: 7, wStones: 12, missile: 1, hidden: 1, scan: 1, fcReward: '골드500', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 65, ap: 5, board: 13, ai: 100, autoEndTurn: 80, bStones: 8, wStones: 14, missile: 1, hidden: 1, scan: 1, fcReward: '골드꾸러미4', fcExp: 250, rcReward: '골드100', rcExp: 40 },
    { floor: 66, ap: 5, board: 13, ai: 100, autoEndTurn: 80, bStones: 9, wStones: 14, missile: 1, hidden: 1, scan: 1, fcReward: '골드500', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 67, ap: 5, board: 13, ai: 100, autoEndTurn: 80, bStones: 8, wStones: 13, missile: 1, hidden: 1, scan: 1, fcReward: '골드500', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 68, ap: 5, board: 13, ai: 100, autoEndTurn: 80, bStones: 7, wStones: 12, missile: 1, hidden: 1, scan: 1, fcReward: '골드500', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 69, ap: 5, board: 13, ai: 100, autoEndTurn: 80, bStones: 5, wStones: 10, missile: 1, hidden: 1, scan: 1, fcReward: '골드500', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 70, ap: 5, board: 13, ai: 100, autoEndTurn: 80, bStones: 3, wStones: 9, missile: 1, hidden: 1, scan: 1, fcReward: '장비상자4', fcExp: 300, rcReward: '골드100', rcExp: 70 },
    { floor: 71, ap: 5, board: 13, ai: 100, autoEndTurn: 80, bStones: 4, wStones: 10, missile: 1, hidden: 1, scan: 1, fcReward: '골드600', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 72, ap: 5, board: 13, ai: 100, autoEndTurn: 80, bStones: 5, wStones: 11, missile: 1, hidden: 1, scan: 1, fcReward: '골드600', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 73, ap: 5, board: 13, ai: 100, autoEndTurn: 80, bStones: 4, wStones: 10, missile: 1, hidden: 1, scan: 1, fcReward: '골드600', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 74, ap: 5, board: 13, ai: 100, autoEndTurn: 80, bStones: 4, wStones: 10, missile: 1, hidden: 1, scan: 1, fcReward: '재료상자4', fcExp: 250, rcReward: '골드100', rcExp: 40 },
    { floor: 75, ap: 5, board: 13, ai: 100, autoEndTurn: 80, bStones: 4, wStones: 12, missile: 1, hidden: 1, scan: 1, fcReward: '골드600', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 76, ap: 5, board: 13, ai: 100, autoEndTurn: 80, bStones: 4, wStones: 11, missile: 1, hidden: 1, scan: 1, fcReward: '골드600', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 77, ap: 5, board: 13, ai: 100, autoEndTurn: 80, bStones: 4, wStones: 11, missile: 1, hidden: 1, scan: 1, fcReward: '골드600', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 78, ap: 5, board: 13, ai: 100, autoEndTurn: 80, bStones: 5, wStones: 12, missile: 1, hidden: 1, scan: 1, fcReward: '다이아꾸러미4', fcExp: 350, rcReward: '골드100', rcExp: 80 },
    { floor: 79, ap: 5, board: 13, ai: 100, autoEndTurn: 80, bStones: 4, wStones: 11, missile: 1, hidden: 1, scan: 1, fcReward: '골드600', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 80, ap: 5, board: 13, ai: 100, autoEndTurn: 80, bStones: 5, wStones: 14, missile: 1, hidden: 1, scan: 1, fcReward: '골드600', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 81, ap: 6, board: 13, ai: 100, autoEndTurn: 80, bStones: 4, wStones: 14, bPattern: 5, wPattern: 4, fcReward: '골드700', fcExp: 250, rcReward: '골드150', rcExp: 50 },
    { floor: 82, ap: 6, board: 13, ai: 100, autoEndTurn: 80, bStones: 3, wStones: 14, bPattern: 5, wPattern: 3, fcReward: '골드700', fcExp: 250, rcReward: '골드150', rcExp: 50 },
    { floor: 83, ap: 6, board: 13, ai: 100, autoEndTurn: 80, bStones: 4, wStones: 16, bPattern: 7, wPattern: 2, fcReward: '골드700', fcExp: 250, rcReward: '골드150', rcExp: 50 },
    { floor: 84, ap: 6, board: 13, ai: 100, autoEndTurn: 80, bStones: 4, wStones: 17, bPattern: 7, wPattern: 2, fcReward: '재료상자5', fcExp: 400, rcReward: '골드150', rcExp: 50 },
    { floor: 85, ap: 6, board: 13, ai: 100, autoEndTurn: 80, bStones: 4, wStones: 18, bPattern: 8, wPattern: 2, fcReward: '골드700', fcExp: 250, rcReward: '골드150', rcExp: 50 },
    { floor: 86, ap: 6, board: 13, ai: 100, autoEndTurn: 80, bStones: 4, wStones: 15, fcReward: '골드800', fcExp: 300, rcReward: '골드300', rcExp: 50 },
    { floor: 87, ap: 6, board: 13, ai: 100, autoEndTurn: 80, bStones: 3, wStones: 15, fcReward: '골드800', fcExp: 300, rcReward: '골드300', rcExp: 50 },
    { floor: 88, ap: 6, board: 13, ai: 100, autoEndTurn: 80, bStones: 3, wStones: 16, fcReward: '골드800', fcExp: 300, rcReward: '골드300', rcExp: 50 },
    { floor: 89, ap: 6, board: 13, ai: 100, autoEndTurn: 80, bStones: 4, wStones: 17, fcReward: '골드800', fcExp: 300, rcReward: '골드300', rcExp: 50 },
    { floor: 90, ap: 6, board: 13, ai: 100, autoEndTurn: 80, bStones: 4, wStones: 17, fcReward: '장비상자6', fcExp: 400, rcReward: '골드300', rcExp: 90 },
    { floor: 91, ap: 7, board: 13, ai: 100, autoEndTurn: 80, bStones: 4, wStones: 17, fcReward: '골드800', fcExp: 350, rcReward: '골드300', rcExp: 50 },
    { floor: 92, ap: 7, board: 13, ai: 100, autoEndTurn: 80, bStones: 3, wStones: 16, fcReward: '골드800', fcExp: 350, rcReward: '골드300', rcExp: 50 },
    { floor: 93, ap: 7, board: 13, ai: 100, autoEndTurn: 80, bStones: 3, wStones: 17, fcReward: '골드800', fcExp: 350, rcReward: '골드300', rcExp: 50 },
    { floor: 94, ap: 7, board: 13, ai: 100, autoEndTurn: 80, bStones: 4, wStones: 18, fcReward: '재료상자6', fcExp: 350, rcReward: '골드300', rcExp: 50 },
    { floor: 95, ap: 7, board: 13, ai: 100, autoEndTurn: 80, bStones: 4, wStones: 25, fcReward: '장비상자6', fcExp: 1000, rcReward: '골드350', rcExp: 90 },
    { floor: 96, ap: 7, board: 13, ai: 100, autoEndTurn: 80, bStones: 4, wStones: 17, fcReward: '골드800', fcExp: 350, rcReward: '골드300', rcExp: 50 },
    { floor: 97, ap: 7, board: 13, ai: 100, autoEndTurn: 80, bStones: 3, wStones: 16, fcReward: '골드800', fcExp: 350, rcReward: '골드300', rcExp: 50 },
    { floor: 98, ap: 7, board: 13, ai: 100, autoEndTurn: 80, bStones: 3, wStones: 17, fcReward: '골드800', fcExp: 350, rcReward: '골드300', rcExp: 50 },
    { floor: 99, ap: 7, board: 13, ai: 100, autoEndTurn: 80, bStones: 4, wStones: 18, fcReward: '재료상자6', fcExp: 350, rcReward: '골드300', rcExp: 50 },
    { floor: 100, ap: 8, board: 13, ai: 100, autoEndTurn: 80, bStones: 4, wStones: 25, fcReward: '스탯+5', fcExp: 1000, rcReward: '골드1000', rcExp: 100 },
];

const parseReward = (rewardStr: string): Partial<QuestReward> => {
    const romanMap: { [key: string]: string } = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V', '6': 'VI' };
    
    if (rewardStr.startsWith('골드꾸러미')) {
        const num = rewardStr.slice(-1);
        return { items: [{ itemId: `골드 꾸러미${num}`, quantity: 1 }] };
    }
    if (rewardStr.startsWith('다이아꾸러미')) {
        const num = rewardStr.slice(-1);
        return { items: [{ itemId: `다이아 꾸러미${num}`, quantity: 1 }] };
    }
    if (rewardStr.startsWith('장비상자')) {
        const num = rewardStr.slice(-1);
        return { items: [{ itemId: `장비 상자 ${romanMap[num]}`, quantity: 1 }] };
    }
    if (rewardStr.startsWith('재료상자')) {
        const num = rewardStr.slice(-1);
        return { items: [{ itemId: `재료 상자 ${romanMap[num]}`, quantity: 1 }] };
    }
    if (rewardStr.startsWith('골드')) {
        return { gold: parseInt(rewardStr.replace('골드', ''), 10) };
    }
    if (rewardStr.startsWith('스탯+')) {
        return { bonus: `스탯+${rewardStr.replace('스탯+', '')}` };
    }
    return {};
};

const getLevel = (aiLevel: number): SinglePlayerLevel => {
    if (aiLevel <= 10) return SinglePlayerLevel.입문;
    if (aiLevel <= 30) return SinglePlayerLevel.초급;
    if (aiLevel <= 50) return SinglePlayerLevel.중급;
    if (aiLevel <= 75) return SinglePlayerLevel.고급;
    return SinglePlayerLevel.유단자;
};

const getGameType = (d: typeof rawData[0]): GameType => {
    if (d.floor <= 20) return GameType.Capture;
    return GameType.Speed; // Represents auto-scoring after turn limit
};

export const TOWER_STAGES: SinglePlayerStageInfo[] = rawData.map(d => {
    const fcRewardParsed = parseReward(d.fcReward);
    const rcRewardParsed = parseReward(d.rcReward);
    
    const isItemGame = d.floor > 20;
    const mixedModes: GameMode[] = [];
    if (isItemGame) {
        if (d.missile > 0) mixedModes.push(GameMode.Missile);
        if (d.hidden > 0) mixedModes.push(GameMode.Hidden);
    }

    let mode: GameMode;
    if (d.gameType === 'capture') {
        mode = GameMode.Capture;
    } else if (mixedModes.length > 1) {
        mode = GameMode.Mix;
    } else if (mixedModes.length === 1) {
        mode = mixedModes[0];
    } else {
        mode = GameMode.Standard;
    }

    return {
        id: `tower-${d.floor}`,
        name: `${d.floor}층`,
        floor: d.floor,
        level: getLevel(d.ai),
        gameType: getGameType(d),
        mode: mode,
        mixedModes: mixedModes.length > 1 ? mixedModes : undefined,
        actionPointCost: d.ap,
        boardSize: d.board as 7 | 9 | 11 | 13,
        targetScore: d.bTarget ? { black: d.bTarget, white: d.wTarget } : undefined,
        aiLevel: Math.ceil(d.ai / 10),
        placements: {
            b: d.bStones,
            w: d.wStones,
            bP: d.bPattern || 0,
            wP: d.wPattern || 0,
            randomBlackStones: getStageId(d.floor) ? parsed_random_placement_data[getStageId(d.floor)]?.randomBlackStones || 0 : 0,
            randomWhiteStones: getStageId(d.floor) ? parsed_random_placement_data[getStageId(d.floor)]?.randomWhiteStones || 0 : 0,
            randomBlackPatternedStones: getStageId(d.floor) ? parsed_random_placement_data[getStageId(d.floor)]?.randomBlackPatternedStones || 0 : 0,
            randomWhitePatternedStones: getStageId(d.floor) ? parsed_random_placement_data[getStageId(d.floor)]?.randomWhitePatternedStones || 0 : 0,
        },
        timeControl: { type: 'byoyomi', mainTime: 3, byoyomiTime: 30, byoyomiCount: 3 },
        rewards: {
            firstClear: { ...fcRewardParsed, exp: { type: 'strategy', amount: d.fcExp } } as QuestReward,
            repeatClear: { ...rcRewardParsed, exp: { type: 'strategy', amount: d.rcExp } } as QuestReward,
        },
        blackStoneLimit: d.bLimit,
        autoEndTurnCount: d.autoEndTurn,
        missileCount: d.missile,
        hiddenStoneCount: d.hidden,
        scanCount: d.scan,
    };
});

export const TOWER_RANKING_REWARDS: LeagueRewardTier[] = [
    { rankStart: 1, rankEnd: 1, diamonds: 200, items: [{ itemId: '장비 상자 VI', quantity: 1 }, { itemId: '재료 상자 VI', quantity: 1 }], strategyXp: 2000, outcome: 'maintain' },
    { rankStart: 2, rankEnd: 2, diamonds: 150, items: [{ itemId: '장비 상자 V', quantity: 1 }, { itemId: '재료 상자 V', quantity: 1 }], strategyXp: 1000, outcome: 'maintain' },
    { rankStart: 3, rankEnd: 3, diamonds: 125, items: [{ itemId: '장비 상자 IV', quantity: 1 }, { itemId: '재료 상자 IV', quantity: 1 }], strategyXp: 500, outcome: 'maintain' },
    { rankStart: 4, rankEnd: 10, diamonds: 100, items: [{ itemId: '장비 상자 III', quantity: 1 }, { itemId: '재료 상자 III', quantity: 1 }], strategyXp: 250, outcome: 'maintain' },
    { rankStart: 11, rankEnd: 50, diamonds: 75, items: [{ itemId: '장비 상자 II', quantity: 1 }, { itemId: '재료 상자 II', quantity: 1 }], strategyXp: 200, outcome: 'maintain' },
    { rankStart: 51, rankEnd: 100, diamonds: 50, items: [{ itemId: '장비 상자 I', quantity: 1 }, { itemId: '재료 상자 I', quantity: 1 }], strategyXp: 100, outcome: 'maintain' },
    { rankStart: 101, rankEnd: Infinity, diamonds: 25, strategyXp: 50, outcome: 'maintain' },
];