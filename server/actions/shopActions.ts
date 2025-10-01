// FIX: Import SHOP_BORDER_ITEMS from constants instead of types.
import { VolatileState, ServerAction, User, HandleActionResult, InventoryItem } from '../../types/index.js';
import { SHOP_BORDER_ITEMS } from '../../constants/index.js';
import * as db from '../db.js';
import { SHOP_ITEMS } from '../shop.js';
import { isSameDayKST, isDifferentWeekKST } from '../../utils/timeUtils.js';
import * as currencyService from '../currencyService.js';
import { addItemsToInventory } from '../../utils/inventoryUtils.js';

const canPurchase = (user: User, item: any, quantity: number = 1): { can: boolean, reason?: string } => {
    if (user.isAdmin) return { can: true };
    const now = Date.now();
    const purchaseRecord = user.dailyShopPurchases?.[item.itemId];

    if (item.dailyLimit) {
        const purchasedToday = (purchaseRecord && isSameDayKST(purchaseRecord.date, now)) ? purchaseRecord.quantity : 0;
        if (purchasedToday + quantity > item.dailyLimit) {
            return { can: false, reason: '일일 구매 한도를 초과했습니다.' };
        }
    }
    
    if (item.weeklyLimit) {
        const purchasedThisWeek = (purchaseRecord && !isDifferentWeekKST(purchaseRecord.date, now)) ? purchaseRecord.quantity : 0;
        if (purchasedThisWeek + quantity > item.weeklyLimit) {
            return { can: false, reason: '주간 구매 한도를 초과했습니다.' };
        }
    }

    if (item.cost.gold && user.gold < item.cost.gold * quantity) {
        return { can: false, reason: '골드가 부족합니다.' };
    }
    
    if (item.cost.diamonds && user.diamonds < item.cost.diamonds * quantity) {
        return { can: false, reason: '다이아가 부족합니다.' };
    }

    return { can: true };
};


export const handleShopAction = async (volatileState: VolatileState, action: ServerAction & { userId: string }, user: User): Promise<HandleActionResult> => {
    const { type, payload } = action;

    switch(type) {
        case 'BUY_SHOP_ITEM': {
            const { itemId, quantity } = payload;
            const itemDetails = Object.entries(SHOP_ITEMS)
                .map(([id, item]) => ({ ...item, itemId: id }))
                .find(i => i.itemId === itemId || i.name === itemId);

            if (!itemDetails) return { error: 'Invalid item.' };
            
            if (!user.isAdmin) {
                const check = canPurchase(user, itemDetails, quantity);
                if (!check.can) return { error: check.reason };
            }

            const itemsToAdd = [];
            for (let i = 0; i < quantity; i++) {
                const purchased = itemDetails.onPurchase();
                if (Array.isArray(purchased)) {
                    itemsToAdd.push(...purchased);
                } else {
                    itemsToAdd.push(purchased);
                }
            }
            
            const tempInventory = JSON.parse(JSON.stringify(user.inventory));
            const { success } = addItemsToInventory(tempInventory, user.inventorySlots, itemsToAdd);

            if (!success) return { error: '인벤토리 공간이 부족합니다.' };
            
            // If space check is successful, apply to the real inventory
            addItemsToInventory(user.inventory, user.inventorySlots, itemsToAdd);
            
            if (!user.isAdmin) {
                if (itemDetails.cost.gold) currencyService.spendGold(user, itemDetails.cost.gold * quantity, `${itemDetails.name} 구매`);
                if (itemDetails.cost.diamonds) currencyService.spendDiamonds(user, itemDetails.cost.diamonds * quantity, `${itemDetails.name} 구매`);

                const now = Date.now();
                if (!user.dailyShopPurchases) user.dailyShopPurchases = {};
                
                const purchaseRecord = user.dailyShopPurchases[itemId] || { quantity: 0, date: 0 };
                const isNewDay = !isSameDayKST(purchaseRecord.date, now);
                const isNewWeek = isDifferentWeekKST(purchaseRecord.date, now);

                if ((itemDetails.dailyLimit && isNewDay) || (itemDetails.weeklyLimit && isNewWeek)) {
                    purchaseRecord.quantity = 0;
                }
                
                purchaseRecord.quantity += quantity;
                purchaseRecord.date = now;
                user.dailyShopPurchases[itemId] = purchaseRecord;
            }
            
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user, obtainedItemsBulk: itemsToAdd } };
        }
        case 'BUY_BORDER': {
            const { borderId } = payload;
            const borderInfo = SHOP_BORDER_ITEMS.find(b => b.id === borderId);
            if (!borderInfo) return { error: 'Invalid border.' };

            if (user.ownedBorders.includes(borderId)) return { error: 'Already own this border.' };

            const price = borderInfo.price;
            if (!user.isAdmin) {
                if (price.gold && user.gold < price.gold) return { error: '골드가 부족합니다.' };
                if (price.diamonds && user.diamonds < price.diamonds) return { error: '다이아가 부족합니다.' };

                if (price.gold) currencyService.spendGold(user, price.gold, `${borderInfo.name} 테두리 구매`);
                if (price.diamonds) currencyService.spendDiamonds(user, price.diamonds, `${borderInfo.name} 테두리 구매`);
            }

            user.ownedBorders.push(borderId);

            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }
        case 'EXPAND_INVENTORY': {
            // ... (Expansion logic)
        }
        default:
            return { error: 'Unknown shop action type.' };
    }

    // A placeholder return until all cases are filled out.
    await db.updateUser(user);
    return { clientResponse: { updatedUser: user } };
};
