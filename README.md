# IMAP Lambda Layer

A lightweight AWS Lambda Layer for interacting with IMAP servers. This library provides a simplified interface for common IMAP operations, built on top of the [ImapFlow](https://github.com/postalsys/imapflow) library.

## Features

- Connect to IMAP servers (with TLS support)
- Search for messages by Message-ID
- Move messages between folders
- List folders and messages
- Optimized for AWS Lambda environments

## Installation

### As a Lambda Layer

1. Download the pre-packaged Lambda Layer zip file from the releases section
2. Upload it to AWS Lambda as a layer
3. Add the layer to your Lambda function

### Manual Installation

```bash
npm install imap-lambda-layer
```

## Usage

### In AWS Lambda

```javascript
// Import the ImapClient from the Lambda Layer
const { ImapClient } = require('/opt/nodejs/imap-layer');

exports.handler = async (event, context) => {
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
  
  // Create IMAP client
  const imapClient = new ImapClient(config);
  
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
  } finally {
    // Always disconnect from the IMAP server
    await imapClient.disconnect();
  }
};
```

## API Reference

### ImapClient

#### Constructor

```javascript
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

## Development

### Prerequisites

- Node.js 14.x or later
- npm 6.x or later

### Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Run tests: `node test.js`

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

node test.js
```

## License

MIT
