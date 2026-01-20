/**
 * Command Parser - Parses CLI arguments using the command registry
 *
 * Uses Node.js built-in util.parseArgs() for argument parsing.
 * Builds parseArgs configuration dynamically from registry.
 */

const { parseArgs } = require('node:util');
const { registry, globalOptions, findCommand, findAction, getDefaultAction } = require('./registry');

/**
 * Build parseArgs options configuration from registry options
 * @param {Array} options - Options from registry
 * @returns {Object} parseArgs options config
 */
function buildParseArgsOptions(options = []) {
  const config = {};

  for (const opt of options) {
    // Get the option name (camelCase)
    const name = opt.name;

    // Determine type for parseArgs
    config[name] = {
      type: opt.type === 'boolean' ? 'boolean' : 'string',
      multiple: opt.repeatable || false
    };

    // Add short flag if available (alias or ai)
    const shortFlag = opt.alias || opt.ai;
    if (shortFlag && shortFlag.startsWith('-') && !shortFlag.startsWith('--')) {
      config[name].short = shortFlag.substring(1);
    }
  }

  return config;
}

/**
 * Parse command line arguments
 * @param {Array} args - Raw arguments (process.argv.slice(2))
 * @returns {Object} Parsed result with command, action, values, positionals, error
 */
function parseCommand(args) {
  const result = {
    command: null,
    action: null,
    values: {},
    positionals: [],
    help: false,
    output: null,
    error: null
  };

  if (!args || args.length === 0) {
    return result;
  }

  // Check for global help flag first
  if (args.includes('--help') || args.includes('-h')) {
    result.help = true;
  }

  // Check for output format
  const outputIdx = args.findIndex(a => a === '--output' || a === '-o');
  if (outputIdx !== -1 && args[outputIdx + 1]) {
    result.output = args[outputIdx + 1];
  }

  // Find the command (first non-flag argument)
  let cmdArg = null;
  let cmdIdx = -1;
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith('-')) {
      cmdArg = args[i];
      cmdIdx = i;
      break;
    }
  }

  if (!cmdArg) {
    // No command specified, just flags
    return result;
  }

  // Find command in registry
  const command = findCommand(cmdArg);
  if (!command) {
    result.error = { type: 'unknown_command', value: cmdArg };
    return result;
  }

  result.command = command.key;

  // Get remaining args after command
  const remainingArgs = args.slice(cmdIdx + 1);

  // If command has actions, find the action
  if (command.actions) {
    // Look for action in remaining args
    let actionArg = null;
    let actionIdx = -1;
    for (let i = 0; i < remainingArgs.length; i++) {
      if (!remainingArgs[i].startsWith('-')) {
        actionArg = remainingArgs[i];
        actionIdx = i;
        break;
      }
    }

    let action = null;
    if (actionArg) {
      action = findAction(command, actionArg);
    }

    if (!action) {
      // Use default action or treat first positional as action arg
      action = getDefaultAction(command);
      if (action) {
        result.action = action.key;
        // If we found a positional but it's not an action, it might be an arg to default action
        if (actionArg && action.args) {
          // Parse with default action, keeping actionArg as positional
        }
      } else if (actionArg) {
        // No default action and unknown action
        result.error = { type: 'unknown_action', command: command.key, value: actionArg };
        return result;
      }
    } else {
      result.action = action.key;
      // Remove action from remaining args
      remainingArgs.splice(actionIdx, 1);
    }

    // Build options from action and global options
    const actionOptions = action?.options || [];
    const allOptions = [...actionOptions, ...globalOptions];
    const parseArgsConfig = buildParseArgsOptions(allOptions);

    try {
      const { values, positionals } = parseArgs({
        args: remainingArgs,
        options: parseArgsConfig,
        allowPositionals: true,
        strict: false
      });
      result.values = values;
      result.positionals = positionals;
    } catch (e) {
      result.error = { type: 'parse_error', message: e.message };
      return result;
    }
  } else if (command.options) {
    // Command has direct options (like research)
    const allOptions = [...command.options, ...globalOptions];
    const parseArgsConfig = buildParseArgsOptions(allOptions);

    try {
      const { values, positionals } = parseArgs({
        args: remainingArgs,
        options: parseArgsConfig,
        allowPositionals: true,
        strict: false
      });
      result.values = values;
      result.positionals = positionals;
    } catch (e) {
      result.error = { type: 'parse_error', message: e.message };
      return result;
    }
  } else {
    // Simple command (like profiles, providers)
    const parseArgsConfig = buildParseArgsOptions(globalOptions);

    try {
      const { values, positionals } = parseArgs({
        args: remainingArgs,
        options: parseArgsConfig,
        allowPositionals: true,
        strict: false
      });
      result.values = values;
      result.positionals = positionals;
    } catch (e) {
      result.error = { type: 'parse_error', message: e.message };
      return result;
    }
  }

  // Check help flag in values
  if (result.values.help) {
    result.help = true;
  }

  // Check output in values
  if (result.values.output) {
    result.output = result.values.output;
  }

  return result;
}

/**
 * Convert parsed result to the legacy args format used by handlers
 * This provides backward compatibility during migration
 * @param {Object} parsed - Result from parseCommand
 * @returns {Object} Legacy args format
 */
function toLegacyArgs(parsed) {
  const args = {
    subcommand: parsed.command,
    action: parsed.action,
    actionArg: parsed.positionals[0] || null,
    actionArg2: parsed.positionals[1] || null,
    help: parsed.help,
    output: parsed.output,
    query: null,
    // Map values to legacy names
    profile: parsed.values.profile || parsed.values.p,
    model: parsed.values.model || parsed.values.m,
    recency: parsed.values.recency,
    domains: parsed.values.domains,
    maxTokens: parsed.values.maxTokens,
    showThinking: parsed.values.thinking,
    showSources: parsed.values.sources,
    showExamples: parsed.values.examples,
    all: parsed.values.all,
    local: parsed.values.local,
    global: parsed.values.global,
    category: parsed.values.category,
    to: parsed.values.to,
    // Update options
    title: parsed.values.title,
    content: parsed.values.content,
    thinking: parsed.values.thinking,
    addSource: parsed.values.addSource,
    updateSource: parsed.values.updateSource,
    removeSource: parsed.values.removeSource,
    addExample: parsed.values.addExample,
    updateExample: parsed.values.updateExample,
    removeExample: parsed.values.removeExample,
    // Category options
    short: parsed.values.short,
    long: parsed.values.long,
    ai: parsed.values.ai,
    rules: parsed.values.rules,
    examples: parsed.values.example || []
  };

  // Handle research command - query is the positional
  if (parsed.command === 'research') {
    args.query = parsed.positionals.join(' ') || null;
  }

  return args;
}

module.exports = {
  parseCommand,
  toLegacyArgs,
  buildParseArgsOptions
};
