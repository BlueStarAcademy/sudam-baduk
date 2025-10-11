
import * as db from '../db.js';
import { type ServerAction, type User, type VolatileState, InventoryItem, Quest, QuestLog, InventoryItemType, TournamentType, TournamentState, QuestReward, ItemOption, CoreStat, SpecialStat, MythicStat, EquipmentSlot, ItemGrade, Player, Mail, HandleActionResult, Guild } from '../../types/index.js';
import { updateQuestProgress } from '../questService.js';
import { SHOP_ITEMS, createItemFromTemplate, pickRandom } from '../shop.js';
// FIX: Corrected import paths for constants.
import { 
    currencyBundles,
    CONSUMABLE_ITEMS, 
    MATERIAL_ITEMS, 
    GRADE_LEVEL_REQUIREMENTS,
    ITEM_SELL_PRICES,
    MATERIAL_SELL_PRICES,
    ENHANCEMENT_COSTS,
    ENHANCEMENT_SUCCESS_RATES,
    ENHANCEMENT_FAIL_BONUS_RATES,
    GRADE_SUB_OPTION_RULES,
    SUB_OPTION_POOLS,
    SYNTHESIS_COSTS,
    EQUIPMENT_POOL,
    ENHANCEMENT_LEVEL_REQUIREMENTS,
    DAILY_MILESTONE_REWARDS,
    WEEKLY_MILESTONE_REWARDS,
    MONTHLY_MILESTONE_REWARDS,
    DAILY_MILESTONE_THRESHOLDS,
    WEEKLY_MILESTONE_THRESHOLDS,
    MONTHLY_MILESTONE_THRESHOLDS,
    SINGLE_PLAYER_MISSIONS
} from '../../constants/index.js';
import { addItemsToInventory as addItemsToInventoryUtil } from '../../utils/inventoryUtils.js';
// FIX: Import `calculateUserEffects` from the correct utility file.
import { calculateUserEffects } from '../../utils/statUtils.js';
import * as currencyService from '../currencyService.js';
import * as guildService from '../guildService.js';
import { isSameDayKST, isDifferentWeekKST, isDifferentMonthKST } from '../../utils/timeUtils.js';
import { getMissionInfoWithLevel, accumulateMissionRewards } from '../questService.js';
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

