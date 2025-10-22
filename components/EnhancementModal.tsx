import React, { useState, useMemo, useEffect } from 'react';
import { UserWithStatus, InventoryItem, ServerAction, ItemGrade, ItemOption } from '../types';
import DraggableWindow from './DraggableWindow';
import Button from './Button';
import { ENHANCEMENT_SUCCESS_RATES, ENHANCEMENT_COSTS, MATERIAL_ITEMS, ENHANCEMENT_FAIL_BONUS_RATES, ENHANCEMENT_LEVEL_REQUIREMENTS, GRADE_LEVEL_REQUIREMENTS } from '../constants';
import { useAppContext } from '../hooks/useAppContext';
import { getStarDisplayInfo, gradeStyles } from '../utils/itemDisplayUtils';

interface EnhancementPanelProps {
    item: InventoryItem;
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
    enhancementOutcome: { message: string; success: boolean; itemBefore: InventoryItem; itemAfter: InventoryItem; } | null;
    onOutcomeConfirm: () => void;
    isTopmost?: boolean;
}



export const ItemCard: React.FC<{ item: InventoryItem; onClick: () => void; className?: string; }> = ({ item, onClick, className }) => {
    const { currentUserWithStatus } = useAppContext();
    const userLevelSum = (currentUserWithStatus?.strategyLevel ?? 1) + (currentUserWithStatus?.playfulLevel ?? 1);
    const requiredLevel = item.type === 'equipment' ? GRADE_LEVEL_REQUIREMENTS[item.grade] : 0;
    const canEquip = userLevelSum >= requiredLevel;

    return (
        <div
            className={`relative aspect-square rounded-md border-2 border-color/50 bg-tertiary/50 cursor-pointer group ${className}`}
            onClick={onClick}
        >
            <img src={gradeStyles[item.grade].background} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-sm" />
            {item.isEquipped && <div className="absolute top-0.5 right-0.5 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold z-10" title="장착중">E</div>}
            {item.image && <img src={item.image} alt={item.name} className="relative w-full h-full object-contain p-1 group-hover:scale-110 transition-transform" />}
            {item.quantity && item.quantity > 1 && (
                <span className="absolute bottom-0 right-0 text-xs font-bold text-white bg-black/60 px-1 rounded-tl-md">{item.quantity}</span>
            )}
            {!canEquip && item.type === 'equipment' && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-center text-xs font-bold text-red-400" title={`착용 레벨 합 필요: ${requiredLevel}`}>
                    레벨 부족
                </div>
            )}
        </div>
    );
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

import DetailedItemDisplay from './DetailedItemDisplay';







