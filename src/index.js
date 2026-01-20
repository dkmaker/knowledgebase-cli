#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { getProvider, listProviders } = require('./providers');
const profiles = require('./profiles.json');
const { initStorage } = require('./storage');
const { createEntry, saveEntry, getUnsavedEntries, getLibraryEntries, curateEntry, getEntryById, deleteEntry, updateEntry, addEntrySource, updateEntrySource, removeEntrySource, addEntryExample, updateEntryExample, removeEntryExample, getEntryHistory, getEntryVersion } = require('./storage/entries');
const { createCategory, getCategories, getCategoryById, getCategoryBySlug, updateCategory, deleteCategory } = require('./storage/categories');
const { getRenderer } = require('./renderers');
const { parseCommand, generateRootHelp, generateCommandHelp, generateError } = require('./commands');

/**
 * Detect how the CLI was invoked
 * @returns {string} The command to use in help text
 */
function detectCliCommand() {
  const argv = process.argv;
  const mainFile = require.main ? require.main.filename : null;
  const npmScript = process.env.npm_lifecycle_script;

  // Helper to find package.json by traversing up
  function findPackageJson(startDir) {
    let dir = startDir;
    while (dir !== path.dirname(dir)) {
      const pkgPath = path.join(dir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        return pkgPath;
      }
      dir = path.dirname(dir);
    }
    return null;
  }

  // Helper to get bin name from package.json
  function getBinName(pkgPath) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.bin && typeof pkg.bin === 'object') {
        return Object.keys(pkg.bin)[0] || null;
      }
    } catch (e) {
      // Ignore parsing errors
    }
    return null;
  }

  // Case 1: npm run script
  if (npmScript) {
    const scriptName = process.env.npm_lifecycle_event || 'script';
    return `npm run ${scriptName}`;
  }

  // Case 2: Check if invoked via bin name (symlink)
  const invokedName = argv[1] ? path.basename(argv[1]) : null;
  if (mainFile) {
    const pkgPath = findPackageJson(path.dirname(mainFile));
    if (pkgPath) {
      const binName = getBinName(pkgPath);
      if (binName && invokedName === binName) {
        return binName;
      }
    }
  }

  // Case 3: Global install or symlink (argv[1] is just the command name, no path)
  if (argv[1] && !argv[1].includes('/')) {
    return path.basename(argv[1]);
  }

  // Case 4: Direct node execution with .js file - use node + filename
  if (argv[0] === process.execPath && argv[1] && argv[1].endsWith('.js')) {
    return `node ${path.basename(argv[1])}`;
  }

  // Case 5: Final fallback - prefer bin name from package.json
  if (mainFile) {
    const pkgPath = findPackageJson(path.dirname(mainFile));
    if (pkgPath) {
      const binName = getBinName(pkgPath);
      if (binName) return binName;
    }
  }

  return `node ${path.basename(mainFile || argv[1] || 'index.js')}`;
}

// Detect how the CLI was invoked
const CLI_COMMAND = detectCliCommand();

/**
 * Parse command line arguments using the command registry.
 * This is a compatibility layer that converts registry-based parsing to legacy format.
 * @param {string[]} args - Process arguments (without node and script)
 * @returns {Object} Parsed options in legacy format
 */
