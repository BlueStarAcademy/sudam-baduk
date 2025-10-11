import React, { useState, useMemo, useEffect } from 'react';
import { UserWithStatus, ServerAction, ShopTab } from '../types/index.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import { isSameDayKST, isDifferentWeekKST } from '../utils/timeUtils.js';
import { SHOP_ITEMS } from '../server/shop.js';
import Slider from './ui/Slider.js';
import { SHOP_CONSUMABLE_ITEMS } from '../constants/index.js';

// --- Type Definitions ---
type ShopItemDetails = {
    itemId: string;
    name: string;
    description: string;
    price: { gold?: number; diamonds?: number };
    image: string;
    type: 'equipment' | 'material' | 'consumable';
    dailyLimit?: number;
    weeklyLimit?: number;
};

interface ShopModalProps {
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
    onStartQuiz: () => void;
    isTopmost?: boolean;
    initialTab?: ShopTab;
}

interface BulkPurchaseModalProps {
    item: ShopItemDetails;
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
}

type PackageItem = {
  id: string;
  image: string;
  line1: string;
  line2?: string;
  price: string;
  limitText: string;
};

const packageItems: PackageItem[] = [
  { id: 'package1', image: '/images/store/package1.png', line1: '전설장비 + 다이아500개', price: '₩7,900', limitText: '일일 구매제한 10회' },
  { id: 'package2', image: '/images/store/package2.png', line1: '신화장비 + 다이아1000개', price: '₩9,900', limitText: '일일 구매제한 5회' },
  { id: 'package3', image: '/images/store/package3.png', line1: 'D.신화장비 + 다이아2000개', price: '₩15,900', limitText: '일일 구매제한 3회' },
  { id: 'package4', image: '/images/store/package4.png', line1: '7일 다이아 보너스', line2: '총350개 + 즉시지급 50개', price: '₩5,900', limitText: '월간 구매제한 1회' },
  { id: 'package5', image: '/images/store/package5.png', line1: '14일 다이아 보너스', line2: '총 700개 + 즉시지급 150개', price: '₩9,900', limitText: '월간 구매제한 1회' },
  { id: 'package6', image: '/images/store/package6.png', line1: '30일 다이아 보너스', line2: '총 2000개 + 즉시지급 500개', price: '₩19,900', limitText: '월간 구매제한 1회' },
];

const PackageItemCard: React.FC<{ item: PackageItem }> = ({ item }) => {
    const handlePurchase = () => {
        alert(`'${item.line1}' 구매 기능은 아직 구현되지 않았습니다.`);
    };

    return (
        <div 
            className="relative w-full aspect-[3/2] rounded-lg bg-black shadow-lg border-2 border-yellow-800/80 cursor-pointer transition-transform hover:scale-105 overflow-hidden"
            onClick={handlePurchase}
        >
            <img src={item.image} alt={item.line1} className="w-full h-full object-contain" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 rounded-lg pointer-events-none"></div>
            <div className="absolute bottom-2 left-0 right-0 px-1 text-center flex flex-col items-center justify-end h-full" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.9)' }}>
                <div className="flex-grow"></div> {/* Spacer */}
                <p className="font-black text-yellow-300 text-[clamp(0.8rem,2.2vw,1.1rem)] leading-tight drop-shadow-lg">{item.line1}</p>
                {item.line2 && <p className="font-black text-yellow-300 text-[clamp(0.7rem,2vw,1rem)] leading-tight drop-shadow-lg">{item.line2}</p>}
                <div className="mt-2 bg-black/60 px-4 py-0.5 rounded-full border border-yellow-600/80 backdrop-blur-sm">
                    <p className="font-bold text-white text-[clamp(0.8rem,2.5vw,1.1rem)]">{item.price}</p>
                </div>
                <p className="text-xs text-gray-200 mt-1">{item.limitText}</p>
            </div>
        </div>
    );
};

// --- Components ---

