

import React from 'react';
import { Guild as GuildType, GuildMember, GuildMission } from '../../types/index.js';
import Button from '../Button.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import DraggableWindow from '../DraggableWindow.js';
import { calculateGuildMissionXp } from '../../utils/guildUtils.js';

interface GuildMissionsPanelProps {
    guild: GuildType;
    myMemberInfo: GuildMember | undefined;
    onClose: () => void;
}

const MissionItem: React.FC<{ mission: GuildMission; guildLevel: number; }> = ({ mission, guildLevel }) => {
    const { currentUserWithStatus } = useAppContext();
    const isComplete = mission.progress >= mission.target;
    const percentage = mission.target > 0 ? Math.min((mission.progress / mission.target) * 100, 100) : 100;
    
    const finalXp = calculateGuildMissionXp(mission.guildReward.guildXp, guildLevel);

    return (
        <div className="bg-secondary p-2 rounded-lg flex items-center gap-3">
            <div className="flex-grow min-w-0">
                <h4 className="font-bold truncate">{mission.title}</h4>
                <p className="text-xs text-tertiary truncate">{mission.description}</p>
                <div className="w-full bg-tertiary rounded-full h-2.5 mt-1">
                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                </div>
                <p className="text-xs text-right text-primary">{mission.progress.toLocaleString()} / {mission.target.toLocaleString()}</p>
            </div>
            <div className="w-36 text-center flex-shrink-0 flex flex-col items-center gap-1 relative">
                <div className="w-full flex flex-col items-center justify-center bg-tertiary/50 rounded-md p-1">
                    <p className="text-[10px] text-secondary">개인 보상 (우편 지급)</p>
                    <div className="flex items-center gap-1 text-sm font-semibold">
                         <img src="/images/guild/tokken.png" alt="Guild Coin" className="w-4 h-4" />
                        <span>{mission.personalReward.guildCoins}</span>
                    </div>
                </div>
                <div className="w-full flex flex-col items-center justify-center bg-tertiary/50 rounded-md p-1">
                    <p className="text-[10px] text-secondary">길드 보상</p>
                     <div className="flex items-center gap-1 text-sm font-semibold">
                         <span>XP</span>
                        <span className="text-green-400">+{finalXp.toLocaleString()}</span>
                    </div>
                </div>
                <Button
                    disabled={true}
                    colorScheme={isComplete ? 'green' : 'gray'}
                    className="w-full !text-sm !py-1"
                >
                    {isComplete ? '달성' : '진행 중'}
                </Button>
            </div>
        </div>
    );
};

const GuildMissionsPanel: React.FC<GuildMissionsPanelProps> = ({ guild, onClose }) => {
    return (
        <DraggableWindow title="주간 길드 임무" onClose={onClose} windowId="guild-missions" initialWidth={750}>
            <div className="flex flex-col">
                <div className="flex-shrink-0 mb-4">
                    <p className="text-sm text-tertiary">길드원들과 협력하여 임무를 완수하고 보상을 획득하세요. 완료 시 모든 길드원에게 보상이 우편으로 지급되며, 매주 월요일에 초기화됩니다.</p>
                </div>
                <div className="flex-grow overflow-y-auto pr-2 max-h-[calc(70vh-100px)]">
                    {guild.weeklyMissions && guild.weeklyMissions.length > 0 ? (
                        <ul className="space-y-2">
                            {guild.weeklyMissions.map(mission => (
                                <li key={mission.id}>
                                    <MissionItem mission={mission} guildLevel={guild.level} />
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-tertiary pt-8">진행 가능한 임무가 없습니다.</p>
                    )}
                </div>
            </div>
        </DraggableWindow>
    );
};

export default GuildMissionsPanel;