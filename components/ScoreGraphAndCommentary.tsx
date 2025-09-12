import React, { useRef, useEffect } from 'react';
import { CommentaryLine, CoreStat } from '../types.js';

interface RandomEventDetailsProps {
    details: NonNullable<CommentaryLine['randomEventDetails']>;
    p1Nickname?: string;
    p2Nickname?: string;
}

const RandomEventDetails: React.FC<RandomEventDetailsProps> = ({ details, p1Nickname, p2Nickname }) => {
    const { stat, p1_stat, p2_stat } = details;
    
    // Consistent naming for display
    const p1 = { nickname: p1Nickname || 'Player 1', stat: p1_stat };
    const p2 = { nickname: p2Nickname || 'Player 2', stat: p2_stat };

    const totalStat = p1.stat + p2.stat;
    const p1Percent = totalStat > 0 ? (p1.stat / totalStat) * 100 : 50;
    const p2Percent = 100 - p1Percent;

    return (
        <div className="text-xs text-gray-400 mt-1 p-2 bg-gray-900/30 rounded-md">
            <p className="font-semibold text-center mb-1">{stat} 능력치 비교</p>
            <div className="flex w-full h-3 bg-gray-700 rounded-full overflow-hidden border border-black/20">
                <div className="bg-blue-500" style={{ width: `${p1Percent}%` }} title={`${p1.nickname}: ${p1.stat}`}></div>
                <div className="bg-red-500" style={{ width: `${p2Percent}%` }} title={`${p2.nickname}: ${p2.stat}`}></div>
            </div>
            <div className="flex justify-between mt-0.5">
                <span className="truncate max-w-[45%]">{p1.nickname}: {p1.stat}</span>
                <span className="truncate max-w-[45%] text-right">{p2.nickname}: {p2.stat}</span>
            </div>
        </div>
    );
};


interface ScoreGraphAndCommentaryProps {
    commentary: CommentaryLine[];
    timeElapsed: number;
    p1Percent: number;
    p2Percent: number;
    isSimulating: boolean;
    p1Nickname?: string;
    p2Nickname?: string;
}

const parseCommentary = (commentaryLine: CommentaryLine, p1Nickname?: string, p2Nickname?: string) => {
    const { text, isRandomEvent, randomEventDetails } = commentaryLine;

    if (text.startsWith('최종 결과 발표!') || text.startsWith('[최종결과]')) {
        return <strong className="text-yellow-400">{text}</strong>;
    }

    const leadRegex = /(\d+\.\d+집|\d+\.5집)/g;
    const parts = text.split(leadRegex);

    const baseText = (
        <span className={isRandomEvent ? 'text-cyan-400' : ''}>
            {parts.map((part, index) => {
                if (leadRegex.test(part)) {
                    return <strong key={index} className="text-yellow-400">{part}</strong>;
                }
                return part;
            })}
        </span>
    );
    
    return (
        <div>
            {baseText}
            {randomEventDetails && <RandomEventDetails details={randomEventDetails} p1Nickname={p1Nickname} p2Nickname={p2Nickname} />}
        </div>
    );
};

const SimulationProgressBar: React.FC<{ timeElapsed: number; totalDuration: number }> = ({ timeElapsed, totalDuration }) => {
    const progress = (timeElapsed / totalDuration) * 100;
    const earlyStage = Math.min(progress, (40 / 140) * 100);
    const midStage = Math.min(Math.max(0, progress - (40 / 140) * 100), (60 / 140) * 100);
    const endStage = Math.min(Math.max(0, progress - (100 / 140) * 100), (40 / 140) * 100);

    return (
        <div>
            <div className="w-full bg-gray-900 rounded-full h-2 flex border border-gray-600">
                <div className="bg-green-500 h-full rounded-l-full" style={{ width: `${earlyStage}%` }} title="초반전"></div>
                <div className="bg-yellow-500 h-full" style={{ width: `${midStage}%` }} title="중반전"></div>
                <div className="bg-red-500 h-full rounded-r-full" style={{ width: `${endStage}%` }} title="끝내기"></div>
            </div>
            <div className="flex text-xs text-gray-400 mt-1">
                <div style={{ width: `${(40/140)*100}%` }}>초반</div>
                <div style={{ width: `${(60/140)*100}%` }} className="text-center">중반</div>
                <div style={{ width: `${(40/140)*100}%` }} className="text-right">종반</div>
            </div>
        </div>
    );
};

const ScoreGraphAndCommentary: React.FC<ScoreGraphAndCommentaryProps> = ({ commentary, timeElapsed, p1Percent, p2Percent, isSimulating, p1Nickname, p2Nickname }) => {
    const commentaryContainerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (commentaryContainerRef.current) {
            commentaryContainerRef.current.scrollTop = commentaryContainerRef.current.scrollHeight;
        }
    }, [commentary]);
    
    return (
        <div className="flex flex-col h-full w-full">
            <div className="flex-shrink-0 p-4 pt-2">
                <h4 className="text-center font-bold text-sm mb-2 text-gray-400">점수 그래프</h4>
                {p1Nickname && p2Nickname && (
                    <div className="flex justify-between text-xs mb-1 font-bold">
                        <span className="truncate max-w-[45%]">흑: {p1Nickname}</span>
                        <span className="truncate max-w-[45%] text-right">백: {p2Nickname}</span>
                    </div>
                )}
                <div className="flex w-full h-3 bg-gray-700 rounded-full overflow-hidden border-2 border-black/30 relative">
                    <div className="bg-black transition-all duration-500 ease-in-out" style={{ width: `${p1Percent}%` }}></div>
                    <div className="bg-white transition-all duration-500 ease-in-out" style={{ width: `${p2Percent}%` }}></div>
                    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-gray-400/50" title="중앙"></div>
                </div>
                 <div className="mt-2">
                    <SimulationProgressBar timeElapsed={timeElapsed} totalDuration={140} />
                </div>
            </div>
            <div className="flex-grow flex flex-col px-4 pb-4 min-h-0">
                <h4 className="text-center font-bold text-sm mb-2 text-gray-400 flex-shrink-0">
                    실시간 중계
                    {isSimulating && <span className="ml-2 text-yellow-400 animate-pulse">경기 진행 중...</span>}
                </h4>
                <div ref={commentaryContainerRef} className="overflow-y-auto space-y-2 text-sm text-gray-300 bg-gray-800/50 p-3 rounded-md h-56">
                    {commentary.length > 0 ? (
                        commentary.slice(-30).map((line, index) => <p key={`${index}-${line.text}`} className="animate-fade-in">{parseCommentary(line, p1Nickname, p2Nickname)}</p>)
                    ) : (
                        <p className="text-gray-500 text-center">경기 시작 대기 중...</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScoreGraphAndCommentary;