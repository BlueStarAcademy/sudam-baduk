import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../hooks/useAppContext.js';
import { Guild as GuildType, GuildMemberRole, GuildBossInfo, GuildResearchId, CoreStat } from '../../types/index.js';
import Button from '../Button.js';
import GuildHomePanel from './GuildHomePanel.js';
import GuildMembersPanel from './GuildMembersPanel.js';
import GuildManagementPanel from './GuildManagementPanel.js';
import { GUILD_XP_PER_LEVEL, GUILD_BOSSES, GUILD_RESEARCH_PROJECTS } from '../../constants/index.js';
import DraggableWindow from '../DraggableWindow.js';
import GuildResearchPanel from './GuildResearchPanel.js';
import GuildMissionsPanel from './GuildMissionsPanel.js';
import GuildShopModal from './GuildShopModal.js';
import { BOSS_SKILL_ICON_MAP } from '../../assets.js';
import HelpModal from '../HelpModal.js';


interface GuildIconSelectionModalProps {
    guild: GuildType;
    onClose: () => void;
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

const GuildIconSelectionModal: React.FC<GuildIconSelectionModalProps> = ({ guild, onClose }) => {
    const { handlers } = useAppContext();
    const [selectedIcon, setSelectedIcon] = useState(guild.icon);

    const icons = useMemo(() => {
        return Array.from({ length: 11 }, (_, i) => `/images/guild/icon${i + 1}.png`);
    }, []);
    
    const handleSave = () => {
        if (selectedIcon !== guild.icon) {
            handlers.handleAction({
                type: 'GUILD_UPDATE_PROFILE',
                payload: {
                    guildId: guild.id,
                    icon: selectedIcon,
                }
            });
        }
        onClose();
    };

    return (
        <DraggableWindow title="길드 아이콘 변경" onClose={onClose} windowId={`guild-icon-select-${guild.id}`} initialWidth={600}>
            <div className="h-[60vh] flex flex-col">
                <div className="flex-grow overflow-y-auto pr-2 grid grid-cols-4 sm:grid-cols-5 gap-4">
                    {icons.map(iconPath => (
                        <div
                            key={iconPath}
                            onClick={() => setSelectedIcon(iconPath)}
                            className={`p-2 rounded-lg border-2 ${selectedIcon === iconPath ? 'border-accent ring-2 ring-accent' : 'border-color bg-secondary/50'} cursor-pointer flex flex-col items-center transition-all`}
                        >
                            <img src={iconPath} alt={`Icon ${iconPath.split('/').pop()}`} className="w-full h-full object-contain" />
                        </div>
                    ))}
                </div>
                <div className="flex-shrink-0 mt-4 pt-4 border-t border-color flex justify-end gap-4">
                    <Button onClick={onClose} colorScheme="gray">취소</Button>
                    <Button onClick={handleSave} disabled={selectedIcon === guild.icon}>저장</Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

interface GuildDashboardProps {
    guild: GuildType;
    guildDonationAnimation: { coins: number; research: number } | null;
}

type GuildTab = 'home' | 'members' | 'management';

export const GuildDashboard: React.FC<GuildDashboardProps> = ({ guild, guildDonationAnimation }) => {
    const { currentUserWithStatus, modals } = useAppContext();
    const [activeTab, setActiveTab] = useState<GuildTab>('home');
    const [isIconModalOpen, setIsIconModalOpen] = useState(false);
    const [isMissionsOpen, setIsMissionsOpen] = useState(false);
    const [isResearchOpen, setIsResearchOpen] = useState(false);
    const [isShopOpen, setIsShopOpen] = useState(false);
    const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
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
    
    const isAnyOtherModalOpen = modals.activeModalIds.length > 0;

    const renderContent = () => {
        switch (activeTab) {
            case 'members': return <GuildMembersPanel guild={guild} myMemberInfo={myMemberInfo} />;
            case 'management': return canManage ? <GuildManagementPanel guild={guild} /> : <p>길드 관리 권한이 없습니다.</p>;
            case 'home':
            default:
                return <GuildHomePanel 
                            guild={guild} 
                            myMemberInfo={myMemberInfo}
                            onOpenMissions={() => setIsMissionsOpen(true)}
                            onOpenResearch={() => setIsResearchOpen(true)}
                            onOpenShop={() => setIsShopOpen(true)}
                            missionNotification={missionTabNotification}
                            guildDonationAnimation={guildDonationAnimation}
                        />;
        }
    };

    return (
        <div className="p-2 sm:p-4 lg:p-6 max-w-7xl mx-auto flex flex-col h-full w-full relative">
            {isIconModalOpen && <GuildIconSelectionModal guild={guild} onClose={() => setIsIconModalOpen(false)} />}
            {isMissionsOpen && <GuildMissionsPanel guild={guild} myMemberInfo={myMemberInfo} onClose={() => setIsMissionsOpen(false)} />}
            {isResearchOpen && <GuildResearchPanel guild={guild} myMemberInfo={myMemberInfo} onClose={() => setIsResearchOpen(false)} />}
            {isShopOpen && <GuildShopModal onClose={() => setIsShopOpen(false)} isTopmost={!isAnyOtherModalOpen} />}
            {isBossGuideOpen && <GuildBossGuideModal onClose={() => setIsBossGuideOpen(false)} />}
            {isHelpOpen && <HelpModal mode="guild" onClose={() => setIsHelpOpen(false)} />}


            <header className="relative flex justify-center items-center mb-4 flex-shrink-0 py-2">
                <div className="absolute left-0 top-1/2 -translate-y-1/2">
                    <Button onClick={() => window.location.hash = '#/profile'}>&larr; 프로필로</Button>
                </div>
                
                <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-4">
                        <div className="relative group flex-shrink-0">
                            <img src={guild.icon} alt="Guild Icon" className="w-16 h-16 bg-tertiary rounded-md" />
                            {canManage && (
                                <button 
                                    onClick={() => setIsIconModalOpen(true)}
                                    className="absolute -top-2 -right-2 w-7 h-7 bg-accent rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:scale-110 hover:!scale-125"
                                    title="아이콘 변경"
                                >
                                    ✏️
                                </button>
                            )}
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
            
            <div className="flex bg-tertiary/70 p-1 rounded-lg mb-4 flex-shrink-0">
                <button onClick={() => setActiveTab('home')} className={`relative flex-1 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'home' ? 'bg-accent' : 'text-tertiary hover:bg-secondary/50'}`}>
                    홈
                </button>
                <button onClick={() => setActiveTab('members')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'members' ? 'bg-accent' : 'text-tertiary hover:bg-secondary/50'}`}>길드원</button>
                {canManage && <button onClick={() => setActiveTab('management')} className={`relative flex-1 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'management' ? 'bg-accent' : 'text-tertiary hover:bg-secondary/50'}`}>
                    관리
                    {(guild.applicants?.length ?? 0) > 0 && <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></div>}
                </button>}
            </div>
            
            <main className="flex-1 min-h-0 lg:grid lg:grid-cols-3 lg:gap-4">
                <div className="lg:col-span-3 h-full min-h-0 bg-panel border border-color rounded-lg p-2 md:p-4">
                    {renderContent()}
                </div>
            </main>
        </div>
    );
};