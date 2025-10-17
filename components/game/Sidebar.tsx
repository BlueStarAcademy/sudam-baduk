import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Player, ChatMessage, GameProps, GameMode, User, UserWithStatus, LiveGameSession, ServerAction } from '../../types/index.js';
import {
    GAME_CHAT_EMOJIS,
    GAME_CHAT_MESSAGES,
    PLAYFUL_GAME_MODES,
    DEFAULT_KOMI,
    AVATAR_POOL,
    BORDER_POOL,
    ALKKAGI_GAUGE_SPEEDS,
    CURLING_GAUGE_SPEEDS,
    SPECIAL_GAME_MODES
} from '../../constants/index.js';
import Button from '../Button.js';
import Avatar from '../Avatar.js';
import { containsProfanity } from '../../profanity.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import CurrencyPanel from './CurrencyPanel.js';

interface SidebarProps extends GameProps {
    onLeaveOrResign?: () => void;
    isNoContestLeaveAvailable: boolean;
    onClose?: () => void;
    onOpenSettings: () => void;
    isPausable?: boolean;
    isPaused?: boolean;
    onPauseToggle?: () => void;
}

const GameInfoPanel: React.FC<{ session: LiveGameSession, onClose?: () => void }> = ({ session, onClose }) => {
    const { mode, settings, effectiveCaptureTargets } = session;

    const renderSetting = (label: string, value: React.ReactNode) => (
        value !== undefined && value !== null && value !== '' && (
            <React.Fragment key={label}>
                <div className="font-semibold text-gray-400">{label}:</div>
                <div className="whitespace-nowrap">{value}</div>
            </React.Fragment>
        )
    );

    const gameDetails = useMemo(() => {
        const details = [];
        const modesWithKomi = [
            GameMode.Standard,
            GameMode.Speed,
            GameMode.Base,
            GameMode.Hidden,
            GameMode.Missile,
            GameMode.Mix,
        ];
        const modesWithoutTime = [GameMode.Alkkagi, GameMode.Curling, GameMode.Dice, GameMode.Thief];

        details.push(renderSetting("게임 모드", mode));
        if (![GameMode.Alkkagi, GameMode.Curling, GameMode.Dice].includes(mode)) {
            details.push(renderSetting("판 크기", `${settings.boardSize}x${settings.boardSize}`));
        }
        
        if (modesWithKomi.includes(mode) && !settings.mixedModes?.includes(GameMode.Base)) {
            details.push(renderSetting("덤", `${session.finalKomi ?? session.settings.komi ?? DEFAULT_KOMI}집`));
        }
       
        if (!modesWithoutTime.includes(mode)) {
            if (settings.timeLimit > 0) {
                details.push(renderSetting("제한시간", `${settings.timeLimit}분`));
                details.push(renderSetting("초읽기", mode === GameMode.Speed ? `${settings.timeIncrement}초 피셔` : `${settings.byoyomiTime}초 ${settings.byoyomiCount}회`));
            } else {
                 details.push(renderSetting("제한시간", "없음"));
            }
        }
        
        if (mode === GameMode.Mix) {
            details.push(renderSetting("조합 규칙", settings.mixedModes?.join(', ')));
        }

        if (mode === GameMode.Omok || mode === GameMode.Ttamok) {
            details.push(renderSetting("쌍삼 금지", settings.has33Forbidden ? '금지' : '가능'));
            details.push(renderSetting("장목 금지", settings.hasOverlineForbidden ? '금지' : '가능'));
        }

        if (mode === GameMode.Ttamok) {
            details.push(renderSetting("따내기 목표", `${settings.captureTarget}개`));
        }
        
        if (mode === GameMode.Capture || (mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Capture))) {
            const captureTargetText = effectiveCaptureTargets
                ? `흑: ${effectiveCaptureTargets[Player.Black]} / 백: ${effectiveCaptureTargets[Player.White]}`
                : `${settings.captureTarget}개 (흑/백 결정 중)`;
             details.push(renderSetting("따내기 목표", captureTargetText));
        }
        
        if (mode === GameMode.Base || (mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Base))) {
             details.push(renderSetting("베이스돌", `${settings.baseStones}개`));
        }
        
        if (mode === GameMode.Hidden || (mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Hidden))) {
             details.push(renderSetting("히든돌", `${settings.hiddenStoneCount}개`));
             details.push(renderSetting("스캔", `${settings.scanCount}개`));
        }
        
        if (mode === GameMode.Missile || (mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Missile))) {
             details.push(renderSetting("미사일", `${settings.missileCount}개`));
        }
        
        if (mode === GameMode.Dice) {
            details.push(renderSetting("라운드", `${settings.diceGoRounds}R`));
            details.push(renderSetting("홀수 아이템", `${settings.oddDiceCount}개`));
            details.push(renderSetting("짝수 아이템", `${settings.evenDiceCount}개`));
        }
        
        if (mode === GameMode.Alkkagi) {
            const speedLabel = ALKKAGI_GAUGE_SPEEDS.find(s => s.value === settings.alkkagiGaugeSpeed)?.label || '보통';
            details.push(renderSetting("라운드", `${settings.alkkagiRounds}R`));
            details.push(renderSetting("돌 개수", `${settings.alkkagiStoneCount}개`));
            details.push(renderSetting("배치 방식", settings.alkkagiPlacementType));
            details.push(renderSetting("배치 전장", settings.alkkagiLayout));
            details.push(renderSetting("게이지 속도", speedLabel));
            details.push(renderSetting("슬로우 아이템", `${settings.alkkagiSlowItemCount}개`));
            details.push(renderSetting("조준선 아이템", `${settings.alkkagiAimingLineItemCount}개`));
        }
        
        if (mode === GameMode.Curling) {
            const speedLabel = CURLING_GAUGE_SPEEDS.find(s => s.value === settings.curlingGaugeSpeed)?.label || '보통';
            details.push(renderSetting("스톤 개수", `${settings.curlingStoneCount}개`));
            details.push(renderSetting("게이지 속도", speedLabel));
            details.push(renderSetting("슬로우 아이템", `${settings.curlingSlowItemCount}개`));
            details.push(renderSetting("조준선 아이템", `${settings.curlingAimingLineItemCount}개`));
        }

        return details.filter(Boolean);
    }, [session]);


    return (
        <div className="bg-gray-800 p-2 rounded-md flex-shrink-0 border border-color">
            <h3 className="text-base font-bold border-b border-gray-700 pb-1 mb-2 text-yellow-300 flex justify-between items-center">
                대국 정보
                {onClose && <button onClick={onClose} className="text-xl font-bold text-gray-400 hover:text-white">×</button>}
            </h3>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                {gameDetails}
            </div>
        </div>
    );
};

