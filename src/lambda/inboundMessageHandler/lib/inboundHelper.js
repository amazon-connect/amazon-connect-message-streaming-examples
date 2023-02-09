// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');
const { log } = require('common-util');
const redact = require('./redact');

const connect = new AWS.Connect();
const connectParticipant = new AWS.ConnectParticipant();
const ddb = new AWS.DynamoDB.DocumentClient();

const ACKNOWLEDGED_EVENT_CONTENT_TYPE =
  'application/vnd.amazonaws.connect.event.connection.acknowledged';
const TYPING_EVENT_CONTENT_TYPE =
  'application/vnd.amazonaws.connect.event.typing';

const {
  CONTACT_TABLE,
  AMAZON_CONNECT_ARN,
  CONTACT_FLOW_ID,
  DIGITAL_OUTBOUND_SNS_TOPIC,
  SMS_OUTBOUND_SNS_TOPIC,
  VENDOR_ID_CHANNEL_INDEX_NAME,
} = process.env;

const channelSNSTopicMap = {
  SMS: SMS_OUTBOUND_SNS_TOPIC,
  FB: DIGITAL_OUTBOUND_SNS_TOPIC,
  WHATSAPP: DIGITAL_OUTBOUND_SNS_TOPIC,
  default: DIGITAL_OUTBOUND_SNS_TOPIC,
};

////////////////////
// Public Methods //
////////////////////
const getOrCreateParticipant = async (channel, vendorId) => {
  const existingParticipant = await checkForExistingParticipant(
    channel,
    vendorId
  );

  // Condition to check 1/ there is an existing chat AND 2/ The chat has not completed (indicated by no S3 transcript) AND 3/ Chat is less than 24 hours old
  if (
    existingParticipant !== null //&&
    //getCurrentTime() - existingParticipant.datetime < parseInt(SESSION_DURATION)
  ) {
    log.debug('Existing participant', existingParticipant);
    if (existingParticipant.connectionCredentials === undefined) {
      const connectionCreds = await createParticipantConnection(
        existingParticipant.ParticipantToken
      );

      existingParticipant.connectionCredentials = connectionCreds;

      // Production improvement: Update database with connection credentials
    }
    return existingParticipant;
  }
  log.debug('creating participant', { channel, vendorId });

  // If any of the above condition is not met, new chat contact is connected but could be linked together through previous/next/current contact Ids

  const participant = await addNewParticipant(
    channel,
    vendorId,
    existingParticipant
  );
  log.debug('finished creating participant', { channel, vendorId });


  return participant;
};

const sendMessage = async (participant, message) => {
  let messageToSend = '';
  if (process.env.PII_DETECTION_TYPES) {
    messageToSend = await redact.redactPII(message);
    log.debug(`redactPII returned: ${messageToSend}`);
  }
  else {
    messageToSend = message;
  }

  const params = {
    ConnectionToken: participant.connectionCredentials.token,
    Content: messageToSend,
    ContentType: 'text/plain',
  };
  log.debug('Send message params', params);
  const result = await connectParticipant.sendMessage(params).promise();
  log.debug('Send message result', result);
};

const sendAttachment = async (participant, url) => {
  const params = {
    ConnectionToken: participant.connectionCredentials.token,
    Content: message,
    ContentType: 'text/plain',
  };
  log.debug('Send message params', params);
  const result = await connectParticipant.sendMessage(params).promise();
  log.debug('Send message result', result);
};

const sendAcknowledgedEvent = async (participant) => {
  await sendEvent(participant, ACKNOWLEDGED_EVENT_CONTENT_TYPE);
};

const sendTypingEvent = async (participant) => {
  await sendEvent(participant, TYPING_EVENT_CONTENT_TYPE);
};

/////////////////////
// Private Methods //
/////////////////////
const startContactStreaming = async (channel, participant) => {
  const snsTopic =
    channelSNSTopicMap[channel] !== undefined
      ? channelSNSTopicMap[channel]
      : channelSNSTopicMap.default;

  const streamingParams = {
    InstanceId: getConnectInstanceId(AMAZON_CONNECT_ARN),
    ContactId: participant.contactId,
    ChatStreamingConfiguration: {
      StreamingEndpointArn: snsTopic
    },
  };

  // Production improvement: error handling
  log.debug('Start Contact Streaming params', streamingParams);
  const streamingResult = await connect
    .startContactStreaming(streamingParams)
    .promise();
  log.debug('Start Contact Streaming Result', streamingResult);

};

