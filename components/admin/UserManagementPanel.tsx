import React, { useState, useMemo, useRef, useLayoutEffect, forwardRef } from 'react';
// FIX: Separate enum and type imports.
import { GameMode } from '../../types/index.js';
import type { User, ServerAction, AdminProps, Quest, DailyQuestData, WeeklyQuestData, MonthlyQuestData, CurrencyLog, Guild } from '../../types/index.js';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants/gameModes.js';

interface QuestCategoryPanelProps {
    title: string;
    questType: 'daily' | 'weekly' | 'monthly';
    questData: DailyQuestData | WeeklyQuestData | MonthlyQuestData | undefined;
    onQuestPropertyChange: (questType: 'daily' | 'weekly' | 'monthly', questId: string, field: 'progress' | 'isClaimed', value: number | boolean) => void;
    onActivityProgressChange: (questType: 'daily' | 'weekly' | 'monthly', value: number) => void;
    onMilestoneChange: (questType: 'daily' | 'weekly' | 'monthly', index: number, value: boolean) => void;
}

const QuestCategoryPanel = forwardRef<HTMLDivElement, QuestCategoryPanelProps>(({ title, questType, questData, onQuestPropertyChange, onActivityProgressChange, onMilestoneChange }, ref) => (
    <div className="bg-tertiary/50 p-3 rounded-lg">
        <h3 className="font-bold text-lg text-highlight mb-2">{title}</h3>
        <div className="flex items-center gap-2 mb-2">
            <label className="text-sm font-medium text-secondary whitespace-nowrap">활약도:</label>
            <input type="number" value={questData?.activityProgress || 0} onChange={e => onActivityProgressChange(questType, parseInt(e.target.value, 10) || 0)} className="bg-secondary p-1 rounded w-full" />
        </div>
        <div className="flex items-center gap-2 mb-3">
            <label className="text-sm font-medium text-secondary whitespace-nowrap">마일스톤:</label>
            <div className="flex gap-2 flex-wrap">
                {Array.from({ length: 5 }).map((_, i) => (
                    <label key={i} className="flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={questData?.claimedMilestones?.[i] || false} onChange={e => onMilestoneChange(questType, i, e.target.checked)} className="w-4 h-4" />
                        {i+1}
                    </label>
                ))}
            </div>
        </div>
        <div ref={ref} className="space-y-2 max-h-48 overflow-y-auto pr-2 border-t border-color pt-2">
            {(questData?.quests || []).map((q: Quest, i: number) => (
                <div key={q.id || i} className="bg-secondary p-2 rounded text-xs">
                    <p className="truncate font-semibold" title={q.title}>{q.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <label>P:</label>
                        <input
                            type="number"
                            value={q.progress}
                            onChange={(e) => onQuestPropertyChange(questType, q.id, 'progress', parseInt(e.target.value) || 0)}
                            className="w-full bg-tertiary rounded p-0.5"
                        />
                        <label>C:</label>
                        <input
                            type="checkbox"
                            checked={q.isClaimed}
                            onChange={(e) => onQuestPropertyChange(questType, q.id, 'isClaimed', e.target.checked)}
                            className="w-4 h-4"
                        />
                    </div>
                </div>
            ))}
        </div>
    </div>
));


interface UserManagementModalProps {
    user: User;
    currentUser: User;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
    guilds: Record<string, Guild>;
}

const UserManagementModal: React.FC<UserManagementModalProps> = ({ user, currentUser, onClose, onAction, guilds }) => {
    const [editedUser, setEditedUser] = useState<User>(JSON.parse(JSON.stringify(user)));
    const [activeTab, setActiveTab] = useState<'general' | 'strategic' | 'playful' | 'quests' | 'currency' | 'danger' | 'currencyLog'>('general');
    const [apToGrant, setApToGrant] = useState(10);

    const dailyScrollRef = useRef<HTMLDivElement>(null);
    const weeklyScrollRef = useRef<HTMLDivElement>(null);
    const monthlyScrollRef = useRef<HTMLDivElement>(null);
    const scrollPositionsToRestore = useRef<{ daily?: number; weekly?: number; monthly?: number }>({});
    
    const myGuild = user.guildId ? guilds[user.guildId] : null;


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value }: { name: string; value: string | number } = e.target;
        setEditedUser(prev => ({ ...prev, [name]: Number(value) }));
    };

    const handleTextInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setEditedUser(prev => ({ ...prev, [name]: value }));
    };
    
    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setEditedUser(prev => ({ ...prev, [name]: checked }));
    };

    const handleStatChange = (mode: GameMode, value: string) => {
        setEditedUser(prev => {
            const newStats = {
                ...prev.stats,
                [mode]: {
                    ...(prev.stats[mode] || { wins: 0, losses: 0, rankingScore: 1200 }),
                    rankingScore: Number(value),
                },
            };
            return { ...prev, stats: newStats };
        });
    };

    const handleApCurrentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value } = e.target;
        setEditedUser(prev => ({ 
            ...prev, 
            actionPoints: { 
                ...prev.actionPoints, 
                current: Number(value) 
            } 
        }));
    };

    const handleGrantAp = () => {
        if (apToGrant > 0) {
            onAction({ type: 'ADMIN_GIVE_ACTION_POINTS', payload: { targetUserId: user.id, amount: apToGrant } });
            // Optimistic update
            setEditedUser(prev => ({
                ...prev,
                actionPoints: {
                    ...prev.actionPoints,
                    current: prev.actionPoints.current + apToGrant
                }
            }));
            setApToGrant(10); // Reset for next grant
        }
    };

    const handleQuestPropertyChange = (questType: 'daily' | 'weekly' | 'monthly', questId: string, field: 'progress' | 'isClaimed', value: number | boolean) => {
        const ref = questType === 'daily' ? dailyScrollRef : questType === 'weekly' ? weeklyScrollRef : monthlyScrollRef;
        if (ref.current) {
            scrollPositionsToRestore.current[questType] = ref.current.scrollTop;
        }
        setEditedUser(prev => {
            const newQuests = JSON.parse(JSON.stringify(prev.quests || {}));
            if (newQuests[questType] && newQuests[questType].quests) {
                const quest = newQuests[questType].quests.find((q: Quest) => q.id === questId);
                if (quest) {
                    (quest as any)[field] = value;
                }
            }
            return { ...prev, quests: newQuests };
        });
    };

    const handleActivityProgressChange = (questType: 'daily' | 'weekly' | 'monthly', value: number) => {
        const ref = questType === 'daily' ? dailyScrollRef : questType === 'weekly' ? weeklyScrollRef : monthlyScrollRef;
        if (ref.current) {
            scrollPositionsToRestore.current[questType] = ref.current.scrollTop;
        }
        setEditedUser(prev => {
            const newQuests = JSON.parse(JSON.stringify(prev.quests || {}));
            if (newQuests[questType]) {
                newQuests[questType].activityProgress = value;
            } else if (!newQuests[questType]) {
                newQuests[questType] = { quests: [], activityProgress: value, claimedMilestones: [false,false,false,false,false], lastReset: 0 };
            }
            return { ...prev, quests: newQuests };
        });
    };

    const handleMilestoneChange = (questType: 'daily' | 'weekly' | 'monthly', index: number, value: boolean) => {
        const ref = questType === 'daily' ? dailyScrollRef : questType === 'weekly' ? weeklyScrollRef : monthlyScrollRef;
        if (ref.current) {
            scrollPositionsToRestore.current[questType] = ref.current.scrollTop;
        }
        setEditedUser(prev => {
            const newQuests = JSON.parse(JSON.stringify(prev.quests || {}));
            if (newQuests[questType] && newQuests[questType].claimedMilestones) {
                newQuests[questType].claimedMilestones[index] = value;
            }
            return { ...prev, quests: newQuests };
        });
    };
    
    useLayoutEffect(() => {
        if (scrollPositionsToRestore.current.daily !== undefined && dailyScrollRef.current) {
            dailyScrollRef.current.scrollTop = scrollPositionsToRestore.current.daily;
            delete scrollPositionsToRestore.current.daily;
        }
        if (scrollPositionsToRestore.current.weekly !== undefined && weeklyScrollRef.current) {
            weeklyScrollRef.current.scrollTop = scrollPositionsToRestore.current.weekly;
            delete scrollPositionsToRestore.current.weekly;
        }
        if (scrollPositionsToRestore.current.monthly !== undefined && monthlyScrollRef.current) {
            monthlyScrollRef.current.scrollTop = scrollPositionsToRestore.current.monthly;
            delete scrollPositionsToRestore.current.monthly;
        }
    });


    const handleSave = () => {
        onAction({ type: 'ADMIN_UPDATE_USER_DETAILS', payload: { targetUserId: user.id, updatedDetails: editedUser } });
        onClose();
    };

    const handleReset = (resetType: 'stats' | 'full') => {
        const message = resetType === 'full' ? `정말로 [${user.nickname}] 님의 레벨과 모든 전적을 초기화하시겠습니까?` : `정말로 [${user.nickname}] 님의 모든 전적을 초기화하시겠습니까?`;
        if (window.confirm(message)) {
            onAction({ type: 'ADMIN_RESET_USER_DATA', payload: { targetUserId: user.id, resetType } });
        }
    };

    const handleDelete = () => {
        if (window.confirm(`정말로 [${user.nickname}] 님의 계정을 삭제하시겠습니까?`)) {
            onAction({ type: 'ADMIN_DELETE_USER', payload: { targetUserId: user.id } });
            onClose();
        }
    };

    const renderStatInputs = (modes: ReadonlyArray<{ mode: GameMode }>) => (
        <div className="space-y-2">
            {modes.map(({ mode }) => (
                <div key={mode} className="grid grid-cols-2 gap-2 items-center">
                    <label className="text-secondary col-span-1">{mode}</label>
                    <input type="number" value={editedUser.stats?.[mode]?.rankingScore ?? 1200} onChange={e => handleStatChange(mode, e.target.value)} className="bg-tertiary p-1 rounded col-span-1" />
                </div>
            ))}
        </div>
    );
    
    const CurrencyLogPanel: React.FC<{ logs: CurrencyLog[] }> = ({ logs }) => {
        const typeMap = {
            gold_gain: { text: '골드 획득', color: 'text-green-400' },
            gold_spend: { text: '골드 사용', color: 'text-red-400' },
            diamond_gain: { text: '다이아 획득', color: 'text-green-400' },
            diamond_spend: { text: '다이아 사용', color: 'text-red-400' },
        };

        return (
             <div className="space-y-2">
                <h3 className="font-bold text-lg text-highlight mb-2">재화 사용 기록 (최근 7일)</h3>
                <div className="max-h-96 overflow-y-auto pr-2 bg-tertiary/50 p-2 rounded-lg">
                    {logs && logs.length > 0 ? (
                        <table className="w-full text-xs text-left">
                            <thead className="sticky top-0 bg-secondary">
                                <tr>
                                    <th className="p-1.5">시간</th>
                                    <th className="p-1.5">종류</th>
                                    <th className="p-1.5 text-right">수량</th>
                                    <th className="p-1.5">사유</th>
                                    <th className="p-1.5 text-right">잔액 (골드/다이아)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map(log => {
                                    const typeInfo = typeMap[log.type];
                                    return (
                                        <tr key={log.timestamp + log.reason + log.amount} className="border-b border-color/50">
                                            <td className="p-1.5 whitespace-nowrap">{new Date(log.timestamp).toLocaleString('ko-KR')}</td>
                                            <td className={`p-1.5 font-semibold ${typeInfo.color}`}>{typeInfo.text}</td>
                                            <td className={`p-1.5 text-right font-mono ${typeInfo.color}`}>
                                                {log.type.includes('gain') ? '+' : '-'}{log.amount.toLocaleString()}
                                            </td>
                                            <td className="p-1.5 max-w-xs truncate" title={log.reason}>{log.reason}</td>
                                            <td className="p-1.5 text-right font-mono">
                                                {log.balanceAfter.gold.toLocaleString()} / {log.balanceAfter.diamonds.toLocaleString()}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <p className="text-center text-tertiary py-8">재화 기록이 없습니다.</p>
                    )}
                </div>
            </div>
        )
    };

    return (
        <DraggableWindow title={`사용자 수정: ${user.nickname}`} onClose={onClose} windowId={`user-edit-${user.id}`} initialWidth={800}>
            <div className="h-full flex flex-col">
                <div className="flex bg-tertiary/70 p-1 rounded-lg mb-4 flex-shrink-0">
                    <button onClick={() => setActiveTab('general')} className={`flex-1 py-2 text-sm font-semibold rounded-md ${activeTab === 'general' ? 'bg-accent' : 'text-tertiary'}`}>일반</button>
                    <button onClick={() => setActiveTab('strategic')} className={`flex-1 py-2 text-sm font-semibold rounded-md ${activeTab === 'strategic' ? 'bg-accent' : 'text-tertiary'}`}>전략</button>
                    <button onClick={() => setActiveTab('playful')} className={`flex-1 py-2 text-sm font-semibold rounded-md ${activeTab === 'playful' ? 'bg-accent' : 'text-tertiary'}`}>놀이</button>
                    <button onClick={() => setActiveTab('quests')} className={`flex-1 py-2 text-sm font-semibold rounded-md ${activeTab === 'quests' ? 'bg-accent' : 'text-tertiary'}`}>퀘스트</button>
                    <button onClick={() => setActiveTab('currency')} className={`flex-1 py-2 text-sm font-semibold rounded-md ${activeTab === 'currency' ? 'bg-accent' : 'text-tertiary'}`}>재화</button>
                    <button onClick={() => setActiveTab('currencyLog')} className={`flex-1 py-2 text-sm font-semibold rounded-md ${activeTab === 'currencyLog' ? 'bg-accent' : 'text-tertiary'}`}>재화 기록</button>
                    <button onClick={() => setActiveTab('danger')} className={`flex-1 py-2 text-sm font-semibold rounded-md ${activeTab === 'danger' ? 'bg-accent' : 'text-tertiary'}`}>위험</button>
                </div>
                <div className="flex-grow overflow-y-auto pr-2">
                    {activeTab === 'general' && (
                        <div className="space-y-3">
                             <div className="flex justify-between items-center">
                                <label className="text-sm font-medium text-secondary">닉네임</label>
                                <input type="text" name="nickname" value={editedUser.nickname} onChange={handleTextInputChange} className="w-2/3 bg-tertiary p-1 rounded" />
                            </div>
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-medium text-secondary">길드</label>
                                <span className="text-sm font-semibold text-primary truncate">{myGuild ? myGuild.name : '소속 길드 없음'}</span>
                            </div>
                             <div className="flex justify-between items-center">
                                <label className="text-sm font-medium text-secondary">관리자</label>
                                <input type="checkbox" name="isAdmin" checked={editedUser.isAdmin} onChange={handleCheckboxChange} className="w-5 h-5" />
                            </div>
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-medium text-secondary">전략 레벨</label>
                                <input type="number" name="strategyLevel" value={editedUser.strategyLevel} onChange={handleInputChange} className="w-24 bg-tertiary p-1 rounded" />
                            </div>
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-medium text-secondary">전략 XP</label>
                                <input type="number" name="strategyXp" value={editedUser.strategyXp} onChange={handleInputChange} className="w-24 bg-tertiary p-1 rounded" />
                            </div>
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-medium text-secondary">놀이 레벨</label>
                                <input
                                    type="number"
                                    name="playfulLevel"
                                    value={editedUser.playfulLevel}
                                    onChange={handleInputChange}
                                    className="w-24 bg-tertiary p-1 rounded"
                                />
                            </div>
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-medium text-secondary">놀이 XP</label>
                                <input type="number" name="playfulXp" value={editedUser.playfulXp} onChange={handleInputChange} className="w-24 bg-tertiary p-1 rounded" />
                            </div>
                        </div>
                    )}
                     {activeTab === 'strategic' && renderStatInputs(SPECIAL_GAME_MODES)}
                     {activeTab === 'playful' && renderStatInputs(PLAYFUL_GAME_MODES)}
                     {activeTab === 'quests' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <QuestCategoryPanel ref={dailyScrollRef} title="일일 퀘스트" questType="daily" questData={editedUser.quests?.daily} onQuestPropertyChange={handleQuestPropertyChange} onActivityProgressChange={handleActivityProgressChange} onMilestoneChange={handleMilestoneChange} />
                            <QuestCategoryPanel ref={weeklyScrollRef} title="주간 퀘스트" questType="weekly" questData={editedUser.quests?.weekly} onQuestPropertyChange={handleQuestPropertyChange} onActivityProgressChange={handleActivityProgressChange} onMilestoneChange={handleMilestoneChange} />
                            <QuestCategoryPanel ref={monthlyScrollRef} title="월간 퀘스트" questType="monthly" questData={editedUser.quests?.monthly} onQuestPropertyChange={handleQuestPropertyChange} onActivityProgressChange={handleActivityProgressChange} onMilestoneChange={handleMilestoneChange} />
                        </div>
                    )}
                     {activeTab === 'currency' && (
                         <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-medium text-secondary">골드</label>
                                <input type="number" name="gold" value={editedUser.gold} onChange={handleInputChange} className="w-24 bg-tertiary p-1 rounded" />
                            </div>
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-medium text-secondary">다이아</label>
                                <input type="number" name="diamonds" value={editedUser.diamonds} onChange={handleInputChange} className="w-24 bg-tertiary p-1 rounded" />
                            </div>
                             <div className="flex justify-between items-center">
                                <label className="text-sm font-medium text-secondary">길드 코인</label>
                                <input type="number" name="guildCoins" value={editedUser.guildCoins || 0} onChange={handleInputChange} className="w-24 bg-tertiary p-1 rounded" />
                            </div>
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-medium text-secondary">행동력</label>
                                <input type="number" name="actionPoints.current" value={editedUser.actionPoints.current} onChange={handleApCurrentChange} className="w-24 bg-tertiary p-1 rounded" />
                            </div>
                            <div className="flex justify-between items-center pt-4 border-t border-color">
                                <label className="text-sm font-medium text-secondary">행동력 지급</label>
                                <div className="flex items-center gap-2">
                                    <input type="number" value={apToGrant} onChange={e => setApToGrant(parseInt(e.target.value, 10) || 0)} className="w-20 bg-tertiary p-1 rounded" />
                                    <Button onClick={handleGrantAp} colorScheme="green" className="!text-xs">지급</Button>
                                </div>
                            </div>
                             <div className="flex justify-between items-center">
                                <label className="text-sm font-medium text-secondary">매너 점수</label>
                                <input type="number" name="mannerScore" value={editedUser.mannerScore} onChange={handleInputChange} className="w-24 bg-tertiary p-1 rounded" />
                            </div>
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-medium text-secondary">길드 보스 도전</label>
                                <input type="number" name="guildBossAttempts" value={editedUser.guildBossAttempts || 0} onChange={handleInputChange} className="w-24 bg-tertiary p-1 rounded" />
                            </div>
                        </div>
                    )}
                    {activeTab === 'currencyLog' && (
                        <CurrencyLogPanel logs={editedUser.currencyLogs || []} />
                    )}
                    {activeTab === 'danger' && (
                        <div className="space-y-4">
                            <Button onClick={() => handleReset('stats')} colorScheme="yellow" className="w-full">전적 초기화</Button>
                            <Button onClick={() => handleReset('full')} colorScheme="orange" className="w-full">레벨 & 전적 초기화</Button>
                            <Button onClick={handleDelete} colorScheme="red" className="w-full" disabled={user.isAdmin || user.id === currentUser.id}>계정 삭제</Button>
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-4 mt-4 pt-4 border-t border-color flex-shrink-0">
                    <Button onClick={onClose} colorScheme="gray">취소</Button>
                    <Button onClick={handleSave} colorScheme="green">저장</Button>
                </div>
            </div>
        </DraggableWindow>
    );
};


const UserManagementPanel: React.FC<AdminProps> = ({ allUsers, currentUser, onAction, onBack, guilds }) => {
    const [filter, setFilter] = useState('');
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    const filteredUsers = useMemo(() => {
        return allUsers
            .filter(u => u.nickname.toLowerCase().includes(filter.toLowerCase()) || u.username.toLowerCase().includes(filter.toLowerCase()))
            .sort((a,b) => a.nickname.localeCompare(b.nickname));
    }, [allUsers, filter]);

    return (
        <div className="bg-primary text-primary">
            {selectedUser && <UserManagementModal user={selectedUser} currentUser={currentUser} onClose={() => setSelectedUser(null)} onAction={onAction} guilds={guilds} />}
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">사용자 관리</h1>
                <Button onClick={onBack} colorScheme="gray">&larr; 대시보드로</Button>
            </header>
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="닉네임 또는 아이디로 검색..."
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    className="w-full bg-secondary border border-color p-3 rounded-lg"
                />
            </div>
            <div className="bg-panel border border-color p-4 rounded-lg shadow-lg">
                <div className="max-h-[60vh] overflow-y-auto">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[768px] text-sm text-left text-secondary">
                            <thead className="text-xs text-secondary uppercase bg-secondary sticky top-0">
                                <tr>
                                    <th scope="col" className="px-4 py-3">닉네임</th>
                                    <th scope="col" className="px-4 py-3">아이디</th>
                                    <th scope="col" className="px-4 py-3">레벨(전략/놀이)</th>
                                    <th scope="col" className="px-4 py-3">골드/다이아</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map(user => (
                                    <tr 
                                        key={user.id} 
                                        onClick={() => setSelectedUser(user)}
                                        className="bg-primary border-b border-color hover:bg-secondary/50 cursor-pointer"
                                    >
                                        <td className="px-4 py-4 font-medium text-primary whitespace-nowrap">{user.nickname}</td>
                                        <td className="px-4 py-4">{user.username}</td>
                                        <td className="px-4 py-4">{user.strategyLevel}/{user.playfulLevel}</td>
                                        <td className="px-4 py-4">{user.gold.toLocaleString()}/{user.diamonds.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserManagementPanel;