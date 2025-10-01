import * as db from './db.js';
import { User, GameMode, LeagueTier, Mail, WeeklyCompetitor, Guild, QuestReward, GuildMemberRole, GuildMember, ChatMessage, GuildResearchId, UserStatus } from '../types/index.js';
import { isDifferentWeekKST, getCurrentSeason, getPreviousSeason, isDifferentMonthKST, getKSTDate, isDifferentDayKST } from '../utils/timeUtils.js';
import { LEAGUE_DATA, LEAGUE_WEEKLY_REWARDS, SEASONAL_TIER_REWARDS, RANKING_TIERS, BOT_NAMES, AVATAR_POOL, TOWER_RANKING_REWARDS, GUILD_BOSSES, SINGLE_PLAYER_MISSIONS, GUILD_RESEARCH_PROJECTS } from '../constants/index.js';
import { createInitialBotCompetitors, defaultStats } from './initialData.js';
import * as guildService from './guildService.js';
import { randomUUID } from 'crypto';
import * as effectService from '../utils/statUtils.js';

export const performOneTimeReset = async () => {
    const resetFlag = await db.getKV('oneTimeRankingScoreReset_20240722');
    if (resetFlag) {
        return;
    }
    console.log('[RESET] Performing one-time ranking score reset for all users...');
    const allUsers = await db.getAllUsers();
    for (const user of allUsers) {
        if (user.stats) {
            for (const mode in user.stats) {
                user.stats[mode as GameMode].rankingScore = 1200;
            }
            await db.updateUser(user);
        }
    }
    await db.setKV('oneTimeRankingScoreReset_20240722', true);
    console.log('[RESET] One-time ranking score reset complete.');
};

export const processRankingRewards = async () => {
    const lastRewardTime = await db.getKV<number>('lastSeasonalRewardTime');
    const now = Date.now();
    const currentSeason = getCurrentSeason(now);
    const previousSeason = getPreviousSeason(now);

    // Check if rewards for the current season have already been processed
    if (lastRewardTime) {
        const lastRewardSeason = getCurrentSeason(lastRewardTime);
        if (lastRewardSeason.name === currentSeason.name) {
            return; // Already processed for this season
        }
    } else {
        // If it's the very first run, just set the time and don't give rewards.
        await db.setKV('lastSeasonalRewardTime', now);
        return;
    }

    console.log(`[Scheduler] Processing seasonal rewards for ${previousSeason.name}...`);
    const allUsers = await db.getAllUsers();

    // Prepare a map of all users' scores for each mode to calculate ranks
    const scoresByMode: Partial<Record<GameMode, { id: string, score: number }[]>> = {};
    for (const mode of Object.values(GameMode)) {
        scoresByMode[mode] = allUsers
            .map(u => ({ id: u.id, score: u.stats?.[mode]?.rankingScore || 0 }))
            .sort((a, b) => b.score - a.score);
    }

    const tierOrder = RANKING_TIERS.map(t => t.name);

    for (const user of allUsers) {
        let userModified = false;
        const seasonHistory = user.seasonHistory || {};
        seasonHistory[previousSeason.name] = {} as Record<GameMode, string>;
        
        let highestTierIndex = tierOrder.length - 1; // Start with the lowest tier ('새싹')

        // Determine tier for each mode and find the highest one
        for (const mode of Object.values(GameMode)) {
            const userStats = user.stats?.[mode];
            let tierName = '새싹';

            if (userStats && (userStats.wins + userStats.losses >= 20)) {
                const scoresForMode = scoresByMode[mode]!;
                const rank = scoresForMode.findIndex(s => s.id === user.id) + 1;
                const totalPlayers = scoresForMode.length;

                const tier = RANKING_TIERS.find(t => t.threshold(userStats.rankingScore, rank, totalPlayers));
                tierName = tier ? tier.name : '새싹';
            }
            
            seasonHistory[previousSeason.name][mode] = tierName;
            
            const currentTierIndex = tierOrder.indexOf(tierName);
            if (currentTierIndex !== -1 && currentTierIndex < highestTierIndex) {
                highestTierIndex = currentTierIndex;
            }
        }
        
        const highestTierName = tierOrder[highestTierIndex];
        const reward = SEASONAL_TIER_REWARDS[highestTierName];

        if (reward) {
            const mail: Mail = {
                id: `mail-season-reward-${user.id}-${previousSeason.name}`,
                from: '시스템',
                title: `[${previousSeason.name}] 시즌 보상`,
                message: `지난 시즌 달성하신 최고 티어 '${highestTierName}'에 대한 보상입니다. 이번 시즌도 화이팅!`,
                attachments: reward,
                receivedAt: now,
                expiresAt: now + 30 * 24 * 60 * 60 * 1000,
                isRead: false,
                attachmentsClaimed: false,
            };
            if (!user.mail) user.mail = [];
            user.mail.unshift(mail);
            userModified = true;
        }

        // Update user profile with new season data
        user.previousSeasonTier = highestTierName;
        user.seasonHistory = seasonHistory;
        user.stats = JSON.parse(JSON.stringify(defaultStats)); // Reset stats for the new season
        userModified = true;

        if (userModified) {
            await db.updateUser(user);
        }
    }

    await db.setKV('lastSeasonalRewardTime', now);
    console.log(`[Scheduler] Seasonal rewards for ${previousSeason.name} processed successfully.`);
};

