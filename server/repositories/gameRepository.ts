import { Pool } from 'pg';
import { LiveGameSession } from '../../types/index.js';
// FIX: Corrected import path for `rowToGame` to point to the correct mapper file.
import { rowToGame } from '../db/mappers.js';
import { broadcast } from '../services/supabaseService.js';

const serializeGame = (game: LiveGameSession) => {
    const serialized: any = {};
    for (const key in game) {
        const value = (game as any)[key];
        if (typeof value === 'object' && value !== null && !(value instanceof Promise)) {
            serialized[key] = JSON.stringify(value);
        } else {
            serialized[key] = value;
        }
    }
    return serialized;
};

export const getLiveGame = async (db: Pool, id: string): Promise<LiveGameSession | null> => {
    const res = await db.query('SELECT * FROM live_games WHERE id = $1', [id]);
    return rowToGame(res.rows[0]);
};

export const getAllActiveGames = async (db: Pool): Promise<LiveGameSession[]> => {
    const res = await db.query("SELECT * FROM live_games WHERE \"gameStatus\" NOT IN ('ended', 'no_contest')");
    return res.rows.map(rowToGame).filter((g): g is LiveGameSession => g !== null);
};

export const getAllEndedGames = async (db: Pool): Promise<LiveGameSession[]> => {
    const res = await db.query("SELECT * FROM live_games WHERE \"gameStatus\" IN ('ended', 'no_contest')");
    return res.rows.map(rowToGame).filter((g): g is LiveGameSession => g !== null);
};

export const saveGame = async (db: Pool, game: LiveGameSession): Promise<void> => {
    const res = await db.query('SELECT id FROM live_games WHERE id = $1', [game.id]);
    const existing = res.rows[0];
    const serializedGame = serializeGame(game);
    
    delete serializedGame.pendingAiMove;

    if (existing) {
        const columns = Object.keys(serializedGame).filter(key => key !== 'id');
        const setClause = columns.map((key, i) => `"${key}" = $${i + 1}`).join(', ');
        const values = columns.map(key => serializedGame[key]);
        await db.query(`UPDATE live_games SET ${setClause} WHERE id = $${columns.length + 1}`, [...values, game.id]);
    } else {
        const columns = Object.keys(serializedGame);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(',');
        const values = columns.map(key => serializedGame[key]);
        await db.query(`INSERT INTO live_games (${columns.map(c => `"${c}"`).join(',')}) VALUES (${placeholders})`, values);
    }

    const updatedGame = await getLiveGame(db, game.id);
    if (updatedGame) {
        await broadcast({ event: 'GAME_UPDATE', payload: updatedGame });
    }
};

export const deleteGame = async (db: Pool, id: string): Promise<void> => {
    await db.query('DELETE FROM live_games WHERE id = $1', [id]);
    await broadcast({ event: 'GAME_DELETE', payload: { id } });
};