// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const AWS = require('aws-sdk');
const secretManager = new AWS.SecretsManager();

const { log } = require('common-util');
let waVerifyToken = undefined;

exports.handler = async (event) => {
  log.debug('Event', event);

  if (waVerifyToken === undefined) {
    await getWhatsAppSecrets();
  }

  var queryParams = event.queryStringParameters;

  var rVerifyToken = queryParams['hub.verify_token'];

  if (rVerifyToken === waVerifyToken) {
    var challenge = queryParams['hub.challenge'];
    const response = {
      statusCode: 200,
      body: parseInt(challenge),
    };
    return response;
  } else {
    const response = {
      statusCode: 200,
      body: JSON.stringify('Wrong access token for WhatsApp'),
    };
    return response;
  }
};

// Production improvement: add error handling in here
const getWhatsAppSecrets = async () => {
  if (process.env.WA_SECRET) {
    const params = {
      SecretId: process.env.WA_SECRET,
    };
    const response = await secretManager.getSecretValue(params).promise();
    waVerifyToken = JSON.parse(response.SecretString).WA_VERIFY_TOKEN;
  } else {
    waVerifyToken = null;
  }
};
