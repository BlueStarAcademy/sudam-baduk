import { randomUUID } from 'crypto';
import * as db from '../db.js';
import { type ServerAction, type User, type VolatileState, InventoryItem, Quest, QuestLog, InventoryItemType, TournamentType, TournamentState, QuestReward, ItemOption, CoreStat, SpecialStat, MythicStat, EquipmentSlot, ItemGrade, Player, Mail, HandleActionResult } from '../../types.js';
import { updateQuestProgress } from '../questService.js';
import { SHOP_ITEMS, createItemFromTemplate, pickRandom } from '../shop.js';
import { 
    CONSUMABLE_ITEMS, 
    MATERIAL_ITEMS, 
    GRADE_LEVEL_REQUIREMENTS,
    ITEM_SELL_PRICES,
    MATERIAL_SELL_PRICES,
    ENHANCEMENT_COSTS,
    ENHANCEMENT_SUCCESS_RATES,
    ENHANCEMENT_FAIL_BONUS_RATES,
    GRADE_SUB_OPTION_RULES,
    SUB_OPTION_POOLS,
    SYNTHESIS_COSTS,
    SYNTHESIS_UPGRADE_CHANCES,
    EQUIPMENT_POOL
} from '../../constants.js';
import { addItemsToInventory as addItemsToInventoryUtil } from '../../utils/inventoryUtils.js';
import * as effectService from '../effectService.js';


const currencyBundles: Record<string, { type: 'gold' | 'diamonds', min: number, max: number }> = {
    '골드 꾸러미1': { type: 'gold', min: 10, max: 500 },
    '골드 꾸러미2': { type: 'gold', min: 100, max: 1000 },
    '골드 꾸러미3': { type: 'gold', min: 500, max: 3000 },
    '골드 꾸러미4': { type: 'gold', min: 1000, max: 10000 },
    '다이아 꾸러미1': { type: 'diamonds', min: 1, max: 20 },
    '다이아 꾸러미2': { type: 'diamonds', min: 10, max: 30 },
    '다이아 꾸러미3': { type: 'diamonds', min: 20, max: 50 },
    '다이아 꾸러미4': { type: 'diamonds', min: 30, max: 100 },
};