const checkForExistingParticipant = async (channel, vendorId) => {
  const params = {
    TableName: CONTACT_TABLE,
    IndexName: VENDOR_ID_CHANNEL_INDEX_NAME,
    KeyConditionExpression: 'vendorId = :vendorId and channel = :channel',
    ExpressionAttributeValues: {
      ':vendorId': vendorId,
      ':channel': channel,
    },
  };
  log.debug('Check existing participant params', params);
  const result = await ddb.query(params).promise();
  log.debug('Check existing participant result', result);

  if (
    result.Items === undefined ||
    result.Items === null ||
    result.Items.length === 0
  ) {
    log.debug('Existing participant not found');

    return null;
  }

  log.debug('Existing participant found', result.Items[0]);
  return result.Items[0];
};

const addNewParticipant = async (channel, vendorId, existingParticipant) => {
  const params = {
    ContactFlowId: CONTACT_FLOW_ID,
    InstanceId: getConnectInstanceId(AMAZON_CONNECT_ARN),
    ParticipantDetails: {
      DisplayName: vendorId,
    },
    Attributes: {
      chatframework_Channel: channel,
      chatframework_VendorId: vendorId,
    },
  };

  log.debug('Create new chat params', params);
  const result = await connect.startChatContact(params).promise();
  const startStreamingParams = {
    contactId: result.ContactId,
    participantId: result.ParticipantId
  }
  const startStreaming = await startContactStreaming(channel, startStreamingParams);
  log.debug('Create new chat results', result);

  const connectionCreds = await createParticipantConnection(
    result.ParticipantToken
  );
  log.debug('Create participant connection results', connectionCreds);

  const updateResults = await updatePreviousConnectionData(
    existingParticipant,
    result
  );

  const ddbItem = {
    vendorId,
    channel,
    contactId: result.ContactId,
    previousContactId:
      existingParticipant === null
        ? 'INITIAL_CHAT'
        : existingParticipant.previousContactId,
    s3Key: existingParticipant === null ? 'NONE' : existingParticipant.s3Key,
    nextContactId: 'CURRENT_CHAT',
    participantId: result.ParticipantId,
    participantToken: result.ParticipantToken,
    connectionCredentials: {
      token: connectionCreds.ConnectionToken,
      expiration: connectionCreds.Expiry,
    },
    datetime: Date.now(),
  };
  const ddbParams = {
    TableName: CONTACT_TABLE,
    Item: ddbItem,
  };

  log.debug('Put participant info params', ddbParams);
  const ddbResult = await ddb.put(ddbParams).promise();
  log.debug('Put participant info result', ddbResult);

  return ddbItem;
};

const updatePreviousConnectionData = async (
  existingParticipant,
  startChatResult
) => {
  if (existingParticipant === null) {
    return;
  } else {
    const params = {
      TableName: CONTACT_TABLE,
      Key: {
        contactId: existingParticipant.previousContactId,
      },
      UpdateExpression: 'set nextContactId = :next',
      ExpressionAttributeValues: {
        ':next': startChatResult.ContactId,
      },
    };
    const ddbResult = await ddb.update(params).promise();
    log.debug('Put participant info result', ddbResult);
    return ddbResult;
  }
};

const createParticipantConnection = async (participantToken) => {
  const params = {
    ParticipantToken: participantToken,
    Type: ['CONNECTION_CREDENTIALS'],
    ConnectParticipant: true
  };

  log.debug('Create participant params', params);
  const result = await connectParticipant
    .createParticipantConnection(params)
    .promise();
  log.debug('Create participant result', result);

  return result.ConnectionCredentials;
};

const sendEvent = async (participant, eventType) => {
  if (
    participant === undefined ||
    participant === null ||
    participant.connectionCredentials === null ||
    participant.connectionCredentials === undefined ||
    participant.connectionCredentials.token === undefined
  ) {
    const ex = new Error('Participant credentials do not exist');
    log.error('Error sending Event', ex);
    throw ex;
  }

  const params = {
    ConnectionToken: participant.connectionCredentials.token,
    ContentType: eventType,
  };

  log.debug('Send event params', params);
  const result = await connectParticipant.sendEvent(params).promise();
  // Production improvement: Code for failure path
  log.debug('Send event result', result);
};

const getConnectInstanceId = (connectArn) => {
  const instanceArnSplit = connectArn.split('/');
  return instanceArnSplit[instanceArnSplit.length - 1];
};

const getCurrentTime = () => {
  return Math.floor(Date.now() / 1000);
};

module.exports = {
  getOrCreateParticipant,
  sendMessage,
  sendAcknowledgedEvent,
  sendTypingEvent,
};