export const processWeeklyLeagueUpdates = async (user: User, allUsers: User[]): Promise<User> => {
    const now = Date.now();
    if (!user.lastLeagueUpdate || isDifferentWeekKST(user.lastLeagueUpdate, now)) {
        if (user.lastLeagueUpdate) { // Don't give rewards on first-ever run for a user
            let league = user.league;
            if (!league || !Object.values(LeagueTier).includes(league)) {
                console.warn(`[Scheduler] User ${user.id} has invalid league tier: "${league}". Resetting to Sprout.`);
                user.league = LeagueTier.Sprout;
                league = user.league;
            }

            const myCompetitors = user.weeklyCompetitors || [];
            
            const sortedCompetitors = myCompetitors.map(c => {
                const liveUser = allUsers.find(u => u.id === c.id);
                const currentScore = liveUser ? liveUser.tournamentScore : c.currentScore;
                return { ...c, currentScore };
            }).sort((a, b) => b.currentScore - a.currentScore);
            
            const myRank = sortedCompetitors.findIndex(c => c.id === user.id) + 1;
            
            if (myRank > 0) {
                const rewardTiers = LEAGUE_WEEKLY_REWARDS[user.league];
                const myRewardTier = rewardTiers.find(t => myRank >= t.rankStart && myRank <= t.rankEnd);

                if (myRewardTier) {
                    const mailAttachments: QuestReward = {
                        diamonds: myRewardTier.diamonds,
                        items: myRewardTier.items,
                    };
                    if (myRewardTier.strategyXp) {
                        mailAttachments.exp = { type: 'strategy', amount: myRewardTier.strategyXp };
                    }
                    const mail: Mail = {
                        id: `mail-league-reward-${user.id}-${now}`,
                        from: '시스템',
                        title: `주간 경쟁 보상 (${league})`,
                        message: `${league}에서 ${myRank}위를 달성하셨습니다.`,
                        attachments: mailAttachments,
                        receivedAt: now,
                        expiresAt: now + 7 * 24 * 60 * 60 * 1000,
                        isRead: false,
                        attachmentsClaimed: false,
                    };
                    user.mail.unshift(mail);

                    const leagueOrder = Object.values(LeagueTier);
                    const currentTierIndex = leagueOrder.indexOf(league);
                    if (myRewardTier.outcome === 'promote' && currentTierIndex < leagueOrder.length - 1) {
                        user.league = leagueOrder[currentTierIndex + 1];
                    } else if (myRewardTier.outcome === 'demote' && currentTierIndex > 0) {
                        user.league = leagueOrder[currentTierIndex - 1];
                    }
                }
            }
        }
        
        user.tournamentScore = 500;
        user.weeklyCompetitors = createInitialBotCompetitors(user);
        user.lastLeagueUpdate = now;
        user.lastWeeklyCompetitorsUpdate = now;
        return user;
    }
    return user;
};

