/**
 * Base renderer class - abstract interface for output formatting
 */
class BaseRenderer {
  /**
   * @param {Object} data - The data object to render
   * @param {Object} options - Rendering options
   */
  constructor(data, options = {}) {
    this.data = data;
    this.options = options;
  }

  /**
   * Render the data to a string
   * @returns {string} Formatted output
   */
  render() {
    throw new Error('Must implement render()');
  }
}

module.exports = { BaseRenderer };
