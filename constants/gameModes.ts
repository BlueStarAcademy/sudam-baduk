
import { GameMode } from '../types/index.js';

interface GameModeInfo {
    mode: GameMode;
    slug: string;
    description: string;
    available: boolean;
    image: string;
}

export const SPECIAL_GAME_MODES: ReadonlyArray<GameModeInfo> = [
  { mode: GameMode.Standard, slug: 'standard', description: "전통 규칙의 정통 바둑.", available: true, image: "/images/simbols/simbol1.png" },
  { mode: GameMode.Capture, slug: 'capture', description: "상대 돌을 목표만큼 먼저 따내면 승리.", available: true, image: "/images/simbols/simbol2.png" },
  { mode: GameMode.Speed, slug: 'speed', description: "피셔룰 기반의 속기 대국. 남은 시간은 보너스 집으로!", available: true, image: "/images/simbols/simbol3.png" },
  { mode: GameMode.Base, slug: 'base', description: "비밀 '베이스돌' 배치 후 흑/백 입찰. 전략적 변수 가득!", available: true, image: "/images/simbols/simbol4.png" },
  { mode: GameMode.Hidden, slug: 'hidden', description: "상대에게 보이지 않는 '히든돌'과 '스캔'을 활용한 심리전.", available: true, image: "/images/simbols/simbol5.png" },
  { mode: GameMode.Missile, slug: 'missile', description: "'미사일'로 돌을 직선 이동시켜 판을 흔드는 동적인 바둑.", available: true, image: "/images/simbols/simbol6.png" },
  { mode: GameMode.Mix, slug: 'mix', description: "두 가지 이상의 특수 규칙을 조합하여 즐기는 새로운 바둑.", available: true, image: "/images/simbols/simbol7.png" }
];

export const PLAYFUL_GAME_MODES: ReadonlyArray<GameModeInfo> = [
  { mode: GameMode.Dice, slug: 'dice', description: "주사위를 굴려 나온 수만큼 착수! 백돌을 모두 따내세요.", available: true, image: "/images/simbols/simbolp1.png" },
  { mode: GameMode.Omok, slug: 'omok', description: "가로, 세로, 대각선으로 다섯 알을 먼저 나란히 놓으면 승리.", available: true, image: "/images/simbols/simbolp2.png" },
  { mode: GameMode.Ttamok, slug: 'ttamok', description: "오목 또는 따내기! 두 가지 승리 조건을 모두 노리세요.", available: true, image: "/images/simbols/simbolp3.png" },
  { mode: GameMode.Thief, slug: 'thief', description: "도둑과 경찰이 되어 상대를 속이는 추격전! 점수로 승리!", available: true, image: "/images/simbols/simbolp4.png" },
  { mode: GameMode.Alkkagi, slug: 'alkkagi', description: "바둑돌을 튕겨 상대 돌을 판 밖으로! 짜릿한 손맛 승부.", available: true, image: "/images/simbols/simbolp5.png" },
  { mode: GameMode.Curling, slug: 'curling', description: "바둑판 위의 컬링! 스톤을 목표 지점에 더 가깝게 보내세요.", available: true, image: "/images/simbols/simbolp6.png" }
];

export const ALL_GAME_MODES = [...SPECIAL_GAME_MODES, ...PLAYFUL_GAME_MODES];

export const GAME_MODE_BY_SLUG: Map<string, GameMode> = new Map(
    ALL_GAME_MODES.map(m => [m.slug, m.mode])
);

export const SLUG_BY_GAME_MODE: Map<GameMode, string> = new Map(
    ALL_GAME_MODES.map(m => [m.mode, m.slug])
);