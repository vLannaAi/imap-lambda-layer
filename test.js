/**
 * Test script for IMAP Lambda Layer
 * 
 * This script tests the core functionality of the IMAP client:
 * 1. Connecting to an IMAP server
 * 2. Searching for a message by Message-ID
 * 3. Moving a message from one folder to another
 * 
 * To run this test, you need to set the following environment variables:
 * - IMAP_HOST: IMAP server hostname
 * - IMAP_PORT: IMAP server port (default: 993)
 * - IMAP_USER: IMAP username
 * - IMAP_PASSWORD: IMAP password
 * - IMAP_SECURE: Whether to use secure connection (default: true)
 * - TEST_MESSAGE_ID: Message-ID to search for
 * - SOURCE_FOLDER: Source folder for move operation (default: INBOX)
 * - TARGET_FOLDER: Target folder for move operation
 */

const { ImapClient } = require('./nodejs/imap-lambda-layer');

// Configuration from environment variables
const config = {
  host: process.env.IMAP_HOST || 'localhost',
  port: parseInt(process.env.IMAP_PORT || '993', 10),
  secure: process.env.IMAP_SECURE !== 'false',
  auth: {
    user: process.env.IMAP_USER || '',
    pass: process.env.IMAP_PASSWORD || ''
  },
  tls: {
    rejectUnauthorized: process.env.IMAP_REJECT_UNAUTHORIZED !== 'false'
  }
};

// Test parameters
const testMessageId = process.env.TEST_MESSAGE_ID || '';
const sourceFolder = process.env.SOURCE_FOLDER || 'INBOX';
const targetFolder = process.env.TARGET_FOLDER || 'Trash';

// Create IMAP client
const imapClient = new ImapClient(config);

/**
 * Run tests
 */
async function runTests() {
  try {
    console.log('Starting IMAP client tests...');
    
    // Test 1: Connect to IMAP server
    console.log('\nTest 1: Connecting to IMAP server...');
    await imapClient.connect();
    console.log('✅ Connected to IMAP server successfully');
    
    // Test 2: List folders
    console.log('\nTest 2: Listing folders...');
    const folders = await imapClient.listFolders();
    console.log(`✅ Found ${folders.length} folders:`);
    folders.forEach(folder => {
      console.log(`  - ${folder.path}`);
    });
    
    // Test 3: List messages in INBOX
    console.log('\nTest 3: Listing messages in INBOX...');
    const messages = await imapClient.listMessages('INBOX', 5);
    console.log(`✅ Found ${messages.length} messages in INBOX`);
    if (messages.length > 0) {
      console.log('  First message:');
      console.log(`  - Subject: ${messages[0].envelope.subject}`);
      console.log(`  - From: ${messages[0].envelope.from[0].address}`);
      console.log(`  - Date: ${messages[0].envelope.date}`);
    }
    
    // Test 4: Search for message by Message-ID
    if (testMessageId) {
      console.log(`\nTest 4: Searching for message with Message-ID: ${testMessageId}...`);
      const message = await imapClient.findMessageByMessageId(sourceFolder, testMessageId);
      
      if (message) {
        console.log('✅ Message found:');
        console.log(`  - UID: ${message.uid}`);
        console.log(`  - Subject: ${message.envelope.subject}`);
        console.log(`  - From: ${message.envelope.from[0].address}`);
        
        // Test 5: Move message
        if (targetFolder) {
          console.log(`\nTest 5: Moving message to ${targetFolder}...`);
          const moveResult = await imapClient.moveMessage(sourceFolder, targetFolder, testMessageId);
          
          if (moveResult) {
            console.log(`✅ Message moved successfully to ${targetFolder}`);
          } else {
            console.log('❌ Failed to move message');
          }
        }
      } else {
        console.log(`❌ Message with Message-ID ${testMessageId} not found`);
      }
    } else {
      console.log('\nSkipping Message-ID search test (TEST_MESSAGE_ID not provided)');
    }
    
    console.log('\nAll tests completed!');
  } catch (error) {
    console.error('Error during tests:', error);
  } finally {
    // Disconnect from IMAP server
    try {
      await imapClient.disconnect();
      console.log('\nDisconnected from IMAP server');
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  }
}

// Run the tests
runTests();
