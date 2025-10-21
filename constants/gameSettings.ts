import { GameMode, DiceGoVariant, GameSettings, Player, AlkkagiPlacementType, AlkkagiLayoutType } from '../types/index.js';

// --- Negotiation Settings ---
export const BOARD_SIZES = [19, 13, 9];
export const OMOK_BOARD_SIZES = [19, 15];
export const CAPTURE_BOARD_SIZES = [13, 11, 9, 7];
export const SPEED_BOARD_SIZES = [7, 9, 11, 13, 19];
export const HIDDEN_BOARD_SIZES = [19, 13, 11, 9, 7];
export const THIEF_BOARD_SIZES = [9, 13, 19];
export const MISSILE_BOARD_SIZES = [19, 13, 9];
export const CAPTURE_TARGETS = [5, 10, 15, 20, 25, 30];
export const CAPTURE_BID_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const TTAMOK_CAPTURE_TARGETS = [10, 20, 30];
export const HIDDEN_STONE_COUNTS = [1, 2, 3];
export const SCAN_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const MISSILE_COUNTS = Array.from({ length: 15 }, (_, i) => i + 1);
export const TIME_LIMITS = [ // in minutes
  { value: 0, label: '없음' },
  { value: 5, label: '5분' },
  { value: 10, label: '10분' },
  { value: 15, label: '15분' },
  { value: 20, label: '20분' },
  { value: 30, label: '30분' },
  { value: 40, label: '40분' },
  { value: 50, label: '50분' },
  { value: 60, label: '1시간' },
  { value: 120, label: '2시간' },
  { value: 180, label: '3시간' },
];
export const SPEED_TIME_LIMITS = [ // in minutes
  { value: 1, label: '1분' },
  { value: 3, label: '3분' },
  { value: 5, label: '5분' },
  { value: 10, label: '10분' },
  { value: 20, label: '20분' },
  { value: 30, label: '30분' },
];
export const BYOYOMI_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const BYOYOMI_TIMES = [10, 20, 30, 40, 50, 60]; // in seconds
export const BASE_STONE_COUNTS = [3, 4, 5, 6, 7, 8, 9, 10];
export const DEFAULT_KOMI = 6.5;

export const getDefaultSettingsForMode = (mode: GameMode): Partial<GameSettings> => {
    switch (mode) {
        case GameMode.Standard:
            return {
                boardSize: 19,
                timeLimit: 10,
                byoyomiCount: 3,
                byoyomiTime: 30,
                komi: DEFAULT_KOMI,
            };
        case GameMode.Omok:
            return {
                boardSize: 19,
                has33Forbidden: true,
                hasOverlineForbidden: true,
            };
        case GameMode.Ttamok:
            return {
                boardSize: 19,
                captureTarget: 20,
                has33Forbidden: true,
                hasOverlineForbidden: true,
            };
        case GameMode.Capture:
            return {
                boardSize: 13,
                captureTarget: 10,
            };
        case GameMode.Speed:
            return {
                boardSize: 13,
                timeLimit: 5,
                timeIncrement: 5,
            };
        case GameMode.Base:
            return {
                boardSize: 13,
                baseStones: 4,
                komi: 0.5,
            };
        case GameMode.Hidden:
            return {
                boardSize: 13,
                hiddenStoneCount: 2,
                scanCount: 5,
                komi: DEFAULT_KOMI,
            };
        case GameMode.Missile:
            return {
                boardSize: 13,
                missileCount: 5,
                komi: DEFAULT_KOMI,
            };
        case GameMode.Mix:
            return {
                boardSize: 13,
                mixedModes: [GameMode.Hidden, GameMode.Speed],
                komi: DEFAULT_KOMI,
            };
        case GameMode.Dice:
            return {
                boardSize: 19,
                diceGoRounds: 3,
                oddDiceCount: 1,
                evenDiceCount: 1,
            };
        case GameMode.Thief:
            return {
                boardSize: 13,
            };
        case GameMode.Alkkagi:
            return {
                alkkagiRounds: 1,
                alkkagiPlacementType: AlkkagiPlacementType.TurnByTurn,
                alkkagiLayout: AlkkagiLayoutType.Normal,
                alkkagiStoneCount: 5,
                alkkagiGaugeSpeed: 700,
                alkkagiSlowItemCount: 2,
                alkkagiAimingLineItemCount: 2,
            };
        case GameMode.Curling:
            return {
                curlingRounds: 3,
                curlingStoneCount: 5,
                curlingGaugeSpeed: 700,
                curlingSlowItemCount: 2,
                curlingAimingLineItemCount: 2,
            };
        default:
            return {};
    }
};
export const FISCHER_INCREMENT_SECONDS = 5;
export const TIME_BONUS_SECONDS_PER_POINT = 5;
export const DICE_GO_ITEM_COUNTS = [0, 1, 2, 3];
export const ALKKAGI_ITEM_COUNTS = [0, 1, 2, 3];
export const ALKKAGI_ROUNDS = [1, 2, 3] as const;
export const CURLING_ROUNDS = [1, 2, 3] as const;
export const CURLING_ITEM_COUNTS = [0, 1, 2, 3, 4, 5];

