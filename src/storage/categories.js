const { readDataFile, writeDataFile } = require('./index');
const { generateId } = require('./utils');
const { archiveVersion, getHistory, deleteHistory } = require('./history');

/**
 * Get all existing category IDs.
 * @returns {Set<string>} Set of existing IDs
 */
function getExistingCategoryIds() {
  const data = readDataFile('categories.json');
  return new Set(data.categories.map(c => c.id));
}

/**
 * Create a new category.
 * @param {Object} data - Category data
 * @param {string} data.slug - URL-friendly identifier (required)
 * @param {string} data.short_desc - Short description, 1-line (required)
 * @param {string} data.long_desc - Long description (required)
 * @param {string} data.ai_summary - AI-optimized summary (required)
 * @param {string} data.rules - When to apply this category (required)
 * @param {string[]} data.examples - Example content descriptions (required, min 1)
 * @returns {Object} Created category
 */
function createCategory(data) {
  // Validate required fields
  const requiredFields = ['slug', 'short_desc', 'long_desc', 'ai_summary', 'rules'];
  for (const field of requiredFields) {
    if (!data[field] || typeof data[field] !== 'string' || data[field].trim() === '') {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate examples array
  if (!Array.isArray(data.examples) || data.examples.length === 0) {
    throw new Error('At least one example is required');
  }
  for (const example of data.examples) {
    if (typeof example !== 'string' || example.trim() === '') {
      throw new Error('Each example must be a non-empty string');
    }
  }

  const categories = readDataFile('categories.json');

  // Check for duplicate slug
  if (categories.categories.some(c => c.slug === data.slug)) {
    throw new Error(`Category with slug "${data.slug}" already exists`);
  }

  const existingIds = getExistingCategoryIds();
  const category = {
    id: generateId(existingIds),
    slug: data.slug,
    short_desc: data.short_desc.trim(),
    long_desc: data.long_desc.trim(),
    ai_summary: data.ai_summary.trim(),
    rules: data.rules.trim(),
    examples: data.examples.map(e => e.trim()),
    created_at: new Date().toISOString()
  };

  categories.categories.push(category);
  writeDataFile('categories.json', categories);

  return category;
}

/**
 * Get all categories.
 * @returns {Array} Array of categories
 */
function getCategories() {
  const data = readDataFile('categories.json');
  return data.categories;
}

/**
 * Get a category by ID.
 * @param {string} categoryId - Category ID
 * @returns {Object|null} Category or null if not found
 */
function getCategoryById(categoryId) {
  const categories = getCategories();
  return categories.find(c => c.id === categoryId) || null;
}

/**
 * Get a category by slug.
 * @param {string} slug - Category slug
 * @returns {Object|null} Category or null if not found
 */
function getCategoryBySlug(slug) {
  const categories = getCategories();
  return categories.find(c => c.slug === slug) || null;
}

/**
 * Update a category.
 * Archives the current state before updating and sets updated_at.
 * @param {string} categoryId - Category ID
 * @param {Object} updates - Fields to update
 * @returns {Object|null} Updated category or null if not found
 */
function updateCategory(categoryId, updates) {
  const data = readDataFile('categories.json');
  const index = data.categories.findIndex(c => c.id === categoryId);

  if (index === -1) {
    return null;
  }

  // Archive current state before updating
  const currentState = { ...data.categories[index] };
  archiveVersion('categories.json', currentState.id, currentState);

  // Don't allow changing immutable fields
  delete updates.id;
  delete updates.slug;
  delete updates.created_at;
  delete updates.updated_at;

  // Validate string fields if provided
  const stringFields = ['short_desc', 'long_desc', 'ai_summary', 'rules'];
  for (const field of stringFields) {
    if (updates[field] !== undefined) {
      if (typeof updates[field] !== 'string' || updates[field].trim() === '') {
        throw new Error(`Field ${field} must be a non-empty string`);
      }
      updates[field] = updates[field].trim();
    }
  }

  // Validate examples if provided
  if (updates.examples !== undefined) {
    if (!Array.isArray(updates.examples) || updates.examples.length === 0) {
      throw new Error('At least one example is required');
    }
    for (const example of updates.examples) {
      if (typeof example !== 'string' || example.trim() === '') {
        throw new Error('Each example must be a non-empty string');
      }
    }
    updates.examples = updates.examples.map(e => e.trim());
  }

  // Apply updates with updated_at timestamp
  data.categories[index] = {
    ...data.categories[index],
    ...updates,
    updated_at: new Date().toISOString()
  };
  writeDataFile('categories.json', data);

  return data.categories[index];
}

/**
 * Delete a category.
 * Also removes its history.
 * @param {string} categoryId - Category ID
 * @returns {boolean} True if deleted, false if not found
 */
function deleteCategory(categoryId) {
  const data = readDataFile('categories.json');
  const index = data.categories.findIndex(c => c.id === categoryId);

  if (index === -1) {
    return false;
  }

  data.categories.splice(index, 1);
  writeDataFile('categories.json', data);

  // Also delete history for this category
  deleteHistory('categories.json', categoryId);

  return true;
}

/**
 * Get version history for a category.
 * @param {string} categoryId - Category ID
 * @returns {Array} Array of historical snapshots (oldest first)
 */
function getCategoryHistory(categoryId) {
  return getHistory('categories.json', categoryId);
}

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
  deleteCategory,
  getCategoryHistory
};
