import { getGoLogic } from './goLogic.js';
import { NO_CONTEST_MOVE_THRESHOLD, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, STRATEGIC_ACTION_BUTTONS_EARLY, STRATEGIC_ACTION_BUTTONS_MID, STRATEGIC_ACTION_BUTTONS_LATE, PLAYFUL_ACTION_BUTTONS_EARLY, PLAYFUL_ACTION_BUTTONS_MID, PLAYFUL_ACTION_BUTTONS_LATE, RANDOM_DESCRIPTIONS, ALKKAGI_TURN_TIME_LIMIT, ALKKAGI_PLACEMENT_TIME_LIMIT, TIME_BONUS_SECONDS_PER_POINT, DEFAULT_GAME_SETTINGS } from '../constants/index.js';
import { TOWER_STAGES } from '../constants/towerChallengeConstants.js';
import { SINGLE_PLAYER_STAGES } from '../constants/singlePlayerConstants.js';
import { type LiveGameSession, type Negotiation, type ActionButton, GameMode, Player, type GameSettings, GameStatus, MythicStat, WinReason, Guild, Move } from '../types/index.js';
import { aiUserId, makeAiMove, getAiUser } from './ai/index.js';
import { initializeStrategicGame, updateStrategicGameState } from './modes/strategic.js';
import { initializePlayfulGame, updatePlayfulGameState } from './modes/playful.js';
import * as db from './db.js';
import * as effectService from '../utils/statUtils.js';
import { endGame, getGameResult } from './summaryService.js';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { gnuGoServiceManager } from './services/gnuGoService.js';
// FIX: Export pointToGnuGoMove to be used in other modules.
import { pointToGnuGoMove } from './services/gnuGoService.js';


export const getNewActionButtons = (game: LiveGameSession): ActionButton[] => {
    const { mode, moveHistory } = game;
    
    let phase: 'early' | 'mid' | 'late';
    const isPlayful = PLAYFUL_GAME_MODES.some(m => m.mode === mode);

    if (isPlayful) {
        // Use round-based phase for most playful games
        const currentRound = game.alkkagiRound || game.curlingRound || game.round || 1;
        const totalRounds = game.settings.alkkagiRounds || game.settings.curlingRounds || game.settings.diceGoRounds || 2;

        if (currentRound === 1) {
            phase = 'early';
        } else if (currentRound === totalRounds) {
            phase = 'late';
        } else {
            phase = 'mid';
        }
    } else { // Strategic
        const moveCount = moveHistory.length;
        if (moveCount <= 30) {
            phase = 'early';
        } else if (moveCount >= 31 && moveCount <= 150) {
            phase = 'mid';
        } else { // moveCount >= 151
            phase = 'late';
        }
    }

    let sourceDeck: ActionButton[];

    if (isPlayful) {
        switch (phase) {
            case 'early': sourceDeck = PLAYFUL_ACTION_BUTTONS_EARLY; break;
            case 'mid':   sourceDeck = PLAYFUL_ACTION_BUTTONS_MID; break;
            case 'late':  sourceDeck = PLAYFUL_ACTION_BUTTONS_LATE; break;
        }
    } else { // Strategic
        switch (phase) {
            case 'early': sourceDeck = STRATEGIC_ACTION_BUTTONS_EARLY; break;
            case 'mid':   sourceDeck = STRATEGIC_ACTION_BUTTONS_MID; break;
            case 'late':  sourceDeck = STRATEGIC_ACTION_BUTTONS_LATE; break;
        }
    }

    const shuffledButtons = [...sourceDeck].sort(() => 0.5 - Math.random());
    const manners = shuffledButtons.filter(b => b.type === 'manner');
    const unmanners = shuffledButtons.filter(b => b.type === 'unmannerly');

    const mannerCount = Math.random() > 0.5 ? 1 : 2;
    const selectedManners = manners.slice(0, mannerCount);
    
    const neededUnmanners = 3 - selectedManners.length;
    const selectedUnmanners = unmanners.slice(0, neededUnmanners);

    let result = [...selectedManners, ...selectedUnmanners];
    
    if (result.length < 3) {
        const existingNames = new Set(result.map(b => b.name));
        const filler = shuffledButtons.filter(b => !existingNames.has(b.name));
        result.push(...filler.slice(0, 3 - result.length));
    }
    
    return result.slice(0, 3).sort(() => 0.5 - Math.random());
};

