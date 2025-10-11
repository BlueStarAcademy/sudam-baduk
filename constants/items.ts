import type { InventoryItem, ItemOption, ShopBorderItem } from '../types/entities.js';
import { EquipmentSlot, ItemGrade, CoreStat, SpecialStat, MythicStat, ItemOptionType } from '../types/enums.js';

export const currencyBundles: Record<string, { type: 'gold' | 'diamonds', min: number, max: number }> = {
    '골드 꾸러미1': { type: 'gold', min: 10, max: 500 },
    '골드 꾸러미2': { type: 'gold', min: 100, max: 1000 },
    '골드 꾸러미3': { type: 'gold', min: 500, max: 3000 },
    '골드 꾸러미4': { type: 'gold', min: 1000, max: 10000 },
    '다이아 꾸러미1': { type: 'diamonds', min: 1, max: 20 },
    '다이아 꾸러미2': { type: 'diamonds', min: 10, max: 30 },
    '다이아 꾸러미3': { type: 'diamonds', min: 20, max: 50 },
    '다이아 꾸러미4': { type: 'diamonds', min: 30, max: 100 },
};

export const emptySlotImages: Record<EquipmentSlot, string> = {
    [EquipmentSlot.Fan]: 'images/equipments/EmptyFanSlot.png',
    [EquipmentSlot.Board]: 'images/equipments/EmptyBoardSlot.png',
    [EquipmentSlot.Top]: 'images/equipments/EmptyTopSlot.png',
    [EquipmentSlot.Bottom]: 'images/equipments/EmptyBottomSlot.png',
    [EquipmentSlot.Bowl]: 'images/equipments/EmptyStoneBoxSlot.png',
    [EquipmentSlot.Stones]: 'images/equipments/EmptyStoneSlot.png',
};

export const slotNames: Record<EquipmentSlot, string> = {
    [EquipmentSlot.Fan]: '부채',
    [EquipmentSlot.Board]: '바둑판',
    [EquipmentSlot.Top]: '상의',
    [EquipmentSlot.Bottom]: '하의',
    [EquipmentSlot.Bowl]: '바둑통',
    [EquipmentSlot.Stones]: '바둑돌',
};

export const GRADE_LEVEL_REQUIREMENTS: Record<ItemGrade, number> = {
    [ItemGrade.Normal]: 2,
    [ItemGrade.Uncommon]: 3,
    [ItemGrade.Rare]: 5,
    [ItemGrade.Epic]: 10,
    [ItemGrade.Legendary]: 15,
    [ItemGrade.Mythic]: 20,
};

export const ENHANCEMENT_LEVEL_REQUIREMENTS: Record<ItemGrade, { 4: number; 7: number; 10: number; }> = {
    [ItemGrade.Normal]:   { 4: 3,  7: 5,  10: 8 },
    [ItemGrade.Uncommon]: { 4: 5,  7: 7,  10: 10 },
    [ItemGrade.Rare]:     { 4: 7,  7: 9,  10: 12 },
    [ItemGrade.Epic]:     { 4: 11, 7: 13, 10: 15 },
    [ItemGrade.Legendary]:{ 4: 16, 7: 18, 10: 20 },
    [ItemGrade.Mythic]:   { 4: 21, 7: 23, 10: 25 },
};

