import React from 'react';
import DraggableWindow from './DraggableWindow.js';
import { TOWER_RANKING_REWARDS } from '../constants/towerChallengeConstants.js';
// FIX: LeagueRewardTier is now defined in types/entities.ts and exported from types/index.js
import { LeagueRewardTier } from '../types.js';
import { CONSUMABLE_ITEMS } from '../constants.js';

interface TowerRankingRewardsModalProps {
    onClose: () => void;
    isTopmost?: boolean;
}

const TowerRankingRewardsModal: React.FC<TowerRankingRewardsModalProps> = ({ onClose, isTopmost }) => {
    const getItemImage = (itemName: string): string | null => {
        if (itemName.includes('다이아')) return '/images/Zem.png';
        const item = CONSUMABLE_ITEMS.find(i => i.name === itemName);
        return item?.image || null;
    };

    const renderReward = (rewardTier: LeagueRewardTier) => {
        const rankText = rewardTier.rankEnd === Infinity
            ? `${rewardTier.rankStart}위 ~`
            : (rewardTier.rankStart === rewardTier.rankEnd
                ? `${rewardTier.rankStart}위`
                : `${rewardTier.rankStart}-${rewardTier.rankEnd}위`);

        const rewardsToShow: { name: string, image: string | null }[] = [];
        if (rewardTier.diamonds) {
            rewardsToShow.push({ name: `${rewardTier.diamonds.toLocaleString()}`, image: '/images/Zem.png' });
        }
        if (rewardTier.strategyXp) {
            rewardsToShow.push({ name: `${rewardTier.strategyXp.toLocaleString()} XP`, image: '⭐' });
        }
        if (rewardTier.items) {
            rewardTier.items.forEach(item => {
                const itemName = 'itemId' in item ? item.itemId : (item as any).name;
                const itemImage = getItemImage(itemName);
                rewardsToShow.push({ name: `${itemName} x${item.quantity}`, image: itemImage });
            });
        }
        
        return (
            <li key={rewardTier.rankStart} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-700/50 px-3 py-2 rounded-md">
                <span className="font-bold text-lg text-yellow-300 w-28 flex-shrink-0">{rankText}</span>
                <div className="flex items-center gap-2 flex-wrap mt-1 sm:mt-0">
                    {rewardsToShow.map((r, index) => {
                        if (!r.image) return null;
                        const isUrl = r.image.startsWith('/');
                        return (
                            <div key={index} className="flex items-center gap-1.5 bg-gray-800/50 px-2 py-1 rounded-md" title={r.name}>
                                {isUrl ? (
                                    <img src={r.image} alt={r.name} className="w-5 h-5 object-contain" />
                                ) : (
                                    <span className="text-lg">{r.image}</span>
                                )}
                                <span className="text-gray-300 whitespace-nowrap text-xs">{r.name}</span>
                            </div>
                        );
                    })}
                </div>
            </li>
        );
    };

    return (
        <DraggableWindow title="도전의 탑 월간 랭킹 보상" onClose={onClose} windowId="tower-ranking-rewards-modal" initialWidth={550} isTopmost={isTopmost}>
            <div className="space-y-4">
                <p className="text-sm text-gray-300 text-center">
                    매월 1일 00시에 랭킹이 초기화되며, 최종 순위에 따라 보상이 우편으로 지급됩니다.
                </p>
                <ul className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                    {TOWER_RANKING_REWARDS.map(renderReward)}
                </ul>
            </div>
        </DraggableWindow>
    );
};

export default TowerRankingRewardsModal;
