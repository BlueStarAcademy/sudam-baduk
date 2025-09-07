import { randomUUID } from 'crypto';
import { InventoryItem, InventoryItemType } from '../types.js';
import { CONSUMABLE_ITEMS, MATERIAL_ITEMS } from '../constants.js';

export const addItemsToInventory = (inventory: InventoryItem[], inventorySlots: number, itemsToAdd: InventoryItem[]): { success: boolean, addedItems: InventoryItem[] } => {
    const tempInventory = JSON.parse(JSON.stringify(inventory));
    
    const nonStackableItems = itemsToAdd.filter(item => item.type === 'equipment');
    const stackableItems = itemsToAdd.filter(item => item.type !== 'equipment');
    
    let neededSlots = nonStackableItems.length;

    const stackableToAdd: Record<string, number> = {};
    for(const item of stackableItems) {
        stackableToAdd[item.name] = (stackableToAdd[item.name] || 0) + (item.quantity || 1);
    }
    
    for (const name in stackableToAdd) {
        let quantityToPlace = stackableToAdd[name];
        for (const existingItem of tempInventory) {
            if (existingItem.name === name && (existingItem.quantity || 0) < 100) {
                const space = 100 - (existingItem.quantity || 0);
                quantityToPlace -= Math.min(quantityToPlace, space);
            }
        }
        if (quantityToPlace > 0) {
            neededSlots += Math.ceil(quantityToPlace / 100);
        }
    }
    
    if (inventorySlots - inventory.length < neededSlots) {
        return { success: false, addedItems: [] };
    }

    inventory.push(...nonStackableItems);

    for (const item of stackableItems) {
        let quantityLeft = item.quantity || 1;
        for (const existingItem of inventory) {
            if (quantityLeft <= 0) break;
            if (existingItem.name === item.name && (existingItem.quantity || 0) < 100) {
                const canAdd = 100 - (existingItem.quantity || 0);
                const toAdd = Math.min(quantityLeft, canAdd);
                existingItem.quantity = (existingItem.quantity || 0) + toAdd;
                quantityLeft -= toAdd;
            }
        }
        while (quantityLeft > 0) {
            const toAdd = Math.min(quantityLeft, 100);
            const template = [...Object.values(CONSUMABLE_ITEMS), ...Object.values(MATERIAL_ITEMS)].find(t => t.name === item.name) as Omit<InventoryItem, 'id'|'createdAt'|'isEquipped'|'level'|'stars'|'options'>;
            if (template) {
                 inventory.push({ ...template, id: `item-${randomUUID()}`, quantity: toAdd, createdAt: Date.now(), isEquipped: false, stars: 0, level: 1 });
            }
            quantityLeft -= toAdd;
        }
    }

    return { success: true, addedItems: itemsToAdd };
};

export const createItemInstancesFromReward = (itemRefs: (InventoryItem | { itemId: string; quantity: number })[]): InventoryItem[] => {
    const createdItems: InventoryItem[] = [];
    for (const itemRef of itemRefs) {
        if ('id' in itemRef) { // It's a full InventoryItem, just pass it through
            createdItems.push(itemRef);
            continue;
        }

        const { itemId, quantity } = itemRef;
        
        // This logic finds the item template and creates an instance, which is correct for granting a reward item.
        // It avoids the previous issue of "opening" the item via shop logic.
        const template = [...CONSUMABLE_ITEMS, ...Object.values(MATERIAL_ITEMS)].find(t => t.name === itemId);

        if (template) {
            const newItem: InventoryItem = {
                ...template,
                id: `item-${randomUUID()}`,
                createdAt: Date.now(),
                quantity: quantity,
                isEquipped: false, 
                level: 1,
                stars: 0,
                options: undefined,
            };
            createdItems.push(newItem);
        } else {
            console.error(`[Reward] Could not find consumable/material item template for: ${itemId}`);
        }
    }
    return createdItems;
};
