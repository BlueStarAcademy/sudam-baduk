import { type ServerAction, type User, type HandleActionResult, UserStatus, ChatMessage, UserStatusInfo } from '../../types/index.js';
import * as db from '../db.js';
import { randomUUID } from 'crypto';
import { containsProfanity } from '../../profanity.js';
import { updateQuestProgress } from '../questService.js';
import { broadcast } from '../services/supabaseService.js';

export const handleSocialAction = async (action: ServerAction & { user: User }): Promise<HandleActionResult> => {
    const { type, payload, user } = action;
    const now = Date.now();

    switch (type) {
        case 'HEARTBEAT': {
            // In a stateless architecture, a heartbeat might be used to update a 'last_seen' timestamp in the DB.
            // This can be handled by a cron job that cleans up users who haven't been seen recently.
            // For now, we do nothing here as the session middleware already implicitly handles activity.
            break;
        }
        case 'LOGOUT': {
            // This is now handled in server.ts action endpoint directly to allow logout even with expired session.
            // Kept here as a fallback but should ideally not be hit if client sends to /api/action.
            const allSessions = await db.getKV<Record<string, string>>('userSessions') || {};
            delete allSessions[user.id];
            await db.setKV('userSessions', allSessions);

            await db.removeUserStatus(user.id);
            await broadcast({ type: 'USER_STATUS_UPDATE', payload: { userId: user.id, statusInfo: null } });
            break;
        }
        case 'ENTER_WAITING_ROOM': {
            const { mode } = payload;
            const status: UserStatusInfo = { status: UserStatus.Waiting, mode, stateEnteredAt: now };
            await db.updateUserStatus(user.id, status);
            await broadcast({ type: 'USER_STATUS_UPDATE', payload: { userId: user.id, statusInfo: status } });
            break;
        }
        case 'SET_USER_STATUS': {
            const { status } = payload;
            if (![UserStatus.Waiting, UserStatus.Resting].includes(status)) {
                return { error: 'Invalid status update.' };
            }
            const userStatus = await db.getUserStatus(user.id);
            if (userStatus && [UserStatus.Waiting, UserStatus.Resting, UserStatus.Online].includes(userStatus.status)) {
                userStatus.status = status;
                userStatus.stateEnteredAt = now;
                await db.updateUserStatus(user.id, userStatus);
                await broadcast({ type: 'USER_STATUS_UPDATE', payload: { userId: user.id, statusInfo: userStatus } });
            }
            break;
        }
        case 'SPECTATE_GAME': {
            const { gameId } = payload;
            const game = await db.getLiveGame(gameId);
            if (!game || game.gameStatus === 'ended' || game.gameStatus === 'no_contest') {
                return { error: 'Game not available for spectating.' };
            }
            const status: UserStatusInfo = { 
                status: UserStatus.Spectating, 
                spectatingGameId: gameId, 
                mode: game.mode, 
                stateEnteredAt: now 
            };
            await db.updateUserStatus(user.id, status);
            await broadcast({ type: 'USER_STATUS_UPDATE', payload: { userId: user.id, statusInfo: status } });
            break;
        }
        case 'LEAVE_AI_GAME':
        case 'LEAVE_GAME_ROOM':
        case 'LEAVE_WAITING_ROOM':
        case 'LEAVE_SPECTATING': {
            const userStatus = await db.getUserStatus(user.id);
            if (userStatus) {
                const newStatus: UserStatusInfo = { status: UserStatus.Online, stateEnteredAt: now };
                await db.updateUserStatus(user.id, newStatus);
                await broadcast({ type: 'USER_STATUS_UPDATE', payload: { userId: user.id, statusInfo: newStatus } });
            }
            break;
        }
        case 'SEND_CHAT_MESSAGE': {
            const { channel, text, emoji, location } = payload;
            
            const userLastChatMessage = await db.getKV<Record<string, number>>('userLastChatMessage') || {};
            const lastMessageTime = userLastChatMessage[user.id] || 0;
            if (now - lastMessageTime < 5000 && !user.isAdmin) {
                return { error: '채팅이 너무 빠릅니다. 잠시 후 다시 시도해주세요.' };
            }

            let message: ChatMessage;
            let isWarning = false;

            if (text && containsProfanity(text)) {
                isWarning = true;
                message = {
                    id: `msg-${randomUUID()}`,
                    user: { id: 'system', nickname: 'AI 보안관봇' },
                    system: true,
                    text: `${user.nickname}님이 부적절한 언어를 사용하여 메시지가 삭제되었습니다.`,
                    timestamp: now,
                    location: location,
                };
            } else {
                message = {
                    id: `msg-${randomUUID()}`,
                    user: { id: user.id, nickname: user.nickname },
                    text,
                    emoji,
                    timestamp: now,
                    location: location,
                };
            }
            
            const chatKey = channel === 'global' ? 'waitingRoomChats' : 'gameChats';
            const allChats = await db.getKV<Record<string, ChatMessage[]>>(chatKey) || {};
            const channelChats = allChats[channel] || [];
            channelChats.push(message);
            allChats[channel] = channelChats.slice(-100);
            await db.setKV(chatKey, allChats);

            // Broadcast only the new message for efficiency
            await broadcast({ type: 'NEW_CHAT_MESSAGE', payload: { channel, message } });

            if (!isWarning) {
                userLastChatMessage[user.id] = now;
                await db.setKV('userLastChatMessage', userLastChatMessage);

                if (text && (text.includes('안녕') || text.includes('하이') || text.includes('반갑'))) {
                    const updatedUser = await db.getUser(user.id);
                    if(updatedUser) {
                        updateQuestProgress(updatedUser, 'chat_greeting');
                        await db.updateUser(updatedUser);
                    }
                }
            }
            break;
        }
        default:
             return { error: 'Unknown social action type.' };
    }
    
    return { clientResponse: { success: true } };
};