import { NO_CONTEST_MOVE_THRESHOLD, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, STRATEGIC_ACTION_BUTTONS_EARLY, STRATEGIC_ACTION_BUTTONS_MID, STRATEGIC_ACTION_BUTTONS_LATE, PLAYFUL_ACTION_BUTTONS_EARLY, PLAYFUL_ACTION_BUTTONS_MID, PLAYFUL_ACTION_BUTTONS_LATE, RANDOM_DESCRIPTIONS, ALKKAGI_TURN_TIME_LIMIT, ALKKAGI_PLACEMENT_TIME_LIMIT, TIME_BONUS_SECONDS_PER_POINT, DEFAULT_GAME_SETTINGS } from '../constants/index.js';
import { TOWER_STAGES } from '../constants/towerChallengeConstants.js';
import { SINGLE_PLAYER_STAGES } from '../constants/singlePlayerConstants.js';
import { type LiveGameSession, type Negotiation, type ActionButton, GameMode, Player, type GameSettings, GameStatus, MythicStat, WinReason, Guild, Move } from '../types/index.js';
import { aiUserId, makeAiMove, getAiUser } from './ai/index.js';
import { initializeStrategicGame, updateStrategicGameState, isFischerGame } from './modes/strategic.js';
import { initializePlayfulGame, updatePlayfulGameState } from './modes/playful.js';
import * as db from './db.js';
import * as effectService from '../utils/statUtils.js';
import { endGame, getGameResult } from './summaryService.js';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { gnuGoServiceManager } from './services/gnuGoService.js';
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
        await initializeStrategicGame(game, neg, now);
    } else if (PLAYFUL_GAME_MODES.some(m => m.mode === mode)) {
        await initializePlayfulGame(game, neg, now, p1Guild, p2Guild);
    }
    
    if (game.gameStatus === GameStatus.Playing && game.currentPlayer === Player.None) {
        game.currentPlayer = Player.Black;
        if (settings.timeLimit > 0) game.turnDeadline = now + game.blackTimeLeft * 1000;
        game.turnStartTime = now;
    }
    
    return game;
};

export const updateGameStates = async (games: LiveGameSession[], now: number, volatileState: any, guilds: Record<string, Guild>): Promise<LiveGameSession[]> => {
    const updatedGames: LiveGameSession[] = [];
    for (const game of games) {
        if (!game.player1 || !game.player2) {
            console.warn(`[Game Loop] Skipping corrupted game ${game.id} with missing player data.`);
            continue;
        }

        // --- Global Disconnection Logic ---
        const p1Online = volatileState.userConnections[game.player1.id];
        const p2Online = volatileState.userConnections[game.player2.id];
        let disconnectedId: string | null = null;

        if (!p1Online && !game.isAiGame && !game.isSinglePlayer && !game.isTowerChallenge) disconnectedId = game.player1.id;
        else if (!p2Online && !game.isAiGame && !game.isSinglePlayer && !game.isTowerChallenge) disconnectedId = game.player2.id;
        
        if (disconnectedId) {
            if (!game.disconnectionState || game.disconnectionState.disconnectedPlayerId !== disconnectedId) {
                // A new disconnection event just occurred.
                game.disconnectionState = { disconnectedPlayerId: disconnectedId, timerStartedAt: now };
                
                // PAUSE THE GAME TIMER on disconnect
                if (game.turnDeadline) {
                    game.pausedTurnTimeLeft = Math.max(0, (game.turnDeadline - now) / 1000);
                    game.turnDeadline = undefined;
                    game.turnStartTime = undefined;
                }

                game.disconnectionCounts[disconnectedId] = (game.disconnectionCounts[disconnectedId] || 0) + 1;
                if (game.disconnectionCounts[disconnectedId] >= 3) {
                    const winner = disconnectedId === game.blackPlayerId ? Player.White : Player.Black;
                    await endGame(game, winner, WinReason.Disconnect);
                    updatedGames.push(game);
                    continue;
                }
            }
        } else if (game.disconnectionState) {
            // Player reconnected.
            
            // RESUME THE GAME TIMER on reconnect
            if (game.pausedTurnTimeLeft !== undefined && game.pausedTurnTimeLeft !== null) {
                const isFischer = isFischerGame(game);
                const playerTimeLeft = game.currentPlayer === Player.Black ? game.blackTimeLeft : game.whiteTimeLeft;
                const isInByoyomi = !isFischer && playerTimeLeft <= 0;
                
                if (isInByoyomi) {
                    // If they were in byoyomi, reset the byoyomi timer to full duration to be fair
                    game.turnDeadline = now + (game.settings.byoyomiTime * 1000);
                } else {
                    // If they were in main time, restore their remaining time
                    game.turnDeadline = now + game.pausedTurnTimeLeft * 1000;
                }
                game.turnStartTime = now;
                game.pausedTurnTimeLeft = undefined;
            }
            
            game.disconnectionState = null;
        }

        if (game.disconnectionState && (now - game.disconnectionState.timerStartedAt > 180000)) {
            const winner = game.blackPlayerId === game.disconnectionState.disconnectedPlayerId ? Player.White : Player.Black;
            await endGame(game, winner, WinReason.Disconnect);
            updatedGames.push(game);
            continue;
        }
        
        if (game.lastTimeoutPlayerIdClearTime && now >= game.lastTimeoutPlayerIdClearTime) {
            game.lastTimeoutPlayerId = undefined;
            game.lastTimeoutPlayerIdClearTime = undefined;
        }
        
        // Use the stable player objects already in the game session.
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
            await updateStrategicGameState(game, now, volatileState);
        } else if (isPlayful) {
            await updatePlayfulGameState(game, now);
        }

        updatedGames.push(game);
    }
    return updatedGames;
};