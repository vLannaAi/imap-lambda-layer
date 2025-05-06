/**
 * Example Lambda function that uses the IMAP Lambda Layer
 * 
 * This demonstrates how to use the ImapClient in an AWS Lambda function
 * to perform common IMAP operations.
 */

// Import the ImapClient from the Lambda Layer
import { ImapClient, getImapClient } from '/opt/nodejs/imap-lambda-layer/index.mjs';

/**
 * Lambda handler function
 * 
 * @param {Object} event - Lambda event object
 * @param {Object} context - Lambda context object
 * @returns {Promise<Object>} - Response object
 */
export const handler = async (event, context) => {
  // Configure IMAP client
  const config = {
    host: process.env.IMAP_HOST,
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    secure: process.env.IMAP_SECURE !== 'false',
    auth: {
      user: process.env.IMAP_USER,
      pass: process.env.IMAP_PASSWORD
    },
    // Optional: Add TLS options if needed
    tls: {
      rejectUnauthorized: process.env.IMAP_REJECT_UNAUTHORIZED !== 'false'
    }
  };
  
  // Get or create IMAP client (using the optimized instance reuse)
  const imapClient = getImapClient(config);
  
  try {
    // Connect to the IMAP server
    await imapClient.connect();
    
    // Determine the operation to perform based on the event
    const operation = event.operation || 'findMessage';
    
    let result;
    
    switch (operation) {
      case 'findMessage':
        // Find a message by Message-ID
        result = await imapClient.findMessageByMessageId(
          event.folder || 'INBOX',
          event.messageId
        );
        break;
        
      case 'moveMessage':
        // Move a message from one folder to another
        result = await imapClient.moveMessage(
          event.sourceFolder || 'INBOX',
          event.targetFolder,
          event.messageId
        );
        break;
        
      case 'listFolders':
        // List all folders
        result = await imapClient.listFolders();
        break;
        
      case 'listMessages':
        // List messages in a folder
        result = await imapClient.listMessages(
          event.folder || 'INBOX',
          event.limit || 10
        );
        break;
        
      case 'getHeaders':
        // Get processed message headers
        result = await imapClient.getMessageHeaders(
          event.folder || 'INBOX',
          event.identifier || event.messageId,
          event.headerName
        );
        break;
        
      case 'getRawHeaders':
        // Get raw message headers
        result = await imapClient.getRawMessageHeaders(
          event.folder || 'INBOX',
          event.identifier || event.messageId,
          event.headerName
        );
        break;
        
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
    
    // Return the result
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        operation,
        result
      })
    };
  } catch (error) {
    // Log the error
    console.error('Error:', error);
    
    // Return an error response
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        operation: event.operation,
        error: error.message
      })
    };
  }
  // Note: We don't disconnect in the finally block anymore
  // because we're reusing the connection across invocations
  // The connection will be managed by the getImapClient function
};
