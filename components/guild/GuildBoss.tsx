import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useAppContext } from '../../hooks/useAppContext.js';
import { Guild as GuildType, UserWithStatus, GuildBossInfo, QuestReward, GuildMember, GuildMemberRole, CoreStat, GuildResearchId, EquipmentSlot, InventoryItem, ItemGrade } from '../../types/index.js';
import Button from '../Button.js';
import GuildHomePanel from './GuildHomePanel.js';
import GuildMembersPanel from './GuildMembersPanel.js';
import GuildManagementPanel from './GuildManagementPanel.js';
import { GUILD_XP_PER_LEVEL, GUILD_BOSSES, GUILD_RESEARCH_PROJECTS, AVATAR_POOL, BORDER_POOL, emptySlotImages, slotNames, GUILD_BOSS_MAX_ATTEMPTS } from '../../constants/index.js';
import DraggableWindow from '../DraggableWindow.js';
import GuildResearchPanel from './GuildResearchPanel.js';
import GuildMissionsPanel from './GuildMissionsPanel.js';
import GuildShopModal from './GuildShopModal.js';
import { BOSS_SKILL_ICON_MAP } from '../../assets.js';
import HelpModal from '../HelpModal.js';
import { runGuildBossBattle, BattleLogEntry, GuildBossBattleResult } from '../../utils/guildBossSimulator.js';
import { calculateTotalStats } from '../../services/statService.js';
import Avatar from '../Avatar.js';
import { GUILD_ATTACK_ICON, GUILD_RESEARCH_HEAL_BLOCK_IMG, GUILD_RESEARCH_IGNITE_IMG, GUILD_RESEARCH_REGEN_IMG } from '../../assets.js';
import RadarChart from '../RadarChart.js';
import { calculateUserEffects } from '../../server/services/effectService.js';

const getResearchSkillDisplay = (researchId: GuildResearchId, level: number): { chance?: number; description: string; } | null => {
    if (level === 0) return null;
    const project = GUILD_RESEARCH_PROJECTS[researchId];
    if (!project) return null;

    const totalEffect = project.baseEffect * level;

    switch (researchId) {
        case GuildResearchId.boss_hp_increase:
            return { description: `[${totalEffect}% 증가]` };
        case GuildResearchId.boss_skill_heal_block: {
            const chance = 10 + (15 * level);
            const reduction = 10 * level;
            return { chance, description: `회복 불가 또는 회복량 ${reduction}% 감소` };
        }
        case GuildResearchId.boss_skill_regen: { // '회복'
            const chance = 10 + (15 * level);
            const increase = 10 * level;
            return { chance, description: `회복, 회복량 +${increase}%` };
        }
        case GuildResearchId.boss_skill_ignite: {
            const chance = 10 + (15 * level);
            const increasePercent = level * 10;
            return { chance, description: `고정피해, 피해량 +${increasePercent}%` };
        }
        default:
            return null;
    }
};


const gradeBackgrounds: Record<ItemGrade, string> = {
    normal: '/images/equipments/normalbgi.png',
    uncommon: '/images/equipments/uncommonbgi.png',
    rare: '/images/equipments/rarebgi.png',
    epic: '/images/equipments/epicbgi.png',
    legendary: '/images/equipments/legendarybgi.png',
    mythic: '/images/equipments/mythicbgi.png',
};

const renderStarDisplay = (stars: number) => {
    if (stars === 0) return null;

    let starImage = '';
    let numberColor = '';
    let starImageClass = '';

    if (stars >= 10) {
        starImage = '/images/equipments/Star4.png';
        numberColor = "prism-text-effect";
        starImageClass = "prism-image-effect";
    } else if (stars >= 7) {
        starImage = '/images/equipments/Star3.png';
        numberColor = "text-purple-400";
    } else if (stars >= 4) {
        starImage = '/images/equipments/Star2.png';
        numberColor = "text-amber-400";
    } else if (stars >= 1) {
        starImage = '/images/equipments/Star1.png';
        numberColor = "text-white";
    }

    return (
        <div className="absolute top-0.5 left-0.5 flex items-center gap-0.5 bg-black/40 rounded-br-md px-1 py-0.5 z-10" style={{ textShadow: '1px 1px 2px black' }}>
            <img src={starImage} alt="star" className={`w-3 h-3 ${starImageClass}`} />
            <span className={`font-bold text-xs leading-none ${numberColor}`}>{stars}</span>
        </div>
    );
};

