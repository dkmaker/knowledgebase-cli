const { readDataFile, writeDataFile } = require('./index');
const { generateId } = require('./utils');

/**
 * Get all existing entry IDs from unsaved and library.
 * @returns {Set<string>} Set of existing IDs
 */
function getExistingIds() {
  const unsaved = readDataFile('unsaved.json');
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

  return {
    id: generateId(existingIds),
    category_id: null,
    query: result.query,
    profile: metadata.profile || 'general',
    model: result.model,
    provider: result.provider,
    scope: {
      type: metadata.general ? 'general' : 'repository',
      path: metadata.general ? null : (metadata.cwd || process.cwd())
    },
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
 * Save an entry to unsaved.json.
 * @param {Object} entry - Entry to save
 * @returns {Object} Saved entry
 */
function saveEntry(entry) {
  const data = readDataFile('unsaved.json');
  data.entries.push(entry);
  writeDataFile('unsaved.json', data);
  return entry;
}

/**
 * Get all unsaved entries.
 * @param {Object} options - Filter options
 * @returns {Array} Array of entries
 */
function getUnsavedEntries(options = {}) {
  const data = readDataFile('unsaved.json');
  let entries = data.entries;

  // Filter by scope if --local flag
  if (options.local) {
    const cwd = options.cwd || process.cwd();
    entries = entries.filter(e =>
      e.scope.type === 'repository' && e.scope.path === cwd
    );
  }

  return entries;
}

/**
 * Get all library entries.
 * @param {Object} options - Filter options
 * @returns {Array} Array of entries
 */
function getLibraryEntries(options = {}) {
  const data = readDataFile('library.json');
  let entries = data.entries;

  // Filter by category
  if (options.categoryId) {
    entries = entries.filter(e => e.category_id === options.categoryId);
  }

  // Filter by scope if --local flag
  if (options.local) {
    const cwd = options.cwd || process.cwd();
    entries = entries.filter(e =>
      e.scope.type === 'repository' && e.scope.path === cwd
    );
  }

  return entries;
}

/**
 * Move an entry from unsaved to library with a category.
 * Supports partial ID matching (prefix match).
 * @param {string} entryId - Entry ID to curate (full or partial)
 * @param {string} categoryId - Category ID to assign
 * @returns {Object|null} Curated entry or null if not found
 */
function curateEntry(entryId, categoryId) {
  const unsaved = readDataFile('unsaved.json');
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
  library.entries.push(entry);

  // Save both files
  writeDataFile('unsaved.json', unsaved);
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
  const unsaved = readDataFile('unsaved.json');
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
 * @param {string} entryId - Entry ID (full or partial)
 * @returns {boolean} True if deleted, false if not found
 */
function deleteEntry(entryId) {
  // Try unsaved first
  const unsaved = readDataFile('unsaved.json');
  const unsavedIndex = unsaved.entries.findIndex(e => e.id === entryId || e.id.startsWith(entryId));
  if (unsavedIndex !== -1) {
    unsaved.entries.splice(unsavedIndex, 1);
    writeDataFile('unsaved.json', unsaved);
    return true;
  }

  // Try library
  const library = readDataFile('library.json');
  const libraryIndex = library.entries.findIndex(e => e.id === entryId || e.id.startsWith(entryId));
  if (libraryIndex !== -1) {
    library.entries.splice(libraryIndex, 1);
    writeDataFile('library.json', library);
    return true;
  }

  return false;
}

module.exports = {
  createEntry,
  saveEntry,
  getUnsavedEntries,
  getLibraryEntries,
  curateEntry,
  getEntryById,
  deleteEntry
};