const UserItem: React.FC<{
    user: UserWithStatus;
    role: '흑' | '백' | '관전';
    isGameEnded: boolean;
    isAiGame: boolean;
    rematchRequested: boolean;
    handleRematch: (opponentId: string) => void;
    onViewUser: (userId: string) => void;
    currentUser: User;
    player1: User;
    player2: User;
}> = ({ user, role, isGameEnded, isAiGame, rematchRequested, handleRematch, onViewUser, currentUser, player1, player2 }) => {
    const isMe = user.id === currentUser.id;
    const isOpponent = !isMe && (user.id === player1.id || user.id === player2.id);

    const avatarUrl = AVATAR_POOL.find(a => a.id === user.avatarId)?.url;
    const borderUrl = BORDER_POOL.find(b => b.id === user.borderId)?.url;

    return (
        <div className={`flex items-center gap-2 p-1 rounded ${isMe ? 'bg-blue-900/50' : ''}`}>
            <div 
                className={`flex items-center gap-2 flex-grow overflow-hidden ${!isMe ? 'cursor-pointer' : ''}`}
                onClick={() => !isMe && onViewUser(user.id)}
                title={!isMe ? `${user.nickname} 프로필 보기` : ''}
            >
                <div className="relative flex-shrink-0">
                        <Avatar userId={user.id} userName={user.nickname} size={28} avatarUrl={avatarUrl} borderUrl={borderUrl} />
                </div>
                <div className="flex items-center gap-2 overflow-hidden">
                    <span className="font-semibold truncate text-sm">{user.nickname}</span>
                    {isGameEnded && isOpponent && !isAiGame && (
                            <Button
                            onClick={(e) => { e?.stopPropagation(); handleRematch(user.id); }}
                            disabled={rematchRequested}
                            colorScheme="yellow"
                            className="!text-xs !py-0.5 !px-2 flex-shrink-0"
                            >
                            {rematchRequested ? '신청중' : '재대결'}
                            </Button>
                    )}
                </div>
            </div>
            <span className="ml-auto text-xs text-gray-400 flex-shrink-0">{role}</span>
        </div>
        )
}

