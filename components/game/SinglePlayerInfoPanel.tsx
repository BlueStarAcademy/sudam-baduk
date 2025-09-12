import React, { useState, useEffect, useMemo } from 'react';
import { LiveGameSession, GameMode, SinglePlayerLevel } from '../../types.js';
import { SINGLE_PLAYER_STAGES } from '../../constants.js';

const GO_TERMS_BY_LEVEL: Record<SinglePlayerLevel, { term: string; meaning: string }[]> = {
    [SinglePlayerLevel.입문]: [
        { term: "활로", meaning: "돌이 살아가는 길. 이 길이 모두 막히면 돌은 잡히게 됩니다." },
        { term: "단수", meaning: "활로가 하나만 남은 상태. 다음 차례에 잡힐 수 있는 위험한 상황입니다." },
        { term: "귀, 변, 중앙", meaning: "집을 짓기 좋은 순서는 귀, 변, 중앙 순서입니다." },
        { term: "1선 (사망선)", meaning: "가장자리 첫째 줄. 살기 어려운 죽음의 선입니다." },
        { term: "2선 (패망선)", meaning: "둘째 줄. 집을 지어도 작아 패배하기 쉬운 선입니다." },
        { term: "3선 (실리선)", meaning: "셋째 줄. 집을 짓기에 가장 효율적인 실리의 선입니다." },
        { term: "4선 (세력선)", meaning: "넷째 줄. 중앙을 향한 세력을 쌓기에 좋은 선입니다." },
    ],
    [SinglePlayerLevel.초급]: [
        { term: "축", meaning: "단수 된 돌을 계속해서 몰아 잡는 기술입니다." },
        { term: "장문", meaning: "그물처럼 상대 돌을 가두어 잡는 기술입니다." },
        { term: "환격", meaning: "자신의 돌을 희생하여 상대의 돌을 되따내는 기술입니다." },
        { term: "촉촉수", meaning: "상대 돌의 활로를 줄여 단수를 연속으로 쳐서 잡는 기술입니다." },
        { term: "단수 방향", meaning: "상대 돌을 어느 방향으로 몰아가며 단수 칠지 결정하는 중요한 기술입니다." },
    ],
    [SinglePlayerLevel.중급]: [
        { term: "사활", meaning: "돌의 삶과 죽음. 바둑의 가장 기본이 되는 중요한 개념입니다." },
        { term: "수상전", meaning: "서로 끊어진 돌들이 활로를 다투며 어느 한쪽이 잡힐 때까지 싸우는 것입니다." },
        { term: "정석", meaning: "예로부터 지금까지 공격과 수비의 최선이라고 알려진, 정해진 형태의 수순입니다." },
        { term: "포석", meaning: "초반에 집과 세력의 균형을 맞추며 돌을 배치하는 전략입니다." },
        { term: "일립이전", meaning: "한 개의 돌에서 두 칸을 벌리는 행마. 안정적인 발전의 기초입니다." },
        { term: "이립삼전", meaning: "두 개의 돌에서 세 칸을 벌리는 행마. 더욱 발전적인 형태입니다." },
    ],
    [SinglePlayerLevel.고급]: [
        { term: "행마", meaning: "돌을 움직여 모양을 만드는 방법. 바둑의 효율성과 아름다움을 결정합니다." },
        { term: "한칸 뜀", meaning: "가장 안정적이고 기본적인 행마법입니다." },
        { term: "날일자", meaning: "한칸 뜀보다 조금 더 발이 빠르고 효율적인 행마법입니다." },
        { term: "눈목자", meaning: "날일자보다 한 칸 더 멀리 가는 행마로, 속도는 빠르지만 약점이 있습니다." },
        { term: "입구자", meaning: "밭전자 행마와 함께 돌을 튼튼하게 연결하는 행마입니다." },
    ],
    [SinglePlayerLevel.유단자]: [
        { term: "삼삼", meaning: "귀의 3의 3 지점. 실리를 차지하기 위한 현대 바둑의 중요한 착점입니다." },
        { term: "바꿔치기", meaning: "자신의 돌 일부를 내주고 상대의 더 큰 돌이나 집을 얻는 교환입니다." },
        { term: "유가무가 불상전", meaning: "집이 있는 돌과 집이 없는 돌은 수상전이 되지 않는다는 격언입니다." },
        { term: "대궁소궁 불상전", meaning: "수상전에서 궁도(활로의 집 모양)가 큰 쪽이 작은 쪽을 이긴다는 격언입니다." },
        { term: "현현기경", meaning: "'깊고 오묘한 이치를 담은 바둑 문제집'이라는 뜻의 고전 사활 책입니다." },
        { term: "기경중묘", meaning: "'바둑판 위의 기묘한 재주'라는 뜻의 고전 묘수풀이 책입니다." },
    ],
};

