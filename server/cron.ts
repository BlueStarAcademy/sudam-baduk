import { Request, Response } from 'express';
import * as db from './db.js';
import { updateStrategicGameState } from './modes/strategic.js';
import { updatePlayfulGameState } from './modes/playful.js';
import { GameStatus } from '../types/index.js';
import { broadcast } from './services/supabaseService.js';

const ACTIVE_GAME_STATUSES: GameStatus[] = [
    GameStatus.Playing,
    GameStatus.NigiriChoosing, GameStatus.NigiriGuessing, GameStatus.NigiriReveal,
    GameStatus.TurnPreferenceSelection,
    GameStatus.CaptureBidding, GameStatus.CaptureReveal,
    GameStatus.BasePlacement,
    GameStatus.HiddenPlacing,
    GameStatus.DiceRolling, GameStatus.DicePlacing, GameStatus.DiceRollingAnimating, GameStatus.DiceRoundEnd,
    GameStatus.ThiefRoleSelection, GameStatus.ThiefRps, GameStatus.ThiefRpsReveal, GameStatus.ThiefRoleConfirmed, GameStatus.ThiefRolling, GameStatus.ThiefPlacing, GameStatus.ThiefRollingAnimating, GameStatus.ThiefRoundEnd,
    GameStatus.AlkkagiStartConfirmation, GameStatus.AlkkagiPlacement, GameStatus.AlkkagiSimultaneousPlacement, GameStatus.AlkkagiPlaying, GameStatus.AlkkagiAnimating, GameStatus.AlkkagiRoundEnd,
    GameStatus.CurlingStartConfirmation, GameStatus.CurlingPlaying, GameStatus.CurlingAnimating, GameStatus.CurlingRoundEnd, GameStatus.CurlingTiebreakerPlaying,
];

export const handleCronTick = async (req: Request, res: Response) => {
    const cronSecret = process.env.CRON_SECRET;
    if (req.headers.authorization !== `Bearer ${cronSecret}`) {
        return res.status(401).send('Unauthorized');
    }

    try {
        console.log('[Cron] Starting tick job...');
        const now = Date.now();
        const activeGames = await db.getAllActiveGames();

        console.log(`[Cron] Found ${activeGames.length} active games to process.`);

        for (const game of activeGames) {
            const originalGameState = JSON.stringify(game);

            await updateStrategicGameState(game, now);
            await updatePlayfulGameState(game, now);

            const updatedGameState = JSON.stringify(game);

            if (originalGameState !== updatedGameState) {
                console.log(`[Cron] Game ${game.id} updated. Status: ${game.gameStatus}`);
                await db.saveGame(game);
                await broadcast({ type: 'GAME_STATE_UPDATE', payload: { updatedGame: game } });
            }
        }

        console.log('[Cron] Tick job finished.');
        res.status(200).send('Cron job executed successfully.');
    } catch (error) {
        console.error('[Cron] Error executing tick job:', error);
        res.status(500).send('Error executing cron job.');
    }
};