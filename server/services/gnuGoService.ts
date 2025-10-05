import { spawn, ChildProcess, ChildProcessWithoutNullStreams } from 'child_process';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { LiveGameSession, AnalysisResult, Player, Point, RecommendedMove, Move } from '../../types/index.js';
import * as types from '../../types/index.js';
import { fileURLToPath } from 'url';
import * as db from '../db.js';
import { processMove } from '../../utils/goLogic.js';
import process from 'process';


// --- Configuration ---
const LETTERS = "ABCDEFGHJKLMNOPQRST";

export const pointToGnuGoMove = (move: Point, boardSize: number): string => {
    if (move.x === -1 || move.y === -1) {
        return 'pass';
    }
    return `${LETTERS[move.x]}${boardSize - move.y}`;
};

const gnuGoMoveToPoint = (move: string, boardSize: number): Point => {
    const upperMove = move.toUpperCase().trim();
    if (upperMove === 'PASS' || upperMove === 'RESIGN') {
        return { x: -1, y: -1 };
    }
    const letter = upperMove.charAt(0);
    const x = LETTERS.indexOf(letter);
    const y = boardSize - parseInt(upperMove.substring(1), 10);

    if (isNaN(y) || x === -1 || y < 0 || y >= boardSize) {
        console.error(`[GnuGo Service] Failed to parse move string: "${move}".`);
        return { x: -1, y: -1 };
    }
    return { x, y };
};


class GnuGoInstance {
    private process: ChildProcessWithoutNullStreams;
    private buffer: string = "";
    private callbacks = new Map<symbol, (line: string) => void>();
    private isOperational = false;
    private gameId: string;
    private initialStones: { x: number, y: number, player: Player }[] = [];
    private boardSize: number;
    private komi: number;
    private level: number;

    constructor(gameId: string, level: number, boardSize: number, komi: number, initialBoardState?: types.BoardState) {
        this.gameId = gameId;
        this.boardSize = boardSize;
        this.komi = komi;
        this.level = level;
        const isWindows = process.platform === 'win32';
        const exeName = isWindows ? 'gnugo.exe' : 'gnugo';
        
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename); // .../server/services
        const serverRoot = path.resolve(__dirname, '..'); // .../server
        
        const searchPaths = [
            path.join(serverRoot, 'gnugo', exeName), // server/gnugo/
            path.join(serverRoot, '..', 'gnugo', exeName), // ../gnugo/
            exeName, // PATH
        ];
        
        let command: string | undefined;
        for (const p of searchPaths) {
            if (p === exeName || fs.existsSync(p)) {
                command = p;
                break;
            }
        }

        if (!command) {
            throw new Error(`GnuGo executable not found for game ${this.gameId}.`);
        }

        console.log(`[GnuGo] Spawning for game ${this.gameId} with command: ${command}`);
        this.process = spawn(command, ['--mode', 'gtp', '--never-resign']);
        this.isOperational = true;

        this.process.stdout.on("data", (data: Buffer) => {
            this.buffer += data.toString();
            let lines = this.buffer.split("\n");
            this.buffer = lines.pop() || "";
            for (let line of lines) {
                if (line.trim()) {
                    this.callbacks.forEach(cb => cb(line.trim()));
                }
            }
        });
        
        this.process.stderr.on('data', (data: Buffer) => {
            console.error(`[GnuGoInstance ${this.gameId}] stderr: ${data}`);
        });
        
        this.process.on('exit', (code) => {
            console.log(`[GnuGoInstance ${this.gameId}] process exited with code ${code}`);
            this.isOperational = false;
        });
        
        this.process.on('error', (err) => {
            console.error(`[GnuGoInstance ${this.gameId}] process error: ${err.message}`);
            this.isOperational = false;
        });

        if (initialBoardState) {
            for (let y = 0; y < boardSize; y++) {
                for (let x = 0; x < boardSize; x++) {
                    const player = initialBoardState[y][x];
                    if (player !== Player.None) {
                        this.initialStones.push({ x, y, player });
                    }
                }
            }
        }

