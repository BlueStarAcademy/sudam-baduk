// server/guildBossSimulator.ts
import { User, Guild, GuildBossInfo, QuestReward, MannerEffects, GuildResearchId, GuildBossSkill, GuildBossActiveSkill, GuildBossPassiveSkill, GuildBossSkillEffect, GuildBossSkillSubEffect, CoreStat, SpecialStat, MythicStat } from '../types/index.js';
import { GUILD_BOSSES, GUILD_RESEARCH_PROJECTS, ACTION_POINT_REGEN_INTERVAL_MS } from '../constants/index.js';
import { BOSS_SKILL_ICON_MAP, GUILD_ATTACK_ICON, GUILD_RESEARCH_REGEN_IMG, GUILD_RESEARCH_HEAL_BLOCK_IMG, GUILD_RESEARCH_IGNITE_IMG } from '../assets.js';
import { calculateUserEffects } from '../services/effectService.js';
import { calculateTotalStats } from '../services/statService.js';

// Define and export types locally
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

const getRandom = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const normalAttackCommentaries = ['침착한 한수로 응수합니다.', '정확하게 약점을 노립니다.', '흐름을 가져오는 일격입니다.', '단단하게 지켜냅니다.'];
const criticalAttackCommentaries = ['사활문제를 풀어냈습니다!', '엄청난 집중력으로 좋은 한수를 둡니다.', '예리한 묘수로 허를 찌릅니다!', '판세를 뒤흔드는 신의 한수!'];


