const { BaseProvider, BASE_SYSTEM_PROMPT, RESPONSE_JSON_SCHEMA } = require('./base');
const { stripThinking } = require('../storage/utils');

/**
 * Perplexity API provider for research queries.
 * Uses native fetch (Node 18+) - no external dependencies.
 */
class PerplexityProvider extends BaseProvider {
  static envKey = 'PERPLEXITY_API_KEY';
  static name = 'perplexity';
  static displayName = 'Perplexity AI';

  static API_BASE = 'https://api.perplexity.ai';

  /**
   * Available Perplexity models
   */
  static getModels() {
    return [
      {
        id: 'sonar',
        name: 'Sonar',
        description: 'Fast, cost-effective research (128K context)',
        context: 128000,
        pricing: { input: 1, output: 1 }
      },
      {
        id: 'sonar-pro',
        name: 'Sonar Pro',
        description: 'Advanced research with deeper search (200K context)',
        context: 200000,
        pricing: { input: 3, output: 15 }
      },
      {
        id: 'sonar-reasoning-pro',
        name: 'Sonar Reasoning Pro',
        description: 'Complex reasoning with chain-of-thought (128K context)',
        context: 128000,
        pricing: { input: 2, output: 8 }
      },
      {
        id: 'sonar-deep-research',
        name: 'Sonar Deep Research',
        description: 'Exhaustive research across hundreds of sources (128K context)',
        context: 128000,
        pricing: { input: 2, output: 8, citation: 2, reasoning: 3 }
      }
    ];
  }

  constructor(options = {}) {
    super(options);
    this.model = options.model || 'sonar';
  }

  /**
   * Perform a research query using Perplexity chat completions
   * @param {string} query - The research query
   * @param {Object} options - Query options
   * @returns {Promise<ResearchResult>}
   */
  async ask(query, options = {}) {
    const apiKey = PerplexityProvider.getApiKey();
    if (!apiKey) {
      throw new Error('PERPLEXITY_API_KEY environment variable not set');
    }

    const mergedOptions = { ...this.options, ...options };
    const model = mergedOptions.model || this.model;

    const requestBody = this._buildRequestBody(query, model, mergedOptions);

    const response = await fetch(`${PerplexityProvider.API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Perplexity API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return this._formatResponse(query, model, data);
  }

  /**
   * Perform a raw search query
   * @param {string} query - The search query
   * @param {Object} options - Search options
   * @returns {Promise<SearchResult>}
   */
  async search(query, options = {}) {
    // Perplexity search API requires their SDK, but we can simulate
    // with a minimal ask query that returns sources
    const result = await this.ask(query, {
      ...options,
      model: 'sonar',
      max_tokens: 100 // Minimal response, we want sources
    });

    return {
      provider: PerplexityProvider.name,
      query,
      results: result.sources
    };
  }

  supportsSearch() {
    return true;
  }

  /**
   * Build the request body for Perplexity API
   * @private
   */
  _buildRequestBody(query, model, options) {
    // Build user message from prompt template or raw query
    let userContent = query;
    if (options.prompt) {
      userContent = options.prompt.replace('{{QUERY}}', query);
    }

    const body = {
      model,
      messages: [
        {
          role: 'user',
          content: userContent
        }
      ]
    };

    // Build system message: base structured prompt + profile-specific prompt
    const systemParts = [BASE_SYSTEM_PROMPT];
    if (options.system) {
      systemParts.push(options.system);
    }
    body.messages.unshift({
      role: 'system',
      content: systemParts.join('\n\n')
    });

    // Add structured response format
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        schema: RESPONSE_JSON_SCHEMA
      }
    };

    // Standard parameters
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.max_tokens !== undefined) body.max_tokens = options.max_tokens;
    if (options.top_p !== undefined) body.top_p = options.top_p;

    // Perplexity-specific search parameters
    if (options.search_mode) body.search_mode = options.search_mode;
    if (options.search_domain_filter) body.search_domain_filter = options.search_domain_filter;
    if (options.search_recency_filter) body.search_recency_filter = options.search_recency_filter;
    if (options.search_after_date_filter) body.search_after_date_filter = options.search_after_date_filter;
    if (options.search_before_date_filter) body.search_before_date_filter = options.search_before_date_filter;

    // Web search options
    if (options.search_context_size) {
      body.web_search_options = body.web_search_options || {};
      body.web_search_options.search_context_size = options.search_context_size;
    }

    // Return options
    if (options.return_images) body.return_images = options.return_images;
    if (options.return_related_questions) body.return_related_questions = options.return_related_questions;

    // Reasoning effort (for sonar-deep-research)
    if (options.reasoning_effort) body.reasoning_effort = options.reasoning_effort;

    return body;
  }

  /**
   * Format Perplexity response to standard ResearchResult
   * @private
   */
  _formatResponse(query, model, data) {
    const choice = data.choices?.[0];
    const message = choice?.message;
    const rawContent = message?.content || '';

    // Strip thinking tags first
    const { thinking, content: strippedContent } = stripThinking(rawContent);

    // Parse structured JSON response from the stripped content
    let structured = { title: '', content: strippedContent, examples: [] };
    try {
      const parsed = JSON.parse(strippedContent);
      structured = {
        title: parsed.title || '',
        content: parsed.content || strippedContent,
        examples: parsed.examples || []
      };
    } catch {
      // If parsing fails, use stripped content as content field
      structured.content = strippedContent;
    }

    // Extract sources from search_results with numbered references
    const sources = (data.search_results || []).map((result, index) => ({
      number: index + 1,
      title: result.title || '',
      url: result.url || '',
      snippet: result.snippet || '',
      date: result.date || null
    }));

    return {
      provider: PerplexityProvider.name,
      model,
      query,
      title: structured.title,
      content: structured.content,
      thinking,
      examples: structured.examples,
      sources,
      usage: {
        input_tokens: data.usage?.prompt_tokens || 0,
        output_tokens: data.usage?.completion_tokens || 0,
        total_tokens: data.usage?.total_tokens || 0
      },
      raw: data
    };
  }
}

module.exports = { PerplexityProvider };
