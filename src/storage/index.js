const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Get the knowledgebase data directory path.
 * Priority: KBCLI_DATA_DIR env var > ~/.local/share/knowledgebase/
 */
function getDataDir() {
  return process.env.KBCLI_DATA_DIR ||
    path.join(os.homedir(), '.local', 'share', 'knowledgebase');
}

/**
 * Ensure the data directory and required files exist.
 */
function initStorage() {
  const dataDir = getDataDir();

  // Create directory if it doesn't exist
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Initialize files if they don't exist
  const files = {
    'categories.json': { categories: [] },
    'unsaved.json': { entries: [] },
    'library.json': { entries: [] }
  };

  for (const [filename, defaultContent] of Object.entries(files)) {
    const filePath = path.join(dataDir, filename);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2));
    }
  }

  return dataDir;
}

/**
 * Get path to a specific data file.
 * @param {string} filename - File name (categories.json, unsaved.json, library.json)
 */
function getFilePath(filename) {
  return path.join(getDataDir(), filename);
}

/**
 * Read a JSON data file.
 * @param {string} filename - File name to read
 * @returns {Object} Parsed JSON content
 */
function readDataFile(filename) {
  const filePath = getFilePath(filename);
  if (!fs.existsSync(filePath)) {
    initStorage();
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Write to a JSON data file.
 * @param {string} filename - File name to write
 * @param {Object} data - Data to write
 */
function writeDataFile(filename, data) {
  const filePath = getFilePath(filename);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = {
  getDataDir,
  initStorage,
  getFilePath,
  readDataFile,
  writeDataFile
};
