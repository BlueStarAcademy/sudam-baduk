import React, { useMemo } from 'react';
import { LiveGameSession, GameType, QuestReward, InventoryItem, UserWithStatus } from '../../types/index.js';
// FIX: Corrected import path for CONSUMABLE_ITEMS.
import { SINGLE_PLAYER_STAGES, CONSUMABLE_ITEMS } from '../../constants/index.js';

interface RewardDisplayProps {
    reward: QuestReward;
    title: string;
}

const RewardDisplay: React.FC<RewardDisplayProps> = ({ reward, title }) => {
    const renderRewardItem = (itemRef: InventoryItem | { itemId: string; quantity: number }, index: number) => {
        const itemName = 'itemId' in itemRef ? itemRef.itemId : itemRef.name;
        const quantity = 'quantity' in itemRef ? itemRef.quantity : 1;
        const itemTemplate = CONSUMABLE_ITEMS.find(ci => ci.name === itemName);
        if (!itemTemplate?.image) return null;
        const titleText = `${itemName} x${quantity}`;
        return (
            <div key={index} className="flex items-center" title={titleText}>
                <img src={itemTemplate.image} alt={itemName} className="w-5 h-5 object-contain" />
            </div>
        );
    };

    return (
        <div className="text-center">
            <h4 className="text-[10px] text-yellow-400 font-semibold">{title}</h4>
            <div className="flex items-center flex-wrap justify-center gap-x-1.5 mt-1">
                {(reward.gold ?? 0) > 0 &&
                    <span className="flex items-center gap-0.5 text-xs" title={`골드 ${reward.gold}`}>
                        <img src="/images/Gold.png" alt="골드" className="w-3 h-3" />
                        {reward.gold}
                    </span>
                }
                {(reward.exp?.amount ?? 0) > 0 &&
                     <span className="flex items-center gap-0.5 text-xs" title={`경험치 ${reward.exp!.amount}`}>
                        <span className="text-sm">⭐</span> {reward.exp!.amount}
                    </span>
                }
                {reward.items?.map(renderRewardItem)}
                {reward.bonus && 
                    <span className="flex items-center gap-0.5" title={`보너스 스탯 ${reward.bonus.replace('스탯', '')}`}>
                        <img src="/images/icons/stat_point.png" alt="Stat Point" className="w-4 h-4" />
                        {reward.bonus.replace('스탯', '')}
                    </span>
                }
            </div>
        </div>
    );
};

const gameTypeKorean: Record<GameType, string> = {
    [GameType.Standard]: '클래식',
    'capture': '따내기',
    'survival': '살리기',
    'speed': '스피드',
    'missile': '미사일',
    'hidden': '히든'
};

interface SinglePlayerInfoPanelProps {
    session: LiveGameSession;
    onOpenSettings: () => void;
    currentUser: UserWithStatus;
}

const SinglePlayerInfoPanel: React.FC<SinglePlayerInfoPanelProps> = ({ session, currentUser, onOpenSettings }) => {
    const { settings, stageId, blackStoneLimit, blackStonesPlaced, gameType } = session;
    const stageInfo = useMemo(() => SINGLE_PLAYER_STAGES.find(s => s.id === stageId), [stageId]);

    const stageDisplayName = useMemo(() => {
        if (!stageInfo) return stageId || '알 수 없는 스테이지';
        return `${stageInfo.id} 스테이지`;
    }, [stageInfo, stageId]);

    const isCleared = useMemo(() => {
        if (!stageInfo) return false;
        return currentUser.claimedFirstClearRewards?.includes(stageInfo.id) ?? false;
    }, [currentUser.claimedFirstClearRewards, stageInfo]);
    
    const rewards = isCleared ? stageInfo?.rewards.repeatClear : stageInfo?.rewards.firstClear;
    const rewardTitle = isCleared ? "반복 클리어 보상" : "최초 클리어 보상";

    return (
        <div className="bg-stone-800/60 backdrop-blur-sm p-3 rounded-md flex-shrink-0 border border-stone-700/50 text-stone-300">
            <h3 className="text-base font-bold border-b border-stone-600/50 pb-1 mb-2 text-amber-300 text-center flex justify-between items-center">
                <span>대국 정보</span>
                <button onClick={onOpenSettings} className="p-1 rounded-full text-lg hover:bg-black/20 transition-colors" title="설정">⚙️</button>
            </h3>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                <div className="font-semibold text-stone-400">스테이지:</div>
                <div>{stageDisplayName}</div>
                <div className="font-semibold text-stone-400">판 크기:</div>
                <div>{settings.boardSize}x{settings.boardSize}</div>
                
                {stageInfo?.targetScore ? (
                    <>
                        <div className="font-semibold text-stone-400">목표 점수:</div>
                        <div>흑{stageInfo.targetScore.black} / 백{stageInfo.targetScore.white}</div>
                    </>
                ) : stageInfo?.autoEndTurnCount ? (
                    <>
                        <div className="font-semibold text-stone-400">종료 조건:</div>
                        <div>{stageInfo.autoEndTurnCount}수 후 자동 계가</div>
                    </>
                ) : null}
                
                {rewards && (
                    <div className="col-span-2 mt-1 pt-1 border-t border-stone-600/50">
                        <RewardDisplay reward={rewards} title={rewardTitle} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default SinglePlayerInfoPanel;