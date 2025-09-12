import { SinglePlayerStageInfo, GameMode, Player, SinglePlayerLevel, LeagueRewardTier } from '../types.js';

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


// Data transcribed from the user-provided image
const rawData = [
    { floor: 1, ap: 2, board: 7, bTarget: 5, wTarget: 5, ai: 10, bLimit: 15, centerChance: 90, bStones: 2, wStones: 2, bPattern: 0, wPattern: 1, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드100', fcExp: 30, rcReward: '골드10', rcExp: 10 },
    { floor: 2, ap: 2, board: 7, bTarget: 5, wTarget: 5, ai: 10, bLimit: 15, centerChance: 90, bStones: 2, wStones: 3, bPattern: 0, wPattern: 1, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드100', fcExp: 30, rcReward: '골드10', rcExp: 10 },
    { floor: 3, ap: 2, board: 7, bTarget: 5, wTarget: 5, ai: 10, bLimit: 15, centerChance: 90, bStones: 2, wStones: 3, bPattern: 1, wPattern: 1, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드100', fcExp: 30, rcReward: '골드10', rcExp: 10 },
    { floor: 4, ap: 2, board: 7, bTarget: 5, wTarget: 5, ai: 10, bLimit: 15, centerChance: 90, bStones: 2, wStones: 4, bPattern: 2, wPattern: 1, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드100', fcExp: 30, rcReward: '골드10', rcExp: 10 },
    { floor: 5, ap: 2, board: 7, bTarget: 6, wTarget: 6, ai: 10, bLimit: 15, centerChance: 90, bStones: 2, wStones: 5, bPattern: 2, wPattern: 1, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드꾸러미1', fcExp: 50, rcReward: '골드10', rcExp: 10 },
    { floor: 6, ap: 2, board: 7, bTarget: 6, wTarget: 6, ai: 10, bLimit: 15, centerChance: 90, bStones: 3, wStones: 7, bPattern: 2, wPattern: 0, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드100', fcExp: 30, rcReward: '골드10', rcExp: 10 },
    { floor: 7, ap: 2, board: 7, bTarget: 6, wTarget: 6, ai: 10, bLimit: 15, centerChance: 90, bStones: 3, wStones: 6, bPattern: 2, wPattern: 2, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드100', fcExp: 30, rcReward: '골드10', rcExp: 10 },
    { floor: 8, ap: 2, board: 7, bTarget: 6, wTarget: 6, ai: 10, bLimit: 15, centerChance: 90, bStones: 3, wStones: 7, bPattern: 3, wPattern: 2, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드100', fcExp: 30, rcReward: '골드10', rcExp: 10 },
    { floor: 9, ap: 2, board: 7, bTarget: 6, wTarget: 6, ai: 10, bLimit: 15, centerChance: 90, bStones: 3, wStones: 6, bPattern: 3, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드100', fcExp: 30, rcReward: '골드10', rcExp: 10 },
    { floor: 10, ap: 2, board: 7, bTarget: 7, wTarget: 7, ai: 10, bLimit: 15, centerChance: 50, bStones: 4, wStones: 7, bPattern: 2, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '장비상자1', fcExp: 100, rcReward: '골드10', rcExp: 15 },
    { floor: 11, ap: 2, board: 7, bTarget: 7, wTarget: 7, ai: 10, bLimit: 15, centerChance: 80, bStones: 4, wStones: 7, bPattern: 2, wPattern: 2, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드150', fcExp: 30, rcReward: '골드10', rcExp: 10 },
    { floor: 12, ap: 2, board: 7, bTarget: 7, wTarget: 7, ai: 10, bLimit: 15, centerChance: 80, bStones: 4, wStones: 6, bPattern: 2, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드150', fcExp: 30, rcReward: '골드10', rcExp: 10 },
    { floor: 13, ap: 2, board: 7, bTarget: 7, wTarget: 7, ai: 10, bLimit: 15, centerChance: 80, bStones: 3, wStones: 6, bPattern: 3, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드150', fcExp: 30, rcReward: '골드10', rcExp: 10 },
    { floor: 14, ap: 2, board: 7, bTarget: 7, wTarget: 7, ai: 10, bLimit: 15, centerChance: 80, bStones: 4, wStones: 6, bPattern: 3, wPattern: 4, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드150', fcExp: 30, rcReward: '골드10', rcExp: 10 },
    { floor: 15, ap: 2, board: 7, bTarget: 8, wTarget: 8, ai: 10, bLimit: 15, centerChance: 80, bStones: 4, wStones: 8, bPattern: 3, wPattern: 2, time: 1, byoTime: 30, byoCount: 3, fcReward: '재료상자1', fcExp: 50, rcReward: '골드10', rcExp: 10 },
    { floor: 16, ap: 2, board: 7, bTarget: 8, wTarget: 7, ai: 10, bLimit: 15, centerChance: 80, bStones: 4, wStones: 6, bPattern: 3, wPattern: 4, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드150', fcExp: 30, rcReward: '골드10', rcExp: 10 },
    { floor: 17, ap: 2, board: 7, bTarget: 8, wTarget: 7, ai: 10, bLimit: 15, centerChance: 80, bStones: 4, wStones: 6, bPattern: 4, wPattern: 4, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드150', fcExp: 30, rcReward: '골드10', rcExp: 10 },
    { floor: 18, ap: 2, board: 7, bTarget: 8, wTarget: 7, ai: 10, bLimit: 15, centerChance: 80, bStones: 4, wStones: 7, bPattern: 2, wPattern: 2, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드150', fcExp: 30, rcReward: '골드10', rcExp: 10 },
    { floor: 19, ap: 2, board: 7, bTarget: 8, wTarget: 8, ai: 10, bLimit: 15, centerChance: 80, bStones: 5, wStones: 9, bPattern: 2, wPattern: 4, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드150', fcExp: 30, rcReward: '골드10', rcExp: 10 },
    { floor: 20, ap: 3, board: 9, bTarget: 9, wTarget: 8, ai: 10, bLimit: 20, centerChance: 50, bStones: 4, wStones: 6, bPattern: 2, wPattern: 4, time: 1, byoTime: 30, byoCount: 3, fcReward: '다이아꾸러미1', fcExp: 100, rcReward: '골드30', rcExp: 20 },
    { floor: 21, ap: 3, board: 9, bTarget: 9, wTarget: 8, ai: 10, bLimit: 20, centerChance: 70, bStones: 5, wStones: 10, bPattern: 2, wPattern: 1, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드200', fcExp: 50, rcReward: '골드30', rcExp: 20 },
    { floor: 22, ap: 3, board: 9, bTarget: 9, wTarget: 8, ai: 10, bLimit: 20, centerChance: 70, bStones: 5, wStones: 10, bPattern: 2, wPattern: 2, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드200', fcExp: 50, rcReward: '골드30', rcExp: 20 },
    { floor: 23, ap: 3, board: 9, bTarget: 9, wTarget: 8, ai: 10, bLimit: 20, centerChance: 70, bStones: 5, wStones: 9, bPattern: 3, wPattern: 4, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드200', fcExp: 50, rcReward: '골드30', rcExp: 20 },
    { floor: 24, ap: 3, board: 9, bTarget: 9, wTarget: 8, ai: 10, bLimit: 20, centerChance: 70, bStones: 5, wStones: 10, bPattern: 3, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드200', fcExp: 50, rcReward: '골드30', rcExp: 20 },
    { floor: 25, ap: 3, board: 9, bTarget: 10, wTarget: 9, ai: 10, bLimit: 20, centerChance: 70, bStones: 3, wStones: 9, bPattern: 4, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드꾸러미2', fcExp: 80, rcReward: '골드30', rcExp: 20 },
    { floor: 26, ap: 3, board: 9, bTarget: 10, wTarget: 9, ai: 10, bLimit: 20, centerChance: 70, bStones: 3, wStones: 10, bPattern: 4, wPattern: 2, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드200', fcExp: 50, rcReward: '골드30', rcExp: 20 },
    { floor: 27, ap: 3, board: 9, bTarget: 10, wTarget: 9, ai: 10, bLimit: 20, centerChance: 70, bStones: 5, wStones: 10, bPattern: 3, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드200', fcExp: 50, rcReward: '골드30', rcExp: 20 },
    { floor: 28, ap: 3, board: 9, bTarget: 10, wTarget: 9, ai: 10, bLimit: 20, centerChance: 70, bStones: 5, wStones: 8, bPattern: 2, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드200', fcExp: 50, rcReward: '골드30', rcExp: 20 },
    { floor: 29, ap: 3, board: 9, bTarget: 10, wTarget: 9, ai: 10, bLimit: 20, centerChance: 70, bStones: 5, wStones: 10, bPattern: 3, wPattern: 1, time: 1, byoTime: 30, byoCount: 3, fcReward: '장비상자2', fcExp: 100, rcReward: '골드30', rcExp: 20 },
    { floor: 30, ap: 3, board: 9, bTarget: 11, wTarget: 9, ai: 10, bLimit: 20, centerChance: 50, bStones: 6, wStones: 11, bPattern: 2, wPattern: 4, time: 1, byoTime: 30, byoCount: 3, fcReward: '장비상자3', fcExp: 100, rcReward: '골드30', rcExp: 20 },
    { floor: 31, ap: 3, board: 9, bTarget: 11, wTarget: 9, ai: 10, bLimit: 20, centerChance: 70, bStones: 6, wStones: 10, bPattern: 2, wPattern: 1, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드250', fcExp: 50, rcReward: '골드30', rcExp: 20 },
    { floor: 32, ap: 3, board: 9, bTarget: 11, wTarget: 9, ai: 10, bLimit: 20, centerChance: 70, bStones: 6, wStones: 9, bPattern: 1, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드250', fcExp: 50, rcReward: '골드30', rcExp: 20 },
    { floor: 33, ap: 3, board: 9, bTarget: 11, wTarget: 9, ai: 10, bLimit: 20, centerChance: 70, bStones: 6, wStones: 10, bPattern: 2, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드250', fcExp: 50, rcReward: '골드30', rcExp: 20 },
    { floor: 34, ap: 3, board: 9, bTarget: 11, wTarget: 9, ai: 10, bLimit: 20, centerChance: 70, bStones: 6, wStones: 10, bPattern: 3, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드250', fcExp: 50, rcReward: '골드30', rcExp: 20 },
    { floor: 35, ap: 3, board: 9, bTarget: 12, wTarget: 10, ai: 10, bLimit: 20, centerChance: 70, bStones: 6, wStones: 11, bPattern: 3, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '재료상자2', fcExp: 100, rcReward: '골드30', rcExp: 20 },
    { floor: 36, ap: 3, board: 9, bTarget: 12, wTarget: 10, ai: 10, bLimit: 20, centerChance: 70, bStones: 6, wStones: 10, bPattern: 2, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드250', fcExp: 50, rcReward: '골드30', rcExp: 20 },
    { floor: 37, ap: 3, board: 9, bTarget: 12, wTarget: 10, ai: 10, bLimit: 20, centerChance: 70, bStones: 3, wStones: 9, bPattern: 4, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드250', fcExp: 50, rcReward: '골드30', rcExp: 20 },
    { floor: 38, ap: 3, board: 9, bTarget: 12, wTarget: 10, ai: 10, bLimit: 20, centerChance: 70, bStones: 4, wStones: 11, bPattern: 3, wPattern: 1, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드250', fcExp: 50, rcReward: '골드30', rcExp: 20 },
    { floor: 39, ap: 3, board: 9, bTarget: 12, wTarget: 10, ai: 10, bLimit: 20, centerChance: 70, bStones: 6, wStones: 10, bPattern: 1, wPattern: 2, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드250', fcExp: 50, rcReward: '골드30', rcExp: 20 },
    { floor: 40, ap: 4, board: 9, bTarget: 15, wTarget: 12, ai: 10, bLimit: 20, centerChance: 50, bStones: 4, wStones: 11, bPattern: 5, wPattern: 4, time: 1, byoTime: 30, byoCount: 3, fcReward: '다이아꾸러미2', fcExp: 150, rcReward: '골드30', rcExp: 40 },
    { floor: 41, ap: 4, board: 11, bTarget: 15, wTarget: 12, ai: 10, bLimit: 25, centerChance: 50, bStones: 3, wStones: 11, bPattern: 5, wPattern: 4, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드300', fcExp: 100, rcReward: '골드50', rcExp: 30 },
    { floor: 42, ap: 4, board: 11, bTarget: 15, wTarget: 12, ai: 10, bLimit: 25, centerChance: 50, bStones: 4, wStones: 10, bPattern: 5, wPattern: 4, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드300', fcExp: 100, rcReward: '골드50', rcExp: 30 },
    { floor: 43, ap: 4, board: 11, bTarget: 15, wTarget: 12, ai: 10, bLimit: 25, centerChance: 50, bStones: 5, wStones: 10, bPattern: 3, wPattern: 4, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드300', fcExp: 100, rcReward: '골드50', rcExp: 30 },
    { floor: 44, ap: 4, board: 11, bTarget: 15, wTarget: 12, ai: 10, bLimit: 25, centerChance: 50, bStones: 5, wStones: 11, bPattern: 3, wPattern: 4, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드300', fcExp: 100, rcReward: '골드50', rcExp: 30 },
    { floor: 45, ap: 4, board: 11, bTarget: 16, wTarget: 12, ai: 10, bLimit: 25, centerChance: 50, bStones: 5, wStones: 14, bPattern: 5, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드꾸러미3', fcExp: 150, rcReward: '골드50', rcExp: 30 },
    { floor: 46, ap: 4, board: 11, bTarget: 16, wTarget: 12, ai: 10, bLimit: 25, centerChance: 50, bStones: 5, wStones: 10, bPattern: 4, wPattern: 5, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드300', fcExp: 100, rcReward: '골드50', rcExp: 30 },
    { floor: 47, ap: 4, board: 11, bTarget: 16, wTarget: 12, ai: 10, bLimit: 25, centerChance: 50, bStones: 5, wStones: 13, bPattern: 3, wPattern: 2, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드300', fcExp: 100, rcReward: '골드50', rcExp: 30 },
    { floor: 48, ap: 4, board: 11, bTarget: 16, wTarget: 12, ai: 10, bLimit: 25, centerChance: 50, bStones: 2, wStones: 12, bPattern: 7, wPattern: 4, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드300', fcExp: 100, rcReward: '골드50', rcExp: 30 },
    { floor: 49, ap: 4, board: 11, bTarget: 17, wTarget: 13, ai: 10, bLimit: 25, centerChance: 40, bStones: 3, wStones: 13, bPattern: 6, wPattern: 4, time: 1, byoTime: 30, byoCount: 3, fcReward: '장비상자3', fcExp: 200, rcReward: '골드50', rcExp: 50 },
    { floor: 50, ap: 4, board: 11, bTarget: 17, wTarget: 13, ai: 10, bLimit: 25, centerChance: 40, bStones: 4, wStones: 14, bPattern: 5, wPattern: 2, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드400', fcExp: 150, rcReward: '골드50', rcExp: 30 },
    { floor: 51, ap: 4, board: 11, bTarget: 17, wTarget: 13, ai: 10, bLimit: 25, centerChance: 40, bStones: 5, wStones: 12, bPattern: 3, wPattern: 2, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드400', fcExp: 150, rcReward: '골드50', rcExp: 30 },
    { floor: 52, ap: 4, board: 11, bTarget: 17, wTarget: 13, ai: 10, bLimit: 25, centerChance: 40, bStones: 6, wStones: 14, bPattern: 3, wPattern: 2, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드400', fcExp: 150, rcReward: '골드50', rcExp: 30 },
    { floor: 53, ap: 4, board: 11, bTarget: 17, wTarget: 13, ai: 10, bLimit: 25, centerChance: 40, bStones: 6, wStones: 12, bPattern: 2, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드400', fcExp: 150, rcReward: '골드50', rcExp: 30 },
    { floor: 54, ap: 4, board: 11, bTarget: 18, wTarget: 13, ai: 10, bLimit: 25, centerChance: 40, bStones: 5, wStones: 12, bPattern: 3, wPattern: 5, time: 1, byoTime: 30, byoCount: 3, fcReward: '재료상자3', fcExp: 200, rcReward: '골드50', rcExp: 30 },
    { floor: 55, ap: 4, board: 11, bTarget: 18, wTarget: 13, ai: 10, bLimit: 25, centerChance: 40, bStones: 7, wStones: 14, bPattern: 3, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드400', fcExp: 150, rcReward: '골드50', rcExp: 30 },
    { floor: 56, ap: 4, board: 11, bTarget: 18, wTarget: 13, ai: 10, bLimit: 25, centerChance: 40, bStones: 8, wStones: 16, bPattern: 1, wPattern: 0, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드400', fcExp: 150, rcReward: '골드50', rcExp: 30 },
    { floor: 57, ap: 4, board: 11, bTarget: 18, wTarget: 13, ai: 10, bLimit: 25, centerChance: 40, bStones: 6, wStones: 14, bPattern: 4, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드400', fcExp: 150, rcReward: '골드50', rcExp: 30 },
    { floor: 58, ap: 4, board: 11, bTarget: 20, wTarget: 15, ai: 10, bLimit: 25, centerChance: 40, bStones: 4, wStones: 15, bPattern: 6, wPattern: 2, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드400', fcExp: 150, rcReward: '골드50', rcExp: 30 },
    { floor: 59, ap: 5, board: 13, bTarget: 20, wTarget: 15, ai: 10, bLimit: 30, centerChance: 40, bStones: 2, wStones: 14, bPattern: 8, wPattern: 4, time: 1, byoTime: 30, byoCount: 3, fcReward: '다이아꾸러미3', fcExp: 250, rcReward: '골드60', rcExp: 40 },
    { floor: 60, ap: 5, board: 13, bTarget: 20, wTarget: 15, ai: 10, bLimit: 30, centerChance: 40, bStones: 1, wStones: 15, bPattern: 8, wPattern: 4, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드500', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 61, ap: 5, board: 13, bTarget: 20, wTarget: 15, ai: 10, bLimit: 30, centerChance: 40, bStones: 2, wStones: 16, bPattern: 7, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드500', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 62, ap: 5, board: 13, bTarget: 20, wTarget: 15, ai: 10, bLimit: 30, centerChance: 40, bStones: 3, wStones: 18, bPattern: 6, wPattern: 1, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드500', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 63, ap: 5, board: 13, bTarget: 20, wTarget: 15, ai: 10, bLimit: 30, centerChance: 40, bStones: 4, wStones: 17, bPattern: 7, wPattern: 5, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드500', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 64, ap: 5, board: 13, bTarget: 20, wTarget: 15, ai: 10, bLimit: 30, centerChance: 40, bStones: 5, wStones: 17, bPattern: 5, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드500', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 65, ap: 5, board: 13, bTarget: 20, wTarget: 15, ai: 10, bLimit: 30, centerChance: 40, bStones: 6, wStones: 16, bPattern: 5, wPattern: 5, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드500', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 66, ap: 5, board: 13, bTarget: 20, wTarget: 15, ai: 10, bLimit: 30, centerChance: 40, bStones: 4, wStones: 14, bPattern: 5, wPattern: 5, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드500', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 67, ap: 5, board: 13, bTarget: 20, wTarget: 15, ai: 10, bLimit: 30, centerChance: 40, bStones: 4, wStones: 18, bPattern: 6, wPattern: 2, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드500', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 68, ap: 5, board: 13, bTarget: 20, wTarget: 15, ai: 10, bLimit: 30, centerChance: 40, bStones: 5, wStones: 16, bPattern: 5, wPattern: 4, time: 1, byoTime: 30, byoCount: 3, fcReward: '장비상자4', fcExp: 300, rcReward: '골드100', rcExp: 70 },
    { floor: 69, ap: 5, board: 13, bTarget: 20, wTarget: 15, ai: 10, bLimit: 30, centerChance: 30, bStones: 5, wStones: 18, bPattern: 5, wPattern: 2, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드600', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 70, ap: 5, board: 13, bTarget: 20, wTarget: 15, ai: 10, bLimit: 30, centerChance: 40, bStones: 4, wStones: 17, bPattern: 6, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드600', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 71, ap: 5, board: 13, bTarget: 20, wTarget: 15, ai: 10, bLimit: 30, centerChance: 40, bStones: 5, wStones: 19, bPattern: 7, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드600', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 72, ap: 5, board: 13, bTarget: 20, wTarget: 15, ai: 10, bLimit: 30, centerChance: 40, bStones: 3, wStones: 15, bPattern: 4, wPattern: 2, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드600', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 73, ap: 5, board: 13, bTarget: 20, wTarget: 15, ai: 10, bLimit: 30, centerChance: 40, bStones: 4, wStones: 14, bPattern: 3, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드600', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 74, ap: 5, board: 13, bTarget: 20, wTarget: 15, ai: 10, bLimit: 30, centerChance: 40, bStones: 3, wStones: 18, bPattern: 5, wPattern: 0, time: 1, byoTime: 30, byoCount: 3, fcReward: '재료상자4', fcExp: 250, rcReward: '골드100', rcExp: 40 },
    { floor: 75, ap: 5, board: 13, bTarget: 20, wTarget: 15, ai: 10, bLimit: 30, centerChance: 40, bStones: 4, wStones: 17, bPattern: 5, wPattern: 2, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드600', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 76, ap: 5, board: 13, bTarget: 20, wTarget: 15, ai: 10, bLimit: 30, centerChance: 40, bStones: 5, wStones: 18, bPattern: 4, wPattern: 1, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드600', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 77, ap: 5, board: 13, bTarget: 20, wTarget: 15, ai: 10, bLimit: 30, centerChance: 40, bStones: 3, wStones: 16, bPattern: 6, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드600', fcExp: 200, rcReward: '골드100', rcExp: 40 },
    { floor: 78, ap: 5, board: 13, bTarget: 20, wTarget: 15, ai: 10, bLimit: 30, centerChance: 30, bStones: 4, wStones: 16, bPattern: 7, wPattern: 5, time: 1, byoTime: 30, byoCount: 3, fcReward: '다이아꾸러미4', fcExp: 350, rcReward: '골드100', rcExp: 80 },
    { floor: 79, ap: 6, board: 13, bTarget: 25, wTarget: 19, ai: 10, bLimit: 35, centerChance: 30, bStones: 5, wStones: 16, bPattern: 6, wPattern: 6, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드700', fcExp: 250, rcReward: '골드150', rcExp: 50 },
    { floor: 80, ap: 6, board: 13, bTarget: 25, wTarget: 19, ai: 10, bLimit: 35, centerChance: 30, bStones: 4, wStones: 16, bPattern: 5, wPattern: 4, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드700', fcExp: 250, rcReward: '골드150', rcExp: 50 },
    { floor: 81, ap: 6, board: 13, bTarget: 25, wTarget: 19, ai: 10, bLimit: 35, centerChance: 30, bStones: 3, wStones: 16, bPattern: 5, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드700', fcExp: 250, rcReward: '골드150', rcExp: 50 },
    { floor: 82, ap: 6, board: 13, bTarget: 25, wTarget: 18, ai: 10, bLimit: 35, centerChance: 30, bStones: 2, wStones: 16, bPattern: 7, wPattern: 4, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드700', fcExp: 250, rcReward: '골드150', rcExp: 50 },
    { floor: 83, ap: 6, board: 13, bTarget: 25, wTarget: 17, ai: 10, bLimit: 35, centerChance: 30, bStones: 3, wStones: 18, bPattern: 6, wPattern: 2, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드700', fcExp: 250, rcReward: '골드150', rcExp: 50 },
    { floor: 84, ap: 6, board: 13, bTarget: 25, wTarget: 16, ai: 10, bLimit: 35, centerChance: 30, bStones: 0, wStones: 17, bPattern: 8, wPattern: 2, time: 1, byoTime: 30, byoCount: 3, fcReward: '재료상자5', fcExp: 400, rcReward: '골드150', rcExp: 50 },
    { floor: 85, ap: 7, board: 13, bTarget: 25, wTarget: 15, ai: 10, bLimit: 35, centerChance: 30, bStones: 2, wStones: 19, bPattern: 8, wPattern: 2, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드700', fcExp: 250, rcReward: '골드200', rcExp: 50 },
    { floor: 86, ap: 7, board: 13, bTarget: 25, wTarget: 14, ai: 10, bLimit: 35, centerChance: 30, bStones: 4, wStones: 19, bPattern: 7, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드700', fcExp: 250, rcReward: '골드200', rcExp: 50 },
    { floor: 87, ap: 7, board: 13, bTarget: 25, wTarget: 13, ai: 10, bLimit: 35, centerChance: 30, bStones: 5, wStones: 20, bPattern: 8, wPattern: 4, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드700', fcExp: 250, rcReward: '골드200', rcExp: 50 },
    { floor: 88, ap: 7, board: 13, bTarget: 25, wTarget: 12, ai: 10, bLimit: 35, centerChance: 30, bStones: 4, wStones: 20, bPattern: 8, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드700', fcExp: 250, rcReward: '골드200', rcExp: 50 },
    { floor: 89, ap: 8, board: 13, bTarget: 30, wTarget: 15, ai: 10, bLimit: 35, centerChance: 20, bStones: 1, wStones: 20, bPattern: 12, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '장비상자5', fcExp: 500, rcReward: '골드200', rcExp: 90 },
    { floor: 90, ap: 8, board: 13, bTarget: 30, wTarget: 15, ai: 10, bLimit: 35, centerChance: 20, bStones: 2, wStones: 17, bPattern: 8, wPattern: 4, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드800', fcExp: 300, rcReward: '골드300', rcExp: 50 },
    { floor: 91, ap: 8, board: 13, bTarget: 30, wTarget: 15, ai: 10, bLimit: 35, centerChance: 30, bStones: 3, wStones: 18, bPattern: 9, wPattern: 5, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드800', fcExp: 300, rcReward: '골드300', rcExp: 50 },
    { floor: 92, ap: 8, board: 13, bTarget: 30, wTarget: 15, ai: 10, bLimit: 35, centerChance: 30, bStones: 3, wStones: 20, bPattern: 10, wPattern: 4, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드800', fcExp: 300, rcReward: '골드300', rcExp: 50 },
    { floor: 93, ap: 8, board: 13, bTarget: 30, wTarget: 15, ai: 10, bLimit: 35, centerChance: 30, bStones: 5, wStones: 21, bPattern: 6, wPattern: 1, time: 1, byoTime: 30, byoCount: 3, fcReward: '재료상자6', fcExp: 400, rcReward: '골드300', rcExp: 50 },
    { floor: 94, ap: 8, board: 13, bTarget: 35, wTarget: 18, ai: 10, bLimit: 35, centerChance: 30, bStones: 4, wStones: 22, bPattern: 7, wPattern: 0, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드800', fcExp: 350, rcReward: '골드300', rcExp: 50 },
    { floor: 95, ap: 8, board: 13, bTarget: 35, wTarget: 18, ai: 10, bLimit: 35, centerChance: 30, bStones: 3, wStones: 20, bPattern: 8, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드800', fcExp: 350, rcReward: '골드300', rcExp: 50 },
    { floor: 96, ap: 8, board: 13, bTarget: 35, wTarget: 18, ai: 10, bLimit: 35, centerChance: 30, bStones: 5, wStones: 16, bPattern: 3, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드800', fcExp: 350, rcReward: '골드300', rcExp: 50 },
    { floor: 97, ap: 8, board: 13, bTarget: 35, wTarget: 18, ai: 10, bLimit: 35, centerChance: 30, bStones: 4, wStones: 19, bPattern: 7, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드800', fcExp: 350, rcReward: '골드300', rcExp: 50 },
    { floor: 98, ap: 8, board: 13, bTarget: 35, wTarget: 18, ai: 10, bLimit: 35, centerChance: 30, bStones: 3, wStones: 21, bPattern: 8, wPattern: 1, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드800', fcExp: 350, rcReward: '골드300', rcExp: 50 },
    { floor: 99, ap: 8, board: 13, bTarget: 35, wTarget: 18, ai: 10, bLimit: 35, centerChance: 30, bStones: 3, wStones: 21, bPattern: 8, wPattern: 1, time: 1, byoTime: 30, byoCount: 3, fcReward: '골드800', fcExp: 350, rcReward: '골드300', rcExp: 50 },
    { floor: 100, ap: 8, board: 13, bTarget: 50, wTarget: 30, ai: 10, bLimit: 35, centerChance: 10, bStones: 4, wStones: 18, bPattern: 6, wPattern: 3, time: 1, byoTime: 30, byoCount: 3, fcReward: '장비상자6', fcExp: 1000, rcReward: '골드300', rcExp: 100 },
];

const toRoman = (num: number): string => {
    const map: { [key: number]: string } = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI' };
    return map[num] || String(num);
};

const parseReward = (rewardStr: string, exp: number): { gold?: number; exp: number; items?: { itemId: string; quantity: number }[]; bonus?: string } => {
    const reward: { gold?: number; exp: number; items?: { itemId: string; quantity: number }[]; bonus?: string } = { exp };
    if (rewardStr.startsWith('골드')) {
        reward.gold = parseInt(rewardStr.replace('골드', ''), 10);
    } else if (rewardStr.startsWith('다이아꾸러미')) {
        const num = rewardStr.replace('다이아꾸러미', '');
        reward.items = [{ itemId: `다이아 꾸러미${num}`, quantity: 1 }];
    } else if (rewardStr.startsWith('골드꾸러미')) {
        const num = rewardStr.replace('골드꾸러미', '');
        reward.items = [{ itemId: `골드 꾸러미${num}`, quantity: 1 }];
    } else if (rewardStr.startsWith('장비상자')) {
        const num = parseInt(rewardStr.replace('장비상자', ''), 10);
        reward.items = [{ itemId: `장비 상자 ${toRoman(num)}`, quantity: 1 }];
    } else if (rewardStr.startsWith('재료상자')) {
        const num = parseInt(rewardStr.replace('재료상자', ''), 10);
        reward.items = [{ itemId: `재료 상자 ${toRoman(num)}`, quantity: 1 }];
    } else if (rewardStr.startsWith('스탯')) {
        reward.bonus = rewardStr;
    }
    return reward;
};

export const TOWER_STAGES: SinglePlayerStageInfo[] = rawData.map(d => {
    let level: SinglePlayerLevel;
    if (d.floor <= 20) level = SinglePlayerLevel.입문;
    else if (d.floor <= 40) level = SinglePlayerLevel.초급;
    else if (d.floor <= 60) level = SinglePlayerLevel.중급;
    else if (d.floor <= 80) level = SinglePlayerLevel.고급;
    else level = SinglePlayerLevel.유단자;

    // FIX: Ensure `repeatClear` reward object always has a `gold` property to match the `SinglePlayerStageInfo` type.
    const parsedRepeatReward = parseReward(d.rcReward, d.rcExp);

    return {
        id: `tower-${d.floor}`,
        floor: d.floor,
        name: `${d.floor}층`,
        level,
        gameType: 'capture',
        actionPointCost: d.ap,
        boardSize: d.board as any,
        targetScore: { black: d.bTarget, white: d.wTarget },
        katagoLevel: d.ai,
        placements: {
            black: d.bStones,
            white: d.wStones,
            blackPattern: d.bPattern,
            whitePattern: d.wPattern,
            centerBlackStoneChance: d.centerChance,
        },
        timeControl: {
            type: 'byoyomi',
            mainTime: d.time,
            byoyomiTime: d.byoTime,
            byoyomiCount: d.byoCount,
        },
        rewards: {
            firstClear: parseReward(d.fcReward, d.fcExp),
            repeatClear: {
                ...parsedRepeatReward,
                gold: parsedRepeatReward.gold ?? 0,
                exp: d.rcExp ?? 0,
            },
        },
        blackStoneLimit: d.bLimit,
    };
});

export const TOWER_RANKING_REWARDS: LeagueRewardTier[] = [
    { rankStart: 1, rankEnd: 1, diamonds: 200, strategyXp: 5000, items: [{ itemId: '장비 상자 VI', quantity: 1 }], outcome: 'maintain' },
    { rankStart: 2, rankEnd: 2, diamonds: 100, strategyXp: 2500, items: [{ itemId: '장비 상자 V', quantity: 1 }], outcome: 'maintain' },
    { rankStart: 3, rankEnd: 3, diamonds: 75, strategyXp: 1000, items: [{ itemId: '장비 상자 IV', quantity: 1 }], outcome: 'maintain' },
    { rankStart: 4, rankEnd: 10, diamonds: 50, strategyXp: 500, items: [{ itemId: '장비 상자 III', quantity: 1 }], outcome: 'maintain' },
    { rankStart: 11, rankEnd: 50, diamonds: 25, strategyXp: 250, items: [{ itemId: '장비 상자 II', quantity: 1 }], outcome: 'maintain' },
    { rankStart: 51, rankEnd: Infinity, diamonds: 10, strategyXp: 100, items: [{ itemId: '장비 상자 I', quantity: 1 }], outcome: 'maintain' },
];