
// This file acts as a barrel file, re-exporting all types from the new modular structure.
// This allows other files to continue importing from './types.js' without any changes.

// FIX: Correctly export from all modularized type files.
export * from './enums.js';
export * from './entities.js';
export * from './api.js';
export * from './navigation.js';
// FIX: Export settings types to resolve import errors in other files.
export type { Theme, SoundCategory, GraphicsSettings, SoundSettings, FeatureSettings, AppSettings } from './settings.js';
