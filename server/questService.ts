import * as types from '../types/index.js';
// FIX: Corrected import path for constants.
import { DAILY_QUESTS, WEEKLY_QUESTS, MONTHLY_QUESTS, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, SINGLE_PLAYER_MISSIONS } from '../constants/index.js';
import { isDifferentDayKST, isDifferentWeekKST, isDifferentMonthKST } from '../utils/timeUtils.js';
import { createDefaultQuests } from './initialData.js';

const generateQuestsFromPool = (questPool: Omit<types.Quest, 'id' | 'progress' | 'isClaimed'>[]): types.Quest[] => {
    return questPool.map(q => ({
        ...q,
        id: `quest-${globalThis.crypto.randomUUID()}`,
        progress: 0,
        isClaimed: false,
    }));
};

export const resetAndGenerateQuests = async (user: types.User): Promise<types.User> => {
    const now = Date.now();
    const updatedUser: types.User = JSON.parse(JSON.stringify(user));
    let modified = false;

    // Ensure quests object and its properties exist and are objects before any further processing.
    // This is the core fix to prevent crashes from malformed data.
    if (!updatedUser.quests || typeof updatedUser.quests !== 'object' || updatedUser.quests === null) {
        updatedUser.quests = createDefaultQuests();
        modified = true;
    }
    if (!updatedUser.quests.daily || typeof updatedUser.quests.daily !== 'object') {
        updatedUser.quests.daily = createDefaultQuests().daily;
        modified = true;
    }
    if (!updatedUser.quests.weekly || typeof updatedUser.quests.weekly !== 'object') {
        updatedUser.quests.weekly = createDefaultQuests().weekly;
        modified = true;
    }
    if (!updatedUser.quests.monthly || typeof updatedUser.quests.monthly !== 'object') {
        updatedUser.quests.monthly = createDefaultQuests().monthly;
        modified = true;
    }


    // Daily Quests check
    const dailyQuestTitlesFromConst = new Set(DAILY_QUESTS.map(q => q.title));
    const userDailyQuests = updatedUser.quests.daily.quests || [];
    const dailyQuestTitlesFromUser = new Set(userDailyQuests.map(q => q.title));
    const areDailyQuestsOutdated = userDailyQuests.length !== dailyQuestTitlesFromConst.size || ![...dailyQuestTitlesFromUser].every(title => dailyQuestTitlesFromConst.has(title));

    if (isDifferentDayKST(updatedUser.quests.daily.lastReset, now) || areDailyQuestsOutdated) {
        updatedUser.quests.daily = {
            quests: generateQuestsFromPool(DAILY_QUESTS),
            activityProgress: 0,
            claimedMilestones: [false, false, false, false, false],
            lastReset: now,
        };
        updateQuestProgress(updatedUser, 'login');
        modified = true;
    }

    // Weekly Quests check
    const weeklyQuestTitlesFromConst = new Set(WEEKLY_QUESTS.map(q => q.title));
    const userWeeklyQuests = updatedUser.quests.weekly.quests || [];
    const weeklyQuestTitlesFromUser = new Set(userWeeklyQuests.map(q => q.title));
    const areWeeklyQuestsOutdated = userWeeklyQuests.length !== weeklyQuestTitlesFromConst.size || ![...weeklyQuestTitlesFromUser].every(title => weeklyQuestTitlesFromConst.has(title));
    
    if (isDifferentWeekKST(updatedUser.quests.weekly.lastReset, now) || areWeeklyQuestsOutdated) {
        updatedUser.quests.weekly = {
            quests: generateQuestsFromPool(WEEKLY_QUESTS),
            activityProgress: 0,
            claimedMilestones: [false, false, false, false, false],
            lastReset: now,
        };
        modified = true;
    }
    
    // Monthly Quests check
    const monthlyQuestTitlesFromConst = new Set(MONTHLY_QUESTS.map(q => q.title));
    const userMonthlyQuests = updatedUser.quests.monthly.quests || [];
    const monthlyQuestTitlesFromUser = new Set(userMonthlyQuests.map(q => q.title));
    const areMonthlyQuestsOutdated = userMonthlyQuests.length !== monthlyQuestTitlesFromConst.size || ![...monthlyQuestTitlesFromUser].every(title => monthlyQuestTitlesFromConst.has(title));

    if (isDifferentMonthKST(updatedUser.quests.monthly.lastReset, now) || areMonthlyQuestsOutdated) {
        updatedUser.quests.monthly = {
            quests: generateQuestsFromPool(MONTHLY_QUESTS),
            activityProgress: 0,
            claimedMilestones: [false, false, false, false, false],
            lastReset: now,
        };
        modified = true;
    }

    // Daily Guild Boss Attempt Reset
    if (isDifferentDayKST(updatedUser.lastGuildBossAttemptDate, now)) {
        updatedUser.guildBossAttempts = 0;
        updatedUser.lastGuildBossAttemptDate = now;
        modified = true;
    }

    const tournamentTypes = [types.TournamentType.Neighborhood, types.TournamentType.National, types.TournamentType.World];
    for (const type of tournamentTypes) {
        const playedDateKey = `last${type.charAt(0).toUpperCase() + type.slice(1)}PlayedDate` as keyof types.User;
        const rewardClaimedKey = `${type}RewardClaimed` as keyof types.User;
        const tournamentKey = `last${type.charAt(0).toUpperCase() + type.slice(1)}Tournament` as keyof types.User;

        if (isDifferentDayKST((updatedUser as any)[playedDateKey], now)) {
            (updatedUser as any)[playedDateKey] = undefined;
            (updatedUser as any)[rewardClaimedKey] = undefined;
            (updatedUser as any)[tournamentKey] = null;
            modified = true;
        }
    }

    return modified ? updatedUser : user;
};