function parseArgs(args) {
  const defaultOutput = process.env.CLAUDECODE === '1' ? 'ai' : 'md';

  // Use the new registry-based parser
  const parsed = parseCommand(args);

  // Build legacy result format
  const result = {
    // Subcommand info
    subcommand: parsed.command,
    action: parsed.action,
    actionArg: parsed.positionals[0] || null,
    actionArg2: parsed.positionals[1] || null,

    // Global options
    output: parsed.output || defaultOutput,
    help: parsed.help,

    // Search options
    profile: parsed.values.profile || parsed.values.p || 'general',
    query: null,
    showThinking: parsed.values.thinking || false,
    searchOptions: {},

    // Subcommand options
    local: parsed.values.local || false,
    all: parsed.values.all || false,
    category: parsed.values.category || null,
    to: parsed.values.to || null,
    global: parsed.values.global || false,

    // Category options
    short: parsed.values.short || null,
    long: parsed.values.long || null,
    ai: parsed.values.ai || null,
    rules: parsed.values.rules || null,
    examples: parsed.values.example || [],

    // Show options
    showSources: parsed.values.sources || false,
    showExamples: parsed.values.examples || false,

    // Update options
    title: parsed.values.title,
    content: parsed.values.content,
    thinking: parsed.values.thinking,
    sources: undefined,
    addSource: undefined,
    updateSourceIndex: undefined,
    updateSourceData: undefined,
    removeSourceIndex: undefined,
    addExample: undefined,
    updateExampleIndex: undefined,
    updateExampleData: undefined,
    removeExampleIndex: undefined,

    // History options
    version: parsed.values.version ? parseInt(parsed.values.version, 10) : null,

    // Error from parser
    _parseError: parsed.error
  };

  // Handle research command - query is the positionals
  if (parsed.command === 'research') {
    result.query = parsed.positionals.join(' ') || null;
  }

  // Handle search options
  if (parsed.values.model || parsed.values.m) {
    result.searchOptions.model = parsed.values.model || parsed.values.m;
  }
  if (parsed.values.recency) {
    result.searchOptions.search_recency_filter = parsed.values.recency;
  }
  if (parsed.values.domains) {
    result.searchOptions.search_domain_filter = parsed.values.domains.split(',');
  }
  if (parsed.values.maxTokens) {
    result.searchOptions.max_tokens = parseInt(parsed.values.maxTokens, 10);
  }

  // Handle JSON parsing for update options
  if (parsed.values.addSource) {
    try {
      result.addSource = JSON.parse(parsed.values.addSource);
    } catch (e) {
      result.addSource = parsed.values.addSource;
    }
  }
  if (parsed.values.removeSource) {
    result.removeSourceIndex = parseInt(parsed.values.removeSource, 10);
  }
  if (parsed.values.addExample) {
    try {
      result.addExample = JSON.parse(parsed.values.addExample);
    } catch (e) {
      result.addExample = parsed.values.addExample;
    }
  }
  if (parsed.values.removeExample) {
    result.removeExampleIndex = parseInt(parsed.values.removeExample, 10);
  }

  return result;
}

// ============================================================================
// Help Data - Using command registry for context-aware output
// ============================================================================

/**
 * Get the output mode based on CLAUDECODE environment variable
 * @returns {string} 'ai' or 'human'
 */
function getOutputMode() {
  return process.env.CLAUDECODE === '1' ? 'ai' : 'human';
}

/**
 * Get root help data from command registry
 * @param {boolean} compact - If true, use AI mode (for backward compatibility)
 * @returns {Object} Help data structure
 */
function getRootHelpData(compact = false) {
  const mode = compact ? 'ai' : getOutputMode();
  return generateRootHelp(mode);
}

/**
 * Get research command help from registry
 */
function getResearchHelpData(compact = false) {
  const mode = compact ? 'ai' : getOutputMode();
  return generateCommandHelp('research', mode);
}

/**
 * Get drafts command help from registry
 */
function getDraftsHelpData(compact = false) {
  const mode = compact ? 'ai' : getOutputMode();
  return generateCommandHelp('drafts', mode);
}

/**
 * Get library command help from registry
 */
function getLibraryHelpData(compact = false) {
  const mode = compact ? 'ai' : getOutputMode();
  return generateCommandHelp('library', mode);
}

/**
 * Get categories command help from registry
 */
function getCategoriesHelpData(compact = false) {
  const mode = compact ? 'ai' : getOutputMode();
  return generateCommandHelp('categories', mode);
}

/**
 * Get profiles command help from registry
 */
function getProfilesHelpData(compact = false) {
  const mode = compact ? 'ai' : getOutputMode();
  return generateCommandHelp('profiles', mode);
}

/**
 * Get providers command help from registry
 */
