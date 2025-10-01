import { Database } from 'sqlite';
import { LiveGameSession } from '../../types/index.js';
import { rowToGame } from './mappers.js';

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

export const getLiveGame = async (db: Database, id: string): Promise<LiveGameSession | null> => {
    const row = await db.get('SELECT * FROM live_games WHERE id = ?', id);
    return rowToGame(row);
};

export const getAllActiveGames = async (db: Database): Promise<LiveGameSession[]> => {
    const rows = await db.all("SELECT * FROM live_games WHERE gameStatus NOT IN ('ended', 'no_contest')");
    return rows.map(rowToGame).filter((g): g is LiveGameSession => g !== null);
};

export const getAllEndedGames = async (db: Database): Promise<LiveGameSession[]> => {
    const rows = await db.all("SELECT * FROM live_games WHERE gameStatus IN ('ended', 'no_contest')");
    return rows.map(rowToGame).filter((g): g is LiveGameSession => g !== null);
};

export const saveGame = async (db: Database, game: LiveGameSession): Promise<void> => {
    const existing = await db.get('SELECT id FROM live_games WHERE id = ?', game.id);
    const serializedGame = serializeGame(game);
    
    // Remove properties that are not columns in the table or should not be persisted
    delete serializedGame.pendingAiMove;

    if (existing) {
        const columns = Object.keys(serializedGame).filter(key => key !== 'id');
        const setClause = columns.map(key => `${key} = ?`).join(', ');
        const values = columns.map(key => serializedGame[key]);
        await db.run(`UPDATE live_games SET ${setClause} WHERE id = ?`, ...values, game.id);
    } else {
        const columns = Object.keys(serializedGame);
        const placeholders = columns.map(() => '?').join(',');
        const values = columns.map(key => serializedGame[key]);
        await db.run(`INSERT INTO live_games (${columns.join(',')}) VALUES (${placeholders})`, ...values);
    }
};

export const deleteGame = async (db: Database, id: string): Promise<void> => {
    await db.run('DELETE FROM live_games WHERE id = ?', id);
};
