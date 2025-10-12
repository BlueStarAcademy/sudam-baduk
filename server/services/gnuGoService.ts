// server/services/gnuGoService.ts

// Dummy implementation to satisfy module requirements and type checks.
// In a real application, this would manage child processes for the GNU Go engine.
class GnuGoServiceManager {
    private games: Map<string, any> = new Map();

    public async create(gameId: string, level: number, boardSize: number, komi: number): Promise<void> {
        console.log(`[GnuGoService] Creating game ${gameId} with level ${level}, size ${boardSize}, komi ${komi}`);
        this.games.set(gameId, { level, boardSize, komi, process: null });
        return Promise.resolve();
    }

    public async destroy(gameId: string): Promise<void> {
        console.log(`[GnuGoService] Destroying game ${gameId}`);
        this.games.delete(gameId);
        return Promise.resolve();
    }
}

export const gnuGoServiceManager = new GnuGoServiceManager();
