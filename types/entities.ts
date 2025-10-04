// types/entities.ts

import { GameMode, Player, GameStatus, WinReason, RPSChoice, ItemGrade, EquipmentSlot, ItemOptionType, UserStatus, TournamentType, LeagueTier, SinglePlayerLevel, GameType, DiceGoVariant, AlkkagiPlacementType, AlkkagiLayoutType, GuildMemberRole, InventoryItemType, GuildResearchId, CoreStat, SpecialStat, MythicStat } from './enums.js';
import { AppSettings } from './settings.js';

// Basic Types
export type Point = { x: number; y: number };
export type BoardState = Player[][];

// User and Player related types
export interface User {
    id: string;
    username: string;
    nickname: string;
    isAdmin: boolean;
    strategyLevel: number;
    strategyXp: number;
    playfulLevel: number;
    playfulXp: number;
    baseStats: Record<CoreStat, number>;
    spentStatPoints: Record<CoreStat, number>;
    inventory: InventoryItem[];
    inventorySlots: number;
    equipment: Partial<Record<EquipmentSlot, string>>;
    equipmentPresets: EquipmentPreset[];
    actionPoints: { current: number; max: number };
    lastActionPointUpdate: number;
    actionPointPurchasesToday?: number;
    lastActionPointPurchaseDate?: number;
    actionPointQuizzesToday: number;
    lastActionPointQuizDate: number;
    dailyShopPurchases: Record<string, { quantity: number, date: number }>;
    gold: number;
    diamonds: number;
    mannerScore: number;
    mannerMasteryApplied: boolean;
    pendingPenaltyNotification: { type: 'no_contest', details: any } | null;
    mail: Mail[];
    quests: QuestLog;
    stats: Record<GameMode, { wins: number; losses: number; rankingScore: number }>;
    chatBanUntil?: number;
    connectionBanUntil?: number;
    avatarId: string;
    borderId: string;
    ownedBorders: string[];
    previousSeasonTier: string | null;
    seasonHistory: Record<string, Record<GameMode, string>>;
    tournamentScore: number;
    league: LeagueTier;
    weeklyCompetitors: WeeklyCompetitor[];
    lastWeeklyCompetitorsUpdate: number;
    lastLeagueUpdate: number;
    monthlyGoldBuffExpiresAt: number;
    mbti: string | null;
    isMbtiPublic: boolean;
    singlePlayerProgress: number;
    bonusStatPoints: number;
    singlePlayerMissions: Record<string, SinglePlayerMissionState>;
    towerProgress: { highestFloor: number; lastClearTimestamp: number };
    claimedFirstClearRewards: string[];
    currencyLogs: CurrencyLog[];
    guildId: string | null;
    guildApplications: string[];
    guildLeaveCooldownUntil?: number;
    guildCoins: number;
    guildBossAttempts: number;
    lastGuildBossAttemptDate: number;
    lastLoginAt: number;
    dailyDonations: { gold: number; diamond: number; date: number };
    dailyMissionContribution: { amount: number; date: number };
    guildShopPurchases: Record<string, { quantity: number, lastPurchaseTimestamp: number }>;
    appSettings?: AppSettings;
    kakaoId?: string;

    // Tournament progress
    lastNeighborhoodPlayedDate?: number;
    neighborhoodRewardClaimed?: boolean;
    lastNeighborhoodTournament: TournamentState | null;

    lastNationalPlayedDate?: number;
    nationalRewardClaimed?: boolean;
    lastNationalTournament: TournamentState | null;
    
    lastWorldPlayedDate?: number;
    worldRewardClaimed?: boolean;
    lastWorldTournament: TournamentState | null;
    dailyChampionshipMatchesPlayed?: number;
    lastChampionshipMatchDate?: number;
}

export interface UserWithStatus extends User {
    status: UserStatus;
    mode?: GameMode;
    gameId?: string;
    spectatingGameId?: string;
}

export interface PlayerForTournament {
    id: string;
    nickname: string;
    avatarId: string;
    borderId: string;
    league: LeagueTier;
    stats: Record<CoreStat, number>;
    originalStats: Record<CoreStat, number>;
    wins: number;
    losses: number;
    condition: number;
}