export const runGuildBossBattle = (user: User, guild: Guild, boss: GuildBossInfo): GuildBossBattleResult => {
    const totalStats = calculateTotalStats(user, guild);
    const effects = calculateUserEffects(user, guild);
    const BATTLE_TURNS = 40;

    const hpIncreaseLevel = guild.research?.boss_hp_increase?.level || 0;
    const hpBonusPercent = hpIncreaseLevel > 0 ? GUILD_RESEARCH_PROJECTS[GuildResearchId.boss_hp_increase].baseEffect * hpIncreaseLevel : 0;
    const maxUserHp = Math.round((10000 + (totalStats[CoreStat.Concentration] * 10)) * (1 + hpBonusPercent / 100));
    let userHp = maxUserHp;

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

    for (let turn = 1; turn <= BATTLE_TURNS; turn++) {
        turnsSurvived = turn;

        // --- User's Turn ---
        let userDamage = (totalStats[CoreStat.CombatPower] * 2.3) + (totalStats[CoreStat.Judgment] * 1.6) + (totalStats[CoreStat.Calculation] * 1.2);
        userDamage *= (1 + (effects.specialStatBonuses[SpecialStat.GuildBossDamage].percent || 0) / 100);
        userDamage *= (1 + (Math.random() * 0.2 - 0.1)); // ±10%
        if(activeDebuffs.user_combat_power_reduction_percent.turns > 0) {
            userDamage *= (1 - activeDebuffs.user_combat_power_reduction_percent.value / 100);
        }

        const critChance = 15 + (totalStats[CoreStat.Judgment] * 0.03);
        const isCrit = Math.random() * 100 < critChance;
        if (isCrit) {
            const critDamagePercent = ((totalStats[CoreStat.CombatPower] * 0.3) + (totalStats[CoreStat.Calculation] * 0.2)) + (Math.random() * 20 - 10);
            userDamage *= (1 + critDamagePercent / 100);
        }
        userDamage = Math.round(userDamage);
        
        const commentary = isCrit ? criticalAttackCommentaries[Math.floor(Math.random() * criticalAttackCommentaries.length)] : normalAttackCommentaries[Math.floor(Math.random() * normalAttackCommentaries.length)];
        battleLog.push({ turn, icon: GUILD_ATTACK_ICON, message: `[${user.nickname}] ${commentary} | 보스 HP -${userDamage.toLocaleString()}${isCrit ? ' (크리티컬!)' : ''}`, isUserAction: true, isCrit });
        totalDamageDealt += userDamage;

        // --- Boss's Turn ---
        const activeSkills = boss.skills.filter((s): s is GuildBossActiveSkill => s.type === 'active');
        if (activeSkills.length === 0) continue;

        const bossSkill = activeSkills[Math.floor(Math.random() * activeSkills.length)];
        
        const performDuel = (stat: CoreStat): boolean => {
            const userStat = totalStats[stat];
            const successRate = (userStat / (userStat + 1000)) + (Math.random() * 0.29 + 0.01); // 1% ~ 30% bonus
            return Math.random() < successRate;
        };

        let successfulDuels = 0;
        const statsToCheck = Array.isArray(bossSkill.checkStat) ? bossSkill.checkStat : [bossSkill.checkStat];
        
        for (const stat of statsToCheck) {
            if (performDuel(stat)) {
                successfulDuels++;
            }
        }
        
        const duelSuccess = (bossSkill.id === '백광_천벌의일격') 
            ? successfulDuels > 0 // 천벌의 일격: 하나라도 성공하면 성공
            : successfulDuels === statsToCheck.length; // Other skills: all must succeed

        // Safety Check: Ensure onSuccess/onFailure exist
        if (!bossSkill.onSuccess || !bossSkill.onFailure) {
            console.error(`[GuildBossSim] Invalid skill data for boss ${boss.id}, skill ${bossSkill.id}. Missing onSuccess/onFailure.`);
            continue; // Skip this skill to prevent crash
        }

        const skillEffectsToApply = duelSuccess ? bossSkill.onSuccess : bossSkill.onFailure;
        
        let turnBossDamage = 0;
        let turnBossHeal = 0;

        for (const effect of skillEffectsToApply) {
            switch (effect.type) {
                case 'damage':
                    turnBossDamage += getRandom(effect.value![0], effect.value![1]) * (effect.hits || 1);
                    break;
                case 'hp_percent':
                    turnBossDamage += Math.round(maxUserHp * (getRandom(effect.value![0], effect.value![1]) / 100));
                    break;
                case 'heal':
                    turnBossHeal += getRandom(effect.value![0], effect.value![1]);
                    break;
                case 'debuff':
                    if (effect.debuffType) {
                        activeDebuffs[effect.debuffType] = { value: getRandom(effect.debuffValue![0], effect.debuffValue![1]), turns: effect.debuffDuration! };
                    }
                    break;
            }
        }
        
        let duelResultMessage = duelSuccess ? '성공' : `${statsToCheck.length - successfulDuels}회 실패`;
        if (['백광_천벌의일격', '녹수_숲의압박', '현묘_심리전'].includes(bossSkill.id)) {
             duelResultMessage = `${successfulDuels} / ${statsToCheck.length}회 성공`;
        }
        
        const finalDamageReduction = 200 / (200 + totalStats[CoreStat.Stability]);
        const finalBossDamage = Math.round(turnBossDamage * finalDamageReduction);
        userHp -= finalBossDamage;

        let logMessage = `[${boss.name}]의 ${bossSkill.name}! (대결 ${duelResultMessage})`;
        if(finalBossDamage > 0) logMessage += ` | 유저 HP -${finalBossDamage.toLocaleString()}`;
        if(turnBossHeal > 0) {
            totalDamageDealt -= turnBossHeal;
            logMessage += ` | 보스 HP +${turnBossHeal.toLocaleString()}`;
        }
        battleLog.push({ turn, icon: bossSkill.image, message: logMessage, isUserAction: false, damageTaken: finalBossDamage, healingDone: turnBossHeal });

        if (userHp <= 0) break;
        
        // --- Passive Skills ---
        const passiveSkills = boss.skills.filter((s): s is GuildBossPassiveSkill => s.type === 'passive');
        for (const pSkill of passiveSkills) {
            const processPassiveEffect = (effect: GuildBossSkillSubEffect) => {
                switch(effect.type) {
                    case 'hp_percent':
                        const pDamage = Math.round(maxUserHp * (getRandom(effect.value![0], effect.value![1]) / 100));
                        userHp -= pDamage;
                        battleLog.push({ turn, icon: pSkill.image, message: `[${boss.name}]의 ${pSkill.name} 발동! | 유저 HP -${pDamage.toLocaleString()}`, isUserAction: false, damageTaken: pDamage });
                        break;
                    case 'debuff':
                         activeDebuffs[effect.debuffType!] = {
                             value: getRandom(effect.debuffValue![0], effect.debuffValue![1]),
                             turns: effect.debuffDuration!,
                         };
                         battleLog.push({ turn, icon: pSkill.image, message: `[${boss.name}]의 ${pSkill.name} 발동! 유저의 회복량이 감소합니다.`, isUserAction: false });
                        break;
                }
            };
            
            if (pSkill.passiveTrigger === 'always') {
                pSkill.passiveEffect.forEach(processPassiveEffect);
            } else if (pSkill.passiveTrigger === 'every_turn' && pSkill.checkStat) {
                if (!performDuel(pSkill.checkStat)) {
                    pSkill.passiveEffect.forEach(processPassiveEffect);
                }
            } else if (pSkill.passiveTrigger === 'on_user_heal' && pSkill.passiveChance) {
                 if (Math.random() < pSkill.passiveChance) {
                     pSkill.passiveEffect.forEach(processPassiveEffect);
                 }
            }
        }
        
        // Decrement debuffs
        Object.keys(activeDebuffs).forEach(key => {
            if (activeDebuffs[key as keyof typeof activeDebuffs].turns > 0) {
                activeDebuffs[key as keyof typeof activeDebuffs].turns--;
            }
        });
        if (userHp <= 0) break;
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