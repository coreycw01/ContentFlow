import type { Settings } from '../domain/types';
import { AnthropicEngine } from './anthropicEngine';
import { localEngine } from './localEngine';
import type { CreativeEngine } from './types';

let cached: { key: string; model: string; engine: CreativeEngine } | null = null;

/**
 * The local engine is always available. Claude is used when a key is present,
 * and every Claude method falls back to the local engine on failure — so the
 * app never dead-ends on a network error.
 */
export function engineFor(settings: Settings): CreativeEngine {
  if (settings.aiProvider !== 'anthropic' || !settings.anthropicApiKey.trim()) {
    return localEngine;
  }
  const key = settings.anthropicApiKey.trim();
  const model = settings.anthropicModel || 'claude-opus-5';
  if (cached && cached.key === key && cached.model === model) return cached.engine;
  const engine = new AnthropicEngine(key, model);
  cached = { key, model, engine };
  return engine;
}

export { localEngine };
export type { CreativeEngine } from './types';