interface ActionPointQuizCardProps {
    currentUser: UserWithStatus;
    onStartQuiz: () => void;
}
const ActionPointQuizCard: React.FC<ActionPointQuizCardProps> = ({ currentUser, onStartQuiz }) => {
    const MAX_QUIZ_ATTEMPTS_PER_DAY = 3;
    const now = Date.now();
    const attemptsToday = isSameDayKST(currentUser.lastActionPointQuizDate || 0, now)
        ? (currentUser.actionPointQuizzesToday || 0)
        : 0;

    const isApFull = currentUser.actionPoints.current >= currentUser.actionPoints.max;

    const canAttempt = attemptsToday < MAX_QUIZ_ATTEMPTS_PER_DAY && !isApFull;

    const buttonText = isApFull
        ? '행동력을 사용 후 퀴즈에 도전하세요'
        : canAttempt
            ? '퀴즈 풀기'
            : '오늘 횟수 소진';

    return (
        <div className="bg-gray-800/60 rounded-lg p-4 flex flex-col items-center text-center border-2 border-gray-700 h-full">
            <div className="w-24 h-24 bg-gray-900/50 rounded-md mb-3 flex items-center justify-center text-6xl">💡</div>
            <h3 className="text-lg font-bold text-white">바둑 퀴즈</h3>
            <p className="text-xs text-gray-400 mt-1 flex-grow h-10">바둑 용어 퀴즈를 풀고 행동력을 획득하세요! (정답 1개당 ⚡3)</p>
            <div className="flex flex-col items-stretch justify-center gap-2 my-3 w-full">
                <Button onClick={onStartQuiz} disabled={!canAttempt} colorScheme="green" className="w-full">
                    {buttonText}
                </Button>
            </div>
             <p className="text-xs text-gray-400">오늘 남은 횟수: {MAX_QUIZ_ATTEMPTS_PER_DAY - attemptsToday}/{MAX_QUIZ_ATTEMPTS_PER_DAY}</p>
        </div>
    );
};

interface ShopItemCardProps {
    item: ShopItemDetails;
    onBuy: (item: ShopItemDetails) => void;
    currentUser: UserWithStatus;
}

const ShopItemCard: React.FC<ShopItemCardProps> = ({ item, onBuy, currentUser }) => {
    const isGold = !!item.price.gold;
    const priceAmount = item.price.gold || item.price.diamonds || 0;
    const PriceIcon = isGold ? <img src="/images/Gold.png" alt="골드" className="w-4 h-4" /> : <img src="/images/Zem.png" alt="다이아" className="w-4 h-4" />;
    
    const now = Date.now();
    const purchaseRecord = currentUser.dailyShopPurchases?.[item.itemId];
    
    let purchasesThisPeriod = 0;
    let limit = Infinity;
    let limitText = '';

    if (item.weeklyLimit) {
        purchasesThisPeriod = (purchaseRecord && !isDifferentWeekKST(purchaseRecord.date, now)) ? purchaseRecord.quantity : 0;
        limit = item.weeklyLimit;
        limitText = '주간';
    } else if (item.dailyLimit) {
        purchasesThisPeriod = (purchaseRecord && isSameDayKST(purchaseRecord.date, now)) ? purchaseRecord.quantity : 0;
        limit = item.dailyLimit;
        limitText = '일일';
    }
    
    const remaining = limit !== Infinity ? limit - purchasesThisPeriod : Infinity;

    return (
        <div className="bg-gray-800/60 rounded-lg p-4 flex flex-col items-center text-center border-2 border-gray-700 h-full">
            <div className="w-24 h-24 bg-gray-900/50 rounded-md mb-3 flex items-center justify-center">
                <img src={item.image} alt={item.name} className="w-full h-full object-contain p-2" />
            </div>
            <h3 className="text-lg font-bold text-white">{item.name}</h3>
            <p className="text-xs text-gray-400 mt-1 flex-grow h-10">{item.description}</p>
            <div className="flex flex-col items-stretch justify-center gap-2 my-3 w-full">
                 <Button onClick={() => onBuy(item)} disabled={remaining === 0} colorScheme="green" className="w-full !text-xs !py-2.5">
                    <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                        <span>구매</span>
                        <div className="flex items-center gap-1">({PriceIcon} {priceAmount.toLocaleString()})</div>
                    </div>
                </Button>
            </div>
            {limit !== Infinity && <p className="text-xs text-gray-400">{limitText} 구매 제한: {remaining}/{limit}</p>}
        </div>
    );
};


