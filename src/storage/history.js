const { readDataFile, writeDataFile } = require('./index');

/**
 * Get the history filename for a given data file.
 * @param {string} dataFilename - Original data file (e.g., 'categories.json')
 * @returns {string} History filename (e.g., 'categories_history.json')
 */
function getHistoryFilename(dataFilename) {
  const base = dataFilename.replace('.json', '');
  return `${base}_history.json`;
}

/**
 * Read history file, creating empty structure if it doesn't exist.
 * @param {string} dataFilename - Original data file name
 * @returns {Object} History data keyed by ID
 */
function readHistory(dataFilename) {
  const historyFilename = getHistoryFilename(dataFilename);
  try {
    return readDataFile(historyFilename);
  } catch {
    return {};
  }
}

/**
 * Write history file.
 * @param {string} dataFilename - Original data file name
 * @param {Object} historyData - History data to write
 */
function writeHistory(dataFilename, historyData) {
  const historyFilename = getHistoryFilename(dataFilename);
  writeDataFile(historyFilename, historyData);
}

/**
 * Archive an object before updating it.
 * Stores a snapshot of the current state with archived_at timestamp.
 * @param {string} dataFilename - Original data file name
 * @param {string} id - Object ID to archive
 * @param {Object} currentState - Current state of the object (before update)
 */
function archiveVersion(dataFilename, id, currentState) {
  const history = readHistory(dataFilename);

  if (!history[id]) {
    history[id] = [];
  }

  // Create snapshot with archived_at timestamp
  const snapshot = {
    ...currentState,
    archived_at: new Date().toISOString()
  };

  history[id].push(snapshot);
  writeHistory(dataFilename, history);
}

/**
 * Get version history for an object.
 * @param {string} dataFilename - Original data file name
 * @param {string} id - Object ID
 * @returns {Array} Array of historical snapshots (oldest first)
 */
function getHistory(dataFilename, id) {
  const history = readHistory(dataFilename);
  return history[id] || [];
}

/**
 * Delete history for an object (when the object is deleted).
 * @param {string} dataFilename - Original data file name
 * @param {string} id - Object ID
 */
function deleteHistory(dataFilename, id) {
  const history = readHistory(dataFilename);
  if (history[id]) {
    delete history[id];
    writeHistory(dataFilename, history);
  }
}

/**
 * Higher-order function that wraps an update function with history tracking.
 * Archives the current state before applying the update.
 * @param {string} dataFilename - Data file name
 * @param {Function} getCurrentState - Function to get current state by ID: (id) => object
 * @param {Function} updateFn - Original update function
 * @returns {Function} Wrapped update function that archives history
 */
function withHistory(dataFilename, getCurrentState, updateFn) {
  return function(id, updates, ...args) {
    // Get current state before update
    const currentState = getCurrentState(id);
    if (currentState) {
      // Archive the current state
      archiveVersion(dataFilename, currentState.id, currentState);
    }

    // Call the original update function
    return updateFn(id, updates, ...args);
  };
}

module.exports = {
  getHistoryFilename,
  readHistory,
  writeHistory,
  archiveVersion,
  getHistory,
  deleteHistory,
  withHistory
};
