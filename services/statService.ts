

// FIX: Import missing types from the centralized types file.
import { User, CoreStat, InventoryItem, SpecialStat, MythicStat, ItemOptionType } from '../types.js';
import { calculateUserEffects } from './effectService.js';

// This function is moved from the client to the server.
export const calculateTotalStats = (user: User): Record<CoreStat, number> => {
    const finalStats: Record<CoreStat, number> = {} as any;
    
    // 1. Start with base stats and spent points
    const baseWithSpent: Record<CoreStat, number> = {} as any;
    // FIX: Cast Object.values to CoreStat[] to ensure type safety when indexing.
    for (const key of Object.values(CoreStat) as CoreStat[]) {
        baseWithSpent[key] = (user.baseStats?.[key] || 0) + (user.spentStatPoints?.[key] || 0);
    }

    // 2. Get equipment bonuses from effect service
    const effects = calculateUserEffects(user);
    const bonuses = effects.coreStatBonuses;

    // 3. Calculate final stats
    // FIX: Cast Object.values to CoreStat[] to ensure type safety when indexing.
    for (const key of Object.values(CoreStat) as CoreStat[]) {
        const baseValue = baseWithSpent[key];
        // FIX: Ensure bonuses[key] is accessed with a correctly typed key.
        const flatBonus = bonuses[key].flat;
        const percentBonus = bonuses[key].percent;
        // FIX: Perform arithmetic operations with correctly typed numbers.
        const finalValue = Math.floor((Number(baseValue) + Number(flatBonus)) * (1 + Number(percentBonus) / 100));
        finalStats[key] = finalValue;
    }
    
    return finalStats;
};