// This file centralizes all image assets for the game for easy management and future updates.

// Corrected import paths for constants from their specific files.
import {
    emptySlotImages, EQUIPMENT_POOL, CONSUMABLE_ITEMS, MATERIAL_ITEMS, TOURNAMENT_DEFINITIONS, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, LEAGUE_DATA, RANKING_TIERS, AVATAR_POOL, BORDER_POOL
} from '../constants.js';
import { WHITE_BASE_STONE_IMG, BLACK_BASE_STONE_IMG, WHITE_HIDDEN_STONE_IMG, BLACK_HIDDEN_STONE_IMG, STRATEGIC_GO_LOBBY_IMG, PLAYFUL_GO_LOBBY_IMG, TOURNAMENT_LOBBY_IMG, SINGLE_PLAYER_LOBBY_IMG, TOWER_CHALLENGE_LOBBY_IMG } from '../assets.js';
// Import ItemGrade to resolve type error.
// FIX: Corrected import path for types.
// FIX: Removed GameModeInfo, LeagueData, RankingTier as they are not exported from types.
import { ItemGrade, type TournamentDefinition, type AvatarInfo, type BorderInfo, type InventoryItem } from '../types/index.js';

const gradeBackgrounds: Record<ItemGrade, string> = {
    [ItemGrade.Normal]: '/images/equipments/normalbgi.png',
    [ItemGrade.Uncommon]: '/images/equipments/uncommonbgi.png',
    [ItemGrade.Rare]: '/images/equipments/rarebgi.png',
    [ItemGrade.Epic]: '/images/equipments/epicbgi.png',
    [ItemGrade.Legendary]: '/images/equipments/legendarybgi.png',
    [ItemGrade.Mythic]: '/images/equipments/mythicbgi.png',
};

const starImages = [
    '/images/equipments/Star1.png',
    '/images/equipments/Star2.png',
    '/images/equipments/Star3.png',
    '/images/equipments/Star4.png',
];

const uiImages = [
    '/images/Gold.png',
    '/images/Zem.png',
    '/images/quest.png',
    '/images/gibo.png',
    '/images/mail.png',
    '/images/store.png',
    '/images/bag.png',
    '/images/BlankEquipmentsSlot.png'
];

const allUrls = new Set<string>();

const addUrls = (urls: (string | undefined | null)[]) => {
    for (const url of urls) {
        if (url && typeof url === 'string' && url.startsWith('/')) {
            allUrls.add(url);
        }
    }
};

addUrls(Object.values(emptySlotImages));
addUrls(Object.values(TOURNAMENT_DEFINITIONS).map((d) => (d as TournamentDefinition).image));
addUrls(SPECIAL_GAME_MODES.map(m => m.image));
addUrls(PLAYFUL_GAME_MODES.map(m => m.image));
addUrls(LEAGUE_DATA.map(l => l.icon));
addUrls(AVATAR_POOL.map((a: AvatarInfo) => a.url));
addUrls(BORDER_POOL.map((b: BorderInfo) => b.url));
addUrls(RANKING_TIERS.map(t => t.icon));
addUrls(EQUIPMENT_POOL.map((e: Omit<InventoryItem, 'id' | 'createdAt' | 'isEquipped' | 'level' | 'options' | 'quantity' | 'stars' | 'enhancementFails'>) => e.image));
addUrls(Object.values(CONSUMABLE_ITEMS).map(c => c.image));
addUrls(Object.values(MATERIAL_ITEMS).map(m => m.image));
addUrls([WHITE_BASE_STONE_IMG, BLACK_BASE_STONE_IMG, WHITE_HIDDEN_STONE_IMG, BLACK_HIDDEN_STONE_IMG, STRATEGIC_GO_LOBBY_IMG, PLAYFUL_GO_LOBBY_IMG, TOURNAMENT_LOBBY_IMG, SINGLE_PLAYER_LOBBY_IMG, TOWER_CHALLENGE_LOBBY_IMG]);
addUrls(Object.values(gradeBackgrounds));
addUrls(starImages);
addUrls(uiImages);

export const ALL_IMAGE_URLS = Array.from(allUrls);

export const preloadImages = (urls: string[]): Promise<(Event | string)[]> => {
    const promises = urls.map(url => {
        return new Promise<Event | string>((resolve) => {
            const img = new Image();
            img.src = url;
            img.onload = resolve;
            // Resolve on error too, so one failed image doesn't block everything.
            img.onerror = (err) => resolve(`Failed to load ${url}: ${err.toString()}`); 
        });
    });
    return Promise.all(promises);
};
