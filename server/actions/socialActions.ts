import { type VolatileState, type ServerAction, type User, type HandleActionResult, UserStatus, ChatMessage } from '../../types/index.js';
import * as db from '../db.js';
import { randomUUID } from 'crypto';
import { containsProfanity } from '../../profanity.js';
import { updateQuestProgress } from '../questService.js';

export const handleSocialAction = async (volatileState: VolatileState, action: ServerAction & { user: User }): Promise<HandleActionResult> => {
    const { type, payload, user } = action;
    const now = Date.now();

    switch (type) {
        case 'LOGOUT': {
            delete volatileState.userConnections[user.id];
            delete volatileState.userStatuses[user.id];
            delete volatileState.userSessions[user.id];
            return { clientResponse: { success: true } };
        }
        case 'ENTER_WAITING_ROOM': {
            const { mode } = payload;
            const userStatus = volatileState.userStatuses[user.id];
            if (userStatus) {
                userStatus.status = UserStatus.Waiting;
                userStatus.mode = mode;
                delete userStatus.gameId;
                delete userStatus.spectatingGameId;
                userStatus.stateEnteredAt = now;
            }
            return { clientResponse: { success: true } };
        }
        case 'SET_USER_STATUS': {
            const { status } = payload;
            if (![UserStatus.Waiting, UserStatus.Resting].includes(status)) {
                return { error: 'Invalid status update.' };
            }
            const userStatus = volatileState.userStatuses[user.id];
            if (userStatus && [UserStatus.Waiting, UserStatus.Resting, UserStatus.Online].includes(userStatus.status)) {
                userStatus.status = status;
                userStatus.stateEnteredAt = now;
            }
            return { clientResponse: { success: true } };
        }

        case 'SPECTATE_GAME': {
            const { gameId } = payload;
            const game = await db.getLiveGame(gameId);
            if (!game || game.gameStatus === 'ended' || game.gameStatus === 'no_contest') {
                return { error: 'Game not available for spectating.' };
            }
            const userStatus = volatileState.userStatuses[user.id];
            if (userStatus) {
                userStatus.status = UserStatus.Spectating;
                userStatus.spectatingGameId = gameId;
                userStatus.mode = game.mode;
                userStatus.stateEnteredAt = now;
            }
            return { clientResponse: { success: true } };
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
                    if (!volatileState.waitingRoomChats['global']) volatileState.waitingRoomChats['global'] = [];
                    volatileState.waitingRoomChats['global'].push(warningMessage);
                } else {
                    if (!volatileState.gameChats[channel]) volatileState.gameChats[channel] = [];
                    volatileState.gameChats[channel].push(warningMessage);
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
                if (!volatileState.waitingRoomChats['global']) volatileState.waitingRoomChats['global'] = [];
                volatileState.waitingRoomChats['global'].push(message);
                if (text && (text.includes('안녕') || text.includes('하이') || text.includes('반갑'))) {
                    const updatedUser = await db.getUser(user.id);
                    if(updatedUser) {
                        updateQuestProgress(updatedUser, 'chat_greeting');
                        await db.updateUser(updatedUser);
                    }
                }

            } else { // Game chat
                if (!volatileState.gameChats[channel]) volatileState.gameChats[channel] = [];
                volatileState.gameChats[channel].push(message);
            }
            
            volatileState.userLastChatMessage[user.id] = now;
            return { clientResponse: { success: true } };
        }
        case 'LEAVE_AI_GAME': {
            const { gameId } = payload;
            const game = await db.getLiveGame(gameId);
            // Only the player of the AI game should be able to delete it
            if (game && game.isAiGame && game.player1.id === user.id) {
                await db.deleteGame(gameId);
            }
            if (volatileState.userStatuses[user.id]) {
                const status = volatileState.userStatuses[user.id];
                status.status = UserStatus.Online; // Go back to general online status, not waiting room
                delete status.gameId;
                delete status.mode;
                status.stateEnteredAt = now;
            }
            return { clientResponse: { success: true } };
        }
        case 'LEAVE_WAITING_ROOM': {
            if (volatileState.userStatuses[user.id]) {
                volatileState.userStatuses[user.id].status = UserStatus.Online;
                volatileState.userStatuses[user.id].mode = undefined;
                volatileState.userStatuses[user.id].gameId = undefined;
                volatileState.userStatuses[user.id].stateEnteredAt = now;
            }
            return { clientResponse: { success: true } };
        }
        case 'LEAVE_GAME_ROOM': {
            const { gameId, mode } = payload;
            const userStatus = volatileState.userStatuses[user.id];

            if (userStatus && userStatus.gameId === gameId) {
                userStatus.status = UserStatus.Waiting;
                userStatus.mode = mode;
                delete userStatus.gameId;
                userStatus.stateEnteredAt = now;
            }
            return { clientResponse: { success: true } };
        }
        case 'LEAVE_SPECTATING': {
            const { gameId, mode } = payload;
            const userStatus = volatileState.userStatuses[user.id];
            
            if (userStatus && userStatus.spectatingGameId === gameId) {
                userStatus.status = UserStatus.Waiting;
                userStatus.mode = mode;
                delete userStatus.spectatingGameId;
                userStatus.stateEnteredAt = now;
            }
            return { clientResponse: { success: true } };
        }
        default:
             return { error: 'Unknown social action type.' };
    }
};