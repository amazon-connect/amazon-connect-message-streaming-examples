// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { log } = require('common-util');
const sms = require('./lib/handlers/sms');
const fb = require('./lib/handlers/facebook');
const wa = require('./lib/handlers/whatsapp');

exports.handler = async (event) => {
  log.debug('Event', event);

  if (event.rawPath === undefined) {
    log.debug('SMS Request detected');
    await processSnsRequest(event);
  } else {
    log.debug('Digital channel Request detected');
    await processDigitalChannelRequest(event);
  }

  const response = {
    statusCode: 200,
    body: JSON.stringify({}),
  };
  return response;
};

const processDigitalChannelRequest = async (event) => {
  switch (event.rawPath) {
    case '/webhook/whatsapp':
      log.debug('WhatsApp channel detected.');
      validRequest = await wa.validateRequest(event);
      if (!validRequest) {
        log.warn('Invalid payload signature');
        return {
          statusCode: 403,
          body: 'Request validation failed',
        };
      }
      log.debug('Process event body');
      await wa.handler(event.body);
      break;
    case '/webhook/facebook':
      log.debug('Facebook channel detected.');
      validRequest = await fb.validateRequest(event);
      if (!validRequest) {
        log.warn('Invalid payload signature');
        return {
          statusCode: 403,
          body: 'Request validation failed',
        };
      }
      log.debug('Process event body');
      await fb.handler(event.body);
      break;
    default:
      log.warn(
        `Request path "${event.rawPath}" does not match any expected paths.`
      );
      break;
  }
};

const processSnsRequest = async (event) => {
  for (let i = 0; i < event.Records.length; i++) {
    const record = event.Records[i];

    if (record.EventSource === 'aws:sns') {
      await sms.handler(record.Sns.Message);
    }
  }
};
