// FIX: Add reference to node types to resolve 'process.exit' error.
/// <reference types="node" />

import pg from 'pg';
import path from 'path';
// FIX: Corrected import path for types.
import { Player } from '../../types/index';

const { Pool } = pg;

let poolInstance: pg.Pool | null = null;

const migrations: { [version: number]: string } = {
    2: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "inventorySlots" INTEGER;',
    3: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "actionPoints" TEXT; ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastActionPointUpdate" BIGINT;',
    4: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "mannerScore" INTEGER;',
    5: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS mail TEXT;',
    6: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS quests TEXT;',
    7: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "chatBanUntil" BIGINT;',
    8: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "avatarId" TEXT; ALTER TABLE users ADD COLUMN IF NOT EXISTS "borderId" TEXT;',
    9: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "previousSeasonTier" TEXT;',
    10: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "seasonHistory" TEXT;',
    11: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "baseStats" TEXT; ALTER TABLE users ADD COLUMN IF NOT EXISTS "spentStatPoints" TEXT;',
    12: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "actionPointPurchasesToday" INTEGER; ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastActionPointPurchaseDate" BIGINT;',
    13: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "dailyShopPurchases" TEXT;',
    14: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "tournamentScore" INTEGER; ALTER TABLE users ADD COLUMN IF NOT EXISTS league TEXT; ALTER TABLE users ADD COLUMN IF NOT EXISTS "mannerMasteryApplied" BOOLEAN; ALTER TABLE users ADD COLUMN IF NOT EXISTS "pendingPenaltyNotification" TEXT;',
    15: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastNeighborhoodPlayedDate" BIGINT; ALTER TABLE users ADD COLUMN IF NOT EXISTS "neighborhoodRewardClaimed" BOOLEAN; ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastNeighborhoodTournament" TEXT;',
    16: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastNationalPlayedDate" BIGINT; ALTER TABLE users ADD COLUMN IF NOT EXISTS "nationalRewardClaimed" BOOLEAN; ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastNationalTournament" TEXT;',
    17: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastWorldPlayedDate" BIGINT; ALTER TABLE users ADD COLUMN IF NOT EXISTS "worldRewardClaimed" BOOLEAN; ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastWorldTournament" TEXT;',
    18: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "weeklyCompetitors" TEXT; ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastWeeklyCompetitorsUpdate" BIGINT; ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastLeagueUpdate" BIGINT;',
    19: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "ownedBorders" TEXT;',
    20: 'ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "mythicBonuses" TEXT; ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "lastPlayfulGoldCheck" TEXT; ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "pendingSystemMessages" TEXT;',
    21: 'ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "thiefCapturesThisRound" INTEGER;',
    22: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "connectionBanUntil" BIGINT;',
    23: `
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "alkkagiStones" TEXT;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "alkkagiStones_p1" TEXT;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "alkkagiStones_p2" TEXT;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "alkkagiTurnDeadline" REAL;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "alkkagiPlacementDeadline" REAL;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "alkkagiItemUses" TEXT;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "activeAlkkagiItems" TEXT;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "alkkagiRound" INTEGER;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "alkkagiRefillsUsed" TEXT;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "alkkagiStonesPlacedThisRound" TEXT;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "alkkagiRoundSummary" TEXT;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "curlingStones" TEXT;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "curlingTurnDeadline" REAL;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "curlingScores" TEXT;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "curlingRound" INTEGER;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "curlingRoundSummary" TEXT;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "curlingItemUses" TEXT;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "activeCurlingItems" TEXT;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "hammerPlayerId" TEXT;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "isTiebreaker" BOOLEAN;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "tiebreakerStonesThrown" INTEGER;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "stonesThrownThisRound" TEXT;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "preGameConfirmations" TEXT;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "roundEndConfirmations" TEXT;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "rematchRejectionCount" TEXT;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "timeoutFouls" TEXT;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "curlingStonesLostToFoul" TEXT;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "foulInfo" TEXT;
    `,
    24: 'ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "mannerScoreChanges" TEXT;',
    25: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS mbti TEXT; ALTER TABLE users ADD COLUMN IF NOT EXISTS "isMbtiPublic" BOOLEAN;',
    26: 'ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "revealedHiddenMoves" TEXT;',
    27: 'ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "lastTurnStones" TEXT; ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "stonesPlacedThisTurn" TEXT;',
    28: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "singlePlayerProgress" INTEGER;',
    29: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "bonusStatPoints" INTEGER;',
    30: `
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "isSinglePlayer" BOOLEAN;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "stageId" TEXT;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "blackPatternStones" TEXT;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "whitePatternStones" TEXT;
        ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "singlePlayerPlacementRefreshesUsed" INTEGER;
    `,
    31: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "singlePlayerMissions" TEXT;',
    32: 'ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "blackStonesPlaced" INTEGER; ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "blackStoneLimit" INTEGER;',
    33: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "towerProgress" TEXT;',
    34: 'ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "isTowerChallenge" BOOLEAN; ALTER TABLE live_games ADD COLUMN IF NOT EXISTS floor INTEGER;',
    35: 'ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "gameType" TEXT; ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "whiteStonesPlaced" INTEGER; ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "whiteStoneLimit" INTEGER;',
    36: 'ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "autoEndTurnCount" INTEGER;',
    37: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "claimedFirstClearRewards" TEXT;',
    38: 'ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "towerChallengePlacementRefreshesUsed" INTEGER;',
    39: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "actionPointQuizzesToday" INTEGER; ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastActionPointQuizDate" BIGINT;',
    40: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "currencyLogs" TEXT;',
    41: 'ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "towerAddStonesUsed" INTEGER;',
    42: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "guildId" TEXT;',
    43: 'ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "turnOrderRollTies" INTEGER;',
    44: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "guildApplications" TEXT; ALTER TABLE users ADD COLUMN IF NOT EXISTS "guildLeaveCooldownUntil" BIGINT;',
    45: 'ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "pendingAiMove" TEXT;',
    46: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "guildCoins" INTEGER; ALTER TABLE users ADD COLUMN IF NOT EXISTS "guildBossAttempts" INTEGER; ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastGuildBossAttemptDate" BIGINT;',
    47: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastLoginAt" BIGINT;',
    48: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "dailyDonations" TEXT;',
    49: 'ALTER TABLE live_games ADD COLUMN IF NOT EXISTS animation TEXT;',
    50: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "guildShopPurchases" TEXT; ALTER TABLE users ADD COLUMN IF NOT EXISTS "monthlyGoldBuffExpiresAt" BIGINT;',
    51: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "dailyMissionContribution" TEXT;',
    52: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "equipmentPresets" TEXT;',
    53: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "appSettings" TEXT;',
    54: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "dailyChampionshipMatchesPlayed" INTEGER; ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastChampionshipMatchDate" BIGINT;',
    55: 'ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "towerItemPurchases" TEXT;',
    56: 'ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "pausedTurnTimeLeft" REAL;',
    57: 'ALTER TABLE live_games ADD COLUMN IF NOT EXISTS "promptForMoreStones" BOOLEAN;',
};


