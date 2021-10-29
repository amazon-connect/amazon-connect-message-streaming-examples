// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { log } = require('common-util');
const crypto = require('crypto');
const inboundHelper = require('../inboundHelper');
const CHANNEL_TYPE = 'FACEBOOK';
const AWS = require('aws-sdk');
const secretManager = new AWS.SecretsManager();
const handler = async (messagePayloadString) => {
  log.debug('Facebook message handler');

  const messagePayload = JSON.parse(messagePayloadString);

  await processMessagePayload(messagePayload);
};

const processMessagePayload = async (messagePayload) => {
  const vendorIdParticipantMap = {};
  const participantGetOrCreatePromises = [];

  // Get all participants for unique vendor ids
  // Docs: https://developers.facebook.com/docs/messenger-platform/reference/webhook-events
  for (let i = 0; i < messagePayload.entry.length; i++) {
    const entry = messagePayload.entry[i];

    // One webhook event do not have messaging objects.  Not supported.
    if (entry.messaging === undefined) {
      log.warn(
        'Facebook "standby" webhook event is not supported.  Unsubscribe from this webhook event to reduce traffic.'
      );
      continue;
    }

    
    for (let j = 0; j < entry.messaging.length; j++) {
      const messaging = entry.messaging[j];

      if (messaging.message === undefined) {
        log.warn(
          'Facebook "read" webhook event is not supported.  Unsubscribe from this webhook event to reduce traffic.'
        );
        continue;
      }
      const vendorId = await getVendorId(messaging);
      await inboundHelper
        .getOrCreateParticipant(CHANNEL_TYPE, vendorId)
        .then((participant) => {
          vendorIdParticipantMap[vendorId] = participant;
        })

      // participantGetOrCreatePromises.push(
      //   inboundHelper
      //     .getOrCreateParticipant(CHANNEL_TYPE, vendorId)
      //     .then((participant) => {
      //       vendorIdParticipantMap[vendorId] = participant;
      //     })
      // );
    }
  }

  // Await getting all unique participants
  // await Promise.all(participantGetOrCreatePromises);
  log.debug('vendor id participant map', vendorIdParticipantMap);

  // Process each individual message
  for (let i = 0; i < messagePayload.entry.length; i++) {
    const entry = messagePayload.entry[i];
    log.debug('Entry', entry);
    for (let j = 0; j < entry.messaging.length; j++) {
      const messaging = entry.messaging[j];

      const vendorId = await getVendorId(messaging);

      const participant = vendorIdParticipantMap[vendorId];

      log.debug('Message', messaging.message);
      log.debug('Participant', participant);
      await processMessage(messaging.message, participant);
    }
  }
};

const processMessage = async (message, participant) => {
  if (message === undefined) {
    log.warn('Undefined message');
    return;
  }

  // Do not accept message echos
  // https://developers.facebook.com/docs/messenger-platform/reference/webhook-events/message-echoes
  if (message.is_echo == true) {
    log.warn(
      'Facebook "message_echoes" webhook event is not supported.  Unsubscribe from this webhook event to reduce traffic.'
    );
    return;
  }

  // Support regular text based message
  if (message.text !== undefined) {
    await inboundHelper.sendMessage(participant, message.text);

    // Support gifs, images, thumbs up
  } else if (message.attachments !== undefined) {
    log.debug('Attachments found', message.attachments);

    for (let i = 0; i < message.attachments.length; i++) {
      const attachment = message.attachments[i];
      // Attachment types from https://developers.facebook.com/docs/messenger-platform/reference/webhook-events/messages
      let attachmentMessage;
      switch (attachment.type) {
        case 'image':
          attachmentMessage = `User sent an image: ${attachment.payload.url}`;
          break;
        case 'video':
          attachmentMessage = `User sent a video: ${attachment.payload.url}`;
          break;
        case 'audio':
          attachmentMessage = `User sent an audio message: ${attachment.payload.url}`;
          break;
        case 'file':
          attachmentMessage = `User sent a file: ${attachment.payload.url}`;
          break;
        default:
          log.warn(
            `Facebook attachment type "${message.attachments[i].type}" not supported.`
          );
          continue;
      }

      await inboundHelper.sendMessage(participant, attachmentMessage);
    }
  } else {
    log.warn('Unsupported message detected.', message);
  }
};

const getVendorId = async (messaging) => {
  return messaging.sender.id;
};

let appSecret = undefined;
const validateRequest = async (request) => {
  if (appSecret === undefined) {
    await getFacebookSecrets();
  }

  if (appSecret === null) {
    log.error('FB Secret not found.  Cannot process record.');
    return false;
  }

  const signature = request.headers['x-hub-signature'];

  if (signature === undefined) {
    log.warn('No signature found.  Request invalid.');
    return false;
  }
  const requestHash = signature.split('=')[1];

  const payloadHash = crypto
    .createHmac('sha1', appSecret)
    .update(request.body)
    .digest('hex');

  if (requestHash === payloadHash) {
    log.debug('Facebook Request Validation - Hash match');
    return true;
  } else {
    log.debug('Facebook Request Validation - Hash does not match');
    return false;
  }
};

const getFacebookSecrets = async () => {
  if(process.env.FB_SECRET){
    const params = {
      SecretId: process.env.FB_SECRET
    }
    const response = await secretManager.getSecretValue(params).promise();
    appSecret = JSON.parse(response.SecretString).APP_SECRET
  } else {
    appSecret = null;
  }
  
};

module.exports = { handler, validateRequest };