// FIX: Add 'guilds' parameter to function signature.
export const handleRewardAction = async (action: ServerAction & { userId: string }, user: User, guilds: Record<string, Guild>): Promise<{ 
    clientResponse?: any;
    error?: string;
}> => {
    const { type, payload } = action;

    const rewardActionTypes: ServerAction['type'][] = [
        'CLAIM_MAIL_ATTACHMENTS', 'CLAIM_ALL_MAIL_ATTACHMENTS', 'DELETE_MAIL', 'DELETE_ALL_CLAIMED_MAIL', 'MARK_MAIL_AS_READ',
        'CLAIM_QUEST_REWARD', 'CLAIM_ACTIVITY_MILESTONE', 'CLAIM_SINGLE_PLAYER_MISSION_REWARD',
        'CLAIM_ACTION_POINT_QUIZ_REWARD', 'RESET_SINGLE_PLAYER_REWARDS', 'START_SINGLE_PLAYER_MISSION', 'UPGRADE_SINGLE_PLAYER_MISSION'
    ];

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
            const { milestoneIndex, questType } = payload;
            if (!['daily', 'weekly', 'monthly'].includes(questType)) {
                return { error: 'Invalid quest type.' };
            }
            
            const questData = user.quests[questType as 'daily' | 'weekly' | 'monthly'];
            const rewards = { daily: DAILY_MILESTONE_REWARDS, weekly: WEEKLY_MILESTONE_REWARDS, monthly: MONTHLY_MILESTONE_REWARDS }[questType as 'daily' | 'weekly' | 'monthly'];
            const thresholds = { daily: DAILY_MILESTONE_THRESHOLDS, weekly: WEEKLY_MILESTONE_THRESHOLDS, monthly: MONTHLY_MILESTONE_THRESHOLDS }[questType as 'daily' | 'weekly' | 'monthly'];
            
            if (!questData || !Array.isArray(questData.claimedMilestones) || questData.claimedMilestones[milestoneIndex] || (questData.activityProgress || 0) < thresholds[milestoneIndex]) {
                return { error: "Cannot claim this milestone." };
            }
            
            const reward = rewards[milestoneIndex];
            if (!reward) {
                console.error(`[CRITICAL] Invalid milestoneIndex ${milestoneIndex} for questType ${questType} from user ${user.id}.`);
                return { error: "Invalid milestone index." };
            }

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
            const now = Date.now();
            
            user = accumulateMissionRewards(user);

            const missionState = user.singlePlayerMissions[missionId];
            if (!missionState || !missionState.isStarted || missionState.claimableAmount < 1) {
                return { error: '수령할 보상이 없습니다.' };
            }
        
            const missionInfo = SINGLE_PLAYER_MISSIONS.find(m => m.id === missionId);
            if (!missionInfo) return { error: '미션 정보를 찾을 수 없습니다.' };

            const level = missionState.level || 1;
            const leveledMissionInfo = getMissionInfoWithLevel(missionInfo, level);

            // Check if storage was full before claiming
            const wasFull = missionState.claimableAmount >= (leveledMissionInfo.maxCapacity ?? Infinity);
        
            const amountToClaim = Math.floor(missionState.claimableAmount);
            const reward: QuestReward = {};
            
            if (leveledMissionInfo.rewardType === 'gold') {
                reward.gold = amountToClaim;
            } else {
                reward.diamonds = amountToClaim;
            }
        
            const addedItems = grantReward(user, reward, `${leveledMissionInfo.name} 수련과제 보상`);
            
            missionState.claimableAmount = missionState.claimableAmount - amountToClaim;
            
            // Only reset the timer if the storage was full. Otherwise, the advanced time from accumulation is preserved.
            if (wasFull) {
                missionState.lastCollectionTime = now;
            }
            
            missionState.progressTowardNextLevel = (missionState.progressTowardNextLevel || 0) + amountToClaim;

            updateQuestProgress(user, 'claim_single_player_mission');
            
            await db.updateUser(user);
            return { 
                clientResponse: { 
                    updatedUser: user,
                    rewardSummary: {
                        reward,
                        items: addedItems,
                        title: `${leveledMissionInfo.name} 수련과제 보상`
                    }
                } 
            };
        }
        case 'UPGRADE_SINGLE_PLAYER_MISSION': {
            const { missionId } = payload;
            if (!user.singlePlayerMissions?.[missionId]?.isStarted) {
                return { error: '미션을 먼저 시작해야 합니다.' };
            }
        
            const missionState = user.singlePlayerMissions[missionId];
            const currentLevel = missionState.level || 1;
        
            if (currentLevel >= 10) {
                return { error: '최대 레벨입니다.' };
            }
        
            const missionInfo = SINGLE_PLAYER_MISSIONS.find(m => m.id === missionId);
            if (!missionInfo) return { error: '미션 정보를 찾을 수 없습니다.' };
        
            const leveledMissionInfo = getMissionInfoWithLevel(missionInfo, currentLevel);
        
            const upgradeTarget = (leveledMissionInfo.maxCapacity ?? Infinity) * 10;
            if ((missionState.progressTowardNextLevel || 0) < upgradeTarget) {
                return { error: '강화에 필요한 누적 수령액이 부족합니다.' };
            }
        
            let goldCost: number;
            if (leveledMissionInfo.rewardType === 'gold') {
                goldCost = (leveledMissionInfo.maxCapacity ?? 0) * 5;
            } else { // diamonds
                goldCost = (leveledMissionInfo.maxCapacity ?? 0) * 1000;
            }

            if (user.gold < goldCost) {
                return { error: '골드가 부족합니다.' };
            }
        
            currencyService.spendGold(user, goldCost, `${missionInfo.name} 강화`);
        
            missionState.level = currentLevel + 1;
            missionState.progressTowardNextLevel = 0;
        
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
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
            
            // FIX: Use passed-in guilds object instead of fetching from DB.
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
                claimableAmount: 0,
                progressTowardNextLevel: 0,
                level: 1,
            };
            
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }

        default:
            return { error: 'Unknown reward action type.' };
    }
};
