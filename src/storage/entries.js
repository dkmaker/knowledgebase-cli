const { readDataFile, writeDataFile } = require('./index');
const { generateId, detectScope, findGitRoot } = require('./utils');
const { archiveVersion, getHistory, deleteHistory } = require('./history');

/**
 * Get all existing entry IDs from unsaved and library.
 * @returns {Set<string>} Set of existing IDs
 */
function getExistingIds() {
  const unsaved = readDataFile('drafts.json');
  const library = readDataFile('library.json');
  const ids = new Set();

  for (const entry of unsaved.entries) {
    ids.add(entry.id);
  }
  for (const entry of library.entries) {
    ids.add(entry.id);
  }

  return ids;
}

/**
 * Create a new entry from a research result.
 * @param {Object} result - Research result from provider
 * @param {Object} metadata - Additional metadata
 * @returns {Object} Entry object
 */
function createEntry(result, metadata = {}) {
  const existingIds = getExistingIds();
  const cwd = metadata.cwd || process.cwd();

  // Determine scope: global flag overrides auto-detection
  let scope;
  if (metadata.general) {
    scope = { type: 'global', path: null };
  } else {
    scope = detectScope(cwd);
  }

  return {
    id: generateId(existingIds),
    category_id: null,
    query: result.query,
    profile: metadata.profile || 'general',
    model: result.model,
    provider: result.provider,
    scope,
    title: result.title || '',
    content: result.content || result.answer || '',
    thinking: result.thinking || null,
    examples: result.examples || [],
    sources: result.sources || [],
    usage: result.usage || {},
    created_at: new Date().toISOString(),
    curated_at: null
  };
}

/**
 * Save an entry to drafts.json.
 * @param {Object} entry - Entry to save
 * @returns {Object} Saved entry
 */
function saveEntry(entry) {
  const data = readDataFile('drafts.json');
  data.entries.push(entry);
  writeDataFile('drafts.json', data);
  return entry;
}

/**
 * Filter entries by scope based on options.
 * @param {Array} entries - Entries to filter
 * @param {Object} options - Filter options
 * @param {boolean} options.all - Show all entries (no filtering)
 * @param {boolean} options.local - Strict local only (no global)
 * @param {string} options.cwd - Current working directory
 * @returns {Array} Filtered entries
 */
function filterEntriesByScope(entries, options = {}) {
  // Mode 1: --all shows everything
  if (options.all) {
    return entries;
  }

  const cwd = options.cwd || process.cwd();
  const gitRoot = findGitRoot(cwd);
  const currentPath = gitRoot || cwd;

  // Mode 2: --local shows strict local only (no global)
  if (options.local) {
    return entries.filter(e =>
      (e.scope.type === 'repository' || e.scope.type === 'folder') &&
      e.scope.path === currentPath
    );
  }

  // Mode 3 (default): current scope + global
  return entries.filter(e =>
    e.scope.type === 'global' ||
    e.scope.path === currentPath
  );
}

/**
 * Get all unsaved entries.
 * @param {Object} options - Filter options
 * @param {boolean} options.all - Show all entries (no filtering)
 * @param {boolean} options.local - Strict local only (no global)
 * @param {string} options.cwd - Current working directory for scope detection
 * @returns {Array} Array of entries
 */
function getUnsavedEntries(options = {}) {
  const data = readDataFile('drafts.json');
  return filterEntriesByScope(data.entries, options);
}

/**
 * Get all library entries.
 * @param {Object} options - Filter options
 * @param {boolean} options.all - Show all entries (no filtering)
 * @param {boolean} options.local - Strict local only (no global)
 * @param {string} options.categoryId - Filter by category
 * @param {string} options.cwd - Current working directory for scope detection
 * @returns {Array} Array of entries
 */
function getLibraryEntries(options = {}) {
  const data = readDataFile('library.json');
  let entries = data.entries;

  // Filter by category first (library-specific)
  if (options.categoryId) {
    entries = entries.filter(e => e.category_id === options.categoryId);
  }

  // Apply scope filtering
  return filterEntriesByScope(entries, options);
}

/**
 * Move an entry from unsaved to library with a category.
 * Supports partial ID matching (prefix match).
 * @param {string} entryId - Entry ID to curate (full or partial)
 * @param {string} categoryId - Category ID to assign
 * @param {boolean} isGlobal - If true, convert scope to global
 * @returns {Object|null} Curated entry or null if not found
 */
function curateEntry(entryId, categoryId, isGlobal = false) {
  const unsaved = readDataFile('drafts.json');
  const library = readDataFile('library.json');

  // Find entry in unsaved (exact or prefix match)
  const entryIndex = unsaved.entries.findIndex(e => e.id === entryId || e.id.startsWith(entryId));
  if (entryIndex === -1) {
    return null;
  }

  // Remove from unsaved and add to library
  const [entry] = unsaved.entries.splice(entryIndex, 1);
  entry.category_id = categoryId;
  entry.curated_at = new Date().toISOString();

  // Convert to global scope if requested
  if (isGlobal) {
    entry.scope = { type: 'global', path: null };
  }

  library.entries.push(entry);

  // Save both files
  writeDataFile('drafts.json', unsaved);
  writeDataFile('library.json', library);

  return entry;
}

