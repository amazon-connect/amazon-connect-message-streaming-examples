// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { log } = require('common-util');
const crypto = require('crypto');
const inboundHelper = require('../inboundHelper');
const CHANNEL_TYPE = 'WHATSAPP';
const AWS = require('aws-sdk');
const secretManager = new AWS.SecretsManager();

const handler = async (messagePayloadString) => {
  log.debug('WhatsApp message handler');

  const messagePayload = JSON.parse(messagePayloadString);
  log.debug('messagePayload.object:', messagePayload.object);
  
  await processWhatsAppMessagePayload(messagePayload);
};

const processWhatsAppMessagePayload = async (messagePayload) => {
  const vendorIdParticipantMap = {};
  log.debug('processWhatsAppMessagePayload');
  // Get all participants for unique vendor ids
  // Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components

  // Process each individual message
  for (const entry of messagePayload.entry) {
    log.debug('Entry', entry);
    for (const change of entry.changes) { 
      if (change.value.messages === undefined) {
        log.info(
          'Ignoring WhatsApp event, missing "messages" object'
        );
        continue;
      }
      for (const [message, messageContent] of Object.entries(change.value.messages)) {
        const vendorId = await getWhatsAppVendorId(messageContent);        
        await inboundHelper
          .getOrCreateParticipant(CHANNEL_TYPE, vendorId)
          .then((participant) => {
              vendorIdParticipantMap[vendorId] = participant;
          })  
        await processWhatsAppMessage(messageContent, vendorIdParticipantMap[vendorId]);        
      }
    }
  }
};

const processWhatsAppMessage = async (message, participant) => {
  log.debug("processMessage message: ", message)
  if (message === undefined) {
    log.warn('Undefined message');
    return;
  }
   
  switch (message.type) {
    // Media types from https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages#media-object
    case 'audio':
      messageToSend = `User sent an audio message - unsupported`;
      break
    case 'button': 
      messageToSend = `User sent button - unsupported`;
      break
     case 'context': 
      messageToSend = `User sent context - unsupported`;
      break
    case 'document': 
      messageToSend = `User sent a document - unsupported`;
      break
    case 'image': 
      messageToSend = `User sent an image - unsupported`;
      break
    case 'interactive': 
      messageToSend = `User sent an interactive message - unsupported `;
      break
    case 'location': 
      messageToSend = `User sent their location: ${JSON.stringify(message.location)}`;
      break
    case 'reaction':
      messageToSend = `User reacted with emoji: ${message.reaction.emoji}`;
      break
    case 'sticker': 
      messageToSend = `User sent a sticker - unsupported`;
      break
    case 'template': 
      messageToSend = `User sent a template  - unsupported`;
      break

    // Support regular text based message
    case 'text':
      messageToSend = message.text.body;
      break;
    default:
      log.warn(
        `WhatsApp message type "${message.type}" not supported.`
      );
    }; 
    await inboundHelper.sendMessage(participant, messageToSend);
}

const getWhatsAppVendorId = async (message) => {
  return message.from;
};

let appSecret = undefined;
const validateRequest = async (request) => {
  if (appSecret === undefined) {
    await getWhatsAppSecrets();
  }

  if (appSecret === null) {
    log.error('App Secret not found. Cannot process record.');
    return false;
  }

  const signature = request.headers['x-hub-signature-256'];

  if (signature === undefined) {
    log.warn('No signature found.  Request invalid.');
    return false;
  }
  const requestHash = signature.split('=')[1];

  const payloadHash = crypto
    .createHmac('sha256', appSecret)
    .update(request.body)
    .digest('hex');

  if (requestHash === payloadHash) {
    log.debug('WhatsApp Request Validation - Hash match');
    return true;
  } else {
    log.debug('WhatsApp Request Validation - Hash does not match');
    return false;
  }
};

const getWhatsAppSecrets = async () => {
  if(process.env.WA_SECRET){
    const params = {
      SecretId: process.env.WA_SECRET
    }
    const response = await secretManager.getSecretValue(params).promise();
    appSecret = JSON.parse(response.SecretString).WA_APP_SECRET
  } else {
    appSecret = null;
  }
  
};

module.exports = { handler, validateRequest };
