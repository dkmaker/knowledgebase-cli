const { BaseProvider } = require('./base');
const { PerplexityProvider } = require('./perplexity');

/**
 * Registry of all available providers
 */
const providers = {
  perplexity: PerplexityProvider
};

/**
 * Get a provider class by name
 * @param {string} name - Provider name
 * @returns {typeof BaseProvider|null}
 */
function getProvider(name) {
  return providers[name] || null;
}

/**
 * Get all available providers (those with API keys configured)
 * @returns {Array<{name: string, displayName: string, available: boolean}>}
 */
function listProviders() {
  return Object.entries(providers).map(([name, Provider]) => ({
    name,
    displayName: Provider.displayName,
    available: Provider.isAvailable(),
    envKey: Provider.envKey
  }));
}

/**
 * Get the first available provider
 * @returns {typeof BaseProvider|null}
 */
function getFirstAvailable() {
  for (const Provider of Object.values(providers)) {
    if (Provider.isAvailable()) {
      return Provider;
    }
  }
  return null;
}

module.exports = {
  BaseProvider,
  PerplexityProvider,
  providers,
  getProvider,
  listProviders,
  getFirstAvailable
};