export const EQUIPMENT_POOL: (Omit<InventoryItem, 'id' | 'createdAt' | 'isEquipped' | 'level' | 'options' | 'quantity' | 'stars' | 'enhancementFails'> & { stars: 0 })[] = [
    // --- Fans (부채) ---
    { name: '푸른 바람 부채', slot: EquipmentSlot.Fan, image: 'images/equipments/Fan1.png', grade: ItemGrade.Normal, stars: 0, type: 'equipment', description: '가볍고 실용적인 대나무 부채입니다.' },
    { name: '은결 바람 부채', slot: EquipmentSlot.Fan, image: 'images/equipments/Fan2.png', grade: ItemGrade.Uncommon, stars: 0, type: 'equipment', description: '부드러운 비단으로 만들어져 손에 잘 감깁니다.' },
    { name: '화염 바람 부채', slot: EquipmentSlot.Fan, image: 'images/equipments/Fan3.png', grade: ItemGrade.Rare, stars: 0, type: 'equipment', description: '학의 날개처럼 우아하게 펼쳐지는 명인의 부채입니다.' },
    { name: '서리 바람 부채', slot: EquipmentSlot.Fan, image: 'images/equipments/Fan4.png', grade: ItemGrade.Epic, stars: 0, type: 'equipment', description: '묵직한 강철로 만들어져 위급 시 무기로도 사용할 수 있습니다.' },
    { name: '용비 바람 부채', slot: EquipmentSlot.Fan, image: 'images/equipments/Fan5.png', grade: ItemGrade.Legendary, stars: 0, type: 'equipment', description: '백 개의 하얀 깃털로 만들어진 전설적인 부채입니다.' },
    { name: '천룡 바람 부채', slot: EquipmentSlot.Fan, image: 'images/equipments/Fan6.png', grade: ItemGrade.Mythic, stars: 0, type: 'equipment', description: '바람을 일으켜 판세를 뒤엎는 신화 속 부채입니다.' },
    // --- Boards (바둑판) ---
    { name: '새싹 바둑판', slot: EquipmentSlot.Board, image: 'images/equipments/Board1.png', grade: ItemGrade.Normal, stars: 0, type: 'equipment', description: '초심자들이 사용하기 좋은 가벼운 오동나무 바둑판입니다.' },
    { name: '단풍결 바둑판', slot: EquipmentSlot.Board, image: 'images/equipments/Board2.png', grade: ItemGrade.Uncommon, stars: 0, type: 'equipment', description: '아름다운 결을 가진 비자나무로 만든 고급 바둑판입니다.' },
    { name: '산호결 바둑판', slot: EquipmentSlot.Board, image: 'images/equipments/Board3.png', grade: ItemGrade.Rare, stars: 0, type: 'equipment', description: '최고급 신비자 나무로 만들어져 돌을 놓는 소리가 청아합니다.' },
    { name: '흑단 바둑판', slot: EquipmentSlot.Board, image: 'images/equipments/Board4.png', grade: ItemGrade.Epic, stars: 0, type: 'equipment', description: '뜨거운 열정으로 다듬어진 화산암 바둑판입니다.' },
    { name: '용문 바둑판', slot: EquipmentSlot.Board, image: 'images/equipments/Board5.png', grade: ItemGrade.Legendary, stars: 0, type: 'equipment', description: '천 년의 세월을 간직한 금강송으로 만들어진 전설의 바둑판입니다.' },
    { name: '천룡 바둑판', slot: EquipmentSlot.Board, image: 'images/equipments/Board6.png', grade: ItemGrade.Mythic, stars: 0, type: 'equipment', description: '밤하늘의 별들을 수놓은 듯한 신화적인 바둑판입니다.' },
    // --- Tops (상의) ---
    { name: '봄빛 도복 상의', slot: EquipmentSlot.Top, image: 'images/equipments/Top1.png', grade: ItemGrade.Normal, stars: 0, type: 'equipment', description: '수련에 집중하기 좋은 편안한 상의입니다.' },
    { name: '여름빛 도복 상의', slot: EquipmentSlot.Top, image: 'images/equipments/Top2.png', grade: ItemGrade.Uncommon, stars: 0, type: 'equipment', description: '오랜 수련에도 해지지 않는 질긴 도복입니다.' },
    { name: '가을빛 도복 상의', slot: EquipmentSlot.Top, image: 'images/equipments/Top3.png', grade: ItemGrade.Rare, stars: 0, type: 'equipment', description: '고요한 기품이 느껴지는 선비의 도포입니다.' },
    { name: '겨울빛 도복 상의', slot: EquipmentSlot.Top, image: 'images/equipments/Top4.png', grade: ItemGrade.Epic, stars: 0, type: 'equipment', description: '날카로운 승부를 위해 만들어진 검객의 복장입니다.' },
    { name: '용비 도복 상의', slot: EquipmentSlot.Top, image: 'images/equipments/Top5.png', grade: ItemGrade.Legendary, stars: 0, type: 'equipment', description: '황제의 위엄을 상징하는 용무늬가 수놓아져 있습니다.' },
    { name: '천룡 도복 상의', slot: EquipmentSlot.Top, image: 'images/equipments/Top6.png', grade: ItemGrade.Mythic, stars: 0, type: 'equipment', description: '입는 자에게 신의 가호를 내린다는 신화 속 의상입니다.' },
    // --- Bottoms (하의) ---
    { name: '봄빛 도복 하의', slot: EquipmentSlot.Bottom, image: 'images/equipments/Bottom1.png', grade: ItemGrade.Normal, stars: 0, type: 'equipment', description: '움직임이 편한 수련용 바지입니다.' },
    { name: '여름빛 도복 하의', slot: EquipmentSlot.Bottom, image: 'images/equipments/Bottom2.png', grade: ItemGrade.Uncommon, stars: 0, type: 'equipment', description: '쉽게 닳지 않는 튼튼한 재질의 바지입니다.' },
    { name: '가을빛 도복 하의', slot: EquipmentSlot.Bottom, image: 'images/equipments/Bottom3.png', grade: ItemGrade.Rare, stars: 0, type: 'equipment', description: '도포와 한 벌을 이루는 고급 비단 바지입니다.' },
    { name: '겨울빛 도복 하의', slot: EquipmentSlot.Bottom, image: 'images/equipments/Bottom4.png', grade: ItemGrade.Epic, stars: 0, type: 'equipment', description: '어떠한 움직임에도 방해받지 않는 검객의 하의입니다.' },
    { name: '용비 도복 하의', slot: EquipmentSlot.Bottom, image: 'images/equipments/Bottom5.png', grade: ItemGrade.Legendary, stars: 0, type: 'equipment', description: '용포와 한 벌을 이루는 최고급 비단으로 만들어졌습니다.' },
    { name: '천룡 도복 하의', slot: EquipmentSlot.Bottom, image: 'images/equipments/Bottom6.png', grade: ItemGrade.Mythic, stars: 0, type: 'equipment', description: '구름을 엮어 만들었다다는 신화 속 하의입니다.' },
    // --- Bowls (바둑통) ---
    { name: '가벼운 나무통', slot: EquipmentSlot.Bowl, image: 'images/equipments/StoneBox1.png', grade: ItemGrade.Normal, stars: 0, type: 'equipment', description: '가볍고 저렴한 플라스틱 바둑통입니다.' },
    { name: '단단한 대나무통', slot: EquipmentSlot.Bowl, image: 'images/equipments/StoneBox2.png', grade: ItemGrade.Uncommon, stars: 0, type: 'equipment', description: '은은한 향이 나는 대추나무로 만든 바둑통입니다.' },
    { name: '홍목 바둑통', slot: EquipmentSlot.Bowl, image: 'images/equipments/StoneBox3.png', grade: ItemGrade.Rare, stars: 0, type: 'equipment', description: '아름다운 붉은 빛을 띠는 장미목으로 만들어졌습니다.' },
    { name: '흑단 바둑통', slot: EquipmentSlot.Bowl, image: 'images/equipments/StoneBox4.png', grade: ItemGrade.Epic, stars: 0, type: 'equipment', description: '기이하고 아름다운 무늬를 가진 괴목으로 만든 희귀한 바둑통입니다.' },
    { name: '용린 바둑통', slot: EquipmentSlot.Bowl, image: 'images/equipments/StoneBox5.png', grade: ItemGrade.Legendary, stars: 0, type: 'equipment', description: '용이 섬세하게 조각된 최고급 자단목 바둑통입니다.' },
    { name: '천룡 바둑통', slot: EquipmentSlot.Bowl, image: 'images/equipments/StoneBox6.png', grade: ItemGrade.Mythic, stars: 0, type: 'equipment', description: '고대 신의 유물을 담았다고 전해지는 신비로운 함입니다.' },
    // --- Stones (바둑돌) ---
    { name: '흑백 새싹돌', slot: EquipmentSlot.Stones, image: 'images/equipments/Stone1.png', grade: ItemGrade.Normal, stars: 0, type: 'equipment', description: '가볍고 저렴한 플라스틱 바둑돌입니다.' },
    { name: '은빛 결돌', slot: EquipmentSlot.Stones, image: 'images/equipments/Stone2.png', grade: ItemGrade.Uncommon, stars: 0, type: 'equipment', description: '강가에서 주운 매끄러운 조약돌로 만든 바둑돌입니다.' },
    { name: '홍옥 바둑돌', slot: EquipmentSlot.Stones, image: 'images/equipments/Stone3.png', grade: ItemGrade.Rare, stars: 0, type: 'equipment', description: '차가운 빛을 내는 흑요석으로 정교하게 깎아 만들었습니다.' },
    { name: '백옥 바둑돌', slot: EquipmentSlot.Stones, image: 'images/equipments/Stone4.png', grade: ItemGrade.Epic, stars: 0, type: 'equipment', description: '영롱한 빛을 내는 청옥과 백옥으로 만들어진 바둑돌입니다.' },
    { name: '용안 바둑돌', slot: EquipmentSlot.Stones, image: 'images/equipments/Stone5.png', grade: ItemGrade.Legendary, stars: 0, type: 'equipment', description: '해와 달, 별의 기운을 담아 벼려낸 전설적인 바둑돌입니다.' },
    { name: '천룡 바둑돌', slot: EquipmentSlot.Stones, image: 'images/equipments/Stone6.png', grade: ItemGrade.Mythic, stars: 0, type: 'equipment', description: '밤하늘의 은하수를 담아놓은 듯한 신화 속 바둑돌입니다.' },
];

export const CONSUMABLE_ITEMS: (Omit<InventoryItem, 'id'|'createdAt'|'isEquipped'|'level'|'stars'|'options'|'enhancementFails' | 'slot'> & {slot: null})[] = [
    { name: '장비 상자 I', description: '일반~희귀 등급 장비 획득', type: 'consumable', slot: null, image: '/images/Box/EquipmentBox1.png', grade: ItemGrade.Normal },
    { name: '장비 상자 II', description: '일반~에픽 등급 장비 획득', type: 'consumable', slot: null, image: '/images/Box/EquipmentBox2.png', grade: ItemGrade.Uncommon },
    { name: '장비 상자 III', description: '고급~전설 등급 장비 획득', type: 'consumable', slot: null, image: '/images/Box/EquipmentBox3.png', grade: ItemGrade.Rare },
    { name: '장비 상자 IV', description: '희귀~신화 등급 장비 획득', type: 'consumable', slot: null, image: '/images/Box/EquipmentBox4.png', grade: ItemGrade.Epic },
    { name: '장비 상자 V', description: '에픽~신화 등급 장비 획득', type: 'consumable', slot: null, image: '/images/Box/EquipmentBox5.png', grade: ItemGrade.Legendary },
    { name: '장비 상자 VI', description: '전설~신화 등급 장비 획득', type: 'consumable', slot: null, image: '/images/Box/EquipmentBox6.png', grade: ItemGrade.Mythic },
    { name: '재료 상자 I', description: '하급 ~ 상급 강화석 5개 획득', type: 'consumable', slot: null, image: '/images/Box/ResourceBox1.png', grade: ItemGrade.Normal },
    { name: '재료 상자 II', description: '하급 ~ 상급 강화석 5개 획득', type: 'consumable', slot: null, image: '/images/Box/ResourceBox2.png', grade: ItemGrade.Uncommon },
    { name: '재료 상자 III', description: '하급 ~ 상급 강화석 5개 획득', type: 'consumable', slot: null, image: '/images/Box/ResourceBox3.png', grade: ItemGrade.Rare },
    { name: '재료 상자 IV', description: '중급 ~ 최상급 강화석 5개 획득', type: 'consumable', slot: null, image: '/images/Box/ResourceBox4.png', grade: ItemGrade.Epic },
    { name: '재료 상자 V', description: '상급 ~ 신비의 강화석 5개 획득', type: 'consumable', slot: null, image: '/images/Box/ResourceBox5.png', grade: ItemGrade.Legendary },
    { name: '재료 상자 VI', description: '상급 ~ 신비의 강화석 5개 획득', type: 'consumable', slot: null, image: '/images/Box/ResourceBox6.png', grade: ItemGrade.Mythic },
    { name: '골드 꾸러미1', description: '10 ~ 500 골드 획득', type: 'consumable', slot: null, image: '/images/Box/GoldBox1.png', grade: ItemGrade.Normal },
    { name: '골드 꾸러미2', description: '100 ~ 1,000 골드 획득', type: 'consumable', slot: null, image: '/images/Box/GoldBox2.png', grade: ItemGrade.Uncommon },
    { name: '골드 꾸러미3', description: '500 ~ 3,000 골드 획득', type: 'consumable', slot: null, image: '/images/Box/GoldBox3.png', grade: ItemGrade.Rare },
    { name: '골드 꾸러미4', description: '1,000 ~ 10,000 골드 획득', type: 'consumable', slot: null, image: '/images/Box/GoldBox4.png', grade: ItemGrade.Epic },
    { name: '다이아 꾸러미1', description: '1 ~ 20 다이아 획득', type: 'consumable', slot: null, image: '/images/Box/DiaBox1.png', grade: ItemGrade.Rare },
    { name: '다이아 꾸러미2', description: '10 ~ 30 다이아 획득', type: 'consumable', slot: null, image: '/images/Box/DiaBox2.png', grade: ItemGrade.Epic },
    { name: '다이아 꾸러미3', description: '20 ~ 50 다이아 획득', type: 'consumable', slot: null, image: '/images/Box/DiaBox3.png', grade: ItemGrade.Legendary },
    { name: '다이아 꾸러미4', description: '30 ~ 100 다이아 획득', type: 'consumable', slot: null, image: '/images/Box/DiaBox4.png', grade: ItemGrade.Mythic },
    { name: '컨디션 물약(소)', description: '토너먼트 경기 시작 전 선수의 피로도를 1~5만큼 회복시킵니다.', type: 'consumable', slot: null, image: '/images/use/con1.png', grade: ItemGrade.Uncommon },
    { name: '컨디션 물약(중)', description: '토너먼트 경기 시작 전 선수의 피로도를 5~10만큼 회복시킵니다.', type: 'consumable', slot: null, image: '/images/use/con2.png', grade: ItemGrade.Rare },
    { name: '컨디션 물약(대)', description: '토너먼트 경기 시작 전 선수의 피로도를 10~20만큼 회복시킵니다.', type: 'consumable', slot: null, image: '/images/use/con3.png', grade: ItemGrade.Epic },
    { name: '싱글플레이 최초보상 초기화권', description: '이미 클리어한 모든 싱글플레이 스테이지의 최초 클리어 보상 기록을 초기화하여, 보상을 다시 획득할 수 있게 합니다. (진행도는 유지됩니다.)', type: 'consumable', slot: null, image: '/images/use/reset.png', grade: ItemGrade.Rare },
    { name: '보너스 스탯 +5', description: '모든 능력치에 자유롭게 분배할 수 있는 보너스 스탯 포인트를 5개 획득합니다.', type: 'consumable', slot: null, image: '/images/statpoint.png', grade: ItemGrade.Legendary },
];

