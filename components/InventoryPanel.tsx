import React, { useMemo } from 'react';
import { InventoryItem, ItemGrade, EquipmentSlot } from '../types/index.js';
import { ItemCard } from './EnhancementModal.js';

export const InventoryPanel: React.FC<{
    items: InventoryItem[];
    selectedItems: InventoryItem[];
    onSelectItem: (item: InventoryItem) => void;
    itemTypeFilter: 'equipment' | 'material' | 'all';
    title: string;
    sortBy: 'time' | 'grade' | 'type';
    onSortByChange: (sortBy: 'time' | 'grade' | 'type') => void;
}> = ({ items, selectedItems, onSelectItem, itemTypeFilter, title, sortBy, onSortByChange }) => {

    const gradeOrder: Record<ItemGrade, number> = {
        mythic: 5,
        legendary: 4,
        epic: 3,
        rare: 2,
        uncommon: 1,
        normal: 0,
    };

    const slotOrder: Record<EquipmentSlot, number> = {
        [EquipmentSlot.Fan]: 0,
        [EquipmentSlot.Top]: 1,
        [EquipmentSlot.Bottom]: 2,
        [EquipmentSlot.Board]: 3,
        [EquipmentSlot.Bowl]: 4,
        [EquipmentSlot.Stones]: 5,
    };

    const sortedItems = useMemo(() => {
        let sorted = [...items];
        if (itemTypeFilter === 'equipment' && sortBy === 'type') {
            sorted.sort((a, b) => (slotOrder[a.slot as EquipmentSlot] - slotOrder[b.slot as EquipmentSlot]) || (gradeOrder[b.grade] - gradeOrder[a.grade]) || (b.createdAt - a.createdAt));
        } else {
            switch (sortBy) {
                case 'time':
                    sorted.sort((a, b) => b.createdAt - a.createdAt);
                    break;
                case 'grade':
                    sorted.sort((a, b) => (gradeOrder[b.grade] - gradeOrder[a.grade]) || (b.createdAt - a.createdAt));
                    break;
                case 'type':
                    sorted.sort((a, b) => a.type.localeCompare(b.type) || (gradeOrder[b.grade] - gradeOrder[a.grade]) || (b.createdAt - a.createdAt));
                    break;
            }
        }
        return sorted;
    }, [items, sortBy, itemTypeFilter]);

    const filteredItems = sortedItems.filter(item => {
        if (itemTypeFilter === 'all') {
            return true;
        }
        return item.type === itemTypeFilter;
    });

    return (
        <div className="p-4 bg-secondary rounded-lg h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">{title}</h3>
                <select
                    value={sortBy}
                    onChange={(e) => onSortByChange(e.target.value as 'time' | 'grade' | 'type')}
                    className="bg-tertiary border border-color rounded-md p-1 text-xs font-semibold text-primary hover:bg-tertiary transition-colors"
                >
                    <option value="time">획득순</option>
                    <option value="grade">등급별</option>
                    <option value="type">종류별</option>
                </select>
            </div>
            <div className="grid gap-2 overflow-y-auto flex-grow" style={{ gridTemplateColumns: 'repeat(10, 1fr)' }}>
                {filteredItems.map(item => (
                    <ItemCard
                        key={item.id}
                        item={item}
                        onClick={() => onSelectItem(item)}
                        className={selectedItems.some(si => si.id === item.id) ? 'border-yellow-400' : ''}
                    />
                ))}
            </div>
        </div>
    );
};

export default InventoryPanel;