// Item and Inventory types
export interface ItemOption {
    type: ItemOptionType;
    value: number;
    baseValue?: number; // for main stats
    isPercentage: boolean;
    display: string;
    tier?: number;
    range?: [number, number];
    enhancements?: number;
}

export interface ItemOptions {
    main: ItemOption;
    combatSubs: ItemOption[];
    specialSubs: ItemOption[];
    mythicSubs: ItemOption[];
}

export interface InventoryItem {
    id: string;
    name: string;
    description?: string;
    type: InventoryItemType;
    slot: EquipmentSlot | null;
    level: number;
    isEquipped: boolean;
    createdAt: number;
    image: string | null;
    grade: ItemGrade;
    stars: number;
    enhancementFails?: number;
    options: ItemOptions | undefined;
    quantity?: number;
}

export interface EquipmentPreset {
    name: string;
    equipment: Partial<Record<EquipmentSlot, string>>;
}

// Game Session and related types
export interface Move {
    player: Player;
    x: number;
    y: number;
}

export interface KoInfo {
    point: Point;
    turn: number;
}

export interface DisconnectionState {
    disconnectedPlayerId: string;
    timerStartedAt: number;
}

export interface ActionButton {
    name: string;
    message: string;
    type: 'manner' | 'unmannerly';
}

export interface GameSettings {
    boardSize: 7 | 9 | 11 | 13 | 15 | 19;
    timeLimit: number;
    byoyomiCount: number;
    byoyomiTime: number;
    baseStones?: number;
    diceGoVariant?: DiceGoVariant;
    diceGoRounds?: 1 | 2 | 3;
    oddDiceCount?: number;
    evenDiceCount?: number;
    captureTarget?: number;
    timeIncrement?: number;
    hiddenStoneCount?: number;
    scanCount?: number;
    missileCount?: number;
    mixedModes?: GameMode[];
    hasOverlineForbidden?: boolean;
    has33Forbidden?: boolean;
    alkkagiPlacementType?: AlkkagiPlacementType;
    alkkagiLayout?: AlkkagiLayoutType;
    alkkagiStoneCount?: number;
    alkkagiGaugeSpeed?: number;
    alkkagiSlowItemCount?: number;
    alkkagiAimingLineItemCount?: number;
    alkkagiRounds?: 1 | 2 | 3;
    curlingStoneCount?: number;
    curlingGaugeSpeed?: number;
    curlingSlowItemCount?: number;
    curlingAimingLineItemCount?: number;
    curlingRounds?: 1 | 2 | 3;
    komi: number;
    player1Color?: Player.Black | Player.White;
    aiDifficulty?: number;
    timeControl?: { type: 'byoyomi' | 'fischer', mainTime: number, byoyomiTime?: number, byoyomiCount?: number, increment?: number };
    autoEndTurnCount?: number;
}

