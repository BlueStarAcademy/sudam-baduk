import { useState, useEffect, useRef } from 'react';
import { Player, GameStatus, GameMode } from '../types/index';
import type { LiveGameSession } from '../types/index';
import { audioService } from '../services/audioService';
import { PLAYFUL_GAME_MODES } from '../constants/gameModes';

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
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        const isMyTurnNow = currentPlayer === myPlayerEnum;

        // Replace string literals with GameStatus enum members.
        const activeStatuses: GameStatus[] = [
            GameStatus.Playing,
            GameStatus.AlkkagiPlaying,
            GameStatus.CurlingPlaying,
            GameStatus.DiceRolling,
            GameStatus.DicePlacing,
            GameStatus.ThiefRolling,
            GameStatus.ThiefPlacing,
        ];
        
        if (isMyTurnNow && activeStatuses.includes(gameStatus) && turnDeadline && turnStartTime) {
            const updateTimer = () => {
                const now = Date.now();
                const remaining = Math.max(0, turnDeadline - now) / 1000;
                
                setClientTimes(prev => {
                    const newTimes = { ...prev };
                    if (currentPlayer === Player.Black) {
                        newTimes.black = remaining;
                    } else if (currentPlayer === Player.White) {
                        newTimes.white = remaining;
                    }
                    return newTimes;
                });
            };

            updateTimer(); // Immediately set the correct time instead of waiting for the first interval
            timerRef.current = window.setInterval(updateTimer, 250);

        } else {
            // Not my turn or not a timed state, just sync with server props
            setClientTimes({ black: blackTimeLeft, white: whiteTimeLeft });
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

    // FIX: Return the clientTimes object directly to fix type errors in consumers.
    return clientTimes;
};