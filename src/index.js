#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { getProvider, listProviders } = require('./providers');
const profiles = require('./profiles.json');
const { initStorage } = require('./storage');
const { createEntry, saveEntry, getUnsavedEntries, getLibraryEntries, curateEntry, getEntryById, deleteEntry } = require('./storage/entries');
const { createCategory, getCategories, getCategoryById, getCategoryBySlug, updateCategory, deleteCategory } = require('./storage/categories');
const { getRenderer } = require('./renderers');

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

// Known subcommands
const SUBCOMMANDS = ['drafts', 'library', 'categories', 'profiles', 'providers', 'help'];
// Known actions within subcommands
const ACTIONS = ['show', 'save', 'rm', 'new', 'update'];

/**
 * Parse command line arguments with subcommand support
 * @param {string[]} args - Process arguments (without node and script)
 * @returns {Object} Parsed options
 */
function parseArgs(args) {
  const defaultOutput = process.env.CLAUDECODE === '1' ? 'ai' : 'md';

  const result = {
    // Subcommand info
    subcommand: null,
    action: null,
    actionArg: null,

    // Global options
    output: defaultOutput,
    help: false,

    // Search options
    profile: 'general',
    query: null,
    showThinking: false,
    searchOptions: {},

    // Subcommand options
    local: false,
    category: null,
    to: null,
    global: false,

    // Category options
    short: null,
    long: null,
    ai: null,
    rules: null,
    examples: [],

    // Show options
    showSources: false,
    showExamples: false
  };

  let i = 0;

  // First pass: detect subcommand
  while (i < args.length) {
    const arg = args[i];

    if (!arg.startsWith('-')) {
      if (SUBCOMMANDS.includes(arg)) {
        result.subcommand = arg;
        i++;
        break;
      } else if (arg === 'help') {
        result.help = true;
        i++;
        break;
      } else {
        // Not a subcommand, must be start of query
        break;
      }
    }

    // Handle global options before subcommand
    if (arg === '--output' || arg === '-o') {
      result.output = args[++i];
    } else if (arg === '--profile' || arg === '-p') {
      result.profile = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      result.help = true;
    }
    i++;
  }

  // Second pass: parse subcommand-specific args
  while (i < args.length) {
    const arg = args[i];

    // Actions (show, save, rm, new)
    if (!arg.startsWith('-') && ACTIONS.includes(arg) && !result.action) {
      result.action = arg;
      // Next non-flag arg is the action argument (id or slug)
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        result.actionArg = args[++i];
      }
      i++;
      continue;
    }

    // Options
    if (arg === '--output' || arg === '-o') {
      result.output = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--profile' || arg === '-p') {
      result.profile = args[++i];
    } else if (arg === '--local') {
      result.local = true;
    } else if (arg === '--global') {
      result.global = true;
    } else if (arg === '--category') {
      result.category = args[++i];
    } else if (arg === '--to') {
      result.to = args[++i];
    } else if (arg === '--short') {
      result.short = args[++i];
    } else if (arg === '--long') {
      result.long = args[++i];
    } else if (arg === '--ai') {
      result.ai = args[++i];
    } else if (arg === '--rules') {
      result.rules = args[++i];
    } else if (arg === '--example') {
      result.examples.push(args[++i]);
    } else if (arg === '--show-thinking' || arg === '--thinking') {
      result.showThinking = true;
    } else if (arg === '--sources') {
      result.showSources = true;
    } else if (arg === '--examples') {
      result.showExamples = true;
    } else if (arg === '--model' || arg === '-m') {
      result.searchOptions.model = args[++i];
    } else if (arg === '--recency') {
      result.searchOptions.search_recency_filter = args[++i];
    } else if (arg === '--domains') {
      result.searchOptions.search_domain_filter = args[++i].split(',');
    } else if (arg === '--max-tokens') {
      result.searchOptions.max_tokens = parseInt(args[++i], 10);
    } else if (!arg.startsWith('-')) {
      // Collect remaining args as query (for search)
      result.query = args.slice(i).join(' ');
      break;
    }
    i++;
  }

  return result;
}

