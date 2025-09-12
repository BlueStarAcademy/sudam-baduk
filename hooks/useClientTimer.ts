import { useState, useEffect, useRef } from 'react';
import { Player, GameStatus, LiveGameSession } from '../types.js';
import { audioService } from '../services/audioService.js';

export const useClientTimer = (session: LiveGameSession) => {
    const {
        gameStatus,
        turnStartTime,
        turnDeadline,
        blackTimeLeft,
        whiteTimeLeft,
        currentPlayer,
    } = session;

    const [clientTimes, setClientTimes] = useState({ black: blackTimeLeft, white: whiteTimeLeft });
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        // Set initial times from session
        setClientTimes({ black: blackTimeLeft, white: whiteTimeLeft });

        // Only run timer if game is playing and there's a deadline
        const activeStatuses: GameStatus[] = [
            'playing',
            'alkkagi_playing',
            'curling_playing',
            'dice_rolling',
            'dice_placing',
            'thief_rolling',
            'thief_placing',
        ];
        
        if (activeStatuses.includes(gameStatus) && turnDeadline && turnStartTime) {
            timerRef.current = window.setInterval(() => {
                const now = Date.now();
                const remaining = Math.max(0, turnDeadline - now) / 1000;
                
                setClientTimes(prev => {
                    if (currentPlayer === Player.Black) {
                        return { ...prev, black: remaining };
                    } else if (currentPlayer === Player.White) {
                        return { ...prev, white: remaining };
                    }
                    return prev;
                });
            }, 250);
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [
        gameStatus, 
        turnStartTime, 
        turnDeadline,
        blackTimeLeft, // Update when server sends new time
        whiteTimeLeft, // Update when server sends new time
        currentPlayer,
    ]);

    return { clientTimes };
};