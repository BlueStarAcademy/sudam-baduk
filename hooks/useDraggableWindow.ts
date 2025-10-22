import { useState, useEffect, useCallback, useRef } from 'react';

interface Point {
    x: number;
    y: number;
}

export const useDraggableWindow = (windowId: string, initialWidth?: number, initialHeight?: number) => {
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState<Point>(() => {
        const storedPosition = localStorage.getItem(`windowPosition-${windowId}`);
        if (storedPosition) {
            return JSON.parse(storedPosition);
        }
        // Default to 0,0 and let useEffect center it if not remembered
        return { x: 0, y: 0 };
    });
    const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
    const [rememberPosition, setRememberPosition] = useState<boolean>(() => {
        return localStorage.getItem(`rememberWindowPosition-${windowId}`) === 'true';
    });

    const windowRef = useRef<HTMLDivElement>(null);

    // Effect to center the window if not remembered and no stored position
    useEffect(() => {
        if (!rememberPosition && position.x === 0 && position.y === 0 && windowRef.current) {
            const { innerWidth, innerHeight } = window;
            const { offsetWidth, offsetHeight } = windowRef.current;

            const centerX = (innerWidth - offsetWidth) / 2;
            const centerY = (innerHeight - offsetHeight) / 2;
            setPosition({ x: centerX, y: centerY });
        }
    }, [rememberPosition, position.x, position.y, windowId]); // Added windowId to dependencies

    useEffect(() => {
        if (rememberPosition) {
            localStorage.setItem(`rememberWindowPosition-${windowId}`, 'true');
        } else {
            localStorage.removeItem(`rememberWindowPosition-${windowId}`);
        }
    }, [rememberPosition, windowId]);

    useEffect(() => {
        if (rememberPosition) {
            localStorage.setItem(`windowPosition-${windowId}`, JSON.stringify(position));
        }
    }, [position, rememberPosition, windowId]);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button !== 0) return; // Only left click
        setIsDragging(true);
        setOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        });
        e.preventDefault();
    }, [position]);

    const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
        if (e.touches.length === 1) {
            setIsDragging(true);
            setOffset({
                x: e.touches[0].clientX - position.x,
                y: e.touches[0].clientY - position.y,
            });
            e.preventDefault();
        }
    }, [position]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return;
        let newX = e.clientX - offset.x;
        let newY = e.clientY - offset.y;

        // Keep window within viewport
        if (windowRef.current) {
            const { innerWidth, innerHeight } = window;
            const { offsetWidth, offsetHeight } = windowRef.current;

            newX = Math.max(-offsetWidth / 2, Math.min(newX, innerWidth - offsetWidth / 2));
            newY = Math.max(-offsetHeight / 2, Math.min(newY, innerHeight - offsetHeight / 2));
        }

        setPosition({ x: newX, y: newY });
    }, [isDragging, offset]);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (!isDragging || e.touches.length !== 1) return;
        let newX = e.touches[0].clientX - offset.x;
        let newY = e.touches[0].clientY - offset.y;

        if (windowRef.current) {
            const { innerWidth, innerHeight } = window;
            const { offsetWidth, offsetHeight } = windowRef.current;

            newX = Math.max(-offsetWidth / 2, Math.min(newX, innerWidth - offsetWidth / 2));
            newY = Math.max(-offsetHeight / 2, Math.min(newY, innerHeight - offsetHeight / 2));
        }

        setPosition({ x: newX, y: newY });
    }, [isDragging, offset]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleTouchEnd = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.addEventListener('touchmove', handleTouchMove);
            document.addEventListener('touchend', handleTouchEnd);
        } else {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

    const handleRememberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setRememberPosition(e.target.checked);
    }, []);

    const headerCursor = isDragging ? 'grabbing' : 'grab';

    return { position, handleMouseDown, handleTouchStart, rememberPosition, handleRememberChange, headerCursor, windowRef };
};