export const updateQuestProgress = (user: types.User, type: 'win' | 'participate' | 'action_button' | 'tournament_participate' | 'enhancement_attempt' | 'craft_attempt' | 'chat_greeting' | 'tournament_complete' | 'login' | 'claim_daily_milestone_100' | 'claim_weekly_milestone_100' | 'tower_challenge_participate' | 'claim_single_player_mission' | 'tournament_match_played' | 'guild_donate' | 'guild_boss_participate', mode?: types.GameMode, amount: number = 1) => {
    if (!user.quests) return;
    const isStrategic = mode ? SPECIAL_GAME_MODES.some(m => m.mode === mode) : false;
    const isPlayful = mode ? PLAYFUL_GAME_MODES.some(m => m.mode === mode) : false;

    const processQuestList = (questData: types.DailyQuestData | types.WeeklyQuestData | types.MonthlyQuestData | undefined) => {
        if (!questData || !questData.quests) return;

        for (const quest of questData.quests) {
            if (quest.isClaimed) continue;

            let shouldUpdate = false;
            switch (type) {
                case 'login': shouldUpdate = quest.title === '출석하기'; break;
                case 'chat_greeting': shouldUpdate = quest.title === '채팅창에 인사하기'; break;
                case 'guild_donate': shouldUpdate = quest.title === '길드 기부하기'; break;
                case 'participate':
                    if (isStrategic && quest.title === '전략바둑 플레이하기') shouldUpdate = true;
                    if (isPlayful && quest.title === '놀이바둑 플레이하기') shouldUpdate = true;
                    break;
                case 'action_button': shouldUpdate = quest.title === '액션버튼 사용하기'; break;
                case 'enhancement_attempt': shouldUpdate = quest.title === '장비 강화시도'; break;
                case 'craft_attempt': shouldUpdate = quest.title === '재료 합성시도'; break;
                case 'claim_daily_milestone_100': shouldUpdate = quest.title === '일일 퀘스트 활약도100 보상받기'; break;
                case 'claim_weekly_milestone_100': shouldUpdate = quest.title === '주간 퀘스트 활약도100 보상받기'; break;
                case 'tower_challenge_participate': shouldUpdate = quest.title === '도전의탑 도전하기'; break;
                case 'claim_single_player_mission': shouldUpdate = quest.title === '싱글플레이 수련과제 수령하기'; break;
                case 'tournament_match_played': shouldUpdate = quest.title === '자동대국 토너먼트 경기하기'; break;
                case 'guild_boss_participate': shouldUpdate = quest.title === '길드보스전 참여하기'; break;
            }

            if (shouldUpdate) {
                quest.progress = Math.min(quest.target, quest.progress + amount);
            }
        }
    };

    processQuestList(user.quests.daily);
    processQuestList(user.quests.weekly);
    processQuestList(user.quests.monthly);
};

export const accumulateMissionRewards = (user: types.User): types.User => {
    if (!user.singlePlayerMissions) {
        return user;
    }

    const now = Date.now();
    let modified = false;
    // Create a deep copy to avoid direct mutation of the input object
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

        // If it's already full, just ensure the last collection time is up to date to prevent re-calculation.
        if (missionState.accumulatedAmount >= missionInfo.maxCapacity) {
            // No need to update time if it's already full and not being collected
            continue;
        }
        
        const lastCollectionTime = missionState.lastCollectionTime || now;
        const elapsedMs = now - lastCollectionTime;
        const productionIntervalMs = missionInfo.productionRateMinutes * 60 * 1000;

        if (elapsedMs > 0 && productionIntervalMs > 0) {
            const rewardsGenerated = Math.floor(elapsedMs / productionIntervalMs);

            if (rewardsGenerated > 0) {
                const currentAmount = missionState.accumulatedAmount || 0;
                const newAmount = Math.min(missionInfo.maxCapacity, currentAmount + rewardsGenerated);

                if (newAmount > currentAmount) {
                    missionState.accumulatedAmount = newAmount;
                    // Important: only update lastCollectionTime by the amount of time we've processed
                    missionState.lastCollectionTime = lastCollectionTime + (rewardsGenerated * productionIntervalMs);
                    modified = true;
                }
            }
        } else if (missionState.lastCollectionTime === 0) {
            // First time it runs for this mission
            missionState.lastCollectionTime = now;
            modified = true;
        }
    }

    return modified ? updatedUser : user;
};
