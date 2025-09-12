
// FIX: Import missing types from the centralized types file.
import { User, CoreStat, InventoryItem, SpecialStat, MythicStat, ItemOptionType } from '../types.js';
import { ACTION_POINT_REGEN_INTERVAL_MS } from '../constants.js';

export interface MannerEffects {
    maxActionPoints: number;
    actionPointRegenInterval: number;
    goldBonusPercent: number;
    itemDropRateBonus: number;
    mannerActionButtonBonus: number;
    rewardMultiplier: number;
    enhancementSuccessRateBonus: number;
}

// This function was moved from mannerService to break a circular dependency
export const getMannerEffects = (user: User): MannerEffects => {
    const score = user.mannerScore ?? 200;
    const effects: MannerEffects = {
        maxActionPoints: 30,
        actionPointRegenInterval: ACTION_POINT_REGEN_INTERVAL_MS,
        goldBonusPercent: 0,
        itemDropRateBonus: 0,
        mannerActionButtonBonus: 0,
        rewardMultiplier: 1,
        enhancementSuccessRateBonus: 0,
    };

    // Apply cumulative positive effects
    if (score >= 400) { // 좋음
        effects.maxActionPoints += 10;
    }
    if (score >= 800) { // 매우 좋음
        effects.goldBonusPercent += 10;
    }
    if (score >= 1200) { // 품격
        effects.itemDropRateBonus += 10;
    }
    if (score >= 1600) { // 프로
        effects.enhancementSuccessRateBonus += 10;
    }
    // 마스터 (2000+) is handled via mannerMasteryApplied flag for stat points

    // Apply cumulative negative effects
    if (score <= 199) { // 주의
        effects.mannerActionButtonBonus += 1;
    }
    if (score <= 99) { // 나쁨
        effects.rewardMultiplier *= 0.5;
    }
    if (score <= 49) { // 매우 나쁨
        effects.actionPointRegenInterval = 20 * 60 * 1000; // 20 minutes
    }
    if (score <= 0) { // 최악
        effects.maxActionPoints = Math.floor(effects.maxActionPoints * 0.1);
    }
    
    return effects;
};

export interface CalculatedEffects extends MannerEffects {
    coreStatBonuses: Record<CoreStat, { flat: number; percent: number }>;
    specialStatBonuses: Record<SpecialStat, { flat: number; percent: number }>;
    mythicStatBonuses: Record<string, { flat: number; percent: number }>;
}

export const calculateUserEffects = (user: User): CalculatedEffects => {
    // Start with manner effects
    const effects = getMannerEffects(user);

    const calculatedEffects: CalculatedEffects = {
        ...effects,
        coreStatBonuses: {} as Record<CoreStat, { flat: number; percent: number }>,
        specialStatBonuses: {} as Record<SpecialStat, { flat: number; percent: number }>,
        mythicStatBonuses: {} as Record<string, { flat: number; percent: number; }>,
    };

    // Initialize bonus records
    // FIX: Cast Object.values to CoreStat[] to ensure type safety when indexing.
    for (const key of Object.values(CoreStat) as CoreStat[]) {
        calculatedEffects.coreStatBonuses[key] = { flat: 0, percent: 0 };
    }
    for (const key of Object.values(SpecialStat)) {
        calculatedEffects.specialStatBonuses[key] = { flat: 0, percent: 0 };
    }
    for (const key of Object.values(MythicStat)) {
        calculatedEffects.mythicStatBonuses[key] = { flat: 0, percent: 0 };
    }

    const equippedItems = user.inventory.filter(i => i.isEquipped && i.type === 'equipment' && i.options);

    // Add equipment effects
    for (const item of equippedItems) {
        const allOptions = [item.options!.main, ...item.options!.combatSubs, ...item.options!.specialSubs, ...item.options!.mythicSubs];
        for (const opt of allOptions) {
            if (!opt) continue;

            const { type, value, isPercentage } = opt;

            if (Object.values(CoreStat).includes(type as CoreStat)) {
                if (isPercentage) {
                    calculatedEffects.coreStatBonuses[type as CoreStat].percent += value;
                } else {
                    calculatedEffects.coreStatBonuses[type as CoreStat].flat += value;
                }
            } else if (Object.values(SpecialStat).includes(type as SpecialStat)) {
                 if (isPercentage) {
                    calculatedEffects.specialStatBonuses[type as SpecialStat].percent += value;
                } else {
                    calculatedEffects.specialStatBonuses[type as SpecialStat].flat += value;
                }
            } else if (Object.values(MythicStat).includes(type as MythicStat)) {
                // Mythic stats are generally flat values (e.g., +1 item)
                calculatedEffects.mythicStatBonuses[type as MythicStat].flat += value;
            }
        }
    }
    
    // Update manner effects based on equipment bonuses
    calculatedEffects.maxActionPoints += calculatedEffects.specialStatBonuses[SpecialStat.ActionPointMax].flat;
    const regenBonusPercent = calculatedEffects.specialStatBonuses[SpecialStat.ActionPointRegen].percent;
    if (regenBonusPercent > 0) {
        calculatedEffects.actionPointRegenInterval = Math.floor(calculatedEffects.actionPointRegenInterval / (1 + regenBonusPercent / 100));
    }
    
    return calculatedEffects;
};

export const regenerateActionPoints = async (user: User): Promise<User> => {
    const effects = calculateUserEffects(user);
    const now = Date.now();
    
    const calculatedMaxAP = effects.maxActionPoints;
    let userModified = false;
    const updatedUser = JSON.parse(JSON.stringify(user));

    if (updatedUser.actionPoints.max !== calculatedMaxAP) {
        updatedUser.actionPoints.max = calculatedMaxAP;
        userModified = true;
    }
    
    if (updatedUser.actionPoints.current >= calculatedMaxAP) {
        if (updatedUser.lastActionPointUpdate !== 0) {
             updatedUser.lastActionPointUpdate = 0;
             userModified = true;
        }
        return userModified ? updatedUser : user;
    }

    if (updatedUser.lastActionPointUpdate === 0) {
        updatedUser.lastActionPointUpdate = now;
        userModified = true;
    }

    const lastUpdate = updatedUser.lastActionPointUpdate;
    if (typeof lastUpdate !== 'number' || isNaN(lastUpdate)) {
        updatedUser.lastActionPointUpdate = now;
        return updatedUser;
    }

    const elapsedMs = now - lastUpdate;
    const pointsToAdd = Math.floor(elapsedMs / effects.actionPointRegenInterval);

    if (pointsToAdd > 0) {
        userModified = true;
        updatedUser.actionPoints.current = Math.min(calculatedMaxAP, updatedUser.actionPoints.current + pointsToAdd);
        updatedUser.lastActionPointUpdate = lastUpdate + pointsToAdd * effects.actionPointRegenInterval;
        
        if(updatedUser.actionPoints.current >= calculatedMaxAP) {
            updatedUser.lastActionPointUpdate = 0;
        }
    }
    return userModified ? updatedUser : user;
};