const BulkPurchaseModal: React.FC<BulkPurchaseModalProps> = ({ item, currentUser, onClose, onAction }) => {
    const [quantity, setQuantity] = useState(1);
    const isGold = !!item.price.gold;
    const priceAmount = item.price.gold || item.price.diamonds || 0;

    const maxQuantity = useMemo(() => {
        let max = 999;
        
        // 1. By currency
        const maxByCurrency = isGold 
            ? Math.floor(currentUser.gold / priceAmount)
            : Math.floor(currentUser.diamonds / priceAmount);
        max = Math.min(max, maxByCurrency);

        // 2. By purchase limit
        const now = Date.now();
        const purchaseRecord = currentUser.dailyShopPurchases?.[item.itemId];
        if (item.weeklyLimit) {
            const purchased = (purchaseRecord && !isDifferentWeekKST(purchaseRecord.date, now)) ? purchaseRecord.quantity : 0;
            max = Math.min(max, item.weeklyLimit - purchased);
        } else if (item.dailyLimit) {
            const purchased = (purchaseRecord && isSameDayKST(purchaseRecord.date, now)) ? purchaseRecord.quantity : 0;
            max = Math.min(max, item.dailyLimit - purchased);
        }
        
        // 3. By inventory space (for non-stackable equipment boxes, assume 1 item per box)
        if (item.type === 'equipment') {
            // FIX: Correctly calculate inventory space for equipment.
            const space = currentUser.inventorySlots.equipment - currentUser.inventory.filter(i => i.type === 'equipment').length;
            let maxBySpace = 0;
            for (let q = 1; q < 200; q++) { // assume max buy is < 200
                if (q + Math.floor(q / 10) <= space) {
                    maxBySpace = q;
                } else {
                    break;
                }
            }
            max = Math.min(max, maxBySpace);
        }

        return Math.max(0, max);
    }, [item, currentUser]);

    useEffect(() => {
        if (quantity > maxQuantity) setQuantity(maxQuantity);
        if (quantity < 1 && maxQuantity > 0) setQuantity(1);
        if (maxQuantity === 0) setQuantity(0);
    }, [maxQuantity, quantity]);


    const handleConfirm = () => {
        if (quantity > 0) {
            onAction({ type: 'BUY_SHOP_ITEM', payload: { itemId: item.itemId, quantity } });
        }
        onClose();
    };

    const isEquipmentBox = item.type === 'equipment';
    const bonusItems = isEquipmentBox ? Math.floor(quantity / 10) : 0;
    const totalItems = quantity + bonusItems;

    return (
        <DraggableWindow title="수량 선택" onClose={onClose} windowId={`bulk-purchase-${item.itemId}`} initialWidth={450}>
            <div className="text-center">
                <div className="flex flex-col items-center gap-2 mb-4">
                    <div className="relative w-24 h-24">
                        <img src={item.image} alt={item.name} className="relative w-full h-full object-contain p-2" />
                    </div>
                    <h3 className="text-xl font-bold">{item.name}</h3>
                </div>
                <div className="space-y-3 bg-tertiary/50 p-4 rounded-lg">
                    <Slider value={quantity} min={0} max={maxQuantity} onChange={setQuantity} disabled={maxQuantity === 0} />
                    <div className="grid grid-cols-5 gap-2">
                        <Button onClick={() => setQuantity(q => Math.max(0, q - 10))} className="!py-1">-10</Button>
                        <Button onClick={() => setQuantity(q => Math.max(0, q - 1))} className="!py-1">-1</Button>
                        <Button onClick={() => setQuantity(maxQuantity)} colorScheme="blue" className="!py-1">MAX</Button>
                        <Button onClick={() => setQuantity(q => Math.min(maxQuantity, q + 1))} className="!py-1">+1</Button>
                        <Button onClick={() => setQuantity(q => Math.min(maxQuantity, q + 10))} className="!py-1">+10</Button>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                         <label>수량:</label>
                         <input type="number" value={quantity} onChange={e => setQuantity(Math.max(0, Math.min(maxQuantity, parseInt(e.target.value) || 0)))} className="w-24 bg-secondary border border-color rounded-md p-1 text-center font-bold" />
                    </div>
                </div>
                <div className="mt-4 p-3 bg-gray-900/50 rounded-lg">
                    {isEquipmentBox && <p className="text-sm text-cyan-300 mb-2">10개 구매 시 +1개 보너스!</p>}
                    <p>총 획득: <span className="font-bold text-highlight">{totalItems}개</span></p>
                    <p>총 비용: <span className="font-bold text-yellow-300">{(priceAmount * quantity).toLocaleString()} {isGold ? '골드' : '다이아'}</span></p>
                </div>
                 <div className="flex justify-center gap-4 mt-6">
                    <Button onClick={onClose} colorScheme="gray" className="w-32">취소</Button>
                    <Button onClick={handleConfirm} colorScheme="green" className="w-32" disabled={quantity === 0}>구매</Button>
                </div>
            </div>
        </DraggableWindow>
    );
};


