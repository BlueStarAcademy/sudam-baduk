import React, { useMemo, useState } from 'react';
// Import EquipmentSlot enum to use its members instead of string literals.
import { UserWithStatus, EquipmentSlot, InventoryItem, ItemGrade, GameMode } from '../types/index.js';
import Avatar from './Avatar.js';
import DraggableWindow from './DraggableWindow.js';
import { AVATAR_POOL, BORDER_POOL, emptySlotImages, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, LEAGUE_DATA, GRADE_LEVEL_REQUIREMENTS, RANKING_TIERS, SINGLE_PLAYER_STAGES } from '../constants/index.js';
// Update import path for manner functions from the missing utils/manner.js to the new services/manner.js.
import { getMannerScore, getMannerRank, getMannerStyle } from '../utils/mannerUtils.js';
import MbtiInfoModal from './MbtiInfoModal.js';

interface UserProfileModalProps {
  user: UserWithStatus;
  onClose: () => void;
  onViewItem: (item: InventoryItem, isOwnedByCurrentUser: boolean) => void;
  isTopmost?: boolean;
}

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

// FIX: Added XpBar component definition to resolve reference error.
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
                <div className={`${colorClass} h-full rounded-full`} style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
};

const StatsTab: React.FC<{ user: UserWithStatus, type: 'strategic' | 'playful' }> = ({ user, type }) => {
    const modes = type === 'strategic' ? SPECIAL_GAME_MODES : PLAYFUL_GAME_MODES;
    const stats = user.stats || {};
    
    let totalWins = 0;
    let totalLosses = 0;

    const gameStats = modes.map(m => {
        const s = stats[m.mode];
        if (s) {
            totalWins += s.wins;
            totalLosses += s.losses;
            return { mode: m.mode, ...s };
        }
        return { mode: m.mode, wins: 0, losses: 0, rankingScore: 1200 };
    });
    
    const totalGames = totalWins + totalLosses;
    const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

    return (
        <div className="space-y-3 text-xs">
            <div className="bg-gray-700/50 p-2 rounded-md text-center">
                <span className="font-bold">총 전적: {totalWins}승 {totalLosses}패 ({winRate}%)</span>
            </div>
            {gameStats.map(stat => {
                 if (stat.wins === 0 && stat.losses === 0) return null;
                 const gameTotal = stat.wins + stat.losses;
                 const gameWinRate = gameTotal > 0 ? Math.round((stat.wins / gameTotal) * 100) : 0;
                return (
                    <div key={stat.mode} className="flex justify-between items-center p-2 bg-gray-900/30 rounded">
                        <span className="font-semibold w-28">{stat.mode}</span>
                        <span className="w-24 text-center">{stat.wins}승 {stat.losses}패 ({gameWinRate}%)</span>
                        <span className="w-16 text-right font-mono text-yellow-300">{stat.rankingScore}점</span>
                    </div>
                )
            })}
        </div>
    );
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({ user, onClose, onViewItem, isTopmost }) => {
    const { inventory, stats, nickname, avatarId, borderId } = user;
    const [activeTab, setActiveTab] = useState<'strategic' | 'playful'>('strategic');
    const [showMbtiHelp, setShowMbtiHelp] = useState(false);
    
    const avatarUrl = useMemo(() => AVATAR_POOL.find(a => a.id === avatarId)?.url, [avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find(b => b.id === borderId)?.url, [borderId]);
    const leagueData = useMemo(() => LEAGUE_DATA.find(l => l.tier === user.league), [user.league]);

    const equippedItems = useMemo(() => {
        return (inventory || []).filter(item => item.isEquipped);
    }, [inventory]);

    const getItemForSlot = (slot: EquipmentSlot) => {
        return equippedItems.find(item => item.slot === slot);
    };

    const totalMannerScore = getMannerScore(user);
    const mannerRank = getMannerRank(totalMannerScore);
    const mannerStyle = getMannerStyle(totalMannerScore);

    return (
        <DraggableWindow title={`${nickname}님의 프로필`} onClose={onClose} windowId={`user-profile-${user.id}`} initialWidth={750} isTopmost={isTopmost}>
            {showMbtiHelp && <MbtiInfoModal onClose={() => setShowMbtiHelp(false)} isTopmost={true} />}
            <div className="flex flex-col md:flex-row gap-4 max-h-[calc(var(--vh,1vh)*70)]">
                {/* Left Column */}
                <div className="w-full md:w-1/3 flex-shrink-0 flex flex-col gap-4">
                    <div className="bg-gray-800/50 rounded-lg p-4 flex flex-col items-center text-center">
                        <Avatar userId={user.id} userName={nickname} size={80} avatarUrl={avatarUrl} borderUrl={borderUrl} />
                        <h2 className="text-xl font-bold mt-2">{nickname}</h2>
                        <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                            <span>매너: </span>
                            <span className={`font-semibold ${mannerRank.color}`}>{totalMannerScore}점 ({mannerRank.rank})</span>
                        </div>
                         <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                            <span>MBTI:</span>
                            <span className="font-semibold text-gray-200">
                                {user.isMbtiPublic && user.mbti ? user.mbti : '비공개'}
                            </span>
                            {user.isMbtiPublic && user.mbti && (
                                                                <button onClick={() => setShowMbtiHelp(true)} className="w-4 h-4 text-xs bg-gray-600 rounded-full text-white flex items-center justify-center hover:bg-gray-500">
                                    <img src="/images/button/help.png" alt="도움말" className="h-3" />
                                </button>
                            )}
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2.5 mt-2 border border-gray-900">
                            <div className={`${mannerStyle.colorClass} h-full rounded-full`} style={{ width: `${mannerStyle.percentage}%` }}></div>
                        </div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
                         <XpBar level={user.strategyLevel} currentXp={user.strategyXp} label="전략" colorClass="bg-gradient-to-r from-blue-500 to-cyan-400" />
                         <XpBar level={user.playfulLevel} currentXp={user.playfulXp} label="놀이" colorClass="bg-gradient-to-r from-yellow-500 to-orange-400" />
                    </div>
                    {leagueData && (
                        <div className="bg-gray-800/50 rounded-lg p-4 flex flex-col items-center text-center">
                             <img src={leagueData.icon} alt={leagueData.name} className="w-16 h-16" />
                             <h3 className="font-bold text-purple-300 mt-1">{leagueData.name}</h3>
                             <p className="text-sm text-gray-300">{user.tournamentScore.toLocaleString()} 점</p>
                        </div>
                    )}
                </div>

                {/* Right Column */}
                <div className="w-full md:w-2/3 flex flex-col gap-4">
                     <div className="bg-gray-800/50 rounded-lg p-4 flex-grow flex flex-col min-h-0">
                        <div className="flex bg-gray-900/70 p-1 rounded-lg mb-3 flex-shrink-0">
                            <button onClick={() => setActiveTab('strategic')} className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-all ${activeTab === 'strategic' ? 'bg-blue-600' : 'text-gray-400 hover:bg-gray-700/50'}`}>전략 전적</button>
                            <button onClick={() => setActiveTab('playful')} className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-all ${activeTab === 'playful' ? 'bg-yellow-600' : 'text-gray-400 hover:bg-gray-700/50'}`}>놀이 전적</button>
                        </div>
                        <div className="flex-grow overflow-y-auto pr-2">
                           {activeTab === 'strategic' ? <StatsTab user={user} type="strategic" /> : <StatsTab user={user} type="playful" />}
                        </div>
                     </div>
                     <div className="bg-gray-800/50 rounded-lg p-4 flex-shrink-0">
                        <h3 className="text-center font-semibold mb-3 text-gray-300">장착 장비</h3>
                        <div className="grid grid-cols-3 gap-3 w-full max-w-xs mx-auto">
                            {/* Replaced string literals with EquipmentSlot enum members. */}
                            <EquipmentSlotDisplay slot={EquipmentSlot.Fan} item={getItemForSlot(EquipmentSlot.Fan)} onClick={() => getItemForSlot(EquipmentSlot.Fan) && onViewItem(getItemForSlot(EquipmentSlot.Fan)!, false)} />
                            <EquipmentSlotDisplay slot={EquipmentSlot.Board} item={getItemForSlot(EquipmentSlot.Board)} onClick={() => getItemForSlot(EquipmentSlot.Board) && onViewItem(getItemForSlot(EquipmentSlot.Board)!, false)} />
                            <EquipmentSlotDisplay slot={EquipmentSlot.Top} item={getItemForSlot(EquipmentSlot.Top)} onClick={() => getItemForSlot(EquipmentSlot.Top) && onViewItem(getItemForSlot(EquipmentSlot.Top)!, false)} />
                            <EquipmentSlotDisplay slot={EquipmentSlot.Bottom} item={getItemForSlot(EquipmentSlot.Bottom)} onClick={() => getItemForSlot(EquipmentSlot.Bottom) && onViewItem(getItemForSlot(EquipmentSlot.Bottom)!, false)} />
                            <EquipmentSlotDisplay slot={EquipmentSlot.Bowl} item={getItemForSlot(EquipmentSlot.Bowl)} onClick={() => getItemForSlot(EquipmentSlot.Bowl) && onViewItem(getItemForSlot(EquipmentSlot.Bowl)!, false)} />
                            <EquipmentSlotDisplay slot={EquipmentSlot.Stones} item={getItemForSlot(EquipmentSlot.Stones)} onClick={() => getItemForSlot(EquipmentSlot.Stones) && onViewItem(getItemForSlot(EquipmentSlot.Stones)!, false)} />
                        </div>
                     </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default UserProfileModal;