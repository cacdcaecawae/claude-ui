import { existsSync } from 'node:fs';
import { resolve, parse as parsePath } from 'node:path';

export function detectWorkspace(cwd: string): string {
  const markers = ['.claude', '.git', 'package.json'];

  for (const marker of markers) {
    let dir = cwd;
    while (true) {
      if (existsSync(resolve(dir, marker))) {
        return dir;
      }
      const parent = resolve(dir, '..');
      if (parent === dir || parent === parsePath(dir).root) break;
      dir = parent;
    }
  }

  return cwd;
}