export const initializeGame = async (neg: Negotiation, guilds: Record<string, Guild>): Promise<LiveGameSession> => {
    const gameId = `game-${globalThis.crypto.randomUUID()}`;
    const { settings: settingsFromNeg, mode } = neg;
    const now = Date.now();
    
    const settings: GameSettings = { ...DEFAULT_GAME_SETTINGS, ...settingsFromNeg };
    
    const challenger = await db.getUser(neg.challenger.id);
    const opponent = neg.opponent.id === aiUserId ? neg.opponent : await db.getUser(neg.opponent.id);

    if (!challenger || !opponent) {
        throw new Error(`Could not find one or more players to start the game: ${neg.challenger.id}, ${neg.opponent.id}`);
    }
    
    const isAiGame = opponent.id === aiUserId;
    
    const descriptions = RANDOM_DESCRIPTIONS[mode] || [`${mode} 한 판!`];
    const randomDescription = descriptions[Math.floor(Math.random() * descriptions.length)];

    const game: LiveGameSession = {
        id: gameId,
        mode, settings, description: randomDescription, player1: challenger, player2: opponent, isAiGame,
        boardState: Array(settings.boardSize).fill(0).map(() => Array(settings.boardSize).fill(Player.None)),
        moveHistory: [], captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        baseStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 }, 
        hiddenStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        winner: null, winReason: null, createdAt: now, lastMove: null, passCount: 0, koInfo: null,
        winningLine: null, statsUpdated: false, summary: undefined,
        animation: undefined,
        blackTimeLeft: settings.timeLimit * 60, whiteTimeLeft: settings.timeLimit * 60,
        blackByoyomiPeriodsLeft: settings.byoyomiCount, whiteByoyomiPeriodsLeft: settings.byoyomiCount,
        disconnectionState: null, disconnectionCounts: { [challenger.id]: 0, [opponent.id]: 0 },
        currentActionButtons: { [challenger.id]: [], [opponent.id]: [] },
        actionButtonCooldownDeadline: {},
        actionButtonUsedThisCycle: { [challenger.id]: false, [opponent.id]: false },
        missileUsedThisTurn: false,
        maxActionButtonUses: 5, actionButtonUses: { [challenger.id]: 0, [opponent.id]: 0 },
        round: 1, turnInRound: 1, newlyRevealed: [], scores: { [challenger.id]: 0, [opponent.id]: 0 },
        analysisResult: undefined, isAnalyzing: false,
        gameStatus: GameStatus.Pending, blackPlayerId: null, whitePlayerId: null, currentPlayer: Player.None,
    } as unknown as LiveGameSession;

    if (settingsFromNeg.autoEndTurnCount && settingsFromNeg.autoEndTurnCount > 0) {
        game.autoEndTurnCount = settingsFromNeg.autoEndTurnCount;
    }

    if (neg.id.startsWith('neg-tc-')) {
        game.isTowerChallenge = true;
    }
    if (neg.id.startsWith('neg-sp-')) {
        game.isSinglePlayer = true;
    }
    
    if (isAiGame && mode !== GameMode.Capture && SPECIAL_GAME_MODES.some(m => m.mode === mode)) {
        if (!game.autoEndTurnCount) {
             switch (settings.boardSize) {
                case 7: game.autoEndTurnCount = 30; break;
                case 9: game.autoEndTurnCount = 40; break;
                case 11: game.autoEndTurnCount = 60; break;
                case 13: game.autoEndTurnCount = 80; break;
                case 19: game.autoEndTurnCount = 200; break;
            }
        }
    }

    const p1Guild = challenger.guildId ? guilds[challenger.guildId] : null;
    const p2Guild = opponent.id !== aiUserId && opponent.guildId ? guilds[opponent.id] : null;

    if (SPECIAL_GAME_MODES.some(m => m.mode === mode) || game.isSinglePlayer || game.isTowerChallenge) {
        initializeStrategicGame(game, neg, now);
    } else if (PLAYFUL_GAME_MODES.some(m => m.mode === mode)) {
        await initializePlayfulGame(game, neg, now, p1Guild, p2Guild);
    }
    
    if (game.gameStatus === GameStatus.Playing && game.currentPlayer === Player.None) {
        game.currentPlayer = Player.Black;
        if (settings.timeLimit > 0) game.turnDeadline = now + game.blackTimeLeft * 1000;
        game.turnStartTime = now;
    }
    
    if (game.isAiGame || game.isSinglePlayer || game.isTowerChallenge) {
        await gnuGoServiceManager.create(game.id, game.player2.playfulLevel, game.settings.boardSize, game.finalKomi ?? game.settings.komi);
        const instance = gnuGoServiceManager.get(game.id);
        if (instance) {
            const initialMoves: Move[] = [];
            for (let y = 0; y < game.settings.boardSize; y++) {
                for (let x = 0; x < game.settings.boardSize; x++) {
                    const player = game.boardState[y][x];
                    if (player !== Player.None) {
                        initialMoves.push({ player, x, y });
                    }
                }
            }
            if (initialMoves.length > 0) {
                // Create a temporary SGF string to set up the board state in GnuGo
                let sgfString = `(;GM[1]FF[4]CA[UTF-8]AP[SUDAM]RU[Japanese]SZ[${game.settings.boardSize}]KM[${game.finalKomi ?? game.settings.komi}]`;
                const blackStones = initialMoves.filter(m => m.player === Player.Black).map(m => `[${String.fromCharCode(97 + m.x)}${String.fromCharCode(97 + m.y)}]`).join('');
                const whiteStones = initialMoves.filter(m => m.player === Player.White).map(m => `[${String.fromCharCode(97 + m.x)}${String.fromCharCode(97 + m.y)}]`).join('');
                if (blackStones) sgfString += `AB${blackStones}`;
                if (whiteStones) sgfString += `AW${whiteStones}`;
                if (game.currentPlayer === Player.Black || game.currentPlayer === Player.White) {
                    sgfString += `PL[${game.currentPlayer === Player.Black ? 'B' : 'W'}]`;
                }
                sgfString += ')';

                const tempFilePath = path.join(os.tmpdir(), `sudam-initial-${game.id}.sgf`);
                try {
                    fs.writeFileSync(tempFilePath, sgfString);
                    await instance.sendCommand(`loadsgf ${tempFilePath}`);
                    console.log(`[GnuGoManager] Loaded initial board state via SGF for game ${game.id}`);
                } catch (e) {
                    console.error(`[GnuGoManager] Failed to load initial state via SGF for game ${game.id}`, e);
                } finally {
                    if (fs.existsSync(tempFilePath)) {
                        fs.unlinkSync(tempFilePath);
                    }
                }
            }
        }
    }
    
    return game;
};

