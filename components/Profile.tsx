import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { UserWithStatus, GameMode, EquipmentSlot, InventoryItem, ItemGrade, ServerAction, LeagueTier, CoreStat, SpecialStat, MythicStat, ItemOptionType, TournamentState, User, Guild } from '../types/index.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, AVATAR_POOL, BORDER_POOL, LEAGUE_DATA, CORE_STATS_DATA, SPECIAL_STATS_DATA, MYTHIC_STATS_DATA, emptySlotImages, TOURNAMENT_DEFINITIONS, GRADE_LEVEL_REQUIREMENTS, RANKING_TIERS, SINGLE_PLAYER_STAGES } from '../constants/index.js';
import { STRATEGIC_GO_LOBBY_IMG, PLAYFUL_GO_LOBBY_IMG, TOURNAMENT_LOBBY_IMG, SINGLE_PLAYER_LOBBY_IMG, TOWER_CHALLENGE_LOBBY_IMG } from '../assets.js';
import Avatar from './Avatar.js';
import Button from './Button.js';
import DetailedStatsModal from './DetailedStatsModal.js';
import { getMannerScore, getMannerRank, getMannerStyle } from '../utils/mannerUtils.js';
import { calculateUserEffects, calculateTotalStats } from '../utils/statUtils.js';
import { useAppContext } from '../hooks/useAppContext.js';
import QuickAccessSidebar from './QuickAccessSidebar.js';
import ChatWindow from "./waiting-room/ChatWindow.js";
import EquipmentEffectsModal from "./EquipmentEffectsModal.js";
import PresetModal from "./PresetModal.js";
import RankingBoard from "./profile/RankingBoard.js";
import { isDifferentDayKST, getKSTDate } from '../utils/timeUtils.js';

interface ProfileProps {
}

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

