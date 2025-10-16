// server/services/statService.ts

// This file is refactored to act as a re-exporter from the single source of truth in utils.
// This eliminates code duplication and ensures consistency.
export { calculateUserEffects, calculateTotalStats, createDefaultBaseStats } from '../../utils/statUtils.js';