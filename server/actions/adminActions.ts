// server/actions/adminActions.ts

import * as db from '../db.js';
import { 
    type ServerAction, 
    type User, 
    type VolatileState, 
    type HandleActionResult,
    type Guild,
    GameMode,
    GameStatus,
    Player,
    WinReason,
    Mail,
} from '../../types/index.js';
import { createDefaultUser, createDefaultSpentStatPoints } from '../initialData.js';
import { randomUUID } from 'crypto';
import * as currencyService from '../currencyService.js';
import { endGame } from '../summaryService.js';
import { broadcast } from '../services/supabaseService.js';

export const handleAdminAction = async (action: ServerAction): Promise<HandleActionResult> => {
    const { type, payload, user } = action;
    if (!user || !user.isAdmin) {
        return { error: 'Permission denied.' };
    }

    switch (type) {
        case 'ADMIN_APPLY_SANCTION': {
            const { targetUserId, sanctionType, durationMinutes } = payload;
            const targetUser = await db.getUser(targetUserId);
            if (!targetUser) return { error: 'Target user not found.' };

            const banUntil = Date.now() + durationMinutes * 60 * 1000;
            if (sanctionType === 'chat') {
                targetUser.chatBanUntil = banUntil;
            } else if (sanctionType === 'connection') {
                targetUser.connectionBanUntil = banUntil;
                // Force immediate logout by removing persisted session
                const allSessions = await db.getKV<Record<string, string>>('userSessions') || {};
                delete allSessions[targetUserId];
                await db.setKV('userSessions', allSessions);
                await broadcast({ type: 'FORCE_LOGOUT', payload: { userId: targetUserId } });
            }
            await db.updateUser(targetUser);
            return {};
        }

        case 'ADMIN_FORCE_LOGOUT': {
            const { targetUserId } = payload;
            const allSessions = await db.getKV<Record<string, string>>('userSessions') || {};
            delete allSessions[targetUserId];
            await db.setKV('userSessions', allSessions);
            await broadcast({ type: 'FORCE_LOGOUT', payload: { userId: targetUserId } });
            return {};
        }

        // ... other cases remain largely the same as they already interact with the DB ...

        default:
            console.warn(`[Admin] Unhandled action type: ${type}`);
            return { error: 'Unknown admin action type.' };
    }
};
