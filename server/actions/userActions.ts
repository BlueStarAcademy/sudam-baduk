import * as db from '../db.js';
import * as types from '../../types/index.js';
import { AVATAR_POOL, BORDER_POOL } from '../../constants.js';
import { containsProfanity } from '../../profanity.js';

type HandleActionResult = { 
    clientResponse?: any;
    error?: string;
};

export const handleUserAction = async (volatileState: types.VolatileState, action: types.ServerAction & { userId: string }, user: types.User): Promise<HandleActionResult> => {
    const { type, payload } = action;

    switch (type) {
        case 'UPDATE_AVATAR': {
            const { avatarId } = payload;
            if (AVATAR_POOL.some(a => a.id === avatarId)) {
                user.avatarId = avatarId;
                await db.updateUser(user);
            } else {
                return { error: 'Invalid avatar ID.' };
            }
            return {};
        }
        case 'UPDATE_BORDER': {
            const { borderId } = payload;
            if (BORDER_POOL.some(b => b.id === borderId)) {
                user.borderId = borderId;
                await db.updateUser(user);
            } else {
                return { error: 'Invalid border ID.' };
            }
            return {};
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
            return {};
        }
        case 'UPDATE_MBTI': {
            const { mbti, isMbtiPublic } = payload;
            if (mbti && (typeof mbti !== 'string' || !/^[IE][NS][TF][JP]$/.test(mbti))) {
                return { error: '유효하지 않은 MBTI 형식입니다.' };
            }
            user.mbti = mbti || null;
            user.isMbtiPublic = !!isMbtiPublic;
            await db.updateUser(user);
            return {};
        }
        case 'RESET_STAT_POINTS': {
            const cost = 500;
            if (user.diamonds < cost && !user.isAdmin) return { error: `다이아가 부족합니다. (필요: ${cost})` };
            
            if (!user.isAdmin) {
                user.diamonds -= cost;
            }
            for (const key of Object.values(types.CoreStat)) {
                user.spentStatPoints[key] = 0;
            }
            await db.updateUser(user);
            return {};
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
            return {};
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
        default:
            return { error: 'Unknown user action.' };
    }
};