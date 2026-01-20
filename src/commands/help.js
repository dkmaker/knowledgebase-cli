/**
 * Help Generator - Generates context-aware help from command registry
 *
 * Produces structured YAML output that differs based on mode:
 * - human: Full descriptions, human-readable command names
 * - ai: Minimal output, short command names, no redundant descriptions
 */

const { registry, globalOptions, findCommand } = require('./registry');

/**
 * Format an option for help output
 * @param {Object} opt - Option definition
 * @param {string} mode - 'human' or 'ai'
 * @returns {Object} Formatted option
 */
function formatOption(opt, mode) {
  // In AI mode, prefer ai/short flag names
  const flag = mode === 'ai' && opt.ai ? opt.ai : opt.flag;

  const result = { flag };

  if (opt.arg) result.arg = opt.arg;
  if (opt.values) result.values = opt.values;
  if (opt.default) result.default = opt.default;
  if (opt.required) result.required = true;
  if (opt.repeatable) result.repeatable = true;

  // Always include description - it's critical for understanding
  if (opt.desc) {
    result.desc = opt.desc;
  }

  return result;
}

/**
 * Format arguments for help output
 * @param {Array} args - Argument definitions
 * @param {string} mode - 'human' or 'ai'
 * @returns {string} Formatted args string
 */
function formatArgs(args, mode) {
  if (!args || args.length === 0) return null;

  return args.map(arg => {
    if (arg.required) {
      return `<${arg.name}>`;
    }
    return `[${arg.name}]`;
  }).join(' ');
}

/**
 * Generate root help (kbcli --help)
 * @param {string} mode - 'human' or 'ai'
 * @returns {Object} Structured help data
 */
function generateRootHelp(mode = 'human') {
  const result = {
    type: 'help',
    command: 'kbcli',
    usage: 'kbcli <command> [options]',
    commands: [],
    options: [],
    examples: []
  };

  // Add commands
  for (const [key, cmd] of Object.entries(registry)) {
    const name = mode === 'ai' ? cmd.ai : key;
    const cmdEntry = { name };

    if (cmd.args) {
      cmdEntry.args = formatArgs(cmd.args, mode);
    }

    // Only include description in human mode, or for AI if it's short
    if (mode === 'human' && cmd.desc) {
      cmdEntry.desc = cmd.desc;
    } else if (mode === 'ai') {
      cmdEntry.desc = cmd.desc;
    }

    result.commands.push(cmdEntry);
  }

  // Add global options
  for (const opt of globalOptions) {
    result.options.push(formatOption(opt, mode));
  }

  // Add examples
  if (mode === 'ai') {
    result.examples = [
      'kbcli r -p code "React hooks"',
      'kbcli d save abc --to graphql'
    ];
  } else {
    result.examples = [
      'kbcli research "What is GraphQL?"',
      'kbcli research --profile code "React hooks"',
      'kbcli drafts save abc --to graphql'
    ];
  }

  // Add terminology section to clarify domain concepts
  result.terminology = {
    slug: 'human-readable identifier (lowercase, e.g., graphql)',
    scope: 'entry context (repository, folder, or global)',
    profile: 'research mode (general, code, docs, troubleshoot)',
    draft: 'unsaved research entry',
    library: 'curated entry with category'
  };

  return result;
}

/**
 * Generate help for a specific command
 * @param {string} commandName - Command name (or alias/ai name)
 * @param {string} mode - 'human' or 'ai'
 * @returns {Object} Structured help data
 */
function generateCommandHelp(commandName, mode = 'human') {
  const cmd = findCommand(commandName);
  if (!cmd) {
    return {
      type: 'error',
      message: `Unknown command: ${commandName}`
    };
  }

  const cmdName = mode === 'ai' ? cmd.ai : cmd.key;

  const result = {
    type: 'help',
    command: cmdName
  };

  // Add description (use longDesc for detailed help, fallback to desc)
  if (cmd.longDesc) {
    result.desc = cmd.longDesc;
  } else if (cmd.desc) {
    result.desc = cmd.desc;
  }

  // Build usage string
  const hasOptions = cmd.options && cmd.options.length > 0;
  if (cmd.actions) {
    result.usage = `kbcli ${cmdName} [action] [options]`;
  } else if (cmd.args && hasOptions) {
    result.usage = `kbcli ${cmdName} [options] ${formatArgs(cmd.args, mode)}`;
  } else if (cmd.args) {
    result.usage = `kbcli ${cmdName} ${formatArgs(cmd.args, mode)}`;
  } else if (hasOptions) {
    result.usage = `kbcli ${cmdName} [options]`;
  } else {
    result.usage = `kbcli ${cmdName}`;
  }

  // Add args if present (for non-action commands)
  if (cmd.args && !cmd.actions) {
    result.args = cmd.args.map(arg => {
      const argDef = {
        name: arg.name,
        required: arg.required
      };
      if (mode === 'human' && arg.desc) {
        argDef.desc = arg.desc;
      }
      return argDef;
    });
  }

  // Add actions if present
  if (cmd.actions) {
    result.actions = [];

    for (const [actionKey, action] of Object.entries(cmd.actions)) {
      const actionName = mode === 'ai' && action.ai ? action.ai : actionKey;
      const actionEntry = {
        name: action.default ? `(${actionKey})` : actionName
      };

      if (action.args) {
        actionEntry.args = formatArgs(action.args, mode);
      }

      // Always include description - it's critical for understanding
      if (action.default) {
        actionEntry.desc = 'default';
      } else if (action.desc) {
        actionEntry.desc = action.desc;
      }

      result.actions.push(actionEntry);
    }

    // Group options by action
    result.options = {};
    for (const [actionKey, action] of Object.entries(cmd.actions)) {
      if (action.options && action.options.length > 0) {
        const actionName = mode === 'ai' && action.ai ? action.ai : actionKey;
        result.options[actionName] = action.options.map(opt => formatOption(opt, mode));
      }
    }

    // Remove empty options object
    if (Object.keys(result.options).length === 0) {
      delete result.options;
    }
  } else if (cmd.options) {
    // Direct options (non-action commands)
    result.options = cmd.options.map(opt => formatOption(opt, mode));
  }

  // Add examples
  if (cmd.examples) {
    result.examples = mode === 'ai' ? cmd.examples.ai : cmd.examples.human;
  }

  return result;
}

/**
 * Generate error response with suggestions
 * @param {string} message - Error message
 * @param {string} mode - 'human' or 'ai'
 * @param {Object} context - Additional context (e.g., unknown command value)
 * @returns {Object} Structured error data
 */
function generateError(message, mode = 'human', context = {}) {
  const result = {
    type: 'error',
    message
  };

  // Add available commands
  const commands = Object.entries(registry).map(([key, cmd]) => {
    return mode === 'ai' ? cmd.ai : key;
  });
  result.commands = commands;

  // Add suggestions
  if (context.unknownCommand) {
    if (mode === 'ai') {
      result.suggestions = [
        `kbcli r "${context.unknownCommand}"`,
        'kbcli -h'
      ];
    } else {
      result.suggestions = [
        { cmd: `kbcli research "${context.unknownCommand}"`, desc: 'Research this topic' },
        { cmd: 'kbcli --help', desc: 'Show help' }
      ];
    }
  }

  return result;
}

module.exports = {
  generateRootHelp,
  generateCommandHelp,
  generateError,
  formatOption,
  formatArgs
};
