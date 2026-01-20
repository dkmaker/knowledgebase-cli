/**
 * Commands Module - Exports command registry, parser, and help generator
 */

const { registry, globalOptions, findCommand, findAction, getDefaultAction, getCommandNames } = require('./registry');
const { parseCommand, toLegacyArgs, buildParseArgsOptions } = require('./parser');
const { generateRootHelp, generateCommandHelp, generateError } = require('./help');

module.exports = {
  // Registry
  registry,
  globalOptions,
  findCommand,
  findAction,
  getDefaultAction,
  getCommandNames,

  // Parser
  parseCommand,
  toLegacyArgs,
  buildParseArgsOptions,

  // Help
  generateRootHelp,
  generateCommandHelp,
  generateError
};