export interface LiveGameSession {
    id: string;
    mode: GameMode;
    description?: string;
    player1: User;
    player2: User;
    blackPlayerId: string | null;
    whitePlayerId: string | null;
    gameStatus: GameStatus;
    currentPlayer: Player;
    boardState: BoardState;
    moveHistory: Move[];
    captures: Record<Player, number>;
    baseStoneCaptures: Record<Player, number>;
    hiddenStoneCaptures: Record<Player, number>;
    winner: Player | null;
    winReason: WinReason | null;
    finalScores: { black: number; white: number } | null;
    createdAt: number;
    lastMove: Point | null;
    lastTurnStones?: Point[] | null;
    stonesPlacedThisTurn?: Point[] | null;
    passCount: number;
    koInfo: KoInfo | null;
    winningLine: Point[] | null;
    statsUpdated: boolean;
    summary?: Record<string, GameSummary>;
    animation?: AnimationData | null;
    blackTimeLeft: number;
    whiteTimeLeft: number;
    blackByoyomiPeriodsLeft: number;
    whiteByoyomiPeriodsLeft: number;
    turnDeadline?: number;
    turnStartTime?: number;
    disconnectionState: DisconnectionState | null;
    disconnectionCounts: Record<string, number>;
    noContestInitiatorIds?: string[];
    currentActionButtons: Record<string, ActionButton[]>;
    actionButtonCooldownDeadline?: Record<string, number>;
    actionButtonUses?: Record<string, number>;
    maxActionButtonUses?: number;
    actionButtonUsedThisCycle?: Record<string, boolean>;
    mannerScoreChanges?: Record<string, number>;
    nigiri?: { holderId: string; guesserId: string; stones: number; guess: 1 | 2 | null; result: 'correct' | 'incorrect' | null; processed?: boolean; };
    guessDeadline?: number;
    bids?: Record<string, number | null>;
    biddingRound?: number;
    captureBidDeadline?: number;
    effectiveCaptureTargets?: Record<Player, number>;
    baseStones?: (Point & { player: Player })[];
    baseStones_p1?: Point[];
    baseStones_p2?: Point[];
    basePlacementDeadline?: number;
    komiBids?: Record<string, KomiBid | null>;
    komiBiddingDeadline?: number;
    komiBiddingRound?: number;
    komiBidRevealProcessed?: boolean;
    finalKomi?: number;
    hiddenMoves?: { [moveIndex: number]: boolean };
    scans_p1?: number;
    scans_p2?: number;
    revealedStones?: Record<string, Point[]>;
    revealedHiddenMoves?: Record<string, number[]>;
    newlyRevealed?: { point: Point, player: Player }[];
    justCaptured?: { point: Point; player: Player; wasHidden: boolean }[];
    hidden_stones_used_p1?: number;
    hidden_stones_used_p2?: number;
    pendingCapture?: { x: number, y: number, captured: Point[] };
    permanentlyRevealedStones?: Point[];
    pendingAiMove?: Promise<Point & { isHidden?: boolean }>;
    missileUsedThisTurn: boolean;
    missiles_p1?: number;
    missiles_p2?: number;
    rpsState?: Record<string, RPSChoice | null>;
    rpsRound?: number;
    dice?: { dice1: number, dice2: number, dice3: number };
    stonesToPlace?: number;
    turnOrderRolls?: Record<string, number | null>;
    turnOrderRollReady?: Record<string, boolean>;
    turnOrderRollResult?: 'tie';
    turnOrderRollTies?: number;
    turnOrderRollDeadline?: number;
    turnOrderAnimationEndTime?: number;
    turnChoiceDeadline?: number;
    turnChooserId?: string;
    turnChoices?: Record<string, 'first' | 'second' | null>;
    turnSelectionTiebreaker?: 'rps' | 'nigiri' | 'dice_roll';
    diceRollHistory?: Record<string, number[]>;
    diceRoundSummary?: DiceRoundSummary | null;
    lastWhiteGroupInfo?: any;
    diceGoItemUses?: Record<string, { odd: number; even: number }>;
    diceGoBonuses?: Record<string, number>;
    diceCapturesThisTurn?: number;
    diceLastCaptureStones?: Point[];
    round: number;
    isDeathmatch?: boolean;
    turnInRound: number;
    scores: Record<string, number>;
    thiefPlayerId?: string;
    policePlayerId?: string;
    roleChoices?: Record<string, 'thief' | 'police' | null>;
    roleChoiceWinnerId?: string;
    thiefRoundSummary?: ThiefRoundSummary | null;
    thiefDiceRollHistory?: Record<string, number[]>;
    thiefCapturesThisRound?: number;
    alkkagiStones?: AlkkagiStone[];
    alkkagiStones_p1?: AlkkagiStone[];
    alkkagiStones_p2?: AlkkagiStone[];
    alkkagiTurnDeadline?: number;
    alkkagiPlacementDeadline?: number;
    alkkagiItemUses?: Record<string, { slow: number; aimingLine: number }>;
    activeAlkkagiItems?: Record<string, ('slow' | 'aimingLine')[]>;
    alkkagiRound?: number;
    alkkagiRefillsUsed?: Record<string, number>;
    alkkagiStonesPlacedThisRound?: Record<string, number>;
    alkkagiRoundSummary?: AlkkagiRoundSummary | null;
    curlingStones?: AlkkagiStone[];
    curlingTurnDeadline?: number;
    curlingScores?: Record<Player, number>;
    curlingRound?: number;
    curlingRoundSummary?: CurlingRoundSummary | null;
    curlingItemUses?: Record<string, { slow: number; aimingLine: number }>;
    activeCurlingItems?: Record<string, ('slow' | 'aimingLine')[]>;
    hammerPlayerId?: string;
    isTiebreaker?: boolean;
    tiebreakerStonesThrown?: number;
    stonesThrownThisRound?: Record<string, number>;
    preGameConfirmations?: Record<string, boolean | number>;
    roundEndConfirmations?: Record<string, number>;
    rematchRejectionCount?: Record<string, number>;
    timeoutFouls?: Record<string, number>;
    curlingStonesLostToFoul?: Record<string, number>;
    foulInfo?: { message: string, expiry: number };
    isAnalyzing?: boolean;
    analysisResult?: Record<string, AnalysisResult>;
    previousAnalysisResult?: Record<string, AnalysisResult>;
    settings: GameSettings;
    canRequestNoContest?: Record<string, boolean>;
    pausedTurnTimeLeft?: number;
    itemUseDeadline?: number;
    lastTimeoutPlayerId?: string;
    lastTimeoutPlayerIdClearTime?: number;
    revealAnimationEndTime?: number;
    revealEndTime?: number;
    isAiGame: boolean;
    aiTurnStartTime?: number;
    aiHiddenStoneUsedThisGame?: boolean;
    mythicBonuses?: Record<string, any>;
    lastPlayfulGoldCheck?: Record<string, number>;
    pendingSystemMessages?: ChatMessage[];
    isSinglePlayer?: boolean;
    stageId?: string;
    blackPatternStones?: Point[];
    whitePatternStones?: Point[];
    singlePlayerPlacementRefreshesUsed?: number;
    towerChallengePlacementRefreshesUsed?: number;
    towerAddStonesUsed?: number;
    towerItemPurchases?: { missile?: boolean; hidden?: boolean; scan?: boolean; };
    blackStonesPlaced?: number;
    blackStoneLimit?: number;
    isTowerChallenge?: boolean;
    floor?: number;
    gameType?: GameType;
    whiteStonesPlaced?: number;
    whiteStoneLimit?: number;
    autoEndTurnCount?: number;
    promptForMoreStones?: boolean;
}

