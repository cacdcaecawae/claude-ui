import type { StorageAdapter } from './types';
import { locateClaudeStorage } from './detect';
import { NativeAdapter } from './native';
import { FallbackAdapter } from './fallback';

export type { StorageAdapter };

let cachedAdapter: StorageAdapter | null = null;

export async function createAdapter(): Promise<StorageAdapter> {
  if (cachedAdapter) return cachedAdapter;

  const workspace = process.env.CLAUDE_WEB_WORKSPACE || process.cwd();

  try {
    const storage = locateClaudeStorage(workspace);
    if (storage.found && storage.format === 'jsonl') {
      const adapter = new NativeAdapter(storage);
      await adapter.verify();
      cachedAdapter = adapter;
      console.log(`[adapter] Using native adapter (format: ${storage.format}, path: ${storage.path})`);
      return adapter;
    }
  } catch (e) {
    console.warn('[adapter] Native adapter failed, falling back:', e);
  }

  const adapter = new FallbackAdapter();
  cachedAdapter = adapter;
  console.log('[adapter] Using fallback adapter');
  return adapter;
}

export function getAdapter(): StorageAdapter | null {
  return cachedAdapter;
}
