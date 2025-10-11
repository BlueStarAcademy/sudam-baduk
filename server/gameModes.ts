import { NO_CONTEST_MOVE_THRESHOLD, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, STRATEGIC_ACTION_BUTTONS_EARLY, STRATEGIC_ACTION_BUTTONS_MID, STRATEGIC_ACTION_BUTTONS_LATE, PLAYFUL_ACTION_BUTTONS_EARLY, PLAYFUL_ACTION_BUTTONS_MID, PLAYFUL_ACTION_BUTTONS_LATE, RANDOM_DESCRIPTIONS, ALKKAGI_TURN_TIME_LIMIT, ALKKAGI_PLACEMENT_TIME_LIMIT, TIME_BONUS_SECONDS_PER_POINT, DEFAULT_GAME_SETTINGS } from '../constants/index.js';
import { TOWER_STAGES } from '../constants/towerChallengeConstants.js';
import { SINGLE_PLAYER_STAGES } from '../constants/singlePlayerConstants.js';
import { type LiveGameSession, type Negotiation, type ActionButton, GameMode, Player, type GameSettings, GameStatus, MythicStat, WinReason, Guild, Move, type AnalysisResult, type UserStatusInfo } from '../types/index.js';
import { aiUserId, makeAiMove, getAiUser } from './ai/index.js';
import * as strategic from './modes/strategic.js';
import { initializePlayfulGame, updatePlayfulGameState } from './modes/playful.js';
import * as db from './db.js';
import * as effectService from '../utils/statUtils.js';
import * as summaryService from './summaryService.js';
import { getNewActionButtons } from './services/actionButtonService.js';


export const initializeGame = async (neg: Negotiation, guilds: Record<string, Guild>): Promise<LiveGameSession> => {
    const gameId = `game-${globalThis.crypto.randomUUID()}`;
    const { settings: settingsFromNeg, mode } = neg;
    const now = Date.now();
    
    const settings: GameSettings = { ...DEFAULT_GAME_SETTINGS, ...settingsFromNeg };

    if (settings.timeControl) {
        settings.timeLimit = settings.timeControl.mainTime;
        if (settings.timeControl.type === 'byoyomi') {
            settings.byoyomiCount = settings.timeControl.byoyomiCount ?? 3;
            settings.byoyomiTime = settings.timeControl.byoyomiTime ?? 30;
            settings.timeIncrement = 0; // Ensure no increment for byoyomi
        } else if (settings.timeControl.type === 'fischer') {
            settings.timeIncrement = settings.timeControl.increment ?? 5;
            settings.byoyomiCount = 0;
            settings.byoyomiTime = 0;
        }
    }
    
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
        await strategic.initializeStrategicGame(game, neg, now);
    } else if (PLAYFUL_GAME_MODES.some(m => m.mode === mode)) {
        await initializePlayfulGame(game, neg, now, p1Guild, p2Guild);
    }
    
    if (game.gameStatus === GameStatus.Playing && game.currentPlayer === Player.None) {
        game.currentPlayer = Player.Black;
        if (settings.timeLimit > 0 || settings.timeControl) {
            game.turnDeadline = now + (settings.timeControl?.mainTime ?? settings.timeLimit) * 60 * 1000;
            game.turnStartTime = now;
        }
    }
    
    return game;
};

export const updateGameStates = async (games: LiveGameSession[], now: number, guilds: Record<string, Guild>): Promise<LiveGameSession[]> => {
    const updatedGames: LiveGameSession[] = [];
    const userStatuses = await db.getKV<Record<string, UserStatusInfo>>('userStatuses') || {};

    for (const game of games) {
        if (!game.player1 || !game.player2) {
            console.warn(`[Game Loop] Skipping corrupted game ${game.id} with missing player data.`);
            continue;
        }

        const p1Online = userStatuses[game.player1.id];
        const p2Online = userStatuses[game.player2.id];
        let disconnectedId: string | null = null;

        if (!p1Online && !game.isAiGame && !game.isSinglePlayer && !game.isTowerChallenge) disconnectedId = game.player1.id;
        else if (!p2Online && !game.isAiGame && !game.isSinglePlayer && !game.isTowerChallenge) disconnectedId = game.player2.id;
        
        if (disconnectedId) {
            if (!game.disconnectionState || game.disconnectionState.disconnectedPlayerId !== disconnectedId) {
                game.disconnectionState = { disconnectedPlayerId: disconnectedId, timerStartedAt: now };
                
                if (game.turnDeadline) {
                    game.pausedTurnTimeLeft = Math.max(0, (game.turnDeadline - now) / 1000);
                    game.turnDeadline = undefined;
                    game.turnStartTime = undefined;
                }

                game.disconnectionCounts[disconnectedId] = (game.disconnectionCounts[disconnectedId] || 0) + 1;
                if (game.disconnectionCounts[disconnectedId] >= 3) {
                    const winner = disconnectedId === game.blackPlayerId ? Player.White : Player.Black;
                    await summaryService.endGame(game, winner, WinReason.Disconnect);
                    updatedGames.push(game);
                    continue;
                }
            }
        } else if (game.disconnectionState) {
            if (game.pausedTurnTimeLeft !== undefined && game.pausedTurnTimeLeft !== null) {
                const isFischer = strategic.isFischerGame(game);
                const playerTimeLeft = game.currentPlayer === Player.Black ? game.blackTimeLeft : game.whiteTimeLeft;
                const isInByoyomi = !isFischer && playerTimeLeft <= 0;
                
                if (isInByoyomi) {
                    game.turnDeadline = now + (game.settings.byoyomiTime * 1000);
                } else {
                    game.turnDeadline = now + game.pausedTurnTimeLeft * 1000;
                }
                game.turnStartTime = now;
                game.pausedTurnTimeLeft = undefined;
            }
            
            game.disconnectionState = null;
        }

        if (game.disconnectionState && (now - game.disconnectionState.timerStartedAt > 180000)) {
            const winner = game.blackPlayerId === game.disconnectionState.disconnectedPlayerId ? Player.White : Player.Black;
            await summaryService.endGame(game, winner, WinReason.Disconnect);
            updatedGames.push(game);
            continue;
        }
        
        if (game.lastTimeoutPlayerIdClearTime && now >= game.lastTimeoutPlayerIdClearTime) {
            game.lastTimeoutPlayerId = undefined;
            game.lastTimeoutPlayerIdClearTime = undefined;
        }
        
        const players = [game.player1, game.player2];
        
        if (!game.isAiGame && (game.gameStatus === GameStatus.Playing || PLAYFUL_GAME_MODES.some(m => m.mode === game.mode))) {
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
            await summaryService.getGameResult(game);
        }
        
        const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === game.mode) || game.isSinglePlayer || game.isTowerChallenge;
        const isPlayful = PLAYFUL_GAME_MODES.some(m => m.mode === game.mode);

        if (isStrategic) {
            await strategic.updateStrategicGameState(game, now);
        } else if (isPlayful) {
            await updatePlayfulGameState(game, now);
        }

        updatedGames.push(game);
    }
    return updatedGames;
};
