/**
 * IMAP Client for AWS Lambda
 * 
 * A lightweight wrapper around ImapFlow to provide simplified IMAP operations
 * for AWS Lambda functions.
 */

const { ImapFlow } = require('imapflow');

/**
 * IMAP Client class for interacting with IMAP servers
 */
class ImapClient {
  /**
   * Create a new IMAP client
   * 
   * @param {Object} config - IMAP connection configuration
   * @param {string} config.host - IMAP server hostname
   * @param {number} config.port - IMAP server port (default: 993 for secure, 143 for insecure)
   * @param {boolean} config.secure - Whether to use secure connection (default: true)
   * @param {Object} config.auth - Authentication details
   * @param {string} config.auth.user - Username
   * @param {string} config.auth.pass - Password
   * @param {boolean} config.tls - TLS options (optional)
   */
  constructor(config) {
    this.config = config;
    this.client = new ImapFlow(config);
    this.isConnected = false;
  }

  /**
   * Connect to the IMAP server
   * 
   * @returns {Promise<void>}
   */
  async connect() {
    if (!this.isConnected) {
      await this.client.connect();
      this.isConnected = true;
    }
  }

  /**
   * Disconnect from the IMAP server
   * 
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.isConnected) {
      await this.client.logout();
      this.isConnected = false;
    }
  }

  /**
   * Search for a message by Message-ID
   * 
   * @param {string} folder - Folder to search in
   * @param {string} messageId - Message-ID to search for
   * @returns {Promise<Object|null>} - Message object or null if not found
   */
  async findMessageByMessageId(folder, messageId) {
    await this.connect();
    
    // Clean the Message-ID if it includes angle brackets
    const cleanMessageId = messageId.replace(/^<|>$/g, '');
    
    // Get a lock on the mailbox
    const lock = await this.client.getMailboxLock(folder);
    
    try {
      // Search for the message
      const searchResults = await this.client.search({
        header: ['message-id', cleanMessageId]
      });
      
      if (!searchResults.length) {
        return null;
      }
      
      // Get the first matching message
      const uid = searchResults[0];
      
      // Fetch the message details
      const message = await this.client.fetchOne(uid, {
        uid: true,
        flags: true,
        envelope: true,
        bodyStructure: true,
        source: true
      });
      
      return message;
    } finally {
      // Always release the lock
      lock.release();
    }
  }

  /**
   * Move a message from one folder to another
   * 
   * @param {string} sourceFolder - Source folder
   * @param {string} targetFolder - Target folder
   * @param {string} messageId - Message-ID of the message to move
   * @returns {Promise<boolean>} - True if successful, false if message not found
   */
  async moveMessage(sourceFolder, targetFolder, messageId) {
    await this.connect();
    
    // Find the message first
    const lock = await this.client.getMailboxLock(sourceFolder);
    
    try {
      // Clean the Message-ID if it includes angle brackets
      const cleanMessageId = messageId.replace(/^<|>$/g, '');
      
      // Search for the message
      const searchResults = await this.client.search({
        header: ['message-id', cleanMessageId]
      });
      
      if (!searchResults.length) {
        return false;
      }
      
      // Get the first matching message
      const uid = searchResults[0];
      
      // Move the message
      await this.client.messageMove(uid, targetFolder);
      
      return true;
    } finally {
      // Always release the lock
      lock.release();
    }
  }

  /**
   * List all folders
   * 
   * @returns {Promise<Array>} - Array of folder objects
   */
  async listFolders() {
    await this.connect();
    
    const tree = await this.client.listTree();
    return tree;
  }

  /**
   * List messages in a folder
   * 
   * @param {string} folder - Folder to list messages from
   * @param {number} limit - Maximum number of messages to return (default: 10)
   * @returns {Promise<Array>} - Array of message objects
   */
  async listMessages(folder, limit = 10) {
    await this.connect();
    
    const lock = await this.client.getMailboxLock(folder);
    
    try {
      const messages = [];
      
      // Get the total number of messages
      const mailbox = this.client.mailbox;
      
      if (!mailbox.exists) {
        return [];
      }
      
      // Calculate the range to fetch (most recent messages first)
      const from = Math.max(1, mailbox.exists - limit + 1);
      const to = mailbox.exists;
      
      // Fetch messages
      for await (const message of this.client.fetch(`${from}:${to}`, {
        uid: true,
        flags: true,
        envelope: true
      })) {
        messages.push(message);
      }
      
      return messages.reverse(); // Return newest first
    } finally {
      // Always release the lock
      lock.release();
    }
  }
}

module.exports = ImapClient;
