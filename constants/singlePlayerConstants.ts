// @ts-nocheck
import { SinglePlayerLevel } from '../types/enums.js';
import type { GameType } from '../types/enums.js';
import type { SinglePlayerStageInfo, SinglePlayerMissionInfo, QuestReward } from '../types/entities.js';

// Added GO_TERMS_BY_LEVEL constant for use in other components.
export const GO_TERMS_BY_LEVEL: Record<SinglePlayerLevel, { term: string; meaning: string }[]> = {
    [SinglePlayerLevel.입문]: [
        { term: "활로", meaning: "돌이 살아가는 길. 이 길이 모두 막히면 돌은 잡히게 됩니다." },
        { term: "단수", meaning: "활로가 하나만 남은 상태. 다음 차례에 잡힐 수 있는 위험한 상황입니다." },
        { term: "귀, 변, 중앙", meaning: "집을 짓기 좋은 순서는 귀, 변, 중앙 순서입니다." },
        { term: "1선 (사망선)", meaning: "가장자리 첫째 줄. 살기 어려운 죽음의 선입니다." },
        { term: "2선 (패망선)", meaning: "둘째 줄. 집을 지어도 작아 패배하기 쉬운 선입니다." },
        { term: "3선 (실리선)", meaning: "셋째 줄. 집을 짓기에 가장 효율적인 실리의 선입니다." },
        { term: "4선 (세력선)", meaning: "넷째 줄. 중앙을 향한 세력을 쌓기에 좋은 선입니다." },
    ],
    [SinglePlayerLevel.초급]: [
        { term: "축", meaning: "단수 된 돌을 계속해서 몰아 잡는 기술입니다." },
        { term: "장문", meaning: "그물처럼 상대 돌을 가두어 잡는 기술입니다." },
        { term: "환격", meaning: "자신의 돌을 희생하여 상대의 더 큰 돌을 되따내는 기술입니다." },
        { term: "촉촉수", meaning: "상대 돌의 활로를 줄여 단수를 연속으로 쳐서 잡는 기술입니다." },
        { term: "단수 방향", meaning: "상대 돌을 어느 방향으로 몰아가며 단수 칠지 결정하는 중요한 기술입니다." },
    ],
    [SinglePlayerLevel.중급]: [
        { term: "사활", meaning: "돌의 삶과 죽음. 바둑의 가장 기본이 되는 중요한 개념입니다." },
        { term: "수상전", meaning: "서로 끊어진 돌들이 활로를 다투며 어느 한쪽이 잡힐 때까지 싸우는 것입니다." },
        { term: "정석", meaning: "예로부터 지금까지 공격과 수비의 최선이라고 알려진, 정해진 형태의 수순입니다." },
        { term: "포석", meaning: "초반에 집과 세력의 균형을 맞추며 돌을 배치하는 전략입니다." },
        { term: "일립이전", meaning: "한 개의 돌에서 두 칸을 벌리는 행마. 안정적인 발전의 기초입니다." },
        { term: "이립삼전", meaning: "두 개의 돌에서 세 칸을 벌리는 행마. 더욱 발전적인 형태입니다." },
    ],
    [SinglePlayerLevel.고급]: [
        { term: "행마", meaning: "돌을 움직여 모양을 만드는 방법. 바둑의 효율성과 아름다움을 결정합니다." },
        { term: "한칸 뜀", meaning: "가장 안정적이고 기본적인 행마법입니다." },
        { term: "날일자", meaning: "한칸 뜀보다 조금 더 발이 빠르고 효율적인 행마법입니다." },
        { term: "눈목자", meaning: "날일자보다 한 칸 더 멀리 가는 행마로, 속도는 빠르지만 약점이 있습니다." },
        { term: "입구자", meaning: "밭전자 행마와 함께 돌을 튼튼하게 연결하는 행마입니다." },
    ],
    [SinglePlayerLevel.유단자]: [
        { term: "삼삼", meaning: "귀의 3의 3 지점. 실리를 차지하기 위한 현대 바둑의 중요한 착점입니다." },
        { term: "바꿔치기", meaning: "자신의 돌 일부를 내주고 상대의 더 큰 돌이나 집을 얻는 교환입니다." },
        { term: "유가무가 불상전", meaning: "집이 있는 돌과 집이 없는 돌은 수상전이 되지 않는다는 격언입니다." },
        { term: "대궁소궁 불상전", meaning: "수상전에서 궁도(활로의 집 모양)가 큰 쪽이 작은 쪽을 이긴다는 격언입니다." },
        { term: "현현기경", meaning: "'깊고 오묘한 이치를 담은 바둑 문제집'이라는 뜻의 고전 사활 책입니다." },
        { term: "기경중묘", meaning: "'바둑판 위의 기묘한 재주'라는 뜻의 고전 묘수풀이 책입니다." },
    ],
};

export const SINGLE_PLAYER_MISSIONS: SinglePlayerMissionInfo[] = [
    { id: 'mission_attendance', name: '출석하기', description: '바둑학원에 등원하기', unlockStageId: '입문-1', productionRateMinutes: 5, rewardType: 'gold', rewardAmount: 5, maxCapacity: 50, image: '/images/single/Mission1.png' },
    { id: 'mission_complete_game', name: '바둑한판 완성', description: '계가까지 바둑두기', unlockStageId: '입문-20', productionRateMinutes: 5, rewardType: 'gold', rewardAmount: 10, maxCapacity: 150, image: '/images/single/Mission2.png' },
    { id: 'mission_rival_match', name: '맞수와 대국', description: '최선을 다해 승부하기', unlockStageId: '초급-20', productionRateMinutes: 5, rewardType: 'gold', rewardAmount: 20, maxCapacity: 300, image: '/images/single/Mission3.png' },
    { id: 'mission_study_joseki', name: '정석/포석 공부', description: '정석/포석 익히기', unlockStageId: '중급-20', productionRateMinutes: 60, rewardType: 'diamonds', rewardAmount: 1, maxCapacity: 2, image: '/images/single/Mission4.png' },
    { id: 'mission_league', name: '리그전 참가', description: '집중하여 연속 바둑두기', unlockStageId: '고급-20', productionRateMinutes: 5, rewardType: 'gold', rewardAmount: 50, maxCapacity: 500, image: '/images/single/Mission5.png' },
    { id: 'mission_ai_match', name: '인공지능대국', description: '배울점을 끊임없이 찾기', unlockStageId: '유단자-20', productionRateMinutes: 60, rewardType: 'diamonds', rewardAmount: 1, maxCapacity: 3, image: '/images/single/Mission6.png' },
];

