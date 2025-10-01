// Removed unused imports to break a circular dependency that was causing module loading failures.

export type AppRoute = {
    // Add 'guildboss' to the AppRoute view types.
    view: 'profile' | 'lobby' | 'waiting' | 'game' | 'admin' | 'tournament' | 'singleplayer' | 'towerchallenge' | 'guild' | 'guildboss';
    params: any;
};

export {};
