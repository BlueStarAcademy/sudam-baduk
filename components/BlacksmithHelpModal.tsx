import React from 'react';
import DraggableWindow from './DraggableWindow.js';
import { SYNTHESIS_LEVEL_BENEFITS } from '../constants/index.js';

interface BlacksmithHelpModalProps {
    onClose: () => void;
}

const Section: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-gray-900/50 p-4 rounded-lg">
        <h3 className="font-bold text-lg text-yellow-300 mb-2">{title}</h3>
        <div className="text-sm space-y-2">{children}</div>
    </div>
);

const BlacksmithHelpModal: React.FC<BlacksmithHelpModalProps> = ({ onClose }) => {
  return (
    <DraggableWindow title="대장간 도움말" onClose={onClose} windowId="blacksmith-help" initialWidth={800}>
        <div className="max-h-[70vh] overflow-y-auto pr-2 text-gray-300 space-y-4">
            <Section title="장비 강화">
                <p>장비를 강화하여 별(★) 등급을 최대 10성까지 올릴 수 있습니다. 강화에는 재료와 골드가 소모됩니다.</p>
                <ul className="list-disc list-inside pl-2 space-y-1">
                    <li><strong className="text-green-400">강화 성공 시:</strong> 별 등급이 1 상승하고 주옵션 능력치가 증가합니다. 추가로, 부옵션이 4개 미만일 경우 새로운 부옵션이 추가되며, 4개일 경우 기존 부옵션 중 하나가 랜덤하게 강화됩니다.</li>
                    <li><strong className="text-red-400">강화 실패 시:</strong> 재료와 골드는 소모되지만 장비는 파괴되지 않습니다. 대신, '실패 보너스'가 누적되어 다음 강화 시 성공 확률이 증가합니다.</li>
                    <li><strong className="text-yellow-400">+4, +7, +10 강화:</strong> 해당 강화 단계에 도달하면 주옵션이 2배로 강화되는 보너스를 받습니다.</li>
                </ul>
            </Section>
            <Section title="장비 합성">
                <p>같은 등급의 장비 3개를 합성하여 새로운 장비 1개를 획득합니다. 합성에는 골드가 소모됩니다.</p>
                 <ul className="list-disc list-inside pl-2 space-y-1">
                    <li>합성 결과물은 재료로 사용된 장비의 부위 중 하나로 랜덤하게 결정됩니다.</li>
                    <li>낮은 확률로 한 등급 높은 장비를 획득하는 '대성공'이 발생할 수 있습니다.</li>
                    <li><strong className="text-orange-400">신화 등급 합성:</strong> 신화 등급 장비 3개를 합성하면 일정 확률로 '더블 신화 옵션'을 가진 특별한 장비가 등장합니다.</li>
                </ul>
            </Section>
            <Section title="장비 분해">
                <p>사용하지 않는 장비를 분해하여 강화에 필요한 재료를 획득할 수 있습니다.</p>
                 <ul className="list-disc list-inside pl-2 space-y-1">
                    <li>장비의 등급과 강화 단계가 높을수록 더 많은 재료를 얻습니다.</li>
                    <li>낮은 확률로 '대박'이 발생하여 획득하는 모든 재료의 양이 2배가 됩니다.</li>
                </ul>
            </Section>
            <Section title="재료 변환">
                <p>보유한 강화 재료를 상위 또는 하위 재료로 변환할 수 있습니다.</p>
                 <ul className="list-disc list-inside pl-2 space-y-1">
                    <li><strong className="text-blue-400">합성 (상위 변환):</strong> 하위 재료 10개를 소모하여 상위 재료 1개를 제작합니다.</li>
                    <li><strong className="text-yellow-400">분해 (하위 변환):</strong> 상위 재료 1개를 소모하여 하위 재료 5개를 제작합니다.</li>
                </ul>
            </Section>
            <Section title="대장간 레벨 (합성 레벨)">
                <p>장비 합성을 통해 대장간 경험치(XP)를 얻고 레벨을 올릴 수 있습니다. 레벨이 오르면 다양한 혜택이 주어집니다.</p>
                 <ul className="list-disc list-inside pl-2 space-y-1">
                    {SYNTHESIS_LEVEL_BENEFITS.filter(b => b.level > 0 && b.level <= 5).map(benefit => (
                        <li key={benefit.level}><strong className="text-yellow-300">Lv.{benefit.level}:</strong> {benefit.synthesizableGrades.slice(-1)[0]} 등급 합성 가능, 대성공 확률 증가</li>
                    ))}
                    <li><strong className="text-yellow-300">Lv.5:</strong> 신화 등급 합성 시 '더블 신화 옵션' 등장 확률(25%) 활성화</li>
                 </ul>
            </Section>
        </div>
    </DraggableWindow>
  );
};

export default BlacksmithHelpModal;
