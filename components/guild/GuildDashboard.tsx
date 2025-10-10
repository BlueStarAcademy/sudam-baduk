import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Guild as GuildType, GuildMemberRole, GuildMember, GuildBossInfo, GuildResearchId, GuildResearchCategory, ItemGrade, ServerAction } from '../../types/index.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import Button from '../Button.js';
import { GUILD_XP_PER_LEVEL, GUILD_BOSSES, GUILD_RESEARCH_PROJECTS, GUILD_DONATION_GOLD_LIMIT, GUILD_DONATION_DIAMOND_LIMIT, GUILD_DONATION_GOLD_COST, GUILD_DONATION_DIAMOND_COST } from '../../constants/index.js';
import DraggableWindow from '../DraggableWindow.js';
import GuildShopModal from './GuildShopModal.js';
import GuildResearchPanel from './GuildResearchPanel.js';
import GuildMissionsPanel from './GuildMissionsPanel.js';
import { BOSS_SKILL_ICON_MAP } from '../../assets.js';
import HelpModal from '../HelpModal.js';
import { getTimeUntilNextMondayKST, isSameDayKST } from '../../utils/timeUtils.js';
import Avatar from '../Avatar.js';
import { AVATAR_POOL, BORDER_POOL } from '../../constants/index.js';
import ToggleSwitch from '../ui/ToggleSwitch.js';
import GuildHomePanel from './GuildHomePanel.js';
import GuildMembersPanel from './GuildMembersPanel.js';
import GuildManagementPanel from './GuildManagementPanel.js';

interface GuildDashboardProps {
    guild: GuildType;
    guildDonationAnimation: { coins: number; research: number } | null;
}

type GuildTab = 'home' | 'members' | 'management';

