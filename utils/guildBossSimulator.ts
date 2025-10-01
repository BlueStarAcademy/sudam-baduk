
// utils/guildBossSimulator.ts
// FIX: Split type and value imports to resolve namespace collision errors
// FIX: Changed imports to point to specific files to avoid namespace conflicts
import type { User, Guild, GuildBossInfo, QuestReward, MannerEffects, GuildBossSkill, GuildBossActiveSkill, GuildBossPassiveSkill, GuildBossSkillEffect, GuildBossSkillSubEffect } from '../types/entities.js';
import { GuildResearchId, CoreStat, SpecialStat, MythicStat } from '../types/enums.js';
import { GUILD_BOSSES, GUILD_RESEARCH_PROJECTS, ACTION_POINT_REGEN_INTERVAL_MS } from '../constants/index.js';
import { BOSS_SKILL_ICON_MAP, GUILD_RESEARCH_IGNITE_IMG, GUILD_RESEARCH_HEAL_BLOCK_IMG, GUILD_RESEARCH_REGEN_IMG, GUILD_ATTACK_ICON } from '../assets.js';


// Define and export types locally
export interface BattleLogEntry {
    turn: number;
    icon?: string;
    message: string;
    isUserAction?: boolean;
    damageTaken?: number;
    healingDone?: number;
    isCrit?: boolean;
    debuffsApplied?: { type: 'user_combat_power_reduction_percent' | 'user_heal_reduction_percent', value: number, turns: number }[];
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

// --- Client-safe utility functions copied from server/services to avoid server-side dependencies ---

const getMannerEffects = (user: User): MannerEffects => {
    const score = user.mannerScore ?? 200;
    const effects: MannerEffects = {
        maxActionPoints: 30,
        actionPointRegenInterval: ACTION_POINT_REGEN_INTERVAL_MS,
        goldBonusPercent: 0,
        itemDropRateBonus: 0,
        mannerActionButtonBonus: 0,
        rewardMultiplier: 1,
        enhancementSuccessRateBonus: 0,
    };
    if (score >= 400) effects.maxActionPoints += 10;
    if (score >= 800) effects.goldBonusPercent += 10;
    if (score >= 1200) effects.itemDropRateBonus += 10;
    if (score >= 1600) effects.enhancementSuccessRateBonus += 10;
    if (score <= 199) effects.mannerActionButtonBonus += 1;
    if (score <= 99) effects.rewardMultiplier *= 0.5;
    if (score <= 49) effects.actionPointRegenInterval = 20 * 60 * 1000;
    if (score <= 0) effects.maxActionPoints = Math.floor(effects.maxActionPoints * 0.1);
    return effects;
};

const researchIdToCoreStat: Partial<Record<GuildResearchId, CoreStat>> = {
    [GuildResearchId.stat_concentration]: CoreStat.Concentration,
    [GuildResearchId.stat_thinking_speed]: CoreStat.ThinkingSpeed,
    [GuildResearchId.stat_judgment]: CoreStat.Judgment,
    [GuildResearchId.stat_calculation]: CoreStat.Calculation,
    [GuildResearchId.stat_combat_power]: CoreStat.CombatPower,
    [GuildResearchId.stat_stability]: CoreStat.Stability,
};

const calculateUserEffects = (user: User, guild: Guild | null): any => {
    const effects = getMannerEffects(user);
    const calculatedEffects: any = {
        ...effects,
        coreStatBonuses: {} as Record<CoreStat, { flat: number; percent: number }>,
        specialStatBonuses: {} as Record<SpecialStat, { flat: number; percent: number }>,
        mythicStatBonuses: {} as Record<MythicStat, { flat: number; percent: number; }>,
        strategicGoldBonusPercent: 0,
        playfulGoldBonusPercent: 0,
        strategicXpBonusPercent: 0,
        playfulXpBonusPercent: 0,
    };
    // FIX: Cast enum values when iterating to resolve 'unknown' index type errors.
    for (const key of Object.values(CoreStat) as CoreStat[]) (calculatedEffects.coreStatBonuses as any)[key] = { flat: 0, percent: 0 };
    for (const key of Object.values(SpecialStat) as SpecialStat[]) (calculatedEffects.specialStatBonuses as any)[key] = { flat: 0, percent: 0 };
    for (const key of Object.values(MythicStat) as MythicStat[]) (calculatedEffects.mythicStatBonuses as any)[key] = { flat: 0, percent: 0 };
    const equippedItems = user.inventory.filter(i => i.isEquipped && i.type === 'equipment' && i.options);
    for (const item of equippedItems) {
        const allOptions = [item.options!.main, ...item.options!.combatSubs, ...item.options!.specialSubs, ...item.options!.mythicSubs];
        for (const opt of allOptions) {
            if (!opt) continue;
            const { type, value, isPercentage } = opt;
            if (Object.values(CoreStat).includes(type as CoreStat)) {
                if (isPercentage) calculatedEffects.coreStatBonuses[type as CoreStat].percent += value;
                else calculatedEffects.coreStatBonuses[type as CoreStat].flat += value;
            } else if (Object.values(SpecialStat).includes(type as SpecialStat)) {
                if (isPercentage) calculatedEffects.specialStatBonuses[type as SpecialStat].percent += value;
                else calculatedEffects.specialStatBonuses[type as SpecialStat].flat += value;
            } else if (Object.values(MythicStat).includes(type as MythicStat)) {
                calculatedEffects.mythicStatBonuses[type as MythicStat].flat += value;
            }
        }
    }
    if (guild && guild.research) {
        for (const researchId in guild.research) {
            const id = researchId as GuildResearchId;
            const data = guild.research[id];
            const project = GUILD_RESEARCH_PROJECTS[id];
            if (data && data.level > 0 && project) {
                const totalEffect = project.baseEffect * data.level;
                const coreStat = researchIdToCoreStat[id];
                if (coreStat) {
                    calculatedEffects.coreStatBonuses[coreStat].percent += totalEffect;
                } else {
                    switch (id) {
                        case GuildResearchId.ap_regen_boost: calculatedEffects.specialStatBonuses[SpecialStat.ActionPointRegen].percent += totalEffect; break;
                        case GuildResearchId.reward_strategic_gold: calculatedEffects.strategicGoldBonusPercent += totalEffect; break;
                        case GuildResearchId.reward_playful_gold: calculatedEffects.playfulGoldBonusPercent += totalEffect; break;
                        case GuildResearchId.reward_strategic_xp: calculatedEffects.strategicXpBonusPercent += totalEffect; break;
                        case GuildResearchId.reward_playful_xp: calculatedEffects.playfulXpBonusPercent += totalEffect; break;
                        case GuildResearchId.boss_hp_increase:
                            // handled separately in battle sim
                            break;
                    }
                }
            }
        }
    }
    
    calculatedEffects.maxActionPoints += calculatedEffects.specialStatBonuses[SpecialStat.ActionPointMax].flat;
    const regenBonusPercent = calculatedEffects.specialStatBonuses[SpecialStat.ActionPointRegen].percent;
    if (regenBonusPercent > 0) calculatedEffects.actionPointRegenInterval = Math.floor(calculatedEffects.actionPointRegenInterval / (1 + regenBonusPercent / 100));
    return calculatedEffects;
};

const calculateTotalStats = (user: User, guild: Guild | null): Record<CoreStat, number> => {
    const finalStats: Record<CoreStat, number> = {} as any;
    const baseWithSpent: Record<CoreStat, number> = {} as any;
    for (const key of Object.values(CoreStat) as CoreStat[]) {
        baseWithSpent[key] = (user.baseStats?.[key] || 0) + (user.spentStatPoints?.[key] || 0);
    }
    const effects = calculateUserEffects(user, guild);
    const bonuses = effects.coreStatBonuses;
    for (const key of Object.values(CoreStat) as CoreStat[]) {
        const baseValue = baseWithSpent[key];
        const flatBonus = bonuses[key].flat;
        const percentBonus = bonuses[key].percent;
        const finalValue = Math.floor((Number(baseValue) + Number(flatBonus)) * (1 + Number(percentBonus) / 100));
        finalStats[key] = finalValue;
    }
    return finalStats;
};

const normalAttackCommentaries = ['침착한 한수로 응수합니다.', '정확하게 약점을 노립니다.', '흐름을 가져오는 일격입니다.', '단단하게 지켜냅니다.'];
const criticalAttackCommentaries = ['사활문제를 풀어냈습니다!', '엄청난 집중력으로 좋은 한수를 둡니다.', '예리한 묘수로 허를 찌릅니다!', '신의 한수!'];

const getRandom = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export const runGuildBossBattle = (user: User, guild: Guild, boss: GuildBossInfo): GuildBossBattleResult => {
    const totalStats = calculateTotalStats(user, guild);
    const effects = calculateUserEffects(user, guild);
    const BATTLE_TURNS = 30; // Boss will use finisher on turn 30
    
    let userHp = 10000 + (totalStats[CoreStat.Concentration] * 10);
    const hpIncreaseLevel = guild.research?.boss_hp_increase?.level || 0;
    if (hpIncreaseLevel > 0) userHp *= (1 + (GUILD_RESEARCH_PROJECTS[GuildResearchId.boss_hp_increase].baseEffect * hpIncreaseLevel) / 100);
    userHp = Math.round(userHp);
    const maxUserHp = userHp;

    let totalDamageDealt = 0;
    let turnsSurvived = 0;
    const battleLog: BattleLogEntry[] = [];
    const researchLevels = guild.research;
    
    let activeDebuffs: {
        [key in 'user_combat_power_reduction_percent' | 'user_heal_reduction_percent']: { value: number; turns: number }
    } = {
        user_combat_power_reduction_percent: { value: 0, turns: 0 },
        user_heal_reduction_percent: { value: 0, turns: 0 },
    };
    
    const runUserTurn = (isExtra: boolean = false) => {
        let userDamage = (totalStats[CoreStat.CombatPower] * 3.2) + (totalStats[CoreStat.Judgment] * 2.6) + (totalStats[CoreStat.Calculation] * 1.8);
        const damageBonusPercent = effects.specialStatBonuses[SpecialStat.GuildBossDamage]?.percent || 0;
        if (damageBonusPercent > 0) userDamage *= (1 + damageBonusPercent / 100);
        userDamage *= (1 + (Math.random() * 0.2 - 0.1));
        const critChance = 15 + (totalStats[CoreStat.Judgment] * 0.03);
        const isCrit = Math.random() * 100 < critChance;
        if (isCrit) {
            const critDamagePercent = ((totalStats[CoreStat.CombatPower] * 0.4) + (totalStats[CoreStat.Calculation] * 0.3)) + (Math.random() * 20 - 10);
            userDamage *= (1 + critDamagePercent / 100);
        }
    
        if(activeDebuffs.user_combat_power_reduction_percent.turns > 0) {
            userDamage *= (1 - activeDebuffs.user_combat_power_reduction_percent.value / 100);
        }
        
        userDamage = Math.round(userDamage);
        const commentary = isCrit ? criticalAttackCommentaries[Math.floor(Math.random() * criticalAttackCommentaries.length)] : normalAttackCommentaries[Math.floor(Math.random() * normalAttackCommentaries.length)];
        const extraTurnText = isExtra ? ' (추가 턴)' : '';
        battleLog.push({ turn: turnsSurvived, icon: GUILD_ATTACK_ICON, message: `[${user.nickname}] ${commentary}${extraTurnText} | 보스 HP -${userDamage.toLocaleString()}${isCrit ? ' (크리티컬!)' : ''}`, isUserAction: true, isCrit });
        totalDamageDealt += userDamage;

        if (boss.hp - totalDamageDealt <= 0) {
            battleLog.push({ turn: turnsSurvived, icon: GUILD_ATTACK_ICON, message: `[${user.nickname}]의 마지막 일격!`, isUserAction: true });
            battleLog.push({ turn: turnsSurvived, message: `[${boss.name}]이 돌을 거두었습니다.`, isUserAction: false });
            totalDamageDealt = boss.hp;
            return true; // Boss defeated
        }
        return false;
    };
    
    const runUserFullTurn = () => {
        let bossDefeated = runUserTurn(false);
        if (bossDefeated) return true;

        const extraTurnChance = totalStats[CoreStat.ThinkingSpeed] * 0.02;
        if (Math.random() * 100 < extraTurnChance) {
            battleLog.push({ turn: turnsSurvived, icon: '/images/guild/skill/userskill4.png', message: `[추가공격] 빠르고 정확한 사고속도로 추가 턴을 획득합니다.`, isUserAction: true, isCrit: false });
            bossDefeated = runUserTurn(true);
            if (bossDefeated) return true;
        }
        
        // Research: Ignite
        const igniteLevel = researchLevels?.[GuildResearchId.boss_skill_ignite]?.level || 0;
        if (igniteLevel > 0) {
            const igniteChance = 10 + (igniteLevel * 15);
            if (Math.random() * 100 < igniteChance) {
                let igniteDamage = boss.maxHp * 0.001; // Base fixed damage is 0.1% of max HP.
                const igniteDamageIncreasePercent = igniteLevel * 10; // +10% damage per level
                igniteDamage *= (1 + igniteDamageIncreasePercent / 100);
                igniteDamage = Math.round(igniteDamage);

                totalDamageDealt += igniteDamage;
                battleLog.push({ turn: turnsSurvived, icon: GUILD_RESEARCH_IGNITE_IMG, message: `[연구-점화] 발동! 보스 HP -${igniteDamage.toLocaleString()}`, isUserAction: true });
                if (boss.hp - totalDamageDealt <= 0) {
                    battleLog.push({ turn: turnsSurvived, message: `[연구-점화]의 피해로 [${boss.name}]이 돌을 거두었습니다.`, isUserAction: false });
                    totalDamageDealt = boss.hp;
                    return true;
                }
            }
        }

        // Research: Regen
        const regenLevel = researchLevels?.[GuildResearchId.boss_skill_regen]?.level || 0;
        const regenChance = 10 + (regenLevel * 15);
        if (Math.random() * 100 < regenChance) {
            let healAmount = (totalStats[CoreStat.Stability] * 0.5);
            const healAmountIncreasePercent = regenLevel >= 1 ? (10 * regenLevel) : 0;
            healAmount *= (1 + healAmountIncreasePercent / 100);
            healAmount = Math.round(healAmount);
            userHp = Math.min(maxUserHp, userHp + healAmount);
            battleLog.push({ turn: turnsSurvived, icon: GUILD_RESEARCH_REGEN_IMG, message: `[연구-지속회복] 발동! HP +${healAmount.toLocaleString()}`, isUserAction: true, healingDone: healAmount });
        }
        
        return false;
    };

    const runBossFullTurn = () => {
        // Active Skill
        const activeSkills = boss.skills.filter((s): s is GuildBossActiveSkill => s.type === 'active');
        if (activeSkills.length > 0) {
            const bossSkill = activeSkills[Math.floor(Math.random() * activeSkills.length)];
            const performDuel = (stat: CoreStat): boolean => {
                const userStat = totalStats[stat];
                const successRate = (userStat / (userStat + 1000)) + (Math.random() * 0.29 + 0.01);
                return Math.random() < successRate;
            };

            let successfulDuels = 0;
            const statsToCheck = Array.isArray(bossSkill.checkStat) ? bossSkill.checkStat : [bossSkill.checkStat];
            
            for (const stat of statsToCheck) {
                const randomStat = Array.isArray(stat) ? stat[Math.floor(Math.random() * stat.length)] : stat;
                if (performDuel(randomStat)) successfulDuels++;
            }
            
            let turnBossDamage = 0;
            let turnBossHeal = 0;
            let duelResultMessage = '';
            const debuffsForLog: BattleLogEntry['debuffsApplied'] = [];

            // Special handling for complex skills
            if (bossSkill.id === '녹수_포자확산') {
                let damageRange: [number, number];
                if (successfulDuels >= 2) damageRange = [2000, 3000];
                else if (successfulDuels === 1) damageRange = [3000, 4000];
                else damageRange = [5000, 8000];
                turnBossDamage = getRandom(damageRange[0], damageRange[1]);
                duelResultMessage = `${successfulDuels} / 3회 성공`;
            } else if (bossSkill.id === '백광_천벌의일격') {
                let damageRange: [number, number];
                if (successfulDuels === 2) damageRange = [2000, 5000];
                else if (successfulDuels === 1) damageRange = [5000, 8000];
                else damageRange = [10000, 15000];
                turnBossDamage = getRandom(damageRange[0], damageRange[1]);
                duelResultMessage = `${successfulDuels} / 2회 성공`;
            } else {
                // Default logic for simple skills
                const duelSuccess = (['백광_천벌의일격', '녹수_숲의압박', '현묘_심리전'].includes(bossSkill.id)) ? successfulDuels > 0 : successfulDuels === statsToCheck.length;
                const skillEffectsToApply = duelSuccess ? bossSkill.onSuccess : bossSkill.onFailure;
                
                for (const effect of skillEffectsToApply) {
                    switch (effect.type) {
                        case 'damage': turnBossDamage += getRandom(effect.value![0], effect.value![1]) * (effect.hits || 1); break;
                        case 'hp_percent': turnBossDamage += Math.round(maxUserHp * (getRandom(effect.value![0], effect.value![1]) / 100)); break;
                        case 'heal': turnBossHeal += getRandom(effect.value![0], effect.value![1]); break;
                        case 'debuff': 
                            if (effect.debuffType) {
                                activeDebuffs[effect.debuffType] = { value: getRandom(effect.debuffValue![0], effect.debuffValue![1]), turns: effect.debuffDuration! };
                                debuffsForLog.push({ type: effect.debuffType, value: activeDebuffs[effect.debuffType].value, turns: activeDebuffs[effect.debuffType].turns });
                            }
                            break;
                    }
                }

                if (['백광_천벌의일격', '녹수_숲의압박', '현묘_심리전'].includes(bossSkill.id)) {
                     duelResultMessage = `${successfulDuels} / ${statsToCheck.length}회 성공`;
                } else {
                    duelResultMessage = duelSuccess ? '성공' : `${statsToCheck.length - successfulDuels}회 실패`;
                }
            }
            
            const finalDamageReduction = 200 / (200 + totalStats[CoreStat.Stability]);
            const finalBossDamage = Math.round(turnBossDamage * finalDamageReduction);
            userHp -= finalBossDamage;

            let logMessage = `[${boss.name}]의 ${bossSkill.name}! (대결 ${duelResultMessage})`;
            if (finalBossDamage > 0) logMessage += ` | 유저 HP -${finalBossDamage.toLocaleString()}`;
            if (turnBossHeal > 0) {
                totalDamageDealt -= turnBossHeal; // Subtract from damage dealt to reflect healing
                logMessage += ` | 보스 HP +${turnBossHeal.toLocaleString()}`;
            }
            battleLog.push({ turn: turnsSurvived, icon: bossSkill.image, message: logMessage, isUserAction: false, damageTaken: finalBossDamage, healingDone: turnBossHeal, debuffsApplied: debuffsForLog.length > 0 ? debuffsForLog : undefined });
        }
        
        if (userHp <= 0) return;

        // Passives
        const passiveSkills = boss.skills.filter((s): s is GuildBossPassiveSkill => s.type === 'passive');
        for (const pSkill of passiveSkills) {
             const performDuel = (stat: CoreStat): boolean => {
                const userStat = totalStats[stat];
                const successRate = (userStat / (userStat + 1000)) + (Math.random() * 0.29 + 0.01);
                return Math.random() < successRate;
            };
            const processPassiveEffect = (effect: GuildBossSkillSubEffect, turn: number) => {
                 switch(effect.type) {
                    case 'hp_percent':
                        const pDamage = Math.round(maxUserHp * (getRandom(effect.value![0], effect.value![1]) / 100));
                        userHp -= pDamage;
                        battleLog.push({ turn, icon: pSkill.image, message: `[${boss.name}]의 ${pSkill.name} 발동! | 유저 HP -${pDamage.toLocaleString()}`, isUserAction: false, damageTaken: pDamage });
                        break;
                    case 'debuff':
                         activeDebuffs[effect.debuffType!] = { value: getRandom(effect.debuffValue![0], effect.debuffValue![1]), turns: effect.debuffDuration! };
                         battleLog.push({ turn, icon: pSkill.image, message: `[${boss.name}]의 ${pSkill.name} 발동! 유저의 회복량이 감소합니다.`, isUserAction: false });
                        break;
                    case 'heal':
                        let pHeal = getRandom(effect.value![0], effect.value![1]);
                        const healBlockLevel = researchLevels?.[GuildResearchId.boss_skill_heal_block]?.level || 0;
                        const blockChance = 10 + (15 * healBlockLevel);
                        if (Math.random() * 100 < blockChance) {
                            battleLog.push({ turn, icon: GUILD_RESEARCH_HEAL_BLOCK_IMG, message: `[연구-회복불가] 발동! 보스의 회복을 막았습니다!`, isUserAction: true });
                            pHeal = 0; // Block heal
                        } else {
                            if (healBlockLevel > 0) {
                                const healReductionPercent = 10 * healBlockLevel;
                                const originalHeal = pHeal;
                                pHeal *= (1 - (healReductionPercent / 100));
                                pHeal = Math.round(pHeal);
                                if (pHeal < originalHeal) {
                                    battleLog.push({ turn, icon: GUILD_RESEARCH_HEAL_BLOCK_IMG, message: `[연구-회복불가] 실패! 보스 회복량 ${healReductionPercent}% 감소.`, isUserAction: true });
                                }
                            }
                        }
                        totalDamageDealt -= pHeal;
                        battleLog.push({ turn: turnsSurvived, icon: pSkill.image, message: `[${boss.name}]의 ${pSkill.name} 발동! | 보스 HP +${pHeal.toLocaleString()}`, isUserAction: false, healingDone: pHeal });
                        break;
                }
            };
            if (pSkill.passiveTrigger === 'always') pSkill.passiveEffect.forEach(e => processPassiveEffect(e, turnsSurvived));
            else if (pSkill.passiveTrigger === 'every_turn' && pSkill.checkStat && !performDuel(pSkill.checkStat)) pSkill.passiveEffect.forEach(e => processPassiveEffect(e, turnsSurvived));
            else if (pSkill.passiveTrigger === 'on_user_heal' && pSkill.passiveChance && Math.random() < pSkill.passiveChance) pSkill.passiveEffect.forEach(e => processPassiveEffect(e, turnsSurvived));
        }

        // Decrement debuffs
        Object.keys(activeDebuffs).forEach(key => {
            if (activeDebuffs[key as keyof typeof activeDebuffs].turns > 0) {
                activeDebuffs[key as keyof typeof activeDebuffs].turns--;
            }
        });
    };
    
    for (let turn = 1; turn <= BATTLE_TURNS; turn++) {
        turnsSurvived = turn;
        let bossDefeated = false;

        const firstAttackChance = totalStats[CoreStat.ThinkingSpeed] * 0.02;
        const userAttacksFirst = Math.random() * 100 < firstAttackChance;

        if (turn === 1) {
            if (userAttacksFirst) {
                battleLog.push({ turn: 1, message: `[${user.nickname}]님의 사고속도가 높아 선제공격에 성공합니다!`, isUserAction: true });
                bossDefeated = runUserFullTurn();
                if (!bossDefeated && userHp > 0) runBossFullTurn();
            } else {
                battleLog.push({ turn: 1, message: `[${boss.name}]의 사고속도가 높아 선제공격에 성공합니다!`, isUserAction: false });
                runBossFullTurn();
                if (userHp > 0) bossDefeated = runUserFullTurn();
            }
        } else {
            bossDefeated = runUserFullTurn();
            if (!bossDefeated && userHp > 0) runBossFullTurn();
        }
        
        if (bossDefeated || userHp <= 0) break;

        if (turn === 30) {
             battleLog.push({
                turn,
                icon: BOSS_SKILL_ICON_MAP[boss.skills[0].id],
                message: `[${boss.name}]의 필살기! [천지개벽]! 하늘과 땅이 뒤틀리는 힘이 당신을 덮칩니다!`,
                isUserAction: false,
                damageTaken: 999999
            });
            userHp = -999999;
            break;
        }
    }
    
    const rewardCoins = 20 + Math.floor(Math.min(1, totalDamageDealt / 2000000) * 80);

    return {
        damageDealt: Math.max(0, Math.round(totalDamageDealt)),
        turnsSurvived,
        rewards: { guildCoins: rewardCoins },
        battleLog,
        bossHpBefore: boss.hp,
        bossHpAfter: Math.max(0, Math.round(boss.hp - Math.max(0, totalDamageDealt))),
        bossMaxHp: boss.maxHp,
        userHp: Math.max(0, userHp),
        maxUserHp,
    };
};
