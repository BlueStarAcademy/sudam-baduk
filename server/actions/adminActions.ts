
import * as db from '../db.js';
import { 
    type ServerAction, 
    type User, 
    type AdminLog, 
    type Announcement, 
    type OverrideAnnouncement, 
    type LiveGameSession, 
    type UserStatusInfo, 
    type InventoryItem, 
    type Mail,
    type Guild,
    GameMode, 
    UserStatus,
    Player,
    WinReason,
    GameStatus as GameStatusEnum, // Use alias to avoid conflict
    VolatileState
} from '../../types/index.js';
import { defaultStats, createDefaultSpentStatPoints, createDefaultUser } from '../initialData.js';
import * as summaryService from '../summaryService.js';
import { createItemFromTemplate } from '../shop.js';
import { EQUIPMENT_POOL, CONSUMABLE_ITEMS, MATERIAL_ITEMS } from '../../constants/items.js';
import * as mannerService from '../services/mannerService.js';
import { containsProfanity } from '../../profanity.js';
import { calculateUserEffects, createDefaultBaseStats } from '../../utils/statUtils.js';
import * as currencyService from '../currencyService.js';
import { isSameDayKST } from '../../utils/timeUtils.js';
import crypto from 'crypto';

type HandleActionResult = { 
    clientResponse?: any;
    error?: string;
};

const createAdminLog = async (admin: User, action: AdminLog['action'], target: User | { id: string; nickname: string }, details: any, backupData: any) => {
    const log: AdminLog = {
        id: `log-${globalThis.crypto.randomUUID()}`,
        timestamp: Date.now(),
        adminId: admin.id,
        adminNickname: admin.nickname,
        targetUserId: target.id,
        targetNickname: target.nickname,
        action: action,
        details: details,
        backupData: backupData
    };

    const logs = await db.getKV<AdminLog[]>('adminLogs') || [];
    logs.unshift(log);
    if (logs.length > 200) logs.length = 200;
    await db.setKV('adminLogs', logs);
};

