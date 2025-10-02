

import { User, CoreStat, Guild } from '../types/index.js';
// FIX: Import `calculateUserEffects` from the correct utility file.
import { calculateUserEffects } from '../../utils/statUtils.js';

export const calculateTotalStats = (user: User, guild: Guild | null): Record<CoreStat, number> => {
    const finalStats: Record<CoreStat, number> = {} as any;
    
    const baseWithSpent: Record<CoreStat, number> = {} as any;
    for (const key of Object.values(CoreStat) as CoreStat[]) {
        baseWithSpent[key] = (user.baseStats?.[key] || 0) + (user.spentStatPoints?.[key] || 0);
    }

    const effects = calculateUserEffects(user, guild);
    const bonuses = effects.coreStatBonuses;

    for (const key of Object.values(CoreStat) as CoreStat[]) {
        const baseValue = baseWithSpent[key];
        const flatBonus = bonuses[key].flat;
        const percentBonus = bonuses[key].percent;
        const finalValue = Math.floor((Number(baseValue) + Number(flatBonus)) * (1 + Number(percentBonus) / 100));
        finalStats[key] = finalValue;
    }
    
    return finalStats;
};
