// server/services/mannerService.ts
import { User, MannerEffects, CoreStat, Guild } from '../../types/index.js';
import { regenerateActionPoints } from './effectService.js';
import { createDefaultSpentStatPoints } from '../initialData.js';
import { getMannerRank } from '../../utils/mannerUtils.js';
import * as db from '../db.js';

export const applyMannerRankChange = async (user: User, oldMannerScore: number): Promise<void> => {
    const guilds = await db.getKV<Record<string, Guild>>('guilds') || {};
    const guild = user.guildId ? (guilds[user.guildId] ?? null) : null;
    const tempUserWithOldScore = { ...user, mannerScore: oldMannerScore };
    const regeneratedUser = regenerateActionPoints(tempUserWithOldScore as User, guild);
    
    user.actionPoints = regeneratedUser.actionPoints;
    user.lastActionPointUpdate = regeneratedUser.lastActionPointUpdate;

    const newMannerScore = user.mannerScore ?? 200;
    const oldRank = getMannerRank(oldMannerScore).rank;
    const newRank = getMannerRank(newMannerScore).rank;

    if (newRank === '마스터' && oldRank !== '마스터' && !user.mannerMasteryApplied) {
        user.mannerMasteryApplied = true;
    } else if (newRank !== '마스터' && oldRank === '마스터' && user.mannerMasteryApplied) {
        user.mannerMasteryApplied = false;
        
        const spentStats = user.spentStatPoints || createDefaultSpentStatPoints();
        const statKeys = Object.keys(spentStats) as CoreStat[];
        const levelPoints = (user.strategyLevel - 1) * 2 + (user.playfulLevel - 1) * 2;
        const bonusStatPoints = user.bonusStatPoints || 0;
        const totalAvailablePoints = levelPoints + bonusStatPoints;
        let totalSpent = statKeys.reduce((sum, key) => sum + spentStats[key], 0);

        let pointsToRetrieve = totalSpent - totalAvailablePoints;

        if (pointsToRetrieve > 0) {
             while (pointsToRetrieve > 0 && totalSpent > 0) {
                const availableStats = statKeys.filter(key => spentStats[key] > 0);
                if (availableStats.length === 0) break;
                
                const randomStat = availableStats[Math.floor(Math.random() * availableStats.length)];
                
                spentStats[randomStat]--;
                pointsToRetrieve--;
                totalSpent--;
            }
        }
        user.spentStatPoints = spentStats;
    }
};