export interface KomiBid {
    color: Player.Black | Player.White;
    komi: number;
}

export interface AlkkagiStone {
    id: number;
    player: Player;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    onBoard: boolean;
}

// Communication and UI types
export interface Negotiation {
    id: string;
    challenger: User;
    opponent: User;
    mode: GameMode;
    settings: GameSettings;
    proposerId: string;
    status: 'draft' | 'pending' | 'accepted' | 'declined';
    turnCount?: number;
    deadline: number;
    rematchOfGameId?: string;
}

export interface ChatMessage {
    id: string;
    user: { id: string; nickname: string };
    text?: string;
    emoji?: string;
    timestamp: number;
    system?: boolean;
    location?: string;
    actionInfo?: { message: string, scoreChange: number };
}

// Summary and Log types
export interface StatChange {
    initial: number;
    final: number;
    change: number;
}

export interface GameSummary {
    xp: StatChange;
    level: {
        initial: number;
        final: number;
        progress: {
            initial: number;
            final: number;
            max: number;
        }
    };
    rating: StatChange;
    gold: number;
    items?: InventoryItem[];
    manner: StatChange;
    mannerActionChange?: number;
    overallRecord?: { wins: number; losses: number };
}

export interface AdminLog {
    id: string;
    timestamp: number;
    adminId: string;
    adminNickname: string;
    targetUserId: string;
    targetNickname: string;
    action: 'apply_sanction' | 'lift_sanction' | 'reset_full' | 'reset_stats' | 'delete_user' | 'force_logout' | 'send_mail' | 'give_action_points' | 'set_game_description' | 'force_delete_game' | 'force_win' | 'update_user_details' | 'update_guild_details' | 'apply_guild_sanction' | 'delete_guild';
    details: any;
    backupData: any;
}

export interface Announcement {
    id: string;
    message: string;
}

export interface OverrideAnnouncement {
    message: string;
    modes: GameMode[] | 'all';
}

// Mail and Quest types
export interface Mail {
    id: string;
    from: string;
    title: string;
    message: string;
    attachments?: QuestReward;
    receivedAt: number;
    expiresAt?: number;
    isRead: boolean;
    attachmentsClaimed: boolean;
}

