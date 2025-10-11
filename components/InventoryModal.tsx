import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { UserWithStatus, InventoryItem, ServerAction, InventoryItemType, EquipmentSlot, ItemGrade, ItemOption, CoreStat, SpecialStat, MythicStat, InventoryTab } from '../types/index.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import { emptySlotImages, ENHANCEMENT_COSTS, MATERIAL_ITEMS, GRADE_LEVEL_REQUIREMENTS, ITEM_SELL_PRICES, MATERIAL_SELL_PRICES, SYNTHESIS_COSTS, slotNames, SYNTHESIS_LEVEL_BENEFITS } from '../constants/index.js';
import Slider from './ui/Slider.js';

interface SynthesisPanelProps {
    synthesisSlots: (InventoryItem | null)[];
    onRemove: (index: number) => void;
    onSynthesize: () => void;
    onCancel: () => void;
    currentUser: UserWithStatus;
}

const SynthesisPanel: React.FC<SynthesisPanelProps> = ({ synthesisSlots, onRemove, onSynthesize, onCancel, currentUser }) => {
    const firstItem = useMemo(() => synthesisSlots.find(item => item !== null), [synthesisSlots]);
    const cost = useMemo(() => {
        if (!firstItem) return 0;
        return SYNTHESIS_COSTS[firstItem.grade] || 0;
    }, [firstItem]);

    const canSynthesize = useMemo(() => {
        return synthesisSlots.filter(item => item !== null).length === 3 && currentUser.gold >= cost;
    }, [synthesisSlots, currentUser.gold, cost]);
    
    const isMythicSynthesis = firstItem?.grade === 'mythic';
    const synthesisLevel = currentUser.synthesisLevel || 1;
    const levelBenefits = SYNTHESIS_LEVEL_BENEFITS.find(b => b.level === synthesisLevel) || SYNTHESIS_LEVEL_BENEFITS[1];
    const doubleMythicChance = levelBenefits.doubleMythicChance;

    const renderSlot = (item: InventoryItem | null, index: number, isResult = false) => (
        <div 
            key={isResult ? 'result' : index}
            className={`relative w-20 h-20 rounded-lg border-2 ${isResult ? 'border-yellow-400' : 'border-color'} bg-tertiary/50 ${!isResult && item ? 'cursor-pointer' : ''}`}
            onClick={() => !isResult && item && onRemove(index)}
            title={!isResult && item ? `${item.name} 제거` : (isResult ? '결과' : '아이템을 선택하세요')}
        >
            {item ? (
                <>
                    <img src={gradeBackgrounds[item.grade]} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-md" />
                    {renderStarDisplay(item.stars)}
                    {item.image && <img src={item.image} alt={item.name} className="relative w-full h-full object-contain p-1" />}
                </>
            ) : (
                isResult && <span className="text-4xl flex items-center justify-center h-full text-tertiary">?</span>
            )}
        </div>
    );

    return (
        <div className="w-full h-full bg-secondary rounded-lg shadow-inner relative p-4 flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-xl text-highlight">장비 합성</h3>
                <Button onClick={onCancel} colorScheme="gray">돌아가기</Button>
            </div>
            <div className="flex-grow flex flex-col items-center justify-center">
                <div className="flex items-center justify-center gap-2 mb-4">
                    {synthesisSlots.map((item, index) => (
                        <React.Fragment key={index}>
                            {renderSlot(item, index)}
                            {index < 2 && <span className="text-2xl font-bold text-tertiary mx-1">+</span>}
                        </React.Fragment>
                    ))}
                    <span className="text-4xl font-bold text-highlight mx-2">=</span>
                    {renderSlot(null, -1, true)}
                </div>
                <p className="text-xs text-tertiary text-center mb-4">합성할 동일한 등급의 장비 3개를 선택하세요.<br/>선택된 장비를 다시 클릭하면 등록이 해제됩니다.</p>
                {isMythicSynthesis && (
                    <p className="text-sm text-cyan-300 font-semibold">
                        더블 신화 옵션 장비 획득 확률: {doubleMythicChance}%
                    </p>
                )}
            </div>
            <div className="flex-shrink-0 flex items-center justify-between mt-4 pt-4 border-t border-color">
                <div className="text-sm">
                    <p>비용:</p>
                    <p className={`font-bold text-lg ${currentUser.gold >= cost ? 'text-yellow-300' : 'text-red-400'}`}>{cost.toLocaleString()} 골드</p>
                </div>
                <Button onClick={onSynthesize} disabled={!canSynthesize} colorScheme="green" className="w-40 py-3">합성</Button>
            </div>
        </div>
    );
};