function getProvidersHelpData(compact = false) {
  const mode = compact ? 'ai' : getOutputMode();
  return generateCommandHelp('providers', mode);
}

// ============================================================================
// Data Handlers
// ============================================================================

function getProfilesData() {
  const profilesList = Object.entries(profiles).map(([name, profile]) => ({
    name,
    description: profile.description,
    model: profile.model,
    provider: profile.provider
  }));

  return {
    type: 'profiles',
    defaultProfile: 'general',
    profiles: profilesList
  };
}

function getProvidersData() {
  return {
    type: 'providers',
    providers: listProviders()
  };
}

function getCategoriesData() {
  return {
    type: 'categories',
    categories: getCategories()
  };
}

function getEntriesData(entries, title, options = {}) {
  // Add metadata counts to each entry
  const enrichedEntries = entries.map(entry => ({
    ...entry,
    meta: {
      sources: entry.sources?.length || 0,
      examples: entry.examples?.length || 0,
      hasThinking: !!entry.thinking
    }
  }));

  // Calculate hidden count if filtering is active
  let hiddenCount = 0;
  if (!options.all && !options.local) {
    // Get total entries to calculate hidden
    const allEntries = title === 'Drafts'
      ? getUnsavedEntries({ all: true })
      : getLibraryEntries({ all: true, categoryId: options.categoryId });
    hiddenCount = allEntries.length - entries.length;
  }

  return {
    type: 'entries',
    title,
    count: entries.length,
    hiddenCount,
    entries: enrichedEntries
  };
}

// ============================================================================
// Action Handlers
// ============================================================================

function handleShow(entryId, location, options = {}) {
  const entry = getEntryById(entryId);
  if (!entry) {
    return { type: 'error', message: `Entry not found: ${entryId}` };
  }

  // If location specified, verify entry is in that location
  if (location && entry.location !== location) {
    return { type: 'error', message: `Entry not found in ${location}: ${entryId}` };
  }

  // Look up category slug if entry has category_id
  let categorySlug = null;
  if (entry.category_id) {
    const category = getCategoryById(entry.category_id);
    categorySlug = category?.slug || null;
  }

  return {
    type: 'entry',
    entry,
    categorySlug,
    showThinking: options.showThinking,
    showSources: options.showSources,
    showExamples: options.showExamples,
    cliCommand: CLI_COMMAND
  };
}

function handleSave(entryId, categorySlugOrId, isGlobal) {
  if (!categorySlugOrId) {
    return { type: 'error', message: 'Missing --to <category>. Use: kbcli drafts save <id> --to <category>' };
  }

  // Look up by slug first, then by ID
  let category = getCategoryBySlug(categorySlugOrId);
  if (!category) {
    category = getCategoryById(categorySlugOrId);
  }
  if (!category) {
    return { type: 'error', message: `Category not found: ${categorySlugOrId}\nRun 'kbcli categories' to list available categories` };
  }

  const entry = curateEntry(entryId, category.id, isGlobal);
  if (!entry) {
    return { type: 'error', message: `Entry not found in drafts: ${entryId}` };
  }

  return { type: 'save', success: true, entry, category };
}

function handleRm(entryId, location) {
  const entry = getEntryById(entryId);
  if (!entry) {
    return { type: 'error', message: `Entry not found: ${entryId}` };
  }

  if (location && entry.location !== location) {
    return { type: 'error', message: `Entry not found in ${location}: ${entryId}` };
  }

  const deleted = deleteEntry(entryId);
  if (!deleted) {
    return { type: 'error', message: `Failed to delete entry: ${entryId}` };
  }

  return { type: 'delete', success: true, entry };
}

