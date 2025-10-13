// server/actions/socialActions.ts

import { type VolatileState, type ServerAction, type User, type HandleActionResult, UserStatus, ChatMessage, UserStatusInfo } from '../../types/index.js';
import * as db from '../db.js';
import { randomUUID } from 'crypto';
import { containsProfanity } from '../../profanity.js';
import { updateQuestProgress } from '../questService.js';

export const handleSocialAction = async (volatileState: VolatileState, action: ServerAction & { user: User }): Promise<HandleActionResult> => {
    const { type, payload, user } = action;
    const now = Date.now();

    const userStatuses = await db.getKV<Record<string, UserStatusInfo>>('userStatuses') || {};
    let statusesChanged = false;

    const { userConnections, userSessions, userLastChatMessage, waitingRoomChats, gameChats } = volatileState;

    switch (type) {
        case 'LOGOUT': {
            delete userConnections[user.id];
            delete userStatuses[user.id];
            statusesChanged = true;

            delete userSessions[user.id];
            const allSessions = (await db.getKV<Record<string, string>>('userSessions') || {}) as Record<string, string>;
            delete allSessions[user.id];
            await db.setKV('userSessions', allSessions);
            
            if (statusesChanged) {
                volatileState.userStatuses = userStatuses;
                await db.setKV('userStatuses', userStatuses);
            }
            return { clientResponse: { success: true } };
        }
        case 'ENTER_WAITING_ROOM': {
            const { mode } = payload;
            const userStatus = userStatuses[user.id] || { status: UserStatus.Online, stateEnteredAt: now };
            
            userStatus.status = UserStatus.Waiting;
            userStatus.mode = mode;
            delete userStatus.gameId;
            delete userStatus.spectatingGameId;
            userStatus.stateEnteredAt = now;
            
            userStatuses[user.id] = userStatus;
            statusesChanged = true;
            break;
        }
        case 'SET_USER_STATUS': {
            const { status } = payload;
            if (![UserStatus.Waiting, UserStatus.Resting].includes(status)) {
                return { error: 'Invalid status update.' };
            }
            const userStatus = userStatuses[user.id];
            if (userStatus && [UserStatus.Waiting, UserStatus.Resting, UserStatus.Online].includes(userStatus.status)) {
                userStatus.status = status;
                userStatus.stateEnteredAt = now;
                statusesChanged = true;
            }
            break;
        }

        case 'SPECTATE_GAME': {
            const { gameId } = payload;
            const game = await db.getLiveGame(gameId);
            if (!game || game.gameStatus === 'ended' || game.gameStatus === 'no_contest') {
                return { error: 'Game not available for spectating.' };
            }
            const userStatus = userStatuses[user.id] || { status: UserStatus.Online, stateEnteredAt: now };
            userStatus.status = UserStatus.Spectating;
            userStatus.spectatingGameId = gameId;
            userStatus.mode = game.mode;
            userStatus.stateEnteredAt = now;
            userStatuses[user.id] = userStatus;
            statusesChanged = true;
            break;
        }

        case 'SEND_CHAT_MESSAGE': {
            const { channel, text, emoji, location } = payload;
            
            const lastMessageTime = userLastChatMessage[user.id] || 0;
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
                    if (!waitingRoomChats['global']) waitingRoomChats['global'] = [];
                    waitingRoomChats['global'].push(warningMessage);
                    await db.setKV('waitingRoomChats', waitingRoomChats);
                } else {
                    if (!gameChats[channel]) gameChats[channel] = [];
                    gameChats[channel].push(warningMessage);
                    await db.setKV('gameChats', gameChats);
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
                if (!waitingRoomChats['global']) waitingRoomChats['global'] = [];
                waitingRoomChats['global'].push(message);
                if (waitingRoomChats['global'].length > 100) waitingRoomChats['global'].shift();
                await db.setKV('waitingRoomChats', waitingRoomChats);

                if (text && (text.includes('안녕') || text.includes('하이') || text.includes('반갑'))) {
                    const updatedUser = await db.getUser(user.id);
                    if(updatedUser) {
                        updateQuestProgress(updatedUser, 'chat_greeting');
                        await db.updateUser(updatedUser);
                    }
                }

            } else { // Game chat
                if (!gameChats[channel]) gameChats[channel] = [];
                gameChats[channel].push(message);
                if (gameChats[channel].length > 100) gameChats[channel].shift();
                await db.setKV('gameChats', gameChats);
            }
            
            userLastChatMessage[user.id] = now;
            await db.setKV('userLastChatMessage', userLastChatMessage);
            break;
        }
        case 'LEAVE_AI_GAME': {
            const { gameId } = payload;
            const game = await db.getLiveGame(gameId);
            if (game && (game.isAiGame || game.isSinglePlayer || game.isTowerChallenge) && game.player1.id === user.id) {
                await db.deleteGame(game.id);
            }
            if (userStatuses[user.id]) {
                const status = userStatuses[user.id];
                status.status = UserStatus.Online;
                delete status.gameId;
                delete status.mode;
                status.stateEnteredAt = now;
                statusesChanged = true;
            }
            break;
        }
        case 'LEAVE_WAITING_ROOM': {
            if (userStatuses[user.id]) {
                userStatuses[user.id].status = UserStatus.Online;
                userStatuses[user.id].mode = undefined;
                userStatuses[user.id].gameId = undefined;
                userStatuses[user.id].stateEnteredAt = now;
                statusesChanged = true;
            }
            break;
        }
        case 'LEAVE_GAME_ROOM': {
            const { gameId, mode } = payload;
            const userStatus = userStatuses[user.id];

            if (userStatus && userStatus.gameId === gameId) {
                userStatus.status = UserStatus.Waiting;
                userStatus.mode = mode;
                delete userStatus.gameId;
                userStatus.stateEnteredAt = now;
                statusesChanged = true;
            }
            break;
        }
        case 'LEAVE_SPECTATING': {
            const { gameId, mode } = payload;
            const userStatus = userStatuses[user.id];
            
            if (userStatus && userStatus.spectatingGameId === gameId) {
                userStatus.status = UserStatus.Waiting;
                userStatus.mode = mode;
                delete userStatus.spectatingGameId;
                userStatus.stateEnteredAt = now;
                statusesChanged = true;
            }
            break;
        }
        default:
             return { error: 'Unknown social action type.' };
    }
    
    if (statusesChanged) {
        volatileState.userStatuses = userStatuses;
        await db.setKV('userStatuses', userStatuses);
    }
    
    return { clientResponse: { success: true } };
};
