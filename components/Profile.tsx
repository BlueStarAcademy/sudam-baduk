import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { UserWithStatus, GameMode, EquipmentSlot, InventoryItem, ItemGrade, ServerAction, LeagueTier, CoreStat, SpecialStat, MythicStat, ItemOptionType, TournamentState, User, Guild, EquipmentPreset } from '../types';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, AVATAR_POOL, BORDER_POOL, LEAGUE_DATA, CORE_STATS_DATA, SPECIAL_STATS_DATA, MYTHIC_STATS_DATA, emptySlotImages, TOURNAMENT_DEFINITIONS, GRADE_LEVEL_REQUIREMENTS, RANKING_TIERS, SINGLE_PLAYER_STAGES } from '../constants';
import { STRATEGIC_GO_LOBBY_IMG, PLAYFUL_GO_LOBBY_IMG, TOURNAMENT_LOBBY_IMG, SINGLE_PLAYER_LOBBY_IMG, TOWER_CHALLENGE_LOBBY_IMG } from '../assets';
import Avatar from './Avatar';
import Button from './Button';
import DetailedStatsModal from './DetailedStatsModal';
import { getMannerScore, getMannerRank, getMannerStyle } from '../utils/mannerUtils';
import { calculateUserEffects, calculateTotalStats } from '../utils/statUtils';
import { useAppContext } from '../hooks/useAppContext';
// FIX: Import QuickAccessSidebar component to resolve module resolution error.
import QuickAccessSidebar from './QuickAccessSidebar';
import ChatWindow from "./waiting-room/ChatWindow";
import EquipmentEffectsModal from "./EquipmentEffectsModal";
import PresetModal from "./PresetModal";
import RankingBoard from "./profile/RankingBoard";
import { isDifferentDayKST, getKSTDate } from '../utils/timeUtils';
import NineSlicePanel from './ui/NineSlicePanel';
import { gradeStyles } from '../utils/itemDisplayUtils';

const getStarDisplayInfo = (stars: number): { text: string; colorClass: string; starImage: string; numberColor: string; } => {
    if (stars >= 10) {
        return { text: `(★${stars})`, colorClass: "prism-text-effect", starImage: '/images/star-rainbow.png', numberColor: 'text-white' };
    } else if (stars >= 7) {
        return { text: `(★${stars})`, colorClass: "text-blue-400", starImage: '/images/star-blue.png', numberColor: 'text-blue-300' };
    } else if (stars >= 4) {
        return { text: `(★${stars})`, colorClass: "text-amber-400", starImage: '/images/star-gold.png', numberColor: 'text-yellow-300' };
    } else if (stars >= 1) {
        return { text: `(★${stars})`, colorClass: "text-white", starImage: '/images/star-white.png', numberColor: 'text-white' };
    }
    return { text: "", colorClass: "text-white", starImage: '', numberColor: '' };
};

const renderStarDisplay = (stars: number) => {
    if (stars === 0) return null;
    const starInfo = getStarDisplayInfo(stars);
    
    return (
        <div className="absolute top-0.5 left-0.5 flex items-center gap-0.5 bg-black/40 rounded-br-md px-1 py-0.5 z-10" style={{ textShadow: '1px 1px 2px black' }}>
            <img src={starInfo.starImage} alt="star" className="w-3 h-3" />
            <span className={`font-bold text-xs leading-none ${starInfo.numberColor}`}>{stars}</span>
        </div>
    );
};

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
                <img src={gradeStyles[item.grade].background} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-md" />
                {renderStarDisplay(item.stars)}
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
            className={`bg-panel text-on-panel rounded-lg p-2 flex flex-col text-center transition-all transform hover:-translate-y-1 shadow-lg ${shadowColor} ${!available ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} h-48 panel-glow`}
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

