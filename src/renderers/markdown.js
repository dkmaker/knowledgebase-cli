const { BaseRenderer } = require('./base');
const { renderTable } = require('./table');

/**
 * Markdown renderer - outputs clean CLI formatting for humans
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
      case 'update_entry':
        return this.renderUpdateEntry();
      case 'entry_history':
        return this.renderEntryHistory();
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
    const { title, count, entries, hiddenCount } = this.data;
    const totalCount = count || entries?.length || 0;

    // Transform entries for table
    const rows = (entries || []).map(entry => {
      // Build scope display
      let scope;
      if (entry.scope?.type === 'global') {
        scope = 'global';
      } else if (entry.scope?.git?.remote) {
        const remote = entry.scope.git.remote;
        const match = remote.match(/[/:]([\w-]+\/[\w.-]+?)(?:\.git)?$/);
        scope = 'git:' + (match ? match[1] : remote);
      } else {
        scope = entry.scope?.path || entry.scope?.type || '-';
      }

      // Build metadata string
      const metaParts = [];
      if (entry.meta) {
        if (entry.meta.sources > 0) metaParts.push(`${entry.meta.sources}s`);
        if (entry.meta.examples > 0) metaParts.push(`${entry.meta.examples}e`);
        if (entry.meta.hasThinking) metaParts.push('t');
      }

      return {
        id: entry.id ? entry.id.slice(0, 5) : '-',
        profile: entry.profile || '-',
        title: entry.title || entry.query || '-',
        scope,
        created: entry.created_at ? entry.created_at.split('T')[0] : '-',
        meta: metaParts.length > 0 ? metaParts.join(',') : '-'
      };
    });

    return renderTable({
      title: `${title} (${totalCount})`,
      columns: [
        { key: 'id', label: 'ID', minWidth: 5, maxWidth: 5 },
        { key: 'profile', label: 'Profile', minWidth: 8, maxWidth: 12 },
        { key: 'title', label: 'Title', flex: true, minWidth: 20 },
        { key: 'scope', label: 'Scope', minWidth: 10, maxWidth: 30 },
        { key: 'created', label: 'Created', minWidth: 10, maxWidth: 10 },
        { key: 'meta', label: 'Meta', minWidth: 4, maxWidth: 10 }
      ],
      rows,
      emptyMessage: `No ${title.toLowerCase()} entries.`,
      footer: hiddenCount > 0 ? `${hiddenCount} entries from other scopes hidden. Use --all to show everything.` : null
    });
  }

  /**
   * Render categories list
   */
  renderCategories() {
    const { categories } = this.data;

    const rows = (categories || []).map(cat => ({
      slug: cat.slug,
      short: cat.short_desc,
      ai: cat.ai_summary,
      examples: cat.examples ? cat.examples.slice(0, 2).join(', ') : '-'
    }));

    return renderTable({
      title: `Categories (${categories?.length || 0})`,
      columns: [
        { key: 'slug', label: 'Slug', minWidth: 8, maxWidth: 20 },
        { key: 'short', label: 'Description', flex: true, minWidth: 20 },
        { key: 'ai', label: 'AI Pattern', minWidth: 15, maxWidth: 40 },
        { key: 'examples', label: 'Examples', minWidth: 15, maxWidth: 30 }
      ],
      rows,
      emptyMessage: 'No categories defined. Create one with: kbcli categories new <slug>'
    });
  }

  /**
   * Render profiles list
   */
  renderProfiles() {
    const { profiles, defaultProfile } = this.data;

    const rows = (profiles || []).map(p => ({
      name: p.name === defaultProfile ? `${p.name} *` : p.name,
      description: p.description
    }));

    return renderTable({
      title: 'Profiles',
      columns: [
        { key: 'name', label: 'Name', minWidth: 12, maxWidth: 16 },
        { key: 'description', label: 'Description', flex: true, minWidth: 30 }
      ],
      rows,
      emptyMessage: 'No profiles defined.',
      footer: '* = default profile'
    });
  }

  /**
   * Render providers list
   */
  renderProviders() {
    const { providers } = this.data;

    const rows = (providers || []).map(p => ({
      name: p.name,
      display: p.displayName,
      status: p.available ? '✓ configured' : `✗ missing ${p.envKey}`
    }));

    return renderTable({
      title: 'Providers',
      columns: [
        { key: 'name', label: 'Name', minWidth: 10, maxWidth: 15 },
        { key: 'display', label: 'Provider', minWidth: 15, maxWidth: 25 },
        { key: 'status', label: 'Status', flex: true, minWidth: 15 }
      ],
      rows,
      emptyMessage: 'No providers available.'
    });
  }

  /**
   * Render help text - supports both legacy (content) and new structured format
   */
  renderHelp() {
    const { content, command, desc, usage, commands, actions, options, args, examples, terminology } = this.data;

    // If legacy content field exists, use it
    if (content && !commands && !actions) {
      return content;
    }

    // Build human-readable help from structured data
    const lines = [];

    if (command && command !== 'kbcli') {
      const cmdDesc = desc || this.getCommandDescription(command);
      lines.push(`kbcli ${command} - ${cmdDesc}`);
      lines.push('');
    } else {
      lines.push('kbcli - Knowledge base CLI with profile-based research');
      lines.push('');
    }

    if (usage) {
      lines.push('Usage:');
      lines.push(`  ${usage}`);
      lines.push('');
    }

    // Render arguments for specific commands
    if (args && args.length > 0) {
      lines.push('Arguments:');
      for (const arg of args) {
        const required = arg.required ? ' (required)' : '';
        lines.push(`  <${arg.name}>${required}  ${arg.desc || ''}`);
      }
      lines.push('');
    }

    // Render commands (for root help)
    if (commands && commands.length > 0) {
      lines.push('Commands:');
      for (const cmd of commands) {
        const cmdArgs = cmd.args ? ` ${cmd.args}` : '';
        const padded = (cmd.name + cmdArgs).padEnd(18);
        lines.push(`  ${padded} ${cmd.desc || ''}`);
      }
      lines.push('');
    }

    // Render actions (for subcommand help)
    if (actions && actions.length > 0) {
      lines.push('Actions:');
      for (const action of actions) {
        const actionArgs = action.args ? ` ${action.args}` : '';
        const padded = (action.name + actionArgs).padEnd(18);
        lines.push(`  ${padded} ${action.desc || ''}`);
      }
      lines.push('');
    }

    // Render options
    if (options) {
      if (Array.isArray(options)) {
        lines.push('Options:');
        for (const opt of options) {
          const arg = opt.arg ? ` ${opt.arg}` : '';
          const vals = opt.values ? ` (${opt.values.join('|')})` : '';
          const def = opt.default ? ` [default: ${opt.default}]` : '';
          const req = opt.required ? ' (required)' : '';
          const rep = opt.repeatable ? ' (repeatable)' : '';
          const padded = (opt.flag + arg).padEnd(22);
          lines.push(`  ${padded} ${opt.desc || ''}${vals}${def}${req}${rep}`);
        }
        lines.push('');
      } else {
        // Options grouped by action
        for (const [actionName, actionOpts] of Object.entries(options)) {
          lines.push(`${actionName.charAt(0).toUpperCase() + actionName.slice(1)} Options:`);
          for (const opt of actionOpts) {
            const arg = opt.arg ? ` ${opt.arg}` : '';
            const vals = opt.values ? ` (${opt.values.join('|')})` : '';
            const def = opt.default ? ` [default: ${opt.default}]` : '';
            const req = opt.required ? ' (required)' : '';
            const rep = opt.repeatable ? ' (repeatable)' : '';
            const padded = (opt.flag + arg).padEnd(22);
            lines.push(`  ${padded} ${opt.desc || ''}${vals}${def}${req}${rep}`);
          }
          lines.push('');
        }
      }
    }

    // Render examples
    if (examples && examples.length > 0) {
      lines.push('Examples:');
      for (const ex of examples) {
        lines.push(`  ${ex}`);
      }
      lines.push('');
    }

    // Render terminology (for root help)
    if (terminology && Object.keys(terminology).length > 0) {
      lines.push('Terminology:');
      for (const [term, definition] of Object.entries(terminology)) {
        lines.push(`  ${term.padEnd(10)} ${definition}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get command description for help header
   */
  getCommandDescription(command) {
    const descriptions = {
      research: 'Create a research entry',
      drafts: 'Manage uncategorized research entries',
      library: 'Manage curated library entries',
      categories: 'Manage categories',
      profiles: 'View available search profiles',
      providers: 'View available API providers'
    };
    return descriptions[command] || '';
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
  /**
   * Render error - supports both legacy and structured format
   */
  renderError() {
    const { message, commands, suggestions } = this.data;
    const lines = [];

    lines.push(`Error: ${message || 'An unknown error occurred'}`);

    // Structured error with commands and suggestions
    if (commands && commands.length > 0) {
      lines.push('');
      lines.push(`Available commands: ${commands.join(', ')}`);
    }

    if (suggestions && suggestions.length > 0) {
      lines.push('');
      lines.push('Suggestions:');
      for (const sug of suggestions) {
        if (typeof sug === 'string') {
          lines.push(`  ${sug}`);
        } else {
          lines.push(`  ${sug.cmd}`);
          if (sug.desc) lines.push(`    ${sug.desc}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Render update confirmation
   */
  renderUpdateEntry() {
    const { entry, action } = this.data;
    const actionLabels = {
      update_fields: 'Updated entry',
      add_source: 'Added source to entry',
      update_source: 'Updated source in entry',
      remove_source: 'Removed source from entry',
      add_example: 'Added example to entry',
      update_example: 'Updated example in entry',
      remove_example: 'Removed example from entry'
    };

    return `✓ ${actionLabels[action] || 'Updated entry'}: ${entry.id}

Title: ${entry.title}
Updated: ${entry.updated_at}
Sources: ${entry.sources.length}
Examples: ${entry.examples.length}
`;
  }

  /**
   * Render entry version history
   */
  renderEntryHistory() {
    const { history, entryId } = this.data;

    let output = `# Version History: ${entryId}\n\n`;
    output += `Total versions: ${history.length}\n\n`;

    // Show history in reverse (newest first)
    for (let i = history.length - 1; i >= 0; i--) {
      const version = history[i];
      output += `## Version ${i + 1}\n`;
      output += `Archived: ${version.archived_at}\n`;
      output += `Title: ${version.title}\n`;
      output += `Sources: ${version.sources?.length || 0}\n`;
      output += `Examples: ${version.examples?.length || 0}\n\n`;
    }

    return output;
  }

  /**
   * Generic fallback renderer (no frontmatter)
   */
  renderGeneric() {
    return JSON.stringify(this.data, null, 2);
  }
}

module.exports = { MarkdownRenderer };