function handleUpdateEntry(entryId, location, args) {
  if (!entryId) {
    return { type: 'error', message: 'Entry ID required for update' };
  }

  const options = { location };

  try {
    // Handle granular array operations first
    if (args.addSource) {
      const result = addEntrySource(entryId, args.addSource, options);
      if (!result) {
        return { type: 'error', message: `Entry ${entryId} not found in ${location}` };
      }
      return { type: 'update_entry', entry: result, action: 'add_source' };
    }

    if (args.updateSourceIndex !== undefined) {
      const result = updateEntrySource(entryId, args.updateSourceIndex, args.updateSourceData, options);
      if (!result) {
        return { type: 'error', message: `Entry or source not found` };
      }
      return { type: 'update_entry', entry: result, action: 'update_source' };
    }

    if (args.removeSourceIndex !== undefined) {
      const result = removeEntrySource(entryId, args.removeSourceIndex, options);
      if (!result) {
        return { type: 'error', message: `Entry not found` };
      }
      return { type: 'update_entry', entry: result, action: 'remove_source' };
    }

    if (args.addExample) {
      const result = addEntryExample(entryId, args.addExample, options);
      if (!result) {
        return { type: 'error', message: `Entry ${entryId} not found in ${location}` };
      }
      return { type: 'update_entry', entry: result, action: 'add_example' };
    }

    if (args.updateExampleIndex !== undefined) {
      const result = updateEntryExample(entryId, args.updateExampleIndex, args.updateExampleData, options);
      if (!result) {
        return { type: 'error', message: `Entry or example not found` };
      }
      return { type: 'update_entry', entry: result, action: 'update_example' };
    }

    if (args.removeExampleIndex !== undefined) {
      const result = removeEntryExample(entryId, args.removeExampleIndex, options);
      if (!result) {
        return { type: 'error', message: `Entry not found` };
      }
      return { type: 'update_entry', entry: result, action: 'remove_example' };
    }

    // Build updates object for text fields and wholesale arrays
    const updates = {};
    if (args.title !== undefined) updates.title = args.title;
    if (args.content !== undefined) updates.content = args.content;
    if (args.thinking !== undefined) updates.thinking = args.thinking;
    if (args.sources !== undefined) updates.sources = args.sources;
    // Only include examples if it's not the default empty array (examples is used for categories too)
    if (args.examples !== undefined && args.examples.length > 0 && typeof args.examples[0] === 'object') {
      updates.examples = args.examples;
    }

    if (Object.keys(updates).length === 0) {
      return { type: 'error', message: 'No fields specified for update' };
    }

    const result = updateEntry(entryId, updates, options);
    if (!result) {
      return { type: 'error', message: `Entry ${entryId} not found in ${location}` };
    }

    return { type: 'update_entry', entry: result, action: 'update_fields' };
  } catch (error) {
    return { type: 'error', message: `Update failed: ${error.message}` };
  }
}

function handleEntryHistory(entryId, location, versionNumber = null, options = {}) {
  if (!entryId) {
    return { type: 'error', message: 'Entry ID required for history' };
  }

  // If version number specified, show that specific version
  if (versionNumber !== null) {
    const version = getEntryVersion(entryId, versionNumber, { location });
    if (!version) {
      return { type: 'error', message: `Version ${versionNumber} not found for entry ${entryId}` };
    }

    // Return as a regular entry view but mark it as historical
    return {
      type: 'entry',
      entry: { ...version, location },
      isHistorical: true,
      versionNumber,
      showThinking: options.showThinking || false,
      showSources: options.showSources || false,
      showExamples: options.showExamples || false,
      cliCommand: CLI_COMMAND
    };
  }

  // Otherwise show history list
  const history = getEntryHistory(entryId, { location });

  if (history.length === 0) {
    return { type: 'error', message: `No history found for entry ${entryId}` };
  }

  return { type: 'entry_history', history, entryId };
}

function handleNewCategory(slug, options) {
  if (!slug) {
    return { type: 'error', message: 'Missing slug. Use: kbcli categories new <slug>' };
  }

  // Check required fields
  const missing = [];
  if (!options.short) missing.push('--short');
  if (!options.long) missing.push('--long');
  if (!options.ai) missing.push('--ai');
  if (!options.rules) missing.push('--rules');
  if (!options.examples || options.examples.length === 0) missing.push('--example');

  if (missing.length > 0) {
    return {
      type: 'error',
      message: `Missing required fields: ${missing.join(', ')}\nRun 'kbcli categories --help' for usage`
    };
  }

  try {
    const category = createCategory({
      slug,
      short_desc: options.short,
      long_desc: options.long,
      ai_summary: options.ai,
      rules: options.rules,
      examples: options.examples
    });
    return { type: 'create-category', success: true, category };
  } catch (error) {
    return { type: 'error', message: error.message };
  }
}

