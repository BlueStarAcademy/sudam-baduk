import { randomUUID } from 'crypto';
import * as types from '../types.js';
import { DAILY_QUESTS, WEEKLY_QUESTS, MONTHLY_QUESTS, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants.js';
import { isDifferentDayKST, isDifferentWeekKST, isDifferentMonthKST } from '../utils/timeUtils.js';
import { createDefaultQuests } from './initialData.js';

const generateQuestsFromPool = (questPool: Omit<types.Quest, 'id' | 'progress' | 'isClaimed'>[]): types.Quest[] => {
    return questPool.map(q => ({
        ...q,
        id: `quest-${randomUUID()}`,
        progress: 0,
        isClaimed: false,
    }));
};

export const resetAndGenerateQuests = async (user: types.User): Promise<types.User> => {
    const now = Date.now();
    const updatedUser: types.User = JSON.parse(JSON.stringify(user));
    let modified = false;

    if (!updatedUser.quests) {
        updatedUser.quests = createDefaultQuests();
        modified = true;
    }

    // Daily Quests check
    const dailyQuestTitlesFromConst = new Set(DAILY_QUESTS.map(q => q.title));
    const userDailyQuests = updatedUser.quests.daily?.quests || [];
    const dailyQuestTitlesFromUser = new Set(userDailyQuests.map(q => q.title));
    const areDailyQuestsOutdated = userDailyQuests.length !== dailyQuestTitlesFromConst.size || ![...dailyQuestTitlesFromUser].every(title => dailyQuestTitlesFromConst.has(title));

    if (!updatedUser.quests.daily || isDifferentDayKST(updatedUser.quests.daily.lastReset, now) || areDailyQuestsOutdated) {
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
    const userWeeklyQuests = updatedUser.quests.weekly?.quests || [];
    const weeklyQuestTitlesFromUser = new Set(userWeeklyQuests.map(q => q.title));
    const areWeeklyQuestsOutdated = userWeeklyQuests.length !== weeklyQuestTitlesFromConst.size || ![...weeklyQuestTitlesFromUser].every(title => weeklyQuestTitlesFromConst.has(title));
    
    if (!updatedUser.quests.weekly || isDifferentWeekKST(updatedUser.quests.weekly.lastReset, now) || areWeeklyQuestsOutdated) {
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
    const userMonthlyQuests = updatedUser.quests.monthly?.quests || [];
    const monthlyQuestTitlesFromUser = new Set(userMonthlyQuests.map(q => q.title));
    const areMonthlyQuestsOutdated = userMonthlyQuests.length !== monthlyQuestTitlesFromConst.size || ![...monthlyQuestTitlesFromUser].every(title => monthlyQuestTitlesFromConst.has(title));

    if (!updatedUser.quests.monthly || isDifferentMonthKST(updatedUser.quests.monthly.lastReset, now) || areMonthlyQuestsOutdated) {
        updatedUser.quests.monthly = {
            quests: generateQuestsFromPool(MONTHLY_QUESTS),
            activityProgress: 0,
            claimedMilestones: [false, false, false, false, false],
            lastReset: now,
        };
        modified = true;
    }

    const tournamentTypes: types.TournamentType[] = ['neighborhood', 'national', 'world'];
    for (const type of tournamentTypes) {
        const playedDateKey = `last${type.charAt(0).toUpperCase() + type.slice(1)}PlayedDate` as keyof types.User;
        const rewardClaimedKey = `${type}RewardClaimed` as keyof types.User;
        const tournamentKey = `last${type.charAt(0).toUpperCase() + type.slice(1)}Tournament` as keyof types.User;

        if (isDifferentDayKST((user as any)[playedDateKey], now)) {
            (updatedUser as any)[playedDateKey] = undefined;
            (updatedUser as any)[rewardClaimedKey] = undefined;
            (updatedUser as any)[tournamentKey] = null;
            modified = true;
        }
    }

    return modified ? updatedUser : user;
};

export const updateQuestProgress = (user: types.User, type: 'win' | 'participate' | 'action_button' | 'tournament_participate' | 'enhancement_attempt' | 'craft_attempt' | 'chat_greeting' | 'tournament_complete' | 'login' | 'claim_daily_milestone_100' | 'claim_weekly_milestone_100' | 'tower_challenge_participate' | 'claim_single_player_mission' | 'tournament_match_played', mode?: types.GameMode, amount: number = 1) => {
    if (!user.quests) return;
    const isStrategic = mode ? SPECIAL_GAME_MODES.some(m => m.mode === mode) : false;
    const isPlayful = mode ? PLAYFUL_GAME_MODES.some((m: { mode: types.GameMode; }) => m.mode === mode) : false;

    const questsToUpdate: types.Quest[] = [
        ...(user.quests.daily?.quests || []),
        ...(user.quests.weekly?.quests || []),
        ...(user.quests.monthly?.quests || [])
    ];

    for (const quest of questsToUpdate) {
        if (quest.isClaimed) continue;

        let shouldUpdate = false;
        switch (quest.title) {
            case '출석하기': if (type === 'login') shouldUpdate = true; break;
            case '채팅창에 인사하기': if (type === 'chat_greeting') shouldUpdate = true; break;
            case '전략바둑 플레이하기': if (type === 'participate' && isStrategic) shouldUpdate = true; break;
            case '놀이바둑 플레이하기': if (type === 'participate' && isPlayful) shouldUpdate = true; break;
            case '액션버튼 사용하기': if (type === 'action_button') shouldUpdate = true; break;
            case '장비 강화시도': if (type === 'enhancement_attempt') shouldUpdate = true; break;
            case '재료 합성시도': if (type === 'craft_attempt') shouldUpdate = true; break;
            case '일일 퀘스트 활약도100 보상받기': if (type === 'claim_daily_milestone_100') shouldUpdate = true; break;
            case '주간 퀘스트 활약도100 보상받기': if (type === 'claim_weekly_milestone_100') shouldUpdate = true; break;
            case '도전의탑 도전하기': if (type === 'tower_challenge_participate') shouldUpdate = true; break;
            case '싱글플레이 수련과제 수령하기': if (type === 'claim_single_player_mission') shouldUpdate = true; break;
            case '자동대국 토너먼트 경기하기': if (type === 'tournament_match_played') shouldUpdate = true; break;
            case '자동대국 토너먼트 참여하기': if (type === 'tournament_participate') shouldUpdate = true; break;
        }

        if (shouldUpdate) {
            quest.progress = Math.min(quest.target, quest.progress + amount);
        }
    }
};