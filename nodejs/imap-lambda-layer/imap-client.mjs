/**
 * IMAP Client for AWS Lambda
 *
 * A lightweight wrapper around ImapFlow to provide simplified IMAP operations
 * for AWS Lambda functions.
 */

import { ImapFlow } from "imapflow";

/**
 * IMAP Client class for interacting with IMAP servers
 */
export class ImapClient {
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
    const cleanMessageId = messageId.replace(/^<|>$/g, "");

    // Get a lock on the mailbox
    const lock = await this.client.getMailboxLock(folder);

    try {
      // Search for the message
      const searchResults = await this.client.search({
        header: ["message-id", cleanMessageId],
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
        source: true,
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
      const cleanMessageId = messageId.replace(/^<|>$/g, "");

      // Search for the message
      const searchResults = await this.client.search({
        header: ["message-id", cleanMessageId],
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
        envelope: true,
      })) {
        messages.push(message);
      }

      return messages.reverse(); // Return newest first
    } finally {
      // Always release the lock
      lock.release();
    }
  }



  /**
   * List AWS SES messages in a folder
   *
   * @param {string} folder - Folder to list messages from
   * @param {number} limit - Maximum number of messages to return (default: 10)
   * @returns {Promise<Array>} - Array of message objects with sesId property
   */
  async listSESMessages(folder, limit = 10) {
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
        envelope: true,
        headers: ['received'],
      })) {
        console.log(' A message', message);
        message.headers = message.headers.toString('utf8');
        const headerStr = message.headers;
        if (headerStr.includes('amazonaws.com') && headerStr.includes('SMTP id')) {
          const smtpIdIndex = headerStr.indexOf('SMTP id');
          if (smtpIdIndex > 0) {
            const afterSmtpId = headerStr.substring(smtpIdIndex + 8).trim();
            let extractedSesId;            
            // The SES ID is the next word (until whitespace, newline, or semicolon)
            const endOfIdSpace = afterSmtpId.indexOf(' ');
            const endOfIdNewline = afterSmtpId.indexOf('\n');
            const endOfIdSemicolon = afterSmtpId.indexOf(';');
            
            if (endOfIdSpace > 0) {
              extractedSesId = afterSmtpId.substring(0, endOfIdSpace).trim();
            } else if (endOfIdNewline > 0) {
              extractedSesId = afterSmtpId.substring(0, endOfIdNewline).trim();
            } else if (endOfIdSemicolon > 0) {
              extractedSesId = afterSmtpId.substring(0, endOfIdSemicolon).trim();
            } else {
              extractedSesId = afterSmtpId.trim();
            }

            message.sesId = extractedSesId;
          }
        }

        messages.push(message);
      }

      return messages.reverse(); // Return newest first
    } finally {
      // Always release the lock
      lock.release();
    }
  }

  /**
   * Get message headers from a message identified by UID or Message-ID
   *
   * @param {string} folder - Folder containing the message
   * @param {string|number} identifier - Either a Message-ID string or a UID number
   * @param {string} [headerName] - Optional specific header name to extract
   * @returns {Promise<Object|string|null>} - All headers as object, specific header as string, or null if not found
   */
  async getMessageHeaders(folder, identifier, headerName = null) {
    await this.connect();

    const lock = await this.client.getMailboxLock(folder);

    try {
      let uid;

      // Check if identifier is a UID (number) or Message-ID (string)
      if (typeof identifier === "number") {
        uid = identifier;
      } else {
        // Clean the Message-ID if it includes angle brackets
        const cleanMessageId = identifier.replace(/^<|>$/g, "");

        // Search for the message by Message-ID
        const searchResults = await this.client.search({
          header: ["message-id", cleanMessageId],
        });

        if (!searchResults.length) {
          return null;
        }

        uid = searchResults[0];
      }

      // Fetch only the headers
      const message = await this.client.fetchOne(uid, {
        uid: true,
        headers: true,
      });

      if (!message) {
        return null;
      }

      // If a specific header is requested, return just that header
      if (headerName) {
        const headerValue = message.headers.get(headerName);
        return headerValue;
      }

      // Convert headers Map to a plain object for easier handling
      const headersObject = {};
      for (const [key, value] of message.headers) {
        headersObject[key] = value;
      }

      return headersObject;
    } finally {
      // Always release the lock
      lock.release();
    }
  }

  /**
   * Get raw message headers from a message identified by UID or Message-ID
   *
   * @param {string} folder - Folder containing the message
   * @param {string|number} identifier - Either a Message-ID string or a UID number
   * @param {string} [headerName] - Optional specific header name to extract (case-insensitive)
   * @returns {Promise<string|null>} - Raw headers as string, specific header line, or null if not found
   */
  async getRawMessageHeaders(folder, identifier, headerName = null) {
    await this.connect();

    const lock = await this.client.getMailboxLock(folder);

    try {
      let uid;

      // Check if identifier is a UID (number) or Message-ID (string)
      if (typeof identifier === "number") {
        uid = identifier;
      } else {
        // Clean the Message-ID if it includes angle brackets
        const cleanMessageId = identifier.replace(/^<|>$/g, "");

        // Search for the message by Message-ID
        const searchResults = await this.client.search({
          header: ["message-id", cleanMessageId],
        });

        if (!searchResults.length) {
          return null;
        }

        uid = searchResults[0];
      }

      // Fetch the message with headersBuf which gives us a Buffer with raw headers
      const message = await this.client.fetchOne(uid, {
        uid: true,
        headersBuf: true,
      });

      if (!message || !message.headersBuf) {
        return null;
      }

      // Convert buffer to string
      const headersString = message.headersBuf.toString("utf-8");

      // If a specific header is requested, extract just that header line
      if (headerName) {
        const headerRegex = new RegExp(
          `^${headerName}:\\s*(.+(?:\\r?\\n\\s+.+)*)`,
          "im"
        );
        const match = headersString.match(headerRegex);
        return match ? match[0] : null;
      }

      return headersString;
    } finally {
      // Always release the lock
      lock.release();
    }
  }
}

// Add Lambda optimization for instance reuse
let clientInstances = new Map();

/**
 * Get a cached IMAP client instance or create a new one
 *
 * @param {Object} config - IMAP connection configuration
 * @returns {ImapClient} - IMAP client instance
 */
export function getImapClient(config) {
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
export async function clearImapClientCache() {
  const disconnectPromises = [];

  for (const client of clientInstances.values()) {
    disconnectPromises.push(
      client
        .disconnect()
        .catch((err) => console.error("Error disconnecting client:", err))
    );
  }

  await Promise.all(disconnectPromises);
  clientInstances.clear();
}