        this.setupBoard()
            .then(() => console.log(`[GnuGoInstance ${this.gameId}] Initialized with level ${level}, boardsize ${boardSize}, komi ${komi}`))
            .catch(e => console.error(`[GnuGoInstance ${this.gameId}] Failed to initialize board`, e));
    }

    private async setupBoard(): Promise<void> {
        await this.sendCommand(`boardsize ${this.boardSize}`);
        await this.sendCommand(`komi ${this.komi}`);
        await this.sendCommand(`level ${this.level}`);
        await this.sendCommand('clear_board');
        
        if (this.initialStones.length > 0) {
            console.log(`[GnuGoInstance ${this.gameId}] Setting up ${this.initialStones.length} initial stones via SGF.`);
            
            const sgfHeader = `(;GM[1]FF[4]CA[UTF-8]AP[SUDAM]RU[Japanese]SZ[${this.boardSize}]KM[${this.komi}]`;
            
            const blackStones = this.initialStones.filter(s => s.player === Player.Black);
            const whiteStones = this.initialStones.filter(s => s.player === Player.White);

            let sgfBody = '';
            const sgfCoord = (p: Point) => `${String.fromCharCode(97 + p.x)}${String.fromCharCode(97 + p.y)}`;

            if (blackStones.length > 0) {
                sgfBody += 'AB' + blackStones.map(s => `[${sgfCoord(s)}]`).join('');
            }
            if (whiteStones.length > 0) {
                sgfBody += 'AW' + whiteStones.map(s => `[${sgfCoord(s)}]`).join('');
            }
            
            // Set the next player to Black, as this is an initial setup.
            sgfBody += 'PL[B]';
            
            const sgfContent = sgfHeader + sgfBody + ')';
            
            const tempDir = os.tmpdir();
            const tempFilePath = path.join(tempDir, `gnugo_setup_${this.gameId}_${randomUUID()}.sgf`);

            try {
                fs.writeFileSync(tempFilePath, sgfContent);
                // GnuGo might need path with forward slashes even on Windows for GTP
                const gtpPath = tempFilePath.replace(/\\/g, '/');
                await this.sendCommand(`loadsgf ${gtpPath}`);
            } catch (err) {
                console.error(`[GnuGoInstance ${this.gameId}] Error during SGF setup:`, err);
                throw err;
            } finally {
                try {
                    fs.unlinkSync(tempFilePath);
                } catch (unlinkErr) {
                    if ((unlinkErr as NodeJS.ErrnoException).code !== 'ENOENT') {
                        console.error(`[GnuGoInstance ${this.gameId}] Failed to delete temp SGF file:`, unlinkErr);
                    }
                }
            }
        }
    }

    sendCommand(cmd: string): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this.isOperational) {
                return reject(new Error(`GnuGo process for game ${this.gameId} is not operational.`));
            }

            const key = Symbol();
            const timeout = setTimeout(() => {
                this.callbacks.delete(key);
                reject(new Error(`GnuGo command timed out: ${cmd}`));
            }, 15000);

            this.callbacks.set(key, (line) => {
                if (line.startsWith("=") || line.startsWith("?")) {
                    clearTimeout(timeout);
                    this.callbacks.delete(key);
                    if (line.startsWith("=")) {
                        resolve(line.substring(1).trim());
                    } else {
                        reject(new Error(line.substring(1).trim()));
                    }
                }
            });

            this.process.stdin.write(cmd + "\n", (err) => {
                if(err) {
                    clearTimeout(timeout);
                    this.callbacks.delete(key);
                    reject(err);
                }
            });
        });
    }

    async genmove(color: 'black' | 'white', boardSize: number): Promise<Point> {
        const suggestedMoveStr = await this.sendCommand(`reg_genmove ${color}`);
        let finalMoveStr = suggestedMoveStr;
    
        const game = await db.getLiveGame(this.gameId);
        let shouldAvoidPassing = false;
    
        if (game && (game.isAiGame || game.isSinglePlayer || game.isTowerChallenge)) {
            shouldAvoidPassing = true;
    
            if (game.passCount === 1) {
                shouldAvoidPassing = false;
            }
            else if ((game.isSinglePlayer || game.isTowerChallenge) && (game.gameType === 'capture' || game.gameType === 'survival')) {
                let goalMet = false;
                if (game.gameType === 'capture') {
                    const blackTarget = game.effectiveCaptureTargets?.[Player.Black] || Infinity;
                    const whiteTarget = game.effectiveCaptureTargets?.[Player.White] || Infinity;
                    if (game.captures[Player.Black] >= blackTarget || game.captures[Player.White] >= whiteTarget) {
                        goalMet = true;
                    }
                } else { // survival
                    const whiteStonesLeft = (game.whiteStoneLimit ?? 0) - (game.whiteStonesPlaced ?? 0);
                    if (whiteStonesLeft <= 0) {
                        goalMet = true;
                    }
                }
                if (goalMet) {
                    shouldAvoidPassing = false; // Goal is met, AI can pass.
                }
            }
        }
    
        if (/resign/i.test(suggestedMoveStr) || (shouldAvoidPassing && /pass/i.test(suggestedMoveStr))) {
            console.log(`[GnuGoInstance ${this.gameId}] GnuGo suggested pass/resign or rules forbid it. Checking for alternatives.`);
            try {
                const legalMovesStr = await this.sendCommand(`list_moves`);
                const legalMoves = legalMovesStr.split(' ').filter(m => m.trim() !== '' && !/pass/i.test(m));
    
                if (legalMoves.length > 0) {
                    const alternativeMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
                    console.log(`[GnuGoInstance ${this.gameId}] Overriding with alternative move: ${alternativeMove}`);
                    finalMoveStr = alternativeMove;
                } else {
                    console.log(`[GnuGoInstance ${this.gameId}] No other legal moves available, allowing pass.`);
                    finalMoveStr = 'pass';
                }
            } catch (e) {
                console.error(`[GnuGoInstance ${this.gameId}] Failed to get list_moves, defaulting to pass.`, e);
                finalMoveStr = 'pass';
            }
        }
        
        return gnuGoMoveToPoint(finalMoveStr, boardSize);
    }
    
    async resync(moveHistory: Move[], boardSize: number, komi: number, newInitialBoardState?: types.BoardState): Promise<void> {
        console.log(`[GnuGoInstance ${this.gameId}] Starting resync with ${moveHistory.length} moves...`);
        this.boardSize = boardSize;
        this.komi = komi;
        
        if (newInitialBoardState) {
            this.initialStones = [];
            for (let y = 0; y < boardSize; y++) {
                for (let x = 0; x < boardSize; x++) {
                    const player = newInitialBoardState[y][x];
                    if (player !== Player.None) {
                        this.initialStones.push({ x, y, player });
                    }
                }
            }
        }

        // Re-run the board setup which includes clearing and applying initial stones.
        await this.setupBoard();
        
        // Then apply the moves from history
        for (const move of moveHistory) {
            const color = move.player === Player.Black ? 'black' : 'white';
            const moveStr = pointToGnuGoMove({x: move.x, y: move.y}, boardSize);
            await this.sendCommand(`play ${color} ${moveStr}`);
        }
        console.log(`[GnuGoInstance ${this.gameId}] Resync complete with ${this.initialStones.length} initial stones and ${moveHistory.length} moves.`);
    }

    kill() {
        if(this.isOperational) {
            this.process.kill();
            this.isOperational = false;
        }
    }
}

