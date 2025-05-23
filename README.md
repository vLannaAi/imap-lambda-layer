# IMAP Lambda Layer

A lightweight AWS Lambda Layer for interacting with IMAP servers. This library provides a simplified interface for common IMAP operations, built on top of the [ImapFlow](https://github.com/postalsys/imapflow) library.

## Features

- Connect to IMAP servers (with TLS support)
- Search for messages by Message-ID
- Move messages between folders
- List folders and messages
- Check if folders exist and create folder hierarchies
- Optimized for AWS Lambda environments with connection reuse
- Modern ES Modules syntax
- Node.js 22+ compatibility

## Requirements

- Node.js 22 or later
- AWS Lambda Node.js 22 runtime

## Installation

### As a Lambda Layer

1. Download the pre-packaged Lambda Layer zip file from the releases section
2. Upload it to AWS Lambda as a layer
3. Add the layer to your Lambda function

### Manual Installation

```bash
npm install imap-lambda-layer
```

### Building from Source

```bash
# Clone the repository
git clone https://github.com/vLannaAi/imap-lambda-layer.git
cd imap-lambda-layer

# Install dependencies
npm install

# Build the Lambda Layer package
npm run package
```

The packaged Lambda Layer will be available in the `dist` directory as `imap-lambda-layer.zip`.

## Usage

### In AWS Lambda

```javascript
// Import the ImapClient from the Lambda Layer
import { ImapClient, getImapClient } from '/opt/nodejs/imap-lambda-layer/index.mjs';

export const handler = async (event, context) => {
  // Configure IMAP client
  const config = {
    host: process.env.IMAP_HOST,
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    secure: process.env.IMAP_SECURE !== 'false',
    auth: {
      user: process.env.IMAP_USER,
      pass: process.env.IMAP_PASSWORD
    }
  };
  
  // Get or create IMAP client (using the optimized instance reuse)
  const imapClient = getImapClient(config);
  
  try {
    // Connect to the IMAP server
    await imapClient.connect();
    
    // Search for a message by Message-ID
    const message = await imapClient.findMessageByMessageId(
      'INBOX',
      '<example-message-id@domain.com>'
    );
    
    // Move a message from one folder to another
    const moveResult = await imapClient.moveMessage(
      'INBOX',
      'Archive',
      '<example-message-id@domain.com>'
    );
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message,
        moveResult
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
  // Note: We don't disconnect in the finally block anymore
  // because we're reusing the connection across invocations
};
```

## Lambda Optimization

This library is optimized for AWS Lambda environments by implementing connection pooling. Connections are cached and reused across function invocations when the Lambda container is reused, which can significantly improve performance.

```javascript
// Get a cached client instance (recommended for Lambda)
import { getImapClient } from '/opt/nodejs/imap-lambda-layer/index.mjs';
const imapClient = getImapClient(config);

// If you need to clear the connection cache (rarely needed)
import { clearImapClientCache } from '/opt/nodejs/imap-lambda-layer/index.mjs';
await clearImapClientCache();
```

## API Reference

### ImapClient

#### Constructor

```javascript
import { ImapClient } from '/opt/nodejs/imap-lambda-layer/index.mjs';
const imapClient = new ImapClient(config);
```

- `config` (Object): IMAP connection configuration
  - `host` (string): IMAP server hostname
  - `port` (number): IMAP server port (default: 993 for secure, 143 for insecure)
  - `secure` (boolean): Whether to use secure connection (default: true)
  - `auth` (Object): Authentication details
    - `user` (string): Username
    - `pass` (string): Password
  - `tls` (Object, optional): TLS options
    - `rejectUnauthorized` (boolean): Whether to reject unauthorized certificates

#### Methods

##### connect()

Connects to the IMAP server.

```javascript
await imapClient.connect();
```

##### disconnect()

Disconnects from the IMAP server.

```javascript
await imapClient.disconnect();
```

##### findMessageByMessageId(folder, messageId)

Searches for a message by Message-ID in the specified folder.

```javascript
const message = await imapClient.findMessageByMessageId('INBOX', '<example-message-id@domain.com>');
```

- `folder` (string): Folder to search in
- `messageId` (string): Message-ID to search for
- Returns: Message object or null if not found

##### moveMessage(sourceFolder, targetFolder, messageId)

Moves a message from one folder to another.

```javascript
const result = await imapClient.moveMessage('INBOX', 'Archive', '<example-message-id@domain.com>');
```

- `sourceFolder` (string): Source folder
- `targetFolder` (string): Target folder
- `messageId` (string): Message-ID of the message to move
- Returns: Boolean indicating success or failure

##### listFolders()

Lists all folders.

```javascript
const folders = await imapClient.listFolders();
```

- Returns: Array of folder objects

##### listMessages(folder, limit)

Lists messages in a folder.

```javascript
const messages = await imapClient.listMessages('INBOX', 10);
```

- `folder` (string): Folder to list messages from
- `limit` (number, optional): Maximum number of messages to return (default: 10)
- Returns: Array of message objects

##### listSESMessages(folder, limit)

Lists messages in a folder and extracts AWS SES ID from messages sent through Amazon SES.

```javascript
const messages = await imapClient.listSESMessages('INBOX', 10);
```

- `folder` (string): Folder to list messages from
- `limit` (number, optional): Maximum number of messages to return (default: 10)
- Returns: Array of message objects with an additional `sesId` property for messages sent through AWS SES

##### searchMessageBySesId(folder, sesId)

Searches for a message by its AWS SES ID in the specified folder.

```javascript
const message = await imapClient.searchMessageBySesId('INBOX', 'YOUR-SES-MESSAGE-ID');
```

- `folder` (string): Folder to search in
- `sesId` (string): AWS SES ID to search for
- Returns: Message object with the `sesId` property if found, null otherwise

##### getMessageHeaders(folder, identifier, headerName)

Gets message headers from a message identified by UID or Message-ID.

```javascript
// Get all headers as an object
const allHeaders = await imapClient.getMessageHeaders('INBOX', '<example-message-id@domain.com>');

// Get a specific header
const subject = await imapClient.getMessageHeaders('INBOX', '<example-message-id@domain.com>', 'subject');

// Using UID instead of Message-ID
const allHeaders = await imapClient.getMessageHeaders('INBOX', 12345);
```

- `folder` (string): Folder containing the message
- `identifier` (string|number): Either a Message-ID string or a UID number
- `headerName` (string, optional): Specific header name to extract
- Returns: All headers as object, specific header as string, or null if not found

##### getRawMessageHeaders(folder, identifier, headerName)

Gets raw message headers from a message identified by UID or Message-ID.

```javascript
// Get all raw headers as a string
const rawHeaders = await imapClient.getRawMessageHeaders('INBOX', '<example-message-id@domain.com>');
```

- `folder` (string): Folder containing the message
- `identifier` (string|number): Either a Message-ID string or a UID number
- `headerName` (string, optional): Specific header name to extract (case-insensitive)
- Returns: Raw headers as string, specific header line, or null if not found

##### folderExists(folderPath)

Checks if a folder exists on the IMAP server.

```javascript
// Check if a folder exists
const exists = await imapClient.folderExists('INBOX/Archive');

// Check nested folders
const exists = await imapClient.folderExists('INBOX/Work/Projects/2023');
```

- `folderPath` (string): Folder path to check (can include nested folders with delimiter)
- Returns: Boolean indicating whether the folder exists

##### folderMake(folderPath)

Creates a folder and all intermediate folders if they don't exist.

```javascript
// Create a folder (and any missing parent folders in the path)
const created = await imapClient.folderMake('INBOX/Archive/2023/Q4');
```

- `folderPath` (string): Path of the folder to create (including nested structure)
- Returns: Boolean indicating success or failure

### Utility Functions

#### getImapClient(config)

Gets a cached IMAP client instance or creates a new one.

```javascript
import { getImapClient } from '/opt/nodejs/imap-lambda-layer/index.mjs';
const imapClient = getImapClient(config);
```

- `config` (Object): IMAP connection configuration (same as ImapClient constructor)
- Returns: ImapClient instance

#### clearImapClientCache()

Clears all cached IMAP client instances.

```javascript
import { clearImapClientCache } from '/opt/nodejs/imap-lambda-layer/index.mjs';
await clearImapClientCache();
```

## Development

### Prerequisites

- Node.js 22.x or later
- npm 8.x or later

### Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Run tests: `npm test`

### Build Scripts

The package includes several npm scripts to help with development:

- `npm run clean` - Clean artifacts and prepare dist directory
- `npm run build` - Build the Lambda Layer
- `npm run install-deps` - Install production dependencies
- `npm run zip` - Create the zip package
- `npm run package` - Run all of the above in sequence
- `npm test` - Run tests

### Testing

To run the tests, you need to set the following environment variables:

```bash
export IMAP_HOST=imap.example.com
export IMAP_PORT=993
export IMAP_USER=your-username
export IMAP_PASSWORD=your-password
export TEST_MESSAGE_ID=<example-message-id@domain.com>
export SOURCE_FOLDER=INBOX
export TARGET_FOLDER=Archive

npm test
```

## License

MIT