const UserListPanel: React.FC<SidebarProps & { onClose?: () => void }> = ({ session, onlineUsers, currentUser, onClose, onAction, onViewUser }) => {
    
    const { player1, player2, blackPlayerId, whitePlayerId, gameStatus, isAiGame } = session;

    const playersInRoom = useMemo(() => {
        return onlineUsers
            .filter(u => u.status === 'in-game' && u.gameId === session.id)
            .sort((a, b) => {
                if (a.id === blackPlayerId) return -1;
                if (b.id === blackPlayerId) return 1;
                return 0;
            });
    }, [onlineUsers, session.id, blackPlayerId]);

    const spectators = useMemo(() => {
        return onlineUsers.filter(u => u.status === 'spectating' && u.spectatingGameId === session.id);
    }, [onlineUsers, session.id]);

    const isGameEnded = ['ended', 'no_contest', 'rematch_pending'].includes(gameStatus);
    const rematchRequested = gameStatus === 'rematch_pending';

    const handleRematch = (opponentId: string) => {
        onAction({ type: 'REQUEST_REMATCH', payload: { opponentId, originalGameId: session.id } });
    };

    return (
        <div className="bg-gray-800 p-2 rounded-md flex flex-col border border-color">
            <h3 className="text-base font-bold border-b border-gray-700 pb-1 mb-2 text-yellow-300 flex-shrink-0 flex justify-between items-center">
                유저 목록
                {onClose && <button onClick={onClose} className="text-xl font-bold text-gray-400 hover:text-white">×</button>}
            </h3>
            <div className="space-y-0.5 overflow-y-auto pr-1 flex-grow">
                {playersInRoom.map(user => (
                    <UserItem
                        key={user.id}
                        user={user}
                        role={user.id === blackPlayerId ? '흑' : '백'}
                        isGameEnded={isGameEnded}
                        isAiGame={isAiGame}
                        rematchRequested={rematchRequested}
                        handleRematch={handleRematch}
                        onViewUser={onViewUser}
                        currentUser={currentUser}
                        player1={player1}
                        player2={player2}
                    />
                ))}
                {spectators.map(user => (
                    <UserItem
                        key={user.id}
                        user={user}
                        role={'관전'}
                        isGameEnded={isGameEnded}
                        isAiGame={isAiGame}
                        rematchRequested={rematchRequested}
                        handleRematch={handleRematch}
                        onViewUser={onViewUser}
                        currentUser={currentUser}
                        player1={player1}
                        player2={player2}
                    />
                ))}
            </div>
        </div>
    );
};


