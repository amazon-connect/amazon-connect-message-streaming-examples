// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');
const { log } = require('common-util');

const pinpoint = new AWS.Pinpoint();

const { PINPOINT_APPLICATION_ID, SMS_NUMBER } = process.env;

const handler = async (phoneNumber, message) => {
  if (message.Type === 'EVENT') {
    log.debug('Ignoring event message', message);
    return;
  }

  await sendMessage(phoneNumber, message);
};

const sendMessage = async (phoneNumber, message) => {
  const params = {
    ApplicationId: PINPOINT_APPLICATION_ID,
    MessageRequest: {
      Addresses: {
        [phoneNumber]: {
          ChannelType: 'SMS',
        },
      },
      MessageConfiguration: {
        SMSMessage: {
          Body: message.Content,
          OriginationNumber: SMS_NUMBER,
          MessageType: "TRANSACTIONAL"
        },
      },
    },
  };

  log.debug('Send pinpoint message params', params);
  const result = await pinpoint.sendMessages(params).promise();
  log.debug('Send pinpoint message result', result);

  if (result.MessageResponse.Result[phoneNumber].StatusCode !== 200) {
    log.error('SMS Send failure', { params, result });
    // Production improvement: error handling.
    return false;
  }

  return true;
};

module.exports = { handler };
