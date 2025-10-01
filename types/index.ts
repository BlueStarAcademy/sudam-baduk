// This file acts as a barrel file, re-exporting all types from the new modular structure.
// This allows other files to continue importing from './types/index.js' without any changes.

export * from './enums.js';
// Export from entities and api to make types available.
// Resolve export conflicts by explicitly renaming the types from api.ts
export * from './entities.js';
export type {
    UserStatusInfo,
    AppState,
    VolatileState,
    ServerActionType,
    ServerAction,
    HandleActionResult,
    GameProps,
    AdminProps,
    UserCredentials,
} from './api.js';
export * from './navigation.js';
// Export all necessary types from settings to avoid circular dependencies and resolve import errors.
export * from './settings.js';
