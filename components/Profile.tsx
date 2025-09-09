import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { UserWithStatus, GameMode, EquipmentSlot, InventoryItem, ItemGrade, ServerAction, LeagueTier, CoreStat, SpecialStat, MythicStat, ItemOptionType, TournamentState, User } from '../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, AVATAR_POOL, BORDER_POOL, LEAGUE_DATA, CORE_STATS_DATA, SPECIAL_STATS_DATA, MYTHIC_STATS_DATA, emptySlotImages, TOURNAMENT_DEFINITIONS, GRADE_LEVEL_REQUIREMENTS, RANKING_TIERS, SINGLE_PLAYER_STAGES } from '../constants.js';
import { STRATEGIC_GO_LOBBY_IMG, PLAYFUL_GO_LOBBY_IMG, TOURNAMENT_LOBBY_IMG, SINGLE_PLAYER_LOBBY_IMG, TOWER_CHALLENGE_LOBBY_IMG } from '../assets.js';
import Avatar from './Avatar.js';
import Button from './Button.js';
import DetailedStatsModal from './DetailedStatsModal.js';
import DraggableWindow from './DraggableWindow.js';
import ProfileEditModal from './ProfileEditModal.js';
import { getMannerScore, getMannerRank, getMannerStyle } from '../services/manner.js';
import { calculateUserEffects } from '../services/effectService.js';
import { useAppContext } from '../hooks/useAppContext.js';
import QuickAccessSidebar from './QuickAccessSidebar.js';
import ChatWindow from './waiting-room/ChatWindow.js';

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
    const maxXp = 1000 + (level - 1) * 200;
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
}> = ({ type, stats, onEnter, onViewStats, level, title, imageUrl, tier }) => {
    const isStrategic = type === 'strategic';
    const shadowColor = isStrategic ? "hover:shadow-blue-500/30" : "hover:shadow-yellow-500/30";

    const totalGames = stats.wins + stats.losses;
    const winRate = totalGames > 0 ? Math.round((stats.wins / totalGames) * 100) : 0;

    return (
        <div 
            onClick={onEnter}
            className={`bg-panel border border-color rounded-lg p-2 flex flex-col text-center transition-all transform hover:-translate-y-1 shadow-lg ${shadowColor} cursor-pointer h-full text-on-panel`}
        >
             <h2 className="text-base font-bold flex items-center justify-center gap-1 h-6 mb-1">
                {title} 
                {tier && <img src={tier.icon} alt={tier.name} className="w-5 h-5" title={tier.name} />}
                <span className="text-sm text-highlight font-normal">Lv.{level}</span>
            </h2>
            <div className="w-full flex-1 bg-tertiary rounded-md flex items-center justify-center text-tertiary overflow-hidden">
                <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
            </div>
            <div 
                onClick={(e) => { e.stopPropagation(); onViewStats(); }}
                className="w-full bg-tertiary/50 rounded-md p-1 text-xs flex justify-between items-center cursor-pointer hover:bg-tertiary transition-colors mt-2"
                title="상세 전적 보기"
            >
                <span>총 전적: {stats.wins}승 {stats.losses}패 ({winRate}%)</span>
                <span className="text-accent font-semibold">&rarr;</span>
            </div>
        </div>
    );
};

const PveCard: React.FC<{ title: string; imageUrl: string; layout: 'grid' | 'tall'; footerContent?: React.ReactNode; }> = ({ title, imageUrl, layout, footerContent }) => {
    const isTall = layout === 'tall';
    return (
        <div className={`bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-purple-500/50 rounded-lg p-2 flex flex-col text-center shadow-lg shadow-purple-500/20 h-full text-on-panel relative overflow-hidden cursor-not-allowed group`}>
            <div className="absolute top-2 -right-10 transform rotate-45 bg-purple-600 text-white text-[10px] font-bold px-10 py-0.5 z-10">
                Coming Soon
            </div>
            <h2 className="text-base font-bold text-purple-300 mt-1 h-6 mb-1">{title}</h2>
            <div className={`w-full rounded-md flex-1 items-center justify-center text-tertiary overflow-hidden transition-transform duration-300 group-hover:scale-105 bg-black/20`}>
                <img src={imageUrl} alt={title} className={`w-full h-full rounded-md p-2 ${isTall ? 'object-contain' : 'object-cover'}`} />
            </div>
            {footerContent && (
                <div className="w-full bg-tertiary/50 rounded-md p-1 text-xs mt-2">
                    {footerContent}
                </div>
            )}
        </div>
    );
};

