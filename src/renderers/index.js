const { JsonRenderer } = require('./json');
const { MarkdownRenderer } = require('./markdown');
const { AiRenderer } = require('./ai');

/**
 * Registry of available renderers
 */
const renderers = {
  json: JsonRenderer,
  md: MarkdownRenderer,
  markdown: MarkdownRenderer,
  ai: AiRenderer
};

/**
 * Get a renderer instance for the specified format
 * @param {string} format - Output format (json, md, markdown)
 * @param {Object} data - Data to render
 * @param {Object} options - Rendering options
 * @returns {BaseRenderer} Renderer instance
 */
function getRenderer(format, data, options = {}) {
  const RendererClass = renderers[format?.toLowerCase()] || MarkdownRenderer;
  return new RendererClass(data, options);
}

/**
 * List available format names
 * @returns {string[]} Available format names
 */
function listFormats() {
  return Object.keys(renderers);
}

module.exports = { getRenderer, renderers, listFormats };
