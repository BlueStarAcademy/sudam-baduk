import React from 'react';

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

const DraggableWindow: React.FC<DraggableWindowProps> = ({ title, children, onClose, initialWidth, initialHeight }) => {
    const style: React.CSSProperties = {};
    if (initialWidth) {
        style.width = `${initialWidth}px`;
    }
    if (initialHeight) {
        style.height = `${initialHeight}px`;
    }

    return (
        <div style={style} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary rounded-xl shadow-2xl flex flex-col z-50 text-on-panel panel-glow">
            <div className="bg-secondary p-3 rounded-t-xl flex justify-between items-center">
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
        </div>
    );
};

export default DraggableWindow;