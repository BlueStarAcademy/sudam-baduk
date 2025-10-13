
import { Pool } from 'pg';
import dotenv from 'dotenv';
import process from 'process';

// Explicitly load .env file. tsx runner might not do this automatically.
dotenv.config();

let db: Pool | null = null;

export const getDb = async (): Promise<Pool> => {
    if (db) {
        return db;
    }
    return initializeAndGetDb();
};

export const initializeAndGetDb = async (): Promise<Pool> => {
    if (db) {
        return db;
    }

    const connectionString = process.env.DATABASE_URL;

    if (!connectionString || typeof connectionString !== 'string' || connectionString.trim() === '') {
        console.error(`[DB] DATABASE_URL environment variable is not valid. Found: "${connectionString}". Please check your .env file in the project root.`);
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: connectionString,
    });

    try {
        await pool.query('SELECT NOW()');
        console.log('[DB] PostgreSQL connected successfully.');
    } catch (err) {
        console.error('[DB] Failed to connect to PostgreSQL:', err);
        process.exit(1);
    }

    const runSchemaAndMigrations = async () => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const userTableSchema = `
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    nickname TEXT NOT NULL,
                    "isAdmin" BOOLEAN DEFAULT FALSE,
                    "strategyLevel" INTEGER DEFAULT 1,
                    "strategyXp" INTEGER DEFAULT 0,
                    "playfulLevel" INTEGER DEFAULT 1,
                    "playfulXp" INTEGER DEFAULT 0,
                    "baseStats" JSONB,
                    "spentStatPoints" JSONB,
                    inventory JSONB,
                    "inventorySlots" JSONB,
                    "synthesisLevel" INTEGER DEFAULT 1,
                    "synthesisXp" INTEGER DEFAULT 0,
                    equipment JSONB,
                    "equipmentPresets" JSONB,
                    "actionPoints" JSONB,
                    "lastActionPointUpdate" BIGINT,
                    "actionPointPurchasesToday" INTEGER,
                    "lastActionPointPurchaseDate" BIGINT,
                    "actionPointQuizzesToday" INTEGER,
                    "lastActionPointQuizDate" BIGINT,
                    "dailyShopPurchases" JSONB,
                    gold INTEGER DEFAULT 0,
                    diamonds INTEGER DEFAULT 0,
                    "mannerScore" INTEGER DEFAULT 200,
                    "mannerMasteryApplied" BOOLEAN,
                    "pendingPenaltyNotification" JSONB,
                    mail JSONB,
                    quests JSONB,
                    stats JSONB,
                    "chatBanUntil" BIGINT,
                    "connectionBanUntil" BIGINT,
                    "avatarId" TEXT,
                    "borderId" TEXT,
                    "ownedBorders" JSONB,
                    "previousSeasonTier" TEXT,
                    "seasonHistory" JSONB,
                    "tournamentScore" INTEGER DEFAULT 0,
                    league TEXT,
                    "weeklyCompetitors" JSONB,
                    "lastWeeklyCompetitorsUpdate" BIGINT,
                    "lastLeagueUpdate" BIGINT,
                    "monthlyGoldBuffExpiresAt" BIGINT,
                    mbti TEXT,
                    "isMbtiPublic" BOOLEAN,
                    "singlePlayerProgress" INTEGER DEFAULT 0,
                    "bonusStatPoints" INTEGER DEFAULT 0,
                    "singlePlayerMissions" JSONB,
                    "towerProgress" JSONB,
                    "claimedFirstClearRewards" JSONB,
                    "currencyLogs" JSONB,
                    "guildId" TEXT,
                    "guildApplications" JSONB,
                    "guildLeaveCooldownUntil" BIGINT,
                    "guildCoins" INTEGER DEFAULT 0,
                    "guildBossAttempts" INTEGER DEFAULT 0,
                    "lastGuildBossAttemptDate" BIGINT,
                    "lastLoginAt" BIGINT,
                    "dailyDonations" JSONB,
                    "dailyMissionContribution" JSONB,
                    "guildShopPurchases" JSONB,
                    "appSettings" JSONB,
                    "kakaoId" TEXT,
                    "lastNeighborhoodPlayedDate" BIGINT,
                    "neighborhoodRewardClaimed" BOOLEAN,
                    "lastNeighborhoodTournament" JSONB,
                    "lastNationalPlayedDate" BIGINT,
                    "nationalRewardClaimed" BOOLEAN,
                    "lastNationalTournament" JSONB,
                    "lastWorldPlayedDate" BIGINT,
                    "worldRewardClaimed" BOOLEAN,
                    "lastWorldTournament" JSONB,
                    "dailyChampionshipMatchesPlayed" INTEGER,
                    "lastChampionshipMatchDate" BIGINT,
                    "lastSinglePlayerStageId" TEXT
                );
            `;

            const liveGamesTableSchema = `
                CREATE TABLE IF NOT EXISTS live_games (
                    id TEXT PRIMARY KEY,
                    mode TEXT,
                    description TEXT,
                    player1 JSONB,
                    player2 JSONB,
                    "blackPlayerId" TEXT,
                    "whitePlayerId" TEXT,
                    "gameStatus" TEXT,
                    "currentPlayer" INTEGER,
                    "boardState" JSONB,
                    "moveHistory" JSONB,
                    captures JSONB,
                    "baseStoneCaptures" JSONB,
                    "hiddenStoneCaptures" JSONB,
                    winner INTEGER,
                    "winReason" TEXT,
                    "finalScores" JSONB,
                    "createdAt" BIGINT,
                    "lastMove" JSONB,
                    "lastTurnStones" JSONB,
                    "stonesPlacedThisTurn" JSONB,
                    "passCount" INTEGER,
                    "koInfo" JSONB,
                    "winningLine" JSONB,
                    "statsUpdated" BOOLEAN,
                    summary JSONB,
                    animation JSONB,
                    "blackTimeLeft" REAL,
                    "whiteTimeLeft" REAL,
                    "blackByoyomiPeriodsLeft" INTEGER,
                    "whiteByoyomiPeriodsLeft" INTEGER,
                    "turnDeadline" BIGINT,
                    "turnStartTime" BIGINT,
                    "disconnectionState" JSONB,
                    "disconnectionCounts" JSONB,
                    "noContestInitiatorIds" JSONB,
                    "currentActionButtons" JSONB,
                    "actionButtonCooldownDeadline" JSONB,
                    "actionButtonUses" JSONB,
                    "maxActionButtonUses" INTEGER,
                    "actionButtonUsedThisCycle" JSONB,
                    "mannerScoreChanges" JSONB,
                    nigiri JSONB,
                    "guessDeadline" BIGINT,
                    bids JSONB,
                    "biddingRound" INTEGER,
                    "captureBidDeadline" BIGINT,
                    "effectiveCaptureTargets" JSONB,
                    "baseStones" JSONB,
                    "baseStones_p1" JSONB,
                    "baseStones_p2" JSONB,
                    "basePlacementDeadline" BIGINT,
                    "komiBids" JSONB,
                    "komiBiddingDeadline" BIGINT,
                    "komiBiddingRound" INTEGER,
                    "komiBidRevealProcessed" BOOLEAN,
                    "finalKomi" REAL,
                    "hiddenMoves" JSONB,
                    "scans_p1" INTEGER,
                    "scans_p2" INTEGER,
                    "revealedStones" JSONB,
                    "revealedHiddenMoves" JSONB,
                    "newlyRevealed" JSONB,
                    "justCaptured" JSONB,
                    "hidden_stones_used_p1" INTEGER,
                    "hidden_stones_used_p2" INTEGER,
                    "pendingCapture" JSONB,
                    "permanentlyRevealedStones" JSONB,
                    "missileUsedThisTurn" BOOLEAN,
                    "missiles_p1" INTEGER,
                    "missiles_p2" INTEGER,
                    "rpsState" JSONB,
                    "rpsRound" INTEGER,
                    dice JSONB,
                    "stonesToPlace" INTEGER,
                    "turnOrderRolls" JSONB,
                    "turnOrderRollReady" JSONB,
                    "turnOrderRollResult" TEXT,
                    "turnOrderRollTies" INTEGER,
                    "turnOrderRollDeadline" BIGINT,
                    "turnOrderAnimationEndTime" BIGINT,
                    "turnChoiceDeadline" BIGINT,
                    "turnChooserId" TEXT,
                    "turnChoices" JSONB,
                    "turnSelectionTiebreaker" TEXT,
                    "diceRollHistory" JSONB,
                    "diceRoundSummary" JSONB,
                    "lastWhiteGroupInfo" JSONB,
                    "diceGoItemUses" JSONB,
                    "diceGoBonuses" JSONB,
                    "diceCapturesThisTurn" INTEGER,
                    "diceLastCaptureStones" JSONB,
                    round INTEGER,
                    "isDeathmatch" BOOLEAN,
                    "turnInRound" INTEGER,
                    scores JSONB,
                    "thiefPlayerId" TEXT,
                    "policePlayerId" TEXT,
                    "roleChoices" JSONB,
                    "roleChoiceWinnerId" TEXT,
                    "thiefRoundSummary" JSONB,
                    "thiefDiceRollHistory" JSONB,
                    "thiefCapturesThisRound" INTEGER,
                    "alkkagiStones" JSONB,
                    "alkkagiStones_p1" JSONB,
                    "alkkagiStones_p2" JSONB,
                    "alkkagiTurnDeadline" BIGINT,
                    "alkkagiPlacementDeadline" BIGINT,
                    "alkkagiItemUses" JSONB,
                    "activeAlkkagiItems" JSONB,
                    "alkkagiRound" INTEGER,
                    "alkkagiRefillsUsed" JSONB,
                    "alkkagiStonesPlacedThisRound" JSONB,
                    "alkkagiRoundSummary" JSONB,
                    "curlingStones" JSONB,
                    "curlingTurnDeadline" BIGINT,
                    "curlingScores" JSONB,
                    "curlingRound" INTEGER,
                    "curlingRoundSummary" JSONB,
                    "curlingItemUses" JSONB,
                    "activeCurlingItems" JSONB,
                    "hammerPlayerId" TEXT,
                    "isTiebreaker" BOOLEAN,
                    "tiebreakerStonesThrown" INTEGER,
                    "stonesThrownThisRound" JSONB,
                    "preGameConfirmations" JSONB,
                    "roundEndConfirmations" JSONB,
                    "rematchRejectionCount" JSONB,
                    "timeoutFouls" JSONB,
                    "curlingStonesLostToFoul" JSONB,
                    "foulInfo" JSONB,
                    "isAnalyzing" BOOLEAN,
                    "analysisResult" JSONB,
                    "previousAnalysisResult" JSONB,
                    settings JSONB,
                    "canRequestNoContest" JSONB,
                    "pausedTurnTimeLeft" REAL,
                    "itemUseDeadline" BIGINT,
                    "lastTimeoutPlayerId" TEXT,
                    "lastTimeoutPlayerIdClearTime" BIGINT,
                    "revealAnimationEndTime" BIGINT,
                    "revealEndTime" BIGINT,
                    "isAiGame" BOOLEAN,
                    "aiTurnStartTime" BIGINT,
                    "mythicBonuses" JSONB,
                    "lastPlayfulGoldCheck" JSONB,
                    "pendingSystemMessages" JSONB,
                    "isSinglePlayer" BOOLEAN,
                    "stageId" TEXT,
                    "blackPatternStones" JSONB,
                    "whitePatternStones" JSONB,
                    "singlePlayerPlacementRefreshesUsed" INTEGER,
                    "towerChallengePlacementRefreshesUsed" INTEGER,
                    "towerAddStonesUsed" INTEGER,
                    "towerItemPurchases" JSONB,
                    "blackStonesPlaced" INTEGER,
                    "blackStoneLimit" INTEGER,
                    "isTowerChallenge" BOOLEAN,
                    floor INTEGER,
                    "gameType" TEXT,
                    "whiteStonesPlaced" INTEGER,
                    "whiteStoneLimit" INTEGER,
                    "autoEndTurnCount" INTEGER,
                    "promptForMoreStones" BOOLEAN,
                    "aiHiddenStoneUsedThisGame" BOOLEAN
                );
            `;

            const userCredentialsTableSchema = `
                CREATE TABLE IF NOT EXISTS user_credentials (
                    username TEXT PRIMARY KEY,
                    hash TEXT,
                    salt TEXT,
                    "userId" TEXT UNIQUE NOT NULL
                );
            `;
            
            const kvTableSchema = `
                CREATE TABLE IF NOT EXISTS kv (
                    key TEXT PRIMARY KEY,
                    value JSONB
                );
            `;

            await client.query(userTableSchema);
            await client.query(liveGamesTableSchema);
            await client.query(userCredentialsTableSchema);
            await client.query(kvTableSchema);

            // --- MIGRATION LOGIC ---
            const checkColumnQuery = `
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'live_games' AND column_name = 'aiHiddenStoneUsedThisGame'
            `;
            const colRes = await client.query(checkColumnQuery);
            if (colRes.rowCount === 0) {
                console.log('[DB Migration] Adding column "aiHiddenStoneUsedThisGame" to live_games table.');
                await client.query('ALTER TABLE live_games ADD COLUMN "aiHiddenStoneUsedThisGame" BOOLEAN');
            }

            // Migration for kv.value column type
            const checkKvColumnQuery = `
                SELECT data_type FROM information_schema.columns
                WHERE table_name = 'kv' AND column_name = 'value';
            `;
            const colResKv = await client.query(checkKvColumnQuery);
            if (colResKv.rows.length > 0 && colResKv.rows[0].data_type !== 'jsonb') {
                console.log('[DB Migration] Changing column "value" in "kv" table from TEXT to JSONB.');
                await client.query('ALTER TABLE kv ALTER COLUMN value TYPE JSONB USING value::jsonb;');
            }
            
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    };

    await runSchemaAndMigrations();

    db = pool;
    return db;
};