export const handleAdminAction = async (action: ServerAction & { user: User }, volatileState: VolatileState): Promise<HandleActionResult> => {
    const { type, payload, user } = action;
    if (!user.isAdmin) {
        return { error: 'Permission denied.' };
    }

    const now = Date.now();

    switch (type) {
        case 'ADMIN_APPLY_SANCTION': {
            const { targetUserId, sanctionType, durationMinutes } = payload;
            const targetUser = await db.getUser(targetUserId);
            if (!targetUser) return { error: '대상 사용자를 찾을 수 없습니다.' };

            const banUntil = now + durationMinutes * 60 * 1000;

            if (sanctionType === 'chat') {
                targetUser.chatBanUntil = banUntil;
            } else if (sanctionType === 'connection') {
                targetUser.connectionBanUntil = banUntil;
                
                // Update volatile state for immediate effect
                delete volatileState.userStatuses[targetUserId];
                delete volatileState.userConnections[targetUserId];
                delete volatileState.userSessions[targetUserId];

                // Update persisted state
                const userStatuses = await db.getKV<Record<string, UserStatusInfo>>('userStatuses') || {};
                delete userStatuses[targetUserId];
                await db.setKV('userStatuses', userStatuses);
            }

            await db.updateUser(targetUser);
            await createAdminLog(user, 'apply_sanction', targetUser, { sanctionType, durationMinutes }, null);
            return { clientResponse: { updatedUserDetail: targetUser } };
        }

        case 'ADMIN_LIFT_SANCTION': {
            const { targetUserId, sanctionType } = payload;
            const targetUser = await db.getUser(targetUserId);
            if (!targetUser) return { error: '대상 사용자를 찾을 수 없습니다.' };

            if (sanctionType === 'chat') {
                targetUser.chatBanUntil = undefined;
            } else if (sanctionType === 'connection') {
                targetUser.connectionBanUntil = undefined;
            }

            await db.updateUser(targetUser);
            await createAdminLog(user, 'lift_sanction', targetUser, { sanctionType }, null);
            return { clientResponse: { updatedUserDetail: targetUser } };
        }
        case 'ADMIN_RESET_USER_DATA': {
            const { targetUserId, resetType } = payload;
            const targetUser = await db.getUser(targetUserId);
            if (!targetUser) return { error: '대상 사용자를 찾을 수 없습니다.' };

            const backupData = JSON.parse(JSON.stringify(targetUser));

            if (resetType === 'full') {
                targetUser.strategyLevel = 1;
                targetUser.strategyXp = 0;
                targetUser.playfulLevel = 1;
                targetUser.playfulXp = 0;
                targetUser.spentStatPoints = createDefaultSpentStatPoints();
            }
            targetUser.stats = JSON.parse(JSON.stringify(defaultStats));

            await db.updateUser(targetUser);
            await createAdminLog(user, resetType === 'full' ? 'reset_full' : 'reset_stats', targetUser, null, backupData);
            return { clientResponse: { updatedUserDetail: targetUser } };
        }
        case 'ADMIN_DELETE_USER': {
            const { targetUserId } = payload;
            const targetUser = await db.getUser(targetUserId);
            if (!targetUser) return { error: '대상 사용자를 찾을 수 없습니다.' };
            if (targetUser.isAdmin) return { error: '관리자 계정은 삭제할 수 없습니다.' };

            const allActiveGames = await db.getAllActiveGames();
            const activeGame = allActiveGames.find(g => g.player1.id === targetUserId || g.player2.id === targetUserId);
            
            if (activeGame) {
                console.log(`[Admin] Ending active game ${activeGame.id} for deleted user ${targetUserId}`);
                const winner = activeGame.player1.id === targetUserId ? Player.White : Player.Black;
                
                activeGame.winner = winner;
                activeGame.winReason = WinReason.Disconnect;
                activeGame.gameStatus = GameStatusEnum.Ended;
                await db.saveGame(activeGame);
                await summaryService.processGameSummary(activeGame);
                await db.saveGame(activeGame);
                
                const opponentId = activeGame.player1.id === targetUserId ? activeGame.player2.id : activeGame.player1.id;
                const opponentStatus = volatileState.userStatuses[opponentId];
                if(opponentStatus) {
                    opponentStatus.status = UserStatus.Waiting;
                    opponentStatus.mode = activeGame.mode;
                    delete opponentStatus.gameId;
                    opponentStatus.stateEnteredAt = now;
                }
            }

            const backupData = JSON.parse(JSON.stringify(targetUser));
            await db.deleteUser(targetUserId);

            // Update volatile state
            delete volatileState.userStatuses[targetUserId];
            delete volatileState.userConnections[targetUserId];
            delete volatileState.userSessions[targetUserId];

            // Update persisted state
            const userStatuses = await db.getKV<Record<string, UserStatusInfo>>('userStatuses') || {};
            delete userStatuses[targetUserId];
            await db.setKV('userStatuses', userStatuses);

            await createAdminLog(user, 'delete_user', targetUser, null, backupData);
            return { clientResponse: { deletedUserId: targetUserId } };
        }
        case 'ADMIN_CREATE_USER': {
            const { username, password, nickname } = payload;
            if (!username || !password || !nickname) { return { error: '모든 필드를 입력해야 합니다.' }; }

            const existingByUsername = await db.getUserCredentials(username);
            if (existingByUsername) return { error: '이미 사용 중인 아이디입니다.' };

            const allUsers = await db.getAllUsers();
            if (allUsers.some(u => u.nickname.toLowerCase() === nickname.toLowerCase())) {
                return { error: '이미 사용 중인 닉네임입니다.' };
            }
            
            const newUser = createDefaultUser(`user-${globalThis.crypto.randomUUID()}`, username, nickname, false);
            await db.createUser(newUser);
            const salt = crypto.randomBytes(16).toString('hex');
            const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
            await db.createUserCredentials(username, hash, salt, newUser.id);
            return {};
        }
        case 'ADMIN_FORCE_LOGOUT': {
            const { targetUserId } = payload;
            const targetUser = await db.getUser(targetUserId);
            if (!targetUser) return { error: '대상 사용자를 찾을 수 없습니다.' };

            const userStatuses = await db.getKV<Record<string, UserStatusInfo>>('userStatuses') || {};
            const backupData = { status: userStatuses[targetUserId] };

            // Update volatile state for immediate effect
            delete volatileState.userStatuses[targetUserId];
            delete volatileState.userConnections[targetUserId];
            delete volatileState.userSessions[targetUserId];
            
            // Update persisted state
            delete userStatuses[targetUserId];
            await db.setKV('userStatuses', userStatuses);
            
            await createAdminLog(user, 'force_logout', targetUser, null, backupData);
            return {};
        }
        case 'ADMIN_SEND_MAIL': {
            const { targetType, targetSpecifier, title, message, expiresInDays, attachments } = payload as any;

            let targetUsers: User[] = [];
            const allUsers = await db.getAllUsers();

            if (targetSpecifier === 'all' || targetType === 'all') {
                targetUsers = allUsers;
            } else if (targetType === 'guild') {
                const guilds = await db.getKV<Record<string, Guild>>('guilds') || {};
                const targetGuild = Object.values(guilds).find(g => g.name === targetSpecifier);
                if(targetGuild) {
                    const memberIds = new Set(targetGuild.members.map(m => m.userId));
                    targetUsers = allUsers.filter(u => memberIds.has(u.id));
                }
            } else { // 'user'
                const foundUser = allUsers.find(u => u.nickname === targetSpecifier || u.username === targetSpecifier);
                if (foundUser) targetUsers.push(foundUser);
            }

            if (targetUsers.length === 0) return { error: '메일을 보낼 사용자를 찾을 수 없습니다.' };

            for (const target of targetUsers) {
                 const userAttachments: Mail['attachments'] = {
                    gold: attachments.gold,
                    diamonds: attachments.diamonds,
                    actionPoints: attachments.actionPoints,
                    items: []
                };

                if (attachments.items && attachments.items.length > 0) {
                    for (const attachedItem of attachments.items) {
                        const { name, quantity, type } = attachedItem;
                        if (type === 'equipment') {
                            for (let i = 0; i < quantity; i++) {
                                const template = EQUIPMENT_POOL.find(t => t.name === name);
                                if (template) {
                                    (userAttachments.items as any[]).push(createItemFromTemplate(template));
                                }
                            }
                        } else { 
                            const template = [...CONSUMABLE_ITEMS, ...Object.values(MATERIAL_ITEMS)].find(t => t.name === name);
                            if (template) {
                                (userAttachments.items as InventoryItem[]).push({
                                    ...(template as any),
                                    id: `item-${globalThis.crypto.randomUUID()}`,
                                    createdAt: Date.now(),
                                    isEquipped: false,
                                    level: 1,
                                    stars: 0,
                                    quantity: quantity,
                                });
                            }
                        }
                    }
                }
                
                const newMail: Mail = {
                    id: `mail-${globalThis.crypto.randomUUID()}`,
                    from: user.nickname,
                    title,
                    message,
                    attachments: userAttachments,
                    receivedAt: Date.now(),
                    expiresAt: expiresInDays > 0 ? Date.now() + expiresInDays * 24 * 60 * 60 * 1000 : undefined,
                    isRead: false,
                    attachmentsClaimed: false
                };
                if(target) {
                    target.mail.unshift(newMail);
                    await db.updateUser(target);
                }
            }
             await createAdminLog(user, 'send_mail', { id: targetSpecifier, nickname: targetSpecifier }, { mailTitle: title }, null);
            return {};
        }
        case 'ADMIN_GIVE_ACTION_POINTS': {
            const { targetUserId, amount } = payload as { targetUserId: string; amount: number };
            const targetUser = await db.getUser(targetUserId);
            if (!targetUser) return { error: '대상 사용자를 찾을 수 없습니다.' };
            if (isNaN(amount) || amount <= 0) return { error: '유효한 수량을 입력하세요.' };
        
            targetUser.actionPoints.current += amount;
            
            const guilds = await db.getKV<Record<string, Guild>>('guilds') || {};
            const guild = targetUser.guildId ? (guilds[targetUser.guildId] ?? null) : null;
            const effects = calculateUserEffects(targetUser, guild);
            targetUser.actionPoints.max = effects.maxActionPoints;
        
            await db.updateUser(targetUser);
            await createAdminLog(user, 'give_action_points', targetUser, { amount }, null);
            return { clientResponse: { updatedUserDetail: targetUser } };
        }
        case 'ADMIN_REORDER_ANNOUNCEMENTS': {
            await db.setKV('announcements', payload.announcements);
            return {};
        }
        case 'ADMIN_ADD_ANNOUNCEMENT': {
            const announcements = await db.getKV<Announcement[]>('announcements') || [];
            const newAnnouncement: Announcement = { id: `ann-${globalThis.crypto.randomUUID()}`, message: payload.message };
            announcements.push(newAnnouncement);
            await db.setKV('announcements', announcements);
            return {};
        }
        case 'ADMIN_REMOVE_ANNOUNCEMENT': {
            const announcements = await db.getKV<Announcement[]>('announcements') || [];
            const updatedAnnouncements = announcements.filter(a => a.id !== payload.id);
            await db.setKV('announcements', updatedAnnouncements);
            return {};
        }
        case 'ADMIN_SET_ANNOUNCEMENT_INTERVAL': {
            await db.setKV('announcementInterval', payload.interval);
            return {};
        }
                case 'ADMIN_SET_OVERRIDE_ANNOUNCEMENT': {
            const override: OverrideAnnouncement = { message: payload.message, modes: 'all' };
            await db.setKV('globalOverrideAnnouncement', override);
            return {};
        }
        case 'ADMIN_CLEAR_OVERRIDE_ANNOUNCEMENT': {
            await db.setKV('globalOverrideAnnouncement', null);
            return {};
        }
        case 'ADMIN_TOGGLE_GAME_MODE': {
            const { mode, isAvailable } = payload;
            const availability = await db.getKV<Record<GameMode, boolean>>('gameModeAvailability') || {} as Record<GameMode, boolean>;
            availability[mode as GameMode] = isAvailable;
            await db.setKV('gameModeAvailability', availability);
            return {};
        }
        case 'ADMIN_SET_GAME_DESCRIPTION': {
            const { gameId, description } = payload;
            const game = await db.getLiveGame(gameId);
            if (!game) return { error: 'Game not found.' };
            game.description = description;
            await db.saveGame(game);
            await createAdminLog(user, 'set_game_description', game.player1, { mailTitle: `Game ${game.id}`}, null);
            return {};
        }
        case 'ADMIN_FORCE_DELETE_GAME': {
            const { gameId } = payload;
            const game = await db.getLiveGame(gameId);
            if (!game) return { error: 'Game not found.' };

            if (!game.player1 || !game.player2) {
                console.error(`[Admin] Corrupt game ${gameId} found with missing player data. Deleting record directly to prevent server crash.`);
                await db.deleteGame(gameId);
                return { clientResponse: { success: true } };
            }

            const backupData = JSON.parse(JSON.stringify(game));

            game.gameStatus = GameStatusEnum.NoContest;
            game.winReason = WinReason.Disconnect;
            game.statsUpdated = true; 

            await db.saveGame(game);
            
            // Update volatile state for immediate effect
            const p1Status = volatileState.userStatuses[game.player1.id];
            if (p1Status) {
                p1Status.status = UserStatus.Waiting;
                p1Status.mode = game.mode;
                delete p1Status.gameId;
                p1Status.stateEnteredAt = now;
            }
            const p2Status = volatileState.userStatuses[game.player2.id];
            if (p2Status) {
                p2Status.status = UserStatus.Waiting;
                p2Status.mode = game.mode;
                delete p2Status.gameId;
                p2Status.stateEnteredAt = now;
            }
            
            await createAdminLog(user, 'force_delete_game', game.player1, { reason: "Admin forced game closure" }, backupData);
            return { clientResponse: { success: true } };
        }
        case 'ADMIN_FORCE_WIN': {
            const { gameId, winnerId } = payload as { gameId: string; winnerId: string };
            const game = await db.getLiveGame(gameId);
            if (!game) return { error: 'Game not found.' };
            if (game.gameStatus === GameStatusEnum.Ended || game.gameStatus === GameStatusEnum.NoContest) {
                return { error: 'Game has already ended.' };
            }

            const winnerEnum = game.blackPlayerId === winnerId ? Player.Black : Player.White;
            const winnerUser = game.player1.id === winnerId ? game.player1 : game.player2;

            await summaryService.endGame(game, winnerEnum, WinReason.Resign);
            const userStatuses = await db.getKV<Record<string, UserStatusInfo>>('userStatuses') || {};
            const p1Status = userStatuses[game.player1.id];
            if (p1Status) {
                p1Status.status = UserStatus.Waiting;
                p1Status.mode = game.mode;
                delete p1Status.gameId;
                p1Status.stateEnteredAt = now;
            }
            const p2Status = userStatuses[game.player2.id];
            if (p2Status) {
                p2Status.status = UserStatus.Waiting;
                p2Status.mode = game.mode;
                delete p2Status.gameId;
                p2Status.stateEnteredAt = now;
            }
             await db.setKV('userStatuses', userStatuses);
            
            await createAdminLog(user, 'force_win', winnerUser, { gameId, winnerId }, null);
            return {};
        }
        case 'ADMIN_UPDATE_USER_DETAILS': {
            const { targetUserId, updatedDetails } = payload as { targetUserId: string; updatedDetails: Partial<User> };
            const targetUser = await db.getUser(targetUserId);
            if (!targetUser) return { error: '대상 사용자를 찾을 수 없습니다.' };

            const backupData = JSON.parse(JSON.stringify(targetUser));
            
            if (updatedDetails.nickname !== undefined && updatedDetails.nickname !== targetUser.nickname) {
                const newNickname = updatedDetails.nickname.trim();
                if (newNickname.length < 2 || newNickname.length > 12) {
                    return { error: '닉네임은 2-12자여야 합니다.' };
                }
                if (containsProfanity(newNickname)) {
                    return { error: '닉네임에 부적절한 단어가 포함되어 있습니다.' };
                }
                const allUsers = await db.getAllUsers();
                if (allUsers.some(u => u.id !== targetUserId && u.nickname.toLowerCase() === newNickname.toLowerCase())) {
                    return { error: '이미 사용 중인 닉네임입니다.' };
                }
                targetUser.nickname = newNickname;
            }

            if (updatedDetails.isAdmin !== undefined) {
                 if (user.id === targetUserId && targetUser.isAdmin && !updatedDetails.isAdmin) {
                    return { error: '자신의 관리자 권한을 해제할 수 없습니다.' };
                }
                targetUser.isAdmin = !!updatedDetails.isAdmin;
            }
            
            const oldMannerScore = targetUser.mannerScore;

            if(updatedDetails.strategyLevel !== undefined) targetUser.strategyLevel = Number(updatedDetails.strategyLevel) || 1;
            if(updatedDetails.strategyXp !== undefined) targetUser.strategyXp = Number(updatedDetails.strategyXp) || 0;
            if(updatedDetails.playfulLevel !== undefined) targetUser.playfulLevel = Number(updatedDetails.playfulLevel) || 1;
            if(updatedDetails.playfulXp !== undefined) targetUser.playfulXp = Number(updatedDetails.playfulXp) || 0;
            
            if(updatedDetails.gold !== undefined) {
                const diff = (Number(updatedDetails.gold) || 0) - targetUser.gold;
                if (diff > 0) currencyService.grantGold(targetUser, diff, `관리자(${user.nickname}) 지급`);
                else if (diff < 0) currencyService.spendGold(targetUser, -diff, `관리자(${user.nickname}) 차감`);
            }
            if(updatedDetails.diamonds !== undefined) {
                 const diff = (Number(updatedDetails.diamonds) || 0) - targetUser.diamonds;
                if (diff > 0) currencyService.grantDiamonds(targetUser, diff, `관리자(${user.nickname}) 지급`);
                else if (diff < 0) currencyService.spendDiamonds(targetUser, -diff, `관리자(${user.nickname}) 차감`);
            }

            if(updatedDetails.actionPoints !== undefined) targetUser.actionPoints.current = Number((updatedDetails.actionPoints as any).current) || 0;
            if(updatedDetails.mannerScore !== undefined) targetUser.mannerScore = Number(updatedDetails.mannerScore) || 200;
            if(updatedDetails.guildCoins !== undefined) targetUser.guildCoins = Number(updatedDetails.guildCoins) || 0;
            if(updatedDetails.guildBossAttempts !== undefined) targetUser.guildBossAttempts = Number(updatedDetails.guildBossAttempts) || 0;

            
            const guilds = await db.getKV<Record<string, Guild>>('guilds') || {};
            const targetUserGuild = targetUser.guildId ? (guilds[targetUser.guildId] ?? null) : null;
            const effects = calculateUserEffects(targetUser, targetUserGuild);
            targetUser.actionPoints.max = effects.maxActionPoints;

            if (updatedDetails.quests) {
                targetUser.quests = updatedDetails.quests;
            }
            
            if (updatedDetails.stats) {
                for (const mode in updatedDetails.stats) {
                    const modeKey = mode as GameMode;
                    if (targetUser.stats && targetUser.stats[modeKey] && updatedDetails.stats[modeKey]) {
                        targetUser.stats[modeKey]!.rankingScore = Number(updatedDetails.stats[modeKey]!.rankingScore) || 1200;
                    }
                }
            }
            
            if(updatedDetails.mannerScore !== undefined) {
                 await mannerService.applyMannerRankChange(targetUser, oldMannerScore);
            }
           
            await db.updateUser(targetUser);
            await createAdminLog(user, 'update_user_details', targetUser, null, backupData);

            if (targetUserId !== user.id) {
                delete volatileState.userConnections[targetUserId];
            }
            
            return { clientResponse: { updatedUserDetail: targetUser } };
        }
        case 'ADMIN_UPDATE_GUILD_DETAILS': {
            const { guildId, updatedDetails } = payload;
            const guilds = await db.getKV<Record<string, Guild>>('guilds') || {};
            const guildToUpdate = guilds[guildId];
            if (!guildToUpdate) {
                return { error: "길드를 찾을 수 없습니다." };
            }
            
            const backupData = JSON.parse(JSON.stringify(guildToUpdate));
            Object.assign(guildToUpdate, updatedDetails);
            await db.setKV('guilds', guilds);
            
            await createAdminLog(user, 'update_guild_details', { id: guildId, nickname: guildToUpdate.name }, null, backupData);
            return { clientResponse: { guilds } };
        }
        case 'ADMIN_APPLY_GUILD_SANCTION': {
            const { guildId, sanctionType, durationHours } = payload;
            const guilds = await db.getKV<Record<string, Guild>>('guilds') || {};
            const guildToSanction = guilds[guildId];
            if (!guildToSanction) {
                return { error: "길드를 찾을 수 없습니다." };
            }

            if (sanctionType === 'recruitment') {
                if(durationHours < 0) {
                     guildToSanction.recruitmentBanUntil = undefined;
                } else {
                     guildToSanction.recruitmentBanUntil = Date.now() + durationHours * 60 * 60 * 1000;
                }
            }

            await db.setKV('guilds', guilds);
            await createAdminLog(user, 'apply_guild_sanction', { id: guildId, nickname: guildToSanction.name }, { sanctionType, durationHours }, null);
            return { clientResponse: { guilds } };
        }
        case 'ADMIN_DELETE_GUILD': {
            const { guildId } = payload;
            const guilds = await db.getKV<Record<string, Guild>>('guilds') || {};
            const guildToDelete = guilds[guildId];

            if (!guildToDelete) {
                return { error: '길드를 찾을 수 없습니다.' };
            }

            const allUsers = await db.getAllUsers();
            for (const member of guildToDelete.members) {
                const userToUpdate = allUsers.find(u => u.id === member.userId);
                if (userToUpdate && userToUpdate.guildId === guildId) {
                    userToUpdate.guildId = null;
                    await db.updateUser(userToUpdate);
                }
            }

            delete guilds[guildId];
            await db.setKV('guilds', guilds);
            
            await createAdminLog(user, 'delete_guild', { id: guildId, nickname: guildToDelete.name }, null, guildToDelete);
            
            return { clientResponse: { guilds } };
        }
        default:
            return { error: 'Unknown admin action type.' };
    }
};
