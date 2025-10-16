// server/services/mannerService.ts
import { User, Guild, MannerEffects, CoreStat } from '../../types/index.js';
import { ACTION_POINT_REGEN_INTERVAL_MS } from '../../constants.js';
import { getMannerRank } from '../../utils/mannerUtils.js';
import * as db from '../db.js';
import { regenerateActionPoints } from './effectService.js';
import { getDb } from '../db/connection.js';

export const applyMannerRankChange = async (user: User, oldMannerScore: number): Promise<void> => {
    // FIX: Removed dbPool argument. db.getKV takes no arguments.
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
    }
};
