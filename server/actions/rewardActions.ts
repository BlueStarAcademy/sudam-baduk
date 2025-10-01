import * as db from '../db.js';
import { type ServerAction, type User, type VolatileState, InventoryItem, QuestReward, SinglePlayerStageInfo, SinglePlayerMissionInfo, Guild, ItemGrade, Quest } from '../../types/index.js';
import { DAILY_MILESTONE_REWARDS, WEEKLY_MILESTONE_REWARDS, MONTHLY_MILESTONE_REWARDS } from '../../constants/quests.js';
import { CONSUMABLE_ITEMS } from '../../constants/items.js';
import { SINGLE_PLAYER_STAGES, SINGLE_PLAYER_MISSIONS } from '../../constants/singlePlayerConstants.js';
import { DAILY_MILESTONE_THRESHOLDS, WEEKLY_MILESTONE_THRESHOLDS, MONTHLY_MILESTONE_THRESHOLDS } from '../../constants/quests.js';
import { updateQuestProgress } from '../questService.js';
import * as currencyService from '../currencyService.js';
import { isSameDayKST } from '../../utils/timeUtils.js';
import { calculateUserEffects } from '../services/effectService.js';
import { SHOP_ITEMS } from '../shop.js';
import { currencyBundles } from '../../constants/index.js';
// FIX: Import inventory utility functions to resolve 'Cannot find name' errors.
import { createItemInstancesFromReward, addItemsToInventory } from '../../utils/inventoryUtils.js';