const Profile: React.FC<ProfileProps> = () => {
    const { currentUserWithStatus, allUsers, handlers, waitingRoomChats, hasClaimableQuest, hasFullMissionReward, guilds, modals, isMobile } = useAppContext();
    const [detailedStatsType, setDetailedStatsType] = useState<'strategic' | 'playful' | null>(null);
    const defaultPresetSaved = useRef(false);
    
    const [isRankingPanelOpen, setIsRankingPanelOpen] = useState(false);
    const [activeMobileTab, setActiveMobileTab] = useState<'profile' | 'equipment' | 'chat'>('profile');
    
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

    const { inventory, stats, nickname, avatarId, borderId } = currentUserWithStatus;
    
    const globalChat = useMemo(() => waitingRoomChats['global'] || [], [waitingRoomChats]);
    
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

        const getTier = (score: number, rank: number, totalPlayers: number) => {
            if (totalPlayers === 0) return RANKING_TIERS[RANKING_TIERS.length - 1];
            for (const tier of RANKING_TIERS) {
                if (tier.threshold(score, rank, totalPlayers)) {
                    return tier;
                }
            }
            return RANKING_TIERS[RANKING_TIERS.length - 1];
        };

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

    const presets = useMemo(() => {
        const userPresets = currentUserWithStatus.equipmentPresets || [];
        return Array(5).fill(null).map((_, i) => 
            userPresets[i] || { name: `프리셋 ${i + 1}`, equipment: {} }
        );
    }, [currentUserWithStatus.equipmentPresets]);

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
                            {!currentUserWithStatus.mbti && <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></div>}
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
                    {/* FIX: Corrected typo from openEquipmentEffectsModal to openGuildEffectsModal */}
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
                             <div key={stat} className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-secondary truncate mr-2">{stat}</span>
                                <span className="font-mono font-bold truncate" title={`기본+분배: ${baseValue}, 장비+효과: ${bonus}`}>
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

    const EquipmentPanelContent = useMemo(() => (
        <NineSlicePanel className="flex flex-col gap-2 h-full">
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
                <select
                    onChange={(e) => {
                        const index = parseInt(e.target.value, 10);
                        if (!isNaN(index)) {
                            handleLoadPreset(index);
                        }
                        e.target.value = "";
                    }}
                    className="w-full bg-secondary border border-color text-primary rounded-md p-1.5 text-sm text-center"
                    defaultValue=""
                >
                    <option value="" disabled>프리셋 불러오기</option>
                    {presets.map((preset, index) => (
                        <option key={index} value={index}>
                            {preset.name}
                        </option>
                    ))}
                </select>
            </div>
        </NineSlicePanel>
    ), [currentUserWithStatus, handlers, handleLoadPreset, equippedItems, presets]);

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

    if (!isMobile) {
        return (
            <div className="p-2 sm:p-4 lg:p-2 max-w-screen-2xl mx-auto w-full h-full flex flex-col">
                <header className="flex justify-between items-center mb-2 px-2 flex-shrink-0">
                    <h1 className="text-2xl font-bold text-primary">홈</h1>
                    <div className="flex items-center gap-2">
                        <button onClick={handlers.openEncyclopedia} className="w-8 h-8 flex items-center justify-center bg-purple-600 hover:bg-purple-500 rounded-full text-white font-bold text-lg flex-shrink-0 transition-transform hover:scale-110" title="도감">
                            <img src="/images/item/itembook.png" alt="도감" className="w-5 h-5"/>
                        </button>
                        {/* FIX: Corrected call to handlers.openInfoModal */}
                                                <button onClick={handlers.openInfoModal} className="w-8 h-8 flex items-center justify-center bg-gray-600 hover:bg-gray-500 rounded-full text-white font-bold text-lg flex-shrink-0 transition-transform hover:scale-110" title="도움말">
                            <img src="/images/button/help.png" alt="도움말" className="h-5" />
                        </button>
                    </div>
                </header>
                <main className="flex-1 flex flex-col min-h-0">
                    <div className="hidden lg:flex flex-col h-full gap-2">
                        <div className="flex flex-row gap-2 h-[45%]">
                            <div className="lg:w-[380px] xl:w-[420px] flex-shrink-0 flex flex-col">
                               <NineSlicePanel className="flex flex-col gap-1 h-full">
                                    {ProfilePanelContent}
                               </NineSlicePanel>
                            </div>
                             <div className="flex-1 flex flex-row gap-2 min-w-0">
                                 <div className="w-[280px] flex-shrink-0 h-full">{EquipmentPanelContent}</div>
                                 <NineSlicePanel className="flex-1 min-h-0 flex flex-col">
                                    <RankingBoard allUsers={allUsers} currentUser={currentUserWithStatus!} guilds={guilds} />
                                 </NineSlicePanel>
                            </div>
                            <div className="w-24 flex-shrink-0">
                               <QuickAccessSidebar compact={true} fillHeight={true} />
                            </div>
                        </div>
                        <div className="flex-1 flex flex-row gap-2 min-h-0">
                            <NineSlicePanel className="w-full lg:w-[30%] flex-shrink-0 min-h-0 flex flex-col">
                                <ChatWindow messages={globalChat} mode="global" onViewUser={handlers.openViewingUser} locationPrefix="[홈]" />
                            </NineSlicePanel>
                            <div className="flex-1 min-h-0 flex flex-col">
                                <div className="grid grid-cols-6 grid-rows-4 gap-4 h-full">
                                    <div className="col-span-2 row-span-2"><LobbyCard type="strategic" stats={aggregatedStats.strategic} onEnter={() => onSelectLobby('strategic')} onViewStats={() => setDetailedStatsType('strategic')} level={currentUserWithStatus.strategyLevel} title="전략 바둑" imageUrl={STRATEGIC_GO_LOBBY_IMG} tier={overallTiers.strategicTier} available={true} /></div>
                                    <div className="col-span-2 row-span-2"><LobbyCard type="playful" stats={aggregatedStats.playful} onEnter={() => onSelectLobby('playful')} onViewStats={() => setDetailedStatsType('playful')} level={currentUserWithStatus.playfulLevel} title="놀이 바둑" imageUrl={PLAYFUL_GO_LOBBY_IMG} tier={overallTiers.playfulTier} available={true} /></div>
                                    <div className="col-span-2 row-span-2"><LobbyCard type="playful" stats={{wins:0, losses:0}} onEnter={onSelectTournamentLobby} onViewStats={() => {}} level={0} title="챔피언십(자동대국)" imageUrl={TOURNAMENT_LOBBY_IMG} available={true}><h2 className="text-base font-bold flex items-center justify-center gap-1 h-6 mb-1">챔피언십(자동대국) {leagueInfo && <img src={leagueInfo.icon} alt={leagueInfo.name} className="w-4 h-4" title={leagueInfo.name} />}</h2><div className="w-full bg-tertiary rounded-md flex items-center justify-center text-tertiary overflow-hidden shadow-inner flex-grow"><img src={TOURNAMENT_LOBBY_IMG} alt="챔피언십(자동대국)" className="w-full h-full object-cover" /></div><div className="w-full bg-tertiary/50 rounded-md p-1 text-[10px] flex justify-center items-center mt-1 flex-shrink-0"><span className="font-semibold">남은 경기: {TOTAL_DAILY_MATCHES - dailyChampionshipMatchesPlayed}/{TOTAL_DAILY_MATCHES}</span></div></LobbyCard></div>
                                    <div className="col-span-3 row-span-2">
                                        <div 
                                            onClick={onSelectSinglePlayerLobby}
                                            className="relative bg-panel panel-glow rounded-lg flex flex-col text-center transition-all transform hover:-translate-y-1 shadow-lg hover:shadow-green-500/30 cursor-pointer text-on-panel h-full overflow-hidden"
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
                                            className="relative bg-panel panel-glow rounded-lg flex flex-col text-center transition-all transform hover:-translate-y-1 shadow-lg hover:shadow-red-500/30 cursor-pointer text-on-panel h-full overflow-hidden"
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
    }
    
    // --- NEW MOBILE LAYOUT ---
    const hasNotification = hasClaimableQuest || hasFullMissionReward;

    return (
        <div className="lg:hidden flex flex-col h-full w-full overflow-hidden bg-primary text-primary pb-[60px]">
            {/* Ranking Panel (Left Side) */}
            <div className={`fixed top-0 left-0 bottom-0 z-50 transition-transform duration-300 ease-in-out ${isRankingPanelOpen ? 'translate-x-0' : '-translate-x-full'} w-4/5 max-w-sm bg-primary border-r-2 border-color shadow-2xl`}>
                <div className="flex flex-col h-full">
                    <div className="flex justify-between items-center p-2 border-b border-color flex-shrink-0">
                        <h2 className="text-xl font-bold">랭킹</h2>
                        <Button onClick={() => setIsRankingPanelOpen(false)} className="!p-2">&gt;</Button>
                    </div>
                    <div className="flex-1 min-h-0">
                        <RankingBoard allUsers={allUsers} currentUser={currentUserWithStatus} guilds={guilds} layout="vertical" />
                    </div>
                </div>
            </div>
            {isRankingPanelOpen && <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setIsRankingPanelOpen(false)}></div>}
            
            {/* Main Content Area */}
            <main className="flex-1 min-h-0 flex flex-col gap-2 relative">
                <button 
                    onClick={() => setIsRankingPanelOpen(true)} 
                    className="fixed top-1/2 -translate-y-1/2 left-0 z-20 w-8 h-12 bg-secondary/80 backdrop-blur-sm rounded-r-lg flex items-center justify-center text-primary shadow-lg"
                    aria-label="랭킹 패널 열기"
                >
                    <img src="/images/button/back.png" alt="뒤로가기" className="h-6" />
                </button>

                <div className="flex-shrink-0">
                    <div className="flex overflow-x-auto gap-3 pb-2 -mx-2 px-2">
                        <div className="w-40 flex-shrink-0"><LobbyCard type="strategic" stats={aggregatedStats.strategic} onEnter={() => onSelectLobby('strategic')} onViewStats={() => setDetailedStatsType('strategic')} level={currentUserWithStatus.strategyLevel} title="전략 바둑" imageUrl={STRATEGIC_GO_LOBBY_IMG} tier={overallTiers.strategicTier} available={true} /></div>
                        <div className="w-40 flex-shrink-0"><LobbyCard type="playful" stats={aggregatedStats.playful} onEnter={() => onSelectLobby('playful')} onViewStats={() => setDetailedStatsType('playful')} level={currentUserWithStatus.playfulLevel} title="놀이 바둑" imageUrl={PLAYFUL_GO_LOBBY_IMG} tier={overallTiers.playfulTier} available={true} /></div>
                        <div className="w-40 flex-shrink-0"><LobbyCard type="playful" stats={{wins:0, losses:0}} onEnter={onSelectTournamentLobby} onViewStats={() => {}} level={0} title="챔피언십" imageUrl={TOURNAMENT_LOBBY_IMG} available={true}><h2 className="text-base font-bold flex items-center justify-center gap-1 h-6 mb-1">챔피언십 {leagueInfo && <img src={leagueInfo.icon} alt={leagueInfo.name} className="w-4 h-4" title={leagueInfo.name} />}</h2><div className="w-full bg-tertiary rounded-md flex items-center justify-center text-tertiary overflow-hidden shadow-inner flex-grow"><img src={TOURNAMENT_LOBBY_IMG} alt="챔피언십" className="w-full h-full object-cover" /></div><div className="w-full bg-tertiary/50 rounded-md p-1 text-[10px] flex justify-center items-center mt-1 flex-shrink-0"><span className="font-semibold">남은 경기: {TOTAL_DAILY_MATCHES - dailyChampionshipMatchesPlayed}/{TOTAL_DAILY_MATCHES}</span></div></LobbyCard></div>
                        <div className="w-40 flex-shrink-0"><LobbyCard type="strategic" stats={{wins:0, losses:0}} onEnter={onSelectSinglePlayerLobby} onViewStats={() => {}} level={0} title="싱글플레이" imageUrl={SINGLE_PLAYER_LOBBY_IMG} available={true}><h2 className="text-base font-bold h-6 mb-1">싱글플레이</h2><div className="w-full bg-tertiary rounded-md flex items-center justify-center text-tertiary overflow-hidden shadow-inner flex-grow"><img src={SINGLE_PLAYER_LOBBY_IMG} alt="싱글플레이" className="w-full h-full object-cover" /></div></LobbyCard></div>
                        <div className="w-40 flex-shrink-0"><LobbyCard type="strategic" stats={{wins:0, losses:0}} onEnter={() => window.location.hash = '#/towerchallenge'} onViewStats={() => {}} level={0} title="도전의 탑" imageUrl={TOWER_CHALLENGE_LOBBY_IMG} available={true}><h2 className="text-base font-bold h-6 mb-1">도전의 탑</h2><div className="w-full bg-tertiary rounded-md flex items-center justify-center text-tertiary overflow-hidden shadow-inner flex-grow"><img src={TOWER_CHALLENGE_LOBBY_IMG} alt="도전의 탑" className="w-full h-full object-cover" /></div></LobbyCard></div>
                    </div>
                </div>

                <div className="flex-shrink-0 flex bg-tertiary/70 p-1 rounded-lg">
                    <button onClick={() => setActiveMobileTab('profile')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${activeMobileTab === 'profile' ? 'bg-accent' : 'text-tertiary hover:bg-secondary/50'}`}>프로필</button>
                    <button onClick={() => setActiveMobileTab('equipment')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${activeMobileTab === 'equipment' ? 'bg-accent' : 'text-tertiary hover:bg-secondary/50'}`}>장비</button>
                    <button onClick={() => setActiveMobileTab('chat')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all relative ${activeMobileTab === 'chat' ? 'bg-accent' : 'text-tertiary hover:bg-secondary/50'}`}>
                        채팅
                        {hasNotification && <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border-2 border-primary"></div>}
                    </button>
                </div>

                <NineSlicePanel className="flex-1 min-h-0 overflow-y-auto p-2">
                    {activeMobileTab === 'profile' && ProfilePanelContent}
                    {activeMobileTab === 'equipment' && EquipmentPanelContent}
                    {activeMobileTab === 'chat' && (
                        <div className="h-full flex flex-col">
                            <ChatWindow messages={globalChat} mode="global" onViewUser={handlers.openViewingUser} locationPrefix="[홈]" />
                        </div>
                    )}
                </NineSlicePanel>
            </main>

            <footer className="fixed bottom-0 left-0 right-0 bg-primary border-t border-color p-1 z-30">
                <QuickAccessSidebar mobile={true} />
            </footer>

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