// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const https = require('https');
const AWS = require('aws-sdk');
const { log } = require('common-util');

const PATH = '/v15.0';
let accessToken = undefined;
let phoneNoId = undefined;

const secretManager = new AWS.SecretsManager();

const handler = async (toPhoneNumber, message) => {
  if (message.Type === 'EVENT') {
    log.debug('Ignoring event message', message);
    return;
  }

  if (accessToken === undefined || phoneNoId === undefined) {
    await getWhatsAppSecrets();
  }

  if (accessToken === null) {
    log.error('WA_ACCESS_TOKEN not found in Secrets Manager');
  }

  if (phoneNoId === null) {
    log.error('WA_PHONE_NUMBER_ID not found in Secrets Manager');
  }

  return await sendMessage(toPhoneNumber, message);
};

const sendMessage = async (toPhoneNumber, message) => {
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toPhoneNumber,
    type: "text",
    text: { 
      preview_url: false,
      body: message.Content 
    },
  };

  const options = {
    host: 'graph.facebook.com',
    path: `${PATH}/${phoneNoId}/messages`,
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json' },
  };

  const result = await new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });

      res.on('end', () => {
        resolve(responseBody);
      });
    });

    req.on('error', (err) => {
      log.error('Error sending WA message', err);
      reject(err);
    });

    req.write(JSON.stringify(body));
    req.end();
  });

  const resultObj = JSON.parse(result);
  log.debug('Send WA Message result', result);

  if (resultObj.error !== undefined) {
    log.error('Error sending WA message', resultObj);
    return false;
  }

  return true;
};

const getWhatsAppSecrets = async () => {
  if(process.env.WA_SECRET){
    const params = {
      SecretId: process.env.WA_SECRET
    }
    const response = await secretManager.getSecretValue(params).promise();
    accessToken = JSON.parse(response.SecretString).WA_ACCESS_TOKEN
    phoneNoId = JSON.parse(response.SecretString).WA_PHONE_NUMBER_ID
  } else {
    accessToken = null;
    phoneNoId = null;
  }
  
};

module.exports = { handler };