export const MISSION_LEVEL_DATA: Record<string, { speed: number; amount: number; capacity: number }[]> = {
    mission_attendance: [
        { speed: 300, amount: 5, capacity: 50 },   // Level 1
        { speed: 300, amount: 5, capacity: 60 },   // Level 2
        { speed: 300, amount: 5, capacity: 70 },   // Level 3
        { speed: 300, amount: 5, capacity: 80 },   // Level 4
        { speed: 300, amount: 5, capacity: 90 },   // Level 5
        { speed: 300, amount: 10, capacity: 100 }, // Level 6
        { speed: 270, amount: 10, capacity: 110 }, // Level 7 (4m 30s)
        { speed: 240, amount: 10, capacity: 120 }, // Level 8 (4m)
        { speed: 210, amount: 10, capacity: 130 }, // Level 9 (3m 30s)
        { speed: 180, amount: 10, capacity: 150 }, // Level 10 (3m)
    ],
    mission_complete_game: [
        { speed: 300, amount: 10, capacity: 150 }, // L1
        { speed: 300, amount: 10, capacity: 160 }, // L2
        { speed: 300, amount: 10, capacity: 170 }, // L3
        { speed: 300, amount: 10, capacity: 180 }, // L4
        { speed: 300, amount: 10, capacity: 200 }, // L5
        { speed: 300, amount: 20, capacity: 220 }, // L6
        { speed: 270, amount: 20, capacity: 240 }, // L7
        { speed: 240, amount: 20, capacity: 260 }, // L8
        { speed: 210, amount: 20, capacity: 280 }, // L9
        { speed: 180, amount: 20, capacity: 300 }, // L10
    ],
    mission_rival_match: [
        { speed: 300, amount: 20, capacity: 300 }, // L1
        { speed: 300, amount: 20, capacity: 340 }, // L2
        { speed: 300, amount: 20, capacity: 380 }, // L3
        { speed: 300, amount: 20, capacity: 420 }, // L4
        { speed: 300, amount: 20, capacity: 460 }, // L5
        { speed: 300, amount: 20, capacity: 500 }, // L6
        { speed: 270, amount: 30, capacity: 540 }, // L7
        { speed: 240, amount: 30, capacity: 600 }, // L8
        { speed: 210, amount: 30, capacity: 660 }, // L9
        { speed: 180, amount: 30, capacity: 750 }, // L10
    ],
    mission_study_joseki: [
        { speed: 3600, amount: 1, capacity: 2 },  // L1 (60 min)
        { speed: 3480, amount: 1, capacity: 2 },  // L2 (58 min)
        { speed: 3360, amount: 1, capacity: 2 },  // L3 (56 min)
        { speed: 3240, amount: 1, capacity: 2 },  // L4 (54 min)
        { speed: 3120, amount: 1, capacity: 3 },  // L5 (52 min)
        { speed: 3000, amount: 1, capacity: 3 },  // L6 (50 min)
        { speed: 2820, amount: 1, capacity: 3 },  // L7 (47 min)
        { speed: 2640, amount: 1, capacity: 3 },  // L8 (44 min)
        { speed: 2460, amount: 1, capacity: 3 },  // L9 (41 min)
        { speed: 2100, amount: 1, capacity: 4 },  // L10 (35 min)
    ],
    mission_league: [
        { speed: 300, amount: 50, capacity: 500 }, // L1
        { speed: 300, amount: 50, capacity: 550 }, // L2
        { speed: 300, amount: 50, capacity: 600 }, // L3
        { speed: 300, amount: 50, capacity: 650 }, // L4
        { speed: 300, amount: 50, capacity: 700 }, // L5
        { speed: 300, amount: 50, capacity: 750 }, // L6
        { speed: 270, amount: 50, capacity: 800 }, // L7
        { speed: 240, amount: 50, capacity: 850 }, // L8
        { speed: 210, amount: 100, capacity: 900 },// L9
        { speed: 180, amount: 100, capacity: 1000 },// L10
    ],
    mission_ai_match: [
        { speed: 3600, amount: 1, capacity: 3 },  // L1 (60 min)
        { speed: 3480, amount: 1, capacity: 3 },  // L2 (58 min)
        { speed: 3360, amount: 1, capacity: 3 },  // L3 (56 min)
        { speed: 3240, amount: 1, capacity: 3 },  // L4 (54 min)
        { speed: 3120, amount: 1, capacity: 4 },  // L5 (52 min)
        { speed: 3000, amount: 1, capacity: 4 },  // L6 (50 min)
        { speed: 2820, amount: 1, capacity: 4 },  // L7 (47 min)
        { speed: 2640, amount: 1, capacity: 4 },  // L8 (44 min)
        { speed: 2460, amount: 1, capacity: 4 },  // L9 (41 min)
        { speed: 2100, amount: 1, capacity: 5 },  // L10 (35 min)
    ],
};

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

const byoyomiTimeControl = { type: 'byoyomi', mainTime: 3, byoyomiTime: 30, byoyomiCount: 3 };
const fischerTimeControl = { type: 'fischer', mainTime: 3, increment: 5 };

