import React from 'react';
import DraggableWindow from './DraggableWindow.js';

interface MbtiInfoModalProps {
    onClose: () => void;
    isTopmost?: boolean;
}

const MBTI_DESCRIPTIONS: Record<string, string> = {
    ISTJ: '현실적, 책임감, 신중함',
    ISFJ: '헌신적, 온화함, 섬세함',
    INFJ: '통찰력, 이상주의, 깊이 있음',
    INTJ: '전략적, 독립적, 논리적',
    ISTP: '논리적, 실용적, 문제 해결사',
    ISFP: '겸손함, 예술적, 융통성',
    INFP: '이상주의, 공감 능력, 창의적',
    INTP: '지적 호기심, 분석적, 독창적',
    ESTP: '활동적, 현실적, 대담함',
    ESFP: '사교적, 낙천적, 즉흥적',
    ENFP: '열정적, 상상력 풍부, 사교적',
    ENTP: '독창적, 박식함, 논쟁가',
    ESTJ: '체계적, 현실적, 리더십',
    ESFJ: '사교적, 협조적, 배려심',
    ENFJ: '카리스마, 영감, 리더십',
    ENTJ: '결단력, 리더십, 전략가',
};

const MbtiInfoModal: React.FC<MbtiInfoModalProps> = ({ onClose, isTopmost }) => {
    return (
        <DraggableWindow title="MBTI 성향 안내" onClose={onClose} windowId="mbti-info" initialWidth={400} isTopmost={isTopmost}>
            <div className="max-h-[60vh] overflow-y-auto pr-2">
                <ul className="space-y-2">
                    {Object.entries(MBTI_DESCRIPTIONS).map(([type, description]) => (
                        <li key={type} className="flex items-center gap-4 bg-gray-900/50 p-2 rounded-md">
                            <span className="font-bold text-lg text-yellow-300 w-16">{type}</span>
                            <span className="text-sm text-gray-300">{description}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </DraggableWindow>
    );
};

export default MbtiInfoModal;
