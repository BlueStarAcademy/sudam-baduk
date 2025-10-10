import { useState, useEffect, useRef } from 'react';
import { Player, GameStatus, GameMode } from '../types/index.js';
import type { LiveGameSession } from '../types/index.js';
import { audioService } from '../services/audioService.js';
import { PLAYFUL_GAME_MODES } from '../constants/gameModes.js';

export const useClientTimer = (session: LiveGameSession, myPlayerEnum: Player) => {
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
        // ALWAYS sync with server state when props change
        setClientTimes({ black: blackTimeLeft, white: whiteTimeLeft });

        // Clean up previous timer
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        const activeStatuses: GameStatus[] = [
            GameStatus.Playing,
            GameStatus.AlkkagiPlaying,
            GameStatus.CurlingPlaying,
            GameStatus.DiceRolling,
            GameStatus.DicePlacing,
            GameStatus.ThiefRolling,
            GameStatus.ThiefPlacing,
        ];
        
        // If the game is in a state where a timer should be running...
        if (activeStatuses.includes(gameStatus) && turnDeadline && turnStartTime) {
            const updateTimer = () => {
                const remaining = Math.max(0, turnDeadline - Date.now()) / 1000;
                setClientTimes(prev => {
                    if (currentPlayer === Player.Black) {
                        return { ...prev, black: remaining };
                    } else if (currentPlayer === Player.White) {
                        return { ...prev, white: remaining };
                    }
                    return prev;
                });
            };

            updateTimer(); // Initial update
            timerRef.current = window.setInterval(updateTimer, 250);
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
        blackTimeLeft,
        whiteTimeLeft,
        currentPlayer,
        myPlayerEnum
    ]);

    return clientTimes;
};
