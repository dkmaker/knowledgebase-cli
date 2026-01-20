/**
 * Base system prompt for structured JSON responses.
 * Prepended to all profile-specific system prompts.
 */
const BASE_SYSTEM_PROMPT = `Respond in JSON format with this exact structure:
{
  "title": "A concise, descriptive title (max 80 chars) summarizing your answer",
  "content": "Your full response with citation references like [1], [2]",
  "examples": [{"description": "what this shows", "code": "code snippet", "language": "javascript"}]
}

Rules:
- title: Required. Max 80 characters. Summarize the key answer.
- content: Required. Full response with [n] citation references.
- examples: Optional array. Only include if providing code or usage examples.

Respond ONLY with valid JSON. No markdown code blocks or extra text.`;

/**
 * JSON Schema for structured responses
 */
const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Concise title summarizing the answer (max 80 chars)'
    },
    content: {
      type: 'string',
      description: 'Full response with [n] citation references'
    },
    examples: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          code: { type: 'string' },
          language: { type: 'string' }
        },
        required: ['description', 'code', 'language']
      },
      description: 'Optional code/usage examples'
    }
  },
  required: ['title', 'content']
};

/**
 * Base provider interface for research providers.
 * All providers must extend this class and implement the required methods.
 */
class BaseProvider {
  /** Environment variable name for API key */
  static envKey = null;

  /** Provider identifier */
  static name = 'base';

  /** Human-readable provider name */
  static displayName = 'Base Provider';

  /**
   * Check if this provider is available (API key exists)
   * @returns {boolean}
   */
  static isAvailable() {
    return this.envKey && !!process.env[this.envKey];
  }

  /**
   * Get the API key from environment
   * @returns {string|null}
   */
  static getApiKey() {
    return this.envKey ? process.env[this.envKey] : null;
  }

  /**
   * Create a new provider instance
   * @param {Object} options - Provider options from profile
   */
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Perform a research query
   * @param {string} query - The research query
   * @param {Object} options - Query options (merged with profile options)
   * @returns {Promise<ResearchResult>}
   */
  async ask(query, options = {}) {
    throw new Error('ask() must be implemented by provider');
  }

  /**
   * Perform a raw search (if supported)
   * @param {string} query - The search query
   * @param {Object} options - Search options
   * @returns {Promise<SearchResult>}
   */
  async search(query, options = {}) {
    throw new Error('search() not supported by this provider');
  }

  /**
   * Check if this provider supports raw search
   * @returns {boolean}
   */
  supportsSearch() {
    return false;
  }

  /**
   * Get available models for this provider
   * @returns {Array<{id: string, name: string, description: string}>}
   */
  static getModels() {
    return [];
  }
}

/**
 * @typedef {Object} ResearchResult
 * @property {string} provider - Provider name
 * @property {string} model - Model used
 * @property {string} query - Original query
 * @property {string} answer - Synthesized response
 * @property {Array<Source>} sources - Sources cited
 * @property {Object} usage - Token usage info
 * @property {Object} [raw] - Raw provider response (optional)
 */

/**
 * @typedef {Object} Source
 * @property {string} title - Source title
 * @property {string} url - Source URL
 * @property {string} [snippet] - Content snippet
 * @property {string} [date] - Publication date
 */

/**
 * @typedef {Object} SearchResult
 * @property {string} provider - Provider name
 * @property {string} query - Original query
 * @property {Array<Source>} results - Search results
 */

module.exports = { BaseProvider, BASE_SYSTEM_PROMPT, RESPONSE_JSON_SCHEMA };
