/**
 * Command Registry - Single source of truth for all CLI commands
 *
 * Each command defines:
 * - name: Human-readable command name
 * - ai: AI-optimized short name (used in CLAUDECODE=1 mode)
 * - alias: Optional human alias (same as ai for convenience)
 * - desc: Description (shown in human mode, optional in AI mode)
 * - args: Positional arguments
 * - options: Command options with human/AI variants
 * - actions: Sub-actions for commands like drafts, library, categories
 * - examples: Mode-specific examples (human vs ai)
 */

const registry = {
  research: {
    name: 'research',
    ai: 'r',
    alias: 'r',
    desc: 'Create research entry',
    args: [
      { name: 'text', required: true, desc: 'Research query' }
    ],
    options: [
      {
        name: 'profile',
        flag: '--profile',
        ai: '-p',
        alias: '-p',
        type: 'string',
        arg: '<name>',
        values: ['general', 'code', 'docs', 'troubleshoot'],
        default: 'general',
        desc: 'Research profile'
      },
      {
        name: 'model',
        flag: '--model',
        ai: '-m',
        alias: '-m',
        type: 'string',
        arg: '<model>',
        desc: 'Override model'
      },
      {
        name: 'recency',
        flag: '--recency',
        type: 'string',
        arg: '<period>',
        values: ['day', 'week', 'month', 'year'],
        desc: 'Filter by time'
      },
      {
        name: 'domains',
        flag: '--domains',
        type: 'string',
        arg: '<list>',
        desc: 'Domain filter (comma-separated)'
      },
      {
        name: 'maxTokens',
        flag: '--max-tokens',
        type: 'string',
        arg: '<n>',
        desc: 'Max response tokens'
      },
      {
        name: 'thinking',
        flag: '--thinking',
        type: 'boolean',
        desc: 'Show reasoning'
      },
      {
        name: 'global',
        flag: '--global',
        type: 'boolean',
        desc: 'Save as global scope'
      }
    ],
    examples: {
      human: [
        'kbcli research "GraphQL best practices"',
        'kbcli research --profile code "React hooks"',
        'kbcli r -p docs --domains nodejs.org "fs module"'
      ],
      ai: [
        'kbcli r "GraphQL best practices"',
        'kbcli r -p code "React hooks"',
        'kbcli r -p docs --domains nodejs.org "fs module"'
      ]
    }
  },

  drafts: {
    name: 'drafts',
    ai: 'd',
    alias: 'd',
    desc: 'Manage draft entries',
    actions: {
      list: {
        default: true,
        desc: 'List drafts',
        options: [
          { name: 'all', flag: '--all', type: 'boolean', desc: 'Show all entries' },
          { name: 'local', flag: '--local', type: 'boolean', desc: 'Strict local only' }
        ]
      },
      show: {
        ai: 's',
        desc: 'View entry details',
        args: [{ name: 'id', required: true, desc: 'Entry ID' }],
        options: [
          { name: 'thinking', flag: '--thinking', type: 'boolean', desc: 'Include reasoning' },
          { name: 'sources', flag: '--sources', type: 'boolean', desc: 'Include citations' },
          { name: 'examples', flag: '--examples', type: 'boolean', desc: 'Include code examples' }
        ]
      },
      save: {
        desc: 'Save to library',
        args: [{ name: 'id', required: true, desc: 'Entry ID' }],
        options: [
          { name: 'to', flag: '--to', type: 'string', arg: '<category>', required: true, desc: 'Target category slug' },
          { name: 'global', flag: '--global', type: 'boolean', desc: 'Save as global scope' }
        ]
      },
      update: {
        ai: 'u',
        desc: 'Modify entry',
        args: [{ name: 'id', required: true, desc: 'Entry ID' }],
        options: [
          { name: 'title', flag: '--title', type: 'string', arg: '<text>', desc: 'Update title' },
          { name: 'content', flag: '--content', type: 'string', arg: '<text>', desc: 'Update content' },
          { name: 'thinking', flag: '--thinking', type: 'string', arg: '<text>', desc: 'Update thinking' },
          { name: 'addSource', flag: '--add-source', type: 'string', arg: '<json>', desc: 'Add source' },
          { name: 'updateSource', flag: '--update-source', type: 'string', arg: '<json>', desc: 'Update source' },
          { name: 'removeSource', flag: '--remove-source', type: 'string', arg: '<n>', desc: 'Remove source at index' },
          { name: 'addExample', flag: '--add-example', type: 'string', arg: '<json>', desc: 'Add example' },
          { name: 'updateExample', flag: '--update-example', type: 'string', arg: '<json>', desc: 'Update example' },
          { name: 'removeExample', flag: '--remove-example', type: 'string', arg: '<n>', desc: 'Remove example at index' }
        ]
      },
      history: {
        ai: 'h',
        desc: 'View version history',
        args: [{ name: 'id', required: true, desc: 'Entry ID' }]
      },
      version: {
        ai: 'v',
        desc: 'View specific version',
        args: [
          { name: 'id', required: true, desc: 'Entry ID' },
          { name: 'version', required: true, desc: 'Version number' }
        ]
      },
      rm: {
        desc: 'Delete entry',
        args: [{ name: 'id', required: true, desc: 'Entry ID' }]
      }
    },
    examples: {
      human: [
        'kbcli drafts',
        'kbcli drafts show abc --sources',
        'kbcli drafts save abc --to graphql'
      ],
      ai: [
        'kbcli d',
        'kbcli d s abc --sources',
        'kbcli d save abc --to graphql'
      ]
    }
  },

  library: {
    name: 'library',
    ai: 'l',
    alias: 'l',
    desc: 'Manage curated entries',
    actions: {
      list: {
        default: true,
        desc: 'List entries',
        options: [
          { name: 'all', flag: '--all', type: 'boolean', desc: 'Show all entries' },
          { name: 'local', flag: '--local', type: 'boolean', desc: 'Strict local only' },
          { name: 'category', flag: '--category', type: 'string', arg: '<slug>', desc: 'Filter by category' }
        ]
      },
      show: {
        ai: 's',
        desc: 'View entry details',
        args: [{ name: 'id', required: true, desc: 'Entry ID' }],
        options: [
          { name: 'thinking', flag: '--thinking', type: 'boolean', desc: 'Include reasoning' },
          { name: 'sources', flag: '--sources', type: 'boolean', desc: 'Include citations' },
          { name: 'examples', flag: '--examples', type: 'boolean', desc: 'Include code examples' }
        ]
      },
      update: {
        ai: 'u',
        desc: 'Modify entry',
        args: [{ name: 'id', required: true, desc: 'Entry ID' }],
        options: [
          { name: 'title', flag: '--title', type: 'string', arg: '<text>', desc: 'Update title' },
          { name: 'content', flag: '--content', type: 'string', arg: '<text>', desc: 'Update content' },
          { name: 'thinking', flag: '--thinking', type: 'string', arg: '<text>', desc: 'Update thinking' },
          { name: 'addSource', flag: '--add-source', type: 'string', arg: '<json>', desc: 'Add source' },
          { name: 'updateSource', flag: '--update-source', type: 'string', arg: '<json>', desc: 'Update source' },
          { name: 'removeSource', flag: '--remove-source', type: 'string', arg: '<n>', desc: 'Remove source at index' },
          { name: 'addExample', flag: '--add-example', type: 'string', arg: '<json>', desc: 'Add example' },
          { name: 'updateExample', flag: '--update-example', type: 'string', arg: '<json>', desc: 'Update example' },
          { name: 'removeExample', flag: '--remove-example', type: 'string', arg: '<n>', desc: 'Remove example at index' }
        ]
      },
      history: {
        ai: 'h',
        desc: 'View version history',
        args: [{ name: 'id', required: true, desc: 'Entry ID' }]
      },
      version: {
        ai: 'v',
        desc: 'View specific version',
        args: [
          { name: 'id', required: true, desc: 'Entry ID' },
          { name: 'version', required: true, desc: 'Version number' }
        ]
      },
      rm: {
        desc: 'Delete entry',
        args: [{ name: 'id', required: true, desc: 'Entry ID' }]
      }
    },
    examples: {
      human: [
        'kbcli library --category graphql',
        'kbcli library show abc --sources --examples'
      ],
      ai: [
        'kbcli l --category graphql',
        'kbcli l s abc --sources --examples'
      ]
    }
  },

  categories: {
    name: 'categories',
    ai: 'c',
    alias: 'c',
    desc: 'Manage categories',
    actions: {
      list: {
        default: true,
        desc: 'List categories'
      },
      new: {
        ai: 'n',
        desc: 'Create category',
        args: [{ name: 'slug', required: true, desc: 'Category slug' }],
        options: [
          { name: 'short', flag: '--short', type: 'string', arg: '<text>', required: true, desc: 'Short description' },
          { name: 'long', flag: '--long', type: 'string', arg: '<text>', required: true, desc: 'Long description' },
          { name: 'ai', flag: '--ai', type: 'string', arg: '<text>', required: true, desc: 'AI summary (format: "name: keyword|keyword|keyword")' },
          { name: 'rules', flag: '--rules', type: 'string', arg: '<text>', required: true, desc: 'When to apply' },
          { name: 'example', flag: '--example', type: 'string', arg: '<text>', required: true, repeatable: true, desc: 'Example entry' }
        ]
      },
      update: {
        ai: 'u',
        desc: 'Update category',
        args: [{ name: 'slug', required: true, desc: 'Category slug' }],
        options: [
          { name: 'short', flag: '--short', type: 'string', arg: '<text>', desc: 'Short description' },
          { name: 'long', flag: '--long', type: 'string', arg: '<text>', desc: 'Long description' },
          { name: 'ai', flag: '--ai', type: 'string', arg: '<text>', desc: 'AI summary (format: "name: keyword|keyword|keyword")' },
          { name: 'rules', flag: '--rules', type: 'string', arg: '<text>', desc: 'When to apply' },
          { name: 'example', flag: '--example', type: 'string', arg: '<text>', repeatable: true, desc: 'Add example' }
        ]
      },
      rm: {
        desc: 'Delete category',
        args: [{ name: 'slug', required: true, desc: 'Category slug' }]
      }
    },
    examples: {
      human: [
        'kbcli categories',
        'kbcli categories new auth --short "Auth patterns" --long "OAuth, JWT, sessions" --ai "auth: oauth|jwt|session" --rules "For login, tokens, identity" --example "OAuth flow" --example "JWT refresh"'
      ],
      ai: [
        'kbcli c',
        'kbcli c n auth --short "Auth patterns" --long "OAuth, JWT, sessions" --ai "auth: oauth|jwt|session" --rules "For login, tokens, identity" --example "OAuth flow" --example "JWT refresh"'
      ]
    }
  },

  profiles: {
    name: 'profiles',
    ai: 'p',
    alias: 'p',
    desc: 'View research profiles',
    longDesc: 'Lists available research profiles that optimize queries for different tasks. Use with -p flag in research command.',
    examples: {
      human: [
        'kbcli profiles',
        'kbcli research --profile code "React hooks"'
      ],
      ai: [
        'kbcli p',
        'kbcli r -p code "React hooks"'
      ]
    }
  },

  providers: {
    name: 'providers',
    ai: 'pv',
    desc: 'View API providers',
    longDesc: 'Lists available API providers and their configuration status. Shows which providers are ready to use.',
    examples: {
      human: [
        'kbcli providers'
      ],
      ai: [
        'kbcli pv'
      ]
    }
  }
};

