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
    this.delimiter = '/';
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
   * Check if a folder exists on the IMAP server
   *
   * @param {string} folderPath - Folder path to check (can include nested folders with delimiter)
   * @returns {Promise<boolean>} - True if folder exists, false otherwise
   */
  async folderExists(folderPath) {
    await this.connect();
    
    try {
      // Normalize path to account for different separators if needed
      const normalizedPath = folderPath.replace(/[\/\\]/g, this.delimiter);
      
      // Use status to check if the mailbox exists
      // Request minimal status info (messages count is sufficient to check existence)
      const status = await this.client.status(normalizedPath, {uidValidity: true});
      console.log(`folderExists status for ${normalizedPath}`, status);
      // If we get a status response, the mailbox exists
      return status !== null;
    } catch (error) {
      // If the error is specifically about the mailbox not existing
      if (error.code === 'NONEXISTENT') {
        return false;
      }
      
      // For other errors, log and return false
      console.error(`Error checking if folder exists: ${error.message}`);
      return false;
    }
  }

  /**
   * Create a folder and all intermediate folders if they don't exist
   *
   * @param {string} folderPath - Path of the folder to create
   * @returns {Promise<boolean>} - True if created successfully, false otherwise
   */
  async folderMake(folderPath) {
    await this.connect();
    
    try {
      // Normalize and sanitize the path:
      // 1. Replace all forward/backward slashes with the IMAP delimiter
      // 2. Split by delimiter and filter out empty parts to handle:
      //    - Leading delimiters (e.g., "/folder/subfolder")
      //    - Trailing delimiters (e.g., "folder/subfolder/")
      //    - Multiple consecutive delimiters (e.g., "folder//subfolder")
      // 3. Rejoin with the IMAP delimiter
      const normalizedPath = folderPath
        .replace(/[\/\\]/g, this.delimiter)
        .split(this.delimiter)
        .filter(Boolean)
        .join(this.delimiter);
      
      // First check if the full path already exists
      if (await this.folderExists(normalizedPath)) {
        return true;
      }
      
      // Split the sanitized path into components
      const parts = normalizedPath.split(this.delimiter);
      
      // Start with the full path and work backwards
      let currentPath = normalizedPath;
      
      while (parts.length > 0) {
        // Remove the last part of the path
        parts.pop();
        currentPath = parts.join(this.delimiter);
        
        // Check if the current path exists
        if (await this.folderExists(currentPath)) {
          // Found the deepest existing parent, now create the remaining folders
          for (let i = parts.length; i < normalizedPath.split(this.delimiter).length; i++) {
            currentPath = currentPath ? 
              currentPath + this.delimiter + normalizedPath.split(this.delimiter)[i] :
              normalizedPath.split(this.delimiter)[i];
            await this.client.mailboxCreate(currentPath);
          }
          return true;
        }
      }
      
      // If we get here, we need to create the entire path from root
      currentPath = '';
      for (const part of normalizedPath.split(this.delimiter)) {
        currentPath = currentPath ? currentPath + this.delimiter + part : part;
        await this.client.mailboxCreate(currentPath);
      }
      
      return true;
    } catch (error) {
      console.error(`Error creating folder structure: ${error.message}`);
      return false;
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
  async moveMessage(sourceFolder, targetFolder, uid) {
    await this.connect();

    // Find the message first
    const lock = await this.client.getMailboxLock(sourceFolder);

    try {
      // Move the message with uid option
      await this.client.messageMove(uid, targetFolder, { uid: true });

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
        const sesId = this.#extractSesIdFromHeaders(headerStr);
        if (sesId) {
          message.sesId = sesId;
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
   * Extract SES ID from email headers
   * 
   * @private
   * @param {string} headerStr - Raw header string to parse
   * @returns {string|null} - Extracted SES ID or null if not found
   */
  #extractSesIdFromHeaders(headerStr) {
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

        return extractedSesId;
      }
    }
    return null;
  }

  /**
   * Search for a message by its AWS SES ID
   *
   * @param {string} folder - Folder to search in
   * @param {string} sesId - SES ID to search for
   * @returns {Promise<Object|null>} - Message object if found, null otherwise
   */
  async searchMessageBySesId(folder, sesId) {
    await this.connect();

    const lock = await this.client.getMailboxLock(folder);

    try {
      // Get the total number of messages
      const mailbox = this.client.mailbox;

      if (!mailbox.exists) {
        return null;
      }

      // Search from newest to oldest
      for (let i = mailbox.exists; i > 0; i--) {
        const message = await this.client.fetchOne(i, {
          uid: true,
          flags: true,
          envelope: true,
          headers: ['received'],
        });

        if (message) {
          message.headers = message.headers.toString('utf8');
          const headerStr = message.headers;
          const extractedSesId = this.#extractSesIdFromHeaders(headerStr);
          
          if (extractedSesId === sesId) {
            message.sesId = extractedSesId;
            return message;
          }
        }
      }

      return null;
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
