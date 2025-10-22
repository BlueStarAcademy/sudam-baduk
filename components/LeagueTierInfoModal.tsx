import React from 'react';
import DraggableWindow from './DraggableWindow';
import { LEAGUE_DATA, LEAGUE_WEEKLY_REWARDS } from '../constants';
// FIX: LeagueRewardTier is now defined in types/entities.ts and exported from types/index.js
import { LeagueRewardTier } from '../types';

interface LeagueTierInfoModalProps {
    onClose: () => void;
    isTopmost?: boolean;
}

const LeagueTierInfoModal: React.FC<LeagueTierInfoModalProps> = ({ onClose, isTopmost }) => {

    const renderReward = (rewardTier: LeagueRewardTier) => {
        const rankText = rewardTier.rankStart === rewardTier.rankEnd
            ? `${rewardTier.rankStart}위`
            : `${rewardTier.rankStart}-${rewardTier.rankEnd}위`;

        let outcomeText = '';
        let outcomeColor = '';
        switch (rewardTier.outcome) {
            case 'promote':
                outcomeText = '승급';
                outcomeColor = 'text-green-400';
                break;
            case 'maintain':
                outcomeText = '잔류';
                outcomeColor = 'text-gray-400';
                break;
            case 'demote':
                outcomeText = '강등';
                outcomeColor = 'text-red-400';
                break;
        }

        return (
            <li key={rewardTier.rankStart} className="flex justify-between items-center bg-gray-700/50 px-3 py-1.5 rounded-md">
                <span className="font-semibold">{rankText}</span>
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-yellow-300">
                        <img src="/images/Zem.png" alt="다이아" className="w-4 h-4" />
                        {rewardTier.diamonds}
                    </span>
                    <span className={`font-bold w-12 text-center ${outcomeColor}`}>{outcomeText}</span>
                </div>
            </li>
        );
    };

    return (
        <DraggableWindow title="챔피언십 리그 안내" onClose={onClose} windowId="league-tier-info-modal" initialWidth={550} isTopmost={isTopmost}>
            <div className="space-y-4">
                <div className="bg-gray-900/50 p-3 rounded-lg">
                    <h4 className="font-bold text-lg text-yellow-300 mb-2">주간 경쟁 규칙</h4>
                    <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
                        <li>매주 월요일 00시, 같은 리그의 15명의 유저(플레이어 및 봇)와 함께 경쟁 그룹에 배정됩니다.</li>
                        <li>일주일간 자동대국 챔피언십에 참여하여 랭킹 점수를 획득하고, 경쟁자들 사이에서 순위를 높여야 합니다.</li>
                        <li><strong>1위 ~ 3위:</strong> 상위 리그로 승급</li>
                        <li><strong>4위 ~ 13위:</strong> 현재 리그 잔류</li>
                        <li><strong>14위 ~ 16위:</strong> 하위 리그로 강등</li>
                        <li>일주일간의 경쟁이 끝나면 티어와 순위에 따라 보상이 지급되고, 모든 유저의 챔피언십 점수는 500점으로 초기화됩니다.</li>
                    </ul>
                </div>

                <ul className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                    {LEAGUE_DATA.map(tierData => {
                        const rewards = LEAGUE_WEEKLY_REWARDS[tierData.tier];
                        return (
                            <li key={tierData.tier} className="p-3 bg-gray-900/50 rounded-lg">
                                <div className="flex items-center gap-4">
                                   <img src={tierData.icon} alt={tierData.name} className="w-12 h-12 flex-shrink-0" />
                                   <div>
                                     <h3 className="text-lg font-bold">{tierData.name}</h3>
                                   </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-gray-700/50">
                                   <h4 className="text-sm font-semibold text-gray-400 mb-1.5">주간 보상</h4>
                                   <ul className="space-y-1 text-xs">
                                       {rewards.map(renderReward)}
                                   </ul>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </DraggableWindow>
    );
};

export default LeagueTierInfoModal;