import React, { useMemo } from 'react';
import { UserWithStatus, ServerAction, UserStatus, GameMode, Negotiation } from '../../types.js';
import Avatar from '../Avatar.js';
import { AVATAR_POOL, BORDER_POOL } from '../../constants.js';
import Button from '../Button.js';

const statusDisplay: Record<UserStatus, { text: string; color: string; }> = {
  'online': { text: '온라인', color: 'text-green-500' },
  'waiting': { text: '대기 중', color: 'text-green-400' },
  'resting': { text: '휴식 중', color: 'text-gray-400' },
  'negotiating': { text: '협상 중', color: 'text-yellow-400' },
  'in-game': { text: '대국 중', color: 'text-blue-400' },
  'spectating': { text: '관전 중', color: 'text-purple-400' },
};

interface PlayerListProps {
    users: UserWithStatus[];
    onAction: (a: ServerAction) => void;
    currentUser: UserWithStatus;
    mode: GameMode;
    negotiations: Negotiation[];
    onViewUser: (userId: string) => void;
}

const PlayerList: React.FC<PlayerListProps> = ({ users, onAction, currentUser, mode, negotiations, onViewUser }) => {
    const me = users.find(user => user.id === currentUser.id);
    const otherUsers = users.filter(user => user.id !== currentUser.id).sort((a,b) => a.nickname.localeCompare(b.nickname));

    const canChallenge = (targetUser: UserWithStatus) => {
        // The current user must be in the waiting room to use this UI
        if (currentUser.status !== 'waiting') {
            return false;
        }
        // The target user can be either in the waiting room or online (in profile)
        return targetUser.status === 'waiting' || targetUser.status === 'online';
    };

    const renderUserItem = (user: UserWithStatus, isCurrentUser: boolean) => {
        const isChallengeable = !isCurrentUser && canChallenge(user);
        const statusInfo = statusDisplay[user.status];
        const isDiceGo = mode === GameMode.Dice;

        const sentNegotiation = !isCurrentUser ? negotiations.find(n => 
            n.challenger.id === currentUser.id && 
            n.opponent.id === user.id && 
            (n.status === 'pending' || n.status === 'draft')
        ) : null;
        
        const avatarUrl = AVATAR_POOL.find(a => a.id === user.avatarId)?.url;
        const borderUrl = BORDER_POOL.find(b => b.id === user.borderId)?.url;

        return (
            <li key={user.id} className={`flex items-center justify-between p-1.5 rounded-lg ${isCurrentUser ? 'bg-blue-900/40 border border-blue-700' : 'bg-tertiary/50'}`}>
                <div 
                    className={`flex items-center gap-2 lg:gap-3 overflow-hidden ${!isCurrentUser ? 'cursor-pointer' : ''}`}
                    onClick={() => !isCurrentUser && onViewUser(user.id)}
                    title={!isCurrentUser ? `${user.nickname} 프로필 보기` : ''}
                >
                    <Avatar userId={user.id} userName={user.nickname} size={36} className="border-2 border-color" avatarUrl={avatarUrl} borderUrl={borderUrl} />
                    {isDiceGo && <div className="w-5 h-5 rounded-full bg-black border border-gray-300 flex-shrink-0" />}
                    <div className="overflow-hidden">
                        <h3 className="font-bold text-sm lg:text-base truncate">{user.nickname}</h3>
                        <span className={`text-xs ${statusInfo.color}`}>● {statusInfo.text}</span>
                    </div>
                </div>
                {isCurrentUser ? (
                    <select
                        value={currentUser.status}
                        onChange={(e) => onAction({ type: 'SET_USER_STATUS', payload: { status: e.target.value } })}
                        disabled={!['waiting', 'resting'].includes(currentUser.status)}
                        className="px-2 py-1 lg:px-3 lg:py-1.5 bg-secondary border border-color rounded-lg text-xs lg:text-sm transition-colors w-20 lg:w-24 text-center focus:ring-accent focus:border-accent disabled:opacity-50"
                    >
                        <option value="waiting">대기 중</option>
                        <option value="resting">휴식 중</option>
                        {!['waiting', 'resting'].includes(currentUser.status) && (
                            <option value={currentUser.status} disabled>{statusDisplay[currentUser.status].text}</option>
                        )}
                    </select>
                ) : (
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {currentUser.isAdmin && !user.isAdmin && (
                            <Button
                                onClick={() => {
                                    if (window.confirm(`[${user.nickname}]님을 강제로 접속 종료하시겠습니까?`)) {
                                        onAction({ type: 'ADMIN_FORCE_LOGOUT', payload: { targetUserId: user.id } });
                                    }
                                }}
                                colorScheme="red"
                                className="!text-xs !py-1 !px-2"
                            >
                                강제 퇴장
                            </Button>
                        )}
                        {sentNegotiation ? (
                             <Button
                                onClick={() => onAction({ type: 'DECLINE_NEGOTIATION', payload: { negotiationId: sentNegotiation.id } })}
                                colorScheme="red"
                                className="!text-xs !py-1 !px-2"
                            >
                                신청 취소
                            </Button>
                        ) : (
                            <Button
                                onClick={() => onAction({ type: 'CHALLENGE_USER', payload: { opponentId: user.id, mode } })}
                                disabled={!isChallengeable}
                                className="!text-xs !py-1 !px-2"
                            >
                                대국 신청
                            </Button>
                        )}
                    </div>
                )}
            </li>
        );
    };

    return (
        <div className="p-3 flex flex-col min-h-0 text-on-panel h-full">
             <h2 className="text-xl font-semibold mb-2 border-b border-color pb-2 flex-shrink-0">유저 목록</h2>
            {me && (
              <div className="flex-shrink-0 mb-2">
                  {renderUserItem(me, true)}
              </div>
            )}
            <ul className="space-y-2 overflow-y-auto pr-2 flex-1 min-h-0">
                {otherUsers.length > 0 ? otherUsers.map(user => renderUserItem(user, false)) : (
                    <p className="text-center text-tertiary pt-8">다른 플레이어가 없습니다.</p>
                )}
            </ul>
        </div>
    );
};

export default PlayerList;