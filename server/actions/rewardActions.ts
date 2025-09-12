import { randomUUID } from 'crypto';
import * as db from '../db.js';
import { type ServerAction, type User, type VolatileState, InventoryItem, Quest, QuestLog, InventoryItemType, TournamentType, TournamentState, QuestReward, ItemOption, CoreStat, SpecialStat, MythicStat, EquipmentSlot, ItemGrade, Player, Mail, HandleActionResult } from '../../types.js';
import { updateQuestProgress } from '../questService.js';
import { SHOP_ITEMS, createItemFromTemplate } from '../shop.js';
import { 
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
    SYNTHESIS_UPGRADE_CHANCES,
    EQUIPMENT_POOL,
    DAILY_MILESTONE_REWARDS, 
    DAILY_MILESTONE_THRESHOLDS,
    WEEKLY_MILESTONE_REWARDS,
    WEEKLY_MILESTONE_THRESHOLDS,
    MONTHLY_MILESTONE_REWARDS,
    MONTHLY_MILESTONE_THRESHOLDS,
    BASE_TOURNAMENT_REWARDS,
    TOURNAMENT_SCORE_REWARDS,
    SINGLE_PLAYER_MISSIONS
} from '../../constants.js';
import { calculateRanks } from '../tournamentService.js';
import { addItemsToInventory as addItemsToInventoryUtil, createItemInstancesFromReward } from '../../utils/inventoryUtils.js';
import { getKSTDate } from '../timeUtils.js';
import { createDefaultQuests } from '../initialData.js';
import * as effectService from '../effectService.js';

