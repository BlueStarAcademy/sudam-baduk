import React, { useState, useRef, useEffect, useMemo } from 'react';
// FIX: Add missing imports for types
import { Guild as GuildType, ChatMessage, GuildMemberRole, GuildMember, GuildBossInfo, GuildResearchId, CoreStat } from '../../types/index.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import Button from '../Button.js';
import GuildMembersPanel from './GuildMembersPanel.js';
import GuildManagementPanel from './GuildManagementPanel.js';
// FIX: Add missing imports for constants
import { GUILD_XP_PER_LEVEL, GUILD_BOSSES, GUILD_RESEARCH_PROJECTS, GUILD_CHECK_IN_MILESTONE_REWARDS, GUILD_DONATION_GOLD_LIMIT, GUILD_DONATION_DIAMOND_LIMIT, GUILD_DONATION_DIAMOND_COST, GUILD_DONATION_GOLD_REWARDS, GUILD_DONATION_DIAMOND_REWARDS, AVATAR_POOL, BORDER_POOL } from '../../constants/index.js';
import DraggableWindow from '../DraggableWindow.js';
import GuildResearchPanel from './GuildResearchPanel.js';
import GuildMissionsPanel from './GuildMissionsPanel.js';
import GuildShopModal from './GuildShopModal.js';
import { BOSS_SKILL_ICON_MAP } from '../../assets.js';
import HelpModal from '../HelpModal.js';
// FIX: Add missing imports for utilities and components
import { getTimeUntilNextMondayKST, isSameDayKST, formatDateTimeKST } from '../../utils/timeUtils.js';
import Avatar from '../Avatar.js';
import { GUILD_ATTACK_ICON, GUILD_RESEARCH_HEAL_BLOCK_IMG, GUILD_RESEARCH_IGNITE_IMG, GUILD_RESEARCH_REGEN_IMG } from '../../assets.js';


interface GuildHomePanelProps {
    guild: GuildType;
    myMemberInfo: GuildMember | undefined;
    onOpenMissions: () => void;
    onOpenResearch: () => void;
    onOpenShop: () => void;
    missionNotification: boolean;
    guildDonationAnimation: { coins: number; research: number } | null;
}

const GuildBossGuideModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [selectedBoss, setSelectedBoss] = useState<GuildBossInfo>(GUILD_BOSSES[0]);

    return (
        <DraggableWindow title="길드 보스 도감" onClose={onClose} windowId="guild-boss-guide" initialWidth={900}>
            <div className="flex flex-col h-[75vh]">
                <div className="bg-tertiary/50 p-3 rounded-lg mb-4">
                    <h3 className="font-bold text-lg text-yellow-300">길드 보스전이란?</h3>
                    <p className="text-sm text-tertiary mt-1">
                        길드원들과 협력하여 강력한 보스를 공략하는 레이드 콘텐츠입니다. 보스에게 입힌 누적 피해량에 따라 개인 보상을 획득할 수 있으며, 보스를 처치하면 모든 길드원이 보상을 받습니다.
                    </p>
                </div>
                <div className="flex gap-4 flex-1 min-h-0">
                    <div className="w-1/4 flex flex-col gap-2">
                        {GUILD_BOSSES.map(boss => (
                            <button 
                                key={boss.id}
                                onClick={() => setSelectedBoss(boss)}
                                className={`flex items-center gap-2 p-2 rounded-lg transition-all ${selectedBoss.id === boss.id ? 'bg-accent' : 'bg-secondary hover:bg-tertiary'}`}
                            >
                                <img src={boss.image} alt={boss.name} className="w-10 h-10 flex-shrink-0" />
                                <span className="font-semibold text-sm">{boss.name}</span>
                            </button>
                        ))}
                    </div>
                    <div className="w-3/4 bg-secondary p-3 rounded-lg flex flex-col min-h-0">
                        <div className="flex gap-4 items-start mb-3 border-b border-color pb-3">
                            <img src={selectedBoss.image} alt={selectedBoss.name} className="w-24 h-24 flex-shrink-0" />
                            <div>
                                <h3 className="text-2xl font-bold text-highlight">{selectedBoss.name}</h3>
                                <p className="text-sm text-tertiary">{selectedBoss.description}</p>
                            </div>
                        </div>
                        <div className="flex-1 grid grid-cols-2 gap-4 overflow-y-auto pr-2">
                            <div className="space-y-2">
                                <h4 className="font-bold">패턴 정보</h4>
                                {selectedBoss.skills.map(skill => (
                                    <div key={skill.id} className="flex items-start gap-2 text-xs bg-tertiary/50 p-1.5 rounded-md">
                                        <img src={BOSS_SKILL_ICON_MAP[skill.id]} alt={skill.name} className="w-8 h-8 flex-shrink-0" />
                                        <div>
                                            <p className="font-bold text-primary">{skill.name}</p>
                                            <p className="text-tertiary">{skill.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <h4 className="font-bold mb-1">추천 능력치</h4>
                                    <div className="bg-tertiary/50 p-2 rounded-md">
                                        <p className="text-sm text-yellow-300 text-center">{selectedBoss.recommendedStats.join(', ')}</p>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-bold mb-1">추천 연구소 스킬</h4>
                                    <div className="space-y-1">
                                    {selectedBoss.recommendedResearch.map(researchId => {
                                        const project = GUILD_RESEARCH_PROJECTS[researchId];
                                        return (
                                            <div key={researchId} className="flex items-center gap-2 text-xs bg-tertiary/50 p-1.5 rounded-md">
                                                <img src={project.image} alt={project.name} className="w-6 h-6 flex-shrink-0"/>
                                                <span className="font-semibold text-primary">{project.name}</span>
                                            </div>
                                        )
                                    })}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-bold mb-1">공략</h4>
                                    <div className="bg-tertiary/50 p-2 rounded-md">
                                        <p className="text-xs text-tertiary">{selectedBoss.strategyGuide}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DraggableWindow>
    )
}

const GuildCheckInPanel: React.FC<{ guild: GuildType }> = ({ guild }) => {
    const { handlers, currentUserWithStatus } = useAppContext();

    const now = Date.now();
    const myCheckInTimestamp = guild.checkIns?.[currentUserWithStatus!.id];
    const hasCheckedInToday = myCheckInTimestamp ? isSameDayKST(myCheckInTimestamp, now) : false;

    const todaysCheckIns = Object.values(guild.checkIns || {}).filter(ts => isSameDayKST(ts, now)).length;
    const totalMembers = guild.memberLimit || guild.members.length;
    
    const maxProgress = GUILD_CHECK_IN_MILESTONE_REWARDS[GUILD_CHECK_IN_MILESTONE_REWARDS.length - 1].count;
    const progressPercent = maxProgress > 0 ? (todaysCheckIns / maxProgress) * 100 : 0;

    const handleCheckIn = () => {
        handlers.handleAction({ type: 'GUILD_CHECK_IN' });
    };
    
    const handleClaimMilestone = (index: number) => {
        handlers.handleAction({ type: 'GUILD_CLAIM_CHECK_IN_REWARD', payload: { milestoneIndex: index } });
    };

    return (
        <div className="bg-secondary p-3 rounded-lg h-full flex flex-col">
            {/* Top Info */}
            <div>
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-xl text-highlight">길드 출석부</h3>
                    <Button onClick={handleCheckIn} disabled={hasCheckedInToday} className="!text-sm !py-1">
                        {hasCheckedInToday ? '출석 완료' : '출석하기'}
                    </Button>
                </div>
                <p className="text-sm text-tertiary">오늘 출석: <span className="font-bold text-primary">{todaysCheckIns} / {totalMembers}</span>명</p>
            </div>

            {/* Progress Bar */}
            <div className="my-2">
                <div className="w-full bg-tertiary rounded-full h-2.5 relative border border-black/20">
                    <div className="bg-green-500 h-full rounded-full transition-width duration-500" style={{ width: `${progressPercent}%` }}></div>
                    {/* Milestone lines */}
                    {GUILD_CHECK_IN_MILESTONE_REWARDS.map((milestone, index) => {
                        if (milestone.count < maxProgress) { // Don't draw line at the very end
                            const milestonePercent = (milestone.count / maxProgress) * 100;
                            return (
                                <div
                                    key={`milestone-line-${index}`}
                                    className="absolute top-0 h-full w-px bg-black/50"
                                    style={{ left: `${milestonePercent}%` }}
                                    title={`${milestone.count}명 보상`}
                                ></div>
                            );
                        }
                        return null;
                    })}
                </div>
            </div>

            {/* Rewards Grid Panel */}
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 flex-grow">
                {GUILD_CHECK_IN_MILESTONE_REWARDS.map((milestone, index) => {
                    const isAchieved = todaysCheckIns >= milestone.count;
                    const isClaimed = guild.dailyCheckInRewardsClaimed?.some(c => c.userId === currentUserWithStatus!.id && c.milestoneIndex === index);
                    const canClaim = isAchieved && !isClaimed && hasCheckedInToday;
                    
                    return (
                        <div key={index} className={`bg-tertiary p-1.5 rounded-lg text-center flex flex-col items-center justify-between border-2 ${isAchieved ? 'border-yellow-500/50' : 'border-transparent'} aspect-square`}>
                            <div className="flex flex-col items-center">
                                <img src="/images/guild/tokken.png" alt="길드 코인" className="w-8 h-8"/>
                                <span className="text-sm font-bold text-primary">+{milestone.reward.guildCoins}</span>
                                <p className="text-xs text-tertiary">{milestone.count}명</p>
                            </div>
                            <Button
                                onClick={() => canClaim && handleClaimMilestone(index)}
                                disabled={!canClaim}
                                colorScheme={canClaim ? 'green' : 'gray'}
                                className="!text-[10px] !py-1 mt-1 w-full"
                            >
                                {isClaimed ? '완료' : (isAchieved ? '받기' : '미달성')}
                            </Button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const GuildAnnouncementPanel: React.FC<{ guild: GuildType }> = ({ guild }) => (
    <div className="bg-secondary p-4 rounded-lg h-full flex flex-col">
        <h3 className="font-bold text-xl text-highlight mb-2 flex-shrink-0">길드 공지</h3>
        <div className="flex-grow overflow-y-auto pr-2 bg-tertiary/40 p-2 rounded-md min-h-0">
            <p className="text-sm text-primary whitespace-pre-wrap">
                {guild.announcement || '등록된 공지사항이 없습니다.'}
            </p>
        </div>
    </div>
);

const GuildDonationPanel: React.FC<{ guildDonationAnimation: { coins: number; research: number } | null }> = ({ guildDonationAnimation }) => {
    const { handlers, currentUserWithStatus } = useAppContext();

    const now = Date.now();
    const userDonations = (currentUserWithStatus!.dailyDonations && isSameDayKST(currentUserWithStatus!.dailyDonations.date, now))
        ? currentUserWithStatus!.dailyDonations
        : { gold: 0, diamond: 0, date: now };
    
    const goldDonationsLeft = GUILD_DONATION_GOLD_LIMIT - userDonations.gold;
    const diamondDonationsLeft = GUILD_DONATION_DIAMOND_LIMIT - userDonations.diamond;

    const handleDonate = (currency: 'gold' | 'diamond') => {
        if (currency === 'diamond') {
            if (window.confirm(`다이아 ${GUILD_DONATION_DIAMOND_COST}개를 사용하여 기부하시겠습니까?`)) {
                handlers.handleAction({ type: 'GUILD_DONATE_DIAMOND' });
            }
        } else {
            handlers.handleAction({ type: 'GUILD_DONATE_GOLD' });
        }
    };

    return (
        <div className="bg-secondary p-4 rounded-lg h-full flex flex-col relative overflow-hidden">
            {guildDonationAnimation && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                    <div className="bonus-score-animation flex items-center gap-2" style={{ position: 'absolute', top: '10%' }}>
                        <img src="/images/guild/tokken.png" alt="Guild Coin" className="w-6 h-6" />
                        <span className="text-xl font-bold text-yellow-300" style={{ textShadow: '1px 1px 3px black' }}>
                            +{guildDonationAnimation.coins}
                        </span>
                    </div>
                    <div className="bonus-score-animation flex items-center gap-2" style={{ position: 'absolute', top: '40%', animationDelay: '0.2s' }}>
                        <img src="/images/guild/guildlab.png" alt="Research Points" className="w-6 h-6" />
                        <span className="text-xl font-bold text-purple-400" style={{ textShadow: '1px 1px 3px black' }}>
                            +{guildDonationAnimation.research}
                        </span>
                    </div>
                </div>
            )}
            <h3 className="font-bold text-xl text-highlight mb-3">길드 기부</h3>
            <div className="flex-grow grid grid-cols-2 gap-4">
                <div className="bg-tertiary p-3 rounded-lg flex flex-col justify-between text-center">
                    <div>
                        <img src="/images/Gold.png" alt="Gold" className="w-10 h-10 mx-auto mb-2" />
                        <h4 className="font-semibold text-primary">100 골드 기부</h4>
                        <div className="text-xs text-tertiary mt-1 space-y-1">
                            <p className="flex items-center justify-center gap-1">
                                <img src="/images/guild/tokken.png" alt="Guild Coin" className="w-4 h-4" />
                                <span>{GUILD_DONATION_GOLD_REWARDS.guildCoins[0]}~{GUILD_DONATION_GOLD_REWARDS.guildCoins[1]} 획득</span>
                            </p>
                            <p className="flex items-center justify-center gap-1">
                                <img src="/images/guild/guildlab.png" alt="Research Points" className="w-4 h-4" />
                                <span>{GUILD_DONATION_GOLD_REWARDS.researchPoints[0]}~{GUILD_DONATION_GOLD_REWARDS.researchPoints[1]} 획득</span>
                            </p>
                        </div>
                    </div>
                    <div className="mt-2">
                        <p className="text-xs text-secondary mb-1">남은 횟수: {goldDonationsLeft}/{GUILD_DONATION_GOLD_LIMIT}</p>
                        <Button onClick={() => handleDonate('gold')} disabled={goldDonationsLeft <= 0} colorScheme="yellow" className="w-full !text-sm !py-1">
                            기부하기
                        </Button>
                    </div>
                </div>
                <div className="bg-tertiary p-3 rounded-lg flex flex-col justify-between text-center">
                    <div>
                        <img src="/images/Zem.png" alt="Diamond" className="w-10 h-10 mx-auto mb-2" />
                        <h4 className="font-semibold text-primary">10 다이아 기부</h4>
                        <div className="text-xs text-tertiary mt-1 space-y-1">
                            <p className="flex items-center justify-center gap-1">
                                <img src="/images/guild/tokken.png" alt="Guild Coin" className="w-4 h-4" />
                                <span>{GUILD_DONATION_DIAMOND_REWARDS.guildCoins[0]}~{GUILD_DONATION_DIAMOND_REWARDS.guildCoins[1]} 획득</span>
                            </p>
                            <p className="flex items-center justify-center gap-1">
                                <img src="/images/guild/guildlab.png" alt="Research Points" className="w-4 h-4" />
                                <span>{GUILD_DONATION_DIAMOND_REWARDS.researchPoints[0]}~{GUILD_DONATION_DIAMOND_REWARDS.researchPoints[1]} 획득</span>
                            </p>
                        </div>
                    </div>
                    <div className="mt-2">
                        <p className="text-xs text-secondary mb-1">남은 횟수: {diamondDonationsLeft}/{GUILD_DONATION_DIAMOND_LIMIT}</p>
                        <Button onClick={() => handleDonate('diamond')} disabled={diamondDonationsLeft <= 0} colorScheme="blue" className="w-full !text-sm !py-1">
                            기부하기
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const GuildChat: React.FC<{ guild: GuildType, myMemberInfo: GuildMember | undefined }> = ({ guild, myMemberInfo }) => {
    const { handlers, allUsers, currentUserWithStatus } = useAppContext();
    const [message, setMessage] = useState('');
    const chatBodyRef = useRef<HTMLDivElement>(null);
    const userMap = useMemo(() => new Map(allUsers.map(u => [u.id, u])), [allUsers]);

    useEffect(() => {
        if (chatBodyRef.current) {
            chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
        }
    }, [guild.chatHistory]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim()) {
            handlers.handleAction({ type: 'SEND_GUILD_CHAT_MESSAGE', payload: { text: message } });
            setMessage('');
        }
    };

    const handleDelete = (msg: ChatMessage) => {
        if (window.confirm('메시지를 삭제하시겠습니까?')) {
            handlers.handleAction({ type: 'GUILD_DELETE_CHAT_MESSAGE', payload: { messageId: msg.id, timestamp: msg.timestamp } });
        }
    };

    return (
        <div className="bg-secondary p-4 rounded-lg h-full flex flex-col">
            <h3 className="font-bold text-xl text-highlight mb-2 flex-shrink-0">길드 채팅</h3>
            <div ref={chatBodyRef} className="flex-grow space-y-3 overflow-y-auto pr-2 mb-2 bg-tertiary/40 p-2 rounded-md min-h-0">
                {guild.chatHistory && guild.chatHistory.length > 0 ? (
                    guild.chatHistory.map(msg => {
                        const sender = userMap.get(msg.user.id);
                        const avatarUrl = sender ? AVATAR_POOL.find(a => a.id === sender.avatarId)?.url : undefined;
                        const borderUrl = sender ? BORDER_POOL.find(b => b.id === sender.borderId)?.url : undefined;
                        const isMyMessage = msg.user.id === currentUserWithStatus?.id;
                        const canManage = myMemberInfo?.role === GuildMemberRole.Master || myMemberInfo?.role === GuildMemberRole.Vice;

                        return (
                            <div key={msg.id || msg.timestamp} className="flex items-start gap-3 group">
                                <div className="flex-shrink-0 mt-1">
                                    {sender && <Avatar userId={sender.id} userName={sender.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={32} />}
                                </div>
                                <div className="flex-grow">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-baseline gap-2">
                                            <span className="font-semibold text-primary">{msg.user.nickname}</span>
                                            <span className="text-xs text-tertiary">{formatDateTimeKST(msg.timestamp)}</span>
                                        </div>
                                        {(isMyMessage || canManage) && !msg.system && msg.id && (
                                            <button 
                                                onClick={() => handleDelete(msg)} 
                                                className="text-xs text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity font-semibold"
                                                aria-label="Delete message"
                                                title="메시지 삭제"
                                            >
                                                삭제
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-sm text-secondary break-words whitespace-pre-wrap">{msg.text}</p>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="h-full flex items-center justify-center text-tertiary">
                        <p>길드 채팅 메시지가 없습니다.</p>
                    </div>
                )}
            </div>
            <form onSubmit={handleSubmit} className="flex gap-2 flex-shrink-0">
                <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="메시지를 입력하세요..."
                    className="flex-grow bg-tertiary border border-color rounded-md p-2 text-sm resize-none"
                    rows={2}
                    maxLength={200}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit(e);
                        }
                    }}
                />
                <Button type="submit" className="self-end">전송</Button>
            </form>
        </div>
    );
};

const ActivityPanel: React.FC<{ onOpenResearch: () => void; onOpenMissions: () => void; onOpenShop: () => void; missionNotification: boolean; onOpenBossGuide: () => void; }> = ({ onOpenResearch, onOpenMissions, onOpenShop, missionNotification, onOpenBossGuide }) => {
    const activities = [
        { name: '길드 미션', icon: '/images/guild/guildmission.png', action: onOpenMissions, notification: missionNotification },
        { name: '길드 연구소', icon: '/images/guild/guildlab.png', action: onOpenResearch },
        { name: '길드 상점', icon: '/images/guild/guildstore.png', action: onOpenShop },
        { name: '보스 도감', icon: '/images/guild/bossraid1.png', action: onOpenBossGuide },
    ];
    return (
        <div className="bg-secondary p-4 rounded-lg">
            <h3 className="font-bold text-xl text-highlight mb-3 text-center">길드 활동</h3>
            <div className="flex justify-around">
                {activities.map(act => (
                    <button 
                        key={act.name} 
                        onClick={act.action}
                        className={`flex flex-col items-center gap-2 text-center transition-transform hover:scale-105 relative`}
                    >
                        <div className="w-16 h-16 bg-tertiary rounded-lg flex items-center justify-center">
                            <img src={act.icon} alt={act.name} className="w-12 h-12" />
                        </div>
                        <span className="text-sm font-semibold">{act.name}</span>
                        {act.notification && <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-secondary"></div>}
                    </button>
                ))}
            </div>
        </div>
    );
};

const BossPanel: React.FC<{ guild: GuildType }> = ({ guild }) => {
    const currentBoss = useMemo(() => {
        if (!guild.guildBossState) return GUILD_BOSSES[0];
        return GUILD_BOSSES.find(b => b.id === guild.guildBossState!.currentBossId) || GUILD_BOSSES[0];
    }, [guild.guildBossState]);
    
    const currentHp = guild.guildBossState?.currentBossHp ?? currentBoss?.maxHp ?? 0;
    const hpPercent = (currentHp / currentBoss.maxHp) * 100;
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const calculateTimeLeft = () => {
            const msLeft = getTimeUntilNextMondayKST();

            const days = Math.floor(msLeft / (1000 * 60 * 60 * 24));
            const hours = Math.floor((msLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));
            setTimeLeft(`${days}일 ${String(hours).padStart(2, '0')}시간 ${String(minutes).padStart(2, '0')}분`);
        };

        calculateTimeLeft();
        const interval = setInterval(calculateTimeLeft, 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);

    return (
        <button 
            onClick={() => window.location.hash = '#/guildboss'}
            className="bg-secondary p-4 rounded-lg flex flex-col items-center text-center flex-grow transition-all hover:bg-tertiary/70"
        >
            <h3 className="font-bold text-xl text-highlight mb-2">길드 보스전</h3>
            <div className="w-24 h-24 bg-tertiary rounded-lg flex items-center justify-center my-2">
                <img src="/images/guild/bossraid.png" alt="길드 보스전" className="w-20 h-20" />
            </div>
            <div className="w-full mt-auto">
                <p className="text-sm font-semibold">{currentBoss.name}</p>
                <div className="w-full bg-tertiary rounded-full h-2.5 border border-color mt-1">
                    <div className="bg-gradient-to-r from-red-500 to-red-700 h-full rounded-full" style={{ width: `${hpPercent}%` }}></div>
                </div>
                <p className="text-xs text-tertiary mt-1">{hpPercent.toFixed(1)}%</p>
                 <p className="text-xs text-tertiary mt-2">교체까지: {timeLeft}</p>
            </div>
        </button>
    );
};

const WarPanel: React.FC = () => (
    <button 
        onClick={() => window.location.hash = '#/guildwar'}
        className="bg-secondary p-4 rounded-lg flex flex-col items-center text-center flex-grow transition-all hover:bg-tertiary/70"
    >
        <h3 className="font-bold text-xl text-highlight mb-2">길드 전쟁</h3>
        <div className="w-24 h-24 bg-tertiary rounded-lg flex items-center justify-center my-2">
            <img src="/images/guild/guildwar.png" alt="길드 전쟁" className="w-20 h-20" />
        </div>
        <span className="text-sm text-secondary mt-auto">입장하기</span>
    </button>
);

const GuildHomePanel: React.FC<GuildHomePanelProps> = ({ guild, myMemberInfo, onOpenMissions, onOpenResearch, onOpenShop, missionNotification, guildDonationAnimation }) => {
    const [isBossGuideOpen, setIsBossGuideOpen] = useState(false);
    return (
        <div className="flex flex-col gap-4 h-full">
            {isBossGuideOpen && <GuildBossGuideModal onClose={() => setIsBossGuideOpen(false)} />}
            {/* Top row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-shrink-0">
                <GuildCheckInPanel guild={guild} />
                <GuildAnnouncementPanel guild={guild} />
                <GuildDonationPanel guildDonationAnimation={guildDonationAnimation} />
            </div>

            {/* Bottom row */}
            <div className="flex flex-col md:flex-row gap-4 flex-grow min-h-0">
                <div className="md:w-2/3 h-full min-h-0">
                    <GuildChat guild={guild} myMemberInfo={myMemberInfo} />
                </div>
                <div className="md:w-1/3 flex flex-col gap-4 h-full">
                    <ActivityPanel onOpenMissions={onOpenMissions} onOpenResearch={onOpenResearch} onOpenShop={onOpenShop} missionNotification={missionNotification} onOpenBossGuide={() => setIsBossGuideOpen(true)} />
                    <div className="flex-grow flex gap-4">
                        <BossPanel guild={guild} />
                        <WarPanel />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GuildHomePanel;