export const SHOP_CONSUMABLE_ITEMS: { name: string; description: string; cost: { gold?: number, diamonds?: number }; image: string; weeklyLimit?: number; dailyLimit?: number; type: 'consumable' }[] = [
    { name: '컨디션 물약(소)', description: '피로도 1~5 회복', cost: { gold: 100 }, image: '/images/use/con1.png', weeklyLimit: 10, type: 'consumable' },
    { name: '컨디션 물약(중)', description: '피로도 5~10 회복', cost: { gold: 250 }, image: '/images/use/con2.png', weeklyLimit: 5, type: 'consumable' },
    { name: '컨디션 물약(대)', description: '피로도 10~20 회복', cost: { gold: 500 }, image: '/images/use/con3.png', weeklyLimit: 3, type: 'consumable' },
    { name: '골드 꾸러미1', description: '10 ~ 500 골드 획득', cost: { diamonds: 10 }, image: '/images/Box/GoldBox1.png', dailyLimit: 10, type: 'consumable' },
    { name: '골드 꾸러미2', description: '100 ~ 1,000 골드 획득', cost: { diamonds: 20 }, image: '/images/Box/GoldBox2.png', dailyLimit: 5, type: 'consumable' },
    { name: '골드 꾸러미3', description: '500 ~ 3,000 골드 획득', cost: { diamonds: 30 }, image: '/images/Box/GoldBox3.png', dailyLimit: 3, type: 'consumable' },
    { name: '골드 꾸러미4', description: '1,000 ~ 10,000 골드 획득', cost: { diamonds: 40 }, image: '/images/Box/GoldBox4.png', dailyLimit: 1, type: 'consumable' },
];

export const MATERIAL_ITEMS: Record<string, Omit<InventoryItem, 'id'|'createdAt'|'isEquipped'|'level'|'stars'|'options'|'enhancementFails'>> = {
    '하급 강화석': { name: '하급 강화석', description: '장비 강화에 사용되는 기본 재료.', type: 'material', slot: null, image: '/images/materials/materials1.png', grade: ItemGrade.Normal },
    '중급 강화석': { name: '중급 강화석', description: '장비 강화에 사용되는 상급 재료.', type: 'material', slot: null, image: '/images/materials/materials2.png', grade: ItemGrade.Uncommon },
    '상급 강화석': { name: '상급 강화석', description: '장비 강화에 사용되는 최상급 재료.', type: 'material', slot: null, image: '/images/materials/materials3.png', grade: ItemGrade.Rare },
    '최상급 강화석': { name: '최상급 강화석', description: '장비 강화에 사용되는 희귀 재료.', type: 'material', slot: null, image: '/images/materials/materials4.png', grade: ItemGrade.Epic },
    '신비의 강화석': { name: '신비의 강화석', description: '장비 강화에 사용되는 고대 재료.', type: 'material', slot: null, image: '/images/materials/materials5.png', grade: ItemGrade.Legendary },
};

export const ENHANCEMENT_SUCCESS_RATES = [100, 90, 80, 70, 60, 50, 40, 35, 30, 20]; // For +1 to +10

export const ENHANCEMENT_FAIL_BONUS_RATES: Record<ItemGrade, number> = {
    [ItemGrade.Normal]: 5,
    [ItemGrade.Uncommon]: 4,
    [ItemGrade.Rare]: 3,
    [ItemGrade.Epic]: 2,
    [ItemGrade.Legendary]: 1,
    [ItemGrade.Mythic]: 0.5,
};

const normalGoldCosts = [100, 150, 200, 300, 500, 750, 1000, 1250, 1500, 2000];
const gradeGoldMultipliers: Record<ItemGrade, number> = {
    [ItemGrade.Normal]: 1,
    [ItemGrade.Uncommon]: 1.5,
    [ItemGrade.Rare]: 2,
    [ItemGrade.Epic]: 3,
    [ItemGrade.Legendary]: 4,
    [ItemGrade.Mythic]: 5,
};

const generateEnhancementCosts = (grade: ItemGrade, materials: { amount: number; name: string }[][]) => {
    const multiplier = gradeGoldMultipliers[grade];
    return materials.map((mats, index) => ({
        gold: Math.floor(normalGoldCosts[index] * multiplier),
        materials: mats,
    }));
};

