const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Generate a short, human-readable ID.
 * Uses 5 characters from a set excluding confusing chars (i, l, o, 0, 1).
 * Character set: abcdefghjkmnpqrstuvwxyz23456789 (32 chars)
 * Total combinations: 32^5 = 33,554,432
 *
 * @param {Set<string>} existingIds - Set of existing IDs to avoid collisions
 * @returns {string} 5-character ID
 */
function generateId(existingIds = new Set()) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const length = 5;

  let id;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    id = '';
    for (let i = 0; i < length; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    attempts++;
  } while (existingIds.has(id) && attempts < maxAttempts);

  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique ID after 100 attempts');
  }

  return id;
}

/**
 * Strip thinking tags from response and separate thinking from content.
 * Handles <think>...</think> tags from reasoning models.
 *
 * @param {string} response - Raw response text
 * @returns {{thinking: string|null, content: string}} Separated thinking and content
 */
function stripThinking(response) {
  if (!response || typeof response !== 'string') {
    return { thinking: null, content: response || '' };
  }

  const thinkEndTag = '</think>';
  if (response.includes(thinkEndTag)) {
    const endIndex = response.indexOf(thinkEndTag);
    const thinkingPart = response.substring(0, endIndex);
    const contentPart = response.substring(endIndex + thinkEndTag.length);

    // Remove opening <think> tag and trim
    const thinking = thinkingPart.replace(/^<think>\s*/i, '').trim();
    const content = contentPart.trim();

    return { thinking, content };
  }

  return { thinking: null, content: response };
}

/**
 * Find the git repository root by traversing up from startPath.
 * @param {string} startPath - Starting directory path
 * @returns {string|null} Git root path or null if not in a repo
 */
function findGitRoot(startPath) {
  let dir = startPath;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

/**
 * Get the git remote origin URL.
 * @param {string} gitRoot - Git repository root path
 * @returns {string|null} Remote URL or null if not configured
 */
function getGitRemote(gitRoot) {
  try {
    const result = execSync('git config --get remote.origin.url', {
      cwd: gitRoot,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return result.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Detect scope information for the current working directory.
 * Scope is tied to the repository (by remote URL), not the branch.
 * @param {string} cwd - Current working directory
 * @returns {Object} Scope object with type, path, and optional git info
 */
function detectScope(cwd) {
  const gitRoot = findGitRoot(cwd);

  if (!gitRoot) {
    return { type: 'folder', path: cwd };
  }

  return {
    type: 'repository',
    path: gitRoot,
    git: {
      remote: getGitRemote(gitRoot)
    }
  };
}

module.exports = {
  generateId,
  stripThinking,
  findGitRoot,
  getGitRemote,
  detectScope
};