const XpBar: React.FC<{ level: number, currentXp: number, label: string, colorClass: string }> = ({ level, currentXp, label, colorClass }) => {
    const maxXp = level * 100;
    const percentage = Math.min((currentXp / maxXp) * 100, 100);
    return (
        <div>
            <div className="flex justify-between items-baseline mb-0.5 text-xs">
                <span className="font-semibold">{label} <span className="text-base font-bold">Lv.{level}</span></span>
                <span className="font-mono text-tertiary">{currentXp} / {maxXp}</span>
            </div>
            <div className="w-full bg-tertiary/50 rounded-full h-3 border border-color">
                <div className={`${colorClass} h-full rounded-full transition-width duration-500`} style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
};


const gradeBackgrounds: Record<ItemGrade, string> = {
    normal: '/images/equipments/normalbgi.png',
    uncommon: '/images/equipments/uncommonbgi.png',
    rare: '/images/equipments/rarebgi.png',
    epic: '/images/equipments/epicbgi.png',
    legendary: '/images/equipments/legendarybgi.png',
    mythic: '/images/equipments/mythicbgi.png',
};

const getStarDisplayInfo = (stars: number) => {
    if (stars >= 10) {
        return { text: `(★${stars})`, colorClass: "prism-text-effect" };
    } else if (stars >= 7) {
        return { text: `(★${stars})`, colorClass: "text-purple-400" };
    } else if (stars >= 4) {
        return { text: `(★${stars})`, colorClass: "text-amber-400" };
    } else if (stars >= 1) {
        return { text: `(★${stars})`, colorClass: "text-white" };
    }
    return { text: "", colorClass: "text-white" };
};

const EquipmentSlotDisplay: React.FC<{ slot: EquipmentSlot; item?: InventoryItem; onClick?: () => void; }> = ({ slot, item, onClick }) => {
    const clickableClass = item && onClick ? 'cursor-pointer hover:scale-105 transition-transform' : '';
    
    if (item) {
        const requiredLevel = GRADE_LEVEL_REQUIREMENTS[item.grade];
        const titleText = `${item.name} (착용 레벨 합: ${requiredLevel}) - 클릭하여 상세보기`;
        const starInfo = getStarDisplayInfo(item.stars);
        return (
            <div
                className={`relative w-full aspect-square rounded-lg border-2 border-color/50 bg-tertiary/50 ${clickableClass}`}
                title={titleText}
                onClick={onClick}
            >
                <img src={gradeBackgrounds[item.grade]} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-md" />
                {item.stars > 0 && (
                    <div className={`absolute top-1 right-1.5 text-sm font-bold z-10 ${starInfo.colorClass}`} style={{ textShadow: '1px 1px 2px black' }}>
                        ★{item.stars}
                    </div>
                )}
                {item.image && <img src={item.image} alt={item.name} className="relative w-full h-full object-contain p-1.5"/>}
            </div>
        );
    } else {
         return (
             <img src={emptySlotImages[slot]} alt={`${slot} empty slot`} className="w-full aspect-square rounded-lg bg-tertiary/50 border-2 border-color/50" />
        );
    }
};

const LobbyCard: React.FC<{
    type: 'strategic' | 'playful';
    stats: { wins: number; losses: number };
    onEnter: () => void;
    onViewStats: () => void;
    level: number;
    title: string;
    imageUrl: string;
    tier?: { name: string; icon: string; };
    available: boolean;
    aspectRatio?: string;
    children?: React.ReactNode;
}> = ({ type, stats, onEnter, onViewStats, level, title, imageUrl, tier, available, aspectRatio, children }) => {
    const isStrategic = type === 'strategic';
    const shadowColor = isStrategic ? "hover:shadow-blue-500/30" : "hover:shadow-yellow-500/30";

    const totalGames = stats.wins + stats.losses;
    const winRate = totalGames > 0 ? Math.round((stats.wins / totalGames) * 100) : 0;
    
    const isLongTitle = title.length > 8;

    return (
        <div 
            onClick={available ? onEnter : undefined}
            className={`bg-panel border border-color rounded-lg p-2 flex flex-col text-center transition-all transform hover:-translate-y-1 shadow-lg ${shadowColor} ${!available ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} text-on-panel h-full`}
        >
            {children ? <div className="flex flex-col h-full">{children}</div> : (
                <>
                    <h2 className={`text-sm font-bold flex items-center justify-center gap-1 mb-1 ${isLongTitle ? 'h-12 flex-wrap' : 'h-6'}`}>
                        <span>{title}</span>
                        {tier && <img src={tier.icon} alt={tier.name} className="w-5 h-5" title={tier.name} />}
                        {level > 0 && <span className="text-sm text-highlight font-normal">Lv.{level}</span>}
                    </h2>
                    <div className={`w-full bg-tertiary rounded-md flex items-center justify-center text-tertiary overflow-hidden shadow-inner ${aspectRatio || 'flex-grow'}`}>
                        <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
                    </div>
                    <div 
                        onClick={(e) => { e.stopPropagation(); onViewStats(); }}
                        className="w-full bg-tertiary/50 rounded-md p-1 text-xs flex justify-between items-center cursor-pointer hover:bg-tertiary transition-colors mt-2 flex-shrink-0"
                        title="상세 전적 보기"
                    >
                        <span>총 전적: {stats.wins}승 {stats.losses}패 ({winRate}%)</span>
                        <span className="text-accent font-semibold">&rarr;</span>
                    </div>
                </>
            )}
        </div>
    );
};

const MobileFullWidthCard: React.FC<{
    title: string;
    imageUrl: string;
    onClick: () => void;
    notification?: boolean;
    hoverColorClass: string;
    children?: React.ReactNode;
}> = ({ title, imageUrl, onClick, notification, hoverColorClass, children }) => {
    return (
        <div onClick={onClick} className={`relative bg-panel border border-color rounded-lg p-3 flex flex-col text-center transition-all transform hover:-translate-y-1 shadow-lg ${hoverColorClass} cursor-pointer text-on-panel h-28`}>
            {notification && (
                <div className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-primary z-20"></div>
            )}
            <div className="absolute inset-0 w-full h-full bg-tertiary rounded-lg overflow-hidden">
               <img src={imageUrl} alt={title} className="w-full h-full object-cover rounded-lg" />
            </div>
            <div className="absolute inset-0 w-full h-full bg-gradient-to-t from-black/80 via-black/50 to-transparent rounded-lg"></div>
            <div className="relative z-10 w-full h-full flex flex-col items-center justify-end p-2">
                {children ? children : <h2 className="text-[clamp(1rem,4vw,1.25rem)] font-bold text-white">{title}</h2>}
            </div>
        </div>
    );
};


const Profile: React.FC<ProfileProps> = () => {
    const { currentUserWithStatus, allUsers, handlers, waitingRoomChats, hasClaimableQuest, hasFullMissionReward, guilds, modals } = useAppContext();
    const [detailedStatsType, setDetailedStatsType] = useState<'strategic' | 'playful' | null>(null);
    const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
    const [hasNewMessage, setHasNewMessage] = useState(false);
    
    const defaultPresetSaved = useRef(false);
    useEffect(() => {
        if (currentUserWithStatus && !defaultPresetSaved.current) {
            const presets = currentUserWithStatus.equipmentPresets || [];
            const preset1 = presets[0];
            const hasItemsInPreset1 = preset1 && Object.keys(preset1.equipment).length > 0;
            const hasEquippedItems = Object.keys(currentUserWithStatus.equipment).length > 0;

            if (!hasItemsInPreset1 && hasEquippedItems) {
                handlers.handleAction({ type: 'SAVE_EQUIPMENT_PRESET', payload: { presetIndex: 0 } });
                defaultPresetSaved.current = true;
            } else if (hasItemsInPreset1 || !hasEquippedItems) {
                defaultPresetSaved.current = true;
            }
        }
    }, [currentUserWithStatus, handlers]);
    
    if (!currentUserWithStatus) return null;

    const getTier = (score: number, rank: number, totalPlayers: number) => {
        if (totalPlayers === 0) return RANKING_TIERS[RANKING_TIERS.length - 1];
        for (const tier of RANKING_TIERS) {
            if (tier.threshold(score, rank, totalPlayers)) {
                return tier;
            }
        }
        return RANKING_TIERS[RANKING_TIERS.length - 1];
    };

    const { inventory, stats, nickname, avatarId, borderId } = currentUserWithStatus;
    
    const globalChat = useMemo(() => waitingRoomChats['global'] || [], [waitingRoomChats]);
    const prevChatLength = usePrevious(globalChat.length);
    const hasNotification = hasNewMessage || hasClaimableQuest || hasFullMissionReward;

    useEffect(() => {
        if (!isMobilePanelOpen && prevChatLength !== undefined && globalChat.length > prevChatLength) {
            setHasNewMessage(true);
        }
    }, [globalChat.length, prevChatLength, isMobilePanelOpen]);
    
    const myGuild = useMemo(() => {
        if (!currentUserWithStatus?.guildId) return null;
        return guilds[currentUserWithStatus.guildId];
    }, [currentUserWithStatus?.guildId, guilds]);

    const avatarUrl = useMemo(() => AVATAR_POOL.find(a => a.id === avatarId)?.url, [avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find(b => b.id === borderId)?.url, [borderId]);

    const equippedItems = useMemo(() => {
        return (inventory || []).filter(item => item.isEquipped);
    }, [inventory]);

    const getItemForSlot = (slot: EquipmentSlot) => {
        return equippedItems.find(e => e && e.slot === slot);
    };

    const aggregatedStats = useMemo(() => {
        const strategic = { wins: 0, losses: 0 };
        const playful = { wins: 0, losses: 0 };
        if (stats) {
            for (const mode of SPECIAL_GAME_MODES) {
                const gameStats = stats[mode.mode];
                if (gameStats) {
                    strategic.wins += gameStats.wins;
                    strategic.losses += gameStats.losses;
                }
            }
            for (const mode of PLAYFUL_GAME_MODES) {
                const gameStats = stats[mode.mode];
                if (gameStats) {
                    playful.wins += gameStats.wins;
                    playful.losses += gameStats.losses;
                }
            }
        }
        return { strategic, playful };
    }, [stats]);
    
    const totalMannerScore = getMannerScore(currentUserWithStatus);
    const mannerRank = getMannerRank(totalMannerScore);
    const mannerStyle = getMannerStyle(totalMannerScore);
    
    const totalStats = useMemo(() => calculateTotalStats(currentUserWithStatus, myGuild), [currentUserWithStatus, myGuild]);
    
    const levelPoints = (currentUserWithStatus.strategyLevel - 1) * 2 + (currentUserWithStatus.playfulLevel - 1) * 2;
    const masteryBonus = currentUserWithStatus.mannerMasteryApplied ? 20 : 0;
    const bonusStatPoints = currentUserWithStatus.bonusStatPoints || 0;
    const totalPoints = levelPoints + masteryBonus + bonusStatPoints;

    const spentPoints = useMemo(() => {
        return Object.values(currentUserWithStatus.spentStatPoints || {}).reduce((sum, points) => sum + points, 0);
    }, [currentUserWithStatus.spentStatPoints]);
    const availablePoints = totalPoints - spentPoints;
    
    const onSelectLobby = useCallback((type: 'strategic' | 'playful') => window.location.hash = `#/lobby/${type}`, []);
    const onSelectTournamentLobby = useCallback(() => window.location.hash = '#/tournament', []);
    const onSelectSinglePlayerLobby = useCallback(() => window.location.hash = '#/singleplayer', []);

    const overallTiers = useMemo(() => {
        const getAvgScore = (user: User, modes: typeof SPECIAL_GAME_MODES | typeof PLAYFUL_GAME_MODES) => {
            let totalScore = 0;
            let count = 0;
            for (const mode of modes) {
                const s = user.stats?.[mode.mode];
                if (s) {
                    totalScore += s.rankingScore;
                    count++;
                }
            }
            return count > 0 ? totalScore / count : 1200;
        };

        const strategicScores = allUsers.map(u => ({ id: u.id, score: getAvgScore(u, SPECIAL_GAME_MODES) })).sort((a,b) => b.score - a.score);
        const playfulScores = allUsers.map(u => ({ id: u.id, score: getAvgScore(u, PLAYFUL_GAME_MODES) })).sort((a,b) => b.score - a.score);

        const myStrategicRankIndex = strategicScores.findIndex(u => u.id === currentUserWithStatus.id);
        const myStrategicRank = myStrategicRankIndex !== -1 ? myStrategicRankIndex + 1 : -1;
        const myStrategicScore = myStrategicRankIndex !== -1 ? strategicScores[myStrategicRankIndex].score : 1200;
        
        const myPlayfulRankIndex = playfulScores.findIndex(u => u.id === currentUserWithStatus.id);
        const myPlayfulRank = myPlayfulRankIndex !== -1 ? myPlayfulRankIndex + 1 : -1;
        const myPlayfulScore = myPlayfulRankIndex !== -1 ? playfulScores[myPlayfulRankIndex].score : 1200;

        const strategicTier = getTier(myStrategicScore, myStrategicRank, strategicScores.length);
        const playfulTier = getTier(myPlayfulScore, myPlayfulRank, playfulScores.length);

        return { strategicTier, playfulTier };
    }, [currentUserWithStatus, allUsers]);

    const handleLoadPreset = useCallback((index: number) => {
        if (!currentUserWithStatus) return;
        const presets = currentUserWithStatus.equipmentPresets || [];
        const preset = presets[index] || { name: `프리셋 ${index + 1}` };
        if (window.confirm(`'${preset.name}' 프리셋을 불러오시겠습니까? 현재 장착된 모든 장비가 해제됩니다.`)) {
            handlers.handleAction({ type: 'LOAD_EQUIPMENT_PRESET', payload: { presetIndex: index } });
        }
    }, [handlers, currentUserWithStatus]);

    const EquipmentPanelContent = useMemo(() => (
        <div className="bg-panel border border-color text-on-panel rounded-lg p-2 flex flex-col gap-2 h-full">
            <h3 className="text-center font-semibold text-secondary text-sm">장착 장비</h3>
            <div className="grid grid-cols-3 gap-2">
                {(['fan', 'top', 'bottom', 'board', 'bowl', 'stones'] as EquipmentSlot[]).map(slot => {
                    const item = getItemForSlot(slot);
                    return (
                        <div key={slot} className="w-full">
                            <EquipmentSlotDisplay
                                slot={slot}
                                item={item}
                                onClick={() => item && handlers.openViewingItem(item, true)}
                            />
                        </div>
                    );
                })}
            </div>
            <div className="mt-auto flex flex-col gap-2">
                <Button onClick={handlers.openEquipmentEffectsModal} colorScheme="purple" className="!text-sm !py-1.5">장비 효과</Button>
                <Button onClick={handlers.openPresetModal} colorScheme="blue" className="!text-sm !py-1.5">프리셋 관리</Button>
                <div className="grid grid-cols-5 gap-1">
                    {Array.from({ length: 5 }, (_, i) => (
                        <Button
                            key={i}
                            onClick={() => handleLoadPreset(i)}
                            className="!p-0 aspect-square text-sm font-bold"
                            title={`불러오기: ${currentUserWithStatus.equipmentPresets?.[i]?.name || `프리셋 ${i + 1}`}`}
                        >
                            {i + 1}
                        </Button>
                    ))}
                </div>
            </div>
        </div>
    ), [currentUserWithStatus, handlers, handleLoadPreset, equippedItems]);

    const ProfilePanelContent = useMemo(() => (
        <>
            <div className="flex flex-col sm:flex-row gap-2 items-center">
                <div className="flex-shrink-0 flex flex-col items-center gap-1 w-24">
                    <div className="relative">
                        <Avatar userId={currentUserWithStatus.id} userName={nickname} size={80} avatarUrl={avatarUrl} borderUrl={borderUrl} />
                        <button 
                            onClick={handlers.openProfileEditModal}
                            className="absolute bottom-0 right-0 w-6 h-6 flex items-center justify-center bg-secondary hover:bg-tertiary rounded-full p-1 border-2 border-primary transition-transform hover:scale-110 active:scale-95"
                            title="프로필 수정"
                        >
                            <span className="text-sm">✏️</span>
                        </button>
                    </div>
                    <div className="flex flex-col items-center w-full">
                        <div className="flex items-center gap-1 w-full justify-center">
                            <h2 className="text-base font-bold truncate" title={nickname}>{nickname}</h2>
                        </div>
                         <p className="text-xs text-tertiary mt-0.5">
                            MBTI: {currentUserWithStatus.isMbtiPublic && currentUserWithStatus.mbti ? currentUserWithStatus.mbti : '비공개'}
                        </p>
                    </div>
                </div>
                
                <div className="flex-grow space-y-1 bg-tertiary/30 p-2 rounded-md flex flex-col justify-center w-full">
                    <XpBar level={currentUserWithStatus.strategyLevel} currentXp={currentUserWithStatus.strategyXp} label="전략" colorClass="bg-gradient-to-r from-blue-500 to-cyan-400" />
                    <XpBar level={currentUserWithStatus.playfulLevel} currentXp={currentUserWithStatus.playfulXp} label="놀이" colorClass="bg-gradient-to-r from-yellow-500 to-orange-400" />
                    <div>
                        <div className="flex justify-between items-baseline mb-0.5 text-xs">
                            <span className="font-semibold">매너 등급</span>
                            <span className={`font-semibold text-xs ${mannerRank.color}`}>{totalMannerScore}점 ({mannerRank.rank})</span>
                        </div>
                        <div className="w-full bg-tertiary/50 rounded-full h-2 border border-color">
                            <div className={`${mannerStyle.colorClass} h-full rounded-full`} style={{ width: `${mannerStyle.percentage}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>

            {myGuild && (
                <div className="border-t border-color mt-2 pt-2 flex items-center justify-between gap-2">
                    <a 
                        href="#/guild"
                        className="flex items-center gap-2 cursor-pointer hover:bg-tertiary/50 rounded-md p-1 flex-grow"
                        title={`${myGuild.name} 길드로 이동`}
                    >
                        <img src={myGuild.icon} alt="Guild Icon" className="w-8 h-8 bg-tertiary rounded-md flex-shrink-0" />
                        <div>
                            <h3 className="font-bold text-primary text-base truncate">{myGuild.name}</h3>
                            <p className="text-sm text-tertiary">Lv.{myGuild.level}</p>
                        </div>
                    </a>
                    <Button 
                        onClick={(e?: React.MouseEvent) => { if (e) e.stopPropagation(); handlers.openGuildEffectsModal(); }}
                        colorScheme="gray" 
                        className="!text-xs !py-1 flex-shrink-0"
                        title="길드 효과 보기"
                    >
                        길드효과
                    </Button>
                </div>
            )}
            
            <div className="flex-grow flex flex-col min-h-0 border-t border-color mt-2 pt-2">
                 <div className="flex justify-between items-center mb-1 flex-shrink-0">
                    <h3 className="font-semibold text-secondary text-sm">능력치</h3>
                    <div className="text-xs flex items-center gap-2">
                        <span>보너스: <span className="font-bold text-green-400">{availablePoints}</span>P</span>
                        <Button 
                            onClick={handlers.openStatAllocationModal} 
                            colorScheme="yellow" 
                            className="!text-[10px] !py-0.5"
                        >
                            분배
                        </Button>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {Object.values(CoreStat).map(stat => {
                        const finalValue = totalStats[stat];
                        const baseValue = (currentUserWithStatus.baseStats[stat] || 0) + (currentUserWithStatus.spentStatPoints?.[stat] || 0);
                        const bonus = finalValue - baseValue;
                        return (
                            <div key={stat} className="bg-tertiary/40 p-1 rounded-md flex items-center justify-between text-xs">
                                <span className="font-semibold text-secondary">{stat}</span>
                                <span className="font-mono font-bold" title={`기본+분배: ${baseValue}, 장비+효과: ${bonus}`}>
                                    {finalValue}
                                    {bonus > 0 && <span className="text-green-400 text-xs ml-0.5">(+{bonus})</span>}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    ), [currentUserWithStatus, handlers, mannerRank, mannerStyle, totalMannerScore, availablePoints, myGuild, avatarUrl, borderUrl, nickname, totalStats]);

    const leagueInfo = LEAGUE_DATA.find(l => l.tier === currentUserWithStatus.league);
    const dailyChampionshipMatchesPlayed = (currentUserWithStatus && !isDifferentDayKST(currentUserWithStatus.lastChampionshipMatchDate, Date.now()))
        ? currentUserWithStatus.dailyChampionshipMatchesPlayed ?? 0
        : 0;
    const TOTAL_DAILY_MATCHES = 3;
    const singlePlayerProgress = currentUserWithStatus.singlePlayerProgress || 0;
    const totalSinglePlayerStages = SINGLE_PLAYER_STAGES.length;
    const highestFloor = currentUserWithStatus.towerProgress?.highestFloor || 0;
    const now = new Date();
    const kstNow = getKSTDate(now);
    const nextMonth = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth() + 1, 1));
    const diff = nextMonth.getTime() - kstNow.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const timeLeftInSeason = `${days}일 ${hours}시간 남음`;

    return (
        <div className="bg-primary text-primary p-2 sm:p-4 lg:p-2 max-w-screen-2xl mx-auto w-full h-full flex flex-col">
            {modals.isEquipmentEffectsModalOpen && <EquipmentEffectsModal user={currentUserWithStatus} guild={myGuild} onClose={handlers.closeEquipmentEffectsModal} />}
            {modals.isPresetModalOpen && <PresetModal user={currentUserWithStatus} onAction={handlers.handleAction} onClose={handlers.closePresetModal} />}
            <header className="flex justify-between items-center mb-2 px-2 flex-shrink-0">
                <h1 className="text-2xl font-bold text-primary">홈</h1>
                <div className="flex items-center gap-2">
                    <button onClick={handlers.openEncyclopedia} className="w-8 h-8 flex items-center justify-center bg-purple-600 hover:bg-purple-500 rounded-full text-white font-bold text-lg flex-shrink-0 transition-transform hover:scale-110" title="도감">
                        <img src="/images/item/itembook.png" alt="도감" className="w-5 h-5"/>
                    </button>
                    <button onClick={handlers.openInfoModal} className="w-8 h-8 flex items-center justify-center bg-gray-600 hover:bg-gray-500 rounded-full text-white font-bold text-lg flex-shrink-0 transition-transform hover:scale-110" title="도움말">?</button>
                </div>
            </header>
            <main className="flex-1 flex flex-col min-h-0">
                {/* --- DESKTOP LAYOUT --- */}
                <div className="hidden lg:flex flex-col h-full gap-2">
                    <div className="flex flex-row gap-2 h-[45%]">
                        <div className="lg:w-[380px] xl:w-[420px] flex-shrink-0 flex flex-col">
                           <div className="bg-panel border border-color text-on-panel rounded-lg p-2 flex flex-col gap-1 h-full">
                                {ProfilePanelContent}
                           </div>
                        </div>
                         <div className="flex-1 flex flex-row gap-2 min-w-0">
                             <div className="w-[280px] flex-shrink-0 h-full">{EquipmentPanelContent}</div>
                             <div className="flex-1 bg-panel border border-color text-on-panel rounded-lg min-h-0 flex flex-col">
                                <RankingBoard allUsers={allUsers} currentUser={currentUserWithStatus!} guilds={guilds} />
                             </div>
                        </div>
                        <div className="w-24 flex-shrink-0">
                           <QuickAccessSidebar compact={true} fillHeight={true} />
                        </div>
                    </div>
                    <div className="flex-1 flex flex-row gap-2 min-h-0">
                        <div className="w-full lg:w-[30%] flex-shrink-0 bg-panel border border-color text-on-panel rounded-lg min-h-0 flex flex-col">
                            <ChatWindow messages={globalChat} mode="global" onAction={handlers.handleAction} onViewUser={handlers.openViewingUser} locationPrefix="[홈]" />
                        </div>
                        <div className="flex-1 min-h-0 flex flex-col">
                            <div className="grid grid-cols-6 grid-rows-4 gap-4 h-full">
                                <div className="col-span-2 row-span-2"><LobbyCard type="strategic" stats={aggregatedStats.strategic} onEnter={() => onSelectLobby('strategic')} onViewStats={() => setDetailedStatsType('strategic')} level={currentUserWithStatus.strategyLevel} title="전략 바둑" imageUrl={STRATEGIC_GO_LOBBY_IMG} tier={overallTiers.strategicTier} available={true} /></div>
                                <div className="col-span-2 row-span-2"><LobbyCard type="playful" stats={aggregatedStats.playful} onEnter={() => onSelectLobby('playful')} onViewStats={() => setDetailedStatsType('playful')} level={currentUserWithStatus.playfulLevel} title="놀이 바둑" imageUrl={PLAYFUL_GO_LOBBY_IMG} tier={overallTiers.playfulTier} available={true} /></div>
                                <div className="col-span-2 row-span-2"><LobbyCard type="playful" stats={{wins:0, losses:0}} onEnter={onSelectTournamentLobby} onViewStats={() => {}} level={0} title="챔피언십(자동대국)" imageUrl={TOURNAMENT_LOBBY_IMG} available={true}><h2 className="text-base font-bold flex items-center justify-center gap-1 h-6 mb-1">챔피언십(자동대국) {leagueInfo && <img src={leagueInfo.icon} alt={leagueInfo.name} className="w-4 h-4" title={leagueInfo.name} />}</h2><div className="w-full bg-tertiary rounded-md flex items-center justify-center text-tertiary overflow-hidden shadow-inner flex-grow"><img src={TOURNAMENT_LOBBY_IMG} alt="챔피언십(자동대국)" className="w-full h-full object-cover" /></div><div className="w-full bg-tertiary/50 rounded-md p-1 text-[10px] flex justify-center items-center mt-1 flex-shrink-0"><span className="font-semibold">남은 경기: {TOTAL_DAILY_MATCHES - dailyChampionshipMatchesPlayed}/{TOTAL_DAILY_MATCHES}</span></div></LobbyCard></div>
                                <div className="col-span-3 row-span-2">
                                    <div 
                                        onClick={onSelectSinglePlayerLobby}
                                        className="relative bg-panel border border-color rounded-lg flex flex-col text-center transition-all transform hover:-translate-y-1 shadow-lg hover:shadow-green-500/30 cursor-pointer text-on-panel h-full overflow-hidden"
                                    >
                                        {hasFullMissionReward && (
                                            <div className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-primary z-20"></div>
                                        )}
                                        <img src={SINGLE_PLAYER_LOBBY_IMG} alt="싱글플레이" className="absolute inset-0 w-full h-full object-cover" />
                                        <div className="absolute inset-0 w-full h-full bg-gradient-to-t from-black/80 via-black/50 to-transparent"></div>
                                        <div className="relative z-10 w-full h-full flex flex-col items-center p-4">
                                            <h2 className="text-xl font-bold text-white">싱글플레이</h2>
                                            <div className="w-full mt-auto">
                                                <div className="flex justify-between text-xs font-semibold text-white/80 mb-1">
                                                    <span>진행도</span>
                                                    <span>{singlePlayerProgress}/{totalSinglePlayerStages}</span>
                                                </div>
                                                <div className="w-full bg-white/20 rounded-full h-2.5">
                                                    <div className="bg-gradient-to-r from-green-400 to-green-600 h-2.5 rounded-full" style={{ width: `${(singlePlayerProgress / totalSinglePlayerStages) * 100}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-span-3 row-span-2">
                                    <div
                                        onClick={() => window.location.hash = '#/towerchallenge'}
                                        className="relative bg-panel border border-color rounded-lg flex flex-col text-center transition-all transform hover:-translate-y-1 shadow-lg hover:shadow-red-500/30 cursor-pointer text-on-panel h-full overflow-hidden"
                                    >
                                        <img src={TOWER_CHALLENGE_LOBBY_IMG} alt="도전의 탑" className="absolute inset-0 w-full h-full object-cover" />
                                        <div className="absolute inset-0 w-full h-full bg-gradient-to-t from-black/80 via-black/50 to-transparent"></div>
                                        <div className="relative z-10 w-full h-full flex flex-col items-center p-4">
                                            <h2 className="text-xl font-bold text-white">도전의 탑</h2>
                                            <div className="mt-auto w-full text-right text-sm font-semibold text-white/90">
                                                <p>최고: {highestFloor}층</p>
                                                <p className="text-xs">{timeLeftInSeason}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- MOBILE & TABLET LAYOUT --- */}
                <div className="lg:hidden flex flex-col flex-1 min-h-0 gap-2 relative p-2">
                    <div className="flex flex-row gap-2 items-stretch">
                        <div className="flex-1 bg-panel border border-color text-on-panel rounded-lg p-2 flex flex-col gap-1">
                            {ProfilePanelContent}
                        </div>
                        <div className="w-20 flex-shrink-0">
                            <QuickAccessSidebar mobile={false} compact={true} fillHeight={true} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                       {EquipmentPanelContent}
                       <RankingBoard allUsers={allUsers} currentUser={currentUserWithStatus!} guilds={guilds} />
                    </div>
                    
                    <div className="flex flex-col gap-2 mt-2">
                        <div className="grid grid-cols-3 gap-2">
                            <LobbyCard type="strategic" stats={aggregatedStats.strategic} onEnter={() => onSelectLobby('strategic')} onViewStats={() => setDetailedStatsType('strategic')} level={currentUserWithStatus.strategyLevel} title="전략 바둑" imageUrl={STRATEGIC_GO_LOBBY_IMG} tier={overallTiers.strategicTier} available={true} />
                            <LobbyCard type="playful" stats={aggregatedStats.playful} onEnter={() => onSelectLobby('playful')} onViewStats={() => setDetailedStatsType('playful')} level={currentUserWithStatus.playfulLevel} title="놀이 바둑" imageUrl={PLAYFUL_GO_LOBBY_IMG} tier={overallTiers.playfulTier} available={true} />
                            <LobbyCard type="playful" stats={{wins:0, losses:0}} onEnter={onSelectTournamentLobby} onViewStats={() => {}} level={0} title="챔피언십(자동대국)" imageUrl={TOURNAMENT_LOBBY_IMG} available={true} />
                        </div>
                        
                        <MobileFullWidthCard 
                            title="싱글플레이" 
                            imageUrl={SINGLE_PLAYER_LOBBY_IMG} 
                            onClick={onSelectSinglePlayerLobby} 
                            notification={hasFullMissionReward} 
                            hoverColorClass="hover:shadow-green-500/30"
                        />

                        <MobileFullWidthCard 
                            title="도전의 탑" 
                            imageUrl={TOWER_CHALLENGE_LOBBY_IMG} 
                            onClick={() => window.location.hash = '#/towerchallenge'} 
                            hoverColorClass="hover:shadow-red-500/30"
                        />
                    </div>

                    <div className="absolute top-1/2 -translate-y-1/2 right-0 z-20">
                        <button onClick={() => { setIsMobilePanelOpen(true); setHasNewMessage(false); }} className="w-8 h-12 bg-secondary/80 backdrop-blur-sm rounded-l-lg flex items-center justify-center text-primary shadow-lg" aria-label="정보 패널 열기">
                            <span className="relative font-bold text-lg"> {'<'} {hasNotification && <div className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-secondary"></div>} </span>
                        </button>
                    </div>

                    <div className={`fixed top-0 right-0 h-full w-[280px] bg-primary shadow-2xl z-50 transition-transform duration-300 ease-in-out ${isMobilePanelOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
                        <div className="flex justify-between items-center p-2 border-b border-color flex-shrink-0">
                            <h3 className="text-lg font-bold">정보</h3>
                            <button onClick={() => setIsMobilePanelOpen(false)} className="text-2xl font-bold text-tertiary hover:text-primary">&times;</button>
                        </div>
                        <div className="flex-1 flex flex-col min-h-0">
                            <div className="h-full min-h-0 bg-panel"><ChatWindow messages={globalChat} mode="global" onAction={handlers.handleAction} onViewUser={handlers.openViewingUser} locationPrefix="[홈]" /></div>
                        </div>
                    </div>
                    {isMobilePanelOpen && <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setIsMobilePanelOpen(false)}></div>}
                </div>
            </main>
            {detailedStatsType && (
                <DetailedStatsModal
                    currentUser={currentUserWithStatus}
                    statsType={detailedStatsType}
                    onClose={() => setDetailedStatsType(null)}
                    onAction={handlers.handleAction}
                />
            )}
        </div>
    );
};

export default Profile;