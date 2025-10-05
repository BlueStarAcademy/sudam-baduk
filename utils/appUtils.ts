import { GameMode, AppRoute } from "../types/index";
import { GAME_MODE_BY_SLUG } from '../constants/gameModes';

const stableStringifyUtil = (data: any): string => {
    const processValue = (value: any): any => {
        if (value === null || typeof value !== 'object') {
            return value;
        }

        if (Array.isArray(value)) {
            // Arrays are not sorted to preserve order, but their contents are processed.
            return value.map(processValue);
        }
        
        // For objects, sort keys alphabetically to ensure consistent output
        const sortedKeys = Object.keys(value).sort();
        const newObj: { [key: string]: any } = {};
        for (const key of sortedKeys) {
            newObj[key] = processValue(value[key]);
        }
        return newObj;
    };
    
    return JSON.stringify(processValue(data));
};


export function parseHash(hash: string): AppRoute {
    const path = hash.replace(/^#\/?/, '');
    const [view, ...rest] = path.split('/');

    switch (view) {
        case 'lobby': return { view: 'lobby', params: { type: rest[0] || 'strategic' } };
        case 'waiting': {
            const slug = rest[0];
            const mode = slug ? GAME_MODE_BY_SLUG.get(slug) || null : null;
            return { view: 'waiting', params: { mode } };
        }
        case 'game': return { view: 'game', params: { id: rest[0] } };
        case 'tournament': return { view: 'tournament', params: {} };
        case 'singleplayer': return { view: 'singleplayer', params: {} };
        case 'towerchallenge': return { view: 'towerchallenge', params: {} };
        case 'guild': return { view: 'guild', params: {} };
        case 'guildboss': return { view: 'guildboss', params: {} };
        case 'guildwar': return { view: 'guildwar', params: {} };
        case 'admin': return { view: 'admin', params: {} };
        case 'profile': return { view: 'profile', params: {} };
        default: return { view: 'profile', params: {} };
    }
}

export const stableStringify = stableStringifyUtil;