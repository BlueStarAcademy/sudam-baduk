import React, { useEffect } from 'react';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import { InventoryItem, ItemGrade, ItemOption } from '../types.js';
import { audioService } from '../services/audioService.js';
import { GRADE_LEVEL_REQUIREMENTS } from '../constants.js';

interface SynthesisResultModalProps {
    result: {
        item: InventoryItem;
        wasUpgraded: boolean;
    };
    onClose: () => void;
    isTopmost?: boolean;
}

const gradeStyles: Record<ItemGrade, { bg: string, text: string, shadow: string, name: string, background: string }> = {
    normal: { bg: 'bg-gray-700', text: 'text-white', shadow: 'shadow-gray-900/50', name: '일반', background: '/images/equipments/normalbgi.png' },
    uncommon: { bg: 'bg-green-700', text: 'text-green-200', shadow: 'shadow-green-500/50', name: '고급', background: '/images/equipments/uncommonbgi.png' },
    rare: { bg: 'bg-blue-700', text: 'text-blue-200', shadow: 'shadow-blue-500/50', name: '희귀', background: '/images/equipments/rarebgi.png' },
    epic: { bg: 'bg-purple-700', text: 'text-purple-200', shadow: 'shadow-purple-500/50', name: '에픽', background: '/images/equipments/epicbgi.png' },
    legendary: { bg: 'bg-red-800', text: 'text-red-200', shadow: 'shadow-red-500/50', name: '전설', background: '/images/equipments/legendarybgi.png' },
    mythic: { bg: 'bg-orange-700', text: 'text-orange-200', shadow: 'shadow-orange-500/50', name: '신화', background: '/images/equipments/mythicbgi.png' },
};

const gradeBorderStyles: Partial<Record<ItemGrade, string>> = {
    rare: 'spinning-border-rare',
    epic: 'spinning-border-epic',
    legendary: 'spinning-border-legendary',
    mythic: 'spinning-border-mythic',
};

const getStarDisplayInfo = (stars: number) => {
    if (stars >= 10) {
        return { text: `(★${stars})`, colorClass: "prism-text-effect" };
    } else if (stars >= 7) {
        return { text: `(★${stars})`, colorClass: "text-purple-400" };
    } else if (stars >= 4) {
        return { text: `(★${stars})`, colorClass: "text-amber-400" };
    } else if (stars >= 1) {
        return { text: `(★${stars})`, colorClass: "text-white" };
    }
    return { text: "", colorClass: "text-white" };
};

const OptionSection: React.FC<{ title: string; options: ItemOption[]; color: string; }> = ({ title, options, color }) => {
    if (options.length === 0) return null;
    return (
        <div>
            <h5 className={`font-semibold ${color} border-b border-gray-600 pb-1 mb-1 text-sm`}>{title}</h5>
            <ul className="list-disc list-inside space-y-0.5 text-gray-300 text-xs">
                {options.map((opt, i) => <li key={i}>{opt.display}</li>)}
            </ul>
        </div>
    );
};

const SynthesisResultModal: React.FC<SynthesisResultModalProps> = ({ result, onClose, isTopmost }) => {
    const { item, wasUpgraded } = result;
    const isDoubleMythic = item.grade === 'mythic' && item.options?.mythicSubs.length === 2;
    const styles = gradeStyles[item.grade];
    const requiredLevel = item.type === 'equipment' ? GRADE_LEVEL_REQUIREMENTS[item.grade] : null;
    const starInfo = getStarDisplayInfo(item.stars);
    const borderClass = gradeBorderStyles[item.grade];

    useEffect(() => {
        if (wasUpgraded || isDoubleMythic) {
            audioService.disassemblyJackpot();
        } else {
            const isHighGrade = ['epic', 'legendary', 'mythic'].includes(item.grade);
            if (isHighGrade) {
                audioService.gachaEpicOrHigher();
            } else {
                audioService.enhancementSuccess();
            }
        }
    }, [item, wasUpgraded, isDoubleMythic]);

    const gradeName = isDoubleMythic ? 'Double[신화]' : styles.name;
    const gradeColor = isDoubleMythic ? 'prism-text-effect' : styles.text;

    return (
        <DraggableWindow title={wasUpgraded || isDoubleMythic ? "✨ 합성 대성공! ✨" : "합성 결과"} onClose={onClose} windowId="synthesis-result" initialWidth={500} isTopmost={isTopmost}>
            <div className="text-center">
                 {(wasUpgraded || isDoubleMythic) && (
                    <h2 className="text-2xl font-bold text-yellow-300 mb-4 animate-pulse">
                        {isDoubleMythic ? '특별한 신화 장비를 획득했습니다!' : '상위 등급 장비를 획득했습니다!'}
                    </h2>
                )}
                <div className="p-6 rounded-lg">
                    <div className="relative w-48 h-48 mx-auto rounded-lg mb-4 overflow-hidden">
                        {borderClass && (
                            <div className={`absolute -inset-1 rounded-lg ${borderClass}`}></div>
                        )}
                        <div className="relative w-full h-full rounded-lg flex items-center justify-center border-2 border-black/50 overflow-hidden">
                            <img src={styles.background} alt={item.grade} className="absolute inset-0 w-full h-full object-cover" />
                            {item.image && <img src={item.image} alt={item.name} className="relative w-full h-full object-contain p-4" />}
                        </div>
                    </div>
                    <p className={`font-bold text-lg ${gradeColor}`}>[{gradeName}]</p>
                    <div className="flex items-baseline justify-center gap-2">
                        <h2 className={`text-3xl font-bold ${starInfo.colorClass}`}>{item.name}</h2>
                        {item.stars > 0 && <span className={`text-2xl font-bold ${starInfo.colorClass}`}>{starInfo.text}</span>}
                    </div>
                    {requiredLevel && <p className="text-xs text-yellow-300">(착용 레벨 합: {requiredLevel})</p>}
                    {item.type === 'equipment' && (
                        <div className="w-full text-xs text-left space-y-2 mt-4 max-h-48 overflow-y-auto bg-black/20 p-2 rounded-md">
                            {item.options && (
                                <>
                                    <OptionSection title="주옵션" options={[item.options.main]} color="text-yellow-300" />
                                    <OptionSection title="전투 부옵션" options={item.options.combatSubs} color="text-blue-300" />
                                    <OptionSection title="특수 부옵션" options={item.options.specialSubs} color="text-green-300" />
                                    <OptionSection title="신화 부옵션" options={item.options.mythicSubs} color="text-red-400" />
                                </>
                            )}
                        </div>
                    )}
                </div>
                <Button onClick={onClose} className="w-full mt-6 py-2.5">확인</Button>
            </div>
        </DraggableWindow>
    );
};

export default SynthesisResultModal;