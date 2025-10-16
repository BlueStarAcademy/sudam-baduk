import React from 'react';
import DraggableWindow from './DraggableWindow.js';
import { RANKING_TIERS, SEASONAL_TIER_REWARDS, CONSUMABLE_ITEMS } from '../constants/index.js';
// FIX: LeagueRewardTier is now defined in types/entities.ts and exported from types/index.js
import { QuestReward, LeagueRewardTier } from '../types/index.js';

interface TierInfoModalProps {
    onClose: () => void;
}

const TierInfoModal: React.FC<TierInfoModalProps> = ({ onClose }) => {
    const requirementMap: Record<string, string> = {
        '챌린저': '3000점 이상 & 상위 10명',
        '마스터': '2600점 이상',
        '다이아': '2200점 이상',
        '플래티넘': '2000점 이상',
        '골드': '1700점 이상',
        '실버': '1500점 이상',
        '브론즈': '1400점 이상',
        '루키': '1300점 이상',
        '새싹': '1300점 미만',
    };

    const getItemImage = (itemName: string): string | null => {
        if (itemName.includes('다이아')) return '/images/Zem.png';
        const item = CONSUMABLE_ITEMS.find(i => i.name === itemName);
        return item?.image || null;
    };

    const renderReward = (tierName: string) => {
        const reward: QuestReward | undefined = SEASONAL_TIER_REWARDS[tierName];
        if (!reward) return <span className="text-gray-500">보상 정보 없음</span>;
        
        const rewardsToShow: { name: string, image: string | null }[] = [];
        if (reward.diamonds) {
            rewardsToShow.push({ name: `${reward.diamonds.toLocaleString()}`, image: '/images/Zem.png' });
        }
        if (reward.items) {
            reward.items.forEach(item => {
                // Correctly handle union type for item references.
                const itemName = 'itemId' in item ? item.itemId : (item as any).name;
                const itemImage = getItemImage(itemName);
                // Handle optional quantity property on InventoryItem
                const quantity = 'quantity' in item ? (item.quantity ?? 1) : 1;
                rewardsToShow.push({ name: `${itemName} x${quantity}`, image: itemImage });
            });
        }

        return (
            <div className="flex items-center gap-2 flex-wrap">
                {rewardsToShow.map((r, index) => {
                    if (!r.image) return null;
                    const isUrl = r.image.startsWith('/');
                    return (
                        <div key={index} className="flex items-center gap-1.5 bg-gray-700/50 px-2 py-1 rounded-md" title={r.name}>
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
        );
    };

    return (
        <DraggableWindow title="시즌 랭킹 티어 안내" onClose={onClose} windowId="ranking-tier-info-modal" initialWidth={600}>
            <div className="space-y-4">
                <p className="text-sm text-gray-300">
                    각 게임 모드의 랭킹 점수에 따라 시즌 티어가 결정됩니다. 티어는 시즌 종료 시 랭킹 순위에 따라 확정되며, 보상이 지급됩니다.
                </p>

                <div className="bg-gray-900/50 p-3 rounded-lg">
                    <h4 className="font-bold text-lg text-yellow-300 mb-2">시즌 일정</h4>
                    <ul className="text-sm text-gray-300 space-y-1">
                        <li><span className="font-semibold">시즌 1:</span> 1월 1일 ~ 3월 31일</li>
                        <li><span className="font-semibold">시즌 2:</span> 4월 1일 ~ 6월 30일</li>
                        <li><span className="font-semibold">시즌 3:</span> 7월 1일 ~ 9월 30일</li>
                        <li><span className="font-semibold">시즌 4:</span> 10월 1일 ~ 12월 31일</li>
                    </ul>
                    <p className="text-xs text-gray-400 mt-2">
                        각 시즌 종료 시 랭킹이 초기화되고 보상이 지급됩니다.
                    </p>
                </div>

                <ul className="space-y-2 overflow-y-auto pr-2">
                    {RANKING_TIERS.map(tier => (
                        <li key={tier.name} className="p-3 bg-gray-900/50 rounded-lg">
                            <div className="flex items-center">
                                <img src={tier.icon} alt={tier.name} className="w-12 h-12 mr-4 flex-shrink-0" />
                                <div className="flex-grow">
                                    <p className={`font-bold text-lg ${tier.color}`}>{tier.name}</p>
                                    <p className="text-sm text-gray-400">{requirementMap[tier.name] || 'N/A'}</p>
                                </div>
                            </div>
                            <div className="mt-2 pt-2 border-t border-gray-700/50">
                                <h5 className="text-xs font-semibold text-gray-400 mb-1.5">시즌 종료 보상</h5>
                                {renderReward(tier.name)}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </DraggableWindow>
    );
};

export default TierInfoModal;