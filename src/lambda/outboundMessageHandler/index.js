// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');
const { log } = require('common-util');
const sms = require('./lib/handlers/sms');
const fb = require('./lib/handlers/facebook');
const wa = require('./lib/handlers/whatsapp');
const { lookupContactId, deleteRecord } = require('./lib/outboundHelper');
const SMS_CHANNEL_TYPE = 'SMS';
const FB_CHANNEL_TYPE = 'FACEBOOK';
const WA_CHANNEL_TYPE = 'WHATSAPP';
const CUSTOMER_ROLE = 'CUSTOMER';
const PARTICIPANT_LEFT_CONTENT_TYPE =
  'application/vnd.amazonaws.connect.event.participant.left';
const CHAT_ENDED_CONTENT_TYPE =
  'application/vnd.amazonaws.connect.event.chat.ended';
const CUSTOMER = 'CUSTOMER';
const ALL = 'ALL';

exports.handler = async (event) => {
  log.debug('Event', event);

  if (event.Records === undefined) {
    const errorText = 'Unsupported event type. event.Records not defined.';
    log.error(errorText);
    throw new Error(errorText);
  }

  log.debug(`Processing ${event.Records.length} records`);
  for (let i = 0; i < event.Records.length; i++) {
    const record = event.Records[i];
    if (!validateRecord(record)) {
      continue;
    }

    // Lookup contact info from Dynamo
    const recordLookup = await lookupContactId(
      record.Sns.MessageAttributes.InitialContactId.Value
    );

    // If record doesn't exist, report error
    if (recordLookup === null) {
      log.error(
        `Record not found for ContactID "${record.Sns.MessageAttributes.InitialContactId.Value}"`,
        record.Sns
      );
      continue;
    }

    if (
      record.Sns.MessageAttributes.ContentType.Value === CHAT_ENDED_CONTENT_TYPE
    ) {
      await deleteRecord(recordLookup.contactId);
      continue;
    }

    await handleMessage(record, recordLookup);
  }
};

const validateRecord = (record) => {
  if (record.EventSource !== 'aws:sns') {
    log.warn(
      'Unsuported event source for record.  Record will not be processed.',
      record
    );
    return false;
  }

  // Ensure we don't send customer messages back to the customer.
  if (
    (record.Sns.MessageAttributes.ParticipantRole === undefined ||
      record.Sns.MessageAttributes.ParticipantRole.Value === CUSTOMER_ROLE) &&
    record.Sns.MessageAttributes.ContentType.Value !== CHAT_ENDED_CONTENT_TYPE &&
    ((record.Sns.MessageAttributes.MessageVisibility.Value == CUSTOMER || 
      record.Sns.MessageAttributes.MessageVisibility.Value == ALL) && 
      record.Sns.MessageAttributes.MessageVisibility.Value != CUSTOMER)
  ) {
    log.debug('Customer event.  Ignoring.');
    return false;
  }

  // Event for the agent leaving the conversation
  if (
    record.Sns.MessageAttributes.ContentType === undefined ||
    record.Sns.MessageAttributes.ContentType.Value ===
      PARTICIPANT_LEFT_CONTENT_TYPE
  ) {
    log.debug('Agent leaving conversation event.  Ignoring.');
    return false;
  }

  return true;
};

const handleMessage = async (record, recordLookup) => {
  switch (recordLookup.channel) {
    case SMS_CHANNEL_TYPE:
      await sms.handler(recordLookup.vendorId, JSON.parse(record.Sns.Message));
      break;
    case FB_CHANNEL_TYPE:
      await fb.handler(recordLookup.vendorId, JSON.parse(record.Sns.Message));
      break;
    case WA_CHANNEL_TYPE:
      await wa.handler(recordLookup.vendorId, JSON.parse(record.Sns.Message));
      break;
    default:
      log.error(`Unsupported channel type: ${recordLookup.channel}`);
      break;
  }
};
