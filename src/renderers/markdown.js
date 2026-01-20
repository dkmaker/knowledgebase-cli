const { BaseRenderer } = require('./base');

/**
 * Markdown renderer - outputs markdown with YAML frontmatter
 */
class MarkdownRenderer extends BaseRenderer {
  /**
   * Render data as markdown with YAML frontmatter
   * @returns {string} Markdown string
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
   * Build YAML frontmatter from an object
   * @param {Object} obj - Key-value pairs for frontmatter
   * @returns {string} YAML frontmatter block
   */
  buildFrontmatter(obj, indent = 0) {
    const lines = indent === 0 ? ['---'] : [];
    const prefix = '  '.repeat(indent);

    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) {
        if (typeof value === 'string') {
          // Escape strings that might break YAML
          if (value.includes(':') || value.includes('#') || value.includes('\n')) {
            lines.push(`${prefix}${key}: "${value.replace(/"/g, '\\"')}"`);
          } else {
            lines.push(`${prefix}${key}: ${value}`);
          }
        } else if (typeof value === 'boolean' || typeof value === 'number') {
          lines.push(`${prefix}${key}: ${value}`);
        } else if (typeof value === 'object' && !Array.isArray(value)) {
          // Nested object - render as nested YAML
          lines.push(`${prefix}${key}:`);
          for (const [nestedKey, nestedValue] of Object.entries(value)) {
            const nestedPrefix = '  '.repeat(indent + 1);
            if (typeof nestedValue === 'string') {
              lines.push(`${nestedPrefix}${nestedKey}: ${nestedValue}`);
            } else {
              lines.push(`${nestedPrefix}${nestedKey}: ${nestedValue}`);
            }
          }
        } else {
          lines.push(`${prefix}${key}: ${JSON.stringify(value)}`);
        }
      }
    }

    if (indent === 0) {
      lines.push('---', '');
    }
    return lines.join('\n');
  }

  /**
   * Render research query result
   */
  renderResearch() {
    const { provider, model, profile, tokens, saved, title, content, thinking, examples, sources } = this.data;
    const parts = [];

    // Build metadata counts
    const meta = [];
    if (sources && sources.length > 0) meta.push(`sources: ${sources.length}`);
    if (examples && examples.length > 0) meta.push(`examples: ${examples.length}`);
    if (thinking) meta.push('thinking: yes');

    // Frontmatter
    parts.push(this.buildFrontmatter({
      type: 'research',
      provider,
      model,
      profile,
      tokens,
      saved,
      meta: meta.length > 0 ? meta.join(', ') : 'none'
    }));

    // Title and content (always show)
    if (title) {
      parts.push(`## ${title}\n`);
    }
    if (content) {
      parts.push(content);
      parts.push('');
    }

    // Thinking (only if requested)
    if (this.options.showThinking && thinking) {
      parts.push('\n### Thinking Process\n');
      parts.push(thinking);
      parts.push('');
    }

    // Examples (only if requested)
    if (this.options.showExamples && examples && examples.length > 0) {
      parts.push('\n### Examples\n');
      for (const example of examples) {
        parts.push(`**${example.description}**`);
        parts.push('```' + (example.language || ''));
        parts.push(example.code);
        parts.push('```\n');
      }
    }

    // Sources (only if requested)
    if (this.options.showSources && sources && sources.length > 0) {
      parts.push('---\nSources:');
      for (const source of sources) {
        const num = source.number ? `[${source.number}] ` : '- ';
        parts.push(`  ${num}${source.title || source.url}`);
        if (source.url && source.title) {
          parts.push(`     ${source.url}`);
        }
      }
    }

    // Add note about hidden content
    const hiddenParts = [];
    if (!this.options.showThinking && thinking) hiddenParts.push('--thinking');
    if (!this.options.showSources && sources && sources.length > 0) hiddenParts.push('--sources');
    if (!this.options.showExamples && examples && examples.length > 0) hiddenParts.push('--examples');
    if (hiddenParts.length > 0) {
      parts.push(`\n*Use ${hiddenParts.join(' ')} to show additional content*`);
    }

    return parts.join('\n');
  }

  /**
   * Render entries list (unsaved or library)
   */
  renderEntries() {
    const { title, count, entries } = this.data;
    const parts = [];

    parts.push(this.buildFrontmatter({
      type: 'entries',
      title,
      count: count || entries?.length || 0
    }));

    if (!entries || entries.length === 0) {
      parts.push(`No ${title.toLowerCase()} entries.`);
      return parts.join('\n');
    }

    // Table header with metadata columns
    parts.push('| ID | Profile | Title | Scope | Created | Meta |');
    parts.push('|----|---------|-------|-------|---------|------|');

    // Table rows
    for (const entry of entries) {
      const id = entry.id ? entry.id.slice(0, 8) : '-';
      const profile = entry.profile || '-';
      const entryTitle = (entry.title || entry.query || '-').slice(0, 40);

      // Build scope display: prefer git remote (short form) over path
      let scope;
      if (entry.scope?.type === 'global') {
        scope = '[global]';
      } else if (entry.scope?.git?.remote) {
        // Extract repo name from remote URL (e.g., "user/repo" from git@github.com:user/repo.git)
        const remote = entry.scope.git.remote;
        const match = remote.match(/[/:]([\w-]+\/[\w.-]+?)(?:\.git)?$/);
        const repoName = match ? match[1] : remote;
        const branch = entry.scope.git.branch ? `@${entry.scope.git.branch}` : '';
        scope = `[${repoName}${branch}]`;
      } else {
        scope = `[${entry.scope?.type || 'unknown'}:${entry.scope?.path || '-'}]`;
      }

      const created = entry.created_at ? entry.created_at.split('T')[0] : '-';

      // Build metadata string
      const metaParts = [];
      if (entry.meta) {
        if (entry.meta.sources > 0) metaParts.push(`${entry.meta.sources}s`);
        if (entry.meta.examples > 0) metaParts.push(`${entry.meta.examples}e`);
        if (entry.meta.hasThinking) metaParts.push('t');
      }
      const meta = metaParts.length > 0 ? metaParts.join(',') : '-';

      parts.push(`| ${id} | ${profile} | ${entryTitle} | ${scope} | ${created} | ${meta} |`);
    }

    return parts.join('\n');
  }

  /**
   * Render categories list (no frontmatter - informational)
   */
  renderCategories() {
    const { categories } = this.data;
    const parts = [];

    if (!categories || categories.length === 0) {
      parts.push('No categories defined. Create one with `kbcli categories new <slug>`');
      return parts.join('\n');
    }

    parts.push('## Categories\n');
    for (const cat of categories) {
      parts.push(`### ${cat.slug}`);
      parts.push(`- **Short**: ${cat.short_desc}`);
      parts.push(`- **Description**: ${cat.long_desc}`);
      parts.push(`- **AI Summary**: ${cat.ai_summary}`);
      parts.push(`- **Rules**: ${cat.rules}`);
      if (cat.examples && cat.examples.length > 0) {
        parts.push('- **Examples**:');
        for (const ex of cat.examples) {
          parts.push(`  - ${ex}`);
        }
      }
      parts.push('');
    }

    return parts.join('\n');
  }

  /**
   * Render profiles list (no frontmatter - informational)
   */
  renderProfiles() {
    const { profiles, defaultProfile } = this.data;
    const parts = [];

    parts.push('## Available Profiles\n');
    for (const profile of profiles || []) {
      const marker = profile.name === defaultProfile ? ' (default)' : '';
      parts.push(`### ${profile.name}${marker}`);
      parts.push(profile.description);
      parts.push('');
    }

    return parts.join('\n');
  }

  /**
   * Render providers list (no frontmatter - informational)
   */
  renderProviders() {
    const { providers } = this.data;
    const parts = [];

    parts.push('## Available Providers\n');
    for (const provider of providers || []) {
      const status = provider.available ? '✓ configured' : `✗ missing ${provider.envKey}`;
      parts.push(`### ${provider.displayName}`);
      parts.push(`- **Name**: ${provider.name}`);
      parts.push(`- **Status**: ${status}`);
      parts.push('');
    }

    return parts.join('\n');
  }

  /**
   * Render help text (no frontmatter - just plain text)
   */
  renderHelp() {
    return this.data.content || '';
  }

  /**
   * Render save confirmation (no frontmatter - confirmation message)
   */
  renderSave() {
    const { success, entry, category, message } = this.data;
    const parts = [];

    if (success) {
      parts.push(`Entry saved to library.`);
      parts.push(`  ID: ${entry?.id}`);
      parts.push(`  Category: ${category?.slug}`);
      if (entry?.title) {
        parts.push(`  Title: ${entry.title}`);
      }
    } else {
      parts.push(`Error: ${message || 'Failed to save entry'}`);
    }

    return parts.join('\n');
  }

  /**
   * Render create-category confirmation (no frontmatter - confirmation message)
   */
  renderCreateCategory() {
    const { success, category, message } = this.data;
    const parts = [];

    if (success) {
      parts.push(`Category created.`);
      parts.push(`  Slug: ${category?.slug}`);
      parts.push(`  Short: ${category?.short_desc}`);
      parts.push(`  Description: ${category?.long_desc}`);
      parts.push(`  AI Summary: ${category?.ai_summary}`);
      parts.push(`  Rules: ${category?.rules}`);
      if (category?.examples?.length > 0) {
        parts.push(`  Examples: ${category.examples.join(', ')}`);
      }
    } else {
      parts.push(`Error: ${message || 'Failed to create category'}`);
    }

    return parts.join('\n');
  }

  /**
   * Render update-category confirmation (no frontmatter - confirmation message)
   */
  renderUpdateCategory() {
    const { success, category, message } = this.data;
    const parts = [];

    if (success) {
      parts.push(`Category updated.`);
      parts.push(`  Slug: ${category?.slug}`);
      parts.push(`  Short: ${category?.short_desc}`);
      parts.push(`  Description: ${category?.long_desc}`);
      parts.push(`  AI Summary: ${category?.ai_summary}`);
      parts.push(`  Rules: ${category?.rules}`);
      if (category?.examples?.length > 0) {
        parts.push(`  Examples: ${category.examples.join(', ')}`);
      }
    } else {
      parts.push(`Error: ${message || 'Failed to update category'}`);
    }

    return parts.join('\n');
  }

  /**
   * Render single entry view
   */
  renderEntry() {
    const { entry, showThinking, showSources, showExamples, cliCommand } = this.data;
    const parts = [];

    // Determine subcommand context
    const location = entry.location === 'library' ? 'library' : 'drafts';
    const baseCmd = `${cliCommand || 'research'} ${location} show ${entry.id.slice(0, 8)}`;

    // Build frontmatter with ALL metadata
    const frontmatter = {
      type: 'entry',
      id: entry.id,
      location: entry.location,
      query: entry.query,
      provider: `${entry.provider}/${entry.model}`,
      profile: entry.profile,
      created: entry.created_at,
      title: entry.title || entry.query
    };

    if (entry.curated_at) frontmatter.curated = entry.curated_at;
    if (this.data.categorySlug) frontmatter.category = this.data.categorySlug;
    if (entry.scope) frontmatter.scope = entry.scope.type;
    if (entry.scope?.path) frontmatter.path = entry.scope.path;
    if (entry.scope?.git?.remote) frontmatter.git_remote = entry.scope.git.remote;
    if (entry.scope?.git?.branch) frontmatter.git_branch = entry.scope.git.branch;

    // Check if viewing specific sections
    const viewingSpecificSections = showThinking || showSources || showExamples;

    // Add show_content command when viewing specific sections
    if (viewingSpecificSections) {
      frontmatter.show_content = baseCmd;
    }

    // Add examples metadata
    if (entry.examples && entry.examples.length > 0) {
      frontmatter.examples = {
        count: entry.examples.length,
        show_command: `${baseCmd} --examples`
      };
    }

    // Add sources metadata
    if (entry.sources && entry.sources.length > 0) {
      frontmatter.sources = {
        count: entry.sources.length,
        show_command: `${baseCmd} --sources`
      };
    }

    // Add thinking metadata
    if (entry.thinking) {
      frontmatter.thinking = {
        exists: true,
        show_command: `${baseCmd} --thinking`
      };
    }

    parts.push(this.buildFrontmatter(frontmatter));

    // Show content only if NOT viewing specific sections
    if (!viewingSpecificSections && entry.content) {
      parts.push(entry.content);
      parts.push('');
    }

    // Thinking section (only if requested)
    if (showThinking && entry.thinking) {
      parts.push('# Thinking\n');
      parts.push(entry.thinking);
      parts.push('');
    }

    // Examples section (only if requested)
    if (showExamples && entry.examples && entry.examples.length > 0) {
      parts.push('# Examples\n');
      for (const example of entry.examples) {
        parts.push(`**${example.description}**`);
        parts.push('```' + (example.language || ''));
        parts.push(example.code);
        parts.push('```\n');
      }
    }

    // Sources section (only if requested)
    if (showSources && entry.sources && entry.sources.length > 0) {
      parts.push('# Sources\n');
      for (const source of entry.sources) {
        const num = source.number ? `[${source.number}] ` : '- ';
        parts.push(`${num}${source.title || source.url}`);
        if (source.url && source.title) {
          parts.push(`   ${source.url}`);
        }
      }
    }

    return parts.join('\n');
  }

  /**
   * Render delete confirmation (no frontmatter - confirmation message)
   */
  renderDelete() {
    const { success, entry } = this.data;
    const parts = [];

    if (success) {
      parts.push(`Entry deleted.`);
      parts.push(`  ID: ${entry?.id}`);
      if (entry?.title) parts.push(`  Title: ${entry.title}`);
    }

    return parts.join('\n');
  }

  /**
   * Render delete category confirmation (no frontmatter - confirmation message)
   */
  renderDeleteCategory() {
    const { success, category } = this.data;
    const parts = [];

    if (success) {
      parts.push(`Category deleted.`);
      parts.push(`  Slug: ${category?.slug}`);
    }

    return parts.join('\n');
  }

  /**
   * Render error (no frontmatter - just error message)
   */
  renderError() {
    return `Error: ${this.data.message || 'An unknown error occurred'}`;
  }

  /**
   * Generic fallback renderer (no frontmatter)
   */
  renderGeneric() {
    return JSON.stringify(this.data, null, 2);
  }
}

module.exports = { MarkdownRenderer };
