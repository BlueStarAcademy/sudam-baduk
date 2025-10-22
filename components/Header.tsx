import React, { useEffect, useMemo, useState } from 'react';
import { UserWithStatus } from '../types';
import Button from './Button';
import Avatar from './Avatar';
import { getMannerEffects } from '../utils/mannerUtils';
import { AVATAR_POOL, BORDER_POOL } from '../constants';
import { useAppContext } from '../hooks/useAppContext';

const ResourceDisplay: React.FC<{ icon: React.ReactNode; value: string; className?: string }> = ({ icon, value, className }) => (
    <div className={`flex items-center gap-0.5 sm:gap-2 bg-tertiary/50 rounded-full py-0.5 pl-0.5 pr-1 shadow-inner ${className}`}>
        <div className="bg-primary w-5 h-5 flex items-center justify-center rounded-full text-sm flex-shrink-0">{icon}</div>
        <span className="font-bold text-xs text-primary">{value}</span>
    </div>
);

const ActionPointTimer: React.FC<{ user: UserWithStatus }> = ({ user }) => {
    const { actionPoints, lastActionPointUpdate } = user;
    const [timeLeft, setTimeLeft] = useState('');
    
    const regenInterval = useMemo(() => getMannerEffects(user).actionPointRegenInterval, [user]);

    useEffect(() => {
        if (actionPoints.current >= actionPoints.max) {
            setTimeLeft('');
            return;
        }

        const updateTimer = () => {
            const nextRegenTime = lastActionPointUpdate + regenInterval;
            const remainingMs = Math.max(0, nextRegenTime - Date.now());
            const totalSeconds = Math.floor(remainingMs / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            setTimeLeft(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
        };

        updateTimer();
        const intervalId = setInterval(updateTimer, 1000);
        return () => clearInterval(intervalId);
    }, [actionPoints.current, actionPoints.max, lastActionPointUpdate, regenInterval]);

    if (!timeLeft) return null;

    return <span className="text-xs text-tertiary font-mono text-center">({timeLeft})</span>;
};


const Header: React.FC = () => {
    const { currentUserWithStatus, handlers } = useAppContext();

    if (!currentUserWithStatus) return null;

    const { handleLogout, openShop, openSettingsModal } = handlers;
    const { actionPoints, gold, diamonds, isAdmin, avatarId, borderId } = currentUserWithStatus;
    
    const avatarUrl = useMemo(() => AVATAR_POOL.find(a => a.id === avatarId)?.url, [avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find(b => b.id === borderId)?.url, [borderId]);

    return (
        <header className="flex-shrink-0 bg-primary/80 backdrop-blur-sm shadow-lg border-b border-color">
            <div className="p-1 flex justify-between items-center gap-2 sm:gap-4 h-[60px] flex-nowrap">
                <div className="flex items-center gap-1 sm:gap-3 flex-shrink min-w-0">
                     <Avatar userId={currentUserWithStatus.id} userName={currentUserWithStatus.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={40} />
                     <div className="hidden sm:block min-w-0">
                        <h1 className="font-bold text-primary truncate">{currentUserWithStatus.nickname}</h1>
                        <p className="text-xs text-tertiary truncate">전략 Lv.{currentUserWithStatus.strategyLevel} / 놀이 Lv.{currentUserWithStatus.playfulLevel}</p>
                     </div>
                </div>

                <div className="flex items-center justify-end flex-wrap gap-2 sm:gap-4">
                    <div className="flex items-center">
                        <ResourceDisplay icon="⚡" value={`${actionPoints.current}/${actionPoints.max}`} />
                        <ActionPointTimer user={currentUserWithStatus} />
                        <button onClick={() => openShop('misc')} className="ml-0.5 w-6 h-6 flex-shrink-0 rounded-full bg-green-600 hover:bg-green-500 text-white font-bold flex items-center justify-center text-sm shadow-md transition-transform hover:scale-110 active:scale-95" title="행동력 구매">+</button>
                    </div>
                    <ResourceDisplay icon={<img src="/images/Gold.png" alt="골드" className="w-5 h-5 object-contain" />} value={gold.toLocaleString()} />
                    <ResourceDisplay icon={<img src="/images/Zem.png" alt="다이아" className="w-5 h-5 object-contain" />} value={diamonds.toLocaleString()} />
                    
                    <div className="h-9 w-px bg-border-color mx-0.5 sm:mx-2"></div>
                    
                    {isAdmin && <Button onClick={() => window.location.hash = '#/admin'} colorScheme="purple" className="text-xs">관리자</Button>}
                    <button
                        onClick={openSettingsModal}
                        className="p-1.5 rounded-lg text-lg hover:bg-secondary transition-colors"
                        title="설정"
                    >
                        ⚙️
                    </button>
                    <Button onClick={handleLogout} colorScheme="red" className="text-xs">로그아웃</Button>
                </div>
            </div>
        </header>
    );
};

export default Header;