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

module.exports = {
  generateId,
  stripThinking
};