export const SINGLE_PLAYER_STAGES: SinglePlayerStageInfo[] = [
    // 입문 1-20
    { id: '입문-1', name: '스테이지 1', level: SinglePlayerLevel.입문, gameType: 'capture', actionPointCost: 2, boardSize: 7, targetScore: { black: 5, white: 5 }, katagoLevel: 1, blackStoneLimit: 15, placements: { black: 2, white: 3, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 100, exp: { type: 'strategy', amount: 20 } }, repeatClear: { gold: 10, exp: { type: 'strategy', amount: 10 } } } },
    { id: '입문-2', name: '스테이지 2', level: SinglePlayerLevel.입문, gameType: 'capture', actionPointCost: 2, boardSize: 7, targetScore: { black: 5, white: 5 }, katagoLevel: 1, blackStoneLimit: 15, placements: { black: 2, white: 3, blackPattern: 0, whitePattern: 1 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 100, exp: { type: 'strategy', amount: 20 } }, repeatClear: { gold: 10, exp: { type: 'strategy', amount: 10 } } } },
    { id: '입문-3', name: '스테이지 3', level: SinglePlayerLevel.입문, gameType: 'capture', actionPointCost: 2, boardSize: 7, targetScore: { black: 5, white: 5 }, katagoLevel: 1, blackStoneLimit: 15, placements: { black: 2, white: 3, blackPattern: 1, whitePattern: 1 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 100, exp: { type: 'strategy', amount: 20 } }, repeatClear: { gold: 10, exp: { type: 'strategy', amount: 10 } } } },
    { id: '입문-4', name: '스테이지 4', level: SinglePlayerLevel.입문, gameType: 'capture', actionPointCost: 2, boardSize: 7, targetScore: { black: 5, white: 5 }, katagoLevel: 1, blackStoneLimit: 15, placements: { black: 2, white: 4, blackPattern: 2, whitePattern: 1 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 100, exp: { type: 'strategy', amount: 20 } }, repeatClear: { gold: 10, exp: { type: 'strategy', amount: 10 } } } },
    { id: '입문-5', name: '스테이지 5', level: SinglePlayerLevel.입문, gameType: 'capture', actionPointCost: 2, boardSize: 7, targetScore: { black: 6, white: 5 }, katagoLevel: 2, blackStoneLimit: 15, placements: { black: 2, white: 5, blackPattern: 2, whitePattern: 1 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { ...parseReward('골드꾸러미1'), exp: { type: 'strategy', amount: 30 } }, repeatClear: { gold: 10, exp: { type: 'strategy', amount: 10 } } } },
    { id: '입문-6', name: '스테이지 6', level: SinglePlayerLevel.입문, gameType: 'capture', actionPointCost: 2, boardSize: 7, targetScore: { black: 6, white: 5 }, katagoLevel: 2, blackStoneLimit: 15, placements: { black: 3, white: 7, blackPattern: 2, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 100, exp: { type: 'strategy', amount: 20 } }, repeatClear: { gold: 10, exp: { type: 'strategy', amount: 10 } } } },
    { id: '입문-7', name: '스테이지 7', level: SinglePlayerLevel.입문, gameType: 'capture', actionPointCost: 2, boardSize: 7, targetScore: { black: 6, white: 5 }, katagoLevel: 2, blackStoneLimit: 15, placements: { black: 3, white: 6, blackPattern: 2, whitePattern: 2 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 100, exp: { type: 'strategy', amount: 20 } }, repeatClear: { gold: 10, exp: { type: 'strategy', amount: 10 } } } },
    { id: '입문-8', name: '스테이지 8', level: SinglePlayerLevel.입문, gameType: 'capture', actionPointCost: 2, boardSize: 7, targetScore: { black: 6, white: 5 }, katagoLevel: 2, blackStoneLimit: 15, placements: { black: 3, white: 7, blackPattern: 3, whitePattern: 2 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 100, exp: { type: 'strategy', amount: 20 } }, repeatClear: { gold: 10, exp: { type: 'strategy', amount: 10 } } } },
    { id: '입문-9', name: '스테이지 9', level: SinglePlayerLevel.입문, gameType: 'capture', actionPointCost: 2, boardSize: 7, targetScore: { black: 6, white: 5 }, katagoLevel: 2, blackStoneLimit: 15, placements: { black: 3, white: 6, blackPattern: 3, whitePattern: 3 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 100, exp: { type: 'strategy', amount: 20 } }, repeatClear: { gold: 10, exp: { type: 'strategy', amount: 10 } } } },
    { id: '입문-10', name: '스테이지 10', level: SinglePlayerLevel.입문, gameType: 'capture', actionPointCost: 2, boardSize: 7, targetScore: { black: 7, white: 5 }, katagoLevel: 3, blackStoneLimit: 15, placements: { black: 4, white: 7, blackPattern: 2, whitePattern: 3 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { ...parseReward('장비상자1'), exp: { type: 'strategy', amount: 100 } }, repeatClear: { gold: 15, exp: { type: 'strategy', amount: 10 } } } },
    { id: '입문-11', name: '스테이지 11', level: SinglePlayerLevel.입문, gameType: 'survival', actionPointCost: 2, boardSize: 9, targetScore: { black: 999, white: 5 }, whiteStoneLimit: 15, katagoLevel: 1, placements: { black: 3, white: 13, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 150, exp: { type: 'strategy', amount: 20 } }, repeatClear: { gold: 10, exp: { type: 'strategy', amount: 10 } } } },
    { id: '입문-12', name: '스테이지 12', level: SinglePlayerLevel.입문, gameType: 'survival', actionPointCost: 2, boardSize: 9, targetScore: { black: 999, white: 5 }, whiteStoneLimit: 15, katagoLevel: 1, placements: { black: 4, white: 14, blackPattern: 0, whitePattern: 1 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 150, exp: { type: 'strategy', amount: 20 } }, repeatClear: { gold: 10, exp: { type: 'strategy', amount: 10 } } } },
    { id: '입문-13', name: '스테이지 13', level: SinglePlayerLevel.입문, gameType: 'survival', actionPointCost: 2, boardSize: 9, targetScore: { black: 999, white: 5 }, whiteStoneLimit: 15, katagoLevel: 1, placements: { black: 5, white: 15, blackPattern: 1, whitePattern: 1 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 150, exp: { type: 'strategy', amount: 20 } }, repeatClear: { gold: 10, exp: { type: 'strategy', amount: 10 } } } },
    { id: '입문-14', name: '스테이지 14', level: SinglePlayerLevel.입문, gameType: 'survival', actionPointCost: 2, boardSize: 9, targetScore: { black: 999, white: 5 }, whiteStoneLimit: 15, katagoLevel: 1, placements: { black: 4, white: 15, blackPattern: 2, whitePattern: 1 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 150, exp: { type: 'strategy', amount: 20 } }, repeatClear: { gold: 10, exp: { type: 'strategy', amount: 10 } } } },
    { id: '입문-15', name: '스테이지 15', level: SinglePlayerLevel.입문, gameType: 'survival', actionPointCost: 2, boardSize: 9, targetScore: { black: 999, white: 5 }, whiteStoneLimit: 15, katagoLevel: 2, placements: { black: 3, white: 14, blackPattern: 2, whitePattern: 1 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { ...parseReward('재료상자1'), exp: { type: 'strategy', amount: 20 } }, repeatClear: { gold: 10, exp: { type: 'strategy', amount: 10 } } } },
    { id: '입문-16', name: '스테이지 16', level: SinglePlayerLevel.입문, gameType: 'survival', actionPointCost: 2, boardSize: 9, targetScore: { black: 999, white: 5 }, whiteStoneLimit: 16, katagoLevel: 2, placements: { black: 2, white: 13, blackPattern: 2, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 150, exp: { type: 'strategy', amount: 30 } }, repeatClear: { gold: 15, exp: { type: 'strategy', amount: 10 } } } },
    { id: '입문-17', name: '스테이지 17', level: SinglePlayerLevel.입문, gameType: 'survival', actionPointCost: 2, boardSize: 9, targetScore: { black: 999, white: 5 }, whiteStoneLimit: 17, katagoLevel: 2, placements: { black: 3, white: 15, blackPattern: 2, whitePattern: 2 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 150, exp: { type: 'strategy', amount: 30 } }, repeatClear: { gold: 15, exp: { type: 'strategy', amount: 10 } } } },
    { id: '입문-18', name: '스테이지 18', level: SinglePlayerLevel.입문, gameType: 'survival', actionPointCost: 2, boardSize: 9, targetScore: { black: 999, white: 5 }, whiteStoneLimit: 18, katagoLevel: 2, placements: { black: 4, white: 16, blackPattern: 3, whitePattern: 2 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 150, exp: { type: 'strategy', amount: 30 } }, repeatClear: { gold: 15, exp: { type: 'strategy', amount: 10 } } } },
    { id: '입문-19', name: '스테이지 19', level: SinglePlayerLevel.입문, gameType: 'survival', actionPointCost: 2, boardSize: 9, targetScore: { black: 999, white: 5 }, whiteStoneLimit: 19, katagoLevel: 2, placements: { black: 5, white: 17, blackPattern: 3, whitePattern: 3 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 150, exp: { type: 'strategy', amount: 30 } }, repeatClear: { gold: 15, exp: { type: 'strategy', amount: 10 } } } },
    { id: '입문-20', name: '스테이지 20', level: SinglePlayerLevel.입문, gameType: 'survival', actionPointCost: 2, boardSize: 9, targetScore: { black: 999, white: 5 }, whiteStoneLimit: 20, katagoLevel: 3, placements: { black: 5, white: 18, blackPattern: 2, whitePattern: 3 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { ...parseReward('다이아꾸러미1'), exp: { type: 'strategy', amount: 30 } }, repeatClear: { gold: 15, exp: { type: 'strategy', amount: 10 } } } },
    
    // 초급 1-20
    { id: '초급-1', name: '스테이지 1', level: SinglePlayerLevel.초급, gameType: 'speed', actionPointCost: 3, boardSize: 9, katagoLevel: 4, autoEndTurnCount: 40, placements: { black: 4, white: 6, blackPattern: 0, whitePattern: 0 }, timeControl: fischerTimeControl, rewards: { firstClear: { gold: 200, exp: { type: 'strategy', amount: 30 } }, repeatClear: { gold: 30, exp: { type: 'strategy', amount: 20 } } } },
    { id: '초급-2', name: '스테이지 2', level: SinglePlayerLevel.초급, gameType: 'speed', actionPointCost: 3, boardSize: 9, katagoLevel: 4, autoEndTurnCount: 40, placements: { black: 5, white: 8, blackPattern: 0, whitePattern: 0 }, timeControl: fischerTimeControl, rewards: { firstClear: { gold: 200, exp: { type: 'strategy', amount: 30 } }, repeatClear: { gold: 30, exp: { type: 'strategy', amount: 20 } } } },
    { id: '초급-3', name: '스테이지 3', level: SinglePlayerLevel.초급, gameType: 'speed', actionPointCost: 3, boardSize: 9, katagoLevel: 4, autoEndTurnCount: 40, placements: { black: 6, white: 9, blackPattern: 0, whitePattern: 0 }, timeControl: fischerTimeControl, rewards: { firstClear: { gold: 200, exp: { type: 'strategy', amount: 30 } }, repeatClear: { gold: 30, exp: { type: 'strategy', amount: 20 } } } },
    { id: '초급-4', name: '스테이지 4', level: SinglePlayerLevel.초급, gameType: 'speed', actionPointCost: 3, boardSize: 9, katagoLevel: 4, autoEndTurnCount: 40, placements: { black: 7, white: 10, blackPattern: 0, whitePattern: 0 }, timeControl: fischerTimeControl, rewards: { firstClear: { gold: 200, exp: { type: 'strategy', amount: 30 } }, repeatClear: { gold: 30, exp: { type: 'strategy', amount: 20 } } } },
    { id: '초급-5', name: '스테이지 5', level: SinglePlayerLevel.초급, gameType: 'speed', actionPointCost: 3, boardSize: 9, katagoLevel: 4, autoEndTurnCount: 40, placements: { black: 8, white: 12, blackPattern: 0, whitePattern: 0 }, timeControl: fischerTimeControl, rewards: { firstClear: { ...parseReward('골드꾸러미2'), exp: { type: 'strategy', amount: 50 } }, repeatClear: { gold: 30, exp: { type: 'strategy', amount: 20 } } } },
    { id: '초급-6', name: '스테이지 6', level: SinglePlayerLevel.초급, gameType: 'speed', actionPointCost: 3, boardSize: 9, katagoLevel: 5, autoEndTurnCount: 40, placements: { black: 9, white: 12, blackPattern: 0, whitePattern: 0 }, timeControl: fischerTimeControl, rewards: { firstClear: { gold: 200, exp: { type: 'strategy', amount: 40 } }, repeatClear: { gold: 30, exp: { type: 'strategy', amount: 20 } } } },
    { id: '초급-7', name: '스테이지 7', level: SinglePlayerLevel.초급, gameType: 'speed', actionPointCost: 3, boardSize: 9, katagoLevel: 5, autoEndTurnCount: 40, placements: { black: 8, white: 11, blackPattern: 0, whitePattern: 0 }, timeControl: fischerTimeControl, rewards: { firstClear: { gold: 200, exp: { type: 'strategy', amount: 40 } }, repeatClear: { gold: 30, exp: { type: 'strategy', amount: 20 } } } },
    { id: '초급-8', name: '스테이지 8', level: SinglePlayerLevel.초급, gameType: 'speed', actionPointCost: 3, boardSize: 9, katagoLevel: 5, autoEndTurnCount: 40, placements: { black: 7, wStones: 10, blackPattern: 0, whitePattern: 0 }, timeControl: fischerTimeControl, rewards: { firstClear: { gold: 200, exp: { type: 'strategy', amount: 40 } }, repeatClear: { gold: 30, exp: { type: 'strategy', amount: 20 } } } },
    { id: '초급-9', name: '스테이지 9', level: SinglePlayerLevel.초급, gameType: 'speed', actionPointCost: 3, boardSize: 9, katagoLevel: 5, autoEndTurnCount: 40, placements: { black: 5, wStones: 8, blackPattern: 0, whitePattern: 0 }, timeControl: fischerTimeControl, rewards: { firstClear: { gold: 200, exp: { type: 'strategy', amount: 40 } }, repeatClear: { gold: 30, exp: { type: 'strategy', amount: 20 } } } },
    { id: '초급-10', name: '스테이지 10', level: SinglePlayerLevel.초급, gameType: 'speed', actionPointCost: 3, boardSize: 9, katagoLevel: 5, autoEndTurnCount: 40, placements: { black: 3, wStones: 7, blackPattern: 0, whitePattern: 0 }, timeControl: fischerTimeControl, rewards: { firstClear: { ...parseReward('장비상자2'), exp: { type: 'strategy', amount: 100 } }, repeatClear: { gold: 30, exp: { type: 'strategy', amount: 20 } } } },
    { id: '초급-11', name: '스테이지 11', level: SinglePlayerLevel.초급, gameType: 'speed', actionPointCost: 3, boardSize: 9, katagoLevel: 5, autoEndTurnCount: 40, placements: { black: 4, wStones: 8, blackPattern: 0, whitePattern: 0 }, timeControl: fischerTimeControl, rewards: { firstClear: { gold: 250, exp: { type: 'strategy', amount: 50 } }, repeatClear: { gold: 30, exp: { type: 'strategy', amount: 20 } } } },
    { id: '초급-12', name: '스테이지 12', level: SinglePlayerLevel.초급, gameType: 'speed', actionPointCost: 3, boardSize: 9, katagoLevel: 5, autoEndTurnCount: 40, placements: { black: 5, wStones: 9, blackPattern: 0, whitePattern: 0 }, timeControl: fischerTimeControl, rewards: { firstClear: { gold: 250, exp: { type: 'strategy', amount: 50 } }, repeatClear: { gold: 30, exp: { type: 'strategy', amount: 20 } } } },
    { id: '초급-13', name: '스테이지 13', level: SinglePlayerLevel.초급, gameType: 'speed', actionPointCost: 3, boardSize: 9, katagoLevel: 5, autoEndTurnCount: 40, placements: { black: 4, wStones: 8, blackPattern: 0, whitePattern: 0 }, timeControl: fischerTimeControl, rewards: { firstClear: { gold: 250, exp: { type: 'strategy', amount: 50 } }, repeatClear: { gold: 30, exp: { type: 'strategy', amount: 20 } } } },
    { id: '초급-14', name: '스테이지 14', level: SinglePlayerLevel.초급, gameType: 'speed', actionPointCost: 3, boardSize: 9, katagoLevel: 5, autoEndTurnCount: 40, placements: { black: 4, wStones: 10, blackPattern: 0, whitePattern: 0 }, timeControl: fischerTimeControl, rewards: { firstClear: { gold: 250, exp: { type: 'strategy', amount: 50 } }, repeatClear: { gold: 30, exp: { type: 'strategy', amount: 20 } } } },
    { id: '초급-15', name: '스테이지 15', level: SinglePlayerLevel.초급, gameType: 'speed', actionPointCost: 3, boardSize: 9, katagoLevel: 5, autoEndTurnCount: 40, placements: { black: 4, wStones: 10, blackPattern: 0, whitePattern: 0 }, timeControl: fischerTimeControl, rewards: { firstClear: { ...parseReward('재료상자2'), exp: { type: 'strategy', amount: 100 } }, repeatClear: { gold: 30, exp: { type: 'strategy', amount: 20 } } } },
    { id: '초급-16', name: '스테이지 16', level: SinglePlayerLevel.초급, gameType: 'speed', actionPointCost: 3, boardSize: 9, katagoLevel: 5, autoEndTurnCount: 40, placements: { black: 4, wStones: 9, blackPattern: 0, whitePattern: 0 }, timeControl: fischerTimeControl, rewards: { firstClear: { gold: 250, exp: { type: 'strategy', amount: 60 } }, repeatClear: { gold: 30, exp: { type: 'strategy', amount: 20 } } } },
    { id: '초급-17', name: '스테이지 17', level: SinglePlayerLevel.초급, gameType: 'speed', actionPointCost: 3, boardSize: 9, katagoLevel: 5, autoEndTurnCount: 40, placements: { black: 4, wStones: 9, blackPattern: 0, whitePattern: 0 }, timeControl: fischerTimeControl, rewards: { firstClear: { gold: 250, exp: { type: 'strategy', amount: 60 } }, repeatClear: { gold: 30, exp: { type: 'strategy', amount: 20 } } } },
    { id: '초급-18', name: '스테이지 18', level: SinglePlayerLevel.초급, gameType: 'speed', actionPointCost: 3, boardSize: 9, katagoLevel: 5, autoEndTurnCount: 40, placements: { black: 5, wStones: 10, blackPattern: 0, whitePattern: 0 }, timeControl: fischerTimeControl, rewards: { firstClear: { gold: 250, exp: { type: 'strategy', amount: 60 } }, repeatClear: { gold: 30, exp: { type: 'strategy', amount: 20 } } } },
    { id: '초급-19', name: '스테이지 19', level: SinglePlayerLevel.초급, gameType: 'speed', actionPointCost: 3, boardSize: 9, katagoLevel: 5, autoEndTurnCount: 40, placements: { black: 4, wStones: 9, blackPattern: 0, whitePattern: 0 }, timeControl: fischerTimeControl, rewards: { firstClear: { gold: 250, exp: { type: 'strategy', amount: 60 } }, repeatClear: { gold: 30, exp: { type: 'strategy', amount: 20 } } } },
    { id: '초급-20', name: '스테이지 20', level: SinglePlayerLevel.초급, gameType: 'speed', actionPointCost: 3, boardSize: 9, katagoLevel: 5, autoEndTurnCount: 40, placements: { black: 5, wStones: 12, blackPattern: 0, whitePattern: 0 }, timeControl: fischerTimeControl, rewards: { firstClear: { ...parseReward('다이아꾸러미2'), exp: { type: 'strategy', amount: 150 } }, repeatClear: { gold: 40, exp: { type: 'strategy', amount: 20 } } } },

    // 중급 1-20
    { id: '중급-1', name: '스테이지 1', level: SinglePlayerLevel.중급, gameType: 'missile', actionPointCost: 4, boardSize: 11, missileCount: 3, katagoLevel: 6, autoEndTurnCount: 60, placements: { black: 4, white: 7, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 300, exp: { type: 'strategy', amount: 100 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 30 } } } },
    { id: '중급-2', name: '스테이지 2', level: SinglePlayerLevel.중급, gameType: 'missile', actionPointCost: 4, boardSize: 11, missileCount: 3, katagoLevel: 6, autoEndTurnCount: 60, placements: { black: 5, white: 9, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 300, exp: { type: 'strategy', amount: 100 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 30 } } } },
    { id: '중급-3', name: '스테이지 3', level: SinglePlayerLevel.중급, gameType: 'missile', actionPointCost: 4, boardSize: 11, missileCount: 3, katagoLevel: 6, autoEndTurnCount: 60, placements: { black: 6, white: 10, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 300, exp: { type: 'strategy', amount: 100 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 30 } } } },
    { id: '중급-4', name: '스테이지 4', level: SinglePlayerLevel.중급, gameType: 'missile', actionPointCost: 4, boardSize: 11, missileCount: 3, katagoLevel: 6, autoEndTurnCount: 60, placements: { black: 6, white: 11, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 300, exp: { type: 'strategy', amount: 100 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 30 } } } },
    { id: '중급-5', name: '스테이지 5', level: SinglePlayerLevel.중급, gameType: 'missile', actionPointCost: 4, boardSize: 11, missileCount: 3, katagoLevel: 6, autoEndTurnCount: 60, placements: { black: 8, white: 13, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { ...parseReward('골드꾸러미3'), exp: { type: 'strategy', amount: 150 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 30 } } } },
    { id: '중급-6', name: '스테이지 6', level: SinglePlayerLevel.중급, gameType: 'missile', actionPointCost: 4, boardSize: 11, missileCount: 3, katagoLevel: 6, autoEndTurnCount: 60, placements: { black: 9, white: 13, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 300, exp: { type: 'strategy', amount: 100 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 30 } } } },
    { id: '중급-7', name: '스테이지 7', level: SinglePlayerLevel.중급, gameType: 'missile', actionPointCost: 4, boardSize: 11, missileCount: 3, katagoLevel: 6, autoEndTurnCount: 60, placements: { black: 8, white: 12, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 300, exp: { type: 'strategy', amount: 100 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 30 } } } },
    { id: '중급-8', name: '스테이지 8', level: SinglePlayerLevel.중급, gameType: 'missile', actionPointCost: 4, boardSize: 11, missileCount: 3, katagoLevel: 6, autoEndTurnCount: 60, placements: { black: 7, white: 11, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 300, exp: { type: 'strategy', amount: 100 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 30 } } } },
    { id: '중급-9', name: '스테이지 9', level: SinglePlayerLevel.중급, gameType: 'missile', actionPointCost: 4, boardSize: 11, missileCount: 3, katagoLevel: 6, autoEndTurnCount: 60, placements: { black: 5, white: 9, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 300, exp: { type: 'strategy', amount: 100 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 30 } } } },
    { id: '중급-10', name: '스테이지 10', level: SinglePlayerLevel.중급, gameType: 'missile', actionPointCost: 4, boardSize: 11, missileCount: 2, katagoLevel: 6, autoEndTurnCount: 60, placements: { black: 3, white: 8, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { ...parseReward('장비상자3'), exp: { type: 'strategy', amount: 200 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 50 } } } },
    { id: '중급-11', name: '스테이지 11', level: SinglePlayerLevel.중급, gameType: 'missile', actionPointCost: 4, boardSize: 11, missileCount: 2, katagoLevel: 7, autoEndTurnCount: 60, placements: { black: 4, white: 9, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 400, exp: { type: 'strategy', amount: 150 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 30 } } } },
    { id: '중급-12', name: '스테이지 12', level: SinglePlayerLevel.중급, gameType: 'missile', actionPointCost: 4, boardSize: 11, missileCount: 2, katagoLevel: 7, autoEndTurnCount: 60, placements: { black: 5, white: 10, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 400, exp: { type: 'strategy', amount: 150 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 30 } } } },
    { id: '중급-13', name: '스테이지 13', level: SinglePlayerLevel.중급, gameType: 'missile', actionPointCost: 4, boardSize: 11, missileCount: 2, katagoLevel: 7, autoEndTurnCount: 60, placements: { black: 4, white: 9, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 400, exp: { type: 'strategy', amount: 150 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 30 } } } },
    { id: '중급-14', name: '스테이지 14', level: SinglePlayerLevel.중급, gameType: 'missile', actionPointCost: 4, boardSize: 11, missileCount: 2, katagoLevel: 7, autoEndTurnCount: 60, placements: { black: 4, white: 11, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 400, exp: { type: 'strategy', amount: 150 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 30 } } } },
    { id: '중급-15', name: '스테이지 15', level: SinglePlayerLevel.중급, gameType: 'missile', actionPointCost: 4, boardSize: 11, missileCount: 2, katagoLevel: 7, autoEndTurnCount: 60, placements: { black: 4, white: 11, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { ...parseReward('재료상자3'), exp: { type: 'strategy', amount: 200 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 30 } } } },
    { id: '중급-16', name: '스테이지 16', level: SinglePlayerLevel.중급, gameType: 'missile', actionPointCost: 4, boardSize: 11, missileCount: 2, katagoLevel: 7, autoEndTurnCount: 60, placements: { black: 4, white: 10, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 400, exp: { type: 'strategy', amount: 150 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 30 } } } },
    { id: '중급-17', name: '스테이지 17', level: SinglePlayerLevel.중급, gameType: 'missile', actionPointCost: 4, boardSize: 11, missileCount: 2, katagoLevel: 7, autoEndTurnCount: 60, placements: { black: 4, white: 10, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 400, exp: { type: 'strategy', amount: 150 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 30 } } } },
    { id: '중급-18', name: '스테이지 18', level: SinglePlayerLevel.중급, gameType: 'missile', actionPointCost: 4, boardSize: 11, missileCount: 2, katagoLevel: 7, autoEndTurnCount: 60, placements: { black: 5, white: 11, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 400, exp: { type: 'strategy', amount: 150 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 30 } } } },
    { id: '중급-19', name: '스테이지 19', level: SinglePlayerLevel.중급, gameType: 'missile', actionPointCost: 4, boardSize: 11, missileCount: 1, katagoLevel: 7, autoEndTurnCount: 60, placements: { black: 5, wStones: 13, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 400, exp: { type: 'strategy', amount: 150 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 30 } } } },
    { id: '중급-20', name: '스테이지 20', level: SinglePlayerLevel.중급, gameType: 'missile', actionPointCost: 4, boardSize: 11, missileCount: 1, katagoLevel: 7, autoEndTurnCount: 60, placements: { black: 5, wStones: 13, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { ...parseReward('다이아꾸러미3'), exp: { type: 'strategy', amount: 250 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 50 } } } },
    
    // 고급 1-20
    { id: '고급-1', name: '스테이지 1', level: SinglePlayerLevel.고급, gameType: 'hidden', actionPointCost: 5, boardSize: 13, hiddenStoneCount: 1, scanCount: 5, katagoLevel: 8, autoEndTurnCount: 80, placements: { black: 4, white: 8, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 500, exp: { type: 'strategy', amount: 200 } }, repeatClear: { gold: 100, exp: { type: 'strategy', amount: 40 } } } },
    { id: '고급-2', name: '스테이지 2', level: SinglePlayerLevel.고급, gameType: 'hidden', actionPointCost: 5, boardSize: 13, hiddenStoneCount: 1, scanCount: 5, katagoLevel: 8, autoEndTurnCount: 80, placements: { black: 5, white: 10, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 500, exp: { type: 'strategy', amount: 200 } }, repeatClear: { gold: 100, exp: { type: 'strategy', amount: 40 } } } },
    { id: '고급-3', name: '스테이지 3', level: SinglePlayerLevel.고급, gameType: 'hidden', actionPointCost: 5, boardSize: 13, hiddenStoneCount: 1, scanCount: 5, katagoLevel: 8, autoEndTurnCount: 80, placements: { black: 6, white: 11, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 500, exp: { type: 'strategy', amount: 200 } }, repeatClear: { gold: 100, exp: { type: 'strategy', amount: 40 } } } },
    { id: '고급-4', name: '스테이지 4', level: SinglePlayerLevel.고급, gameType: 'hidden', actionPointCost: 5, boardSize: 13, hiddenStoneCount: 1, scanCount: 5, katagoLevel: 8, autoEndTurnCount: 80, placements: { black: 7, white: 12, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 500, exp: { type: 'strategy', amount: 200 } }, repeatClear: { gold: 100, exp: { type: 'strategy', amount: 40 } } } },
    { id: '고급-5', name: '스테이지 5', level: SinglePlayerLevel.고급, gameType: 'hidden', actionPointCost: 5, boardSize: 13, hiddenStoneCount: 1, scanCount: 5, katagoLevel: 8, autoEndTurnCount: 80, placements: { black: 8, white: 14, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { ...parseReward('골드꾸러미4'), exp: { type: 'strategy', amount: 250 } }, repeatClear: { gold: 100, exp: { type: 'strategy', amount: 40 } } } },
    { id: '고급-6', name: '스테이지 6', level: SinglePlayerLevel.고급, gameType: 'hidden', actionPointCost: 5, boardSize: 13, hiddenStoneCount: 1, scanCount: 5, katagoLevel: 8, autoEndTurnCount: 80, placements: { black: 9, white: 14, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 500, exp: { type: 'strategy', amount: 200 } }, repeatClear: { gold: 100, exp: { type: 'strategy', amount: 40 } } } },
    { id: '고급-7', name: '스테이지 7', level: SinglePlayerLevel.고급, gameType: 'hidden', actionPointCost: 5, boardSize: 13, hiddenStoneCount: 1, scanCount: 5, katagoLevel: 8, autoEndTurnCount: 80, placements: { black: 8, white: 13, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 500, exp: { type: 'strategy', amount: 200 } }, repeatClear: { gold: 100, exp: { type: 'strategy', amount: 40 } } } },
    { id: '고급-8', name: '스테이지 8', level: SinglePlayerLevel.고급, gameType: 'hidden', actionPointCost: 5, boardSize: 13, hiddenStoneCount: 1, scanCount: 5, katagoLevel: 8, autoEndTurnCount: 80, placements: { black: 7, white: 12, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 500, exp: { type: 'strategy', amount: 200 } }, repeatClear: { gold: 100, exp: { type: 'strategy', amount: 40 } } } },
    { id: '고급-9', name: '스테이지 9', level: SinglePlayerLevel.고급, gameType: 'hidden', actionPointCost: 5, boardSize: 13, hiddenStoneCount: 1, scanCount: 5, katagoLevel: 8, autoEndTurnCount: 80, placements: { black: 5, white: 10, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 500, exp: { type: 'strategy', amount: 200 } }, repeatClear: { gold: 100, exp: { type: 'strategy', amount: 40 } } } },
    { id: '고급-10', name: '스테이지 10', level: SinglePlayerLevel.고급, gameType: 'hidden', actionPointCost: 5, boardSize: 13, hiddenStoneCount: 1, scanCount: 5, katagoLevel: 8, autoEndTurnCount: 80, placements: { black: 3, white: 9, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { ...parseReward('장비상자4'), exp: { type: 'strategy', amount: 300 } }, repeatClear: { gold: 100, exp: { type: 'strategy', amount: 70 } } } },
    { id: '고급-11', name: '스테이지 11', level: SinglePlayerLevel.고급, gameType: 'hidden', actionPointCost: 5, boardSize: 13, hiddenStoneCount: 1, scanCount: 5, katagoLevel: 9, autoEndTurnCount: 80, placements: { black: 4, white: 10, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 600, exp: { type: 'strategy', amount: 200 } }, repeatClear: { gold: 100, exp: { type: 'strategy', amount: 40 } } } },
    { id: '고급-12', name: '스테이지 12', level: SinglePlayerLevel.고급, gameType: 'hidden', actionPointCost: 5, boardSize: 13, hiddenStoneCount: 1, scanCount: 5, katagoLevel: 9, autoEndTurnCount: 80, placements: { black: 5, white: 11, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 600, exp: { type: 'strategy', amount: 200 } }, repeatClear: { gold: 100, exp: { type: 'strategy', amount: 40 } } } },
    { id: '고급-13', name: '스테이지 13', level: SinglePlayerLevel.고급, gameType: 'hidden', actionPointCost: 5, boardSize: 13, hiddenStoneCount: 1, scanCount: 5, katagoLevel: 9, autoEndTurnCount: 80, placements: { black: 4, white: 10, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 600, exp: { type: 'strategy', amount: 200 } }, repeatClear: { gold: 100, exp: { type: 'strategy', amount: 40 } } } },
    { id: '고급-14', name: '스테이지 14', level: SinglePlayerLevel.고급, gameType: 'hidden', actionPointCost: 5, boardSize: 13, hiddenStoneCount: 1, scanCount: 5, katagoLevel: 9, autoEndTurnCount: 80, placements: { black: 4, white: 12, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 600, exp: { type: 'strategy', amount: 200 } }, repeatClear: { gold: 100, exp: { type: 'strategy', amount: 40 } } } },
    { id: '고급-15', name: '스테이지 15', level: SinglePlayerLevel.고급, gameType: 'hidden', actionPointCost: 5, boardSize: 13, hiddenStoneCount: 1, scanCount: 5, katagoLevel: 9, autoEndTurnCount: 80, placements: { black: 4, white: 12, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { ...parseReward('재료상자4'), exp: { type: 'strategy', amount: 250 } }, repeatClear: { gold: 100, exp: { type: 'strategy', amount: 40 } } } },
    { id: '고급-16', name: '스테이지 16', level: SinglePlayerLevel.고급, gameType: 'hidden', actionPointCost: 5, boardSize: 13, hiddenStoneCount: 1, scanCount: 5, katagoLevel: 9, autoEndTurnCount: 80, placements: { black: 4, white: 11, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 600, exp: { type: 'strategy', amount: 200 } }, repeatClear: { gold: 100, exp: { type: 'strategy', amount: 40 } } } },
    { id: '고급-17', name: '스테이지 17', level: SinglePlayerLevel.고급, gameType: 'hidden', actionPointCost: 5, boardSize: 13, hiddenStoneCount: 1, scanCount: 5, katagoLevel: 9, autoEndTurnCount: 80, placements: { black: 4, white: 11, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 600, exp: { type: 'strategy', amount: 200 } }, repeatClear: { gold: 100, exp: { type: 'strategy', amount: 40 } } } },
    { id: '고급-18', name: '스테이지 18', level: SinglePlayerLevel.고급, gameType: 'hidden', actionPointCost: 5, boardSize: 13, hiddenStoneCount: 1, scanCount: 5, katagoLevel: 9, autoEndTurnCount: 80, placements: { black: 5, white: 12, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 600, exp: { type: 'strategy', amount: 200 } }, repeatClear: { gold: 100, exp: { type: 'strategy', amount: 40 } } } },
    { id: '고급-19', name: '스테이지 19', level: SinglePlayerLevel.고급, gameType: 'hidden', actionPointCost: 5, boardSize: 13, hiddenStoneCount: 1, scanCount: 5, katagoLevel: 9, autoEndTurnCount: 80, placements: { black: 5, white: 12, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 600, exp: { type: 'strategy', amount: 200 } }, repeatClear: { gold: 100, exp: { type: 'strategy', amount: 40 } } } },
    { id: '고급-20', name: '스테이지 20', level: SinglePlayerLevel.고급, gameType: 'hidden', actionPointCost: 5, boardSize: 13, hiddenStoneCount: 1, scanCount: 5, katagoLevel: 9, autoEndTurnCount: 80, placements: { black: 5, white: 14, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { ...parseReward('다이아꾸러미4'), exp: { type: 'strategy', amount: 350 } }, repeatClear: { gold: 100, exp: { type: 'strategy', amount: 80 } } } },

    // 유단자 1-20
    { id: '유단자-1', name: '스테이지 1', level: SinglePlayerLevel.유단자, gameType: 'capture', actionPointCost: 5, boardSize: 13, targetScore: { black: 25, white: 10 }, katagoLevel: 10, blackStoneLimit: 35, placements: { black: 4, white: 14, blackPattern: 5, whitePattern: 4 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 700, exp: { type: 'strategy', amount: 250 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 50 } } } },
    { id: '유단자-2', name: '스테이지 2', level: SinglePlayerLevel.유단자, gameType: 'capture', actionPointCost: 5, boardSize: 13, targetScore: { black: 25, white: 9 }, katagoLevel: 10, blackStoneLimit: 35, placements: { black: 3, white: 14, blackPattern: 5, whitePattern: 3 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 700, exp: { type: 'strategy', amount: 250 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 50 } } } },
    { id: '유단자-3', name: '스테이지 3', level: SinglePlayerLevel.유단자, gameType: 'capture', actionPointCost: 5, boardSize: 13, targetScore: { black: 25, white: 8 }, katagoLevel: 10, blackStoneLimit: 35, placements: { black: 4, white: 16, blackPattern: 7, whitePattern: 2 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 700, exp: { type: 'strategy', amount: 250 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 50 } } } },
    { id: '유단자-4', name: '스테이지 4', level: SinglePlayerLevel.유단자, gameType: 'capture', actionPointCost: 5, boardSize: 13, targetScore: { black: 25, white: 7 }, katagoLevel: 10, blackStoneLimit: 35, placements: { black: 4, white: 17, blackPattern: 7, whitePattern: 2 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 700, exp: { type: 'strategy', amount: 250 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 50 } } } },
    { id: '유단자-5', name: '스테이지 5', level: SinglePlayerLevel.유단자, gameType: 'capture', actionPointCost: 5, boardSize: 13, targetScore: { black: 30, white: 6 }, katagoLevel: 10, blackStoneLimit: 35, placements: { black: 4, white: 18, blackPattern: 8, whitePattern: 2 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { ...parseReward('재료상자5'), exp: { type: 'strategy', amount: 400 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 50 } } } },
    { id: '유단자-6', name: '스테이지 6', level: SinglePlayerLevel.유단자, gameType: 'speed', actionPointCost: 5, boardSize: 13, katagoLevel: 10, autoEndTurnCount: 80, placements: { black: 4, white: 15, blackPattern: 0, whitePattern: 0 }, timeControl: fischerTimeControl, rewards: { firstClear: { gold: 700, exp: { type: 'strategy', amount: 250 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 50 } } } },
    { id: '유단자-7', name: '스테이지 7', level: SinglePlayerLevel.유단자, gameType: 'speed', actionPointCost: 5, boardSize: 13, katagoLevel: 10, autoEndTurnCount: 80, placements: { black: 3, white: 14, blackPattern: 0, whitePattern: 0 }, timeControl: fischerTimeControl, rewards: { firstClear: { gold: 700, exp: { type: 'strategy', amount: 250 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 50 } } } },
    { id: '유단자-8', name: '스테이지 8', level: SinglePlayerLevel.유단자, gameType: 'speed', actionPointCost: 5, boardSize: 13, katagoLevel: 10, autoEndTurnCount: 80, placements: { black: 3, white: 15, blackPattern: 0, whitePattern: 0 }, timeControl: fischerTimeControl, rewards: { firstClear: { gold: 700, exp: { type: 'strategy', amount: 250 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 50 } } } },
    { id: '유단자-9', name: '스테이지 9', level: SinglePlayerLevel.유단자, gameType: 'speed', actionPointCost: 5, boardSize: 13, katagoLevel: 10, autoEndTurnCount: 80, placements: { black: 4, white: 16, blackPattern: 0, whitePattern: 0 }, timeControl: fischerTimeControl, rewards: { firstClear: { gold: 700, exp: { type: 'strategy', amount: 250 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 50 } } } },
    { id: '유단자-10', name: '스테이지 10', level: SinglePlayerLevel.유단자, gameType: 'speed', actionPointCost: 5, boardSize: 13, katagoLevel: 10, autoEndTurnCount: 80, placements: { black: 4, white: 16, blackPattern: 0, whitePattern: 0 }, timeControl: fischerTimeControl, rewards: { firstClear: { ...parseReward('장비상자5'), exp: { type: 'strategy', amount: 500 } }, repeatClear: { gold: 90, exp: { type: 'strategy', amount: 50 } } } },
    { id: '유단자-11', name: '스테이지 11', level: SinglePlayerLevel.유단자, gameType: 'missile', actionPointCost: 5, boardSize: 13, missileCount: 3, katagoLevel: 10, autoEndTurnCount: 80, placements: { black: 4, white: 16, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 800, exp: { type: 'strategy', amount: 300 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 50 } } } },
    { id: '유단자-12', name: '스테이지 12', level: SinglePlayerLevel.유단자, gameType: 'missile', actionPointCost: 5, boardSize: 13, missileCount: 3, katagoLevel: 10, autoEndTurnCount: 80, placements: { black: 3, white: 15, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 800, exp: { type: 'strategy', amount: 300 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 50 } } } },
    { id: '유단자-13', name: '스테이지 13', level: SinglePlayerLevel.유단자, gameType: 'missile', actionPointCost: 5, boardSize: 13, missileCount: 3, katagoLevel: 10, autoEndTurnCount: 80, placements: { black: 3, white: 16, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 800, exp: { type: 'strategy', amount: 300 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 50 } } } },
    { id: '유단자-14', name: '스테이지 14', level: SinglePlayerLevel.유단자, gameType: 'missile', actionPointCost: 5, boardSize: 13, missileCount: 3, katagoLevel: 10, autoEndTurnCount: 80, placements: { black: 4, white: 17, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 800, exp: { type: 'strategy', amount: 300 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 50 } } } },
    { id: '유단자-15', name: '스테이지 15', level: SinglePlayerLevel.유단자, gameType: 'missile', actionPointCost: 5, boardSize: 13, missileCount: 3, katagoLevel: 10, autoEndTurnCount: 80, placements: { black: 4, white: 17, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { ...parseReward('재료상자6'), exp: { type: 'strategy', amount: 400 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 50 } } } },
    { id: '유단자-16', name: '스테이지 16', level: SinglePlayerLevel.유단자, gameType: 'hidden', actionPointCost: 5, boardSize: 13, hiddenStoneCount: 1, scanCount: 2, katagoLevel: 10, autoEndTurnCount: 80, placements: { black: 4, white: 17, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 800, exp: { type: 'strategy', amount: 350 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 50 } } } },
    { id: '유단자-17', name: '스테이지 17', level: SinglePlayerLevel.유단자, gameType: 'hidden', actionPointCost: 5, boardSize: 13, hiddenStoneCount: 1, scanCount: 2, katagoLevel: 10, autoEndTurnCount: 80, placements: { black: 3, white: 16, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 800, exp: { type: 'strategy', amount: 350 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 50 } } } },
    { id: '유단자-18', name: '스테이지 18', level: SinglePlayerLevel.유단자, gameType: 'hidden', actionPointCost: 5, boardSize: 13, hiddenStoneCount: 1, scanCount: 2, katagoLevel: 10, autoEndTurnCount: 80, placements: { black: 3, white: 17, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 800, exp: { type: 'strategy', amount: 350 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 50 } } } },
    { id: '유단자-19', name: '스테이지 19', level: SinglePlayerLevel.유단자, gameType: 'hidden', actionPointCost: 5, boardSize: 13, hiddenStoneCount: 1, scanCount: 2, katagoLevel: 10, autoEndTurnCount: 80, placements: { black: 4, white: 18, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { gold: 800, exp: { type: 'strategy', amount: 350 } }, repeatClear: { gold: 50, exp: { type: 'strategy', amount: 50 } } } },
    { id: '유단자-20', name: '스테이지 20', level: SinglePlayerLevel.유단자, gameType: 'hidden', actionPointCost: 5, boardSize: 13, hiddenStoneCount: 2, scanCount: 1, katagoLevel: 10, autoEndTurnCount: 80, placements: { black: 4, white: 25, blackPattern: 0, whitePattern: 0 }, timeControl: byoyomiTimeControl, rewards: { firstClear: { ...parseReward('장비상자6'), exp: { type: 'strategy', amount: 1000 } }, repeatClear: { gold: 100, exp: { type: 'strategy', amount: 50 } } } },
];
