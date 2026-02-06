import { existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import type { StorageDetectionResult } from './types';

/**
 * Encode a workspace absolute path into Claude Code's project key format.
 * Claude replaces every `/` with `-`.
 * e.g. `/Users/lymac/Desktop/works/claude-ui` → `-Users-lymac-Desktop-works-claude-ui`
 */
export function encodeProjectKey(workspacePath: string): string {
  return workspacePath.replace(/\//g, '-');
}

/**
 * Locate the Claude Code session storage for a given workspace.
 *
 * Claude stores sessions under:
 *   ~/.claude/projects/{projectKey}/
 * where projectKey = workspace path with `/` replaced by `-`.
 *
 * Each session is a JSONL file: {sessionId}.jsonl
 * An optional sessions-index.json contains metadata.
 */
export function locateClaudeStorage(workspace?: string): StorageDetectionResult {
  const claudeDir = resolve(homedir(), '.claude');

  if (!existsSync(claudeDir)) {
    return { found: false, path: '', format: 'unknown', details: { reason: 'No ~/.claude directory' } };
  }

  const projectsDir = join(claudeDir, 'projects');
  if (!existsSync(projectsDir)) {
    return { found: false, path: projectsDir, format: 'unknown', details: { reason: 'No ~/.claude/projects directory' } };
  }

  // If a workspace is provided, look for that specific project directory
  if (workspace) {
    const projectKey = encodeProjectKey(workspace);
    const projectPath = join(projectsDir, projectKey);

    if (existsSync(projectPath)) {
      const entries = readdirSync(projectPath);
      const jsonlFiles = entries.filter((e) => e.endsWith('.jsonl'));
      const hasIndex = entries.includes('sessions-index.json');

      return {
        found: true,
        path: projectPath,
        format: 'jsonl',
        details: {
          projectKey,
          workspace,
          sessionCount: jsonlFiles.length,
          hasIndex,
          claudeDir,
          projectsDir,
        },
      };
    }

    // Project directory doesn't exist yet — will be created when first session starts
    return {
      found: true,
      path: projectPath,
      format: 'jsonl',
      details: {
        projectKey,
        workspace,
        sessionCount: 0,
        hasIndex: false,
        claudeDir,
        projectsDir,
        note: 'Project directory does not exist yet; will be created on first session.',
      },
    };
  }

  // No workspace specified — just confirm projects dir exists
  try {
    const projectDirs = readdirSync(projectsDir);
    return {
      found: true,
      path: projectsDir,
      format: 'jsonl',
      details: {
        projectCount: projectDirs.length,
        claudeDir,
        projectsDir,
      },
    };
  } catch {
    return { found: false, path: projectsDir, format: 'unknown', details: { reason: 'Cannot read projects directory' } };
  }
}
