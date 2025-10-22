import React from 'react';
import DraggableWindow from './DraggableWindow';
import Button from './Button';
import { QuestReward, InventoryItem } from '../types';
import { gradeStyles } from '../utils/itemDisplayUtils';
import { EQUIPMENT_POOL, CONSUMABLE_ITEMS } from '../constants/items';

const ALL_ITEMS = [...EQUIPMENT_POOL, ...CONSUMABLE_ITEMS];

interface QuestRewardSummaryModalProps {
    reward: QuestReward;
    onClose: () => void;
    isTopmost?: boolean;
}

const QuestRewardSummaryModal: React.FC<QuestRewardSummaryModalProps> = ({ reward, onClose, isTopmost }) => {
    return (
        <DraggableWindow title="퀘스트 보상" onClose={onClose} windowId="quest-reward-summary-modal" initialWidth={400} initialHeight={300} isTopmost={isTopmost}>
            <div className="p-4 flex flex-col items-center justify-center gap-4">
                <h3 className="text-2xl font-bold text-yellow-300">보상 획득!</h3>
                
                {reward.gold && (
                    <div className="flex items-center gap-2 text-primary text-lg">
                        <img src="/images/Gold.png" alt="골드" className="w-6 h-6" />
                        <span>골드: {reward.gold.toLocaleString()}</span>
                    </div>
                )}
                {reward.diamonds && (
                    <div className="flex items-center gap-2 text-primary text-lg">
                        <img src="/images/Diamond.png" alt="다이아" className="w-6 h-6" />
                        <span>다이아: {reward.diamonds.toLocaleString()}</span>
                    </div>
                )}
                {reward.exp && (
                    <div className="flex items-center gap-2 text-primary text-lg">
                        <img src="/images/icons/xp.png" alt="경험치" className="w-6 h-6" />
                        <span>{reward.exp.type === 'strategy' ? '전략' : '놀이'} 경험치: {reward.exp.amount.toLocaleString()}</span>
                    </div>
                )}
                {reward.guildCoins && (
                    <div className="flex items-center gap-2 text-primary text-lg">
                        <img src="/images/icons/guild_coin.png" alt="길드 코인" className="w-6 h-6" />
                        <span>길드 코인: {reward.guildCoins.toLocaleString()}</span>
                    </div>
                )}
                {reward.items && reward.items.length > 0 && (
                    <div className="w-full mt-2">
                        <h4 className="text-lg font-bold text-center text-blue-300 mb-2">아이템</h4>
                        <div className="grid grid-cols-3 gap-2">
                            {reward.items.map((item, index) => {
                                const itemDetails = 'itemId' in item ? ALL_ITEMS.find(i => i.name === item.itemId) : item;
                                if (!itemDetails) return null; // Handle case where itemDetails might not be found

                                return (
                                    <div key={index} className="flex flex-col items-center text-center">
                                        <img src={itemDetails.image || '/images/equipments/empty.png'} alt={itemDetails.name} className="w-12 h-12 object-contain" />
                                        <span className={`text-xs ${gradeStyles[itemDetails.grade]}`}>{itemDetails.name}</span>
                                        {item.quantity && item.quantity > 1 && <span className="text-xs text-gray-400">x{item.quantity}</span>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                {reward.bonus && (
                    <p className="text-yellow-300 text-sm font-bold">보너스: {reward.bonus}</p>
                )}

                <Button onClick={onClose} colorScheme="green" className="w-full mt-4">확인</Button>
            </div>
        </DraggableWindow>
    );
};

export default QuestRewardSummaryModal;