export const resetGameForRematch = (game: LiveGameSession, negotiation: Negotiation): LiveGameSession => {
    const newGame = { ...game, id: `game-${globalThis.crypto.randomUUID()}` };

    newGame.mode = negotiation.mode;
    newGame.settings = negotiation.settings;
    
    const now = Date.now();
    const baseFields = {
        winner: null, winReason: null, statsUpdated: false, summary: undefined, finalScores: undefined,
        winningLine: null,
        boardState: Array(newGame.settings.boardSize).fill(0).map(() => Array(newGame.settings.boardSize).fill(Player.None)),
        moveHistory: [], captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 }, 
        baseStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 }, 
        hiddenStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 }, 
        lastMove: null, passCount: 0, koInfo: null,
        blackTimeLeft: newGame.settings.timeLimit * 60, whiteTimeLeft: newGame.settings.timeLimit * 60,
        blackByoyomiPeriodsLeft: newGame.settings.byoyomiCount, whiteByoyomiPeriodsLeft: newGame.settings.byoyomiCount,
        currentActionButtons: { [game.player1.id]: [], [game.player2.id]: [] },
        actionButtonCooldownDeadline: {},
        actionButtonUsedThisCycle: { [game.player1.id]: false, [game.player2.id]: false },
        missileUsedThisTurn: false,
        actionButtonUses: { [game.player1.id]: 0, [game.player2.id]: 0 },
        isAnalyzing: false, analysisResult: undefined, round: 1, turnInRound: 1,
        scores: { [game.player1.id]: 0, [game.player2.id]: 0 },
        rematchRejectionCount: undefined,
    };

    Object.assign(newGame, baseFields);
    
    // NOTE: Guild information isn't readily available here for a rematch.
    // This is a potential limitation if guild effects are expected to be recalculated.
    // For now, assuming stats don't change between matches is acceptable.
    if (SPECIAL_GAME_MODES.some(m => m.mode === newGame.mode)) {
        initializeStrategicGame(newGame, negotiation, now);
    } else if (PLAYFUL_GAME_MODES.some(m => m.mode === newGame.mode)) {
        initializePlayfulGame(newGame, negotiation, now, null, null);
    }
    
    return newGame;
};

