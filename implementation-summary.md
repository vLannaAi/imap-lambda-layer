# IMAP Lambda Layer Implementation Summary

## Project Overview
This document summarizes the implementation of a NodeJS lightweight library for AWS Lambda that interacts with IMAP servers. The library provides a simplified interface for common IMAP operations, including authentication, connection, message search by Message-ID, and moving messages between folders.

## Library Selection Process

### Libraries Evaluated
1. **node-imap**
   - 2.2k GitHub stars
   - 22,019 weekly downloads
   - 813 KB package size
   - Last updated 5 years ago
   - Callback-based API

2. **imapflow**
   - 414 GitHub stars
   - 78,828 weekly downloads
   - 659 KB package size
   - Last updated 1 month ago
   - Promise-based API with async/await support

3. **emailjs-imap-client**
   - 566 GitHub stars
   - 10,158 weekly downloads
   - 1.13 MB package size
   - Last updated 5 years ago
   - Promise-based API but not maintained

### Selection Criteria
- Active maintenance
- Modern JavaScript support (Promises, async/await)
- Lambda compatibility (size, dependencies)
- Feature completeness
- Documentation quality
- Community adoption

### Selected Library: ImapFlow
ImapFlow was selected as the optimal library due to:
- Active maintenance (last update 1 month ago)
- Modern Promise-based API with async/await support
- Smallest package size (659 KB)
- Highest weekly downloads (78,828)
- Comprehensive feature set
- Excellent documentation

## Implementation Details

### Project Structure
```
imap-lambda-layer/
├── dist/
│   └── imap-lambda-layer.zip      # Lambda Layer deployment package
├── nodejs/
│   ├── node_modules/              # Dependencies
│   ├── imap-client.js             # IMAP client implementation
│   ├── index.js                   # Main export file
│   └── package.json               # Package configuration
├── src/
│   ├── imap-client.js             # Source IMAP client implementation
│   └── index.js                   # Source main export file
├── example-lambda.js              # Example Lambda function
├── test.js                        # Test script
├── README.md                      # Documentation
└── package.json                   # Project configuration
```

### Core Functionality
The implementation provides a simple, high-level API for IMAP operations:

1. **Connection Management**
   - Connect to IMAP servers with TLS support
   - Automatic connection handling
   - Proper disconnection

2. **Message Operations**
   - Search for messages by Message-ID
   - Move messages between folders
   - List messages in folders

3. **Folder Management**
   - List all folders

### Lambda Integration
The library is packaged as an AWS Lambda Layer, making it easy to use in Lambda functions:

```javascript
// Import the ImapClient from the Lambda Layer
const { ImapClient } = require('/opt/nodejs/imap-layer');

exports.handler = async (event) => {
  const imapClient = new ImapClient({
    host: process.env.IMAP_HOST,
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    secure: true,
    auth: {
      user: process.env.IMAP_USER,
      pass: process.env.IMAP_PASSWORD
    }
  });
  
  try {
    await imapClient.connect();
    
    // Search for a message by Message-ID
    const message = await imapClient.findMessageByMessageId(
      'INBOX',
      event.messageId
    );
    
    // Move a message between folders
    if (message && event.targetFolder) {
      await imapClient.moveMessage(
        'INBOX',
        event.targetFolder,
        event.messageId
      );
    }
    
    return { success: true, message };
  } finally {
    await imapClient.disconnect();
  }
};
```

## Testing
A comprehensive test script is included to verify all functionality:
- Connection to IMAP servers
- Listing folders
- Listing messages
- Searching for messages by Message-ID
- Moving messages between folders

## Next Steps
1. Push the code to your GitHub repository (https://github.com/vLannaai)
2. Deploy the Lambda Layer to AWS
3. Create Lambda functions that use the layer
4. Configure environment variables for IMAP connection details

## Conclusion
The implemented IMAP Lambda Layer provides a simple, efficient way to interact with IMAP servers from AWS Lambda functions. It meets all the specified requirements and is ready for deployment and use in production environments.

## Header Extraction Methods

### `getMessageHeaders(folder, identifier, headerName)`

This method provides access to parsed message headers using ImapFlow's built-in header handling.

#### Implementation Details:

1. **Message Identification**:
   - Accepts either a UID (number) or Message-ID (string)
   - For Message-IDs, performs a search to find the corresponding UID
   - Handles proper cleaning of Message-IDs by removing angle brackets if present

2. **Header Fetching**:
   - Uses ImapFlow's `fetchOne` method with the `headers: true` option
   - ImapFlow automatically parses headers into a `Map` object

3. **Return Formats**:
   - When no specific header is requested: Returns a plain JavaScript object with all headers
   - When a specific header is requested: Returns just that header's value as a string
   - Returns `null` if the message is not found

4. **Resource Management**:
   - Uses mailbox locks to ensure proper IMAP protocol sequencing
   - Properly handles connections and disconnections
   - Always releases locks in the `finally` block to prevent deadlocks

### `getRawMessageHeaders(folder, identifier, headerName)`

This method provides access to raw, unparsed message headers, which is useful when you need the exact format of headers including original casing, multi-line formats, etc.

#### Implementation Details:

1. **Message Identification**:
   - Same approach as `getMessageHeaders` - accepts UID or Message-ID
   - Performs proper Message-ID cleaning and searching

2. **Raw Header Fetching**:
   - Uses ImapFlow's `fetchOne` method with the `headersBuf: true` option
   - This returns the raw headers as a Buffer object, which is then converted to a UTF-8 string

3. **Return Formats**:
   - When no specific header is requested: Returns the complete raw headers as a string
   - When a specific header is requested: Uses regex to extract the specific header line, including any folded lines
   - Returns `null` if the message is not found or the requested header doesn't exist

4. **Regular Expression for Header Extraction**:
   - Uses a case-insensitive regex that handles folded header lines (headers that span multiple lines)
   - Pattern: `/^HeaderName:\s*(.+(?:\r?\n\s+.+)*)/im`

## Use Cases

1. **Processed Headers (getMessageHeaders)**:
   - When you need normalized header values
   - When you want a clean JavaScript object structure
   - When you need to work with decoded headers (ImapFlow handles MIME decoding)

2. **Raw Headers (getRawMessageHeaders)**:
   - When you need the exact, original format of headers
   - When you need to preserve multi-line structures
   - When you need to see all header parameters exactly as they appear in the message

## Implementation Considerations

1. **Performance Optimization**:
   - Both methods reuse the same message identification logic
   - Mailbox locks are properly managed to prevent deadlocks
   - Connection reuse is maintained through the existing architecture

2. **Error Handling**:
   - Both methods handle cases where messages aren't found
   - Lock releasing is guaranteed through `finally` blocks
   - Connection states are properly managed

3. **AWS Lambda Optimization**:
   - These methods work seamlessly with the existing connection reuse mechanism
   - No additional connections are created, maintaining the Lambda optimization benefits

## Integration with Existing Code

The new methods follow the same patterns as the existing `ImapClient` methods:
- Similar parameter structure
- Similar error handling
- Similar resource management
- Consistent return value patterns