export const ENHANCEMENT_COSTS: Record<ItemGrade, { gold: number; materials: { amount: number; name: string }[] }[]> = {
    [ItemGrade.Normal]: generateEnhancementCosts(ItemGrade.Normal, [
        [{ amount: 10, name: '하급 강화석' }],
        [{ amount: 15, name: '하급 강화석' }],
        [{ amount: 20, name: '하급 강화석' }],
        [{ amount: 25, name: '하급 강화석' }],
        [{ amount: 30, name: '하급 강화석' }],
        [{ amount: 30, name: '중급 강화석' }],
        [{ amount: 50, name: '중급 강화석' }],
        [{ amount: 5, name: '상급 강화석' }],
        [{ amount: 10, name: '상급 강화석' }],
        [{ amount: 5, name: '최상급 강화석' }],
    ]),
    [ItemGrade.Uncommon]: generateEnhancementCosts(ItemGrade.Uncommon, [
        [{ amount: 20, name: '하급 강화석' }],
        [{ amount: 30, name: '하급 강화석' }],
        [{ amount: 40, name: '하급 강화석' }],
        [{ amount: 50, name: '하급 강화석' }],
        [{ amount: 60, name: '하급 강화석' }],
        [{ amount: 50, name: '중급 강화석' }],
        [{ amount: 10, name: '상급 강화석' }],
        [{ amount: 20, name: '상급 강화석' }],
        [{ amount: 10, name: '최상급 강화석' }],
        [{ amount: 20, name: '최상급 강화석' }],
    ]),
    [ItemGrade.Rare]: generateEnhancementCosts(ItemGrade.Rare, [
        [{ amount: 10, name: '중급 강화석' }],
        [{ amount: 15, name: '중급 강화석' }],
        [{ amount: 20, name: '중급 강화석' }],
        [{ amount: 25, name: '중급 강화석' }],
        [{ amount: 30, name: '중급 강화석' }],
        [{ amount: 100, name: '중급 강화석' }],
        [{ amount: 20, name: '상급 강화석' }],
        [{ amount: 40, name: '상급 강화석' }],
        [{ amount: 15, name: '최상급 강화석' }],
        [{ amount: 30, name: '최상급 강화석' }],
    ]),
    [ItemGrade.Epic]: generateEnhancementCosts(ItemGrade.Epic, [
        [{ amount: 20, name: '중급 강화석' }],
        [{ amount: 30, name: '중급 강화석' }],
        [{ amount: 40, name: '중급 강화석' }],
        [{ amount: 50, name: '중급 강화석' }],
        [{ amount: 60, name: '중급 강화석' }],
        [{ amount: 30, name: '상급 강화석' }],
        [{ amount: 50, name: '상급 강화석' }],
        [{ amount: 20, name: '최상급 강화석' }],
        [{ amount: 45, name: '최상급 강화석' }],
        [{ amount: 80, name: '최상급 강화석' }],
    ]),
    [ItemGrade.Legendary]: generateEnhancementCosts(ItemGrade.Legendary, [
        [{ amount: 10, name: '상급 강화석' }],
        [{ amount: 15, name: '상급 강화석' }],
        [{ amount: 20, name: '상급 강화석' }],
        [{ amount: 25, name: '상급 강화석' }],
        [{ amount: 30, name: '상급 강화석' }],
        [{ amount: 100, name: '상급 강화석' }],
        [{ amount: 20, name: '최상급 강화석' }],
        [{ amount: 50, name: '최상급 강화석' }],
        [{ amount: 100, name: '최상급 강화석' }],
        [{ amount: 10, name: '신비의 강화석' }],
    ]),
    [ItemGrade.Mythic]: generateEnhancementCosts(ItemGrade.Mythic, [
        [{ amount: 20, name: '상급 강화석' }],
        [{ amount: 30, name: '상급 강화석' }],
        [{ amount: 40, name: '상급 강화석' }],
        [{ amount: 50, name: '상급 강화석' }],
        [{ amount: 60, name: '상급 강화석' }],
        [{ amount: 40, name: '최상급 강화석' }],
        [{ amount: 80, name: '최상급 강화석' }],
        [{ amount: 10, name: '신비의 강화석' }],
        [{ amount: 50, name: '신비의 강화석' }],
        [{ amount: 100, name: '신비의 강화석' }],
    ]),
};

export const SYNTHESIS_COSTS: Record<ItemGrade, number> = {
    [ItemGrade.Normal]: 100,
    [ItemGrade.Uncommon]: 300,
    [ItemGrade.Rare]: 500,
    [ItemGrade.Epic]: 1000,
    [ItemGrade.Legendary]: 2000,
    [ItemGrade.Mythic]: 5000,
};

export interface SynthesisLevelBenefit {
    level: number;
    synthesizableGrades: ItemGrade[];
    upgradeChance: Partial<Record<ItemGrade, number>>;
    doubleMythicChance: number; // Percentage
}

export const SYNTHESIS_LEVEL_BENEFITS: SynthesisLevelBenefit[] = [
    { level: 0, synthesizableGrades: [], upgradeChance: {}, doubleMythicChance: 0 },
    { level: 1, synthesizableGrades: [ItemGrade.Normal, ItemGrade.Uncommon], upgradeChance: { [ItemGrade.Normal]: 50, [ItemGrade.Uncommon]: 30 }, doubleMythicChance: 0 },
    { level: 2, synthesizableGrades: [ItemGrade.Normal, ItemGrade.Uncommon, ItemGrade.Rare], upgradeChance: { [ItemGrade.Normal]: 50, [ItemGrade.Uncommon]: 30, [ItemGrade.Rare]: 20 }, doubleMythicChance: 0 },
    { level: 3, synthesizableGrades: [ItemGrade.Normal, ItemGrade.Uncommon, ItemGrade.Rare, ItemGrade.Epic], upgradeChance: { [ItemGrade.Normal]: 50, [ItemGrade.Uncommon]: 30, [ItemGrade.Rare]: 20, [ItemGrade.Epic]: 10 }, doubleMythicChance: 0 },
    { level: 4, synthesizableGrades: [ItemGrade.Normal, ItemGrade.Uncommon, ItemGrade.Rare, ItemGrade.Epic, ItemGrade.Legendary], upgradeChance: { [ItemGrade.Normal]: 50, [ItemGrade.Uncommon]: 30, [ItemGrade.Rare]: 20, [ItemGrade.Epic]: 10, [ItemGrade.Legendary]: 1 }, doubleMythicChance: 0 },
    { level: 5, synthesizableGrades: Object.values(ItemGrade), upgradeChance: { [ItemGrade.Normal]: 50, [ItemGrade.Uncommon]: 30, [ItemGrade.Rare]: 20, [ItemGrade.Epic]: 10, [ItemGrade.Legendary]: 1.5 }, doubleMythicChance: 25 },
    { level: 6, synthesizableGrades: Object.values(ItemGrade), upgradeChance: { [ItemGrade.Normal]: 65, [ItemGrade.Uncommon]: 40, [ItemGrade.Rare]: 25, [ItemGrade.Epic]: 12.5, [ItemGrade.Legendary]: 2 }, doubleMythicChance: 30 },
    { level: 7, synthesizableGrades: Object.values(ItemGrade), upgradeChance: { [ItemGrade.Normal]: 80, [ItemGrade.Uncommon]: 50, [ItemGrade.Rare]: 30, [ItemGrade.Epic]: 15, [ItemGrade.Legendary]: 2.5 }, doubleMythicChance: 35 },
    { level: 8, synthesizableGrades: Object.values(ItemGrade), upgradeChance: { [ItemGrade.Normal]: 95, [ItemGrade.Uncommon]: 60, [ItemGrade.Rare]: 35, [ItemGrade.Epic]: 17.5, [ItemGrade.Legendary]: 3 }, doubleMythicChance: 40 },
    { level: 9, synthesizableGrades: Object.values(ItemGrade), upgradeChance: { [ItemGrade.Normal]: 100, [ItemGrade.Uncommon]: 70, [ItemGrade.Rare]: 40, [ItemGrade.Epic]: 20, [ItemGrade.Legendary]: 3.5 }, doubleMythicChance: 45 },
    { level: 10, synthesizableGrades: Object.values(ItemGrade), upgradeChance: { [ItemGrade.Normal]: 100, [ItemGrade.Uncommon]: 80, [ItemGrade.Rare]: 45, [ItemGrade.Epic]: 22.5, [ItemGrade.Legendary]: 4 }, doubleMythicChance: 50 },
    { level: 11, synthesizableGrades: Object.values(ItemGrade), upgradeChance: { [ItemGrade.Normal]: 100, [ItemGrade.Uncommon]: 90, [ItemGrade.Rare]: 50, [ItemGrade.Epic]: 25, [ItemGrade.Legendary]: 4.5 }, doubleMythicChance: 55 },
    { level: 12, synthesizableGrades: Object.values(ItemGrade), upgradeChance: { [ItemGrade.Normal]: 100, [ItemGrade.Uncommon]: 100, [ItemGrade.Rare]: 55, [ItemGrade.Epic]: 27.5, [ItemGrade.Legendary]: 5 }, doubleMythicChance: 60 },
    { level: 13, synthesizableGrades: Object.values(ItemGrade), upgradeChance: { [ItemGrade.Normal]: 100, [ItemGrade.Uncommon]: 100, [ItemGrade.Rare]: 60, [ItemGrade.Epic]: 30, [ItemGrade.Legendary]: 5.5 }, doubleMythicChance: 65 },
    { level: 14, synthesizableGrades: Object.values(ItemGrade), upgradeChance: { [ItemGrade.Normal]: 100, [ItemGrade.Uncommon]: 100, [ItemGrade.Rare]: 65, [ItemGrade.Epic]: 32.5, [ItemGrade.Legendary]: 6 }, doubleMythicChance: 70 },
    { level: 15, synthesizableGrades: Object.values(ItemGrade), upgradeChance: { [ItemGrade.Normal]: 100, [ItemGrade.Uncommon]: 100, [ItemGrade.Rare]: 70, [ItemGrade.Epic]: 35, [ItemGrade.Legendary]: 6.5 }, doubleMythicChance: 75 },
    { level: 16, synthesizableGrades: Object.values(ItemGrade), upgradeChance: { [ItemGrade.Normal]: 100, [ItemGrade.Uncommon]: 100, [ItemGrade.Rare]: 75, [ItemGrade.Epic]: 37.5, [ItemGrade.Legendary]: 7 }, doubleMythicChance: 80 },
    { level: 17, synthesizableGrades: Object.values(ItemGrade), upgradeChance: { [ItemGrade.Normal]: 100, [ItemGrade.Uncommon]: 100, [ItemGrade.Rare]: 80, [ItemGrade.Epic]: 40, [ItemGrade.Legendary]: 7.5 }, doubleMythicChance: 85 },
    { level: 18, synthesizableGrades: Object.values(ItemGrade), upgradeChance: { [ItemGrade.Normal]: 100, [ItemGrade.Uncommon]: 100, [ItemGrade.Rare]: 90, [ItemGrade.Epic]: 42.5, [ItemGrade.Legendary]: 8 }, doubleMythicChance: 90 },
    { level: 19, synthesizableGrades: Object.values(ItemGrade), upgradeChance: { [ItemGrade.Normal]: 100, [ItemGrade.Uncommon]: 100, [ItemGrade.Rare]: 90, [ItemGrade.Epic]: 45, [ItemGrade.Legendary]: 8.5 }, doubleMythicChance: 95 },
    { level: 20, synthesizableGrades: Object.values(ItemGrade), upgradeChance: { [ItemGrade.Normal]: 100, [ItemGrade.Uncommon]: 100, [ItemGrade.Rare]: 100, [ItemGrade.Epic]: 50, [ItemGrade.Legendary]: 10 }, doubleMythicChance: 100 }
];


