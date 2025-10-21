export enum GameMode {
    Standard = '클래식',
    Capture = '따내기',
    Speed = '스피드',
    Base = '베이스',
    Hidden = '히든',
    Missile = '미사일',
    Mix = '믹스룰',
    Dice = '주사위',
    Omok = '오목',
    Ttamok = '따목',
    Thief = '도둑과경찰',
    Alkkagi = '알까기',
    Curling = '바둑컬링',
}

export enum Player {
    None,
    Black,
    White,
}

export enum GameStatus {
    Pending = 'pending',
    Playing = 'playing',
    Paused = 'paused',
    Ended = 'ended',
    NoContest = 'no_contest',
    RematchPending = 'rematch_pending',
    Scoring = 'scoring',
    NigiriChoosing = 'nigiri_choosing',
    NigiriGuessing = 'nigiri_guessing',
    NigiriReveal = 'nigiri_reveal',
    BasePlacement = 'base_placement',
    KomiBidding = 'komi_bidding',
    KomiBidReveal = 'komi_bid_reveal',
    BaseGameStartConfirmation = 'base_game_start_confirmation',
    CaptureBidding = 'capture_bidding',
    CaptureReveal = 'capture_reveal',
    CaptureTiebreaker = 'capture_tiebreaker',
    HiddenPlacing = 'hidden_placing',
    Scanning = 'scanning',
    ScanningAnimating = 'scanning_animating',
    HiddenRevealAnimating = 'hidden_reveal_animating',
    HiddenFinalReveal = 'hidden_final_reveal',
    MissileSelecting = 'missile_selecting',
    MissileAnimating = 'missile_animating',
    TurnPreferenceSelection = 'turn_preference_selection',
    DiceRps = 'dice_rps',
    DiceRpsReveal = 'dice_rps_reveal',
    ThiefRps = 'thief_rps',
    ThiefRpsReveal = 'thief_rps_reveal',
    AlkkagiRps = 'alkkagi_rps',
    AlkkagiRpsReveal = 'alkkagi_rps_reveal',
    CurlingRps = 'curling_rps',
    CurlingRpsReveal = 'curling_rps_reveal',
    OmokRps = 'omok_rps',
    OmokRpsReveal = 'omok_rps_reveal',
    TtamokRps = 'ttamok_rps',
    TtamokRpsReveal = 'ttamok_rps_reveal',
    DiceTurnRolling = 'dice_turn_rolling',
    DiceTurnRollingAnimating = 'dice_turn_rolling_animating',
    DiceTurnChoice = 'dice_turn_choice',
    DiceStartConfirmation = 'dice_start_confirmation',
    DiceRolling = 'dice_rolling',
    DiceRollingAnimating = 'dice_rolling_animating',
    DicePlacing = 'dice_placing',
    DiceRoundEnd = 'dice_round_end',
    ThiefRoleSelection = 'thief_role_selection',
    ThiefRoleConfirmed = 'thief_role_confirmed',
    ThiefRolling = 'thief_rolling',
    ThiefRollingAnimating = 'thief_rolling_animating',
    ThiefPlacing = 'thief_placing',
    ThiefRoundEnd = 'thief_round_end',
    AlkkagiStartConfirmation = 'alkkagi_start_confirmation',
    AlkkagiPlacement = 'alkkagi_placement',
    AlkkagiSimultaneousPlacement = 'alkkagi_simultaneous_placement',
    AlkkagiPlaying = 'alkkagi_playing',
    AlkkagiAnimating = 'alkkagi_animating',
    AlkkagiRoundEnd = 'alkkagi_round_end',
    CurlingStartConfirmation = 'curling_start_confirmation',
    CurlingPlaying = 'curling_playing',
    CurlingAnimating = 'curling_animating',
    CurlingRoundEnd = 'curling_round_end',
    CurlingTiebreakerPreferenceSelection = 'curling_tiebreaker_preference_selection',
    CurlingTiebreakerPlaying = 'curling_tiebreaker_playing',
    CurlingTiebreakerRps = 'curling_tiebreaker_rps',
    CurlingTiebreakerRpsReveal = 'curling_tiebreaker_rps_reveal',
    AiHiddenThinking = 'ai_hidden_thinking',
    SinglePlayerIntro = 'single_player_intro',
}

export enum WinReason {
    Resign = 'resign',
    Timeout = 'timeout',
    Score = 'score',
    CaptureLimit = 'capture_limit',
    Disconnect = 'disconnect',
    OmokWin = 'omok_win',
    DiceWin = 'dice_win',
    AlkkagiWin = 'alkkagi_win',
    CurlingWin = 'curling_win',
    TotalScore = 'total_score',
    FoulLimit = 'foul_limit',
    StoneLimitExceeded = 'stone_limit_exceeded',
}

