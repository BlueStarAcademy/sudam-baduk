import type { User, Guild, MannerEffects } from '../../types/index.js';
// FIX: Export `calculateUserEffects` to make it available to other modules.
export { calculateUserEffects } from '../../utils/statUtils.js';
import { calculateUserEffects } from '../../utils/statUtils.js';
import { ACTION_POINT_REGEN_INTERVAL_MS } from '../../constants/index.js';

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