export const updateWeeklyCompetitorsIfNeeded = async (user: User, allUsers: User[]): Promise<User> => {
    const now = Date.now();
    if (!user.lastWeeklyCompetitorsUpdate || isDifferentWeekKST(user.lastWeeklyCompetitorsUpdate, now)) {
        user.weeklyCompetitors = createInitialBotCompetitors(user);
        user.lastWeeklyCompetitorsUpdate = now;
        return user;
    }
    
    let updated = false;
    user.weeklyCompetitors.forEach(c => {
        if (!c.id.startsWith('bot-')) {
            const realUser = allUsers.find(u => u.id === c.id);
            if (realUser && realUser.tournamentScore !== c.currentScore) {
                c.currentScore = realUser.tournamentScore;
                updated = true;
            }
        }
    });

    return updated ? user : user;
};

export const processMonthlyTowerReset = async () => {
    const now = Date.now();
    const nowKST = getKSTDate(now);

    if (nowKST.getUTCDate() !== 1) {
        return;
    }

    const lastResetTime = await db.getKV<number>('lastTowerResetTime');
    if (lastResetTime && !isDifferentMonthKST(lastResetTime, now)) {
        return;
    }
    
    const allUsers = await db.getAllUsers();
    
    const rewardSkipFlag = await db.getKV<boolean>('oneTimeTowerRewardSkip_20250915');

    if (!rewardSkipFlag) {
        console.log("[Scheduler] Performing one-time skip of monthly tower rewards.");
        await db.setKV('oneTimeTowerRewardSkip_20250915', true);
    } else {
        console.log(`[Scheduler] Processing monthly tower ranking rewards...`);
        const towerRankings = allUsers
            .filter(u => u.towerProgress && u.towerProgress.highestFloor > 0)
            .sort((a, b) => {
                if (b.towerProgress!.highestFloor !== a.towerProgress!.highestFloor) {
                    return b.towerProgress!.highestFloor - a.towerProgress!.highestFloor;
                }
                return a.towerProgress!.lastClearTimestamp - b.towerProgress!.lastClearTimestamp;
            });
            
        for (let i = 0; i < towerRankings.length; i++) {
            const user = towerRankings[i];
            const rank = i + 1;
            const rewardTier = TOWER_RANKING_REWARDS.find(t => rank >= t.rankStart && rank <= t.rankEnd);
            
            if (rewardTier) {
                const mailAttachments: QuestReward = {
                    diamonds: rewardTier.diamonds,
                    items: rewardTier.items,
                };
                if (rewardTier.strategyXp) {
                    mailAttachments.exp = { type: 'strategy', amount: rewardTier.strategyXp };
                }
                 const mail: Mail = {
                    id: `mail-tower-reward-${user.id}-${now}`,
                    from: '시스템',
                    title: `도전의 탑 월간 랭킹 보상`,
                    message: `지난달 도전의 탑에서 ${rank}위를 달성하셨습니다.`,
                    attachments: mailAttachments,
                    receivedAt: now,
                    expiresAt: now + 7 * 24 * 60 * 60 * 1000,
                    isRead: false,
                    attachmentsClaimed: false,
                };
                user.mail.unshift(mail);
            }
        }
    }

    console.log("[Scheduler] Resetting tower progress for all users.");
    for (const user of allUsers) {
        let userModified = false;
        if (user.towerProgress && (user.towerProgress.highestFloor > 0 || user.towerProgress.lastClearTimestamp > 0)) {
            user.towerProgress.highestFloor = 0;
            user.towerProgress.lastClearTimestamp = 0;
            userModified = true;
        }
        if (user.claimedFirstClearRewards?.some(id => id.startsWith('tower-'))) {
            user.claimedFirstClearRewards = user.claimedFirstClearRewards.filter(id => !id.startsWith('tower-'));
            userModified = true;
        }
        
        if (userModified || user.mail.some(m => m.id.startsWith('mail-tower-reward-'))) {
            await db.updateUser(user);
        }
    }

    await db.setKV('lastTowerResetTime', now);
    console.log("[Scheduler] Monthly tower reset process complete.");
};

