/**
 * IMAP Lambda Layer
 * 
 * This module exports the ImapClient class for use in AWS Lambda functions.
 * It provides simplified IMAP operations for common tasks.
 */

import { ImapClient, getImapClient, clearImapClientCache } from './imap-client.mjs';

export {
  ImapClient,
  getImapClient,
  clearImapClientCache
};
