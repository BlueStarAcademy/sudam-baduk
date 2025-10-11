import * as db from '../db.js';
import { 
    type ServerAction, 
    type User, 
    type VolatileState, 
    type HandleActionResult,
    type Guild,
    GuildMemberRole,
    GuildResearchId,
    type InventoryItem,
    type ChatMessage,
    type GuildBossBattleResult,
} from '../../types/index.js';
import { containsProfanity } from '../../profanity.js';
import { createDefaultGuild } from '../initialData.js';
import { GUILD_CREATION_COST, GUILD_DONATION_DIAMOND_COST, GUILD_DONATION_DIAMOND_LIMIT, GUILD_DONATION_DIAMOND_REWARDS, GUILD_DONATION_GOLD_COST, GUILD_DONATION_GOLD_LIMIT, GUILD_DONATION_GOLD_REWARDS, GUILD_LEAVE_COOLDOWN_MS, GUILD_RESEARCH_PROJECTS, GUILD_CHECK_IN_MILESTONE_REWARDS, GUILD_SHOP_ITEMS, CONSUMABLE_ITEMS, MATERIAL_ITEMS, GUILD_BOSSES } from '../../constants/index.js';
import * as currencyService from '../currencyService.js';
import * as guildService from '../guildService.js';
import { isSameDayKST, isDifferentWeekKST, isDifferentMonthKST } from '../../utils/timeUtils.js';
import { addItemsToInventory } from '../../utils/inventoryUtils.js';
import { openGuildGradeBox } from '../shop.js';
import { randomUUID } from 'crypto';
import { updateQuestProgress } from '../questService.js';
import { calculateGuildMissionXp } from '../../utils/guildUtils.js';

