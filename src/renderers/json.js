const { BaseRenderer } = require('./base');

/**
 * JSON renderer - outputs raw JSON
 */
class JsonRenderer extends BaseRenderer {
  /**
   * Render data as formatted JSON
   * @returns {string} JSON string
   */
  render() {
    return JSON.stringify(this.data, null, 2);
  }
}

module.exports = { JsonRenderer };