export const ITEM_SELL_PRICES: Record<ItemGrade, number> = {
    [ItemGrade.Normal]: 50,
    [ItemGrade.Uncommon]: 100,
    [ItemGrade.Rare]: 200,
    [ItemGrade.Epic]: 300,
    [ItemGrade.Legendary]: 500,
    [ItemGrade.Mythic]: 1000,
};

export const MATERIAL_SELL_PRICES: Record<string, number> = {
    '하급 강화석': 10,
    '중급 강화석': 30,
    '상급 강화석': 50,
    '최상급 강화석': 100,
    '신비의 강화석': 200,
};

// Core Stat Info
export const CORE_STATS_DATA: Record<CoreStat, { name: string; description: string }> = {
    [CoreStat.Concentration]: { name: '집중력', description: '모든 구간에 꾸준히 영향을 미칩니다. 안정적인 시작과 중반 운영, 끝내기에서의 실수 방지에 기여하는 기본 능력치입니다.' },
    [CoreStat.ThinkingSpeed]: { name: '사고속도', description: '챔피언십 초반전에 영향을 줍니다. 빠른 판단으로 초반 흐름을 유리하게 가져와 꾸준히 점수를 쌓는 데 도움을 줍니다.' },
    [CoreStat.Judgment]: { name: '판단력', description: '챔피언십 중반전에 가장 큰 영향을 미칩니다. 복잡한 형세에서 정확한 판단으로 미세한 이득을 점수로 연결하는 핵심 변수입니다.' },
    [CoreStat.Calculation]: { name: '계산력', description: '챔피언십 끝내기에서 승패를 결정짓는 가장 중요한 능력치입니다. 점수를 극대화하고 승리를 확정 짓는 데 사용됩니다.' },
    [CoreStat.CombatPower]: { name: '전투력', description: '챔피언십 초반전에 가장 큰 영향을 미칩니다. 높은 전투력은 초반 기세를 장악하고 점수를 쌓는 데 결정적인 역할을 합니다.' },
    [CoreStat.Stability]: { name: '안정감', description: '챔피언십 중반전과 끝내기에 중요하게 작용합니다. 상대의 공격을 효과적으로 방어하고 점수 손실을 최소화하는 방어 변수입니다.' },
};

