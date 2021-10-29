// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const inboundHelper = require('../inboundHelper');
const CHANNEL_TYPE = 'SMS';

const handler = async (messageString) => {
  const message = JSON.parse(messageString);
  const participant = await inboundHelper.getOrCreateParticipant(
    CHANNEL_TYPE,
    getVendorId(message)
  );

  await inboundHelper.sendMessage(participant, message.messageBody);
};

const getVendorId = (message) => {
  return message.originationNumber;
};

module.exports = { handler };