function handleUpdateCategory(slug, options) {
  if (!slug) {
    return { type: 'error', message: 'Missing slug. Use: kbcli categories update <slug>' };
  }

  const category = getCategoryBySlug(slug);
  if (!category) {
    return { type: 'error', message: `Category not found: ${slug}` };
  }

  // Build updates object from provided options
  const updates = {};
  if (options.short) updates.short_desc = options.short;
  if (options.long) updates.long_desc = options.long;
  if (options.ai) updates.ai_summary = options.ai;
  if (options.rules) updates.rules = options.rules;
  if (options.examples && options.examples.length > 0) updates.examples = options.examples;

  if (Object.keys(updates).length === 0) {
    return { type: 'error', message: 'No fields to update. Provide at least one of: --short, --long, --ai, --rules, --example' };
  }

  try {
    const updated = updateCategory(category.id, updates);
    return { type: 'update-category', success: true, category: updated };
  } catch (error) {
    return { type: 'error', message: error.message };
  }
}

function handleRmCategory(slug) {
  if (!slug) {
    return { type: 'error', message: 'Missing slug. Use: kbcli categories rm <slug>' };
  }

  const category = getCategoryBySlug(slug);
  if (!category) {
    return { type: 'error', message: `Category not found: ${slug}` };
  }

  const deleted = deleteCategory(category.id);
  if (!deleted) {
    return { type: 'error', message: `Failed to delete category: ${slug}` };
  }

  return { type: 'delete-category', success: true, category };
}

async function executeSearch(args, outputMode) {
  const profile = profiles[args.profile];
  if (!profile) {
    return {
      type: 'error',
      message: `Unknown profile: ${args.profile}\nAvailable: ${Object.keys(profiles).join(', ')}`
    };
  }

  const Provider = getProvider(profile.provider);
  if (!Provider) {
    return { type: 'error', message: `Unknown provider: ${profile.provider}` };
  }

  if (!Provider.isAvailable()) {
    return {
      type: 'error',
      message: `${Provider.displayName} not configured. Set ${Provider.envKey} environment variable.`
    };
  }

  const options = {
    ...profile.options,
    model: args.searchOptions.model || profile.model,
    ...args.searchOptions
  };

  // Immediate feedback - print to stderr so it doesn't interfere with output
  const model = options.model || profile.model;
  if (outputMode === 'ai') {
    process.stderr.write(`---\ntype: status\nstatus: researching\nquery: ${args.query}\nprofile: ${args.profile}\nmodel: ${model}\n---\n`);
  } else {
    process.stderr.write(`Researching: "${args.query}"\n`);
    process.stderr.write(`Profile: ${args.profile} | Model: ${model}\n\n`);
  }

  const provider = new Provider(options);
  const result = await provider.ask(args.query, options);

  // Save to drafts
  const entry = createEntry(result, {
    profile: args.profile,
    general: false,
    cwd: process.cwd()
  });
  saveEntry(entry);

  // Return entry data for rendering (same as drafts show)
  return {
    type: 'entry',
    entry: { ...entry, location: 'unsaved' },
    showThinking: args.showThinking,
    showSources: args.showSources,
    showExamples: args.showExamples,
    cliCommand: CLI_COMMAND
  };
}

// ============================================================================
// Main Router
// ============================================================================

