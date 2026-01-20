const { BaseRenderer } = require('./base');

/**
 * AI-optimized renderer - token-efficient YAML-style output
 * Designed for Anthropic Claude models
 */
class AiRenderer extends BaseRenderer {
  /**
   * Render data as token-efficient YAML-style output
   * @returns {string} YAML-style string
   */
  render() {
    const { type } = this.data;

    switch (type) {
      case 'research':
        return this.renderResearch();
      case 'entries':
        return this.renderEntries();
      case 'categories':
        return this.renderCategories();
      case 'profiles':
        return this.renderProfiles();
      case 'providers':
        return this.renderProviders();
      case 'help':
        return this.renderHelp();
      case 'curate':
      case 'save':
        return this.renderSave();
      case 'create-category':
        return this.renderCreateCategory();
      case 'update-category':
        return this.renderUpdateCategory();
      case 'entry':
        return this.renderEntry();
      case 'delete':
        return this.renderDelete();
      case 'delete-category':
        return this.renderDeleteCategory();
      case 'error':
        return this.renderError();
      default:
        return this.renderGeneric();
    }
  }

  /**
   * Render research query result
   */
  renderResearch() {
    const { provider, model, profile, tokens, saved, title, content, thinking, examples, sources } = this.data;
    const lines = [];

    lines.push('type: research');
    if (provider) lines.push(`provider: ${provider}`);
    if (model) lines.push(`model: ${model}`);
    if (profile) lines.push(`profile: ${profile}`);
    if (tokens) lines.push(`tokens: ${tokens}`);
    if (saved !== undefined) lines.push(`saved: ${saved}`);
    if (title) lines.push(`title: ${title}`);

    // Add metadata counts
    const metaCounts = [];
    if (sources && sources.length > 0) metaCounts.push(`sources: ${sources.length}`);
    if (examples && examples.length > 0) metaCounts.push(`examples: ${examples.length}`);
    if (thinking) metaCounts.push('thinking: yes');
    if (metaCounts.length > 0) {
      lines.push(`meta: ${metaCounts.join(', ')}`);
    }

    // Always show content
    if (content) {
      lines.push('content: |');
      for (const line of content.split('\n')) {
        lines.push(`  ${line}`);
      }
    }

    // Show thinking only if requested
    if (this.options.showThinking && thinking) {
      lines.push('thinking: |');
      for (const line of thinking.split('\n')) {
        lines.push(`  ${line}`);
      }
    }

    // Show examples only if requested
    if (this.options.showExamples && examples && examples.length > 0) {
      lines.push('examples:');
      for (const ex of examples) {
        lines.push(`- description: ${ex.description}`);
        if (ex.language) lines.push(`  language: ${ex.language}`);
        lines.push('  code: |');
        for (const line of (ex.code || '').split('\n')) {
          lines.push(`    ${line}`);
        }
      }
    }

    // Show sources only if requested
    if (this.options.showSources && sources && sources.length > 0) {
      lines.push('sources:');
      for (const src of sources) {
        const num = src.number ? `[${src.number}] ` : '';
        lines.push(`- ${num}${src.title || src.url}`);
        if (src.url && src.title) lines.push(`  url: ${src.url}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Render entries list
   */
  renderEntries() {
    const { title, count, entries } = this.data;
    const lines = [];

    lines.push('type: entries');
    lines.push(`title: ${title}`);
    lines.push(`count: ${count || entries?.length || 0}`);

    if (!entries || entries.length === 0) {
      return lines.join('\n');
    }

    lines.push('entries:');
    for (const entry of entries) {
      lines.push(`- id: ${entry.id ? entry.id.slice(0, 8) : '-'}`);
      lines.push(`  profile: ${entry.profile || '-'}`);
      lines.push(`  title: ${(entry.title || entry.query || '-').slice(0, 60)}`);
      lines.push(`  scope: ${entry.scope?.type || 'unknown'}`);
      if (entry.scope?.path) lines.push(`  path: ${entry.scope.path}`);
      if (entry.scope?.git?.remote) lines.push(`  git_remote: ${entry.scope.git.remote}`);
      if (entry.scope?.git?.branch) lines.push(`  git_branch: ${entry.scope.git.branch}`);
      lines.push(`  created: ${entry.created_at ? entry.created_at.split('T')[0] : '-'}`);

      // Metadata counts
      if (entry.meta) {
        if (entry.meta.sources > 0) lines.push(`  sources: ${entry.meta.sources}`);
        if (entry.meta.examples > 0) lines.push(`  examples: ${entry.meta.examples}`);
        if (entry.meta.hasThinking) lines.push(`  thinking: yes`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Render categories list
   */
  renderCategories() {
    const { categories } = this.data;
    const lines = [];

    lines.push('type: categories');
    lines.push(`count: ${categories?.length || 0}`);

    if (!categories || categories.length === 0) {
      return lines.join('\n');
    }

    lines.push('categories:');
    for (const cat of categories) {
      lines.push(`- slug: ${cat.slug}`);
      lines.push(`  short: ${cat.short_desc}`);
      lines.push(`  ai: ${cat.ai_summary}`);
      lines.push(`  rules: ${cat.rules}`);
      if (cat.examples && cat.examples.length > 0) {
        lines.push(`  examples: [${cat.examples.join(', ')}]`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Render profiles list
   */
  renderProfiles() {
    const { profiles, defaultProfile } = this.data;
    const lines = [];

    lines.push('type: profiles');
    lines.push(`default: ${defaultProfile}`);

    if (profiles && profiles.length > 0) {
      lines.push('profiles:');
      for (const profile of profiles) {
        lines.push(`- name: ${profile.name}`);
        lines.push(`  description: ${profile.description}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Render providers list
   */
  renderProviders() {
    const { providers } = this.data;
    const lines = [];

    lines.push('type: providers');
    lines.push(`count: ${providers?.length || 0}`);

    if (providers && providers.length > 0) {
      lines.push('providers:');
      for (const p of providers) {
        lines.push(`- name: ${p.name}`);
        lines.push(`  display: ${p.displayName}`);
        lines.push(`  available: ${p.available}`);
        if (!p.available) lines.push(`  missing: ${p.envKey}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Render help text
   */
  renderHelp() {
    const { content } = this.data;
    const lines = [];

    lines.push('type: help');
    lines.push('content: |');
    for (const line of (content || '').split('\n')) {
      lines.push(`  ${line}`);
    }

    return lines.join('\n');
  }

  /**
   * Render save confirmation (curate)
   */
  renderSave() {
    const { success, entry, category, message } = this.data;
    const lines = [];

    lines.push('type: save');
    lines.push(`success: ${success}`);

    if (success) {
      lines.push(`entry_id: ${entry?.id}`);
      lines.push(`category: ${category?.slug}`);
      if (entry?.title) lines.push(`title: ${entry.title}`);
      lines.push('message: Entry saved to library');
    } else {
      lines.push(`message: ${message || 'Failed to save entry'}`);
    }

    return lines.join('\n');
  }

  /**
   * Render create-category confirmation
   */
  renderCreateCategory() {
    const { success, category, message } = this.data;
    const lines = [];

    lines.push('type: create-category');
    lines.push(`success: ${success}`);

    if (success) {
      lines.push(`slug: ${category?.slug}`);
      lines.push(`short: ${category?.short_desc}`);
      lines.push(`ai: ${category?.ai_summary}`);
      lines.push(`rules: ${category?.rules}`);
      if (category?.examples?.length > 0) {
        lines.push(`examples: [${category.examples.join(', ')}]`);
      }
    } else {
      lines.push(`message: ${message || 'Failed to create category'}`);
    }

    return lines.join('\n');
  }

  /**
   * Render update-category confirmation
   */
  renderUpdateCategory() {
    const { success, category, message } = this.data;
    const lines = [];

    lines.push('type: update-category');
    lines.push(`success: ${success}`);

    if (success) {
      lines.push(`slug: ${category?.slug}`);
      lines.push(`short: ${category?.short_desc}`);
      lines.push(`ai: ${category?.ai_summary}`);
      lines.push(`rules: ${category?.rules}`);
      if (category?.examples?.length > 0) {
        lines.push(`examples: [${category.examples.join(', ')}]`);
      }
    } else {
      lines.push(`message: ${message || 'Failed to update category'}`);
    }

    return lines.join('\n');
  }

  /**
   * Render single entry view
   */
  renderEntry() {
    const { entry, showThinking, showSources, showExamples, cliCommand } = this.data;
    const lines = [];

    // Determine subcommand context
    const location = entry.location === 'library' ? 'library' : 'drafts';
    const baseCmd = `${cliCommand || 'research'} ${location} show ${entry.id.slice(0, 8)}`;

    // ALL metadata at top
    lines.push('type: entry');
    lines.push(`id: ${entry.id}`);
    lines.push(`location: ${entry.location || 'unknown'}`);
    lines.push(`profile: ${entry.profile}`);
    lines.push(`provider: ${entry.provider}`);
    lines.push(`model: ${entry.model}`);
    lines.push(`query: ${entry.query}`);
    if (entry.title) lines.push(`title: ${entry.title}`);
    lines.push(`scope: ${entry.scope?.type || 'unknown'}`);
    if (entry.scope?.path) lines.push(`path: ${entry.scope.path}`);
    if (entry.scope?.git?.remote) lines.push(`git_remote: ${entry.scope.git.remote}`);
    if (entry.scope?.git?.branch) lines.push(`git_branch: ${entry.scope.git.branch}`);

    // Check if viewing specific sections
    const viewingSpecificSections = showThinking || showSources || showExamples;

    // Add show_content command when viewing specific sections
    if (viewingSpecificSections) {
      lines.push(`show_content: ${baseCmd}`);
    }

    // Examples metadata
    if (entry.examples && entry.examples.length > 0) {
      lines.push('examples:');
      lines.push(`  count: ${entry.examples.length}`);
      lines.push(`  show_command: ${baseCmd} --examples`);
    }

    // Sources metadata
    if (entry.sources && entry.sources.length > 0) {
      lines.push('sources:');
      lines.push(`  count: ${entry.sources.length}`);
      lines.push(`  show_command: ${baseCmd} --sources`);
    }

    // Thinking metadata
    if (entry.thinking) {
      lines.push('thinking:');
      lines.push(`  exists: true`);
      lines.push(`  show_command: ${baseCmd} --thinking`);
    }

    lines.push(`created: ${entry.created_at}`);
    if (entry.curated_at) lines.push(`curated: ${entry.curated_at}`);
    if (this.data.categorySlug) lines.push(`category: ${this.data.categorySlug}`);
    if (!viewingSpecificSections && entry.content) {
      lines.push('content: |');
      for (const line of entry.content.split('\n')) {
        lines.push(`  ${line}`);
      }
    }

    // Appended sections (only if requested)
    if (showThinking && entry.thinking) {
      lines.push('thinking: |');
      for (const line of entry.thinking.split('\n')) {
        lines.push(`  ${line}`);
      }
    }

    if (showExamples && entry.examples && entry.examples.length > 0) {
      lines.push('examples:');
      for (const ex of entry.examples) {
        lines.push(`- description: ${ex.description}`);
        if (ex.language) lines.push(`  language: ${ex.language}`);
        lines.push('  code: |');
        for (const line of (ex.code || '').split('\n')) {
          lines.push(`    ${line}`);
        }
      }
    }

    if (showSources && entry.sources && entry.sources.length > 0) {
      lines.push('sources:');
      for (const src of entry.sources) {
        const num = src.number ? `[${src.number}] ` : '';
        lines.push(`- ${num}${src.title || src.url}`);
        if (src.url && src.title) lines.push(`  url: ${src.url}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Render delete confirmation
   */
  renderDelete() {
    const { success, entry } = this.data;
    const lines = [];

    lines.push('type: delete');
    lines.push(`success: ${success}`);
    lines.push(`id: ${entry?.id}`);
    if (entry?.title) lines.push(`title: ${entry.title}`);
    lines.push(`location: ${entry?.location || 'unknown'}`);

    return lines.join('\n');
  }

  /**
   * Render delete category confirmation
   */
  renderDeleteCategory() {
    const { success, category } = this.data;
    const lines = [];

    lines.push('type: delete-category');
    lines.push(`success: ${success}`);
    lines.push(`slug: ${category?.slug}`);

    return lines.join('\n');
  }

  /**
   * Render error
   */
  renderError() {
    const { message } = this.data;
    const lines = [];

    lines.push('type: error');
    lines.push(`message: ${message || 'An unknown error occurred'}`);

    return lines.join('\n');
  }

  /**
   * Generic fallback renderer
   */
  renderGeneric() {
    const lines = [];

    lines.push(`type: ${this.data.type || 'unknown'}`);

    // Simple key-value dump for unknown types
    for (const [key, value] of Object.entries(this.data)) {
      if (key === 'type') continue;
      if (typeof value === 'object') {
        lines.push(`${key}: ${JSON.stringify(value)}`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    }

    return lines.join('\n');
  }
}

module.exports = { AiRenderer };