class GnuGoManager {
    private games: Map<string, GnuGoInstance> = new Map();

    create(gameId: string, level: number, boardSize: number, komi: number, initialBoardState?: types.BoardState): GnuGoInstance | null {
        if (this.games.has(gameId)) {
            console.warn(`[GnuGoManager] GnuGo instance for game ${gameId} already exists. Killing old one.`);
            this.games.get(gameId)?.kill();
        }
        try {
            const instance = new GnuGoInstance(gameId, level, boardSize, komi, initialBoardState);
            this.games.set(gameId, instance);
            return instance;
        } catch (error) {
            console.error(`[GnuGoManager] Failed to create GnuGo instance for game ${gameId}:`, error);
            return null;
        }
    }

    get(gameId: string): GnuGoInstance | undefined {
        return this.games.get(gameId);
    }
    
    async playUserMove(gameId: string, move: Point, player: Player, boardSize: number, moveHistory: Move[], komi: number): Promise<void> {
        const inst = this.get(gameId);
        if (!inst) {
            console.warn(`[GnuGoManager] playUserMove: GnuGo instance for game ${gameId} not found.`);
            return;
        }
        const color = player === Player.Black ? 'black' : 'white';
        const moveStr = pointToGnuGoMove(move, boardSize);
        try {
            await inst.sendCommand(`play ${color} ${moveStr}`);
        } catch (error) {
            console.error(`[GnuGoManager] Error playing move for game ${gameId}, attempting resync. Error:`, error);
            try {
                // Pass the full move history to resync the board from scratch
                await inst.resync(moveHistory, boardSize, komi);
            } catch (resyncError) {
                console.error(`[GnuGoManager] Resync for game ${gameId} failed. GnuGo state is likely corrupt. Restarting instance.`, resyncError);
                // If resync fails, the instance is probably broken. We should destroy and recreate it.
                this.destroy(gameId);
                try {
                    const game = await db.getLiveGame(gameId);
                    if(game) {
                        const newInstance = this.create(gameId, game.player2.playfulLevel, game.settings.boardSize, game.finalKomi ?? game.settings.komi, game.boardState);
                        if (newInstance) {
                            // After creating, we must immediately bring it up to state.
                            await newInstance.resync(game.moveHistory, game.settings.boardSize, game.finalKomi ?? game.settings.komi);
                            console.log(`[GnuGoManager] Successfully restarted and resynced instance for game ${gameId}`);
                        }
                    }
                } catch (restartError) {
                    console.error(`[GnuGoManager] CRITICAL: Failed to restart GnuGo instance for game ${gameId}.`, restartError);
                }
            }
        }
    }

    async generateMove(gameId: string, player: Player, boardSize: number): Promise<Point> {
        const inst = this.get(gameId);
        if (!inst) {
            console.error(`[GnuGoManager] generateMove: GnuGo instance for game ${gameId} not found.`);
            return { x: -1, y: -1 }; // Pass if no instance
        }
        const color = player === Player.Black ? 'black' : 'white';
        try {
            return await inst.genmove(color, boardSize);
        } catch(e) {
            console.error(`[GnuGoManager] Error generating move for game ${gameId}:`, e);
            return { x: -1, y: -1 }; // Pass on error
        }
    }

    destroy(gameId: string) {
        const inst = this.games.get(gameId);
        if (inst) {
            inst.kill();
            this.games.delete(gameId);
            console.log(`[GnuGoManager] Destroyed GnuGo instance for game ${gameId}`);
        }
    }
}

export const gnuGoServiceManager = new GnuGoManager();