export enum RPSChoice {
    Rock = 'rock',
    Paper = 'paper',
    Scissors = 'scissors',
}

export enum ItemGrade {
    Normal = 'normal',
    Uncommon = 'uncommon',
    Rare = 'rare',
    Epic = 'epic',
    Legendary = 'legendary',
    Mythic = 'mythic',
}

export enum EquipmentSlot {
    Fan = 'fan',
    Board = 'board',
    Top = 'top',
    Bottom = 'bottom',
    Bowl = 'bowl',
    Stones = 'stones',
}

export enum CoreStat {
    Concentration = '집중력',
    ThinkingSpeed = '사고속도',
    Judgment = '판단력',
    Calculation = '계산력',
    CombatPower = '전투력',
    Stability = '안정감',
}

export enum SpecialStat {
    ActionPointMax = 'ActionPointMax',
    ActionPointRegen = 'ActionPointRegen',
    StrategyXpBonus = 'StrategyXpBonus',
    PlayfulXpBonus = 'PlayfulXpBonus',
    GoldBonus = 'GoldBonus',
    ItemDropRate = 'ItemDropRate',
    MaterialDropRate = 'MaterialDropRate',
    GuildBossDamage = 'GuildBossDamage',
    GuildBossDamageReduction = 'GuildBossDamageReduction',
    GuildBossHealIncrease = 'GuildBossHealIncrease',
}

export enum MythicStat {
    MannerActionCooldown = 'MannerActionCooldown',
    StrategicGoldBonus = 'StrategicGoldBonus',
    PlayfulGoldBonus = 'PlayfulGoldBonus',
    DiceGoOddBonus = 'DiceGoOddBonus',
    AlkkagiSlowBonus = 'AlkkagiSlowBonus',
    AlkkagiAimingBonus = 'AlkkagiAimingBonus',
}

export type ItemOptionType = CoreStat | SpecialStat | MythicStat;

export enum UserStatus {
    Online = 'online',
    Waiting = 'waiting',
    Resting = 'resting',
    Negotiating = 'negotiating',
    InGame = 'in-game',
    Spectating = 'spectating',
}

export enum TournamentType {
    Neighborhood = 'neighborhood',
    National = 'national',
    World = 'world',
}

export enum LeagueTier {
    Sprout = '새싹 리그',
    Rookie = '루키 리그',
    Rising = '라이징 리그',
    Ace = '에이스 리그',
    Diamond = '다이아 리그',
    Master = '마스터 리그',
    Grandmaster = '그랜드마스터 리그',
    Challenger = '챌린저 리그',
}

export enum SinglePlayerLevel {
    입문 = '입문',
    초급 = '초급',
    중급 = '중급',
    고급 = '고급',
    유단자 = '유단자',
}

export enum GameType {
    Standard = 'standard',
    Capture = 'capture',
    Survival = 'survival',
    Speed = 'speed',
    Missile = 'missile',
    Hidden = 'hidden',
}

export enum DiceGoVariant {
    Basic = 'basic'
}

export enum AlkkagiPlacementType {
    TurnByTurn = '턴제 배치',
    Simultaneous = '일괄 배치',
}

export enum AlkkagiLayoutType {
    Normal = '기본형',
    Battle = '대결형',
}

export enum GuildMemberRole {
    Master = 'master',
    Vice = 'vice',
    Member = 'member',
}

export type InventoryItemType = 'equipment' | 'consumable' | 'material';

export enum GuildResearchId { 
    // 길드 발전
    member_limit_increase = 'member_limit_increase',
    
    // 보스전
    boss_hp_increase = 'boss_hp_increase',
    boss_skill_heal_block = 'boss_skill_heal_block',
    boss_skill_regen = 'boss_skill_regen',
    boss_skill_ignite = 'boss_skill_ignite',

    // 능력치 증가
    stat_concentration = 'stat_concentration',
    stat_thinking_speed = 'stat_thinking_speed',
    stat_judgment = 'stat_judgment',
    stat_calculation = 'stat_calculation',
    stat_combat_power = 'stat_combat_power',
    stat_stability = 'stat_stability',
    ap_regen_boost = 'ap_regen_boost',

    // 보상 증가
    reward_strategic_gold = 'reward_strategic_gold',
    reward_playful_gold = 'reward_playful_gold',
    reward_strategic_xp = 'reward_strategic_xp',
    reward_playful_xp = 'reward_playful_xp',
}