export const GuildDashboard: React.FC<GuildDashboardProps> = ({ guild, guildDonationAnimation }) => {
    const { currentUserWithStatus } = useAppContext();
    const [activeTab, setActiveTab] = useState<GuildTab>('home');
    const [isIconModalOpen, setIsIconModalOpen] = useState(false);
    const [isMissionsOpen, setIsMissionsOpen] = useState(false);
    const [isResearchOpen, setIsResearchOpen] = useState(false);
    const [isShopOpen, setIsShopOpen] = useState(false);
    const [isBossGuideOpen, setIsBossGuideOpen] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    const myMemberInfo = useMemo(() => {
        return guild.members.find(m => m.userId === currentUserWithStatus?.id);
    }, [guild.members, currentUserWithStatus?.id]);

    const canManage = myMemberInfo?.role === GuildMemberRole.Master || myMemberInfo?.role === GuildMemberRole.Vice;

    const xpForNextLevel = GUILD_XP_PER_LEVEL(guild.level);
    const xpProgress = Math.min((guild.xp / xpForNextLevel) * 100, 100);
    const myGuildCoins = currentUserWithStatus?.guildCoins ?? 0;
    const myBossTickets = currentUserWithStatus?.guildBossAttempts !== undefined ? 2 - currentUserWithStatus.guildBossAttempts : 2;
    
    const missionTabNotification = useMemo(() => {
        if (!currentUserWithStatus || !myMemberInfo) return false;
        return guild.weeklyMissions?.some(m => m.progress >= m.target && !m.claimedBy.includes(currentUserWithStatus.id)) ?? false;
    }, [guild.weeklyMissions, myMemberInfo, currentUserWithStatus]);

    const renderLeftContent = () => {
        switch (activeTab) {
            case 'members':
                return <GuildMembersPanel guild={guild} myMemberInfo={myMemberInfo} />;
            case 'management':
                return canManage ? <GuildManagementPanel guild={guild} /> : <p className="text-center p-8">길드 관리 권한이 없습니다.</p>;
            case 'home':
            default:
                return <GuildHomePanel guild={guild} myMemberInfo={myMemberInfo} />;
        }
    };
    
    const GuildDonationPanel: React.FC<{ guildDonationAnimation: { coins: number; research: number } | null }> = ({ guildDonationAnimation }) => {
        const { handlers, currentUserWithStatus } = useAppContext();
        const [isDonating, setIsDonating] = useState(false);
        const donationInFlight = useRef(false);
        const now = Date.now();
        const dailyDonations = (currentUserWithStatus?.dailyDonations && isSameDayKST(currentUserWithStatus.dailyDonations.date, now))
            ? currentUserWithStatus.dailyDonations
            : { gold: 0, diamond: 0, date: now };

        const goldDonationsLeft = GUILD_DONATION_GOLD_LIMIT - dailyDonations.gold;
        const diamondDonationsLeft = GUILD_DONATION_DIAMOND_LIMIT - dailyDonations.diamond;

        const canDonateGold = goldDonationsLeft > 0 && (currentUserWithStatus?.gold ?? 0) >= GUILD_DONATION_GOLD_COST;
        const canDonateDiamond = diamondDonationsLeft > 0 && (currentUserWithStatus?.diamonds ?? 0) >= GUILD_DONATION_DIAMOND_COST;

        const handleDonate = async (type: 'GUILD_DONATE_GOLD' | 'GUILD_DONATE_DIAMOND') => {
            if (donationInFlight.current) return;
            donationInFlight.current = true;
            setIsDonating(true);
            try {
                await handlers.handleAction({ type });
            } catch(error) {
                console.error("Donation failed:", error);
            } finally {
                setIsDonating(false);
                donationInFlight.current = false;
            }
        };
        
        const animationElements = useMemo(() => {
            if (!guildDonationAnimation) return [];
            return Array.from({ length: 5 }).map((_, i) => {
                const delay = i * 100;
                return (
                    <div key={i} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-float-up-and-fade" style={{ animationDelay: `${delay}ms` }}>
                        <div className="flex items-center gap-1 bg-black/50 p-1 rounded-lg">
                            <img src="/images/guild/tokken.png" alt="Coin" className="w-4 h-4" />
                            <span className="text-xs font-bold text-yellow-300">+{guildDonationAnimation.coins}</span>
                            <img src="/images/statpoint.png" alt="Research" className="w-4 h-4 ml-2" />
                            <span className="text-xs font-bold text-blue-300">+{guildDonationAnimation.research}</span>
                        </div>
                    </div>
                );
            });
        }, [guildDonationAnimation]);

        return (
            <div className="bg-secondary p-4 rounded-lg flex flex-col relative overflow-hidden">
                <h3 className="font-bold text-lg text-highlight mb-3 text-center">길드 기부</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-tertiary p-3 rounded-md text-center">
                        <img src="/images/Gold.png" alt="골드 기부" className="w-12 h-12 mx-auto mb-2" />
                        <p className="text-xs text-secondary">골드 기부 ({goldDonationsLeft}/{GUILD_DONATION_GOLD_LIMIT})</p>
                        <Button 
                            onClick={() => handleDonate('GUILD_DONATE_GOLD')}
                            disabled={!canDonateGold || isDonating}
                            colorScheme="yellow"
                            className="w-full mt-2 !text-xs !py-1"
                        >
                            {isDonating ? '기부 중...' : `${GUILD_DONATION_GOLD_COST.toLocaleString()} 골드 기부`}
                        </Button>
                    </div>
                    <div className="bg-tertiary p-3 rounded-md text-center">
                        <img src="/images/Zem.png" alt="다이아 기부" className="w-12 h-12 mx-auto mb-2" />
                        <p className="text-xs text-secondary">다이아 기부 ({diamondDonationsLeft}/{GUILD_DONATION_DIAMOND_LIMIT})</p>
                        <Button
                            onClick={() => handleDonate('GUILD_DONATE_DIAMOND')}
                            disabled={!canDonateDiamond || isDonating}
                            colorScheme="blue"
                            className="w-full mt-2 !text-xs !py-1"
                        >
                            {isDonating ? '기부 중...' : `${GUILD_DONATION_DIAMOND_COST.toLocaleString()} 다이아 기부`}
                        </Button>
                    </div>
                </div>
                {animationElements}
            </div>
        );
    };

    const ActivityPanel: React.FC<{ onOpenMissions: () => void; onOpenResearch: () => void; onOpenShop: () => void; missionNotification: boolean; onOpenBossGuide: () => void; }> = ({ onOpenMissions, onOpenResearch, onOpenShop, missionNotification, onOpenBossGuide }) => {
        const activities = [
            { name: '길드 미션', icon: '/images/guild/guildmission.png', action: onOpenMissions, notification: missionNotification },
            { name: '길드 연구소', icon: '/images/guild/guildlab.png', action: onOpenResearch },
            { name: '길드 상점', icon: '/images/guild/guildstore.png', action: onOpenShop },
            { name: '보스 도감', icon: '/images/guild/bossraid1.png', action: onOpenBossGuide },
        ];
        return (
            <div className="bg-secondary p-4 rounded-lg">
                <h3 className="font-bold text-lg text-highlight mb-3 text-center">길드 활동</h3>
                <div className="flex justify-around">
                    {activities.map(act => (
                        <button 
                            key={act.name} 
                            onClick={act.action}
                            className={`flex flex-col items-center gap-2 text-center transition-transform hover:scale-105 relative`}
                        >
                            <div className="w-16 h-16 bg-tertiary rounded-lg flex items-center justify-center">
                                <img src={act.icon} alt={act.name} className="w-14 h-14" />
                            </div>
                            <span className="text-base font-semibold">{act.name}</span>
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
            const interval = setInterval(calculateTimeLeft, 60000);
            return () => clearInterval(interval);
        }, []);

        return (
            <button 
                onClick={() => window.location.hash = '#/guildboss'}
                className="bg-secondary p-3 rounded-lg flex flex-col items-center text-center transition-all hover:bg-tertiary/70 w-full"
            >
                <h3 className="font-bold text-xl text-highlight mb-2">길드 보스전</h3>
                <div className="w-24 h-24 bg-tertiary rounded-lg flex items-center justify-center my-1">
                    <img src="/images/guild/bossraid.png" alt="길드 보스전" className="w-20 h-20" />
                </div>
                <div className="w-full mt-auto">
                    <p className="text-lg font-semibold">{currentBoss.name}</p>
                    <div className="w-full bg-tertiary rounded-full h-2 border border-color mt-1">
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
            className="bg-secondary p-3 rounded-lg flex flex-col items-center text-center transition-all hover:bg-tertiary/70 w-full"
        >
            <h3 className="font-bold text-xl text-highlight mb-2">길드 전쟁</h3>
            <div className="w-24 h-24 bg-tertiary rounded-lg flex items-center justify-center my-1">
                <img src="/images/guild/guildwar.png" alt="길드 전쟁" className="w-20 h-20" />
            </div>
            <span className="text-lg text-secondary mt-auto">입장하기</span>
        </button>
    );
    
    return (
        <div className="p-2 sm:p-4 lg:p-6 max-w-7xl mx-auto flex flex-col h-full w-full relative">
            {isHelpOpen && <HelpModal mode="guild" onClose={() => setIsHelpOpen(false)} />}
            
            <header className="relative flex justify-center items-center mb-4 flex-shrink-0 py-2">
                <div className="absolute left-0 top-1/2 -translate-y-1/2">
                    <Button onClick={() => window.location.hash = '#/profile'}>&larr; 프로필로</Button>
                </div>
                
                <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-4">
                        <div className="relative group flex-shrink-0">
                            <img src={guild.icon} alt="Guild Icon" className="w-16 h-16 bg-tertiary rounded-md" />
                        </div>
                        <h1 className="text-3xl font-bold">{guild.name}</h1>
                    </div>
                    <div className="w-48">
                        <div className="flex justify-between text-xs text-secondary mb-0.5">
                            <span>Lv.{guild.level}</span>
                            <span>{guild.xp.toLocaleString()} / {xpForNextLevel.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-tertiary rounded-full h-2.5 border border-color">
                            <div className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full" style={{ width: `${xpProgress}%` }}></div>
                        </div>
                    </div>
                </div>

                <div className="absolute right-0 top-1/2 -translate-y-1/2">
                    <div className="flex flex-col items-end gap-1">
                        <button onClick={() => setIsHelpOpen(true)} className="p-1 rounded-full text-2xl hover:bg-tertiary transition-colors" title="길드 도움말">❓</button>
                        <div className="flex items-center gap-2 bg-tertiary/50 p-2 rounded-lg">
                            <div className="flex items-center gap-2 pr-2 border-r border-color" title="나의 길드 코인">
                                <img src="/images/guild/tokken.png" alt="Guild Coin" className="w-6 h-6" />
                                <span className="font-bold text-lg">{myGuildCoins.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-2" title="나의 보스전 참여 티켓">
                                <img src="/images/guild/ticket.png" alt="Boss Ticket" className="w-6 h-6" />
                                <span className="font-bold text-lg">{myBossTickets} / 2</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>
            
            <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3 flex flex-col gap-4 h-full min-h-0">
                     <GuildHomePanel guild={guild} myMemberInfo={myMemberInfo} />
                </div>

                <div className="lg:col-span-2 flex flex-col gap-4">
                    <GuildDonationPanel guildDonationAnimation={guildDonationAnimation} />
                    <ActivityPanel onOpenMissions={() => setIsMissionsOpen(true)} onOpenResearch={() => setIsResearchOpen(true)} onOpenShop={() => setIsShopOpen(true)} missionNotification={missionTabNotification} onOpenBossGuide={() => setIsBossGuideOpen(true)} />
                    <div className="flex-grow flex gap-4 min-h-0">
                        <BossPanel guild={guild} />
                        <WarPanel />
                    </div>
                </div>
            </main>
        </div>
    );
};