const CraftingPanel: React.FC<{
    inventory: InventoryItem[];
    onStartCraft: (materialName: string, craftType: 'upgrade' | 'downgrade') => void;
}> = ({ inventory, onStartCraft }) => {
    const materialTiers = ['하급 강화석', '중급 강화석', '상급 강화석', '최상급 강화석', '신비의 강화석'];
    
    const materialCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        inventory.filter(i => i.type === 'material').forEach(i => {
            counts[i.name] = (counts[i.name] || 0) + (i.quantity || 0);
        });
        return counts;
    }, [inventory]);

    return (
        <div className="w-full h-full p-4 flex flex-col">
            <h3 className="font-bold text-xl text-highlight mb-4 text-center flex-shrink-0">재료 변환</h3>
            <p className="text-xs text-tertiary text-center mb-4 flex-shrink-0">
                상위 재료 1개 = 하위 재료 5개<br/>
                하위 재료 10개 = 상위 재료 1개
            </p>
            <ul className="space-y-2 overflow-y-auto flex-grow">
                {materialTiers.map((materialName, index) => {
                    const template = MATERIAL_ITEMS[materialName as keyof typeof MATERIAL_ITEMS];
                    const count = materialCounts[materialName] || 0;
                    const canUpgrade = index < materialTiers.length - 1 && count >= 10;
                    const canDowngrade = index > 0 && count >= 1;
                    return (
                        <li key={materialName} className="flex items-center justify-between bg-tertiary/50 p-2 rounded-md">
                            <div className="flex items-center gap-3">
                                <img src={template.image!} alt={materialName} className="w-10 h-10" />
                                <div>
                                    <p className="font-semibold text-primary">{materialName}</p>
                                    <p className="text-xs text-tertiary">보유: {count.toLocaleString()}개</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={() => onStartCraft(materialName, 'downgrade')} disabled={!canDowngrade} colorScheme="orange" className="!text-xs !py-1">분해</Button>
                                <Button onClick={() => onStartCraft(materialName, 'upgrade')} disabled={!canUpgrade} colorScheme="blue" className="!text-xs !py-1">합성</Button>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

interface InventoryModalProps {
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
    onStartEnhance: (item: InventoryItem) => void;
    enhancementAnimationTarget: { itemId: string; stars: number } | null;
    onAnimationComplete: () => void;
    isTopmost?: boolean;
    initialTab?: InventoryTab;
}

type SortKey = 'createdAt' | 'type' | 'grade';

const MAX_INVENTORY_SIZE_PER_TAB = 100;
const EXPANSION_COST_DIAMONDS = 100;
const EXPANSION_AMOUNT = 10;

const gradeBackgrounds: Record<ItemGrade, string> = {
    normal: '/images/equipments/normalbgi.png',
    uncommon: '/images/equipments/uncommonbgi.png',
    rare: '/images/equipments/rarebgi.png',
    epic: '/images/equipments/epicbgi.png',
    legendary: '/images/equipments/legendarybgi.png',
    mythic: '/images/equipments/mythicbgi.png',
};

const gradeStyles: Record<ItemGrade, { name: string; color: string; }> = {
    normal: { name: '일반', color: 'text-gray-300' },
    uncommon: { name: '고급', color: 'text-green-400' },
    rare: { name: '희귀', color: 'text-blue-400' },
    epic: { name: '에픽', color: 'text-purple-400' },
    legendary: { name: '전설', color: 'text-red-500' },
    mythic: { name: '신화', color: 'text-orange-400' },
};

const gradeOrder: Record<ItemGrade, number> = {
    normal: 0,
    uncommon: 1,
    rare: 2,
    epic: 3,
    legendary: 4,
    mythic: 5,
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

const renderStarDisplay = (stars: number) => {
    if (stars === 0) return null;

    let starImage = '';
    let numberColor = '';
    let starImageClass = '';

    if (stars >= 10) {
        starImage = '/images/equipments/Star4.png';
        numberColor = "prism-text-effect";
        starImageClass = "prism-image-effect";
    } else if (stars >= 7) {
        starImage = '/images/equipments/Star3.png';
        numberColor = "text-purple-400";
    } else if (stars >= 4) {
        starImage = '/images/equipments/Star2.png';
        numberColor = "text-amber-400";
    } else if (stars >= 1) {
        starImage = '/images/equipments/Star1.png';
        numberColor = "text-white";
    }

    return (
        <div className="absolute top-0.5 left-0.5 flex items-center gap-0.5 bg-black/40 rounded-br-md px-1 py-0.5 z-10" style={{ textShadow: '1px 1px 2px black' }}>
            <img src={starImage} alt="star" className={`w-3 h-3 ${starImageClass}`} />
            <span className={`font-bold text-xs leading-none ${numberColor}`}>{stars}</span>
        </div>
    );
};

const calculateSellPrice = (item: InventoryItem): number => {
    if (item.type === 'equipment') {
        if (item.isEquipped) {
            return 0;
        }
        const basePrice = ITEM_SELL_PRICES[item.grade] || 0;
        const enhancementMultiplier = Math.pow(1.2, item.stars);
        return Math.floor(basePrice * enhancementMultiplier);
    }
    if (item.type === 'material') {
        const pricePerUnit = MATERIAL_SELL_PRICES[item.name] || 1;
        return pricePerUnit * (item.quantity || 1);
    }
    return 0;
};

const OptionSection: React.FC<{ title: string; options: ItemOption[]; color: string; }> = ({ title, options, color }) => {
    if (options.length === 0) return null;
    return (
        <div>
            <h5 className={`font-semibold ${color} border-b border-gray-600 pb-1 mb-1`}>{title}</h5>
            <ul className="list-disc list-inside space-y-0.5 text-gray-300">
                {options.map((opt: ItemOption, i: number) => <li key={i}>{opt.display}</li>)}
            </ul>
        </div>
    );
};

const renderOptions = (item: InventoryItem) => {
    if (!item.options) return null;
    const { combatSubs, specialSubs, mythicSubs } = item.options;
    return (
        <div className="w-full text-xs text-left space-y-2">
            <OptionSection title="전투 부옵션" options={combatSubs} color="text-blue-300" />
            <OptionSection title="특수 부옵션" options={specialSubs} color="text-green-300" />
            <OptionSection title="신화 부옵션" options={mythicSubs} color="text-red-400" />
        </div>
    )
};

const OptionSectionWithComparison: React.FC<{
    title: string;
    color: string;
    currentOptions: ItemOption[];
    comparisonOptions: ItemOption[] | undefined;
}> = ({ title, color, currentOptions, comparisonOptions }) => {
    const comparisonMap = new Map(comparisonOptions?.map(opt => [opt.type, opt]));
    const currentRendered = currentOptions.map(opt => {
        let changeIndicator: React.ReactNode = null;
        const comparisonOpt = comparisonMap.get(opt.type);
        if (comparisonOpt) {
            const diff = opt.value - comparisonOpt.value;
            if (Math.abs(diff) > 0.001) {
                const diffText = diff.toFixed(opt.isPercentage ? 1 : 0).replace(/\.0$/, '');
                changeIndicator = (
                    <span className={diff > 0 ? "text-green-400 ml-2" : "text-red-400 ml-2"}>
                        ({diff > 0 ? '▲' : '▼'} {diff > 0 ? '+' : ''}{diffText})
                    </span>
                );
            }
        } else {
            changeIndicator = <span className="text-blue-400 ml-2">(New)</span>;
        }
        return <li key={opt.type}>{opt.display}{changeIndicator}</li>;
    });

    const removedOptions = comparisonOptions?.filter(opt => !currentOptions.some(cOpt => cOpt.type === opt.type)) || [];
    if (currentRendered.length === 0 && removedOptions.length === 0) return null;

    return (
        <div>
            <h5 className={`font-semibold ${color} border-b border-gray-600 pb-1 mb-1`}>{title}</h5>
            <ul className="list-disc list-inside space-y-0.5 text-gray-300">
                {currentRendered}
                {removedOptions.map(opt => (
                    <li key={opt.type} className="text-gray-500 line-through">{opt.display}</li>
                ))}
            </ul>
        </div>
    );
};

interface ItemDisplayCardProps { 
    item: InventoryItem | null | undefined; 
    title: string; 
    slot?: EquipmentSlot | null; 
    currentUser: UserWithStatus; 
    activeTab: InventoryTab; 
    isLarge?: boolean;
    comparisonItem?: InventoryItem | null | undefined;
}

const ItemDisplayCard: React.FC<ItemDisplayCardProps> = ({ item, title, slot, currentUser, activeTab, isLarge, comparisonItem }) => {
    const renderItemDetails = () => {
        if (!item) return null;
        if (comparisonItem && item.type === 'equipment' && item.options) {
            const { combatSubs, specialSubs, mythicSubs } = item.options;
            const comparisonOptions = comparisonItem.options;

            return (
                <div className="w-full text-left space-y-2 text-[clamp(0.6rem,1.2vh,0.75rem)]">
                    <OptionSectionWithComparison title="전투 부옵션" color="text-blue-300" currentOptions={combatSubs} comparisonOptions={comparisonOptions?.combatSubs} />
                    <OptionSectionWithComparison title="특수 부옵션" color="text-green-300" currentOptions={specialSubs} comparisonOptions={comparisonOptions?.specialSubs} />
                    <OptionSectionWithComparison title="신화 부옵션" color="text-red-400" currentOptions={mythicSubs} comparisonOptions={comparisonOptions?.mythicSubs} />
                </div>
            );
        }
        return renderOptions(item);
    };

    if (!item) {
        if (title === '현재 장착') {
            return (
                <div className="bg-secondary/50 rounded-lg p-3 flex flex-col h-full items-center justify-center text-center">
                    <h3 className="font-bold text-tertiary mb-1 text-[clamp(0.8rem,1.5vh,1rem)]">{title}</h3>
                    <div className="bg-tertiary rounded-lg flex items-center justify-center text-tertiary mb-1 text-sm w-[clamp(4rem,12vh,6rem)] h-[clamp(4rem,12vh,6rem)]">
                        {slot ? 
                            <img src={emptySlotImages[slot]} alt={`${slot} slot`} className="w-full h-full object-contain p-2" />
                            :
                            <img src="/images/BlankEquipmentsSlot.png" alt="empty slot" className="w-full h-full object-contain p-2" />
                        }
                    </div>
                    <p className="text-tertiary text-xs">장착된 아이템이 없습니다.</p>
                </div>
            );
        }

        let emptyText = '아이템을 선택해주세요.';
        let emptyIcon = <img src="/images/BlankEquipmentsSlot.png" alt="empty slot" className="w-full h-full object-contain p-2" />;
        if (activeTab === 'consumable') {
            emptyText = '소모품을 선택하여 정보를 확인하세요.';
            emptyIcon = <span className="text-4xl">🧪</span>;
        } else if (activeTab === 'material') {
            emptyText = '재료를 선택하여 정보를 확인하세요.';
            emptyIcon = <span className="text-4xl">💎</span>;
        }
        
        return (
            <div className={`bg-secondary/50 rounded-lg p-3 flex flex-col h-full items-center justify-center text-center ${isLarge ? 'flex-1' : ''}`}>
                <h3 className="font-bold text-tertiary mb-1 text-base">{title}</h3>
                <div className="bg-tertiary rounded-lg flex items-center justify-center text-tertiary mb-1 text-sm w-[clamp(4.5rem,14vh,6.5rem)] h-[clamp(4.5rem,14vh,6.5rem)]">
                    {emptyIcon}
                </div>
                <p className="text-tertiary text-sm">{emptyText}</p>
            </div>
        );
    }
    
    const styles = gradeStyles[item.grade];

    if (item.type === 'material' || item.type === 'consumable') {
        return (
            <div className={`bg-secondary/50 rounded-lg p-3 flex flex-col h-full items-center text-center ${isLarge ? 'flex-1' : ''}`}>
                <h3 className="font-bold text-tertiary mb-1 text-[clamp(0.8rem,1.5vh,1rem)] flex-shrink-0">{title}</h3>
                <div className="relative rounded-lg flex items-center justify-center my-2 flex-shrink-0 w-[clamp(5rem,15vh,7rem)] h-[clamp(5rem,15vh,7rem)]">
                    <img src={gradeBackgrounds[item.grade]} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-lg" />
                    {item.image && <img src={item.image} alt={item.name} className="relative w-full h-full object-contain p-4"/>}
                </div>
                <div className="flex items-baseline justify-center gap-1">
                    <h4 className={`font-bold ${styles.color} text-[clamp(1rem,2vh,1.25rem)]`}>{item.name}</h4>
                </div>
                <p className="text-xs mt-1 flex-shrink-0">
                    <span className={`font-bold ${styles.color}`}>[{styles.name}]</span>
                </p>
                <div className="w-full mt-4 pt-4 border-t border-color text-secondary">
                    <p className="text-sm">{item.description}</p>
                </div>
            </div>
        );
    }
    
    const userLevelSum = currentUser.strategyLevel + currentUser.playfulLevel;
    const requiredLevel = item.type === 'equipment' ? GRADE_LEVEL_REQUIREMENTS[item.grade] : 0;
    const levelRequirementMet = userLevelSum >= requiredLevel;
    const starInfo = getStarDisplayInfo(item.stars);

    return (
        <div className="bg-secondary/50 rounded-lg p-3 flex flex-col h-full items-center text-center">
            <h3 className="font-bold text-tertiary mb-1 text-[clamp(0.8rem,1.5vh,1rem)] flex-shrink-0">{title}</h3>
            <div className="relative rounded-lg flex items-center justify-center mb-1 flex-shrink-0 w-[clamp(4.5rem,12vh,6rem)] h-[clamp(4.5rem,12vh,6rem)]">
                <img src={gradeBackgrounds[item.grade]} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-lg" />
                {item.image && <img src={item.image} alt={item.name} className="relative w-full h-full object-contain p-3"/>}
            </div>
            <div className="flex items-baseline justify-center gap-1">
                <h4 className={`font-bold ${starInfo.colorClass} text-[clamp(0.75rem,1.8vh,1rem)]`}>{item.name}</h4>
                {item.type === 'equipment' && item.stars > 0 && <span className={`font-bold ${starInfo.colorClass} text-[clamp(0.75rem,1.8vh,1rem)]`}>{starInfo.text}</span>}
            </div>
            {item.type === 'equipment' && (
                <p className="text-xs mt-1 flex-shrink-0 text-center">
                    <span className={`font-bold ${styles.color}`}>[{styles.name}]</span>
                    {item.options?.main && (
                        <span className="font-semibold text-yellow-300 ml-1">{item.options.main.display}</span>
                    )}
                    <span className={!levelRequirementMet ? 'text-red-400' : 'text-tertiary'}> (Lv.{requiredLevel})</span>
                </p>
            )}
            <div className="w-full mt-2 pt-2 border-t border-color text-secondary flex-grow overflow-y-auto pr-2">
                 {renderItemDetails()}
            </div>
        </div>
    );
};

const DisassemblyPreviewPanel: React.FC<{
    selectedIds: Set<string>;
    inventory: InventoryItem[];
}> = ({ selectedIds, inventory }) => {
    const { totalMaterials, totalSellPrice, itemCount } = useMemo(() => {
        const selectedItems = inventory.filter(item => selectedIds.has(item.id));
        const materials: Record<string, number> = {};
        let price = 0;

        for (const item of selectedItems) {
            price += calculateSellPrice(item);

            const enhancementIndex = Math.min(item.stars, 9);
            const costInfo = ENHANCEMENT_COSTS[item.grade]?.[enhancementIndex];
            if (costInfo) {
                for (const cost of costInfo.materials) {
                    const yieldAmount = Math.floor(cost.amount * 0.25);
                    if (yieldAmount > 0) {
                        materials[cost.name] = (materials[cost.name] || 0) + yieldAmount;
                    }
                }
            }
        }
        
        return {
            totalMaterials: Object.entries(materials).map(([name, amount]) => ({ name, amount })),
            totalSellPrice: price,
            itemCount: selectedItems.length
        };
    }, [selectedIds, inventory]);

    return (
        <div className="w-full h-full bg-secondary/50 rounded-lg p-4 flex flex-col text-center">
            <h3 className="font-bold text-lg text-tertiary mb-2">분해 미리보기</h3>
            <p className="text-sm text-tertiary mb-4">선택된 아이템: {itemCount}개</p>
            <div className="flex-grow w-full bg-tertiary/30 p-3 rounded-md overflow-y-auto space-y-2">
                <h4 className="font-semibold text-highlight text-left border-b border-color pb-1">예상 획득 재료</h4>
                {totalMaterials.length > 0 ? (
                    totalMaterials.map(({ name, amount }) => {
                        const template = MATERIAL_ITEMS[name as keyof typeof MATERIAL_ITEMS];
                        return (
                            <div key={name} className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2">
                                    {template?.image && <img src={template.image} alt={name} className="w-6 h-6" />}
                                    {name}
                                </span>
                                <span className="font-mono text-primary">x {amount.toLocaleString()}</span>
                            </div>
                        );
                    })
                ) : (
                    <p className="text-sm text-tertiary pt-4">획득할 재료가 없습니다.</p>
                )}
                 <p className="text-xs text-cyan-300 text-center pt-4">분해 시 일정 확률로 '대박'이 발생하여 모든 재료 획득량이 2배가 됩니다!</p>
            </div>
            <div className="mt-4 text-sm text-tertiary">
                <p>선택 아이템 판매 시: <span className="font-bold text-yellow-300">{totalSellPrice.toLocaleString()} 골드</span></p>
            </div>
        </div>
    );
};

const CraftingDetailModal: React.FC<{
    details: { materialName: string, craftType: 'upgrade' | 'downgrade' };
    inventory: InventoryItem[];
    onClose: () => void;
    onAction: (action: ServerAction) => void;
}> = ({ details, inventory, onClose, onAction }) => {
    const { materialName, craftType } = details;
    const isUpgrade = craftType === 'upgrade';
    
    const materialTiers = ['하급 강화석', '중급 강화석', '상급 강화석', '최상급 강화석', '신비의 강화석'];
    const tierIndex = materialTiers.indexOf(materialName);
    if (tierIndex === -1) {
        onClose(); // Should not happen
        return null;
    }

    const sourceMaterialName = materialName;
    const targetMaterialName = isUpgrade ? materialTiers[tierIndex + 1] : materialTiers[tierIndex - 1];

    const sourceTemplate = MATERIAL_ITEMS[sourceMaterialName];
    const targetTemplate = MATERIAL_ITEMS[targetMaterialName];

    const conversionRate = isUpgrade ? 10 : 1;
    const yieldRate = isUpgrade ? 1 : 5;

    const sourceMaterialCount = useMemo(() => {
        return inventory
            .filter(i => i.name === sourceMaterialName)
            .reduce((sum, i) => sum + (i.quantity || 0), 0);
    }, [inventory, sourceMaterialName]);

    const maxQuantity = Math.floor(sourceMaterialCount / conversionRate);
    const [quantity, setQuantity] = useState(maxQuantity > 0 ? 1 : 0);

    const handleQuantityChange = (newQuantity: number) => {
        setQuantity(Math.max(0, Math.min(maxQuantity, newQuantity)));
    };
    
    const handleConfirm = () => {
        if (quantity > 0) {
            onAction({ type: 'CRAFT_MATERIAL', payload: { materialName, craftType, quantity } });
        }
        onClose();
    };

    return (
        <div className="absolute inset-0 bg-black/80 z-20 flex items-center justify-center" onClick={onClose}>
            <div className="bg-panel rounded-lg shadow-xl p-6 w-full max-w-md border border-color text-on-panel" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-center mb-4">{isUpgrade ? '재료 합성' : '재료 분해'}</h2>

                <div className="flex items-center justify-around text-center mb-4">
                    <div className="flex flex-col items-center">
                        <img src={sourceTemplate.image!} alt={sourceMaterialName} className="w-16 h-16" />
                        <span className="font-semibold">{sourceMaterialName}</span>
                        <span className="text-xs text-tertiary mt-1">보유: {sourceMaterialCount.toLocaleString()}개</span>
                    </div>
                    <div className="text-4xl font-bold text-highlight mx-4">→</div>
                    <div className="flex flex-col items-center">
                        <img src={targetTemplate.image!} alt={targetMaterialName} className="w-16 h-16" />
                        <span className="font-semibold">{targetMaterialName}</span>
                        <span className="text-sm text-green-400 mt-1">획득: {(quantity * yieldRate).toLocaleString()}개</span>
                    </div>
                </div>
                
                <div className="space-y-2">
                    <label htmlFor="quantity-slider" className="block text-sm font-medium text-secondary text-center">
                        {isUpgrade ? '합성' : '분해'}할 {sourceMaterialName}: <span className="font-bold text-highlight">{(quantity * conversionRate).toLocaleString()} / {sourceMaterialCount.toLocaleString()}</span>개
                    </label>
                    <Slider 
                        value={quantity}
                        min={0}
                        max={maxQuantity}
                        onChange={handleQuantityChange}
                        disabled={maxQuantity === 0}
                    />
                     <div className="flex justify-between text-xs text-tertiary">
                        <span>0회</span>
                        <span>{maxQuantity}회</span>
                    </div>
                    <p className="text-center text-sm text-tertiary">
                        {isUpgrade ? '합성' : '분해'} 횟수: {quantity.toLocaleString()}회
                    </p>
                </div>

                <div className="flex justify-end gap-4 mt-6">
                    <Button onClick={onClose} colorScheme="gray">취소</Button>
                    <Button onClick={handleConfirm} colorScheme={isUpgrade ? 'blue' : 'orange'} disabled={quantity === 0}>
                        {quantity}회 {isUpgrade ? '합성' : '분해'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

const AutoSelectModal: React.FC<{
    onClose: () => void;
    onConfirm: (selectedGrades: ItemGrade[]) => void;
}> = ({ onClose, onConfirm }) => {
    const [selectedGrades, setSelectedGrades] = useState<ItemGrade[]>([]);

    const handleToggleGrade = (grade: ItemGrade) => {
        setSelectedGrades(prev =>
            prev.includes(grade) ? prev.filter(g => g !== grade) : [...prev, grade]
        );
    };

    const handleConfirmClick = () => {
        onConfirm(selectedGrades);
        onClose();
    };

    return (
        <DraggableWindow title="분해 자동 선택" onClose={onClose} windowId="disassembly-auto-select" isTopmost>
            <div className="text-on-panel">
                <p className="text-sm text-tertiary mb-4 text-center">분해할 장비 등급을 선택하세요. 신화 등급은 제외됩니다.</p>
                <div className="grid grid-cols-2 gap-3">
                    {['normal', 'uncommon', 'rare', 'epic', 'legendary'].map(grade => {
                        const style = gradeStyles[grade as ItemGrade];
                        return (
                            <label key={grade} className="flex items-center gap-3 p-3 bg-tertiary/50 rounded-lg cursor-pointer border-2 border-transparent has-[:checked]:border-accent">
                                <input
                                    type="checkbox"
                                    checked={selectedGrades.includes(grade as ItemGrade)}
                                    onChange={() => handleToggleGrade(grade as ItemGrade)}
                                    className="w-5 h-5 text-accent bg-secondary border-color rounded focus:ring-accent"
                                />
                                <span className={`font-semibold ${style.color}`}>{style.name}</span>
                            </label>
                        );
                    })}
                </div>
                <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-color">
                    <Button onClick={onClose} colorScheme="gray">취소</Button>
                    <Button onClick={handleConfirmClick} colorScheme="blue">선택 완료</Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

const BulkUseModal: React.FC<{
    item: InventoryItem;
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
}> = ({ item, currentUser, onClose, onAction }) => {
    const maxQuantity = useMemo(() => {
        return currentUser.inventory
            .filter(i => i.name === item.name && i.type === 'consumable')
            .reduce((sum, i) => sum + (i.quantity || 1), 0);
    }, [currentUser.inventory, item.name]);

    const [quantity, setQuantity] = useState(1);

    const handleQuantityChange = (newQuantity: number) => {
        setQuantity(Math.max(1, Math.min(maxQuantity, newQuantity)));
    };

    const handleUse = () => {
        if (quantity > 0) {
            onAction({ type: 'USE_ITEM_BULK', payload: { itemName: item.name, quantity } });
        }
        onClose();
    };

    return (
        <DraggableWindow title={`'${item.name}' 일괄 사용`} onClose={onClose} windowId={`bulk-use-${item.id}`} initialWidth={450}>
            <div className="text-center">
                <div className="flex flex-col items-center gap-2 mb-4">
                    <div className="relative w-24 h-24">
                        <img src={gradeBackgrounds[item.grade]} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-lg" />
                        <img src={item.image!} alt={item.name} className="relative w-full h-full object-contain p-2" />
                    </div>
                    <h3 className="text-xl font-bold">{item.name}</h3>
                    <p className="text-sm text-tertiary">보유 수량: {maxQuantity.toLocaleString()}개</p>
                </div>

                <div className="space-y-3 bg-tertiary/50 p-4 rounded-lg">
                    <div className="flex items-center gap-4">
                        <input
                            type="number"
                            value={quantity}
                            onChange={(e) => handleQuantityChange(parseInt(e.target.value, 10) || 1)}
                            className="w-full bg-secondary border border-color rounded-md p-2 text-center font-bold text-lg"
                            min="1"
                            max={maxQuantity}
                        />
                    </div>
                    <Slider 
                        value={quantity}
                        min={1}
                        max={maxQuantity}
                        onChange={handleQuantityChange}
                    />
                     <div className="grid grid-cols-5 gap-2">
                        <Button onClick={() => handleQuantityChange(quantity - 10)} className="!py-1">-10</Button>
                        <Button onClick={() => handleQuantityChange(quantity - 1)} className="!py-1">-1</Button>
                        <Button onClick={() => handleQuantityChange(maxQuantity)} colorScheme="blue" className="!py-1">MAX</Button>
                        <Button onClick={() => handleQuantityChange(quantity + 1)} className="!py-1">+1</Button>
                        <Button onClick={() => handleQuantityChange(quantity + 10)} className="!py-1">+10</Button>
                    </div>
                    <p className="text-center text-sm text-tertiary">
                        사용할 수량: {quantity.toLocaleString()}개
                    </p>
                </div>
                
                <div className="flex justify-center gap-4 mt-6">
                    <Button onClick={onClose} colorScheme="gray" className="w-32">취소</Button>
                    <Button onClick={handleUse} colorScheme="green" className="w-32">사용</Button>
                </div>
            </div>
        </DraggableWindow>
    );
};


const SynthesisLevelPanel: React.FC<{ user: UserWithStatus }> = ({ user }) => {
    const { synthesisLevel, synthesisXp } = user;
    const requiredXp = synthesisLevel * 10000;
    const progressPercent = (synthesisXp / requiredXp) * 100;
    
    return (
        <div className="flex-shrink-0">
            <div className="flex justify-between items-baseline mb-0.5 text-xs">
                <span className="font-semibold text-primary">장비 합성 레벨 <span className="text-base font-bold">Lv.{synthesisLevel}</span></span>
                <span className="font-mono text-tertiary">{synthesisXp.toLocaleString()} / {requiredXp.toLocaleString()}</span>
            </div>
            <div className="w-full bg-tertiary/50 rounded-full h-3 border border-color">
                <div className="bg-gradient-to-r from-purple-500 to-fuchsia-500 h-full rounded-full" style={{ width: `${progressPercent}%` }}></div>
            </div>
        </div>
    );
};


const InventoryModal: React.FC<InventoryModalProps> = ({ currentUser, onClose, onAction, onStartEnhance, enhancementAnimationTarget, onAnimationComplete, isTopmost, initialTab }) => {
    const { inventory, inventorySlots, diamonds } = currentUser;
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<InventoryTab>(initialTab || 'all');
    const [sortKey, setSortKey] = useState<SortKey>('createdAt');
    const [disassembleMode, setDisassembleMode] = useState(false);
    const [showSynthesis, setShowSynthesis] = useState(false);
    const [selectedForDisassembly, setSelectedForDisassembly] = useState<Set<string>>(new Set());
    const [craftingDetails, setCraftingDetails] = useState<{ materialName: string, craftType: 'upgrade' | 'downgrade' } | null>(null);
    const [isAutoSelectOpen, setIsAutoSelectOpen] = useState(false);
    const [itemForBulkUse, setItemForBulkUse] = useState<InventoryItem | null>(null);
    
    const [synthesisMode, setSynthesisMode] = useState(false);
    const [synthesisSlots, setSynthesisSlots] = useState<(InventoryItem | null)[]>([null, null, null]);

    const inventoryCounts = useMemo(() => {
        return {
            equipment: inventory.filter(i => i.type === 'equipment').length,
            consumable: inventory.filter(i => i.type === 'consumable').length,
            material: inventory.filter(i => i.type === 'material').length,
        };
    }, [inventory]);
    
    const getTabCount = (tab: InventoryTab) => {
        if (tab === 'all') {
            return inventory.length;
        }
        return inventoryCounts[tab];
    };
    
    const getTabSlots = (tab: InventoryTab) => {
        if (tab === 'all') {
            return inventorySlots.equipment + inventorySlots.consumable + inventorySlots.material;
        }
        return inventorySlots[tab];
    };

    const handleExpand = () => {
        const tabToExpand = activeTab;
        if (tabToExpand === 'all') {
            alert('확장할 인벤토리 탭(장비/소모품/재료)을 선택해주세요.');
            return;
        }
        
        const tabNameMap = {
            equipment: '장비',
            consumable: '소모품',
            material: '재료',
        };

        if (window.confirm(`다이아 ${EXPANSION_COST_DIAMONDS}개를 사용하여 ${tabNameMap[tabToExpand]} 가방을 ${EXPANSION_AMOUNT}칸 확장하시겠습니까?`)) {
            onAction({ type: 'EXPAND_INVENTORY', payload: { tab: tabToExpand } });
        }
    };

    useEffect(() => {
        if (!synthesisMode) {
            setSynthesisSlots([null, null, null]);
        }
    }, [synthesisMode]);

    const selectedItem = useMemo(() => {
        if (!selectedItemId) return null;
        return inventory.find(item => item.id === selectedItemId) || null;
    }, [selectedItemId, inventory]);
    
    const isEquipmentView = useMemo(() => (activeTab === 'equipment') || (selectedItem?.type === 'equipment'), [activeTab, selectedItem]);


    useEffect(() => {
        if (synthesisMode) setActiveTab('equipment');
    }, [synthesisMode]);

    useEffect(() => {
        if (enhancementAnimationTarget) {
            const timer = setTimeout(() => onAnimationComplete(), 800);
            return () => clearTimeout(timer);
        }
    }, [enhancementAnimationTarget, onAnimationComplete]);
    
    const handleSell = () => {
        if (!selectedItem) return;
        if (selectedItem.type === 'equipment' && selectedItem.isEquipped) {
            alert('장착 중인 아이템은 판매할 수 없습니다.');
            return;
        }
        if (selectedItem.type === 'consumable') {
            alert('소모품은 판매할 수 없습니다.');
            return;
        }
        const sellPrice = calculateSellPrice(selectedItem);
        const isHighGrade = selectedItem.type === 'equipment' && gradeOrder[selectedItem.grade] >= gradeOrder.epic;
        let confirmMessage = `[${selectedItem.name}] 아이템을 ${sellPrice.toLocaleString()} 골드에 판매하시겠습니까?`;
        if (isHighGrade) confirmMessage = `등급이 높은 장비가 있습니다.\n\n` + confirmMessage;
        if (window.confirm(confirmMessage)) {
            onAction({ type: 'SELL_ITEM', payload: { itemId: selectedItem.id } });
            setSelectedItemId(null);
        }
    };
    
    const filteredAndSortedInventory = useMemo(() => {
        let items = [...inventory];
        if (activeTab !== 'all') items = items.filter(item => item.type === activeTab);
        return items.sort((a, b) => {
            if (sortKey === 'createdAt') return b.createdAt - a.createdAt;
            if (sortKey === 'grade') {
                const gradeA = gradeOrder[a.grade];
                const gradeB = gradeOrder[b.grade];
                if (gradeA !== gradeB) return gradeB - gradeA;
                return b.stars - a.stars;
            }
            if (sortKey === 'type') {
                const typeOrder: Record<InventoryItemType, number> = { equipment: 1, consumable: 2, material: 3 };
                return typeOrder[a.type] - typeOrder[b.type];
            }
            return 0;
        });
    }, [inventory, activeTab, sortKey]);
    
    useEffect(() => setSelectedItemId(null), [activeTab, disassembleMode, showSynthesis, synthesisMode]);
    useEffect(() => {
        if (selectedItemId && !inventory.some(i => i.id === selectedItemId)) setSelectedItemId(null);
    }, [inventory, selectedItemId]);
    
    const currentlyEquippedItem = useMemo(() => {
        if (selectedItem?.type !== 'equipment' || !selectedItem.slot) return null;
        return inventory.find(item => item.isEquipped && item.slot === selectedItem.slot);
    }, [selectedItem, inventory]);
    
    const canExpand = activeTab === 'all' ? false : (inventorySlots[activeTab] || 0) < MAX_INVENTORY_SIZE_PER_TAB;

    const handleDisassemble = () => {
        if (selectedForDisassembly.size === 0) return;
        const hasHighGrade = Array.from(selectedForDisassembly).some(itemId => {
            const item = inventory.find(i => i.id === itemId);
            return item && (item.grade === 'legendary' || item.grade === 'mythic');
        });
        if (hasHighGrade && !window.confirm("높은 등급의 장비가 포함되어 있습니다. 그래도 분해하시겠습니까?")) return;
        if (window.confirm(`${selectedForDisassembly.size}개의 아이템을 분해하시겠습니까?`)) {
            onAction({ type: 'DISASSEMBLE_ITEM', payload: { itemIds: Array.from(selectedForDisassembly) } });
            setSelectedForDisassembly(new Set());
            setDisassembleMode(false);
        }
    };
    const toggleDisassemblySelection = (itemId: string) => setSelectedForDisassembly(prev => { const newSet = new Set(prev); newSet.has(itemId) ? newSet.delete(itemId) : newSet.add(itemId); return newSet; });
    const handleAutoSelectConfirm = (grades: ItemGrade[]) => {
        const itemsToSelect = inventory.filter(item => item.type === 'equipment' && !item.isEquipped && grades.includes(item.grade)).map(item => item.id);
        setSelectedForDisassembly(prev => new Set([...prev, ...itemsToSelect]));
        setIsAutoSelectOpen(false);
    };

    const handleEnterSynthesisMode = () => { setDisassembleMode(false); setShowSynthesis(false); setSynthesisMode(true); setSelectedItemId(null); };
    const handleExitSynthesisMode = () => { setSynthesisMode(false); setSynthesisSlots([null, null, null]); };
    const handleItemClickForSynthesis = (item: InventoryItem) => {
        if (item.type !== 'equipment') return;
        if (synthesisSlots.some(slot => slot?.id === item.id)) { setSynthesisSlots(synthesisSlots.map(slot => (slot?.id === item.id ? null : slot))); return; }
        const firstItemInSlots = synthesisSlots.find(slot => slot !== null);
        if (firstItemInSlots && item.grade !== firstItemInSlots.grade) return;
        const nextEmptySlotIndex = synthesisSlots.findIndex(slot => slot === null);
        if (nextEmptySlotIndex !== -1) { const newSlots = [...synthesisSlots]; newSlots[nextEmptySlotIndex] = item; setSynthesisSlots(newSlots); }
    };
    const handleRemoveFromSynthesis = (index: number) => { const newSlots = [...synthesisSlots]; newSlots[index] = null; setSynthesisSlots(newSlots); };
    const handleSynthesize = () => {
        const itemsInSlots = synthesisSlots.filter((item): item is InventoryItem => item !== null);
        if (itemsInSlots.length !== 3) { alert('3개의 장비를 모두 채워주세요.'); return; }
        const itemIds = itemsInSlots.map(item => item.id);
        const firstItemGrade = itemsInSlots[0]?.grade;
        if (!firstItemGrade) return;
        const synthesisCost = SYNTHESIS_COSTS[firstItemGrade] || 0;
        if (currentUser.gold < synthesisCost) { alert(`합성에 필요한 골드가 부족합니다. (필요: ${synthesisCost.toLocaleString()} 골드)`); return; }
        if(window.confirm(`[${gradeStyles[firstItemGrade].name} 등급] 장비 3개를 합성하시겠습니까?\n비용: ${synthesisCost.toLocaleString()} 골드`)) {
            onAction({ type: 'SYNTHESIZE_EQUIPMENT', payload: { itemIds } });
            handleExitSynthesisMode();
        }
    };
    const firstSynthesisItemGrade = useMemo(() => synthesisSlots.find(item => item !== null)?.grade, [synthesisSlots]);

    return (
        <DraggableWindow title="가방" onClose={onClose} windowId="inventory" initialWidth={850} isTopmost={isTopmost}>
            <div className="flex flex-col h-[calc(var(--vh,1vh)*75)]">
                {craftingDetails && <CraftingDetailModal details={craftingDetails} inventory={inventory} onClose={() => setCraftingDetails(null)} onAction={onAction} />}
                {isAutoSelectOpen && <AutoSelectModal onClose={() => setIsAutoSelectOpen(false)} onConfirm={handleAutoSelectConfirm} />}
                {itemForBulkUse && <BulkUseModal item={itemForBulkUse} currentUser={currentUser} onClose={() => setItemForBulkUse(null)} onAction={onAction} />}
                
                <div className="flex-shrink-0 border-b border-color pb-2 mb-2 flex justify-between items-center">
                     <div className="flex items-center gap-2">
                        {(activeTab === 'all' || activeTab === 'equipment') && <Button onClick={handleEnterSynthesisMode} disabled={synthesisMode} colorScheme="purple">장비 합성</Button>}
                        <Button onClick={() => { setDisassembleMode(true); setSelectedItemId(null); setSynthesisMode(false); }} disabled={disassembleMode}>장비 분해</Button>
                        <Button onClick={() => {setShowSynthesis(true); setDisassembleMode(false); setSynthesisMode(false);}} disabled={showSynthesis}>재료 변환</Button>
                    </div>
                     {(synthesisMode || disassembleMode || showSynthesis) && (
                        <Button onClick={() => { setSynthesisMode(false); setDisassembleMode(false); setShowSynthesis(false); setSelectedForDisassembly(new Set()); }} colorScheme="gray">돌아가기</Button>
                     )}
                </div>

                <div className="flex-1 min-h-0 mb-2">
                    {synthesisMode ? <SynthesisPanel synthesisSlots={synthesisSlots} onRemove={handleRemoveFromSynthesis} onSynthesize={handleSynthesize} onCancel={handleExitSynthesisMode} currentUser={currentUser} />
                    : disassembleMode ? <DisassemblyPreviewPanel selectedIds={selectedForDisassembly} inventory={inventory} />
                    : showSynthesis ? <div className="w-full h-full bg-secondary rounded-lg shadow-inner relative"><CraftingPanel inventory={inventory} onStartCraft={(materialName, craftType) => setCraftingDetails({ materialName, craftType })} /></div>
                    : !selectedItem ? <div className="w-full h-full bg-secondary/50 rounded-lg p-4 flex flex-col items-center justify-center text-center text-tertiary"><h3 className="font-bold text-lg">아이템 정보</h3><p className="text-sm mt-4">아래 목록에서 아이템을 선택하여<br/>상세 정보를 확인하세요.</p><div className="mt-4 w-full"><SynthesisLevelPanel user={currentUser} /></div></div>
                    : !isEquipmentView ? <ItemDisplayCard item={selectedItem} title="선택 아이템" currentUser={currentUser} activeTab={activeTab} isLarge={true} />
                    : <div className="w-full flex flex-row gap-4 h-full"><div className="w-1/2 h-full min-h-0"><ItemDisplayCard item={currentlyEquippedItem} title="현재 장착" slot={selectedItem?.slot} currentUser={currentUser} activeTab={activeTab} /></div><div className="w-1/2 h-full min-h-0"><ItemDisplayCard item={selectedItem} title="선택 아이템" slot={selectedItem?.slot} currentUser={currentUser} activeTab={activeTab} comparisonItem={currentlyEquippedItem} /></div></div>}
                </div>
                
                 { !synthesisMode && !disassembleMode && !showSynthesis && selectedItem && (
                    <div className="w-full pt-2 mt-2 border-y border-color flex flex-wrap justify-center items-center gap-2 py-2">
                        {selectedItem.type === 'equipment' && (<><Button onClick={() => onAction({ type: 'TOGGLE_EQUIP_ITEM', payload: { itemId: selectedItem.id } })} colorScheme="green">{selectedItem.isEquipped ? '장착 해제' : '장착'}</Button><Button onClick={() => onStartEnhance(selectedItem)} colorScheme="yellow" disabled={selectedItem.stars >= 10}>강화</Button></>)}
                        {selectedItem.type === 'consumable' && (<><Button onClick={() => onAction({ type: 'USE_ITEM', payload: { itemId: selectedItem.id } })} colorScheme="green">사용</Button><Button onClick={() => setItemForBulkUse(selectedItem)} colorScheme="blue">일괄 사용</Button></>)}
                        <Button onClick={handleSell} colorScheme="orange" disabled={selectedItem.type === 'consumable' || selectedItem.isEquipped}>판매</Button>
                    </div>
                 )}
                
                { disassembleMode && (
                     <div className="flex items-center justify-center gap-2 border-y border-color py-2 my-2">
                        <Button onClick={() => setIsAutoSelectOpen(true)} colorScheme="blue">자동 선택</Button>
                        <Button onClick={handleDisassemble} colorScheme="red" disabled={selectedForDisassembly.size === 0}>선택 아이템 분해 ({selectedForDisassembly.size})</Button>
                    </div>
                )}


                <div className={`flex-shrink-0 flex flex-col pt-2 transition-all duration-300 ${isEquipmentView ? 'h-48' : 'h-[45%]'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2 flex-shrink-0">
                        <div className="flex items-center gap-4">
                             <div className="flex bg-tertiary/70 p-1 rounded-lg">
                                {(['all', 'equipment', 'consumable', 'material'] as InventoryTab[]).map(tab => {
                                    const isDisabled = (synthesisMode && tab !== 'equipment') || showSynthesis;
                                    const tabNameMap: Record<InventoryTab, string> = { all: '전체', equipment: '장비', consumable: '소모품', material: '재료' };
                                    return <button key={tab} onClick={() => { if (!isDisabled) { setActiveTab(tab); setSynthesisMode(false); setDisassembleMode(false); setShowSynthesis(false); } }} disabled={isDisabled} className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${activeTab === tab ? 'bg-accent' : 'text-tertiary hover:bg-secondary/50'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>{tabNameMap[tab]} ({getTabCount(tab)}/{getTabSlots(tab)})</button>;
                                })}
                            </div>
                        </div>
                         <div className="flex items-center gap-2">
                             <span className="text-xs text-secondary">정렬:</span>
                            <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} className="bg-secondary border border-color text-xs rounded-md p-1 focus:ring-accent focus:border-accent"><option value="createdAt">획득순</option><option value="grade">등급순</option><option value="type">종류순</option></select>
                         </div>
                    </div>
                    
                    <div className="flex-grow overflow-y-auto pr-2 bg-tertiary/30 p-2 rounded-md">
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(clamp(48px,6vh,64px),1fr))] gap-1">
                            {Array.from({ length: getTabSlots(activeTab) }).map((_, index) => {
                                const item = filteredAndSortedInventory[index];
                                const isDisassemblable = item?.type === 'equipment' && !item.isEquipped;
                                const isSynthesizable = item?.type === 'equipment' && !item.isEquipped;
                                const isSelectedForDisassembly = disassembleMode && item && selectedForDisassembly.has(item.id);
                                const isInSynthesisSlot = synthesisMode && item && synthesisSlots.some(slot => slot?.id === item.id);
                                const isClickable = !showSynthesis && ((synthesisMode && isSynthesizable) || (disassembleMode && isDisassemblable) || (!synthesisMode && !disassembleMode && item));
                                let isDisabledInSynthesis = false;
                                if (synthesisMode && item?.type === 'equipment' && firstSynthesisItemGrade && item.grade !== firstSynthesisItemGrade) isDisabledInSynthesis = true;

                                return (
                                    <div key={item?.id || `empty-${index}`} onClick={() => { if (!isClickable || isDisabledInSynthesis) return; if (synthesisMode && isSynthesizable) handleItemClickForSynthesis(item!); else if (disassembleMode && isDisassemblable) toggleDisassemblySelection(item!.id); else if (item) setSelectedItemId(item.id); }} className={`relative aspect-square rounded-md transition-all duration-200 ${item ? 'hover:scale-105' : 'bg-tertiary/50'} ${isClickable && !isDisabledInSynthesis ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                                        {item && ( <>
                                            <div className={`absolute inset-0 rounded-md border-2 ${selectedItemId === item.id && !disassembleMode && !synthesisMode && !showSynthesis ? 'border-accent ring-2 ring-accent' : 'border-black/20'}`} />
                                            <img src={gradeBackgrounds[item.grade]} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-sm" />
                                            {item.image && <img src={item.image} alt={item.name} className="relative w-full h-full object-contain p-1" />}
                                            {item.isEquipped && <div className="absolute top-0.5 right-0.5 text-xs font-bold text-white bg-blue-600/80 px-1 rounded-bl-md">E</div>}
                                            {item.quantity && item.quantity > 1 && <span className="absolute bottom-0 right-0 text-xs font-bold text-white bg-black/60 px-1 rounded-tl-md">{item.quantity}</span>}
                                            {item.type === 'equipment' && renderStarDisplay(item.stars)}
                                            {disassembleMode && (<> {!isDisassemblable && <div className="absolute inset-0 bg-black/70 rounded-sm"></div>} {isSelectedForDisassembly && <div className="absolute inset-0 bg-red-500/70 flex items-center justify-center text-3xl text-white rounded-sm">✓</div>} </>)}
                                            {(synthesisMode || isInSynthesisSlot || isDisabledInSynthesis) && (<div className={`absolute inset-0 rounded-sm ${isInSynthesisSlot ? 'bg-green-500/70' : (isDisabledInSynthesis ? 'bg-black/80' : '')} flex items-center justify-center text-3xl text-white`}> {isInSynthesisSlot && '✓'} </div>)}
                                            {enhancementAnimationTarget?.itemId === item.id && <div className="absolute inset-0 animate-ping rounded-md bg-yellow-400/50"></div>}
                                        </> )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex justify-between items-center mt-2 flex-shrink-0 text-sm">
                        <SynthesisLevelPanel user={currentUser} />
                        {canExpand && activeTab !== 'all' ? ( <Button onClick={handleExpand} colorScheme="blue" className="!text-xs !py-1" title={`비용: 💎 ${EXPANSION_COST_DIAMONDS}`}> 확장 (+{EXPANSION_AMOUNT}) </Button> ) : ( <p className="text-xs text-tertiary">최대 확장</p> )}
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};
export default InventoryModal;