export const processInactiveGuildMasters = async () => {
    const guilds = await db.getKV<Record<string, Guild>>('guilds') || {};
    const allUsers = await db.getAllUsers();
    let guildsUpdated = false;

    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

    for (const guild of Object.values(guilds)) {
        const master = guild.members.find(m => m.role === GuildMemberRole.Master);
        if (!master) continue;

        const masterUser = allUsers.find(u => u.id === master.userId);
        if (!masterUser || (masterUser.lastLoginAt && masterUser.lastLoginAt > twoWeeksAgo)) {
            continue;
        }

        let newMaster: GuildMember | null = null;
        let oldMasterNickname = master.nickname;
        
        const eligibleVices = guild.members
            .filter(m => m.role === GuildMemberRole.Vice)
            .map(m => ({ member: m, user: allUsers.find(u => u.id === m.userId) }))
            .filter(data => data.user && (data.user.lastLoginAt ?? 0) > twoWeeksAgo)
            .sort((a, b) => (b.member.contribution || 0) - (a.member.contribution || 0));

        if (eligibleVices.length > 0) {
            newMaster = eligibleVices[0].member;
        }

        if (!newMaster) {
            const eligibleMembers = guild.members
                .filter(m => m.role === GuildMemberRole.Member)
                .map(m => ({ member: m, user: allUsers.find(u => u.id === m.userId) }))
                .filter(data => data.user && (data.user.lastLoginAt ?? 0) > twoWeeksAgo)
                .sort((a, b) => (b.member.contribution || 0) - (a.member.contribution || 0));
            
            if (eligibleMembers.length > 0) {
                newMaster = eligibleMembers[0].member;
            }
        }
        
        if (newMaster) {
            master.role = GuildMemberRole.Member;
            newMaster.role = GuildMemberRole.Master;
            
            const systemMessage: ChatMessage = {
                id: `msg-guild-${randomUUID()}`,
                user: { id: 'system', nickname: '시스템' },
                system: true,
                text: `길드장 [${oldMasterNickname}]님이 2주 이상 미접속하여, 길드장 권한이 [${newMaster.nickname}]님에게 자동으로 위임되었습니다.`,
                timestamp: Date.now(),
            };
            if (!guild.chatHistory) guild.chatHistory = [];
            guild.chatHistory.push(systemMessage);
            if (guild.chatHistory.length > 100) guild.chatHistory.shift();

            guildsUpdated = true;
        }
    }

    if (guildsUpdated) {
        await db.setKV('guilds', guilds);
    }
};


export const runScheduledTasks = async () => {
    await processMonthlyTowerReset();
    await processRankingRewards();
    
    const now = Date.now();
    const lastGuildResetTime = await db.getKV<number>('lastGuildWeeklyResetTime') || 0;

    if (isDifferentWeekKST(lastGuildResetTime, now)) {
        console.log('[Scheduler] Performing weekly guild resets...');
        const guilds = await db.getKV<Record<string, Guild>>('guilds') || {};
        for(const guild of Object.values(guilds)) {
            guildService.resetWeeklyGuildMissions(guild, now);
            guild.members.forEach(m => m.weeklyContribution = 0);
            if (!guild.dailyCheckInRewardsClaimed) guild.dailyCheckInRewardsClaimed = [];
            guild.dailyCheckInRewardsClaimed = [];
            
            if (guild.guildBossState) {
                const currentBossIndex = GUILD_BOSSES.findIndex(b => b.id === guild.guildBossState!.currentBossId);
                const nextBossIndex = (currentBossIndex + 1) % GUILD_BOSSES.length;
                const nextBoss = GUILD_BOSSES[nextBossIndex];
                
                guild.guildBossState.currentBossId = nextBoss.id;
                guild.guildBossState.currentBossHp = nextBoss.maxHp;
                guild.guildBossState.totalDamageLog = {};
                guild.guildBossState.lastReset = now;
            } else {
                const firstBoss = GUILD_BOSSES[0];
                guild.guildBossState = {
                    currentBossId: firstBoss.id,
                    currentBossHp: firstBoss.maxHp,
                    totalDamageLog: {},
                    lastReset: now,
                };
            }
        }
        await db.setKV('guilds', guilds);
        await db.setKV('lastGuildWeeklyResetTime', now);
    }
};