const EquipmentSlotDisplay: React.FC<{ slot: EquipmentSlot; item?: InventoryItem; onClick?: () => void; }> = ({ slot, item, onClick }) => {
    const clickableClass = item && onClick ? 'cursor-pointer hover:scale-105 transition-transform' : '';
    
    if (item) {
        return (
            <div
                className={`relative w-full aspect-square rounded-md border border-color/50 bg-tertiary/50 ${clickableClass}`}
                title={item.name}
                onClick={onClick}
            >
                <img src={gradeBackgrounds[item.grade]} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-sm" />
                {renderStarDisplay(item.stars)}
                {item.image && <img src={item.image} alt={item.name} className="relative w-full h-full object-contain p-1"/>}
            </div>
        );
    } else {
         return (
             <img src={emptySlotImages[slot]} alt={`${slot} empty slot`} className="w-full aspect-square rounded-md bg-tertiary/50 border-2 border-dashed border-color/50" />
        );
    }
};

interface UserStatsPanelProps {
    user: UserWithStatus;
    guild: GuildType | null;
    hp: number;
    maxHp: number;
    damageNumbers: { id: number; text: string; color: string }[];
    onOpenEffects: () => void;
    onOpenPresets: () => void;
    isSimulating: boolean;
    activeDebuffs: Record<string, { value: number; turns: number }>;
}