export interface QuestReward {
    gold?: number;
    diamonds?: number;
    actionPoints?: number;
    exp?: { type: 'strategy' | 'playful', amount: number };
    items?: (InventoryItem | { itemId: string; quantity: number })[];
    bonus?: string;
    guildCoins?: number;
}

export interface Quest {
    id: string;
    title: string;
    description: string;
    target: number;
    progress: number;
    reward: QuestReward;
    isClaimed: boolean;
    activityPoints: number;
}

export interface DailyQuestData {
    quests: Quest[];
    activityProgress: number;
    claimedMilestones: boolean[];
    lastReset: number;
}

export interface WeeklyQuestData extends DailyQuestData {}
export interface MonthlyQuestData extends DailyQuestData {}

export interface QuestLog {
    daily: DailyQuestData;
    weekly: WeeklyQuestData;
    monthly: MonthlyQuestData;
}

export interface WeeklyCompetitor {
    id: string;
    nickname: string;
    avatarId: string;
    borderId: string;
    league: LeagueTier;
    initialScore: number;
    currentScore: number;
}

// Analysis types
export interface RecommendedMove extends Point {
    winrate: number;
    scoreLead: number;
    order: number;
}

export interface ScoreDetails {
    territory: number;
    captures: number; // legacy/display
    liveCaptures: number;
    deadStones: number;
    komi?: number;
    baseStoneBonus: number;
    hiddenStoneBonus: number;
    timeBonus: number;
    itemBonus: number;
    total: number;
}

export interface AnalysisResult {
    winRateBlack: number;
    winRateChange: number;
    scoreLead: number;
    deadStones: Point[];
    ownershipMap: number[][] | null;
    recommendedMoves: RecommendedMove[];
    areaScore: { black: number; white: number };
    scoreDetails: { black: ScoreDetails; white: ScoreDetails };
    blackConfirmed: Point[];
    whiteConfirmed: Point[];
    blackRight: Point[];
    whiteRight: Point[];
    blackLikely: Point[];
    whiteLikely: Point[];
}

export interface AnimationData {
    type: 'missile' | 'scan' | 'hidden_reveal' | 'bonus_score' | 'dice_roll_turn' | 'dice_roll_main' | 'alkkagi_flick' | 'curling_flick' | 'hidden_missile' | 'bonus_text';
    startTime: number;
    duration: number;
    [key: string]: any;
}

// Dice Go types
export interface DiceRoundSummary {
    round: number;
    scores: Record<string, number>;
    diceStats?: Record<string, { rolls: Record<number, number>; totalRolls: number }>;
}

// Thief Go types
export interface ThiefRoundSummary {
    round: number;
    isDeathmatch: boolean;
    player1: {
        id: string;
        role: 'thief' | 'police';
        roundScore: number;
        cumulativeScore: number;
    };
    player2: {
        id: string;
        role: 'thief' | 'police';
        roundScore: number;
        cumulativeScore: number;
    };
}

// Alkkagi types
export interface AlkkagiRoundSummary {
    round: number;
    winnerId: string;
    loserId: string;
    refillsRemaining: Record<string, number>;
}

// Curling types
export interface CurlingRoundSummary {
    round: number;
    roundWinner: Player | null;
    black: { houseScore: number; knockoutScore: number; total: number };
    white: { houseScore: number; knockoutScore: number; total: number };
    cumulativeScores: Record<Player, number>;
    stonesState: AlkkagiStone[];
    scoredStones: { [stoneId: number]: number };
}

// Tournament types
export interface Match {
    id: string;
    players: (PlayerForTournament | null)[];
    winner: PlayerForTournament | null;
    isFinished: boolean;
    commentary: CommentaryLine[];
    isUserMatch: boolean;
    sgfFileIndex?: number;
    potionUsed?: Record<string, boolean>;
    conditionBoost?: Record<string, number>;
    finalScore: { player1: number; player2: number } | null;
}

export interface Round {
    id: number;
    name: string;
    matches: Match[];
}