interface GameInfoPanelProps {
    session: LiveGameSession;
    onOpenSettings: () => void;
}

const GameInfoPanel: React.FC<GameInfoPanelProps> = ({ session, onOpenSettings }) => {
    const { settings, stageId } = session;
    const stageInfo = useMemo(() => SINGLE_PLAYER_STAGES.find(s => s.id === stageId), [stageId]);

    const stageDisplayName = useMemo(() => {
        if (!stageInfo) return stageId || '알 수 없는 스테이지';
        // e.g., stageId "초급-4" becomes "초급-4 스테이지"
        return `${stageInfo.id} 스테이지`;
    }, [stageInfo, stageId]);

    return (
        <div className="h-full bg-stone-800/60 backdrop-blur-sm p-3 rounded-md flex-shrink-0 border border-stone-700/50 text-stone-300">
            <h3 className="text-base font-bold border-b border-stone-600/50 pb-1 mb-2 text-amber-300 text-center flex justify-between items-center">
                <span>대국 정보</span>
                <button onClick={onOpenSettings} className="p-1 rounded-full text-lg hover:bg-black/20 transition-colors" title="설정">⚙️</button>
            </h3>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                <div className="font-semibold text-stone-400">스테이지:</div>
                <div>{stageDisplayName}</div>
                <div className="font-semibold text-stone-400">판 크기:</div>
                <div>{settings.boardSize}x{settings.boardSize}</div>
                <div className="font-semibold text-stone-400">AI 레벨:</div>
                <div>{settings.aiDifficulty}</div>
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
            </div>
        </div>
    );
};

const ProverbPanel: React.FC<{ session: LiveGameSession }> = ({ session }) => {
    const stageInfo = useMemo(() => SINGLE_PLAYER_STAGES.find(s => s.id === session.stageId), [session.stageId]);
    const currentLevel = useMemo(() => stageInfo?.level || SinglePlayerLevel.입문, [stageInfo]);
    const termsForLevel = useMemo(() => GO_TERMS_BY_LEVEL[currentLevel], [currentLevel]);

    const [termIndex, setTermIndex] = useState(0);

    useEffect(() => {
        // When the level changes, reset the index to show a new term immediately.
        setTermIndex(Math.floor(Math.random() * termsForLevel.length));

        const timer = setInterval(() => {
            setTermIndex(prev => (prev + 1) % termsForLevel.length);
        }, 15000); // Change term every 15 seconds
        return () => clearInterval(timer);
    }, [termsForLevel]);

    const currentTerm = termsForLevel[termIndex % termsForLevel.length];

    return (
        <div className="bg-stone-800/60 backdrop-blur-sm p-3 rounded-md flex-1 border border-stone-700/50 text-stone-300 flex flex-col items-center justify-center text-center">
            <h3 className="text-base font-bold border-b border-stone-600/50 pb-1 mb-2 text-amber-300">
                바둑 용어
            </h3>
            <div className="flex-grow flex flex-col items-center justify-center">
                <p className="text-2xl font-semibold text-stone-100">{currentTerm.term}</p>
                <p className="text-sm text-stone-300 mt-2">{currentTerm.meaning}</p>
            </div>
        </div>
    );
};

interface SinglePlayerInfoPanelProps {
    session: LiveGameSession;
    onOpenSettings: () => void;
}

const SinglePlayerInfoPanel: React.FC<SinglePlayerInfoPanelProps> = ({ session, onOpenSettings }) => {
    return (
        <div className="flex flex-col md:flex-row h-full gap-2">
            <GameInfoPanel session={session} onOpenSettings={onOpenSettings} />
            <ProverbPanel session={session} />
        </div>
    );
};

export default SinglePlayerInfoPanel;