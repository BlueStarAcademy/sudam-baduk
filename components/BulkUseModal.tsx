import React, { useState, useMemo, useEffect } from 'react';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import Slider from './ui/Slider.js';
import { InventoryItem, ServerAction, ItemGrade } from '../types/index.js';
import { currencyBundles } from '../constants/index.js';

interface BulkUseModalProps {
    item: InventoryItem;
    currentUserGold: number;
    currentUserDiamonds: number;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
}

const BulkUseModal: React.FC<BulkUseModalProps> = ({ item, currentUserGold, currentUserDiamonds, onClose, onAction }) => {
    const [quantity, setQuantity] = useState(1);

    const totalAvailable = item.quantity || 1; // Assuming stackable items have quantity

    const bundleInfo = useMemo(() => currencyBundles[item.name], [item.name]);

    const maxQuantity = useMemo(() => {
        // For now, max quantity is just total available in stack
        return totalAvailable;
    }, [totalAvailable]);

    useEffect(() => {
        if (quantity > maxQuantity) setQuantity(maxQuantity);
        if (quantity < 1 && maxQuantity > 0) setQuantity(1);
        if (maxQuantity === 0) setQuantity(0);
    }, [maxQuantity, quantity]);

    const estimatedYield = useMemo(() => {
        if (!bundleInfo) return null;
        // For currency bundles, estimate average yield
        const avgAmount = (bundleInfo.min + bundleInfo.max) / 2;
        return {
            type: bundleInfo.type,
            amount: Math.floor(avgAmount * quantity),
        };
    }, [bundleInfo, quantity]);

    const handleConfirm = () => {
        if (quantity > 0) {
            onAction({ type: 'USE_ITEM_BULK', payload: { itemName: item.name, quantity } });
        }
        onClose();
    };

    return (
        <DraggableWindow title="일괄 사용" onClose={onClose} windowId={`bulk-use-${item.id}`} initialWidth={450}>
            <div className="text-center">
                <div className="flex flex-col items-center gap-2 mb-4">
                    <div className="relative w-24 h-24">
                        <img src={item.image || '/images/default_item.png'} alt={item.name} className="relative w-full h-full object-contain p-2" />
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
                {estimatedYield && (
                    <div className="mt-4 p-3 bg-gray-900/50 rounded-lg">
                        <p>예상 획득량: <span className="font-bold text-yellow-300">{estimatedYield.amount.toLocaleString()} {estimatedYield.type === 'gold' ? '골드' : '다이아'}</span></p>
                    </div>
                )}
                 <div className="flex justify-center gap-4 mt-6">
                    <Button onClick={onClose} colorScheme="gray" className="w-32">취소</Button>
                    <Button onClick={handleConfirm} colorScheme="green" className="w-32" disabled={quantity === 0}>사용</Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default BulkUseModal;