/**
 * Basic test for IMAP Lambda Layer
 * 
 * This test verifies the ES modules syntax and functionality of the IMAP client.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ImapClient, getImapClient, clearImapClientCache } from '../src/index.mjs';

describe('IMAP Client', () => {
  it('should create an instance of ImapClient', () => {
    const config = {
      host: 'imap.example.com',
      port: 993,
      secure: true,
      auth: {
        user: 'test@example.com',
        pass: 'password'
      }
    };
    
    const client = new ImapClient(config);
    assert.strictEqual(typeof client, 'object');
    assert.strictEqual(client instanceof ImapClient, true);
    assert.strictEqual(client.isConnected, false);
  });
  
  it('should cache client instances with getImapClient', () => {
    const config = {
      host: 'imap.example.com',
      port: 993,
      secure: true,
      auth: {
        user: 'test@example.com',
        pass: 'password'
      }
    };
    
    const client1 = getImapClient(config);
    const client2 = getImapClient(config);
    
    assert.strictEqual(client1 instanceof ImapClient, true);
    assert.strictEqual(client1, client2, 'Should return the same cached instance');
    
    // Different config should return different instance
    const config2 = {
      host: 'imap.another.com',
      port: 993,
      secure: true,
      auth: {
        user: 'test@example.com',
        pass: 'password'
      }
    };
    
    const client3 = getImapClient(config2);
    assert.notStrictEqual(client1, client3, 'Should return different instance for different config');
  });
  
  it('should clear client cache with clearImapClientCache', async () => {
    const config = {
      host: 'imap.example.com',
      port: 993,
      secure: true,
      auth: {
        user: 'test@example.com',
        pass: 'password'
      }
    };
    
    const client1 = getImapClient(config);
    await clearImapClientCache();
    const client2 = getImapClient(config);
    
    assert.notStrictEqual(client1, client2, 'Should return new instance after clearing cache');
  });
});