/**
 * Get an entry by ID from either unsaved or library.
 * Supports partial ID matching (prefix match).
 * @param {string} entryId - Entry ID (full or partial)
 * @returns {Object|null} Entry or null if not found
 */
function getEntryById(entryId) {
  const unsaved = readDataFile('drafts.json');
  // Try exact match first, then prefix match
  let entry = unsaved.entries.find(e => e.id === entryId || e.id.startsWith(entryId));
  if (entry) return { ...entry, location: 'unsaved' };

  const library = readDataFile('library.json');
  entry = library.entries.find(e => e.id === entryId || e.id.startsWith(entryId));
  if (entry) return { ...entry, location: 'library' };

  return null;
}

/**
 * Delete an entry by ID from either unsaved or library.
 * Supports partial ID matching (prefix match).
 * Cleans up history after deletion.
 * @param {string} entryId - Entry ID (full or partial)
 * @returns {boolean} True if deleted, false if not found
 */
function deleteEntry(entryId) {
  // Try unsaved first
  const unsaved = readDataFile('drafts.json');
  const unsavedIndex = unsaved.entries.findIndex(e => e.id === entryId || e.id.startsWith(entryId));
  if (unsavedIndex !== -1) {
    const actualId = unsaved.entries[unsavedIndex].id;
    unsaved.entries.splice(unsavedIndex, 1);
    writeDataFile('drafts.json', unsaved);
    deleteHistory('drafts.json', actualId);
    return true;
  }

  // Try library
  const library = readDataFile('library.json');
  const libraryIndex = library.entries.findIndex(e => e.id === entryId || e.id.startsWith(entryId));
  if (libraryIndex !== -1) {
    const actualId = library.entries[libraryIndex].id;
    library.entries.splice(libraryIndex, 1);
    writeDataFile('library.json', library);
    deleteHistory('library.json', actualId);
    return true;
  }

  return false;
}

/**
 * Update an entry with history tracking.
 * Archives the current state before updating and sets updated_at.
 * @param {string} entryId - Entry ID (full or partial)
 * @param {Object} updates - Fields to update
 * @param {string} [updates.title] - Updated title
 * @param {string} [updates.content] - Updated content
 * @param {string|null} [updates.thinking] - Updated thinking (null to remove)
 * @param {Array} [updates.examples] - Complete examples array (replaces existing)
 * @param {Array} [updates.sources] - Complete sources array (replaces existing)
 * @param {Object} options - Update options
 * @param {string} options.location - 'drafts' or 'library' (required for dual storage)
 * @returns {Object|null} Updated entry or null if not found
 */
function updateEntry(entryId, updates, options = {}) {
  const location = options.location || 'drafts';
  const filename = location === 'library' ? 'library.json' : 'drafts.json';
  const data = readDataFile(filename);

  // Find entry (prefix match)
  const index = data.entries.findIndex(e => e.id === entryId || e.id.startsWith(entryId));
  if (index === -1) return null;

  // Archive BEFORE updating
  const currentState = { ...data.entries[index] };
  archiveVersion(filename, currentState.id, currentState);

  // Validate - remove immutable fields
  const immutableFields = ['id', 'query', 'profile', 'model', 'provider',
                           'scope', 'created_at', 'curated_at', 'category_id', 'usage'];
  for (const field of immutableFields) {
    if (updates[field] !== undefined) {
      delete updates[field];
    }
  }

  // Validate mutable fields
  if (updates.title !== undefined) {
    if (typeof updates.title !== 'string') {
      throw new Error('Field title must be a string');
    }
    updates.title = updates.title.trim();
    if (!updates.title) {
      throw new Error('Field title cannot be empty');
    }
  }

  if (updates.content !== undefined) {
    if (typeof updates.content !== 'string') {
      throw new Error('Field content must be a string');
    }
    updates.content = updates.content.trim();
    if (!updates.content) {
      throw new Error('Field content cannot be empty');
    }
  }

  if (updates.thinking !== undefined) {
    if (updates.thinking !== null && typeof updates.thinking !== 'string') {
      throw new Error('Field thinking must be a string or null');
    }
    updates.thinking = updates.thinking === null ? null : updates.thinking.trim();
  }

  if (updates.sources !== undefined) {
    if (!Array.isArray(updates.sources)) {
      throw new Error('Field sources must be an array');
    }
    // Validate each source has required fields
    for (const src of updates.sources) {
      if (!src.url && !src.title) {
        throw new Error('Each source must have at least a title or url');
      }
    }
  }

  if (updates.examples !== undefined) {
    if (!Array.isArray(updates.examples)) {
      throw new Error('Field examples must be an array');
    }
    // Validate each example has required fields
    for (const ex of updates.examples) {
      if (!ex.description || !ex.code) {
        throw new Error('Each example must have description and code');
      }
    }
  }

  // Apply updates with updated_at timestamp
  data.entries[index] = {
    ...data.entries[index],
    ...updates,
    updated_at: new Date().toISOString()
  };

  writeDataFile(filename, data);
  return data.entries[index];
}

/**
 * Add a source to an entry.
 * @param {string} entryId - Entry ID
 * @param {Object} source - Source object {title, url, snippet, number?}
 * @param {Object} options - {location: 'drafts'|'library'}
 * @returns {Object|null} Updated entry
 */
function addEntrySource(entryId, source, options) {
  const entry = getEntryById(entryId);
  if (!entry) return null;

  const sources = [...(entry.sources || []), source];
  return updateEntry(entryId, { sources }, { location: options.location || entry.location });
}

/**
 * Update a source at a specific index.
 * @param {string} entryId - Entry ID
 * @param {number} index - Source index (0-based)
 * @param {Object} updates - Partial source updates
 * @param {Object} options - {location: 'drafts'|'library'}
 * @returns {Object|null} Updated entry
 */
function updateEntrySource(entryId, index, updates, options) {
  const entry = getEntryById(entryId);
  if (!entry || !entry.sources[index]) return null;

  const sources = [...entry.sources];
  sources[index] = { ...sources[index], ...updates };
  return updateEntry(entryId, { sources }, { location: options.location || entry.location });
}

/**
 * Remove a source at a specific index.
 * @param {string} entryId - Entry ID
 * @param {number} index - Source index (0-based)
 * @param {Object} options - {location: 'drafts'|'library'}
 * @returns {Object|null} Updated entry
 */
function removeEntrySource(entryId, index, options) {
  const entry = getEntryById(entryId);
  if (!entry) return null;

  const sources = entry.sources.filter((_, i) => i !== index);
  return updateEntry(entryId, { sources }, { location: options.location || entry.location });
}

/**
 * Add an example to an entry.
 * @param {string} entryId - Entry ID
 * @param {Object} example - Example object {description, code, language}
 * @param {Object} options - {location: 'drafts'|'library'}
 * @returns {Object|null} Updated entry
 */
function addEntryExample(entryId, example, options) {
  const entry = getEntryById(entryId);
  if (!entry) return null;

  const examples = [...(entry.examples || []), example];
  return updateEntry(entryId, { examples }, { location: options.location || entry.location });
}

/**
 * Update an example at a specific index.
 * @param {string} entryId - Entry ID
 * @param {number} index - Example index (0-based)
 * @param {Object} updates - Partial example updates
 * @param {Object} options - {location: 'drafts'|'library'}
 * @returns {Object|null} Updated entry
 */
function updateEntryExample(entryId, index, updates, options) {
  const entry = getEntryById(entryId);
  if (!entry || !entry.examples[index]) return null;

  const examples = [...entry.examples];
  examples[index] = { ...examples[index], ...updates };
  return updateEntry(entryId, { examples }, { location: options.location || entry.location });
}

/**
 * Remove an example at a specific index.
 * @param {string} entryId - Entry ID
 * @param {number} index - Example index (0-based)
 * @param {Object} options - {location: 'drafts'|'library'}
 * @returns {Object|null} Updated entry
 */
function removeEntryExample(entryId, index, options) {
  const entry = getEntryById(entryId);
  if (!entry) return null;

  const examples = entry.examples.filter((_, i) => i !== index);
  return updateEntry(entryId, { examples }, { location: options.location || entry.location });
}

/**
 * Get version history for an entry.
 * @param {string} entryId - Entry ID
 * @param {Object} options - {location: 'drafts'|'library'}
 * @returns {Array} Array of historical snapshots (oldest first)
 */
function getEntryHistory(entryId, options = {}) {
  const entry = getEntryById(entryId);
  if (!entry) return [];

  const location = options.location || entry.location;
  const filename = location === 'library' ? 'library.json' : 'drafts.json';
  return getHistory(filename, entry.id);
}

/**
 * Get a specific version from history.
 * @param {string} entryId - Entry ID
 * @param {number} versionNumber - Version number (1-based)
 * @param {Object} options - {location: 'drafts'|'library'}
 * @returns {Object|null} Historical version or null if not found
 */
function getEntryVersion(entryId, versionNumber, options = {}) {
  const history = getEntryHistory(entryId, options);
  if (!history || history.length === 0) return null;

  // Convert 1-based version number to 0-based index
  const index = versionNumber - 1;
  if (index < 0 || index >= history.length) return null;

  return history[index];
}

module.exports = {
  createEntry,
  saveEntry,
  getUnsavedEntries,
  getLibraryEntries,
  filterEntriesByScope,
  curateEntry,
  getEntryById,
  deleteEntry,
  updateEntry,
  addEntrySource,
  updateEntrySource,
  removeEntrySource,
  addEntryExample,
  updateEntryExample,
  removeEntryExample,
  getEntryHistory,
  getEntryVersion
};