const EnhancementPanel: React.FC<EnhancementPanelProps> = ({ item, currentUser, onClose, onAction, enhancementOutcome, onOutcomeConfirm, isTopmost }) => {


    const [isEnhancing, setIsEnhancing] = useState(false);


    const [displayItem, setDisplayItem] = useState(item);





    useEffect(() => {


        setDisplayItem(item);


        setIsEnhancing(false);


        onOutcomeConfirm();


    }, [item]);





    useEffect(() => {


        if (enhancementOutcome) {


            setIsEnhancing(false);


            setDisplayItem(enhancementOutcome.itemAfter);


        }


    }, [enhancementOutcome]);





    const costInfo = ENHANCEMENT_COSTS[displayItem.grade]?.[displayItem.stars];


    const baseSuccessRate = ENHANCEMENT_SUCCESS_RATES[displayItem.stars];


    const failBonusRate = ENHANCEMENT_FAIL_BONUS_RATES[displayItem.grade] || 0.5;


    const failBonus = (displayItem.enhancementFails || 0) * failBonusRate;





    const userLevelSum = currentUser.strategyLevel + currentUser.playfulLevel;


    const nextStars = displayItem.stars + 1;





    const levelRequirement = useMemo(() => {


        if (nextStars === 4 || nextStars === 7 || nextStars === 10) {


            const reqs = ENHANCEMENT_LEVEL_REQUIREMENTS[displayItem.grade];


            if (reqs) {


                return reqs[nextStars as 4 | 7 | 10];


            }


        }


        return 0;


    }, [nextStars, displayItem.grade]);


    const meetsLevelRequirement = userLevelSum >= levelRequirement;





    const userMaterials = useMemo(() => {


        const counts: Record<string, number> = {};


        for (const material of Object.keys(MATERIAL_ITEMS)) {


            counts[material] = currentUser.inventory


                .filter(i => i.name === material)


                .reduce((sum, i) => sum + (i.quantity || 0), 0);


        }


        return counts;


    }, [currentUser.inventory]);





    const canEnhance = useMemo(() => {


        if (!costInfo) return false;


        if (levelRequirement > 0 && !meetsLevelRequirement) return false;


        if (currentUser.gold < costInfo.gold) return false;


        return costInfo.materials.every(cost => userMaterials[cost.name] >= cost.amount);


    }, [costInfo, userMaterials, levelRequirement, meetsLevelRequirement, currentUser.gold]);





    const handleEnhanceClick = () => {


        if (!canEnhance || isEnhancing) return;


        setIsEnhancing(true);


        onAction({ type: 'ENHANCE_ITEM', payload: { itemId: displayItem.id } });


    };





    const { mainOptionPreview, subOptionPreview } = useMemo(() => {


        if (!displayItem.options || displayItem.stars >= 10) return { mainOptionPreview: '최대 강화', subOptionPreview: '' };





        const { main, combatSubs } = displayItem.options;


        const mainBaseValue = main.baseValue;





        if (!mainBaseValue) {


            return { mainOptionPreview: 'N/A', subOptionPreview: 'N/A' };


        }


        


        let increaseMultiplier = 1;


        if ([3, 6, 9].includes(displayItem.stars)) {


            increaseMultiplier = 2;


        }


        const increaseAmount = mainBaseValue * increaseMultiplier;


        const newValue = main.value + increaseAmount;


        


        const mainPrev = `${main.type} +${main.value.toFixed(2).replace(/\.00$/, '')}${main.isPercentage ? '%' : ''}`;


        const mainNext = `+${newValue.toFixed(2).replace(/\.00$/, '')}${main.isPercentage ? '%' : ''}`;


        const mainOptionPreview = `${mainPrev} → ${mainNext}`;





        const subOptionPreview = combatSubs.length < 4 ? '신규 전투 부옵션 1개 추가' : '기존 전투 부옵션 1개 강화';


        


        return { mainOptionPreview, subOptionPreview };


    }, [displayItem]);


    


    const starInfoCurrent = getStarDisplayInfo(displayItem.stars);


    const starInfoNext = displayItem.stars < 10 ? getStarDisplayInfo(displayItem.stars + 1) : null;





    const buttonText = useMemo(() => {


        if (isEnhancing) return '강화 중...';


        if (displayItem.stars >= 10) return '최대 강화';


        if (levelRequirement > 0 && !meetsLevelRequirement) return `레벨 부족 (합 ${levelRequirement} 필요)`;


        if (!costInfo) return '강화 정보 없음'; // Should not happen


        if (!canEnhance) {


            if(currentUser.gold < costInfo.gold) return '골드 부족';


            return '재료 부족';


        }


        return `강화하기 (+${displayItem.stars + 1})`;


    }, [isEnhancing, displayItem.stars, levelRequirement, meetsLevelRequirement, costInfo, canEnhance, currentUser.gold]);





    return (
        <div className="h-full flex flex-col p-4">
            {enhancementOutcome && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-gray-800/90 p-6 rounded-lg shadow-xl text-center animate-fade-in-up">
                        <h4 className={`font-bold text-2xl mb-3 ${enhancementOutcome.success ? 'text-green-400' : 'text-red-400'}`}>
                            {enhancementOutcome.success ? '강화 성공!' : '강화 실패...'}
                        </h4>
                        <p className="text-gray-300 text-base mb-4">{enhancementOutcome.message}</p>
                        {enhancementOutcome.success && (
                            <div className="mb-4 p-3 bg-gray-700/50 rounded-md">
                                <h5 className="font-bold text-yellow-300 text-sm mb-2">변경 사항</h5>
                                <div className="flex justify-between items-center text-sm mb-1">
                                    <span>등급:</span>
                                    <span className="flex items-center gap-2">
                                        <span className={getStarDisplayInfo(enhancementOutcome.itemBefore.stars).colorClass}>{getStarDisplayInfo(enhancementOutcome.itemBefore.stars).text || '(미강화)'}</span>
                                        <span className="text-gray-400">→</span>
                                        <span className={getStarDisplayInfo(enhancementOutcome.itemAfter.stars).colorClass}>{getStarDisplayInfo(enhancementOutcome.itemAfter.stars).text}</span>
                                    </span>
                                </div>
                                {enhancementOutcome.itemBefore.options && enhancementOutcome.itemAfter.options && (
                                    <div className="flex justify-between items-center text-sm">
                                        <span>주옵션:</span>
                                        <span className="truncate">{enhancementOutcome.itemBefore.options.main.display} <span className="text-gray-400">→</span> {enhancementOutcome.itemAfter.options.main.display}</span>
                                    </div>
                                )}
                            </div>
                        )}
                        <Button onClick={onOutcomeConfirm} colorScheme="green" className="w-full">확인</Button>
                    </div>
                </div>
            )}

            <div className="flex-grow flex flex-row gap-4">
                {/* Left Panel: Item Display & Current Stats */}
                <div className="w-1/2 flex flex-col items-center gap-3 bg-gray-900/40 p-4 rounded-lg">
                    <div className="relative w-24 h-24 flex-shrink-0 rounded-md border-2 border-color/50 bg-tertiary/50">
                        <img src={gradeStyles[displayItem.grade].background} alt={displayItem.grade} className="absolute inset-0 w-full h-full object-cover rounded-sm" />
                        {displayItem.image && <img src={displayItem.image} alt={displayItem.name} className="relative w-full h-full object-contain p-1" />}
                    </div>
                    <h3 className={`font-bold text-lg ${gradeStyles[displayItem.grade].text}`}>{displayItem.name}</h3>
                    <p className="text-gray-400 text-sm">+{displayItem.stars} 강화</p>

                    <div className="w-full mt-auto p-3 bg-gray-800/50 rounded-lg text-xs space-y-1">
                        <h4 className="font-bold text-center text-yellow-300 mb-2">현재 능력치</h4>
                        <div className="flex justify-between">
                            <span>등급:</span>
                            <span className={starInfoCurrent.colorClass}>{starInfoCurrent.text || '(미강화)'}</span>
                        </div>
                        {displayItem.options?.main && (
                            <div className="flex justify-between">
                                <span>주옵션:</span>
                                <span>{displayItem.options.main.display}</span>
                            </div>
                        )}
                        {displayItem.options?.combatSubs && displayItem.options.combatSubs.length > 0 && (
                            <div className="flex justify-between">
                                <span>전투 부옵션:</span>
                                <span>{displayItem.options.combatSubs.length}개</span>
                            </div>
                        )}
                        {displayItem.options?.specialSubs && displayItem.options.specialSubs.length > 0 && (
                            <div className="flex justify-between">
                                <span>특수 부옵션:</span>
                                <span>{displayItem.options.specialSubs.length}개</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Enhancement Info & Controls */}
                <div className="w-1/2 space-y-3 flex flex-col">
                    <div className="bg-gray-900/50 p-3 rounded-lg flex-grow">
                        <h4 className="font-semibold text-center mb-3 text-green-300 text-base">강화 성공 시</h4>
                        <div className="space-y-1 text-xs text-left">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400">등급:</span>
                                <div className="font-mono text-white flex items-center gap-1">
                                    <span className={starInfoCurrent.colorClass}>{starInfoCurrent.text || '(★0)'}</span>
                                    <span className="text-gray-400">→</span>
                                    {starInfoNext ? <span className={starInfoNext.colorClass}>{starInfoNext.text}</span> : '-'}
                                </div>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">주옵션:</span>
                                <span className="font-mono text-white text-right">{mainOptionPreview}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">부옵션:</span>
                                <span className="font-mono text-white text-right">{displayItem.stars < 10 ? subOptionPreview : ''}</span>
                            </div>
                            {levelRequirement > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-400">필요 레벨 합:</span>
                                    <span className={`font-mono ${meetsLevelRequirement ? 'text-green-400' : 'text-red-400'}`}>{levelRequirement}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-gray-900/50 p-3 rounded-lg">
                        <h4 className="font-semibold text-center mb-3 text-base">필요 재료</h4>
                        <div className="space-y-1 text-xs">
                            {costInfo?.materials.map(cost => {
                                const userHas = userMaterials[cost.name] || 0;
                                const hasEnough = userHas >= cost.amount;
                                return (
                                    <div key={cost.name} className="flex justify-between items-center">
                                        <span className="flex items-center gap-1">
                                            <img src={MATERIAL_ITEMS[cost.name as keyof typeof MATERIAL_ITEMS].image!} alt={cost.name} className="w-4 h-4" />
                                            {cost.name}
                                        </span>
                                        <span className={`font-mono ${hasEnough ? 'text-green-400' : 'text-red-400'}`}>
                                            {userHas.toLocaleString()} / {cost.amount.toLocaleString()}
                                        </span>
                                    </div>
                                );
                            })}
                            {costInfo && costInfo.gold > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="flex items-center gap-1">
                                        <img src="/images/Gold.png" alt="골드" className="w-4 h-4" />
                                        골드
                                    </span>
                                    <span className={`font-mono ${currentUser.gold >= costInfo.gold ? 'text-green-400' : 'text-red-400'}`}>
                                        {currentUser.gold.toLocaleString()} / {costInfo.gold.toLocaleString()}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-gray-900/50 p-3 rounded-lg text-center">
                        <h4 className="font-bold text-base mb-2">강화 성공 확률</h4>
                        <p className="text-3xl font-bold text-yellow-300">
                            {baseSuccessRate}%
                            {failBonus > 0 && <span className="text-lg text-green-400 ml-1">(+{failBonus.toFixed(1).replace(/\.0$/, '')}%)</span>}
                        </p>
                    </div>

                    <Button
                        onClick={handleEnhanceClick}
                        disabled={!canEnhance || isEnhancing || displayItem.stars >= 10}
                        colorScheme="yellow"
                        className="w-full py-2 mt-auto text-base"
                    >
                        {buttonText}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default EnhancementPanel;