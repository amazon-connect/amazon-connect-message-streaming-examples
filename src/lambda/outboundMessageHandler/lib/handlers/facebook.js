// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const https = require('https');
const AWS = require('aws-sdk');
const { log } = require('common-util');
const crypto = require('crypto');

const PATH = '/v2.6/me/messages';
let pageToken = undefined;
let appSecret = undefined;

const secretManager = new AWS.SecretsManager();

const handler = async (facebookId, message) => {
  if (message.Type === 'EVENT') {
    log.debug('Ignoring event message', message);
    return;
  }

  if (pageToken === undefined || appSecret === undefined) {
    await getFacebookSecrets();
  }

  if (pageToken === null) {
    log.error('Page token not found');
  }

  return await sendMessage(facebookId, message);
};

const sendMessage = async (facebookId, message) => {
  const body = {
    recipient: { id: facebookId },
    message: { text: message.Content },
  };
  log.debug('Send FB Message body', body);

  const appsecret_proof = crypto.createHmac('sha256', appSecret).update(pageToken).digest('hex');
  const options = {
    host: 'graph.facebook.com',
    path: `${PATH}?access_token=${pageToken}&appsecret_proof=${appsecret_proof}`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
      log.error('Error sending FB message', err);
      reject(err);
    });

    req.write(JSON.stringify(body));
    req.end();
  });

  const resultObj = JSON.parse(result);
  log.debug('Send FB Message result', result);

  if (resultObj.error !== undefined) {
    log.error('Error sending FB message', resultObj);
    return false;
  }

  return true;
};


const getFacebookSecrets = async () => {
  if (process.env.FB_SECRET) {
    const params = {
      SecretId: process.env.FB_SECRET
    }
    const response = await secretManager.getSecretValue(params).promise();
    pageToken = JSON.parse(response.SecretString).PAGE_TOKEN
    appSecret = JSON.parse(response.SecretString).APP_SECRET
  } else {
    pageToken = null;
    appSecret = null;
  }
  
};

module.exports = { handler };