// ============================================================================
// Help Data
// ============================================================================

function getRootHelpData(compact = false) {
  if (compact) {
    return {
      type: 'help',
      content: `kbcli [opts] <query> | kbcli <cmd> [opts]

Commands: drafts, library, categories, profiles, providers

Options:
  -o <fmt>  Output: md|json|ai
  -p <name> Profile: general|code|docs|troubleshoot
  -h        Help

Example: kbcli -p code "React hooks"`
    };
  }

  return {
    type: 'help',
    content: `kbcli - Knowledge base CLI with profile-based research

Usage:
  kbcli [options] <query>          Execute search
  kbcli <command> [options]        Manage entries

Commands:
  drafts        Manage uncategorized research entries
  library       Manage curated library entries
  categories    Manage categories
  profiles      View available search profiles
  providers     View available API providers

Global Options:
  --output, -o <fmt>    Output format: md, json, ai
  --profile, -p <name>  Profile: general, code, docs, troubleshoot
  --help, -h            Show help

Run 'kbcli <command> --help' for command-specific help.

Examples:
  kbcli "What is quantum computing?"
  kbcli --profile code "React hooks"
  kbcli drafts
  kbcli drafts show abc123
  kbcli library --category algorithms`
  };
}

function getSearchHelpData(compact = false) {
  if (compact) {
    return {
      type: 'help',
      content: `kbcli [opts] <query>

Options:
  -p <name>       Profile: general|code|docs|troubleshoot (default: general)
  -m <model>      Override model
  --recency <p>   Filter: day|week|month|year
  --domains <l>   Domain filter (comma-separated)
  --max-tokens <n>
  --thinking      Show reasoning
  -o <fmt>        Output: md|json|ai

Example: kbcli -p code "React hooks"`
    };
  }

  return {
    type: 'help',
    content: `kbcli <query> - Execute a search

Usage:
  kbcli [options] <query>

Options:
  --profile, -p <name>  Use profile: general, code, docs, troubleshoot (default: general)
  --model, -m <model>   Override model from profile
  --recency <period>    Filter: day, week, month, year
  --domains <list>      Comma-separated domain filter
  --max-tokens <n>      Maximum response tokens
  --show-thinking       Display reasoning process
  --output, -o <fmt>    Output format: md, json, ai

Examples:
  kbcli "What is quantum computing?"
  kbcli --profile code "React hooks examples"
  kbcli --profile troubleshoot --recency week "ECONNREFUSED"`
  };
}

function getDraftsHelpData(compact = false) {
  if (compact) {
    return {
      type: 'help',
      content: `kbcli drafts [opts] | show <id> | save <id> --to <cat> | rm <id>

Options:
  --local      Filter to current repo
  --thinking   Include reasoning
  --sources    Include citations
  --examples   Include code examples
  --to <cat>   Target category (save)
  --global     Save as global`
    };
  }

  return {
    type: 'help',
    content: `kbcli drafts - Manage uncategorized research entries

Usage:
  kbcli drafts [options]           List drafts
  kbcli drafts show <id> [opts]    View entry content
  kbcli drafts save <id> [opts]    Save to library
  kbcli drafts rm <id>             Delete entry

List Options:
  --local               Filter to current repository only

Show Options:
  --thinking            Include thinking/reasoning process
  --sources             Include source citations
  --examples            Include code examples

Save Options:
  --to <category>       Target category (required)
  --global              Save as global (not repo-bound)

Examples:
  kbcli drafts
  kbcli drafts --local
  kbcli drafts show abc123
  kbcli drafts show abc123 --thinking --sources
  kbcli drafts save abc123 --to algorithms
  kbcli drafts rm abc123`
  };
}

