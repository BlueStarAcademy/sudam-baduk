import { type VolatileState, type ServerAction, type User, type HandleActionResult, UserStatus, ChatMessage, UserStatusInfo } from '../../types/index.js';
import * as db from '../db.js';
import { randomUUID } from 'crypto';
import { containsProfanity } from '../../profanity.js';
import { updateQuestProgress } from '../questService.js';
import { broadcast } from '../services/supabaseService.js';

export const handleSocialAction = async (volatileState: VolatileState, action: ServerAction & { user: User }): Promise<HandleActionResult> => {
    const { type, payload, user } = action;
    const now = Date.now();

    const allStatuses = await db.getKV<Record<string, UserStatusInfo>>('userStatuses') || {};
    let updatedUserStatuses: { [key: string]: UserStatusInfo | undefined } | null = null;

    switch (type) {
        case 'HEARTBEAT': {
            // This action is just for updating the user's last seen time,
            // which is already handled by the middleware.
            break;
        }
        case 'LOGOUT': {
            delete volatileState.userConnections[user.id];
            delete volatileState.userSessions[user.id];
            delete allStatuses[user.id];
            updatedUserStatuses = { [user.id]: undefined };
            
            const allSessions = await db.getKV<Record<string, string>>('userSessions') || {};
            delete allSessions[user.id];
            await db.setKV('userSessions', allSessions);
            break;
        }
        case 'ENTER_WAITING_ROOM': {
            const { mode } = payload;
            const status: UserStatusInfo = { status: UserStatus.Waiting, mode, stateEnteredAt: now };
            allStatuses[user.id] = status;
            updatedUserStatuses = { [user.id]: status };
            break;
        }
        case 'SET_USER_STATUS': {
            const { status } = payload;
            if (![UserStatus.Waiting, UserStatus.Resting].includes(status)) {
                return { error: 'Invalid status update.' };
            }
            const userStatus = allStatuses[user.id];
            if (userStatus && [UserStatus.Waiting, UserStatus.Resting, UserStatus.Online].includes(userStatus.status)) {
                userStatus.status = status;
                userStatus.stateEnteredAt = now;
                updatedUserStatuses = { [user.id]: userStatus };
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
            allStatuses[user.id] = status;
            updatedUserStatuses = { [user.id]: status };
            break;
        }
        case 'LEAVE_AI_GAME': {
            const { gameId } = payload;
            const game = await db.getLiveGame(gameId);
            if (game && (game.isAiGame || game.isSinglePlayer || game.isTowerChallenge) && game.player1.id === user.id) {
                // await db.deleteGame(game.id); // Do not delete SP games, let them be cleaned up later or archived
            }
            const status = allStatuses[user.id];
            if (status) {
                status.status = UserStatus.Online;
                delete status.gameId;
                delete status.mode;
                status.stateEnteredAt = now;
                updatedUserStatuses = { [user.id]: status };
            }
            return { clientResponse: { success: true, updatedUserStatuses, deletedGameId: gameId } };
        }
        case 'LEAVE_WAITING_ROOM': {
            const status = allStatuses[user.id];
            if (status) {
                status.status = UserStatus.Online;
                status.mode = undefined;
                status.gameId = undefined;
                status.stateEnteredAt = now;
                updatedUserStatuses = { [user.id]: status };
            }
            break;
        }
        case 'LEAVE_GAME_ROOM': {
            const { gameId, mode } = payload;
            const userStatus = allStatuses[user.id];

            if (userStatus && userStatus.gameId === gameId) {
                userStatus.status = UserStatus.Waiting;
                userStatus.mode = mode;
                delete userStatus.gameId;
                userStatus.stateEnteredAt = now;
                updatedUserStatuses = { [user.id]: userStatus };
            }
            break;
        }
        case 'LEAVE_SPECTATING': {
            const { gameId, mode } = payload;
            const userStatus = allStatuses[user.id];
            
            if (userStatus && userStatus.spectatingGameId === gameId) {
                userStatus.status = UserStatus.Waiting;
                userStatus.mode = mode;
                delete userStatus.spectatingGameId;
                userStatus.stateEnteredAt = now;
                updatedUserStatuses = { [user.id]: userStatus };
            }
            break;
        }
        case 'SEND_CHAT_MESSAGE': {
            const { channel, text, emoji, location } = payload;
            
            const lastMessageTime = volatileState.userLastChatMessage[user.id] || 0;
            if (now - lastMessageTime < 5000 && !user.isAdmin) {
                return { error: '채팅이 너무 빠릅니다. 잠시 후 다시 시도해주세요.' };
            }
            
            if (text && containsProfanity(text)) {
                const warningMessage: ChatMessage = {
                    id: `msg-${randomUUID()}`,
                    user: { id: 'system', nickname: 'AI 보안관봇' },
                    system: true,
                    text: `${user.nickname}님이 부적절한 언어를 사용하여 메시지가 삭제되었습니다.`,
                    timestamp: now,
                    location: location,
                };
                if (channel === 'global') {
                    volatileState.waitingRoomChats['global'] = [...(volatileState.waitingRoomChats['global'] || []), warningMessage].slice(-100);
                    await db.setKV('waitingRoomChats', volatileState.waitingRoomChats);
                    await broadcast({ waitingRoomChats: volatileState.waitingRoomChats });
                } else {
                    volatileState.gameChats[channel] = [...(volatileState.gameChats[channel] || []), warningMessage].slice(-100);
                    await db.setKV('gameChats', volatileState.gameChats);
                    await broadcast({ gameChats: volatileState.gameChats });
                }
                return { clientResponse: { success: true } };
            }

            const message: ChatMessage = {
                id: `msg-${randomUUID()}`,
                user: { id: user.id, nickname: user.nickname },
                text,
                emoji,
                timestamp: now,
                location: location,
            };
            
            if (channel === 'global') {
                volatileState.waitingRoomChats['global'] = [...(volatileState.waitingRoomChats['global'] || []), message].slice(-100);
                await db.setKV('waitingRoomChats', volatileState.waitingRoomChats);
                await broadcast({ waitingRoomChats: volatileState.waitingRoomChats });

                if (text && (text.includes('안녕') || text.includes('하이') || text.includes('반갑'))) {
                    const updatedUser = await db.getUser(user.id);
                    if(updatedUser) {
                        updateQuestProgress(updatedUser, 'chat_greeting');
                        await db.updateUser(updatedUser);
                    }
                }

            } else { // Game chat
                volatileState.gameChats[channel] = [...(volatileState.gameChats[channel] || []), message].slice(-100);
                await db.setKV('gameChats', volatileState.gameChats);
                await broadcast({ gameChats: volatileState.gameChats });
            }
            
            volatileState.userLastChatMessage[user.id] = now;
            await db.setKV('userLastChatMessage', volatileState.userLastChatMessage);
            break;
        }
        default:
             return { error: 'Unknown social action type.' };
    }
    
    if (updatedUserStatuses) {
        await db.setKV('userStatuses', allStatuses);
        volatileState.userStatuses = allStatuses;
        return { clientResponse: { success: true, updatedUserStatuses } };
    }
    
    return { clientResponse: { success: true } };
};