const ShopModal: React.FC<ShopModalProps> = ({ currentUser, onClose, onAction, onStartQuiz, isTopmost, initialTab }) => {
    const [activeTab, setActiveTab] = useState<ShopTab>(initialTab || 'package');
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [purchasingItem, setPurchasingItem] = useState<ShopItemDetails | null>(null);

    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);

    const handleBuyItem = (item: ShopItemDetails) => {
        setPurchasingItem(item);
    };

    const shopItems = useMemo(() => {
        const eq = Object.entries(SHOP_ITEMS)
            .filter(([, item]) => item.type === 'equipment')
            .map(([itemId, item]) => ({ ...item, itemId, price: item.cost }));
        
        const mat = Object.entries(SHOP_ITEMS)
            .filter(([, item]) => item.type === 'material')
            .map(([itemId, item]) => ({ ...item, itemId, price: item.cost }));
            
        const cons = SHOP_CONSUMABLE_ITEMS.map(item => ({
            itemId: item.name, // Use name as ID for consumables
            name: item.name,
            description: item.description,
            price: item.cost,
            image: item.image,
            type: item.type,
            dailyLimit: item.dailyLimit,
            weeklyLimit: item.weeklyLimit,
        }));
        
        return { equipment: eq, materials: mat, consumables: cons };
    }, []);

    const resetTicketItem: ShopItemDetails = {
        itemId: 'reset_ticket',
        name: '싱글플레이 최초보상 초기화권',
        description: '싱글플레이 진행도는 유지하고, 최초 클리어 보상 기록만 초기화합니다.',
        price: { diamonds: 200 },
        image: '/images/use/reset.png',
        weeklyLimit: 1,
        type: 'consumable',
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'package':
                return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {packageItems.map(item => <PackageItemCard key={item.id} item={item} />)}
                    </div>
                );
            case 'equipment':
                return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {shopItems.equipment.map(item => <ShopItemCard key={item.itemId} item={item} onBuy={handleBuyItem} currentUser={currentUser} />)}
                    </div>
                );
            case 'materials':
                 return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {shopItems.materials.map(item => <ShopItemCard key={item.itemId} item={item} onBuy={handleBuyItem} currentUser={currentUser} />)}
                    </div>
                );
            case 'consumables':
                return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {shopItems.consumables.map(item => <ShopItemCard key={item.itemId} item={item} onBuy={handleBuyItem} currentUser={currentUser} />)}
                    </div>
                );
            case 'misc':
                 return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <ActionPointQuizCard currentUser={currentUser} onStartQuiz={onStartQuiz} />
                        <ShopItemCard
                            item={resetTicketItem}
                            onBuy={handleBuyItem}
                            currentUser={currentUser}
                        />
                    </div>
                );
        }
    };

    return (
        <DraggableWindow title="상점" onClose={onClose} windowId="shop" initialWidth={700} isTopmost={isTopmost}>
            {purchasingItem && (
                <BulkPurchaseModal 
                    item={purchasingItem}
                    currentUser={currentUser}
                    onClose={() => setPurchasingItem(null)}
                    onAction={(action) => {
                        onAction(action);
                        setToastMessage('구매 완료! 가방을 확인하세요.');
                    }}
                />
            )}
            <div className="h-[calc(var(--vh,1vh)*60)] flex flex-col relative">
                <div className="flex bg-gray-900/70 p-1 rounded-lg mb-4 flex-shrink-0">
                    <button onClick={() => setActiveTab('package')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'package' ? 'bg-accent' : 'text-gray-400 hover:bg-gray-700/50'}`}>패키지</button>
                    <button onClick={() => setActiveTab('equipment')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'equipment' ? 'bg-accent' : 'text-gray-400 hover:bg-gray-700/50'}`}>장비</button>
                    <button onClick={() => setActiveTab('materials')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'materials' ? 'bg-accent' : 'text-gray-400 hover:bg-gray-700/50'}`}>재료</button>
                    <button onClick={() => setActiveTab('consumables')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'consumables' ? 'bg-accent' : 'text-gray-400 hover:bg-gray-700/50'}`}>소모품</button>
                    <button onClick={() => setActiveTab('misc')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'misc' ? 'bg-accent' : 'text-gray-400 hover:bg-gray-700/50'}`}>기타</button>
                </div>

                <div className="flex-grow overflow-y-auto pr-2">
                    {renderContent()}
                </div>

                {toastMessage && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in z-10">
                        {toastMessage}
                    </div>
                )}
            </div>
        </DraggableWindow>
    );
};

export default ShopModal;