const getRandomInt = (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const grantReward = (user: User, reward: QuestReward, reason: string): InventoryItem[] => {
    let addedItems: InventoryItem[] = [];
    if (reward.gold) currencyService.grantGold(user, reward.gold, reason);
    if (reward.diamonds) currencyService.grantDiamonds(user, reward.diamonds, reason);
    if (reward.actionPoints) {
        user.actionPoints.current = Math.min(user.actionPoints.max, user.actionPoints.current + reward.actionPoints);
    }
    if (reward.exp) {
        if (reward.exp.type === 'strategy') {
            user.strategyXp += reward.exp.amount;
        } else {
            user.playfulXp += reward.exp.amount;
        }
    }
    if (reward.guildCoins) {
        user.guildCoins = (user.guildCoins || 0) + reward.guildCoins;
    }
    if (reward.items) {
        const itemInstances = createItemInstancesFromReward(reward.items);
        const result = addItemsToInventory(user.inventory, user.inventorySlots, itemInstances);
        if (result.success) {
            addedItems = itemInstances;
        } else {
            // TODO: Mail items if inventory is full
        }
    }
    if (reward.bonus && reward.bonus.startsWith('스탯+')) {
        const points = parseInt(reward.bonus.replace('스탯+', ''), 10);
        if (!isNaN(points)) {
            user.bonusStatPoints = (user.bonusStatPoints || 0) + points;
        }
    }
    return addedItems;
};

export const handleRewardAction = async (volatileState: VolatileState, action: ServerAction & { userId: string }, user: User): Promise<{ 
    clientResponse?: any;
    error?: string;
}> => {
    const { type, payload } = action;

    switch(type) {
        case 'CLAIM_MAIL_ATTACHMENTS': {
            const { mailId } = payload;
            const mail = user.mail.find(m => m.id === mailId);
            if (!mail || !mail.attachments || mail.attachmentsClaimed) {
                return { error: 'Invalid mail or attachments already claimed.' };
            }

            const addedItems = grantReward(user, mail.attachments as QuestReward, `${mail.title} 우편 보상`);
            mail.attachmentsClaimed = true;

            await db.updateUser(user);
            return { 
                clientResponse: { 
                    updatedUser: user,
                    rewardSummary: { reward: mail.attachments, items: addedItems, title: `${mail.title} 보상` }
                } 
            };
        }
        case 'CLAIM_ALL_MAIL_ATTACHMENTS': {
            let totalGold = 0;
            let totalDiamonds = 0;
            let totalActionPoints = 0;
            const allAddedItems: InventoryItem[] = [];

            for (const mail of user.mail) {
                if (mail.attachments && !mail.attachmentsClaimed) {
                    const added = grantReward(user, mail.attachments as QuestReward, `${mail.title} 우편 일괄수령`);
                    allAddedItems.push(...added);
                    mail.attachmentsClaimed = true;
                    totalGold += mail.attachments.gold || 0;
                    totalDiamonds += mail.attachments.diamonds || 0;
                    totalActionPoints += mail.attachments.actionPoints || 0;
                }
            }
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user, claimAllSummary: { gold: totalGold, diamonds: totalDiamonds, actionPoints: totalActionPoints, items: allAddedItems } } };
        }
        case 'MARK_MAIL_AS_READ': {
            const { mailId } = payload;
            const mail = user.mail.find(m => m.id === mailId);
            if (mail && !mail.isRead) {
                mail.isRead = true;
                await db.updateUser(user);
                return { clientResponse: { updatedUser: user } };
            }
            return {};
        }
        case 'DELETE_MAIL': {
            const { mailId } = payload;
            user.mail = user.mail.filter(m => m.id !== mailId);
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }
        case 'DELETE_ALL_CLAIMED_MAIL': {
            user.mail = user.mail.filter(m => {
                return !(m.attachments && m.attachmentsClaimed);
            });
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }
        case 'CLAIM_QUEST_REWARD': {
            const { questId } = payload;
            const questLists = {
                daily: user.quests.daily.quests,
                weekly: user.quests.weekly.quests,
                monthly: user.quests.monthly.quests,
            };

            let foundQuest: Quest | null = null;
            let questType: 'daily' | 'weekly' | 'monthly' | null = null;

            for (const type of Object.keys(questLists) as Array<keyof typeof questLists>) {
                const quest = questLists[type].find(q => q.id === questId);
                if (quest) {
                    foundQuest = quest;
                    questType = type;
                    break;
                }
            }

            if (!foundQuest || foundQuest.isClaimed || foundQuest.progress < foundQuest.target) {
                return { error: 'Invalid quest or not completed.' };
            }

            if (questType) {
                const questData = user.quests[questType];
                questData.activityProgress = (questData.activityProgress || 0) + foundQuest.activityPoints;
            }
            
            const addedItems = grantReward(user, foundQuest.reward, `${foundQuest.title} 퀘스트 보상`);
            foundQuest.isClaimed = true;

            await db.updateUser(user);
            return { 
                clientResponse: { 
                    updatedUser: user,
                    rewardSummary: { reward: foundQuest.reward, items: addedItems, title: `${foundQuest.title} 보상` }
                } 
            };
        }
        case 'CLAIM_ACTIVITY_MILESTONE': {
            const { milestoneIndex } = payload;
            const questType = payload.questType as 'daily' | 'weekly' | 'monthly';
            if (!['daily', 'weekly', 'monthly'].includes(questType)) {
                return { error: 'Invalid quest type.' };
            }
            
            const questData = user.quests[questType];
            const rewards = { daily: DAILY_MILESTONE_REWARDS, weekly: WEEKLY_MILESTONE_REWARDS, monthly: MONTHLY_MILESTONE_REWARDS }[questType];
            const thresholds = { daily: DAILY_MILESTONE_THRESHOLDS, weekly: WEEKLY_MILESTONE_THRESHOLDS, monthly: MONTHLY_MILESTONE_THRESHOLDS }[questType];
            
            if (!questData || questData.claimedMilestones[milestoneIndex] || questData.activityProgress < thresholds[milestoneIndex]) {
                return { error: "Cannot claim this milestone." };
            }
            
            const reward = rewards[milestoneIndex];
            const addedItems = grantReward(user, reward, `${questType} 활약도 ${thresholds[milestoneIndex]} 보상`);
            questData.claimedMilestones[milestoneIndex] = true;
            
            if (questType === 'daily' && milestoneIndex === 4) updateQuestProgress(user, 'claim_daily_milestone_100');
            if (questType === 'weekly' && milestoneIndex === 4) updateQuestProgress(user, 'claim_weekly_milestone_100');
            
            await db.updateUser(user);
            return { 
                clientResponse: { 
                    updatedUser: user,
                    rewardSummary: { reward, items: addedItems, title: `활약도 보상` }
                } 
            };
        }
        case 'CLAIM_SINGLE_PLAYER_MISSION_REWARD': {
            const { missionId } = payload;
            const missionState = user.singlePlayerMissions[missionId];
            if (!missionState || !missionState.isStarted || missionState.accumulatedAmount < 1) {
                return { error: '수령할 보상이 없습니다.' };
            }
        
            const missionInfo = SINGLE_PLAYER_MISSIONS.find(m => m.id === missionId);
            if (!missionInfo) return { error: '미션 정보를 찾을 수 없습니다.' };

            const wasAtMax = missionState.accumulatedAmount >= missionInfo.maxCapacity;
        
            const amountToClaim = Math.floor(missionState.accumulatedAmount);
            const reward: QuestReward = {};
            
            if (missionInfo.rewardType === 'gold') {
                reward.gold = amountToClaim;
            } else {
                reward.diamonds = amountToClaim;
            }
        
            const addedItems = grantReward(user, reward, `${missionInfo.name} 수련과제 보상`);
            
            missionState.accumulatedAmount -= amountToClaim;
            if (wasAtMax) {
                missionState.lastCollectionTime = Date.now();
            }
            
            updateQuestProgress(user, 'claim_single_player_mission');
            
            await db.updateUser(user);
            return { 
                clientResponse: { 
                    updatedUser: user,
                    rewardSummary: {
                        reward,
                        items: addedItems,
                        title: `${missionInfo.name} 수련과제 보상`
                    }
                } 
            };
        }
        case 'CLAIM_ACTION_POINT_QUIZ_REWARD': {
            const { score } = payload;

            const now = Date.now();
            const attemptsToday = isSameDayKST(user.lastActionPointQuizDate || 0, now)
                ? (user.actionPointQuizzesToday || 0)
                : 0;

            if (attemptsToday >= 3 && !user.isAdmin) {
                return { error: '오늘 퀴즈 참여 횟수를 모두 사용했습니다.' };
            }
            
            const guilds = await db.getKV<Record<string, Guild>>('guilds') || {};
            const guild = user.guildId ? (guilds[user.guildId] ?? null) : null;
            const effects = calculateUserEffects(user, guild);
            user.actionPoints.max = effects.maxActionPoints;

            if (user.actionPoints.current >= user.actionPoints.max) {
                return { error: '행동력을 사용 후 퀴즈에 도전하세요' };
            }

            user.actionPoints.current += (score * 3);
            
            if (!user.isAdmin) {
                user.actionPointQuizzesToday = attemptsToday + 1;
                user.lastActionPointQuizDate = Date.now();
            }

            await db.updateUser(user);
            return { clientResponse: { updatedUser: user }};
        }
        case 'RESET_SINGLE_PLAYER_REWARDS': {
            const ticketName = '싱글플레이 최초보상 초기화권';
            const ticketIndex = user.inventory.findIndex(i => i.name === ticketName);

            if (ticketIndex === -1) {
                return { error: '초기화권이 없습니다.' };
            }

            if ((user.inventory[ticketIndex].quantity ?? 1) > 1) {
                user.inventory[ticketIndex].quantity = (user.inventory[ticketIndex].quantity ?? 1) - 1;
            } else {
                user.inventory.splice(ticketIndex, 1);
            }
            
            user.claimedFirstClearRewards = [];
            
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }
        case 'START_SINGLE_PLAYER_MISSION': {
            const { missionId } = payload;
            const missionInfo = SINGLE_PLAYER_MISSIONS.find(m => m.id === missionId);
            if (!missionInfo) return { error: '미션 정보를 찾을 수 없습니다.' };
            
            if (!user.singlePlayerMissions) user.singlePlayerMissions = {};

            if (user.singlePlayerMissions[missionId]?.isStarted) return { error: '이미 시작된 미션입니다.' };
            
            user.singlePlayerMissions[missionId] = {
                isStarted: true,
                lastCollectionTime: Date.now(),
                accumulatedAmount: 0,
            };
            
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }

        default:
            return { error: 'Unknown reward action type.' };
    }
};
