import { GameMode } from '../types/index.js';
import type { ActionButton, QuestReward } from '../types/index.js';

// --- Action Point Costs ---
export const STRATEGIC_ACTION_POINT_COST = 5;
export const PLAYFUL_ACTION_POINT_COST = 3;
export const ACTION_POINT_REGEN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// --- Action Point Purchase Costs ---
export const ACTION_POINT_PURCHASE_COSTS_DIAMONDS = [10, 20, 30, 50, 80, 120, 180, 250, 350, 500];
export const MAX_ACTION_POINT_PURCHASES_PER_DAY = 10;
export const ACTION_POINT_PURCHASE_REFILL_AMOUNT = 30;

// --- Action Buttons by Game Phase ---

// STRATEGIC GAMES
export const STRATEGIC_ACTION_BUTTONS_EARLY: ActionButton[] = [
    { name: '안녕하세요', message: '정중하게 인사를 건넵니다.', type: 'manner' },
    { name: '잘 부탁드립니다', message: '좋은 대국을 기대하며 정중히 부탁합니다.', type: 'manner' },
    { name: '자세 바로잡기', message: '자세를 바로잡고 대국에 집중합니다.', type: 'manner' },
    { name: '헛기침하기', message: '헛기침을 하며 목을 가다듬습니다.', type: 'unmannerly' },
    { name: '다리 꼬기', message: '거만하게 다리를 꼬고 상대를 봅니다.', type: 'unmannerly' },
];

export const STRATEGIC_ACTION_BUTTONS_MID: ActionButton[] = [
    { name: '상대의 묘수 인정', message: '상대의 좋은 수를 인정합니다.', type: 'manner' },
    { name: '차분히 생각', message: '차분하게 다음 수를 생각합니다.', type: 'manner' },
    { name: '다리 떨기', message: '다리를 떨기 시작합니다.', type: 'unmannerly' },
    { name: '바둑돌 만지작', message: '바둑돌을 잘그락거리며 소음을 냅니다.', type: 'unmannerly' },
    { name: '흥얼거리기', message: '콧노래를 부르며 흥얼거립니다.', type: 'unmannerly' },
    { name: '문자하기', message: '휴대폰을 꺼내 문자를 보냅니다.', type: 'unmannerly' },
];

export const STRATEGIC_ACTION_BUTTONS_LATE: ActionButton[] = [
    { name: '끝까지 집중', message: '끝까지 최선을 다해 집중합니다.', type: 'manner' },
    { name: '계가 신청?', message: '슬슬 끝내자는 눈치를 줍니다.', type: 'manner' },
    { name: '한숨 쉬기', message: '깊은 한숨을 내쉬며 불만을 표합니다.', type: 'unmannerly' },
    { name: '하품하기', message: '대국이 지겹다는 듯이 하품을 합니다.', type: 'unmannerly' },
    { name: '통화하기', message: '전화를 받으며 대국에 집중하지 않습니다.', type: 'unmannerly' },
];


// PLAYFUL GAMES
export const PLAYFUL_ACTION_BUTTONS_EARLY: ActionButton[] = [
    { name: '손가락 풀기', message: '결전의 시간을 위해 손가락을 풉니다.', type: 'manner' },
    { name: '기원하기', message: '좋은 결과가 있기를 기원합니다.', type: 'manner' },
    { name: '심호흡', message: '크게 심호흡하며 집중력을 높입니다.', type: 'manner' },
    { name: '약올리기', message: '상대를 약올리는 표정을 짓습니다.', type: 'unmannerly' },
];

export const PLAYFUL_ACTION_BUTTONS_MID: ActionButton[] = [
    { name: '응원하기', message: '좋은 승부를 기대하며 응원합니다.', type: 'manner' },
    { name: '책상 쿵!', message: '책상을 쿵! 치며 상대를 놀라게 합니다.', type: 'unmannerly' },
    { name: '입김 불기', message: '주사위/돌에 입김을 불어넣습니다.', type: 'unmannerly' },
    { name: '안타까워하기', message: '자신의 실수를 안타까워합니다.', type: 'unmannerly' },
];

export const PLAYFUL_ACTION_BUTTONS_LATE: ActionButton[] = [
    { name: '거의 다왔다!', message: '승리가 눈 앞에 있다는 듯 미소짓습니다.', type: 'manner' },
    { name: '초조해하기', message: '초조한 듯 손톱을 물어뜯습니다.', type: 'unmannerly' },
    { name: '상대 실수 기원', message: '상대방이 실수하기를 간절히 기도합니다.', type: 'unmannerly' },
];

// --- No Contest Rules ---
export const NO_CONTEST_MOVE_THRESHOLD = 10;
export const NO_CONTEST_TIME_THRESHOLD_SECONDS = 180;
export const NO_CONTEST_MANNER_PENALTY = 20;
export const NO_CONTEST_RANKING_PENALTY = 50;

// Tournament Bot Score Gain
// FIX: Export missing constants.
export const MIN_DAILY_SCORE_GAIN = 0;
export const MAX_DAILY_SCORE_GAIN = 50;