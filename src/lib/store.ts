import type { StorageAdapter } from '@/lib/adapter';

let adapter: StorageAdapter | null = null;

export function setAdapter(a: StorageAdapter): void {
  adapter = a;
}

export function getStoredAdapter(): StorageAdapter | null {
  return adapter;
}