const ChatPanel: React.FC<Omit<SidebarProps, 'onLeaveOrResign' | 'isNoContestLeaveAvailable'>> = (props) => {
    const { session, isSpectator, onAction, waitingRoomChat, gameChat, onClose, onViewUser } = props;
    const { mode } = session;
    const { currentUserWithStatus, handlers, onlineUsers } = useAppContext();
    const isAiGame = session.isAiGame;

    const [activeTab, setActiveTab] = useState<'game' | 'global'>(isAiGame ? 'global' : 'game');
    const [chatInput, setChatInput] = useState('');
    const [showQuickChat, setShowQuickChat] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const quickChatRef = useRef<HTMLDivElement>(null);
    const chatBodyRef = useRef<HTMLDivElement>(null);

    const activeChatMessages = activeTab === 'game' ? gameChat : waitingRoomChat;
    
    useEffect(() => { if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight; }, [activeChatMessages]);

    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => {
                setCooldown(prev => Math.max(0, prev - 1));
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (quickChatRef.current && !quickChatRef.current.contains(event.target as Node)) setShowQuickChat(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === mode);
    const lobbyType = isStrategic ? '전략' : '놀이';
    const locationPrefix = `[${lobbyType}:${mode}]`;

    const handleSend = (message: { text?: string, emoji?: string }) => {
        if(isSpectator || cooldown > 0) return;
        
        const channel = activeTab === 'game' ? session.id : 'global';
        const payload: any = { channel, ...message };

        if (channel === 'global') {
            payload.location = locationPrefix;
        }

        onAction({ type: 'SEND_CHAT_MESSAGE', payload });
        setShowQuickChat(false); setChatInput('');
        setCooldown(5);
    };

    const handleSendTextSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (chatInput.trim()) {
            if (containsProfanity(chatInput)) {
                alert("부적절한 단어가 포함되어 있어 메시지를 전송할 수 없습니다.");
                setChatInput('');
                return;
            }
            handleSend({ text: chatInput });
        }
    };
    
    if (!currentUserWithStatus) return null;

    const handleUserClick = (userId: string) => {
        if (currentUserWithStatus.isAdmin && userId !== currentUserWithStatus.id) {
            const userToModerate = onlineUsers.find(u => u.id === userId);
            if (userToModerate) {
                handlers.openModerationModal(userToModerate.id);
            }
        } else if (userId !== currentUserWithStatus.id) {
            const userToView = onlineUsers.find(u => u.id === userId);
            if (userToView) {
                onViewUser(userToView.id);
            }
        }
    };

    const isBanned = (currentUserWithStatus.chatBanUntil ?? 0) > Date.now();
    const banTimeLeft = isBanned ? Math.ceil((currentUserWithStatus.chatBanUntil! - Date.now()) / 1000 / 60) : 0;
    const isInputDisabled = isBanned || cooldown > 0;
    const placeholderText = isBanned 
        ? `채팅 금지 중 (${banTimeLeft}분 남음)` 
        : isInputDisabled
            ? `(${cooldown}초)`
            : "[메시지 입력]";
    
    return (
        <div className="flex flex-col h-full bg-gray-800 p-2 rounded-md border border-color">
            {isAiGame ? (
                <h3 className="text-base font-bold border-b border-gray-700 pb-1 mb-2 text-yellow-300 flex-shrink-0">전체채팅</h3>
            ) : (
                <div className="flex bg-gray-900/70 p-1 rounded-lg mb-2 flex-shrink-0">
                    <button onClick={() => setActiveTab('game')} className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-all ${activeTab === 'game' ? 'bg-blue-600' : 'text-gray-400 hover:bg-gray-700/50'}`}>대국실</button>
                    <button onClick={() => setActiveTab('global')} className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-all ${activeTab === 'global' ? 'bg-blue-600' : 'text-gray-400 hover:bg-gray-700/50'}`}>전체채팅</button>
                </div>
            )}
            <div ref={chatBodyRef} className="flex-grow space-y-0.5 overflow-y-auto pr-2 mb-2 bg-gray-900/40 p-1.5 rounded-md min-h-0">
                {activeChatMessages.map(msg => {
                    const isBotMessage = msg.system && !msg.actionInfo && msg.user.nickname === 'AI 보안관봇';
                    return (
                        <div key={msg.id || msg.timestamp} className="text-sm">
                            {msg.location && <span className="font-semibold text-gray-500 pr-1">{msg.location}</span>}
                            <span 
                                className={`font-semibold pr-2 ${msg.system ? 'text-yellow-400' : 'text-gray-400 cursor-pointer hover:underline'}`}
                                onClick={() => !msg.system && handleUserClick(msg.user.id)}
                                title={!msg.system ? `${msg.user.nickname} 프로필 보기 / 제재` : ''}
                            >
                                {msg.system ? (isBotMessage ? 'AI 보안관봇' : '시스템') : msg.user.nickname}:
                            </span>
                            {msg.text && <span className={isBotMessage ? 'text-yellow-400' : ''}>{msg.text}{isBotMessage && ' 🚓'}</span>}
                            {msg.emoji && <span className="text-xl">{msg.emoji}</span>}
                        </div>
                    );
                })}
                {activeChatMessages.length === 0 && <div className="h-full flex items-center justify-center text-gray-500 text-sm">채팅 메시지가 없습니다.</div>}
            </div>
            {!isSpectator && (
                <div className="relative flex-shrink-0">
                   {showQuickChat && (
                       <div ref={quickChatRef} className="absolute bottom-full mb-2 w-full bg-gray-600 rounded-lg shadow-xl p-1 z-10 max-h-64 overflow-y-auto">
                           <div className="grid grid-cols-5 gap-1 text-2xl mb-1 border-b border-gray-500 pb-1">
                              {GAME_CHAT_EMOJIS.map(emoji => ( <button key={emoji} onClick={() => handleSend({ emoji })} className="w-full p-1 rounded-md hover:bg-blue-600 transition-colors text-center"> {emoji} </button> ))}
                           </div>
                           <ul className="space-y-0.5">
                              {GAME_CHAT_MESSAGES.map(msg => ( <li key={msg}> <button onClick={() => handleSend({ text: msg })} className="w-full text-left text-xs p-1 rounded-md hover:bg-blue-600 transition-colors"> {msg} </button> </li> ))}
                           </ul>
                       </div>
                   )}
                   <form onSubmit={handleSendTextSubmit} className="flex gap-1">
                        <button type="button" onClick={() => setShowQuickChat(s => !s)} className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-2.5 rounded-md transition-colors text-lg flex items-center justify-center" title="빠른 채팅" disabled={isInputDisabled}>
                            <span>🙂</span>
                        </button>
                       <input
                           type="text"
                           value={chatInput}
                           onChange={e => setChatInput(e.target.value)}
                           placeholder={placeholderText}
                           className="flex-grow bg-gray-900 border border-gray-600 rounded-md p-1.5 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-800 disabled:text-gray-500"
                           maxLength={30}
                           disabled={isInputDisabled}
                       />
                       <Button type="submit" disabled={!chatInput.trim() || isInputDisabled} className="!px-2.5 !py-1.5" title="보내기">
                            💬
                       </Button>
                   </form>
                </div>
            )}
        </div>
    );
};

