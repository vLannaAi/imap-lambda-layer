/**
 * IMAP Lambda Layer - CommonJS exports
 */

const { ImapClient } = require('./imap-client');

// Create a cache for client instances
const clientInstances = new Map();

/**
 * Get a cached IMAP client instance or create a new one
 * 
 * @param {Object} config - IMAP connection configuration
 * @returns {ImapClient} - IMAP client instance
 */
function getImapClient(config) {
  const key = `${config.host}:${config.port}:${config.auth.user}`;
  
  if (!clientInstances.has(key)) {
    clientInstances.set(key, new ImapClient(config));
  }
  
  return clientInstances.get(key);
}

/**
 * Clear all cached IMAP client instances
 * 
 * @returns {Promise<void>}
 */
async function clearImapClientCache() {
  const disconnectPromises = [];
  
  for (const client of clientInstances.values()) {
    disconnectPromises.push(client.disconnect().catch(err => console.error('Error disconnecting client:', err)));
  }
  
  await Promise.all(disconnectPromises);
  clientInstances.clear();
}

module.exports = {
  ImapClient,
  getImapClient,
  clearImapClientCache
}; 