export interface CommentaryLine {
    text: string;
    phase: 'start' | 'early' | 'mid' | 'end';
    isRandomEvent?: boolean;
    randomEventDetails?: {
        type: 'mistake';
        stat: CoreStat;
        p1_id: string;
        p2_id: string;
        p1_stat: number;
        p2_stat: number;
        player_id: string;
        score_change: number;
    }
    time?: number;
}

export interface TournamentState {
    type: TournamentType;
    status: 'bracket_ready' | 'round_in_progress' | 'round_complete' | 'complete' | 'eliminated';
    title: string;
    players: PlayerForTournament[];
    rounds: Round[];
    currentSimulatingMatch: { roundIndex: number, matchIndex: number } | null;
    currentMatchCommentary: CommentaryLine[];
    lastPlayedDate: number;
    nextRoundStartTime?: number;
    timeElapsed: number;
    currentMatchScores?: { player1: number; player2: number };
    lastStatChanges?: { playerId: string, stat: CoreStat, change: number }[];
    currentRoundRobinRound?: number;
}

export interface TowerRank {
    rank: number;
    user: User;
    floor: number;
}

// Single Player Types
export interface SinglePlayerStageInfo {
    id: string;
    name: string;
    level: SinglePlayerLevel;
    gameType: GameType;
    actionPointCost: number;
    boardSize: 7 | 9 | 11 | 13;
    targetScore?: { black: number, white: number };
    katagoLevel: number;
    placements: { black: number; white: number; blackPattern: number; whitePattern: number; centerBlackStoneChance?: number; };
    timeControl: { type: 'byoyomi' | 'fischer', mainTime: number, byoyomiTime?: number, byoyomiCount?: number, increment?: number };
    rewards: { firstClear: QuestReward, repeatClear: QuestReward };
    blackStoneLimit?: number;
    whiteStoneLimit?: number;
    autoEndTurnCount?: number;
    missileCount?: number;
    hiddenStoneCount?: number;
    scanCount?: number;
    floor?: number;
    mode?: GameMode;
    mixedModes?: GameMode[];
}

export interface SinglePlayerMissionInfo {
    id: string;
    name: string;
    description: string;
    unlockStageId: string;
    productionRateMinutes: number;
    rewardType: 'gold' | 'diamonds';
    rewardAmount: number;
    maxCapacity: number;
    image: string;
}

export interface SinglePlayerMissionState {
    isStarted: boolean;
    lastCollectionTime: number;
    claimableAmount: number;
    progressTowardNextLevel: number;
    level?: number;
}

export interface CurrencyLog {
    timestamp: number;
    type: 'gold_gain' | 'gold_spend' | 'diamond_gain' | 'diamond_spend';
    amount: number;
    reason: string;
    balanceAfter: { gold: number, diamonds: number };
}

// Guild Types
export interface Guild {
    id: string;
    name: string;
    description: string;
    isPublic: boolean;
    icon: string;
    level: number;
    xp: number;
    researchPoints: number;
    members: GuildMember[];
    applicants: string[];
    announcement?: string;
    weeklyMissions: GuildMission[];
    missionProgress: GuildMissionProgress;
    lastMissionReset: number;
    lastWeeklyContributionReset: number;
    chatHistory: ChatMessage[];
    memberLimit: number;
    research: Partial<Record<GuildResearchId, { level: number }>>;
    researchTask: { researchId: GuildResearchId; completionTime: number } | null;
    recruitmentBanUntil?: number;
    dailyCheckInRewardsClaimed?: { userId: string, milestoneIndex: number }[];
    checkIns?: Record<string, number>;
    guildBossState?: GuildBossState;
}

export interface GuildMember {
    userId: string;
    nickname: string;
    role: GuildMemberRole;
    joinedAt: number;
    contribution: number;
    weeklyContribution: number;
}

export interface GuildMission {
    id: string;
    title: string;
    description: string;
    target: number;
    progress: number;
    personalReward: { guildCoins: number };
    guildReward: { guildXp: number };
    isCompleted: boolean;
    claimedBy: string[];
    progressKey: GuildMissionProgressKey;
}

export type GuildMissionProgressKey = keyof GuildMissionProgress;
export interface GuildMissionProgress {
    checkIns: number;
    strategicWins: number;
    playfulWins: number;
    diamondsSpent: number;
    equipmentEnhancements: number;
    materialCrafts: number;
    equipmentSyntheses: number;
    championshipClaims: number;
    towerFloor50Conquerors: string[];
    towerFloor100Conquerors: string[];
    bossAttempts: number;
}