const Sidebar: React.FC<SidebarProps> = (props) => {
    const { session, onLeaveOrResign, isNoContestLeaveAvailable, isSpectator, onOpenSettings, isPausable, isPaused, onPauseToggle } = props;
    const { gameStatus } = session;

    const isGameEnded = ['ended', 'no_contest', 'rematch_pending'].includes(gameStatus);
    const leaveButtonText = isNoContestLeaveAvailable ? '무효처리' : (isGameEnded ? '나가기' : (isSpectator ? '관전종료' : '기권하기'));
    const leaveButtonColor = isNoContestLeaveAvailable ? 'yellow' : 'red';
    
    return (
        <div className="flex flex-col h-full gap-1.5 bg-gray-900/80 rounded-lg p-2 border border-color">
            <div className="flex-shrink-0 space-y-2">
                <GameInfoPanel session={session} onClose={props.onClose} />
                <UserListPanel {...props} />
            </div>
            <div className="flex-1 mt-2 min-h-0">
                <ChatPanel {...props} />
            </div>
            <div className="flex-shrink-0 pt-2">
                {isGameEnded && onLeaveOrResign ? (
                    <Button onClick={onLeaveOrResign} colorScheme="gray" className="w-full">
                        나가기
                    </Button>
                ) : isPausable ? (
                    <Button onClick={onPauseToggle} colorScheme="yellow" className="w-full">
                        {isPaused ? '대국 재개' : '일시정지'}
                    </Button>
                ) : (
                    onLeaveOrResign && (
                        <Button onClick={onLeaveOrResign} colorScheme={leaveButtonColor} className="w-full">
                            {leaveButtonText}
                        </Button>
                    )
                )}
            </div>
        </div>
    );
};

export default Sidebar;