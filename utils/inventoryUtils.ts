// Import InventoryItem type.
import { InventoryItem, InventoryItemType } from '../types/index';
// Corrected import path for constants.
import { CONSUMABLE_ITEMS, MATERIAL_ITEMS } from '../constants/items';

export const addItemsToInventory = (inventory: InventoryItem[], inventorySlots: number, itemsToAdd: InventoryItem[]): { success: boolean, addedItems: InventoryItem[] } => {
    const tempInventory = JSON.parse(JSON.stringify(inventory));
    
    const nonStackableItems = itemsToAdd.filter(item => item.type === 'equipment');
    
    // Aggregate stackable items before processing to handle multiple stacks of the same item being added at once.
    const stackableItemsMap: Record<string, { quantity: number; item: InventoryItem }> = {};
    for (const item of itemsToAdd) {
        if (item.type === 'consumable' || item.type === 'material') {
            if (!stackableItemsMap[item.name]) {
                stackableItemsMap[item.name] = { quantity: 0, item: item };
            }
            stackableItemsMap[item.name].quantity += item.quantity || 1;
        }
    }

    let neededSlots = nonStackableItems.length;
    for (const name in stackableItemsMap) {
        let quantityToPlace = stackableItemsMap[name].quantity;
        // Check existing stacks in a temporary inventory copy
        for (const existingItem of tempInventory) {
            if (existingItem.name === name && (existingItem.type === 'consumable' || existingItem.type === 'material') && (existingItem.quantity || 0) < 100) {
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

    // Add equipment first
    inventory.push(...nonStackableItems);

    // Process aggregated stackable items
    for (const name in stackableItemsMap) {
        let quantityLeft = stackableItemsMap[name].quantity;

        // First pass: fill existing stacks in the actual inventory
        for (const existingItem of inventory) {
            if (quantityLeft <= 0) break;
            // Add explicit type check to prevent stacking on equipment with the same name
            if (existingItem.name === name && (existingItem.type === 'consumable' || existingItem.type === 'material') && (existingItem.quantity || 0) < 100) {
                const canAdd = 100 - (existingItem.quantity || 0);
                const toAdd = Math.min(quantityLeft, canAdd);
                existingItem.quantity = (existingItem.quantity || 0) + toAdd;
                quantityLeft -= toAdd;
            }
        }
        
        // Second pass: create new stacks if needed
        while (quantityLeft > 0) {
            const toAdd = Math.min(quantityLeft, 100);
            const template = [...CONSUMABLE_ITEMS, ...Object.values(MATERIAL_ITEMS)].find(t => t.name === name);
            if (template) {
                 const newItem: InventoryItem = {
                     ...(template as any),
                     id: `item-${globalThis.crypto.randomUUID()}`,
                     quantity: toAdd, 
                     createdAt: Date.now(), 
                     isEquipped: false, 
                     stars: 0, 
                     level: 1,
                     slot: null,
                     options: undefined,
                 };
                 inventory.push(newItem);
            } else {
                console.error(`[Inventory] Could not find template for ${name} when creating new stack.`);
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
        const template = [...CONSUMABLE_ITEMS, ...Object.values(MATERIAL_ITEMS)].find((t: { name: string; }) => t.name === itemId);

        if (template) {
            const newItem: InventoryItem = {
                ...template,
                id: `item-${globalThis.crypto.randomUUID()}`,
                createdAt: Date.now(),
                quantity: quantity,
                isEquipped: false, 
                level: 1,
                stars: 0,
                options: undefined,
                slot: null, // Ensure slot is null for non-equipment
            };
            createdItems.push(newItem);
        } else {
            console.error(`[Reward] Could not find consumable/material item template for: ${itemId}`);
        }
    }
    return createdItems;
};