const getRandomInt = (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

const removeUserItems = (user: User, itemsToRemove: { name: string; amount: number }[]): boolean => {
    const inventory = user.inventory;
    const materialCounts: Record<string, number> = {};
    inventory.filter(i => i.type === 'material').forEach(i => {
        materialCounts[i.name] = (materialCounts[i.name] || 0) + (i.quantity || 0);
    });

    for (const item of itemsToRemove) {
        if ((materialCounts[item.name] || 0) < item.amount) {
            return false; // Not enough materials
        }
    }

    for (const item of itemsToRemove) {
        let amountToRemove = item.amount;
        for (let i = inventory.length - 1; i >= 0; i--) {
            if (inventory[i].name === item.name) {
                if ((inventory[i].quantity || 0) > amountToRemove) {
                    inventory[i].quantity! -= amountToRemove;
                    amountToRemove = 0;
                } else {
                    amountToRemove -= (inventory[i].quantity || 0);
                    inventory.splice(i, 1);
                }
            }
            if (amountToRemove <= 0) break;
        }
    }
    return true;
};


export const handleInventoryAction = async (volatileState: VolatileState, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult> => {
    const { type, payload } = action;

    switch (type) {
        case 'USE_ITEM': {
            const { itemId } = payload;
            const itemIndex = user.inventory.findIndex(i => i.id === itemId);
            if (itemIndex === -1) return { error: '아이템을 찾을 수 없습니다.' };
        
            const itemToConsume = user.inventory[itemIndex];
            if (itemToConsume.type !== 'consumable') return { error: '사용할 수 없는 아이템입니다.' };

            if (itemToConsume.name === '싱글플레이 초기화권') {
                user.singlePlayerProgress = 0;
                user.singlePlayerMissions = {}; // Reset all missions
                 if (itemToConsume.quantity && itemToConsume.quantity > 1) {
                    itemToConsume.quantity--;
                } else {
                    user.inventory.splice(itemIndex, 1);
                }
                await db.updateUser(user);
                return { clientResponse: { updatedUser: user } };
            }
        
            // Handle currency bundles
            const bundleInfo = currencyBundles[itemToConsume.name];
            if (bundleInfo) {
                const amount = getRandomInt(bundleInfo.min, bundleInfo.max);
                let obtainedItem: Partial<InventoryItem>;
        
                if (bundleInfo.type === 'gold') {
                    user.gold += amount;
                    obtainedItem = { name: '골드', quantity: amount, image: '/images/Gold.png', type: 'material', grade: 'uncommon' };
                } else {
                    user.diamonds += amount;
                    obtainedItem = { name: '다이아', quantity: amount, image: '/images/Zem.png', type: 'material', grade: 'rare' };
                }
        
                if (itemToConsume.quantity && itemToConsume.quantity > 1) {
                    itemToConsume.quantity--;
                } else {
                    user.inventory.splice(itemIndex, 1);
                }
                await db.updateUser(user);
                return { clientResponse: { obtainedItemsBulk: [obtainedItem], updatedUser: user } };
            }
        
            // Handle other consumable items (boxes, potions, etc.)
            const shopItemKey = Object.keys(SHOP_ITEMS).find(key => SHOP_ITEMS[key as keyof typeof SHOP_ITEMS].name === itemToConsume.name);
            if (!shopItemKey) {
                return { error: '알 수 없는 아이템입니다.' };
            }
        
            const shopItem = SHOP_ITEMS[shopItemKey as keyof typeof SHOP_ITEMS];

            if (itemToConsume.name.includes('컨디션 물약')) {
                return { error: '컨디션 물약은 토너먼트 경기 시작 전에만 사용할 수 있습니다.' };
            }

            const obtainedItems = shopItem.onPurchase();
            const itemsArray = Array.isArray(obtainedItems) ? obtainedItems : [obtainedItems];
            
            // Create a new inventory array representing the state AFTER consumption.
            let inventoryAfterConsumption: InventoryItem[];
            if (itemToConsume.quantity && itemToConsume.quantity > 1) {
                inventoryAfterConsumption = user.inventory.map(i => 
                    i.id === itemId ? { ...i, quantity: (i.quantity as number) - 1 } : i
                );
            } else {
                inventoryAfterConsumption = user.inventory.filter(i => i.id !== itemId);
            }
            
            // Check for space using a deep copy, because the utility function mutates its input.
            const inventoryForCheck = JSON.parse(JSON.stringify(inventoryAfterConsumption));
            const { success } = addItemsToInventoryUtil(inventoryForCheck, user.inventorySlots, itemsArray);
            
            if (!success) {
                return { error: '인벤토리 공간이 부족합니다.' };
            }
            
            // Apply the changes to the actual user object.
            user.inventory = inventoryAfterConsumption;
            addItemsToInventoryUtil(user.inventory, user.inventorySlots, itemsArray);
            
            await db.updateUser(user);
            return { clientResponse: { obtainedItemsBulk: itemsArray, updatedUser: user } };
        }
        
        case 'USE_ITEM_BULK': {
            const { itemName, quantity } = payload;
            if (quantity <= 0) return { error: "수량은 1 이상이어야 합니다." };

            const itemsToUse = user.inventory.filter(i => i.name === itemName && i.type === 'consumable');
            if (itemsToUse.length === 0) return { error: '사용할 아이템이 없습니다.' };

            const totalAvailable = itemsToUse.reduce((sum, i) => sum + (i.quantity || 1), 0);
            if (quantity > totalAvailable) return { error: '보유한 수량보다 많이 사용할 수 없습니다.' };

            const allObtainedItems: InventoryItem[] = [];
            let totalGoldGained = 0;
            let totalDiamondsGained = 0;

            const shopItemKey = Object.keys(SHOP_ITEMS).find(key => SHOP_ITEMS[key as keyof typeof SHOP_ITEMS].name === itemName);
            const bundleInfo = currencyBundles[itemName];

            for (let i = 0; i < quantity; i++) {
                if (bundleInfo) {
                    const amount = getRandomInt(bundleInfo.min, bundleInfo.max);
                    if (bundleInfo.type === 'gold') totalGoldGained += amount;
                    else totalDiamondsGained += amount;
                } else if (shopItemKey) {
                    const shopItem = SHOP_ITEMS[shopItemKey as keyof typeof SHOP_ITEMS];
                    const openedItems = shopItem.onPurchase();
                    if (Array.isArray(openedItems)) allObtainedItems.push(...openedItems);
                    else allObtainedItems.push(openedItems);
                }
            }

            let quantityToRemove = quantity;
            const inventoryAfterRemoval = user.inventory.map(invItem => {
                if (invItem.name === itemName && invItem.type === 'consumable' && quantityToRemove > 0) {
                    const amountInStack = invItem.quantity || 1;
                    if (amountInStack > quantityToRemove) {
                        const newQuantity = amountInStack - quantityToRemove;
                        quantityToRemove = 0;
                        return { ...invItem, quantity: newQuantity };
                    } else {
                        quantityToRemove -= amountInStack;
                        return null;
                    }
                }
                return invItem;
            }).filter((i): i is InventoryItem => i !== null);

            const { success: hasSpace } = addItemsToInventoryUtil([...inventoryAfterRemoval], user.inventorySlots, allObtainedItems);
            if (!hasSpace) return { error: '모든 아이템을 받기에 가방 공간이 부족합니다.' };

            user.inventory = inventoryAfterRemoval;
            user.gold += totalGoldGained;
            user.diamonds += totalDiamondsGained;
            addItemsToInventoryUtil(user.inventory, user.inventorySlots, allObtainedItems);

            await db.updateUser(user);

            const clientResponseItems = [...allObtainedItems];
            if (totalGoldGained > 0) clientResponseItems.push({ name: '골드', quantity: totalGoldGained, image: '/images/Gold.png', type: 'material', grade: 'uncommon' } as any);
            if (totalDiamondsGained > 0) clientResponseItems.push({ name: '다이아', quantity: totalDiamondsGained, image: '/images/Zem.png', type: 'material', grade: 'rare' } as any);
            
            return { clientResponse: { obtainedItemsBulk: clientResponseItems, updatedUser: user } };
        }

        case 'TOGGLE_EQUIP_ITEM': {
            const { itemId } = payload;
            const itemToToggle = user.inventory.find(i => i.id === itemId);
    
            if (!itemToToggle || itemToToggle.type !== 'equipment' || !itemToToggle.slot) {
                return { error: 'Invalid equipment item.' };
            }
            
            const requiredLevel = GRADE_LEVEL_REQUIREMENTS[itemToToggle.grade];
            const userLevelSum = user.strategyLevel + user.playfulLevel;

            if (!itemToToggle.isEquipped && userLevelSum < requiredLevel) {
                 return { error: `착용 레벨 합이 부족합니다. (필요: ${requiredLevel}, 현재: ${userLevelSum})` };
            }

            if (itemToToggle.isEquipped) {
                itemToToggle.isEquipped = false;
                delete user.equipment[itemToToggle.slot];
            } else {
                const currentItemInSlot = user.inventory.find(
                    i => i.isEquipped && i.slot === itemToToggle.slot
                );
                if (currentItemInSlot) {
                    currentItemInSlot.isEquipped = false;
                }
                itemToToggle.isEquipped = true;
                user.equipment[itemToToggle.slot] = itemToToggle.id;
            }
            
            const effects = effectService.calculateUserEffects(user);
            user.actionPoints.max = effects.maxActionPoints;
            user.actionPoints.current = Math.min(user.actionPoints.current, user.actionPoints.max);
            
            await db.updateUser(user);
            return {};
        }

        case 'SELL_ITEM': {
            const { itemId } = payload;
            const itemIndex = user.inventory.findIndex(i => i.id === itemId);
            if (itemIndex === -1) return { error: '아이템을 찾을 수 없습니다.' };

            const item = user.inventory[itemIndex];
            let sellPrice = 0;

            if (item.type === 'equipment') {
                if (item.isEquipped) {
                    return { error: '장착 중인 아이템은 판매할 수 없습니다.' };
                }
                const basePrice = ITEM_SELL_PRICES[item.grade] || 0;
                const enhancementMultiplier = Math.pow(1.2, item.stars);
                sellPrice = Math.floor(basePrice * enhancementMultiplier);
            } else if (item.type === 'material') {
                const pricePerUnit = MATERIAL_SELL_PRICES[item.name] || 1; 
                sellPrice = pricePerUnit * (item.quantity || 1);
            } else {
                return { error: '판매할 수 없는 아이템입니다. (소모품 판매 불가)' };
            }

            user.gold += sellPrice;
            user.inventory.splice(itemIndex, 1);

            await db.updateUser(user);
            return {};
        }

        case 'ENHANCE_ITEM': {
            const { itemId } = payload;
            const item = user.inventory.find(i => i.id === itemId);
            if (!item || item.type !== 'equipment' || !item.options) return { error: '강화할 수 없는 아이템입니다.' };
            if (item.stars >= 10) return { error: '최대 강화 레벨입니다.' };

            const targetStars = item.stars + 1;
            const userLevelSum = user.strategyLevel + user.playfulLevel;
            const enhancementLevelRequirements: Record<number, number> = {
                4: 3,
                7: 8,
                10: 15,
            };

            if (enhancementLevelRequirements[targetStars] && userLevelSum < enhancementLevelRequirements[targetStars]) {
                return { error: `+${targetStars}강화 시도에는 유저 레벨 합 ${enhancementLevelRequirements[targetStars]}이(가) 필요합니다.` };
            }
            
            const originalItemState = JSON.parse(JSON.stringify(item));

            const costs = ENHANCEMENT_COSTS[item.grade]?.[item.stars];
            if (!costs) return { error: '강화 정보를 찾을 수 없습니다.' };

            if (!user.isAdmin) {
                if (!removeUserItems(user, costs)) {
                    return { error: '재료가 부족합니다.' };
                }
            }
            
            updateQuestProgress(user, 'enhancement_attempt');

            const baseSuccessRate = ENHANCEMENT_SUCCESS_RATES[item.stars];
            const failBonusRate = ENHANCEMENT_FAIL_BONUS_RATES[item.grade] || 0.5;
            const failBonus = (item.enhancementFails || 0) * failBonusRate;
            const successRate = Math.min(100, baseSuccessRate + failBonus);

            const isSuccess = Math.random() * 100 < successRate;
            let resultMessage = '';

            if (isSuccess) {
                item.stars++;
                item.enhancementFails = 0;
                resultMessage = `강화 성공! +${item.stars} ${item.name}이(가) 되었습니다.`;
                
                const main = item.options.main;
                if(main.baseValue) {
                    let increaseMultiplier = 1;
                    if ([3, 6, 9].includes(item.stars - 1)) {
                        increaseMultiplier = 2;
                    }
                    const increaseAmount = main.baseValue * increaseMultiplier;
                    main.value = parseFloat((main.value + increaseAmount).toFixed(2));
                    main.display = `${main.type} +${main.value}${main.isPercentage ? '%' : ''}`;
                }

                if (item.options.combatSubs.length < 4) {
                    const rules = GRADE_SUB_OPTION_RULES[item.grade];
                    const existingSubTypes = new Set([main.type, ...item.options.combatSubs.map(s => s.type)]);
                    const combatTier = rules.combatTier;
                    const combatPool = SUB_OPTION_POOLS[item.slot!][combatTier].filter(opt => !existingSubTypes.has(opt.type));
                    if(combatPool.length > 0) {
                        const newSubDef = pickRandom(combatPool);
                        combatPool.splice(combatPool.indexOf(newSubDef), 1);
                        
                        const value = getRandomInt(newSubDef.range[0], newSubDef.range[1]);
                        const newSub: ItemOption = {
                            type: newSubDef.type,
                            value,
                            isPercentage: newSubDef.isPercentage,
                            display: `${newSubDef.type} +${value}${newSubDef.isPercentage ? '%' : ''} [${newSubDef.range[0]}~${newSubDef.range[1]}]`,
                            range: newSubDef.range,
                            enhancements: 0,
                        };
                        item.options.combatSubs.push(newSub);
                    }
                } else {
                    const subToUpgrade = item.options.combatSubs[Math.floor(Math.random() * item.options.combatSubs.length)];
                    subToUpgrade.enhancements = (subToUpgrade.enhancements || 0) + 1;
        
                    const itemTier = GRADE_SUB_OPTION_RULES[item.grade].combatTier;
                    const subOptionPool = SUB_OPTION_POOLS[item.slot!][itemTier];
                    const subDef = subOptionPool.find(s => s.type === subToUpgrade.type && s.isPercentage === subToUpgrade.isPercentage);
        
                    if (subDef) {
                        const increaseAmount = getRandomInt(subDef.range[0], subDef.range[1]);
                        subToUpgrade.value += increaseAmount;
        
                        if (!subToUpgrade.range) {
                            subToUpgrade.range = [subDef.range[0], subDef.range[1]];
                        } else {
                            subToUpgrade.range[0] += subDef.range[0];
                            subToUpgrade.range[1] += subDef.range[1];
                        }
                        
                        subToUpgrade.display = `${subToUpgrade.type} +${subToUpgrade.value}${subToUpgrade.isPercentage ? '%' : ''} [${subToUpgrade.range[0]}~${subToUpgrade.range[1]}]`;

                    } else {
                        subToUpgrade.value = parseFloat((subToUpgrade.value * 1.1).toFixed(2));
                        subToUpgrade.display = `${subToUpgrade.type} +${subToUpgrade.value}${subToUpgrade.isPercentage ? '%' : ''}`;
                    }
                }

            } else {
                item.enhancementFails = (item.enhancementFails || 0) + 1;
                const newFailBonus = item.enhancementFails * failBonusRate;
                resultMessage = `강화에 실패했습니다. (실패 보너스: +${newFailBonus.toFixed(1).replace(/\.0$/, '')}%)`;
            }
            
            await db.updateUser(user);
            const itemBeforeEnhancement = JSON.parse(JSON.stringify(originalItemState));
            return { 
                clientResponse: { 
                    enhancementOutcome: { 
                        message: resultMessage, 
                        success: isSuccess, 
                        itemBefore: itemBeforeEnhancement, 
                        itemAfter: item 
                    },
                    enhancementAnimationTarget: { itemId: item.id, stars: item.stars } 
                } 
            };
        }
        case 'DISASSEMBLE_ITEM': {
            const { itemIds } = payload as { itemIds: string[] };
            if (!itemIds || itemIds.length === 0) return { error: '분해할 아이템을 선택하세요.' };

            const gainedMaterials: Record<string, number> = {};
            const itemsToRemove: string[] = [];

            for (const itemId of itemIds) {
                const item = user.inventory.find((i: InventoryItem) => i.id === itemId);
                if (item && item.type === 'equipment' && !item.isEquipped) {
                    const enhancementIndex = Math.min(item.stars, 9);
                    const costsForNextLevel = ENHANCEMENT_COSTS[item.grade]?.[enhancementIndex];
                    if (costsForNextLevel) {
                        for (const cost of costsForNextLevel) {
                            const yieldAmount = Math.floor(cost.amount * 0.25);
                            if (yieldAmount > 0) {
                                gainedMaterials[cost.name] = (gainedMaterials[cost.name] || 0) + yieldAmount;
                            }
                        }
                    }
                    itemsToRemove.push(itemId);
                }
            }

            if (itemsToRemove.length === 0) return { error: '분해할 수 있는 아이템이 없습니다.' };

            const isJackpot = Math.random() < 0.30;
            if (isJackpot) {
                for (const key in gainedMaterials) {
                    gainedMaterials[key] *= 2;
                }
            }
            
            const itemsToAdd: InventoryItem[] = Object.entries(gainedMaterials).map(([name, quantity]) => ({
                ...MATERIAL_ITEMS[name], id: '', quantity, createdAt: 0, isEquipped: false, level: 1, stars: 0
            }));
            
            user.inventory = user.inventory.filter(item => !itemsToRemove.includes(item.id));
            const { success } = addItemsToInventoryUtil(user.inventory, user.inventorySlots, itemsToAdd);
            if (!success) return { error: '재료를 받기에 인벤토리 공간이 부족합니다.' };

            await db.updateUser(user);

            return { clientResponse: { disassemblyResult: { gained: Object.entries(gainedMaterials).map(([name, amount]) => ({ name, amount })), jackpot: isJackpot } } };
        }
        case 'CRAFT_MATERIAL': {
            const { materialName, craftType, quantity } = payload as { materialName: string, craftType: 'upgrade' | 'downgrade', quantity: number };
            const materialTiers = ['하급 강화석', '중급 강화석', '상급 강화석', '최상급 강화석', '신비의 강화석'];
            const tierIndex = materialTiers.indexOf(materialName);
            if (tierIndex === -1) return { error: '잘못된 재료입니다.' };
        
            let fromMaterialName: string, toMaterialName: string, fromCost: number, toYield: number;
        
            if (craftType === 'upgrade') {
                if (tierIndex >= materialTiers.length - 1) return { error: '더 이상 제작할 수 없습니다.' };
                fromMaterialName = materialTiers[tierIndex];
                toMaterialName = materialTiers[tierIndex + 1];
                fromCost = 10 * quantity;
                toYield = 1 * quantity;
            } else { // downgrade
                if (tierIndex === 0) return { error: '더 이상 분해할 수 없습니다.' };
                fromMaterialName = materialTiers[tierIndex];
                toMaterialName = materialTiers[tierIndex - 1];
                fromCost = 1 * quantity;
                toYield = 5 * quantity;
            }
        
            const tempUser = JSON.parse(JSON.stringify(user));
        
            if (!user.isAdmin) {
                if (!removeUserItems(tempUser, [{ name: fromMaterialName, amount: fromCost }])) {
                    return { error: '재료가 부족합니다.' };
                }
            }
        
            const toAddTemplate = MATERIAL_ITEMS[toMaterialName];
            const itemsToAdd: InventoryItem[] = [{
                ...toAddTemplate, id: `item-${randomUUID()}`, quantity: toYield, createdAt: 0, isEquipped: false, level: 1, stars: 0
            }];
        
            const { success } = addItemsToInventoryUtil(tempUser.inventory, tempUser.inventorySlots, itemsToAdd);
            if (!success) {
                return { error: '인벤토리에 공간이 부족합니다.' };
            }
        
            user.inventory = tempUser.inventory;
            
            updateQuestProgress(user, 'craft_attempt');
            await db.updateUser(user);
        
            return {
                clientResponse: {
                    craftResult: {
                        gained: [{ name: toMaterialName, amount: toYield }],
                        used: [{ name: fromMaterialName, amount: fromCost }],
                        craftType
                    }
                }
            };
        }
        case 'SYNTHESIZE_EQUIPMENT': {
            const { itemIds } = payload as { itemIds: string[] };
            if (!itemIds || itemIds.length !== 3) {
                return { error: '합성에는 3개의 장비가 필요합니다.' };
            }
        
            const itemsToSynthesize = user.inventory.filter(i => itemIds.includes(i.id));
            if (itemsToSynthesize.length !== 3) {
                return { error: '선택된 아이템 중 일부를 찾을 수 없습니다.' };
            }
        
            if (itemsToSynthesize.some(i => i.type !== 'equipment')) {
                return { error: '장비 아이템만 합성할 수 있습니다.' };
            }
            
            const firstItemGrade = itemsToSynthesize[0].grade;
            if (itemsToSynthesize.some(i => i.grade !== firstItemGrade)) {
                return { error: '같은 등급의 장비만 합성할 수 있습니다.' };
            }
            
            if (itemsToSynthesize.some(i => i.isEquipped)) {
                return { error: '장착 중인 아이템은 합성 재료로 사용할 수 없습니다.' };
            }
        
            const synthesisCost = SYNTHESIS_COSTS[firstItemGrade];
            if (user.gold < synthesisCost && !user.isAdmin) {
                return { error: `골드가 부족합니다. (필요: ${synthesisCost})` };
            }
        
            if ((user.inventory.length - 3 + 1) > user.inventorySlots) {
                 return { error: '인벤토리 공간이 부족합니다.' };
            }
            
            if (!user.isAdmin) {
                user.gold -= synthesisCost;
            }
            user.inventory = user.inventory.filter(i => !itemIds.includes(i.id));
        
            const upgradeChance = SYNTHESIS_UPGRADE_CHANCES[firstItemGrade];
            const roll = Math.random() * 100;
            let wasUpgraded = roll < upgradeChance;
            let newGrade: ItemGrade;
            let isDoubleMythic = false;
        
            const gradeOrder: ItemGrade[] = ['normal', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
            const currentGradeIndex = gradeOrder.indexOf(firstItemGrade);
        
            if (firstItemGrade === 'mythic') {
                wasUpgraded = roll < upgradeChance; // This represents the chance for double mythic option
                isDoubleMythic = wasUpgraded;
                newGrade = 'mythic';
            } else {
                newGrade = wasUpgraded && currentGradeIndex < gradeOrder.length - 1 
                    ? gradeOrder[currentGradeIndex + 1] 
                    : firstItemGrade;
            }
            
            const possibleSlots = [...new Set(itemsToSynthesize.map(i => i.slot))].filter((s): s is EquipmentSlot => s !== null);
            if (possibleSlots.length === 0) {
                return { error: '합성 재료의 부위를 결정할 수 없습니다.' };
            }
            const newSlot = possibleSlots[Math.floor(Math.random() * possibleSlots.length)];
            
            const templatePool = EQUIPMENT_POOL.filter(item => item.grade === newGrade && item.slot === newSlot);
            let template: (typeof EQUIPMENT_POOL)[0];
        
            if (templatePool.length === 0) {
                const anyTemplateOfGrade = EQUIPMENT_POOL.filter(item => item.grade === newGrade);
                if (anyTemplateOfGrade.length === 0) {
                     console.error(`[Synthesis] Could not find ANY template for grade ${newGrade}.`);
                    return { error: '결과 아이템을 생성할 수 없습니다. (템플릿 없음)' };
                }
                const fallbackTemplate = anyTemplateOfGrade[Math.floor(Math.random() * anyTemplateOfGrade.length)];
                template = { ...fallbackTemplate, slot: newSlot };
            } else {
                template = templatePool[Math.floor(Math.random() * templatePool.length)];
            }
            
            const newItem = createItemFromTemplate(template, { forceDoubleMythic: isDoubleMythic });
            
            user.inventory.push(newItem);
            
            updateQuestProgress(user, 'craft_attempt');
            await db.updateUser(user);
        
            return { clientResponse: { synthesisResult: { item: newItem, wasUpgraded: wasUpgraded } } };
        }

        default:
            return { error: `Unknown inventory action: ${type}` };
    }
};