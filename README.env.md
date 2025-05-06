# How to configure your .env file

Edit the `.env` file with your actual IMAP server information. Here are examples for common email providers:

## Gmail Example
```
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=your-gmail@gmail.com
IMAP_PASSWORD=your-app-password  # Use an app password if you have 2FA enabled
IMAP_SECURE=true
IMAP_REJECT_UNAUTHORIZED=true
TEST_MESSAGE_ID=<your-message-id>
SOURCE_FOLDER=INBOX
TARGET_FOLDER=[Gmail]/Trash
```

## Outlook/Office 365 Example
```
IMAP_HOST=outlook.office365.com
IMAP_PORT=993
IMAP_USER=your-email@outlook.com
IMAP_PASSWORD=your-password
IMAP_SECURE=true
IMAP_REJECT_UNAUTHORIZED=true
TEST_MESSAGE_ID=<your-message-id>
SOURCE_FOLDER=INBOX
TARGET_FOLDER=Deleted Items
```

## Yahoo Mail Example
```
IMAP_HOST=imap.mail.yahoo.com
IMAP_PORT=993
IMAP_USER=your-email@yahoo.com
IMAP_PASSWORD=your-password
IMAP_SECURE=true
IMAP_REJECT_UNAUTHORIZED=true
TEST_MESSAGE_ID=<your-message-id>
SOURCE_FOLDER=INBOX
TARGET_FOLDER=Trash
```

## Finding a Message-ID

To find a message ID:
1. Open an email in your email client
2. View the message source/headers 
3. Look for a header called 'Message-ID' (it will be in the format `<some-id@domain.com>`)

Remember to include the angle brackets in the TEST_MESSAGE_ID value.

## Running the test

After configuring your `.env` file:

```bash
node test.js
``` 