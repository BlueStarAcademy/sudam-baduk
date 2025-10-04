import * as types from '../types/index.js';
import { SINGLE_PLAYER_MISSIONS } from '../constants/index.js';

export const getMissionInfoWithLevel = (missionInfo: types.SinglePlayerMissionInfo, level: number): types.SinglePlayerMissionInfo => {
    let newInfo = { ...missionInfo };
    if (level <= 1) return newInfo;

    if (newInfo.rewardType === 'gold') {
        let maxCapacity = newInfo.maxCapacity;
        // Start from level 2 for upgrades
        for (let i = 2; i <= level; i++) {
            if (i < 10) {
                maxCapacity *= 1.2;
            } else { // i == 10
                maxCapacity *= 1.4;
            }
        }
        newInfo.maxCapacity = Math.floor(maxCapacity);
    } else { // diamond
        let maxCapacity = newInfo.maxCapacity;
        let productionRate = newInfo.productionRateMinutes;
        for (let i = 2; i <= level; i++) {
            maxCapacity += 1;
            if (i === 10) {
                productionRate -= 20;
            }
        }
        newInfo.maxCapacity = maxCapacity;
        newInfo.productionRateMinutes = productionRate;
    }
    return newInfo;
};


export const accumulateMissionRewards = (user: types.User): types.User => {
    if (!user.singlePlayerMissions) {
        return user;
    }

    const now = Date.now();
    let modified = false;
    const updatedUser = JSON.parse(JSON.stringify(user));

    for (const missionId in updatedUser.singlePlayerMissions) {
        const missionState = updatedUser.singlePlayerMissions[missionId];
        if (!missionState.isStarted) {
            continue;
        }

        const missionInfo = SINGLE_PLAYER_MISSIONS.find(m => m.id === missionId);
        if (!missionInfo) {
            continue;
        }
        
        const currentAmount = missionState.claimableAmount || 0;
        const level = missionState.level || 1;
        const leveledMissionInfo = getMissionInfoWithLevel(missionInfo, level);

        if (currentAmount >= leveledMissionInfo.maxCapacity) {
            continue;
        }
        
        const lastCollectionTime = missionState.lastCollectionTime || now;
        const elapsedMs = now - lastCollectionTime;
        const productionIntervalMs = leveledMissionInfo.productionRateMinutes * 60 * 1000;

        if (elapsedMs > 0 && productionIntervalMs > 0) {
            const rewardsToGenerate = Math.floor(elapsedMs / productionIntervalMs);

            if (rewardsToGenerate > 0) {
                const amountGenerated = rewardsToGenerate * leveledMissionInfo.rewardAmount;
                const timeConsumed = rewardsToGenerate * productionIntervalMs;
                
                const newClaimableAmount = Math.min(leveledMissionInfo.maxCapacity, currentAmount + amountGenerated);
                
                missionState.claimableAmount = newClaimableAmount;
                missionState.lastCollectionTime = lastCollectionTime + timeConsumed;
                modified = true;
            }
        }
    }

    return modified ? updatedUser : user;
};
