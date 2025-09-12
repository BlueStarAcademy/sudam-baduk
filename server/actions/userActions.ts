
import * as db from '.././db.js';
import * as types from '../../types.js';
import { AVATAR_POOL, BORDER_POOL, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants.js';
import { containsProfanity } from '../../profanity.js';
import { createDefaultSpentStatPoints } from '../initialData.js';
import * as mannerService from '../mannerService.js';

type HandleActionResult = { 
    clientResponse?: any;
    error?: string;
};

export const handleUserAction = async (volatileState: types.VolatileState, action: types.ServerAction & { userId: string }, user: types.User): Promise<HandleActionResult> => {
    const { type, payload } = action;

    switch (type) {
        case 'UPDATE_AVATAR': {
            const { avatarId } = payload;
            const avatar = AVATAR_POOL.find((a: types.AvatarInfo) => a.id === avatarId);
            if (!avatar) return { error: 'Invalid avatar ID.' };

            const isUnlocked = avatar.type === 'any' || 
                (avatar.type === 'strategy' && user.strategyLevel >= avatar.requiredLevel) ||
                (avatar.type === 'playful' && user.playfulLevel >= avatar.requiredLevel);
            
            if (!isUnlocked) return { error: 'Avatar not unlocked.' };
            
            user.avatarId = avatarId;
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }
        case 'UPDATE_BORDER': {
            const { borderId } = payload;
            if (BORDER_POOL.some((b: types.BorderInfo) => b.id === borderId)) {
                user.borderId = borderId;
                await db.updateUser(user);
            } else {
                return { error: 'Invalid border ID.' };
            }
            return { clientResponse: { updatedUser: user } };
        }
        case 'CHANGE_NICKNAME': {
            const { newNickname } = payload;
            const cost = 150;
            if (user.diamonds < cost && !user.isAdmin) return { error: '다이아가 부족합니다.' };
            if (newNickname.trim().length < 2 || newNickname.trim().length > 12) return { error: '닉네임은 2-12자여야 합니다.' };
            if (containsProfanity(newNickname)) return { error: "닉네임에 부적절한 단어가 포함되어 있습니다." };
            
            const allUsers = await db.getAllUsers();
            if (allUsers.some((u: types.User) => u.nickname.toLowerCase() === newNickname.toLowerCase())) {
                return { error: '이미 사용 중인 닉네임입니다.' };
            }
            
            if (!user.isAdmin) {
                user.diamonds -= cost;
            }
            user.nickname = newNickname;
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }
        case 'UPDATE_MBTI': {
            const { mbti, isMbtiPublic } = payload;
            if (mbti && (typeof mbti !== 'string' || !/^[IE][NS][TF][JP]$/.test(mbti))) {
                return { error: '유효하지 않은 MBTI 형식입니다.' };
            }
            user.mbti = mbti || null;
            user.isMbtiPublic = !!isMbtiPublic;
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }
        case 'RESET_STAT_POINTS': {
            const cost = 500;
            if (user.diamonds < cost && !user.isAdmin) return { error: `다이아가 부족합니다. (필요: ${cost})` };
            
            if (!user.isAdmin) {
                user.diamonds -= cost;
            }
            user.spentStatPoints = createDefaultSpentStatPoints();
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }
        case 'CONFIRM_STAT_ALLOCATION': {
            const { newStatPoints } = payload as { newStatPoints: Record<types.CoreStat, number> };
            
            const levelPoints = (user.strategyLevel - 1) * 2 + (user.playfulLevel - 1) * 2;
            const masteryBonus = user.mannerMasteryApplied ? 20 : 0;
            const bonusPoints = user.bonusStatPoints || 0;
            const totalAvailablePoints = levelPoints + masteryBonus + bonusPoints;
            
            const totalSpent = Object.values(newStatPoints).reduce((sum, points) => sum + points, 0);

            if (totalSpent > totalAvailablePoints) {
                return { error: '사용 가능한 포인트를 초과했습니다.' };
            }

            user.spentStatPoints = newStatPoints;
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }
        case 'CHANGE_PASSWORD': {
            const { currentPassword, newPassword } = payload;
            const credentials = await db.getUserCredentialsByUserId(user.id);
            if (!credentials || credentials.passwordHash !== currentPassword) {
                return { error: '현재 비밀번호가 일치하지 않습니다.' };
            }
            if (newPassword.trim().length < 4) {
                return { error: "새 비밀번호는 4자 이상이어야 합니다." };
            }
            
            await db.updateUserPassword(user.id, newPassword); 
            return { clientResponse: { success: true, message: "비밀번호가 변경되었습니다." } };
        }
        case 'DELETE_ACCOUNT': {
            if (user.isAdmin) {
                return { error: '관리자 계정은 탈퇴할 수 없습니다.' };
            }
            
            await db.deleteUser(user.id);
            
            delete volatileState.userConnections[user.id];
            delete volatileState.userStatuses[user.id];
            
            return { clientResponse: { success: true } };
        }
        case 'RESET_SINGLE_STAT': {
            const { mode } = payload as { mode: types.GameMode };
            const cost = 300;
            if (user.diamonds < cost) return { error: '다이아가 부족합니다.' };

            if (user.stats?.[mode]) {
                user.diamonds -= cost;
                user.stats[mode] = { wins: 0, losses: 0, rankingScore: 1200 };
                await db.updateUser(user);
                return { clientResponse: { updatedUser: user } };
            }
            return { error: '초기화할 전적이 없습니다.' };
        }
        case 'RESET_STATS_CATEGORY': {
            const { category } = payload as { category: 'strategic' | 'playful' };
            const cost = 500;
            if (user.diamonds < cost) return { error: '다이아가 부족합니다.' };
            
            const modesToReset = category === 'strategic' ? SPECIAL_GAME_MODES : PLAYFUL_GAME_MODES;
            user.diamonds -= cost;
            for (const modeInfo of modesToReset) {
                if (user.stats?.[modeInfo.mode]) {
                    user.stats[modeInfo.mode] = { wins: 0, losses: 0, rankingScore: 1200 };
                }
            }
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }
        default:
            return { error: 'Unknown user action.' };
    }
};
