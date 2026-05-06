/**
 * Backwards-compatibility shim.
 *
 * The API client has been refactored into src/utils/api/ (see index.ts).
 * This file re-exports everything so all existing import paths remain valid:
 *
 *   import { fetchTargetWord, ... } from '../utils/api'   // still works ✓
 */
export * from './api/index';