async function main() {
  initStorage();

  const args = parseArgs(process.argv.slice(2));
  const compact = args.output === 'ai';
  let data;

  try {
    // Route based on subcommand
    switch (args.subcommand) {
      case 'drafts':
        if (args.help) {
          data = getDraftsHelpData(compact);
        } else if (args.action === 'show') {
          data = handleShow(args.actionArg, 'unsaved', {
            showThinking: args.showThinking,
            showSources: args.showSources,
            showExamples: args.showExamples
          });
        } else if (args.action === 'save') {
          data = handleSave(args.actionArg, args.to, args.global);
        } else if (args.action === 'update') {
          data = handleUpdateEntry(args.actionArg, 'drafts', args);
        } else if (args.action === 'history') {
          data = handleEntryHistory(args.actionArg, 'drafts', args.version, {
            showThinking: args.showThinking,
            showSources: args.showSources,
            showExamples: args.showExamples
          });
        } else if (args.action === 'rm') {
          data = handleRm(args.actionArg, 'unsaved');
        } else {
          const opts = { local: args.local, all: args.all };
          data = getEntriesData(getUnsavedEntries(opts), 'Drafts', opts);
        }
        break;

      case 'library':
        if (args.help) {
          data = getLibraryHelpData(compact);
        } else if (args.action === 'show') {
          data = handleShow(args.actionArg, 'library', {
            showThinking: args.showThinking,
            showSources: args.showSources,
            showExamples: args.showExamples
          });
        } else if (args.action === 'update') {
          data = handleUpdateEntry(args.actionArg, 'library', args);
        } else if (args.action === 'history') {
          data = handleEntryHistory(args.actionArg, 'library', args.version, {
            showThinking: args.showThinking,
            showSources: args.showSources,
            showExamples: args.showExamples
          });
        } else if (args.action === 'rm') {
          data = handleRm(args.actionArg, 'library');
        } else {
          // Resolve category slug to ID if provided
          let categoryId = null;
          if (args.category) {
            const cat = getCategoryBySlug(args.category);
            if (!cat) {
              data = { type: 'error', message: `Category not found: ${args.category}` };
              break;
            }
            categoryId = cat.id;
          }
          const opts = { categoryId, local: args.local, all: args.all };
          data = getEntriesData(getLibraryEntries(opts), 'Library', opts);
        }
        break;

      case 'categories':
        if (args.help) {
          data = getCategoriesHelpData(compact);
        } else if (args.action === 'new') {
          data = handleNewCategory(args.actionArg, {
            short: args.short,
            long: args.long,
            ai: args.ai,
            rules: args.rules,
            examples: args.examples
          });
        } else if (args.action === 'update') {
          data = handleUpdateCategory(args.actionArg, {
            short: args.short,
            long: args.long,
            ai: args.ai,
            rules: args.rules,
            examples: args.examples
          });
        } else if (args.action === 'rm') {
          data = handleRmCategory(args.actionArg);
        } else {
          data = getCategoriesData();
        }
        break;

      case 'profiles':
        if (args.help) {
          data = getProfilesHelpData(compact);
        } else {
          data = getProfilesData();
        }
        break;

      case 'providers':
        if (args.help) {
          data = getProvidersHelpData(compact);
        } else {
          data = getProvidersData();
        }
        break;

      case 'research':
        if (args.help) {
          data = getResearchHelpData(compact);
        } else if (!args.query) {
          data = { type: 'error', message: 'Research topic required.\n\nUsage: kbcli research "your question"\n       kbcli r -p code "React hooks"' };
        } else {
          data = await executeSearch(args, args.output);
        }
        break;

      default:
        // No subcommand - show help or error on unknown command
        if (args.help) {
          data = getRootHelpData(compact);
        } else if (args._parseError && args._parseError.type === 'unknown_command') {
          // Use registry-based error with context-aware output
          const mode = compact ? 'ai' : getOutputMode();
          data = generateError(
            `Unknown command: ${args._parseError.value}`,
            mode,
            { unknownCommand: args._parseError.value }
          );
        } else {
          data = getRootHelpData(compact);
        }
    }
  } catch (error) {
    data = { type: 'error', message: error.message };
  }

  const renderer = getRenderer(args.output, data, { showThinking: args.showThinking });
  console.log(renderer.render());

  if (data.type === 'error') {
    process.exit(1);
  }
}

main();