export interface GuildResearchProject {
    image: string;
    category: GuildResearchCategory;
    name: string;
    description: string;
    maxLevel: number;
    baseCost: number;
    costMultiplier: number;
    baseEffect: number;
    effectUnit: string;
    baseTimeHours: number;
    timeIncrementHours: number;
    requiredGuildLevel: number[];
}

export type GuildResearchCategory = 'development' | 'boss' | 'stats' | 'rewards';

export interface GuildBossSkillSubEffect {
    type: 'damage' | 'hp_percent' | 'heal' | 'debuff';
    value?: [number, number];
    debuffType?: 'user_heal_reduction_percent' | 'user_combat_power_reduction_percent';
    debuffValue?: [number, number];
    debuffDuration?: number;
    hits?: number;
}

export type GuildBossSkillEffect = GuildBossSkillSubEffect[];

interface GuildBossSkillBase {
    id: string;
    name: string;
    description: string;
    image: string;
}

export interface GuildBossActiveSkill extends GuildBossSkillBase {
    type: 'active';
    checkStat: CoreStat | CoreStat[];
    onSuccess: GuildBossSkillEffect;
    onFailure: GuildBossSkillEffect;
}

export interface GuildBossPassiveSkill extends GuildBossSkillBase {
    type: 'passive';
    passiveTrigger: 'on_user_heal' | 'every_turn' | 'always';
    checkStat?: CoreStat;
    passiveChance?: number;
    passiveEffect: GuildBossSkillEffect;
}

export type GuildBossSkill = GuildBossActiveSkill | GuildBossPassiveSkill;


export interface GuildBossInfo {
    id: string;
    name: string;
    description: string;
    image: string;
    maxHp: number;
    hp: number;
    stats: Record<CoreStat, number>;
    strategyGuide: string;
    skills: GuildBossSkill[];
    recommendedStats: CoreStat[];
    recommendedResearch: GuildResearchId[];
}

export interface GuildBossState {
    currentBossId: string;
    currentBossHp: number;
    totalDamageLog: Record<string, number>;
    lastReset: number;
}

export interface BattleLogEntry {
    turn: number;
    icon?: string;
    message: string;
    isUserAction?: boolean;
    damageTaken?: number;
    healingDone?: number;
    isCrit?: boolean;
}

export interface GuildBossBattleResult {
    damageDealt: number;
    turnsSurvived: number;
    rewards: { guildCoins: number };
    battleLog: BattleLogEntry[];
    bossHpBefore: number;
    bossHpAfter: number;
    bossMaxHp: number;
    userHp: number;
    maxUserHp: number;
}

export interface MannerEffects {
    maxActionPoints: number;
    actionPointRegenInterval: number;
    goldBonusPercent: number;
    itemDropRateBonus: number;
    mannerActionButtonBonus: number;
    rewardMultiplier: number;
    enhancementSuccessRateBonus: number;
}

// UI-specific types
export interface AvatarInfo {
    id: string;
    name: string;
    url: string;
    requiredLevel: number;
    type: 'any' | 'strategy' | 'playful';
}

export interface BorderInfo {
    id: string;
    name: string;
    url: string; // Can be a color string or an image URL
    type: 'basic' | 'level' | 'seasonal' | 'shop';
    description: string;
    requiredLevelSum?: number;
    unlockTier?: string;
}

export interface ShopBorderItem extends BorderInfo {
    price: { gold?: number; diamonds?: number };
}

export interface TournamentDefinition {
    id: TournamentType;
    name: string;
    description: string;
    format: 'round-robin' | 'tournament';
    players: number;
    image: string;
}

export interface LeagueRewardTier {
    rankStart: number;
    rankEnd: number;
    diamonds: number;
    outcome: 'promote' | 'maintain' | 'demote';
    items?: (InventoryItem | { itemId: string; quantity: number })[];
    strategyXp?: number;
}

export interface SeasonInfo {
    year: number;
    season: 1 | 2 | 3 | 4;
    name: string; // e.g., '25-1시즌'
}