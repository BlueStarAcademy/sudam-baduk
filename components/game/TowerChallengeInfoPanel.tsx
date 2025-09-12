import React, { useState, useEffect, useMemo } from 'react';
import { LiveGameSession, SinglePlayerLevel } from '../../types.js';
import { TOWER_STAGES, TOWER_PROVERBS } from '../../constants/towerChallengeConstants.js';

interface GameInfoPanelProps {
    session: LiveGameSession;
    onOpenSettings: () => void;
}

const GameInfoPanel: React.FC<GameInfoPanelProps> = ({ session, onOpenSettings }) => {
    const { settings, stageId, floor, blackStoneLimit, blackStonesPlaced } = session;
    const stageInfo = useMemo(() => TOWER_STAGES.find(s => s.id === stageId), [stageId]);
    const stonesLeft = (blackStoneLimit ?? 0) - (blackStonesPlaced ?? 0);

    return (
        <div className="h-full bg-stone-800/60 backdrop-blur-sm p-3 rounded-md flex-shrink-0 border border-stone-700/50 text-stone-300">
            <h3 className="text-base font-bold border-b border-stone-600/50 pb-1 mb-2 text-red-300 text-center flex justify-between items-center">
                <span>대국 정보</span>
                <button onClick={onOpenSettings} className="p-1 rounded-full text-lg hover:bg-black/20 transition-colors" title="설정">⚙️</button>
            </h3>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                <div className="font-semibold text-stone-400">도전 층수:</div>
                <div>{floor}층</div>
                <div className="font-semibold text-stone-400">판 크기:</div>
                <div>{settings.boardSize}x{settings.boardSize}</div>
                <div className="font-semibold text-stone-400">AI 레벨:</div>
                <div>{settings.aiDifficulty}</div>
                <div className="font-semibold text-stone-400">목표 점수:</div>
                <div>흑{stageInfo?.targetScore?.black ?? 0} / 백{stageInfo?.targetScore?.white ?? 0}</div>
                <div className="font-semibold text-stone-400">흑돌 제한:</div>
                <div>{stonesLeft} / {blackStoneLimit}</div>
            </div>
        </div>
    );
};

const ProverbPanel: React.FC<{ session: LiveGameSession }> = ({ session }) => {
    const termsForLevel = TOWER_PROVERBS;

    const [termIndex, setTermIndex] = useState(0);

    useEffect(() => {
        if (termsForLevel.length > 0) {
            setTermIndex(Math.floor(Math.random() * termsForLevel.length));
            const timer = setInterval(() => {
                setTermIndex(prev => (prev + 1) % termsForLevel.length);
            }, 15000);
            return () => clearInterval(timer);
        }
    }, [termsForLevel]);

    const currentTerm = termsForLevel[termIndex % termsForLevel.length];
    if (!currentTerm) return null;

    return (
        <div className="bg-stone-800/60 backdrop-blur-sm p-3 rounded-md flex-1 border border-stone-700/50 text-stone-300 flex flex-col items-center justify-center text-center">
            <h3 className="text-base font-bold border-b border-stone-600/50 pb-1 mb-2 text-red-300">
                바둑 격언
            </h3>
            <div className="flex-grow flex flex-col items-center justify-center">
                <p className="text-2xl font-semibold text-stone-100">{currentTerm.term}</p>
                <p className="text-sm text-stone-300 mt-2">{currentTerm.meaning}</p>
            </div>
        </div>
    );
};

interface TowerChallengeInfoPanelProps {
    session: LiveGameSession;
    onOpenSettings: () => void;
}

const TowerChallengeInfoPanel: React.FC<TowerChallengeInfoPanelProps> = ({ session, onOpenSettings }) => {
    return (
        <div className="flex flex-col md:flex-row h-full gap-2">
            <GameInfoPanel session={session} onOpenSettings={onOpenSettings} />
            <ProverbPanel session={session} />
        </div>
    );
};

export default TowerChallengeInfoPanel;
