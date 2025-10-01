

import { VolatileState, ServerAction, User, HandleActionResult, GameMode, Guild } from '../../types/index.js';
import * as db from '../db.js';
import { containsProfanity } from '../../profanity.js';
import { createDefaultSpentStatPoints } from '../initialData.js';
import * as currencyService from '../currencyService.js';
import * as guildService from '../guildService.js';

export const handleUserAction = async (volatileState: VolatileState, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult> => {
    const { type, payload } = action;

    switch(type) {
        case 'UPDATE_AVATAR': {
            user.avatarId = payload.avatarId;
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }
        case 'UPDATE_BORDER': {
            user.borderId = payload.borderId;
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }
        case 'CHANGE_NICKNAME': {
            const { newNickname } = payload;
            const cost = 150;
            if (!user.isAdmin && user.diamonds < cost) {
                return { error: '다이아가 부족합니다.' };
            }
            if (newNickname.trim().length < 2 || newNickname.trim().length > 12) {
                return { error: '닉네임은 2-12자여야 합니다.' };
            }
            if (containsProfanity(newNickname)) {
                 return { error: '닉네임에 부적절한 단어가 포함되어 있습니다.' };
            }
            const allUsers = await db.getAllUsers();
            if (allUsers.some(u => u.id !== user.id && u.nickname.toLowerCase() === newNickname.toLowerCase())) {
                return { error: '이미 사용 중인 닉네임입니다.' };
            }
            
            if (!user.isAdmin) {
                currencyService.spendDiamonds(user, cost, '닉네임 변경');
                if (user.guildId) {
                    guildService.updateGuildMissionProgress(user.guildId, 'diamondsSpent', cost);
                }
            }

            user.nickname = newNickname.trim();

            if (user.guildId) {
                const guilds = await db.getKV<Record<string, Guild>>('guilds') || {};
                const guild = guilds[user.guildId];
                if (guild) {
                    const memberIndex = guild.members.findIndex(m => m.userId === user.id);
                    if (memberIndex > -1) {
                        guild.members[memberIndex].nickname = user.nickname;
                        
                        if (guild.chatHistory) {
                            guild.chatHistory.forEach(msg => {
                                if (msg.user.id === user.id) {
                                    msg.user.nickname = user.nickname;
                                }
                            });
                        }
                        
                        await db.setKV('guilds', guilds);
                    }
                }
            }

            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }
        case 'RESET_STAT_POINTS': {
            const allResets = await db.getKV<{ [userId: string]: number }>('userStatResets') || {};
            const resets = allResets[user.id] || 0;
            const cost = 1000 * Math.pow(2, Math.min(resets, 9)); // 1st: 1000, 2nd: 2000... 10th+: 512,000

            if (payload?.dryRun) {
                return { clientResponse: { cost } };
            }

            if (!user.isAdmin) {
                if (user.gold < cost) {
                    return { error: `골드가 부족합니다. (필요: ${cost.toLocaleString()} 골드)` };
                }
                currencyService.spendGold(user, cost, `스탯 초기화 (${resets + 1}회차)`);
            }
            
            user.spentStatPoints = createDefaultSpentStatPoints();
            allResets[user.id] = resets + 1;
            
            await db.setKV('userStatResets', allResets);
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }
        case 'RESET_SINGLE_STAT': {
            const cost = 300;
            if (!user.isAdmin) {
                if (user.diamonds < cost) return { error: '다이아가 부족합니다.' };
                currencyService.spendDiamonds(user, cost, '단일 스탯 초기화');
                if (user.guildId) {
                    guildService.updateGuildMissionProgress(user.guildId, 'diamondsSpent', cost);
                }
            }
             // Logic to reset single stat will be handled client-side for confirmation
            return { clientResponse: { success: true, cost }};
        }
        case 'UPDATE_MBTI': {
            user.mbti = payload.mbti;
            user.isMbtiPublic = payload.isMbtiPublic;
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }
        case 'CHANGE_PASSWORD': {
            const { currentPassword, newPassword } = payload;
            const creds = await db.getUserCredentialsByUserId(user.id);
            if (creds?.passwordHash !== currentPassword) {
                return { error: '현재 비밀번호가 일치하지 않습니다.' };
            }
            // FIX: Add password length check
            if (newPassword.length < 4) {
                 return { error: '새 비밀번호는 4자 이상이어야 합니다.' };
            }
            await db.updateUserPassword(user.id, newPassword);
            return { clientResponse: { success: true } };
        }
        case 'CONFIRM_STAT_ALLOCATION': {
            user.spentStatPoints = payload.newStatPoints;
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }
        case 'DELETE_ACCOUNT': {
            await db.deleteUser(user.id);
            delete volatileState.userConnections[user.id];
            delete volatileState.userStatuses[user.id];
            return { clientResponse: { success: true } };
        }
        case 'RESET_STATS_CATEGORY': {
            const { category } = payload as { category: 'strategic' | 'playful' };
            const cost = 500;
            if (!user.isAdmin) {
                if (user.diamonds < cost) {
                    return { error: `다이아가 부족합니다. (필요: ${cost})` };
                }
                currencyService.spendDiamonds(user, cost, `${category === 'strategic' ? '전략' : '놀이'} 전적 초기화`);
                if (user.guildId) {
                    guildService.updateGuildMissionProgress(user.guildId, 'diamondsSpent', cost);
                }
            }

            const modesToReset = category === 'strategic'
                ? Object.values(GameMode).filter(m => m !== GameMode.Alkkagi && m !== GameMode.Curling && m !== GameMode.Dice && m !== GameMode.Omok && m !== GameMode.Ttamok && m !== GameMode.Thief)
                : [GameMode.Alkkagi, GameMode.Curling, GameMode.Dice, GameMode.Omok, GameMode.Ttamok, GameMode.Thief];

            for (const mode of modesToReset) {
                if (user.stats[mode]) {
                    user.stats[mode] = { wins: 0, losses: 0, rankingScore: 0 };
                }
            }
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }
        case 'UPDATE_APP_SETTINGS': {
            user.appSettings = payload.settings;
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }
        default:
            return { error: 'Unknown user action type.' };
    }
};