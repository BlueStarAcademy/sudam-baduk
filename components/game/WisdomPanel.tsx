import React, { useState, useEffect, useMemo } from 'react';
import { LiveGameSession, SinglePlayerLevel } from '../../types/index.js';
import { TOWER_PROVERBS, GO_TERMS_BY_LEVEL, SINGLE_PLAYER_STAGES } from '../../constants/index.js';

interface WisdomPanelProps {
    session: LiveGameSession;
}

const GO_TRIVIA = [
    { term: "수담(手談)", meaning: "바둑은 '손으로 나누는 대화'라는 별명을 가지고 있습니다." },
    { term: "바둑의 역사", meaning: "세계에서 가장 오래된 전략 게임 중 하나로, 약 4000년의 역사를 가집니다." },
    { term: "천원(天元)", meaning: "바둑판의 중앙점(천원)은 우주의 중심을 상징하지만, 실전에서는 초반에 잘 두지 않습니다." },
    { term: "프로 입단", meaning: "프로 바둑기사의 입단은 보통 10대에 이루어지며, 매우 치열한 경쟁을 뚫어야 합니다." },
    { term: "알파고 쇼크", meaning: "인공지능 알파고가 이세돌 9단을 이긴 사건은 바둑계와 과학계에 큰 충격을 주었습니다." },
];

const WisdomPanel: React.FC<WisdomPanelProps> = React.memo(({ session }) => {
    const { isTowerChallenge, stageId } = session;

    const terms = useMemo(() => {
        let availableTerms: { term: string; meaning: string }[] = [...TOWER_PROVERBS, ...GO_TRIVIA];
        if (!isTowerChallenge) {
            const stageInfo = SINGLE_PLAYER_STAGES.find(s => s.id === stageId);
            const currentLevel = stageInfo?.level || SinglePlayerLevel.입문;
            availableTerms.push(...(GO_TERMS_BY_LEVEL[currentLevel] || []));
        }
        // Remove duplicates
        const uniqueTerms = Array.from(new Map(availableTerms.map(item => [item.term, item])).values());
        return uniqueTerms;
    }, [isTowerChallenge, stageId]);

    const [termIndex, setTermIndex] = useState(() => Math.floor(Math.random() * terms.length));

    useEffect(() => {
        if (terms.length > 1) {
            const rotateTerm = () => {
                setTermIndex(prev => (prev + 1) % terms.length);
            };
            const intervalId = setInterval(rotateTerm, 10000);
            return () => clearInterval(intervalId);
        }
    }, [terms]);

    const currentTerm = terms[termIndex];
    if (!currentTerm) return null;

    const titleColor = isTowerChallenge ? "text-red-300" : "text-amber-300";

    return (
        <div className="bg-stone-800/60 backdrop-blur-sm p-3 rounded-md flex-1 border border-stone-700/50 text-stone-300 flex flex-col items-center justify-center text-center">
            <h3 className={`text-base font-bold border-b border-stone-600/50 pb-1 mb-2 ${titleColor}`}>
                바둑 용어/격언/상식
            </h3>
            <div className="flex-grow flex flex-col items-center justify-center">
                <p className="text-2xl font-semibold text-stone-100">{currentTerm.term}</p>
                <p className="text-sm text-stone-300 mt-2">{currentTerm.meaning}</p>
            </div>
        </div>
    );
});

export default WisdomPanel;