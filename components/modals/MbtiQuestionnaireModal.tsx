import React, { useState } from 'react';
import { ServerAction } from '../../types/index.js';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';

// This data is already in ProfileEditModal, I will copy it from there.
const MBTI_DETAILS = {
    'E': { name: '외향 (E)', general: '사교적이며 활동적입니다. 외부 세계에 에너지를 쏟으며 사람들과의 교류를 즐깁니다.', goStyle: '적극적으로 전투를 이끌고 중앙을 중시하는 기풍입니다. 상대방과의 수싸움을 즐기며 판을 복잡하게 만드는 경향이 있습니다.' },
    'I': { name: '내향 (I)', general: '신중하고 조용하며, 내면 세계에 더 집중합니다. 깊이 있는 관계를 선호하며 혼자만의 시간을 통해 에너지를 얻습니다.', goStyle: '실리를 중시하며 견실하게 집을 짓는 기풍입니다. 상대의 도발에 쉽게 응하지 않으며, 조용히 형세를 유리하게 만듭니다.' },
    'S': { name: '감각 (S)', general: '현실적이고 실용적이며, 오감을 통해 정보를 받아들입니다. 현재에 집중하고 구체적인 사실을 중시합니다.', goStyle: '눈앞의 집과 실리에 집중하는 현실적인 기풍입니다. 정석과 기본적인 행마에 충실하며, 확실한 승리를 추구합니다.' },
    'N': { name: '직관 (N)', general: '상상력이 풍부하고 미래지향적입니다. 가능성과 의미를 탐구하며, 전체적인 그림을 보는 것을 선호합니다.', goStyle: '창의적이고 변칙적인 수를 선호하는 기풍입니다. 대세관이 뛰어나며, 판 전체를 아우르는 큰 그림을 그리며 둡니다.' },
    'T': { name: '사고 (T)', general: '논리적이고 분석적이며, 객관적인 사실을 바탕으로 결정을 내립니다. 공정함과 원칙을 중요하게 생각합니다.', goStyle: '냉철한 수읽기를 바탕으로 최선의 수를 찾아내는 이성적인 기풍입니다. 감정에 휘둘리지 않고 형세판단에 근거하여 둡니다.' },
    'F': { name: '감정 (F)', general: '공감 능력이 뛰어나고 사람들과의 관계를 중시합니다. 조화와 협력을 바탕으로 결정을 내리며, 타인의 감정을 고려합니다.', goStyle: '상대의 기세나 심리에 영향을 받는 감성적인 기풍입니다. 때로는 무리수처럼 보이는 과감한 수를 두기도 합니다.' },
    'J': { name: '판단 (J)', general: '체계적이고 계획적이며, 목표를 설정하고 달성하는 것을 선호합니다. 결정을 빨리 내리고 질서 있는 환경을 좋아합니다.', goStyle: '한번 정한 작전을 밀고 나가는 계획적인 기풍입니다. 정해진 목표를 향해 흔들림 없이 나아가며, 끝내기에 강한 모습을 보입니다.' },
    'P': { name: '인식 (P)', general: '융통성 있고 적응력이 뛰어나며, 상황에 따라 유연하게 대처합니다. 자율성을 중시하고 새로운 경험에 개방적입니다.', goStyle: '형세에 따라 유연하게 작전을 바꾸는 임기응변에 능한 기풍입니다. 정해진 수순보다 즉흥적인 감각으로 두는 것을 즐깁니다.' },
};

type MbtiState = {
    ei: 'E' | 'I' | null;
    sn: 'S' | 'N' | null;
    tf: 'T' | 'F' | null;
    jp: 'J' | 'P' | null;
};

interface MbtiQuestionnaireModalProps {
    onClose: () => void;
    onAction: (action: ServerAction) => void;
    isTopmost?: boolean;
}

const QuestionnaireStep: React.FC<{
    title: string;
    options: ('E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P')[];
    selectedValue: 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P' | null;
    onSelect: (value: any) => void;
}> = ({ title, options, selectedValue, onSelect }) => {
    return (
        <div className="flex flex-col items-center">
            <h3 className="text-2xl font-bold text-highlight mb-4">{title}</h3>
            <div className="flex w-full gap-4">
                {options.map(opt => (
                    <div
                        key={opt}
                        onClick={() => onSelect(opt)}
                        className={`w-1/2 p-4 rounded-lg border-4 transition-all cursor-pointer ${selectedValue === opt ? 'border-accent ring-2 ring-accent' : 'border-color hover:border-accent/50'}`}
                    >
                        <h4 className="text-xl font-bold text-center mb-2">{MBTI_DETAILS[opt].name}</h4>
                        <div className="text-xs space-y-3">
                            <div>
                                <h5 className="font-semibold text-secondary">일반적 성향</h5>
                                <p className="text-primary">{MBTI_DETAILS[opt].general}</p>
                            </div>
                            <div>
                                <h5 className="font-semibold text-secondary">바둑 성향</h5>
                                <p className="text-primary">{MBTI_DETAILS[opt].goStyle}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const MbtiQuestionnaireModal: React.FC<MbtiQuestionnaireModalProps> = ({ onClose, onAction, isTopmost }) => {
    const [step, setStep] = useState(0);
    const [mbti, setMbti] = useState<MbtiState>({ ei: null, sn: null, tf: null, jp: null });

    const steps = [
        { title: '에너지 방향', key: 'ei' as keyof MbtiState, options: ['E', 'I'] as ('E' | 'I')[] },
        { title: '인식 기능', key: 'sn' as keyof MbtiState, options: ['S', 'N'] as ('S' | 'N')[] },
        { title: '판단 기능', key: 'tf' as keyof MbtiState, options: ['T', 'F'] as ('T' | 'F')[] },
        { title: '생활 양식', key: 'jp' as keyof MbtiState, options: ['J', 'P'] as ('J' | 'P')[] },
    ];
    
    const currentStep = steps[step];
    const isNextDisabled = mbti[currentStep.key] === null;

    const handleNext = () => {
        if (isNextDisabled) return;
        if (step < steps.length - 1) {
            setStep(step + 1);
        } else {
            // Finish
            const finalMbti = `${mbti.ei}${mbti.sn}${mbti.tf}${mbti.jp}`;
            onAction({ type: 'UPDATE_MBTI', payload: { mbti: finalMbti } });
            onClose();
        }
    };

    return (
        <DraggableWindow title={`MBTI 성향 설정 (${step + 1}/${steps.length})`} onClose={onClose} windowId="mbti-questionnaire" initialWidth={700} isTopmost={isTopmost}>
            <div className="h-[calc(var(--vh,1vh)*60)] flex flex-col justify-between">
                <QuestionnaireStep
                    title={currentStep.title}
                    options={currentStep.options}
                    selectedValue={mbti[currentStep.key]}
                    onSelect={(v) => setMbti(p => ({ ...p, [currentStep.key]: v }))}
                />
                <div className="flex justify-end gap-4 mt-6">
                    {step > 0 && <Button onClick={() => setStep(step - 1)} colorScheme="gray">이전</Button>}
                    <Button onClick={handleNext} disabled={isNextDisabled}>
                        {step < steps.length - 1 ? '다음' : '완료'}
                    </Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default MbtiQuestionnaireModal;