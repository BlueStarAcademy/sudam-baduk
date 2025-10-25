
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const runSchema = async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL is not set!');
    }

    console.log('[Schema Init] Connecting to the database...');
    const pool = new Pool({
        connectionString: connectionString,
        ssl: {
            rejectUnauthorized: false
        }
    });

    const client = await pool.connect();
    console.log('[Schema Init] Connected. Creating tables...');

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
                "aiHiddenStoneUsedThisGame" BOOLEAN,
                "stageInfo" JSONB
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
        console.log('[Schema Init] "users" table created or already exists.');
        await client.query(liveGamesTableSchema);
        console.log('[Schema Init] "live_games" table created or already exists.');
        await client.query(userCredentialsTableSchema);
        console.log('[Schema Init] "user_credentials" table created or already exists.');
        await client.query(kvTableSchema);
        console.log('[Schema Init] "kv" table created or already exists.');
        
        await client.query('COMMIT');
        console.log('\n✅ Schema initialization completed successfully!');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('\n❌ Schema initialization failed:', e);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
};

runSchema().catch(e => {
    console.error(e);
    process.exit(1);
});
