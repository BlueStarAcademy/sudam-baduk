
import type { User, Guild, MannerEffects } from '../types/index';
import { CoreStat, SpecialStat, MythicStat, GuildResearchId } from '../types/index';
import { GUILD_RESEARCH_PROJECTS, ACTION_POINT_REGEN_INTERVAL_MS } from '../constants/index';
import { getMannerEffects } from './manner';

export interface CalculatedEffects extends MannerEffects {
    maxActionPoints: number;
    actionPointRegenInterval: number;
    coreStatBonuses: Record<CoreStat, { flat: number; percent: number }>;
    specialStatBonuses: Record<SpecialStat, { flat: number; percent: number }>;
    mythicStatBonuses: Record<MythicStat, { flat: number; percent: number; }>,
    strategicGoldBonusPercent: number;
    playfulGoldBonusPercent: number;
    strategicXpBonusPercent: number;
    playfulXpBonusPercent: number;
}

const researchIdToCoreStat: Partial<Record<GuildResearchId, CoreStat>> = {
    [GuildResearchId.stat_concentration]: CoreStat.Concentration,
    [GuildResearchId.stat_thinking_speed]: CoreStat.ThinkingSpeed,
    [GuildResearchId.stat_judgment]: CoreStat.Judgment,
    [GuildResearchId.stat_calculation]: CoreStat.Calculation,
    [GuildResearchId.stat_combat_power]: CoreStat.CombatPower,
    [GuildResearchId.stat_stability]: CoreStat.Stability,
};

export const calculateUserEffects = (user: User, guild: Guild | null): CalculatedEffects => {
    const effects = getMannerEffects(user);

    const calculatedEffects: CalculatedEffects = {
        ...effects,
        coreStatBonuses: {} as Record<CoreStat, { flat: number; percent: number }>,
        specialStatBonuses: {} as Record<SpecialStat, { flat: number; percent: number }>,
        mythicStatBonuses: {} as Record<MythicStat, { flat: number; percent: number; }>,
        strategicGoldBonusPercent: 0,
        playfulGoldBonusPercent: 0,
        strategicXpBonusPercent: 0,
        playfulXpBonusPercent: 0,
    };

    for (const key of Object.values(CoreStat) as CoreStat[]) {
        calculatedEffects.coreStatBonuses[key] = { flat: 0, percent: 0 };
    }
    for (const key of Object.values(SpecialStat) as SpecialStat[]) {
        calculatedEffects.specialStatBonuses[key] = { flat: 0, percent: 0 };
    }
    for (const key of Object.values(MythicStat) as MythicStat[]) {
        calculatedEffects.mythicStatBonuses[key] = { flat: 0, percent: 0 };
    }

    const equippedItems = user.inventory.filter(i => i.isEquipped && i.type === 'equipment' && i.options);

    for (const item of equippedItems) {
        const allOptions = [item.options!.main, ...item.options!.combatSubs, ...item.options!.specialSubs, ...item.options!.mythicSubs];
        for (const opt of allOptions) {
            if (!opt) continue;

            const { type, value, isPercentage } = opt;

            if (Object.values(CoreStat).includes(type as CoreStat)) {
                if (isPercentage) {
                    calculatedEffects.coreStatBonuses[type as CoreStat].percent += value;
                } else {
                    calculatedEffects.coreStatBonuses[type as CoreStat].flat += value;
                }
            } else if (Object.values(SpecialStat).includes(type as SpecialStat)) {
                 if (isPercentage) {
                    calculatedEffects.specialStatBonuses[type as SpecialStat].percent += value;
                } else {
                    calculatedEffects.specialStatBonuses[type as SpecialStat].flat += value;
                }
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
                            break;
                    }
                }
            }
        }
    }
    
    calculatedEffects.maxActionPoints += calculatedEffects.specialStatBonuses[SpecialStat.ActionPointMax]?.flat ?? 0;
    const regenBonusPercent = calculatedEffects.specialStatBonuses[SpecialStat.ActionPointRegen]?.percent ?? 0;
    if (regenBonusPercent > 0) {
        calculatedEffects.actionPointRegenInterval = Math.floor(calculatedEffects.actionPointRegenInterval / (1 + regenBonusPercent / 100));
    }
    
    return calculatedEffects;
};

export const regenerateActionPoints = (user: User, guild: Guild | null): User => {
    const effects = calculateUserEffects(user, guild);
    const now = Date.now();
    
    const calculatedMaxAP = effects.maxActionPoints;
    let userModified = false;
    const updatedUser = JSON.parse(JSON.stringify(user));

    if (updatedUser.actionPoints.max !== calculatedMaxAP) {
        updatedUser.actionPoints.max = calculatedMaxAP;
        userModified = true;
    }
    
    if (updatedUser.actionPoints.current >= calculatedMaxAP) {
        if (updatedUser.lastActionPointUpdate !== 0) {
             updatedUser.lastActionPointUpdate = 0;
             userModified = true;
        }
        return userModified ? updatedUser : user;
    }

    if (updatedUser.lastActionPointUpdate === 0) {
        updatedUser.lastActionPointUpdate = now;
        userModified = true;
    }

    const lastUpdate = updatedUser.lastActionPointUpdate;
    if (typeof lastUpdate !== 'number' || isNaN(lastUpdate)) {
        updatedUser.lastActionPointUpdate = now;
        return updatedUser;
    }

    if (!effects.actionPointRegenInterval || effects.actionPointRegenInterval <= 0) {
        console.error(`[AP Regen] Invalid regen interval for user ${user.id}: ${effects.actionPointRegenInterval}. Aborting AP regen.`);
        return userModified ? updatedUser : user;
    }
    
    const elapsedMs = now - lastUpdate;
    const pointsToAdd = Math.floor(elapsedMs / effects.actionPointRegenInterval);

    if (pointsToAdd > 0) {
        userModified = true;
        updatedUser.actionPoints.current = Math.min(calculatedMaxAP, updatedUser.actionPoints.current + pointsToAdd);
        updatedUser.lastActionPointUpdate = lastUpdate + pointsToAdd * effects.actionPointRegenInterval;
        
        if(updatedUser.actionPoints.current >= calculatedMaxAP) {
            updatedUser.lastActionPointUpdate = 0;
        }
    }
    return userModified ? updatedUser : user;
};