export const runSchemaAndMigrations = async (pool: pg.Pool) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Initial Schema
        await client.query(`
            CREATE TABLE IF NOT EXISTS kv (
                key TEXT PRIMARY KEY,
                value TEXT
            );

            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE,
                nickname TEXT UNIQUE,
                "isAdmin" BOOLEAN,
                "strategyLevel" INTEGER,
                "strategyXp" INTEGER,
                "playfulLevel" INTEGER,
                "playfulXp" INTEGER,
                gold INTEGER,
                diamonds INTEGER,
                inventory TEXT,
                equipment TEXT,
                stats TEXT
            );

            CREATE TABLE IF NOT EXISTS user_credentials (
                username TEXT PRIMARY KEY,
                "passwordHash" TEXT,
                "userId" TEXT
            );

            CREATE TABLE IF NOT EXISTS live_games (
                id TEXT PRIMARY KEY,
                mode TEXT,
                description TEXT,
                player1 TEXT,
                player2 TEXT,
                "blackPlayerId" TEXT,
                "whitePlayerId" TEXT,
                "gameStatus" TEXT,
                "currentPlayer" INTEGER,
                "boardState" TEXT,
                "moveHistory" TEXT,
                captures TEXT,
                "baseStoneCaptures" TEXT,
                "hiddenStoneCaptures" TEXT,
                winner INTEGER,
                "winReason" TEXT,
                "finalScores" TEXT,
                "createdAt" BIGINT,
                "lastMove" TEXT,
                "passCount" INTEGER,
                "koInfo" TEXT,
                "winningLine" TEXT,
                "statsUpdated" BOOLEAN,
                summary TEXT,
                "blackTimeLeft" REAL,
                "whiteTimeLeft" REAL,
                "blackByoyomiPeriodsLeft" INTEGER,
                "whiteByoyomiPeriodsLeft" INTEGER,
                "turnDeadline" REAL,
                "turnStartTime" REAL,
                "disconnectionState" TEXT,
                "disconnectionCounts" TEXT,
                "noContestInitiatorIds" TEXT,
                "currentActionButtons" TEXT,
                "actionButtonCooldownDeadline" TEXT,
                "actionButtonUses" TEXT,
                "maxActionButtonUses" INTEGER,
                "actionButtonUsedThisCycle" TEXT,
                nigiri TEXT,
                "guessDeadline" REAL,
                bids TEXT,
                "biddingRound" INTEGER,
                "captureBidDeadline" REAL,
                "effectiveCaptureTargets" TEXT,
                "baseStones" TEXT,
                "baseStones_p1" TEXT,
                "baseStones_p2" TEXT,
                "basePlacementDeadline" REAL,
                "komiBids" TEXT,
                "komiBiddingDeadline" REAL,
                "komiBiddingRound" INTEGER,
                "komiBidRevealProcessed" BOOLEAN,
                "finalKomi" REAL,
                "hiddenMoves" TEXT,
                scans_p1 INTEGER,
                scans_p2 INTEGER,
                "revealedStones" TEXT,
                "newlyRevealed" TEXT,
                "justCaptured" TEXT,
                "hidden_stones_used_p1" INTEGER,
                "hidden_stones_used_p2" INTEGER,
                "pendingCapture" TEXT,
                "permanentlyRevealedStones" TEXT,
                missiles_p1 INTEGER,
                missiles_p2 INTEGER,
                "missileUsedThisTurn" BOOLEAN,
                "rpsState" TEXT,
                "rpsRound" INTEGER,
                dice TEXT,
                "stonesToPlace" INTEGER,
                "turnOrderRolls" TEXT,
                "turnOrderRollReady" TEXT,
                "turnOrderRollResult" TEXT,
                "turnOrderRollDeadline" REAL,
                "turnOrderAnimationEndTime" REAL,
                "turnChoiceDeadline" REAL,
                "turnChooserId" TEXT,
                "turnChoices" TEXT,
                "turnSelectionTiebreaker" TEXT,
                "diceRollHistory" TEXT,
                "diceRoundSummary" TEXT,
                "lastWhiteGroupInfo" TEXT,
                "diceGoItemUses" TEXT,
                "diceGoBonuses" TEXT,
                "diceCapturesThisTurn" INTEGER,
                "diceLastCaptureStones" TEXT,
                round INTEGER,
                "isDeathmatch" BOOLEAN,
                "turnInRound" INTEGER,
                scores TEXT,
                "thiefPlayerId" TEXT,
                "policePlayerId" TEXT,
                "roleChoices" TEXT,
                "roleChoiceWinnerId" TEXT,
                "thiefRoundSummary" TEXT,
                "thiefDiceRollHistory" TEXT,
                "isAnalyzing" BOOLEAN,
                "analysisResult" TEXT,
                "previousAnalysisResult" TEXT,
                settings TEXT,
                "canRequestNoContest" TEXT,
                "itemUseDeadline" REAL,
                "lastTimeoutPlayerId" TEXT,
                "lastTimeoutPlayerIdClearTime" REAL,
                "revealAnimationEndTime" REAL,
                "revealEndTime" REAL,
                "isAiGame" BOOLEAN,
                "aiTurnStartTime" REAL
            );

            CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER NOT NULL
            );
        `);

        // Migration Logic
        const versionRes = await client.query('SELECT version FROM schema_version');
        let version = 0;
        if (versionRes.rows.length > 0) {
            version = versionRes.rows[0].version;
        } else {
            await client.query('INSERT INTO schema_version (version) VALUES (1)');
            version = 1;
        }

        const maxVersion = Math.max(...Object.keys(migrations).map(Number));
        for (let v = version + 1; v <= maxVersion; v++) {
            if (migrations[v]) {
                console.log(`[DB] Running PostgreSQL migration version ${v}...`);
                const statements = migrations[v].split(';').filter(s => s.trim());
                for (const statement of statements) {
                    try {
                        // Add double quotes around any camelCase columns in ALTER statements
                        const fixedStatement = statement.replace(/ADD COLUMN IF NOT EXISTS (\w+)/, 'ADD COLUMN IF NOT EXISTS "$1"');
                        await client.query(fixedStatement);
                    } catch (e: any) {
                        console.error(`[DB] Migration ${v} failed on statement: "${statement}"`, e.message);
                        throw e; // Abort transaction
                    }
                }
                await client.query('UPDATE schema_version SET version = $1', [v]);
                console.log(`[DB] Migration ${v} complete.`);
            }
        }

        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Database initialization/migration failed:", e);
        throw e;
    } finally {
        client.release();
    }
}


export const initializeAndGetDb = async (): Promise<pg.Pool> => {
    if (poolInstance) return poolInstance;

    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL environment variable is not set. Please configure it to connect to your PostgreSQL database.");
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    pool.on('error', (err) => {
        console.error('Unexpected error on idle PostgreSQL client', err);
        process.exit(-1);
    });

    console.log('[DB] Connecting to PostgreSQL...');
    await runSchemaAndMigrations(pool);
    console.log('[DB] PostgreSQL connection and setup complete.');

    poolInstance = pool;
    return poolInstance;
};

export const getDb = async (): Promise<pg.Pool> => {
    return poolInstance ?? initializeAndGetDb();
};