export const updateGameStates = async (games: LiveGameSession[], now: number, guilds: Record<string, Guild>): Promise<LiveGameSession[]> => {
    const updatedGames: LiveGameSession[] = [];
    for (const game of games) {
        if (game.disconnectionState && (now - game.disconnectionState.timerStartedAt > 90000)) {
            game.winner = game.blackPlayerId === game.disconnectionState.disconnectedPlayerId ? Player.White : Player.Black;
            game.winReason = WinReason.Disconnect;
            game.disconnectionState = null;
        }

        if (game.lastTimeoutPlayerIdClearTime && now >= game.lastTimeoutPlayerIdClearTime) {
            game.lastTimeoutPlayerId = undefined;
            game.lastTimeoutPlayerIdClearTime = undefined;
        }

        if (!game.player1 || !game.player2) {
            console.warn(`[Game Loop] Skipping corrupted game ${game.id} with missing player data.`);
            continue;
        }
        
        // Use the stable player objects already in the game session.
        // DO NOT refetch from DB here to prevent infinite refreshes from non-game-related data changes (e.g., action points).
        const players = [game.player1, game.player2];
        
        // --- Action Buttons Generation ---
        const playableStatuses: GameStatus[] = [
            GameStatus.Playing,
            GameStatus.AlkkagiPlaying,
            GameStatus.CurlingPlaying,
            GameStatus.DiceRolling,
            GameStatus.DicePlacing,
            GameStatus.ThiefRolling,
            GameStatus.ThiefPlacing,
        ];
        
        if (!game.isAiGame && playableStatuses.includes(game.gameStatus)) {
            for (const player of players) {
                const deadline = game.actionButtonCooldownDeadline?.[player.id];
                if (typeof deadline !== 'number' || now >= deadline) {
                    game.currentActionButtons[player.id] = getNewActionButtons(game);
                    
                    const playerGuild = player.guildId ? guilds[player.id] : null;
                    const effects = effectService.calculateUserEffects(player, playerGuild);
                    const cooldown = (5 * 60 - (effects.mythicStatBonuses[MythicStat.MannerActionCooldown]?.flat || 0)) * 1000;

                    if (!game.actionButtonCooldownDeadline) game.actionButtonCooldownDeadline = {};
                    game.actionButtonCooldownDeadline[player.id] = now + cooldown;
                    if (game.actionButtonUsedThisCycle) {
                        game.actionButtonUsedThisCycle[player.id] = false;
                    }
                }
            }
        }
        
        if (
            (game.isAiGame || game.isSinglePlayer || game.isTowerChallenge) &&
            game.autoEndTurnCount &&
            game.moveHistory.length >= game.autoEndTurnCount &&
            game.gameStatus === GameStatus.Playing
        ) {
            console.log(`[Game Loop] Game ${game.id} reached turn limit (${game.moveHistory.length}/${game.autoEndTurnCount}). Triggering scoring.`);
            await getGameResult(game);
        }
        
        const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === game.mode) || game.isSinglePlayer || game.isTowerChallenge;
        const isPlayful = PLAYFUL_GAME_MODES.some(m => m.mode === game.mode);

        if (isStrategic) {
            await updateStrategicGameState(game, now);
        } else if (isPlayful) {
            await updatePlayfulGameState(game, now);
        }

        updatedGames.push(game);
    }
    return updatedGames;
};
