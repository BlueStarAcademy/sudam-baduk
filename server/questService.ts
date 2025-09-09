

import { randomUUID } from 'crypto';
import * as types from '../types.js';
// FIX: Implement and export resetAndGenerateQuests to resolve missing module member error in server.ts. Also import quest constants.
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, DAILY_QUESTS, WEEKLY_QUESTS, MONTHLY_QUESTS } from '../constants.js';
import { isDifferentDayKST, isDifferentWeekKST, isDifferentMonthKST } from '../utils/timeUtils.js';

const selectRandomQuests = (questPool: Omit<types.Quest, 'id' | 'progress' | 'isClaimed'>[], count: number): types.Quest[] => {
    const shuffled = [...questPool].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count).map(q => ({
        ...q,
        id: `quest-${randomUUID()}`,
        progress: 0,
        isClaimed: false,
    }));
};

export const resetAndGenerateQuests = async (user: types.User): Promise<types.User> => {
    const now = Date.now();
    let userModified = false;
    // Create a mutable copy to work with
    const updatedUser: types.User = JSON.parse(JSON.stringify(user));

    if (!updatedUser.quests) {
        updatedUser.quests = { daily: undefined, weekly: undefined, monthly: undefined };
    }

    // Daily quests
    if (!updatedUser.quests.daily || isDifferentDayKST(updatedUser.quests.daily.lastReset, now)) {
        updatedUser.quests.daily = {
            quests: selectRandomQuests(DAILY_QUESTS, 5),
            activityProgress: 0,
            claimedMilestones: [false, false, false, false, false],
            lastReset: now,
        };
        // Auto-complete login quest upon reset
        updateQuestProgress(updatedUser, 'login');
        userModified = true;
    }

    // Weekly quests
    if (!updatedUser.quests.weekly || isDifferentWeekKST(updatedUser.quests.weekly.lastReset, now)) {
        updatedUser.quests.weekly = {
            quests: selectRandomQuests(WEEKLY_QUESTS, 5),
            activityProgress: 0,
            claimedMilestones: [false, false, false, false, false],
            lastReset: now,
        };
        userModified = true;
    }

    // Monthly quests
    if (!updatedUser.quests.monthly || isDifferentMonthKST(updatedUser.quests.monthly.lastReset, now)) {
        updatedUser.quests.monthly = {
            quests: selectRandomQuests(MONTHLY_QUESTS, 3),
            activityProgress: 0,
            claimedMilestones: [false, false, false, false, false],
            lastReset: now,
        };
        userModified = true;
    }

    // Return the modified user object if changes were made, otherwise the original
    return userModified ? updatedUser : user;
};


export const updateQuestProgress = (user: types.User, type: 'win' | 'participate' | 'action_button' | 'tournament_participate' | 'enhancement_attempt' | 'craft_attempt' | 'chat_greeting' | 'tournament_complete' | 'login' | 'claim_daily_milestone_100' | 'claim_weekly_milestone_100', mode?: types.GameMode, amount: number = 1) => {
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
            case '전략바둑 승리하기': if (type === 'win' && isStrategic) shouldUpdate = true; break;
            case '놀이바둑 승리하기': if (type === 'win' && isPlayful) shouldUpdate = true; break;
            case '액션버튼 사용하기': if (type === 'action_button') shouldUpdate = true; break;
            case '자동대국 토너먼트 완료하기': if (type === 'tournament_complete') shouldUpdate = true; break;
            case '자동대국 토너먼트 참여하기': if (type === 'tournament_participate') shouldUpdate = true; break;
            case '장비 강화시도': if (type === 'enhancement_attempt') shouldUpdate = true; break;
            case '재료 합성시도': if (type === 'craft_attempt') shouldUpdate = true; break;
            case '일일퀘스트 활약도100보상 받기(3/3)': if (type === 'claim_daily_milestone_100') shouldUpdate = true; break;
            case '일일 퀘스트 활약도100 보상받기 10회': if (type === 'claim_daily_milestone_100') shouldUpdate = true; break;
            case '주간퀘스트 활약도100보상 받기(2/2)': if (type === 'claim_weekly_milestone_100') shouldUpdate = true; break;
        }

        if (shouldUpdate) {
            quest.progress = Math.min(quest.target, quest.progress + amount);
        }
    }
};