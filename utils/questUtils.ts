import * as types from '../types/index.js';
import { SINGLE_PLAYER_MISSIONS, MISSION_LEVEL_DATA } from '../constants/index.js';

export const getMissionInfoWithLevel = (missionInfo: types.SinglePlayerMissionInfo, level: number): types.SinglePlayerMissionInfo => {
    let newInfo = { ...missionInfo };
    if (level < 1) level = 1;
    if (level > 10) level = 10;

    const levelDataArray = MISSION_LEVEL_DATA[missionInfo.id];
    if (!levelDataArray) {
        console.warn(`[getMissionInfoWithLevel] Mission level data not found for ID: ${missionInfo.id}`);
        return newInfo; // Fallback to base info if not found
    }
    
    const levelData = levelDataArray[level - 1];
    if (!levelData) {
        console.warn(`[getMissionInfoWithLevel] Data for level ${level} not found for mission ID: ${missionInfo.id}`);
        return newInfo; // Fallback if level data for that level doesn't exist
    }

    newInfo.productionRateMinutes = levelData.speed / 60;
    newInfo.rewardAmount = levelData.amount;
    newInfo.maxCapacity = levelData.capacity;
    
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
