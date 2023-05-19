# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.2] - 2023-05-19
-update dependencies 

## [1.1.1] - 2023-04-18
-update dependencies 

## [1.1] - 2023-02-09

Implementation of Whatsapp Channel

### Added
 - src/lambda/digitalChannelHealthCheck/lib/whatsapp.js to process WhatsApp webhook health check
- src/lambda/inboundMessageHandler/lib/handlers/whatsapp.js to process incoming WhatsApp messages
- src/lambda/outboundMessageHandler/lib/handlers/whatsapp.js to process outgoing WhatsApp messages
### Changed
- lib/chat-message-streaming-examples-stack.ts to deploy infrastructure with WhatsApp support
- src/lambda/digitalChannelHealthCheck/index.js to provide WhatsApp webhook health check response
- src/lambda/inboundMessageHandler/index.js to add WhatsApp webhook for incoming messages
- src/lambda/inboundMessageHandler/lib/inboundHelper.js to add WhatsApp channel SNS mapping
- src/lambda/outboundMessageHandler/index.js to add WhatsApp channel support for outbound messaging

## [1.0.0] - 2022-09-09
### Added
-  redact.js to add in PII redaction functionality

### Changed
- inboundHelper.js to add in logic for turning on redaction capabilities
- chat-message-streaming-examples-stack.ts to give permissions to Amazon Comprehend
- full-arch.png to include call to Amazon Comprehend