const UserStatsPanel: React.FC<UserStatsPanelProps> = ({ user, guild, hp, maxHp, damageNumbers, onOpenEffects, onOpenPresets, isSimulating, activeDebuffs }) => {
    const { handlers } = useAppContext();
    const myGuild = guild;
    
    const totalStats = useMemo(() => calculateTotalStats(user, myGuild), [user, myGuild]);
    const baseWithSpent = useMemo(() => {
        const stats: Record<CoreStat, number> = {} as any;
        for (const key of Object.values(CoreStat)) {
            stats[key] = (user.baseStats[key] || 0) + (user.spentStatPoints?.[key] || 0);
        }
        return stats;
    }, [user.baseStats, user.spentStatPoints]);

    const equipmentOnlyEffects = useMemo(() => calculateUserEffects(user, null), [user]);

    const equipmentBonuses = useMemo(() => {
        const bonuses: Partial<Record<CoreStat, number>> = {};
        for (const key of Object.values(CoreStat)) {
            const baseValue = baseWithSpent[key];
            const flatBonus = equipmentOnlyEffects.coreStatBonuses[key].flat;
            const percentBonus = equipmentOnlyEffects.coreStatBonuses[key].percent;
            const finalValue = Math.floor((baseValue + flatBonus) * (1 + percentBonus / 100));
            bonuses[key] = finalValue - baseValue;
        }
        return bonuses;
    }, [baseWithSpent, equipmentOnlyEffects]);

    const avatarUrl = useMemo(() => AVATAR_POOL.find(a => a.id === user.avatarId)?.url, [user.avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find(b => b.id === user.borderId)?.url, [user.borderId]);

    const radarDataset = useMemo(() => [{
        stats: totalStats,
        color: '#60a5fa',
        fill: 'rgba(59, 130, 246, 0.4)',
    }], [totalStats]);
    
    const equippedItems = useMemo(() => {
        return (user.inventory || []).filter(item => item.isEquipped);
    }, [user.inventory]);

    const getItemForSlot = (slot: EquipmentSlot) => {
        return equippedItems.find(e => e && e.slot === slot);
    };
    
    const hpPercent = maxHp > 0 ? (hp / maxHp) * 100 : 0;
    
    const allBossResearch = useMemo(() => {
        if (!guild) return [];
        return Object.entries(GUILD_RESEARCH_PROJECTS)
            .filter(([, project]) => project.category === 'boss')
            .map(([id, project]) => {
                const currentLevel = guild.research?.[id as GuildResearchId]?.level || 0;
                return { ...project, id: id as GuildResearchId, currentLevel };
            });
    }, [guild]);

    const presets = useMemo(() => {
        const userPresets = user.equipmentPresets || [];
        return Array(5).fill(null).map((_, i) => 
            userPresets[i] || { name: `프리셋 ${i + 1}`, equipment: {} }
        );
    }, [user.equipmentPresets]);

    const handleLoadPreset = (index: number) => {
        if (window.confirm(`'${presets[index].name}' 프리셋을 불러오시겠습니까? 현재 장착된 모든 장비가 해제됩니다.`)) {
            handlers.handleAction({ type: 'LOAD_EQUIPMENT_PRESET', payload: { presetIndex: index } });
        }
    };

    return (
        <div className="bg-panel border border-color rounded-lg p-3 flex flex-col h-full">
            <style>{`
                @keyframes float-up-and-fade {
                    from { transform: translateY(0) scale(1); opacity: 1; }
                    to { transform: translateY(-50px) scale(1.5); opacity: 0; }
                }
                .damage-number-animation {
                    animation: float-up-and-fade 1.5s ease-out forwards;
                }
            `}</style>
            
            <div className="flex items-center gap-3 mb-2 flex-shrink-0">
                <Avatar userId={user.id} userName={user.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={48} />
                <h3 className="font-bold text-lg">{user.nickname}</h3>
            </div>
            
            <div className="relative mb-3 flex-shrink-0">
                <div className="w-full bg-tertiary rounded-full h-4 border-2 border-color relative">
                    <div className="bg-gradient-to-r from-green-400 to-green-600 h-full rounded-full" style={{ width: `${hpPercent}%`, transition: 'width 0.5s linear' }}></div>
                     <span className="absolute inset-0 text-xs font-bold text-white flex items-center justify-center" style={{textShadow: '1px 1px 2px black'}}>
                        HP: {Math.ceil(hp).toLocaleString()} / {maxHp.toLocaleString()}
                    </span>
                </div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-24 w-full overflow-hidden pointer-events-none">
                    {damageNumbers.map(dn => (
                        <div key={dn.id} className={`absolute bottom-0 left-1/2 -translate-x-1/2 font-bold text-xl damage-number-animation ${dn.color}`} style={{ textShadow: '1px 1px 3px black' }}>
                            {dn.text}
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="flex flex-row gap-2 items-center mb-2">
                <div className="w-1/2">
                    <RadarChart datasets={radarDataset} maxStatValue={1000} size={150} />
                </div>
                <div className="w-1/2 grid grid-cols-1 gap-1 text-xs">
                    {Object.values(CoreStat).map(stat => {
                        const bonus = equipmentBonuses[stat] || 0;
                        const isDebuffed = stat === CoreStat.CombatPower && activeDebuffs['user_combat_power_reduction_percent']?.turns > 0;
                        return (
                            <div key={stat} className="flex justify-between items-center bg-tertiary/40 p-1 rounded-md">
                                <span className={`font-semibold text-secondary ${isDebuffed ? 'text-red-400' : ''}`}>{stat}</span>
                                <div className="flex items-baseline">
                                    <span className={`font-mono font-bold ${isDebuffed ? 'text-red-400' : 'text-primary'}`}>{totalStats[stat]}</span>
                                    {bonus > 0 && <span className="font-mono text-xs text-green-400 ml-0.5">(+{bonus})</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            
            <div className="grid grid-cols-6 gap-1 px-1">
                {(['fan', 'top', 'bottom', 'board', 'bowl', 'stones'] as EquipmentSlot[]).map(slot => (
                    <div key={slot} className="w-full">
                        <EquipmentSlotDisplay
                            slot={slot}
                            item={getItemForSlot(slot)}
                            onClick={() => {
                                const item = getItemForSlot(slot);
                                if (item) handlers.openViewingItem(item, true);
                            }}
                        />
                    </div>
                ))}
            </div>
            
            <div className="mt-2 flex items-center justify-end gap-2">
                <Button onClick={onOpenEffects} colorScheme="purple" className="flex-1 !text-xs !py-1.5">장비 효과</Button>
                <div className="flex items-center gap-1">
                    {presets.map((preset, index) => (
                        <button
                            key={index}
                            onClick={() => handleLoadPreset(index)}
                            disabled={isSimulating}
                            className="w-8 h-8 !p-0 flex items-center justify-center bg-secondary rounded-md text-sm font-bold text-primary hover:bg-tertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={isSimulating ? "전투 중에는 변경할 수 없습니다." : `불러오기: ${preset.name}`}
                        >
                            {index + 1}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mt-2 pt-2 border-t border-color flex-shrink-0">
                <h4 className="font-semibold text-sm text-center text-secondary mb-1">연구소 스킬 효과</h4>
                 <div className="space-y-1 text-xs">
                    {allBossResearch.map(project => {
                        const currentLevel = guild?.research?.[project.id]?.level || 0;
                        const displayInfo = getResearchSkillDisplay(project.id, currentLevel);
                        const simpleNameMap: Partial<Record<GuildResearchId, string>> = {
                            'boss_hp_increase': 'HP증가',
                            'boss_skill_heal_block': '회복불가',
                            'boss_skill_regen': '회복',
                            'boss_skill_ignite': '점화',
                        };
                        const displayName = simpleNameMap[project.id] || project.name;
                        
                        return (
                            <div key={project.id} className={`flex items-center gap-2 bg-tertiary/50 p-1 rounded-md ${!displayInfo ? 'opacity-60' : ''}`} title={project.description}>
                                <div className="flex items-center gap-2 flex-shrink-0 w-28">
                                    <img src={project.image} alt={displayName} className="w-14 h-14"/>
                                    <span className="font-semibold text-primary text-sm">{displayName}</span>
                                </div>
                                <div className="flex-grow min-w-0 text-right">
                                    {displayInfo ? (
                                        <p className="font-mono font-bold text-yellow-400">
                                            {displayInfo.chance !== undefined ? `[${displayInfo.chance}% 확률] ` : ''}{displayInfo.description}
                                        </p>
                                    ) : (
                                        <p className="text-tertiary text-[10px]">비활성</p>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
};

interface BossPanelProps {
    boss: GuildBossInfo;
    hp: number;
    maxHp: number;
    damageNumbers: { id: number; text: string; color: string; isHeal: boolean; isCrit?: boolean }[];
}

const BossPanel: React.FC<BossPanelProps> = ({ boss, hp, maxHp, damageNumbers }) => {
    const { handlers } = useAppContext();
    const hpPercent = maxHp > 0 ? (hp / maxHp) * 100 : 0;

    return (
        <div className="flex flex-col gap-4 h-full">
            <div className="relative rounded-lg overflow-hidden flex-shrink-0 group">
                <img src={boss.image} alt={boss.name} className="w-full object-contain" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/50"></div>
                
                <div className="absolute top-2 left-2 right-2">
                     <div className="w-full bg-tertiary rounded-full h-5 border-2 border-black/50 relative">
                        <div className="bg-gradient-to-r from-red-500 to-red-700 h-full rounded-full" style={{ width: `${hpPercent}%`, transition: 'width 0.5s linear' }}></div>
                         <span className="absolute inset-0 text-sm font-bold text-white flex items-center justify-center" style={{textShadow: '1px 1px 2px black'}}>
                            {Math.ceil(hp).toLocaleString()} / {maxHp.toLocaleString()} ({hpPercent.toFixed(1)}%)
                        </span>
                        <div className="absolute top-full left-0 right-0 h-24 pointer-events-none">
                            {damageNumbers.map(dn => (
                                <div 
                                    key={dn.id} 
                                    className={`absolute top-0 left-1/2 -translate-x-1/2 font-bold ${dn.isCrit ? 'text-4xl' : 'text-2xl'} ${dn.color} ${dn.isHeal ? 'animate-float-up-and-fade' : 'animate-float-down-and-fade'}`}
                                    style={{ textShadow: dn.isCrit ? '0 0 5px yellow, 0 0 8px orange' : '1px 1px 3px black' }}
                                >
                                    {dn.text}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="flex-1 bg-panel border border-color rounded-lg p-3 flex flex-col gap-2 min-h-0">
                <div className="flex-shrink-0 text-center">
                    <h4 className="font-bold text-yellow-300">보스 패턴</h4>
                    <div className="flex justify-around items-center gap-2 mt-1">
                        {boss.skills.map(skill => (
                            <div key={skill.id} className="relative group/skill">
                                <img src={BOSS_SKILL_ICON_MAP[skill.id]} alt={skill.name} className="w-14 h-14" />
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-black/80 text-white text-xs rounded-lg p-2 opacity-0 group-hover/skill:opacity-100 transition-opacity pointer-events-none z-10">
                                    <p className="font-bold text-yellow-300">{skill.name}</p>
                                    <p>{skill.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="flex-grow border-t border-color/50 mt-1 pt-1 flex flex-col justify-center">
                    <h4 className="font-bold text-yellow-300 mb-1 text-center text-sm">추천 능력치</h4>
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-secondary">
                        {boss.recommendedStats.map(stat => <span key={stat}>{stat}</span>)}
                    </div>
                </div>
            </div>
        </div>
    );
};

interface DamageRankingPanelProps {
    damageRanking: { userId: string; nickname: string; damage: number }[];
    myRankData: { userId: string; nickname: string; damage: number; rank: number } | null;
    myCurrentBattleDamage: number;
}


const DamageRankingPanel: React.FC<DamageRankingPanelProps> = ({ damageRanking, myRankData, myCurrentBattleDamage }) => {
    const { handlers } = useAppContext();

    return (
        <div className="bg-panel border border-color rounded-lg p-3 flex flex-col min-h-0 h-full">
            <h4 className="font-bold text-yellow-300 mb-2 text-center flex-shrink-0">누적 랭킹</h4>
            
            {myRankData ? (
                <div className="flex-shrink-0 mb-2 pb-2 border-b border-color/50">
                    <div className="flex items-center justify-between bg-blue-900/40 p-1.5 rounded-md text-xs">
                        <div className="flex items-center gap-1.5">
                            <span className="font-bold w-5 text-center">{myRankData.rank}</span>
                            <span className="font-semibold truncate">{myRankData.nickname} (나)</span>
                        </div>
                        <span className="font-mono text-highlight">{myRankData.damage.toLocaleString()}</span>
                    </div>
                </div>
            ) : (
                 <div className="flex-shrink-0 mb-2 pb-2 border-b border-color/50">
                    <p className="text-xs text-tertiary text-center">아직 랭킹 기록이 없습니다.</p>
                </div>
            )}
            
            <div className="flex-grow overflow-y-auto pr-1">
                {damageRanking.length > 0 ? (
                    <ul className="space-y-1">
                        {damageRanking.map((rank, index) => (
                            <li key={rank.userId} onClick={() => handlers.openViewingUser(rank.userId)} className="flex items-center justify-between bg-tertiary/50 p-1.5 rounded-md text-xs cursor-pointer hover:bg-secondary">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-bold w-5 text-center">{index + 1}.</span>
                                    <span className="font-semibold truncate">{rank.nickname}</span>
                                </div>
                                <span className="font-mono text-highlight">{rank.damage.toLocaleString()}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="h-full flex items-center justify-center text-tertiary text-sm">기록 없음</div>
                )}
            </div>
            <div className="mt-2 pt-2 border-t border-color/50 flex-shrink-0 text-center">
                <p className="text-sm">이번 전투 피해량: <span className="font-bold text-yellow-300">{myCurrentBattleDamage.toLocaleString()}</span></p>
            </div>
        </div>
    );
};

const GuildBoss: React.FC = () => {
    const { currentUserWithStatus, guilds, handlers } = useAppContext();
    
    const [isSimulating, setIsSimulating] = useState(false);
    const [simulationResult, setSimulationResult] = useState<GuildBossBattleResult | null>(null);
    const [logIndex, setLogIndex] = useState(0);
    const [battleLog, setBattleLog] = useState<BattleLogEntry[]>([]);
    const [userHp, setUserHp] = useState(0);
    const [maxUserHp, setMaxUserHp] = useState(0);
    const [damageNumbers, setDamageNumbers] = useState<{ id: number; text: string; color: string }[]>([]);
    const [bossDamageNumbers, setBossDamageNumbers] = useState<{ id: number; text: string; color: string; isHeal: boolean; isCrit?: boolean }[]>([]);
    const [currentBattleDamage, setCurrentBattleDamage] = useState(0);
    const [activeDebuffs, setActiveDebuffs] = useState<Record<string, { value: number; turns: number }>>({});

    
    const userLogContainerRef = useRef<HTMLDivElement>(null);
    const bossLogContainerRef = useRef<HTMLDivElement>(null);

    const myGuild = useMemo(() => {
        if (!currentUserWithStatus?.guildId) return null;
        return guilds[currentUserWithStatus.guildId];
    }, [currentUserWithStatus?.guildId, guilds]);

    const currentBoss = useMemo(() => {
        if (!myGuild?.guildBossState) return GUILD_BOSSES[0];
        return GUILD_BOSSES.find(b => b.id === myGuild.guildBossState!.currentBossId) || GUILD_BOSSES[0];
    }, [myGuild]);
    
    const bossIndex = useMemo(() => (currentBoss?.id || 'boss_1').split('_')[1], [currentBoss]);
    const backgroundStyle = useMemo(() => ({
        backgroundImage: `url(/images/guild/boss${bossIndex}bg.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: 'rgb(var(--bg-tertiary))', // Fallback color
    }), [bossIndex]);
    
    const { guildBossState } = myGuild || {};
    const currentHp = guildBossState?.currentBossHp ?? currentBoss?.maxHp ?? 0;
    const [simulatedBossHp, setSimulatedBossHp] = useState(currentHp);

    const userLogs = useMemo(() => battleLog.filter(e => e.isUserAction), [battleLog]);
    const bossLogs = useMemo(() => battleLog.filter(e => !e.isUserAction), [battleLog]);

    useEffect(() => { if (userLogContainerRef.current) userLogContainerRef.current.scrollTop = userLogContainerRef.current.scrollHeight; }, [userLogs]);
    useEffect(() => { if (bossLogContainerRef.current) bossLogContainerRef.current.scrollTop = bossLogContainerRef.current.scrollHeight; }, [bossLogs]);
    useEffect(() => { if (!isSimulating) setSimulatedBossHp(currentHp); }, [currentHp, isSimulating]);

    const handleBattleStart = useCallback(() => {
        if (!currentUserWithStatus || !myGuild) return;
        const attemptsLeft = GUILD_BOSS_MAX_ATTEMPTS - (currentUserWithStatus.guildBossAttempts || 0);
        if (attemptsLeft <= 0 || isSimulating) return;
        
        setIsSimulating(true);
        setBattleLog([]);
        setLogIndex(0);
        setDamageNumbers([]);
        setBossDamageNumbers([]);
        setCurrentBattleDamage(0);
        setActiveDebuffs({});
        const initialHp = myGuild.guildBossState?.currentBossHp ?? currentBoss.maxHp;
        setSimulatedBossHp(initialHp);

        const result = runGuildBossBattle(currentUserWithStatus, myGuild, { ...currentBoss, hp: initialHp });
        
        setUserHp(result.maxUserHp);
        setMaxUserHp(result.maxUserHp);
        setSimulationResult(result);
    }, [currentUserWithStatus, myGuild, isSimulating, currentBoss]);

    useEffect(() => {
        if (!isSimulating || !simulationResult) return;

        if (logIndex >= simulationResult.battleLog.length) {
            const timer = setTimeout(() => {
                handlers.handleAction({ type: 'START_GUILD_BOSS_BATTLE', payload: { result: { ...simulationResult, damageDealt: currentBattleDamage }, bossName: currentBoss.name } });
                setIsSimulating(false);
                setSimulationResult(null);
                setActiveDebuffs({});
            }, 1000);
            return () => clearTimeout(timer);
        }

        const processNextLogEntry = () => {
            const newEntry = simulationResult.battleLog[logIndex];
            
            // At the start of a new turn, update debuffs
            if (logIndex > 0 && simulationResult.battleLog[logIndex-1].turn !== newEntry.turn) {
                 setActiveDebuffs(prev => {
                    const nextDebuffs: Record<string, { value: number; turns: number }> = {};
                    for (const key in prev) {
                        if (prev[key].turns > 1) {
                            nextDebuffs[key] = { ...prev[key], turns: prev[key].turns - 1 };
                        }
                    }
                    return nextDebuffs;
                });
            }
            
            setBattleLog(prev => [...prev, newEntry]);

            if (newEntry.damageTaken) {
                setUserHp(hp => Math.max(0, hp - newEntry.damageTaken!));
                setDamageNumbers(prev => [...prev.slice(-5), { id: Date.now() + Math.random(), text: `-${newEntry.damageTaken}`, color: 'text-red-400' }]);
            }
            if (newEntry.healingDone) {
                setUserHp(hp => Math.min(maxUserHp, hp + newEntry.healingDone!));
                setDamageNumbers(prev => [...prev.slice(-5), { id: Date.now() + Math.random(), text: `+${newEntry.healingDone}`, color: 'text-green-400' }]);
            }
            
            if (newEntry.debuffsApplied) {
                setActiveDebuffs(prev => {
                    const newDebuffs = { ...prev };
                    for (const debuff of newEntry.debuffsApplied!) {
                        newDebuffs[debuff.type] = { value: debuff.value, turns: debuff.turns };
                    }
                    return newDebuffs;
                });
            }

            if (newEntry.isUserAction) {
                const damageMatch = newEntry.message.match(/보스 HP -([\d,]+)/);
                if (damageMatch && damageMatch[1]) {
                    const damageDealtInTurn = parseInt(damageMatch[1].replace(/,/g, ''), 10);
                    if (!isNaN(damageDealtInTurn)) {
                        setCurrentBattleDamage(prev => prev + damageDealtInTurn);
                    }
                }
            }

            const bossHpChangeMatch = newEntry.message.match(/보스 HP ([+-])([\d,]+)/);
            if (bossHpChangeMatch) {
                const sign = bossHpChangeMatch[1];
                const value = parseInt(bossHpChangeMatch[2].replace(/,/g, ''), 10);
                
                if (sign === '-') {
                    setSimulatedBossHp(prevHp => Math.max(0, prevHp - value));
                    setBossDamageNumbers(prev => [...prev.slice(-9), { 
                        id: Date.now() + Math.random(), 
                        text: `-${value.toLocaleString()}`, 
                        color: newEntry.isCrit ? 'text-yellow-300' : 'text-red-400',
                        isHeal: false,
                        isCrit: newEntry.isCrit
                    }]);
                } else { // sign is '+'
                    setSimulatedBossHp(prevHp => Math.min(currentBoss.maxHp, prevHp + value));
                    setBossDamageNumbers(prev => [...prev.slice(-9), { 
                        id: Date.now() + Math.random(), 
                        text: `+${value.toLocaleString()}`, 
                        color: 'text-green-400',
                        isHeal: true,
                        isCrit: false
                    }]);
                }
            }

            setLogIndex(prev => prev + 1);
        };

        const timer = setTimeout(processNextLogEntry, 1000);
        return () => clearTimeout(timer);

    }, [isSimulating, simulationResult, logIndex, handlers, maxUserHp, currentBoss.name, currentBattleDamage]);

    const { fullDamageRanking, myRankData } = useMemo(() => {
        if (!myGuild?.guildBossState?.totalDamageLog) {
            return { fullDamageRanking: [], myRankData: null };
        }
        
        const damageLog = myGuild.guildBossState.totalDamageLog;
        
        const fullRanking = Object.entries(damageLog)
            .map(([userId, damage]) => {
                const member = myGuild.members.find(m => m.userId === userId);
                return { userId, nickname: member?.nickname || '알 수 없음', damage };
            })
            .sort((a, b) => b.damage - a.damage);
            
        const myRankIndex = fullRanking.findIndex(r => r.userId === currentUserWithStatus?.id);
        const myData = myRankIndex !== -1 ? { ...fullRanking[myRankIndex], rank: myRankIndex + 1 } : null;

        return { fullDamageRanking: fullRanking, myRankData: myData };
    }, [myGuild?.guildBossState?.totalDamageLog, myGuild?.members, currentUserWithStatus?.id]);
    
    const top3DamageRanking = fullDamageRanking.slice(0, 3);


    if (!currentUserWithStatus || !myGuild) {
        return <div className="p-4">길드 정보를 불러오는 중...</div>;
    }

    const { gold, diamonds, guildCoins, guildBossAttempts } = currentUserWithStatus;
    const attemptsLeft = GUILD_BOSS_MAX_ATTEMPTS - (guildBossAttempts || 0);
    
    return (
        <div style={backgroundStyle} className="p-2 sm:p-4 lg:p-6 max-w-7xl mx-auto h-full flex flex-col relative">
            <header className="relative flex justify-center items-center mb-4 flex-shrink-0 py-2">
                <div className="absolute left-0 top-1/2 -translate-y-1/2">
                    <Button onClick={() => window.location.hash = '#/guild'}>&larr; 길드 홈으로</Button>
                </div>
                <h1 className="text-3xl font-bold text-white" style={{ textShadow: '2px 2px 5px black' }}>길드 보스전</h1>
            </header>
             <div className="absolute top-4 right-4 z-10">
                <div className="flex items-center gap-2 bg-tertiary/70 p-2 rounded-lg text-primary">
                    <div className="flex items-center gap-1 pr-2 border-r border-color" title={`골드: ${gold.toLocaleString()}`}>
                        <img src="/images/Gold.png" alt="골드" className="w-5 h-5" />
                        <span className="font-bold text-sm">{gold.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1 pr-2 border-r border-color" title={`다이아: ${diamonds.toLocaleString()}`}>
                        <img src="/images/Zem.png" alt="다이아" className="w-5 h-5" />
                        <span className="font-bold text-sm">{diamonds.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1 pr-2 border-r border-color" title={`길드 코인: ${guildCoins.toLocaleString()}`}>
                        <img src="/images/guild/tokken.png" alt="Guild Coin" className="w-5 h-5" />
                        <span className="font-bold text-sm">{guildCoins.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1" title={`보스전 티켓: ${attemptsLeft}`}>
                        <img src="/images/guild/ticket.png" alt="Boss Ticket" className="w-5 h-5" />
                        <span className="font-bold text-sm">{attemptsLeft}</span>
                    </div>
                </div>
            </div>

            <main className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">
                <div className="w-full lg:w-1/4 flex flex-col gap-4">
                    <BossPanel boss={currentBoss} hp={simulatedBossHp} maxHp={currentBoss.maxHp} damageNumbers={bossDamageNumbers} />
                    <DamageRankingPanel damageRanking={top3DamageRanking} myRankData={myRankData} myCurrentBattleDamage={currentBattleDamage} />
                </div>
                
                <div className="flex-1 flex flex-col gap-4 min-h-0">
                    <div className="bg-panel border border-color rounded-lg p-4 flex flex-col h-1/2 min-h-[200px] lg:min-h-0">
                        <h3 className="text-xl font-bold mb-2 flex-shrink-0 text-center text-red-300">보스의 공격</h3>
                        <div ref={bossLogContainerRef} className="flex-grow overflow-y-auto pr-2 bg-tertiary/50 p-2 rounded-md space-y-2 text-sm">
                            {bossLogs.map((entry, index) => (
                                <div key={index} className="flex items-center gap-2 animate-fade-in">
                                    <span className="font-bold text-yellow-300 mr-2 flex-shrink-0">[{entry.turn}턴]</span>
                                    {entry.icon && <img src={entry.icon} alt="action" className="w-6 h-6 flex-shrink-0" />}
                                    <span>{entry.message}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                     <div className="bg-panel border border-color rounded-lg p-4 flex flex-col h-1/2 min-h-[200px] lg:min-h-0">
                        <h3 className="text-xl font-bold mb-2 flex-shrink-0 text-center text-blue-300">나의 공격</h3>
                        <div ref={userLogContainerRef} className="flex-grow overflow-y-auto pr-2 bg-tertiary/50 p-2 rounded-md space-y-2 text-sm">
                            {userLogs.map((entry, index) => (
                                <div key={index} className="flex items-center gap-2 animate-fade-in justify-start">
                                    <span className="font-bold text-yellow-300 mr-2 flex-shrink-0">[{entry.turn}턴]</span>
                                    {entry.icon && <img src={entry.icon} alt="action" className="w-6 h-6 flex-shrink-0" />}
                                    <span>{entry.message}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                
                <div className="w-full lg:w-1/3 flex-shrink-0 flex flex-col gap-4">
                    <UserStatsPanel 
                        user={currentUserWithStatus} 
                        guild={myGuild} 
                        hp={userHp} 
                        maxHp={maxUserHp} 
                        damageNumbers={damageNumbers}
                        onOpenEffects={() => handlers.openEquipmentEffectsModal()}
                        onOpenPresets={() => handlers.openPresetModal()}
                        isSimulating={isSimulating}
                        activeDebuffs={activeDebuffs}
                    />
                     <div className="flex-shrink-0 bg-panel border border-color rounded-lg p-3 space-y-2 text-center">
                         <Button
                            onClick={handleBattleStart}
                            disabled={attemptsLeft <= 0 || isSimulating}
                            className="w-full mt-3"
                         >
                             {isSimulating ? '전투 중...' : '도전하기'}
                         </Button>
                     </div>
                </div>
            </main>
        </div>
    );
};

export default GuildBoss;