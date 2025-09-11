import { randomUUID } from 'crypto';
import * as db from '../db.js';
import { type ServerAction, type User, type VolatileState, InventoryItem, Quest, QuestLog, InventoryItemType, TournamentType, TournamentState, QuestReward } from '../../types/index.js';
import * as types from '../../types/index.js';
import { updateQuestProgress } from '../questService.js';
import { SHOP_ITEMS, createItemFromTemplate } from '../shop.js';
import { 
    CONSUMABLE_ITEMS, 
    MATERIAL_ITEMS, 
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
import { addItemsToInventory, createItemInstancesFromReward } from '../../utils/inventoryUtils.js';
import { getKSTDate } from '.././timeUtils.js';
import { createDefaultQuests } from '../initialData.js';
import * as effectService from '../effectService.js';

type HandleActionResult = {
    clientResponse?: any;
    error?: string;
};

export const handleRewardAction = async (volatileState: VolatileState, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult> => {
    const { type, payload } = action;

    switch (type) {
        case 'CLAIM_SINGLE_PLAYER_MISSION_REWARD': {
            const { missionId } = payload;
            const missionInfo = SINGLE_PLAYER_MISSIONS.find(m => m.id === missionId);
            if (!missionInfo) return { error: 'Mission not found.' };
            if (!user.singlePlayerMissions || !user.singlePlayerMissions[missionId] || !user.singlePlayerMissions[missionId].isStarted) {
                return { error: 'Mission not started.' };
            }
            
            const missionState = user.singlePlayerMissions[missionId];
            const amountToClaim = missionState.accumulatedAmount;
            if (amountToClaim < 1) return { error: 'No rewards to claim.' };
    
            const reward: types.QuestReward = {
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
    
            updateQuestProgress(user, 'claim_single_player_mission', undefined, amountToClaim);
    
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
        
            const { success } = addItemsToInventory([...user.inventory], user.inventorySlots, itemsToCreate);
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
        
            addItemsToInventory(user.inventory, user.inventorySlots, itemsToCreate);
        
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
            const allItemsToCreate: InventoryItem[] = [];

            for (const mail of mailsToClaim) {
                totalGold += mail.attachments!.gold || 0;
                totalDiamonds += mail.attachments!.diamonds || 0;
                totalActionPoints += mail.attachments!.actionPoints || 0;
                if (mail.attachments!.items) {
                    const createdItems = createItemInstancesFromReward(mail.attachments!.items as { itemId: string; quantity: number }[]);
                    allItemsToCreate.push(...createdItems);
                }
            }

            const { success } = addItemsToInventory([...user.inventory], user.inventorySlots, allItemsToCreate);
            if (!success) {
                return { error: '모든 아이템을 받기에 가방 공간이 부족합니다.' };
            }

            user.gold += totalGold;
            user.diamonds += totalDiamonds;
            user.actionPoints.current += totalActionPoints;
            addItemsToInventory(user.inventory, user.inventorySlots, allItemsToCreate);

            for (const mail of mailsToClaim) mail.attachmentsClaimed = true;

            await db.updateUser(user);
            
            const reward: QuestReward = {
                gold: totalGold,
                diamonds: totalDiamonds,
                actionPoints: totalActionPoints,
            };

            // If only currency is being awarded, send a simpler response for the dedicated modal.
            if (allItemsToCreate.length === 0 && (totalGold > 0 || totalDiamonds > 0 || totalActionPoints > 0)) {
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

            const { success } = addItemsToInventory([...user.inventory], user.inventorySlots, itemsToCreate);
            if (!success) {
                return { error: '보상을 받기에 인벤토리 공간이 부족합니다.' };
            }
            
            foundQuest.isClaimed = true;
            
            if (reward.gold) user.gold += reward.gold;
            if (reward.diamonds) user.diamonds += reward.diamonds;
            if (reward.actionPoints) user.actionPoints.current += reward.actionPoints;
            addItemsToInventory(user.inventory, user.inventorySlots, itemsToCreate);
            
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

            const { success } = addItemsToInventory([...user.inventory], user.inventorySlots, itemsToCreate);
            if (!success) {
                return { error: '보상을 받기에 인벤토리 공간이 부족합니다.' };
            }
            
            user.gold += reward.gold || 0;
            user.diamonds += reward.diamonds || 0;
            user.actionPoints.current += reward.actionPoints || 0;
            addItemsToInventory(user.inventory, user.inventorySlots, itemsToCreate);
            
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
        case 'DELETE_MAIL': {
            const { mailId } = payload;
            const mailIndex = user.mail.findIndex(m => m.id === mailId);
            if (mailIndex === -1) return { error: 'Mail not found.' };

            const mail = user.mail[mailIndex];
            if (mail.attachments && !mail.attachmentsClaimed) {
                return { error: '수령하지 않은 아이템이 있는 메일은 삭제할 수 없습니다.' };
            }

            user.mail.splice(mailIndex, 1);
            await db.updateUser(user);
            return {};
        }
        case 'DELETE_ALL_CLAIMED_MAIL': {
            user.mail = user.mail.filter(m => !(m.attachments && m.attachmentsClaimed));
            await db.updateUser(user);
            return {};
        }
        default:
            return { error: 'Unknown reward action.' };
    }
};