export const handleRewardAction = async (volatileState: VolatileState, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult> => {
    const { type, payload } = action;

    switch (type) {
        case 'CLAIM_TOURNAMENT_REWARD': {
            const { tournamentType } = payload as { tournamentType: TournamentType };
            let stateKey: keyof User;
            let rewardClaimedKey: keyof User;

            switch (tournamentType) {
                case 'neighborhood':
                    stateKey = 'lastNeighborhoodTournament';
                    rewardClaimedKey = 'neighborhoodRewardClaimed';
                    break;
                case 'national':
                    stateKey = 'lastNationalTournament';
                    rewardClaimedKey = 'nationalRewardClaimed';
                    break;
                case 'world':
                    stateKey = 'lastWorldTournament';
                    rewardClaimedKey = 'worldRewardClaimed';
                    break;
                default:
                    return { error: 'Invalid tournament type for reward claim.' };
            }

            const tournamentState = (user as any)[stateKey] as TournamentState | null;
            if (!tournamentState || (tournamentState.status !== 'complete' && tournamentState.status !== 'eliminated')) {
                return { error: '토너먼트가 아직 진행 중이거나 결과가 없어 보상을 수령할 수 없습니다.' };
            }

            if ((user as any)[rewardClaimedKey]) {
                return { error: 'Reward already claimed.' };
            }

            const ranks = calculateRanks(tournamentState);
            const myRankInfo = ranks.find(r => r.id === user.id);
            if (!myRankInfo) {
                return { error: 'Could not determine your rank.' };
            }

            const rewardInfo = BASE_TOURNAMENT_REWARDS[tournamentType];
            let rewardKey: number;
            
            if (tournamentType === 'neighborhood') {
                rewardKey = myRankInfo.rank <= 3 ? myRankInfo.rank : 4;
            } else if (tournamentType === 'national') {
                rewardKey = myRankInfo.rank <= 4 ? myRankInfo.rank : 5;
            } else { // world
                if (myRankInfo.rank <= 4) rewardKey = myRankInfo.rank;
                else if (myRankInfo.rank <= 8) rewardKey = 5;
                else rewardKey = 9;
            }
            const reward = rewardInfo.rewards[rewardKey];
            
            if (!reward) return { error: 'No reward found for your rank.' };
            
            const scoreReward = TOURNAMENT_SCORE_REWARDS[tournamentType][rewardKey] || 0;
            const itemsToAdd = createItemInstancesFromReward(reward.items || []);
            
            const inventoryForCheck = [...user.inventory];
            const { success, addedItems } = addItemsToInventoryUtil(inventoryForCheck, user.inventorySlots, itemsToAdd);

            if (!success) return { error: '인벤토리 공간이 부족하여 보상을 수령할 수 없습니다.' };
            
            // Apply changes now that checks have passed
            user.tournamentScore += scoreReward;
            user.inventory = inventoryForCheck; // Use the checked inventory
            (user as any)[rewardClaimedKey] = true;

            await db.updateUser(user);
            
            return {
                clientResponse: {
                    rewardSummary: {
                        reward,
                        items: addedItems,
                        title: `${tournamentState.title} 보상`
                    },
                    updatedUser: user
                }
            };
        }
        case 'CLAIM_SINGLE_PLAYER_MISSION_REWARD': {
            const { missionId } = payload;
            const missionInfo = SINGLE_PLAYER_MISSIONS.find(m => m.id === missionId);
            if (!missionInfo) return { error: 'Mission not found.' };
            if (!user.singlePlayerMissions || !user.singlePlayerMissions[missionId] || !user.singlePlayerMissions[missionId].isStarted) {
                return { error: 'Mission not started.' };
            }
            
            const missionState = user.singlePlayerMissions[missionId];
            const amountToClaim = missionState.accumulatedAmount;
            if (amountToClaim < 1) return { error: '수령할 보상이 없습니다.' };
    
            const reward: QuestReward = {
                gold: missionInfo.rewardType === 'gold' ? amountToClaim : 0,
                diamonds: missionInfo.rewardType === 'diamonds' ? amountToClaim : 0,
            };

            if (missionInfo.rewardType === 'gold') {
                user.gold += amountToClaim;
            } else if (missionInfo.rewardType === 'diamonds') {
                user.diamonds += amountToClaim;
            }
    
            missionState.accumulatedAmount = 0;
            missionState.lastCollectionTime = Date.now();
    
            updateQuestProgress(user, 'claim_single_player_mission', undefined, 1);
    
            await db.updateUser(user);
            
            return { 
                clientResponse: { 
                    updatedUser: user,
                    rewardSummary: {
                        reward,
                        items: [], // Missions only give currency
                        title: "수련 과제 보상"
                    }
                } 
            };
        }
        case 'CLAIM_MAIL_ATTACHMENTS': {
            const { mailId } = payload;
            const mail = user.mail.find(m => m.id === mailId);
        
            if (!mail) return { error: 'Mail not found.' };
            if (mail.attachmentsClaimed) return { error: 'Attachments already claimed.' };
            if (!mail.attachments) return { error: 'No attachments to claim.' };
        
            const itemsToCreate: InventoryItem[] = [];
            if (mail.attachments.items) {
                 const createdItems = createItemInstancesFromReward(mail.attachments.items as { itemId: string; quantity: number }[]);
                 itemsToCreate.push(...createdItems);
            }
        
            const { success } = addItemsToInventoryUtil([...user.inventory], user.inventorySlots, itemsToCreate);
            if (!success) return { error: '인벤토리 공간이 부족합니다.' };
        
            const reward: QuestReward = {
                gold: mail.attachments.gold || 0,
                diamonds: mail.attachments.diamonds || 0,
                actionPoints: mail.attachments.actionPoints || 0,
            };

            if (reward.gold) user.gold += reward.gold;
            if (reward.diamonds) user.diamonds += reward.diamonds;
            if (reward.actionPoints) {
                user.actionPoints.current += reward.actionPoints;
            }
        
            if (mail.attachments.strategyXp) {
                const xpGain = mail.attachments.strategyXp;
                user.strategyXp += xpGain;
                
                let currentLevel = user.strategyLevel;
                let currentXp = user.strategyXp;
                let requiredXp = 1000 + (currentLevel - 1) * 200;
        
                while (currentXp >= requiredXp) {
                    currentXp -= requiredXp;
                    currentLevel++;
                    requiredXp = 1000 + (currentLevel - 1) * 200;
                }
                
                user.strategyLevel = currentLevel;
                user.strategyXp = currentXp;

                reward.xp = { type: 'strategy', amount: xpGain };
            }

            addItemsToInventoryUtil(user.inventory, user.inventorySlots, itemsToCreate);
        
            mail.attachmentsClaimed = true;
            await db.updateUser(user);
            
            return {
                clientResponse: {
                    rewardSummary: {
                        reward,
                        items: itemsToCreate,
                        title: '우편 보상'
                    },
                    updatedUser: user
                }
            };
        }
        case 'CLAIM_ALL_MAIL_ATTACHMENTS': {
            const mailsToClaim = user.mail.filter(m => m.attachments && !m.attachmentsClaimed);
            if (mailsToClaim.length === 0) return { error: '수령할 아이템이 없습니다.' };

            let totalGold = 0;
            let totalDiamonds = 0;
            let totalActionPoints = 0;
            let totalStrategyXp = 0;
            const aggregatedItems: Record<string, { quantity: number; template: any }> = {};

            for (const mail of mailsToClaim) {
                totalGold += mail.attachments!.gold || 0;
                totalDiamonds += mail.attachments!.diamonds || 0;
                totalActionPoints += mail.attachments!.actionPoints || 0;
                totalStrategyXp += mail.attachments!.strategyXp || 0;
                
                if (mail.attachments!.items) {
                    for (const itemRef of mail.attachments!.items) {
                        const isFullItem = 'id' in itemRef;
                        const itemName = isFullItem ? itemRef.name : itemRef.itemId;
                        const quantity = itemRef.quantity || 1;

                        if (isFullItem && itemRef.type === 'equipment') {
                            const uniqueKey = `equipment-${itemRef.id}`;
                            if (!aggregatedItems[uniqueKey]) {
                                aggregatedItems[uniqueKey] = { quantity: 1, template: itemRef };
                            }
                        } else {
                            if (!aggregatedItems[itemName]) {
                                const template = [...CONSUMABLE_ITEMS, ...Object.values(MATERIAL_ITEMS)].find(t => t.name === itemName);
                                if (template) {
                                    aggregatedItems[itemName] = { quantity: 0, template };
                                }
                            }
                            if (aggregatedItems[itemName]) {
                                aggregatedItems[itemName].quantity += quantity;
                            }
                        }
                    }
                }
            }
            
            const allItemsToCreate: InventoryItem[] = Object.entries(aggregatedItems).map(([key, data]) => {
                if (key.startsWith('equipment-')) {
                    return data.template;
                }
                return {
                    ...data.template,
                    id: `item-${randomUUID()}`,
                    createdAt: Date.now(),
                    quantity: data.quantity,
                    isEquipped: false,
                    level: 1,
                    stars: 0,
                    options: undefined,
                };
            });


            const { success } = addItemsToInventoryUtil([...user.inventory], user.inventorySlots, allItemsToCreate);
            if (!success) {
                return { error: '모든 아이템을 받기에 가방 공간이 부족합니다.' };
            }

            user.gold += totalGold;
            user.diamonds += totalDiamonds;
            user.actionPoints.current += totalActionPoints;
            
            if (totalStrategyXp > 0) {
                user.strategyXp += totalStrategyXp;
                let currentLevel = user.strategyLevel;
                let currentXp = user.strategyXp;
                let requiredXp = 1000 + (currentLevel - 1) * 200;
                while(currentXp >= requiredXp) {
                    currentXp -= requiredXp;
                    currentLevel++;
                    requiredXp = 1000 + (currentLevel - 1) * 200;
                }
                user.strategyLevel = currentLevel;
                user.strategyXp = currentXp;
            }

            addItemsToInventoryUtil(user.inventory, user.inventorySlots, allItemsToCreate);

            for (const mail of mailsToClaim) mail.attachmentsClaimed = true;

            await db.updateUser(user);
            
            const reward: QuestReward = {
                gold: totalGold,
                diamonds: totalDiamonds,
                actionPoints: totalActionPoints,
            };
            if (totalStrategyXp > 0) {
                reward.xp = { type: 'strategy', amount: totalStrategyXp };
            }

            if (allItemsToCreate.length === 0 && (totalGold > 0 || totalDiamonds > 0 || totalActionPoints > 0 || totalStrategyXp > 0)) {
                return {
                    clientResponse: {
                        claimAllSummary: {
                            gold: totalGold,
                            diamonds: totalDiamonds,
                            actionPoints: totalActionPoints
                        },
                        updatedUser: user
                    }
                };
            }

            return {
                clientResponse: {
                    rewardSummary: {
                        reward,
                        items: allItemsToCreate,
                        title: '우편 일괄 수령'
                    },
                    updatedUser: user
                }
            };
        }
        case 'CLAIM_QUEST_REWARD': {
            const { questId } = payload;
            const questCategories = ['daily', 'weekly', 'monthly'] as const;
            let foundQuest: Quest | undefined;
            let questType: 'daily' | 'weekly' | 'monthly' | undefined;

            for (const category of questCategories) {
                const questList = user.quests[category]?.quests;
                if (questList) {
                    foundQuest = questList.find(q => q.id === questId);
                    if (foundQuest) {
                        questType = category;
                        break;
                    }
                }
            }

            if (!foundQuest) return { error: '퀘스트를 찾을 수 없습니다.' };
            if (foundQuest.isClaimed) return { error: '이미 보상을 수령했습니다.' };
            if (foundQuest.progress < foundQuest.target) return { error: '퀘스트를 아직 완료하지 않았습니다.' };
            
            const { reward, activityPoints } = foundQuest;
            const itemsToCreate: InventoryItem[] = [];
            if (reward.items) {
                const createdItems = createItemInstancesFromReward(reward.items as { itemId: string; quantity: number }[]);
                itemsToCreate.push(...createdItems);
            }

            const { success } = addItemsToInventoryUtil([...user.inventory], user.inventorySlots, itemsToCreate);
            if (!success) {
                return { error: '보상을 받기에 인벤토리 공간이 부족합니다.' };
            }
            
            foundQuest.isClaimed = true;
            
            if (reward.gold) user.gold += reward.gold;
            if (reward.diamonds) user.diamonds += reward.diamonds;
            if (reward.actionPoints) user.actionPoints.current += reward.actionPoints;
            addItemsToInventoryUtil(user.inventory, user.inventorySlots, itemsToCreate);
            
            if (activityPoints > 0 && user.quests[questType!]) {
                user.quests[questType!]!.activityProgress += activityPoints;
            }

            await db.updateUser(user);
            return { 
                clientResponse: { 
                    rewardSummary: {
                        reward,
                        items: itemsToCreate,
                        title: `${questType === 'daily' ? '일일' : questType === 'weekly' ? '주간' : '월간'} 퀘스트 보상`
                    },
                    updatedUser: user
                } 
            };
        }
        case 'CLAIM_ACTIVITY_MILESTONE': {
            const { milestoneIndex, questType } = payload as { milestoneIndex: number; questType: 'daily' | 'weekly' | 'monthly' };
            
            const questDataMap = {
                daily: { data: user.quests.daily, thresholds: DAILY_MILESTONE_THRESHOLDS, rewards: DAILY_MILESTONE_REWARDS },
                weekly: { data: user.quests.weekly, thresholds: WEEKLY_MILESTONE_THRESHOLDS, rewards: WEEKLY_MILESTONE_REWARDS },
                monthly: { data: user.quests.monthly, thresholds: MONTHLY_MILESTONE_THRESHOLDS, rewards: MONTHLY_MILESTONE_REWARDS },
            };

            const selectedQuest = questDataMap[questType];
            if (!selectedQuest || !selectedQuest.data) return { error: "유효하지 않은 퀘스트 타입입니다." };

            const { data, thresholds, rewards } = selectedQuest;
            
            if (milestoneIndex < 0 || milestoneIndex >= rewards.length) return { error: "유효하지 않은 마일스톤입니다." };
            if (data.claimedMilestones[milestoneIndex]) return { error: "이미 수령한 보상입니다." };

            const requiredProgress = thresholds[milestoneIndex];
            if (data.activityProgress < requiredProgress) return { error: "활약도 점수가 부족합니다." };

            const reward = rewards[milestoneIndex];
            
            const itemsToCreate: InventoryItem[] = [];
            if (reward.items) {
                 const createdItems = createItemInstancesFromReward(reward.items as {itemId: string, quantity: number}[]);
                 itemsToCreate.push(...createdItems);
            }

            const { success } = addItemsToInventoryUtil([...user.inventory], user.inventorySlots, itemsToCreate);
            if (!success) {
                return { error: '보상을 받기에 인벤토리 공간이 부족합니다.' };
            }
            
            user.gold += reward.gold || 0;
            user.diamonds += reward.diamonds || 0;
            user.actionPoints.current += reward.actionPoints || 0;
            addItemsToInventoryUtil(user.inventory, user.inventorySlots, itemsToCreate);
            
            data.claimedMilestones[milestoneIndex] = true;

            if (questType === 'monthly' && milestoneIndex === 4) { // 100 points
                const now = new Date();
                const kstNow = getKSTDate(now.getTime());
                const endOfMonth = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth() + 1, 0, 23, 59, 59, 999));
                user.monthlyGoldBuffExpiresAt = endOfMonth.getTime() - (9 * 60 * 60 * 1000); // Convert back to UTC from KST
            }

            if (milestoneIndex === 4) { // 100 activity points milestone is at index 4
                if (questType === 'daily') {
                    updateQuestProgress(user, 'claim_daily_milestone_100');
                } else if (questType === 'weekly') {
                    updateQuestProgress(user, 'claim_weekly_milestone_100');
                }
            }

            await db.updateUser(user);
            return { 
                clientResponse: { 
                    rewardSummary: {
                        reward,
                        items: itemsToCreate,
                        title: `${questType === 'daily' ? '일일' : questType === 'weekly' ? '주간' : '월간'} 활약도 보상`
                    },
                    updatedUser: user
                } 
            };
        }
    }

    return { error: `Unknown reward action: ${type}` };
};