// Global options available on all commands
const globalOptions = [
  {
    name: 'output',
    flag: '--output',
    ai: '-o',
    alias: '-o',
    type: 'string',
    arg: '<format>',
    values: ['md', 'json', 'ai'],
    desc: 'Output format'
  },
  {
    name: 'help',
    flag: '--help',
    ai: '-h',
    alias: '-h',
    type: 'boolean',
    desc: 'Show help'
  }
];

/**
 * Find a command by name, alias, or AI name
 * @param {string} name - Command name to find
 * @returns {Object|null} Command definition or null
 */
function findCommand(name) {
  if (!name) return null;

  for (const [key, cmd] of Object.entries(registry)) {
    if (key === name || cmd.alias === name || cmd.ai === name) {
      return { ...cmd, key };
    }
  }
  return null;
}

/**
 * Find an action within a command by name or AI name
 * @param {Object} command - Command definition
 * @param {string} actionName - Action name to find
 * @returns {Object|null} Action definition with key, or null
 */
function findAction(command, actionName) {
  if (!command.actions || !actionName) return null;

  for (const [key, action] of Object.entries(command.actions)) {
    if (key === actionName || action.ai === actionName) {
      return { ...action, key };
    }
  }
  return null;
}

/**
 * Get the default action for a command
 * @param {Object} command - Command definition
 * @returns {Object|null} Default action with key, or null
 */
function getDefaultAction(command) {
  if (!command.actions) return null;

  for (const [key, action] of Object.entries(command.actions)) {
    if (action.default) {
      return { ...action, key };
    }
  }
  return null;
}

/**
 * Get all command names (for validation/help)
 * @param {string} mode - 'human' or 'ai'
 * @returns {Array} List of command names
 */
function getCommandNames(mode = 'human') {
  return Object.entries(registry).map(([key, cmd]) => {
    return mode === 'ai' ? cmd.ai : key;
  });
}

module.exports = {
  registry,
  globalOptions,
  findCommand,
  findAction,
  getDefaultAction,
  getCommandNames
};
