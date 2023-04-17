// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const AWS = require('aws-sdk');
const secretManager = new AWS.SecretsManager();

const { log } = require('common-util');
let lnVerifyToken = undefined;

exports.handler = async (event) => {
  log.debug('Event', event);

  if (lnVerifyToken === undefined) {
    await getLINESecrets();
  }

  var queryParams = event.queryStringParameters;

  var rVerifyToken = queryParams['hub.verify_token'];

  if (rVerifyToken === lnVerifyToken) {
    var challenge = queryParams['hub.challenge'];
    const response = {
      statusCode: 200,
      body: parseInt(challenge),
    };
    return response;
  } else {
    const response = {
      statusCode: 200,
      body: JSON.stringify('Wrong access token for LINE'),
    };
    return response;
  }
};

// Production improvement: add error handling in here
const getLINESecrets = async () => {
  if (process.env.LN_SECRET) {
    const params = {
      SecretId: process.env.LN_SECRET,
    };
    const response = await secretManager.getSecretValue(params).promise();
    lnVerifyToken = JSON.parse(response.SecretString).LINE_VERIFY_TOKEN;
  } else {
    lnVerifyToken = null;
  }
};
