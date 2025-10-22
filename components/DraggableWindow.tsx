import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useDraggableWindow } from '../hooks/useDraggableWindow';

interface DraggableWindowProps {
    title: string;
    windowId: string;
    onClose?: () => void;
    children: React.ReactNode;
    initialWidth?: number;
    initialHeight?: number;
    modal?: boolean;
    closeOnOutsideClick?: boolean;
    isTopmost?: boolean;
}

const DraggableWindow: React.FC<DraggableWindowProps> = ({ title, children, onClose, initialWidth, initialHeight, windowId, modal, closeOnOutsideClick, isTopmost }) => {
    const { position, handleMouseDown, handleTouchStart, rememberPosition, handleRememberChange, headerCursor, windowRef } = useDraggableWindow(windowId, initialWidth, initialHeight);

    const style: React.CSSProperties = {
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: initialWidth ? `${initialWidth}px` : undefined,
        height: initialHeight ? `${initialHeight}px` : undefined,
    };

    return (
        <div ref={windowRef} style={style} className="fixed bg-primary rounded-xl shadow-2xl flex flex-col z-50 text-on-panel panel-glow">
            <div
                className={`bg-secondary p-3 rounded-t-xl flex justify-between items-center ${headerCursor} touch-none`}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
            >
                <h2 className="text-lg font-bold text-secondary select-none">{title}</h2>
                {onClose && (
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-tertiary hover:bg-danger transition-colors z-30">
                        <span className="text-white font-bold text-lg">✕</span>
                    </button>
                )}
            </div>
            <div className="p-3 md:p-6 flex-grow overflow-y-auto z-30">
                {children}
            </div>
            <div className="flex-shrink-0 p-2 border-t border-color flex justify-end items-center bg-secondary rounded-b-xl">
                <label className="flex items-center text-xs text-tertiary gap-2 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={rememberPosition}
                        onChange={handleRememberChange}
                        className="w-4 h-4 bg-tertiary border-color rounded focus:ring-accent"
                    />
                    창 위치 기억하기
                </label>
            </div>
        </div>
    );
};

export default DraggableWindow;