export const MAIN_STAT_DEFINITIONS: Record<EquipmentSlot, {
    isPercentage: boolean;
    options: Record<ItemGrade, {
        stats: CoreStat[];
        value: number;
    }>
}> = {
    [EquipmentSlot.Fan]: {
        isPercentage: true,
        options: {
            [ItemGrade.Normal]:   { stats: [CoreStat.ThinkingSpeed, CoreStat.Concentration], value: 4 },
            [ItemGrade.Uncommon]: { stats: [CoreStat.ThinkingSpeed, CoreStat.Concentration], value: 6 },
            [ItemGrade.Rare]:     { stats: [CoreStat.ThinkingSpeed, CoreStat.Concentration], value: 8 },
            [ItemGrade.Epic]:     { stats: [CoreStat.ThinkingSpeed, CoreStat.Concentration], value: 10 },
            [ItemGrade.Legendary]:{ stats: [CoreStat.ThinkingSpeed, CoreStat.Concentration], value: 12 },
            [ItemGrade.Mythic]:   { stats: [CoreStat.ThinkingSpeed, CoreStat.Concentration], value: 15 },
        }
    },
    [EquipmentSlot.Board]: {
        isPercentage: true,
        options: {
            [ItemGrade.Normal]:   { stats: [CoreStat.Stability, CoreStat.Calculation], value: 4 },
            [ItemGrade.Uncommon]: { stats: [CoreStat.Stability, CoreStat.Calculation], value: 6 },
            [ItemGrade.Rare]:     { stats: [CoreStat.Stability, CoreStat.Calculation], value: 8 },
            [ItemGrade.Epic]:     { stats: [CoreStat.Stability, CoreStat.Calculation], value: 10 },
            [ItemGrade.Legendary]:{ stats: [CoreStat.Stability, CoreStat.Calculation], value: 12 },
            [ItemGrade.Mythic]:   { stats: [CoreStat.Stability, CoreStat.Calculation], value: 15 },
        }
    },
    [EquipmentSlot.Top]: {
        isPercentage: true,
        options: {
            [ItemGrade.Normal]:   { stats: [CoreStat.CombatPower, CoreStat.Judgment], value: 4 },
            [ItemGrade.Uncommon]: { stats: [CoreStat.CombatPower, CoreStat.Judgment], value: 6 },
            [ItemGrade.Rare]:     { stats: [CoreStat.CombatPower, CoreStat.Judgment], value: 8 },
            [ItemGrade.Epic]:     { stats: [CoreStat.CombatPower, CoreStat.Judgment], value: 10 },
            [ItemGrade.Legendary]:{ stats: [CoreStat.CombatPower, CoreStat.Judgment], value: 12 },
            [ItemGrade.Mythic]:   { stats: [CoreStat.CombatPower, CoreStat.Judgment], value: 15 },
        }
    },
    [EquipmentSlot.Bottom]: {
        isPercentage: false,
        options: {
            [ItemGrade.Normal]:   { stats: [CoreStat.Concentration, CoreStat.Stability, CoreStat.Judgment, CoreStat.Calculation, CoreStat.ThinkingSpeed], value: 8 },
            [ItemGrade.Uncommon]: { stats: [CoreStat.Concentration, CoreStat.Stability, CoreStat.Judgment, CoreStat.Calculation, CoreStat.ThinkingSpeed], value: 12 },
            [ItemGrade.Rare]:     { stats: [CoreStat.Concentration, CoreStat.Stability, CoreStat.Judgment, CoreStat.Calculation, CoreStat.ThinkingSpeed], value: 16 },
            [ItemGrade.Epic]:     { stats: [CoreStat.Concentration, CoreStat.Stability, CoreStat.Judgment, CoreStat.Calculation, CoreStat.ThinkingSpeed], value: 20 },
            [ItemGrade.Legendary]:{ stats: [CoreStat.Concentration, CoreStat.Stability, CoreStat.Judgment, CoreStat.Calculation, CoreStat.ThinkingSpeed], value: 24 },
            [ItemGrade.Mythic]:   { stats: [CoreStat.Concentration, CoreStat.Stability, CoreStat.Judgment, CoreStat.Calculation, CoreStat.ThinkingSpeed], value: 30 },
        }
    },
    [EquipmentSlot.Stones]: {
        isPercentage: false,
        options: {
            [ItemGrade.Normal]:   { stats: [CoreStat.CombatPower, CoreStat.Calculation], value: 8 },
            [ItemGrade.Uncommon]: { stats: [CoreStat.CombatPower, CoreStat.Calculation], value: 12 },
            [ItemGrade.Rare]:     { stats: [CoreStat.CombatPower, CoreStat.Calculation], value: 16 },
            [ItemGrade.Epic]:     { stats: [CoreStat.CombatPower, CoreStat.Calculation], value: 20 },
            [ItemGrade.Legendary]:{ stats: [CoreStat.CombatPower, CoreStat.Calculation], value: 24 },
            [ItemGrade.Mythic]:   { stats: [CoreStat.CombatPower, CoreStat.Calculation], value: 30 },
        }
    },
    [EquipmentSlot.Bowl]: {
        isPercentage: false,
        options: {
            [ItemGrade.Normal]:   { stats: [CoreStat.Concentration, CoreStat.Stability, CoreStat.ThinkingSpeed], value: 8 },
            [ItemGrade.Uncommon]: { stats: [CoreStat.Concentration, CoreStat.Stability, CoreStat.ThinkingSpeed], value: 12 },
            [ItemGrade.Rare]:     { stats: [CoreStat.Concentration, CoreStat.Stability, CoreStat.ThinkingSpeed], value: 16 },
            [ItemGrade.Epic]:     { stats: [CoreStat.Concentration, CoreStat.Stability, CoreStat.ThinkingSpeed], value: 20 },
            [ItemGrade.Legendary]:{ stats: [CoreStat.Concentration, CoreStat.Stability, CoreStat.ThinkingSpeed], value: 24 },
            [ItemGrade.Mythic]:   { stats: [CoreStat.Concentration, CoreStat.Stability, CoreStat.ThinkingSpeed], value: 30 },
        }
    }
};
export const SPECIAL_STATS_DATA: Record<SpecialStat, { name: string; description: string; isPercentage: boolean; range: [number, number]; }> = {
    [SpecialStat.ActionPointMax]: { name: '행동력 최대치', description: '행동력의 최대치를 증가시킵니다.', isPercentage: false, range: [2, 5] },
    [SpecialStat.ActionPointRegen]: { name: '행동력 회복속도', description: '행동력이 회복되는 속도를 증가시킵니다.', isPercentage: true, range: [1, 3] },
    [SpecialStat.StrategyXpBonus]: { name: '전략 경험치 추가획득', description: '전략 바둑 승리 시 획득하는 경험치를 증가시킵니다.', isPercentage: true, range: [1, 3] },
    [SpecialStat.PlayfulXpBonus]: { name: '놀이 경험치 추가획득', description: '놀이 바둑 승리 시 획득하는 경험치를 증가시킵니다.', isPercentage: true, range: [1, 3] },
    [SpecialStat.GoldBonus]: { name: '골드 보상 추가', description: '경기 승리 시 골드 보상을 추가로 획득합니다.', isPercentage: true, range: [1, 3] },
    [SpecialStat.ItemDropRate]: { name: '장비상자 획득확률 증가', description: '경기 승리 시 장비상자 획득 확률을 증가시킵니다.', isPercentage: true, range: [1, 2] },
    [SpecialStat.MaterialDropRate]: { name: '재료상자 획득확률 증가', description: '경기 승리 시 재료상자 획득 확률을 증가시킵니다.', isPercentage: true, range: [1, 3] },
    [SpecialStat.GuildBossDamage]: { name: '길드보스전 데미지 증가', description: '길드 보스전에서 입히는 피해량이 증가합니다.', isPercentage: true, range: [3, 5] },
    [SpecialStat.GuildBossDamageReduction]: { name: '길드보스전 데미지 감소', description: '길드 보스전에서 받는 피해량이 감소합니다.', isPercentage: true, range: [3, 5] },
    [SpecialStat.GuildBossHealIncrease]: { name: '길드보스전 회복량 증가', description: '길드 보스전에서 스킬로 회복하는 체력이 증가합니다.', isPercentage: true, range: [5, 10] },
};

export const MYTHIC_STATS_DATA: Record<MythicStat, { name: string; description: string; value: (range: [number, number]) => number; }> = {
    [MythicStat.MannerActionCooldown]: { name: '매너 액션 버튼 생성시간 감소', description: '매너 액션 버튼 생성시간을 감소시킵니다.', value: () => 30 }, // Fixed 30s reduction
    [MythicStat.StrategicGoldBonus]: { name: '전략 골드 보너스', description: '전략 바둑 경기중 착수시 20%확률로 골드획득(10~50골드) 최대5회', value: () => 1 },
    [MythicStat.PlayfulGoldBonus]: { name: '놀이 골드 보너스', description: '놀이 바둑 경기중 60초마다 20%확률로 골드획득(10~50골드) 최대5회', value: () => 1 },
    [MythicStat.DiceGoOddBonus]: { name: '주사위 홀/짝 보너스', description: '주사위 바둑에서 홀/짝수 아이템 1개씩 추가', value: () => 1 },
    [MythicStat.AlkkagiSlowBonus]: { name: '알까기 슬로우 보너스', description: '알까기 및 바둑컬링에서 슬로우 아이템 1개추가', value: () => 1 },
    [MythicStat.AlkkagiAimingBonus]: { name: '알까기 조준선 보너스', description: '알까기 및 바둑컬링에서 조준선 아이템 1개추가', value: () => 1 },
};

export const GRADE_SUB_OPTION_RULES: Record<ItemGrade, { combatCount: [number, number]; specialCount: [number, number]; mythicCount: [number, number]; combatTier: number; }> = {
    [ItemGrade.Normal]:   { combatCount: [1, 2], specialCount: [0, 0], mythicCount: [0, 0], combatTier: 1 },
    [ItemGrade.Uncommon]: { combatCount: [2, 3], specialCount: [1, 1], mythicCount: [0, 0], combatTier: 2 },
    [ItemGrade.Rare]:     { combatCount: [3, 3], specialCount: [1, 1], mythicCount: [0, 0], combatTier: 3 },
    [ItemGrade.Epic]:     { combatCount: [3, 4], specialCount: [1, 1], mythicCount: [0, 0], combatTier: 4 },
    [ItemGrade.Legendary]:{ combatCount: [4, 4], specialCount: [1, 2], mythicCount: [0, 0], combatTier: 5 },
    [ItemGrade.Mythic]:   { combatCount: [4, 4], specialCount: [1, 2], mythicCount: [1, 1], combatTier: 6 },
};

