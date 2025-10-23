import { ServerAction, User, HandleActionResult, GameMode, Guild, GameStatus, Player, UserStatus, Negotiation, UserStatusInfo } from '../../types/index.js';
import * as db from '../db.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, STRATEGIC_ACTION_POINT_COST, PLAYFUL_ACTION_POINT_COST, DEFAULT_GAME_SETTINGS } from '../../constants/index.js';
import { initializeGame } from '../gameModes.js';
import { calculateUserEffects } from '../../utils/statUtils.js';
import { aiUserId, getAiUser } from '../ai/index.js';
import { broadcast } from '../services/supabaseService.js';

const getActionPointCost = (mode: GameMode): number => {
    if (SPECIAL_GAME_MODES.some(m => m.mode === mode)) {
        return STRATEGIC_ACTION_POINT_COST;
    }
    if (PLAYFUL_GAME_MODES.some(m => m.mode === mode)) {
        return PLAYFUL_ACTION_POINT_COST;
    }
    return STRATEGIC_ACTION_POINT_COST;
};

export const handleNegotiationAction = async (action: ServerAction & { userId: string }, user: User, guilds: Record<string, Guild>): Promise<HandleActionResult> => {
    const { type, payload } = action;
    const now = Date.now();

    const negotiations = await db.getKV<Record<string, Negotiation>>('negotiations') || {};
    const userStatuses = await db.getKV<Record<string, UserStatusInfo>>('userStatuses') || {};

    switch (type) {
        case 'CHALLENGE_USER': {
            const { opponentId, mode, settings } = payload;
            const opponent = opponentId === aiUserId ? getAiUser(mode, settings?.aiDifficulty) : await db.getUser(opponentId);
        
            if (!opponent) return { error: 'Opponent not found.' };
            if (user.id === opponent.id) return { error: 'You cannot challenge yourself.' };

            // Clean up any previous draft negotiations for this user
            const existingDraftId = Object.keys(negotiations).find(id => negotiations[id].challenger.id === user.id && negotiations[id].status === 'draft');
            if (existingDraftId) {
                delete negotiations[existingDraftId];
            }
            
            const cost = getActionPointCost(mode);

            if (opponentId !== aiUserId) {
                const myStatus = userStatuses[user.id];
                const opponentStatus = userStatuses[opponent.id];

                if (!opponentStatus) return { error: '상대방이 오프라인 상태입니다.' };
                if (myStatus?.status !== UserStatus.Waiting) return { error: '대국 신청은 대기실에서만 가능합니다.' };
                if (![UserStatus.Waiting, UserStatus.Online].includes(opponentStatus?.status)) return { error: '상대방이 대국을 신청받을 수 있는 상태가 아닙니다.' };

                const isOpponentInPendingNegotiation = Object.values(negotiations).some(
                    neg => (neg.opponent.id === opponent.id || neg.challenger.id === opponent.id) && neg.status === 'pending'
                );
                if (isOpponentInPendingNegotiation) return { error: '상대방은 현재 다른 대국 신청을 처리 중입니다.' };

                if (opponent.actionPoints.current < cost && !opponent.isAdmin) return { error: `상대방의 액션 포인트가 부족합니다.` };
            }
            
            if (user.actionPoints.current < cost && !user.isAdmin) return { error: `액션 포인트가 부족합니다. (필요: ${cost})` };
        
            const negotiationId = `neg-${globalThis.crypto.randomUUID()}`;
            const newNegotiation: Negotiation = {
                id: negotiationId, challenger: user, opponent: opponent, mode: mode,
                settings: { ...DEFAULT_GAME_SETTINGS, ...settings }, proposerId: user.id,
                status: 'draft', turnCount: 0, deadline: now + 60000,
            };
        
            negotiations[negotiationId] = newNegotiation;
            await db.setKV('negotiations', negotiations);
            
            const userStatusInfo = userStatuses[user.id];
            userStatusInfo.status = UserStatus.Negotiating;
            userStatusInfo.stateEnteredAt = now;
            await db.updateUserStatus(user.id, userStatusInfo);

            await broadcast({ type: 'NEGOTIATION_UPDATE', payload: { updatedNegotiations: { [negotiationId]: newNegotiation } } });
            await broadcast({ type: 'USER_STATUS_UPDATE', payload: { userId: user.id, statusInfo: userStatusInfo } });

            return { clientResponse: { success: true } };
        }
        case 'SEND_CHALLENGE': {
            const { negotiationId, settings } = payload;
            const negotiation = negotiations[negotiationId];
            if (!negotiation || negotiation.challenger.id !== user.id || negotiation.status !== 'draft') {
                return { error: 'Invalid challenge.' };
            }

            const cost = getActionPointCost(negotiation.mode);
            if (user.actionPoints.current < cost && !user.isAdmin) return { error: `액션 포인트가 부족합니다. (필요: ${cost})` };

            const opponent = negotiation.opponent;
            const isOpponentAlreadyInNegotiation = Object.values(negotiations).some(
                neg => neg.id !== negotiationId && (neg.challenger.id === opponent.id || neg.opponent.id === opponent.id) && neg.status === 'pending'
            );

            if (isOpponentAlreadyInNegotiation) {
                delete negotiations[negotiationId];
                await db.setKV('negotiations', negotiations);
                const challengerStatus = userStatuses[user.id];
                if (challengerStatus && challengerStatus.status === UserStatus.Negotiating) {
                    challengerStatus.status = UserStatus.Waiting;
                    challengerStatus.stateEnteredAt = now;
                    await db.updateUserStatus(user.id, challengerStatus);
                    await broadcast({ type: 'USER_STATUS_UPDATE', payload: { userId: user.id, statusInfo: challengerStatus } });
                }
                await broadcast({ type: 'NEGOTIATION_REMOVE', payload: { removedNegotiationId: negotiationId } });
                return { error: '상대방이 다른 대국 신청을 먼저 받았습니다. 잠시 후 다시 시도해주세요.' };
            }

            negotiation.settings = settings;
            negotiation.status = 'pending';
            negotiation.proposerId = negotiation.opponent.id;
            negotiation.turnCount = 1;
            negotiation.deadline = now + 60000;
            await db.setKV('negotiations', negotiations);
            
            await broadcast({ type: 'NEGOTIATION_UPDATE', payload: { updatedNegotiations: { [negotiationId]: negotiation } } });

            return { clientResponse: { success: true } };
        }
        case 'UPDATE_NEGOTIATION': {
            const { negotiationId, settings } = payload;
            const negotiation = negotiations[negotiationId];
            if (!negotiation || negotiation.proposerId !== user.id || negotiation.status !== 'pending') {
                return { error: 'Cannot update this negotiation now.' };
            }

            negotiation.settings = settings;
            negotiation.proposerId = negotiation.challenger.id === user.id ? negotiation.opponent.id : negotiation.challenger.id;
            negotiation.turnCount = (negotiation.turnCount || 0) + 1;
            negotiation.deadline = now + 60000;
            await db.setKV('negotiations', negotiations);

            if (negotiation.turnCount >= 10) {
                delete negotiations[negotiationId];
                await db.setKV('negotiations', negotiations);
                await broadcast({ type: 'NEGOTIATION_REMOVE', payload: { removedNegotiationId: negotiationId } });
            }
            
            await broadcast({ type: 'NEGOTIATION_UPDATE', payload: { updatedNegotiations: { [negotiationId]: negotiation } } });
            return { clientResponse: { success: true } };
        }
        case 'ACCEPT_NEGOTIATION': {
            const { negotiationId, settings } = payload;
            const negotiation = negotiations[negotiationId];
            if (!negotiation || negotiation.proposerId !== user.id || negotiation.status !== 'pending') {
                return { error: '만료되었거나 취소된 대국 신청입니다.' };
            }
        
            const challenger = await db.getUser(negotiation.challenger.id);
            const opponent = await db.getUser(negotiation.opponent.id);
            if (!challenger || !opponent) {
                delete negotiations[negotiationId];
                await db.setKV('negotiations', negotiations);
                await broadcast({ type: 'NEGOTIATION_REMOVE', payload: { removedNegotiationId: negotiationId } });
                return { error: "대국 상대를 찾을 수 없습니다." };
            }
        
            const challengerStatus = userStatuses[challenger.id];
            if (!challengerStatus || challengerStatus.status !== UserStatus.Negotiating) {
                delete negotiations[negotiationId];
                await db.setKV('negotiations', negotiations);
                const myStatus = userStatuses[user.id];
                if (myStatus) {
                    myStatus.status = UserStatus.Waiting;
                    myStatus.stateEnteredAt = now;
                    await db.updateUserStatus(user.id, myStatus);
                    await broadcast({ type: 'USER_STATUS_UPDATE', payload: { userId: user.id, statusInfo: myStatus } });
                }
                await broadcast({ type: 'NEGOTIATION_REMOVE', payload: { removedNegotiationId: negotiationId } });
                return { error: '대국 신청자가 자리를 비워 신청이 취소되었습니다.' };
            }

            const cost = getActionPointCost(negotiation.mode);
            if (opponent.actionPoints.current < cost && !opponent.isAdmin) return { error: `액션 포인트가 부족합니다. (필요: ${cost})` };
            if (challenger.actionPoints.current < cost && !challenger.isAdmin) {
                 delete negotiations[negotiationId];
                await db.setKV('negotiations', negotiations);
                if (userStatuses[challenger.id]) {
                    userStatuses[challenger.id].status = UserStatus.Waiting;
                    userStatuses[challenger.id].stateEnteredAt = now;
                    await db.updateUserStatus(challenger.id, userStatuses[challenger.id]);
                    await broadcast({ type: 'USER_STATUS_UPDATE', payload: { userId: challenger.id, statusInfo: userStatuses[challenger.id] } });
                }
                if (userStatuses[user.id]) {
                    userStatuses[user.id].status = UserStatus.Waiting;
                    userStatuses[user.id].stateEnteredAt = now;
                    await db.updateUserStatus(user.id, userStatuses[user.id]);
                    await broadcast({ type: 'USER_STATUS_UPDATE', payload: { userId: user.id, statusInfo: userStatuses[user.id] } });
                }
                await broadcast({ type: 'NEGOTIATION_REMOVE', payload: { removedNegotiationId: negotiationId } });
                return { error: '상대방의 액션 포인트가 부족하여 대국이 취소되었습니다.' };
            }
        
            // Deduct action points and update users
            // ... (rest of the logic is complex and stateful, needs careful check)

            negotiation.settings = settings;
            const game = await initializeGame(negotiation, guilds);
            await db.saveGame(game);
            
            const statusInGame = { status: UserStatus.InGame, mode: game.mode, gameId: game.id, stateEnteredAt: now };
            await db.updateUserStatus(game.player1.id, statusInGame);
            await db.updateUserStatus(game.player2.id, statusInGame);
            
            // Cleanup all other negotiations involving these players
            const playerIdsInGame = new Set([game.player1.id, game.player2.id]);
            const negotiationsToRemove: string[] = [];
            for (const neg of Object.values(negotiations)) {
                if (playerIdsInGame.has(neg.challenger.id) || playerIdsInGame.has(neg.opponent.id)) {
                    negotiationsToRemove.push(neg.id);
                }
            }
            negotiationsToRemove.forEach(id => delete negotiations[id]);
            await db.setKV('negotiations', negotiations);

            // Broadcast updates
            await broadcast({ type: 'GAME_START', payload: { game } });
            await broadcast({ type: 'USER_STATUS_UPDATE', payload: { userId: game.player1.id, statusInfo: statusInGame } });
            await broadcast({ type: 'USER_STATUS_UPDATE', payload: { userId: game.player2.id, statusInfo: statusInGame } });
            negotiationsToRemove.forEach(id => {
                broadcast({ type: 'NEGOTIATION_REMOVE', payload: { removedNegotiationId: id } });
            });

            return { clientResponse: { success: true } };
        }
        case 'DECLINE_NEGOTIATION': {
            const { negotiationId } = payload;
            const negotiation = negotiations[negotiationId];
            if (!negotiation || (negotiation.challenger.id !== user.id && negotiation.opponent.id !== user.id)) {
                 return {}; // Not part of this negotiation, just ignore
            }
        
            const { challenger, opponent, rematchOfGameId, mode } = negotiation;
            
            if (rematchOfGameId) {
                const originalGame = await db.getLiveGame(rematchOfGameId);
                if (originalGame?.gameStatus === GameStatus.RematchPending) {
                    originalGame.gameStatus = GameStatus.Ended;
                    await db.saveGame(originalGame);
                    // Broadcast game update if needed
                }
            }

            const statusUpdateIds = [challenger.id, opponent.id];
            for (const id of statusUpdateIds) {
                const status = userStatuses[id];
                 if (status?.status === UserStatus.Negotiating) {
                    status.status = UserStatus.Waiting;
                    status.mode = mode;
                    delete status.gameId;
                    status.stateEnteredAt = now;
                    await db.updateUserStatus(id, status);
                    await broadcast({ type: 'USER_STATUS_UPDATE', payload: { userId: id, statusInfo: status } });
                }
            }

            delete negotiations[negotiationId];
            await db.setKV('negotiations', negotiations);
            await broadcast({ type: 'NEGOTIATION_REMOVE', payload: { removedNegotiationId: negotiationId } });

            return { clientResponse: { success: true } };
        }
        case 'REQUEST_REMATCH': {
            const { opponentId, originalGameId } = payload;
            const opponent = await db.getUser(opponentId);
            if (!opponent) return { error: 'Opponent not found.' };
        
            const originalGame = await db.getLiveGame(originalGameId);
            if (!originalGame || ![GameStatus.Ended, GameStatus.NoContest, GameStatus.RematchPending].includes(originalGame.gameStatus)) {
                return { error: 'Cannot request a rematch for this game.' };
            }
        
            if (Object.values(negotiations).some(n => n.rematchOfGameId === originalGameId)) {
                return { error: 'A rematch has already been requested.' };
            }

            originalGame.gameStatus = GameStatus.RematchPending;
            await db.saveGame(originalGame);
            // Broadcast game update to show rematch pending status
            await broadcast({ type: 'GAME_STATE_UPDATE', payload: { updatedGame: originalGame } });
        
            const negotiationId = `neg-${globalThis.crypto.randomUUID()}`;
            const newNegotiation: Negotiation = {
                id: negotiationId, challenger: user, opponent: opponent, mode: originalGame.mode,
                settings: originalGame.settings, proposerId: user.id, status: 'draft',
                turnCount: 0, deadline: now + 60000, rematchOfGameId: originalGameId,
            };
        
            negotiations[negotiationId] = newNegotiation;
            await db.setKV('negotiations', negotiations);
        
            const statusNegotiating = { status: UserStatus.Negotiating, gameId: originalGameId, stateEnteredAt: now };
            await db.updateUserStatus(user.id, statusNegotiating);
            await db.updateUserStatus(opponent.id, statusNegotiating);

            await broadcast({ type: 'NEGOTIATION_UPDATE', payload: { updatedNegotiations: { [negotiationId]: newNegotiation } } });
            await broadcast({ type: 'USER_STATUS_UPDATE', payload: { userId: user.id, statusInfo: statusNegotiating } });
            await broadcast({ type: 'USER_STATUS_UPDATE', payload: { userId: opponent.id, statusInfo: statusNegotiating } });
        
            return { clientResponse: { success: true } };
        }
        default:
            // The START_AI_GAME was moved to a separate file/handler.
            return { error: 'Unknown negotiation action.' };
    }
};