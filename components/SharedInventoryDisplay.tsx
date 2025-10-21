import React from 'react';
import { InventoryItem, ItemGrade } from '../types/index.js';
import { gradeStyles } from '../utils/itemDisplayUtils.js';

interface SharedInventoryDisplayProps {
    items: InventoryItem[];
    title: string;
}

const SharedInventoryDisplay: React.FC<SharedInventoryDisplayProps> = ({ items, title }) => {
    if (items.length === 0) {
        return (
            <div className="bg-secondary p-4 rounded-lg text-center text-tertiary">
                <h3 className="text-lg font-bold mb-2">{title}</h3>
                <p>아이템이 없습니다.</p>
            </div>
        );
    }

    return (
        <div className="bg-secondary p-4 rounded-lg">
            <h3 className="text-lg font-bold mb-4 text-primary">{title}</h3>
            <div className="grid grid-cols-5 gap-2 max-h-60 overflow-y-auto">
                {items.map(item => (
                    <div key={item.id} className="relative flex flex-col items-center text-center bg-tertiary/50 p-1 rounded-md">
                        <img src={item.image || '/images/equipments/empty.png'} alt={item.name} className="w-12 h-12 object-contain" />
                        <span className={`text-xs ${gradeStyles[item.grade]} truncate w-full`}>{item.name}</span>
                        {item.quantity && item.quantity > 1 && (
                            <span className="absolute bottom-0 right-0 text-xs font-bold text-white bg-black/60 px-1 rounded-tl-md">x{item.quantity}</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SharedInventoryDisplay;