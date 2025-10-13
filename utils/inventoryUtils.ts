// Import InventoryItem type.
import { InventoryItem, InventoryItemType } from '../types/index.js';
// Corrected import path for constants.
import { CONSUMABLE_ITEMS, MATERIAL_ITEMS } from '../constants/items.js';

export const addItemsToInventory = (
    inventory: InventoryItem[],
    inventorySlots: { equipment: number; consumable: number; material: number },
    itemsToAdd: InventoryItem[]
): { success: boolean, addedItems: InventoryItem[] } => {
    const tempInventory = JSON.parse(JSON.stringify(inventory));
    
    // Group items by type to check against slot limits
    const itemsByType: Record<InventoryItemType, InventoryItem[]> = {
        equipment: [],
        consumable: [],
        material: [],
    };
    for (const item of itemsToAdd) {
        itemsByType[item.type].push(item);
    }

    const currentCounts = {
        equipment: inventory.filter(i => i.type === 'equipment').length,
        consumable: inventory.filter(i => i.type === 'consumable').length,
        material: inventory.filter(i => i.type === 'material').length,
    };

    // Check equipment slots
    if (currentCounts.equipment + itemsByType.equipment.length > inventorySlots.equipment) {
        return { success: false, addedItems: [] };
    }
    
    // Check consumable and material slots
    for (const type of ['consumable', 'material'] as const) {
        if (itemsByType[type].length === 0) continue;

        let neededSlots = 0;
        const aggregatedQuantities: Record<string, number> = {};
        for (const item of itemsByType[type]) {
            aggregatedQuantities[item.name] = (aggregatedQuantities[item.name] || 0) + (item.quantity || 1);
        }

        for (const name in aggregatedQuantities) {
            let quantityToPlace = aggregatedQuantities[name];

            // Account for space in existing stacks
            for (const existingItem of tempInventory) {
                if (existingItem.name === name && existingItem.type === type && (existingItem.quantity || 0) < 100) {
                    const space = 100 - (existingItem.quantity || 0);
                    quantityToPlace -= Math.min(quantityToPlace, space);
                }
            }

            if (quantityToPlace > 0) {
                neededSlots += Math.ceil(quantityToPlace / 100);
            }
        }
        
        const currentTypeCount = inventory.filter(i => i.type === type).length;
        if (currentTypeCount + neededSlots > inventorySlots[type]) {
            return { success: false, addedItems: [] };
        }
    }

    // All checks passed, now actually add items
    // Non-stackables first
    inventory.push(...itemsByType.equipment);

    // Then stackables
    for (const type of ['consumable', 'material'] as const) {
        const aggregatedQuantities: Record<string, number> = {};
        for (const item of itemsByType[type]) {
            aggregatedQuantities[item.name] = (aggregatedQuantities[item.name] || 0) + (item.quantity || 1);
        }

        for (const name in aggregatedQuantities) {
            let quantityLeft = aggregatedQuantities[name];

            // First pass: fill existing stacks
            for (const existingItem of inventory) {
                if (quantityLeft <= 0) break;
                if (existingItem.name === name && existingItem.type === type && (existingItem.quantity || 0) < 100) {
                    const canAdd = 100 - (existingItem.quantity || 0);
                    const toAdd = Math.min(quantityLeft, canAdd);
                    existingItem.quantity = (existingItem.quantity || 0) + toAdd;
                    quantityLeft -= toAdd;
                }
            }
            
            // Second pass: create new stacks
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
// FIX: Add missing 'options' property to created item object to satisfy InventoryItem type.
                         options: undefined,
                     };
                     inventory.push(newItem);
                } else {
                    console.error(`[Inventory] Could not find template for ${name} when creating new stack.`);
                }
                quantityLeft -= toAdd;
            }
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