const formatMythicStat = (stat: MythicStat, data: { count: number, totalValue: number }): React.ReactNode => {
    const baseDescription = MYTHIC_STATS_DATA[stat].description;

    switch (stat) {
        case MythicStat.StrategicGoldBonus:
        case MythicStat.PlayfulGoldBonus: {
            const newPercentage = 20 * data.count;
            return <span className="w-full">{baseDescription.replace(/20%/, `${newPercentage}%`)}</span>;
        }
        case MythicStat.MannerActionCooldown: {
             return (
                <div className="flex justify-between items-center w-full">
                    <span>{baseDescription}</span>
                    <span className="font-mono font-semibold">+{data.totalValue}</span>
                </div>
            );
        }
        case MythicStat.DiceGoOddBonus:
        case MythicStat.AlkkagiSlowBonus:
        case MythicStat.AlkkagiAimingBonus: {
            return <span className="w-full">{baseDescription.replace(/1개/g, `${data.totalValue}개`)}</span>;
        }
        default:
            return <span className="w-full">{baseDescription}</span>;
    }
};

const getTier = (rank: number, totalPlayers: number) => {
    if (totalPlayers === 0) return RANKING_TIERS[RANKING_TIERS.length - 1];
    for (const tier of RANKING_TIERS) {
        if (tier.threshold(rank, totalPlayers)) {
            return tier;
        }
    }
    return RANKING_TIERS[RANKING_TIERS.length - 1];
};

const StatSummaryPanel: React.FC<{ title: string; color: string; children: React.ReactNode }> = ({ title, color, children }) => {
    const childrenArray = React.Children.toArray(children).filter(Boolean); // Filter out null/undefined children
    return (
        <div className="flex-1 bg-tertiary/30 p-2 rounded-md flex flex-col min-h-0">
            <h4 className={`text-center font-semibold mb-1 text-sm flex-shrink-0 ${color}`}>{title}</h4>
            <div className="flex-grow overflow-y-auto pr-1 space-y-1 text-xs">
                {childrenArray.length > 0 ? childrenArray : <p className="text-xs text-tertiary text-center">해당 없음</p>}
            </div>
        </div>
    );
};


