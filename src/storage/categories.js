const { readDataFile, writeDataFile } = require('./index');
const { generateId } = require('./utils');

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
 * @param {string} data.slug - URL-friendly identifier
 * @param {string} data.description - Category description
 * @param {string} data.rules - When to apply this category
 * @returns {Object} Created category
 */
function createCategory(data) {
  const categories = readDataFile('categories.json');

  // Check for duplicate slug
  if (categories.categories.some(c => c.slug === data.slug)) {
    throw new Error(`Category with slug "${data.slug}" already exists`);
  }

  const existingIds = getExistingCategoryIds();
  const category = {
    id: generateId(existingIds),
    slug: data.slug,
    description: data.description || '',
    rules: data.rules || '',
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

  // Don't allow changing the ID
  delete updates.id;
  delete updates.created_at;

  // Check for duplicate slug if changing slug
  if (updates.slug && updates.slug !== data.categories[index].slug) {
    if (data.categories.some(c => c.slug === updates.slug)) {
      throw new Error(`Category with slug "${updates.slug}" already exists`);
    }
  }

  data.categories[index] = { ...data.categories[index], ...updates };
  writeDataFile('categories.json', data);

  return data.categories[index];
}

/**
 * Delete a category.
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

  return true;
}

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
  deleteCategory
};