const getRandomInt = (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

const getResearchCost = (researchId: GuildResearchId, level: number): number => {
    const project = GUILD_RESEARCH_PROJECTS[researchId];
    if (!project) return Infinity;
    return Math.floor(project.baseCost * Math.pow(project.costMultiplier, level));
};

const getResearchTimeMs = (researchId: GuildResearchId, level: number): number => {
    const project = GUILD_RESEARCH_PROJECTS[researchId];
    if(!project) return 0;
    const hours = project.baseTimeHours + (project.timeIncrementHours * level);
    return hours * 60 * 60 * 1000;
};


export const handleGuildAction = async (action: ServerAction & { user: User }, guilds: Record<string, Guild>): Promise<HandleActionResult> => {
    const { type, payload, user } = action;
    let needsSave = false;
    
    // Lazy migration for chat message IDs to support deleting old messages
    for (const guild of Object.values(guilds)) {
        if (guild.chatHistory) {
            for (const msg of guild.chatHistory) {
                // Only add IDs to user messages that are missing one and have a valid user object
                if (!msg.id && !msg.system && msg.user && typeof msg.user.id === 'string') {
                    msg.id = `msg-guild-${globalThis.crypto.randomUUID()}`;
                    needsSave = true;
                }
            }
        }
    }

    if (needsSave) {
        await db.setKV('guilds', guilds);
    }


    switch (type) {
        case 'CREATE_GUILD': {
            const { name, description, isPublic } = payload;
            if (user.guildId) return { error: '이미 길드에 가입되어 있습니다.' };
            if (name.trim().length < 2 || name.trim().length > 12) return { error: '길드 이름은 2-12자여야 합니다.' };
            if (containsProfanity(name) || containsProfanity(description)) return { error: '부적절한 단어가 포함되어 있습니다.' };
            
            if (!user.isAdmin) {
                if (user.diamonds < GUILD_CREATION_COST) return { error: '다이아가 부족합니다.' };
                currencyService.spendDiamonds(user, GUILD_CREATION_COST, '길드 창설');
            }
            
            if (Object.values(guilds).some(g => g.name.toLowerCase() === name.toLowerCase())) {
                return { error: '이미 사용 중인 길드 이름입니다.' };
            }

            const guildId = `guild-${globalThis.crypto.randomUUID()}`;
            const newGuild = createDefaultGuild(guildId, name, description, isPublic, user);
            guilds[guildId] = newGuild;
            
            user.guildId = guildId;
            
            await db.setKV('guilds', guilds);
            await db.updateUser(user);

            return { clientResponse: { updatedUser: user } };
        }

        case 'JOIN_GUILD': {
            const { guildId } = payload;
            const guild = guilds[guildId];

            if (!guild) return { error: '길드를 찾을 수 없습니다.' };
            if (user.guildId) return { error: '이미 길드에 가입되어 있습니다.' };
            if (user.guildLeaveCooldownUntil && user.guildLeaveCooldownUntil > Date.now()) {
                const timeLeft = Math.ceil((user.guildLeaveCooldownUntil - Date.now()) / 1000 / 60);
                return { error: `길드 탈퇴 후 ${timeLeft}분 동안 가입할 수 없습니다.` };
            }
            if (guild.members.length >= (guild.memberLimit || 30)) return { error: '길드 인원이 가득 찼습니다.' };

            if (guild.isPublic) {
                guild.members.push({
                    userId: user.id,
                    nickname: user.nickname,
                    role: GuildMemberRole.Member,
                    joinedAt: Date.now(),
                    contribution: 0,
                    weeklyContribution: 0,
                });
                user.guildId = guild.id;
                user.guildApplications = [];
            } else {
                if (!guild.applicants) guild.applicants = [];
                if (guild.applicants.includes(user.id)) return { error: '이미 가입 신청을 했습니다.' };
                guild.applicants.push(user.id);
                if (!user.guildApplications) user.guildApplications = [];
                user.guildApplications.push(guild.id);
            }

            await db.setKV('guilds', guilds);
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }

        case 'GUILD_CANCEL_APPLICATION': {
            const { guildId } = payload;
            const guild = guilds[guildId];
            if (guild && guild.applicants) {
                guild.applicants = guild.applicants.filter(id => id !== user.id);
                await db.setKV('guilds', guilds);
            }
            if (user.guildApplications) {
                user.guildApplications = user.guildApplications.filter(id => id !== guildId);
                await db.updateUser(user);
            }
            return { clientResponse: { updatedUser: user } };
        }
        
        case 'GUILD_ACCEPT_APPLICANT': {
            const { guildId, applicantId } = payload;
            const guild = guilds[guildId];
            const myMemberInfo = guild?.members.find(m => m.userId === user.id);
            if (!guild || !myMemberInfo || (myMemberInfo.role !== GuildMemberRole.Master && myMemberInfo.role !== GuildMemberRole.Vice)) {
                return { error: '권한이 없습니다.' };
            }
            if (guild.members.length >= (guild.memberLimit || 30)) return { error: '길드 인원이 가득 찼습니다.' };

            const applicant = await db.getUser(applicantId);
            if (!applicant || applicant.guildId) {
                if (guild.applicants) guild.applicants = guild.applicants.filter(id => id !== applicantId);
                await db.setKV('guilds', guilds);
                return { error: '대상이 이미 다른 길드에 가입했습니다.' };
            }

            guild.members.push({ userId: applicant.id, nickname: applicant.nickname, role: GuildMemberRole.Member, joinedAt: Date.now(), contribution: 0, weeklyContribution: 0 });
            if (guild.applicants) guild.applicants = guild.applicants.filter(id => id !== applicantId);
            applicant.guildId = guild.id;
            applicant.guildApplications = [];

            await db.setKV('guilds', guilds);
            await db.updateUser(applicant);
            return {};
        }

        case 'GUILD_REJECT_APPLICANT': {
            const { guildId, applicantId } = payload;
            const guild = guilds[guildId];
            const myMemberInfo = guild?.members.find(m => m.userId === user.id);
             if (!guild || !myMemberInfo || (myMemberInfo.role !== GuildMemberRole.Master && myMemberInfo.role !== GuildMemberRole.Vice)) {
                return { error: '권한이 없습니다.' };
            }
            if (guild.applicants) guild.applicants = guild.applicants.filter(id => id !== applicantId);
            
            const applicant = await db.getUser(applicantId);
            if (applicant && applicant.guildApplications) {
                applicant.guildApplications = applicant.guildApplications.filter(id => id !== guildId);
                await db.updateUser(applicant);
            }

            await db.setKV('guilds', guilds);
            return {};
        }

        case 'GUILD_LEAVE': {
            const { guildId } = payload;
            const guild = guilds[guildId];
            if (!guild || user.guildId !== guildId) return { error: '길드 정보를 찾을 수 없습니다.' };
            
            const memberInfo = guild.members.find(m => m.userId === user.id);
            if (!memberInfo) return { error: '길드원이 아닙니다.' };
            if (memberInfo.role === GuildMemberRole.Master && guild.members.length > 1) {
                return { error: '길드장이 길드를 떠나려면 먼저 다른 길드원에게 길드장을 위임해야 합니다.' };
            }
            
            if (memberInfo.role === GuildMemberRole.Master && guild.members.length === 1) {
                delete guilds[guildId]; // Last member, dissolve guild
            } else {
                guild.members = guild.members.filter(m => m.userId !== user.id);
            }
            
            user.guildId = null;
            user.guildLeaveCooldownUntil = Date.now() + GUILD_LEAVE_COOLDOWN_MS;
            
            await db.setKV('guilds', guilds);
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }

        case 'GUILD_KICK_MEMBER': {
            const { guildId, targetMemberId } = payload;
            const guild = guilds[guildId];
            const myMemberInfo = guild?.members.find(m => m.userId === user.id);
            const targetMemberInfo = guild?.members.find(m => m.userId === targetMemberId);

            if (!guild || !myMemberInfo || !targetMemberInfo) return { error: '정보를 찾을 수 없습니다.' };
            if ((myMemberInfo.role === GuildMemberRole.Master && targetMemberInfo.role !== GuildMemberRole.Master) || 
                (myMemberInfo.role === GuildMemberRole.Vice && targetMemberInfo.role === GuildMemberRole.Member)) {
                
                guild.members = guild.members.filter(m => m.userId !== targetMemberId);
                const targetUser = await db.getUser(targetMemberId);
                if (targetUser) {
                    targetUser.guildId = null;
                    await db.updateUser(targetUser);
                }
                await db.setKV('guilds', guilds);
            } else {
                return { error: '권한이 없습니다.' };
            }
            return {};
        }
        
        case 'GUILD_PROMOTE_MEMBER':
        case 'GUILD_DEMOTE_MEMBER': {
             const { guildId, targetMemberId } = payload;
            const guild = guilds[guildId];
            const myMemberInfo = guild?.members.find(m => m.userId === user.id);
            const targetMemberInfo = guild?.members.find(m => m.userId === targetMemberId);
            if (!guild || !myMemberInfo || !targetMemberInfo || myMemberInfo.role !== GuildMemberRole.Master) {
                return { error: '권한이 없습니다.' };
            }
            if (type === 'GUILD_PROMOTE_MEMBER' && targetMemberInfo.role === GuildMemberRole.Member) {
                targetMemberInfo.role = GuildMemberRole.Vice;
            } else if (type === 'GUILD_DEMOTE_MEMBER' && targetMemberInfo.role === GuildMemberRole.Vice) {
                targetMemberInfo.role = GuildMemberRole.Member;
            }
            await db.setKV('guilds', guilds);
            return {};
        }
        
        case 'GUILD_TRANSFER_MASTERSHIP': {
            const { guildId, targetMemberId } = payload;
            const guild = guilds[guildId];
            const myMemberInfo = guild?.members.find(m => m.userId === user.id);
            const targetMemberInfo = guild?.members.find(m => m.userId === targetMemberId);

            if (!guild || !myMemberInfo || !targetMemberInfo || myMemberInfo.role !== GuildMemberRole.Master) {
                return { error: '권한이 없습니다.' };
            }
            if (myMemberInfo.userId === targetMemberId) {
                return { error: '자기 자신에게 위임할 수 없습니다.' };
            }
            
            myMemberInfo.role = GuildMemberRole.Member;
            targetMemberInfo.role = GuildMemberRole.Master;
            
            await db.setKV('guilds', guilds);
            return {};
        }

        case 'GUILD_UPDATE_PROFILE': {
             const { guildId, description, isPublic, icon } = payload;
            const guild = guilds[guildId];
            const myMemberInfo = guild?.members.find(m => m.userId === user.id);
            if (!guild || !myMemberInfo || (myMemberInfo.role !== GuildMemberRole.Master && myMemberInfo.role !== GuildMemberRole.Vice)) {
                return { error: '권한이 없습니다.' };
            }
            if(description !== undefined) guild.description = description;
            if(isPublic !== undefined) guild.isPublic = isPublic;
            if(icon !== undefined) guild.icon = icon;

            await db.setKV('guilds', guilds);
            return {};
        }

        case 'GUILD_UPDATE_ANNOUNCEMENT': {
            const { guildId, announcement } = payload;
            const guild = guilds[guildId];
            const myMemberInfo = guild?.members.find(m => m.userId === user.id);
             if (!guild || !myMemberInfo || (myMemberInfo.role !== GuildMemberRole.Master && myMemberInfo.role !== GuildMemberRole.Vice)) {
                return { error: '권한이 없습니다.' };
            }
            guild.announcement = announcement;
            await db.setKV('guilds', guilds);
            return {};
        }

        case 'GUILD_CHECK_IN': {
            const now = Date.now();
            if (!user.guildId) return { error: '길드에 가입되어 있지 않습니다.' };
            const guild = guilds[user.guildId];
            if (!guild) return { error: '길드를 찾을 수 없습니다.' };

            if (!guild.checkIns) guild.checkIns = {};
            if (isSameDayKST(guild.checkIns[user.id], now)) return { error: '오늘 이미 출석했습니다.' };

            guild.checkIns[user.id] = now;
            
            // The service now modifies the guilds object in place and the caller saves it.
            await guildService.updateGuildMissionProgress(user.guildId, 'checkIns', 1, guilds);
            
            await db.setKV('guilds', guilds);
            return {};
        }
        case 'GUILD_CLAIM_CHECK_IN_REWARD': {
             const { milestoneIndex } = payload;
            if (!user.guildId) return { error: '길드에 가입되어 있지 않습니다.' };
            const guild = guilds[user.guildId];
            if (!guild) return { error: '길드를 찾을 수 없습니다.' };
            
            const now = Date.now();
            const todaysCheckIns = Object.values(guild.checkIns || {}).filter(ts => isSameDayKST(ts, now)).length;
            const milestone = GUILD_CHECK_IN_MILESTONE_REWARDS[milestoneIndex];

            if (!milestone || todaysCheckIns < milestone.count) return { error: '보상 조건을 만족하지 못했습니다.' };
            if (!guild.dailyCheckInRewardsClaimed) guild.dailyCheckInRewardsClaimed = [];
            if (guild.dailyCheckInRewardsClaimed.some(c => c.userId === user.id && c.milestoneIndex === milestoneIndex)) return { error: '이미 수령한 보상입니다.' };
            
            user.guildCoins = (user.guildCoins || 0) + milestone.reward.guildCoins;
            guild.dailyCheckInRewardsClaimed.push({ userId: user.id, milestoneIndex });

            await db.setKV('guilds', guilds);
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }
        case 'GUILD_CLAIM_MISSION_REWARD': {
            const { missionId } = payload;
            if (!user.guildId) return { error: '길드에 가입되어 있지 않습니다.' };
            const guild = guilds[user.guildId];
            if (!guild) return { error: '길드를 찾을 수 없습니다.' };
        
            const mission = guild.weeklyMissions.find(m => m.id === missionId);
        
            if (!mission) return { error: '미션을 찾을 수 없습니다.' };
            if (!mission.isCompleted) return { error: '아직 완료되지 않은 미션입니다.' };
            if (mission.claimedBy.includes(user.id)) return { error: '이미 수령한 보상입니다.' };

            // Grant Guild XP EVERY time a member claims.
            const finalXp = calculateGuildMissionXp(mission.guildReward.guildXp, guild.level);
            guild.xp += finalXp;
            guildService.checkGuildLevelUp(guild);
            
            // Grant personal reward (Guild Coins)
            user.guildCoins = (user.guildCoins || 0) + mission.personalReward.guildCoins;
        
            // Mark as claimed by the current user
            mission.claimedBy.push(user.id);
            
            await db.setKV('guilds', guilds);
            await db.updateUser(user);
        
            return { clientResponse: { updatedUser: user } };
        }
        case 'GUILD_DONATE_GOLD':
        case 'GUILD_DONATE_DIAMOND': {
            if (!user.guildId) return { error: '길드에 가입되어 있지 않습니다.' };
            const guild = guilds[user.guildId];
            if (!guild) return { error: '길드를 찾을 수 없습니다.' };
            
            const now = Date.now();
            if (!user.isAdmin) {
                if (!user.dailyDonations || !isSameDayKST(user.dailyDonations.date, now)) {
                    user.dailyDonations = { gold: 0, diamond: 0, date: now };
                }
            }
            
            let gainedGuildCoins = 0;
            let gainedResearchPoints = 0;

            if (type === 'GUILD_DONATE_GOLD') {
                if (!user.isAdmin) {
                    if (user.dailyDonations!.gold >= GUILD_DONATION_GOLD_LIMIT) return { error: '오늘 골드 기부 한도를 초과했습니다.' };
                    if (user.gold < GUILD_DONATION_GOLD_COST) return { error: '골드가 부족합니다.' };
                    currencyService.spendGold(user, GUILD_DONATION_GOLD_COST, '길드 기부');
                    user.dailyDonations!.gold++;
                }
                gainedGuildCoins = getRandomInt(GUILD_DONATION_GOLD_REWARDS.guildCoins[0], GUILD_DONATION_GOLD_REWARDS.guildCoins[1]);
                gainedResearchPoints = getRandomInt(GUILD_DONATION_GOLD_REWARDS.researchPoints[0], GUILD_DONATION_GOLD_REWARDS.researchPoints[1]);
                
                user.guildCoins += gainedGuildCoins;
                guild.researchPoints += gainedResearchPoints;
                guild.xp += GUILD_DONATION_GOLD_REWARDS.guildXp;
                guildService.addContribution(guild, user.id, GUILD_DONATION_GOLD_REWARDS.contribution);
            } else {
                if (!user.isAdmin) {
                    if (user.dailyDonations!.diamond >= GUILD_DONATION_DIAMOND_LIMIT) return { error: '오늘 다이아 기부 한도를 초과했습니다.' };
                    if (user.diamonds < GUILD_DONATION_DIAMOND_COST) return { error: '다이아가 부족합니다.' };
                    currencyService.spendDiamonds(user, GUILD_DONATION_DIAMOND_COST, '길드 기부');
                    await guildService.updateGuildMissionProgress(user.guildId, 'diamondsSpent', GUILD_DONATION_DIAMOND_COST, guilds);
                    user.dailyDonations!.diamond++;
                }
                gainedGuildCoins = getRandomInt(GUILD_DONATION_DIAMOND_REWARDS.guildCoins[0], GUILD_DONATION_DIAMOND_REWARDS.guildCoins[1]);
                gainedResearchPoints = getRandomInt(GUILD_DONATION_DIAMOND_REWARDS.researchPoints[0], GUILD_DONATION_DIAMOND_REWARDS.researchPoints[1]);
                
                user.guildCoins += gainedGuildCoins;
                guild.researchPoints += gainedResearchPoints;
                guild.xp += GUILD_DONATION_DIAMOND_REWARDS.guildXp;
                guildService.addContribution(guild, user.id, GUILD_DONATION_DIAMOND_REWARDS.contribution);
            }

            guildService.checkGuildLevelUp(guild);
            updateQuestProgress(user, 'guild_donate');

            await db.setKV('guilds', guilds);
            await db.updateUser(user);
            return { 
                clientResponse: { 
                    updatedUser: user, 
                    donationResult: {
                        coins: gainedGuildCoins,
                        research: gainedResearchPoints,
                    }
                } 
            };
        }
        
        case 'GUILD_START_RESEARCH': {
            const { guildId, researchId } = payload;
            const guild = guilds[guildId];
            const myMemberInfo = guild?.members.find(m => m.userId === user.id);
            if (!guild || !myMemberInfo || (myMemberInfo.role !== GuildMemberRole.Master && myMemberInfo.role !== GuildMemberRole.Vice)) {
                return { error: '권한이 없습니다.' };
            }
            if (guild.researchTask) return { error: '이미 진행 중인 연구가 있습니다.' };

            const project = GUILD_RESEARCH_PROJECTS[researchId as keyof typeof GUILD_RESEARCH_PROJECTS];
            const currentLevel = guild.research?.[researchId as keyof typeof GUILD_RESEARCH_PROJECTS]?.level ?? 0;
            if (currentLevel >= project.maxLevel) return { error: '최고 레벨에 도달했습니다.' };
            
            const cost = getResearchCost(researchId, currentLevel);
            const timeMs = getResearchTimeMs(researchId, currentLevel);
            if (guild.researchPoints < cost) return { error: '연구 포인트가 부족합니다.' };
            
            guild.researchPoints -= cost;
            guild.researchTask = {
                researchId,
                completionTime: Date.now() + timeMs,
            };

            await db.setKV('guilds', guilds);
            return {};
        }

        case 'GUILD_BUY_SHOP_ITEM': {
            const { itemId } = payload;
            if (!user.guildId) return { error: '길드에 가입되어 있지 않습니다.' };
            const guild = guilds[user.guildId];
            if (!guild) return { error: '길드를 찾을 수 없습니다.' };

            const itemToBuy = GUILD_SHOP_ITEMS.find(item => item.itemId === itemId);
            if (!itemToBuy) return { error: '상점에서 해당 아이템을 찾을 수 없습니다.' };
            
            if (!user.isAdmin) {
                // Check cost
                if ((user.guildCoins || 0) < itemToBuy.cost) {
                    return { error: '길드 코인이 부족합니다.' };
                }

                // Check limits
                const now = Date.now();
                if (!user.guildShopPurchases) user.guildShopPurchases = {};
                const purchaseRecord = user.guildShopPurchases[itemId];
                let purchasesThisPeriod = 0;
                
                if (purchaseRecord) {
                    const isNewPeriod = (itemToBuy.limitType === 'weekly' && isDifferentWeekKST(purchaseRecord.lastPurchaseTimestamp, now)) ||
                                        (itemToBuy.limitType === 'monthly' && isDifferentMonthKST(purchaseRecord.lastPurchaseTimestamp, now));
                    if (!isNewPeriod) {
                        purchasesThisPeriod = purchaseRecord.quantity;
                    }
                }
                
                if (purchasesThisPeriod >= itemToBuy.limit) {
                    return { error: `${itemToBuy.limitType === 'weekly' ? '주간' : '월간'} 구매 한도를 초과했습니다.` };
                }
            }
            
            // Deduct cost and update purchase record BEFORE giving the item
            if (!user.isAdmin) {
                user.guildCoins = (user.guildCoins || 0) - itemToBuy.cost;
                
                const now = Date.now();
                if (!user.guildShopPurchases) user.guildShopPurchases = {};
                const record = user.guildShopPurchases[itemId];
                if (record) {
                    const isNewPeriod = (itemToBuy.limitType === 'weekly' && isDifferentWeekKST(record.lastPurchaseTimestamp, now)) ||
                                        (itemToBuy.limitType === 'monthly' && isDifferentMonthKST(record.lastPurchaseTimestamp, now));

                    if (isNewPeriod) {
                        record.quantity = 1;
                        record.lastPurchaseTimestamp = now;
                    } else {
                        record.quantity++;
                    }
                } else {
                    user.guildShopPurchases[itemId] = {
                        quantity: 1,
                        lastPurchaseTimestamp: now,
                    };
                }
            }
            
            // Special handling for Stat Points
            if (itemToBuy.itemId === '보너스 스탯 +5') {
                user.bonusStatPoints = (user.bonusStatPoints || 0) + 5;
                await db.updateUser(user);
                
                const rewardSummary = {
                    reward: { bonus: '스탯+5' },
                    items: [],
                    title: '길드 상점 구매'
                };
                return { clientResponse: { updatedUser: user, rewardSummary } };
            }
            
            // Regular item handling
            let itemsToAdd: InventoryItem[] = [];
            if (itemToBuy.type === 'equipment_box') {
                itemsToAdd.push(openGuildGradeBox(itemToBuy.grade));
            } else { // 'material' or 'consumable'
                const template = [...CONSUMABLE_ITEMS, ...Object.values(MATERIAL_ITEMS)].find(t => t.name === itemToBuy.name);
                
                if (template) {
                    itemsToAdd.push({
                        ...template,
                        id: `item-${globalThis.crypto.randomUUID()}`,
                        createdAt: Date.now(),
                        quantity: 1,
                        isEquipped: false, level: 1, stars: 0, options: undefined, slot: null,
                    });
                } else {
                     console.error(`[Guild Shop] Could not find template for ${itemToBuy.name}`);
                     if (!user.isAdmin) { user.guildCoins = (user.guildCoins || 0) + itemToBuy.cost; } // Refund
                     return { error: '아이템 정보를 찾을 수 없습니다.' };
                }
            }
            
            const { success } = addItemsToInventory(user.inventory, user.inventorySlots, itemsToAdd);
            if (!success) {
                if (!user.isAdmin) { user.guildCoins = (user.guildCoins || 0) + itemToBuy.cost; } // Refund
                return { error: '인벤토리 공간이 부족합니다.' };
            }
            
            await db.updateUser(user);
            
            return { clientResponse: { updatedUser: user, obtainedItemsBulk: itemsToAdd } };
        }

        case 'SEND_GUILD_CHAT_MESSAGE': {
            const { text } = payload;
            if (!user.guildId) return { error: "길드에 가입되어 있지 않습니다." };
            const guild = guilds[user.guildId];
            if (!guild) return { error: "길드를 찾을 수 없습니다." };

            if (!guild.chatHistory) guild.chatHistory = [];

            const message = {
                id: `msg-guild-${globalThis.crypto.randomUUID()}`,
                user: { id: user.id, nickname: user.nickname },
                text,
                timestamp: Date.now(),
            };
            guild.chatHistory.push(message);
            if (guild.chatHistory.length > 100) {
                guild.chatHistory.shift();
            }
            await db.setKV('guilds', guilds);
            return {};
        }

        case 'GUILD_DELETE_CHAT_MESSAGE': {
            const { messageId, timestamp } = payload;
            if (!user.guildId) return { error: "길드에 가입되어 있지 않습니다." };
            const guild = guilds[user.guildId];
            if (!guild) return { error: "길드를 찾을 수 없습니다." };
        
            let messageIndex = -1;
            
            // Primary method: find by ID
            if (messageId) {
                messageIndex = guild.chatHistory.findIndex(m => m.id === messageId);
            }
            
            // Fallback method for older messages without an ID on the client
            if (messageIndex === -1 && timestamp) {
                messageIndex = guild.chatHistory.findIndex(m => m.timestamp === timestamp && m.user.id === user.id && !m.system);
            }
            
            if (messageIndex === -1) {
                return { error: "메시지를 찾을 수 없습니다." };
            }
        
            const messageToDelete = guild.chatHistory[messageIndex];
            
            const myMemberInfo = guild.members.find(m => m.userId === user.id);
            const canManage = myMemberInfo?.role === GuildMemberRole.Master || myMemberInfo?.role === GuildMemberRole.Vice;
        
            if (messageToDelete.user.id !== user.id && !canManage) {
                return { error: "메시지를 삭제할 권한이 없습니다." };
            }
        
            guild.chatHistory.splice(messageIndex, 1);
        
            await db.setKV('guilds', guilds);
            return {};
        }
        
        case 'START_GUILD_BOSS_BATTLE': {
            const { result } = payload as { result: GuildBossBattleResult };
            if (!user.guildId) return { error: "길드에 가입되어 있지 않습니다." };
            const guild = guilds[user.guildId];
            if (!guild) return { error: "길드를 찾을 수 없습니다." };

            if (!user.isAdmin) {
                if ((user.guildBossAttempts || 0) >= 2) return { error: "오늘 도전 횟수를 모두 사용했습니다." };
            }

            if (!guild.guildBossState) {
                guild.guildBossState = {
                    currentBossId: 'boss_1',
                    currentBossHp: GUILD_BOSSES[0].maxHp,
                    totalDamageLog: {},
                    lastReset: Date.now(),
                };
            }
            
            guild.guildBossState.currentBossHp = result.bossHpAfter;
            guild.guildBossState.totalDamageLog[user.id] = (guild.guildBossState.totalDamageLog[user.id] || 0) + result.damageDealt;

            if (!user.isAdmin) {
                user.guildBossAttempts = (user.guildBossAttempts || 0) + 1;
                user.lastGuildBossAttemptDate = Date.now();
            }

            user.guildCoins = (user.guildCoins || 0) + result.rewards.guildCoins;
            updateQuestProgress(user, 'guild_boss_participate');
            
            const currentBoss = GUILD_BOSSES.find(b => b.id === guild.guildBossState!.currentBossId);
            if (currentBoss) {
                const chatMessage: ChatMessage = {
                    id: `msg-guild-${randomUUID()}`,
                    user: { id: 'system', nickname: '시스템' },
                    system: true,
                    text: `[${user.nickname}] 길드 보스전에서 [${currentBoss.name}] 보스에게 ${result.damageDealt.toLocaleString()}의 피해를 입혔습니다.`,
                    timestamp: Date.now(),
                };
                if (!guild.chatHistory) guild.chatHistory = [];
                guild.chatHistory.push(chatMessage);
                if (guild.chatHistory.length > 100) {
                    guild.chatHistory.shift();
                }
            }

            await db.setKV('guilds', guilds);
            await db.updateUser(user);
            
            return { clientResponse: { updatedUser: user, guildBossBattleResult: result } };
        }


        default:
            return { error: 'Unknown guild action type.' };
    }
};