type SubOptionDefinition = { type: CoreStat, isPercentage: boolean, range: [number, number] };
export const SUB_OPTION_POOLS: Record<EquipmentSlot, Record<number, SubOptionDefinition[]>> = {
    [EquipmentSlot.Fan]: {
        1: [ { type: CoreStat.Concentration, isPercentage: true, range: [1, 2] }, { type: CoreStat.CombatPower, isPercentage: false, range: [2, 5] }, { type: CoreStat.Judgment, isPercentage: false, range: [2, 5] }, { type: CoreStat.ThinkingSpeed, isPercentage: true, range: [1, 2] }, { type: CoreStat.Stability, isPercentage: false, range: [2, 5] }, { type: CoreStat.Calculation, isPercentage: false, range: [2, 5] } ],
        2: [ { type: CoreStat.Concentration, isPercentage: true, range: [2, 3] }, { type: CoreStat.CombatPower, isPercentage: false, range: [3, 6] }, { type: CoreStat.Judgment, isPercentage: false, range: [3, 6] }, { type: CoreStat.ThinkingSpeed, isPercentage: true, range: [2, 3] }, { type: CoreStat.Stability, isPercentage: false, range: [3, 6] }, { type: CoreStat.Calculation, isPercentage: false, range: [3, 6] } ],
        3: [ { type: CoreStat.Concentration, isPercentage: true, range: [3, 5] }, { type: CoreStat.CombatPower, isPercentage: false, range: [4, 7] }, { type: CoreStat.Judgment, isPercentage: false, range: [4, 7] }, { type: CoreStat.ThinkingSpeed, isPercentage: true, range: [3, 5] }, { type: CoreStat.Stability, isPercentage: false, range: [4, 7] }, { type: CoreStat.Calculation, isPercentage: false, range: [4, 7] } ],
        4: [ { type: CoreStat.Concentration, isPercentage: true, range: [4, 6] }, { type: CoreStat.CombatPower, isPercentage: false, range: [5, 8] }, { type: CoreStat.Judgment, isPercentage: false, range: [5, 8] }, { type: CoreStat.ThinkingSpeed, isPercentage: true, range: [4, 6] }, { type: CoreStat.Stability, isPercentage: false, range: [5, 8] }, { type: CoreStat.Calculation, isPercentage: false, range: [5, 8] } ],
        5: [ { type: CoreStat.Concentration, isPercentage: true, range: [5, 7] }, { type: CoreStat.CombatPower, isPercentage: false, range: [7, 10] }, { type: CoreStat.Judgment, isPercentage: false, range: [7, 10] }, { type: CoreStat.ThinkingSpeed, isPercentage: true, range: [5, 7] }, { type: CoreStat.Stability, isPercentage: false, range: [7, 10] }, { type: CoreStat.Calculation, isPercentage: false, range: [7, 10] } ],
        6: [ { type: CoreStat.Concentration, isPercentage: true, range: [8, 10] }, { type: CoreStat.CombatPower, isPercentage: false, range: [10, 15] }, { type: CoreStat.Judgment, isPercentage: false, range: [10, 15] }, { type: CoreStat.ThinkingSpeed, isPercentage: true, range: [8, 10] }, { type: CoreStat.Stability, isPercentage: false, range: [10, 15] }, { type: CoreStat.Calculation, isPercentage: false, range: [10, 15] } ]
    },
    [EquipmentSlot.Board]: {
        1: [ { type: CoreStat.Concentration, isPercentage: true, range: [1, 2] }, { type: CoreStat.CombatPower, isPercentage: false, range: [2, 5] }, { type: CoreStat.Judgment, isPercentage: false, range: [2, 5] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [2, 5] }, { type: CoreStat.Stability, isPercentage: true, range: [1, 2] }, { type: CoreStat.Calculation, isPercentage: false, range: [2, 5] } ],
        2: [ { type: CoreStat.Concentration, isPercentage: true, range: [2, 3] }, { type: CoreStat.CombatPower, isPercentage: false, range: [3, 6] }, { type: CoreStat.Judgment, isPercentage: false, range: [3, 6] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [3, 6] }, { type: CoreStat.Stability, isPercentage: true, range: [2, 3] }, { type: CoreStat.Calculation, isPercentage: false, range: [3, 6] } ],
        3: [ { type: CoreStat.Concentration, isPercentage: true, range: [3, 5] }, { type: CoreStat.CombatPower, isPercentage: false, range: [4, 7] }, { type: CoreStat.Judgment, isPercentage: false, range: [4, 7] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [4, 7] }, { type: CoreStat.Stability, isPercentage: true, range: [3, 5] }, { type: CoreStat.Calculation, isPercentage: false, range: [4, 7] } ],
        4: [ { type: CoreStat.Concentration, isPercentage: true, range: [4, 6] }, { type: CoreStat.CombatPower, isPercentage: false, range: [5, 8] }, { type: CoreStat.Judgment, isPercentage: false, range: [5, 8] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [5, 8] }, { type: CoreStat.Stability, isPercentage: true, range: [4, 6] }, { type: CoreStat.Calculation, isPercentage: false, range: [5, 8] } ],
        5: [ { type: CoreStat.Concentration, isPercentage: true, range: [5, 7] }, { type: CoreStat.CombatPower, isPercentage: false, range: [7, 10] }, { type: CoreStat.Judgment, isPercentage: false, range: [7, 10] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [7, 10] }, { type: CoreStat.Stability, isPercentage: true, range: [5, 7] }, { type: CoreStat.Calculation, isPercentage: false, range: [7, 10] } ],
        6: [ { type: CoreStat.Concentration, isPercentage: true, range: [8, 10] }, { type: CoreStat.CombatPower, isPercentage: false, range: [10, 15] }, { type: CoreStat.Judgment, isPercentage: false, range: [10, 15] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [10, 15] }, { type: CoreStat.Stability, isPercentage: true, range: [8, 10] }, { type: CoreStat.Calculation, isPercentage: false, range: [10, 15] } ]
    },
    [EquipmentSlot.Top]: {
        1: [ { type: CoreStat.Concentration, isPercentage: false, range: [2, 5] }, { type: CoreStat.Concentration, isPercentage: true, range: [1, 2] }, { type: CoreStat.CombatPower, isPercentage: true, range: [1, 2] }, { type: CoreStat.CombatPower, isPercentage: false, range: [2, 5] }, { type: CoreStat.Judgment, isPercentage: false, range: [2, 5] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [2, 5] }, { type: CoreStat.ThinkingSpeed, isPercentage: true, range: [1, 2] }, { type: CoreStat.Stability, isPercentage: false, range: [2, 5] }, { type: CoreStat.Stability, isPercentage: true, range: [1, 2] }, { type: CoreStat.Calculation, isPercentage: true, range: [1, 2] } ],
        2: [ { type: CoreStat.Concentration, isPercentage: false, range: [3, 6] }, { type: CoreStat.Concentration, isPercentage: true, range: [2, 3] }, { type: CoreStat.CombatPower, isPercentage: true, range: [2, 3] }, { type: CoreStat.CombatPower, isPercentage: false, range: [3, 6] }, { type: CoreStat.Judgment, isPercentage: false, range: [3, 6] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [3, 6] }, { type: CoreStat.ThinkingSpeed, isPercentage: true, range: [2, 3] }, { type: CoreStat.Stability, isPercentage: false, range: [3, 6] }, { type: CoreStat.Stability, isPercentage: true, range: [2, 3] }, { type: CoreStat.Calculation, isPercentage: true, range: [2, 3] } ],
        3: [ { type: CoreStat.Concentration, isPercentage: false, range: [4, 7] }, { type: CoreStat.Concentration, isPercentage: true, range: [3, 5] }, { type: CoreStat.CombatPower, isPercentage: true, range: [3, 5] }, { type: CoreStat.CombatPower, isPercentage: false, range: [4, 7] }, { type: CoreStat.Judgment, isPercentage: false, range: [4, 7] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [4, 7] }, { type: CoreStat.ThinkingSpeed, isPercentage: true, range: [3, 5] }, { type: CoreStat.Stability, isPercentage: false, range: [4, 7] }, { type: CoreStat.Stability, isPercentage: true, range: [3, 5] }, { type: CoreStat.Calculation, isPercentage: true, range: [3, 5] } ],
        4: [ { type: CoreStat.Concentration, isPercentage: false, range: [5, 8] }, { type: CoreStat.Concentration, isPercentage: true, range: [4, 6] }, { type: CoreStat.CombatPower, isPercentage: true, range: [4, 6] }, { type: CoreStat.CombatPower, isPercentage: false, range: [5, 8] }, { type: CoreStat.Judgment, isPercentage: false, range: [5, 8] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [5, 8] }, { type: CoreStat.ThinkingSpeed, isPercentage: true, range: [4, 6] }, { type: CoreStat.Stability, isPercentage: false, range: [5, 8] }, { type: CoreStat.Stability, isPercentage: true, range: [4, 6] }, { type: CoreStat.Calculation, isPercentage: true, range: [4, 6] } ],
        5: [ { type: CoreStat.Concentration, isPercentage: false, range: [7, 10] }, { type: CoreStat.Concentration, isPercentage: true, range: [5, 7] }, { type: CoreStat.CombatPower, isPercentage: true, range: [5, 7] }, { type: CoreStat.CombatPower, isPercentage: false, range: [7, 10] }, { type: CoreStat.Judgment, isPercentage: false, range: [7, 10] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [7, 10] }, { type: CoreStat.ThinkingSpeed, isPercentage: true, range: [5, 7] }, { type: CoreStat.Stability, isPercentage: false, range: [7, 10] }, { type: CoreStat.Stability, isPercentage: true, range: [5, 7] }, { type: CoreStat.Calculation, isPercentage: true, range: [5, 7] } ],
        6: [ { type: CoreStat.Concentration, isPercentage: false, range: [10, 15] }, { type: CoreStat.Concentration, isPercentage: true, range: [8, 10] }, { type: CoreStat.CombatPower, isPercentage: true, range: [8, 10] }, { type: CoreStat.CombatPower, isPercentage: false, range: [10, 15] }, { type: CoreStat.Judgment, isPercentage: false, range: [10, 15] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [10, 15] }, { type: CoreStat.ThinkingSpeed, isPercentage: true, range: [8, 10] }, { type: CoreStat.Stability, isPercentage: false, range: [10, 15] }, { type: CoreStat.Stability, isPercentage: true, range: [8, 10] }, { type: CoreStat.Calculation, isPercentage: true, range: [8, 10] } ]
    },
    [EquipmentSlot.Bottom]: {
        1: [ { type: CoreStat.Concentration, isPercentage: false, range: [2, 5] }, { type: CoreStat.CombatPower, isPercentage: false, range: [2, 5] }, { type: CoreStat.Judgment, isPercentage: false, range: [2, 5] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [2, 5] }, { type: CoreStat.Stability, isPercentage: false, range: [2, 5] }, { type: CoreStat.Calculation, isPercentage: false, range: [2, 5] } ],
        2: [ { type: CoreStat.Concentration, isPercentage: false, range: [3, 6] }, { type: CoreStat.CombatPower, isPercentage: false, range: [3, 6] }, { type: CoreStat.Judgment, isPercentage: false, range: [3, 6] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [3, 6] }, { type: CoreStat.Stability, isPercentage: false, range: [3, 6] }, { type: CoreStat.Calculation, isPercentage: false, range: [3, 6] } ],
        3: [ { type: CoreStat.Concentration, isPercentage: false, range: [4, 7] }, { type: CoreStat.CombatPower, isPercentage: false, range: [4, 7] }, { type: CoreStat.Judgment, isPercentage: false, range: [4, 7] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [4, 7] }, { type: CoreStat.Stability, isPercentage: false, range: [4, 7] }, { type: CoreStat.Calculation, isPercentage: false, range: [4, 7] } ],
        4: [ { type: CoreStat.Concentration, isPercentage: false, range: [5, 8] }, { type: CoreStat.CombatPower, isPercentage: false, range: [5, 8] }, { type: CoreStat.Judgment, isPercentage: false, range: [5, 8] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [5, 8] }, { type: CoreStat.Stability, isPercentage: false, range: [5, 8] }, { type: CoreStat.Calculation, isPercentage: false, range: [5, 8] } ],
        5: [ { type: CoreStat.Concentration, isPercentage: false, range: [7, 10] }, { type: CoreStat.CombatPower, isPercentage: false, range: [7, 10] }, { type: CoreStat.Judgment, isPercentage: false, range: [7, 10] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [7, 10] }, { type: CoreStat.Stability, isPercentage: false, range: [7, 10] }, { type: CoreStat.Calculation, isPercentage: false, range: [7, 10] } ],
        6: [ { type: CoreStat.Concentration, isPercentage: false, range: [8, 12] }, { type: CoreStat.CombatPower, isPercentage: false, range: [8, 12] }, { type: CoreStat.Judgment, isPercentage: false, range: [8, 12] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [8, 12] }, { type: CoreStat.Stability, isPercentage: false, range: [8, 12] }, { type: CoreStat.Calculation, isPercentage: false, range: [8, 12] } ]
    },
    [EquipmentSlot.Stones]: {
        1: [ { type: CoreStat.Concentration, isPercentage: false, range: [2, 5] }, { type: CoreStat.CombatPower, isPercentage: false, range: [2, 5] }, { type: CoreStat.Judgment, isPercentage: false, range: [2, 5] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [2, 5] }, { type: CoreStat.Stability, isPercentage: false, range: [2, 5] } ],
        2: [ { type: CoreStat.Concentration, isPercentage: false, range: [3, 6] }, { type: CoreStat.CombatPower, isPercentage: false, range: [3, 6] }, { type: CoreStat.Judgment, isPercentage: false, range: [3, 6] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [3, 6] }, { type: CoreStat.Stability, isPercentage: false, range: [3, 6] } ],
        3: [ { type: CoreStat.Concentration, isPercentage: false, range: [4, 7] }, { type: CoreStat.CombatPower, isPercentage: false, range: [4, 7] }, { type: CoreStat.Judgment, isPercentage: false, range: [4, 7] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [4, 7] }, { type: CoreStat.Stability, isPercentage: false, range: [4, 7] } ],
        4: [ { type: CoreStat.Concentration, isPercentage: false, range: [5, 8] }, { type: CoreStat.CombatPower, isPercentage: false, range: [5, 8] }, { type: CoreStat.Judgment, isPercentage: false, range: [5, 8] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [5, 8] }, { type: CoreStat.Stability, isPercentage: false, range: [5, 8] } ],
        5: [ { type: CoreStat.Concentration, isPercentage: false, range: [7, 10] }, { type: CoreStat.CombatPower, isPercentage: false, range: [7, 10] }, { type: CoreStat.Judgment, isPercentage: false, range: [7, 10] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [7, 10] }, { type: CoreStat.Stability, isPercentage: false, range: [7, 10] } ],
        6: [ { type: CoreStat.Concentration, isPercentage: false, range: [8, 12] }, { type: CoreStat.CombatPower, isPercentage: false, range: [8, 12] }, { type: CoreStat.Judgment, isPercentage: false, range: [8, 12] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [8, 12] }, { type: CoreStat.Stability, isPercentage: false, range: [8, 12] } ]
    },
    [EquipmentSlot.Bowl]: {
        1: [ { type: CoreStat.Concentration, isPercentage: false, range: [2, 5] }, { type: CoreStat.CombatPower, isPercentage: false, range: [2, 5] }, { type: CoreStat.Judgment, isPercentage: false, range: [2, 5] }, { type: CoreStat.Stability, isPercentage: false, range: [2, 5] }, { type: CoreStat.Calculation, isPercentage: false, range: [2, 5] } ],
        2: [ { type: CoreStat.Concentration, isPercentage: false, range: [3, 6] }, { type: CoreStat.CombatPower, isPercentage: false, range: [3, 6] }, { type: CoreStat.Judgment, isPercentage: false, range: [3, 6] }, { type: CoreStat.Stability, isPercentage: false, range: [3, 6] }, { type: CoreStat.Calculation, isPercentage: false, range: [3, 6] } ],
        3: [ { type: CoreStat.Concentration, isPercentage: false, range: [4, 7] }, { type: CoreStat.CombatPower, isPercentage: false, range: [4, 7] }, { type: CoreStat.Judgment, isPercentage: false, range: [4, 7] }, { type: CoreStat.Stability, isPercentage: false, range: [4, 7] }, { type: CoreStat.Calculation, isPercentage: false, range: [4, 7] } ],
        4: [ { type: CoreStat.Concentration, isPercentage: false, range: [5, 8] }, { type: CoreStat.CombatPower, isPercentage: false, range: [5, 8] }, { type: CoreStat.Judgment, isPercentage: false, range: [5, 8] }, { type: CoreStat.Stability, isPercentage: false, range: [5, 8] }, { type: CoreStat.Calculation, isPercentage: false, range: [5, 8] } ],
        5: [ { type: CoreStat.Concentration, isPercentage: false, range: [7, 10] }, { type: CoreStat.CombatPower, isPercentage: false, range: [7, 10] }, { type: CoreStat.Judgment, isPercentage: false, range: [7, 10] }, { type: CoreStat.Stability, isPercentage: false, range: [7, 10] }, { type: CoreStat.Calculation, isPercentage: false, range: [7, 10] } ],
        6: [ { type: CoreStat.Concentration, isPercentage: false, range: [8, 12] }, { type: CoreStat.CombatPower, isPercentage: false, range: [8, 12] }, { type: CoreStat.Judgment, isPercentage: false, range: [8, 12] }, { type: CoreStat.Stability, isPercentage: false, range: [8, 12] }, { type: CoreStat.Calculation, isPercentage: false, range: [8, 12] } ]
    },
};