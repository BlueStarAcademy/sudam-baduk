import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { UserWithStatus, InventoryItem, ServerAction, InventoryItemType, EquipmentSlot, ItemGrade, ItemOption, CoreStat, SpecialStat, MythicStat } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import { emptySlotImages, ENHANCEMENT_COSTS, MATERIAL_ITEMS, GRADE_LEVEL_REQUIREMENTS, ITEM_SELL_PRICES, MATERIAL_SELL_PRICES, SYNTHESIS_COSTS, slotNames } from '../constants.js';

interface InventoryModalProps {
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
    onStartEnhance: (item: InventoryItem) => void;
    enhancementAnimationTarget: { itemId: string; stars: number } | null;
    onAnimationComplete: () => void;
    isTopmost?: boolean;
}

type Tab = 'all' | 'equipment' | 'consumable' | 'material';
type SortKey = 'createdAt' | 'type' | 'grade';

const MAX_INVENTORY_SIZE = 100;
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

    if (stars >= 10) {
        starImage = '/images/equipments/Star4.png';
        numberColor = "prism-text-effect";
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
            <img src={starImage} alt="star" className="w-3 h-3" />
            <span className={`font-bold text-xs leading-none ${numberColor}`}>{stars}</span>
        </div>
    );
};

const calculateSellPrice = (item: InventoryItem): number => {
    if (item.type === 'equipment') {
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
    const { main, combatSubs, specialSubs, mythicSubs } = item.options;
    return (
        <div className="w-full text-xs text-left space-y-2">
            <OptionSection title="주옵션" options={[main]} color="text-yellow-300" />
            <OptionSection title="전투 부옵션" options={combatSubs} color="text-blue-300" />
            <OptionSection title="특수 부옵션" options={specialSubs} color="text-green-300" />
            <OptionSection title="신화 부옵션" options={mythicSubs} color="text-red-400" />
        </div>
    );
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
    activeTab: Tab; 
    isLarge?: boolean;
    comparisonItem?: InventoryItem | null | undefined;
}

const ItemDisplayCard: React.FC<ItemDisplayCardProps> = ({ item, title, slot, currentUser, activeTab, isLarge, comparisonItem }) => {
    const renderItemDetails = () => {
        if (!item) return null;
        if (comparisonItem && item.type === 'equipment' && item.options) {
            const { main, combatSubs, specialSubs, mythicSubs } = item.options;
            const comparisonOptions = comparisonItem.options;
            const mainComparisonOptions = comparisonOptions ? [comparisonOptions.main] : [];

            return (
                <div className="w-full text-xs text-left space-y-2">
                    <OptionSectionWithComparison title="주옵션" color="text-yellow-300" currentOptions={[main]} comparisonOptions={mainComparisonOptions} />
                    <OptionSectionWithComparison title="전투 부옵션" color="text-blue-300" currentOptions={combatSubs} comparisonOptions={comparisonOptions?.combatSubs} />
                    <OptionSectionWithComparison title="특수 부옵션" color="text-green-300" currentOptions={specialSubs} comparisonOptions={comparisonOptions?.specialSubs} />
                    <OptionSectionWithComparison title="신화 부옵션" color="text-red-400" currentOptions={mythicSubs} comparisonOptions={comparisonOptions?.mythicSubs} />
                </div>
            );
        }
        return renderOptions(item);
    };

    if (!item) {
        if (title === '현재 장착') { // 'currently equipped' pane should always be for equipment
            return (
                <div className="bg-secondary/50 rounded-lg p-3 flex flex-col h-full items-center justify-center text-center">
                    <h3 className="font-bold text-tertiary mb-1 text-base">{title}</h3>
                    <div className="w-20 h-20 bg-tertiary rounded-lg flex items-center justify-center text-tertiary mb-1 text-sm">
                        {slot ? 
                            <img src={emptySlotImages[slot]} alt={`${slot} slot`} className="w-full h-full object-contain p-2" />
                            :
                            <img src="/images/BlankEquipmentsSlot.png" alt="empty slot" className="w-full h-full object-contain p-2" />
                        }
                    </div>
                    <p className="text-tertiary text-sm">장착된 아이템이 없습니다.</p>
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
                <div className="w-20 h-20 bg-tertiary rounded-lg flex items-center justify-center text-tertiary mb-1 text-sm">
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
                <h3 className="font-bold text-tertiary mb-1 text-base flex-shrink-0">{title}</h3>
                <div className="relative w-24 h-24 rounded-lg flex items-center justify-center my-2 flex-shrink-0">
                    <img src={gradeBackgrounds[item.grade]} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-lg" />
                    {item.image && <img src={item.image} alt={item.name} className="relative w-full h-full object-contain p-4"/>}
                </div>
                <div className="flex items-baseline justify-center gap-1">
                    <h4 className={`text-xl font-bold ${styles.color}`}>{item.name}</h4>
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
            <h3 className="font-bold text-tertiary mb-1 text-base flex-shrink-0">{title}</h3>
            <div className="relative w-20 h-20 rounded-lg flex items-center justify-center mb-1 flex-shrink-0">
                <img src={gradeBackgrounds[item.grade]} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-lg" />
                {item.image && <img src={item.image} alt={item.name} className="relative w-full h-full object-contain p-3"/>}
            </div>
            <div className="flex items-baseline justify-center gap-1">
                <h4 className={`text-base font-bold ${starInfo.colorClass}`}>{item.name}</h4>
                {item.type === 'equipment' && item.stars > 0 && <span className={`text-base font-bold ${starInfo.colorClass}`}>{starInfo.text}</span>}
            </div>
            {item.type === 'equipment' && (
                <p className="text-xs mt-1 flex-shrink-0">
                    <span className={`font-bold ${styles.color}`}>[{styles.name}]</span>
                    <span className={!levelRequirementMet ? 'text-red-400' : 'text-tertiary'}> (착용 레벨 합: {requiredLevel})</span>
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
            const costsForNextLevel = ENHANCEMENT_COSTS[item.grade]?.[enhancementIndex];
            if (costsForNextLevel) {
                for (const cost of costsForNextLevel) {
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
                 <p className="text-xs text-cyan-300 text-center pt-4">분해 시 30% 확률로 '대박'이 발생하여 모든 재료 획득량이 2배가 됩니다!</p>
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

    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value)) {
            setQuantity(Math.max(0, Math.min(maxQuantity, value)));
        } else {
            setQuantity(0);
        }
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
                    <input
                        id="quantity-slider"
                        type="range"
                        min="0"
                        max={maxQuantity}
                        value={quantity}
                        onChange={handleQuantityChange}
                        disabled={maxQuantity === 0}
                        className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
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

const CraftingPanel: React.FC<{
    inventory: InventoryItem[];
    onStartCraft: (materialName: string, craftType: 'upgrade' | 'downgrade') => void;
}> = ({ inventory, onStartCraft }) => {
    
    const materialTiers = [
        { name: '하급 강화석' },
        { name: '중급 강화석' },
        { name: '상급 강화석' },
        { name: '최상급 강화석' },
        { name: '신비의 강화석' },
    ];

    const materialCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        materialTiers.forEach(tier => {
            counts[tier.name] = inventory
                .filter(i => i.name === tier.name)
                .reduce((sum, i) => sum + (i.quantity || 0), 0);
        });
        return counts;
    }, [inventory]);

    const MaterialDisplay: React.FC<{ name: string }> = ({ name }) => {
        const template = MATERIAL_ITEMS[name];
        const count = materialCounts[name] || 0;
        return (
            <div className="flex flex-col items-center text-center w-24">
                <img src={template.image!} alt={name} className="w-12 h-12" />
                <h4 className="font-bold text-sm mt-1">{name}</h4>
                <p className="text-xs text-tertiary">보유: {count.toLocaleString()}</p>
            </div>
        );
    };

    const ConversionButtons: React.FC<{ from: string, to: string }> = ({ from, to }) => {
        const fromCount = materialCounts[from] || 0;
        const toCount = materialCounts[to] || 0;
        return (
            <div className="flex flex-col items-center gap-2 mx-2">
                <Button onClick={() => onStartCraft(from, 'upgrade')} disabled={fromCount < 10} className="!text-xs !py-1 whitespace-nowrap">합성 →</Button>
                <Button onClick={() => onStartCraft(to, 'downgrade')} disabled={toCount < 1} className="!text-xs !py-1 whitespace-nowrap" colorScheme="orange">← 분해</Button>
            </div>
        );
    };

    return (
        <div className="w-full h-full flex flex-col items-center p-4 text-on-panel">
            <h3 className="text-xl font-bold mb-6">재료 합성/분해</h3>
            <div className="flex flex-col items-center space-y-4">
                {/* Row 1 */}
                <div className="flex items-center justify-center">
                    <MaterialDisplay name="하급 강화석" />
                    <ConversionButtons from="하급 강화석" to="중급 강화석" />
                    <MaterialDisplay name="중급 강화석" />
                    <ConversionButtons from="중급 강화석" to="상급 강화석" />
                    <MaterialDisplay name="상급 강화석" />
                </div>
                
                {/* Row 2 */}
                <div className="flex items-center justify-center mt-4">
                    <MaterialDisplay name="상급 강화석" />
                    <ConversionButtons from="상급 강화석" to="최상급 강화석" />
                    <MaterialDisplay name="최상급 강화석" />
                    <ConversionButtons from="최상급 강화석" to="신비의 강화석" />
                    <MaterialDisplay name="신비의 강화석" />
                </div>
            </div>
            <p className="text-xs text-tertiary mt-auto pt-4">* 합성: 하위 재료 10개 → 상위 재료 1개 / 분해: 상위 재료 1개 → 하위 재료 5개</p>
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
        <DraggableWindow title="분해 자동 선택" onClose={onClose} windowId="disassembly-auto-select" initialWidth={400} isTopmost>
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

const SynthesisPanel: React.FC<{
    synthesisSlots: (InventoryItem | null)[];
    onRemove: (index: number) => void;
    onSynthesize: () => void;
    onCancel: () => void;
    currentUser: UserWithStatus;
}> = ({ synthesisSlots, onRemove, onSynthesize, onCancel, currentUser }) => {
    const itemsInSlots = useMemo(() => synthesisSlots.filter((i): i is InventoryItem => i !== null), [synthesisSlots]);
    const firstItemGrade = useMemo(() => itemsInSlots[0]?.grade, [itemsInSlots]);
    const synthesisCost = useMemo(() => (firstItemGrade ? SYNTHESIS_COSTS[firstItemGrade] : 0), [firstItemGrade]);
    const canSynthesize = itemsInSlots.length === 3;
    const allSameGrade = itemsInSlots.length > 0 && itemsInSlots.every(i => i.grade === firstItemGrade);

    const possibleSlots = useMemo(() => {
        if (!allSameGrade) return [];
        return [...new Set(itemsInSlots.map(i => i.slot))].filter(Boolean) as EquipmentSlot[];
    }, [itemsInSlots, allSameGrade]);

    const greatSuccessMessage = useMemo(() => {
        if (!firstItemGrade || !allSameGrade) return "";
        if (firstItemGrade === 'mythic') {
            return "신화등급 합성시에는 50%확률로 신화옵션 2개인 장비가 합성됩니다.";
        }
        return "낮은 확률로 한 등급 높은 장비가 나올 수 있습니다.";
    }, [firstItemGrade, allSameGrade]);
    
    return (
        <div className="w-full h-full bg-secondary/50 rounded-lg p-3 flex flex-col items-center justify-between text-center">
            <div>
                <h3 className="font-bold text-lg text-tertiary mb-2">장비 합성</h3>
                <p className="text-sm text-tertiary mb-3">합성할 동일 등급의 장비 3개를 아래 슬롯에 올려주세요.</p>
                <div className="flex gap-4 mb-3">
                    {synthesisSlots.map((item, index) => (
                        <div key={index} onClick={() => onRemove(index)} className="w-24 h-24 bg-tertiary/50 rounded-lg border-2 border-dashed border-color flex items-center justify-center cursor-pointer hover:border-accent">
                            {item ? (
                                <div className="relative w-full h-full">
                                    <img src={gradeBackgrounds[item.grade]} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-md" />
                                    {renderStarDisplay(item.stars)}
                                    {item.image && <img src={item.image} alt={item.name} className="relative w-full h-full object-contain p-2"/>}
                                </div>
                            ) : (
                                <span className="text-3xl text-tertiary">+</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="w-full bg-tertiary/30 p-3 rounded-md space-y-2 mt-4 flex-grow flex flex-col">
                <h4 className="font-semibold text-highlight text-left border-b border-color pb-1 flex-shrink-0">예상 결과 부위</h4>
                <div className="flex-grow overflow-y-auto pr-1">
                    {possibleSlots.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2 py-2">
                            {possibleSlots.map(slot => (
                                <div key={slot} className="text-center bg-tertiary/50 p-2 rounded">
                                    <img src={emptySlotImages[slot]} className="w-8 h-8 mx-auto mb-1 opacity-70" />
                                    <span className="text-xs">{slotNames[slot]}</span>
                                    <span className="font-mono font-bold block text-sm text-primary">{(100 / possibleSlots.length).toFixed(0)}%</span>
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-xs text-tertiary pt-4 text-center">합성할 아이템을 올려주세요.</p>}
                    {greatSuccessMessage && (
                        <p className="text-xs text-cyan-300 text-center pt-2 mt-2 border-t border-color">{greatSuccessMessage}</p>
                    )}
                </div>
            </div>

            <div className="mt-4 flex-shrink-0 w-full">
                {firstItemGrade && <p className={`text-sm text-tertiary ${currentUser.gold < synthesisCost ? 'text-red-400' : ''}`}>비용: <span className="font-bold text-yellow-300">{synthesisCost.toLocaleString()} 골드</span></p>}
                 <div className="flex items-center gap-4 mt-2">
                    <Button onClick={onCancel} colorScheme="gray" className="flex-1">취소</Button>
                    <Button onClick={onSynthesize} colorScheme="green" disabled={!canSynthesize} className="flex-1">합성하기</Button>
                </div>
            </div>
        </div>
    );
};

const InventoryModal: React.FC<InventoryModalProps> = ({ currentUser, onClose, onAction, onStartEnhance, enhancementAnimationTarget, onAnimationComplete, isTopmost }) => {
    const { inventory, inventorySlots } = currentUser;
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('all');
    const [sortKey, setSortKey] = useState<SortKey>('createdAt');
    const [disassembleMode, setDisassembleMode] = useState(false);
    const [showSynthesis, setShowSynthesis] = useState(false); // This is for MATERIAL crafting
    const [selectedForDisassembly, setSelectedForDisassembly] = useState<Set<string>>(new Set());
    const [craftingDetails, setCraftingDetails] = useState<{ materialName: string, craftType: 'upgrade' | 'downgrade' } | null>(null);
    const [isAutoSelectOpen, setIsAutoSelectOpen] = useState(false);
    
    // --- NEW: Equipment Synthesis State ---
    const [synthesisMode, setSynthesisMode] = useState(false);
    const [synthesisSlots, setSynthesisSlots] = useState<(InventoryItem | null)[]>([null, null, null]);

    const selectedItem = useMemo(() => {
        if (!selectedItemId) return null;
        return inventory.find(item => item.id === selectedItemId) || null;
    }, [selectedItemId, inventory]);

    useEffect(() => {
        if (enhancementAnimationTarget) {
            const timer = setTimeout(() => {
                onAnimationComplete();
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [enhancementAnimationTarget, onAnimationComplete]);
    
    const handleExpand = () => {
        if (window.confirm(`다이아 ${EXPANSION_COST_DIAMONDS}개를 사용하여 가방을 ${EXPANSION_AMOUNT}칸 확장하시겠습니까?`)) {
            onAction({ type: 'EXPAND_INVENTORY' });
        }
    };

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
        if (activeTab !== 'all') {
            items = items.filter((item: InventoryItem) => item.type === activeTab);
        }
        items.sort((a, b) => {
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
        return items;
    }, [inventory, activeTab, sortKey]);
    
    useEffect(() => {
        setSelectedItemId(null);
    }, [activeTab, disassembleMode, showSynthesis, synthesisMode]);

    useEffect(() => {
        if (selectedItemId && !inventory.some(i => i.id === selectedItemId)) {
            setSelectedItemId(null);
        }
    }, [inventory, selectedItemId]);
    
    const currentlyEquippedItem = useMemo(() => {
        if (selectedItem?.type !== 'equipment' || !selectedItem.slot) {
            return null;
        }
        return inventory.find((item: InventoryItem) => item.isEquipped && item.slot === selectedItem.slot);
    }, [selectedItem, inventory]);

    const inventoryDisplaySlots = Array.from({ length: inventorySlots }, (_, index) => filteredAndSortedInventory[index] || null);
    
    const canExpand = inventorySlots < MAX_INVENTORY_SIZE;

    // --- Disassembly Logic ---
    const handleDisassemble = () => {
        if (selectedForDisassembly.size === 0) return;
        const hasHighGrade = Array.from(selectedForDisassembly).some(itemId => {
            const item = inventory.find((i: InventoryItem) => i.id === itemId);
            return item && (item.grade === 'legendary' || item.grade === 'mythic');
        });
        if (hasHighGrade && !window.confirm("높은 등급의 장비가 포함되어 있습니다. 그래도 분해하시겠습니까?")) return;
        if (window.confirm(`${selectedForDisassembly.size}개의 아이템을 분해하시겠습니까?`)) {
            onAction({ type: 'DISASSEMBLE_ITEM', payload: { itemIds: Array.from(selectedForDisassembly) } });
            setSelectedForDisassembly(new Set());
            setDisassembleMode(false);
        }
    };
    const toggleDisassemblySelection = (itemId: string) => {
        setSelectedForDisassembly(prev => {
            const newSet = new Set(prev);
            newSet.has(itemId) ? newSet.delete(itemId) : newSet.add(itemId);
            return newSet;
        });
    };
     const handleAutoSelectConfirm = (grades: ItemGrade[]) => {
        const itemsToSelect = inventory.filter(item =>
            item.type === 'equipment' && !item.isEquipped && grades.includes(item.grade)
        ).map(item => item.id);
        setSelectedForDisassembly(prev => new Set([...prev, ...itemsToSelect]));
        setIsAutoSelectOpen(false);
    };

    // --- Equipment Synthesis Logic ---
    const handleEnterSynthesisMode = () => {
        setDisassembleMode(false);
        setShowSynthesis(false);
        setSynthesisMode(true);
        setSelectedItemId(null);
    };

    const handleExitSynthesisMode = () => {
        setSynthesisMode(false);
        setSynthesisSlots([null, null, null]);
    };

    const handleItemClickForSynthesis = (item: InventoryItem) => {
        if (item.type !== 'equipment') {
            return;
        }
        
        if (synthesisSlots.some(slot => slot?.id === item.id)) {
            const newSlots = synthesisSlots.map(slot => (slot?.id === item.id ? null : slot));
            setSynthesisSlots(newSlots);
            return;
        }

        const firstItemInSlots = synthesisSlots.find(slot => slot !== null);
        if (firstItemInSlots && item.grade !== firstItemInSlots.grade) {
            return;
        }

        const nextEmptySlotIndex = synthesisSlots.findIndex(slot => slot === null);
        if (nextEmptySlotIndex !== -1) {
            const newSlots = [...synthesisSlots];
            newSlots[nextEmptySlotIndex] = item;
            setSynthesisSlots(newSlots);
        }
    };
    
    const handleRemoveFromSynthesis = (index: number) => {
        const newSlots = [...synthesisSlots];
        newSlots[index] = null;
        setSynthesisSlots(newSlots);
    };

    const handleSynthesize = () => {
        const itemsInSlots = synthesisSlots.filter((item): item is InventoryItem => item !== null);
        if (itemsInSlots.length !== 3) {
            alert('3개의 장비를 모두 채워주세요.');
            return;
        }
        const itemIds = itemsInSlots.map(item => item.id);
        const firstItemGrade = itemsInSlots[0]?.grade;
        if (!firstItemGrade) {
            return;
        }
        const synthesisCost = SYNTHESIS_COSTS[firstItemGrade] || 0;
        if (currentUser.gold < synthesisCost) {
            alert(`합성에 필요한 골드가 부족합니다. (필요: ${synthesisCost.toLocaleString()} 골드)`);
            return;
        }
        if(window.confirm(`[${gradeStyles[firstItemGrade].name} 등급] 장비 3개를 합성하시겠습니까?\n비용: ${synthesisCost.toLocaleString()} 골드`)) {
            onAction({ type: 'SYNTHESIZE_EQUIPMENT', payload: { itemIds } });
            handleExitSynthesisMode();
        }
    };
    
    const firstSynthesisItemGrade = useMemo(() => {
        return synthesisSlots.find(item => item !== null)?.grade;
    }, [synthesisSlots]);

    return (
        <DraggableWindow title="가방" onClose={onClose} windowId="inventory" initialWidth={950} isTopmost={isTopmost}>
            <div className="flex flex-col h-[calc(var(--vh,1vh)*75)]">
                {craftingDetails && <CraftingDetailModal details={craftingDetails} inventory={inventory} onClose={() => setCraftingDetails(null)} onAction={onAction} />}
                {isAutoSelectOpen && <AutoSelectModal onClose={() => setIsAutoSelectOpen(false)} onConfirm={handleAutoSelectConfirm} />}
                
                <div className="flex-shrink-0 border-b border-color pb-2 mb-2 flex justify-between items-center">
                     <div className="flex items-center gap-2">
                        {(activeTab === 'all' || activeTab === 'equipment') && <Button onClick={handleEnterSynthesisMode} disabled={synthesisMode} colorScheme="purple">장비 합성</Button>}
                        <Button onClick={() => { setDisassembleMode(true); setSelectedItemId(null); setSynthesisMode(false); }} disabled={disassembleMode}>장비 분해</Button>
                        <Button onClick={() => {setShowSynthesis(true); setDisassembleMode(false); setSynthesisMode(false);}} disabled={showSynthesis}>재료 변환</Button>
                    </div>
                     {(synthesisMode || disassembleMode || showSynthesis) && (
                        <Button
                            onClick={() => {
                                setSynthesisMode(false);
                                setDisassembleMode(false);
                                setShowSynthesis(false);
                                setSynthesisSlots([null, null, null]);
                                setSelectedForDisassembly(new Set());
                            }}
                            colorScheme="gray"
                        >
                            돌아가기
                        </Button>
                     )}
                </div>

                <div className="flex-1 min-h-0 mb-2">
                    {synthesisMode ? (
                        <SynthesisPanel synthesisSlots={synthesisSlots} onRemove={handleRemoveFromSynthesis} onSynthesize={handleSynthesize} onCancel={handleExitSynthesisMode} currentUser={currentUser} />
                    ) : disassembleMode ? (
                        <DisassemblyPreviewPanel selectedIds={selectedForDisassembly} inventory={inventory} />
                    ) : showSynthesis ? (
                        <div className="w-full h-full bg-secondary rounded-lg shadow-inner relative">
                             <CraftingPanel inventory={inventory} onStartCraft={(materialName, craftType) => setCraftingDetails({ materialName, craftType })} />
                        </div>
                    ) : !selectedItem ? (
                        <div className="w-full h-full bg-secondary/50 rounded-lg p-4 flex flex-col items-center justify-center text-center text-tertiary">
                            <h3 className="font-bold text-lg">아이템 정보</h3>
                            <p className="text-sm mt-4">아래 목록에서 아이템을 선택하여<br/>상세 정보를 확인하세요.</p>
                        </div>
                    ) : (activeTab !== 'equipment' && activeTab !== 'all') || (selectedItem && selectedItem.type !== 'equipment') ? (
                         <ItemDisplayCard item={selectedItem} title="선택 아이템" currentUser={currentUser} activeTab={activeTab} isLarge={true} />
                    ) : (
                        <div className="w-full flex flex-row gap-4 h-full">
                            <div className="w-1/2 h-full min-h-0"><ItemDisplayCard item={currentlyEquippedItem} title="현재 장착" slot={selectedItem?.slot} currentUser={currentUser} activeTab={activeTab} /></div>
                            <div className="w-1/2 h-full min-h-0"><ItemDisplayCard item={selectedItem} title="선택 아이템" slot={selectedItem?.slot} currentUser={currentUser} activeTab={activeTab} comparisonItem={currentlyEquippedItem} /></div>
                        </div>
                    )}
                </div>
                
                 { !synthesisMode && !disassembleMode && !showSynthesis && selectedItem && (
                    <div className="w-full pt-2 mt-2 border-y border-color flex flex-wrap justify-center items-center gap-2 py-2">
                        {selectedItem.type === 'equipment' && (
                            <>
                                <Button onClick={() => onAction({ type: 'TOGGLE_EQUIP_ITEM', payload: { itemId: selectedItem.id } })} colorScheme="green">{selectedItem.isEquipped ? '장착 해제' : '장착'}</Button>
                                <Button onClick={() => onStartEnhance(selectedItem)} colorScheme="yellow" disabled={selectedItem.stars >= 10}>강화</Button>
                            </>
                        )}
                        {selectedItem.type === 'consumable' && (
                            <>
                                <Button onClick={() => onAction({ type: 'USE_ITEM', payload: { itemId: selectedItem.id } })} colorScheme="green">사용</Button>
                                <Button onClick={() => { if (window.confirm(`[${selectedItem.name}] 아이템을 모두 사용하시겠습니까?`)) { onAction({ type: 'USE_ALL_ITEMS_OF_TYPE', payload: { itemName: selectedItem.name } }); } }} colorScheme="blue">일괄 사용</Button>
                            </>
                        )}
                        <Button onClick={handleSell} colorScheme="orange" disabled={selectedItem.type === 'consumable' || selectedItem.isEquipped}>판매</Button>
                    </div>
                 )}
                
                { disassembleMode && (
                     <div className="flex items-center justify-center gap-2 border-y border-color py-2 my-2">
                        <Button onClick={() => setIsAutoSelectOpen(true)} colorScheme="blue">자동 선택</Button>
                        <Button onClick={handleDisassemble} colorScheme="red" disabled={selectedForDisassembly.size === 0}>선택 아이템 분해 ({selectedForDisassembly.size})</Button>
                    </div>
                )}


                <div className="flex-shrink-0 flex flex-col pt-2 h-56">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2 flex-shrink-0">
                        <div className="flex items-center gap-4">
                            <h3 className="text-lg font-bold text-on-panel">인벤토리 ({inventory.length} / {inventorySlots})</h3>
                             <div className="flex bg-tertiary/70 p-1 rounded-lg">
                                {(['all', 'equipment', 'consumable', 'material'] as Tab[]).map(tab => (
                                    <button key={tab} onClick={() => { setActiveTab(tab); setSynthesisMode(false); setDisassembleMode(false); }} className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${activeTab === tab ? 'bg-accent' : 'text-tertiary hover:bg-secondary/50'}`}>
                                        {tab === 'all' ? '전체' : tab === 'equipment' ? '장비' : tab === 'consumable' ? '소모품' : '재료'}
                                    </button>
                                ))}
                            </div>
                        </div>
                         <div className="flex items-center gap-2">
                             <span className="text-xs text-secondary">정렬:</span>
                            <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} className="bg-secondary border border-color text-xs rounded-md p-1 focus:ring-accent focus:border-accent">
                                <option value="createdAt">획득순</option>
                                <option value="grade">등급순</option>
                                <option value="type">종류순</option>
                            </select>
                         </div>
                    </div>
                    
                    <div className="flex-grow overflow-y-auto pr-2 bg-tertiary/30 p-2 rounded-md">
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-1">
                            {inventoryDisplaySlots.map((item, index) => {
                                const isDisassemblable = item?.type === 'equipment' && !item.isEquipped;
                                const isSynthesizable = item?.type === 'equipment' && !item.isEquipped;
                                const isSelectedForDisassembly = disassembleMode && item && selectedForDisassembly.has(item.id);
                                const isInSynthesisSlot = synthesisMode && item && synthesisSlots.some(slot => slot?.id === item.id);
                                
                                const isClickable = (synthesisMode && isSynthesizable) || (disassembleMode && isDisassemblable) || (!synthesisMode && !disassembleMode && item);

                                // Logic to dim items during synthesis mode
                                let isDisabledInSynthesis = false;
                                if (synthesisMode && item?.type === 'equipment') {
                                    if (firstSynthesisItemGrade && item.grade !== firstSynthesisItemGrade) {
                                        isDisabledInSynthesis = true;
                                    }
                                }

                                return (
                                    <div
                                        key={item?.id || `empty-${index}`}
                                        onClick={() => {
                                            if (!isClickable || isDisabledInSynthesis) return;
                                            if (synthesisMode && isSynthesizable) handleItemClickForSynthesis(item!);
                                            else if (disassembleMode && isDisassemblable) toggleDisassemblySelection(item!.id);
                                            else if (item) setSelectedItemId(item.id);
                                        }}
                                        className={`relative aspect-square rounded-md transition-all duration-200 ${item ? 'hover:scale-105' : 'bg-tertiary/50'} ${isClickable && !isDisabledInSynthesis ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                                    >
                                        {item && (
                                            <>
                                                <div className={`absolute inset-0 rounded-md border-2 ${selectedItemId === item.id && !disassembleMode && !synthesisMode ? 'border-accent ring-2 ring-accent' : 'border-black/20'}`} />
                                                <img src={gradeBackgrounds[item.grade]} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-sm" />
                                                {item.image && <img src={item.image} alt={item.name} className="relative w-full h-full object-contain p-1" />}
                                                
                                                {item.isEquipped && <div className="absolute top-0.5 right-0.5 text-xs font-bold text-white bg-blue-600/80 px-1 rounded-bl-md">E</div>}
                                                {item.quantity && item.quantity > 1 && <span className="absolute bottom-0 right-0 text-xs font-bold text-white bg-black/60 px-1 rounded-tl-md">{item.quantity}</span>}
                                                {item.type === 'equipment' && renderStarDisplay(item.stars)}
                                                
                                                {disassembleMode && (
                                                    <>
                                                        {!isDisassemblable && <div className="absolute inset-0 bg-black/70 rounded-sm"></div>}
                                                        {isSelectedForDisassembly && <div className="absolute inset-0 bg-red-500/70 flex items-center justify-center text-3xl text-white rounded-sm">✓</div>}
                                                    </>
                                                )}

                                                {(synthesisMode || isInSynthesisSlot || isDisabledInSynthesis) && (
                                                    <div className={`absolute inset-0 rounded-sm ${isInSynthesisSlot ? 'bg-green-500/70' : (isDisabledInSynthesis ? 'bg-black/80' : '')} flex items-center justify-center text-3xl text-white`}>
                                                        {isInSynthesisSlot && '✓'}
                                                    </div>
                                                )}
                                                
                                                {enhancementAnimationTarget?.itemId === item.id && <div className="absolute inset-0 animate-ping rounded-md bg-yellow-400/50"></div>}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex justify-end items-center mt-2 flex-shrink-0 text-sm">
                        {canExpand ? (
                            <Button onClick={handleExpand} colorScheme="blue" className="!text-xs !py-1" title={`비용: 💎 ${EXPANSION_COST_DIAMONDS}`}>
                                확장 (+{EXPANSION_AMOUNT})
                            </Button>
                        ) : (
                            <p className="text-xs text-tertiary">최대 확장</p>
                        )}
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};
export default InventoryModal;