function getLibraryHelpData(compact = false) {
  if (compact) {
    return {
      type: 'help',
      content: `kbcli library [opts] | show <id> | rm <id>

Options:
  --local        Filter to current repo
  --category <id> Filter by category
  --thinking     Include reasoning
  --sources      Include citations
  --examples     Include code examples`
    };
  }

  return {
    type: 'help',
    content: `kbcli library - Manage curated library entries

Usage:
  kbcli library [options]          List library entries
  kbcli library show <id> [opts]   View entry content
  kbcli library rm <id>            Delete entry

List Options:
  --local               Filter to current repository only
  --category <id>       Filter by category

Show Options:
  --thinking            Include thinking/reasoning process
  --sources             Include source citations
  --examples            Include code examples

Examples:
  kbcli library
  kbcli library --category react
  kbcli library --local
  kbcli library show abc123
  kbcli library show abc123 --sources --examples
  kbcli library rm abc123`
  };
}

function getCategoriesHelpData(compact = false) {
  if (compact) {
    return {
      type: 'help',
      content: `kbcli categories | new <slug> | update <slug> | rm <slug>

New (all required):
  --short <text>   Short description
  --long <text>    Long description
  --ai <text>      AI summary
  --rules <text>   When to apply
  --example <text> Example (repeatable)

Update: --short|--long|--ai|--rules|--example`
    };
  }

  return {
    type: 'help',
    content: `kbcli categories - Manage categories

Usage:
  kbcli categories                   List all categories
  kbcli categories new <slug>        Create new category (all fields required)
  kbcli categories update <slug>     Update category fields
  kbcli categories rm <slug>         Delete category

New Options (all required):
  --short <text>        Short description (1-line)
  --long <text>         Long description (detailed)
  --ai <text>           AI-optimized summary
  --rules <text>        When to apply this category
  --example <text>      Example content (repeat for multiple)

Update Options (any combination):
  --short <text>        Update short description
  --long <text>         Update long description
  --ai <text>           Update AI summary
  --rules <text>        Update rules
  --example <text>      Replace examples (repeat for multiple)

Examples:
  kbcli categories new auth \\
    --short "Authentication patterns" \\
    --long "OAuth, JWT, session management" \\
    --ai "auth: oauth|jwt|session patterns" \\
    --rules "Apply for login, tokens, auth middleware" \\
    --example "OAuth 2.0 flow" \\
    --example "JWT refresh rotation"

  kbcli categories update auth --short "Updated description"
  kbcli categories rm auth`
  };
}

function getProfilesHelpData(compact = false) {
  if (compact) {
    return {
      type: 'help',
      content: `Profiles: general (default), code, docs, troubleshoot`
    };
  }

  return {
    type: 'help',
    content: `kbcli profiles - View available search profiles

Usage:
  kbcli profiles

Profiles:
  general       General-purpose research (default)
  code          Code examples and implementations
  docs          Official documentation and API references
  troubleshoot  Errors, bugs, and debugging solutions`
  };
}

function getProvidersHelpData(compact = false) {
  if (compact) {
    return {
      type: 'help',
      content: `Lists configured API providers`
    };
  }

  return {
    type: 'help',
    content: `kbcli providers - View available API providers

Usage:
  kbcli providers

Shows configured API providers and their status.`
  };
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

function getEntriesData(entries, title) {
  // Add metadata counts to each entry
  const enrichedEntries = entries.map(entry => ({
    ...entry,
    meta: {
      sources: entry.sources?.length || 0,
      examples: entry.examples?.length || 0,
      hasThinking: !!entry.thinking
    }
  }));

  return {
    type: 'entries',
    title,
    count: entries.length,
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

async function executeSearch(args) {
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
        } else if (args.action === 'rm') {
          data = handleRm(args.actionArg, 'unsaved');
        } else {
          data = getEntriesData(getUnsavedEntries({ local: args.local }), 'Drafts');
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
        } else if (args.action === 'rm') {
          data = handleRm(args.actionArg, 'library');
        } else {
          data = getEntriesData(getLibraryEntries({ categoryId: args.category, local: args.local }), 'Library');
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

      default:
        // No subcommand - either help or search
        if (args.help) {
          data = args.query ? getSearchHelpData(compact) : getRootHelpData(compact);
        } else if (args.query) {
          data = await executeSearch(args);
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