const Profile: React.FC<ProfileProps> = () => {
    const { currentUserWithStatus, allUsers, handlers, waitingRoomChats, hasClaimableQuest } = useAppContext();
    const [detailedStatsType, setDetailedStatsType] = useState<'strategic' | 'playful' | null>(null);
    const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
    const [hasNewMessage, setHasNewMessage] = useState(false);
    const [towerTimeLeft, setTowerTimeLeft] = useState('');

    useEffect(() => {
        const calculateTime = () => {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            const nextMonth = new Date(year, month + 1, 1);
            const diff = nextMonth.getTime() - now.getTime();

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            setTowerTimeLeft(`${days}일 ${hours}시간 남음`);
        };
        calculateTime();
        const interval = setInterval(calculateTime, 60 * 60 * 1000); // Update every hour
        return () => clearInterval(interval);
    }, []);
    
    if (!currentUserWithStatus) return null;

    const { inventory, stats, nickname, avatarId, borderId } = currentUserWithStatus;
    
    const globalChat = useMemo(() => waitingRoomChats['global'] || [], [waitingRoomChats]);
    const prevChatLength = usePrevious(globalChat.length);
    const hasNotification = hasNewMessage || hasClaimableQuest;

    useEffect(() => {
        if (!isMobilePanelOpen && prevChatLength !== undefined && globalChat.length > prevChatLength) {
            setHasNewMessage(true);
        }
    }, [globalChat.length, prevChatLength, isMobilePanelOpen]);
    
    const avatarUrl = useMemo(() => AVATAR_POOL.find(a => a.id === avatarId)?.url, [avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find(b => b.id === borderId)?.url, [borderId]);

    const equippedItems = useMemo(() => {
        return (inventory || []).filter(item => item.isEquipped);
    }, [inventory]);

    const getItemForSlot = (slot: EquipmentSlot) => {
        return equippedItems.find(item => item.slot === slot);
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
    
    const { coreStatBonuses, specialStatBonuses, mythicStatBonuses } = useMemo(() => calculateUserEffects(currentUserWithStatus), [currentUserWithStatus]);
    
    const hasSpecialBonuses = useMemo(() => Object.values(specialStatBonuses).some(bonus => bonus.flat > 0 || bonus.percent > 0), [specialStatBonuses]);
    const hasMythicBonuses = useMemo(() => Object.values(mythicStatBonuses).some(bonus => bonus.flat > 0), [mythicStatBonuses]);

    const aggregatedMythicStats = useMemo(() => {
        const aggregated: Record<MythicStat, { count: number, totalValue: number }> = {} as any;
        for (const key of Object.values(MythicStat)) {
            aggregated[key] = { count: 0, totalValue: 0 };
        }
        equippedItems.forEach(item => {
            item.options?.mythicSubs.forEach(sub => {
                const key = sub.type as MythicStat;
                if (aggregated[key]) {
                    aggregated[key].count++;
                    aggregated[key].totalValue += sub.value;
                }
            });
        });
        return aggregated;
    }, [equippedItems]);

    const levelPoints = (currentUserWithStatus.strategyLevel - 1) * 2 + (currentUserWithStatus.playfulLevel - 1) * 2;
    const masteryBonus = currentUserWithStatus.mannerMasteryApplied ? 20 : 0;
    const bonusPoints = currentUserWithStatus.bonusStatPoints || 0;
    const totalPoints = levelPoints + masteryBonus + bonusPoints;

    const spentPoints = useMemo(() => {
        return Object.values(currentUserWithStatus.spentStatPoints || {}).reduce((sum, points) => sum + points, 0);
    }, [currentUserWithStatus.spentStatPoints]);
    const availablePoints = totalPoints - spentPoints;
    
    const overallTiers = useMemo(() => {
        const getAvgScore = (user: User, modes: typeof SPECIAL_GAME_MODES) => {
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

        const myStrategicRank = strategicScores.findIndex(u => u.id === currentUserWithStatus.id) + 1;
        const myPlayfulRank = playfulScores.findIndex(u => u.id === currentUserWithStatus.id) + 1;

        const strategicTier = getTier(myStrategicRank, strategicScores.length);
        const playfulTier = getTier(myPlayfulRank, playfulScores.length);

        return { strategicTier, playfulTier };
    }, [currentUserWithStatus, allUsers]);
    
    const coreStatAbbreviations: Record<CoreStat, string> = {
        [CoreStat.Concentration]: '집중',
        [CoreStat.ThinkingSpeed]: '사고',
        [CoreStat.Judgment]: '판단',
        [CoreStat.Calculation]: '계산',
        [CoreStat.CombatPower]: '전투',
        [CoreStat.Stability]: '안정',
    };
    
    const specialStatAbbreviations: Record<SpecialStat, string> = {
        [SpecialStat.ActionPointMax]: '최대 AP',
        [SpecialStat.ActionPointRegen]: 'AP 회복',
        [SpecialStat.StrategyXpBonus]: '전략 XP',
        [SpecialStat.PlayfulXpBonus]: '놀이 XP',
        [SpecialStat.GoldBonus]: '골드 보상',
        [SpecialStat.ItemDropRate]: '장비 드랍',
        [SpecialStat.MaterialDropRate]: '재료 드랍',
    };
    
    const mainOptionBonuses = useMemo(() => {
        const bonuses: Record<string, { value: number; isPercentage: boolean }> = {};
        equippedItems.forEach(item => {
            if (item.options?.main) {
                const main = item.options.main;
                const key = main.type as string;
                if (!bonuses[key]) {
                    bonuses[key] = { value: 0, isPercentage: main.isPercentage };
                }
                bonuses[key].value += main.value;
            }
        });
        return bonuses;
    }, [equippedItems]);

    const combatSubOptionBonuses = useMemo(() => {
        const bonuses: Record<string, { value: number; isPercentage: boolean }> = {};
        equippedItems.forEach(item => {
            if (item.options?.combatSubs) {
                item.options.combatSubs.forEach(sub => {
                    const key = sub.type as string;
                    if (!bonuses[key]) {
                        bonuses[key] = { value: 0, isPercentage: sub.isPercentage };
                    }
                    bonuses[key].value += sub.value;
                });
            }
        });
        return bonuses;
    }, [equippedItems]);
    
    const ProfilePanelContent = useMemo(() => (
        <>
            <div className="flex flex-row gap-2 items-center">
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
                
                <div className="flex-grow space-y-1 bg-tertiary/30 p-2 rounded-md flex flex-col justify-center">
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
                        const baseValue = (currentUserWithStatus.baseStats[stat] || 0) + (currentUserWithStatus.spentStatPoints?.[stat] || 0);
                        const bonus = Math.floor(baseValue * (coreStatBonuses[stat].percent / 100)) + coreStatBonuses[stat].flat;
                        const finalValue = baseValue + bonus;
                        return (
                            <div key={stat} className="bg-tertiary/40 p-1 rounded-md flex items-center justify-between text-xs">
                                <span className="font-semibold text-secondary">{stat}</span>
                                <span className="font-mono font-bold" title={`기본+분배: ${baseValue}, 장비: ${bonus}`}>
                                    {finalValue}
                                    {bonus > 0 && <span className="text-green-400 text-xs ml-0.5">(+{bonus})</span>}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    ), [currentUserWithStatus, handlers, mannerRank, mannerStyle, totalMannerScore, availablePoints, coreStatBonuses]);
    
    const EquipmentPanelContent = useMemo(() => (
        <div className="flex flex-col lg:flex-row gap-4 h-full">
            <div className="flex flex-col w-full lg:w-[240px] flex-shrink-0 gap-2">
                <div className="bg-tertiary/30 p-2 rounded-md">
                    <h3 className="text-center font-semibold mb-2 text-secondary text-sm flex-shrink-0">장착 장비</h3>
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
                </div>
                <div className="flex-1 bg-tertiary/30 p-2 rounded-md flex-col min-h-0 hidden lg:flex">
                    <h4 className="text-center font-semibold mb-1 text-sm flex-shrink-0 text-yellow-300">주옵션 합계</h4>
                    <div className="flex-grow overflow-y-auto pr-1 space-y-1 text-xs">
                        {Object.values(CoreStat).map(stat => {
                            const bonus = mainOptionBonuses[stat];
                            const displayValue = bonus
                                ? `+${bonus.value.toFixed(bonus.isPercentage ? 1 : 0).replace(/\.0$/, '')}${bonus.isPercentage ? '%' : ''}`
                                : `+0`;
                            return (
                                 <div key={stat} className="flex justify-between items-baseline">
                                    <span className="text-tertiary">{coreStatAbbreviations[stat] || stat}</span>
                                    <span className={`font-mono font-semibold text-right ${!bonus ? 'text-tertiary' : ''}`}>
                                        {displayValue}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
    
            <div className="flex-1 lg:flex flex-col gap-2 min-h-0 hidden">
                <StatSummaryPanel title="전투 부옵션 합계" color="text-blue-300">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {Object.values(CoreStat).map(stat => {
                            const bonus = combatSubOptionBonuses[stat];
                            const displayValue = bonus
                                ? `+${bonus.value.toFixed(bonus.isPercentage ? 1 : 0).replace(/\.0$/, '')}${bonus.isPercentage ? '%' : ''}`
                                : `+0`;
                            return (
                                <div key={stat} className="flex justify-between items-baseline">
                                    <span className="text-tertiary">{coreStatAbbreviations[stat] || stat}</span>
                                    <span className={`font-mono font-semibold text-right ${!bonus ? 'text-tertiary' : ''}`}>
                                        {displayValue}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </StatSummaryPanel>
                <StatSummaryPanel title="특수 능력치 합계" color="text-green-300">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {Object.entries(specialStatBonuses).map(([stat, bonus]) => {
                            if (bonus.flat === 0 && bonus.percent === 0) return null;
                            const statEnum = stat as SpecialStat;
                            const name = SPECIAL_STATS_DATA[statEnum].name;
                            const abbr = specialStatAbbreviations[statEnum];
                            return (
                                <div key={stat} className="flex justify-between items-baseline" title={name}>
                                    <span className="text-tertiary truncate">{abbr}</span>
                                    <span className="font-mono font-semibold text-right text-green-300">
                                        {bonus.flat > 0 && `+${bonus.flat.toFixed(0)}`}
                                        {bonus.percent > 0 && (bonus.flat > 0 ? ', ' : '') + `+${bonus.percent.toFixed(1)}%`}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </StatSummaryPanel>
                <StatSummaryPanel title="신화 능력치 합계" color="text-red-400">
                    {Object.entries(aggregatedMythicStats).map(([stat, data]) => {
                        if (data.count === 0) return null;
                        return (
                            <div key={stat} className="text-red-300 text-[10px] leading-tight">
                                {formatMythicStat(stat as MythicStat, data)}
                            </div>
                        )
                    })}
                </StatSummaryPanel>
            </div>
        </div>
    ), [currentUserWithStatus, handlers, mainOptionBonuses, combatSubOptionBonuses, specialStatBonuses, aggregatedMythicStats]);

    const LobbyCards = (
        <div className="grid grid-cols-10 grid-rows-2 lg:grid-rows-7 gap-4 h-full">
            <div className="col-span-5 row-span-1 lg:col-span-5 lg:row-span-3">
                <LobbyCard type="strategic" stats={aggregatedStats.strategic} onEnter={() => window.location.hash = '#/lobby/strategic'} onViewStats={() => setDetailedStatsType('strategic')} level={currentUserWithStatus.strategyLevel} title="전략 바둑" imageUrl={STRATEGIC_GO_LOBBY_IMG} tier={overallTiers.strategicTier} />
            </div>
    
            <div className="col-span-5 row-span-1 lg:col-span-5 lg:row-span-3">
                <LobbyCard type="playful" stats={aggregatedStats.playful} onEnter={() => window.location.hash = '#/lobby/playful'} onViewStats={() => setDetailedStatsType('playful')} level={currentUserWithStatus.playfulLevel} title="놀이 바둑" imageUrl={PLAYFUL_GO_LOBBY_IMG} tier={overallTiers.playfulTier} />
            </div>
    
            <div 
                onClick={() => window.location.hash = '#/tournament'} 
                className="col-span-4 row-span-1 lg:col-span-4 lg:row-span-4 bg-panel border border-color rounded-lg p-2 flex flex-col text-center transition-all transform hover:-translate-y-1 shadow-lg hover:shadow-purple-500/30 cursor-pointer h-full text-on-panel"
            >
                <h2 className="text-base font-bold h-6 mb-1">자동대국 챔피언십</h2>
                <div className="w-full flex-1 bg-tertiary rounded-md flex items-center justify-center text-tertiary overflow-hidden">
                    <img src={TOURNAMENT_LOBBY_IMG} alt="자동대국 챔피언십" className="w-full h-full object-cover" />
                </div>
                <div className="w-full bg-tertiary/50 rounded-md p-1 text-xs mt-2" title="챔피언십 정보">
                     <span>점수: {currentUserWithStatus.tournamentScore.toLocaleString()} / 리그: {currentUserWithStatus.league}</span>
                </div>
            </div>
            
            <div 
                onClick={() => window.location.hash = '#/singleplayer'}
                className="col-span-4 row-span-1 lg:col-span-4 lg:row-span-4 bg-panel border border-color rounded-lg p-2 flex flex-col text-center transition-all transform hover:-translate-y-1 shadow-lg hover:shadow-green-500/30 cursor-pointer h-full text-on-panel"
            >
                <h2 className="text-base font-bold h-6 mb-1">싱글플레이</h2>
                <div className="w-full flex-1 bg-tertiary rounded-md flex items-center justify-center text-tertiary overflow-hidden">
                    <img src={SINGLE_PLAYER_LOBBY_IMG} alt="싱글플레이" className="w-full h-full object-cover" />
                </div>
                <div className="w-full bg-tertiary/50 rounded-md p-1 text-xs mt-2" title="싱글플레이 정보">
                     <span>진행도: {currentUserWithStatus.singlePlayerProgress ?? 0} / {SINGLE_PLAYER_STAGES.length}</span>
                </div>
            </div>
            
            <div className="col-span-2 row-span-1 lg:col-span-2 lg:row-span-4">
                <PveCard 
                    title="도전의 탑" 
                    imageUrl={TOWER_CHALLENGE_LOBBY_IMG} 
                    layout="tall" 
                    footerContent={
                        <div className="flex flex-col items-center">
                            <span>현재 층: 1층</span>
                            <span className="text-tertiary">{towerTimeLeft}</span>
                        </div>
                    }
                />
            </div>
        </div>
    );
    
    const EquippedEffectsPanel = useMemo(() => (
        <div className="bg-panel border border-color text-on-panel rounded-lg p-2 flex flex-col gap-2">
          <h3 className="text-center font-semibold text-secondary text-sm flex-shrink-0">장비 장착 효과</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <StatSummaryPanel title="주옵션" color="text-yellow-300">
                {Object.values(CoreStat).map(stat => {
                    const bonus = mainOptionBonuses[stat];
                    const displayValue = bonus
                        ? `+${bonus.value.toFixed(bonus.isPercentage ? 1 : 0).replace(/\.0$/, '')}${bonus.isPercentage ? '%' : ''}`
                        : `+0`;
                    return (
                         <div key={stat} className="flex justify-between items-baseline">
                            <span className="text-tertiary">{coreStatAbbreviations[stat] || stat}</span>
                            <span className={`font-mono font-semibold text-right ${!bonus ? 'text-tertiary' : ''}`}>
                                {displayValue}
                            </span>
                        </div>
                    );
                })}
            </StatSummaryPanel>
            <StatSummaryPanel title="전투 부옵션" color="text-blue-300">
                {Object.values(CoreStat).map(stat => {
                    const bonus = combatSubOptionBonuses[stat];
                    const displayValue = bonus
                        ? `+${bonus.value.toFixed(bonus.isPercentage ? 1 : 0).replace(/\.0$/, '')}${bonus.isPercentage ? '%' : ''}`
                        : `+0`;
                    return (
                        <div key={stat} className="flex justify-between items-baseline">
                            <span className="text-tertiary">{coreStatAbbreviations[stat] || stat}</span>
                            <span className={`font-mono font-semibold text-right ${!bonus ? 'text-tertiary' : ''}`}>
                                {displayValue}
                            </span>
                        </div>
                    );
                })}
            </StatSummaryPanel>
            <StatSummaryPanel title="특수 능력치" color="text-green-300">
                {Object.entries(specialStatBonuses).map(([stat, bonus]) => {
                    if (bonus.flat === 0 && bonus.percent === 0) return null;
                    const statEnum = stat as SpecialStat;
                    const name = SPECIAL_STATS_DATA[statEnum].name;
                    const abbr = specialStatAbbreviations[statEnum];
                    return (
                        <div key={stat} className="flex justify-between items-baseline" title={name}>
                            <span className="text-tertiary truncate">{abbr}</span>
                            <span className="font-mono font-semibold text-right text-green-300">
                                {bonus.flat > 0 && `+${bonus.flat.toFixed(0)}`}
                                {bonus.percent > 0 && (bonus.flat > 0 ? ', ' : '') + `+${bonus.percent.toFixed(1)}%`}
                            </span>
                        </div>
                    )
                })}
            </StatSummaryPanel>
            <StatSummaryPanel title="신화 능력치" color="text-red-400">
                {Object.entries(aggregatedMythicStats).map(([stat, data]) => {
                    if (data.count === 0) return null;
                    return (
                        <div key={stat} className="text-red-300 text-[10px] leading-tight">
                            {formatMythicStat(stat as MythicStat, data)}
                        </div>
                    )
                })}
            </StatSummaryPanel>
          </div>
        </div>
    ), [mainOptionBonuses, combatSubOptionBonuses, specialStatBonuses, aggregatedMythicStats]);

    return (
        <div className="bg-primary text-primary p-2 sm:p-4 lg:p-2 max-w-screen-2xl mx-auto w-full h-full flex flex-col">
            <header className="flex justify-between items-center mb-2 px-2 flex-shrink-0">
                <h1 className="text-2xl font-bold text-primary">홈</h1>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={handlers.openEncyclopedia}
                        className="w-8 h-8 flex items-center justify-center bg-purple-600 hover:bg-purple-500 rounded-full text-white font-bold text-lg flex-shrink-0 transition-transform hover:scale-110"
                        title="도감"
                    >
                        📖
                    </button>
                    <button 
                        onClick={handlers.openInfoModal}
                        className="w-8 h-8 flex items-center justify-center bg-gray-600 hover:bg-gray-500 rounded-full text-white font-bold text-lg flex-shrink-0 transition-transform hover:scale-110"
                        title="도움말"
                    >
                        ?
                    </button>
                </div>
            </header>
            <main className="flex-1 flex flex-col min-h-0">
                {/* --- DESKTOP LAYOUT --- */}
                <div className="hidden lg:flex flex-col h-full gap-2">
                    <div className="flex flex-row gap-2">
                        <div className="w-[30%] bg-panel border border-color text-on-panel rounded-lg p-2 flex flex-col gap-1">{ProfilePanelContent}</div>
                         <div className="flex-1 flex flex-row gap-2 min-w-0">
                             <div className="flex-1 bg-panel border border-color text-on-panel rounded-lg p-2 flex flex-col">{EquipmentPanelContent}</div>
                             <div className="w-24 flex-shrink-0">
                                <QuickAccessSidebar />
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 grid grid-cols-12 gap-2 min-h-0">
                        <div className="col-span-5 bg-panel border border-color text-on-panel rounded-lg min-h-0 flex flex-col">
                            <ChatWindow messages={globalChat} mode="global" onAction={handlers.handleAction} onViewUser={handlers.openViewingUser} locationPrefix="[홈]" />
                        </div>
                        <div className="col-span-7 min-h-0 flex flex-col justify-end">
                            {LobbyCards}
                        </div>
                    </div>
                </div>

                {/* --- MOBILE LAYOUT --- */}
                <div className="lg:hidden flex flex-col h-full gap-2 relative">
                    <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto">
                        <div className="flex flex-row gap-2">
                            <div className="w-1/2 bg-panel border border-color text-on-panel rounded-lg p-2 flex flex-col gap-1">{ProfilePanelContent}</div>
                            <div className="w-1/2 bg-panel border border-color text-on-panel rounded-lg p-2 flex flex-col">{EquipmentPanelContent}</div>
                        </div>
                        
                        {EquippedEffectsPanel}

                        <div className="flex-shrink-0 h-[50vh]">
                            {LobbyCards}
                        </div>
                    </div>

                    {/* Slide-out button */}
                    <div className="absolute top-1/2 -translate-y-1/2 right-0 z-20">
                        <button
                            onClick={() => { setIsMobilePanelOpen(true); setHasNewMessage(false); }}
                            className="w-8 h-12 bg-secondary/80 backdrop-blur-sm rounded-l-lg flex items-center justify-center text-primary shadow-lg"
                            aria-label="채팅/메뉴 열기"
                        >
                            <span className="relative font-bold text-lg">
                                {'<'}
                                {hasNotification && <div className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-secondary"></div>}
                            </span>
                        </button>
                    </div>

                    {/* Slide-out Panel */}
                    <div className={`fixed top-0 right-0 h-full w-[280px] bg-primary shadow-2xl z-50 transition-transform duration-300 ease-in-out ${isMobilePanelOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
                        <div className="flex justify-between items-center p-2 border-b border-color flex-shrink-0">
                            <h3 className="text-lg font-bold">채팅 / 메뉴</h3>
                            <button onClick={() => setIsMobilePanelOpen(false)} className="text-2xl font-bold text-tertiary hover:text-primary">×</button>
                        </div>
                        <div className="flex flex-col gap-2 p-2 flex-grow min-h-0">
                            <div className="flex-shrink-0 p-1 bg-panel rounded-lg border border-color">
                                <QuickAccessSidebar mobile={true} />
                            </div>
                            <div className="flex-1 bg-panel border border-color rounded-lg min-h-0">
                                <ChatWindow messages={globalChat} mode="global" onAction={handlers.handleAction} onViewUser={handlers.openViewingUser} locationPrefix="[홈]" />
                            </div>
                        </div>
                    </div>

                    {/* Overlay */}
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