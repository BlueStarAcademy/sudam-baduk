import React from 'react';
import { UserWithStatus } from '../../types/index.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import Button from '../Button.js';

const ResourceDisplay: React.FC<{ icon: React.ReactNode; value: string; className?: string }> = ({ icon, value, className }) => (
    <div className={`flex items-center gap-1 sm:gap-2 bg-tertiary/50 rounded-full py-1 pl-1 pr-2 sm:pr-3 shadow-inner ${className}`}>
        <div className="bg-primary w-6 h-6 flex items-center justify-center rounded-full text-lg flex-shrink-0">{icon}</div>
        <span className="font-bold text-xs sm:text-sm text-primary">{value}</span>
    </div>
);

interface CurrencyPanelProps {
    currentUser: UserWithStatus;
    className?: string;
}

const CurrencyPanel: React.FC<CurrencyPanelProps> = ({ currentUser, className }) => {
    const { handlers } = useAppContext();
    const { actionPoints, gold, diamonds } = currentUser;

    const panelClasses = className || "bg-stone-800/60 backdrop-blur-sm p-2 rounded-md flex-shrink-0 border border-stone-700/50 text-stone-300";

    return (
        <div className={panelClasses}>
            <div className="flex justify-around items-center gap-2">
                <div className="flex items-center">
                    <ResourceDisplay icon="⚡" value={`${actionPoints.current}/${actionPoints.max}`} />
                    <button onClick={() => handlers.openShop('misc')} className="ml-1 w-6 h-6 flex-shrink-0 rounded-full bg-green-600 hover:bg-green-500 text-white font-bold flex items-center justify-center text-lg shadow-md transition-transform hover:scale-110 active:scale-95" title="행동력 구매">+</button>
                </div>
                <ResourceDisplay icon={<img src="/images/Gold.png" alt="골드" className="w-4 h-4 object-contain" />} value={gold.toLocaleString()} />
                <ResourceDisplay icon={<img src="/images/Zem.png" alt="다이아" className="w-4 h-4 object-contain" />} value={diamonds.toLocaleString()} />
            </div>
        </div>
    );
};

export default CurrencyPanel;