export const AUTO_END_TURN_COUNTS: { [key: string]: number[] } = {
    'small': [40, 50, 60], // <= 9
    'medium': [60, 80, 100], // 11, 13
    'large': [100, 120, 150], // 15, 17
    'full': [150, 200, 250], // 19
};

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  boardSize: 19,
  timeLimit: 10,
  byoyomiCount: 3,
  byoyomiTime: 30,
  baseStones: 4,
  diceGoVariant: DiceGoVariant.Basic,
  diceGoRounds: 3,
  oddDiceCount: 1,
  evenDiceCount: 1,
  captureTarget: 20,
  timeIncrement: 5,
  hiddenStoneCount: 2,
  scanCount: 5,
  missileCount: 5,
  mixedModes: [GameMode.Hidden, GameMode.Speed],
  hasOverlineForbidden: true,
  has33Forbidden: true,
  alkkagiPlacementType: AlkkagiPlacementType.TurnByTurn,
  alkkagiLayout: AlkkagiLayoutType.Normal,
  alkkagiStoneCount: 5,
  alkkagiGaugeSpeed: 700,
  alkkagiSlowItemCount: 2,
  alkkagiAimingLineItemCount: 2,
  alkkagiRounds: 1,
  curlingStoneCount: 5,
  curlingGaugeSpeed: 700,
  curlingSlowItemCount: 2,
  curlingAimingLineItemCount: 2,
  curlingRounds: 3,
  komi: DEFAULT_KOMI,
  player1Color: Player.Black,
  aiDifficulty: 1,
  autoEndTurnCount: 0,
};

// --- Dice Go Settings ---
export const DICE_GO_INITIAL_WHITE_STONES_BY_ROUND = [15, 25, 35];
export const DICE_GO_LAST_CAPTURE_BONUS_BY_TOTAL_ROUNDS = [5, 7, 10];
export const DICE_GO_TURN_ROLL_TIME = 30;
export const DICE_GO_TURN_CHOICE_TIME = 30;
export const DICE_GO_MAIN_ROLL_TIME = 30;
export const DICE_GO_MAIN_PLACE_TIME = 30;
export const DICE_GO_VARIANT_NAMES = {
  [DiceGoVariant.Basic]: '기본 주사위 바둑',
};

// --- Alkkagi Settings ---
export const ALKKAGI_STONE_COUNTS = [3, 5, 7, 9];
export const ALKKAGI_TURN_TIME_LIMIT = 30;
export const ALKKAGI_PLACEMENT_TIME_LIMIT = 30;
export const ALKKAGI_SIMULTANEOUS_PLACEMENT_TIME_LIMIT = 30;
export const ALKKAGI_GAUGE_SPEEDS = [
  { value: 1000, label: 'x1 (느림)' },
  { value: 700, label: 'x2 (보통)' },
  { value: 400, label: 'x3 (빠름)' },
];
export const BATTLE_PLACEMENT_ZONES: { [key in Player.Black | Player.White]: { x: number, y: number, width: number, height: number }[] } = {
    [Player.Black]: [
        { x: 7, y: 4, width: 5, height: 2 },
        { x: 4, y: 7, width: 2, height: 4 },
        { x: 13, y: 7, width: 2, height: 4 },
        { x: 7, y: 13, width: 2, height: 2 },
        { x: 10, y: 13, width: 2, height: 2 },
    ],
    [Player.White]: [
        { x: 4, y: 4, width: 2, height: 2 },
        { x: 13, y: 4, width: 2, height: 2 },
        { x: 7, y: 7, width: 5, height: 2 },
        { x: 7, y: 10, width: 5, height: 2 },
    ],
};
export const PLAYFUL_MODE_FOUL_LIMIT = 5;

// --- Curling Settings ---
export const CURLING_STONE_COUNTS = [3, 5, 7];
export const CURLING_TURN_TIME_LIMIT = 30;
export const CURLING_GAUGE_SPEEDS = [
  { value: 1000, label: 'x1 (느림)' },
  { value: 700, label: 'x2 (보통)' },
  { value: 400, label: 'x3 (빠름)' },
];

// FIX: Add missing AI difficulty maps for NegotiationModal.
export const strategicAiDisplayMap = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const captureAiLevelMap = [1, 3, 5, 7, 9, 11, 13, 15, 17, 18];