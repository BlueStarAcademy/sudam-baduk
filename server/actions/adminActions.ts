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

export const handleAdminAction = async (action: ServerAction, volatileState: VolatileState): Promise<HandleActionResult> => {
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
                // Force immediate logout
                delete volatileState.userConnections[targetUserId];
                delete volatileState.userSessions[targetUserId];
            }
            await db.updateUser(targetUser);
            return {};
        }

        case 'ADMIN_LIFT_SANCTION': {
            const { targetUserId, sanctionType } = payload;
            const targetUser = await db.getUser(targetUserId);
            if (!targetUser) return { error: 'Target user not found.' };

            if (sanctionType === 'chat') {
                targetUser.chatBanUntil = 0;
            } else if (sanctionType === 'connection') {
                targetUser.connectionBanUntil = 0;
            }
            await db.updateUser(targetUser);
            return {};
        }

        case 'ADMIN_RESET_USER_DATA': {
            const { targetUserId, resetType } = payload;
            const targetUser = await db.getUser(targetUserId);
            if (!targetUser) return { error: 'Target user not found.' };

            if (resetType === 'full' || resetType === 'stats') {
                targetUser.stats = JSON.parse(JSON.stringify(createDefaultUser('', '', '').stats));
                targetUser.spentStatPoints = createDefaultSpentStatPoints();
            }
            if (resetType === 'full') {
                targetUser.strategyLevel = 1;
                targetUser.strategyXp = 0;
                targetUser.playfulLevel = 1;
                targetUser.playfulXp = 0;
            }
            await db.updateUser(targetUser);
            return {};
        }
        
        case 'ADMIN_DELETE_USER': {
            const { targetUserId } = payload;
            await db.deleteUser(targetUserId);
            return {};
        }

        case 'ADMIN_FORCE_LOGOUT': {
            const { targetUserId } = payload;
            delete volatileState.userConnections[targetUserId];
            delete volatileState.userSessions[targetUserId];
            return {};
        }

        case 'ADMIN_SEND_MAIL': {
            const { targetType, targetSpecifier, title, message, expiresInDays, attachments } = payload;
            
            const mail: Omit<Mail, 'id' | 'receivedAt' | 'isRead' | 'attachmentsClaimed'> = {
                from: '관리자',
                title,
                message,
                attachments,
                expiresAt: expiresInDays > 0 ? Date.now() + expiresInDays * 24 * 60 * 60 * 1000 : undefined,
            };
            
            const usersToMail: User[] = [];
            if (targetType === 'all') {
                usersToMail.push(...await db.getAllUsers());
            } else if (targetType === 'user') {
                const targetUser = await db.getUserByNickname(targetSpecifier);
                if (targetUser) usersToMail.push(targetUser);
            } else if (targetType === 'guild') {
                const guilds = await db.getKV<Record<string, Guild>>('guilds') || {};
                const targetGuild = Object.values(guilds).find(g => g.name === targetSpecifier);
                if (targetGuild) {
                    const memberIds = targetGuild.members.map(m => m.userId);
                    const allUsers = await db.getAllUsers();
                    usersToMail.push(...allUsers.filter(u => memberIds.includes(u.id)));
                }
            }

            for (const targetUser of usersToMail) {
                targetUser.mail.unshift({
                    ...mail,
                    id: `mail-${randomUUID()}`,
                    receivedAt: Date.now(),
                    isRead: false,
                    attachmentsClaimed: false,
                });
                await db.updateUser(targetUser);
            }
            return {};
        }
        
        case 'ADMIN_GIVE_ACTION_POINTS': {
            const { targetUserId, amount } = payload;
            const targetUser = await db.getUser(targetUserId);
            if (targetUser) {
                targetUser.actionPoints.current += amount;
                await db.updateUser(targetUser);
            }
            return {};
        }
        
        case 'ADMIN_REORDER_ANNOUNCEMENTS': {
            await db.setKV('announcements', payload.announcements);
            return {};
        }
        case 'ADMIN_ADD_ANNOUNCEMENT': {
            const announcements = await db.getKV<any[]>('announcements') || [];
            announcements.push({ id: `ann-${randomUUID()}`, message: payload.message });
            await db.setKV('announcements', announcements);
            return {};
        }
        case 'ADMIN_REMOVE_ANNOUNCEMENT': {
            let announcements = await db.getKV<any[]>('announcements') || [];
            announcements = announcements.filter(a => a.id !== payload.id);
            await db.setKV('announcements', announcements);
            return {};
        }
        case 'ADMIN_SET_ANNOUNCEMENT_INTERVAL': {
            await db.setKV('announcementInterval', payload.interval);
            return {};
        }
        case 'ADMIN_SET_OVERRIDE_ANNOUNCEMENT': {
            await db.setKV('globalOverrideAnnouncement', { message: payload.message, modes: 'all' });
            return {};
        }
        case 'ADMIN_CLEAR_OVERRIDE_ANNOUNCEMENT': {
            await db.setKV('globalOverrideAnnouncement', null);
            return {};
        }
        
        case 'ADMIN_TOGGLE_GAME_MODE': {
            const { mode, isAvailable } = payload;
            const availability = await db.getKV<Record<GameMode, boolean>>('gameModeAvailability') || {} as Record<GameMode, boolean>;
            availability[mode] = isAvailable;
            await db.setKV('gameModeAvailability', availability);
            return {};
        }
        
        case 'ADMIN_FORCE_DELETE_GAME': {
            await db.deleteGame(payload.gameId);
            return {};
        }
        
        case 'ADMIN_FORCE_WIN': {
            const { gameId, winnerId } = payload;
            const game = await db.getLiveGame(gameId);
            if (game) {
                const winner = game.player1.id === winnerId ? (game.blackPlayerId === game.player1.id ? Player.Black : Player.White) : (game.blackPlayerId === game.player2.id ? Player.Black : Player.White);
                await endGame(game, winner, WinReason.Resign); // Use resign as reason
            }
            return {};
        }

        case 'ADMIN_UPDATE_USER_DETAILS': {
            const { targetUserId, updatedDetails } = payload;
            const targetUser = await db.getUser(targetUserId);
            if (targetUser) {
                // A bit risky, but this is an admin action. Let's merge what's given.
                const updated = { ...targetUser, ...updatedDetails };
                await db.updateUser(updated);
            }
            return {};
        }

        case 'ADMIN_UPDATE_GUILD_DETAILS': {
            const { guildId, updatedDetails } = payload;
            const guilds = await db.getKV<Record<string, Guild>>('guilds') || {};
            const guild = guilds[guildId];
            if (guild) {
                Object.assign(guild, updatedDetails);
                await db.setKV('guilds', guilds);
            }
            return {};
        }

        case 'ADMIN_APPLY_GUILD_SANCTION': {
            const { guildId, sanctionType, durationHours } = payload;
            const guilds = await db.getKV<Record<string, Guild>>('guilds') || {};
            const guild = guilds[guildId];
            if (guild) {
                if (sanctionType === 'recruitment') {
                    guild.recruitmentBanUntil = Date.now() + durationHours * 60 * 60 * 1000;
                }
                await db.setKV('guilds', guilds);
            }
            return {};
        }

        case 'ADMIN_DELETE_GUILD': {
            const { guildId } = payload;
            const guilds = await db.getKV<Record<string, Guild>>('guilds') || {};
            const guild = guilds[guildId];
            if (guild) {
                const memberIds = guild.members.map(m => m.userId);
                for (const memberId of memberIds) {
                    const memberUser = await db.getUser(memberId);
                    if (memberUser) {
                        memberUser.guildId = null;
                        await db.updateUser(memberUser);
                    }
                }
                await db.setKV('guilds', guilds);
            }
            return { clientResponse: { guilds } };
        }
        
        default:
            console.warn(`[Admin] Unhandled action type: ${type}`);
            return { error: 'Unknown admin action type.' };
    }
};
