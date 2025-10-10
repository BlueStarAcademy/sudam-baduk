import { GameMode, AppRoute } from "../types/index.js";
import { GAME_MODE_BY_SLUG } from '../constants/gameModes.js';
import { stableStringify as stableStringifyUtil } from './stableStringify.js';

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