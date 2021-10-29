// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const AWS = require('aws-sdk');
const secretManager = new AWS.SecretsManager();

const { log } = require('common-util');
let verifyToken = undefined;

exports.handler = async (event) => {
  log.debug('Event', event);

  if (verifyToken === undefined) {
    await getFacebookSecrets();
  }

  var queryParams = event.queryStringParameters;

  var rVerifyToken = queryParams['hub.verify_token'];

  if (rVerifyToken === verifyToken) {
    var challenge = queryParams['hub.challenge'];
    const response = {
      statusCode: 200,
      body: parseInt(challenge),
    };
    return response;
  } else {
    const response = {
      statusCode: 200,
      body: JSON.stringify('Wrong validation token'),
    };
    return response;
  }
};

// Production improvement: add error handling in here
const getFacebookSecrets = async () => {
  if (process.env.FB_SECRET) {
    const params = {
      SecretId: process.env.FB_SECRET,
    };
    const response = await secretManager.getSecretValue(params).promise();
    verifyToken = JSON.parse(response.SecretString).VERIFY_TOKEN;
  } else {
    verifyToken = null;
  }
};
